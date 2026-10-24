/* utils.js — 通用小工具 */
'use strict';

const rand    = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const clamp   = (v, a, b) => v < a ? a : v > b ? b : v;
const dist    = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const $       = id => document.getElementById(id);

/* 按权重随机取 key:weights = { key: 权重 } */
function weightedPick(weights){
  let sum = 0;
  for (const k in weights) sum += weights[k];
  let r = Math.random() * sum;
  for (const k in weights){ if ((r -= weights[k]) < 0) return k; }
  return Object.keys(weights)[0];
}

/* 手机震动反馈(跟随静音开关;不支持的设备自动忽略) */
function buzz(ms){
  if (G.muted || !navigator.vibrate) return;
  try{ navigator.vibrate(ms); }catch(e){}
}

/* ★ 大数字缩写:≥1万 显示 x.x万,≥1亿 显示 x.x亿(防止资源行溢出屏幕) */
function fmtNum(n){
  n = Math.floor(n);
  if (n >= 1e8) return (n / 1e8).toFixed(n % 1e8 ? 1 : 0).replace(/\.0$/, '') + '亿';
  if (n >= 1e4) return (n / 1e4).toFixed(n % 1e4 ? 1 : 0).replace(/\.0$/, '') + '万';
  return '' + n;
}
