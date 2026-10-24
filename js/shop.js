/* shop.js — 强化工坊:金币全军攻击强化 / 材料防具强化 / 武器技能总览 */
'use strict';

const wboostCost = () => Math.floor(CONFIG.upgrade.wboostBaseCost * Math.pow(CONFIG.upgrade.wboostCostGrow, player.wboost));
const armorCost  = () => Math.floor(CONFIG.upgrade.armorBaseCost  * Math.pow(CONFIG.upgrade.armorCostGrow,  player.armorLv - 1));

/* 【强化①】金币:全军攻击 +3/级(所有武器伤害同步提升) */
function upgradeWboost(){
  const c = wboostCost();
  if (player.gold < c) return;
  player.gold -= c; player.wboost++;
  player.upT = 0.6;
  floaters.push({ x: player.x, y: player.y - 46, text: '攻击 +' + CONFIG.upgrade.atkPerLv + '!',
                  color: '#ffd23e', t: 1, life: 1, size: 16, vy: -40 });
  sfx('up'); buzz(20); save(); refreshHUD();
}
/* 【强化②】材料:防具 +25 生命上限/级,并回满血 */
function upgradeArmor(){
  const c = armorCost();
  if (player.mat < c) return;
  player.mat -= c; player.armorLv++;
  player.hp = playerMaxHp();
  player.upT = 0.6;
  floaters.push({ x: player.x, y: player.y - 46, text: '防具 Lv' + player.armorLv + '!',
                  color: '#7cc2ff', t: 1, life: 1, size: 16, vy: -40 });
  sfx('up'); buzz(20); save(); refreshHUD();
}

/* 估算当前总 DPS(工坊展示用):各武器 伤害/间隔×数量 求和 */
function estimateDPS(){
  let dps = 0;
  for (const key in player.weapons){
    const st = player.weapons[key], w = WEAPONS[key];
    const dmg = weaponDamage(key, st);
    if (w.type === 'orbit') dps += dmg / 0.45;                       // 斧:按受击间隔估
    else if (w.type === 'melee' || w.type === 'projectile' || w.type === 'spread' ||
             w.type === 'boomerang' || w.type === 'fireball')
      dps += dmg * weaponCount(key, st.lv) / (w.interval * player.buffs.aspd);
    else if (w.type === 'chain')
      dps += dmg * (w.jumps + Math.floor(st.lv / w.countNote)) * 0.85 / (w.interval * player.buffs.aspd);
  }
  return Math.round(dps * (1 + critChance() * (CONFIG.player.critMult - 1)));
}

/* 面板里的武器/技能总览列表 */
function renderShopLists(){
  const wbox = $('stat-weapons');
  wbox.innerHTML = '';
  for (const k in player.weapons){
    const w = WEAPONS[k], st = player.weapons[k];
    const n = weaponCount(k, st.lv);
    const row = document.createElement('div');
    row.className = 'stat-row';
    row.innerHTML = '<span>' + weaponIconHTML(k, 15) + ' ' + w.name + '</span>' +
                    '<span>Lv' + st.lv + (n > 1 ? ' ×' + n : '') +
                    ' · 伤害 ' + Math.round(weaponDamage(k, st)) + '</span>';
    wbox.appendChild(row);
  }
  $('w-count').textContent = Object.keys(player.weapons).length + '/' + WEAPON_KEYS.length + ' 把';

  const sbox = $('stat-skills');
  sbox.innerHTML = '';
  let any = false;
  for (const k in player.skills){
    const lv = player.skills[k];
    if (!lv) continue;
    any = true;
    const s = SKILLS[k];
    const row = document.createElement('div');
    row.className = 'stat-row';
    sbox.appendChild(row);
    row.innerHTML = '<span>' + s.icon + ' ' + s.name + '</span><span>Lv' + lv + '/' + s.max + '</span>';
  }
  for (const k in player.buffs){
    let txt = '';
    if (k === 'atk'    && player.buffs.atk    > 1) txt = '攻击 ×' + player.buffs.atk.toFixed(2);
    if (k === 'aspd'   && player.buffs.aspd   < 1) txt = '攻速 ×' + (1 / player.buffs.aspd).toFixed(2);
    if (k === 'hp'     && player.buffs.hp     > 0) txt = '生命 +' + player.buffs.hp;
    if (k === 'spd'    && player.buffs.spd    > 1) txt = '移速 ×' + player.buffs.spd.toFixed(2);
    if (k === 'pickup' && player.buffs.pickup > 1) txt = '拾取 ×' + player.buffs.pickup.toFixed(2);
    if (txt){
      const row = document.createElement('div');
      row.className = 'stat-row';
      row.innerHTML = '<span>' + CHEST_BUFFS[k].icon + ' ' + CHEST_BUFFS[k].name + '</span><span>' + txt + '</span>';
      sbox.appendChild(row);
      any = true;
    }
  }
  if (!any) sbox.innerHTML = '<div class="stat-row dim">暂无 · 拾取宝箱获取强化点与技能</div>';

  /* 生涯统计 */
  const st = $('stat-stats');
  if (st){
    const rows = [
      ['☠ 生涯击杀', fmtNum(player.kills)],
      ['📦 开启宝箱', fmtNum(player.chests)],
      ['💀 死亡次数', fmtNum(player.deaths)],
      ['🏆 最高关卡', '第 ' + G.bestStage + ' 关'],
      ['🔥 估算 DPS', fmtNum(estimateDPS())],
      ['⏱ 远征时长', fmtDur(G.playSec)],
      ['🪙 持有金币', fmtNum(player.gold)],
    ];
    st.innerHTML = rows.map(r => '<div class="stat-row"><span>' + r[0] + '</span><span>' + r[1] + '</span></div>').join('');
  }

  /* 成就列表 */
  const ab = $('stat-achievements');
  if (ab){
    ab.innerHTML = ACHIEVEMENTS.map(a => {
      const got = !!player.achievements[a.key];
      return '<div class="stat-row' + (got ? '' : ' off') + '"><span>' + (got ? '✅ ' : '🔒 ') + a.icon + ' ' + a.name +
             ' <i class="dim">· ' + a.desc + '</i></span><span>' + (got ? '已达成' : (a.gold ? '金币' + a.gold : '材料' + a.mat)) + '</span></div>';
    }).join('');
    const got = ACHIEVEMENTS.filter(a => player.achievements[a.key]).length;
    $('ach-count').textContent = got + '/' + ACHIEVEMENTS.length;
  }
}
