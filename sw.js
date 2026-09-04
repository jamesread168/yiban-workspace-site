/**
 * PWA 离线缓存引擎
 * 策略：stale-while-revalidate —— 优先秒开缓存，后台静默更新
 * 效果：手机加载过一次后，即使 5G 流量下被拦/无网络，也能正常打开工作台
 */
const CACHE_NAME = 'yiban-workspace-v5';
const CORE_FILES = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/data.js',
  './js/sync.js',
  './js/schedule.js',
  './js/schedule-edit.js',
  './js/study.js',
  './js/views.js',
  './js/cloud-sync.js',
  './js/app.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
];

// 安装：预缓存核心文件
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((c) => Promise.allSettled(CORE_FILES.map((f) => c.add(f))))
      .then(() => self.skipWaiting())
  );
});

// 激活：清理旧版本缓存
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 请求：缓存优先 + 后台更新（仅处理同源 GET；跳过二维码等外部 API）
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // API 请求一律不进缓存：数据读写 + SSE 实时推送必须拿最新结果，
  // 否则多设备同步会读到旧数据、SSE 长连接也会被缓存中断。
  if (url.pathname.indexOf('/api/') === 0) return;
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchPromise = fetch(e.request)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
