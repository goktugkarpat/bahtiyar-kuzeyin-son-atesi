// Zemin: yönlü siluet gölgeleri, yumuşak temas ve meşale sekme ışığı.
// Gölgeler katman.golge'de (bütün karakterlerin ALTINDA): devin gölgesi barbarın üstüne binmez.
// Meşale zemin sekmesi gölgelerin de ALTINDA çizilir: barbarı/düşmanı soldurmaz, hale oluşturmaz; gölgeler sıcak zemine oturur.
// Barbarın temas gölgesi en son çizilir (devin geniş gölgesinin içinde bile ayağının altı net okunur).
(function () {
  'use strict';
  var HAVUZ = 128, golgeler = [], doku = null, temasDoku = null, kap = null, temas = null;
  var DEKOR_HAVUZ = 48, dekorGolge = [], dekorKap = null;
  var dekorIzleri = [], canliIzleri = [];
  var ISIK_HAVUZ = 24, bounceIsik = [], bounceKap = null, isikDoku = null;
  var kuleZeminIsigi, ayazYansimalari = [];
  var devOrtamGolge = null, vargorOrtamGolge = null, devOrtamDoku = null;
  var zaman = 0, vargorAlfa = 1;
  var _ozelSpr = [];
  // Üst soldaki gök ışığı (köy ve hisar) ve sağ alttaki kızıl ocak ışığı.
  var GOLGE_YON = [
    { x: 0.45, y: 0.24, renk: 0x222934, dekor: 0.36, canli: 0.37 },
    { x: -0.36, y: -0.20, renk: 0x33201e, dekor: 0.40, canli: 0.38 },
    { x: 0.35, y: 0.22, renk: 0x26394b, dekor: 0.30, canli: 0.32 }
  ];
  GOLGE_YON.forEach(function (yon) {
    yon.egim = Math.atan2(-yon.x, -yon.y);
    yon.uzunluk = Math.hypot(yon.x, yon.y);
  });
  var GEN = {
    goblin: 34, okcu: 46, kalkanli: 58, saman: 44, yakici: 46,
    baskinci: 48, infazci: 68, dev: 190, vargor: 145,
    totem: 88, varil: 74, oyuncu: 55
  }; // oyuncu 50 → 55: barbar %10 iri (19 Kasım)
  var AYAR = {
    devSaydam: 0.85,     // dev barbarı örterken hafif ve temiz saydamlaşma (hayalet/çamur olmadan silueti destekler)
    vargorSaydam: 0.78,  // Vargor barbarı örterken temiz saydamlaşma
    devGecis: 8,         // saydamlaşma hızı (1/sn)
    temasAlfa: 0.74,     // barbarın ağırlığını ayağın altında tutan temas gölgesi
    dekorAlfa: 0.52,     // yapı/ağaç/kaya/arabaların taban izi
    mesaleSekme: 0.11    // meşale/ateşlerin zeminde bıraktığı sıcak sekme ışığı (barbarı soldurmaz)
  };
  function ekleAlt(ust, cocuk) {
    if (typeof ust.addChildAt === 'function') ust.addChildAt(cocuk, 0);
    else ust.addChild(cocuk);
  }
  // YAKINLIK (19 Kasım): ekranda GÖRÜNEN DÜNYA dikdörtgeni (cekirdek.js OYUN.gorus + sarsıntı); yoksa eski tam ekran hesabı. Tek nesne.
  var _gd = { x: 0, y: 0, w: 1280, h: 720 };
  function gorD() {
    var g = OYUN.gorus, k = OYUN.kamera || {}, sx = k.sx || 0, sy = k.sy || 0;
    if (g && isFinite(g.sol) && isFinite(g.ust) && g.w > 0) { _gd.x = g.sol - sx; _gd.y = g.ust - sy; _gd.w = g.w; _gd.h = g.h; return _gd; }
    var G = OYUN.gorunum || { x0: 0, y0: 0, w: OYUN.W || 1280, h: OYUN.H || 720 };
    _gd.x = (k.x || 0) + G.x0 - sx; _gd.y = (k.y || 0) + G.y0 - sy; _gd.w = G.w; _gd.h = G.h; return _gd;
  }
  function goruntuAl(o) {
    if (!o) return null;
    return o.sprite || o.kap || o.s || o.g || (o.d && o.d.s) || null;
  }
  function ozelSprTopla() {
    _ozelSpr.length = 0;
    var B = window.BOLUM, V = window.VARGOR, i, s;
    if (B && Array.isArray(B.variller)) {
      for (i = 0; i < B.variller.length; i++) {
        var vr = B.variller[i];
        if (!vr) continue;
        s = vr.sprite || vr.s || (vr.d && vr.d.s);
        if (s) _ozelSpr.push(s);
      }
    }
    if (V && Array.isArray(V.totemler)) {
      for (i = 0; i < V.totemler.length; i++) {
        var tm = V.totemler[i];
        if (!tm) continue;
        if (tm.sprite) _ozelSpr.push(tm.sprite);
        if (tm.kap) _ozelSpr.push(tm.kap);
      }
    }
  }
  function ortuSaydamGuncelle(spr, x, y, oy, boy, eni, tabanAlfa, dt) {
    if (!spr || typeof spr.alpha !== 'number') return false;
    var dyo = y - OYUNCU.y;
    var ortulu = oy && spr.visible && dyo > 6 && dyo < boy * 0.8 && Math.abs(x - OYUNCU.x) < eni;
    var hdf = ortulu ? tabanAlfa : 1;
    if (Math.abs(spr.alpha - hdf) > 0.01) spr.alpha += (hdf - spr.alpha) * Math.min(1, dt * 10);
    return ortulu;
  }
  // Sprite'ın mevcut atlas karesini zemine yatırır. Yeni doku, filtre ve yeniden çizim yok.
  function izduser(hedef, resim, x, y, sx, sy, yon, alfa) {
    if (hedef.texture !== resim.texture) hedef.texture = resim.texture;
    hedef.anchor.copyFrom(resim.anchor);
    hedef.position.set(x, y);
    hedef.scale.set(sx, sy * yon.uzunluk);
    hedef.skew.x = yon.egim;
    hedef.tint = yon.renk;
    hedef.alpha = alfa;
    hedef.visible = true;
  }
  function kalanIzleriGizle(havuz, n) {
    for (; n < havuz.length; n++) havuz[n].visible = false;
  }
  function dekorGolgeleri(V, yon) {
    var ch = OYUN.katman.varlik.children, n = 0, x1 = V.x + V.w, y1 = V.y + V.h;
    ozelSprTopla();
    for (var i = 0; i < ch.length && n < DEKOR_HAVUZ; i++) {
      var c = ch[i];
      if (!c.golgeTaban || !c.visible || c.alpha <= 0 || _ozelSpr.indexOf(c) >= 0) continue;
      var w = Math.abs(c.texture.width * c.scale.x), h = Math.abs(c.texture.height * c.scale.y);
      var dx = h * yon.x, dy = h * yon.y;
      if (c.x + w + Math.max(0, dx) < V.x || c.x - w + Math.min(0, dx) > x1 ||
          c.y + 42 + Math.max(0, dy) < V.y || c.y - 52 + Math.min(0, dy) > y1) continue;
      // Yıkıntı ve kaya kısa, kule ve ağaç uzun bir iz bırakır. Taban ise gerçek temas ölçülerini izler.
      izduser(dekorIzleri[n], c, c.x, c.y, c.scale.x, c.scale.y, yon, yon.dekor * c.alpha);
      var s = dekorGolge[n++], taban = c.golgeTaban;
      s.position.set(c.x, c.y - Math.min(12, taban[1] * 0.23));
      s.width = Math.max(14, Math.min(w * 1.16, taban[0] * 1.2));
      s.height = Math.max(10, Math.min(108, taban[1] * 1.22));
      s.tint = yon.renk; s.alpha = AYAR.dekorAlfa * c.alpha; s.visible = true;
    }
    kalanIzleriGizle(dekorGolge, n);
    kalanIzleriGizle(dekorIzleri, n);
  }

  // Altı yumuşakça zemine karışan tek temas dokusu. Bölüme göre gölge rengini sprite verir.
  function dokuYap(yogun) {
    var c = document.createElement('canvas'); c.width = 128; c.height = 64;
    var g = c.getContext('2d');
    g.translate(64, 32); g.scale(1, 0.5);
    var gr = g.createRadialGradient(0, 0, 4, 0, 0, 62);
    gr.addColorStop(0, yogun ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.81)');
    gr.addColorStop(0.46, yogun ? 'rgba(255,255,255,.78)' : 'rgba(255,255,255,.59)');
    gr.addColorStop(0.75, 'rgba(255,255,255,.26)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(-64, -64, 128, 128);
    return PIXI.Texture.from(c);
  }
  // Dev için geniş atmosferik zemin gölgesi (temas gölgesinin altında, ağırlık ve derinlik verir)
  function ortamGolgeDokuYap() {
    var c = document.createElement('canvas'); c.width = 128; c.height = 64;
    var g = c.getContext('2d');
    g.save();
    g.translate(64, 32);
    g.scale(1, 0.5);
    var gr = g.createRadialGradient(0, 0, 6, 0, 0, 62);
    gr.addColorStop(0, 'rgba(6,5,12,0.42)');
    gr.addColorStop(0.55, 'rgba(6,5,12,0.18)');
    gr.addColorStop(1, 'rgba(6,5,12,0)');
    g.fillStyle = gr;
    g.beginPath(); g.arc(0, 0, 62, 0, Math.PI * 2); g.fill();
    g.restore();
    return PIXI.Texture.from(c);
  }
  // Zemin meşale/ateş sekme ışığı dokusu (eğik bakış için yatay elips)
  function isikDokuYap() {
    var c = document.createElement('canvas'); c.width = 128; c.height = 64;
    var g = c.getContext('2d');
    g.save();
    g.translate(64, 32);
    g.scale(1, 0.5);
    var gr = g.createRadialGradient(0, 0, 2, 0, 0, 62);
    gr.addColorStop(0, 'rgba(255,215,150,0.95)');
    gr.addColorStop(0.35, 'rgba(255,145,58,0.5)');
    gr.addColorStop(0.7, 'rgba(255,88,24,0.16)');
    gr.addColorStop(1, 'rgba(255,55,10,0)');
    g.fillStyle = gr;
    g.beginPath(); g.arc(0, 0, 62, 0, Math.PI * 2); g.fill();
    g.restore();
    return PIXI.Texture.from(c);
  }
  function yumusak(kenar, x) {
    var t = Math.max(0, Math.min(1, x / kenar));
    return t * t * (3 - 2 * t);
  }
  function kur() {
    if (kap) return;
    doku = dokuYap(false); temasDoku = dokuYap(true);
    isikDoku = isikDokuYap(); devOrtamDoku = ortamGolgeDokuYap();
    bounceKap = new PIXI.Container();
    var addMode = (PIXI.BLEND_MODES && PIXI.BLEND_MODES.ADD) || 1;
    for (var b = 0; b < ISIK_HAVUZ; b++) {
      var bs = new PIXI.Sprite(isikDoku);
      bs.anchor.set(0.5); bs.visible = false; bs.blendMode = addMode;
      bounceKap.addChild(bs); bounceIsik.push(bs);
    }
    var lamba = document.createElement('canvas'); lamba.width = lamba.height = 128;
    var fg = lamba.getContext('2d'), sicak = fg.createRadialGradient(64, 64, 2, 64, 64, 63);
    sicak.addColorStop(0, 'rgba(255,162,83,.94)');
    sicak.addColorStop(.34, 'rgba(241,111,46,.70)');
    sicak.addColorStop(.72, 'rgba(199,67,24,.24)');
    sicak.addColorStop(1, 'rgba(207,77,31,0)');
    fg.fillStyle = sicak; fg.fillRect(0, 0, 128, 128);
    kuleZeminIsigi = new PIXI.Sprite(PIXI.Texture.from(lamba));
    kuleZeminIsigi.name = 'ayaz_kule_zemin_isigi';
    kuleZeminIsigi.anchor.set(.5); kuleZeminIsigi.visible = false;
    bounceKap.addChild(kuleZeminIsigi);
    dekorKap = new PIXI.Container();
    kap = new PIXI.Container();
    OYUN.katman.golge.addChild(dekorKap);   // yapı/ağaç/kaya temas gölgeleri: karakter gölgelerinin ALTINDA
    ekleAlt(OYUN.katman.golge, bounceKap);  // meşale zemin sekme ışığı: tüm gölgelerin de ALTINDA (karakterleri soldurmaz)
    for (var j = 0; j < DEKOR_HAVUZ; j++) {
      var di = new PIXI.Sprite(); di.visible = false;
      dekorKap.addChild(di); dekorIzleri.push(di);
    }
    for (var j = 0; j < DEKOR_HAVUZ; j++) { var dg = new PIXI.Sprite(doku); dg.anchor.set(0.5); dg.visible = false; dekorKap.addChild(dg); dekorGolge.push(dg); }
    OYUN.katman.golge.addChild(kap);
    devOrtamGolge = new PIXI.Sprite(devOrtamDoku); devOrtamGolge.anchor.set(0.5); devOrtamGolge.visible = false;
    kap.addChild(devOrtamGolge);
    vargorOrtamGolge = new PIXI.Sprite(devOrtamDoku); vargorOrtamGolge.anchor.set(0.5); vargorOrtamGolge.visible = false;
    kap.addChild(vargorOrtamGolge);
    for (var k = 0; k < HAVUZ; k++) {
      var ci = new PIXI.Sprite(); ci.visible = false;
      kap.addChild(ci); canliIzleri.push(ci);
    }
    for (var i = 0; i < HAVUZ; i++) { var s = new PIXI.Sprite(doku); s.anchor.set(0.5); s.visible = false; kap.addChild(s); golgeler.push(s); }
    temas = new PIXI.Sprite(temasDoku); temas.anchor.set(0.5); temas.visible = false; kap.addChild(temas);   // en üstte
  }
  function mesaleSekmeleri() {
    var at = window.BOLUM && BOLUM.atesler;
    if (!at || !at.length || AYAR.mesaleSekme <= 0) {
      for (var k = 0; k < ISIK_HAVUZ; k++) bounceIsik[k].visible = false;
      return;
    }
    var V = gorD(), ky = V.y, Hh = V.h, n = 0;   // görünen dünya (yakınlık + görüş kayması; tam ekran şeritleri dahil)
    var ayaz = OYUN.bolum === 3, volkan = OYUN.bolum === 2;
    // Aynı ışık havuzu: köyde ıslak taş genişçe yansıtır, ocakta ışık zemine daha yakın kalır.
    var en = ayaz ? 1 : volkan ? 1.98 : 2.20, boy = ayaz ? .46 : volkan ? .98 : .87;
    var guc = ayaz ? 1 : volkan ? 3.50 : 4.20, tavan = ayaz ? .22 : volkan ? .44 : .53;
    for (var i = 0; i < at.length && n < ISIK_HAVUZ; i++) {
      var f = at[i];
      if (!f || f.y < ky - 220 || f.y > ky + Hh + 220 || f.x < V.x - 260 || f.x > V.x + V.w + 260) continue;
      var s = bounceIsik[n++];
      var tit = 1 + Math.sin(zaman * 5.3 + i * 1.7) * 0.08 + Math.sin(zaman * 11.1 + i * 3.1) * 0.04;
      var g = (f.guc || 1) * tit;
      var cap = (150 + (f.h || 30) * 1.8) * Math.sqrt(Math.max(0.4, f.guc || 1));
      s.visible = true;
      s.x = ayaz ? f.x : f.agizX ?? f.x;
      s.y = f.y + 6;
      s.width = cap * en * tit;
      s.height = cap * boy * tit;
      s.tint = ayaz ? (f.tur === 'mesale' ? 0xff9442 : 0xff7629) : (volkan ? 0xffad78 : 0xffdfb1);
      s.alpha = Math.min(tavan, AYAR.mesaleSekme * g * guc);
    }
    for (; n < ISIK_HAVUZ; n++) bounceIsik[n].visible = false;
  }
  function ayazKarakterIsigi(indeks, actor, lamba) {
    var katman = actor && actor.sprite, taban = katman && katman.g;
    var yansima = ayazYansimalari[indeks];
    var alan = actor && (1 - yumusak(245, actor.y - 620));
    if (!lamba || !alan || !taban || !taban.visible || katman.yerTutucu || !taban.parent || actor.canli === false) {
      if (yansima && !yansima.destroyed) yansima.visible = false;
      return;
    }
    if (!yansima || yansima.destroyed) {
      yansima = ayazYansimalari[indeks] = new PIXI.Sprite();
      yansima.name = 'ayaz_karakter_isigi';
      yansima.blendMode = PIXI.BLEND_MODES.ADD;
    }
    if (yansima.parent !== taban.parent) taban.parent.addChildAt(yansima, taban.parent.getChildIndex(taban) + 1);
    // Aynı sprite karesinin silueti içinde kalır; zemin veya HUD aydınlanmaz.
    if (yansima.texture !== taban.texture) yansima.texture = taban.texture;
    yansima.position.copyFrom(taban.position); yansima.scale.copyFrom(taban.scale);
    yansima.anchor.copyFrom(taban.anchor); yansima.rotation = taban.rotation;
    var uzaklik = Math.hypot(actor.x - (lamba.x - 45), (actor.y - lamba.y + 42) * 1.32);
    var ates = (1 - yumusak(550, uzaklik)) * Math.min(1, lamba.guc / 1.55);
    var ay = .255 * (1 - .82 * ates);
    var kor = .57 * ates * (1 + .035 * Math.sin(zaman * 9));
    var guc = ay + kor, oran = kor / guc;
    var r = Math.round(89 + 166 * oran), g = Math.round(156 - 12 * oran), b = Math.round(255 - 193 * oran);
    yansima.tint = (r << 16) | (g << 8) | b;
    yansima.alpha = guc * alan * taban.alpha;
    yansima.visible = true;
  }
  function ayazArenaIsigi(V) {
    var lamba = OYUN.bolum === 3 && V.y < 850 && window.AYAZ && AYAZ.kuleIsigi();
    kuleZeminIsigi.visible = !!lamba;
    if (lamba) {
      kuleZeminIsigi.position.set(lamba.x - 119, lamba.y - 55);
      kuleZeminIsigi.width = 740; kuleZeminIsigi.height = 510;
      kuleZeminIsigi.alpha = .76 * Math.min(1, lamba.guc / 1.55);
    }
    ayazKarakterIsigi(0, window.OYUNCU, lamba);
    ayazKarakterIsigi(1, window.SKARN, lamba);
  }
  function koy(n, x, y, gen, alfa, yon) {
    var s = golgeler[n]; if (!s) return;
    s.position.set(x, y + 2);
    s.width = gen * 1.24; s.height = gen * 0.57;
    s.tint = yon.renk; s.alpha = alfa; s.visible = true;
  }
  function canliIz(n, spr, x, y, V, yon, alfa) {
    if (!spr || !spr.visible || n >= HAVUZ || alfa <= 0 ||
        x < V.x - 180 || x > V.x + V.w + 180 ||
        y < V.y - 130 || y > V.y + V.h + 130) return n;
    var g = spr.g || spr;
    // Yedek modeller ve çok parçalı kurt kuklası temas dokusu ile zemine oturur.
    if (spr.yerTutucu || spr.kurtRig || !g.visible || !g.anchor || g.texture === PIXI.Texture.EMPTY) return n;
    var sx = g.scale.x, sy = g.scale.y;
    if (g !== spr) {
      sx *= spr.scale.x; sy *= spr.scale.y;
      var asagi = g.y * spr.scale.y;
      x += g.x * spr.scale.x - asagi * yon.x;
      y -= asagi * yon.y;
    }
    izduser(canliIzleri[n], g, x, y, sx, sy, yon, yon.canli * alfa);
    return n + 1;
  }
  function bossOrtuOrtam(boss, spr, ortam, w, h, alfa, dxLim, dyLim, saydam, oy, saklananAlfa, dt) {
    var canli = !!(boss && boss.can > 0 && !boss.olu && (boss !== window.VARGOR || boss.aktif));
    var aGor = (spr && typeof spr.alpha === 'number') ? spr.alpha : 1;
    if (saklananAlfa !== null && saklananAlfa < aGor) aGor = saklananAlfa;
    if (ortam) {
      if (canli && spr && spr.visible) {
        ortam.visible = true;
        ortam.x = boss.x; ortam.y = boss.y + 4;
        ortam.width = w; ortam.height = h;
        ortam.alpha = alfa * aGor;
      } else {
        ortam.visible = false;
      }
    }
    var ortu = 0;
    if (spr && window.OYUNCU) {
      if (canli && oy) {
        var dx = Math.abs(OYUNCU.x - boss.x), dy = boss.y - OYUNCU.y;
        if (dy > 0 && dy < dyLim && dx < dxLim) {
          var ox = yumusak(dxLim * 0.38, dxLim - dx);
          var oyU = yumusak(36, dy) * yumusak(60, dyLim - dy);
          ortu = ox * oyU;
        }
      }
      var hedef = 1 - (1 - saydam) * ortu;
      var k = 1 - Math.exp(-AYAR.devGecis * dt);
      if (saklananAlfa !== null) {
        saklananAlfa += (hedef - saklananAlfa) * k;
        if (Math.abs(saklananAlfa - hedef) < 0.002) saklananAlfa = hedef;
        if (canli && spr.visible) spr.alpha = Math.min(spr.alpha, saklananAlfa);
      } else {
        spr.alpha += (hedef - spr.alpha) * k;
        if (Math.abs(spr.alpha - hedef) < 0.002) spr.alpha = hedef;
      }
    }
    return { ortu: ortu, alfa: saklananAlfa };
  }
  function herKare(gd) {
    if (!kap) return;
    var dt = Math.min(0.1, gd || 0.016);
    zaman += dt;
    var V = gorD(), yon = GOLGE_YON[OYUN.bolum - 1] || GOLGE_YON[0];
    try { mesaleSekmeleri(); } catch (e) {}
    ayazArenaIsigi(V);
    dekorGolgeleri(V, yon);
    var n = 0, iz = 0, i, d, L;
    var oy = window.OYUNCU && OYUNCU.canli !== false && typeof OYUNCU.x === 'number';
    var vr = window.VARGOR;
    L = (window.DUSMAN && DUSMAN.liste) || [];
    for (i = 0; i < L.length && n < HAVUZ - 1; i++) {
      d = L[i]; if (!d || d.olu) continue;
      var vargorMu = d === vr || d.ad === 'VARGOR' || d.tur === 'vargor';
      var dGor = vargorMu ? goruntuAl(d) : d.sprite;
      var sa = (dGor && typeof dGor.alpha === 'number') ? dGor.alpha : 1;
      if (vargorMu && vargorAlfa < sa) sa = vargorAlfa;
      var gen = vargorMu ? GEN.vargor : (GEN[d.tur] || (d.r ? d.r * 2.2 : 44));
      if (d.tur === 'kircil_kurt' && d.kurt) sa *= d.kurt.alfa;
      iz = canliIz(iz, dGor, d.x, d.y, V, yon, sa);
      var ayak = dGor && dGor.temas;
      if (ayak) {
        var ax = dGor.x + ayak.x, ay = dGor.y + ayak.y;
        koy(n++, d.x + ayak.x * .31, d.y + ayak.y * .31, gen * .92, .67 * sa, yon);
        if (n < HAVUZ - 1) koy(n++, ax, ay - 2, Math.min(d.tur === 'skarn' ? 30 : 23, gen * .33), (d.tur === 'skarn' ? .61 : .48) * sa, yon);
      } else koy(n++, d.x, d.y, gen, .80 * sa, yon);
    }
    if (vr && vr.aktif && !vr.olu && isFinite(vr.x) && isFinite(vr.y) && L.indexOf(vr) < 0 && n < HAVUZ - 1) {
      var vg = goruntuAl(vr);
      var va = (vg && typeof vg.alpha === 'number') ? vg.alpha : 1;
      var vaGolge = Math.min(va, vargorAlfa);
      koy(n++, vr.x, vr.y, GEN.vargor, 0.8 * vaGolge, yon);
      iz = canliIz(iz, vg, vr.x, vr.y, V, yon, vaGolge);
    }
    var tmL = vr && vr.aktif && !vr.olu && Array.isArray(vr.totemler) ? vr.totemler : null;
    if (tmL) {
      for (i = 0; i < tmL.length; i++) {
        var tm = tmL[i];
        if (!tm || !isFinite(tm.x) || !isFinite(tm.y)) continue;
        var tmCanli = tm.aktif !== false && !tm.olu && !tm.kirik && !tm.kirildi && !(typeof tm.can === 'number' && tm.can <= 0);
        var tGor = tm.kap || goruntuAl(tm);
        if (tmCanli) {
          var ta = (tGor && typeof tGor.alpha === 'number') ? tGor.alpha : 1;
          if (n < HAVUZ - 1) koy(n++, tm.x, tm.y, GEN.totem, 0.77 * ta, yon);
          iz = canliIz(iz, tm.sprite, tm.x, tm.y, V, yon, ta);
          ortuSaydamGuncelle(tGor, tm.x, tm.y, oy, 205, 48, 0.45, dt);
        } else if (tm.kap && tm.kap.alpha !== 1) {
          tm.kap.alpha = 1;
        }
      }
    }
    var varL = (window.BOLUM && Array.isArray(BOLUM.variller)) ? BOLUM.variller : null;
    if (varL) {
      for (i = 0; i < varL.length; i++) {
        var v = varL[i];
        if (!v || !isFinite(v.x) || !isFinite(v.y)) continue;
        var vGor = goruntuAl(v);
        var vCanli = !v.patladi && v.aktif !== false && !(typeof v.can === 'number' && v.can <= 0);
        if (vCanli) {
          var vaa = (vGor && typeof vGor.alpha === 'number') ? vGor.alpha : 1;
          if (n < HAVUZ - 1) koy(n++, v.x, v.y, GEN.varil, 0.74 * vaa, yon);
          iz = canliIz(iz, vGor, v.x, v.y, V, yon, vaa);
          if (ortuSaydamGuncelle(vGor, v.x, v.y, oy, 105, 44, 0.5, dt)) v._cilaSoldurdu = true;
          else if (v._cilaSoldurdu && vGor && vGor.alpha > 0.985) { vGor.alpha = 1; v._cilaSoldurdu = false; }
        } else if (v._cilaSoldurdu && vGor) {
          vGor.alpha = 1; v._cilaSoldurdu = false;
        }
      }
    }
    if (oy) {
      koy(n++, OYUNCU.x, OYUNCU.y, GEN.oyuncu, 0.65, yon);
      iz = canliIz(iz, OYUNCU.sprite, OYUNCU.x, OYUNCU.y, V, yon, 1);
    }
    kalanIzleriGizle(golgeler, n);
    kalanIzleriGizle(canliIzleri, iz);
    // iri düşman (kalkanlı, okçu, şaman, baskıncı, infazcı) barbarın ÖNÜNDE durup onu örtüyorsa hafif saydamlaşır: barbar kalabalıkta kaybolmasın
    if (oy) {
      var BOYU = { kalkanli: 150, okcu: 135, saman: 150, yakici: 135, baskinci: 128, infazci: 165 };
      var ENI = { kalkanli: 46, okcu: 30, saman: 34, yakici: 32, baskinci: 34, infazci: 48 };
      for (i = 0; i < L.length; i++) {
        d = L[i]; if (!d || d.olu || !d.sprite || d.devMi || d.ad === 'VARGOR' || !BOYU[d.tur]) continue;
        ortuSaydamGuncelle(d.sprite, d.x, d.y, oy, BOYU[d.tur], ENI[d.tur], 0.5, dt);
      }
    }
    // dev veya Vargor barbarın önünü kapatıyorsa mesafeye bağlı pürüzsüz geçiş + barbarın temas gölgesini belirginleştir
    var ortu = 0;
    try {
      var dv = window.DEV;
      var devSon = bossOrtuOrtam(dv, dv && dv.sprite, devOrtamGolge, 290, 115, 0.24, 145, 350, AYAR.devSaydam, oy, null, dt);
      var vSon = bossOrtuOrtam(vr, vr && (vr.kap || vr.sprite), vargorOrtamGolge, 220, 86, 0.22, 120, 285, AYAR.vargorSaydam, oy, vargorAlfa, dt);
      vargorAlfa = vSon.alfa;
      ortu = Math.max(devSon.ortu, vSon.ortu);
    } catch (e) {}
    // barbarın ayağının altında net, küçük temas gölgesi (dev/Vargor arkasındayken bir ton daha belirgin)
    temas.visible = !!oy;
    if (oy) {
      temas.x = OYUNCU.x; temas.y = OYUNCU.y + 1;
      temas.width = 39 + ortu * 5; temas.height = 19 + ortu * 2;
      temas.tint = yon.renk;
      temas.alpha = Math.min(0.95, AYAR.temasAlfa + ortu * 0.14);
    }
  }
  OYUN.sistem('cila', { baslat: kur, herKare: herKare, sifirla: function () {
    zaman = 0; vargorAlfa = 1;
    kalanIzleriGizle(golgeler, 0);
    kalanIzleriGizle(canliIzleri, 0);
    kalanIzleriGizle(dekorGolge, 0);
    kalanIzleriGizle(dekorIzleri, 0);
    for (var b = 0; b < bounceIsik.length; b++) bounceIsik[b].visible = false;
    if (devOrtamGolge) devOrtamGolge.visible = false;
    if (vargorOrtamGolge) vargorOrtamGolge.visible = false;
    if (temas) temas.visible = false;
    if (kuleZeminIsigi) kuleZeminIsigi.visible = false;
    for (var isik of ayazYansimalari) if (isik && !isik.destroyed) { isik.visible = false; isik.parent?.removeChild(isik); }
    try { if (window.DEV && DEV.sprite) DEV.sprite.alpha = 1; } catch (e) {}
    try { if (window.VARGOR) { var vg = VARGOR.kap || VARGOR.sprite; if (vg) vg.alpha = 1; } } catch (e) {}
  } });
  window.CILA = { AYAR: AYAR };
})();
