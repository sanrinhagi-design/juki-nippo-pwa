// ============================================================
// Service Worker — キャッシュ & オフライン対応
// ============================================================
const CACHE_NAME = 'juki-nippo-v41';
const ASSETS = ['./index.html', './manifest.json'];
self.addEventListener('install', e => {
  // cache:'reload' でブラウザのHTTPキャッシュを経由せず、必ず最新版を取り込む
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(ASSETS.map(u => new Request(u, {cache: 'reload'}))))
  );
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  // GAS API リクエストはキャッシュしない
  if (e.request.url.includes('script.google.com')) return;
  if (e.request.method !== 'GET') return;
  const isNav = e.request.mode === 'navigate' || e.request.url.endsWith('index.html') || e.request.url.endsWith('/');
  if (isNav) {
    // ★アプリ本体はキャッシュ優先（圏外・電波が弱い時もネット待ちせずすぐ起動する）。
    //   裏でネットから取り直してキャッシュを更新し、次回の起動から新しい版を使う。
    //   ?machine=H-3 のようなNFC用URLも同じ index.html として扱う
    const update = fetch('./index.html', {cache: 'no-cache'}).then(res => {
      if (res && res.ok) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put('./index.html', clone));
      }
      return res;
    });
    e.respondWith(caches.match('./index.html').then(cached => cached || update));
    e.waitUntil(update.catch(() => {}));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (!res || res.status !== 200 || res.type !== 'basic') return res;
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
// メインスレッドからのメッセージ受信（オプション）
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
