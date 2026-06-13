/* ============================================================
   Conversation view: messages, composer, typing, seen, media
   ============================================================ */
import {
  getChat, watchChat, watchMessages, sendMessage, markChatRead, markMessagesSeen,
  setTyping, watchTyping, deleteMessage, addReaction, getUser, watchPresence,
} from "./data.js";
import { uploadToCloudinary, dataUrlToBlob, cldThumb } from "./cloudinary.js";
import { openDoodle } from "./doodle.js";
import { $, esc, avatarUrl, fmtTime, fmtDay, toast, openMedia, timeAgo } from "./ui.js";

let me, meProfile, current = null;
let unsubMsgs = null, unsubChat = null, unsubTyping = null, unsubPresence = null;
let typingTimer = null;

const STICKERS = ["😀","😂","🥰","😎","😭","😡","👍","🙏","🎉","🔥","💯","❤️","🤣","😴","🤔","🙄","😱","🥳","💀","👀","✨","🌚","🤝","🫶"];
const EMOJIS = ["😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇","🙂","🙃","😉","😌","😍","🥰","😘","😗","😙","😚","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🥸","🤩","🥳","😏","😒","😞","😔","😟","😕","🙁","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🫡","🤭","🫢","🤫","🤥","😶","😐","😑","😬","🙄","😯","😦","😧","😮","😲","🥱","😴","🤤","😪","😵","🤐","🥴","🤢","🤮","🤧","😷","🤒","🤕","👍","👎","👊","✊","🤞","🙏","👏","🙌","💪","❤️","🧡","💛","💚","💙","💜","🖤","🤍","💔","💯","🔥","✨","🎉","🎊","💫"];

export function initConversation(uid, profile) { me = uid; meProfile = profile; }

export function closeConversation() {
  cleanup();
  current = null;
  $("#conv-active").classList.add("hidden");
  $("#conv-placeholder").classList.remove("hidden");
  $("#app").classList.remove("show-conv");
}

function cleanup() {
  if (unsubMsgs) unsubMsgs();
  if (unsubChat) unsubChat();
  if (unsubTyping) unsubTyping();
  if (unsubPresence) unsubPresence();
  unsubMsgs = unsubChat = unsubTyping = unsubPresence = null;
}

export async function openChat(chatId, callHandlers) {
  cleanup();
  const chat = await getChat(chatId);
  if (!chat) { toast("Chat not found", "error"); return; }
  current = chat;

  $("#conv-placeholder").classList.add("hidden");
  $("#conv-active").classList.remove("hidden");
  $("#app").classList.add("show-conv");

  renderHeader(chat, callHandlers);
  markChatRead(chatId, me);

  unsubChat = watchChat(chatId, (c) => { if (c) { current = c; } });

  const msgBox = $("#messages");
  msgBox.innerHTML = `<div class="loading-row"><div class="spinner"></div> Loading messages…</div>`;

  unsubMsgs = watchMessages(chatId, (msgs) => {
    renderMessages(msgs, chat);
    markChatRead(chatId, me);
    // mark unseen incoming as seen
    const toSee = msgs.filter((m) => m.sender !== me && !(m.seenBy || []).includes(me)).map((m) => m.id);
    if (toSee.length) markMessagesSeen(chatId, me, toSee);
  });

  unsubTyping = watchTyping(chatId, me, (typers) => {
    const bar = $("#typing-bar");
    if (typers.length) {
      const names = typers.map((u) => (chat.memberInfo || {})[u]?.name || "Someone");
      bar.textContent = chat.type === "group" ? `${names.join(", ")} typing…` : "typing…";
      bar.classList.remove("hidden");
    } else bar.classList.add("hidden");
  });

  setupComposer(chatId);
}

function renderHeader(chat, callHandlers) {
  const isGroup = chat.type === "group";
  let name, photo, otherId = null;
  if (isGroup) { name = chat.name; photo = chat.photo; }
  else {
    otherId = (chat.members || []).find((m) => m !== me);
    const info = (chat.memberInfo || {})[otherId] || {};
    name = info.name || "User"; photo = info.photo;
  }
  $("#conv-avatar").src = avatarUrl(photo, name);
  $("#conv-title").textContent = name;
  const sub = $("#conv-sub");

  if (isGroup) {
    sub.textContent = `${(chat.members || []).length} members`;
    sub.style.color = "var(--muted)";
  } else if (otherId) {
    if (unsubPresence) unsubPresence();
    unsubPresence = watchPresence(otherId, (p) => {
      if (p.state === "online") { sub.textContent = "online"; sub.style.color = "var(--accent)"; }
      else { sub.textContent = p.lastSeen ? `last seen ${timeAgo(p.lastSeen)}` : "offline"; sub.style.color = "var(--muted)"; }
    });
  }

  // Calls
  $("#call-voice").onclick = () => callHandlers.onCall(chat, false);
  $("#call-video").onclick = () => callHandlers.onCall(chat, true);

  // Conv menu
  const menu = $("#conv-menu");
  $("#conv-menu-btn").onclick = (e) => { e.stopPropagation(); menu.classList.toggle("hidden"); };
  $("#conv-open-info").onclick = () => callHandlers.onInfo(chat);
  menu.querySelectorAll("button").forEach((b) => {
    b.onclick = () => {
      menu.classList.add("hidden");
      if (b.dataset.action === "view-info") callHandlers.onInfo(chat);
      else if (b.dataset.action === "clear") { $("#messages").innerHTML = `<div class="day-sep">Messages cleared locally</div>`; }
    };
  });
  $("#conv-back").onclick = () => closeConversation();
}

function renderMessages(msgs, chat) {
  const box = $("#messages");
  const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
  let html = "";
  let lastDay = "";
  msgs.forEach((m) => {
    const day = fmtDay(m.createdAt);
    if (day && day !== lastDay) { html += `<div class="day-sep">${day}</div>`; lastDay = day; }
    html += renderBubble(m, chat);
  });
  box.innerHTML = html || `<div class="day-sep">No messages yet — say hi 👋</div>`;

  // bind media + reactions
  box.querySelectorAll("[data-media]").forEach((el) => {
    el.onclick = () => openMedia(el.dataset.mtype, el.dataset.media);
  });
  box.querySelectorAll(".react-trigger").forEach((el) => {
    el.onclick = (e) => { e.stopPropagation(); reactPicker(chat.id, el.dataset.mid); };
  });

  if (atBottom) box.scrollTop = box.scrollHeight;
}

function renderBubble(m, chat) {
  const out = m.sender === me;
  const isGroup = chat.type === "group";
  const senderName = isGroup && !out ? `<div class="sender-name">${esc((chat.memberInfo || {})[m.sender]?.name || "User")}</div>` : "";
  const time = fmtTime(m.createdAt);
  const allMembers = (chat.members || []).filter((x) => x !== m.sender);
  const seenByAll = allMembers.length && allMembers.every((u) => (m.seenBy || []).includes(u));
  const ticks = out ? `<span class="ticks ${seenByAll ? "seen" : ""}"><i class="fa-solid fa-check-double"></i></span>` : "";
  const reaction = m.reactions ? Object.values(m.reactions)[0] : null;
  const reactEl = reaction ? `<span class="reaction">${reaction}</span>` : "";
  const trigger = `<span class="react-trigger" data-mid="${m.id}"><i class="fa-regular fa-face-smile"></i></span>`;

  if (m.deleted || m.type === "deleted") {
    return `<div class="msg ${out ? "out" : "in"} deleted">🚫 This message was deleted<div class="meta">${time}</div></div>`;
  }

  let body = "";
  const md = m.media || {};
  switch (m.type) {
    case "image":
      body = `${senderName}<img class="media" data-media="${esc(md.url)}" data-mtype="image" src="${esc(cldThumb(md.url, 500))}" alt="photo" />`;
      break;
    case "doodle":
      body = `${senderName}<img class="media doodle-media" data-media="${esc(md.url)}" data-mtype="image" src="${esc(cldThumb(md.url, 500))}" alt="doodle" />`;
      break;
    case "video":
      body = `${senderName}<video class="media" data-media="${esc(md.url)}" data-mtype="video" src="${esc(md.url)}#t=0.1" preload="metadata"></video>`;
      break;
    case "sticker":
      return `<div class="msg ${out ? "out" : "in"} sticker-msg">${senderName}<div class="sticker" style="font-size:90px;text-align:center">${esc(m.text)}</div><div class="meta">${time} ${ticks}</div>${reactEl}${trigger}</div>`;
    default:
      body = `${senderName}${esc(m.text).replace(/\n/g, "<br>")}`;
  }
  return `<div class="msg ${out ? "out" : "in"}">${body}<div class="meta">${time} ${ticks}</div>${reactEl}${trigger}</div>`;
}

function reactPicker(chatId, mid) {
  const quick = ["❤️","😂","👍","😮","😢","🙏"];
  const host = document.createElement("div");
  host.className = "modal-root";
  host.innerHTML = `<div class="modal" style="max-width:320px"><div class="modal-body"><div class="emoji-grid" style="grid-template-columns:repeat(6,1fr)">${quick.map((e) => `<button data-e="${e}">${e}</button>`).join("")}</div></div></div>`;
  document.body.appendChild(host);
  host.onclick = (e) => { if (e.target === host) host.remove(); };
  host.querySelectorAll("button").forEach((b) => {
    b.onclick = async () => { await addReaction(chatId, mid, me, b.dataset.e); host.remove(); };
  });
}

/* ---------------- COMPOSER ---------------- */
function setupComposer(chatId) {
  const input = $("#msg-input");
  const sendBtn = $("#send-btn");

  input.value = "";
  input.oninput = () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 120) + "px";
    setTyping(chatId, me, true);
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => setTyping(chatId, me, false), 2500);
  };
  input.onkeydown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); }
  };
  sendBtn.onclick = doSend;

  async function doSend() {
    const text = input.value.trim();
    if (!text) return;
    input.value = ""; input.style.height = "auto";
    setTyping(chatId, me, false);
    try {
      await sendMessage(chatId, { sender: me, type: "text", text });
    } catch (e) { toast("Failed to send", "error"); }
  }

  // Attach menu
  const attachMenu = $("#attach-menu");
  $("#attach-btn").onclick = (e) => { e.stopPropagation(); attachMenu.classList.toggle("hidden"); };
  attachMenu.querySelectorAll("button").forEach((b) => {
    b.onclick = () => {
      attachMenu.classList.add("hidden");
      const kind = b.dataset.attach;
      if (kind === "image") $("#file-image").click();
      else if (kind === "video") $("#file-video").click();
      else if (kind === "doodle") openDoodle((dataUrl) => sendDoodle(chatId, dataUrl));
      else if (kind === "sticker") openStickerPicker(chatId);
    };
  });

  $("#file-image").onchange = (e) => handleFile(chatId, e.target.files[0], "image");
  $("#file-video").onchange = (e) => handleFile(chatId, e.target.files[0], "video");

  // Emoji
  $("#emoji-btn").onclick = () => openEmojiPicker(input);
}

async function handleFile(chatId, file, type) {
  if (!file) return;
  const prog = $("#upload-progress");
  prog.classList.remove("hidden");
  const bar = prog.querySelector(".bar");
  const label = prog.querySelector("span");
  label.textContent = `Uploading ${type}…`;
  try {
    const res = await uploadToCloudinary(file, {
      folder: `moodchat/${type}s`,
      resourceType: type === "video" ? "video" : "image",
      onProgress: (p) => { bar.style.setProperty("--p", p + "%"); label.textContent = `Uploading… ${p}%`; },
    });
    await sendMessage(chatId, {
      sender: me, type,
      media: { url: res.secureUrl, width: res.width, height: res.height, duration: res.duration },
    });
  } catch (e) {
    toast(e.message || "Upload failed", "error");
  } finally {
    prog.classList.add("hidden");
    bar.style.setProperty("--p", "0%");
    $("#file-image").value = ""; $("#file-video").value = "";
  }
}

async function sendDoodle(chatId, dataUrl) {
  const prog = $("#upload-progress");
  prog.classList.remove("hidden");
  prog.querySelector("span").textContent = "Uploading doodle…";
  try {
    const blob = dataUrlToBlob(dataUrl);
    const res = await uploadToCloudinary(blob, {
      folder: "moodchat/doodles", resourceType: "image",
      onProgress: (p) => prog.querySelector(".bar").style.setProperty("--p", p + "%"),
    });
    await sendMessage(chatId, { sender: me, type: "doodle", media: { url: res.secureUrl } });
  } catch (e) { toast(e.message, "error"); }
  finally { prog.classList.add("hidden"); }
}

function openStickerPicker(chatId) {
  const host = document.createElement("div");
  host.className = "modal-root";
  host.innerHTML = `<div class="modal" style="max-width:380px">
    <div class="modal-head"><h3>Stickers</h3><button class="icon-btn" id="st-close"><i class="fa-solid fa-xmark"></i></button></div>
    <div class="modal-body"><div class="sticker-grid">${STICKERS.map((s) => `<button data-s="${s}">${s}</button>`).join("")}</div></div></div>`;
  document.body.appendChild(host);
  host.onclick = (e) => { if (e.target === host) host.remove(); };
  host.querySelector("#st-close").onclick = () => host.remove();
  host.querySelectorAll(".sticker-grid button").forEach((b) => {
    b.onclick = async () => { host.remove(); await sendMessage(chatId, { sender: me, type: "sticker", text: b.dataset.s }); };
  });
}

function openEmojiPicker(input) {
  const host = document.createElement("div");
  host.className = "modal-root";
  host.innerHTML = `<div class="modal" style="max-width:420px">
    <div class="modal-head"><h3>Emoji</h3><button class="icon-btn" id="em-close"><i class="fa-solid fa-xmark"></i></button></div>
    <div class="modal-body"><div class="emoji-grid">${EMOJIS.map((e) => `<button data-e="${e}">${e}</button>`).join("")}</div></div></div>`;
  document.body.appendChild(host);
  host.onclick = (e) => { if (e.target === host) host.remove(); };
  host.querySelector("#em-close").onclick = () => host.remove();
  host.querySelectorAll(".emoji-grid button").forEach((b) => {
    b.onclick = () => { input.value += b.dataset.e; input.focus(); };
  });
}

export function getCurrentChat() { return current; }
