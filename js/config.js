/* ============================================================
   MoodChat — Configuration
   All backend credentials (public client keys).
   Security is enforced via Supabase RLS + Firebase Rules.
   ============================================================ */

export const SUPABASE_CONFIG = {
  url: "https://pupwtdupqcbceahmgrwc.supabase.co",
  anonKey: "sb_publishable_dnyeFg6dYj5fYGKhqQHWwA_-tvrSXc0",
};

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAh9Y5sIwDI1pPlYARSOQJ4KY7ydS6zaBU",
  authDomain: "moodchat-f13a0.firebaseapp.com",
  projectId: "moodchat-f13a0",
  storageBucket: "moodchat-f13a0.firebasestorage.app",
  messagingSenderId: "196346161497",
  appId: "1:196346161497:web:baab4b0b87b94037f64448",
  measurementId: "G-D8GJNEL69N",
  // Realtime Database URL (derived from project id / region default)
  databaseURL: "https://moodchat-f13a0-default-rtdb.firebaseio.com",
};

export const FIREBASE_VAPID_KEY = "HeZ-qYuCiEcHLbGTPPVzlpIeRczK24BYkDOwKLzgQh0";

export const CLOUDINARY_CONFIG = {
  cloudName: "djlt2chgd",
  uploadPreset: "moodchat_media_unsigned",
};

// App-wide constants
export const APP = {
  name: "MoodChat",
  statusExpiryMs: 24 * 60 * 60 * 1000, // 24 hours
  messagePageSize: 50,
};
