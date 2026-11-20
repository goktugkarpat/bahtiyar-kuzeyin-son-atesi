'use strict';

// ============================================================
// VARGOR — Bölüm II Final Boss (Sönmeyen Ocağın Efendisi)
// Yalnızca OYUN.bolum === 2 iken aktiftir.
// ============================================================

(function () {
  var AYAR = {
    canMax: 3800,
    ustPay: 380,
    evre2: 0.65,
    evre3: 0.35,
    renk: 0xff6a1a,
    olcek: 1,
    r: 58,
    boy: 250,

    // Hareket ve arena sınırları
    hiz1: 108,
    hiz2: 122,
    hiz3: 136,
    kenarPay: 105,
    altPay: 75,
    uzakYakin: 245,

    // Evre 1+ — Alevli Gürz Süpürmesi ('vur')
    gurzMenzil: 245,
    gurzYariAci: 1.05,
    gurzHasar: 34,
    gurzTele: 0.72,
    gurzKilit: 0.24,
    gurzToparla: 0.45,
    gurzBekleme: 2.35,

    // Evre 1+ — Köz Küre Salvosu ('kayaat')
    korAdet: 3,
    korHasar: 26,
    korSekmeHasar: 180,
    korSekmeSersem: 0.9,
    korR: 28,
    korHiz: 470,
    korElY: 94,
    korYukseklik: 72,
    korAyrik: 119,
    korTele: 0.72,
    korKilit: 0.26,
    korSekmeHiz: 750,
    korToparla: 0.50,
    korBekleme: 3.1,

    // Ocak Yarması: yan adımla kaçılan, zemine yayılan doğrusal gürz darbesi.
    yarmaMenzil: 465,
    yarmaYariGen: 52,
    yarmaHasar: 24,
    yarmaTele: 0.9,
    yarmaKilit: 0.49,
    yarmaToparla: 0.75,
    yarmaBekleme: 5.2,

    // Evre 2 & 3 — Kükreme & Ateş Totemleri ('kukre')
    totemCanMax: 180,
    totemR: 38,
    kalkanOran: 0.50,
    kalkanKirSersem: 2.2,
    kalkanKirCarpan: 1.25,
    takviyeSinir: 4,
    isilMenzil: 108,
    isilHasar: 16,
    isilTele: 1.12,
    isilAra: 5.2,
    kukreTele: 0.65,
    kukreToparla: 0.55,
    kukreItmeMenzil: 220,
    kukreItmeHasar: 16,

    // Evre 3 — Lav Dalga Halkası ('yerevur')
    lavBasR: 60,
    lavMaxR: 360,
    lavHasar: 34,
    lavYaySure: 0.95,
    lavKalinlik: 26,
    lavZiplamaEsik: 24,
    lavHavuzAdet: 3,
    lavHavuzR: 70,
    lavHavuzSure: 4.5,
    lavTele: 0.85,
    lavToparla: 0.60,
    lavBekleme: 3.8,

    // Zafer gecikmesi
    kazanmaGecikme: 1.8
  };

  var SALDIRI_SIRASI = [
    ['vur', 'kayaat', 'yarma'],
    ['kayaat', 'yarma', 'vur'],
    ['yerevur', 'kayaat', 'yarma', 'vur']
  ];
  var TAKVIYELER = [[], ['kalkanli', 'baskinci'], ['baskinci', 'okcu', 'goblin']];
  var _olayBagli = false;
  var _totemSayac = 0;

  var st = null;

  function yeniDurum() {
    return {
      durum: 'bekle', // 'bekle' | 'dolas' | 'tele' | 'toparla' | 'sersem' | 'olum'
      saldiri: null,
      sayac: 0,
      teleSure: 0,

      hedefAci: 0,

      vurdu: false,
      hedefEvre: 1,
      kukreTotemAdet: 0,
      kukreTakviye: null,
      saldiriSira: 0,
      korHedefleri: [],
      lavHedefleri: [],
      yarmaIzi: null,
      lavHavuzlari: [],
      takviyeler: [],
      isilSure: 0,
      isilSirasi: 0,
      isilHedef: null,
      acik: false,
      sonGurzT: -10,
      sonKorT: -10,
      sonLavT: -10,
      sonYarmaT: -10,
      sersemT: 0,
      vurFlash: 0,
      kalkanFlash: 0,
      olumT: 0,
      kazandiYayildi: false,
      olumTemizlenecek: false,
      arenaMerkezX: null,
      otoDevT: 0,
      atilVurulan: new Set(),
      yonDegisT: 0,
      sonAnim: '',
      sonYon8: -1,
      kuklaTur: 'yok' // 'paket' | 'geo'
    };
  }

  var VARGOR = {
    aktif: false,
    olu: false,
    canli: false,
    tur: 'dev',
    ad: 'VARGOR',
    unvan: 'Sönmeyen Ocağın Efendisi',
    devMi: true,
    x: 0,
    y: 0,
    r: AYAR.r,
    yon: -1,
    can: AYAR.canMax,
    canMax: AYAR.canMax,
    evre: 1,
    AYAR: AYAR,
    totemler: [],
    lavHalkalar: [],
    kap: null,
    sprite: null,
    kukla: null,
    golge: null,
    tg: null,
    bagG: null,
    lavG: null,
    isilG: null,
    basla: basla,
    totemVur: totemVur,
    saldir: saldir,
    hasarAl: hasarAl,
    it: function () { /* Dev boss ağır, itme almaz */ },
    bilgi: bilgi
  };

  // ---- Yardımcılar ----
  function clamp(v, min, max) {
    return v < min ? min : (v > max ? max : v);
  }

  function normAci(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  function bolumIkiMi() {
    return !!(window.OYUN && OYUN.bolum === 2);
  }

  function paramAcik(ad) {
    if (!window.OYUN || typeof OYUN.param !== 'function') return false;
    var v = OYUN.param(ad);
    if (v === null || v === undefined) return false;
    var s = String(v).toLowerCase();
    return s !== '0' && s !== 'false' && s !== 'hayir' && s !== 'no';
  }

  function paketAl(ad) {
    if (!window.VARLIK) return null;
    if (typeof VARLIK.paket === 'function') return VARLIK.paket(ad);
    if (VARLIK.paketler && VARLIK.paketler[ad]) return VARLIK.paketler[ad];
    return null;
  }

  function vargorPaketHazirMi() {
    var p = paketAl('vargor');
    if (!p || p.yerTutucu || p.yukleniyor) return false;
    if (window.VARLIK && typeof VARLIK.var === 'function' && !VARLIK.var('vargor')) return false;
    return true;
  }

  function aktifTotemSayisi() {
    var n = 0;
    for (var i = 0; i < VARGOR.totemler.length; i++) {
      var t = VARGOR.totemler[i];
      if (t && t.aktif && t.can > 0) n++;
    }
    return n;
  }

  function kalkanAktifMi() {
    return aktifTotemSayisi() > 0;
  }

  function ustSinirY() {
    var kamY = (window.OYUN && OYUN.kamera && isFinite(OYUN.kamera.y)) ? OYUN.kamera.y : 0;
    var b = window.BOLUM && BOLUM.sinir;
    var bUst = (b && isFinite(b.ust)) ? b.ust : 0;
    return Math.max(AYAR.ustPay, Math.round(kamY + AYAR.ustPay), bUst);
  }

  function alan() {
    var W = (window.OYUN && OYUN.W) || 1280;
    var H = (window.OYUN && OYUN.H) || 720;
    var kam = (window.OYUN && OYUN.kamera) || { x: 0, y: 0 };
    var kx = isFinite(kam.x) ? kam.x : 0;
    var ky = isFinite(kam.y) ? kam.y : 0;
    var b = window.BOLUM && BOLUM.sinir;

    var sol = kx + AYAR.kenarPay;
    var sag = kx + W - AYAR.kenarPay;
    if (b && isFinite(b.sol) && isFinite(b.sag)) {
      if (b.sag - b.sol <= W + 160) {
        sol = b.sol + AYAR.kenarPay;
        sag = b.sag - AYAR.kenarPay;
      } else {
        sol = Math.max(b.sol + AYAR.kenarPay, sol);
        sag = Math.min(b.sag - AYAR.kenarPay, sag);
      }
    }
    if (st && isFinite(st.arenaMerkezX)) {
      sol = Math.max(sol, st.arenaMerkezX - (W * 0.5 - AYAR.kenarPay));
      sag = Math.min(sag, st.arenaMerkezX + (W * 0.5 - AYAR.kenarPay));
    }
    if (sag < sol + 80) {
      var mid = (sol + sag) * 0.5;
      sol = mid - 120;
      sag = mid + 120;
    }

    var ust = ustSinirY();
    var alt = ky + H - AYAR.altPay;
    if (b && isFinite(b.alt)) alt = Math.min(alt, b.alt - 20);
    if (alt < ust + 30) alt = ust + 90;

    return { sol: sol, sag: sag, ust: ust, alt: alt };
  }

  function oyuncuAlani() {
    return (window.BOLUM && BOLUM.sinir) || alan();
  }

  function arenaNoktasi(x, y, a, pay) {
    return { x: clamp(x, a.sol + pay, a.sag - pay), y: clamp(y, a.ust + pay, a.alt - pay) };
  }

  function konumKistir() {
    var a = alan();
    VARGOR.x = clamp(VARGOR.x, a.sol, a.sag);
    VARGOR.y = clamp(VARGOR.y, a.ust, a.alt);
    if (VARGOR.y < AYAR.ustPay) VARGOR.y = AYAR.ustPay;
    if (VARGOR.kap) {
      VARGOR.kap.x = VARGOR.x;
      VARGOR.kap.y = VARGOR.y;
    }
    if (VARGOR.golge) {
      VARGOR.golge.x = VARGOR.x;
      VARGOR.golge.y = VARGOR.y;
    }
  }

  function oyuncuKonum() {
    if (window.OYUNCU && isFinite(OYUNCU.x) && isFinite(OYUNCU.y)) {
      return { x: OYUNCU.x, y: OYUNCU.y, r: OYUNCU.r || 18, z: OYUNCU.z || 0 };
    }
    return { x: VARGOR.x - 220, y: VARGOR.y + 20, r: 18, z: 0 };
  }

  function koniIcinde(px, py, cx, cy, aci, menzil, yariAci) {
    var dx = px - cx;
    var dy = py - cy;
    var d = Math.hypot(dx, dy);
    if (d > menzil) return false;
    if (d < 28) return true;
    var fark = Math.abs(normAci(Math.atan2(dy, dx) - aci));
    return fark <= yariAci;
  }

  function dusmanListeyeEkle() {
    if (!window.DUSMAN || !Array.isArray(DUSMAN.liste)) return;
    if (DUSMAN.liste.indexOf(VARGOR) === -1) DUSMAN.liste.push(VARGOR);
  }

  function dusmanListedenCikar() {
    if (!window.DUSMAN || !Array.isArray(DUSMAN.liste)) return;
    var idx = DUSMAN.liste.indexOf(VARGOR);
    if (idx !== -1) DUSMAN.liste.splice(idx, 1);
  }

  function gorseliSil(gorsel) {
    if (gorsel && !gorsel.destroyed) gorsel.destroy({ children: true });
  }

  function vargorMermisiMi(m) {
    var kaynak = m && m.kaynak;
    return kaynak === VARGOR || (kaynak && st && st.takviyeler.some(function (s) { return s.d === kaynak && s.id === kaynak.id; }));
  }

  function mermiTemizle() {
    if (!window.MERMI || !Array.isArray(MERMI.liste)) return;
    for (var i = MERMI.liste.length - 1; i >= 0; i--) {
      var m = MERMI.liste[i];
      if (vargorMermisiMi(m)) MERMI.birak(m);
    }
  }

  var KOR_KABUK = [
    [-.77, -.54, -.29, -.91, .10, -.78, -.13, -.40, -.52, -.28],
    [.18, -.78, .67, -.68, .95, -.25, .52, -.19, .12, -.39],
    [-.52, -.16, -.19, -.30, -.18, .14, -.46, .48, -.83, .20],
    [.02, -.26, .49, -.08, .86, -.11, .79, .42, .43, .55, .06, .23],
    [-.40, .58, -.10, .24, .29, .53, .45, .72, .05, .88, -.40, .79]
  ];
  var KOR_YUZEY = [0x654d40, 0x40323a, 0x453239, 0x514147, 0x302831];
  var SEKME_YUZEY = [0x577b79, 0x2a535a, 0x345961, 0x3d666b, 0x203d47];

  function korKureGorselSusle(m, r, sekme) {
    if (!window.PIXI || !m || !m.kap) return;
    var ic = m.kap.ic;
    if (!(ic instanceof PIXI.Graphics) || Math.abs((ic.scale.x || 1) - r) >= 0.08) return;
    ic.clear();
    ic.beginFill(sekme ? 0x123b44 : 0x4d1209, 0.58);
    ic.drawCircle(0, 0, 1.14);
    ic.endFill();
    ic.lineStyle(.105, sekme ? 0x122a31 : 0x280b08, 1);
    ic.beginFill(sekme ? 0x93ebde : 0xff8825, 1);
    ic.drawPolygon([-.93, -.33, -.56, -.86, .02, -1.0, .61, -.81, 1, -.32,
      .89, .39, .53, .77, .04, .98, -.52, .80, -.91, .30]);
    ic.endFill();

    var renkler = sekme ? SEKME_YUZEY : KOR_YUZEY;
    ic.lineStyle(.055, sekme ? 0x25494e : 0x673328, 1);
    for (var i = 0; i < KOR_KABUK.length; i++) {
      ic.beginFill(renkler[i], 1);
      ic.drawPolygon(KOR_KABUK[i]);
      ic.endFill();
    }
    // Parlak çekirdek, cüruf levhalarının açıkta bıraktığı çatlaklardan sızar.
    ic.lineStyle(.066, sekme ? 0xe0fff3 : 0xffebba, .96);
    ic.moveTo(-.09, -.37);
    ic.lineTo(-.09, .01);
    ic.lineTo(.01, .22);
    ic.lineTo(.29, .43);
    ic.moveTo(-.09, .01);
    ic.lineTo(-.40, .43);
    ic.moveTo(-.06, -.32);
    ic.lineTo(.09, -.60);
    ic.lineStyle(.055, sekme ? 0x9bbeb4 : 0x9b7a67, .84);
    ic.moveTo(-.63, -.53);
    ic.lineTo(-.31, -.77);
    ic.moveTo(.25, -.63);
    ic.lineTo(.55, -.54);
  }

  // ---- Geometrik Fallback Kukla (varlik/vargor.js yüklenene dek) ----
  var GEO_ANIM = {
    dur:    { n: 8, fps: 10, dongu: true,  vurus: 0 },
    yuru:   { n: 8, fps: 12, dongu: true,  vurus: 0 },
    vur:    { n: 8, fps: 13, dongu: false, vurus: 4 },
    kayaat: { n: 6, fps: 11, dongu: false, vurus: 3 },
    kukre:  { n: 6, fps: 10, dongu: false, vurus: 3 },
    sersem: { n: 4, fps: 10, dongu: true,  vurus: 0 },
    ol:     { n: 8, fps: 7,  dongu: false, vurus: 0 }
  };

  function geometrikKuklaOlustur() {
    var kap = new PIXI.Container();
    var govde = new PIXI.Container();
    kap.addChild(govde);

    // Koyu bazalt & kor damarlı savaş lordu silüeti
    var bacak = new PIXI.Graphics();
    bacak.lineStyle(4, 0x090606, 0.95);
    bacak.beginFill(0x1f1716);
    bacak.drawRoundedRect(-44, -84, 34, 84, 10);
    bacak.drawRoundedRect(10, -84, 34, 84, 10);
    bacak.endFill();
    bacak.lineStyle(3, 0xff6a1a, 0.8);
    bacak.moveTo(-28, -72); bacak.lineTo(-24, -18);
    bacak.moveTo(26, -72);  bacak.lineTo(22, -18);
    govde.addChild(bacak);

    var gogus = new PIXI.Graphics();
    // Zırh ana gövde
    gogus.lineStyle(5, 0x080505, 0.95);
    gogus.beginFill(0x281c1a);
    gogus.moveTo(-68, -185);
    gogus.lineTo(68, -185);
    gogus.lineTo(52, -76);
    gogus.lineTo(-52, -76);
    gogus.closePath();
    gogus.endFill();
    // Omuzluklar
    gogus.beginFill(0x36231e);
    gogus.drawRoundedRect(-90, -198, 44, 48, 12);
    gogus.drawRoundedRect(46, -198, 44, 48, 12);
    gogus.endFill();
    // Göğüs ocağı (sönmeyen kor çekirdek)
    gogus.beginFill(0xff5a12, 0.95);
    gogus.drawCircle(0, -138, 22);
    gogus.endFill();
    gogus.beginFill(0xffe08a, 0.95);
    gogus.drawCircle(0, -138, 11);
    gogus.endFill();
    // Çatlak kor damarları
    gogus.lineStyle(3, 0xff7a22, 0.9);
    gogus.moveTo(-36, -168); gogus.lineTo(-14, -142); gogus.lineTo(-28, -104);
    gogus.moveTo(36, -168);  gogus.lineTo(14, -142);  gogus.lineTo(28, -104);
    govde.addChild(gogus);

    // Boynuzlu miğfer kafa
    var kafa = new PIXI.Graphics();
    kafa.lineStyle(4, 0x070404, 0.95);
    kafa.beginFill(0x1b1211);
    kafa.drawRoundedRect(-28, -238, 56, 52, 14);
    kafa.endFill();
    // Boynuzlar
    kafa.beginFill(0x2a1b18);
    kafa.moveTo(-24, -228); kafa.lineTo(-52, -264); kafa.lineTo(-14, -242); kafa.closePath();
    kafa.moveTo(24, -228);  kafa.lineTo(52, -264);  kafa.lineTo(14, -242);  kafa.closePath();
    kafa.endFill();
    // Yanan gözler
    kafa.lineStyle(0);
    kafa.beginFill(0xffe4a8);
    kafa.drawEllipse(-11, -214, 7, 4);
    kafa.drawEllipse(11, -214, 7, 4);
    kafa.endFill();
    govde.addChild(kafa);

    // Sağ kol + Rünlü Dev Kor Gürz
    var sagKol = new PIXI.Container();
    sagKol.x = 68;
    sagKol.y = -172;
    var gurz = new PIXI.Graphics();
    gurz.lineStyle(4, 0x080505, 0.95);
    gurz.beginFill(0x3a251c);
    gurz.drawRoundedRect(-8, -12, 16, 128, 5);
    gurz.endFill();
    // Gürz başı
    gurz.beginFill(0x221614);
    gurz.drawRoundedRect(-30, 88, 60, 44, 10);
    gurz.endFill();
    gurz.lineStyle(3, 0xff7a22, 0.95);
    gurz.beginFill(0xff5a12, 0.9);
    gurz.drawCircle(0, 110, 14);
    gurz.endFill();
    gurz.beginFill(0xffe4a8, 0.95);
    gurz.drawCircle(0, 110, 6);
    gurz.endFill();
    sagKol.addChild(gurz);
    govde.addChild(sagKol);

    // Sol kol + Kor Küresi el tutacağı
    var solKol = new PIXI.Container();
    solKol.x = -68;
    solKol.y = -172;
    var elG = new PIXI.Graphics();
    elG.lineStyle(4, 0x080505, 0.95);
    elG.beginFill(0x2b1d1b);
    elG.drawRoundedRect(-12, -8, 24, 90, 8);
    elG.endFill();
    var elKure = new PIXI.Graphics();
    elKure.y = 84;
    elKure.beginFill(0xff6a1a, 0.92);
    elKure.drawCircle(0, 0, 17);
    elKure.endFill();
    elKure.beginFill(0xffe4a8, 0.95);
    elKure.drawCircle(0, 0, 8);
    elKure.endFill();
    elKure.visible = false;
    solKol.addChild(elG);
    solKol.addChild(elKure);
    govde.addChild(solKol);

    var k = {
      kap: kap,
      govde: govde,
      anim: 'dur',
      kare: 0,
      bitti: false,
      yon: VARGOR.yon,
      olcek: 1,
      zaman: 0,
      animVar: function (ad) { return !!GEO_ANIM[ad]; },
      oynat: function (ad, sifirla) {
        if (!GEO_ANIM[ad]) ad = 'dur';
        if (this.anim === ad && !sifirla && !this.bitti) return;
        this.anim = ad;
        this.kare = 0;
        this.zaman = 0;
        this.bitti = false;
      },
      vurusKaresiMi: function () {
        var tan = GEO_ANIM[this.anim];
        return !!(tan && tan.vurus && this.kare === tan.vurus);
      },
      guncelle: function (dt) {
        var tan = GEO_ANIM[this.anim] || GEO_ANIM.dur;
        this.zaman += dt;
        var kareSuresi = 1 / (tan.fps || 10);
        while (this.zaman >= kareSuresi) {
          this.zaman -= kareSuresi;
          this.kare++;
          if (this.kare >= tan.n) {
            if (tan.dongu) this.kare = 0;
            else {
              this.kare = tan.n - 1;
              this.bitti = true;
            }
          }
        }

        var t = (window.OYUN && OYUN.zaman) ? OYUN.zaman.t : 0;
        var p = tan.n > 1 ? this.kare / (tan.n - 1) : 0;
        kap.scale.x = (this.yon < 0 ? -1 : 1) * this.olcek;
        kap.scale.y = this.olcek;

        govde.y = 0;
        govde.rotation = 0;
        govde.alpha = 1;
        sagKol.rotation = 0;
        solKol.rotation = 0;
        elKure.visible = false;

        if (this.anim === 'dur') {
          govde.y = Math.sin(t * 3.2) * 3;
          sagKol.rotation = -0.15 + Math.sin(t * 3.2) * 0.06;
          solKol.rotation = 0.14 - Math.sin(t * 3.2) * 0.05;
        } else if (this.anim === 'yuru') {
          govde.y = -Math.abs(Math.sin(t * 9)) * 7;
          govde.rotation = Math.sin(t * 4.5) * 0.04;
          sagKol.rotation = Math.sin(t * 4.5) * 0.25;
          solKol.rotation = -Math.sin(t * 4.5) * 0.25;
        } else if (this.anim === 'vur') {
          sagKol.rotation = p < 0.45 ? -2.2 * (p / 0.45) : -2.2 + 3.4 * ((p - 0.45) / 0.55);
          govde.rotation = p < 0.45 ? -0.12 : 0.14;
        } else if (this.anim === 'kayaat') {
          elKure.visible = p < 0.6;
          solKol.rotation = p < 0.45 ? -2.1 * (p / 0.45) : -2.1 + 2.9 * ((p - 0.45) / 0.55);
          sagKol.rotation = 0.3;
        } else if (this.anim === 'kukre') {
          govde.y = -Math.sin(p * Math.PI) * 14;
          sagKol.rotation = -2.3 * Math.sin(p * Math.PI);
          solKol.rotation = 2.3 * Math.sin(p * Math.PI);
        } else if (this.anim === 'sersem') {
          govde.y = 14 + Math.sin(t * 14) * 3;
          govde.rotation = Math.sin(t * 9) * 0.1;
          sagKol.rotation = 0.4;
          solKol.rotation = -0.4;
        } else if (this.anim === 'ol') {
          govde.y = p * 75;
          govde.rotation = p * -1.35;
          govde.alpha = clamp(1 - p * 0.35, 0.4, 1);
        }
      }
    };
    return k;
  }

  function kuklaKur() {
    if (!window.PIXI || !window.OYUN || !OYUN.katman) return;
    if (VARGOR.kukla && typeof VARGOR.kukla.sil === 'function') {
      try { VARGOR.kukla.sil(); } catch (e) {}
    }
    gorseliSil(VARGOR.kap);
    gorseliSil(VARGOR.golge);

    VARGOR.kap = new PIXI.Container();
    VARGOR.kap.x = VARGOR.x;
    VARGOR.kap.y = VARGOR.y;
    VARGOR.kap.zEk = 0;

    if (vargorPaketHazirMi() && window.VARLIK && typeof VARLIK.sprite === 'function') {
      st.kuklaTur = 'paket';
      VARGOR.kukla = VARLIK.sprite('vargor', { olcek: AYAR.olcek });
      VARGOR.sprite = VARGOR.kukla;
      VARGOR.kap.addChild(VARGOR.kukla.kap || VARGOR.kukla);
    } else {
      st.kuklaTur = 'geo';
      VARGOR.kukla = geometrikKuklaOlustur();
      VARGOR.sprite = null;
      VARGOR.kap.addChild(VARGOR.kukla.kap);
    }
    if (OYUN.katman.varlik) OYUN.katman.varlik.addChild(VARGOR.kap);

    // Zemin kor halesi (cila.js temas gölgesini tamamlar)
    VARGOR.golge = new PIXI.Graphics();
    VARGOR.golge.beginFill(0xff5512, 0.22);
    VARGOR.golge.drawEllipse(0, 6, 108, 34);
    VARGOR.golge.endFill();
    VARGOR.golge.lineStyle(2, 0xff7a22, 0.35);
    VARGOR.golge.drawEllipse(0, 6, 108, 34);
    VARGOR.golge.x = VARGOR.x;
    VARGOR.golge.y = VARGOR.y;
    if (OYUN.katman.golge) OYUN.katman.golge.addChild(VARGOR.golge);

    if (!VARGOR.tg) {
      VARGOR.tg = new PIXI.Graphics();
      if (OYUN.katman.leke) OYUN.katman.leke.addChild(VARGOR.tg);
    }
    if (!VARGOR.bagG) {
      VARGOR.bagG = new PIXI.Graphics();
      if (OYUN.katman.efekt) OYUN.katman.efekt.addChild(VARGOR.bagG);
    }
    if (!VARGOR.lavG) {
      VARGOR.lavG = new PIXI.Graphics();
      if (OYUN.katman.leke) OYUN.katman.leke.addChild(VARGOR.lavG);
    }
    if (!VARGOR.isilG) {
      VARGOR.isilG = new PIXI.Graphics();
      if (OYUN.katman.leke) OYUN.katman.leke.addChild(VARGOR.isilG);
    }
  }

  function animDestekliMi(ad) {
    if (!VARGOR.kukla) return false;
    if (typeof VARGOR.kukla.animVar === 'function') return VARGOR.kukla.animVar(ad);
    if (st.kuklaTur === 'paket' && window.VARLIK && typeof VARLIK.animVar === 'function') {
      return VARLIK.animVar('vargor', ad);
    }
    return true;
  }

  function yon8Al() {
    var p = oyuncuKonum();
    var dx = p.x - VARGOR.x;
    var dy = p.y - VARGOR.y;
    if (window.OYUN && typeof OYUN.aciYon === 'function') {
      if (st.durum === 'tele' || st.durum === 'toparla') return OYUN.aciYon(st.hedefAci);
      if ((dx * dx + dy * dy) > 1) return OYUN.aciYon(Math.atan2(dy, dx));
    }
    return VARGOR.yon >= 0 ? 6 : 2;
  }

  function kuklaOynat(ad, sifirla) {
    if (!VARGOR.kukla || typeof VARGOR.kukla.oynat !== 'function') return;
    if (!animDestekliMi(ad)) {
      if (ad === 'yerevur') ad = animDestekliMi('vur') ? 'vur' : 'kukre';
      else if (ad === 'ol' || ad === 'sersem') ad = 'dur';
    }
    if (st.kuklaTur === 'paket') {
      var y8 = yon8Al();
      if (!sifirla && st.sonAnim === ad && st.sonYon8 === y8) return;
      st.sonAnim = ad;
      st.sonYon8 = y8;
      var sec = sifirla ? { bastan: true } : {};
      if (sifirla && st.durum === 'tele') {
        var a = VARGOR.kukla._animTanim(ad);
        if (a && a.fps && Number.isFinite(a.vurus)) sec.hiz = (a.vurus + 0.5) / a.fps / st.teleSure;
      }
      VARGOR.kukla.oynat(ad, y8, sec);
    } else {
      st.sonAnim = ad;
      VARGOR.kukla.oynat(ad, !!sifirla);
    }
  }

  function toparlanmaAnimasyonu(sure) {
    var k = VARGOR.kukla;
    if (!k || st.kuklaTur !== 'paket') return;
    var a = k._animTanim(st.sonAnim);
    if (!a || !a.fps || !Number.isFinite(a.vurus)) return;
    k.oynat(st.sonAnim, st.sonYon8, { hiz: Math.max(1, a.n - a.vurus) / a.fps / sure });
  }

  function renkUygula(hedef, tint) {
    if (!hedef) return;
    if (typeof hedef.tint === 'number') hedef.tint = tint;
    if (Array.isArray(hedef.children)) {
      for (var i = 0; i < hedef.children.length; i++) {
        if (hedef.children[i] && typeof hedef.children[i].tint === 'number') {
          hedef.children[i].tint = tint;
        }
      }
    }
  }

  function kuklaRenkGuncelle() {
    if (!VARGOR.kukla || !VARGOR.kap) return;
    var hedef = VARGOR.kukla.sp || VARGOR.kukla.sprite || VARGOR.kukla.kap || VARGOR.kukla;
    var tint = 0xffffff;
    if (st.vurFlash > 0) {
      tint = 0xffffff;
      VARGOR.kap.alpha = 0.85 + Math.sin(st.vurFlash * 60) * 0.15;
    } else {
      if (st.kalkanFlash > 0) tint = 0xffb36b;
      else if (kalkanAktifMi()) tint = 0xffddbb;
      if (!window.CILA) VARGOR.kap.alpha = 1;
    }
    if (typeof VARGOR.kukla.renk === 'function') VARGOR.kukla.renk(tint);
    else renkUygula(hedef, tint);
  }

  // ---- Yüksek Kontrastlı Amber Telgraflar ----
  function koniCiz(g, x, y, r, a0, a1, oran) {
    if (!g) return;
    oran = clamp(oran, 0, 1);
    var p1x = x + Math.cos(a0) * r;
    var p1y = y + Math.sin(a0) * r;
    var p2x = x + Math.cos(a1) * r;
    var p2y = y + Math.sin(a1) * r;

    // Zemin koyu amber dolgu
    g.lineStyle(0);
    g.beginFill(0xff6a1a, 0.14 + 0.14 * oran);
    g.moveTo(x, y);
    g.lineTo(p1x, p1y);
    g.arc(x, y, r, a0, a1);
    g.lineTo(x, y);
    g.endFill();

    // İlerleyen ön yay dolgusu
    var ir = Math.max(12, r * oran);
    g.beginFill(0xff9436, 0.18 + 0.14 * oran);
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a0) * ir, y + Math.sin(a0) * ir);
    g.arc(x, y, ir, a0, a1);
    g.lineTo(x, y);
    g.endFill();

    // Siyah alt kontur
    g.lineStyle(8, 0x000000, 0.6);
    g.moveTo(x, y);
    g.lineTo(p1x, p1y);
    g.arc(x, y, r, a0, a1);
    g.lineTo(x, y);

    // Parlak kor-turuncu dış çizgi
    g.lineStyle(3.5, 0xff7a22, 0.94);
    g.moveTo(x, y);
    g.lineTo(p1x, p1y);
    g.arc(x, y, r, a0, a1);
    g.lineTo(x, y);

    // Krem-amber ilerleyen ön yay
    g.lineStyle(3, 0xffe4a8, 0.95);
    g.moveTo(x + Math.cos(a0) * ir, y + Math.sin(a0) * ir);
    g.arc(x, y, ir, a0, a1);
  }

  function daireCiz(g, x, y, r, oran) {
    if (!g) return;
    oran = clamp(oran, 0, 1);
    var ir = Math.max(8, r * oran);

    g.lineStyle(0);
    g.beginFill(0xff5a12, 0.14 + 0.14 * oran);
    g.drawCircle(x, y, r);
    g.endFill();

    // Siyah alt kontur
    g.lineStyle(8, 0x000000, 0.6);
    g.drawCircle(x, y, r);
    // Parlak kor-turuncu dış çizgi
    g.lineStyle(3.5, 0xff7a22, 0.95);
    g.drawCircle(x, y, r);

    // Krem-amber ön yay (içten dışa genişleyen uyarı halkası)
    g.lineStyle(6, 0x000000, 0.55);
    g.drawCircle(x, y, ir);
    g.lineStyle(3, 0xffe4a8, 0.95);
    g.drawCircle(x, y, ir);
  }

  function korHedefCiz(g, sx, sy, tx, ty, r, oran) {
    if (!g) return;
    daireCiz(g, tx, ty, r, oran);
    // Şerit yön oku: siyah alt kontur + kor-turuncu + krem-amber ilerleyen çizgi
    g.lineStyle(8, 0x000000, 0.6);
    g.moveTo(sx, sy);
    g.lineTo(tx, ty);
    g.lineStyle(3, 0xff7a22, 0.85);
    g.moveTo(sx, sy);
    g.lineTo(tx, ty);
    var ix = sx + (tx - sx) * oran;
    var iy = sy + (ty - sy) * oran;
    g.lineStyle(3, 0xffe4a8, 0.95);
    g.moveTo(sx, sy);
    g.lineTo(ix, iy);
  }

  function yarmaSeridiCiz(g, oran) {
    var ux = Math.cos(st.hedefAci), uy = Math.sin(st.hedefAci);
    var nx = -uy * AYAR.yarmaYariGen, ny = ux * AYAR.yarmaYariGen;
    var x = VARGOR.x, y = VARGOR.y;
    var dx = ux * AYAR.yarmaMenzil, dy = uy * AYAR.yarmaMenzil;
    g.lineStyle(6, 0x160b05, 0.82);
    g.beginFill(0x9e3114, 0.30 + oran * 0.19);
    g.drawPolygon([x + nx, y + ny, x + dx + nx, y + dy + ny, x + dx - nx, y + dy - ny, x - nx, y - ny]);
    g.endFill();
    g.lineStyle(3, 0xff963f, 0.96);
    g.moveTo(x + nx, y + ny).lineTo(x + dx + nx, y + dy + ny);
    g.moveTo(x - nx, y - ny).lineTo(x + dx - nx, y + dy - ny);
    g.lineStyle(3, 0xffe5ba, 0.92);
    g.moveTo(x, y).lineTo(x + dx * oran, y + dy * oran);
  }

  function telgrafCiz() {
    if (!VARGOR.tg) return;
    var g = VARGOR.tg;
    g.clear();
    if (!VARGOR.aktif || VARGOR.olu || st.durum !== 'tele') return;

    var oran = st.teleSure > 0 ? clamp(st.sayac / st.teleSure, 0, 1) : 1;
    if (st.saldiri === 'vur') {
      koniCiz(g, VARGOR.x, VARGOR.y, AYAR.gurzMenzil, st.hedefAci - AYAR.gurzYariAci, st.hedefAci + AYAR.gurzYariAci, oran);
    } else if (st.saldiri === 'kayaat') {
      var sx = VARGOR.x + VARGOR.yon * 36;
      var sy = VARGOR.y - 8;
      for (var i = 0; i < st.korHedefleri.length; i++) {
        var n = st.korHedefleri[i];
        korHedefCiz(g, sx, sy, n.x, n.y, AYAR.korR, oran);
      }
    } else if (st.saldiri === 'yarma') {
      yarmaSeridiCiz(g, oran);
    } else if (st.saldiri === 'kukre') {
      daireCiz(g, VARGOR.x, VARGOR.y, AYAR.kukreItmeMenzil, oran);
    } else if (st.saldiri === 'yerevur') {
      daireCiz(g, VARGOR.x, VARGOR.y, AYAR.lavMaxR, oran);
      // İç başlangıç halkası
      g.lineStyle(6, 0x000000, 0.6);
      g.drawCircle(VARGOR.x, VARGOR.y, AYAR.lavBasR);
      g.lineStyle(3, 0xffe4a8, 0.95);
      g.drawCircle(VARGOR.x, VARGOR.y, AYAR.lavBasR);
      for (var li = 0; li < st.lavHedefleri.length; li++) {
        var havuz = st.lavHedefleri[li];
        g.lineStyle(2, 0xff923e, 0.5 + oran * 0.4);
        g.beginFill(0xd24914, 0.2);
        g.drawEllipse(havuz.x, havuz.y, AYAR.lavHavuzR, AYAR.lavHavuzR * 0.55);
        g.endFill();
      }
    }
  }

  // ---- Totem Sistemi (Evre 2 & 3) ----
  function totemGorselKur(t) {
    if (!window.PIXI || !window.OYUN || !OYUN.katman) return;
    var kap = new PIXI.Container();
    kap.x = t.x;
    kap.y = t.y;
    kap.zEk = 0;

    var govde = new PIXI.Container();
    kap.addChild(govde);

    var spriteEklendi = false;
    if (window.VARLIK && typeof VARLIK.kare === 'function') {
      var cevreHazir = (typeof VARLIK.var === 'function') ? VARLIK.var('cevre2') : true;
      var k = cevreHazir ? VARLIK.kare('cevre2', 'totem_kor') : null;
      if (k && k.doku && k.doku !== PIXI.Texture.EMPTY && k.w > 32) {
        var sp = new PIXI.Sprite(k.doku);
        var olc = (k.bilgi && k.bilgi.olcek) ? k.bilgi.olcek : 0.3333;
        sp.anchor.set(-k.ox / k.w, -k.oy / k.h);
        sp.scale.set(olc);
        govde.addChild(sp);
        t.sprite = sp;
        spriteEklendi = true;
      }
    }

    if (!spriteEklendi) {
      // Yedek geometrik kor totemi (obsidian sütun + yanan mangal)
      var fig = new PIXI.Graphics();
      fig.lineStyle(4, 0x080505, 0.95);
      fig.beginFill(0x231918);
      fig.drawRoundedRect(-26, -138, 52, 138, 8);
      fig.endFill();
      // Taban kaidesi
      fig.beginFill(0x181110);
      fig.drawRoundedRect(-36, -24, 72, 24, 6);
      fig.endFill();
      // Kor çatlakları
      fig.lineStyle(3, 0xff7a22, 0.9);
      fig.moveTo(-10, -110); fig.lineTo(8, -76); fig.lineTo(-6, -42);
      // Üst ateş çanağı
      fig.lineStyle(3, 0x000000, 0.85);
      fig.beginFill(0x2d1c18);
      fig.drawEllipse(0, -138, 34, 13);
      fig.endFill();
      fig.lineStyle(0);
      fig.beginFill(0xff6a1a, 0.95);
      fig.drawCircle(0, -152, 20);
      fig.endFill();
      fig.beginFill(0xffe4a8, 0.95);
      fig.drawCircle(0, -154, 10);
      fig.endFill();
      govde.addChild(fig);
      t.sprite = fig;
    }

    // Üst titreşen ateş tacı + minik can barı
    var alev = new PIXI.Graphics();
    alev.beginFill(0xff7a22, 0.38);
    alev.drawCircle(0, -173, 25);
    alev.endFill();
    alev.beginFill(0xffe4a8, 0.65);
    alev.drawCircle(0, -173, 10);
    alev.endFill();
    govde.addChild(alev);
    t.alev = alev;

    var barW = 72;
    var barH = 9;
    var barY = -218;
    var barBg = new PIXI.Graphics();
    barBg.lineStyle(2, 0x000000, 0.9);
    barBg.beginFill(0x140a08, 0.9);
    barBg.drawRoundedRect(-barW * 0.5, barY, barW, barH, 3);
    barBg.endFill();
    kap.addChild(barBg);

    var barDolgu = new PIXI.Graphics();
    kap.addChild(barDolgu);
    t.barBg = barBg;
    t.barDolgu = barDolgu;
    t.barW = barW;
    t.barH = barH;
    t.barY = barY;
    totemCanBariGuncelle(t);

    if (OYUN.katman.varlik) OYUN.katman.varlik.addChild(kap);

    var golge = new PIXI.Graphics();
    golge.beginFill(0x000000, 0.42);
    golge.drawEllipse(0, 4, 42, 16);
    golge.endFill();
    golge.lineStyle(2, 0xff6a1a, 0.35);
    golge.drawEllipse(0, 4, 42, 16);
    golge.x = t.x;
    golge.y = t.y;
    if (OYUN.katman.golge) OYUN.katman.golge.addChild(golge);

    t.kap = kap;
    t.govde = govde;
    t.golge = golge;
  }

  function totemCanBariGuncelle(t) {
    if (!t || !t.barDolgu) return;
    var oran = t.canMax > 0 ? clamp(t.can / t.canMax, 0, 1) : 0;
    t.barDolgu.clear();
    if (oran <= 0) return;
    t.barDolgu.beginFill(0xff6a1a, 0.96);
    t.barDolgu.drawRoundedRect(-t.barW * 0.5 + 1, t.barY + 1, (t.barW - 2) * oran, t.barH - 2, 2);
    t.barDolgu.endFill();
    t.barDolgu.beginFill(0xffe4a8, 0.85);
    t.barDolgu.drawRect(-t.barW * 0.5 + 1, t.barY + 1, (t.barW - 2) * oran, 2);
    t.barDolgu.endFill();
  }

  function totemTemizle() {
    for (var i = 0; i < VARGOR.totemler.length; i++) {
      var t = VARGOR.totemler[i];
      if (!t) continue;
      gorseliSil(t.kap);
      gorseliSil(t.golge);
    }
    VARGOR.totemler.length = 0;
  }

  function totemKonumlariSec(adet) {
    var a = alan();
    var gen = a.sag - a.sol;
    var yuk = a.alt - a.ust;
    var adaylar;

    if (adet <= 2) {
      adaylar = [
        { x: a.sol + gen * 0.18, y: a.ust + yuk * 0.38 },
        { x: a.sag - gen * 0.18, y: a.ust + yuk * 0.72 }
      ];
    } else {
      adaylar = [
        { x: a.sol + gen * 0.16, y: a.ust + yuk * 0.36 },
        { x: a.sag - gen * 0.16, y: a.ust + yuk * 0.36 },
        { x: a.sol + gen * 0.50, y: a.ust + yuk * 0.84 }
      ];
    }

    var p = oyuncuKonum();
    var sonuc = [];
    for (var i = 0; i < Math.min(adet, adaylar.length); i++) {
      var nx = clamp(Math.round(adaylar[i].x), a.sol + 45, a.sag - 45);
      var ny = clamp(Math.round(adaylar[i].y), a.ust + 25, a.alt - 15);
      if (ny < AYAR.ustPay) ny = AYAR.ustPay;
      if (Math.hypot(nx - VARGOR.x, ny - VARGOR.y) < 130) {
        nx = clamp(nx + (nx < VARGOR.x ? -110 : 110), a.sol + 45, a.sag - 45);
      }
      if (Math.hypot(nx - p.x, ny - p.y) < 85) {
        ny = clamp(ny + (ny < p.y ? -80 : 80), a.ust + 25, a.alt - 15);
      }
      sonuc.push({ x: nx, y: ny });
    }
    return sonuc;
  }

  function totemDik(adet) {
    // Önceki totem kalıntılarını sessizce temizle (yeni faz kalkanı tertemiz kurulur)
    totemTemizle();
    var noktalar = totemKonumlariSec(adet);
    for (var i = 0; i < noktalar.length; i++) {
      _totemSayac++;
      var t = {
        id: 'totem_' + _totemSayac,
        tur: 'totem_kor',
        x: noktalar[i].x,
        y: noktalar[i].y,
        r: AYAR.totemR,
        can: AYAR.totemCanMax,
        canMax: AYAR.totemCanMax,
        aktif: true,
        flashT: 0,

        faz: i * 2.1,
        kap: null,
        govde: null,
        golge: null,
        sprite: null,
        alev: null,
        barBg: null,
        barDolgu: null
      };
      totemGorselKur(t);
      VARGOR.totemler.push(t);
    }
    st.isilHedef = null;
    st.isilSure = AYAR.isilAra;
    st.isilSirasi = 0;
    if (window.OLAY && VARGOR.totemler.length) OLAY.emit('vargorTotemler', { boss: VARGOR, evre: VARGOR.evre, adet: VARGOR.totemler.length });
  }

  function totemSondurHepsi() {
    for (var i = 0; i < VARGOR.totemler.length; i++) {
      var t = VARGOR.totemler[i];
      if (!t) continue;
      t.aktif = false;
      t.can = 0;
      if (t.alev) t.alev.visible = false;
      if (t.barBg) t.barBg.visible = false;
      if (t.barDolgu) t.barDolgu.clear();
      if (t.govde) t.govde.alpha = 0.45;
    }
  }

  function totemVur(x, y, r, hasar, tur) {
    if (!VARGOR.aktif || VARGOR.olu || !VARGOR.totemler.length) return 0;
    var menzil = isFinite(r) ? r : 0;
    var dmg = Math.max(0, isFinite(hasar) ? hasar : 0);
    if (dmg <= 0) return 0;

    var oncedenAktif = aktifTotemSayisi();
    var vurdu = 0;
    var kirildi = 0;

    for (var i = 0; i < VARGOR.totemler.length; i++) {
      var t = VARGOR.totemler[i];
      if (!t || !t.aktif || t.can <= 0) continue;
      var d = Math.hypot(t.x - x, t.y - y);
      if (d <= menzil + (t.r || AYAR.totemR)) {
        vurdu++;
        var once = t.can;
        t.can = Math.max(0, t.can - dmg);
        t.flashT = 0.14;
        totemCanBariGuncelle(t);
        if (window.OLAY) {
          OLAY.emit('dusmanHasar', { hedef: t, miktar: once - t.can });
          OLAY.emit('vurus', {
            hedef: t,
            x: t.x,
            y: t.y - 75,
            hasar: dmg,
            tur: tur || 'totem',
            malzeme: 'tas'
          });
        }
        if (t.can <= 0) {
          t.aktif = false;
          kirildi++;
          if (t.alev) t.alev.visible = false;
          if (t.barBg) t.barBg.visible = false;
          if (t.barDolgu) t.barDolgu.clear();
          if (t.govde) {
            t.govde.alpha = 0.42;
            t.govde.scale.y = 0.72;
          }
          if (window.OLAY) {
            OLAY.emit('totemKir', { x: t.x, y: t.y, id: t.id, kalan: aktifTotemSayisi() });
          }
        }
      }
    }

    if (kirildi > 0 && oncedenAktif > 0 && aktifTotemSayisi() === 0 && VARGOR.aktif && !VARGOR.olu) {
      kalkanKirVeSersemlet();
    }
    return vurdu;
  }

  function kalkanKirVeSersemlet() {
    if (!VARGOR.aktif || VARGOR.olu) return;
    if (VARGOR.tg) VARGOR.tg.clear();
    if (VARGOR.bagG) VARGOR.bagG.clear();
    st.durum = 'sersem';
    st.saldiri = null;
    st.sersemT = AYAR.kalkanKirSersem;
    st.acik = true;
    st.isilHedef = null;
    kuklaOynat('sersem', true);
    if (window.OYUN && OYUN.kamera && OYUN.kamera.sars) OYUN.kamera.sars(15, 0.30);
    if (window.OLAY) {
      OLAY.emit('kalkanKir', { x: VARGOR.x, y: VARGOR.y, boss: VARGOR, sure: AYAR.kalkanKirSersem });
    }
  }

  function totemleriGuncelle(dt) {
    var tZaman = (window.OYUN && OYUN.zaman) ? OYUN.zaman.t : 0;
    for (var i = 0; i < VARGOR.totemler.length; i++) {
      var t = VARGOR.totemler[i];
      if (!t) continue;
      if (t.flashT > 0) t.flashT = Math.max(0, t.flashT - dt);
      if (t.aktif && t.alev) {
        var nabiz = 0.86 + Math.sin(tZaman * 9 + t.faz) * 0.16;
        t.alev.scale.set(nabiz);
        var yuk = st.isilHedef === t ? Math.sin(tZaman * 24) * 0.15 + 0.15 : 0;
        t.alev.alpha = Math.min(1, 0.75 + Math.sin(tZaman * 12 + t.faz) * 0.18 + yuk);
      }
      if (t.sprite) {
        t.sprite.tint = t.flashT > 0 ? 0xffffff : (t.aktif ? 0xffe8d0 : 0x554444);
      }
    }

    // Vargor ile aktif totemler arasındaki titreşen alev kalkan bağı
    if (!VARGOR.bagG) return;
    var g = VARGOR.bagG;
    g.clear();
    if (!VARGOR.aktif || VARGOR.olu || !kalkanAktifMi()) return;

    var bx = VARGOR.x;
    var by = VARGOR.y - 125;

    // Vargor kor kalkanı halesi
    var kalkanR = 84 + Math.sin(tZaman * 7) * 5 + (st.kalkanFlash > 0 ? 12 : 0);
    g.lineStyle(8, 0x000000, 0.45);
    g.drawCircle(bx, by, kalkanR);
    g.lineStyle(3.5, 0xff7a22, 0.72);
    g.drawCircle(bx, by, kalkanR);
    g.lineStyle(2, 0xffe4a8, 0.65);
    g.drawCircle(bx, by, kalkanR - 5);

    for (var j = 0; j < VARGOR.totemler.length; j++) {
      var tm = VARGOR.totemler[j];
      if (!tm || !tm.aktif) continue;
      var sx = tm.x;
      var sy = tm.y - 173;
      var dx = bx - sx;
      var dy = by - sy;
      var len = Math.max(1, Math.hypot(dx, dy));
      var nx = -dy / len;
      var ny = dx / len;
      var adim = 8;

      // Siyah alt kontur
      g.lineStyle(8, 0x000000, 0.55);
      g.moveTo(sx, sy);
      for (var k = 1; k <= adim; k++) {
        var r = k / adim;
        var dalga = Math.sin(r * Math.PI * 3 + tZaman * 14 + tm.faz) * Math.sin(r * Math.PI) * 14;
        g.lineTo(sx + dx * r + nx * dalga, sy + dy * r + ny * dalga);
      }
      // Kor-turuncu ışın
      g.lineStyle(4, 0xff7a22, 0.9);
      g.moveTo(sx, sy);
      for (k = 1; k <= adim; k++) {
        r = k / adim;
        dalga = Math.sin(r * Math.PI * 3 + tZaman * 14 + tm.faz) * Math.sin(r * Math.PI) * 14;
        g.lineTo(sx + dx * r + nx * dalga, sy + dy * r + ny * dalga);
      }
      // Krem-amber çekirdek
      g.lineStyle(2, 0xffe4a8, 0.92);
      g.moveTo(sx, sy);
      for (k = 1; k <= adim; k++) {
        r = k / adim;
        dalga = Math.sin(r * Math.PI * 3 + tZaman * 14 + tm.faz) * Math.sin(r * Math.PI) * 10;
        g.lineTo(sx + dx * r + nx * dalga, sy + dy * r + ny * dalga);
      }
    }
  }

  function atilmaTotemKontrol() {
    if (!window.OYUNCU || OYUNCU.durum !== 'atil') return;
    for (var i = 0; i < VARGOR.totemler.length; i++) {
      var t = VARGOR.totemler[i];
      if (!t.aktif || st.atilVurulan.has(t)) continue;
      if (Math.hypot(t.x - OYUNCU.x, t.y - OYUNCU.y) > t.r + OYUNCU.r + 8) continue;
      st.atilVurulan.add(t);
      totemVur(t.x, t.y, 0, OYUNCU.AYAR.atilHasar, 'atil');
    }
  }

  function totemIsisiGuncelle(dt) {
    var g = VARGOR.isilG;
    if (g) g.clear();
    if (!kalkanAktifMi() || st.durum === 'sersem') return;
    st.isilSure -= dt;
    var t = st.isilHedef;
    if (t) {
      if (!t.aktif || st.isilSure <= 0) {
        st.isilHedef = null;
        st.isilSure = AYAR.isilAra;
        if (!t.aktif) return;
        var p = oyuncuKonum();
        if (window.OLAY) {
          OLAY.emit('vargorTotemPatla', { boss: VARGOR, x: t.x, y: t.y, r: AYAR.isilMenzil });
          OLAY.emit('devYereVur', { x: t.x, y: t.y, r: 75, vargor: true });
        }
        if (Math.hypot(p.x - t.x, p.y - t.y) <= AYAR.isilMenzil + p.r) oyuncuyaVur(AYAR.isilHasar, t.x, t.y, 290);
        return;
      }
      if (g) daireCiz(g, t.x, t.y, AYAR.isilMenzil, 1 - st.isilSure / AYAR.isilTele);
      return;
    }
    if (st.isilSure > 0 || st.durum !== 'dolas' || VARGOR.lavHalkalar.length) return;
    var n = VARGOR.totemler.length;
    for (var i = 0; i < n; i++) {
      var sira = st.isilSirasi++ % n;
      var aday = VARGOR.totemler[sira];
      if (!aday.aktif) continue;
      st.isilHedef = aday;
      st.isilSure = AYAR.isilTele;
      break;
    }
  }

  // ---- Saldırı Uygulamaları ----
  function korHedefleriniKitle(p) {
    var a = oyuncuAlani();
    var aci = Math.atan2(p.y - VARGOR.y, p.x - VARGOR.x);
    st.hedefAci = aci;
    VARGOR.yon = Math.cos(aci) >= 0 ? 1 : -1;
    var merkez = arenaNoktasi(p.x, p.y, a, 9);
    var dx = -Math.sin(aci), dy = Math.cos(aci);
    st.korHedefleri = [merkez];
    for (var i = 1; i < AYAR.korAdet; i++) {
      var pay = (i % 2 ? -1 : 1) * AYAR.korAyrik * Math.ceil(i / 2);
      var n = arenaNoktasi(merkez.x + dx * pay, merkez.y + dy * pay, a, 9);
      if (Math.hypot(n.x - merkez.x, n.y - merkez.y) < AYAR.korR * 2.5) {
        n = arenaNoktasi(merkez.x + Math.cos(aci) * pay + dx * pay * 0.85, merkez.y + Math.sin(aci) * pay + dy * pay * 0.85, a, 9);
      }
      if (!st.korHedefleri.some(function (h) { return Math.hypot(h.x - n.x, h.y - n.y) < AYAR.korR * 1.85; })) st.korHedefleri.push(n);
    }
  }

  function takviyeCagir(turler) {
    if (!window.DUSMAN || typeof DUSMAN.dogur !== 'function') return;
    st.takviyeler = st.takviyeler.filter(function (s) { return s.d.id === s.id && !s.d.olu; });
    var a = oyuncuAlani(), p = oyuncuKonum();
    var mevcut = st.takviyeler.length;
    for (var i = 0; i < turler.length && mevcut + i < AYAR.takviyeSinir; i++) {
      var tur = turler[i];
      var taraf = (i % 2 === 0) ? -1 : 1;
      var sx = VARGOR.x + taraf * (255 + i * 70);
      var sy = VARGOR.y + (i === 0 ? 38 : i === 1 ? 116 : -42);
      var n = arenaNoktasi(sx, sy, a, 40);
      if (Math.hypot(n.x - p.x, n.y - p.y) < 145) {
        n = arenaNoktasi(VARGOR.x - taraf * 260, VARGOR.y + (p.y > VARGOR.y ? -92 : 118), a, 40);
      }
      if (window.BOLUM && typeof BOLUM.engelIt === 'function') BOLUM.engelIt(n, 26);
      n = arenaNoktasi(n.x, n.y, a, 26);
      if (Math.hypot(n.x - p.x, n.y - p.y) < 110) continue;
      var d = DUSMAN.dogur(tur, n.x, n.y, { aci: Math.atan2(p.y - n.y, p.x - n.x) });
      if (d) st.takviyeler.push({ d: d, id: d.id });
    }
  }

  function lavHedefleriniKitle() {
    var a = oyuncuAlani(), p = oyuncuKonum();
    var yon = Math.atan2(p.y - VARGOR.y, p.x - VARGOR.x);
    st.lavHedefleri = [];
    for (var i = 0; i < AYAR.lavHavuzAdet; i++) {
      var aci = yon + i * Math.PI * 2 / AYAR.lavHavuzAdet + 0.74;
      var mes = 220 + (i % 2) * 48;
      var n = arenaNoktasi(VARGOR.x + Math.cos(aci) * mes, VARGOR.y + Math.sin(aci) * mes, a, 34);
      n.mes = Math.hypot(n.x - VARGOR.x, n.y - VARGOR.y);
      if (n.mes < 115 || st.lavHedefleri.some(function (h) { return Math.hypot(h.x - n.x, h.y - n.y) < AYAR.lavHavuzR * 1.7; })) continue;
      st.lavHedefleri.push(n);
    }
  }

  function lavHavuzuBirak(n) {
    st.lavHavuzlari = st.lavHavuzlari.filter(function (h) { return h.f.id === h.id && h.f.t < h.f.sure; });
    if (!window.DUSMAN || typeof DUSMAN.atesEkle !== 'function') return;
    var f = DUSMAN.atesEkle(n.x, n.y, AYAR.lavHavuzR, AYAR.lavHavuzSure, 'dusman');
    if (f) st.lavHavuzlari.push({ f: f, id: f.id });
  }

  function lavSondur() {
    if (!st || !window.DUSMAN) return;
    for (var i = 0; i < st.lavHavuzlari.length; i++) {
      var h = st.lavHavuzlari[i];
      DUSMAN.atesSondur(h.f, h.id);
    }
    st.lavHavuzlari.length = 0;
  }

  function takviyeleriTemizle() {
    if (!st || !window.DUSMAN) return;
    for (var i = 0; i < st.takviyeler.length; i++) {
      var s = st.takviyeler[i];
      if (s.d.id === s.id && !s.d.olu) DUSMAN.hasarVer(s.d, s.d.can, { tur: 'ates' });
    }
    st.takviyeler.length = 0;
  }

  function oyuncuyaVur(hasar, x, y, guc) {
    if (!window.OYUNCU || !OYUNCU.canli || OYUNCU.durum === 'atil') return;
    OYUNCU.hasarAl(hasar, { x: x, y: y, guc: guc, kaynak: VARGOR });
  }

  function yarmaVur() {
    var p = oyuncuKonum();
    var ux = Math.cos(st.hedefAci), uy = Math.sin(st.hedefAci);
    var dx = p.x - VARGOR.x, dy = p.y - VARGOR.y;
    var ileri = dx * ux + dy * uy, yanal = Math.abs(dy * ux - dx * uy);
    st.yarmaIzi = { x: VARGOR.x, y: VARGOR.y, ux: ux, uy: uy, t: 0 };
    if (window.OLAY) {
      OLAY.emit('devYereVur', { x: VARGOR.x + ux * 124, y: VARGOR.y + uy * 124, r: 102, vargor: true });
      OLAY.emit('vargorYarma', { boss: VARGOR, x: VARGOR.x, y: VARGOR.y, aci: st.hedefAci });
    }
    if (ileri >= -p.r && ileri <= AYAR.yarmaMenzil + p.r && yanal <= AYAR.yarmaYariGen + p.r) {
      oyuncuyaVur(AYAR.yarmaHasar, VARGOR.x, VARGOR.y, 340);
    }
  }

  function gurzVur() {
    var p = oyuncuKonum();
    var aci = st.hedefAci;
    var hx = VARGOR.x + Math.cos(aci) * 125;
    var hy = VARGOR.y + Math.sin(aci) * 60;

    if (window.OYUN && OYUN.kamera && OYUN.kamera.sars) OYUN.kamera.sars(11, 0.22);
    if (window.OLAY) {
      OLAY.emit('devSopa', {
        x: hx,
        y: hy,
        yon: VARGOR.yon,
        aci: aci,
        menzil: AYAR.gurzMenzil,
        vargor: true
      });
    }

    if (p.z < 42 && koniIcinde(p.x, p.y, VARGOR.x, VARGOR.y, aci, AYAR.gurzMenzil + p.r, AYAR.gurzYariAci)) {
      oyuncuyaVur(AYAR.gurzHasar, VARGOR.x, VARGOR.y, 450);
    }
  }

  function korKureAt() {
    var sx = VARGOR.x + VARGOR.yon * 36;
    var sy = VARGOR.y - 8;
    var noktalar = st.korHedefleri;

    if (window.OYUN && OYUN.kamera && OYUN.kamera.sars) OYUN.kamera.sars(8, 0.16);
    if (window.OLAY) {
      OLAY.emit('devKaya', {
        x: sx,
        y: sy,
        hedefX: noktalar[0].x,
        hedefY: noktalar[0].y,
        adet: noktalar.length,
        vargor: true
      });
      OLAY.emit('vargorKorAt', { boss: VARGOR });
    }

    if (!window.MERMI || typeof MERMI.at !== 'function') return;
    for (var i = 0; i < noktalar.length; i++) {
      var n = noktalar[i];
      var mes = Math.hypot(n.x - sx, n.y - sy);
      var yaySure = clamp(mes / AYAR.korHiz, 0.45, 0.9);
      var m = MERMI.at('kor_kure', sx, sy, Math.atan2(n.y - sy, n.x - sx), {
        tur: 'kor_kure',
        sahip: 'dusman',
        hasar: AYAR.korHasar,
        r: AYAR.korR,
        z: AYAR.korElY,
        hiz: AYAR.korHiz,
        kaynak: VARGOR,
        yay: {
          x: n.x,
          y: n.y,
          sure: yaySure,
          yukseklik: AYAR.korYukseklik,
          z0: AYAR.korElY
        }
      });
      if (m) {
        m._vargorOnceX = m.x;
        m._vargorOnceY = m.y;
        korKureGorselSusle(m, AYAR.korR);
      }
    }
  }

  function kukrePatlat() {
    var p = oyuncuKonum();
    if (window.OYUN && OYUN.kamera && OYUN.kamera.sars) OYUN.kamera.sars(14, 0.30);
    if (window.OLAY) {
      OLAY.emit('devKukre', {
        x: VARGOR.x,
        y: VARGOR.y,
        evre: VARGOR.evre,
        vargor: true
      });
    }

    if (Math.hypot(p.x - VARGOR.x, p.y - VARGOR.y) <= AYAR.kukreItmeMenzil + p.r) oyuncuyaVur(AYAR.kukreItmeHasar, VARGOR.x, VARGOR.y, 520);

    if (st.kukreTotemAdet > 0) {
      totemDik(st.kukreTotemAdet);
      st.kukreTotemAdet = 0;
    }
    if (st.kukreTakviye) {
      takviyeCagir(st.kukreTakviye);
      st.kukreTakviye = null;
    }
  }

  function lavDalgaBaslat() {
    if (window.OYUN && OYUN.kamera && OYUN.kamera.sars) OYUN.kamera.sars(15, 0.32);
    if (window.OLAY) {
      OLAY.emit('devYereVur', {
        x: VARGOR.x,
        y: VARGOR.y,
        r: 110,
        vargor: true
      });
    }

    VARGOR.lavHalkalar.push({
      x: VARGOR.x,
      y: VARGOR.y,
      r: AYAR.lavBasR,
      basR: AYAR.lavBasR,
      maxR: AYAR.lavMaxR,
      sure: AYAR.lavYaySure,
      t: 0,
      vurdu: false,
      havuzlar: st.lavHedefleri.slice()
    });
  }

  function yarmaIziCiz(g, dt) {
    var iz = st.yarmaIzi;
    if (!iz) return;
    iz.t += dt;
    if (iz.t >= 0.4) { st.yarmaIzi = null; return; }
    var opak = 1 - iz.t / 0.4;
    var gen = AYAR.yarmaYariGen;
    var nx = -iz.uy * gen, ny = iz.ux * gen;
    var dx = iz.ux * AYAR.yarmaMenzil, dy = iz.uy * AYAR.yarmaMenzil;
    var x = iz.x, y = iz.y;
    g.lineStyle(4, 0x200a05, 0.8 * opak);
    g.beginFill(0xd64013, 0.42 * opak);
    g.drawPolygon([x + nx, y + ny, x + dx + nx, y + dy + ny, x + dx - nx, y + dy - ny, x - nx, y - ny]);
    g.endFill();
    g.lineStyle(5.5, 0xff8e36, 0.9 * opak);
    g.moveTo(x, y);
    for (var i = 1; i <= 9; i++) {
      var oran = i / 9, sapma = i === 9 ? 0 : Math.sin(i * 12.4) * (0.13 + oran * 0.27);
      g.lineTo(x + dx * oran + nx * sapma, y + dy * oran + ny * sapma);
    }
  }

  function zeminSaldirilariGuncelle(dt) {
    if (VARGOR.lavG) {
      VARGOR.lavG.clear();
      yarmaIziCiz(VARGOR.lavG, dt);
    }
    if (!VARGOR.lavHalkalar.length) return;

    var p = oyuncuKonum();
    var pDokunulmaz = !!(window.OYUNCU && (OYUNCU.durum === 'atil' || (OYUNCU.dokunulmazSure || 0) > 0 || (p.z || 0) >= AYAR.lavZiplamaEsik));

    for (var i = VARGOR.lavHalkalar.length - 1; i >= 0; i--) {
      var h = VARGOR.lavHalkalar[i];
      h.t += dt;
      var oran = clamp(h.t / h.sure, 0, 1);
      var oncekiR = h.r;
      h.r = h.basR + (h.maxR - h.basR) * oran;
      for (var hi = h.havuzlar.length - 1; hi >= 0; hi--) {
        var havuz = h.havuzlar[hi];
        if (h.r < havuz.mes) continue;
        lavHavuzuBirak(havuz);
        h.havuzlar.splice(hi, 1);
      }

      if (!h.vurdu && window.OYUNCU && OYUNCU.canli && !pDokunulmaz) {
        var mes = Math.hypot(p.x - h.x, p.y - h.y);
        var pay = AYAR.lavKalinlik * 0.5 + p.r;
        if (mes >= oncekiR - pay && mes <= h.r + pay) {
          h.vurdu = true;
          oyuncuyaVur(AYAR.lavHasar, h.x, h.y, 380);
        }
      }

      if (VARGOR.lavG && VARGOR.aktif && !VARGOR.olu) {
        var g = VARGOR.lavG;
        var solma = 1 - oran * 0.25;
        // Dış parlak alev bandı
        g.lineStyle(AYAR.lavKalinlik, 0xff5a12, 0.34 * solma);
        g.drawCircle(h.x, h.y, h.r);
        // Siyah alt kontur
        g.lineStyle(8, 0x000000, 0.6 * solma);
        g.drawCircle(h.x, h.y, h.r);
        // Parlak kor-turuncu halka
        g.lineStyle(4, 0xff7a22, 0.96 * solma);
        g.drawCircle(h.x, h.y, h.r);
        // Krem-amber tepe yayı
        g.lineStyle(2.5, 0xffe4a8, 0.95 * solma);
        g.drawCircle(h.x, h.y, h.r + 3);
      }

      if (oran >= 1) VARGOR.lavHalkalar.splice(i, 1);
    }
  }

  function korHedefSec(m, aci) {
    var hedef = VARGOR, en = Infinity;
    for (var i = 0; i < VARGOR.totemler.length; i++) {
      var t = VARGOR.totemler[i];
      if (!t.aktif) continue;
      var dx = t.x - m.x, dy = t.y - m.y;
      var skor = Math.hypot(dx, dy) * 0.65 + Math.abs(normAci(Math.atan2(dy, dx) - aci)) * 105;
      if (skor < en) { en = skor; hedef = t; }
    }
    return hedef;
  }

  function koruHedefeYonelt(m, hedef) {
    var dx = hedef.x - m.x, dy = hedef.y - m.y;
    var hiz = AYAR.korSekmeHiz / Math.max(1, Math.hypot(dx, dy));
    m.vx = dx * hiz;
    m.vy = dy * hiz;
  }

  function korSektir(e) {
    if (!VARGOR.aktif || VARGOR.olu || !e || e.tur !== 'kor_kure' || !window.MERMI) return;
    // Savurma olayı ortak mermi güncellemesinden önce gelir.
    for (var i = MERMI.liste.length - 1; i >= 0; i--) {
      var m = MERMI.liste[i];
      if (m.kaynak !== VARGOR || m.sahip !== 'oyuncu' || m.kilitliHedef || m.x !== e.x || m.y !== e.y) continue;
      m.kilitliHedef = korHedefSec(m, e.aci);
      m._vargorOnceX = m.x; m._vargorOnceY = m.y;
      m.hasar = AYAR.korSekmeHasar;
      korKureGorselSusle(m, m.r, true);
      koruHedefeYonelt(m, m.kilitliHedef);
      break;
    }
  }

  function korMermileriGuncelle() {
    if (!window.MERMI || !Array.isArray(MERMI.liste)) return;
    for (var i = MERMI.liste.length - 1; i >= 0; i--) {
      var m = MERMI.liste[i];
      if (m.tur !== 'kor_kure' || m.kaynak !== VARGOR || m.sahip !== 'oyuncu') continue;
      var hedef = m.kilitliHedef;
      if (!hedef) {
        m._vargorOnceX = m.x; m._vargorOnceY = m.y;
        korKureGorselSusle(m, m.r, true);
      }
      if (!hedef || (hedef !== VARGOR && !hedef.aktif)) {
        hedef = m.kilitliHedef = korHedefSec(m, Math.atan2(m.vy, m.vx));
        m.hasar = AYAR.korSekmeHasar;
      }
      var dx = m.x - m._vargorOnceX, dy = m.y - m._vargorOnceY;
      var l2 = dx * dx + dy * dy;
      var u = l2 > 0 ? clamp(((hedef.x - m._vargorOnceX) * dx + (hedef.y - m._vargorOnceY) * dy) / l2, 0, 1) : 0;
      var cx = m._vargorOnceX + dx * u, cy = m._vargorOnceY + dy * u;
      if (hedef !== VARGOR && Math.hypot(hedef.x - cx, hedef.y - cy) <= hedef.r + m.r) {
        totemVur(hedef.x, hedef.y, 0, m.hasar, 'sekme');
        if (window.OLAY) OLAY.emit('mermiVur', { tur: m.tur, x: hedef.x, y: hedef.y, sahip: m.sahip });
        MERMI.birak(m);
        continue;
      }
      m._vargorOnceX = m.x; m._vargorOnceY = m.y;
      koruHedefeYonelt(m, hedef);
    }
  }

  // ---- Saldırı Durum Makinesi ----
  function saldir(tur) {
    if (!VARGOR.aktif || VARGOR.olu || !bolumIkiMi()) return false;
    var norm = String(tur || '').toLowerCase();
    if (norm === 'supurme' || norm === 'gurz') norm = 'vur';
    else if (norm === 'kor' || norm === 'kor_kure') norm = 'kayaat';
    else if (norm === 'lav' || norm === 'lav_dalga' || norm === 'dalga') norm = 'yerevur';

    var p = oyuncuKonum();
    var yonAci = Math.atan2(p.y - VARGOR.y, p.x - VARGOR.x);
    if (p.x !== VARGOR.x) VARGOR.yon = p.x >= VARGOR.x ? 1 : -1;
    if (VARGOR.kukla && st.kuklaTur === 'geo') VARGOR.kukla.yon = VARGOR.yon;

    st.durum = 'tele';
    st.saldiri = norm;
    st.sayac = 0;
    st.vurdu = false;
    st.kukreTotemAdet = 0;
    st.kukreTakviye = null;
    st.hedefAci = yonAci;

    if (norm === 'vur') {
      st.teleSure = AYAR.gurzTele;
      kuklaOynat('vur', true);
    } else if (norm === 'kayaat') {
      st.teleSure = AYAR.korTele;
      korHedefleriniKitle(p);
      kuklaOynat('kayaat', true);
    } else if (norm === 'yarma') {
      st.teleSure = AYAR.yarmaTele;
      kuklaOynat('yerevur', true);
    } else if (norm === 'kukre') {
      st.teleSure = AYAR.kukreTele;
      kuklaOynat('kukre', true);
    } else if (norm === 'yerevur') {
      st.teleSure = AYAR.lavTele;
      lavHedefleriniKitle();
      kuklaOynat('yerevur', true);
    } else {
      st.saldiri = 'vur';
      st.teleSure = AYAR.gurzTele;
      kuklaOynat('vur', true);
    }
    return true;
  }

  function evreGecisi() {
    if (st.hedefEvre <= VARGOR.evre || st.durum === 'sersem' || st.durum === 'tele' || kalkanAktifMi()) return false;
    VARGOR.evre++;
    saldir('kukre');
    st.kukreTotemAdet = VARGOR.evre;
    st.kukreTakviye = TAKVIYELER[VARGOR.evre - 1];
    st.sonKorT = -10;
    st.saldiriSira = 0;
    return true;
  }

  function planSec(mes) {
    if (st.isilHedef) return; // Aynı anda iki farklı kaçınma uyarısı verme.
    var t = OYUN.zaman.t;
    var sira = SALDIRI_SIRASI[VARGOR.evre - 1];
    for (var i = 0; i < sira.length; i++) {
      var ix = (st.saldiriSira + i) % sira.length, ad = sira[ix];
      if (ad === 'yerevur') {
        if (mes > AYAR.lavMaxR + 30 || t - st.sonLavT < AYAR.lavBekleme) continue;
        st.sonLavT = t;
      } else if (ad === 'kayaat') {
        if (mes < (kalkanAktifMi() ? 105 : 155) || t - st.sonKorT < AYAR.korBekleme) continue;
        st.sonKorT = t;
      } else if (ad === 'yarma') {
        if (mes < 145 || mes > AYAR.yarmaMenzil || t - st.sonYarmaT < AYAR.yarmaBekleme) continue;
        st.sonYarmaT = t;
      } else {
        if (mes > AYAR.gurzMenzil || t - st.sonGurzT < AYAR.gurzBekleme) continue;
        st.sonGurzT = t;
      }
      st.saldiriSira = (ix + 1) % sira.length;
      saldir(ad);
      return;
    }
  }

  // ---- Hasar, Evre Geçişleri ve Ölüm ----
  function hasarAl(miktar, ops) {
    if (!VARGOR.aktif || VARGOR.olu || !bolumIkiMi()) return 0;
    var dmg = Math.max(0, isFinite(miktar) ? miktar : 0);
    if (dmg <= 0) return 0;

    var kalkan = kalkanAktifMi();
    var totemKuruluyor = st.kukreTotemAdet > 0;
    if (kalkan) {
      dmg *= AYAR.kalkanOran;
      st.kalkanFlash = 0.16;
    } else if (st.acik) {
      dmg *= AYAR.kalkanKirCarpan;
    }

    // Totemlerin kurulması ve son evre, bekleyen bir darbeyle atlanamaz.
    var altSinir = VARGOR.evre < 3 || kalkan || totemKuruluyor ? 1 : 0;
    if (VARGOR.evre === 2 && (kalkan || totemKuruluyor)) altSinir = Math.floor(VARGOR.canMax * AYAR.evre3);
    var once = VARGOR.can;
    var net = Math.min(Math.max(0, once - altSinir), Math.max(1, Math.round(dmg)));
    if (net === 0) {
      if (window.OLAY) OLAY.emit('blok', { hedef: VARGOR, x: VARGOR.x, y: VARGOR.y - 88, aci: ops && ops.aci, vargor: true });
      return { oldu: false, blok: true };
    }
    VARGOR.can = once - net;
    if (window.OLAY) OLAY.emit('dusmanHasar', { hedef: VARGOR, miktar: net });
    st.vurFlash = 0.12;

    // Seken kor küresi kalkansızken kısa tökezletme uygular
    if (ops && ops.tur === 'sekme' && miktar >= AYAR.korSekmeHasar && !kalkan && !totemKuruluyor && VARGOR.can > 0 && st.durum !== 'sersem' && st.durum !== 'olum') {
      if (VARGOR.tg) VARGOR.tg.clear();
      st.durum = 'sersem';
      st.saldiri = null;
      st.sersemT = AYAR.korSekmeSersem;
      kuklaOynat('sersem', true);
    }

    if (VARGOR.can <= 0) {
      olumBasla();
      return net;
    }

    var oran = VARGOR.can / VARGOR.canMax;
    if (oran <= AYAR.evre3) st.hedefEvre = 3;
    else if (oran <= AYAR.evre2) st.hedefEvre = Math.max(st.hedefEvre, 2);
    return net;
  }

  function olumBasla() {
    if (VARGOR.olu) return;
    VARGOR.can = 0;
    VARGOR.aktif = false;
    VARGOR.canli = false;
    VARGOR.olu = true;

    dusmanListedenCikar();
    totemSondurHepsi();
    lavSondur();
    // Son darbeyi bir mermi indirmiş olabilir. Ortak mermi döngüsü bitmeden listeyi değiştirme.
    st.olumTemizlenecek = true;
    if (window.MERMI) {
      for (var i = 0; i < MERMI.liste.length; i++) {
        var m = MERMI.liste[i];
        if (vargorMermisiMi(m)) m.hasar = 0;
      }
    }
    if (VARGOR.isilG) VARGOR.isilG.clear();
    if (VARGOR.tg) VARGOR.tg.clear();
    if (VARGOR.bagG) VARGOR.bagG.clear();
    if (VARGOR.lavG) VARGOR.lavG.clear();
    VARGOR.lavHalkalar.length = 0;

    st.durum = 'olum';
    st.saldiri = null;
    st.olumT = 0;
    st.kazandiYayildi = false;
    kuklaOynat('ol', true);

    if (window.OYUN && OYUN.kamera && OYUN.kamera.sars) OYUN.kamera.sars(22, 0.65);
    if (window.OYUN && OYUN.zaman && OYUN.zaman.yavaslat) OYUN.zaman.yavaslat(0.28, 0.35);
    if (window.OLAY) {
      OLAY.emit('devOldu', {
        bolum: 2,
        ad: 'VARGOR',
        x: VARGOR.x,
        y: VARGOR.y,
        boss: VARGOR
      });
    }
  }

  // ---- Yaşam Döngüsü ----
  function olaylariBagla() {
    if (_olayBagli || !window.OLAY || typeof OLAY.on !== 'function') return;
    _olayBagli = true;

    OLAY.on('bolum', function () {
      sifirla();
    });

    OLAY.on('sektir', korSektir);
    OLAY.on('atil', function () { if (st) st.atilVurulan.clear(); });
  }

  function sistemBaslat() {
    olaylariBagla();
    if (!st) st = yeniDurum();
    sifirla();
  }

  function basla(bx, by) {
    if (!bolumIkiMi()) return null;
    olaylariBagla();
    sifirla();
    if (!st) st = yeniDurum();

    var kam = (window.OYUN && OYUN.kamera) || { x: 0, y: 0 };
    var W = (window.OYUN && OYUN.W) || 1280;
    var a = alan();

    var x0 = isFinite(bx) ? bx : ((kam.x || 0) + W * 0.72);
    var y0 = isFinite(by) ? by : Math.round((a.ust + a.alt) * 0.5);
    y0 = Math.max(y0, ustSinirY(), AYAR.ustPay);

    st.arenaMerkezX = isFinite(bx) ? Math.max((kam.x || 0) + W * 0.5, bx - 180) : ((kam.x || 0) + W * 0.5);

    VARGOR.x = x0;
    VARGOR.y = y0;
    VARGOR.r = AYAR.r;
    VARGOR.yon = -1;
    VARGOR.canMax = AYAR.canMax;
    VARGOR.can = AYAR.canMax;
    VARGOR.evre = 1;
    VARGOR.aktif = true;
    VARGOR.olu = false;
    VARGOR.canli = true;

    st.durum = 'dolas';
    st.sonGurzT = -1;
    st.sonKorT = -1.5;
    st.sonLavT = -2;

    kuklaKur();
    konumKistir();
    dusmanListeyeEkle();
    kuklaOynat('dur', true);

    if (window.OLAY) {
      OLAY.emit('devBasla', {
        bolum: 2,
        ad: 'VARGOR',
        unvan: VARGOR.unvan,
        boss: VARGOR,
        evre2: AYAR.evre2,
        evre3: AYAR.evre3,
        x: VARGOR.x,
        y: VARGOR.y
      });
    }
    return VARGOR;
  }

  function guncelle(dt) {
    if (!bolumIkiMi()) {
      if (VARGOR.aktif || VARGOR.olu) sifirla();
      return;
    }
    if (!st) st = yeniDurum();

    // Ölüm animasyonu & zafer zamanlayıcısı (VARGOR.aktif === false olsa bile akar)
    if (VARGOR.olu && st.durum === 'olum') {
      if (st.olumTemizlenecek) {
        st.olumTemizlenecek = false;
        mermiTemizle();
        takviyeleriTemizle();
      }
      var rdt = (window.OYUN && OYUN.zaman && OYUN.zaman.gercekDt) || dt;
      st.olumT += rdt;
      if (st.kuklaTur === 'geo' && VARGOR.kukla && VARGOR.kukla.guncelle) VARGOR.kukla.guncelle(rdt);
      if (st.olumT >= AYAR.kazanmaGecikme && !st.kazandiYayildi) {
        st.kazandiYayildi = true;
        if (window.OLAY) {
          OLAY.emit('kazandi', { bolum: 2, ad: 'VARGOR', boss: VARGOR });
        }
        try { if (window.OYUN && typeof OYUN.durumYap === 'function') OYUN.durumYap('kazandi'); } catch (e) {}
      }
      return;
    }

    // Normal arena girişini bölüm sistemi yönetir.
    if (!VARGOR.aktif) {
      if (!VARGOR.olu && paramAcik('dev')) {
        st.otoDevT += dt;
        if (st.otoDevT >= 0.25) basla();
      }
      return;
    }

    if (st.vurFlash > 0) st.vurFlash = Math.max(0, st.vurFlash - dt);
    if (st.kalkanFlash > 0) st.kalkanFlash = Math.max(0, st.kalkanFlash - dt);
    if (st.yonDegisT > 0) st.yonDegisT = Math.max(0, st.yonDegisT - dt);

    // Eğer varlik/vargor.js sonradan yüklendiyse geometrik fallback'ten gerçek atlasa geç
    if (st.kuklaTur === 'geo' && vargorPaketHazirMi()) {
      kuklaKur();
    }

    atilmaTotemKontrol();
    korMermileriGuncelle();
    totemIsisiGuncelle(dt);
    totemleriGuncelle(dt);
    zeminSaldirilariGuncelle(dt);

    if (!VARGOR.aktif || VARGOR.olu) return;
    evreGecisi();

    var p = oyuncuKonum();
    var dx = p.x - VARGOR.x;
    var dy = p.y - VARGOR.y;
    var mes = Math.max(1, Math.hypot(dx, dy));

    if (st.durum === 'sersem') {
      st.sersemT -= dt;
      kuklaOynat('sersem', false);
      if (st.sersemT <= 0) {
        st.durum = 'dolas';
        st.acik = false;
        kuklaOynat('dur', true);
      }
    } else if (st.durum === 'tele') {
      st.sayac += dt;
      var kilitPayi = st.saldiri === 'vur' ? AYAR.gurzKilit : st.saldiri === 'yarma' ? AYAR.yarmaKilit : null;
      if (kilitPayi !== null && st.teleSure - st.sayac > kilitPayi) st.hedefAci = Math.atan2(dy, dx);
      if (st.saldiri === 'kayaat' && st.teleSure - st.sayac > AYAR.korKilit) korHedefleriniKitle(p);
      if (st.sonAnim) kuklaOynat(st.sonAnim, false);

      if (st.sayac >= st.teleSure && !st.vurdu) {
        st.vurdu = true;
        if (VARGOR.tg) VARGOR.tg.clear();
        if (st.saldiri === 'vur') {
          gurzVur();
          st.teleSure = AYAR.gurzToparla;
        } else if (st.saldiri === 'kayaat') {
          korKureAt();
          st.teleSure = AYAR.korToparla;
        } else if (st.saldiri === 'yarma') {
          yarmaVur();
          st.teleSure = AYAR.yarmaToparla;
        } else if (st.saldiri === 'kukre') {
          kukrePatlat();
          st.teleSure = AYAR.kukreToparla;
        } else if (st.saldiri === 'yerevur') {
          lavDalgaBaslat();
          st.teleSure = AYAR.lavToparla;
        }
        st.durum = 'toparla';
        toparlanmaAnimasyonu(st.teleSure);
        st.sayac = 0;
      }
    } else if (st.durum === 'toparla') {
      st.sayac += dt;
      if (st.sayac >= st.teleSure) {
        st.durum = 'dolas';
        st.saldiri = null;
        kuklaOynat('dur', true);
      }
    } else {
      // 'dolas' — oyuncuyu takip et ve saldırı seç
      if (Math.abs(dx) >= 22 && st.yonDegisT <= 0) {
        var yeniYon = dx >= 0 ? 1 : -1;
        if (yeniYon !== VARGOR.yon) {
          VARGOR.yon = yeniYon;
          st.yonDegisT = 0.25;
        }
      }
      if (VARGOR.kukla && st.kuklaTur === 'geo') VARGOR.kukla.yon = VARGOR.yon;

      var hiz = VARGOR.evre >= 3 ? AYAR.hiz3 : (VARGOR.evre === 2 ? AYAR.hiz2 : AYAR.hiz1);
      if (mes > 175) {
        VARGOR.x += (dx / mes) * hiz * dt;
        VARGOR.y += (dy / mes) * hiz * 0.75 * dt;
        kuklaOynat('yuru', false);
      } else {
        kuklaOynat('dur', false);
      }
      planSec(mes);
    }

    konumKistir();
    telgrafCiz();
    kuklaRenkGuncelle();
    if (st.kuklaTur === 'geo' && VARGOR.kukla && VARGOR.kukla.guncelle) VARGOR.kukla.guncelle(dt);
  }

  function sifirla() {
    dusmanListedenCikar();
    totemTemizle();
    mermiTemizle();
    lavSondur();
    takviyeleriTemizle();

    if (VARGOR.kukla && typeof VARGOR.kukla.sil === 'function') {
      try { VARGOR.kukla.sil(); } catch (e) {}
    }
    gorseliSil(VARGOR.kap);
    gorseliSil(VARGOR.golge);
    gorseliSil(VARGOR.tg);
    gorseliSil(VARGOR.bagG);
    gorseliSil(VARGOR.lavG);
    gorseliSil(VARGOR.isilG);

    VARGOR.kap = null;
    VARGOR.sprite = null;
    VARGOR.kukla = null;
    VARGOR.golge = null;
    VARGOR.tg = null;
    VARGOR.bagG = null;
    VARGOR.lavG = null;
    VARGOR.isilG = null;
    VARGOR.lavHalkalar.length = 0;

    VARGOR.aktif = false;
    VARGOR.olu = false;
    VARGOR.canli = false;
    VARGOR.canMax = AYAR.canMax;
    VARGOR.can = AYAR.canMax;
    VARGOR.evre = 1;
    VARGOR.x = 0;
    VARGOR.y = 0;
    VARGOR.yon = -1;

    st = yeniDurum();
  }

  function bilgi() {
    return {
      aktif: VARGOR.aktif,
      olu: VARGOR.olu,
      bolum: window.OYUN ? OYUN.bolum : 0,
      ad: VARGOR.ad,
      unvan: VARGOR.unvan,
      can: VARGOR.can,
      canMax: VARGOR.canMax,
      evre: VARGOR.evre,
      x: Math.round(VARGOR.x),
      y: Math.round(VARGOR.y),
      kalkan: kalkanAktifMi(),
      aktifTotem: aktifTotemSayisi(),
      toplamTotem: VARGOR.totemler.length,
      durum: st ? st.durum : 'yok',
      saldiri: st && st.saldiri,
      acik: !!(st && st.acik),
      korHedefleri: st ? st.korHedefleri : [],
      isilHedef: st && st.isilHedef ? st.isilHedef.id : null,
      takviye: st ? st.takviyeler.filter(function (s) { return !s.d.olu && s.d.id === s.id; }).length : 0
    };
  }

  window.VARGOR = VARGOR;

  if (window.OYUN && typeof OYUN.sistem === 'function') {
    OYUN.sistem('vargor', {
      baslat: sistemBaslat,
      guncelle: guncelle,
      sifirla: sifirla,
      bilgi: bilgi
    });
  }
})();
