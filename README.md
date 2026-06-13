# 💬 MoodChat — Live Real-Time Chat App

MoodChat is a **fully functional, production-style** real-time messaging web app (not a mockup). It uses:

- **Supabase** → Email OTP authentication + auto-login
- **Firebase** (Firestore + Realtime Database + FCM) → users, chats, groups, messages, presence, typing, seen, status, calls signaling, games, push
- **Cloudinary** → profile pictures, chat images/videos, stickers, doodles, status media

---

## ✅ Completed Features

| Feature | Status | Backend |
|---|---|---|
| Email OTP login (6-digit code) | ✅ | Supabase |
| Auto-login / "Keep me signed in" | ✅ | Supabase session persistence |
| Profile setup (name, about, DP) | ✅ | Firestore + Cloudinary |
| 1-to-1 chats | ✅ | Firestore |
| Group chats (create, members, leave) | ✅ | Firestore |
| Text messages | ✅ | Firestore |
| Image / Video messages | ✅ | Cloudinary + Firestore |
| Stickers & Emoji picker | ✅ | Firestore |
| **Doodle / drawing** (draw → save → upload → send) | ✅ | Canvas + Cloudinary |
| Message reactions | ✅ | Firestore |
| Typing indicator | ✅ | Realtime DB |
| Seen / read receipts (double blue tick) | ✅ | Firestore |
| Online / offline / last seen | ✅ | Realtime DB presence |
| Unread badges | ✅ | Firestore |
| **Status / Stories** (photo/video, 24h expiry, view tracking) | ✅ | Cloudinary + Firestore |
| **Voice & Video calls** (WebRTC P2P) | ✅ | Realtime DB signaling |
| Incoming call banner + ringtone | ✅ | Realtime DB |
| Call history | ✅ | localStorage |
| **Multiplayer games** (Tic-Tac-Toe, Rock-Paper-Scissors) | ✅ | Realtime DB live sync |
| Push notifications (foreground + service worker) | ✅ | FCM |
| Zoom lock (app-like) + media-viewer pinch zoom | ✅ | CSS + JS gesture blocking |
| Loading / empty / error states everywhere | ✅ | — |
| Toasts & inline error handling | ✅ | — |

---

## 🚀 Functional Entry Points

- `index.html` — single-page app (all screens: splash → auth → profile setup → main app).
- `firebase-messaging-sw.js` — FCM background service worker (auto-registered).
- `manifest.json` — PWA installable manifest.

There are **no URL parameters** — navigation is internal (tabs: Chats / Status / Calls / Games).

---

## ⚙️ REQUIRED BACKEND SETUP (do this once)

The app uses public client keys (normal for client SDKs). Security is enforced by **rules** you must configure in each dashboard.

### 1) Supabase
- Dashboard → **Authentication → Providers → Email** → enable **"Email OTP"** (Confirm email = ON, with OTP).
- Dashboard → **Authentication → URL Configuration** → add your deployed site URL to **Site URL** and **Redirect URLs**.
- No tables needed in Supabase (Firestore stores app data).

### 2) Firebase — enable services
- **Firestore Database** → Create database (production mode).
- **Realtime Database** → Create database. ⚠️ The default URL is assumed to be:
  `https://moodchat-f13a0-default-rtdb.firebaseio.com`
  If your DB is in another region, update `databaseURL` in `js/config.js`.
- **Cloud Messaging** → already configured with the provided VAPID key.

### 3) Firestore Security Rules (paste in Firestore → Rules)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    match /users/{uid} { allow read, write: if true; }
    match /chats/{chatId} {
      allow read, write: if true;
      match /messages/{m} { allow read, write: if true; }
    }
    match /status/{s} { allow read, write: if true; }
  }
}
```
> ⚠️ These are **open rules** for quick launch. For real production, restrict using `request.auth`. Since auth is via Supabase (not Firebase Auth), you'd typically mint a Firebase custom token from a Cloud Function, or keep rules permissive behind Supabase login. See "Hardening" below.

### 4) Realtime Database Rules (paste in Realtime DB → Rules)
```json
{
  "rules": {
    "presence":  { ".read": true, ".write": true },
    "typing":    { ".read": true, ".write": true },
    "calls":     { ".read": true, ".write": true },
    "incoming":  { ".read": true, ".write": true },
    "games":     { ".read": true, ".write": true }
  }
}
```

### 5) Cloudinary
- Your unsigned upload preset **`moodchat_media_unsigned`** must exist and be **Unsigned**.
- Cloudinary console → Settings → Upload → Upload presets → confirm `moodchat_media_unsigned` = *Unsigned*.

---

## 🔔 About Push Notifications (important)
- **Foreground notifications** (app open) ✅ work via FCM `onMessage`.
- **Background notifications** while the tab is closed need a **server to send** the push using your FCM *server* key. A pure static site cannot send server-push.
- **What works now without a server:** in-app realtime alerts + browser notifications while the app/tab is open or backgrounded (via the service worker showing FCM messages).
- **To enable true offline push**, deploy this Firebase Cloud Function (outside this static project):
  ```js
  // sends a push when a new message doc is created
  exports.onNewMessage = functions.firestore
    .document('chats/{chatId}/messages/{m}')
    .onCreate(async (snap) => {
      const msg = snap.data();
      const chat = (await admin.firestore().doc(`chats/${context.params.chatId}`).get()).data();
      const recipients = chat.members.filter(u => u !== msg.sender);
      for (const uid of recipients) {
        const u = (await admin.firestore().doc(`users/${uid}`).get()).data();
        if (u?.fcmToken) await admin.messaging().send({
          token: u.fcmToken,
          notification: { title: chat.name || 'New message', body: msg.preview || msg.text || 'New message' },
        });
      }
    });
  ```

---

## 📞 About Calls
- Uses **WebRTC** with Google STUN servers — works on most home/office networks.
- Strict/symmetric NATs may need a **TURN** server (paid). Add TURN entries to `ICE_SERVERS` in `js/calls.js` if calls fail to connect across some networks.

---

## 🗂️ Data Models

**Firestore `users/{uid}`**: `uid, email, name, about, photo, fcmToken, createdAt, updatedAt`

**Firestore `chats/{chatId}`**: `type(dm|group), members[], memberInfo{}, name, photo, admins[], owner, lastMessage, lastMessageAt, lastSender, unread{uid:count}`

**Firestore `chats/{chatId}/messages/{id}`**: `sender, type(text|image|video|doodle|sticker|deleted), text, media{url,...}, reactions{uid:emoji}, seenBy[], createdAt, deleted`

**Firestore `status/{id}`**: `uid, name, photo, media{type,url}, createdAt, expiresAt(now+24h), viewers[]`

**Realtime DB**: `presence/{uid}`, `typing/{chatId}/{uid}`, `calls/{callId}`, `incoming/{uid}`, `games/{code}`

---

## 📁 Project Structure
```
index.html                  Main SPA shell (zoom-locked)
manifest.json               PWA manifest
firebase-messaging-sw.js    FCM background worker
css/style.css               Full app styling (dark theme)
js/
  config.js                 All credentials
  auth.js                   Supabase OTP + auto-login
  firebase.js               Firebase SDK init
  data.js                   Firestore + RTDB data layer
  cloudinary.js             Unsigned uploads + transforms
  notify.js                 FCM token + foreground notifications
  ui.js                     Toasts, modals, formatting, media viewer
  screens.js                Auth + profile-setup screens
  sidebar.js                Chat/status/call lists
  conversation.js           Messages, composer, typing, seen, media
  doodle.js                 Drawing canvas
  modals.js                 New chat/group, profile, status, info
  games.js                  Multiplayer Tic-Tac-Toe & RPS
  calls.js                  WebRTC voice/video
  app.js                    Orchestrator
```

---

## ⏳ Not Yet Implemented / Future
- Group voice/video calls (currently 1:1 only).
- More games (the framework supports adding new ones in `js/games.js`).
- Server-side scheduled deletion of expired status media from Cloudinary (currently hidden client-side after 24h; Firestore docs filtered by `expiresAt`).
- True offline push (needs the Cloud Function above).
- Message search inside a conversation, voice notes recording.

## 🔒 Hardening (recommended next steps)
1. Replace open Firestore/RTDB rules with auth-scoped rules.
2. Add a TURN server for reliable calls.
3. Deploy the Cloud Function for offline push.
4. Add a scheduled function to purge expired status records & Cloudinary assets.

---

## 🌐 Deployment
To make MoodChat live, open the **Publish tab** in this environment and click publish. It will build and host the static app over HTTPS (required for camera/mic, notifications, and service workers) and give you the live URL. Remember to add that URL to **Supabase → Auth → URL Configuration**.
```
```
