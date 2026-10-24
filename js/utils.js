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

/* ★ 时长格式化:X天X小时 / X小时X分 / X分X秒 */
function fmtDur(s){
  s = Math.floor(s);
  const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
  if (d) return d + '天' + h + '小时';
  if (h) return h + '小时' + m + '分';
  if (m) return m + '分' + (s % 60) + '秒';
  return s + '秒';
}

/* 手机震动反馈(跟随静音开关;不支持的设备自动忽略) */
function buzz(ms){
  if (G.muted || !navigator.vibrate) return;
  try{ navigator.vibrate(ms); }catch(e){}
}

/* ★ 大数字缩写:<1万 原样;<1000万 一位小数;≥1000万 取整(4位数,保证均分格内完整显示);
     万位进位到亿(99999999 → 1亿) */
function fmtNum(n){
  n = Math.floor(n);
  if (n < 1e4) return '' + n;
  const w = Math.round(n / 1e4);
  if (w >= 10000) return (w / 10000).toFixed(w % 10000 ? 1 : 0).replace(/\.0$/, '') + '亿';
  if (n >= 1e8) return (n / 1e8).toFixed(n % 1e8 ? 1 : 0).replace(/\.0$/, '') + '亿';
  if (w >= 1000) return w + '万';
  return (n / 1e4).toFixed(n % 1e4 ? 1 : 0).replace(/\.0$/, '') + '万';
}
