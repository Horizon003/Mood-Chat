/* ============================================================
   Sidebar: chat list, status list, calls, presence rendering
   ============================================================ */
import { watchMyChats, watchStatuses, getAllUsers, watchPresence } from "./data.js";
import { $, esc, avatarUrl, fmtTime, timeAgo } from "./ui.js";

let chatsCache = [];
const presenceUnsubs = {};

export function getChatsCache() { return chatsCache; }

export function initSidebarTabs() {
  $$(".tab").forEach((tab) => {
    tab.onclick = () => {
      $$(".tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      $$(".panel").forEach((p) => p.classList.remove("active"));
      $(`#panel-${tab.dataset.tab}`).classList.add("active");
    };
  });
}
function $$(s) { return [...document.querySelectorAll(s)]; }

export function watchChats(me, onOpenChat) {
  return watchMyChats(me, (chats) => {
    chatsCache = chats;
    renderChatList(chats, me, onOpenChat);
  });
}

function renderChatList(chats, me, onOpenChat) {
  const list = $("#chat-list");
  const empty = $("#chats-empty");
  if (!chats.length) {
    list.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");
  list.innerHTML = chats.map((c) => {
    const isGroup = c.type === "group";
    let name, photo, otherId = null;
    if (isGroup) { name = c.name; photo = c.photo; }
    else {
      otherId = (c.members || []).find((m) => m !== me);
      const info = (c.memberInfo || {})[otherId] || {};
      name = info.name || "User"; photo = info.photo;
    }
    const unread = (c.unread || {})[me] || 0;
    const time = c.lastMessageAt ? fmtTime(c.lastMessageAt) : "";
    return `
      <li class="chat-item" data-id="${c.id}" ${otherId ? `data-other="${otherId}"` : ""}>
        <img class="avatar" src="${avatarUrl(photo, name)}" alt="" />
        <div class="ci-body">
          <div class="ci-top"><span class="ci-name">${esc(name)} ${isGroup ? '<i class="fa-solid fa-users" style="font-size:11px;color:var(--muted)"></i>' : ""}</span><span class="ci-time">${time}</span></div>
          <div class="ci-bottom">
            <span class="ci-preview">${esc(c.lastMessage || "Tap to chat")}</span>
            ${unread ? `<span class="badge">${unread}</span>` : ""}
          </div>
        </div>
      </li>`;
  }).join("");

  list.querySelectorAll(".chat-item").forEach((li) => {
    li.onclick = () => {
      list.querySelectorAll(".chat-item").forEach((x) => x.classList.remove("active"));
      li.classList.add("active");
      onOpenChat(li.dataset.id);
    };
  });
}

/* ---------------- STATUS LIST ---------------- */
export function watchStatusList(me, onOpenStatus) {
  return watchStatuses((statuses) => {
    const grouped = {};
    statuses.forEach((s) => {
      if (!grouped[s.uid]) grouped[s.uid] = { uid: s.uid, name: s.name, photo: s.photo, items: [] };
      grouped[s.uid].items.push(s);
    });

    // My status row
    const mine = grouped[me];
    const myAvatar = $("#status-my-avatar");
    const mySub = $("#status-my-sub");
    if (mine) {
      myAvatar.src = avatarUrl(mine.photo, mine.name);
      mySub.textContent = `${mine.items.length} update${mine.items.length > 1 ? "s" : ""} · tap to view`;
    } else {
      mySub.textContent = "Tap to add status update";
    }

    const others = Object.values(grouped).filter((g) => g.uid !== me);
    const list = $("#status-list");
    const empty = $("#status-empty");
    if (!others.length) { list.innerHTML = ""; empty.classList.remove("hidden"); return; }
    empty.classList.add("hidden");
    list.innerHTML = others.map((g) => {
      const last = g.items[0];
      const seen = (last.viewers || []).includes(me);
      return `<li class="status-item" data-uid="${g.uid}">
        <div class="status-ring ${seen ? "" : "unseen"}"><img src="${avatarUrl(g.photo, g.name)}" /></div>
        <div><b>${esc(g.name)}</b><div class="muted">${timeAgo(last.expiresAt - 24*60*60*1000)}</div></div>
      </li>`;
    }).join("");
    list.querySelectorAll(".status-item").forEach((li) => {
      li.onclick = () => onOpenStatus(grouped[li.dataset.uid]);
    });
    window.__statusGrouped = grouped;
  });
}

/* ---------------- CALL LIST (from localStorage history) ---------------- */
export function renderCallHistory() {
  const list = $("#call-list");
  const empty = $("#calls-empty");
  const hist = JSON.parse(localStorage.getItem("moodchat_calls") || "[]");
  if (!hist.length) { list.innerHTML = ""; empty.classList.remove("hidden"); return; }
  empty.classList.add("hidden");
  list.innerHTML = hist.slice(0, 50).map((h) => `
    <li class="call-item">
      <img class="avatar" src="${avatarUrl(h.photo, h.name)}" />
      <div class="ci-body"><b>${esc(h.name)}</b>
        <div class="dir ${h.missed ? "missed" : ""}">
          <i class="fa-solid fa-arrow-${h.dir === "out" ? "up" : "down"}"></i>
          ${h.video ? "Video" : "Voice"} · ${timeAgo(h.at)}
        </div>
      </div>
      <i class="fa-solid fa-${h.video ? "video" : "phone"}" style="color:var(--accent)"></i>
    </li>`).join("");
}

export function logCall(entry) {
  const hist = JSON.parse(localStorage.getItem("moodchat_calls") || "[]");
  hist.unshift({ ...entry, at: Date.now() });
  localStorage.setItem("moodchat_calls", JSON.stringify(hist.slice(0, 50)));
  renderCallHistory();
}
