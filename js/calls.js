/* ============================================================
   Calls — WebRTC peer-to-peer with Firebase RTDB signaling
   ============================================================ */
import {
  createCall, watchCall, updateCall, endCall, ringUser, clearIncoming,
  pushIce, watchIce,
} from "./data.js";
import { $, toast, avatarUrl } from "./ui.js";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:global.stun.twilio.com:3478" },
  ],
};

let pc = null, localStream = null, callId = null, role = null;
let unsubCall = null, unsubIceA = null, unsubIceB = null;
let isVideo = false, muted = false, camOff = false;

export async function startCall(me, meProfile, peer, peerProfile, video) {
  isVideo = video;
  callId = `${me}_${peer}_${Date.now()}`;
  role = "caller";
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
  } catch (e) {
    toast("Camera/mic permission needed", "error");
    return;
  }
  renderCallUI(peerProfile, video, "Calling…");
  setupPeer();
  localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  await createCall(callId, {
    caller: me, callee: peer, video, type: "ringing",
    callerName: meProfile.name, callerPhoto: meProfile.photo || "",
    offer: JSON.stringify(offer),
  });
  await ringUser(peer, { callId, from: me, fromName: meProfile.name, fromPhoto: meProfile.photo || "", video });

  pc.onicecandidate = (e) => { if (e.candidate) pushIce(callId, "caller", e.candidate.toJSON()); };

  unsubCall = watchCall(callId, async (data) => {
    if (!data) { hangup(true); return; }
    if (data.answer && pc.signalingState !== "stable") {
      await pc.setRemoteDescription(JSON.parse(data.answer));
      $("#call-status") && ($("#call-status").textContent = "Connected");
    }
    if (data.type === "ended") hangup(true);
  });
  unsubIceB = watchIce(callId, "callee", (cands) => cands.forEach((c) => pc.addIceCandidate(new RTCIceCandidate(c)).catch(()=>{})));
}

export async function acceptCall(me, meProfile, info) {
  callId = info.callId; role = "callee"; isVideo = info.video;
  await clearIncoming(me);
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: info.video });
  } catch (e) { toast("Permission needed", "error"); await endCall(callId); return; }

  renderCallUI({ name: info.fromName, photo: info.fromPhoto }, info.video, "Connecting…");
  setupPeer();
  localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

  unsubCall = watchCall(callId, async (data) => {
    if (!data) { hangup(true); return; }
    if (data.offer && !pc.currentRemoteDescription) {
      await pc.setRemoteDescription(JSON.parse(data.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await updateCall(callId, { answer: JSON.stringify(answer), type: "connected" });
      $("#call-status") && ($("#call-status").textContent = "Connected");
    }
    if (data.type === "ended") hangup(true);
  });
  pc.onicecandidate = (e) => { if (e.candidate) pushIce(callId, "callee", e.candidate.toJSON()); };
  unsubIceA = watchIce(callId, "caller", (cands) => cands.forEach((c) => pc.addIceCandidate(new RTCIceCandidate(c)).catch(()=>{})));
}

function setupPeer() {
  pc = new RTCPeerConnection(ICE_SERVERS);
  pc.ontrack = (e) => {
    const rv = $("#remote-video");
    if (rv && e.streams[0]) { rv.srcObject = e.streams[0]; rv.classList.remove("hidden"); }
    const ca = $("#call-avatar-wrap");
    if (ca && isVideo) ca.classList.add("hidden");
  };
  pc.onconnectionstatechange = () => {
    if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
      // give it a moment for reconnection
    }
  };
}

function renderCallUI(peerProfile, video, status) {
  const ov = document.createElement("div");
  ov.className = "call-overlay";
  ov.id = "call-overlay";
  ov.innerHTML = `
    ${video ? `<div class="call-videos"><video id="remote-video" autoplay playsinline class="hidden"></video><video id="local-video" autoplay playsinline muted></video></div>` : ""}
    <div class="call-top" id="call-avatar-wrap">
      <img src="${avatarUrl(peerProfile.photo, peerProfile.name)}" alt="" />
      <h2>${peerProfile.name || "User"}</h2>
      <p id="call-status">${status}</p>
    </div>
    <div class="call-controls">
      <button class="call-btn" id="btn-mute" title="Mute"><i class="fa-solid fa-microphone"></i></button>
      ${video ? `<button class="call-btn" id="btn-cam" title="Camera"><i class="fa-solid fa-video"></i></button>` : ""}
      <button class="call-btn end" id="btn-hangup" title="End"><i class="fa-solid fa-phone-slash"></i></button>
    </div>`;
  document.body.appendChild(ov);

  if (video) { const lv = $("#local-video"); lv.srcObject = localStream; }

  $("#btn-hangup").onclick = () => hangup(false);
  $("#btn-mute").onclick = () => {
    muted = !muted;
    localStream.getAudioTracks().forEach((t) => (t.enabled = !muted));
    $("#btn-mute").classList.toggle("muted", muted);
    $("#btn-mute").innerHTML = `<i class="fa-solid fa-microphone${muted ? "-slash" : ""}"></i>`;
  };
  if (video) {
    $("#btn-cam").onclick = () => {
      camOff = !camOff;
      localStream.getVideoTracks().forEach((t) => (t.enabled = !camOff));
      $("#btn-cam").classList.toggle("muted", camOff);
    };
  }
}

export async function hangup(remote = false) {
  try { if (!remote && callId) await updateCall(callId, { type: "ended" }); } catch (_) {}
  try { if (callId) await endCall(callId); } catch (_) {}
  if (unsubCall) unsubCall(); if (unsubIceA) unsubIceA(); if (unsubIceB) unsubIceB();
  unsubCall = unsubIceA = unsubIceB = null;
  if (localStream) localStream.getTracks().forEach((t) => t.stop());
  if (pc) pc.close();
  pc = null; localStream = null; callId = null;
  const ov = $("#call-overlay"); if (ov) ov.remove();
}

export async function declineIncoming(me, info) {
  await clearIncoming(me);
  try { await updateCall(info.callId, { type: "ended" }); } catch (_) {}
}
