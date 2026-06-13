/* ============================================================
   Notifications: FCM token registration + foreground notifications
   ============================================================ */
import { app, getMessaging, getToken, onMessage, messagingSupported } from "./firebase.js";
import { FIREBASE_VAPID_KEY } from "./config.js";
import { saveFcmToken } from "./data.js";

let messaging = null;

export async function initNotifications(uid) {
  try {
    if (!(await messagingSupported())) return;
    if (!("serviceWorker" in navigator)) return;

    const reg = await navigator.serviceWorker.register("firebase-messaging-sw.js");
    messaging = getMessaging(app);

    const perm = await Notification.requestPermission();
    if (perm !== "granted") return;

    const token = await getToken(messaging, {
      vapidKey: FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: reg,
    });
    if (token) await saveFcmToken(uid, token);

    // Foreground messages
    onMessage(messaging, (payload) => {
      const n = payload.notification || {};
      showLocalNotification(n.title || "MoodChat", n.body || "");
    });
  } catch (e) {
    console.warn("Notifications unavailable:", e.message);
  }
}

/** Local notification (works while tab is open / focused). */
export function showLocalNotification(title, body) {
  try {
    if (Notification.permission === "granted" && document.hidden) {
      new Notification(title, {
        body,
        icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='22' fill='%2300a884'/%3E%3C/svg%3E",
      });
    }
  } catch (_) {}
}
