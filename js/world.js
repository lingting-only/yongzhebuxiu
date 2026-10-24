/* world.js — 画布 / 相机 / 主题地图(地面/围墙/装饰,随关卡切换配色) */
'use strict';

const canvas = $('game');
const ctx = canvas.getContext('2d');
let DPR = 1;
const view = { w: 0, h: 0 };        // 逻辑视口
const cam  = { x: 0, y: 0 };        // 世界相机(左上角)

function resize(){
  const r = canvas.getBoundingClientRect();
  DPR = Math.min(window.devicePixelRatio || 1, 2);   // 限 2 倍,兼顾清晰与手机性能
  view.w = Math.round(r.width); view.h = Math.round(r.height);
  canvas.width  = Math.round(view.w * DPR);
  canvas.height = Math.round(view.h * DPR);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

/* 世界坐标是否在当前屏幕视口内(margin=四周边距) */
function inView(x, y, margin){
  return x > cam.x - margin && x < cam.x + view.w + margin &&
         y > cam.y - margin && y < cam.y + view.h + margin;
}

/* ── 主题地图:按关卡主题生成草地贴图/装饰 ── */
let groundPattern = null, curTheme = THEMES[0];

function makeGroundTile(theme){
  const c = document.createElement('canvas'); c.width = c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = theme.ground[0]; g.fillRect(0, 0, 96, 96);
  for (let i = 0; i < 150; i++){
    g.fillStyle = Math.random() < 0.5 ? theme.ground[1] : theme.ground[2];
    g.fillRect(randInt(0, 31) * 3, randInt(0, 31) * 3, 3, 3);
  }
  for (let i = 0; i < 9; i++){                       // 小草丛/碎石点缀
    const x = randInt(1, 30) * 3, y = randInt(1, 30) * 3;
    g.fillStyle = theme.tuft;
    g.fillRect(x, y + 3, 3, 3); g.fillRect(x + 3, y, 3, 6); g.fillRect(x + 6, y + 3, 3, 3);
  }
  return c;
}

/* 装饰:树/石头/灌木,固定坐标不挡路,只画视口附近的部分 */
const decor = [];
function initDecor(){
  decor.length = 0;
  const kinds = ['tree', 'rock', 'bush'];
  for (let i = 0; i < 48; i++){
    decor.push({
      kind: kinds[Math.random() < 0.42 ? 0 : Math.random() < 0.55 ? 1 : 2],
      x: rand(CONFIG.wall + 40, CONFIG.mapW - CONFIG.wall - 40),
      y: rand(CONFIG.wall + 40, CONFIG.mapH - CONFIG.wall - 40),
    });
  }
}

/* ★ 关卡切换时调用:换主题配色 + 重摆装饰 */
function loadTheme(stage){
  curTheme = THEMES[(stage - 1) % THEMES.length];
  groundPattern = ctx.createPattern(makeGroundTile(curTheme), 'repeat');
  rebuildDecorSprites(curTheme);
  initDecor();
}

/* 每帧:地面 + 石墙(在相机坐标系内调用,颜色取自当前主题) */
function drawGroundAndWalls(){
  const gx = Math.max(0, cam.x), gy = Math.max(0, cam.y);
  const gw = Math.min(CONFIG.mapW, cam.x + view.w) - gx;
  const gh = Math.min(CONFIG.mapH, cam.y + view.h) - gy;
  if (gw > 0 && gh > 0 && groundPattern){ ctx.fillStyle = groundPattern; ctx.fillRect(gx, gy, gw, gh); }

  const W = CONFIG.mapW, H = CONFIG.mapH, T = CONFIG.wall;
  ctx.fillStyle = curTheme.wall;
  ctx.fillRect(0, 0, W, T); ctx.fillRect(0, H - T, W, T);
  ctx.fillRect(0, 0, T, H); ctx.fillRect(W - T, 0, T, H);
  ctx.fillStyle = curTheme.wallDark;
  for (let x = 0; x < W; x += 26){ ctx.fillRect(x + 3, 7, 9, 6); ctx.fillRect(x + 15, 15, 9, 6); }
  for (let y = 0; y < H; y += 26){ ctx.fillRect(7, y + 3, 6, 9); ctx.fillRect(15, y + 15, 6, 9); }
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.fillRect(T - 3, T, 3, H - T * 2); ctx.fillRect(W - T, T, 3, H - T * 2);
  ctx.fillRect(T, T - 3, W - T * 2, 3); ctx.fillRect(T, H - T, W - T * 2, 3);
}
