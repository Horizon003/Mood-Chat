/* ============================================================
   UI utilities: toasts, modals, formatting, media viewer
   ============================================================ */

export function $(sel, root = document) { return root.querySelector(sel); }
export function $$(sel, root = document) { return [...root.querySelectorAll(sel)]; }

export function toast(msg, type = "") {
  const host = $("#toast-host");
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = msg;
  host.appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; t.style.transform = "translateY(10px)"; }, 2600);
  setTimeout(() => t.remove(), 3000);
}

export function esc(s = "") {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function avatarUrl(url, name = "?") {
  if (url) return url;
  const letter = (name || "?").trim().charAt(0).toUpperCase() || "?";
  const colors = ["00a884", "53bdeb", "f6c344", "f15c6d", "9b59b6", "e67e22"];
  const c = colors[(name || "?").charCodeAt(0) % colors.length];
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='#${c}'/><text x='50' y='62' font-size='44' font-family='Arial' fill='white' text-anchor='middle'>${letter}</text></svg>`
  )}`;
}

export function timeAgo(ms) {
  if (!ms) return "";
  const d = Date.now() - ms;
  if (d < 60000) return "just now";
  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
  return `${Math.floor(d / 86400000)}d ago`;
}

export function fmtTime(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function fmtDay(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const today = new Date(); today.setHours(0,0,0,0);
  const yd = new Date(today); yd.setDate(yd.getDate()-1);
  const dd = new Date(d); dd.setHours(0,0,0,0);
  if (dd.getTime() === today.getTime()) return "Today";
  if (dd.getTime() === yd.getTime()) return "Yesterday";
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

/* ---------- Modal ---------- */
let modalCloseHandler = null;
export function openModal(html, opts = {}) {
  const root = $("#modal-root");
  root.innerHTML = `<div class="modal ${opts.className || ""}">${html}</div>`;
  root.classList.remove("hidden");
  modalCloseHandler = opts.onClose || null;
  root.onclick = (e) => { if (e.target === root && !opts.persistent) closeModal(); };
  return root.firstElementChild;
}
export function closeModal() {
  const root = $("#modal-root");
  root.classList.add("hidden");
  root.innerHTML = "";
  if (modalCloseHandler) { modalCloseHandler(); modalCloseHandler = null; }
}

/* ---------- Media viewer (zoom allowed) ---------- */
export function openMedia(type, url) {
  const v = $("#media-viewer");
  const c = $("#viewer-content");
  if (type === "video") {
    c.innerHTML = `<video src="${esc(url)}" controls autoplay playsinline></video>`;
  } else {
    c.innerHTML = `<img src="${esc(url)}" alt="media" />`;
  }
  v.classList.remove("hidden");
}
export function initMediaViewer() {
  $("#viewer-close").onclick = () => {
    const v = $("#media-viewer");
    v.classList.add("hidden");
    $("#viewer-content").innerHTML = "";
  };
}
