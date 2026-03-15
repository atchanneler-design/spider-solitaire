const CACHE_NAME = 'spider-solitaire-v23';
const FONT_CACHE_NAME = 'spider-solitaire-fonts-v1';

// App Shell: オフラインでも動作させるファイル一覧
const APP_SHELL = [
  './index.html',
  './spider-solitaire.html',
  './privacy.html',
  './contact.html',
  './manifest.json',
  './icon.svg',
];

// ============================================================
// Install: App Shell をキャッシュ
// ============================================================
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// ============================================================
// Activate: 古いキャッシュを削除
// ============================================================
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== FONT_CACHE_NAME)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ============================================================
// Fetch: リクエスト別キャッシュ戦略
// ============================================================
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Google Fonts: ネットワーク優先 → キャッシュフォールバック
  if (
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  ) {
    event.respondWith(networkFirstWithFontCache(event.request));
    return;
  }

  // App Shell: キャッシュ優先 → ネットワークフォールバック
  event.respondWith(cacheFirst(event.request));
});

// キャッシュ優先戦略（App Shell）
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // オフライン時: App Shell の HTML を返す
    return caches.match('./spider-solitaire.html');
  }
}

// ネットワーク優先戦略（Google Fonts）
async function networkFirstWithFontCache(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(FONT_CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || Response.error();
  }
}
