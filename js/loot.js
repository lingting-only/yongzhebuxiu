/* loot.js — 击杀掉落 / 磁吸拾取(金币/材料/红心/宝箱) */
'use strict';

/* ★ 宝箱掉率/保底随进度递减/递增(越往后弹窗越不频繁)
     掉率:8% 起步,随击杀数衰减,下限 2%(400 杀时约 4%)
     保底:15 杀起步,每 150 杀 +10,上限 60 杀 */
function chestChance(){ return Math.max(CONFIG.chest.chanceMin, CONFIG.chest.chance / (1 + player.kills / CONFIG.chest.chanceDecay)); }
function chestPity(){   return Math.min(CONFIG.chest.pityMax,   CONFIG.chest.pity + Math.floor(player.kills / CONFIG.chest.pityStep) * CONFIG.chest.pityGrow); }

/* 怪物死亡:掉落 + 关卡进度 + Boss/精英特殊掉落 + 粒子 */
function killMonster(m){
  if (m.hp > 0) m.hp = 0;
  player.kills++;
  G.killSinceChest++;
  if (player.kills % 100 === 0){
    floaters.push({ x: player.x, y: player.y - 60, text: '⚠ 怪物变强了! (' + player.kills + '杀)',
                    color: '#ff8a5a', t: 1.6, life: 1.6, size: 15, vy: -22 });
    sfx('up');
  }
  /* ★ 关卡进度:普通怪+1 / 精英+3(召唤物与 Boss 不计) */
  if (!m.boss && !m.summon) G.stageKills += m.elite ? 3 : 1;

  const dfGold = modMul('gold') * (m.elite ? ELITE.goldMul : 1) * (m.boss ? 3 : 1);
  const total = Math.round(randInt(m.type.gold[0], m.type.gold[1]) *
                (1 + (player.skills.greed || 0) * 0.25) * dfGold);
  const piles = clamp(Math.round(total / 5), 1, m.boss ? 8 : 3);
  const each = Math.floor(total / piles);
  for (let i = 0; i < piles; i++)
    spawnDrop(m.x, m.y, 'gold', i === piles - 1 ? total - each * (piles - 1) : each);
  if (Math.random() < m.type.matChance * modMul('mat') || m.boss)
    spawnDrop(m.x, m.y, 'mat', m.boss ? 3 : 1);
  if (Math.random() < 0.06) spawnDrop(m.x, m.y, 'heal', Math.round(playerMaxHp() * 0.2));
  /* 宝箱:精英必掉 / Boss 掉2个 / 普通按动态概率+词条 */
  if (m.elite){ spawnDrop(m.x, m.y, 'chest', 1); G.killSinceChest = 0; }
  else if (m.boss){ spawnDrop(m.x, m.y, 'chest', 1); spawnDrop(m.x + 10, m.y, 'chest', 1); G.killSinceChest = 0; }
  else if (Math.random() < chestChance() * modMul('chest') || G.killSinceChest >= chestPity()){
    G.killSinceChest = 0;
    spawnDrop(m.x, m.y, 'chest', 1);
  }
  for (let i = 0; i < (m.boss ? 26 : 8); i++)
    puffs.push({ x: m.x, y: m.y - 8, vx: rand(-120, 120), vy: rand(-160, -20),
                 t: 0.5, life: 0.5, color: m.boss ? '#ffd24a' : '#fff', size: rand(2, m.boss ? 6 : 4) });

  /* ★ Boss 死亡 → 关卡通关流程 */
  if (m.boss){
    G.boss = null;
    G.clearT = 3.0;                                    // 3 秒庆祝后进入下一关
    G.shakeT = 0.5; sfx('boom');
    const nextTh = THEMES[G.stage % THEMES.length];
    $('stage-clear-text').innerHTML = '✅ 第 ' + G.stage + ' 关 · ' + stageTheme().name +
      ' 通关!<br><span style="font-size:14px;color:#9fd8ff">即将前往 第 ' + (G.stage + 1) + ' 关 · ' + nextTh.name +
      ' · 通关奖励已发放,血量回满</span><br><span style="font-size:12px;color:#8a93a3">点击任意处立即进入 →</span>';
    $('stage-mask').classList.remove('hidden');
  }
  refreshHUD();
}

function spawnDrop(x, y, kind, v){
  if (drops.length >= 90){                      // 数量兜底防卡顿:直接进背包
    if (kind === 'gold') player.gold += v;
    else if (kind === 'mat') player.mat += v;
    return;
  }
  drops.push({ kind, v, x, y, vx: rand(-70, 70), vy: rand(-70, 70), age: 0, seed: Math.random() * 7 });
}

/* ★ 自动拾取:靠近 → 磁吸 → 入包;宝箱 → 弹窗三选一 */
function updateDrops(dt){
  const pr = pickupRadius();
  for (const d of drops){
    d.age += dt;
    if (d.age < 0.4){
      d.x += d.vx * dt; d.y += d.vy * dt;
      d.vx *= 1 - 5 * dt; d.vy *= 1 - 5 * dt;
    }
    if (player.dead || G.paused || G.clearT > 0) continue;   // 通关结算期不磁吸,宝箱带入下一关
    const dd = dist(d, player);
    if (dd < pr){
      const s = CONFIG.pickup.magnetSpeed * dt;
      d.x += (player.x - d.x) / dd * s;
      d.y += (player.y - d.y) / dd * s;
      if (dd < 18){
        d.taken = true;
        if (d.kind === 'gold'){
          player.gold += d.v;
          floaters.push({ x: player.x, y: player.y - 36, text: '+' + d.v, color: '#ffd24a', t: 0.7, life: 0.7, size: 13, vy: -42 });
          sfx('coin');
        } else if (d.kind === 'mat'){
          player.mat += d.v;
          floaters.push({ x: player.x, y: player.y - 36, text: '+1 💎', color: '#7cc2ff', t: 0.7, life: 0.7, size: 13, vy: -42 });
          sfx('mat');
        } else if (d.kind === 'heal'){
          player.hp = Math.min(playerMaxHp(), player.hp + d.v);
          floaters.push({ x: player.x, y: player.y - 36, text: '+' + d.v, color: '#7dff9e', t: 0.7, life: 0.7, size: 13, vy: -42 });
          sfx('mat');
        } else if (d.kind === 'chest'){
          player.chests++;
          buzz(30);
          openChestPanel();                      // → levelup.js 三选一弹窗(暂停游戏)
          sfx('chest');
        }
        refreshHUD();
      }
    }
  }
  drops = drops.filter(d => !d.taken);
}
