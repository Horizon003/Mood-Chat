/* ============================================================
   Supabase Email OTP authentication + auto-login (remember me)
   ============================================================ */
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_CONFIG } from "./config.js";

const REMEMBER_KEY = "moodchat_remember";

export const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: window.localStorage,
  },
});

/** Send a 6-digit email OTP code. Creates the user if new. */
export async function sendOtp(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
  return true;
}

/** Verify the OTP code the user entered. */
export async function verifyOtp(email, token, remember = true) {
  const { data, error } = await supabase.auth.verifyOtp({
    email, token, type: "email",
  });
  if (error) throw error;
  localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
  return data.user;
}

/** Returns current session/user if a valid one exists (auto-login). */
export async function getCurrentUser() {
  const remember = localStorage.getItem(REMEMBER_KEY);
  if (remember === "0") {
    // user explicitly didn't want to be remembered this session
    const { data } = await supabase.auth.getSession();
    return data.session ? data.session.user : null;
  }
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session ? data.session.user : null;
}

export async function signOut() {
  localStorage.removeItem(REMEMBER_KEY);
  await supabase.auth.signOut();
}

export function onAuthChange(cb) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    cb(session ? session.user : null);
  });
}
