/* ============================================================
   Firebase initialization (modular v10 via CDN)
   Exposes Firestore, Realtime DB, Messaging helpers.
   ============================================================ */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc,
  deleteDoc, query, where, orderBy, limit, onSnapshot, serverTimestamp,
  arrayUnion, arrayRemove, writeBatch, increment, startAfter
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getDatabase, ref, set, get, update, remove, onValue, onDisconnect,
  serverTimestamp as rtdbServerTimestamp, push as rtdbPush, child
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import {
  getMessaging, getToken, onMessage, isSupported as messagingSupported
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";

import { FIREBASE_CONFIG } from "./config.js";

const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);
const rtdb = getDatabase(app);

export {
  app, db, rtdb,
  // firestore
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, onSnapshot, serverTimestamp, arrayUnion,
  arrayRemove, writeBatch, increment, startAfter,
  // rtdb
  ref, set, get, update, remove, onValue, onDisconnect, rtdbServerTimestamp,
  rtdbPush, child,
  // messaging
  getMessaging, getToken, onMessage, messagingSupported,
};
