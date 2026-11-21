/* cekirdek.js – Barbar denemesi çekirdeği (Pixi kurulum, katmanlar, kamera, zaman, girdi, olaylar, varlıklar, döngü)
 *
 * API ÖZETİ (sözleşme, CLAUDE.md):
 *   OYUN.W=1280, OYUN.H=720, OYUN.app, OYUN.sessiz, OYUN.param(ad) → değer | '' (değersiz) | null (yok)
 *   OYUN.katman = { zemin, leke, golge, varlik, efekt, isik }  → kamera kabının (OYUN.katman.kamera) içinde, DÜNYA koordinatı
 *                 ust                                          → kameradan BAĞIMSIZ, EKRAN koordinatı (0..1280, 0..720)
 *   OYUN.gorunum = { x0, y0, w, h } (TAM EKRAN): pencerenin tamamı mantıksal ekran koordinatında; 1280×720 ortada,
 *                 fazlalık şeritler x0..0 / 1280..x0+w ve y0..0 / 720..y0+h (tam ekran örten şeyler bunu kullanır). OLAY 'boyut'.
 *                 varlik her kare zIndex = y (+ nesne.zEk) ile sıralanır (içine ne konursa).
 *   OYUN.kamera = { y (ekranın üst kenarının dünya y'si), hedefY (sayı ise kamera yumuşakça ona gider; null = kapalı),
 *                   sars(guc_px, sure_sn), yumusak (hedefY takip hızı, vars. 6) }
 *   OYUN.zaman  = { t, dt (oyun dt sn; duraksamada 0; ≤1/30), gercekDt, dondur(sn), yavaslat(olcek, sn) }
 *   OYUN.durum, OYUN.durumYap(d) → OLAY 'durum' (veri = d)
 *   OYUN.sistem(ad, {baslat(), guncelle(dt), sifirla()})   guncelle yalnız durum==='oyun' iken, kayıt sırasıyla
 *   OYUN.aciYon(rad), OYUN.yonAci(yon), OYUN.sinirla(v,a,b), OYUN.rast(a,b) (tohumlu; argsız 0..1), OYUN.mesafe(a,b)
 *   OYUN.basla(), OYUN.yenidenBasla(), OYUN.bilgi(), OYUN.adim(sn)
 *   OLAY.on(ad, fn) → kapatma fonksiyonu döner, OLAY.emit(ad, veri)
 *   GIRDI = { hx, hy, fare:{x,y,ex,ey,sol,sag}, basildi(tus), tutuluyor(tus) }
 *   VARLIK.ekle(ad, paket), VARLIK.var(ad), VARLIK.sprite(ad,{olcek}), VARLIK.doku(ad, kareAdi)
 *     s.oynat(anim, yon, {dongu, hiz=1, bitince, bastan=false}), s.anim, s.yon, s.kare, s.bitti, s.renk(tint), s.sil()
 *     Aynı anim tekrar oynatılırsa (bastan:false) yalnız yön/hız güncellenir; bitmiş tek seferlik anim yeniden başlamaz → bastan:true ver.
 *
 * SÖZLEŞMEYE EKLER (kırmadan):
 *   OYUN.oto (?oto), OYUN.atla (?atla), OYUN.hiz (?hiz, oyun hızı çarpanı; alt adımlarla, dt yine ≤1/30), OYUN.tohum (?tohum)
 *   OYUN.oncekiDurum, OYUN.basladi, OYUN.hatalar (yakalanan hatalar), OYUN.molaTusu=true (Esc/P ile oyun<->mola geçişini ÇEKİRDEK yapar;
 *     arayüz yalnız 'durum' olayını dinlesin; false yapılırsa çekirdek dokunmaz), sekme gizlenince 'oyun' → 'mola'.
 *   OYUN.sistem kaydında isteğe bağlı herKare(gercekDt): HER durumda her kare çağrılır (başlık/ölüm ekranı canlandırması için).
 *   OYUN.rastTam(a,b) (a..b dahil tam sayı), OYUN.sec(dizi), OYUN.tohumla(n), OYUN.aci(a,b) (a'dan b'ye açı), OYUN.aciFark(a,b) (-π..π),
 *   OYUN.lerp(a,b,t), OYUN.ekrandaMi(x, y, pay=100) (TASARIM penceresi, oynanış), OYUN.ekranaCevir/dunyayaCevir = dunyaEkran/ekranDunya
 *   YAKINLIK (19 Kasım): OYUN.yakinlik (vars. 1.15, ?yakin=), OYUN.gorus {sol,ust,w,h} (ekranda görünen dünya; barbarı izler),
 *     OYUN.dunyaEkran(x,y) / OYUN.ekranDunya(ex,ey) → {x,y} (mantıksal ekran = katman.ust), OYUN.gorusteMi(x,y,pay=100), OYUN.gorusOtur()
 *   OLAY.kapat(ad, fn), OLAY.bir(ad, fn)
 *   GIRDI tuş adları: 'sol','sag' (fare), 'bosluk','esc','enter','shift','tab', harfler 'a'..'z', rakamlar '0'..'9',
 *     yönler 'yukari','asagi','sola','saga' (WASD ve oklar ikisi de). GIRDI.fare.ekranda (imleç tuvalde mi)
 *   VARLIK.kare(ad, kareAdi) → {doku, ox, oy, w, h, bilgi} (çapa ofsetiyle tekil kare; bilgi = paket.bilgi[kareAdi] ya da null), VARLIK.animVar(ad, anim), VARLIK.yerTutucu(ad)
 *   s.animVar(anim), s.guncelle(dt) (elle ilerletme; sprite({elle:true}) ise çekirdek ilerletmez), s.boy (yaklaşık ekran boyu px),
 *     s.zEk (sıralama ofseti), s.ayna (şu an yatay çevrilmiş mi), s.yerTutucu (true/false)
 *   VARLIK.sprite'lar her kare oyun dt'si ile kendiliğinden ilerler ('mola' dışında; duraksamada donar).
 *
 * PAKET KARE BİÇİMİ: kareler[i] = [x, y, w, h, ox, oy]; (ox, oy) = karenin SOL-ÜST köşesinin çapaya (ayak noktası) göre
 *   konumu, PAKET PİKSELİ cinsinden (genelde ox≈-w/2, oy≈-h). Ekranda çarpan = paket.olcek * sprite({olcek}).
 *   anim.yon: 8 elemanlı ilk-kare dizisi; eleman null/-1/eksikse o yön ayna ile (8-yon)%8 yönünden yatay çevrilerek çizilir.
 *   anim.ayna: { yon: kaynakYon | [kaynakYon] } açıkça hangi yönün çevrileceğini söyler. anim.yon tek sayıysa yönsüz anim.
 */
(function () {
  'use strict';
  var W = 1280, H = 720;
  var PI = Math.PI, IKIPI = PI * 2;

  // ---------- URL parametreleri ----------
  var _ara = new URLSearchParams(location.search);
  function param(ad) { return _ara.has(ad) ? (_ara.get(ad) || '') : null; }

  var OYUN = window.OYUN = {
    W: W, H: H, app: null, param: param,
    sessiz: param('sessiz') !== null,
    oto: param('oto') !== null,
    atla: param('atla') !== null,
    hiz: Math.max(0.05, parseFloat(param('hiz')) || 1),
    tohum: param('tohum') !== null ? (parseInt(param('tohum'), 10) || 1) : ((Date.now() ^ (Math.random() * 1e9)) >>> 0),
    bolum: 1,
    durum: 'baslik', oncekiDurum: null, basladi: false, molaTusu: true, hatalar: []
  };

  function hataKaydet(yer, e) {
    var m = yer + ': ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e);
    if (OYUN.hatalar.length < 50) OYUN.hatalar.push(m);
    console.error('[cekirdek] ' + m);
  }

  // ---------- Olaylar ----------
  var _dinle = {}, _emitSay = 0, _kopyali = new Set();
  var OLAY = window.OLAY = {
    on: function (ad, fn) {
      var l = _dinle[ad];
      if (!l) l = _dinle[ad] = [];
      else if (_emitSay > 0 && !_kopyali.has(ad)) { l = _dinle[ad] = l.slice(); _kopyali.add(ad); }
      l.push(fn);
      return function () { OLAY.kapat(ad, fn); };
    },
    kapat: function (ad, fn) {
      var l = _dinle[ad]; if (!l) return;
      var i = l.indexOf(fn); if (i < 0) return;
      if (_emitSay > 0 && !_kopyali.has(ad)) { l = _dinle[ad] = l.slice(); _kopyali.add(ad); }
      l.splice(i, 1);
    },
    bir: function (ad, fn) { var k = OLAY.on(ad, function (v) { k(); fn(v); }); return k; },
    emit: function (ad, veri) {
      var l = _dinle[ad]; if (!l || !l.length) return;
      if (l.length === 1) { try { l[0](veri); } catch (e) { hataKaydet('olay ' + ad, e); } return; }
      _emitSay++;
      try {
        for (var i = 0; i < l.length; i++) { try { l[i](veri); } catch (e) { hataKaydet('olay ' + ad, e); } }
      } finally {
        if (--_emitSay === 0 && _kopyali.size) _kopyali.clear();
      }
    }
  };

  // ---------- Yardımcılar ----------
  var _r = OYUN.tohum >>> 0;
  function rnd() { // mulberry32
    _r = (_r + 0x6D2B79F5) >>> 0; var t = _r;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  OYUN.tohumla = function (n) { _r = (n >>> 0); };
  OYUN.rast = function (a, b) { if (a === undefined) return rnd(); if (b === undefined) { b = a; a = 0; } return a + (b - a) * rnd(); };
  OYUN.rastTam = function (a, b) { return Math.floor(a + (b - a + 1) * rnd()); };
  OYUN.sec = function (d) { return d[Math.floor(rnd() * d.length)]; };
  OYUN.sinirla = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  OYUN.lerp = function (a, b, t) { return a + (b - a) * t; };
  OYUN.mesafe = function (a, b) { var dx = b.x - a.x, dy = b.y - a.y; return Math.sqrt(dx * dx + dy * dy); };
  OYUN.aci = function (a, b) { return Math.atan2(b.y - a.y, b.x - a.x); };
  OYUN.aciFark = function (a, b) { if (!isFinite(a) || !isFinite(b)) return 0; var d = (b - a) % IKIPI; if (d > PI) d -= IKIPI; else if (d < -PI) d += IKIPI; return d; };
  // açı 0 = sağ (D=6), +π/2 = aşağı (G=0)
  OYUN.aciYon = function (a) { if (!isFinite(a)) return 0; var k = Math.round(a / (PI / 4)); k = ((k % 8) + 8) % 8; return (k + 6) % 8; };
  OYUN.yonAci = function (yon) { var k = (((yon | 0) - 6) % 8 + 8) % 8; var a = k * PI / 4; return a > PI ? a - IKIPI : a; };

  // ---------- Pixi uygulaması ----------
  var sahne = document.getElementById('sahne');
  if (!sahne) { sahne = document.createElement('div'); sahne.id = 'sahne'; document.body.appendChild(sahne); }
  var app = new PIXI.Application({
    width: W, height: H, backgroundColor: 0x0c0b0e, antialias: false, autoDensity: false,
    resolution: Math.min(2, window.devicePixelRatio || 1), powerPreference: 'high-performance'
  });
  OYUN.app = app;
  var tuval = app.view;
  sahne.appendChild(tuval);
  tuval.style.position = 'absolute'; tuval.style.display = 'block';
  tuval.style.touchAction = 'none';
  document.documentElement.style.background = '#000';
  if (document.body) { document.body.style.margin = '0'; document.body.style.background = '#000'; document.body.style.overflow = 'hidden'; }
  // TAM EKRAN (19 Kasım): tuval pencerenin TAMAMINI kaplar (siyah şerit yok). Mantıksal oyun alanı yine 1280×720,
  // pencereye sığacak ölçekte ORTADA durur; pencere 16:9'dan uzun/genişse fazladan görünen şeritlerde dünya devam eder.
  // OYUN.gorunum = { x0, y0, w, h } : görünen alanın tamamı, MANTIKSAL ekran koordinatında (x0,y0 ≤ 0; w ≥ 1280, h ≥ 720).
  //   Ekran (0,0) yine mantıksal alanın sol-üst köşesi; dünya noktası (x,y) ekranda (x - kamera.x, y - kamera.y).
  //   Görünen dünya: x ∈ [kamera.x + x0, kamera.x + x0 + w], y ∈ [kamera.y + y0, kamera.y + y0 + h]. Oynanış yine 1280×720'ye göre.
  var gorunum = OYUN.gorunum = { x0: 0, y0: 0, w: W, h: H };
  var _ox = 0, _oy = 0, _lw = W, _lh = H, _TAVAN = 4;   // _TAVAN: en çok 4 aygıt pikseli / mantıksal birim (dev ekranlarda dolum maliyeti)
  function boyutla() {
    var ww = Math.max(1, window.innerWidth || W), wh = Math.max(1, window.innerHeight || H);
    // çizim çözünürlüğü = ekrandaki gerçek piksel sayısı (tarayıcı ikinci kez büyütüp bulanıklaştırmasın: "gıcır gıcır")
    var dpr = window.devicePixelRatio;
    if (!(dpr > 0 && isFinite(dpr))) dpr = 1;
    var pw = Math.max(1, Math.round(ww * dpr)), ph = Math.max(1, Math.round(wh * dpr));
    var res = Math.max(0.25, Math.min(pw / W, ph / H)), f = res > _TAVAN ? _TAVAN / res : 1;
    var rpw = Math.max(1, Math.round(pw * f)), rph = Math.max(1, Math.round(ph * f));
    res *= f;
    _lw = rpw / res; _lh = rph / res;
    if (app.renderer.resolution !== res || app.renderer.screen.width !== _lw || app.renderer.screen.height !== _lh) {
      app.renderer.resolution = res; app.renderer.resize(_lw, _lh);
    }
    // Tuvalin CSS boyu = iç çözünürlük / dpr, TAM eşit (eşit değilse tarayıcı yeniden örnekleyip bütün sahneyi bulanıklaştırır).
    // Yalnız tavanı aşan dev ekranlarda (f < 1) tuval pencereye gerilir.
    var bw = f < 1 ? ww : tuval.width / dpr, bh = f < 1 ? wh : tuval.height / dpr;
    tuval.style.width = bw + 'px'; tuval.style.height = bh + 'px';
    tuval.style.left = '0px'; tuval.style.top = '0px';
    // mantıksal alan ortada; kayma aygıt pikseline oturur
    _ox = Math.round((_lw - W) / 2 * res) / res; _oy = Math.round((_lh - H) / 2 * res) / res;
    stage.position.set(_ox, _oy);
    gorunum.x0 = -_ox; gorunum.y0 = -_oy; gorunum.w = _lw; gorunum.h = _lh;
    OYUN.ekranOlcek = bw / _lw;   // CSS pikseli / mantıksal birim
  }
  var _boyAnahtar = '';
  function boyutDenetle() {   // her kare: pencere boyu ya da ekran yoğunluğu (Retina ↔ dış ekran) değişti mi; 'resize' olayı dpr değişiminde gelmeyebilir
    var k = window.innerWidth + 'x' + window.innerHeight + '@' + window.devicePixelRatio;
    if (k === _boyAnahtar) return;
    _boyAnahtar = k; boyutla();
    try { OLAY.emit('boyut', gorunum); } catch (e) {}
  }
  window.addEventListener('resize', boyutDenetle);

  // ---------- Katmanlar ----------
  var stage = app.stage;
  var kap = new PIXI.Container(); kap.name = 'kamera';
  var K = OYUN.katman = {};
  ['zemin', 'leke', 'golge', 'varlik', 'efekt', 'isik'].forEach(function (ad) {
    var c = new PIXI.Container(); c.name = ad; K[ad] = c; kap.addChild(c);
  });
  K.varlik.sortableChildren = true;
  K.ust = new PIXI.Container(); K.ust.name = 'ust';
  K.kamera = kap;
  stage.addChild(kap); stage.addChild(K.ust);
  boyutDenetle();   // tam ekran boyutu (stage kayması burada kurulabilir)

  // ---------- Kamera ----------
  var _sarsGuc = 0, _sarsSure = 0, _sarsKalan = 0;
  var kamera = OYUN.kamera = {
    x: 0, y: 0, hedefY: null, yumusak: 6, sx: 0, sy: 0,
    sars: function (guc, sure) {
      // EBEVEYN (5. tur): sürekli titreme istemiyor → bütün sarsıntılar yarıya iner, küçükleri (sıradan vuruş, adım, domino) hiç olmaz.
      guc *= 0.4; if (!(guc >= 2)) return;
      sure = Math.max(0.01, sure || 0.25);
      var simdiki = (_sarsKalan > 0 && _sarsSure > 0) ? _sarsGuc * (_sarsKalan / _sarsSure) : 0;
      if (guc >= simdiki) { _sarsGuc = guc; _sarsSure = sure; _sarsKalan = sure; }
    }
  };
  // ---------- YAKINLAŞTIRMA + GÖRÜŞ PENCERESİ (19 Kasım, %15 yakın) ----------
  // Oynanış "tasarım penceresi" yine 1280×720 (kamera.x/kamera.y'den başlar; ekrandaMi buna göre).
  // OYUN.gorus = {sol, ust, w, h}: o kare ekranda GÖRÜNEN dünya dikdörtgeni (w = gorunum.w / yakinlik). Barbarı yumuşakça izler,
  // tasarım penceresinin içine kıstırılır (görüş ondan büyükse ortalanır). Kamera kabı: ölçek = yakinlik, konum aygıt pikseline yuvarlı.
  var yakinDeneme = parseFloat(param('yakin'));
  var sabitYakinlik = yakinDeneme > .3 && yakinDeneme < 4;
  var dokunmatikApple = /Mac/.test(navigator.platform) && navigator.maxTouchPoints > 1;
  var mobilEkran = /Android|iPad|iPhone|iPod/i.test(navigator.userAgent) || dokunmatikApple;
  var siradakiKameraKontrolu = 0;

  function otomatikYakinlik() {
    var en = screen.width, boy = screen.height;
    // CSS ekran boyutu, pencere boyutundan bağımsız bir büyük ekran göstergesidir.
    var buyukEkran = Math.max(en, boy) >= 1840 && Math.min(en, boy) >= 900;
    return !mobilEkran && buyukEkran ? 1 : 1.15;
  }

  OYUN.yakinlik = sabitYakinlik ? yakinDeneme : otomatikYakinlik();
  function kameraEkraniniDenetle() {
    if (sabitYakinlik || mobilEkran) return;
    var simdi = performance.now();
    if (simdi < siradakiKameraKontrolu) return;
    siradakiKameraKontrolu = simdi + 400;
    var yakinlik = otomatikYakinlik();
    if (OYUN.yakinlik === yakinlik) return;
    OYUN.yakinlik = yakinlik;
    OYUN.gorusOtur();
    fareDunya();
  }
  var gorus = OYUN.gorus = { sol: 0, ust: 0, w: W, h: H };
  var _gOtur = true;     // true → bir sonraki güncellemede yumuşatmadan otur (ışınlanma)
  OYUN.gorusZaman = 0.2; // izleme zaman sabiti (sn)
  OYUN.gorusOtur = function () { _gOtur = true; gorusGuncelle(0); };
  var _gSonX = null, _gSonY = null, _gSonKY = null;
  function gorusHedef(ad) {   // ad: 'x' | 'y' → kıstırılmış hedef sol/ust
    var z = OYUN.yakinlik, O = window.OYUNCU;
    var ox = O && isFinite(O.x) ? O.x : kamera.x + W / 2, oy = O && isFinite(O.y) ? O.y : kamera.y + H / 2;
    if (ad === 'x') {
      if (gorus.w >= W) return kamera.x + (W - gorus.w) / 2;
      var mx = ox, D = window.DEV;
      // dev dövüşünde pencere devle barbarın arasına doğru biraz kayar (dev görüşten çıkmasın); barbar kenardan ≥180 px içeride kalır
      if (D && D.aktif && !D.olu && isFinite(D.x)) {
        mx = ox + (D.x - ox) * 0.4;
        mx = Math.max(ox - gorus.w / 2 + 180, Math.min(ox + gorus.w / 2 - 180, mx));
      }
      return Math.max(kamera.x, Math.min(kamera.x + W - gorus.w, mx - gorus.w / 2));
    }
    if (gorus.h >= H) return kamera.y + (H - gorus.h) / 2;
    return Math.max(kamera.y, Math.min(kamera.y + H - gorus.h, oy - gorus.h * 0.58));
  }
  function gorusGuncelle(dt) {
    var z = OYUN.yakinlik;
    gorus.w = gorunum.w / z; gorus.h = gorunum.h / z;
    var O = window.OYUNCU, ox = O && isFinite(O.x) ? O.x : null, oy = O && isFinite(O.y) ? O.y : null;
    // ışınlanma sezgisi: barbar ya da kamera bir karede çok sıçradıysa otur
    if (ox !== null && _gSonX !== null && (Math.abs(ox - _gSonX) > 400 || Math.abs(oy - _gSonY) > 400)) _gOtur = true;
    if (_gSonKY !== null && Math.abs(kamera.y - _gSonKY) > 400) _gOtur = true;
    _gSonX = ox; _gSonY = oy; _gSonKY = kamera.y;
    var hx = gorusHedef('x'), hy = gorusHedef('y');
    if (_gOtur || !(isFinite(gorus.sol) && isFinite(gorus.ust))) { gorus.sol = hx; gorus.ust = hy; _gOtur = false; }
    else if (dt > 0) {
      var k = 1 - Math.exp(-dt / Math.max(0.01, OYUN.gorusZaman));
      gorus.sol += (hx - gorus.sol) * k; gorus.ust += (hy - gorus.ust) * k;
    }
    // her durumda kıstır (kamera.y değişmiş, pencere boyu değişmiş olabilir)
    if (gorus.w < W) gorus.sol = Math.max(kamera.x, Math.min(kamera.x + W - gorus.w, gorus.sol)); else gorus.sol = hx;
    if (gorus.h < H) gorus.ust = Math.max(kamera.y, Math.min(kamera.y + H - gorus.h, gorus.ust)); else gorus.ust = hy;
  }
  OYUN.gorusGuncelle = gorusGuncelle;
  // dünya → mantıksal ekran (katman.ust koordinatı; 1280×720'nin sol-üstü 0,0) ve tersi
  OYUN.dunyaEkran = function (x, y) {
    var z = OYUN.yakinlik;
    return { x: (x - gorus.sol) * z + gorunum.x0, y: (y - gorus.ust) * z + gorunum.y0 };
  };
  OYUN.ekranDunya = function (ex, ey) {
    var z = OYUN.yakinlik;
    return { x: gorus.sol + (ex - gorunum.x0) / z, y: gorus.ust + (ey - gorunum.y0) / z };
  };
  OYUN.gorusteMi = function (x, y, pay) {
    if (pay === undefined) pay = 100;
    return x > gorus.sol - pay && x < gorus.sol + gorus.w + pay && y > gorus.ust - pay && y < gorus.ust + gorus.h + pay;
  };
  OYUN.ekranaCevir = OYUN.dunyaEkran;
  OYUN.dunyayaCevir = OYUN.ekranDunya;
  function fareDunya() {
    var f = GIRDI.fare, z = OYUN.yakinlik;
    f.x = gorus.sol + (f.ex - gorunum.x0) / z; f.y = gorus.ust + (f.ey - gorunum.y0) / z;
  }
  OLAY.on('boyut', function () { _gOtur = true; });
  OYUN.ekrandaMi = function (x, y, pay) {
    if (pay === undefined) pay = 100;
    return y > kamera.y - pay && y < kamera.y + H + pay && x > kamera.x - pay && x < kamera.x + W + pay;
  };

  // ---------- Zaman ----------
  var _donKalan = 0, _yavasOlcek = 1, _yavasKalan = 0;
  var zaman = OYUN.zaman = {
    t: 0, dt: 0, gercekDt: 0, gercekT: 0,
    // EBEVEYN (5. tur): "vurdukça takıla takıla oynuyorum" → vuruş duraksaması KAPALI. Küçük istekler (her vuruş, blok,
    // sektirme, hasar alma…) yok sayılır; yalnız büyük, seyrek anlar (ölüm, dev ölümü, öfke açılışı: ≥0.1 sn) kısaltılarak geçer.
    dondur: function (sn) { if (!(sn >= 0.1)) return; sn = Math.min(sn, 0.1); if (sn > _donKalan) _donKalan = sn; },
    yavaslat: function (olcek, sn) { _yavasOlcek = olcek; _yavasKalan = sn; },
    get donuk() { return _donKalan > 0; }
  };

  // ---------- Girdi ----------
  var _tut = new Set(), _gelen = new Set(), _bu = new Set(), _altAdim = false;
  var VARSAYILAN_TUSLAR = {
    yukari: 'KeyW', sola: 'KeyA', asagi: 'KeyS', saga: 'KeyD', o: 'KeyO', p: 'KeyP',
    g: 'KeyG', bosluk: 'Space', e: 'KeyE', x: 'KeyX', esc: 'Escape', r: 'KeyR'
  };
  var YON_TUSLARI = { ArrowUp: 'yukari', ArrowLeft: 'sola', ArrowDown: 'asagi', ArrowRight: 'saga' };
  var TUS_ADLARI = { Space: 'Boşluk', Escape: 'Esc', ArrowUp: '↑', ArrowLeft: '←', ArrowDown: '↓', ArrowRight: '→',
    Backspace: 'Sil', Delete: 'Delete', Insert: 'Insert', PageUp: 'PgUp', PageDown: 'PgDn', Home: 'Home', End: 'End',
    ShiftLeft: 'Sol Shift', ShiftRight: 'Sağ Shift', Minus: '−', Equal: '=', Backquote: '`', BracketLeft: '[',
    BracketRight: ']', Semicolon: ';', Quote: "'", Backslash: 'Ters eğik çizgi', IntlBackslash: '<', Comma: ',', Period: '.', Slash: '/',
    NumpadAdd: 'Num +', NumpadSubtract: 'Num −', NumpadMultiply: 'Num ×', NumpadDivide: 'Num ÷', NumpadDecimal: 'Num .' };
  var TUS_KAYDI = 'barbar-klavye';
  var atamalar = Object.assign({}, VARSAYILAN_TUSLAR);
  function atanabilir(kod) {
    return typeof kod === 'string' && (Object.hasOwn(TUS_ADLARI, kod) || /^(Key[A-Z]|Digit[0-9]|Numpad[0-9])$/.test(kod));
  }
  try {
    var kayitliTuslar = JSON.parse(localStorage.getItem(TUS_KAYDI) || 'null');
    if (kayitliTuslar) {
      var adayTuslar = Object.assign({}, atamalar);
      for (var eylem in atamalar) if (atanabilir(kayitliTuslar[eylem])) adayTuslar[eylem] = kayitliTuslar[eylem];
      if (new Set(Object.values(adayTuslar)).size === Object.keys(atamalar).length) atamalar = adayTuslar;
    }
  } catch (e) { /* Tarayıcı depolama izni vermeyebilir. */ }
  var tusaGore = new Map();
  function tusHaritasiniKur() {
    tusaGore.clear();
    for (var ad in atamalar) tusaGore.set(atamalar[ad], ad);
    for (var kod in YON_TUSLARI) {
      var yon = YON_TUSLARI[kod];
      if (!tusaGore.has(kod) && atamalar[yon] === VARSAYILAN_TUSLAR[yon]) tusaGore.set(kod, yon);
    }
  }
  tusHaritasiniKur();
  var basiliKodlar = new Map();
  function tuslariKaydet() {
    GIRDI.temizle();
    tusHaritasiniKur();
    try { localStorage.setItem(TUS_KAYDI, JSON.stringify(atamalar)); } catch (e) { /* Bu oturumda geçerli kalır. */ }
    OLAY.emit('tusAtamalari');
  }
  // Tarayıcının standart Xbox düzenindeki düğme ve eksen sıralaması.
  var PAD_ADLARI = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menü', 'LS', 'RS'];
  var PAD_VARSAYILAN = { o: 7, p: 6, g: 5, bosluk: 0, e: 3, x: 2, esc: 9, r: 8 };
  var PAD_KAYDI = 'barbar-kontrolcu';
  var padTuslari = Object.assign({}, PAD_VARSAYILAN);
  var padEylemler = [], padTut = new Set(), padBasili = new Uint8Array(16);
  var pad = { bagli: false, aktif: false, ayarlaniyor: false, ax: 0, ay: 0, hx: 0, hy: 0 };
  var padIndeks = -1, padMerkezBekle = false, padGezinti = -1;
  function padKodu(no) { return Number.isInteger(no) && no >= 0 && no < PAD_ADLARI.length; }
  try {
    var kayitliPad = JSON.parse(localStorage.getItem(PAD_KAYDI) || 'null');
    if (kayitliPad && Object.keys(padTuslari).every(function (ad) { return padKodu(kayitliPad[ad]); }) &&
        new Set(Object.keys(padTuslari).map(function (ad) { return kayitliPad[ad]; })).size === Object.keys(padTuslari).length) {
      for (var ad in padTuslari) padTuslari[ad] = kayitliPad[ad];
    }
  } catch (e) { /* Depolama kapalı olabilir. */ }
  function padHaritasi() {
    padEylemler.length = 0;
    for (var ad in padTuslari) padEylemler[padTuslari[ad]] = ad;
  }
  padHaritasi();
  function padKaydet() {
    padTut.clear();
    padHaritasi();
    try { localStorage.setItem(PAD_KAYDI, JSON.stringify(padTuslari)); } catch (e) { /* Oturumda kalır. */ }
    OLAY.emit('kontrolcuAtamalari');
  }
  function padAktifYap(aktif) {
    if (pad.aktif === aktif) return;
    pad.aktif = aktif;
    OLAY.emit('kontrolcuGiris', aktif);
  }
  function padCubuk(eksenler, i, alan, xAd, yAd) {
    var x = eksenler[i] || 0, y = eksenler[i + 1] || 0, m = Math.hypot(x, y), esik = .20;
    var k = m > esik ? (Math.min(1, m) - esik) / ((1 - esik) * m) : 0;
    alan[xAd] = x * k; alan[yAd] = y * k;
  }
  var padTara = typeof navigator.getGamepads === 'function' ? navigator.getGamepads.bind(navigator) : null;
  function padOku() {
    if (!padTara) return;
    var liste;
    try { liste = padTara(); } catch (e) { padTara = null; }
    var aygit = liste && liste[padIndeks];
    if (!aygit?.connected || aygit.mapping !== 'standard') {
      aygit = null;
      if (liste) for (var i = 0; i < liste.length; i++) {
        if (liste[i]?.connected && liste[i].mapping === 'standard') { aygit = liste[i]; break; }
      }
    }
    padTut.clear(); pad.hx = pad.hy = pad.ax = pad.ay = 0;
    if (pad.bagli !== !!aygit) {
      pad.bagli = !!aygit;
      if (!aygit) padAktifYap(false);
      OLAY.emit('kontrolcuBaglanti', pad.bagli);
    }
    if (!aygit) { padIndeks = -1; padBasili.fill(0); padGezinti = -1; return; }
    if (padIndeks !== aygit.index) {
      padIndeks = aygit.index;
      padBasili.fill(0); padGezinti = -1;
    }
    if (document.hidden || !document.hasFocus()) { padMerkezBekle = true; return; }
    padCubuk(aygit.axes, 0, pad, 'hx', 'hy');
    padCubuk(aygit.axes, 2, pad, 'ax', 'ay');
    var d = OYUN.durum, oyunda = d === 'oyun', ayar = pad.ayarlaniyor, herhangi = false;
    for (var i = 0; i < padBasili.length; i++) {
      var b = aygit.buttons[i], basili = !!(b && (b.pressed || b.value > .52));
      var yeni = basili && !padBasili[i];
      padBasili[i] = basili ? 1 : 0;
      if (!basili) continue;
      herhangi = true;
      if (padMerkezBekle) continue;
      if (yeni) padAktifYap(true);
      if (ayar || !oyunda) {
        if (yeni) OLAY.emit('kontrolcuTusu', i);
        continue;
      }
      var ad = padEylemler[i];
      if (ad) {
        padTut.add(ad);
        if (yeni) _gelen.add(ad);
      }
    }
    if (padMerkezBekle) {
      if (!herhangi && !pad.hx && !pad.hy && !pad.ax && !pad.ay) padMerkezBekle = false;
      pad.hx = pad.hy = pad.ax = pad.ay = 0;
      return;
    }
    if (pad.hx || pad.hy || pad.ax || pad.ay) padAktifYap(true);
    if (oyunda && !ayar) {
      if (!pad.hx && !pad.hy) {
        pad.hx = padBasili[15] - padBasili[14]; pad.hy = padBasili[13] - padBasili[12];
        if (pad.hx && pad.hy) { pad.hx *= Math.SQRT1_2; pad.hy *= Math.SQRT1_2; }
      }
      padGezinti = -1;
    } else {
      var x = pad.hx, y = pad.hy, yon = -1;
      if (Math.abs(x) > .38 || Math.abs(y) > .38) yon = Math.abs(x) > Math.abs(y) ? (x < 0 ? 14 : 15) : (y < 0 ? 12 : 13);
      if (!ayar && yon >= 0 && yon !== padGezinti) OLAY.emit('kontrolcuTusu', yon);
      padGezinti = yon;
      pad.hx = pad.hy = pad.ax = pad.ay = 0;
    }
  }

  var GIRDI = window.GIRDI = {
    hx: 0, hy: 0, saldiriKlavye: false, pad: pad,
    padAdi: function (ad) { return PAD_ADLARI[padTuslari[ad]]; },
    padEylemi: function (no) { return padEylemler[no]; },
    padAta: function (ad, no) {
      if (!Object.hasOwn(padTuslari, ad) || !padKodu(no)) return false;
      var diger = padEylemler[no];
      if (diger && diger !== ad) padTuslari[diger] = padTuslari[ad];
      padTuslari[ad] = no;
      padKaydet();
      return true;
    },
    padSifirla: function () { padTuslari = Object.assign({}, PAD_VARSAYILAN); padKaydet(); },
    fare: { x: W / 2, y: H / 2, ex: W / 2, ey: H / 2, sol: false, sag: false, ekranda: false },
    tusEylemi: function (kod) { return tusaGore.get(kod); },
    tusAdi: function (ad) {
      var kod = atamalar[ad];
      return TUS_ADLARI[kod] || kod.replace(/^Key|^Digit/, '').replace(/^Numpad/, 'Num ');
    },
    tusAta: function (ad, kod) {
      if (!Object.hasOwn(atamalar, ad) || !atanabilir(kod)) return false;
      var diger = tusaGore.get(kod);
      if (diger && diger !== ad && atamalar[diger] === kod) atamalar[diger] = atamalar[ad];
      atamalar[ad] = kod;
      tuslariKaydet();
      return true;
    },
    tuslariSifirla: function () { atamalar = Object.assign({}, VARSAYILAN_TUSLAR); tuslariKaydet(); },
    basildi: function (t) { return !_altAdim && _bu.has(t); },
    tutuluyor: function (t) { return _tut.has(t) || padTut.has(t); },
    temizle: function () { padTut.clear(); basiliKodlar.clear(); _tut.clear(); _gelen.clear(); _bu.clear(); GIRDI.fare.sol = GIRDI.fare.sag = false; GIRDI.hx = GIRDI.hy = 0; }
  };
  window.addEventListener('keydown', function (e) {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.repeat || e.target.closest?.('input, textarea, [contenteditable="true"]')) return;
    var ad = GIRDI.tusEylemi(e.code);
    if (!ad) return;
    padAktifYap(false);
    if ((OYUN.durum === 'oyun' && !e.target.closest?.('button')) || ad === 'esc') e.preventDefault();
    if (ad === 'o' || ad === 'p') GIRDI.saldiriKlavye = true;
    basiliKodlar.set(e.code, ad); _gelen.add(ad); _tut.add(ad);
  });
  window.addEventListener('keyup', function (e) {
    var ad = basiliKodlar.get(e.code);
    if (!ad) return;
    basiliKodlar.delete(e.code);
    for (var basili of basiliKodlar.values()) if (basili === ad) return;
    _tut.delete(ad);
  });
  function fareKonum(e) {
    if (!isFinite(e.clientX) || !isFinite(e.clientY)) return;
    var r = tuval.getBoundingClientRect();
    var f = GIRDI.fare;
    // tuval tüm pencere: tuval pikseli → mantıksal ekran (ortadaki 1280×720'nin sol-üstü 0,0; şeritlerde eksi / 1280-720 üstü)
    f.ex = (e.clientX - r.left) / (r.width || 1) * _lw - _ox;
    f.ey = (e.clientY - r.top) / (r.height || 1) * _lh - _oy;
    f.ekranda = f.ex >= gorunum.x0 && f.ey >= gorunum.y0 && f.ex <= gorunum.x0 + gorunum.w && f.ey <= gorunum.y0 + gorunum.h;
    fareDunya();
    if (e.pointerType === 'mouse' && typeof e.buttons === 'number') {
      if (!(e.buttons & 1)) { f.sol = false; _tut.delete('sol'); }
      if (!(e.buttons & 2)) { f.sag = false; _tut.delete('sag'); }
    }
  }
  window.addEventListener('pointermove', fareKonum, { passive: true });
  window.addEventListener('pointerdown', function (e) {
    fareKonum(e);
    var t = e.button === 2 ? 'sag' : (e.button === 0 ? 'sol' : null); if (!t) return;
    padAktifYap(false);
    GIRDI.saldiriKlavye = false;
    GIRDI.fare[t] = true; _tut.add(t); _gelen.add(t);
  });
  window.addEventListener('pointerup', function (e) {
    fareKonum(e);
    var t = e.button === 2 ? 'sag' : (e.button === 0 ? 'sol' : null); if (!t) return;
    GIRDI.fare[t] = false; _tut.delete(t);
  });
  window.addEventListener('pointercancel', function () {
    GIRDI.fare.sol = GIRDI.fare.sag = false;
    _tut.delete('sol'); _tut.delete('sag');
  });
  window.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  window.addEventListener('blur', function () { padMerkezBekle = true; GIRDI.temizle(); GIRDI.fare.ekranda = false; });
  window.addEventListener('pagehide', function () { GIRDI.temizle(); GIRDI.fare.ekranda = false; });
  function girdiKare() {
    padOku();
    var tmp = _bu; _bu = _gelen; _gelen = tmp; _gelen.clear();
    var hx = (_tut.has('saga') ? 1 : 0) - (_tut.has('sola') ? 1 : 0);
    var hy = (_tut.has('asagi') ? 1 : 0) - (_tut.has('yukari') ? 1 : 0);
    if (hx && hy) { hx *= Math.SQRT1_2; hy *= Math.SQRT1_2; }
    GIRDI.hx = hx || hy ? hx : pad.hx; GIRDI.hy = hx || hy ? hy : pad.hy;
    gorusGuncelle(0);   // sistemlerden önce: görüş penceresi (yumuşatmasız, yalnız kıstırma)
    fareDunya();
  }

  // ---------- Durum ----------
  OYUN.durumYap = function (d) {
    if (OYUN.durum === d) return;
    OYUN.oncekiDurum = OYUN.durum; OYUN.durum = d;
    if (d !== 'oyun') GIRDI.temizle();
    OLAY.emit('durum', d);
  };
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { GIRDI.temizle(); if (OYUN.durum === 'oyun' && OYUN.molaTusu) OYUN.durumYap('mola'); }
  });

  // ---------- Sistemler ----------
  var sistemler = [];
  OYUN.sistemler = sistemler;
  OYUN.sistem = function (ad, s) {
    s = s || {}; s.ad = ad; s._hata = 0;
    for (var i = 0; i < sistemler.length; i++) if (sistemler[i].ad === ad) { sistemler[i] = s; return s; }
    sistemler.push(s);
    if (OYUN.basladi && s.baslat) { try { s.baslat(); } catch (e) { hataKaydet(ad + '.baslat', e); } }
    return s;
  };
  function sistemCagir(fn, a) {
    for (var i = 0; i < sistemler.length; i++) {
      var s = sistemler[i], f = s[fn];
      if (!f) continue;
      try { f.call(s, a); } catch (e) { if (s._hata++ < 3) hataKaydet(s.ad + '.' + fn, e); }
    }
  }

  // =====================================================================
  // ---------- Varlıklar ----------
  // =====================================================================
  var paketler = {};
  function bolumNo(no) { return no === 2 || no === 3 ? no : 1; }
  var BOLUM_PAKET = OYUN.BOLUM_PAKET = {
    1: ['dev', 'cevre', 'goblin'],
    2: ['vargor', 'cevre2', 'baskinci', 'infazci', 'goblin'],
    3: ['ayaz', 'ayaz_cevre2', 'ayaz_kurt', 'ayaz_stil', 'ayaz_tutsak', 'ayaz_goblin', 'ayaz_mizrak', 'ayaz_zincirci', 'ayaz_muhafiz', 'ayaz_skarn']
  };
  function aktifPaketMi(ad, no) {
    no = no || OYUN.bolum;
    var aktif = BOLUM_PAKET[no] || [];
    if (aktif.indexOf(ad) >= 0) return true;
    for (var b in BOLUM_PAKET) {
      if (BOLUM_PAKET[b].indexOf(ad) >= 0) return false;
    }
    return true;
  }
  var YT_BOY = { barbar: 120, oyuncu: 120, goblin: 78, okcu: 135, kalkanli: 135, ork: 135, saman: 125, dev: 360 };
  var YT_RENK = { barbar: 0xc89a58, oyuncu: 0xc89a58, goblin: 0x5d8f3a, okcu: 0x8a7a3e, kalkanli: 0x6c7480, ork: 0x6d7a48, saman: 0x8a4fa0, dev: 0x9a5a44 };
  var YT_ANIM = {
    dur: [6, 4, true], yuru: [10, 8, true], vur: [16, 6, false], vur2: [16, 6, false], at: [14, 6, false],
    atil: [14, 6, false], sersem: [12, 4, false], ol: [12, 8, false], cek: [10, 8, false], buyu: [10, 10, false],
    kalkan: [8, 4, true], yerevur: [10, 12, false], kayaat: [10, 10, false], kukre: [10, 12, false]
  };
  function aynaYon(y) { return (8 - y) % 8; }

  function paketHazirla(ad, p) {
    p.ad = ad; p.olcek = p.olcek || 1;
    p.anim = p.anim || {}; p.tekil = p.tekil || {}; p.kareler = p.kareler || [];
    // ÇOK SAYFA: p.img bir dizi olabilir (ya da ek sayfalar p.sayfalar); kareler[i][6] = sayfa no (yoksa 0)
    var imgs = Array.isArray(p.img) ? p.img : [p.img].concat(Array.isArray(p.sayfalar) ? p.sayfalar : []);
    p.bases = [];
    try {
      p.bases = imgs.map(function (s) { return PIXI.BaseTexture.from(s); });
      p.base = p.bases[0];
      // çevre (ve paket.mipmap:true diyen) resimler küçültülerek de çizilir (2× çizilmiş dekor 1× ekranda) → mipmap: kumlanma/titreşme olmasın.
      // Büyütmede mipmap devreye girmez (keskin kalır). Karakter paketlerinde kapalı (hafif yumuşatma yapmasın).
      if (p.mipmap === true || ((ad === 'cevre' || ad === 'cevre2') && p.mipmap !== false)) p.bases.forEach(function (b) { b.mipmap = PIXI.MIPMAP_MODES.ON; b.anisotropicLevel = 4; });
    } catch (e) { hataKaydet('VARLIK.ekle ' + ad, e); p.base = null; p.bases = []; }
    p.dokular = new Array(p.kareler.length);
    for (var i = 0; i < p.kareler.length; i++) {
      var k = p.kareler[i], bt = p.bases[k[6] || 0];
      p.dokular[i] = bt ? new PIXI.Texture(bt, new PIXI.Rectangle(k[0], k[1], k[2], k[3])) : PIXI.Texture.EMPTY;
    }
    var enBoy = 0;
    for (var an in p.anim) {
      var a = p.anim[an];
      a.fps = a.fps || 10; a.n = a.n || 1; if (a.dongu === undefined) a.dongu = true;
      // her yön için {ilk, ayna}
      var tablo = new Array(8);
      if (typeof a.yon === 'number') { for (var y = 0; y < 8; y++) tablo[y] = [a.yon, false]; }
      else {
        var yd = a.yon || [0];
        for (var y2 = 0; y2 < 8; y2++) {
          var ilk = yd[y2];
          if (ilk !== undefined && ilk !== null && ilk >= 0) tablo[y2] = [ilk, false];
        }
        var ay = a.ayna || {};
        for (var y3 = 0; y3 < 8; y3++) {
          var kaynak = ay[y3];
          if (Array.isArray(kaynak)) kaynak = kaynak[0];
          if (kaynak !== undefined && kaynak !== null && tablo[kaynak]) tablo[y3] = [tablo[kaynak][0], true];
        }
        for (var y4 = 0; y4 < 8; y4++) {
          if (!tablo[y4]) {
            var m = aynaYon(y4);
            if (tablo[m] && !tablo[m][1]) tablo[y4] = [tablo[m][0], true];
          }
        }
        // hâlâ boşsa en yakın dolu yön
        for (var y5 = 0; y5 < 8; y5++) if (!tablo[y5]) {
          for (var d = 1; d <= 4 && !tablo[y5]; d++) {
            var c1 = tablo[(y5 + d) % 8], c2 = tablo[(y5 + 8 - d) % 8];
            if (c1) tablo[y5] = c1; else if (c2) tablo[y5] = c2;
          }
          if (!tablo[y5]) tablo[y5] = [0, false];
        }
      }
      a._tablo = tablo;
      var ilkK = p.kareler[tablo[0][0]];
      if (ilkK && ilkK[3] > enBoy) enBoy = ilkK[3];
    }
    p.boy = (enBoy || 100) * p.olcek;
    return p;
  }

  var _ytDoku = {};
  function ytDokular(tur) {
    if (_ytDoku[tur]) return _ytDoku[tur];
    var boy = YT_BOY[tur] || 80, gen = Math.round(boy * (tur === 'dev' ? 0.55 : 0.42));
    var g = new PIXI.Graphics();
    g.lineStyle(Math.max(2, boy * 0.03), 0x101010, 1);
    g.beginFill(0xffffff); g.drawEllipse(gen / 2 + 3, boy / 2 + 3, gen / 2, boy / 2); g.endFill();
    g.lineStyle(0); g.beginFill(0x000000, 0.25); g.drawEllipse(gen / 2 + 3, boy * 0.72 + 3, gen * 0.42, boy * 0.22); g.endFill();
    g.beginFill(0xffffff, 0.9); g.drawCircle(gen / 2 + 3, boy * 0.2 + 3, gen * 0.18); g.endFill();
    var govde = app.renderer.generateTexture(g, { resolution: 1 });
    g.destroy();
    var ol = Math.max(22, boy * 0.38), og = Math.max(12, boy * 0.16);
    var o = new PIXI.Graphics();
    o.lineStyle(2, 0x101010, 1); o.beginFill(0xffffff);
    o.moveTo(0, 0); o.lineTo(ol, og / 2); o.lineTo(0, og); o.lineTo(ol * 0.25, og / 2); o.closePath(); o.endFill();
    var ok = app.renderer.generateTexture(o, { resolution: 1 });
    o.destroy();
    var h = 0; for (var i = 0; i < tur.length; i++) h = (h * 31 + tur.charCodeAt(i)) >>> 0;
    var renk = YT_RENK[tur] !== undefined ? YT_RENK[tur] : (((h & 0x7f) + 0x50) << 16 | (((h >> 8) & 0x7f) + 0x50) << 8 | (((h >> 16) & 0x7f) + 0x50));
    return (_ytDoku[tur] = { govde: govde, ok: ok, boy: boy, gen: gen, renk: renk });
  }

  var canliSpritelar = new Set();

  class Kukla extends PIXI.Container {
    constructor(ad, sec) {
      super();
      sec = sec || {};
      this.ad = ad;
      this.paket = paketler[ad] || null;
      this.yerTutucu = !this.paket;
      this.olcek = (sec.olcek || 1) * (this.paket ? this.paket.olcek : 1);
      this.anim = null; this.yon = 0; this.kare = 0; this.bitti = false; this.ayna = false; this.zEk = 0;
      this._t = 0; this._hiz = 1; this._dongu = true; this._bitince = null; this._a = null; this._tint = 0xffffff;
      this.g = new PIXI.Sprite(PIXI.Texture.EMPTY);
      this.addChild(this.g);
      if (this.yerTutucu) {
        var d = ytDokular(ad);
        this._yt = d;
        this.g.texture = d.govde; this.g.anchor.set(0.5, (d.boy + 3) / (d.boy + 6));
        this.g.tint = d.renk; this.g.scale.set(this.olcek);
        this.ok = new PIXI.Sprite(d.ok); this.ok.anchor.set(-0.15, 0.5); this.ok.tint = 0xffe6a0;
        this.ok.scale.set(this.olcek); this.ok.y = -d.boy * 0.12 * this.olcek;
        this.addChild(this.ok);
        this.boy = d.boy * this.olcek;
      } else {
        this.boy = this.paket.boy * (sec.olcek || 1);
      }
      if (!sec.elle) canliSpritelar.add(this);
      var ilk = this.animVar('dur') ? 'dur' : this._ilkAnim();
      if (ilk) this.oynat(ilk, sec.yon || 0);
    }
    _ilkAnim() {
      if (this.yerTutucu) return 'dur';
      for (var k in this.paket.anim) return k;
      return null;
    }
    _animTanim(ad) {
      if (this.yerTutucu) {
        var t = YT_ANIM[ad]; if (!t) return null;
        return { fps: t[0], n: t[1], dongu: t[2] };
      }
      return this.paket.anim[ad] || null;
    }
    animVar(ad) { return !!this._animTanim(ad); }
    oynat(anim, yon, sec) {
      if (this.destroyed) return this;
      var a = this._animTanim(anim);
      if (!a) {
        if (this.yerTutucu) a = { fps: 8, n: 4, dongu: true };       // bilinmeyen anim: yine çalışsın
        else { a = this.paket.anim.dur || this.paket.anim[this._ilkAnim()]; if (!a) return this; }
      }
      if (yon === undefined || yon === null) yon = this.yon;
      yon = ((yon | 0) % 8 + 8) % 8;
      var ayniMi = this.anim === anim && !(sec && sec.bastan);
      this.yon = yon;
      if (sec) {
        if (sec.hiz !== undefined) this._hiz = sec.hiz;
        if (sec.dongu !== undefined) this._dongu = sec.dongu;
        if (sec.bitince !== undefined) this._bitince = sec.bitince;
      }
      if (!ayniMi) {
        this.anim = anim; this._a = a; this._t = 0; this.kare = 0; this.bitti = false;
        this._hiz = sec && sec.hiz !== undefined ? sec.hiz : 1;
        this._dongu = sec && sec.dongu !== undefined ? sec.dongu : a.dongu !== false;
        this._bitince = sec && sec.bitince ? sec.bitince : null;
      }
      this._ciz();
      return this;
    }
    guncelle(dt) {
      var a = this._a; if (!a || this.bitti || this.destroyed || !(dt > 0) || !isFinite(dt)) return;
      var hiz = (typeof this._hiz === 'number' && isFinite(this._hiz) && this._hiz >= 0) ? this._hiz : 1;
      this._t += dt * a.fps * hiz;
      if (!(this._t >= 0 && isFinite(this._t))) this._t = 0;
      var k = this._t | 0;
      if (k >= a.n) {
        if (this._dongu) { this._t -= a.n * Math.floor(this._t / a.n); k = this._t | 0; if (k >= a.n) k = a.n - 1; }
        else {
          k = a.n - 1; this._t = a.n - 0.0001;
          if (this.kare !== k) { this.kare = k; this._ciz(); }
          this.bitti = true;
          var cb = this._bitince; this._bitince = null;
          if (cb) { try { cb(this); } catch (e) { hataKaydet('sprite bitince ' + this.ad, e); } }
          return;
        }
      }
      if (k !== this.kare) { this.kare = k; this._ciz(); }
      else if (this.yerTutucu) this._ciz();
    }
    _ciz() {
      var a = this._a; if (!a || this.destroyed) return;
      if (this.yerTutucu) return this._cizYT();
      var p = this.paket, t = a._tablo && a._tablo[this.yon];
      if (!p || !t) return;
      var idx = t[0] + this.kare, kr = p.kareler[idx];
      if (!kr) return;
      var g = this.g, o = this.olcek;
      g.texture = p.dokular[idx];
      this.ayna = t[1];
      if (t[1]) { g.scale.x = -o; g.x = -kr[4] * o; } else { g.scale.x = o; g.x = kr[4] * o; }
      g.scale.y = o; g.y = kr[5] * o;
    }
    _cizYT() {
      var a = this._a, d = this._yt, g = this.g, ok = this.ok, o = this.olcek;
      var n = a.n || 1, ilerle = Math.min(1, (this._t) / n), an = this.anim;
      var aci = OYUN.yonAci(this.yon), yx = Math.cos(aci);
      g.rotation = 0; g.y = 0; g.scale.set(o, o); ok.alpha = 1;
      ok.rotation = aci; ok.scale.set(o, o);
      var renk = this._tint !== 0xffffff ? this._tint : d.renk;
      if (an === 'yuru') {
        var f = (this._t / n) * IKIPI * 2;
        g.y = -Math.abs(Math.sin(f)) * d.boy * 0.05 * o; g.rotation = Math.sin(f) * 0.07;
      } else if (an === 'dur') {
        g.scale.y = o * (1 + 0.025 * Math.sin(ilerle * IKIPI));
      } else if (an === 'ol') {
        g.rotation = (yx >= 0 ? -1 : 1) * ilerle * PI / 2; ok.alpha = 1 - ilerle; renk = 0x553333;
      } else if (an === 'sersem') {
        renk = (this.kare & 1) ? 0xffffff : 0xff5050; g.rotation = (yx >= 0 ? -1 : 1) * 0.18 * Math.sin(ilerle * PI);
      } else if (an === 'atil') {
        g.scale.y = o * 0.82; g.rotation = (yx >= 0 ? 1 : -1) * 0.35; ok.scale.x = o * 1.6;
      } else if (an === 'kalkan') {
        g.scale.x = o * 1.18; ok.tint = 0xa0c8ff;
      } else if (an === 'kukre') {
        g.scale.set(o * (1 + 0.1 * Math.sin(ilerle * PI * 6)));
      } else {
        // vur, vur2, at, cek, buyu, yerevur, kayaat ...
        var s = Math.sin(ilerle * PI);
        g.rotation = (yx >= 0 ? 1 : -1) * 0.3 * s; ok.scale.x = o * (1 + s * 1.2);
        if (an === 'buyu') renk = 0xc080ff;
      }
      if (an !== 'kalkan') ok.tint = 0xffe6a0;
      g.tint = renk;
    }
    renk(tint) {
      this._tint = (tint === undefined || tint === null) ? 0xffffff : tint;
      if (this.yerTutucu) this._cizYT(); else this.g.tint = this._tint;
      return this;
    }
    sil() {
      canliSpritelar.delete(this);
      this._bitince = null; this._a = null; this.paket = null; this._yt = null;
      if (this.parent) this.parent.removeChild(this);
      if (!this.destroyed) super.destroy({ children: true });
    }
    destroy(o) {
      canliSpritelar.delete(this);
      this._bitince = null; this._a = null; this.paket = null; this._yt = null;
      if (!this.destroyed) super.destroy(o);
    }
  }

  var _ytTekil = null;
  function ytTekilDoku() {
    if (_ytTekil) return _ytTekil;
    var g = new PIXI.Graphics();
    g.lineStyle(3, 0xff00ff, 1); g.beginFill(0x404040); g.drawRect(0, 0, 32, 32); g.endFill();
    g.moveTo(0, 0); g.lineTo(32, 32); g.moveTo(32, 0); g.lineTo(0, 32);
    _ytTekil = app.renderer.generateTexture(g, { resolution: 1 }); g.destroy();
    return _ytTekil;
  }

  var VARLIK = window.VARLIK = {
    paketler: paketler,
    ekle: function (ad, paket) {
      try { paketler[ad] = paketHazirla(ad, paket); } catch (e) { hataKaydet('VARLIK.ekle ' + ad, e); }
    },
    var: function (ad) { return !!paketler[ad]; },
    hazir: function (ad) { var p = paketler[ad]; return !!(p && p.base && p.bases && p.bases.length && p.bases.every(function (b) { return b.valid; })); },
    yerTutucu: function (ad) { return !paketler[ad]; },
    animVar: function (ad, anim) { var p = paketler[ad]; return p ? !!p.anim[anim] : !!YT_ANIM[anim]; },
    sprite: function (ad, sec) { return new Kukla(ad, sec); },
    kare: function (ad, kareAdi) {
      var p = paketler[ad];
      var i = p ? (typeof kareAdi === 'number' ? kareAdi : p.tekil[kareAdi]) : undefined;
      if (!p || i === undefined || !p.kareler[i]) { var d = ytTekilDoku(); return { doku: d, ox: -16, oy: -32, w: 32, h: 32 }; }
      var k = p.kareler[i];
      return { doku: p.dokular[i], ox: k[4], oy: k[5], w: k[2], h: k[3], bilgi: (p.bilgi && typeof kareAdi === 'string' && p.bilgi[kareAdi]) || null };
    },
    doku: function (ad, kareAdi) { return VARLIK.kare(ad, kareAdi).doku; }
  };
  OYUN.Kukla = Kukla;

  // =====================================================================
  // ---------- Döngü ----------
  // =====================================================================
  var _fpsSay = 0, _fpsT = 0, _fps = 0, _cizimSay = 0, _cizim = 0, _sonCizimSay = 0;
  var gl = app.renderer.gl;
  if (gl && gl.drawElements) {
    var _de = gl.drawElements.bind(gl), _da = gl.drawArrays.bind(gl);
    gl.drawElements = function (a, b, c, d) { _cizimSay++; return _de(a, b, c, d); };
    gl.drawArrays = function (a, b, c) { _cizimSay++; return _da(a, b, c); };
  }

  var _animDt = 0;
  function animIlerlet(s) {
    if (s.destroyed) { canliSpritelar.delete(s); return; }
    s.guncelle(_animDt);
  }
  function adimIsle(dtHam) {
    if (_donKalan > 0) { _donKalan -= dtHam; zaman.dt = 0; }
    else {
      var ol = 1;
      if (_yavasKalan > 0) { _yavasKalan -= dtHam; ol = _yavasOlcek; if (_yavasKalan <= 0) _yavasOlcek = 1; }
      zaman.dt = dtHam * ol;
    }
    var dt = zaman.dt;
    if (OYUN.durum === 'mola' || OYUN.durum === 'yukleniyor') { zaman.dt = 0; return; }
    zaman.t += dt;
    if (OYUN.basladi && OYUN.durum === 'oyun') sistemCagir('guncelle', dt);
    if (dt > 0) { _animDt = dt; canliSpritelar.forEach(animIlerlet); }
    if (kamera.hedefY !== null && kamera.hedefY !== undefined && isFinite(kamera.hedefY)) {
      var fark = kamera.hedefY - kamera.y;
      if (Math.abs(fark) < 0.01) kamera.y = kamera.hedefY;
      else kamera.y += fark * (1 - Math.exp(-kamera.yumusak * dtHam));
    }
  }

  function kareIsle(gercekDt, hizC) {
    if (!(gercekDt > 0) || !isFinite(gercekDt)) gercekDt = 1 / 60;
    if (!(hizC > 0) || !isFinite(hizC)) hizC = 1;
    zaman.gercekDt = gercekDt; zaman.gercekT += gercekDt;
    _fpsSay++; _fpsT += gercekDt;
    if (_fpsT >= 0.5) { _fps = _fpsSay / _fpsT; _fpsSay = 0; _fpsT = 0; }
    _cizim = _cizimSay - _sonCizimSay; _sonCizimSay = _cizimSay;

    girdiKare();
    if (OYUN.molaTusu && OYUN.basladi && GIRDI.basildi('esc')) {
      if (OYUN.durum === 'oyun') OYUN.durumYap('mola'); else if (OYUN.durum === 'mola') OYUN.durumYap('oyun');
    }
    var adimSay = Math.max(1, Math.ceil(hizC - 1e-6));
    var dtHam = Math.min(gercekDt, 1 / 30) * hizC / adimSay;
    for (var i = 0; i < adimSay; i++) {
      _altAdim = i > 0;
      adimIsle(dtHam);
    }
    _altAdim = false;
    if (OYUN.basladi) sistemCagir('herKare', gercekDt);

    // kamera uygula + sarsıntı (gerçek zamanla söner; molada titremez)
    var sx = 0, sy = 0;
    if (_sarsKalan > 0 && OYUN.durum !== 'mola') {
      _sarsKalan -= gercekDt;
      if (_sarsKalan <= 0) { _sarsKalan = 0; _sarsGuc = 0; }
      else {
        var g = _sarsGuc * (_sarsKalan / _sarsSure);
        sx = (Math.random() * 2 - 1) * g; sy = (Math.random() * 2 - 1) * g;
      }
    }
    kamera.sx = sx; kamera.sy = sy;
    // aygıt pikseline yuvarla (tam piksele yuvarlamak yavaş kaymada 1 px'lik sıçrama/titreme yapıyordu)
    var _cr = app.renderer.resolution || 1, _z = OYUN.yakinlik;
    gorusGuncelle(OYUN.durum === 'mola' ? 0 : gercekDt);   // çizimden hemen önce: barbarı yumuşakça izle
    kap.scale.set(_z);
    kap.x = Math.round((gorunum.x0 - gorus.sol * _z + sx) * _cr) / _cr; kap.y = Math.round((gorunum.y0 - gorus.ust * _z + sy) * _cr) / _cr;
    fareDunya();

    // varlik katmanı y sıralaması
    var ch = K.varlik.children;
    for (var j = 0; j < ch.length; j++) { var c = ch[j]; c.zIndex = (c.y || 0) + (c.zEk || 0); }
  }

  app.ticker.add(function () {
    boyutDenetle();
    kameraEkraniniDenetle();
    var gdt = app.ticker.deltaMS / 1000;
    if (gdt > 0.25) gdt = 0.25;
    try { kareIsle(gdt, OYUN.hiz); } catch (e) { hataKaydet('dongu', e); }
  });

  OYUN.adim = function (sn, kareDt) { // test: kareDt (sn ya da fonksiyon) verilirse dalgalı kare süresi taklit edilir
    sn = sn || 0; var n = Math.max(1, Math.round(sn * 60)), i;
    if (!kareDt) { for (i = 0; i < n; i++) { try { kareIsle(1 / 60, 1); } catch (e) { hataKaydet('adim', e); } if (OYUN.adimKanca) OYUN.adimKanca(1 / 60); } }
    else {
      for (var top = 0, j = 0; top < sn - 1e-9 && j < 100000; j++) {
        var d = typeof kareDt === 'function' ? kareDt(j) : kareDt; top += d;
        try { kareIsle(d, 1); } catch (e) { hataKaydet('adim', e); }
        if (OYUN.adimKanca) OYUN.adimKanca(d);
      }
    }
    app.render();
    return OYUN.bilgi();
  };

  // Resim sayfalarını ekran kartına ÖNCEDEN yükle (başlıkta, her seferinde bir sayfa): yoksa büyük bir sayfa
  // oyunun ortasında ilk kullanıldığı karede yüklenir ve o kare takılır (düşman/dev ilk göründüğünde).
  // Yalnız ortak paketler ve aktif OYUN.bolum'un paketleri yüklenir.
  var _onZ = null, onYuklemeTemizle = null;
  function onYuklemeyiDurdur() {
    if (_onZ) { clearInterval(_onZ); _onZ = null; }
    if (onYuklemeTemizle) { onYuklemeTemizle(); onYuklemeTemizle = null; }
  }
  function onYuklemeBaslat() {
    try {
      onYuklemeyiDurdur();
      var _onDur = OYUN.onYukleme = { toplam: 0, biten: 0, bitti: false }, _onSay = 0;
      // Yalnız bir büyük sayfanın piksel belleğini elde tut ve bölüm değişiminde bırak.
      var hazirlanan = null, iptal = false;
      onYuklemeTemizle = function () {
        iptal = true;
        if (hazirlanan && hazirlanan.bitmap) hazirlanan.bitmap.close();
        hazirlanan = null;
      };
      function resmiIsle(bt) {
        var kaynak = bt.resource;
        var durum = hazirlanan = { taban: bt, bitti: false, bitmap: null };
        fetch(kaynak.source.src).then(function (yanit) { return yanit.blob(); }).then(function (blob) {
          return createImageBitmap(blob, { premultiplyAlpha: bt.alphaMode === PIXI.ALPHA_MODES.UNPACK ? 'premultiply' : 'none' });
        }).then(function (bitmap) {
          if (iptal) bitmap.close();
          else durum.bitmap = bitmap;
        }, function () {
          // ImageBitmap desteklenmezse var olan HTMLImageElement yüklemesi devam eder.
        }).then(function () { durum.bitti = true; });
      }
      for (var ad0 in paketler) {
        if (!aktifPaketMi(ad0)) continue;
        var bs0 = paketler[ad0].bases || [];
        for (var j = 0; j < bs0.length; j++) {
          var bt0 = bs0[j]; if (!bt0) continue;
          _onDur.toplam++;
          if (bt0._bdOnYuk) _onDur.biten++;
        }
      }
      _onZ = setInterval(function () {
        var kalan = false, yapildi = false, _top = 0, _bit = 0;
        try {
          for (var ad in paketler) {
            if (!aktifPaketMi(ad)) continue;
            var bs = paketler[ad].bases || [];
            for (var i = 0; i < bs.length; i++) {
              var bt = bs[i]; if (!bt) continue; _top++; if (bt._bdOnYuk) { _bit++; continue; }
              if (!bt.valid) { kalan = true; continue; }
              if (yapildi || (hazirlanan && (hazirlanan.taban !== bt || !hazirlanan.bitti))) {
                kalan = true; continue;
              }
              var kaynak = bt.resource;
              if (!hazirlanan && typeof createImageBitmap === 'function' && bt.width >= 2048 &&
                  kaynak instanceof PIXI.ImageResource && !kaynak.createBitmap && kaynak.source.src.startsWith('data:') &&
                  !Object.keys(bt._glTextures).length) {
                resmiIsle(bt); kalan = true; continue;
              }
              var bitmap = hazirlanan && hazirlanan.bitmap;
              try {
                if (bitmap) { kaynak.createBitmap = true; kaynak.bitmap = bitmap; }
                if (app.renderer && app.renderer.texture && app.renderer.texture.bind) app.renderer.texture.bind(bt);
                bt._bdOnYuk = true; yapildi = true;
              } finally {
                if (bitmap) {
                  if (kaynak.bitmap === bitmap) { bitmap.close(); kaynak.bitmap = null; }
                  kaynak.createBitmap = false;
                }
                hazirlanan = null;
              }
            }
          }
        } catch (e) { hataKaydet('onYukleme', e); kalan = false; }
        _onDur.toplam = _top; _onDur.biten = _bit + (yapildi ? 1 : 0);
        if ((!kalan && !yapildi) || ++_onSay > 1500) {
          onYuklemeyiDurdur();
          _onDur.bitti = true; _onDur.biten = _onDur.toplam;
        }
      }, 12);
    } catch (e) {}
  }

  OYUN.bolumYukle = function (no) {
    no = bolumNo(no);
    for (var ad in paketler) {
      if (aktifPaketMi(ad, no)) continue;
      var p = paketler[ad];
      if (!p || !p.bases) continue;
      for (var j = 0; j < p.bases.length; j++) {
        var bt = p.bases[j];
        if (!bt) continue;
        bt._bdOnYuk = false;
        if (bt.resource && bt._glTextures) {
          try { bt.dispose(); } catch (e) { hataKaydet('bolumYukle.dispose', e); }
        }
      }
    }
    OYUN.bolum = no;
    OLAY.emit('bolum', no);
    onYuklemeBaslat();
  };

  var bolumDosyaIstekleri = Object.create(null);
  function bolumDosyasiYukle(ad) {
    if (paketler[ad]) return Promise.resolve();
    if (bolumDosyaIstekleri[ad]) return bolumDosyaIstekleri[ad];
    var istek = new Promise(function (tamam, hata) {
      var dosya = document.createElement('script');
      dosya.src = 'varlik/' + ad + '.js';
      function yuklenemedi() {
        dosya.remove();
        hata(new Error(ad + ' grafik paketi yüklenemedi'));
      }
      dosya.onload = function () { if (paketler[ad]) tamam(); else yuklenemedi(); };
      dosya.onerror = yuklenemedi;
      document.head.appendChild(dosya);
    });
    bolumDosyaIstekleri[ad] = istek.catch(function (e) { delete bolumDosyaIstekleri[ad]; throw e; });
    return bolumDosyaIstekleri[ad];
  }

  function sonrakiKare() { return new Promise(function (bitir) { requestAnimationFrame(bitir); }); }

  OYUN.bolumGec = async function (no) {
    if (OYUN.durum === 'yukleniyor') return;
    no = bolumNo(no);
    var eksikDosyalar = BOLUM_PAKET[no].filter(function (ad) { return !paketler[ad]; });
    var gecis = OYUN.bolumGecis = {
      bolum: no, dosyalar: { toplam: eksikDosyalar.length, biten: 0 }, yukleme: null, zemin: false
    };
    OYUN.bolumYuklemeHatasi = false;
    OYUN.durumYap('yukleniyor');
    kap.visible = false;
    try {
      // Paint the overlay before texture disposal or allocation can block a frame.
      await sonrakiKare();
      await sonrakiKare();
      onYuklemeyiDurdur();
      await Promise.all(eksikDosyalar.map(function (ad) {
        return bolumDosyasiYukle(ad).then(function () { gecis.dosyalar.biten++; });
      }));
      OYUN.bolumYukle(no);
      gecis.yukleme = OYUN.onYukleme;
      while (gecis.yukleme && !gecis.yukleme.bitti) await sonrakiKare();

      kosuyuSifirla();
      OYUN.gorusOtur();
      kap.visible = true;
      gecis.zemin = true;
      var sinir = performance.now() + 2400;
      do { await sonrakiKare(); }
      while (window.BOLUM && !BOLUM.girisHazir() && performance.now() < sinir);
      await sonrakiKare();
      GIRDI.temizle();
      OYUN.durumYap('oyun');
    } catch (e) {
      hataKaydet('bolumGec', e);
      OYUN.bolumYuklemeHatasi = true;
      if (OYUN.bolum === 1 && !OYUN.onYukleme?.bitti) onYuklemeBaslat();
      OYUN.durumYap('baslik');
    } finally {
      kap.visible = true;
      OYUN.bolumGecis = null;
    }
  };

  OYUN.basla = function () {
    if (OYUN.basladi) return;
    OYUN.basladi = true;
    // 5. tur (yönetici): Pixi, ~1 dakika çizilmeyen resim sayfasını ekran kartından ATIYORDU; sayfa yeniden gerekince
    // (uzun süredir görünmeyen düşman, ölüm karesi…) 4096 px'lik sayfa 130–160 ms'de baştan yükleniyor ve kare takılıyordu.
    // Kapalı: sayfalar bir kez yüklenir, hep kalır. (Bölüm zemini gibi geçici dokular zaten elle siliniyor.)
    try { app.renderer.textureGC.mode = PIXI.GC_MODES.MANUAL; } catch (e) {}
    sistemCagir('baslat');
    var ilkBolum = bolumNo(Number(param('bolum')));
    if (OYUN.atla && ilkBolum > 1) { OYUN.bolumGec(ilkBolum); return; }
    OYUN.durumYap(OYUN.atla ? 'oyun' : 'baslik');
    onYuklemeBaslat();
  };

  function kosuyuSifirla() {
    OYUN.tohumla(OYUN.tohum);
    _donKalan = 0; _yavasKalan = 0; _yavasOlcek = 1; _sarsKalan = 0; _sarsGuc = 0; _sarsSure = 0;
    kamera.hedefY = null; kamera.sx = 0; kamera.sy = 0; zaman.t = 0;
    _gOtur = true;
    GIRDI.temizle();
    sistemCagir('sifirla');
  }
  OYUN.yenidenBasla = function () {
    kosuyuSifirla();
    var once = OYUN.durum;
    OYUN.durum = '';  // 'oyun' olayı her zaman gitsin
    OYUN.durumYap('oyun');
    OYUN.oncekiDurum = once;
  };

  OYUN.bilgi = function () {
    var D = window.DUSMAN, M = window.MERMI, B = window.BOLUM, O = window.OYUNCU;
    return {
      durum: OYUN.durum,
      bolum: OYUN.bolum,
      fps: Math.round(_fps * 10) / 10,
      'kare/sn': Math.round(_fps * 10) / 10,
      dusman: D && D.liste ? D.liste.length : null,
      mermi: M && M.liste ? M.liste.length : null,
      ilerleme: B && B.ilerleme !== undefined ? Math.round(B.ilerleme * 1000) / 1000 : null,
      can: O && O.can !== undefined ? Math.round(O.can) : null,
      cizim: _cizim,
      sprite: canliSpritelar.size,
      varlikSayisi: K.varlik.children.length,
      t: Math.round(zaman.t * 100) / 100,
      kameraY: Math.round(kamera.y),
      gorus: { sol: Math.round(gorus.sol), ust: Math.round(gorus.ust), w: Math.round(gorus.w), h: Math.round(gorus.h) }, yakinlik: OYUN.yakinlik,
      cozunurluk: app.renderer.resolution,
      sistemler: sistemler.map(function (s) { return s.ad; }),
      hatalar: OYUN.hatalar.slice(-5)
    };
  };

  window.addEventListener('error', function (e) { if (OYUN.hatalar.length < 50) OYUN.hatalar.push('pencere: ' + (e.message || e) + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno); });
})();
