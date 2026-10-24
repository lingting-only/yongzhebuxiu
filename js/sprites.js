/* sprites.js — 像素精灵:字符画定义,启动时渲染成离屏 canvas(零外部素材) */
'use strict';

const SPRITE_SRC = {
  player: { p:{S:'#c3ccd9',F:'#f2c294',E:'#3a3f4a',B:'#3e6db5',G:'#e8c05a',L:'#7a4e2a',s:'#77839a'}, r:[
    '....SSSS....',
    '...SSSSSS...',
    '...SFFFFS...',
    '...FEFFEF...',
    '....FFFF....',
    '..BBBBBBBB..',
    '.SBBGBBGBBS.',
    '.SBBBBBBBBS.',
    '..BBBBBBBB..',
    '..GGGGGGGG..',
    '...LL..LL...',
    '...LL..LL...',
    '...ss..ss...',
  ]},
  slime: { p:{g:'#4fc24f',G:'#8ee08a',e:'#20301f',m:'#2c7a35',d:'#2f8f43'}, r:[
    '...gggg...',
    '..gGgggG..',
    '.gggggggg.',
    '.geggggeg.',
    'gggggggggg',
    'gggggmmggg',
    'gddddddddg',
    '.dddddddd.',
  ]},
  bat: { p:{b:'#7a5fd0',B:'#9d85ec',e:'#ffe95e',d:'#4c3a8f'}, r:[
    'b........b',
    'bb.bbbb.bb',
    '.bbBeeBbb.',
    '..bBBBBb..',
    '..dbBBbd..',
    '...dddd...',
  ]},
  mush: { p:{R:'#d84f4f',W:'#f2e6d8',C:'#e8d9b0',e:'#4a3524'}, r:[
    '...RRRR...',
    '..RWRRWR..',
    '.RRRRRRRR.',
    '.RWRRRRWR.',
    'RRRRRRRRRR',
    '.CCCCCCCC.',
    '..CeCCeC..',
    '..CCCCCC..',
    '..CCCCCC..',
    '..CC..CC..',
  ]},
  skel: { p:{W:'#e8ecf2',E:'#31363f'}, r:[
    '..WWWWWW..',
    '.WWWWWWWW.',
    '.WEEWWEEW.',
    '.WWWWWWWW.',
    '...WWWW...',
    '.W.WWWW.W.',
    '...WWWW...',
    '..W.WW.W..',
    '...W..W...',
    '...W..W...',
    '..WW..WW..',
  ]},
  coin: { p:{g:'#c8871e',G:'#ffd24a'}, r:[
    '..gggg..',
    '.gGGGGg.',
    'gGGGGGGg',
    'gGGGGGGg',
    'gGGGGGGg',
    'gGGGGGGg',
    '.gGGGGg.',
    '..gggg..',
  ]},
  gem: { p:{b:'#2f6fd8',B:'#5aa4ff',W:'#eaf6ff'}, r:[
    '...bb...',
    '..bBBb..',
    '.bWBBBb.',
    'bBBBBBBb',
    '.bBBBBb.',
    '..bBBb..',
    '...bb...',
  ]},
  heart: { p:{p:'#d84f6a',P:'#ff7d9a',W:'#ffc2d1'}, r:[
    '.pp..pp.',
    'pPPppPPp',
    'pPWPPPPp',
    'pPPPPPPp',
    '.pPPPPp.',
    '..pPPp..',
    '...pp...',
  ]},
  chest: { p:{w:'#a0642c',W:'#c8871e',G:'#ffd24a',d:'#6b4218'}, r:[
    '.wwwwwwww.',
    'wWWWWWWWWw',
    'wWWWWWWWWw',
    'wwwwGwwwww',
    'wWWWGWWWWw',
    'wWWGGGGWWw',
    'wWWWWWWWWw',
    '.dddddddd.',
  ]},
  axe: { p:{S:'#c3ccd9',s:'#77839a',L:'#7a4e2a'}, r:[
    '.SS....',
    'SSSS...',
    'SSSSs..',
    '.SSs.L.',
    '....L..',
    '...L...',
    '...L...',
  ]},
  tomb: { p:{W:'#9aa0ad',E:'#31363f',D:'#6b7180'}, r:[
    '...WWWW...',
    '..WWWWWW..',
    '..WExxEW..',
    '..WWWWWW..',
    '...WWWW...',
    '...WDDW...',
    '...WWWW...',
    '...WWWW...',
    '.DDDDDDDD.',
  ]},
  crown: { p:{G:'#ffd24a',g:'#c8871e'}, r:[
    'G.G.G.G',
    'GGGGGGG',
    'GGGGGGG',
    'ggggggg',
  ]},
  tree: { p:{T:'#2e7d3a',t:'#7a4e2a',U:'#3f9c4d'}, r:[
    '....TTTT....',
    '..TTTTTTTT..',
    '.TTUTTTTUTT.',
    '.TTTTTTTTTT.',
    'TTUTTTTTTUTT',
    'TTTTTTTTTTTT',
    '.TTTTTTTTTT.',
    '..TTTTTTTT..',
    '.....tt.....',
    '.....tt.....',
  ]},
  rock: { p:{r:'#8b8f98',R:'#b9bfc9',d:'#6b7078'}, r:[
    '..rrrr..',
    '.rRRrrd.',
    'rRRRRrdd',
    'rrrrrrdd',
    '.dddddd.',
  ]},
  bush: { p:{T:'#2e7d3a',U:'#4aaa55'}, r:[
    '..TTTTTT..',
    '.TTUTTUTT.',
    'TTTTTTTTTT',
    '.TTTTTTTT.',
  ]},
};

/* 把字符画渲染成离屏 canvas(只执行一次,每帧 drawImage,性能好)
   override:调色板覆盖(主题地图换色用) */
function buildSprite(src, scale, override){
  const rows = src.r, pal = Object.assign({}, src.p, override || {});
  const h = rows.length, w = rows[0].length;
  const c = document.createElement('canvas');
  c.width = w * scale; c.height = h * scale;
  const g = c.getContext('2d');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
    const col = pal[rows[y][x]];
    if (!col) continue;
    g.fillStyle = col;
    g.fillRect(x * scale, y * scale, scale, scale);
  }
  return c;
}
/* 受击闪白版本 */
function whiteOf(cv){
  const c = document.createElement('canvas');
  c.width = cv.width; c.height = cv.height;
  const g = c.getContext('2d');
  g.drawImage(cv, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  return c;
}
/* 装饰精灵单独存放:随地图主题换色重建(world.js loadTheme 调用) */
const DECOR_KEYS = ['tree', 'rock', 'bush'];
let DECOR_SPRITES = {};
function rebuildDecorSprites(theme){
  for (const k of DECOR_KEYS)
    DECOR_SPRITES[k] = buildSprite(SPRITE_SRC[k], 3, (theme.decor && theme.decor[k]) || {});
}
rebuildDecorSprites(THEMES[0]);   // 默认第一张主题

const SPRITES = {}, SPRITES_WHITE = {};
for (const k in SPRITE_SRC){
  SPRITES[k] = buildSprite(SPRITE_SRC[k], 3);
  SPRITES_WHITE[k] = whiteOf(SPRITES[k]);
}

/* 内嵌像素图标:🪙/🪓 等 Unicode 13 新 emoji 在部分系统(如 Win10)不显示,
   统一改用游戏内像素精灵生成的 dataURL 图片,风格一致且必定渲染 */
const COIN_URL = SPRITES.coin.toDataURL();
const AXE_URL  = SPRITES.axe.toDataURL();
const coinIcon = h => '<img class="pix-ic" style="height:' + (h || 15) + 'px" src="' + COIN_URL + '" alt="金币">';
const axeIcon  = h => '<img class="pix-ic" style="height:' + (h || 15) + 'px" src="' + AXE_URL + '" alt="斧">';
/* 武器图标统一入口:斧头用像素图,其余用兼容性好的旧版 emoji */
function weaponIconHTML(key, h){ return key === 'axe' ? axeIcon(h) : WEAPONS[key].icon; }
