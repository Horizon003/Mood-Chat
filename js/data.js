/* ============================================================
   MoodChat Data Layer
   Firestore: persistent (users, chats, messages, groups, status, games)
   Realtime DB: ephemeral (presence, typing, calls signaling, game live state)
   ============================================================ */
import {
  db, rtdb,
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, onSnapshot, serverTimestamp, arrayUnion,
  arrayRemove, writeBatch, increment,
  ref, set, get, update, remove, onValue, onDisconnect, rtdbServerTimestamp,
  rtdbPush,
} from "./firebase.js";

/* ---------------- USERS ---------------- */

export async function upsertUser(uid, profile) {
  const uref = doc(db, "users", uid);
  const snap = await getDoc(uref);
  if (snap.exists()) {
    await updateDoc(uref, { ...profile, updatedAt: serverTimestamp() });
  } else {
    await setDoc(uref, {
      uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...profile,
    });
  }
  return (await getDoc(uref)).data();
}

export async function getUser(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

export async function getUserByEmail(email) {
  const q = query(collection(db, "users"), where("email", "==", email.toLowerCase()));
  const snap = await getDocs(q);
  return snap.empty ? null : snap.docs[0].data();
}

export function watchUser(uid, cb) {
  return onSnapshot(doc(db, "users", uid), (s) => cb(s.exists() ? s.data() : null));
}

export async function searchUsers(term) {
  // simple prefix-ish search on name & email
  const snap = await getDocs(query(collection(db, "users"), limit(200)));
  const t = term.toLowerCase().trim();
  return snap.docs.map((d) => d.data()).filter((u) =>
    (u.name || "").toLowerCase().includes(t) ||
    (u.email || "").toLowerCase().includes(t)
  );
}

export async function getAllUsers() {
  const snap = await getDocs(query(collection(db, "users"), limit(500)));
  return snap.docs.map((d) => d.data());
}

/* ---------------- PRESENCE (RTDB) ---------------- */

export function initPresence(uid) {
  const statusRef = ref(rtdb, `presence/${uid}`);
  const connRef = ref(rtdb, ".info/connected");
  onValue(connRef, (snap) => {
    if (snap.val() === false) return;
    onDisconnect(statusRef).set({ state: "offline", lastSeen: Date.now() })
      .then(() => set(statusRef, { state: "online", lastSeen: Date.now() }));
  });
}

export function watchPresence(uid, cb) {
  return onValue(ref(rtdb, `presence/${uid}`), (s) => cb(s.val() || { state: "offline", lastSeen: 0 }));
}

export async function setOffline(uid) {
  try { await set(ref(rtdb, `presence/${uid}`), { state: "offline", lastSeen: Date.now() }); } catch (_) {}
}

/* ---------------- CHATS ---------------- */
// chatId for 1:1 = sorted uids joined; group = auto id

export function dmId(a, b) {
  return [a, b].sort().join("__");
}

export async function ensureDmChat(me, other, meProfile, otherProfile) {
  const id = dmId(me, other);
  const cref = doc(db, "chats", id);
  const snap = await getDoc(cref);
  if (!snap.exists()) {
    await setDoc(cref, {
      id,
      type: "dm",
      members: [me, other],
      memberInfo: {
        [me]: { name: meProfile.name, photo: meProfile.photo || "" },
        [other]: { name: otherProfile.name, photo: otherProfile.photo || "" },
      },
      lastMessage: "",
      lastMessageAt: serverTimestamp(),
      lastSender: "",
      unread: { [me]: 0, [other]: 0 },
      createdAt: serverTimestamp(),
    });
  }
  return id;
}

export async function createGroup(name, photo, members, memberInfo, ownerUid) {
  const cref = await addDoc(collection(db, "chats"), {
    type: "group",
    name,
    photo: photo || "",
    members,
    memberInfo,
    admins: [ownerUid],
    owner: ownerUid,
    lastMessage: "",
    lastMessageAt: serverTimestamp(),
    lastSender: "",
    unread: members.reduce((o, m) => ((o[m] = 0), o), {}),
    createdAt: serverTimestamp(),
  });
  await updateDoc(cref, { id: cref.id });
  return cref.id;
}

export function watchMyChats(uid, cb) {
  const q = query(
    collection(db, "chats"),
    where("members", "array-contains", uid),
    orderBy("lastMessageAt", "desc")
  );
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => { console.warn("watchMyChats", err); cb([]); });
}

export async function getChat(chatId) {
  const s = await getDoc(doc(db, "chats", chatId));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

export function watchChat(chatId, cb) {
  return onSnapshot(doc(db, "chats", chatId), (s) => cb(s.exists() ? { id: s.id, ...s.data() } : null));
}

export async function updateGroup(chatId, patch) {
  await updateDoc(doc(db, "chats", chatId), patch);
}

export async function addGroupMembers(chatId, uids, memberInfoPatch) {
  const cref = doc(db, "chats", chatId);
  const snap = await getDoc(cref);
  const data = snap.data();
  const info = { ...(data.memberInfo || {}), ...memberInfoPatch };
  const unread = { ...(data.unread || {}) };
  uids.forEach((u) => { if (!(u in unread)) unread[u] = 0; });
  await updateDoc(cref, { members: arrayUnion(...uids), memberInfo: info, unread });
}

export async function removeGroupMember(chatId, uid) {
  await updateDoc(doc(db, "chats", chatId), { members: arrayRemove(uid) });
}

export async function leaveGroup(chatId, uid) {
  await removeGroupMember(chatId, uid);
}

/* ---------------- MESSAGES ---------------- */

export async function sendMessage(chatId, msg) {
  const mref = collection(db, "chats", chatId, "messages");
  const created = await addDoc(mref, {
    ...msg,
    createdAt: serverTimestamp(),
    seenBy: [msg.sender],
  });
  // update chat preview + unread counts
  const chat = await getChat(chatId);
  const unread = { ...(chat.unread || {}) };
  (chat.members || []).forEach((m) => {
    if (m !== msg.sender) unread[m] = (unread[m] || 0) + 1;
  });
  await updateDoc(doc(db, "chats", chatId), {
    lastMessage: msg.preview || previewFor(msg),
    lastMessageAt: serverTimestamp(),
    lastSender: msg.sender,
    unread,
  });
  return created.id;
}

function previewFor(msg) {
  switch (msg.type) {
    case "image": return "📷 Photo";
    case "video": return "🎥 Video";
    case "doodle": return "🎨 Doodle";
    case "sticker": return "🩷 Sticker";
    case "audio": return "🎤 Voice message";
    default: return msg.text || "";
  }
}

export function watchMessages(chatId, cb, max = 200) {
  const q = query(
    collection(db, "chats", chatId, "messages"),
    orderBy("createdAt", "asc"),
    limit(max)
  );
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => { console.warn("watchMessages", err); cb([]); });
}

export async function markChatRead(chatId, uid) {
  const cref = doc(db, "chats", chatId);
  const snap = await getDoc(cref);
  if (!snap.exists()) return;
  const unread = { ...(snap.data().unread || {}) };
  unread[uid] = 0;
  await updateDoc(cref, { unread });
}

export async function markMessagesSeen(chatId, uid, messageIds) {
  if (!messageIds.length) return;
  const batch = writeBatch(db);
  messageIds.forEach((mid) => {
    batch.update(doc(db, "chats", chatId, "messages", mid), { seenBy: arrayUnion(uid) });
  });
  await batch.commit();
}

export async function deleteMessage(chatId, messageId) {
  await updateDoc(doc(db, "chats", chatId, "messages", messageId), {
    deleted: true, text: "", media: null, type: "deleted",
  });
}

export async function addReaction(chatId, messageId, uid, emoji) {
  await updateDoc(doc(db, "chats", chatId, "messages", messageId), {
    [`reactions.${uid}`]: emoji,
  });
}

/* ---------------- TYPING (RTDB) ---------------- */

export function setTyping(chatId, uid, isTyping) {
  const tref = ref(rtdb, `typing/${chatId}/${uid}`);
  if (isTyping) {
    set(tref, Date.now());
    onDisconnect(tref).remove();
  } else {
    remove(tref);
  }
}

export function watchTyping(chatId, myUid, cb) {
  return onValue(ref(rtdb, `typing/${chatId}`), (snap) => {
    const val = snap.val() || {};
    const now = Date.now();
    const typers = Object.keys(val).filter((u) => u !== myUid && now - val[u] < 6000);
    cb(typers);
  });
}

/* ---------------- STATUS (Stories) ---------------- */

export async function postStatus(uid, profile, media) {
  await addDoc(collection(db, "status"), {
    uid,
    name: profile.name,
    photo: profile.photo || "",
    media, // {type, url, ...}
    createdAt: serverTimestamp(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    viewers: [],
  });
}

export function watchStatuses(cb) {
  const q = query(collection(db, "status"), orderBy("createdAt", "desc"), limit(300));
  return onSnapshot(q, (snap) => {
    const now = Date.now();
    const live = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .filter((s) => (s.expiresAt || 0) > now);
    cb(live);
  });
}

export async function viewStatus(statusId, uid) {
  await updateDoc(doc(db, "status", statusId), { viewers: arrayUnion(uid) });
}

export async function deleteStatus(statusId) {
  await deleteDoc(doc(db, "status", statusId));
}

/* ---------------- CALLS (RTDB signaling) ---------------- */

export function createCall(callId, payload) {
  return set(ref(rtdb, `calls/${callId}`), { ...payload, createdAt: Date.now() });
}
export function watchCall(callId, cb) {
  return onValue(ref(rtdb, `calls/${callId}`), (s) => cb(s.val()));
}
export function updateCall(callId, patch) {
  return update(ref(rtdb, `calls/${callId}`), patch);
}
export function endCall(callId) {
  return remove(ref(rtdb, `calls/${callId}`));
}
export function watchIncomingCalls(uid, cb) {
  return onValue(ref(rtdb, `incoming/${uid}`), (s) => cb(s.val()));
}
export function ringUser(uid, callInfo) {
  const r = ref(rtdb, `incoming/${uid}`);
  onDisconnect(r).remove();
  return set(r, callInfo);
}
export function clearIncoming(uid) {
  return remove(ref(rtdb, `incoming/${uid}`));
}
export function pushIce(callId, who, candidate) {
  return rtdbPush(ref(rtdb, `calls/${callId}/ice/${who}`), candidate);
}
export function watchIce(callId, who, cb) {
  return onValue(ref(rtdb, `calls/${callId}/ice/${who}`), (s) => {
    const v = s.val() || {};
    cb(Object.values(v));
  });
}

/* ---------------- GAMES (RTDB live state) ---------------- */

export async function createGameRoom(game, host, hostInfo) {
  const code = Math.random().toString(36).substring(2, 6).toUpperCase();
  await set(ref(rtdb, `games/${code}`), {
    game, host, code,
    players: { [host]: { name: hostInfo.name, photo: hostInfo.photo || "", joinedAt: Date.now() } },
    state: "waiting",
    createdAt: Date.now(),
    turn: host,
    board: null,
    scores: {},
  });
  return code;
}
export async function joinGameRoom(code, uid, info) {
  const snap = await get(ref(rtdb, `games/${code}`));
  if (!snap.exists()) throw new Error("Room not found");
  await update(ref(rtdb, `games/${code}/players/${uid}`), {
    name: info.name, photo: info.photo || "", joinedAt: Date.now(),
  });
  return snap.val();
}
export function watchGameRoom(code, cb) {
  return onValue(ref(rtdb, `games/${code}`), (s) => cb(s.val()));
}
export function updateGameRoom(code, patch) {
  return update(ref(rtdb, `games/${code}`), patch);
}
export function leaveGameRoom(code, uid) {
  return remove(ref(rtdb, `games/${code}/players/${uid}`));
}

/* ---------------- FCM TOKENS ---------------- */
export async function saveFcmToken(uid, token) {
  await setDoc(doc(db, "users", uid), { fcmToken: token }, { merge: true });
}

export { serverTimestamp };
