/* ui.js — HUD 刷新 / 面板与按钮绑定 */
'use strict';

function refreshHUD(){
  const maxhp = playerMaxHp();
  const fill = $('hp-fill');
  fill.style.width = clamp(player.hp / maxhp, 0, 1) * 100 + '%';
  fill.classList.toggle('low', player.hp / maxhp < 0.3);
  $('hp-text').textContent = Math.ceil(player.hp) + '/' + maxhp;
  $('atk-text').textContent = Math.round(playerAtk());
  $('gold-text').textContent = fmtNum(player.gold);
  $('mat-text').textContent = fmtNum(player.mat);
  $('kill-text').textContent = fmtNum(player.kills);

  /* 关卡信息独立细条(不占资源行) + Boss 血条 */
  $('stage-line').textContent = '第' + G.stage + '关·' + stageTheme().name +
    (G.mods.length ? ' [' + G.mods.map(m => m.name).join('·') + ']' : '') + ' · ' +
    (G.bossSpawned ? (G.boss ? '👑 BOSS战' : '通关中…') : '击杀 ' + G.stageKills + '/' + stageQuota(G.stage));
  const bb = $('boss-bar');
  if (G.boss && G.boss.hp > 0){
    bb.classList.remove('hidden');
    $('boss-name').textContent = '👑 ' + G.boss.bossDef.name;
    $('boss-fill').style.width = clamp(G.boss.hp / G.boss.maxHp, 0, 1) * 100 + '%';
  } else bb.classList.add('hidden');

  /* 武器栏(左下):图标 + 等级(斧头用像素图,其余 emoji) */
  const bar = $('weapon-bar');
  const keys = Object.keys(player.weapons);
  if (bar.childElementCount !== keys.length || bar.dataset.sig !== keys.join(',')){
    bar.dataset.sig = keys.join(',');
    bar.innerHTML = '';
    for (const k of keys){
      const el = document.createElement('div');
      el.className = 'wslot';
      el.innerHTML = weaponIconHTML(k, 20) + '<i>' + player.weapons[k].lv + '</i>';
      bar.appendChild(el);
    }
  } else {
    const els = bar.children;
    keys.forEach((k, i) => { els[i].innerHTML = weaponIconHTML(k, 20) + '<i>' + player.weapons[k].lv + '</i>'; });
  }

  /* 工坊面板数值 */
  $('pb-lv').textContent = 'Lv' + player.wboost;
  $('pb-atk').textContent = Math.round(playerAtk());
  $('pb-next').textContent = Math.round((CONFIG.player.atk + (player.wboost + 1) * CONFIG.upgrade.atkPerLv) * player.buffs.atk);
  const wc = wboostCost();
  const bw = $('btn-wboost'); bw.innerHTML = '强化 (' + coinIcon(13) + ' ' + fmtNum(wc) + ')'; bw.disabled = player.gold < wc;
  $('pa-lv').textContent = 'Lv' + player.armorLv;
  $('pa-hp').textContent = maxhp + ' → ' + (maxhp + CONFIG.upgrade.hpPerLv);
  const ac = armorCost();
  const ba = $('btn-armor'); ba.textContent = '强化 (💎 ' + fmtNum(ac) + ')'; ba.disabled = player.mat < ac;
  if (!$('panel-mask').classList.contains('hidden')) renderShopLists();
}

/* ★ 暂停规则:宝箱/工坊/帮助/离线收益 任一打开 → 世界暂停 */
function syncPause(){
  G.paused = !$('chest-mask').classList.contains('hidden') ||
             !$('panel-mask').classList.contains('hidden') ||
             !$('help-mask').classList.contains('hidden') ||
             !$('offline-mask').classList.contains('hidden');
}

/* 事件/关卡横幅:显示后 3 秒自动淡出(CSS 动画) */
function showEventBanner(text){
  const el = $('event-banner');
  el.textContent = text;
  el.classList.remove('show');
  void el.offsetWidth;                 // 重启动画
  el.classList.add('show');
}

function initUI(){
  $('coin-slot').innerHTML = coinIcon(14);   // 金币像素图标(emoji 兼容性兜底)
  $('btn-upgrade').addEventListener('click', () => { $('panel-mask').classList.remove('hidden'); renderShopLists(); refreshHUD(); syncPause(); });
  $('btn-close').addEventListener('click',  () => { $('panel-mask').classList.add('hidden'); syncPause(); });
  $('panel-mask').addEventListener('click', e => { if (e.target.id === 'panel-mask'){ $('panel-mask').classList.add('hidden'); syncPause(); } });
  $('btn-wboost').addEventListener('click', upgradeWboost);
  $('btn-armor').addEventListener('click', upgradeArmor);
  $('btn-help').addEventListener('click',   () => { $('help-mask').classList.remove('hidden'); syncPause(); });
  $('btn-help-close').addEventListener('click', () => { $('help-mask').classList.add('hidden'); syncPause(); });
  $('help-mask').addEventListener('click',  e => { if (e.target.id === 'help-mask'){ $('help-mask').classList.add('hidden'); syncPause(); } });
  /* 重置存档:二次点击确认;必须把 v3/v2 存档键与标签页所有权全部清掉,
     否则 load() 的 v2 迁移兜底会把旧进度又加载回来 */
  $('btn-reset').addEventListener('click', function(){
    const btn = this;
    if (!btn.dataset.confirm){
      btn.dataset.confirm = '1';
      btn.textContent = '⚠ 再点一次确认重置';
      setTimeout(() => { delete btn.dataset.confirm; btn.textContent = '🗑 重置存档(重新开始)'; }, 3000);
      return;
    }
    try{
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem(SAVE_KEY_V2);
      localStorage.removeItem('pixel_rpg_tab_owner');
    }catch(e){}
    location.reload();
  });
  /* 通关结算弹窗:点击立即进入下一关(否则 3 秒后自动) */
  $('stage-mask').addEventListener('click', () => { if (G.clearT > 0.05) G.clearT = 0.05; });
  /* 离线收益:领取后关闭并恢复 */
  $('btn-offline-claim').addEventListener('click', () => {
    player.gold += G.offlineGold; player.mat += G.offlineMat;
    sfx('coin'); buzz(40);
    G.offlineGold = G.offlineMat = G.offlineSecs = 0;
    $('offline-mask').classList.add('hidden');
    syncPause(); save(); refreshHUD();
  });
  $('btn-sound').addEventListener('click', function(){
    this.textContent = toggleMute() ? '🔇' : '🔊';
  });
}
