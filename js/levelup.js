/* ═══════════════════════════════════════════════════════════════
   levelup.js — 【核心】宝箱弹窗:三选一(属性点 / 武器 / 技能)
   ------------------------------------------------------------
   拾取宝箱 → 暂停世界 → 弹出 3 张卡 → 点选一张立即生效 → 恢复战斗
   ═══════════════════════════════════════════════════════════════ */
'use strict';

/* 组建候选池:未拥有武器(高权重)/ 武器升级 / 可升级技能 / 属性点 */
function rollChoices(){
  const pool = [];
  for (const k of WEAPON_KEYS){
    if (!player.weapons[k]) pool.push({ w: 3, c: cardWeaponNew(k) });
    else if (player.weapons[k].lv < 10) pool.push({ w: 2, c: cardWeaponUp(k) });
  }
  for (const k in SKILLS){
    const lv = player.skills[k] || 0;
    if (lv < SKILLS[k].max) pool.push({ w: 2.5, c: cardSkill(k) });
  }
  for (const k in CHEST_BUFFS){
    if (!buffCapped(k)) pool.push({ w: 2, c: cardBuff(k) });   // ★ 叠满上限的属性点不再出现在卡池
  }

  const picks = [];
  const used = new Set();
  while (picks.length < 3 && pool.length){
    const total = pool.reduce((s, e) => s + e.w, 0);
    let r = Math.random() * total, idx = 0;
    for (; idx < pool.length; idx++){ r -= pool[idx].w; if (r < 0) break; }
    const card = pool[idx].c;
    if (!used.has(card.id)){ used.add(card.id); picks.push(card); }
    pool.splice(idx, 1);
  }
  return picks;
}

/* ── 三种卡片 ── */
function cardWeaponNew(k){
  const w = WEAPONS[k];
  return { id: 'wn_' + k, icon: weaponIconHTML(k, 24), tag: '新武器!', name: w.name,
           desc: w.desc + ' · 伤害 ' + Math.round(w.dmg * playerAtk() / CONFIG.player.atk),
           apply(){ player.weapons[k] = { lv: 1, cd: 0, angle: Math.random() * 6 }; } };
}
function cardWeaponUp(k){
  const w = WEAPONS[k], st = player.weapons[k];
  let extra = '';
  if (w.countNote && (st.lv + 1) % w.countNote === 0) extra = ' · 数量+1!';
  return { id: 'wu_' + k, icon: weaponIconHTML(k, 24), tag: '强化', name: w.name + ' Lv' + st.lv + '→' + (st.lv + 1),
           desc: '伤害 +25%' + extra, apply(){ st.lv++; } };
}
function cardSkill(k){
  const s = SKILLS[k], lv = player.skills[k] || 0;
  return { id: 'sk_' + k, icon: s.icon, tag: s.type === 'auto' ? '主动技' : '被动技',
           name: s.name + (lv ? ' Lv' + lv + '→' + (lv + 1) : ''),
           desc: s.desc, apply(){ player.skills[k] = lv + 1; } };
}
function cardBuff(k){
  const b = CHEST_BUFFS[k];
  return { id: 'bf_' + k, icon: b.icon, tag: '属性点', name: b.name, desc: b.desc, apply(){ b.apply(); } };
}

/* ── 打开宝箱弹窗(暂停) ── */
function openChestPanel(){
  const choices = rollChoices();
  /* ★ 全部强化满级(武器10级/技能满/属性点满)→ 卡池为空:
       不弹窗不暂停,宝箱自动折算金币,游戏照常进行 */
  if (!choices.length){
    const gold = 150 + G.stage * 25;
    player.gold += gold;
    floaters.push({ x: player.x, y: player.y - 46, text: '已全满 · 宝箱折算金币 +' + gold,
                    color: '#ffd24a', t: 1.3, life: 1.3, size: 15, vy: -38 });
    for (let i = 0; i < 10; i++)
      puffs.push({ x: player.x, y: player.y - 10, vx: rand(-100, 100), vy: rand(-150, -30),
                   t: 0.5, life: 0.5, color: '#ffd24a', size: rand(2, 4) });
    sfx('coin'); buzz(20); save(); refreshHUD();
    return;
  }
  const box = $('chest-cards');
  box.innerHTML = '';
  for (const card of choices){
    const el = document.createElement('button');
    el.className = 'chest-card';
    el.innerHTML = '<span class="cc-icon">' + card.icon + '</span>' +
                   '<span class="cc-tag">' + card.tag + '</span>' +
                   '<span class="cc-name">' + card.name + '</span>' +
                   '<span class="cc-desc">' + card.desc + '</span>';
    el.addEventListener('click', () => {
      card.apply();
      closeChestPanel();
      floaters.push({ x: player.x, y: player.y - 50, text: card.icon + ' ' + card.name + '!',
                      color: '#ffd23e', t: 1.2, life: 1.2, size: 16, vy: -38 });
      player.upT = 0.6;
      for (let i = 0; i < 14; i++)
        puffs.push({ x: player.x, y: player.y - 10, vx: rand(-120, 120), vy: rand(-160, -40),
                     t: 0.6, life: 0.6, color: '#ffd24a', size: rand(2, 5) });
      sfx('pick');
      save(); refreshHUD();
    });
    box.appendChild(el);
  }
  $('chest-mask').classList.remove('hidden');
  syncPause();                                  // → ui.js:宝箱/工坊任一打开即暂停
}
function closeChestPanel(){
  $('chest-mask').classList.add('hidden');
  syncPause();                                  // 若强化工坊仍开着则保持暂停
}
