/* ============================================================
   Onboarding screens: auth (OTP), profile setup
   ============================================================ */
import { sendOtp, verifyOtp } from "./auth.js";
import { upsertUser, getUser } from "./data.js";
import { uploadToCloudinary } from "./cloudinary.js";
import { $, toast, avatarUrl } from "./ui.js";

export function showScreen(id) {
  ["splash", "auth-screen", "profile-setup", "app"].forEach((s) => {
    const el = document.getElementById(s);
    if (el) el.classList.toggle("hidden", s !== id);
  });
}

/* ---------------- AUTH FLOW ---------------- */
export function initAuthScreen(onVerified) {
  const emailForm = $("#email-form");
  const otpForm = $("#otp-form");
  const errEl = $("#auth-error");
  let pendingEmail = "";

  const setErr = (m) => (errEl.textContent = m || "");
  const loading = (btn, on, label) => {
    btn.disabled = on;
    btn.querySelector("span").innerHTML = on ? `<span class="btn-spin"></span>` : label;
  };

  emailForm.onsubmit = async (e) => {
    e.preventDefault();
    setErr("");
    const email = $("#auth-email").value.trim().toLowerCase();
    if (!email) return;
    const btn = $("#send-otp-btn");
    loading(btn, true, "Send code");
    try {
      await sendOtp(email);
      pendingEmail = email;
      $("#otp-email-label").textContent = email;
      emailForm.classList.add("hidden");
      otpForm.classList.remove("hidden");
      $("#auth-otp").focus();
      toast("Code sent — check your inbox", "success");
    } catch (err) {
      setErr(err.message || "Failed to send code");
    } finally {
      loading(btn, false, "Send code");
    }
  };

  otpForm.onsubmit = async (e) => {
    e.preventDefault();
    setErr("");
    const token = $("#auth-otp").value.trim();
    if (token.length < 6) return setErr("Enter the 6-digit code");
    const remember = $("#remember-me").checked;
    const btn = $("#verify-otp-btn");
    loading(btn, true, "Verify & continue");
    try {
      const user = await verifyOtp(pendingEmail, token, remember);
      onVerified(user);
    } catch (err) {
      setErr(err.message || "Invalid or expired code");
      loading(btn, false, "Verify & continue");
    }
  };

  $("#otp-back").onclick = () => {
    otpForm.classList.add("hidden");
    emailForm.classList.remove("hidden");
    setErr("");
  };
  $("#otp-resend").onclick = async () => {
    if (!pendingEmail) return;
    try { await sendOtp(pendingEmail); toast("New code sent", "success"); }
    catch (err) { setErr(err.message); }
  };
}

/* ---------------- PROFILE SETUP ---------------- */
export function initProfileSetup(user, onDone) {
  const preview = $("#setup-dp-preview");
  const input = $("#setup-dp-input");
  const statusEl = $("#setup-dp-status");
  const errEl = $("#setup-error");
  let photoUrl = "";

  // Prefill if returning user
  getUser(user.id).then((u) => {
    if (u) {
      $("#setup-name").value = u.name || "";
      $("#setup-about").value = u.about || "";
      if (u.photo) { photoUrl = u.photo; preview.style.backgroundImage = `url(${u.photo})`; preview.innerHTML = ""; }
    } else {
      $("#setup-name").value = (user.email || "").split("@")[0];
    }
  });

  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    statusEl.textContent = "Uploading…";
    try {
      const res = await uploadToCloudinary(file, { folder: "moodchat/avatars", resourceType: "image" });
      photoUrl = res.secureUrl;
      preview.style.backgroundImage = `url(${photoUrl})`;
      preview.innerHTML = "";
      statusEl.textContent = "✓ Uploaded";
    } catch (e) {
      statusEl.textContent = "Upload failed";
      toast(e.message, "error");
    }
  };

  $("#profile-form").onsubmit = async (e) => {
    e.preventDefault();
    errEl.textContent = "";
    const name = $("#setup-name").value.trim();
    if (!name) return (errEl.textContent = "Please enter your name");
    const btn = $("#save-profile-btn");
    btn.disabled = true;
    btn.querySelector("span").innerHTML = `<span class="btn-spin"></span>`;
    try {
      const profile = await upsertUser(user.id, {
        email: (user.email || "").toLowerCase(),
        name,
        about: $("#setup-about").value.trim() || "Hey there! I'm using MoodChat",
        photo: photoUrl,
      });
      onDone(profile);
    } catch (err) {
      errEl.textContent = err.message;
      btn.disabled = false;
      btn.querySelector("span").textContent = "Continue";
    }
  };
}
