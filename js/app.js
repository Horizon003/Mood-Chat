/* ============================================================
   MoodChat — Main application orchestrator
   ============================================================ */
import { getCurrentUser, signOut, onAuthChange } from "./auth.js";
import { getUser, initPresence, setOffline, watchIncomingCalls, clearIncoming } from "./data.js";
import { initNotifications, showLocalNotification } from "./notify.js";
import { $, $$, toast, avatarUrl, initMediaViewer } from "./ui.js";
import { showScreen, initAuthScreen, initProfileSetup } from "./screens.js";
import { initSidebarTabs, watchChats, watchStatusList, renderCallHistory, logCall, getChatsCache } from "./sidebar.js";
import { initConversation, openChat, closeConversation, getCurrentChat } from "./conversation.js";
import { initModals, setMeProfile, openNewChat, openNewGroup, openProfile, openStatusUpload, openStatusViewer, openChatInfo } from "./modals.js";
import { initGames, renderGamesGrid } from "./games.js";
import { startCall, acceptCall, declineIncoming, hangup } from "./calls.js";

let ME = null;       // supabase user
let PROFILE = null;  // firestore profile
let unsubChats = null, unsubStatus = null, unsubIncoming = null;

/* ---------------- BOOTSTRAP ---------------- */
async function boot() {
  initMediaViewer();
  preventZoom();

  initAuthScreen(async (user) => {
    ME = user;
    await routeAfterAuth();
  });

  // Auto-login
  try {
    const user = await getCurrentUser();
    if (user) {
      ME = user;
      await routeAfterAuth();
    } else {
      showScreen("auth-screen");
    }
  } catch (e) {
    console.warn(e);
    showScreen("auth-screen");
  }
}

async function routeAfterAuth() {
  showScreen("splash");
  const profile = await getUser(ME.id);
  if (!profile || !profile.name) {
    showScreen("profile-setup");
    initProfileSetup(ME, (p) => { PROFILE = p; enterApp(); });
  } else {
    PROFILE = profile;
    enterApp();
  }
}

/* ---------------- ENTER APP ---------------- */
async function enterApp() {
  showScreen("app");

  // header
  $("#me-name").textContent = PROFILE.name;
  $("#me-avatar").src = avatarUrl(PROFILE.photo, PROFILE.name);

  // init modules
  initSidebarTabs();
  initConversation(ME.id, PROFILE);
  initModals(ME.id, PROFILE);
  initGames(ME.id, PROFILE);
  renderGamesGrid($("#games-grid"));
  renderCallHistory();

  // presence + notifications
  initPresence(ME.id);
  initNotifications(ME.id);

  // realtime data
  let firstChatsLoad = true;
  let prevPreviews = {};
  unsubChats = watchChats(ME.id, (chatId) => openChatFlow(chatId));
  // notify on new messages (compare last messages)
  const origWatch = watchChats;

  unsubStatus = watchStatusList(ME.id, (group) => openStatusViewer(group));

  // incoming calls
  unsubIncoming = watchIncomingCalls(ME.id, (info) => {
    if (info) showIncomingCall(info);
    else removeIncomingBanner();
  });

  bindGlobalUI();
  watchForNewMessages();
}

/* ---------------- NEW MESSAGE NOTIFICATIONS ---------------- */
let lastSeenChatState = {};
function watchForNewMessages() {
  setInterval(() => {
    const chats = getChatsCache();
    chats.forEach((c) => {
      const key = c.id;
      const stamp = c.lastMessageAt?.toMillis ? c.lastMessageAt.toMillis() : 0;
      const prev = lastSeenChatState[key];
      if (prev !== undefined && stamp > prev && c.lastSender && c.lastSender !== ME.id) {
        const cur = getCurrentChat();
        if (!cur || cur.id !== c.id || document.hidden) {
          let name;
          if (c.type === "group") name = c.name;
          else {
            const other = (c.members || []).find((m) => m !== ME.id);
            name = (c.memberInfo || {})[other]?.name || "New message";
          }
          showLocalNotification(name, c.lastMessage || "New message");
        }
      }
      lastSeenChatState[key] = stamp;
    });
  }, 2500);
}

/* ---------------- CHAT FLOW ---------------- */
function openChatFlow(chatId) {
  openChat(chatId, {
    onCall: (chat, video) => initiateCall(chat, video),
    onInfo: (chat) => openChatInfo(chat, () => closeConversation()),
  });
}

/* ---------------- CALLS ---------------- */
async function initiateCall(chat, video) {
  if (chat.type === "group") { toast("Group calls coming soon — 1:1 only", ""); return; }
  const otherId = (chat.members || []).find((m) => m !== ME.id);
  const other = await getUser(otherId);
  if (!other) return toast("User unavailable", "error");
  logCall({ name: other.name, photo: other.photo, dir: "out", video, missed: false });
  await startCall(ME.id, PROFILE, otherId, other, video);
}

function showIncomingCall(info) {
  removeIncomingBanner();
  const b = document.createElement("div");
  b.className = "incoming-banner";
  b.id = "incoming-banner";
  b.innerHTML = `
    <img src="${avatarUrl(info.fromPhoto, info.fromName)}" />
    <div class="ib-body"><b>${info.fromName}</b><div class="muted">Incoming ${info.video ? "video" : "voice"} call…</div></div>
    <div class="ib-actions">
      <button class="ib-decline" id="ib-decline"><i class="fa-solid fa-phone-slash"></i></button>
      <button class="ib-accept" id="ib-accept"><i class="fa-solid fa-phone"></i></button>
    </div>`;
  document.body.appendChild(b);
  // simple ringtone via WebAudio
  ring();
  $("#ib-accept").onclick = async () => {
    stopRing();
    removeIncomingBanner();
    logCall({ name: info.fromName, photo: info.fromPhoto, dir: "in", video: info.video, missed: false });
    await acceptCall(ME.id, PROFILE, info);
  };
  $("#ib-decline").onclick = async () => {
    stopRing();
    removeIncomingBanner();
    logCall({ name: info.fromName, photo: info.fromPhoto, dir: "in", video: info.video, missed: true });
    await declineIncoming(ME.id, info);
  };
}
function removeIncomingBanner() { const b = $("#incoming-banner"); if (b) b.remove(); stopRing(); }

let ringOsc = null, ringCtx = null, ringInt = null;
function ring() {
  try {
    ringCtx = new (window.AudioContext || window.webkitAudioContext)();
    const beep = () => {
      const o = ringCtx.createOscillator(); const g = ringCtx.createGain();
      o.frequency.value = 480; o.connect(g); g.connect(ringCtx.destination);
      g.gain.setValueAtTime(0.001, ringCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.3, ringCtx.currentTime + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, ringCtx.currentTime + 0.5);
      o.start(); o.stop(ringCtx.currentTime + 0.5);
    };
    beep(); ringInt = setInterval(beep, 1500);
  } catch (_) {}
}
function stopRing() { if (ringInt) clearInterval(ringInt); ringInt = null; if (ringCtx) { ringCtx.close(); ringCtx = null; } }

/* ---------------- GLOBAL UI BINDINGS ---------------- */
function bindGlobalUI() {
  // main menu
  const menu = $("#main-menu");
  $("#menu-btn").onclick = (e) => { e.stopPropagation(); menu.classList.toggle("hidden"); };
  menu.querySelectorAll("button").forEach((b) => {
    b.onclick = () => {
      menu.classList.add("hidden");
      const a = b.dataset.action;
      if (a === "new-group") openNewGroup((id) => { switchTab("chats"); openChatFlow(id); });
      else if (a === "games") switchTab("games");
      else if (a === "profile") openProfile();
      else if (a === "logout") doLogout();
    };
  });

  $("#me-chip").onclick = () => openProfile();
  $("#new-chat-btn").onclick = () => openNewChat((id) => openChatFlow(id));
  $("#empty-new-chat").onclick = () => openNewChat((id) => openChatFlow(id));
  $("#new-status-btn").onclick = () => openStatusUpload();
  $("#status-myrow").onclick = () => {
    const mine = window.__statusGrouped && window.__statusGrouped[ME.id];
    if (mine) openStatusViewer(mine); else openStatusUpload();
  };

  // search
  $("#search-input").oninput = (e) => {
    const t = e.target.value.toLowerCase();
    $$("#chat-list .chat-item").forEach((li) => {
      const name = li.querySelector(".ci-name").textContent.toLowerCase();
      li.style.display = name.includes(t) ? "" : "none";
    });
  };

  // close dropdowns on outside click
  document.addEventListener("click", () => {
    $("#main-menu").classList.add("hidden");
    $("#conv-menu")?.classList.add("hidden");
    $("#attach-menu")?.classList.add("hidden");
  });
}

function switchTab(name) {
  $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  $$(".panel").forEach((p) => p.classList.toggle("active", p.id === `panel-${name}`));
}

async function doLogout() {
  if (!confirm("Log out of MoodChat?")) return;
  await setOffline(ME.id);
  if (unsubChats) unsubChats();
  if (unsubStatus) unsubStatus();
  if (unsubIncoming) unsubIncoming();
  await signOut();
  location.reload();
}

/* ---------------- ZOOM LOCK ---------------- */
function preventZoom() {
  // Block pinch-zoom gestures except inside media viewer
  const inViewer = (t) => t.closest && t.closest("#media-viewer");
  document.addEventListener("gesturestart", (e) => { if (!inViewer(e.target)) e.preventDefault(); }, { passive: false });
  document.addEventListener("gesturechange", (e) => { if (!inViewer(e.target)) e.preventDefault(); }, { passive: false });
  // Block double-tap zoom
  let lastTouch = 0;
  document.addEventListener("touchend", (e) => {
    const now = Date.now();
    if (now - lastTouch <= 300 && !inViewer(e.target)) e.preventDefault();
    lastTouch = now;
  }, { passive: false });
  // Block ctrl+wheel zoom
  document.addEventListener("wheel", (e) => { if (e.ctrlKey && !inViewer(e.target)) e.preventDefault(); }, { passive: false });
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && ["+", "-", "=", "0"].includes(e.key)) e.preventDefault();
  });
}

// graceful offline on close
window.addEventListener("beforeunload", () => { if (ME) setOffline(ME.id); });

boot();
