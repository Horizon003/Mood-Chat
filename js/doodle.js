/* ============================================================
   Doodle / drawing canvas — Instagram-like
   ============================================================ */
import { openModal, closeModal, toast } from "./ui.js";

export function openDoodle(onSend) {
  const html = `
    <div class="modal-head">
      <h3><i class="fa-solid fa-paintbrush"></i> Doodle</h3>
      <button class="icon-btn" id="doodle-close"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="modal-body">
      <div class="doodle-toolbar">
        <div class="swatch-row" id="swatches"></div>
        <input type="color" id="doodle-color" value="#ff2d55" />
        <label class="muted">Size</label>
        <input type="range" id="doodle-size" min="1" max="40" value="6" />
        <button class="icon-btn" id="doodle-eraser" title="Eraser"><i class="fa-solid fa-eraser"></i></button>
        <button class="icon-btn" id="doodle-undo" title="Undo"><i class="fa-solid fa-rotate-left"></i></button>
        <button class="icon-btn" id="doodle-clear" title="Clear"><i class="fa-solid fa-trash"></i></button>
      </div>
      <canvas id="doodle-canvas" width="520" height="400"></canvas>
    </div>
    <div class="modal-foot">
      <button class="btn-ghost" id="doodle-cancel">Cancel</button>
      <button class="btn-primary" id="doodle-send" style="margin:0"><span>Send doodle</span></button>
    </div>`;
  openModal(html, { className: "doodle-modal", persistent: true });

  const canvas = document.getElementById("doodle-canvas");
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.lineCap = "round"; ctx.lineJoin = "round";

  let drawing = false, color = "#ff2d55", size = 6, erasing = false;
  const history = [];
  const pushHistory = () => { if (history.length > 25) history.shift(); history.push(ctx.getImageData(0,0,canvas.width,canvas.height)); };
  pushHistory();

  // swatches
  const palette = ["#ff2d55","#ffcc00","#34c759","#007aff","#af52de","#000000","#ffffff","#8e8e93"];
  const sw = document.getElementById("swatches");
  palette.forEach((c, i) => {
    const b = document.createElement("div");
    b.className = "swatch" + (i === 0 ? " active" : "");
    b.style.background = c;
    b.onclick = () => {
      document.querySelectorAll(".swatch").forEach(s => s.classList.remove("active"));
      b.classList.add("active"); color = c; erasing = false;
      document.getElementById("doodle-color").value = c;
    };
    sw.appendChild(b);
  });

  document.getElementById("doodle-color").oninput = (e) => { color = e.target.value; erasing = false; };
  document.getElementById("doodle-size").oninput = (e) => { size = +e.target.value; };
  document.getElementById("doodle-eraser").onclick = () => { erasing = true; };

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
    return { x: x * (canvas.width / r.width), y: y * (canvas.height / r.height) };
  }
  function start(e) { e.preventDefault(); drawing = true; pushHistory(); const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
  function move(e) {
    if (!drawing) return; e.preventDefault();
    const p = pos(e);
    ctx.strokeStyle = erasing ? "#ffffff" : color;
    ctx.lineWidth = erasing ? size * 2 : size;
    ctx.lineTo(p.x, p.y); ctx.stroke();
  }
  function end() { drawing = false; }

  canvas.addEventListener("mousedown", start);
  canvas.addEventListener("mousemove", move);
  window.addEventListener("mouseup", end);
  canvas.addEventListener("touchstart", start, { passive: false });
  canvas.addEventListener("touchmove", move, { passive: false });
  canvas.addEventListener("touchend", end);

  document.getElementById("doodle-undo").onclick = () => {
    if (history.length > 1) { history.pop(); ctx.putImageData(history[history.length - 1], 0, 0); }
  };
  document.getElementById("doodle-clear").onclick = () => {
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height); pushHistory();
  };
  document.getElementById("doodle-close").onclick = closeModal;
  document.getElementById("doodle-cancel").onclick = closeModal;
  document.getElementById("doodle-send").onclick = () => {
    const dataUrl = canvas.toDataURL("image/png");
    closeModal();
    onSend(dataUrl);
  };
}
