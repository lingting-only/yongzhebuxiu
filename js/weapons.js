/* ═══════════════════════════════════════════════════════════════
   weapons.js — 【核心】多武器同时自动攻击系统
   ------------------------------------------------------------
   玩家可拥有多把武器(宝箱解锁/升级),updateWeapons 每帧对
   每把武器独立冷却、独立索敌、并行开火:
     melee      近战挥砍最近敌人
     projectile 自动追踪魔法弹(可多发)
     orbit      旋风斧环绕自身,碰撞持续伤害(可多把)
     chain      闪电链在敌群间跳跃(可多跳)
     fireball   火球命中后范围爆炸
     spread     朝最近敌人扇形射出飞刀(可多发)
   ═══════════════════════════════════════════════════════════════ */
'use strict';

/* 找"屏幕可视区域内"最近的活怪(★ 只有敌人出现在屏幕上才攻击;
   同时仍受武器自身射程 range 限制) */
function nearestMonster(range, exclude){
  let best = null, bd = Infinity;
  for (const m of monsters){
    if (m.hp <= 0 || (exclude && exclude.has(m))) continue;
    if (!inView(m.x, m.y, 30)) continue;              // 视口外(留30px边距)不打
    const d = dist(player, m);
    if (d <= range + m.type.radius && d < bd){ bd = d; best = m; }
  }
  return best;
}

/* ★ 特效档位:lv 1-2 → 1档(基础),3-4 → 2档,5-6 → 3档,7+ → 4档(满特效)
   武器升级不只加伤害,攻击特效也随档位变炫:更大/拖尾/残影/双斩/冲击波 */
function fxTier(lv){ return lv >= 7 ? 4 : lv >= 5 ? 3 : lv >= 3 ? 2 : 1; }

/* 每帧驱动所有武器 */
function updateWeapons(dt){
  for (const key in player.weapons){
    const st = player.weapons[key], w = WEAPONS[key];
    st.cd -= dt;
    if (key === 'axe'){ st.angle = (st.angle + w.spin * dt) % (Math.PI * 2); }

    if (key === 'axe'){ updateOrbit(key, st, w, dt); continue; }   // 环绕斧无开火冷却,持续碰撞
    if (st.cd > 0) continue;
    st.cd = w.interval * intervalMul();                            // 攻速=武器间隔×急速×狂暴

    if      (w.type === 'melee')      fireMelee(key, st, w);
    else if (w.type === 'projectile') fireBolts(key, st, w);
    else if (w.type === 'chain')      fireChain(key, st, w);
    else if (w.type === 'fireball')   fireFireball(key, st, w);
    else if (w.type === 'spread')     fireKnives(key, st, w);
    else if (w.type === 'boomerang')  fireBoomerang(key, st, w);
  }
  updateProjectiles(dt);
}

/* ── 近战:锁定最近敌人挥砍(等级越高弧光越大越华丽) ── */
function fireMelee(key, st, w){
  const m = nearestMonster(w.range);
  if (!m) { st.cd = 0.08; return; }                                // 没目标快速重试
  player.dir = m.x < player.x ? -1 : 1;
  const tier = fxTier(st.lv);
  const cx = (player.x + m.x) / 2, cy = (player.y + m.y) / 2 - 10;
  const a = Math.atan2(m.y - player.y, m.x - player.x);
  const col = tier >= 3 ? '#ffd75e' : '#fff';                      // 三档+:金色弧光
  const scale = 1 + tier * 0.2;                                    // 弧光随档位放大
  slashes.push({ x: cx, y: cy, a, t: 0.18, max: 0.18, color: col, scale });
  if (tier >= 2)                                                   // 二档+:交叉双斩
    slashes.push({ x: cx, y: cy, a: a + 2.1, t: 0.18, max: 0.18, color: col, scale: scale * 0.8 });
  if (tier >= 3)                                                   // 三档+:命中冲击波
    booms.push({ x: m.x, y: m.y - 8, r: 6, max: 20 + tier * 6, t: 0.3, life: 0.3, color: '#ffd75e' });
  dealDamage(m, weaponDamage(key, st));
  sfx('hit');
}

/* ── 追踪弹:朝最近敌人发射(数量随等级) ── */
function fireBolts(key, st, w){
  const m = nearestMonster(w.range);
  if (!m) { st.cd = 0.12; return; }                                  // 没目标快速重试
  const n = weaponCount(key, st.lv);
  for (let i = 0; i < n; i++){
    const a = Math.atan2(m.y - player.y, m.x - player.x) + rand(-0.25, 0.25);
    projectiles.push({ kind:'bolt', key, x: player.x, y: player.y - 14,
                       vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed,
                       dmg: weaponDamage(key, st), life: w.range / w.speed, target: m,
                       lv: st.lv, size: 5 + st.lv * 0.35, trail: st.lv >= 3 });   // 高级:更大+紫色拖尾
  }
  sfx('shoot');
}

/* ── 闪电链:最近敌人起跳,链式跳跃 ── */
function fireChain(key, st, w){
  const first = nearestMonster(w.range);
  if (!first) { st.cd = 0.15; return; }
  const jumps = w.jumps + Math.floor(st.lv / w.countNote);
  const tier = fxTier(st.lv);
  const hitSet = new Set();
  const pts = [{ x: player.x, y: player.y - 16 }];
  let cur = first, dmg = weaponDamage(key, st);
  for (let i = 0; i < jumps && cur; i++){
    pts.push({ x: cur.x, y: cur.y - cur.type.radius });
    hitSet.add(cur);
    dealDamage(cur, dmg, { color: '#9fd8ff' });
    if (tier >= 2)                                                 // 二档+:每个命中点迸电火花
      for (let s = 0; s < 3; s++)
        puffs.push({ x: cur.x, y: cur.y - cur.type.radius, vx: rand(-70, 70), vy: rand(-90, -10),
                     t: 0.3, life: 0.3, color: '#bfe0ff', size: 2.5 });
    dmg *= 0.85;                                                   // 每跳衰减
    /* 从当前目标找下一个未命中且在屏幕内的近怪 */
    let next = null, nd = Infinity;
    for (const m of monsters){
      if (m.hp <= 0 || hitSet.has(m)) continue;
      if (!inView(m.x, m.y, 30)) continue;            // 闪电链也不跳出屏幕
      const d = dist(cur, m);
      if (d < w.jumpR && d < nd){ nd = d; next = m; }
    }
    cur = next;
  }
  arcs.push({ pts, t: 0.18, life: 0.18, seed: Math.random() * 100,
              width: 2.5 + st.lv * 0.2, dual: tier >= 3 });        // 三档+:蓝白双层电弧
  sfx('zap');
}

/* ── 火球:直线飞行,命中/耗尽后范围爆炸 ── */
function fireFireball(key, st, w){
  const m = nearestMonster(w.range);
  if (!m) { st.cd = 0.15; return; }
  const a = Math.atan2(m.y - player.y, m.x - player.x);
  projectiles.push({ kind:'fire', key, x: player.x, y: player.y - 16,
                     vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed,
                     dmg: weaponDamage(key, st), life: w.range / w.speed,
                     aoe: w.aoe + (st.lv >= 5 ? 20 : 0),
                     lv: st.lv, size: 7 + st.lv * 0.4 });           // 高级:火球更大
  sfx('shoot');
}

/* ── 飞刀阵:朝最近敌人扇形多发 ── */
function fireKnives(key, st, w){
  const m = nearestMonster(w.range);
  if (!m) { st.cd = 0.12; return; }
  const n = weaponCount(key, st.lv);
  const base = Math.atan2(m.y - player.y, m.x - player.x);
  for (let i = 0; i < n; i++){
    const a = base + (i - (n - 1) / 2) * (w.spread / Math.max(1, n - 1) * 2);
    projectiles.push({ kind:'knife', key, x: player.x, y: player.y - 14,
                       vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed,
                       dmg: weaponDamage(key, st), life: w.range / w.speed, ang: a,
                       lv: st.lv });                               // 绘制时按等级加长/镀金/拖尾
  }
  sfx('shoot');
}

/* ── 旋风斧:环绕玩家旋转,碰撞造成周期伤害 ── */
function updateOrbit(key, st, w, dt){
  const n = weaponCount(key, st.lv);
  for (let i = 0; i < n; i++){
    const a = st.angle + i * Math.PI * 2 / n;
    const ax = player.x + Math.cos(a) * w.orbitR;
    const ay = player.y - 10 + Math.sin(a) * w.orbitR;
    for (const m of monsters){
      if (m.hp <= 0) continue;
      if ((m.cds[key] || 0) > 0) continue;
      if (Math.hypot(m.x - ax, m.y - 10 - ay) < m.type.radius + 12){
        m.cds[key] = 0.45;                                         // 每只怪独立受击间隔
        dealDamage(m, weaponDamage(key, st), { color: '#ffd9a0' });
      }
    }
  }
}

/* ── 回旋镖:飞出后折返,往返两段都能命中(穿透) ── */
function fireBoomerang(key, st, w){
  const m = nearestMonster(w.range);
  if (!m) { st.cd = 0.15; return; }
  const n = weaponCount(key, st.lv);
  for (let i = 0; i < n; i++){
    const a = Math.atan2(m.y - player.y, m.x - player.x) + (i - (n - 1) / 2) * 0.5;
    projectiles.push({ kind:'boomerang', key, x: player.x, y: player.y - 14,
                       vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed,
                       dmg: weaponDamage(key, st), maxLife: w.range / w.speed,
                       life: w.range / w.speed, lv: st.lv, phase: 'out', hitSet: new Set() });
  }
  sfx('shoot');
}

/* ── 投射物飞行:追踪转向 / 碰撞 / 爆炸 ── */
function updateProjectiles(dt){
  for (const p of projectiles){
    p.life -= dt;
    /* ★ 窗口规则:弹体飞出屏幕(留60px余量)即失效——不向画面外射击;
       回旋镖例外(去程可能短暂出屏,返程回到玩家手中) */
    if (p.kind !== 'boomerang' && !inView(p.x, p.y, 60)){ p.dead = true; continue; }
    /* ★ 回旋镖:去程直线,半程后折返飞回玩家手中;命中不消失(往返双段) */
    if (p.kind === 'boomerang'){
      if (p.phase === 'out' && p.life <= p.maxLife / 2){
        p.phase = 'back';
        p.hitSet.clear();                            // 返程可再次命中同一目标
      }
      if (p.phase === 'back'){
        const dx = player.x - p.x, dy = player.y - 14 - p.y;
        const sp = Math.hypot(p.vx, p.vy) || 1;
        p.vx = dx / (Math.hypot(dx, dy) || 1) * sp;
        p.vy = dy / (Math.hypot(dx, dy) || 1) * sp;
        if (Math.hypot(dx, dy) < 22) p.dead = true;  // 回到手
      }
      if (p.life <= 0) p.dead = true;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if ((p.lv || 1) >= 3 && Math.random() < 0.4)
        puffs.push({ x: p.x, y: p.y, vx: 0, vy: 0, t: 0.2, life: 0.2, color: '#aef5d0', size: 2.5 });
      for (const m of monsters){
        if (m.hp <= 0 || p.hitSet.has(m)) continue;
        if (!inView(m.x, m.y, 30)) continue;         // ★ 屏幕外的敌人不被伤害
        if (Math.hypot(m.x - p.x, m.y - 10 - p.y) < m.type.radius + 9){
          p.hitSet.add(m);
          dealDamage(m, p.dmg, { color: '#aef5d0' });
        }
      }
      continue;                                      // 回旋镖不走下方通用命中逻辑
    }
    /* 魔导弹持续追踪(目标死亡或离开屏幕就直线飞,飞出屏幕即失效) */
    if (p.kind === 'bolt' && p.target && p.target.hp > 0 && inView(p.target.x, p.target.y, 30)){
      const want = Math.atan2(p.target.y - 10 - p.y, p.target.x - p.x);
      const cur = Math.atan2(p.vy, p.vx);
      let diff = want - cur;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turn = 6 * dt;                                         // 每秒最多转6弧度
      const na = cur + clamp(diff, -turn, turn);
      const sp = Math.hypot(p.vx, p.vy);
      p.vx = Math.cos(na) * sp; p.vy = Math.sin(na) * sp;
    }
    p.x += p.vx * dt; p.y += p.vy * dt;
    /* 高级魔导弹:紫色能量拖尾 */
    if (p.kind === 'bolt' && p.trail && Math.random() < 0.6)
      puffs.push({ x: p.x, y: p.y, vx: 0, vy: 0, t: 0.22, life: 0.22, color: '#b07dff', size: 3 });
    /* 火球尾焰:等级越高越浓 */
    if (p.kind === 'fire' && Math.random() < 0.25 + (p.lv || 1) * 0.05)
      puffs.push({ x: p.x, y: p.y, vx: rand(-15,15), vy: rand(-15,15), t: 0.25, life: 0.25, color: '#ff9440', size: 3 });

    /* 命中判定(★ 只命中屏幕内可见的敌人) */
    let hit = null;
    for (const m of monsters){
      if (m.hp <= 0 || !inView(m.x, m.y, 30)) continue;
      if (Math.hypot(m.x - p.x, m.y - 10 - p.y) < m.type.radius + 7){ hit = m; break; }
    }
    if (hit || p.life <= 0){
      p.dead = true;
      if (p.kind === 'fire'){                                      // 火球:范围爆炸(等级越高爆得越炫)
        booms.push({ x: p.x, y: p.y, r: 8, max: p.aoe, t: 0.35, life: 0.35, color: '#ff9440' });
        const t4 = fxTier(p.lv || 1);
        for (let i = 0; i < 3 + t4 * 3; i++)
          puffs.push({ x: p.x, y: p.y, vx: rand(-140, 140), vy: rand(-140, 140), t: 0.4, life: 0.4,
                       color: Math.random() < 0.5 ? '#ff9440' : '#ffd23e', size: rand(3, 5) });
        for (const m of monsters.slice()){
          if (m.hp > 0 && inView(m.x, m.y, 30) && dist(m, { x: p.x, y: p.y + 10 }) < p.aoe + m.type.radius)
            dealDamage(m, p.dmg, { color: '#ffb347' });
        }
        sfx('boom');
      } else if (hit){
        dealDamage(hit, p.dmg);
        const n = 2 + fxTier(p.lv || 1) * 2;                       // 命中火花随档位增多
        for (let i = 0; i < n; i++)
          puffs.push({ x: p.x, y: p.y, vx: rand(-80, 80), vy: rand(-80, 80), t: 0.25, life: 0.25,
                       color: p.kind === 'bolt' ? '#cfe8ff' : '#dfe8f2', size: 3 });
      }
    }
  }
  projectiles = projectiles.filter(p => !p.dead && p.life > 0);
}

/* ── 武器相关绘制(世界坐标系内调用):斧/弹体/电弧/爆炸 ── */
function drawWeaponFX(){
  /* 旋风斧:等级→放大 + 残影拖尾 + 轨迹圈 */
  const axeSt = player.weapons.axe;
  if (axeSt && !player.dead){
    const w = WEAPONS.axe, n = weaponCount('axe', axeSt.lv);
    const lv = axeSt.lv, sc = 1 + Math.min(0.5, lv * 0.05);
    const img = SPRITES.axe;
    const drawAxeAt = (a, alpha) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(player.x + Math.cos(a) * w.orbitR, player.y - 10 + Math.sin(a) * w.orbitR);
      ctx.rotate(G.time * w.spin * 2);
      ctx.drawImage(img, -img.width * sc / 2, -img.height * sc / 2, img.width * sc, img.height * sc);
      ctx.restore();
      ctx.globalAlpha = 1;
    };
    if (lv >= 5){                                                  // 五级+:金色虚线轨迹圈
      ctx.strokeStyle = 'rgba(255,217,94,.28)'; ctx.lineWidth = 2; ctx.setLineDash([6, 8]);
      ctx.beginPath(); ctx.arc(player.x, player.y - 10, w.orbitR, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    for (let i = 0; i < n; i++){
      const a = axeSt.angle + i * Math.PI * 2 / n;
      if (lv >= 3){ drawAxeAt(a - 0.28, 0.22); drawAxeAt(a - 0.56, 0.1); }   // 三级+:残影
      drawAxeAt(a, 1);
    }
  }
  /* 投射物(尺寸/光效随等级) */
  for (const p of projectiles){
    if (p.kind === 'bolt'){
      const r = p.size || 5;
      if ((p.lv || 1) >= 5){                                       // 五级+:外圈能量光环
        ctx.strokeStyle = 'rgba(176,125,255,.45)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, r + 3.5, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = '#b07dff';
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8d5ff';
      ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.5, 0, Math.PI * 2); ctx.fill();
    } else if (p.kind === 'fire'){
      const r = (p.size || 7) * (1 + Math.sin(G.time * 18) * 0.08);   // 火焰脉动
      ctx.fillStyle = '#ff7b2d';
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.5, 0, Math.PI * 2); ctx.fill();
    } else if (p.kind === 'boomerang'){
      /* 旋转十字镖 */
      const lv = p.lv || 1, r = 8 + lv * 0.6;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(G.time * 16);
      ctx.fillStyle = lv >= 7 ? '#ffd75e' : '#d8f0e2';
      ctx.fillRect(-r, -2.5, r * 2, 5);
      ctx.fillRect(-2.5, -r, 5, r * 2);
      ctx.fillStyle = '#5a8a72';
      ctx.fillRect(-2.5, -2.5, 5, 5);
      ctx.restore();
    } else if (p.kind === 'knife'){
      const lv = p.lv || 1, len = 12 + lv * 0.8;
      const gold = lv >= 7;                                        // 七级+:镀金飞刀
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.atan2(p.vy, p.vx));
      if (lv >= 4){                                                // 四级+:刀光拖尾线
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = gold ? '#ffd75e' : '#dfe8f2'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-len - 8, 0); ctx.lineTo(-len, 0); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = gold ? '#ffd75e' : '#dfe8f2';
      ctx.fillRect(-len / 2, -1.5, len, 3);
      ctx.fillStyle = gold ? '#c8871e' : '#8a93a3';
      ctx.fillRect(-len / 2, -1.5, 4, 3);
      ctx.restore();
    }
  }
  /* 闪电链(锯齿折线;高级=更粗+蓝白双层) */
  for (const a of arcs){
    const buildPath = () => {
      ctx.beginPath();
      for (let i = 0; i < a.pts.length - 1; i++){
        const p1 = a.pts[i], p2 = a.pts[i + 1];
        ctx.moveTo(p1.x, p1.y);
        const segs = 4;
        for (let s = 1; s <= segs; s++){
          const t = s / segs;
          const jx = (s < segs) ? (Math.sin(a.seed + s * 12.9898 + i * 78.233) * 10) : 0;   // 伪随机抖动
          const jy = (s < segs) ? (Math.cos(a.seed + s * 4.1414 + i * 39.7) * 10) : 0;
          ctx.lineTo(p1.x + (p2.x - p1.x) * t + jx, p1.y + (p2.y - p1.y) * t + jy);
        }
      }
    };
    ctx.globalAlpha = Math.min(1, a.t / a.life * 1.5);
    if (a.dual){                                                   // 三档+:外层蓝色粗弧
      ctx.strokeStyle = '#7cb8ff'; ctx.lineWidth = (a.width || 2.5) + 2.5;
      buildPath(); ctx.stroke();
    }
    ctx.strokeStyle = a.dual ? '#eaf6ff' : '#bfe0ff';
    ctx.lineWidth = a.width || 2.5;
    buildPath(); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  /* 爆炸圈 */
  for (const b of booms){
    const p = 1 - b.t / b.life;
    ctx.globalAlpha = (1 - p) * 0.8;
    ctx.strokeStyle = b.color; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = (1 - p) * 0.25;
    ctx.fillStyle = b.color;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.8, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}
