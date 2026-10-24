/* input.js — 触屏/鼠标虚拟摇杆 + PC 键盘 */
'use strict';

const joy = { active: false, id: null, cx: 0, cy: 0, vx: 0, vy: 0 };
const JOY_R = 56;
const keys = {};

/* 手指按下 → 按下处生成摇杆;拖动 → 方向向量;抬起 → 消失 */
canvas.addEventListener('pointerdown', e => {
  initAudio();
  if (joy.active || G.paused) return;
  const r = canvas.getBoundingClientRect();
  joy.active = true; joy.id = e.pointerId;
  joy.cx = e.clientX - r.left; joy.cy = e.clientY - r.top;
  joy.vx = joy.vy = 0;
  e.preventDefault();
});
window.addEventListener('pointermove', e => {
  if (!joy.active || e.pointerId !== joy.id) return;
  const r = canvas.getBoundingClientRect();
  let dx = (e.clientX - r.left) - joy.cx, dy = (e.clientY - r.top) - joy.cy;
  const len = Math.hypot(dx, dy);
  if (len > JOY_R){ dx = dx / len * JOY_R; dy = dy / len * JOY_R; }
  joy.vx = dx / JOY_R; joy.vy = dy / JOY_R;
});
function joyEnd(e){ if (joy.active && e.pointerId === joy.id){ joy.active = false; joy.vx = joy.vy = 0; } }
window.addEventListener('pointerup', joyEnd);
window.addEventListener('pointercancel', joyEnd);
window.addEventListener('contextmenu', e => e.preventDefault());

/* PC 键盘:WASD / 方向键 */
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) e.preventDefault();
  keys[k] = true; initAudio();
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
function keyVec(){
  let x = 0, y = 0;
  if (keys['a'] || keys['arrowleft'])  x -= 1;
  if (keys['d'] || keys['arrowright']) x += 1;
  if (keys['w'] || keys['arrowup'])    y -= 1;
  if (keys['s'] || keys['arrowdown'])  y += 1;
  return { x, y };
}

/* 摇杆绘制(屏幕坐标系内调用) */
function drawJoystick(){
  if (!joy.active) return;
  ctx.fillStyle = 'rgba(255,255,255,.07)';
  ctx.beginPath(); ctx.arc(joy.cx, joy.cy, JOY_R, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.3)';
  ctx.beginPath(); ctx.arc(joy.cx + joy.vx * (JOY_R - 16), joy.cy + joy.vy * (JOY_R - 16), 22, 0, Math.PI * 2); ctx.fill();
}
