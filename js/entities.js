/* entities.js — 全局状态 / 玩家 / 怪物 / 关卡推进 / Boss / 事件 / 特效实体 */
'use strict';

/* ── 全局游戏状态 ── */
const G = {
  paused: false,        // 宝箱/工坊/帮助弹窗打开时暂停世界
  muted: false,
  time: 0, shakeT: 0,
  spawnT: 0, uiT: 0, saveT: 0,
  killSinceChest: 0,    // 宝箱保底计数

  /* ★ 闯关状态 */
  stage: 1,             // 当前关卡(无限推进)
  bestStage: 1,         // 历史最高关卡
  stageKills: 0,        // 本关击杀进度
  boss: null,           // 当前 Boss 引用
  bossSpawned: false,   // 本关 Boss 是否已出现
  clearT: 0,            // 通关庆祝倒计时(>0 时停止刷怪)
  mods: [],             // 本关挑战词条

  /* 离线收益(load 时计算,领取后清零) */
  offlineGold: 0, offlineMat: 0, offlineSecs: 0,

  /* 精英怪与随机事件 */
  eliteT: 24,           // 精英怪倒计时
  eventT: 45,           // 随机事件倒计时
  rageT: 0,             // 怪物狂暴剩余时间
  achT: 1,              // 成就检查计时
};

/* ── 玩家 ── */
const player = {
  x: CONFIG.mapW / 2, y: CONFIG.mapH / 2,
  hp: CONFIG.player.hp,
  gold: 0, mat: 0, kills: 0, chests: 0, deaths: 0,
  achievements: {},                       // 已解锁成就 {key:true}
  weaponLv: 1, armorLv: 1, wboost: 0,
  weapons: { sword: { lv: 1, cd: 0, angle: 0 } },     // 开局只有铁剑
  skills: {},
  buffs: { atk: 1, aspd: 1, spd: 1, pickup: 1, hp: 0 },
  dir: 1, dead: false, reviveT: 0, invT: 0,
  hurtT: 0, walkT: 0, moving: false, upT: 0,
  meteorCd: 5, frenzyCd: 8, frenzyT: 0,     // 主动技能计时
  stillT: 0, huntWarned: false,             // 站桩计时 / 围猎提示标记
};
let monsters = [], drops = [], projectiles = [], floaters = [], slashes = [], puffs = [], arcs = [], booms = [];
let eorbs = [];        // ★ 敌方弹幕(Boss 发射,玩家需躲避)

/* ── 派生属性 ── */
const playerAtk   = () => (CONFIG.player.atk + player.wboost * CONFIG.upgrade.atkPerLv) * player.buffs.atk;
const playerMaxHp = () => CONFIG.player.hp + (player.armorLv - 1) * CONFIG.upgrade.hpPerLv + player.buffs.hp;
const playerSpeed = () => CONFIG.player.speed * player.buffs.spd;
const pickupRadius= () => CONFIG.pickup.radius * player.buffs.pickup * (1 + (player.skills.magnet || 0) * 0.4);
const critChance  = () => CONFIG.player.critChance + (player.skills.crit || 0) * 0.08;
const intervalMul = () => player.buffs.aspd * (player.frenzyT > 0 ? 0.5 : 1) * atkSlowMul();   // 狂暴×2速 / 站桩降速
function weaponDamage(key, st){
  const w = WEAPONS[key];
  return w.dmg * (1 + 0.25 * (st.lv - 1)) * (playerAtk() / CONFIG.player.atk);
}
/* ★ 难度成长(三重驱动,越往后越难):
   ① 玩家成长:武器+技能总等级越多,新刷的怪越强(×0.04/级)
   ② 关卡深度:每关攻击 +0.20/关(血量另享 stageHpMul 的 +18%/关)
   ③ 站桩围猎:站着不动怪加速+自身攻速下降 */
function difficulty(){
  let total = player.armorLv - 1 + player.wboost;
  for (const k in player.weapons) total += player.weapons[k].lv;
  for (const k in player.skills)  total += player.skills[k];
  return 1 + total * 0.04 + (G.stage - 1) * 0.20;
}
const monsterCap = () => CONFIG.maxMonsters + modMul('cap');   // 蜂群词条加怪位
function huntBoost(){
  const c = CONFIG.idleHunt;
  const t = player.stillT - c.delay;
  if (t <= 0) return 0;
  return Math.min(c.maxBoost, c.maxBoost * t / c.rampTime);
}
/* ★ 站桩攻速惩罚:攻击间隔乘数(1=无惩罚,最大 1+atkSlow),与围猎同步爬升 */
function atkSlowMul(){
  const c = CONFIG.idleHunt;
  const t = player.stillT - c.delay;
  if (t <= 0) return 1;
  return 1 + Math.min(c.atkSlow, c.atkSlow * t / c.rampTime);
}
/* ★ 关卡血量成长:每深入一关,怪物基础血量 +18%(独立于玩家成长的难度曲线) */
const stageHpMul = () => 1 + (G.stage - 1) * 0.18;

/* ═══════════ 刷怪(环形刷怪 + 关卡词条 + 精英怪) ═══════════ */
function spawnMonster(forceElite){
  if (monsters.length >= monsterCap() && !forceElite) return;
  for (let i = 0; i < 12; i++){
    const a = Math.random() * Math.PI * 2;
    const r = rand(340, 620);
    const x = clamp(player.x + Math.cos(a) * r, CONFIG.wall + 40, CONFIG.mapW - CONFIG.wall - 40);
    const y = clamp(player.y + Math.sin(a) * r, CONFIG.wall + 40, CONFIG.mapH - CONFIG.wall - 40);
    if (Math.hypot(x - player.x, y - player.y) < 280) continue;
    const key = weightedPick(monsterWeights(G.stage));
    const type = MONSTER_TYPES[key], df = difficulty();
    /* 精英判定:定时器到点 or 强制 */
    const elite = forceElite === true;
    const hpMul = (elite ? ELITE.hpMul : 1) * modMul('hp') * stageHpMul();   // ★ 关卡越深血越厚
    monsters.push({
      key, type, x, y, elite,
      hp: Math.round(type.hp * df * hpMul), maxHp: Math.round(type.hp * df * hpMul),
      atk: Math.round(type.atk * (1 + (df - 1) * 0.8) * (elite ? ELITE.atkMul : 1) * modMul('atk')),
      speed: type.speed * (elite ? ELITE.speedMul : 1) * modMul('speed'),
      atkCd: rand(0.3, 1), state: 'wander',
      wx: x, wy: y, waitT: rand(0, 2),
      flashT: 0, dir: Math.random() < 0.5 ? -1 : 1, walkT: 0, moving: false,
      cds: {},
    });
    return true;
  }
  return false;
}

/* ═══════════ ★ Boss 出现:每关达到击杀目标后在屏幕外刷新 ═══════════ */
function spawnBoss(){
  const theme = stageTheme();
  const B = BOSSES[theme.boss];
  const df = difficulty();
  const a = Math.random() * Math.PI * 2, r = 420;
  const x = clamp(player.x + Math.cos(a) * r, CONFIG.wall + 80, CONFIG.mapW - CONFIG.wall - 80);
  const y = clamp(player.y + Math.sin(a) * r, CONFIG.wall + 80, CONFIG.mapH - CONFIG.wall - 80);
  const hp = Math.round(B.hp * df * modMul('hp') * stageHpMul());   // ★ Boss 血量同享关卡成长
  G.boss = {
    key: B.sprite, type: { name: B.name, radius: B.radius, aggro: 1e9, atkRange: B.atkRange, atkInterval: B.atkInterval, gold: B.gold, matChance: 1, speed: B.speed, hp: B.hp, atk: B.atk },
    bossDef: B, boss: true, x, y,
    hp, maxHp: hp,
    atk: Math.round(B.atk * (1 + (df - 1) * 0.6) * modMul('atk')),
    atkCd: 1, state: 'chase',
    skillCd: 3, skillIdx: 0, windupT: 0, dashT: 0,
    flashT: 0, dir: 1, walkT: 0, moving: true, waitT: 0, wx: x, wy: y,
    cds: {},
  };
  monsters.push(G.boss);
  showEventBanner('⚠ ' + B.name + ' 降临!');
  G.shakeT = 0.4; sfx('boom');
  refreshHUD();
}

/* ═══════════ ★ 关卡推进:击杀目标 → Boss → 通关 → 下一关 ═══════════ */
function rollStageMods(stage){
  const mods = [];
  if (stage >= 2){
    const pool = STAGE_MODS.slice();
    const n = stage >= 5 && Math.random() < 0.5 ? 2 : 1;
    for (let i = 0; i < n && pool.length; i++)
      mods.push(pool.splice(randInt(0, pool.length - 1), 1)[0]);
  }
  return mods;
}
function nextStage(){
  G.stage++;
  G.bestStage = Math.max(G.bestStage, G.stage);
  buzz(60);
  G.stageKills = 0; G.bossSpawned = false; G.boss = null; G.clearT = 0;
  /* 清场:怪/弹幕清空,地面掉落折算入包(宝箱保留在脚下) */
  monsters = []; eorbs = []; projectiles = [];
  let keepChests = 0;
  for (const d of drops){
    if (d.kind === 'gold') player.gold += d.v;
    else if (d.kind === 'mat') player.mat += d.v;
    else if (d.kind === 'chest') keepChests++;
  }
  drops = [];
  for (let i = 0; i < keepChests; i++) spawnDrop(player.x + rand(-30, 30), player.y + rand(-30, 30), 'chest', 1);
  player.hp = playerMaxHp();                          // 通关奖励:回满血
  player.gold += 30 + G.stage * 20;                   // 通关金币奖励
  loadTheme(G.stage);                                 // → world.js 换主题地图
  G.mods = rollStageMods(G.stage);
  showEventBanner('第 ' + G.stage + ' 关 · ' + stageTheme().name +
    (G.mods.length ? ' [' + G.mods.map(m => m.name).join('·') + ']' : ''));
  sfx('up'); save(); refreshHUD();
}
function updateStage(dt){
  G.rageT -= dt;
  G.eliteT -= dt;
  if (G.eliteT <= 0){                                 // ★ 精英怪:定时出现
    G.eliteT = ELITE.interval;
    if (spawnMonster(true)) showEventBanner('✨ 精英怪出现,必掉宝箱!');
  }
  /* 通关庆祝阶段 → 倒计时结束进入下一关 */
  if (G.clearT > 0){
    G.clearT -= dt;
    if (G.clearT <= 0){ $('stage-mask').classList.add('hidden'); nextStage(); }
    return;
  }
  /* 击杀目标达成 → 刷 Boss */
  if (!G.bossSpawned && G.stageKills >= stageQuota(G.stage)){
    G.bossSpawned = true;
    spawnBoss();
    return;
  }
  /* ★ 随机事件 */
  G.eventT -= dt;
  if (G.eventT <= 0){
    G.eventT = rand(CONFIG.events.minT, CONFIG.events.maxT);
    runRandomEvent();
  }

  /* ★ 成就检查(每秒一次,达成即解锁并发奖) */
  G.achT -= dt;
  if (G.achT <= 0){
    G.achT = 1;
    checkAchievements();
  }
}
function checkAchievements(){
  let any = false;
  for (const a of ACHIEVEMENTS){
    if (player.achievements[a.key]) continue;
    if (a.check()){
      player.achievements[a.key] = true;
      any = true;
      if (a.gold) player.gold += a.gold;
      if (a.mat)  player.mat += a.mat;
      showEventBanner('🏆 成就解锁:' + a.name + (a.gold ? ' · 金币+' + a.gold : '') + (a.mat ? ' · 材料+' + a.mat : ''));
      floaters.push({ x: player.x, y: player.y - 50, text: a.icon + ' ' + a.name,
                      color: '#ffd23e', t: 1.4, life: 1.4, size: 16, vy: -36 });
      sfx('up'); buzz(30);
    }
  }
  if (any){ save(); refreshHUD(); }
}
function runRandomEvent(){
  const ev = EVENTS[randInt(0, EVENTS.length - 1)];
  showEventBanner(ev.name);
  if (ev.key === 'chestrain'){                        // 宝箱雨
    for (let i = 0; i < 6; i++){
      const a = Math.random() * Math.PI * 2, r = rand(60, 170);
      spawnDrop(clamp(player.x + Math.cos(a) * r, 60, CONFIG.mapW - 60),
                clamp(player.y + Math.sin(a) * r, 60, CONFIG.mapH - 60), 'chest', 1);
    }
    sfx('chest');
  } else if (ev.key === 'goldrain'){                  // 金币雨
    for (let i = 0; i < 22; i++){
      const a = Math.random() * Math.PI * 2, r = rand(40, 200);
      spawnDrop(clamp(player.x + Math.cos(a) * r, 60, CONFIG.mapW - 60),
                clamp(player.y + Math.sin(a) * r, 60, CONFIG.mapH - 60), 'gold', randInt(3, 8));
    }
    sfx('coin');
  } else if (ev.key === 'rage'){                      // 怪物狂暴
    G.rageT = 15; sfx('hurt');
  } else if (ev.key === 'swarm'){                     // 怪物狂潮
    for (let i = 0; i < 6; i++) spawnMonster();
    sfx('boom');
  }
}

/* ═══════════ 统一伤害入口:暴击 / 吸血 / 飘字 / 击杀 ═══════════ */
function dealDamage(m, baseDmg, opts){
  opts = opts || {};
  const crit = opts.noCrit ? false : Math.random() < critChance();
  let dmg = Math.max(1, Math.round(baseDmg * rand(0.9, 1.1) * (crit ? CONFIG.player.critMult : 1)));
  m.hp -= dmg; m.flashT = 0.12;
  floaters.push({ x: m.x + rand(-6, 6), y: m.y - 26 * (m.boss ? 2.4 : 1) * (m.elite ? 1.5 : 1),
                  text: crit ? dmg + '!' : '' + dmg,
                  color: crit ? '#ffd23e' : (opts.color || '#fff'), t: 0.8, life: 0.8,
                  size: crit ? 19 : 13, vy: -50 });
  const leech = player.skills.leech || 0;
  if (leech > 0 && !player.dead){
    player.hp = Math.min(playerMaxHp(), player.hp + dmg * 0.05 * leech);
  }
  if (m.hp <= 0) killMonster(m);      // → loot.js 掉落
  return dmg;
}

/* ═══════════ 玩家:受击 / 死亡 / 复活 ═══════════ */
function hurtPlayer(dmg){
  if (player.dead || player.invT > 0) return;
  const guard = player.skills.guard || 0;
  dmg = Math.max(1, Math.round(dmg * (1 - 0.12 * guard) * rand(0.9, 1.1)));
  player.hp -= dmg; player.hurtT = 0.2; G.shakeT = 0.18;
  buzz(25);
  floaters.push({ x: player.x, y: player.y - 32, text: '-' + dmg, color: '#ff6a6a',
                  t: 0.8, life: 0.8, size: 14, vy: -46 });
  sfx('hurt');
  /* ★ 荆棘技能:受击时对周围敌人反弹伤害 */
  const thorns = player.skills.thorns || 0;
  if (thorns > 0 && !player.dead){
    const dmg = playerAtk() * 0.6 * thorns;
    for (const m of monsters.slice()){
      if (m.hp > 0 && dist(m, player) < 110)
        dealDamage(m, dmg, { noCrit: true, color: '#aef5d0' });
    }
  }
  if (player.hp <= 0){
    player.hp = 0; player.dead = true;
    player.reviveT = CONFIG.player.reviveDelay;
    player.deaths++;
    $('revive-mask').classList.remove('hidden');
    for (const m of monsters) if (!m.boss) m.state = 'wander';
    sfx('dead');
  }
  refreshHUD();
}
function revive(){
  player.dead = false; player.hp = playerMaxHp();
  player.invT = CONFIG.player.invTime;
  $('revive-mask').classList.add('hidden');
  sfx('revive');
  refreshHUD();
}

/* ═══════════ 玩家更新:移动 + 主动技能 ═══════════ */
function updatePlayer(dt){
  player.hurtT -= dt; player.invT -= dt; player.upT -= dt; player.frenzyT -= dt;
  if (player.dead){
    player.reviveT -= dt;
    $('revive-text').textContent = Math.max(1, Math.ceil(player.reviveT));
    if (player.reviveT <= 0) revive();
    return;
  }
  const regen = player.skills.regen || 0;
  if (regen > 0) player.hp = Math.min(playerMaxHp(), player.hp + playerMaxHp() * 0.015 * regen * dt);

  if ((player.skills.meteor || 0) > 0){
    player.meteorCd -= dt;
    if (player.meteorCd <= 0 && monsters.length){
      player.meteorCd = SKILLS.meteor.cd;
      const dmg = playerAtk() * (2 + player.skills.meteor);
      for (const m of monsters.slice()){
        if (!inView(m.x, m.y, 30)) continue;
        booms.push({ x: m.x, y: m.y - 6, r: 8, max: 46, t: 0.4, life: 0.4, color: '#ffb347' });
        dealDamage(m, dmg, { noCrit: true, color: '#ffb347' });
      }
      G.shakeT = 0.3; sfx('boom');
    }
  }
  if ((player.skills.frenzy || 0) > 0){
    player.frenzyCd -= dt;
    if (player.frenzyCd <= 0){
      player.frenzyCd = SKILLS.frenzy.cd;
      player.frenzyT = SKILLS.frenzy.dur;
      floaters.push({ x: player.x, y: player.y - 46, text: '狂暴!', color: '#ff8a5a',
                      t: 1, life: 1, size: 16, vy: -40 });
      sfx('up');
    }
  }

  const kv = keyVec();
  let mx = joy.vx + kv.x, my = joy.vy + kv.y;
  const ml = Math.hypot(mx, my);
  if (ml > 1){ mx /= ml; my /= ml; }
  player.moving = ml > 0.05;

  player.stillT = player.moving ? 0 : player.stillT + dt;
  if (player.moving){
    player.huntWarned = false;
  } else if (player.stillT >= CONFIG.idleHunt.delay && !player.huntWarned && monsters.length){
    player.huntWarned = true;
    floaters.push({ x: player.x, y: player.y - 56, text: '⚠ 站桩惩罚:怪加速·攻速降!',
                    color: '#ff8a5a', t: 1.4, life: 1.4, size: 14, vy: -20 });
    sfx('zap');
  }

  if (player.moving){
    player.x += mx * playerSpeed() * dt;
    player.y += my * playerSpeed() * dt;
    const M = CONFIG.wall + 18;
    player.x = clamp(player.x, M, CONFIG.mapW - M);
    player.y = clamp(player.y, M, CONFIG.mapH - M);
    if (Math.abs(mx) > 0.05) player.dir = mx < 0 ? -1 : 1;
    player.walkT += dt;
  }
  updateWeapons(dt);
}

/* ═══════════ 怪物AI:漫游 → 仇恨追击 → 近身攻击;Boss 带技能 ═══════════ */
function moveEntity(e, tx, ty, speed, dt){
  const dx = tx - e.x, dy = ty - e.y, len = Math.hypot(dx, dy) || 1;
  e.x += dx / len * speed * dt;
  e.y += dy / len * speed * dt;
  if (Math.abs(dx) > 2) e.dir = dx < 0 ? -1 : 1;
  const M = CONFIG.wall + 16;
  e.x = clamp(e.x, M, CONFIG.mapW - M);
  e.y = clamp(e.y, M, CONFIG.mapH - M);
}
function updateMonster(m, dt){
  m.atkCd -= dt; m.flashT -= dt;
  for (const k in m.cds) m.cds[k] -= dt;
  const d = dist(m, player);
  const rage = G.rageT > 0 ? 1.4 : 1;                 // 狂暴事件:移速+40%
  const speed = (m.speed || m.type.speed) * rage * (m.boss ? 1 : 1 + huntBoost());

  if (m.boss){
    /* ★ Boss:永远追击 + 周期技能(冲锋/弹幕/召唤) */
    bossAI(m, dt, d, speed);
    if (m.moving) m.walkT += dt;
    return;
  }

  if (player.dead){ m.state = 'wander'; }
  else if (d < m.type.aggro){ m.state = 'chase'; }
  else if (d > m.type.aggro + 130){ m.state = 'wander'; }

  m.moving = false;
  if (m.state === 'chase'){
    if (d > m.type.atkRange + CONFIG.player.radius + m.type.radius){
      moveEntity(m, player.x, player.y, speed, dt); m.moving = true;
    } else if (m.atkCd <= 0){
      m.atkCd = m.type.atkInterval;
      slashes.push({ x:(m.x+player.x)/2, y:(m.y+player.y)/2-10,
                     a: Math.atan2(player.y-m.y, player.x-m.x), t:0.18, max:0.18, color:'#ff6a5a' });
      hurtPlayer(m.atk * (G.rageT > 0 ? 1.2 : 1));
    }
  } else {
    m.waitT -= dt;
    if (Math.hypot(m.wx - m.x, m.wy - m.y) < 8 || m.waitT <= 0){
      m.wx = clamp(m.x + rand(-130, 130), CONFIG.wall + 30, CONFIG.mapW - CONFIG.wall - 30);
      m.wy = clamp(m.y + rand(-130, 130), CONFIG.wall + 30, CONFIG.mapH - CONFIG.wall - 30);
      m.waitT = rand(1.2, 3.2);
    } else { moveEntity(m, m.wx, m.wy, speed * 0.45, dt); m.moving = true; }
  }
  if (m.moving) m.walkT += dt;
}
/* ★ Boss 技能AI:冲锋(前摇红闪+猛冲)、环形弹幕、召唤小怪 */
function bossAI(m, dt, d, speed){
  m.skillCd -= dt;
  /* 冲锋执行阶段 */
  if (m.dashT > 0){
    m.dashT -= dt;
    moveEntity(m, player.x, player.y, speed * 3.4, dt);
    puffs.push({ x: m.x, y: m.y - 10, vx: rand(-30, 30), vy: rand(-30, 30), t: 0.3, life: 0.3, color: '#ff8a5a', size: 4 });
    m.moving = true;
    return;
  }
  if (m.windupT > 0){                                 // 冲锋前摇(红闪蓄力)
    m.windupT -= dt; m.flashT = Math.max(m.flashT, 0.1);
    m.moving = false;
    if (m.windupT <= 0) m.dashT = 1.0;
    return;
  }
  if (m.skillCd <= 0){
    const skill = m.bossDef.skills[m.skillIdx % m.bossDef.skills.length];
    m.skillIdx++;
    m.skillCd = rand(3.2, 4.5);
    if (skill === 'dash'){
      m.windupT = 0.45;
      floaters.push({ x: m.x, y: m.y - 70, text: '冲锋!', color: '#ff5d5d', t: 0.8, life: 0.8, size: 15, vy: -30 });
    } else if (skill === 'barrage'){
      const n = 12, sp = 175;
      for (let i = 0; i < n; i++){
        const a = i / n * Math.PI * 2 + rand(-0.1, 0.1);
        eorbs.push({ x: m.x, y: m.y - 20, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                     dmg: Math.max(3, Math.round(m.atk * 0.6)), life: 2.6 });
      }
      sfx('zap');
    } else if (skill === 'summon'){
      for (let i = 0; i < 3; i++){
        const key = weightedPick(monsterWeights(G.stage));
        const type = MONSTER_TYPES[key], df = difficulty();
        monsters.push({ key, type, summon: true,
          x: clamp(m.x + rand(-70, 70), 60, CONFIG.mapW - 60),
          y: clamp(m.y + rand(-70, 70), 60, CONFIG.mapH - 60),
          hp: Math.round(type.hp * df * 0.6), maxHp: Math.round(type.hp * df * 0.6),
          atk: Math.round(type.atk * (1 + (df - 1) * 0.5)),
          atkCd: 1, state: 'chase', wx: 0, wy: 0, waitT: 0,
          flashT: 0, dir: 1, walkT: 0, moving: false, cds: {} });
      }
      showEventBanner('👑 ' + m.bossDef.name + ' 召唤了随从!');
      sfx('boom');
    }
  }
  /* 普通追击与近战 */
  m.moving = false;
  if (d > m.type.atkRange + CONFIG.player.radius + m.type.radius){
    moveEntity(m, player.x, player.y, speed, dt); m.moving = true;
  } else if (m.atkCd <= 0){
    m.atkCd = m.type.atkInterval;
    slashes.push({ x:(m.x+player.x)/2, y:(m.y+player.y)/2-10,
                   a: Math.atan2(player.y-m.y, player.x-m.x), t:0.18, max:0.18, color:'#ff6a5a' });
    hurtPlayer(m.atk);
  }
}
/* ★ 敌方弹幕:飞行 → 撞玩家造成伤害 */
function updateEnemyOrbs(dt){
  for (const o of eorbs){
    o.life -= dt;
    o.x += o.vx * dt; o.y += o.vy * dt;
    if (Math.hypot(player.x - o.x, player.y - 10 - o.y) < CONFIG.player.radius + 8){
      o.life = 0;
      hurtPlayer(o.dmg);
      for (let i = 0; i < 4; i++) puffs.push({ x: o.x, y: o.y, vx: rand(-60, 60), vy: rand(-60, 60), t: 0.25, life: 0.25, color: '#ff8a5a', size: 3 });
    }
  }
  eorbs = eorbs.filter(o => o.life > 0);
  if (eorbs.length > 60) eorbs.length = 60;
}
/* 怪物间轻量排斥,避免重叠(Boss 体型大也参与) */
function separateMonsters(){
  for (let i = 0; i < monsters.length; i++) for (let j = i + 1; j < monsters.length; j++){
    const a = monsters[i], b = monsters[j];
    const dx = b.x - a.x, dy = b.y - a.y;
    const ra = a.type.radius * (a.boss ? 1.6 : a.elite ? 1.4 : 1);
    const rb = b.type.radius * (b.boss ? 1.6 : b.elite ? 1.4 : 1);
    const min = ra + rb, d = Math.hypot(dx, dy);
    if (d > 0 && d < min){
      const push = (min - d) / 2 / d;
      a.x -= dx * push; a.y -= dy * push;
      b.x += dx * push; b.y += dy * push;
    }
  }
}

/* ═══════════ 特效寿命更新 ═══════════ */
function updateEffects(dt){
  for (const f of floaters){ f.t -= dt; f.y += f.vy * dt; }
  floaters = floaters.filter(f => f.t > 0);
  for (const s of slashes) s.t -= dt;
  slashes = slashes.filter(s => s.t > 0);
  for (const a of arcs) a.t -= dt;
  arcs = arcs.filter(a => a.t > 0);
  for (const b of booms){ b.t -= dt; b.r = b.max * (1 - b.t / b.life * 0.4); }
  booms = booms.filter(b => b.t > 0);
  for (const p of puffs){ p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 160 * dt; }
  puffs = puffs.filter(p => p.t > 0);
}
