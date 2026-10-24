/* sw.js — PWA Service Worker(勇者不休)
   策略:页面(导航请求)网络优先、失败回退缓存;静态资源缓存优先 + 后台更新;
   全部失败回退到缓存的 index.html → 断网也能玩。
   部署新版本时改 CACHE 版本号即可让老客户端刷新缓存。 */
'use strict';
const CACHE = 'yzbx-v2';
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './favicon.png', './icon-192.png', './icon-512.png',
  './css/style.css',
  './js/config.js', './js/utils.js', './js/sprites.js', './js/audio.js',
  './js/world.js', './js/entities.js', './js/weapons.js', './js/loot.js',
  './js/levelup.js', './js/shop.js', './js/ui.js', './js/input.js', './js/main.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* 忽略 ?v= 查询串匹配缓存,版本号变更也能命中并后台刷新 */
const stripQuery = url => url.split('?')[0];

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const isPage = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');

  if (isPage){
    /* 页面:网络优先(保证拿到最新 index.html 引用新版本资源),断网回退缓存 */
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put('./index.html', copy));
        return res;
      }).catch(() => caches.match('./index.html', { ignoreSearch: true }))
    );
    return;
  }
  /* 静态资源:缓存优先 + 后台静默更新 */
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => {
      const refresh = fetch(req).then(res => {
        if (res && res.ok){
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(stripQuery(req.url), copy));
        }
        return res;
      }).catch(() => hit);
      return hit || refresh;
    })
  );
});
