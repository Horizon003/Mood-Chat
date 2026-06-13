# MOODCHAT — Express Every Mood 💬

Aapki PRD aur design screenshots ke base par banaya gaya ek **fully interactive single-file** prototype. Yeh ek WhatsApp-style dark-green messaging app hai jo browser mein iPhone frame ke andar chalti hai.

## ✅ Completed Features (Screens)

| # | Screen | Functionality |
|---|--------|---------------|
| 1 | **Splash** | Logo, branding, "Get Started" CTA |
| 2 | **Login** | Country code + phone input |
| 3 | **OTP Verification** | 6-digit auto-advance boxes, live resend countdown timer |
| 4 | **Profile Setup** | Avatar uploader, name/username/bio fields |
| 5 | **Chats List** | Pinned/All chats, friend-request card, unread badges, tabs, FAB |
| 6 | **Hidden Chats** | Locked private conversations view |
| 7 | **Conversation (1:1)** | Live messaging + auto-reply, image, voice note, reactions, typing indicator |
| 8 | **Long-Press Menu** | Reply / Copy / Edit / Delete / React / Forward |
| 9 | **Group Chat** | Multi-sender bubbles, file attachment, admin tag |
| 10 | **Chat Info** | Profile, quick actions, media strip, toggles |
| 11 | **Status Hub** | My status, recent & viewed updates |
| 12 | **Status Composer** | Text/Image/Video segments, background picker |
| 13 | **Status Viewer** | Auto-progressing story bar, emoji reactions, reply |
| 14 | **Contacts** | Search-only discovery (try typing **sarah**) → result / no-result states |
| 15 | **Friend Request** | Personal note + send |
| 16 | **Calls List** | Missed/incoming/outgoing with tabs |
| 17 | **Audio Call** | Live call timer, toggleable controls |
| 18 | **Video Call** | Self-view PIP, control bar |
| 19 | **Games Hub** | 6 games grid |
| 20 | **Game Friend Picker** | Select accepted friend |
| 21 | **Tic-Tac-Toe** | **Fully playable** vs AI, win/draw detection, rematch |
| 22 | **Settings** | Profile card + all preference rows |
| 23 | **Edit Profile** | Editable fields |
| 24 | **Notifications** | Working toggles, quiet hours |
| 25 | **Chat Themes** | 6 selectable themes |
| 26 | **Security & App Lock** | PIN length, lock timeout, toggles |
| 27 | **PIN Lock** | **Working keypad** — enter any 6 digits to unlock |
| 28 | **Composer Appearance** | Solid + gradient color picker with live preview |
| 29 | **Doodle Canvas** | **Drawing works** (mouse + touch), colors, pen/eraser/clear |

## 🎨 Design
- Exact dark-green theme (`#25d366` accent, `#0a1014` background) from your screenshots
- iPhone frame with notch, status bar
- Inter font + Font Awesome icons
- Fully responsive (full-screen on mobile)

## 🚀 Entry Point
- `index.html` — single file, no build step. Open directly in browser.

## 🧭 Try These
- **OTP** is pre-filled `123456` → tap Verify
- **Contacts**: search "sarah" (found) or anything else (not found)
- **Games → Tic-Tac-Toe**: actually play vs AI
- **Conversation**: type a message → get auto-reply
- **Doodle**: draw with your mouse/finger
- **PIN Lock**: tap any 6 digits

## 📌 Not Implemented (prototype scope)
- Real backend / E2E encryption (UI only)
- Real-time multiplayer for games
- Actual photo/video upload & camera
- Other games besides Tic-Tac-Toe are placeholders

## 🔜 Next Steps
1. Connect RESTful Table API for persistent chats/contacts
2. Add light mode + apply theme selections globally
3. Build out remaining games (RPS, Memory Flip, etc.)
4. Add real voice-note recording (Web Audio API)

## 🚢 Deploy
Website live karne ke liye **Publish tab** use karein — wahan se one-click deployment ho jayegi.
