// Barbar – cila: net temas gölgeleri, zemin meşale sekme ışığı, dev arkası yumuşak saydamlık ve derinlik.
// Gölgeler katman.golge'de (bütün karakterlerin ALTINDA): devin gölgesi barbarın üstüne binmez.
// Meşale zemin sekmesi gölgelerin de ALTINDA çizilir: barbarı/düşmanı soldurmaz, hale oluşturmaz; gölgeler sıcak zemine oturur.
// Barbarın temas gölgesi en son çizilir (devin geniş gölgesinin içinde bile ayağının altı net okunur).
(function () {
  'use strict';
  var HAVUZ = 128, golgeler = [], doku = null, temasDoku = null, kap = null, temas = null;
  var DEKOR_HAVUZ = 48, dekorGolge = [], dekorKap = null;
  var ISIK_HAVUZ = 24, bounceIsik = [], bounceKap = null, isikDoku = null;
  var devOrtamGolge = null, vargorOrtamGolge = null, devOrtamDoku = null;
  var zaman = 0, vargorAlfa = 1;
  var _ozelSpr = [];
  var GEN = {
    goblin: 34, okcu: 46, kalkanli: 58, saman: 44, yakici: 46,
    baskinci: 48, infazci: 68, dev: 190, vargor: 145,
    totem: 88, varil: 74, oyuncu: 55
  }; // oyuncu 50 → 55: barbar %10 iri (19 Kasım)
  var AYAR = {
    devSaydam: 0.85,     // dev barbarı örterken hafif ve temiz saydamlaşma (hayalet/çamur olmadan silueti destekler)
    vargorSaydam: 0.78,  // Vargor barbarı örterken temiz saydamlaşma
    devGecis: 8,         // saydamlaşma hızı (1/sn)
    temasAlfa: 0.84,     // barbarın ayağının altındaki net temas gölgesi
    dekorAlfa: 0.48,     // yapı/ağaç/kaya/arabaların zemine düşen net temas gölgesi (derinlik)
    mesaleSekme: 0.11    // meşale/ateşlerin zeminde bıraktığı sıcak sekme ışığı (barbarı soldurmaz)
  };
  function ekleAlt(ust, cocuk) {
    if (typeof ust.addChildAt === 'function') ust.addChildAt(cocuk, 0);
    else ust.addChild(cocuk);
  }
  // varlik katmanındaki düz dekor resimleri (karakterler Container; dekorlar düz Sprite) için ayağa net temas gölgesi
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
  function dekorGolgeleri() {
    var ch = OYUN.katman.varlik.children, V = gorD(), ky = V.y, Hh = V.h, x0 = V.x - 60, x1 = V.x + V.w + 60, n = 0;
    ozelSprTopla();
    for (var i = 0; i < ch.length && n < DEKOR_HAVUZ; i++) {
      var c = ch[i];
      if (c.constructor !== PIXI.Sprite || !c.visible || !c.texture || c.y < ky - 40 || c.y > ky + Hh + 300) continue;
      if (_ozelSpr.indexOf(c) >= 0) continue;
      var w = Math.abs(c.texture.width * c.scale.x), h = Math.abs(c.texture.height * c.scale.y);
      if (c.x + w < x0 || c.x - w > x1) continue;   // görüş yana kaymışken dışarıda kalan dekor havuzu doldurmasın
      if (h < 40 || w < 30 || c.anchor.y < 0.6) continue;
      var ax = c.scale.x < 0 ? 1 - c.anchor.x : c.anchor.x, s = dekorGolge[n++];
      s.visible = true; s.x = c.x + (0.5 - ax) * w; s.y = c.y - Math.min(10, h * 0.04);
      s.width = w * 0.94; s.height = Math.max(12, Math.min(w * 0.28, 66)); s.alpha = AYAR.dekorAlfa * c.alpha;
    }
    for (; n < DEKOR_HAVUZ; n++) dekorGolge[n].visible = false;
  }

  // 3. tur: gölgeler NET biçimli (sert kenarlı, yarı saydam oval) — yumuşak bulanık leke değil ("gıcır gıcır").
  // 2× pikselle çizilir (retina); soğuk-koyu ton sıcak zemin ışığıyla kontrast kurar.
  function dokuYap(sert) {
    var K = 2, c = document.createElement('canvas'); c.width = 128 * K; c.height = 64 * K;
    var g = c.getContext('2d'); g.scale(K, K);
    g.fillStyle = sert ? 'rgba(8,6,12,0.62)' : 'rgba(8,6,12,0.48)';
    g.beginPath(); g.ellipse(64, 32, 60, 28, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = sert ? 'rgba(4,2,8,0.28)' : 'rgba(4,2,8,0.18)';   // ayağın hemen altı bir ton koyu (yine net kenarlı)
    g.beginPath(); g.ellipse(64, 32, 40, 18, 0, 0, Math.PI * 2); g.fill();
    if (sert) {
      g.fillStyle = 'rgba(2,1,5,0.22)';
      g.beginPath(); g.ellipse(64, 32, 24, 11, 0, 0, Math.PI * 2); g.fill();
    }
    return PIXI.Texture.from(c, { resolution: K });
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
    dekorKap = new PIXI.Container();
    kap = new PIXI.Container();
    OYUN.katman.golge.addChild(dekorKap);   // yapı/ağaç/kaya temas gölgeleri: karakter gölgelerinin ALTINDA
    ekleAlt(OYUN.katman.golge, bounceKap);  // meşale zemin sekme ışığı: tüm gölgelerin de ALTINDA (karakterleri soldurmaz)
    for (var j = 0; j < DEKOR_HAVUZ; j++) { var dg = new PIXI.Sprite(doku); dg.anchor.set(0.5); dg.visible = false; dekorKap.addChild(dg); dekorGolge.push(dg); }
    OYUN.katman.golge.addChild(kap);
    devOrtamGolge = new PIXI.Sprite(devOrtamDoku); devOrtamGolge.anchor.set(0.5); devOrtamGolge.visible = false;
    kap.addChild(devOrtamGolge);
    vargorOrtamGolge = new PIXI.Sprite(devOrtamDoku); vargorOrtamGolge.anchor.set(0.5); vargorOrtamGolge.visible = false;
    kap.addChild(vargorOrtamGolge);
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
    for (var i = 0; i < at.length && n < ISIK_HAVUZ; i++) {
      var f = at[i];
      if (!f || f.y < ky - 220 || f.y > ky + Hh + 220 || f.x < V.x - 260 || f.x > V.x + V.w + 260) continue;
      var s = bounceIsik[n++];
      var tit = 1 + Math.sin(zaman * 5.3 + i * 1.7) * 0.08 + Math.sin(zaman * 11.1 + i * 3.1) * 0.04;
      var g = (f.guc || 1) * tit;
      var cap = (150 + (f.h || 30) * 1.8) * Math.sqrt(Math.max(0.4, f.guc || 1));
      s.visible = true;
      s.x = f.x;
      s.y = f.y + 6;
      s.width = cap * tit;
      s.height = cap * 0.46 * tit;
      s.tint = f.tur === 'mesale' ? 0xff9442 : 0xff7629;
      s.alpha = Math.min(0.22, AYAR.mesaleSekme * g);
    }
    for (; n < ISIK_HAVUZ; n++) bounceIsik[n].visible = false;
  }
  function koy(n, x, y, gen, alfa) {
    var s = golgeler[n]; if (!s) return;
    s.visible = true; s.x = x; s.y = y + 2; s.width = gen * 1.15; s.height = gen * 0.46; s.alpha = alfa;   // net oval: eski yumuşak lekenin görünen boyu
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
    try { mesaleSekmeleri(); } catch (e) {}
    try { dekorGolgeleri(); } catch (e) {}
    var n = 0, i, d, L;
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
      var ayak = dGor && dGor.temas;
      if (ayak) {
        var ax = dGor.x + ayak.x, ay = dGor.y + ayak.y;
        koy(n++, d.x + ayak.x * .31, d.y + ayak.y * .31, gen * .92, .67 * sa);
        if (n < HAVUZ - 1) koy(n++, ax, ay - 2, Math.min(d.tur === 'skarn' ? 30 : 23, gen * .33), (d.tur === 'skarn' ? .61 : .48) * sa);
      } else koy(n++, d.x, d.y, gen, .85 * sa);
    }
    if (vr && vr.aktif && !vr.olu && isFinite(vr.x) && isFinite(vr.y) && L.indexOf(vr) < 0 && n < HAVUZ - 1) {
      var vg = goruntuAl(vr);
      var va = (vg && typeof vg.alpha === 'number') ? vg.alpha : 1;
      koy(n++, vr.x, vr.y, GEN.vargor, 0.85 * Math.min(va, vargorAlfa));
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
          if (n < HAVUZ - 1) koy(n++, tm.x, tm.y, GEN.totem, 0.82 * ta);
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
          if (n < HAVUZ - 1) koy(n++, v.x, v.y, GEN.varil, 0.78 * vaa);
          if (ortuSaydamGuncelle(vGor, v.x, v.y, oy, 105, 44, 0.5, dt)) v._cilaSoldurdu = true;
          else if (v._cilaSoldurdu && vGor && vGor.alpha > 0.985) { vGor.alpha = 1; v._cilaSoldurdu = false; }
        } else if (v._cilaSoldurdu && vGor) {
          vGor.alpha = 1; v._cilaSoldurdu = false;
        }
      }
    }
    if (oy) koy(n++, OYUNCU.x, OYUNCU.y, GEN.oyuncu, 0.9);
    for (; n < HAVUZ; n++) golgeler[n].visible = false;
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
      temas.width = 38 + ortu * 5; temas.height = 13 + ortu * 2;
      temas.alpha = Math.min(0.95, AYAR.temasAlfa + ortu * 0.14);
    }
  }
  OYUN.sistem('cila', { baslat: kur, herKare: herKare, sifirla: function () {
    zaman = 0; vargorAlfa = 1;
    for (var i = 0; i < golgeler.length; i++) golgeler[i].visible = false;
    for (var j = 0; j < dekorGolge.length; j++) dekorGolge[j].visible = false;
    for (var b = 0; b < bounceIsik.length; b++) bounceIsik[b].visible = false;
    if (devOrtamGolge) devOrtamGolge.visible = false;
    if (vargorOrtamGolge) vargorOrtamGolge.visible = false;
    if (temas) temas.visible = false;
    try { if (window.DEV && DEV.sprite) DEV.sprite.alpha = 1; } catch (e) {}
    try { if (window.VARGOR) { var vg = VARGOR.kap || VARGOR.sprite; if (vg) vg.alpha = 1; } } catch (e) {}
  } });
  window.CILA = { AYAR: AYAR };
})();
