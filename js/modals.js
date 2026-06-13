/* ============================================================
   Modals: new chat, new group, profile, status, chat info
   ============================================================ */
import {
  getAllUsers, ensureDmChat, createGroup, getUser, upsertUser,
  postStatus, viewStatus, deleteStatus, leaveGroup, addGroupMembers,
} from "./data.js";
import { uploadToCloudinary } from "./cloudinary.js";
import { openModal, closeModal, $, esc, avatarUrl, toast, timeAgo } from "./ui.js";

let me, meProfile;
export function initModals(uid, profile) { me = uid; meProfile = profile; }
export function setMeProfile(p) { meProfile = p; }

/* ---------------- NEW CHAT ---------------- */
export async function openNewChat(onOpened) {
  const modal = openModal(`
    <div class="modal-head"><h3>New chat</h3><button class="icon-btn" id="nc-close"><i class="fa-solid fa-xmark"></i></button></div>
    <div class="modal-body">
      <input type="search" id="nc-search" placeholder="Search people by name or email" />
      <div id="nc-list"><div class="loading-row"><div class="spinner"></div></div></div>
    </div>`);
  $("#nc-close").onclick = closeModal;

  const users = (await getAllUsers()).filter((u) => u.uid !== me);
  const render = (term = "") => {
    const t = term.toLowerCase();
    const filtered = users.filter((u) => (u.name || "").toLowerCase().includes(t) || (u.email || "").toLowerCase().includes(t));
    const list = $("#nc-list");
    if (!filtered.length) { list.innerHTML = `<div class="empty-state"><p>No users found</p></div>`; return; }
    list.innerHTML = filtered.map((u) => `
      <div class="user-pick" data-uid="${u.uid}">
        <img class="avatar" src="${avatarUrl(u.photo, u.name)}" />
        <div class="ci-body"><b>${esc(u.name)}</b><div class="muted">${esc(u.about || u.email)}</div></div>
      </div>`).join("");
    list.querySelectorAll(".user-pick").forEach((el) => {
      el.onclick = async () => {
        const other = users.find((x) => x.uid === el.dataset.uid);
        try {
          const id = await ensureDmChat(me, other.uid, meProfile, other);
          closeModal();
          onOpened(id);
        } catch (e) { toast(e.message, "error"); }
      };
    });
  };
  render();
  $("#nc-search").oninput = (e) => render(e.target.value);
}

/* ---------------- NEW GROUP ---------------- */
export async function openNewGroup(onCreated) {
  let photoUrl = "";
  const selected = new Set();
  const users = (await getAllUsers()).filter((u) => u.uid !== me);

  const modal = openModal(`
    <div class="modal-head"><h3>New group</h3><button class="icon-btn" id="ng-close"><i class="fa-solid fa-xmark"></i></button></div>
    <div class="modal-body">
      <div class="dp-uploader"><label for="ng-dp" class="dp-circle" id="ng-dp-prev"><i class="fa-solid fa-camera"></i></label>
        <input type="file" id="ng-dp" accept="image/*" hidden /><small id="ng-dp-status"></small></div>
      <input type="text" id="ng-name" placeholder="Group name" />
      <div class="muted" style="margin:6px 0">Add members (<span id="ng-count">0</span>)</div>
      <div id="ng-list"></div>
    </div>
    <div class="modal-foot"><button class="btn-ghost" id="ng-cancel">Cancel</button>
      <button class="btn-primary" id="ng-create" style="margin:0"><span>Create</span></button></div>`);

  $("#ng-close").onclick = closeModal;
  $("#ng-cancel").onclick = closeModal;

  $("#ng-dp").onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    $("#ng-dp-status").textContent = "Uploading…";
    try {
      const r = await uploadToCloudinary(f, { folder: "moodchat/groups", resourceType: "image" });
      photoUrl = r.secureUrl;
      $("#ng-dp-prev").style.backgroundImage = `url(${photoUrl})`; $("#ng-dp-prev").innerHTML = "";
      $("#ng-dp-status").textContent = "✓";
    } catch (err) { toast(err.message, "error"); $("#ng-dp-status").textContent = ""; }
  };

  $("#ng-list").innerHTML = users.map((u) => `
    <div class="user-pick" data-uid="${u.uid}">
      <img class="avatar" src="${avatarUrl(u.photo, u.name)}" />
      <div class="ci-body"><b>${esc(u.name)}</b><div class="muted">${esc(u.email)}</div></div>
      <span class="check hidden"><i class="fa-solid fa-circle-check"></i></span>
    </div>`).join("");
  $("#ng-list").querySelectorAll(".user-pick").forEach((el) => {
    el.onclick = () => {
      const uid = el.dataset.uid;
      if (selected.has(uid)) { selected.delete(uid); el.classList.remove("selected"); el.querySelector(".check").classList.add("hidden"); }
      else { selected.add(uid); el.classList.add("selected"); el.querySelector(".check").classList.remove("hidden"); }
      $("#ng-count").textContent = selected.size;
    };
  });

  $("#ng-create").onclick = async () => {
    const name = $("#ng-name").value.trim();
    if (!name) return toast("Enter a group name", "error");
    if (!selected.size) return toast("Select at least one member", "error");
    const members = [me, ...selected];
    const memberInfo = { [me]: { name: meProfile.name, photo: meProfile.photo || "" } };
    members.forEach((uid) => {
      if (uid === me) return;
      const u = users.find((x) => x.uid === uid);
      memberInfo[uid] = { name: u.name, photo: u.photo || "" };
    });
    try {
      const id = await createGroup(name, photoUrl, members, memberInfo, me);
      closeModal();
      onCreated(id);
    } catch (e) { toast(e.message, "error"); }
  };
}

/* ---------------- PROFILE ---------------- */
export async function openProfile() {
  const u = await getUser(me) || meProfile;
  let photoUrl = u.photo || "";
  const modal = openModal(`
    <div class="modal-head"><h3>Profile</h3><button class="icon-btn" id="pf-close"><i class="fa-solid fa-xmark"></i></button></div>
    <div class="modal-body profile-view">
      <label for="pf-dp"><img class="big-dp" id="pf-dp-img" src="${avatarUrl(photoUrl, u.name)}" style="cursor:pointer" /></label>
      <input type="file" id="pf-dp" accept="image/*" hidden />
      <small id="pf-dp-status" class="muted"></small>
      <div style="text-align:left;margin-top:14px">
        <label class="muted">Name</label>
        <input type="text" id="pf-name" value="${esc(u.name || "")}" />
        <label class="muted">About</label>
        <input type="text" id="pf-about" value="${esc(u.about || "")}" />
        <label class="muted">Email</label>
        <input type="text" value="${esc(u.email || "")}" disabled style="opacity:.6" />
      </div>
    </div>
    <div class="modal-foot"><button class="btn-ghost" id="pf-cancel">Close</button>
      <button class="btn-primary" id="pf-save" style="margin:0"><span>Save</span></button></div>`);
  $("#pf-close").onclick = closeModal;
  $("#pf-cancel").onclick = closeModal;
  $("#pf-dp").onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    $("#pf-dp-status").textContent = "Uploading…";
    try {
      const r = await uploadToCloudinary(f, { folder: "moodchat/avatars", resourceType: "image" });
      photoUrl = r.secureUrl; $("#pf-dp-img").src = photoUrl; $("#pf-dp-status").textContent = "✓ Uploaded";
    } catch (err) { toast(err.message, "error"); $("#pf-dp-status").textContent = ""; }
  };
  $("#pf-save").onclick = async () => {
    const name = $("#pf-name").value.trim();
    if (!name) return toast("Name required", "error");
    try {
      const updated = await upsertUser(me, { name, about: $("#pf-about").value.trim(), photo: photoUrl });
      meProfile = updated;
      $("#me-name").textContent = updated.name;
      $("#me-avatar").src = avatarUrl(updated.photo, updated.name);
      toast("Profile updated", "success");
      closeModal();
    } catch (e) { toast(e.message, "error"); }
  };
}

/* ---------------- STATUS UPLOAD ---------------- */
export function openStatusUpload(onPosted) {
  const modal = openModal(`
    <div class="modal-head"><h3>Add status</h3><button class="icon-btn" id="su-close"><i class="fa-solid fa-xmark"></i></button></div>
    <div class="modal-body" style="text-align:center">
      <p class="muted" style="margin-bottom:14px">Share a photo or video. Disappears after 24 hours.</p>
      <input type="file" id="su-file" accept="image/*,video/*" hidden />
      <button class="btn-primary" id="su-pick" style="width:100%"><span><i class="fa-solid fa-image"></i> Choose photo / video</span></button>
      <div id="su-progress" class="muted" style="margin-top:14px"></div>
    </div>`);
  $("#su-close").onclick = closeModal;
  $("#su-pick").onclick = () => $("#su-file").click();
  $("#su-file").onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const isVideo = f.type.startsWith("video");
    $("#su-progress").textContent = "Uploading…";
    try {
      const r = await uploadToCloudinary(f, {
        folder: "moodchat/status", resourceType: isVideo ? "video" : "image",
        onProgress: (p) => $("#su-progress").textContent = `Uploading… ${p}%`,
      });
      await postStatus(me, meProfile, { type: isVideo ? "video" : "image", url: r.secureUrl });
      toast("Status posted", "success");
      closeModal();
      onPosted && onPosted();
    } catch (err) { toast(err.message, "error"); $("#su-progress").textContent = ""; }
  };
}

/* ---------------- STATUS VIEWER ---------------- */
export function openStatusViewer(group) {
  let idx = 0;
  const items = group.items.slice().reverse(); // oldest first
  const modal = openModal(`
    <div class="modal-head"><h3>${esc(group.name)}</h3><button class="icon-btn" id="sv-close"><i class="fa-solid fa-xmark"></i></button></div>
    <div class="modal-body" style="text-align:center;padding:0;background:#000">
      <div id="sv-bars" style="display:flex;gap:4px;padding:8px"></div>
      <div id="sv-media" style="min-height:300px;display:flex;align-items:center;justify-content:center"></div>
      ${group.uid === me ? `<button class="btn-ghost" id="sv-delete" style="margin:10px">Delete this status</button>` : ""}
    </div>`, { className: "doodle-modal" });
  $("#sv-close").onclick = closeModal;

  function show() {
    const item = items[idx];
    $("#sv-bars").innerHTML = items.map((_, i) => `<div style="flex:1;height:3px;border-radius:3px;background:${i <= idx ? "var(--accent)" : "var(--panel-3)"}"></div>`).join("");
    const m = item.media;
    $("#sv-media").innerHTML = m.type === "video"
      ? `<video src="${esc(m.url)}" controls autoplay playsinline style="max-width:100%;max-height:70vh"></video>`
      : `<img src="${esc(m.url)}" style="max-width:100%;max-height:70vh" />`;
    if (group.uid !== me) viewStatus(item.id, me);
    const del = $("#sv-delete");
    if (del) del.onclick = async () => { await deleteStatus(item.id); toast("Deleted"); closeModal(); };
  }
  $("#sv-media").onclick = () => { idx = (idx + 1) % items.length; show(); };
  show();
}

/* ---------------- CHAT INFO ---------------- */
export async function openChatInfo(chat, onChanged) {
  const isGroup = chat.type === "group";
  let name, photo;
  if (isGroup) { name = chat.name; photo = chat.photo; }
  else {
    const otherId = (chat.members || []).find((m) => m !== me);
    const info = (chat.memberInfo || {})[otherId] || {};
    name = info.name; photo = info.photo;
    const full = await getUser(otherId);
    if (full) { name = full.name; photo = full.photo; }
    openModal(`
      <div class="modal-head"><h3>Contact info</h3><button class="icon-btn" id="ci-close"><i class="fa-solid fa-xmark"></i></button></div>
      <div class="modal-body profile-view">
        <img class="big-dp" src="${avatarUrl(photo, name)}" />
        <h3>${esc(name)}</h3>
        <p class="muted">${esc(full?.about || "")}</p>
        <p class="muted">${esc(full?.email || "")}</p>
      </div>`);
    $("#ci-close").onclick = closeModal;
    return;
  }

  const memberList = (chat.members || []).map((uid) => {
    const i = (chat.memberInfo || {})[uid] || {};
    const isAdmin = (chat.admins || []).includes(uid);
    return `<div class="user-pick"><img class="avatar" src="${avatarUrl(i.photo, i.name)}" />
      <div class="ci-body"><b>${esc(i.name || "User")} ${uid === me ? "(You)" : ""}</b>
      <div class="muted">${isAdmin ? "Admin" : "Member"}</div></div></div>`;
  }).join("");

  openModal(`
    <div class="modal-head"><h3>Group info</h3><button class="icon-btn" id="gi-close"><i class="fa-solid fa-xmark"></i></button></div>
    <div class="modal-body profile-view">
      <img class="big-dp" src="${avatarUrl(photo, name)}" />
      <h3>${esc(name)}</h3>
      <p class="muted">${(chat.members || []).length} members</p>
      <div style="text-align:left;margin-top:16px">${memberList}</div>
      <button class="btn-ghost" id="gi-leave" style="margin-top:16px;color:var(--danger)">Leave group</button>
    </div>`);
  $("#gi-close").onclick = closeModal;
  $("#gi-leave").onclick = async () => {
    if (!confirm("Leave this group?")) return;
    await leaveGroup(chat.id, me);
    toast("You left the group");
    closeModal();
    onChanged && onChanged();
  };
}
