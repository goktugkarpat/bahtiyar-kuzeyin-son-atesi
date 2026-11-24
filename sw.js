/* Bahtiyar: Kuzeyin Son Ateşi — çevrimdışı/önbellek (24 Kasım).
   Aynı sitede (goktugkarpat.github.io) başka oyunların da önbelleği var: yalnız "bahtiyar-kuzey-" ile başlayanlara dokunulur.
   - varlik/, vendor/, resimler: ÖNCE ÖNBELLEK (büyük dosyalar; ~116 MB yeniden inmesin). Arka planda her dosya bir kez
     (SW her uyandığında) küçük bir HEAD isteğiyle denetlenir; GitHub'daki sürüm değiştiyse yenisi indirilip kaydedilir
     (bir sonraki açılışta görünür).
   - index.html: önce ağ (en çok 3 sn), sonra önbellek. src/ ve style.css: önbellekten hemen, arka planda yenilenir
     (kod güncellemesi bir SONRAKİ açılışta görünür).
   Dosya biçimi değişip eskiyle uyumsuz olursa CACHE sürümünü artır (index.html'deki CACHE adıyla AYNI olmalı). */
var CACHE = 'bahtiyar-kuzey-v1';
var denetlendi = {};

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf('bahtiyar-kuzey-') === 0 && k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function etagSade(t) { return (t || '').replace(/^W\//, '').replace(/"/g, '').replace(/-(gzip|br)$/, ''); }
function kaydet(c, istek, yanit) {
  if (!yanit || !yanit.ok || yanit.type === 'opaque') return Promise.resolve();
  var h = new Headers(yanit.headers); h.set('x-kaydedildi', String(Date.now()));
  return yanit.clone().blob().then(function (b) { return c.put(istek, new Response(b, { status: 200, headers: h })); }).catch(function () {});
}
// sw.js'in kendisi kaydettiği yanıtları işaretler: sayfadaki yükleyici aynı dosyayı ikinci kez kaydetmesin
function isaretle(y) {
  if (!y || !y.ok || y.type === 'opaque') return y;
  var h = new Headers(y.headers); h.set('x-sw', '1');
  return new Response(y.body, { status: y.status, statusText: y.statusText, headers: h });
}
function anahtar(url) { var u = new URL(url); u.search = ''; u.hash = ''; return u.href; }

self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET') return;
  var url = new URL(r.url);
  if (url.origin !== location.origin) return;
  var kapsam = new URL('./', self.registration.scope).pathname;
  if (url.pathname.indexOf(kapsam) !== 0) return;
  var yol = url.pathname.slice(kapsam.length);
  var buyuk = /^(varlik|vendor)\//.test(yol) || /\.(webp|png|jpe?g|mp3|ogg)$/.test(yol);
  var k = anahtar(r.url);

  if (buyuk) {
    e.respondWith(caches.open(CACHE).then(function (c) {
      return c.match(k).then(function (eski) {
        if (eski) {
          if (!denetlendi[k]) {
            denetlendi[k] = true;
            e.waitUntil(fetch(k, { method: 'HEAD', cache: 'no-store' }).then(function (h) {
              if (!h.ok) return;
              var yeni = etagSade(h.headers.get('etag')), var_ = etagSade(eski.headers.get('etag'));
              if (yeni && var_ && yeni === var_) return;
              if (!yeni && !var_) return;
              return fetch(k, { cache: 'no-store' }).then(function (y) { return kaydet(c, k, y); });
            }).catch(function () {}));
          }
          return eski;
        }
        return fetch(r).then(function (y) { e.waitUntil(kaydet(c, k, y.clone())); return isaretle(y); });
      });
    }));
    return;
  }
  var sayfa = r.mode === 'navigate' || /(^|\/)$|\.html$/.test(yol);
  if (sayfa) {
    // sayfa: önce ağ (en çok 3 sn), olmazsa önbellek
    e.respondWith(caches.open(CACHE).then(function (c) {
      var ag = fetch(r).then(function (y) { if (y.ok) e.waitUntil(kaydet(c, k, y.clone())); return y; });
      var sure = new Promise(function (ok) { setTimeout(ok, 3000); }).then(function () { return c.match(k); });
      return Promise.race([ag.catch(function () { return c.match(k); }), sure.then(function (m) { return m || ag; })])
        .then(function (y) { return y || ag; });
    }));
    return;
  }
  // kod (src/, style.css): önbellekte varsa hemen ver, arka planda bir kez yenile (güncelleme bir sonraki açılışta)
  e.respondWith(caches.open(CACHE).then(function (c) {
    return c.match(k).then(function (eski) {
      var yenile = function () { return fetch(r, { cache: 'no-store' }).then(function (y) { return kaydet(c, k, y.clone()).then(function () { return isaretle(y); }); }); };
      if (eski) { if (!denetlendi[k]) { denetlendi[k] = true; e.waitUntil(yenile().catch(function () {})); } return eski; }
      return yenile();
    });
  }));
});
