/* =========================================================================
 *  Service Worker — マラソン3:20プロジェクト PWA
 *  ・コア資産をプリキャッシュしてオフラインでも起動
 *  ・data.js とページ本体は network-first（更新を優先・オフライン時はキャッシュ）
 *  ・CSS / JS / アイコンは stale-while-revalidate（高速＋裏で更新）
 *  デプロイで内容を変えたら CACHE のバージョンを上げる。
 * ========================================================================= */
const CACHE = "m320-v2";
const CORE = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/data.js",
  "./js/main.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function networkFirst(req) {
  return fetch(req)
    .then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    })
    .catch(() => caches.match(req).then((r) => r || caches.match("./index.html")));
}

function staleWhileRevalidate(req) {
  return caches.open(CACHE).then((c) =>
    c.match(req).then((cached) => {
      const net = fetch(req)
        .then((res) => { c.put(req, res.clone()); return res; })
        .catch(() => cached);
      return cached || net;
    })
  );
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 外部は素通し

  // ページ遷移と data.js は最新を優先
  if (req.mode === "navigate" || url.pathname.endsWith("/js/data.js")) {
    e.respondWith(networkFirst(req));
    return;
  }
  // 静的資産は高速表示＋裏で更新
  e.respondWith(staleWhileRevalidate(req));
});
