/* FCM background message service worker */
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyAh9Y5sIwDI1pPlYARSOQJ4KY7ydS6zaBU",
  authDomain: "moodchat-f13a0.firebaseapp.com",
  projectId: "moodchat-f13a0",
  storageBucket: "moodchat-f13a0.firebasestorage.app",
  messagingSenderId: "196346161497",
  appId: "1:196346161497:web:baab4b0b87b94037f64448",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || "MoodChat";
  const options = {
    body: (payload.notification && payload.notification.body) || "New activity",
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='22' fill='%2300a884'/%3E%3Ctext x='50' y='68' font-size='56' text-anchor='middle'%3E%F0%9F%92%AC%3C/text%3E%3C/svg%3E",
    data: payload.data || {},
  };
  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: "window" }).then((cs) => {
    for (const c of cs) { if ("focus" in c) return c.focus(); }
    if (clients.openWindow) return clients.openWindow("./index.html");
  }));
});
