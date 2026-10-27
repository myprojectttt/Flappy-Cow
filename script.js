'use strict';

// ===== Cấu hình =====
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
// Thế giới game có kích thước logic thay đổi theo màn hình để luôn phủ kín (xem resize())
const BASE_W = 400;
const BASE_H = 600;
const GROUND_H = 80;
let W = BASE_W;
let H = BASE_H;
let GROUND_Y = H - GROUND_H;
let scale = 1;

const GRAVITY = 0.42;      // trọng lực
const FLAP_POWER = -7.2;   // lực vỗ cánh
const PIPE_W = 66;
const PIPE_GAP = 160;      // khoảng hở giữa 2 ống
const PIPE_SPEED = 2.5;
const PIPE_SPACING = 210;  // khoảng cách giữa các cặp ống
const COW_R = 15;          // bán kính va chạm của bò

// ===== Trạng thái =====
let state = 'ready';       // 'ready' | 'play' | 'over'
let score = 0;
let best = loadBest();
let pipes = [];
let clouds = [];
let groundX = 0;
let wingPhase = 0;
let time = 0;
let overAt = 0;
let flash = 0;
const cow = { x: 100, y: H / 2 - 30, vy: 0, angle: 0 };

function initClouds() {
  const need = Math.ceil(W / 90);
  while (clouds.length < need) {
    clouds.push({ x: Math.random() * W, yf: 0.06 + Math.random() * 0.4, s: 0.6 + Math.random() * 0.8, v: 0.25 + Math.random() * 0.25 });
  }
}

// ===== Phủ kín màn hình (máy tính + điện thoại) =====
function resize() {
  const rect = canvas.getBoundingClientRect();
  const cssW = Math.max(rect.width, 1);
  const cssH = Math.max(rect.height, 1);
  const aspect = cssW / cssH;
  if (aspect >= BASE_W / BASE_H) { H = BASE_H; W = BASE_H * aspect; }  // màn hình ngang: mở rộng bề ngang
  else { W = BASE_W; H = BASE_W / aspect; }                           // điện thoại dọc: kéo dài bề dọc
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  scale = canvas.width / W;
  GROUND_Y = H - GROUND_H;
  cow.x = Math.max(100, W * 0.22);
  cow.y = Math.max(COW_R, Math.min(cow.y, GROUND_Y - COW_R));
  const maxGap = GROUND_Y - PIPE_GAP - 90;
  pipes.forEach((p) => { p.gapY = Math.max(90, Math.min(p.gapY, maxGap)); });
  initClouds();
}
new ResizeObserver(resize).observe(canvas);
resize();

// ===== Lưu điểm cao =====
function loadBest() {
  try { return Number(localStorage.getItem('flappyCowBest')) || 0; } catch (e) { return 0; }
}
function saveBest() {
  try { localStorage.setItem('flappyCowBest', String(best)); } catch (e) { /* bỏ qua */ }
}

// ===== Âm thanh (tạo bằng code, không cần file) =====
let audio;
function tone(f1, f2, dur, type = 'square', vol = 0.06) {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator();
    const g = audio.createGain();
    const t = audio.currentTime;
    o.type = type;
    o.frequency.setValueAtTime(f1, t);
    o.frequency.linearRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(audio.destination);
    o.start(t);
    o.stop(t + dur);
  } catch (e) { /* bỏ qua nếu trình duyệt chặn âm thanh */ }
}

// ===== Điều khiển =====
function reset() {
  score = 0;
  pipes = [];
  cow.y = H / 2 - 30;
  cow.vy = 0;
  cow.angle = 0;
  state = 'ready';
}

function flap() {
  if (state === 'ready') state = 'play';
  if (state === 'play') {
    cow.vy = FLAP_POWER;
    tone(480, 720, 0.1);
  } else if (state === 'over' && time - overAt > 600) {
    reset();
  }
}

function die() {
  if (state !== 'play') return;
  state = 'over';
  overAt = time;
  flash = 1;
  if (score > best) { best = score; saveBest(); }
  tone(220, 110, 0.7, 'sawtooth', 0.08); // tiếng "ụmmm" của bò
}

// ===== Toàn màn hình thật (ẩn thanh trình duyệt) =====
const fsBtn = document.getElementById('fs');
const root = document.documentElement;
const reqFs = root.requestFullscreen || root.webkitRequestFullscreen;
const exitFs = document.exitFullscreen || document.webkitExitFullscreen;
if (!reqFs) fsBtn.hidden = true; // iPhone Safari không hỗ trợ: dùng "Thêm vào Màn hình chính"

function toggleFullscreen() {
  try {
    const inFs = document.fullscreenElement || document.webkitFullscreenElement;
    const p = inFs ? exitFs.call(document) : reqFs.call(root);
    if (p && p.catch) p.catch(() => {});
  } catch (e) { /* bỏ qua */ }
}
fsBtn.addEventListener('click', () => { toggleFullscreen(); fsBtn.blur(); });

window.addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) {
    e.preventDefault();
    if (!e.repeat) flap();
  } else if (e.code === 'KeyF' && !e.repeat && !e.ctrlKey && !e.metaKey && reqFs) {
    toggleFullscreen();
  }
});
canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); flap(); });

// ===== Va chạm =====
function circleRect(cx, cy, r, rx, ry, rw, rh) {
  const nx = Math.max(rx, Math.min(cx, rx + rw));
  const ny = Math.max(ry, Math.min(cy, ry + rh));
  return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
}

function hitPipe(p) {
  return circleRect(cow.x, cow.y, COW_R, p.x, 0, PIPE_W, p.gapY) ||
         circleRect(cow.x, cow.y, COW_R, p.x, p.gapY + PIPE_GAP, PIPE_W, GROUND_Y);
}

// ===== Cập nhật =====
function update(dt) {
  clouds.forEach((c) => { c.x -= c.v * dt; if (c.x < -80) c.x = W + 80; });
  if (state !== 'over') groundX = (groundX + PIPE_SPEED * dt) % 24;
  wingPhase += dt * (state === 'over' ? 0 : (cow.vy < 0 ? 0.55 : 0.22));

  if (state === 'ready') {
    cow.y = H / 2 - 30 + Math.sin(time / 250) * 8;
    cow.angle = 0;
    return;
  }

  cow.vy += GRAVITY * dt;
  cow.y += cow.vy * dt;
  cow.angle = Math.max(-0.45, Math.min(1.2, cow.vy * 0.08));

  if (cow.y - COW_R < 0) { cow.y = COW_R; cow.vy = 0; }
  if (cow.y + COW_R >= GROUND_Y) {
    cow.y = GROUND_Y - COW_R;
    die();
    cow.vy = 0;
  }
  if (state === 'over') return;

  const last = pipes[pipes.length - 1];
  if (!last || last.x < W - PIPE_SPACING) {
    const min = 90;
    const max = GROUND_Y - PIPE_GAP - 90;
    pipes.push({ x: W, gapY: min + Math.random() * (max - min), passed: false });
  }

  for (const p of pipes) {
    p.x -= PIPE_SPEED * dt;
    if (!p.passed && p.x + PIPE_W < cow.x - COW_R) {
      p.passed = true;
      score++;
      tone(880, 1040, 0.1, 'triangle');
    }
    if (hitPipe(p)) { die(); break; }
  }
  pipes = pipes.filter((p) => p.x > -PIPE_W - 10);
}

// ===== Vẽ =====
function drawCloud(c) {
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  [[0, 0, 20], [22, -8, 24], [46, 0, 18]].forEach(([dx, dy, r]) => {
    ctx.beginPath();
    ctx.arc(c.x + dx * c.s, c.yf * GROUND_Y + dy * c.s, r * c.s, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawPipe(p) {
  const capH = 26, capX = p.x - 4, capW = PIPE_W + 8;
  const bottomY = p.gapY + PIPE_GAP;
  const grad = ctx.createLinearGradient(p.x, 0, p.x + PIPE_W, 0);
  grad.addColorStop(0, '#8be05f');
  grad.addColorStop(0.5, '#5cc13b');
  grad.addColorStop(1, '#3f9a2a');
  ctx.fillStyle = grad;
  ctx.strokeStyle = '#2b5f1c';
  ctx.lineWidth = 3;
  const box = (x, y, w, h) => { ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h); };
  box(p.x, -3, PIPE_W, p.gapY + 3);            // ống trên
  box(capX, p.gapY - capH, capW, capH);
  box(p.x, bottomY, PIPE_W, H);                // ống dưới
  box(capX, bottomY, capW, capH);
}

function drawGround() {
  ctx.fillStyle = '#ded895';
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
  ctx.fillStyle = '#73bf2e';
  ctx.fillRect(0, GROUND_Y, W, 16);
  ctx.fillStyle = '#5aa51f';
  for (let x = -groundX; x < W + 24; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, GROUND_Y);
    ctx.lineTo(x + 12, GROUND_Y);
    ctx.lineTo(x + 4, GROUND_Y + 16);
    ctx.lineTo(x - 8, GROUND_Y + 16);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#2b5f1c';
  ctx.fillRect(0, GROUND_Y, W, 3);
}

function drawWing(px, py, ang, color) {
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(ang);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-4, -26, -26, -36);
  ctx.quadraticCurveTo(-22, -27, -27, -23);
  ctx.quadraticCurveTo(-20, -20, -22, -12);
  ctx.quadraticCurveTo(-14, -13, -14, -4);
  ctx.quadraticCurveTo(-8, -6, 0, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawCow() {
  const DARK = '#2d2d3a';
  const flapA = -0.2 + Math.sin(wingPhase) * 0.7;
  ctx.save();
  ctx.translate(cow.x, cow.y);
  ctx.rotate(cow.angle);
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = DARK;

  drawWing(-4, -8, flapA * 0.9, '#a9c9f5');   // cánh sau

  // đuôi
  ctx.beginPath();
  ctx.moveTo(-21, -2);
  ctx.quadraticCurveTo(-32, -2, -31, 10);
  ctx.stroke();
  ctx.fillStyle = DARK;
  ctx.beginPath();
  ctx.ellipse(-31, 12, 3.5, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // chân
  [-13, 9].forEach((x) => {
    ctx.fillStyle = '#fff';
    ctx.fillRect(x, 10, 6, 9);
    ctx.strokeRect(x, 10, 6, 9);
    ctx.fillStyle = DARK;
    ctx.fillRect(x, 16, 6, 3);
  });

  // thân + đốm đen
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(0, 0, 23, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = DARK;
  ctx.beginPath(); ctx.ellipse(-12, 6, 8, 6, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(6, -10, 8, 5, -0.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // sừng
  ctx.fillStyle = '#f2d98b';
  ctx.beginPath(); ctx.moveTo(14, -17); ctx.lineTo(12, -27); ctx.lineTo(19, -19); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(24, -18); ctx.lineTo(28, -27); ctx.lineTo(30, -16); ctx.closePath(); ctx.fill(); ctx.stroke();

  // đầu
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(21, -7, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // tai
  ctx.fillStyle = DARK;
  ctx.beginPath();
  ctx.ellipse(9, -11, 6, 3.5, -0.5, 0, Math.PI * 2);
  ctx.fill();

  // mõm + lỗ mũi
  ctx.fillStyle = '#ffb3c1';
  ctx.beginPath();
  ctx.ellipse(28, -2, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#c2566e';
  [[26, -2], [31, -2]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill(); });

  // mắt
  ctx.fillStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(22, -11, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = DARK;
  ctx.beginPath(); ctx.arc(23, -11, 1.7, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 2;

  drawWing(-4, -8, flapA, '#f0f7ff');          // cánh trước

  ctx.restore();
}

function text(str, x, y, size, fill = '#fff') {
  ctx.font = `bold ${size}px "Trebuchet MS", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  ctx.lineWidth = size / 6;
  ctx.strokeStyle = '#2d2d3a';
  ctx.strokeText(str, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(str, x, y);
}

function drawUI() {
  if (state === 'ready') {
    const ty = H * 0.22;
    text('FLAPPY COW', W / 2, ty, 44, '#ffe27a');
    text('Bò có cánh đang chờ bạn', W / 2, ty + 40, 20);
    text('Nhấn Space hoặc chạm để bay', W / 2, H / 2 + 90, 20);
  } else {
    text(String(score), W / 2, 80, 54);
  }

  if (state === 'over') {
    ctx.fillStyle = 'rgba(30, 45, 25, 0.85)';
    const py = H / 2 - 110;
    ctx.beginPath();
    ctx.roundRect(W / 2 - 145, py, 290, 210, 18);
    ctx.fill();
    text('GAME OVER', W / 2, py + 55, 36, '#ff7b7b');
    text('Điểm: ' + score, W / 2, py + 102, 26);
    text('Kỷ lục: ' + best, W / 2, py + 140, 26, '#ffe27a');
    text('Nhấn để chơi lại', W / 2, py + 186, 18);
  }
}

function draw() {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0, '#4ec0ff');
  sky.addColorStop(1, '#cdeeff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  clouds.forEach(drawCloud);
  pipes.forEach(drawPipe);
  drawGround();
  drawCow();
  drawUI();

  if (flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${flash * 0.7})`;
    ctx.fillRect(0, 0, W, H);
    flash = Math.max(0, flash - 0.08);
  }
}

// ===== Vòng lặp game =====
let lastTime = performance.now();
function loop(now) {
  const dt = Math.min((now - lastTime) / 16.667, 2.5); // giữ tốc độ ổn định trên mọi màn hình
  lastTime = now;
  time = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
