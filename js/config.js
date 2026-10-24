/* ═════════════════════════════════════════════════════════
   config.js — 全部可调参数(改难度/节奏/武器/技能,只改这个文件)
   ═════════════════════════════════════════════════════════ */
'use strict';

const CONFIG = {
  mapW: 1500, mapH: 2200,       // 地图尺寸(世界像素)
  wall: 26,                     // 四周石墙厚度
  maxMonsters: 22,              // ★ 同屏怪物上限(性能关键,手机 ≤25)
  spawnInterval: 0.35,          // ★ 刷怪间隔(秒)——调小=节奏更快
  /* ★ 宝箱:掉率/保底随击杀数递减/递增 → 越往后弹窗越不频繁
       掉率 = chance / (1 + kills/chanceDecay),下限 chanceMin
       保底 = pity + 每 pityStep 杀 +pityGrow,上限 pityMax */
  chest: {
    chance: 0.08, chanceMin: 0.02, chanceDecay: 400,
    pity: 15, pityStep: 150, pityGrow: 10, pityMax: 60,
  },

  player: {
    hp: 100,                    // 初始生命上限
    speed: 210,                 // ★ 移动速度(比上版快)
    radius: 13,
    atk: 10,                    // 基础攻击(全军强化/宝箱百分比都乘它)
    atkRange: 140,              // 近战锁定范围
    critChance: 0.12,           // 基础暴击率(技能可加)
    critMult: 1.9,
    reviveDelay: 3,             // 复活倒计时
    invTime: 2,                 // 复活无敌
  },
  pickup: { radius: 60, magnetSpeed: 400 },   // 拾取磁吸(宝箱"磁力"再加成)

  /* ★ 站桩围猎:站着不动超过 delay 秒后双重惩罚 ——
     追击怪移速提升 + 玩家攻速下降(迫使走位;移动立即恢复) */
  idleHunt: {
    delay: 3,       // 站桩多少秒后开始惩罚
    maxBoost: 0.8,  // 怪物移速最多 +80%
    atkSlow: 0.5,   // 玩家攻击间隔最多 +50%(≈攻速 -33%)
    rampTime: 20,   // 从开始惩罚到满值经历多少秒(线性爬升)
  },

  events: { minT: 40, maxT: 70 },   // ★ 随机事件间隔区间(秒)

  /* ★ 离线收益:关闭页面期间也在"挂机",回来按时长结算
       金币速率 = base + 关卡×perStage;材料 = 金币的 1/8;封顶 capSec 秒 */
  offline: { minSec: 120, capSec: 8 * 3600, base: 3, perStage: 1.5 },
  upgrade: {
    wboostBaseCost: 60,         // ★ 全军攻击强化(金币)基础消耗
    wboostCostGrow: 1.52,       //   ★ 越往后越贵(指数增长,后期升级明显变难)
    atkPerLv: 3,                //   每级攻击+3
    armorBaseCost: 8,           // ★ 防具强化(材料)
    armorCostGrow: 1.50,        //   ★ 越往后越贵
    hpPerLv: 25,
  },
};

/* ★ 怪物图鉴:hp/atk/speed/aggro 仇恨 / gold 金币区间 / matChance 材料率
     aggro 仇恨范围 ≥ 环形刷新半径上限(620),保证刷出的怪立即朝玩家走来 */
const MONSTER_TYPES = {
  slime: { name:'史莱姆', hp:30,  atk:6,  speed:72,  radius:12, aggro:660, atkRange:30, atkInterval:1.2, gold:[3,6],  matChance:0.28 },
  bat:   { name:'蝙蝠',   hp:22,  atk:5,  speed:112, radius:10, aggro:700, atkRange:28, atkInterval:0.9, gold:[4,8],  matChance:0.30 },
  mush:  { name:'毒蘑菇', hp:55,  atk:9,  speed:58,  radius:13, aggro:640, atkRange:30, atkInterval:1.4, gold:[5,10], matChance:0.42 },
  skel:  { name:'骷髅兵', hp:95,  atk:13, speed:88,  radius:13, aggro:720, atkRange:32, atkInterval:1.0, gold:[8,15], matChance:0.55 },
};
/* 出怪权重:关卡越深,强怪越多 */
function monsterWeights(stage){
  if (stage <= 1) return { slime:1 };
  if (stage === 2) return { slime:5, bat:2 };
  if (stage <= 4) return { slime:4, bat:3, mush:2 };
  if (stage <= 7) return { slime:3, bat:3, mush:3, skel:2 };
  return { slime:2, bat:3, mush:3, skel:4 };
}
/* 每关击杀目标(达到后刷 Boss) */
function stageQuota(stage){ return Math.min(45, 18 + stage * 3); }

/* ═════════════════════════════════════════════════════════
   ★ 武器库:全部可同时自动攻击
   type: melee 近战挥砍 / projectile 追踪弹 / orbit 环绕斧
         chain 闪电链 / fireball 爆炸火球 / spread 扇形飞刀
   dmg 基础伤害,每升 1 级 +25%;countNote 是加数量的等级
   ═════════════════════════════════════════════════════════ */
const WEAPONS = {
  sword: { name:'铁剑',   icon:'⚔️', type:'melee',      dmg:12, interval:0.38, range:140,
           desc:'近战挥砍最近敌人', countNote:'' },
  bolt:  { name:'魔导弹', icon:'🔮', type:'projectile', dmg:9,  interval:0.50, range:380, speed:430,
           desc:'自动追踪魔法弹',   countNote:3 },
  axe:   { name:'旋风斧', icon:'🪓', type:'orbit',      dmg:7,  tick:0.24, orbitR:78, spin:3.2,
           desc:'环绕自身旋转撞击', countNote:4 },
  chain: { name:'闪电链', icon:'⚡', type:'chain',      dmg:13, interval:1.5, range:320, jumps:3, jumpR:170,
           desc:'电击并跳跃多个敌', countNote:3 },
  fire:  { name:'火球术', icon:'🔥', type:'fireball',   dmg:24, interval:1.3, range:420, speed:320, aoe:80,
           desc:'命中后范围爆炸',   countNote:5 },
  knife: { name:'飞刀阵', icon:'🗡️', type:'spread',     dmg:6,  interval:0.55, range:360, speed:520, spread:0.6,
           desc:'扇形射出多发飞刀', countNote:4 },
  boomerang: { name:'回旋镖', icon:'🌀', type:'boomerang', dmg:10, interval:0.9, range:340, speed:380,
           desc:'飞出折返,往返皆可命中', countNote:4 },
};
const WEAPON_KEYS = Object.keys(WEAPONS);
/* 武器升级时,等级达到 countNote 的倍数 +1 弹体/斧头/跳跃数 */
function weaponCount(key, lv){
  const w = WEAPONS[key];
  if (!w.countNote) return 1;
  return 1 + Math.floor(lv / w.countNote);
}

/* ═════════════════════════════════════════════════════════
   ★ 技能库(宝箱三选一可获得;全部自动生效,符合挂机定位)
   passive 持续生效 / auto 周期自动施放
   ═════════════════════════════════════════════════════════ */
const SKILLS = {
  crit:   { name:'致命一击', icon:'🎯', max:5, type:'passive', desc:'暴击率 +8%/级' },
  leech:  { name:'吸血',     icon:'🩸', max:3, type:'passive', desc:'造成伤害的 5%/级 转化为生命' },
  greed:  { name:'贪婪',     icon:'💰', max:4, type:'passive', desc:'金币获取 +25%/级' },
  regen:  { name:'再生',     icon:'💚', max:4, type:'passive', desc:'每秒回复 1.5%/级 生命' },
  magnet: { name:'磁力',     icon:'🧲', max:3, type:'passive', desc:'拾取范围 +40%/级' },
  guard:  { name:'守护',     icon:'🛡️', max:3, type:'passive', desc:'受到伤害 -12%/级' },
  meteor: { name:'陨石术',   icon:'☄️', max:5, type:'auto', cd:18, desc:'每18秒轰击全场,伤害=攻击×(2+等级)' },
  frenzy: { name:'狂暴',     icon:'😤', max:3, type:'auto', cd:16, dur:4, desc:'每16秒攻速翻倍4秒' },
  thorns: { name:'荆棘',     icon:'🌵', max:3, type:'passive', desc:'受击时反弹攻击×0.6/级 伤害给周围敌人' },
};

/* ★ 宝箱三选一:属性强化点池(可重复获得,滚雪球) */
const CHEST_BUFFS = {
  atk:    { icon:'💪', name:'力量', desc:'攻击力 +12%',        apply(){ player.buffs.atk    *= 1.12; } },
  aspd:   { icon:'⚡', name:'急速', desc:'所有武器攻速 +10%',   apply(){ player.buffs.aspd   *= 0.90; } },
  hp:     { icon:'❤️', name:'体魄', desc:'生命上限 +25 并回满', apply(){ player.buffs.hp += 25; player.hp = playerMaxHp(); } },
  spd:    { icon:'👟', name:'疾风', desc:'移动速度 +8%',        apply(){ player.buffs.spd   *= 1.08; } },
  pickup: { icon:'🧲', name:'寻宝', desc:'拾取范围 +30%',       apply(){ player.buffs.pickup*= 1.30; } },
};

/* ═════════════════════════════════════════════════════════
   ★ 闯关模式:5 张主题地图循环(每通关一张切下一张)
   ═════════════════════════════════════════════════════════ */
const THEMES = [
  { key:'grass',  name:'翠风草原', ground:['#3f9950','#398c48','#46a555'], tuft:'#2e7d3c',
    wall:'#4a4238', wallDark:'#3a342c', boss:'slimeking',
    decor:{ tree:{T:'#2e7d3a',U:'#3f9c4d'}, bush:{T:'#2e7d3a',U:'#4aaa55'} } },
  { key:'snow',   name:'霜语雪原', ground:['#dce6ec','#cfdbe4','#eaf2f7'], tuft:'#b4c9d6',
    wall:'#7d8ba0', wallDark:'#5f6c80', boss:'batking',
    decor:{ tree:{T:'#2f6d52',U:'#e8f2f8'}, bush:{T:'#5a8a72',U:'#cfe4dc'} } },
  { key:'desert', name:'流金沙漠', ground:['#d8b878','#cbaa68','#e4c688'], tuft:'#b09454',
    wall:'#8a6f4a', wallDark:'#6b5438', boss:'mushking',
    decor:{ tree:{T:'#7d8a3a',U:'#9aaa55'}, bush:{T:'#8a8a3a',U:'#adaa55'} } },
  { key:'volcano',name:'燃火之地', ground:['#5a4038','#4d3830','#684a40'], tuft:'#3a2a24',
    wall:'#4a3a44', wallDark:'#332830', boss:'skellord',
    decor:{ tree:{T:'#7d3a2a',U:'#a04a35'}, bush:{T:'#8a4a2a',U:'#b0603a'} } },
  { key:'abyss',  name:'幽暗深渊', ground:['#3a3550','#332e48','#443e5c'], tuft:'#2a2640',
    wall:'#46405e', wallDark:'#332e46', boss:'shadowdragon',
    decor:{ tree:{T:'#4a3a7a',U:'#6a55aa'}, bush:{T:'#5a4a8a',U:'#7a6aba'} } },
];
const stageTheme = () => THEMES[(G.stage - 1) % THEMES.length];

/* ★ Boss 图鉴(数值为第 1 关基准,随关卡与玩家成长放大) */
const BOSSES = {
  slimeking:    { name:'史莱姆之王', sprite:'slime', scale:2.6, hp:900,  atk:18, speed:55, radius:30, atkRange:46, atkInterval:1.6, gold:[60,90],  skills:['summon'] },
  batking:      { name:'冰霜蝠王',   sprite:'bat',   scale:2.4, hp:780,  atk:15, speed:95, radius:26, atkRange:42, atkInterval:1.2, gold:[55,85],  skills:['barrage','dash'] },
  mushking:     { name:'蘑菇沙皇',   sprite:'mush',  scale:2.5, hp:1000, atk:20, speed:50, radius:28, atkRange:44, atkInterval:1.5, gold:[65,95],  skills:['barrage','summon'] },
  skellord:     { name:'骷髅领主',   sprite:'skel',  scale:2.6, hp:1150, atk:24, speed:70, radius:28, atkRange:46, atkInterval:1.3, gold:[70,105], skills:['dash','summon'] },
  shadowdragon: { name:'暗影魔龙',   sprite:'bat',   scale:3.0, hp:1400, atk:28, speed:80, radius:32, atkRange:48, atkInterval:1.4, gold:[90,130], skills:['dash','barrage','summon'] },
};

/* ★ 精英怪 */
const ELITE = { interval: 24, hpMul: 4, atkMul: 1.6, speedMul: 1.1, scale: 1.45, goldMul: 3 };

/* ★ 随机事件(每隔 40~70 秒触发一个) */
const EVENTS = [
  { key:'chestrain', name:'🎁 天降宝箱!' },
  { key:'goldrain',  name:'💰 金币雨!' },
  { key:'rage',      name:'🔴 怪物狂暴 15 秒!' },
  { key:'swarm',     name:'🌊 怪物狂潮来袭!' },
];

/* ★ 挑战词条:每关随机(第2关起1条,第5关起可能2条),风险↔收益 */
const STAGE_MODS = [
  { key:'swift', name:'迅捷', desc:'怪物移速+25% · 金币+50%', speed:1.25, gold:1.5 },
  { key:'tough', name:'坚韧', desc:'怪物血量+40% · 材料×2',   hp:1.4,    mat:2 },
  { key:'fierce',name:'狂攻', desc:'怪物攻击+30% · 宝箱掉率×2',atk:1.3,  chest:2 },
  { key:'swarm', name:'蜂群', desc:'怪物上限+8 · 金币+25%',    cap:8,     gold:1.25 },
];
/* 词条乘数汇总(modKey = speed/hp/atk/gold/mat/chest/cap) */
function modMul(modKey){
  let v = 1;
  for (const m of G.mods) if (m[modKey]) v *= m[modKey];
  return v;
}

/* ═════════════════════════════════════════════════════════
   ★ 成就系统:达成条件自动解锁,发放金币/材料奖励(每秒检查)
   ═════════════════════════════════════════════════════════ */
const ACHIEVEMENTS = [
  { key:'kill100',  icon:'⚔️', name:'百人斩',     desc:'累计击杀 100',      gold:200,  check:() => player.kills >= 100 },
  { key:'kill1000', icon:'⚔️', name:'千人斩',     desc:'累计击杀 1000',     gold:1000, check:() => player.kills >= 1000 },
  { key:'kill5000', icon:'💀', name:'怪物克星',   desc:'累计击杀 5000',     gold:5000, check:() => player.kills >= 5000 },
  { key:'chest25',  icon:'📦', name:'寻宝者',     desc:'开启 25 个宝箱',    gold:300,  check:() => player.chests >= 25 },
  { key:'chest100', icon:'📦', name:'宝箱猎人',   desc:'开启 100 个宝箱',   gold:1500, check:() => player.chests >= 100 },
  { key:'stage5',   icon:'🗺️', name:'远征新手',   desc:'到达第 5 关',       gold:400,  check:() => G.bestStage >= 5 },
  { key:'stage10',  icon:'🗺️', name:'远征老手',   desc:'到达第 10 关',      gold:1200, check:() => G.bestStage >= 10 },
  { key:'stage20',  icon:'🏔️', name:'远征传奇',   desc:'到达第 20 关',      gold:4000, check:() => G.bestStage >= 20 },
  { key:'arsenal',  icon:'🗡️', name:'军械收藏家', desc:'集齐全部武器',      gold:800,  check:() => Object.keys(player.weapons).length >= WEAPON_KEYS.length },
  { key:'wboost10', icon:'💪', name:'神兵利器',   desc:'全军攻击强化 Lv10',  gold:1000, check:() => player.wboost >= 10 },
  { key:'armor10',  icon:'🛡️', name:'铜墙铁壁',   desc:'防具强化 Lv10',     mat:20,    check:() => player.armorLv >= 10 },
  { key:'skills3',  icon:'✨', name:'技能大师',   desc:'3 个技能升至满级',  gold:2000, check:() => Object.keys(SKILLS).filter(k => (player.skills[k] || 0) >= SKILLS[k].max).length >= 3 },
];
