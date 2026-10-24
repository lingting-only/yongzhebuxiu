/* main.js — 存档 / 初始化 / 主循环 / 渲染 */
'use strict';

/* ═══════════════ 存档(localStorage,自动保存;兼容 v2 旧档迁移) ═══════════════ */
const SAVE_KEY = 'pixel_idle_rpg_v3';
const SAVE_KEY_V2 = 'pixel_idle_rpg_v2';

/* ★ 多标签页防覆盖:每个标签页有随机 ID,点击/切到前台时"认领"存档所有权,
   只有持有所有权的标签页才允许写存档 → 后台的旧标签页不会把旧进度写回来 */
const TAB_ID = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
function claimTab(){ try{ localStorage.setItem('pixel_rpg_tab_owner', TAB_ID); }catch(e){} }
function tabMaySave(){ try{ return localStorage.getItem('pixel_rpg_tab_owner') === TAB_ID; }catch(e){ return true; } }
document.addEventListener('visibilitychange', () => { if (!document.hidden) claimTab(); });
window.addEventListener('pointerdown', claimTab, { passive: true });
window.addEventListener('keydown', claimTab);
claimTab();

function save(){
  if (!tabMaySave()) return;                     // 非活跃标签页:禁止写档
  try{
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      g: player.gold, m: player.mat, k: player.kills, c: player.chests, d: player.deaths,
      wb: player.wboost, al: player.armorLv, stage: G.stage, bs: G.bestStage,
      t: Date.now(),
      w: Object.fromEntries(Object.entries(player.weapons).map(([k, s]) => [k, s.lv])),
      s: player.skills, a: player.achievements,
      b: { a: player.buffs.atk, v: player.buffs.aspd, h: player.buffs.hp, p: player.buffs.spd, q: player.buffs.pickup },
    }));
  }catch(e){}
}
function load(){
  try{
    let d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (!d) d = JSON.parse(localStorage.getItem(SAVE_KEY_V2) || 'null');   // v2 旧档迁移
    if (!d) return;
    player.gold = d.g | 0; player.mat = d.m | 0; player.kills = d.k | 0; player.chests = d.c | 0;
    player.deaths = d.d | 0;
    player.wboost = Math.max(0, d.wb | 0); player.armorLv = Math.max(1, d.al | 0);
    G.stage = Math.max(1, d.stage | 0);
    G.bestStage = Math.max(G.stage, d.bs | 0);
    for (const k in (d.w || {}))
      if (WEAPONS[k]) player.weapons[k] = { lv: clamp(d.w[k] | 0, 1, 10), cd: 0, angle: Math.random() * 6 };
    for (const k in (d.s || {}))
      if (SKILLS[k]) player.skills[k] = clamp(d.s[k] | 0, 0, SKILLS[k].max);
    player.achievements = (d.a && typeof d.a === 'object') ? d.a : {};
    if (d.b){ player.buffs.atk = +d.b.a || 1; player.buffs.aspd = +d.b.v || 1; player.buffs.hp = d.b.h | 0;
              player.buffs.spd = +d.b.p || 1; player.buffs.pickup = +d.b.q || 1; }
    player.hp = playerMaxHp();
    /* ★ 离线收益:超过 minSec 按"离线挂机"结算(封顶 capSec) */
    const elapsed = d.t ? (Date.now() - d.t) / 1000 : 0;
    if (elapsed >= CONFIG.offline.minSec){
      const secs = Math.min(elapsed, CONFIG.offline.capSec);
      const rate = CONFIG.offline.base + G.stage * CONFIG.offline.perStage;
      G.offlineGold = Math.round(secs * rate);
      G.offlineMat  = Math.round(secs * rate / 8);
      G.offlineSecs = Math.round(secs);
    }
  }catch(e){}
}

/* ═══════════════ 渲染辅助 ═══════════════ */
function drawSpriteAt(img, x, y, flip, bob, alpha, scale){
  const sc = scale || 1;
  const w = img.width * sc, h = img.height * sc;
  const px = Math.round(x - w / 2), py = Math.round(y - h + (bob || 0));
  if (alpha !== undefined) ctx.globalAlpha = alpha;
  if (flip) ctx.drawImage(img, px + w, py, -w, h);      // 负宽 = 水平镜像
  else ctx.drawImage(img, px, py, w, h);
  ctx.globalAlpha = 1;
}
function drawShadow(x, y, w){
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath(); ctx.ellipse(x, y - 1, w, 4, 0, 0, Math.PI * 2); ctx.fill();
}
function drawMonster(m){
  const img = SPRITES[m.key];
  const sc = m.boss ? m.bossDef.scale : (m.elite ? ELITE.scale : 1);
  const bob = m.moving ? Math.sin(m.walkT * 13) * 1.5 : Math.sin(G.time * 2.5 + m.x) * 0.8;
  drawShadow(m.x, m.y, m.type.radius * (m.boss ? 1.8 : m.elite ? 1.4 : 1));
  /* 精英怪:金色光环脉冲 */
  if (m.elite){
    ctx.globalAlpha = 0.4 + Math.sin(G.time * 5) * 0.15;
    ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(m.x, m.y - 4, m.type.radius + 8 + Math.sin(G.time * 5) * 2, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  drawSpriteAt(img, m.x, m.y, m.dir < 0, bob, undefined, sc);
  if (m.flashT > 0){
    ctx.globalAlpha = Math.min(1, m.flashT / 0.12);
    drawSpriteAt(SPRITES_WHITE[m.key], m.x, m.y, m.dir < 0, bob, undefined, sc);
    ctx.globalAlpha = 1;
  }
  /* 精英/Boss 皇冠 */
  if (m.elite || m.boss){
    const crown = SPRITES.crown;
    const cw = crown.width * (m.boss ? 1.6 : 1);
    ctx.drawImage(crown, Math.round(m.x - cw / 2), Math.round(m.y - img.height * sc - (m.boss ? 14 : 8)), cw, crown.height * (m.boss ? 1.6 : 1));
  }
  /* 头顶小血条(Boss 用顶部大血条,不画) */
  if (m.hp < m.maxHp && !m.boss){
    const w = m.elite ? 34 : 26, pct = m.hp / m.maxHp;
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillRect(m.x - w / 2 - 1, m.y - img.height * sc - 9, w + 2, 5);
    ctx.fillStyle = pct > 0.5 ? '#6dde6d' : pct > 0.25 ? '#ffd24a' : '#ff5d5d';
    ctx.fillRect(m.x - w / 2, m.y - img.height * sc - 8, w * pct, 3);
  }
}
function drawPlayer(){
  if (player.dead){ drawShadow(player.x, player.y, 12); drawSpriteAt(SPRITES.tomb, player.x, player.y, false); return; }
  if (player.invT > 0 && Math.floor(player.invT * 10) % 2 === 0) return;
  const bob = player.moving ? Math.sin(player.walkT * 14) * 1.6 : Math.sin(G.time * 2.2) * 0.8;
  drawShadow(player.x, player.y, 12);
  if (player.upT > 0){                                   // 强化/选卡成功金圈
    const p = 1 - player.upT / 0.6;
    ctx.globalAlpha = 1 - p;
    ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(player.x, player.y - 12, 14 + p * 30, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (player.frenzyT > 0){                               // 狂暴红光
    ctx.globalAlpha = 0.5 + Math.sin(G.time * 12) * 0.2;
    ctx.strokeStyle = '#ff6a5a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(player.x, player.y - 12, 22, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  drawSpriteAt(SPRITES.player, player.x, player.y, player.dir < 0, bob);
}

/* ═══════════════ 每帧更新 ═══════════════ */
function update(dt){
  G.time += dt; G.shakeT -= dt;
  if (G.paused) return;                                  // 宝箱/工坊/帮助弹窗:世界暂停

  updateStage(dt);                                       // ★ 关卡推进/精英/事件
  G.spawnT -= dt;
  if (G.spawnT <= 0 && G.clearT <= 0){                   // 通关庆祝期不刷怪
    /* Boss 战期间小怪刷新减速,聚焦 Boss 对决 */
    G.spawnT = CONFIG.spawnInterval * (G.boss && G.boss.hp > 0 ? 1.8 : 1);
    spawnMonster();
    if (monsters.length < 8 && !(G.boss && G.boss.hp > 0)) spawnMonster();
  }
  updatePlayer(dt);
  for (const m of monsters) updateMonster(m, dt);
  separateMonsters();
  monsters = monsters.filter(m => m.hp > 0);
  updateDrops(dt);
  updateEnemyOrbs(dt);                                   // ★ Boss 弹幕
  updateEffects(dt);

  cam.x = clamp(player.x - view.w / 2, 0, Math.max(0, CONFIG.mapW - view.w));
  cam.y = clamp(player.y - view.h / 2, 0, Math.max(0, CONFIG.mapH - view.h));
  G.uiT -= dt;  if (G.uiT  <= 0){ G.uiT  = 0.25; refreshHUD(); }
  G.saveT -= dt; if (G.saveT <= 0){ G.saveT = 4; save(); }
  $('hurt-fx').style.opacity = Math.max(0, Math.min(1, player.hurtT * 3)) * 0.8;
}

/* ═══════════════ 渲染 ═══════════════ */
function render(){
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#10100e';                             // 地图外黑暗
  ctx.fillRect(0, 0, view.w, view.h);
  if (G.shakeT > 0){ const s = G.shakeT * 9; ctx.translate(rand(-s, s), rand(-s, s)); }
  ctx.translate(-cam.x, -cam.y);

  drawGroundAndWalls();

  /* 攻击范围提示圈 */
  ctx.strokeStyle = 'rgba(255,255,255,.13)'; ctx.lineWidth = 2;
  ctx.setLineDash([8, 10]);
  ctx.beginPath(); ctx.arc(player.x, player.y - 8, WEAPONS.sword.range, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);

  /* 掉落物(掉落类型名 → 精灵名映射) */
  const DROP_SPRITE = { gold: 'coin', mat: 'gem', heal: 'heart', chest: 'chest' };
  for (const d of drops){
    drawSpriteAt(SPRITES[DROP_SPRITE[d.kind]], d.x, d.y + 8 + Math.sin(G.time * 4 + d.seed) * 2.5, false);
  }

  /* 实体按 y 排序(装饰+怪+玩家统一排序) */
  const list = [];
  const vis = (x, y, pad) => x > cam.x - pad && x < cam.x + view.w + pad && y > cam.y - pad && y < cam.y + view.h + pad;
  for (const d of decor) if (vis(d.x, d.y, 80))
    list.push({ y: d.y, f: () => { drawShadow(d.x, d.y, DECOR_SPRITES[d.kind].width * 0.35);
                                   drawSpriteAt(DECOR_SPRITES[d.kind], d.x, d.y, false); } });
  for (const m of monsters) if (vis(m.x, m.y, 80)) list.push({ y: m.y, f: () => drawMonster(m) });
  list.push({ y: player.y, f: drawPlayer });
  list.sort((a, b) => a.y - b.y);
  for (const it of list) it.f();

  drawWeaponFX();                                        // 斧/弹体/电弧/爆炸

  /* ★ 敌方弹幕(Boss 红弹,需走位躲避) */
  for (const o of eorbs){
    const r = 6 + Math.sin(G.time * 14 + o.x) * 1.2;
    ctx.fillStyle = '#ff5d4a';
    ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd0a0';
    ctx.beginPath(); ctx.arc(o.x, o.y, r * 0.45, 0, Math.PI * 2); ctx.fill();
  }

  /* 挥砍弧光(scale:武器等级越高弧光越大) */
  for (const s of slashes){
    const p = 1 - s.t / s.max;
    const sc = s.scale || 1;
    ctx.globalAlpha = 1 - p;
    ctx.strokeStyle = s.color; ctx.lineWidth = (4 * (1 - p) + 1) * sc;
    ctx.beginPath(); ctx.arc(s.x, s.y, (10 + 20 * p) * sc, s.a - 0.9, s.a + 0.9); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  /* 粒子 */
  for (const p of puffs){
    ctx.globalAlpha = Math.max(0, p.t / p.life);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  /* 飘字 */
  ctx.textAlign = 'center';
  for (const f of floaters){
    ctx.globalAlpha = Math.min(1, f.t / f.life * 1.5);
    ctx.font = 'bold ' + f.size + 'px sans-serif';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.7)';
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  drawJoystick();                                        // 屏幕坐标系:摇杆
}

/* ═══════════════ 启动 ═══════════════ */
load();
resize();
initUI();
loadTheme(G.stage);                                    // ★ 按存档关卡加载主题地图
G.mods = rollStageMods(G.stage);
for (let i = 0; i < 12; i++) spawnMonster();           // 开局先刷一批怪
refreshHUD();
showEventBanner('第 ' + G.stage + ' 关 · ' + stageTheme().name +
  (G.mods.length ? ' [' + G.mods.map(m => m.name).join('·') + ']' : ''));
/* ★ 离线收益弹窗(load 时已按离线时长算好) */
if (G.offlineGold > 0){
  const h = Math.floor(G.offlineSecs / 3600), m = Math.floor(G.offlineSecs % 3600 / 60);
  $('offline-text').innerHTML = '你离线挂机了 <b>' + (h ? h + ' 小时 ' : '') + m + ' 分钟</b><br>' +
    '获得 <span style="color:#ffd24a">' + coinIcon(13) + ' ' + fmtNum(G.offlineGold) +
    '</span> + <span style="color:#7cc2ff">💎 ' + fmtNum(G.offlineMat) + '</span>';
  $('offline-mask').classList.remove('hidden');
  syncPause();
}
setTimeout(() => { const t = $('tip'); if (t) t.style.opacity = '0'; }, 6000);

let last = performance.now();
function frame(now){
  const dt = Math.min((now - last) / 1000, 0.05);        // 限 dt,切后台不跳帧
  last = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
