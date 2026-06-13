/* ============================================================
   Multiplayer games via Firebase RTDB live sync
   - Tic Tac Toe
   - Rock Paper Scissors
   ============================================================ */
import {
  createGameRoom, joinGameRoom, watchGameRoom, updateGameRoom, leaveGameRoom,
} from "./data.js";
import { openModal, closeModal, toast, avatarUrl, $ } from "./ui.js";

const GAMES = [
  { id: "ttt", name: "Tic Tac Toe", icon: "❌⭕", desc: "Classic 3×3" },
  { id: "rps", name: "Rock Paper Scissors", icon: "✊✋", desc: "Best of 5" },
];

let me, meProfile, currentCode = null, unsub = null;

export function initGames(uid, profile) { me = uid; meProfile = profile; }

export function renderGamesGrid(container) {
  container.innerHTML = GAMES.map((g) => `
    <div class="game-card" data-game="${g.id}">
      <div class="gc-icon">${g.icon}</div>
      <b>${g.name}</b>
      <small>${g.desc}</small>
    </div>`).join("");
  container.querySelectorAll(".game-card").forEach((c) => {
    c.onclick = () => openLobby(c.dataset.game);
  });
}

function openLobby(gameId) {
  const game = GAMES.find((g) => g.id === gameId);
  const html = `
    <div class="modal-head"><h3>${game.icon} ${game.name}</h3>
      <button class="icon-btn" id="lobby-close"><i class="fa-solid fa-xmark"></i></button></div>
    <div class="modal-body">
      <button class="btn-primary" id="create-room" style="width:100%"><span>Create room</span></button>
      <div style="text-align:center;margin:14px 0;color:var(--muted)">— or join with code —</div>
      <input type="text" id="join-code" placeholder="Enter room code" maxlength="4" style="text-transform:uppercase;text-align:center;letter-spacing:4px;font-weight:700" />
      <button class="btn-ghost" id="join-room" style="width:100%">Join room</button>
    </div>`;
  openModal(html, { persistent: true });
  $("#lobby-close").onclick = closeModal;
  $("#create-room").onclick = async () => {
    try {
      const code = await createGameRoom(gameId, me, meProfile);
      enterRoom(gameId, code, true);
    } catch (e) { toast(e.message, "error"); }
  };
  $("#join-room").onclick = async () => {
    const code = $("#join-code").value.trim().toUpperCase();
    if (!code) return;
    try {
      await joinGameRoom(code, me, meProfile);
      enterRoom(gameId, code, false);
    } catch (e) { toast("Room not found", "error"); }
  };
}

function enterRoom(gameId, code, isHost) {
  currentCode = code;
  const html = `
    <div class="modal-head"><h3>Room <span class="code-pill">${code}</span></h3>
      <button class="icon-btn" id="room-close"><i class="fa-solid fa-xmark"></i></button></div>
    <div class="modal-body"><div id="game-area" class="game-room"></div></div>`;
  openModal(html, { persistent: true, onClose: leaveRoom });
  $("#room-close").onclick = closeModal;

  if (unsub) unsub();
  unsub = watchGameRoom(code, (room) => {
    if (!room) { toast("Room closed", ""); closeModal(); return; }
    const area = $("#game-area");
    if (!area) return;
    if (gameId === "ttt") renderTTT(area, room);
    else if (gameId === "rps") renderRPS(area, room);
  });
}

function leaveRoom() {
  if (unsub) { unsub(); unsub = null; }
  if (currentCode) { leaveGameRoom(currentCode, me); currentCode = null; }
}

function playersBar(room, turnUid) {
  const ps = Object.entries(room.players || {});
  return `<div class="players-row">${ps.map(([uid, p]) => `
    <div class="player-chip ${uid === turnUid ? "turn" : ""}">
      <img src="${avatarUrl(p.photo, p.name)}" /><div>${uid === me ? "You" : p.name}</div>
    </div>`).join("")}</div>`;
}

/* ---------------- TIC TAC TOE ---------------- */
function renderTTT(area, room) {
  const players = Object.keys(room.players || {});
  if (players.length < 2) {
    area.innerHTML = `${playersBar(room)}<div class="dots-status">Waiting for opponent… Share code <b>${room.code}</b></div>`;
    return;
  }
  const board = room.board || Array(9).fill("");
  const [p1, p2] = players;
  const symbols = { [p1]: "X", [p2]: "O" };
  const mySym = symbols[me];
  const winner = checkTTT(board);
  const full = board.every((c) => c);
  let status;
  if (winner) {
    const winUid = Object.keys(symbols).find((u) => symbols[u] === winner);
    status = `<div class="game-result">${winUid === me ? "🎉 You win!" : "You lose 😢"}</div>`;
  } else if (full) {
    status = `<div class="game-result">It's a draw!</div>`;
  } else {
    status = `<div class="dots-status">${room.turn === me ? "Your turn" : "Opponent's turn"} — you are <b>${mySym}</b></div>`;
  }

  area.innerHTML = `${playersBar(room, room.turn)}${status}
    <div class="ttt-board">${board.map((c, i) => `
      <div class="ttt-cell ${c === "X" ? "x" : c === "O" ? "o" : ""}" data-i="${i}">${c}</div>`).join("")}</div>
    ${(winner || full) ? `<div style="text-align:center;margin-top:16px"><button class="btn-primary" id="ttt-rematch" style="display:inline-flex">Rematch</button></div>` : ""}`;

  area.querySelectorAll(".ttt-cell").forEach((cell) => {
    cell.onclick = () => {
      const i = +cell.dataset.i;
      if (board[i] || winner || full || room.turn !== me) return;
      const nb = [...board]; nb[i] = mySym;
      updateGameRoom(room.code, { board: nb, turn: players.find((u) => u !== me) });
    };
  });
  const rb = $("#ttt-rematch");
  if (rb) rb.onclick = () => updateGameRoom(room.code, { board: Array(9).fill(""), turn: p1 });
}

function checkTTT(b) {
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for (const [a,c,d] of lines) if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
  return null;
}

/* ---------------- ROCK PAPER SCISSORS ---------------- */
function renderRPS(area, room) {
  const players = Object.keys(room.players || {});
  if (players.length < 2) {
    area.innerHTML = `${playersBar(room)}<div class="dots-status">Waiting for opponent… Share code <b>${room.code}</b></div>`;
    return;
  }
  const moves = room.moves || {};
  const scores = room.scores || {};
  const [p1, p2] = players;
  const myMove = moves[me];
  const bothPlayed = moves[p1] && moves[p2];
  const myScore = scores[me] || 0;
  const oppUid = players.find((u) => u !== me);
  const oppScore = scores[oppUid] || 0;

  let resultLine = "";
  if (bothPlayed) {
    const res = rpsWinner(moves[p1], moves[p2]);
    let txt;
    if (res === 0) txt = "Tie!";
    else { const winUid = res === 1 ? p1 : p2; txt = winUid === me ? "You won this round! 🎉" : "Opponent won this round"; }
    const emoji = { rock: "✊", paper: "✋", scissors: "✌️" };
    resultLine = `<div class="game-result">${txt}</div>
      <div class="dots-status">You: ${emoji[moves[me]]} &nbsp; vs &nbsp; ${emoji[moves[oppUid]]} :Opponent</div>`;
  }

  const champion = myScore >= 3 ? "You are the champion! 🏆" : oppScore >= 3 ? "Opponent is champion 😢" : null;

  area.innerHTML = `${playersBar(room)}
    <div class="dots-status">Score — You <b>${myScore}</b> : <b>${oppScore}</b> Opponent &nbsp;(first to 3)</div>
    ${resultLine}
    ${champion ? `<div class="game-result">${champion}</div>
      <div style="text-align:center"><button class="btn-primary" id="rps-reset" style="display:inline-flex">Play again</button></div>`
    : `<div class="rps-choices">
        ${["rock","paper","scissors"].map((m) => `<button data-m="${m}" class="${myMove === m ? "sel" : ""}" ${myMove ? "disabled style='opacity:.5'" : ""}>${{rock:"✊",paper:"✋",scissors:"✌️"}[m]}</button>`).join("")}
      </div>
      <div class="dots-status">${myMove ? (bothPlayed ? "" : "Waiting for opponent…") : "Make your move"}</div>`}`;

  area.querySelectorAll(".rps-choices button").forEach((b) => {
    b.onclick = () => {
      if (myMove) return;
      updateGameRoom(room.code, { [`moves/${me}`]: b.dataset.m });
    };
  });

  // when both played, host tallies score then clears moves after delay
  if (bothPlayed && me === room.host && !room._scored) {
    const res = rpsWinner(moves[p1], moves[p2]);
    const ns = { ...scores };
    if (res === 1) ns[p1] = (ns[p1] || 0) + 1;
    else if (res === 2) ns[p2] = (ns[p2] || 0) + 1;
    updateGameRoom(room.code, { scores: ns, _scored: true });
    setTimeout(() => updateGameRoom(room.code, { moves: null, _scored: false }), 2500);
  }

  const rb = $("#rps-reset");
  if (rb) rb.onclick = () => updateGameRoom(room.code, { scores: { [p1]: 0, [p2]: 0 }, moves: null, _scored: false });
}

function rpsWinner(a, b) {
  if (a === b) return 0;
  const beats = { rock: "scissors", paper: "rock", scissors: "paper" };
  return beats[a] === b ? 1 : 2;
}
