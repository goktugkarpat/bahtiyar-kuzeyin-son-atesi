/* oyuncu.js — Barbar: hareket, savurma zinciri, sektirme, balta, atılma, öfke, can, ?oto.
   Global: OYUNCU. Efekt/ses çağırmaz; yalnız OLAY yayar (+ OYUN.zaman.dondur / OYUN.kamera.sars). */
(function () {
  'use strict';

  // ---------------------------------------------------------------- AYAR (ince ayar burada)
  var AYAR = {
    canMax: 100,
    r: 18,
    hiz: 235,              // px/sn
    ivme: 22,              // hedef hıza yaklaşma (1/sn); büyük = keskin
    disSonum: 11,          // itilme/öne adım hızının sönümü (1/sn)
    savurHareket: 0.45,    // savururken yürüme hızı çarpanı
    boyOlcek: 1.10,        // barbar ekranda %10 iri çizilir (19 Kasım, ebeveyn); oynanış ölçüleri (menzil, çarpışma, hız) aynı
    nisanYuksek: 40,       // nişan, ayaktan bu kadar yukarıdan (göğüs) hesaplanır (barbar ~108 px)
    // savurma zinciri: [vur (sağdan sola), vur2 (soldan sağa), vur3 (geniş bitirici)]
    // adim: hedef yokken öne adım itişi (px/sn; yer değiştirme ≈ adim / disSonum)
    zincir: [
      { anim: 'vur',  hasar: 14, guc: 280, yay: 150, menzil: 98,  hazir: 0.06,  etkin: 0.085, toparla: 0.15, adim: 190, teget: 0.34 },
      { anim: 'vur2', hasar: 17, guc: 330, yay: 160, menzil: 102, hazir: 0.06,  etkin: 0.085, toparla: 0.15, adim: 210, teget: -0.38 },
      { anim: 'vur',  hasar: 32, guc: 720, yay: 215, menzil: 124, hazir: 0.095, etkin: 0.11,  toparla: 0.24, adim: 320, teget: 0.20, agir: true }
    ],
    zincirPencere: 0.38,   // toparlanma bitince sonraki vuruş için süre
    zincirKes: 0.47, zincirKesAgir: 0.25,   // sıradaki vuruş tamponlandıysa/tuş basılıysa toparlanmanın son bu kadarı kesilir (tık→hazırlık ≤ 80 ms, tutarlı ritim)
    // vuruş duraksaması (sn) — isabet sayısı/öldürmeye göre artan eğri: tek goblinde hafif, kalabalıkta doyurucu
    donTaban: 0, donEk: 0, donOldur: 0, donEn: 0,   // 5. tur: vuruşta duraksama YOK (ebeveyn: takılma gibi)
    donAgir: 0, donAgirEk: 0, donAgirEn: 0,
    sarsTaban: 0, sarsEk: 0.5, sarsEn: 2, sarsAgir: 3.5, sarsAgirEk: 0.5, sarsAgirEn: 5,   // 5. tur: hafif vuruşta sarsıntı yok, ağırda ölçülü
    agirYavas: 1, agirYavasSure: 0,   // bitirici isabette kısa ağır çekim (ölçek, gerçek sn)
    // öne adım + hedefe mıknatıs: hedefle arayı bu boşluğa kadar kapatır (en çok miknatisEn px)
    hedefBosluk: 22, miknatisEn: 44, miknatisMenzil: 60,
    nisanYardim: 18,       // derece; savururken en yakın düşmana bu kadar dönebilir
    tampon: 0.15,          // girdi tamponu (sn)
    baltaTampon: 0.3,      // balta elde yokken basılan sol tık, balta bu kadar içinde dönerse vuruşa dönüşür (sn)
    hizliPencere: 0.25, hizliHazir: 0.55,   // atılma bitişi / balta yakalama sonrası bu süre içindeki vuruşun hazırlığı kısalır
    // sektirme
    sektirHiz: 1.4, sektirErken: 0.03 /*sn; hazırlığın son anından itibaren sayılır*/,
    sektirKusursuz: 75 /*px; mermi bu kadar yakınken sektirilirse "tam zamanında"*/, sektirKusursuzHiz: 1.85, sektirKusursuzOfke: 4, sektirHedefYay: 55 /*derece*/,
    // balta
    // 19 Kasım balta turu: delip geçer (gidişte/dönüşte herkese bir kez), gidiş 18 → 30, dönüş ≈35
    baltaHiz: 770, baltaMenzil: 520, baltaDonHiz: 800, baltaHasar: 30, baltaGuc: 220, baltaR: 22, baltaDon: 22 /*rad/sn*/,
    baltaDonR: 30, baltaDonHasar: 1.17, baltaDonGuc: 300,   // dönen balta yolundakileri biçer
    baltaBekle: 0.3,       // menzil sonunda havada dönerek bekleme (sn): oyuncu konum alıp geri çağırabilsin
    baltaCagirEn: 0.12,    // atıştan sonra bu kadar sn geçmeden ikinci sağ tık geri çağırmaz (yanlış tetik)
    baltaOfkeTaban: 16,    // balta isabetinin öfkesi savurmayla orantılı: ofkeIsabet × hasar / bu (en çok 2 kat)
    baltaAtSure: 0.18, baltaSekmeCarpan: 0.80, baltaKavis: 240,
    yakalaDondur: 0.022, yakalaSars: 2.2,
    // atılma (savurmanın hazırlığını/toparlanmasını, fırlatmanın sonunu ve sersemlemenin sonunu keser)
    atilMesafe: 260, atilSure: 0.16, atilBekle: 0.9, atilEkDokunulmaz: 0.1, atilHasar: 10, atilGuc: 420,
    // hasar alma
    dokunulmaz: 0.5, sersemSure: 0.14, sersemKacis: 0.07, itilme: 260, hasarDondur: 0.035,
    olumDondur: 0.12, olumYavas: 0.3, olumYavasSure: 0.7,
    // öfke
    ofkeIsabet: 1.2, ofkeOldur: 2.2, ofkeHasarAl: 0.5, ofkeAzal: 0.8 /*/sn*/, ofkeAzalBekle: 3,
    ofkeSure: 6, ofkeHiz: 1.2, ofkeHasar: 1.6, ofkeYay: 200, ofkeMenzil: 125, ofkeKalkan: 0.3,
    ofkeCanCalma: 0.15, ofkeCanSiniri: 40,
    ofkeTempo: 1.2,        // öfkede savurma bu kat hızlı
    kasirga: { ofkeSaniye: 8, hazirlik: 0.07, donus: 0.28, toparlan: 0.16, menzil: 158, hasar: 26, guc: 165, kesilmeGucu: 360 },
    ofkeAcSars: 11, ofkeDalgaR: 180, ofkeDalgaGuc: 560, ofkeDalgaHasar: 8, ofkeAcDokunulmaz: 0.35, ofkeKukre: 0.43,
    // ?oto: "ortalama insan" tepki gecikmesi (sn); ?otoGecikme=300 (ms) ile ayarlanır
    otoGecikme: 0,
    adimAralik: 0.3,
    // his / animasyon (oynanışı değiştirmez)
    yonPay: 12,            // derece; 8 yön sınırında titreme önleyici pay
    donusAdim: 0.028,      // sn; bakış yönü her bu kadar sürede bir dilim döner (180° ≈ 0,11 sn)
    yuruBasla: 28, yuruBit: 48,   // gerçek hız (px/sn) eşikleri: kalkış ve duruş
    yuruItme: 125,         // tuşa basılmadan (itilirken/kayarken) yürüme pozu için gereken hız
    nisanYakin: 46,        // px; imleç göğse bu kadar yakınsa bakış değişmez
    vurusOran: 0.5,        // paket vurusKare vermezse vuruş anı karesi = n × bu
    kilitPay: 0.12,        // sn; atılma/fırlatma/sersem pozu, durum bitince en çok bu kadar daha oynar
    hasarParla: 0.12,      // sn; hasar alınca kırmızı parlama
    baltaBirak: 0.06,      // sn; fırlatma pozunda balta elden bu kadar sonra çıkar (paket birakKare verirse)
    yerKisalma: 0.78       // eğik kamera: yerdeki dikey adım ekranda bu oranda kısa görünür (paket adimDikey verirse o kullanılır)
  };

  var PI = Math.PI, D2R = PI / 180;
  function aciFark(a, b) { var d = a - b; while (d > PI) d -= 2 * PI; while (d < -PI) d += 2 * PI; return d; }
  function prm(ad) { try { return OYUN.param ? OYUN.param(ad) : null; } catch (e) { return null; } }
  function varmi(ad) { var v = prm(ad); return v !== null && v !== undefined && v !== false; }
  function emit(ad, v) { if (window.OLAY) OLAY.emit(ad, v); }
  function dondur(s) { if (OYUN.zaman && OYUN.zaman.dondur) OYUN.zaman.dondur(s); }
  function sars(g, s) { if (OYUN.kamera && OYUN.kamera.sars) OYUN.kamera.sars(g, s); }
  function dusmanlar(x, y, r) {
    var res = [];
    if (window.DUSMAN) {
      if (DUSMAN.yakindakiler) res = DUSMAN.yakindakiler(x, y, r) || [];
      else if (DUSMAN.liste) res = DUSMAN.liste.filter(function (d) { return !d.olu && Math.hypot(d.x - x, d.y - y) < r + (d.r || 20); });
    }
    var ek = [window.DEV, window.VARGOR];
    for (var i = 0; i < ek.length; i++) {
      var b = ek[i];
      if (b && b.aktif && !b.olu && isFinite(b.x) && isFinite(b.y) && res.indexOf(b) < 0) {
        if (Math.hypot(b.x - x, b.y - y) <= r + (b.r || 55)) {
          if (window.DUSMAN && res === DUSMAN.liste) res = res.slice();
          res.push(b);
        }
      }
    }
    return res;
  }
  function hasarVer(d, m, o, kukreme) {
    var once = d ? d.can : 0, sonuc;
    if (window.DUSMAN && DUSMAN.hasarVer) sonuc = DUSMAN.hasarVer(d, m, o);
    else if (d && typeof d.hasarAl === 'function') sonuc = d.hasarAl(m, o);
    if (P.ofkeli && !kukreme && d && Number.isFinite(once) && Number.isFinite(d.can)) {
      var hasar = once - Math.max(0, d.can);
      var kazanilan = Math.min(hasar * AYAR.ofkeCanCalma, S.ofkeCanKaldi, P.canMax - P.can);
      if (kazanilan > 0 && P.canli) {
        iyiles(kazanilan);
        S.ofkeCanKaldi -= kazanilan;
      }
    }
    return sonuc || {};
  }
  function vurVaril(hx, hy, hr, hasar) {
    if (!(window.BOLUM && BOLUM.varilVur)) return 0;
    var r = BOLUM.varilVur(hx, hy, hr, hasar);
    if (r === false || r === 0 || r === null || (typeof r === 'object' && r.vurdu === false)) return 0;
    return r === undefined ? -1 : 1;
  }
  function vurTotem(hx, hy, hr, hasar, tur) {
    if (!(window.VARGOR && VARGOR.aktif && VARGOR.totemVur)) return 0;
    var r = VARGOR.totemVur(hx, hy, hr, hasar, tur);
    if (r === false || r === 0 || r === null || (typeof r === 'object' && r.vurdu === false)) return 0;
    return r === undefined ? -1 : 1;
  }
  function baltaYerVurdu(liste, x, y, esik) {
    for (var i = 0; i < liste.length; i++) {
      if (Math.hypot(liste[i].x - x, liste[i].y - y) < esik) return true;
    }
    return false;
  }
  function sinir() {
    var b = window.BOLUM && BOLUM.sinir;
    if (b && isFinite(b.sol) && isFinite(b.sag)) return b;
    var ky = (OYUN.kamera && OYUN.kamera.y) || 0;
    return { sol: 30, sag: OYUN.W - 30, ust: ky + 60, alt: ky + OYUN.H - 20 };
  }

  var P = window.OYUNCU = {
    AYAR: AYAR,
    x: 640, y: 600, r: AYAR.r, vx: 0, vy: 0, dvx: 0, dvy: 0,
    can: AYAR.canMax, canMax: AYAR.canMax, ofke: 0, ofkeli: false, baltaVar: true, canli: true,
    aci: -PI / 2, yon: 4,
    durum: 'serbest',     // serbest | savur | kasirga | kukre | atil | at | sersem | olu
    kasirgaFaz: -1, kasirgaAci: 0,
    dokunulmazSure: 0,
    hasarAl: hasarAl, iyiles: iyiles,
    yanmaAl: yanmaAl,       // ateş birikintisi / tutuşma hasarı (itme, sersem, dokunulmazlık yok; atılırken yanmaz)
    tutus: tutus, tutusT: 0, // meşale vuruşu: tutusT sn boyunca 0,25 sn'de bir yanma (atılma söndürür)
    sprite: null, balta: null,
    baltaCagrilir: false,   // balta dışarıda ve geri çağrılabilir (arayüz rozeti "çağır")
    baltaIst: null          // ölçüm: {atis, isabet, kesme, cagir, delinen, enCok}
  };
  function baltaIstSifirla() { P.baltaIst = { atis: 0, isabet: 0, kesme: 0, cagir: 0, delinen: 0, enCok: 0 }; }
  baltaIstSifirla();

  var S = {};   // iç durum
  function iciSifirla() {
    S = {
      faz: '', fazT: 0, zNo: 0, zPencere: 0, sv: null, vurulan: [], sekenler: [], svVaril: false, svTotem: false,
      atilT: 0, atilBekle: 0, atilAci: 0, atilVurulan: [], atilDok: 0,
      kasirgaT: 0, kasirgaEvre: '', kasirgaVurulan: new Set(), kasirgaCevre: false, kukreT: 0,
      atT: 0, sersemT: 0, tSavur: 0, tAgir: 0, tAtil: 0, tBalta: 0, kayaSavurT: -Infinity,
      ofkeT: 0, ofkeCanKaldi: 0, ofkeGorunum: 0, sonIsabet: 99, adimT: 0, animAd: '', oto: { t: 0, atilT: 0, baltaT: 0 },
      hedefYon: 4, donusT: 0, yFaz: 0, vR: 0, gv: 0, yuruyor: false, durT: 0, ox: null, oy: null,
      fex: null, fey: null, nisanTaze: false, aimKurtar: false, atE: 0, atBekleyen: null, atBirak: 0, sonraki: false, sonrakiAgir: false, kilitAd: '', kilitSon: 0, parlaT: 0,
      hizliT: 0, sersemGecen: 0, tutusTik: 0
    };
    S.oto.gorulen = new Map();
  }
  iciSifirla();
  P._ic = function () { return S; };   // test/ölçüm için

  // ---------------------------------------------------------------- girdi (gerçek ya da ?oto)
  var OTO = false, OLUMSUZ = false;
  function girdiOku(dt) {
    if (OTO) return otoGirdi(dt);
    var G = window.GIRDI || {}, f = G.fare || {};
    var bas = function (t) { return G.basildi ? !!G.basildi(t) : false; };
    var hx = G.hx || 0, hy = G.hy || 0;
    var savurTus = bas('o'), baltaTus = bas('p'), savurBasili = G.tutuluyor && G.tutuluyor('o');
    var fareBas = bas('sol'), fareBalta = bas('sag');
    var padNisan = G.pad.aktif && !fareBas && !fareBalta && !f.sol;
    var cubukNisan = padNisan && !!(G.pad.ax || G.pad.ay);
    var klavyeNisan = padNisan || savurTus || baltaTus || (G.saldiriKlavye && !fareBas && !fareBalta && !f.sol);
    var aci = cubukNisan ? Math.atan2(G.pad.ay, G.pad.ax)
      : klavyeNisan && (hx || hy) ? Math.atan2(hy, hx) : P.aci;
    return {
      hx: hx, hy: hy, klavyeNisan: klavyeNisan, cubukNisan: cubukNisan,
      nx: !klavyeNisan && isFinite(f.x) ? f.x : P.x + Math.cos(aci) * 100,
      ny: !klavyeNisan && isFinite(f.y) ? f.y : P.y - AYAR.nisanYuksek + Math.sin(aci) * 100,
      savurBas: fareBas || savurTus, savurTut: !!f.sol || savurBasili, agirBas: bas('g'),
      balta: fareBalta || baltaTus, atil: bas('bosluk'), ofke: bas('e'),
      kasirgaTut: !!(G.tutuluyor && G.tutuluyor('x'))
    };
  }

  // ---------------------------------------------------------------- ?oto: otomatik oyuncu (Bölüm I & II)
  function totemAktifMi(t) {
    if (!t || !isFinite(t.x) || !isFinite(t.y)) return false;
    if (t.olu || t.kirik || t.kirildi || t.yikildi || t.kirilabilir === false) return false;
    if (t.aktif === false || t.canli === false) return false;
    if (typeof t.can === 'number' && t.can <= 0) return false;
    return true;
  }
  function kozSicakMi(k) {
    if (!k || !isFinite(k.x) || !isFinite(k.y)) return false;
    if (k.uyari === true || k.faz === 'uyari' || k.durum === 'uyari') return true;
    if (k.aktif === false || k.sicak === false || k.etkin === false || k.sonuk || k.olu) return false;
    if (k.durum === 'soguk' || k.durum === 'sonuk' || k.durum === 'bekle') return false;
    if (typeof k.sicakT === 'number' && k.sicakT <= 0 && k.sicak !== true && k.aktif !== true) return false;
    return true;
  }
  function sicakTehlike(x, y, pay) {
    var D = window.DUSMAN;
    if (D && D.atesIcinde && D.atesler && D.atesler.length) {
      var af = D.atesIcinde(x, y, pay || 0);
      if (af) return af;
    }
    var B = window.BOLUM;
    if (!B) return null;
    if (typeof B.kozIcinde === 'function') {
      var kf = B.kozIcinde(x, y, pay || 0);
      if (kf) {
        if (typeof kf === 'object' && isFinite(kf.x) && isFinite(kf.y)) return kf;
        if (Array.isArray(B.kozler)) {
          var enK = null, enKD = 1e9;
          for (var ki = 0; ki < B.kozler.length; ki++) {
            var kk = B.kozler[ki];
            if (!kozSicakMi(kk)) continue;
            var kd = Math.hypot(x - kk.x, y - (isFinite(kk.cy) ? kk.cy : kk.y));
            if (kd < enKD) { enKD = kd; enK = kk; }
          }
          if (enK) return enK;
        }
        return { x: x, y: y };
      }
    }
    if (Array.isArray(B.kozler)) {
      for (var i = 0; i < B.kozler.length; i++) {
        var k = B.kozler[i];
        if (!kozSicakMi(k)) continue;
        var kx = k.x, ky = isFinite(k.cy) ? k.cy : k.y;
        var rx = (k.rx || k.r || 65) + (pay || 0);
        var ry = (k.ry || (k.r ? k.r * (k.basik || 0.65) : 45)) + (pay || 0);
        var dx = x - kx, dy = y - ky;
        if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) < 1) return { x: kx, y: ky, rx: rx, ry: ry };
      }
    }
    return null;
  }
  function engelCarp(x, y, r, totemHedef) {
    var B = window.BOLUM;
    if (!B || !Array.isArray(B.engeller)) return null;
    var ry = r * 0.6;
    for (var i = 0; i < B.engeller.length; i++) {
      var e = B.engeller[i];
      if (!e || e.kapali) continue;
      if (totemHedef && e.x1 <= totemHedef.x + 12 && e.x2 >= totemHedef.x - 12 && e.y1 <= totemHedef.y + 12 && e.y2 >= totemHedef.y - 12) continue;
      if (x >= e.x1 - r && x <= e.x2 + r && y >= e.y1 - ry && y <= e.y2 + ry) return e;
    }
    return null;
  }
  function sinirIcindeMi(x, y, b, pay) {
    pay = pay || 36;
    return x >= b.sol + pay && x <= b.sag - pay && y >= b.ust + pay && y <= b.alt - pay;
  }
  function otoGirdi(dt) {
    var r0 = otoGirdi0(dt), g = r0.g, totemHedef = r0.totem;
    if (g.atil) return g;
    var b = sinir(), f = sicakTehlike(P.x, P.y, 14);
    if (f) {
      var basik = (f.ry && f.rx) ? (f.ry / f.rx) : 0.55;
      var ax = P.x - f.x, ay = (P.y - f.y) / Math.max(0.35, basik), am = Math.hypot(ax, ay) || 1;
      g.hx = ax / am; g.hy = ay / am;
      if (P.x < b.sol + 60) g.hx = Math.abs(g.hx) + 0.4; if (P.x > b.sag - 60) g.hx = -Math.abs(g.hx) - 0.4;
      if (P.y < b.ust + 60) g.hy = Math.abs(g.hy) + 0.4; if (P.y > b.alt - 50) g.hy = -Math.abs(g.hy) - 0.4;
      return g;
    }
    if (Math.hypot(g.hx, g.hy) > 0.1) {
      var f2 = sicakTehlike(P.x + g.hx * 45, P.y + g.hy * 45, 12) || sicakTehlike(P.x + g.hx * 26, P.y + g.hy * 26, 10);
      if (f2) { // yan yoldan dolan (koz veya ateş kenarından)
        var sx1 = -g.hy, sy1 = g.hx, sl = Math.hypot(sx1, sy1) || 1;
        sx1 /= sl; sy1 /= sl;
        var sx2 = -sx1, sy2 = -sy1;
        var s1Ok = sinirIcindeMi(P.x + sx1 * 42, P.y + sy1 * 42, b, 34) && !sicakTehlike(P.x + sx1 * 42, P.y + sy1 * 42, 8);
        var s2Ok = sinirIcindeMi(P.x + sx2 * 42, P.y + sy2 * 42, b, 34) && !sicakTehlike(P.x + sx2 * 42, P.y + sy2 * 42, 8);
        if (s1Ok && !s2Ok) { g.hx = sx1; g.hy = sy1; }
        else if (s2Ok && !s1Ok) { g.hx = sx2; g.hy = sy2; }
        else {
          if ((f2.x - P.x) * sx1 + (f2.y - P.y) * sy1 > 0) { sx1 = sx2; sy1 = sy2; }
          g.hx = sx1; g.hy = sy1;
        }
      } else if (!g.savurBas && !g.agirBas) {
        var eg = engelCarp(P.x + g.hx * 34, P.y + g.hy * 34, P.r + 4, totemHedef);
        if (eg) {
          var ecx = (eg.x1 + eg.x2) * 0.5, ecy = (eg.y1 + eg.y2) * 0.5;
          var ex1 = -g.hy, ey1 = g.hx, el = Math.hypot(ex1, ey1) || 1;
          ex1 /= el; ey1 /= el;
          if ((ecx - P.x) * ex1 + (ecy - P.y) * ey1 > 0) { ex1 = -ex1; ey1 = -ey1; }
          if (!sinirIcindeMi(P.x + ex1 * 40, P.y + ey1 * 40, b, 30)) { ex1 = -ex1; ey1 = -ey1; }
          g.hx = ex1; g.hy = ey1;
        }
      }
    }
    return g;
  }
  function otoGirdi0(dt) {
    var o = S.oto, g = { hx: 0, hy: 0, nx: P.x, ny: P.y - 200, savurBas: false, savurTut: false, agirBas: false, balta: false, atil: false, ofke: false };
    o.t += dt; o.atilT -= dt; o.baltaT -= dt;
    var b = sinir();
    var liste = (window.DUSMAN && DUSMAN.liste) ? DUSMAN.liste.filter(function (d) { return !d.olu; }) : [];
    if (window.DEV && DEV.aktif && !DEV.olu && isFinite(DEV.x) && isFinite(DEV.y) && liste.indexOf(DEV) < 0) liste.push(DEV);
    if (window.VARGOR && VARGOR.aktif && !VARGOR.olu && isFinite(VARGOR.x) && isFinite(VARGOR.y) && liste.indexOf(VARGOR) < 0) liste.push(VARGOR);
    var en = null, enD = 1e9, kx = 0, ky = 0, yakin = 0;
    var infazciYakin = false, infazciHedef = null, infazciD = 1e9;
    for (var i = 0; i < liste.length; i++) {
      var d = liste[i], m = Math.hypot(d.x - P.x, d.y - P.y);
      if (m < enD) { enD = m; en = d; }
      if (m < 220) { kx += d.x; ky += d.y; yakin++; }
      if (d.tur === 'infazci') {
        if (m < 180) infazciYakin = true;
        if (m < infazciD) { infazciD = m; infazciHedef = d; }
      }
    }
    // Vargor totemleri: kırılabilir aktif totemler varsa önce onlara koş ve kır
    var hedefTotem = null, totemD = 1e9;
    if (window.VARGOR && VARGOR.aktif && !VARGOR.olu && Array.isArray(VARGOR.totemler)) {
      for (var tti = 0; tti < VARGOR.totemler.length; tti++) {
        var tt = VARGOR.totemler[tti];
        if (!totemAktifMi(tt)) continue;
        var ttd = Math.hypot(tt.x - P.x, tt.y - P.y);
        if (ttd < totemD) { totemD = ttd; hedefTotem = tt; }
      }
    }
    // tehlikeli mermi
    var mer = null, merD = 1e9;
    if (window.MERMI && MERMI.liste) for (var j = 0; j < MERMI.liste.length; j++) {
      var m2 = MERMI.liste[j]; if (m2.sahip !== 'dusman') continue;
      var mx = P.x - m2.x, my = (P.y - AYAR.nisanYuksek) - m2.y, md = Math.hypot(mx, my);
      // görüş yarıçapı tepki gecikmesi kadar geniş (insan oku uzaktan görür, geç tepki verir)
      if (md < 150 + Math.hypot(m2.vx || 0, m2.vy || 0) * AYAR.otoGecikme && (m2.vx * mx + m2.vy * my) > 0 && md < merD) { merD = md; mer = m2; }
    }
    // tehditleri "görme" anı: insan gibi ancak otoGecikme sonra tepki verir
    var gor = o.gorulen, simdi = o.t, gec = AYAR.otoGecikme;
    function farkEt(nesne) {
      var t0 = gor.get(nesne); if (t0 === undefined) { t0 = simdi; gor.set(nesne, t0); }
      nesne._otoGordu = simdi;
      return simdi - t0 >= gec;
    }
    if (gor.size > 200 || (o.t % 2) < dt) gor.forEach(function (v, k) { if (k._otoGordu !== simdi && simdi - v > 2) gor.delete(k); });
    // telgraf: yakın düşman/boss hazırlanıyorsa (ve fark edildiyse) yana atıl
    var tehdit = null;
    for (var ti = 0; ti < liste.length; ti++) {
      var td = liste[ti], tm = Math.hypot(td.x - P.x, td.y - P.y);
      var devMi = td === window.DEV || (td.tur === 'dev' && td.ad !== 'VARGOR');
      var vargorMi = td === window.VARGOR || td.ad === 'VARGOR' || td.tur === 'vargor';
      var infazciMi = td.tur === 'infazci';
      var vDurum = vargorMi ? (td.durum || (typeof td.bilgi === 'function' ? ((td.bilgi() || {}).durum || '') : '')) : '';
      var hz = devMi
        ? (window.DEV && /sopa|yerevur|sarj|hucum/.test(DEV.durum || ''))
        : vargorMi
          ? /(?:^|_)vur|sopa|yerevur|sarj|hucum|hazir|cekic|savur|ezme|darbe|tele/.test(vDurum)
          : (td.durum === 'hazirlik' || td.durum === 'atilHaz' || td.durum === 'vurHaz');
      var tr = devMi ? 300 : vargorMi ? Math.max(250, (td.r || 50) + 180) : infazciMi ? 175 : (td.r || 20) + 130;
      if (hz && tm < tr && farkEt(td)) { tehdit = td; break; }
    }
    if (mer && !farkEt(mer)) mer = null;
    if (P.ofke >= 100 && (en || hedefTotem)) g.ofke = true;
    var bossTehdit = tehdit && (tehdit.tur === 'dev' || tehdit === window.DEV || tehdit.tur === 'vargor' || tehdit === window.VARGOR || tehdit.devMi);
    if (tehdit && (!P.ofkeli || (bossTehdit && P.can < 45)) && S.atilBekle <= 0 && o.atilT <= 0 && !(mer && P.baltaVar)) {
      var ta = Math.atan2(P.y - tehdit.y, P.x - tehdit.x) + (o.t % 2 < 1 ? 0.9 : -0.9);
      g.hx = Math.cos(ta); g.hy = Math.sin(ta);
      if (P.x < b.sol + 90) g.hx = Math.abs(g.hx) + 0.3; if (P.x > b.sag - 90) g.hx = -Math.abs(g.hx) - 0.3;
      if (P.y < b.ust + 90) g.hy = Math.abs(g.hy) + 0.3; if (P.y > b.alt - 70) g.hy = -Math.abs(g.hy) - 0.3;
      g.atil = true; o.atilT = 0.6;
      g.nx = tehdit.x; g.ny = tehdit.y - AYAR.nisanYuksek;
      return { g: g, totem: hedefTotem };
    }
    // balta dışarıda: aradaki hatta ≥2 düşman dizildiyse ya da biri dibimize geldiyse ya da uçuş sonunda bekliyorsa geri çağır
    var bt = P.balta;
    if (bt && !bt.cagrildi && (bt.faz === 'git' || bt.faz === 'bekle') && bt.t > 0.25) {
      var hx0 = P.x - bt.x, hy0 = P.y - bt.y, hl0 = Math.hypot(hx0, hy0) || 1, dizi = 0;
      for (var hi = 0; hi < liste.length; hi++) {
        var hd = liste[hi], u0 = ((hd.x - bt.x) * hx0 + (hd.y - bt.y) * hy0) / (hl0 * hl0);
        if (u0 < 0 || u0 > 1) continue;
        if (Math.abs((hd.x - bt.x) * hy0 - (hd.y - bt.y) * hx0) / hl0 < AYAR.baltaDonR + (hd.r || 20)) dizi++;
      }
      if (dizi >= 2 || (enD < 110 && bt.t > 0.45) || (bt.faz === 'bekle' && bt.t > 0.2)) g.balta = true;
    }
    // KESME: ok geren okçuya / büyü yapan şamana / çömlek atan yakıcıya balta at
    if (!mer && !g.balta && P.baltaVar && o.baltaT <= 0 && (P.durum === 'serbest' || P.durum === 'at')) {
      var kh = null, khD = 1e9;
      for (var ki = 0; ki < liste.length; ki++) {
        var kd = liste[ki], kdm = Math.hypot(kd.x - P.x, kd.y - P.y), kalan;
        if (kd.tur === 'okcu' && kd.durum === 'cek') kalan = ((DUSMAN.AYAR && DUSMAN.AYAR.okcu && DUSMAN.AYAR.okcu.cek) || 0.8) - (kd.t || 0);
        else if (kd.tur === 'saman' && kd.durum === 'buyu') kalan = (kd.buyuSure || 0.9) - (kd.t || 0);
        else if (kd.tur === 'yakici' && kd.durum === 'at') kalan = ((DUSMAN.AYAR && DUSMAN.AYAR.yakici && DUSMAN.AYAR.yakici.kaldir) || 0.6) - (kd.t || 0);
        else continue;
        if (kdm > AYAR.baltaMenzil + 20 || kalan < kdm / AYAR.baltaHiz + AYAR.baltaBirak + 0.03) continue;
        if (!farkEt(kd)) continue;
        if (kdm < khD) { khD = kdm; kh = kd; }
      }
      if (kh) { g.balta = true; o.baltaT = 1.2; g.nx = kh.x; g.ny = kh.y - AYAR.nisanYuksek; return { g: g, totem: hedefTotem }; }
    }
    if (mer) { g.nx = mer.x; g.ny = mer.y; if (merD < 105 && P.baltaVar) { g.savurBas = true; g.savurTut = true; } }

    // 1. ÖNCELİK (Bölüm II Vargor): aktif totemler ayaktaysa önce totemlere koş ve kır
    if (hedefTotem) {
      var tdx = hedefTotem.x - P.x, tdy = hedefTotem.y - P.y, tl = Math.hypot(tdx, tdy) || 1;
      if (!mer) { g.nx = hedefTotem.x; g.ny = hedefTotem.y - AYAR.nisanYuksek; }
      var tr = hedefTotem.r || 36;
      var tMenzil = (P.ofkeli ? AYAR.ofkeMenzil : AYAR.zincir[2].menzil) + tr;
      var vurMesafe = Math.min(tMenzil - 10, Math.max(tr + P.r + 32, (P.ofkeli ? AYAR.ofkeMenzil : AYAR.zincir[0].menzil) * 0.92 + 12));
      if (!P.baltaVar) {
        if (enD < 95 && en) {
          var edx0 = en.x - P.x, edy0 = en.y - P.y, el0 = Math.hypot(edx0, edy0) || 1;
          g.hx = -edx0 / el0; g.hy = -edy0 / el0;
          if (P.x < b.sol + 80) g.hx = Math.abs(g.hx) + 0.5; if (P.x > b.sag - 80) g.hx = -Math.abs(g.hx) - 0.5;
          if (P.y < b.ust + 80) g.hy = Math.abs(g.hy) + 0.5; if (P.y > b.alt - 60) g.hy = -Math.abs(g.hy) - 0.5;
        } else if (totemD > vurMesafe * 0.7) {
          g.hx = tdx / tl; g.hy = tdy / tl;
        }
        g.savurBas = false; g.savurTut = false; g.agirBas = false;
      } else if (totemD < vurMesafe) {
        g.savurBas = true; g.savurTut = true; g.agirBas = true;
        g.hx = Math.cos(o.t * 1.3) * 0.15; g.hy = Math.sin(o.t * 1.3) * 0.15;
      } else {
        g.hx = tdx / tl; g.hy = tdy / tl;
        if (totemD > 130 && totemD <= AYAR.baltaMenzil && o.baltaT <= 0 && !mer && (P.durum === 'serbest' || P.durum === 'at')) {
          g.balta = true; o.baltaT = 1.4;
        } else if (totemD > 180 && totemD < 340 && S.atilBekle <= 0 && o.atilT <= 0 && !sicakTehlike(hedefTotem.x, hedefTotem.y, 0)) {
          g.atil = true; o.atilT = 2.0;
        }
      }
      return { g: g, totem: hedefTotem };
    }

    // Ayaz surlarının zincirini, ilerisi boşsa veya yakın düşman duvar arkasındaysa kır.
    var kapi = OYUN.bolum === 3 && window.AYAZ && AYAZ.kapiHedef(P.x, P.y);
    if (kapi && (!en || enD > 108 || (P.y-kapi.y)*(en.y-kapi.y) < 0)) {
      if (!mer) { g.nx = kapi.x; g.ny = kapi.y - AYAR.nisanYuksek; }
      if (kapi.mesafe < 105 && P.baltaVar) {
        g.savurBas = true; g.savurTut = true;
      } else {
        var kdx = kapi.x - P.x, yaklas = Math.abs(kdx) > 52 ? (P.y > kapi.y ? 74 : -74) : 0;
        var kdy = kapi.y + yaklas - P.y, kl = Math.hypot(kdx, kdy) || 1;
        g.hx = kdx / kl; g.hy = kdy / kl;
      }
      return { g:g, totem:kapi };
    }

    // 2. HEDEF YOKSA BÖLÜM İLERLEMESİ
    if (!en) {
      var kx0 = (OYUN.kamera && OYUN.kamera.x) || 0, ky0 = (OYUN.kamera && OYUN.kamera.y) || 0;
      var kilitli = !!(window.BOLUM && BOLUM.arenaKilitli);
      var il = (window.BOLUM && typeof BOLUM.ilerleme === 'number') ? BOLUM.ilerleme : 0;
      var dikeyBolum = (OYUN.bolum === 1 || OYUN.bolum === 2) || !!(window.BOLUM && (BOLUM.dikey || BOLUM.yon === 'yukari' || (BOLUM.uzunluk && BOLUM.uzunluk > 2000)));
      var yatayBolum = kx0 > 5 || !!(window.BOLUM && (BOLUM.yatay || BOLUM.yon === 'sag')) || !dikeyBolum;
      var hxHedef, hyHedef;
      if (kilitli) {
        hxHedef = (b.sol + b.sag) * 0.5;
        hyHedef = (b.ust + b.alt) * 0.5;
      } else if (yatayBolum) {
        hxHedef = Math.min(b.sag - 36, kx0 + OYUN.W * 0.82);
        if (Math.abs(hxHedef - P.x) <= 30 && b.sag - P.x > 40) hxHedef = b.sag - 36;
        hyHedef = (window.BOLUM && typeof BOLUM.yolY === 'function') ? BOLUM.yolY(hxHedef) : (b.ust + b.alt) * 0.5;
      } else {
        hxHedef = (b.sol + b.sag) * 0.5;
        hyHedef = Math.max(b.ust + 20, ky0 + OYUN.H * 0.38);
      }
      if (P.can < 80 && window.BOLUM && Array.isArray(BOLUM.canlar)) {
        for (var ci = 0; ci < BOLUM.canlar.length; ci++) {
          var cs = BOLUM.canlar[ci];
          if (cs && !cs.alindi && isFinite(cs.x) && isFinite(cs.y) && Math.hypot(cs.x - P.x, cs.y - P.y) < 240) {
            hxHedef = cs.x; hyHedef = cs.y; break;
          }
        }
      }
      var dx0 = hxHedef - P.x, dy0 = hyHedef - P.y;
      if (Math.hypot(dx0, dy0) > 25) { var l0 = Math.hypot(dx0, dy0); g.hx = dx0 / l0; g.hy = dy0 / l0; }
      if (!mer) { g.nx = P.x + g.hx * 100; g.ny = P.y - AYAR.nisanYuksek + g.hy * 100 - 1; }
      return { g: g, totem: null };
    }

    // 3. DÜŞMAN / BOSS SAVAŞI (Vargor sersemlediyse öncelikle Vargor'a yüklen)
    var vBil = (window.VARGOR && typeof VARGOR.bilgi === 'function') ? VARGOR.bilgi() : null;
    if (window.VARGOR && VARGOR.aktif && !VARGOR.olu && (VARGOR.sersem > 0 || VARGOR.durum === 'sersem' || (vBil && vBil.durum === 'sersem'))) {
      var vd = Math.hypot(VARGOR.x - P.x, VARGOR.y - P.y);
      if (vd < 360) { en = VARGOR; enD = vd; }
    }
    var dx = en.x - P.x, dy = en.y - P.y, l = Math.hypot(dx, dy) || 1;
    if (!mer) { g.nx = en.x; g.ny = en.y - AYAR.nisanYuksek; }
    var menzil = (P.ofkeli ? AYAR.ofkeMenzil : AYAR.zincir[0].menzil) + (en.r || 20);
    // infazci varken baltayla zırh kırmaya / hasar vermeye öncelik ver
    if (!mer && !g.balta && P.baltaVar && o.baltaT <= 0 && infazciHedef && infazciD > 115 && infazciD <= AYAR.baltaMenzil && (P.durum === 'serbest' || P.durum === 'at')) {
      g.balta = true; o.baltaT = 1.5; g.nx = infazciHedef.x; g.ny = infazciHedef.y - AYAR.nisanYuksek;
      return { g: g, totem: null };
    }
    // canı azsa kalabalıktan kaç (dev/Vargor'dan kaçmaz: telgraflara atılarak dövüşür); en çok 4 sn kaçıp 4 sn yeniden dalar
    var bossMu = !!(en.devMi || en.tur === 'dev' || en.tur === 'vargor' || en === window.DEV || en === window.VARGOR);
    var kac = P.can < 30 && !OLUMSUZ && !P.ofkeli && yakin >= 3 && !bossMu && (en.r || 0) <= 40;
    o.kacT = kac ? (o.kacT || 0) + dt : 0;
    if (o.kacT > 4) { kac = false; if (o.kacT > 8) o.kacT = 0; }
    if (!P.baltaVar) {
      // balta havada: vuramaz → yakındaki düşmandan uzaklaş, balta dönünce yeniden saldır
      if (enD < menzil + 60) {
        g.hx = -dx / l; g.hy = -dy / l;
        if (P.x < b.sol + 80) g.hx = Math.abs(g.hx) + 0.5; if (P.x > b.sag - 80) g.hx = -Math.abs(g.hx) - 0.5;
        if (P.y < b.ust + 80) g.hy = Math.abs(g.hy) + 0.5; if (P.y > b.alt - 60) g.hy = -Math.abs(g.hy) - 0.5;
        if (o.atilT <= 0 && enD < 70) { g.atil = true; o.atilT = 1.5; }
      }
      g.savurBas = false; g.savurTut = false; g.agirBas = false;
    } else if (kac) {
      var cx = kx / yakin - P.x, cy = ky / yakin - P.y, cl = Math.hypot(cx, cy) || 1;
      g.hx = -cx / cl; g.hy = -cy / cl;
      // kenara sıkışmasın
      if (P.x < b.sol + 80) g.hx = Math.abs(g.hx) + 0.5; if (P.x > b.sag - 80) g.hx = -Math.abs(g.hx) - 0.5;
      if (P.y < b.ust + 80) g.hy = Math.abs(g.hy) + 0.5; if (P.y > b.alt - 60) g.hy = -Math.abs(g.hy) - 0.5;
      if (o.atilT <= 0 && enD < 90) { g.atil = true; o.atilT = 1.5; }
      if (enD < menzil - 5) { g.savurBas = true; g.savurTut = true; if (infazciYakin || en.tur === 'infazci') g.agirBas = true; }
    } else if (enD < menzil - 8) {
      g.savurBas = true; g.savurTut = true;
      if (infazciYakin || en.tur === 'infazci') g.agirBas = true;
      g.hx = Math.cos(o.t * 1.3) * 0.25; g.hy = Math.sin(o.t * 1.3) * 0.25;  // hafif dolanma
    } else {
      g.hx = dx / l; g.hy = dy / l;
      if (enD > 260 && P.baltaVar && o.baltaT <= 0 && OYUN.rast(0, 1) < 0.02) { g.balta = true; o.baltaT = 2.5; }
      else if (enD > 140 && enD < 300 && o.atilT <= 0 && OYUN.rast(0, 1) < 0.015) { g.atil = true; o.atilT = 3; }
    }
    return { g: g, totem: null };
  }

  // ---------------------------------------------------------------- sprite
  function spriteKur() {
    if (P.sprite || !window.VARLIK || !OYUN.katman) return;
    P.sprite = VARLIK.sprite('barbar', { olcek: AYAR.boyOlcek });
    OYUN.katman.varlik.addChild(P.sprite);
    S.animAd = '';
  }
  // baltasız eşi varsa onu seç (dur_b, yuru_b, atil_b, sersem_b)
  function cozAd(ad) {
    var s = P.sprite;
    if (!P.baltaVar && s && s.animVar && !s.yerTutucu && s.animVar(ad + '_b')) return ad + '_b';
    return ad;
  }
  function animTanim(ad) {
    try { return P.sprite && P.sprite._animTanim ? P.sprite._animTanim(ad) : null; } catch (e) { return null; }
  }
  function anim(ad, sec) {
    var s = P.sprite;
    if (!s || !s.oynat) return;
    sec = sec || {};
    var gercek = cozAd(ad);
    S.animAd = ad;
    if (!sec.bastan && s.anim === gercek) {
      if (s.yon !== P.yon || (sec.hiz !== undefined && s._hiz !== sec.hiz)) s.oynat(gercek, P.yon, sec.hiz !== undefined ? { hiz: sec.hiz } : {});
      return;
    }
    // baltalı ↔ baltasız geçişte animasyon evresi korunur (baştan başlamaz)
    var oran = null;
    if (!sec.bastan && s.anim && s._a && (s.anim === gercek + '_b' || s.anim + '_b' === gercek)) oran = s._t / (s._a.n || 1);
    s.oynat(gercek, P.yon, sec);
    if (oran !== null && s._a) kareKoy(oran * s._a.n);
  }
  // elle kare: sprite hiz=0 ile oynatılır, evreyi biz süreriz
  function kareKoy(t) {
    var s = P.sprite, a = s && s._a; if (!a) return;
    var n = a.n || 1;
    t = Math.max(0, Math.min(n - 0.001, t));
    s._t = t; s.bitti = false;
    var k = t | 0;
    if (k !== s.kare || s.yerTutucu) { s.kare = k; if (s._ciz) s._ciz(); }
  }
  function atKare() {
    var ta = P.sprite && P.sprite._a; if (!ta) return;
    var n = ta.n || 1, top = AYAR.baltaAtSure + AYAR.kilitPay, e = S.atE;
    var bk = isFinite(ta.birakKare) ? Math.max(1, Math.min(n - 1, ta.birakKare)) : 0;
    var t = S.atBirak > 0 && e < S.atBirak ? bk * e / S.atBirak : bk + (n - bk) * (e - S.atBirak) / Math.max(0.01, top - S.atBirak);
    kareKoy(t);
  }
  // tek seferlik pozun (atılma/fırlatma/sersem) giriş-çıkışı kesilmesin
  function kilit(ad, sure) { S.kilitAd = ad; S.kilitSon = OYUN.zaman.t + sure; }
  // 8 yön (çekirdekle aynı numaralama): yön → açı
  function yonMerkez(y) { return (((y + 2) % 8) * PI / 4); }
  function aciYon(a) { return OYUN.aciYon ? OYUN.aciYon(a) : ((Math.round(a / (PI / 4)) % 8 + 8 + 6) % 8); }
  // pay (histerezis): sınırın hemen ötesine geçen açı yönü değiştirmez
  function yonSec(a, mevcut) {
    if (Math.abs(aciFark(a, yonMerkez(mevcut))) <= PI / 8 + AYAR.yonPay * D2R) return mevcut;
    return aciYon(a);
  }
  // anında dön (saldırı, atılma, fırlatma: tepki hızlı olmalı)
  function yonGuncelle(a) {
    P.aci = a;
    P.yon = S.hedefYon = aciYon(a); S.donusT = 0;
    if (P.sprite && P.sprite.yon !== P.yon && P.sprite.anim) P.sprite.oynat(P.sprite.anim, P.yon, {});
  }
  // yumuşak dön: hedef yöne dilim dilim (ters yöne ani sıçrama yok)
  function yonYumusak(a, dt) {
    P.aci = a;
    S.hedefYon = yonSec(a, S.hedefYon);
    if (P.yon === S.hedefYon) { S.donusT = 0; return; }
    var fark = ((S.hedefYon - P.yon) % 8 + 8) % 8;   // 1..7
    if (fark === 1 || fark === 7) { P.yon = S.hedefYon; S.donusT = 0; return; }
    S.donusT -= dt;
    if (S.donusT <= 0) {
      var yonu = fark < 4 ? 1 : fark > 4 ? -1 : (aciFark(a, yonMerkez(P.yon)) >= 0 ? 1 : -1);
      P.yon = (P.yon + yonu + 8) % 8; S.donusT = AYAR.donusAdim;
    }
  }

  // ---------------------------------------------------------------- balta
  function baltaGorsel() {
    var c = new PIXI.Container();
    var golge = new PIXI.Graphics(); golge.beginFill(0x000000, 0.35).drawEllipse(0, 0, 16, 6).endFill();
    var don = new PIXI.Container(); don.y = -44;
    var tex = null;
    try {
      var pk = window.VARLIK && VARLIK.var && VARLIK.var('efekt') && VARLIK.paketler ? VARLIK.paketler.efekt : null;
      if (pk && pk.tekil && pk.tekil.balta !== undefined) tex = VARLIK.doku('efekt', 'balta');   // yoksa yer tutucu X gelir; onu istemiyoruz
    } catch (e) { tex = null; }
    if (tex && tex !== PIXI.Texture.EMPTY && tex.valid !== false && tex.width > 2) {
      var sp = new PIXI.Sprite(tex); sp.anchor.set(0.5); var k = 70 / Math.max(tex.width, tex.height); sp.scale.set(k); don.addChild(sp);
    } else {
      var g = new PIXI.Graphics();
      g.lineStyle(3, 0x1a120c).beginFill(0x5a3a22).drawRect(-3, -26, 6, 52).endFill();          // sap
      g.lineStyle(3, 0x15151a).beginFill(0x8d939b);                                              // ağız
      g.moveTo(2, -24).lineTo(22, -32).quadraticCurveTo(30, -14, 22, 4).lineTo(2, -6).closePath().endFill();
      g.lineStyle(0).beginFill(0xd8dde2, 0.8).moveTo(22, -30).quadraticCurveTo(29, -14, 22, 2).lineTo(20, 0).quadraticCurveTo(26, -14, 20, -28).closePath().endFill();
      don.addChild(g);
    }
    c.addChild(golge); c.addChild(don); c.don = don; c.golge = golge;
    return c;
  }
  function baltaAt(aci) {
    // el hizasından (ileri + sağ el ofseti) fırlat
    var x = P.x + Math.cos(aci) * 22 + Math.cos(aci + PI / 2) * 11;
    var y = P.y + Math.sin(aci) * 22 + Math.sin(aci + PI / 2) * 11;
    var spinYon = Math.cos(aci) >= 0 ? 1 : -1;
    var b = {
      x: x, y: y, vx: Math.cos(aci) * AYAR.baltaHiz, vy: Math.sin(aci) * AYAR.baltaHiz,
      faz: 'git', z: 48, yol: 0, donT: 0, sekmeT: 0, atAci: aci, t: 0, bekleT: 0, cagrildi: false,
      spinYon: spinYon, kavisYon: spinYon,
      vurGit: [], vurDon: [], varilGit: [], varilDon: [], totemGit: [], totemDon: [], g: null
    };
    if (OYUN.katman) { b.g = baltaGorsel(); OYUN.katman.varlik.addChild(b.g); }
    P.balta = b; P.baltaVar = false; P.baltaCagrilir = true;
    P.baltaIst.atis++;
    emit('baltaAt', { x: x, y: y, aci: aci });
  }
  function baltaSil() {
    if (P.balta && P.balta.g) { P.balta.g.destroy({ children: true }); }
    P.balta = null; P.baltaCagrilir = false;
  }
  // GERİ ÇAĞIRMA: balta giderken / menzil sonunda beklerken ikinci sağ tık → bulunduğu yerden hemen döner (atış başına bir kez)
  function baltaCagir() {
    var b = P.balta;
    if (!b || b.cagrildi || (b.faz !== 'git' && b.faz !== 'bekle') || b.t < AYAR.baltaCagirEn) return false;
    b.cagrildi = true; b.faz = 'don'; b.donT = 0; b.kavisYok = true; b.sekmeT = 0.12;
    // gidiş hızı söner, barbara doğru yönelir (yay çizmeden düz hat: dizdiğin herkes biçilir)
    var dx = P.x - b.x, dy = P.y - b.y, l = Math.hypot(dx, dy) || 1, h = AYAR.baltaDonHiz * 0.55;
    b.vx = dx / l * h; b.vy = dy / l * h;
    P.baltaCagrilir = false; P.baltaIst.cagir++;
    emit('baltaCagir', { x: b.x, y: b.y, aci: Math.atan2(dy, dx), mesafe: l });
    return true;
  }
  function baltaGuncelle(dt) {
    var b = P.balta; if (!b) return;
    b.t += dt;
    if (b.sekmeT > 0) b.sekmeT = Math.max(0, b.sekmeT - dt);
    if (b.faz === 'bekle') {
      // menzil sonunda havada yerinde dönerek bekler (hafif süzülme), sonra kendiliğinden döner
      b.bekleT -= dt;
      var sn = Math.exp(-9 * dt); b.vx *= sn; b.vy *= sn;
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.z = 42 - 3 * Math.min(1, 1 - b.bekleT / Math.max(0.01, AYAR.baltaBekle));
      if (b.bekleT <= 0) { b.faz = 'don'; b.donT = 0; }
    } else if (b.faz === 'git') {
      // menzilin son %20'sinde doğal yavaşlama (havada asılma hissi)
      var oran = b.yol / AYAR.baltaMenzil;
      var yavas = oran > 0.80 ? Math.max(0.55, 1 - 0.45 * ((oran - 0.80) / 0.20)) : 1;
      var adimX = b.vx * yavas * dt, adimY = b.vy * yavas * dt;
      b.x += adimX; b.y += adimY;
      b.yol += Math.hypot(adimX, adimY);
      b.z = 48 - 6 * Math.min(1, oran);
      // duvar / arena kenarı sekmesi
      var s = sinir();
      var kn = (window.BOLUM && BOLUM.kenar) ? BOLUM.kenar(b.y) : null;
      var sol = kn && isFinite(kn.sol) ? Math.max(s.sol, kn.sol) : s.sol;
      var sag = kn && isFinite(kn.sag) ? Math.min(s.sag, kn.sag) : s.sag;
      var sekti = false;
      if (b.x <= sol + 10) { b.x = sol + 10; b.vx = Math.abs(b.vx) * AYAR.baltaSekmeCarpan; sekti = true; }
      else if (b.x >= sag - 10) { b.x = sag - 10; b.vx = -Math.abs(b.vx) * AYAR.baltaSekmeCarpan; sekti = true; }
      if (b.y <= s.ust + 10) { b.y = s.ust + 10; b.vy = Math.abs(b.vy) * AYAR.baltaSekmeCarpan; sekti = true; }
      else if (b.y >= s.alt - 10) { b.y = s.alt - 10; b.vy = -Math.abs(b.vy) * AYAR.baltaSekmeCarpan; sekti = true; }
      if (sekti) {
        b.kavisYon = -b.kavisYon; b.sekmeT = 0.14; b.faz = 'don';
        sars(1.8, 0.06);
      } else if (b.yol >= AYAR.baltaMenzil) {
        if (AYAR.baltaBekle > 0) { b.faz = 'bekle'; b.bekleT = AYAR.baltaBekle; }
        else b.faz = 'don';
      }
    } else {
      b.donT += dt;
      // oyuncunun el hizasına akıcı yakalama + yakın mesafede mıknatıs
      var ox = b.x, oy = b.y;
      b.donOnceX=ox; b.donOnceY=oy;
      var hx = P.x + Math.cos(P.aci + 0.35) * 10, hy = P.y + Math.sin(P.aci + 0.35) * 10;
      var dx = hx - b.x, dy = hy - b.y, l = Math.hypot(dx, dy) || 1;
      var h = AYAR.baltaDonHiz * (l > 300 ? 1.15 : 1);
      var kavis = b.donT < 0.22 && !b.kavisYok ? AYAR.baltaKavis * (1 - b.donT / 0.22) * Math.min(1, l / 120) : 0;
      var tvx = (dx / l) * h + (-dy / l) * kavis * b.kavisYon;
      var tvy = (dy / l) * h + (dx / l) * kavis * b.kavisYon;
      var steer = Math.min(1, dt * (l < 110 ? 34 : l < 180 ? 24 : 16));
      b.vx += (tvx - b.vx) * steer;
      b.vy += (tvy - b.vy) * steer;
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.z = 38 + 6 * Math.max(0, 1 - l / 180);
      // hareket çizgisi elden geçerse yüksek dt'de bile kaçırmaz
      var sx = b.x - ox, sy = b.y - oy, sl2 = sx * sx + sy * sy;
      var u = sl2 > 1 ? Math.max(0, Math.min(1, ((hx - ox) * sx + (hy - oy) * sy) / sl2)) : 1;
      var yakDist = Math.hypot(hx - (ox + sx * u), hy - (oy + sy * u));
      if (yakDist < 44 || !P.canli) {
        baltaSil(); P.baltaVar = true;
        if (P.canli) {
          // yakalama anı: tok bir "şak" + sonraki vuruş hızlı
          emit('baltaDondu', { x: P.x, y: P.y, yakala: true });
          dondur(AYAR.yakalaDondur); sars(AYAR.yakalaSars, 0.08);
          S.hizliT = AYAR.hizliPencere;
        }
        return;
      }
    }
    // isabet: her düşmana gidişte bir, dönüşte bir (dönen balta daha geniş biçer)
    // DELİP GEÇME: balta kimsede durmaz; gidişte (bekleme dahil) ve dönüşte yolundaki herkese birer kez vurur
    var donus = b.faz === 'don', vurulan = donus ? b.vurDon : b.vurGit, bR = donus ? AYAR.baltaDonR : AYAR.baltaR;
    var bHs0 = AYAR.baltaHasar * (donus ? AYAR.baltaDonHasar : 1);
    var bHs = bHs0 * (P.ofkeli ? AYAR.ofkeHasar : 1);
    var aday = dusmanlar(b.x, b.y, bR + 60), n = 0, aci = Math.hypot(b.vx, b.vy) > 5 ? Math.atan2(b.vy, b.vx) : b.atAci;
    var vListe = donus ? (b.varilDon || (b.varilDon = [])) : (b.varilGit || (b.varilGit = []));
    var tListe = donus ? (b.totemDon || (b.totemDon = [])) : (b.totemGit || (b.totemGit = []));
    if (!baltaYerVurdu(vListe, b.x, b.y, (bR + 36) * 2)) {
      var bvr = vurVaril(b.x, b.y, bR, bHs);
      if (bvr !== 0) { vListe.push({ x: b.x, y: b.y }); if (bvr > 0) n++; }
    }
    if (!baltaYerVurdu(tListe, b.x, b.y, (bR + 40) * 2)) {
      var btr = vurTotem(b.x, b.y, bR, bHs, 'balta');
      if (btr !== 0) { tListe.push({ x: b.x, y: b.y }); if (btr > 0) n++; }
    }
    for (var i = 0; i < aday.length; i++) {
      var d = aday[i]; if (d.olu || vurulan.indexOf(d) >= 0) continue;
      if (Math.hypot(d.x - b.x, d.y - b.y) > bR + (d.r || 20)) continue;
      vurulan.push(d);
      var hs0 = bHs0, hs = bHs;
      var bg = donus ? AYAR.baltaDonGuc : AYAR.baltaGuc;
      // dev için: donus/geriCagir/konum alanları (dev.js telgrafta isabeti kendisi değerlendirir)
      var son = hasarVer(d, hs, { aci: aci, guc: bg, tur: 'balta', delici: true, donus: donus, geriCagir: !!b.cagrildi,
        x: b.x, y: b.y, z: b.z, sira: vurulan.length }) || {};
      if (son.kesme) P.baltaIst.kesme++;
      if (!son.blok) P.baltaIst.isabet++;
      if (vurulan.length >= 2 && !son.blok) P.baltaIst.delinen++;
      n++; isabetSonrasi(d, son, aci, bg, 'balta', false, {
        kesme: !!son.kesme, donus: donus, geriCagir: !!b.cagrildi, sira: vurulan.length, delici: true,
        ofkeCarpan: Math.min(2, hs0 / AYAR.baltaOfkeTaban) });
      if (b.faz === 'git') { b.vx *= 0.94; b.vy *= 0.94; b.sekmeT = 0.08; }
    }
    if (vurulan.length > P.baltaIst.enCok) P.baltaIst.enCok = vurulan.length;
    if (n) { dondur(0.03); sars(2.5, 0.1); }
    if (b.g) {
      b.g.x = b.x; b.g.y = b.y; b.g.zIndex = b.y + 30;
      var hizSimdi = Math.hypot(b.vx, b.vy);
      var spinOran = (0.45 + 0.85 * (hizSimdi / AYAR.baltaHiz)) * (b.sekmeT > 0 ? 1.35 : 1);
      b.g.don.rotation += AYAR.baltaDon * spinOran * dt * b.spinYon;
      b.g.don.y = -b.z;
      if (b.g.golge) {
        var gs = 0.85 + (44 - b.z) * 0.015;
        b.g.golge.scale.set(gs, gs);
      }
    }
  }

  // ---------------------------------------------------------------- isabet ortak
  function isabetSonrasi(d, son, aci, guc, tur, agir, ek) {
    son = son || {};
    if (son.blok) return;   // 'blok' olayını dusman.js yayar
    var v = { hedef: d, x: d.x, y: d.y, aci: aci, guc: guc, tur: tur, oldurdu: !!son.oldu, agir: !!agir };
    // balta: kesme (saldırı iptali), donus, geriCagir, sira (kaçıncı delinen) alanları
    if (ek) for (var k in ek) if (k !== 'ofkeCarpan' && k !== 'ofkeHarca') v[k] = ek[k];
    emit('vurus', v);
    S.sonIsabet = 0;
    var oc = ek && isFinite(ek.ofkeCarpan) ? ek.ofkeCarpan : 1;   // balta: hasarıyla orantılı öfke
    if (!P.ofkeli && !(ek && ek.ofkeHarca)) P.ofke = Math.min(100, P.ofke + AYAR.ofkeIsabet * oc + (son.oldu ? AYAR.ofkeOldur : 0));
  }

  // ---------------------------------------------------------------- savurma
  function savurBasla(nisanAci, agirZorla) {
    if (agirZorla) S.zNo = AYAR.zincir.length - 1;
    var z = AYAR.zincir[S.zNo % AYAR.zincir.length];
    var ofk = P.ofkeli;
    var menzil = ofk ? z.menzil * AYAR.ofkeMenzil / AYAR.zincir[0].menzil : z.menzil;
    var a = nisanAci;
    // akıllı nişan yardımı: nişan çizgisine yakınlık + mesafe skoru ile kontrolü almadan hafif hizala
    var aday = dusmanlar(P.x, P.y, menzil + 55), en = null, enSkor = 1e9, enD = 1e9;
    for (var i = 0; i < aday.length; i++) {
      var d = aday[i]; if (d.olu) continue;
      var dx = d.x - P.x, dy = d.y - P.y, m = Math.hypot(dx, dy);
      var dr = d.r || 20;
      if (m - dr > menzil + 28) continue;
      var da = Math.abs(aciFark(Math.atan2(dy, dx), nisanAci));
      if (da < 48 * D2R) {
        var skor = da * 85 + Math.max(0, m - dr);
        if (skor < enSkor) { enSkor = skor; enD = m; en = d; }
      }
    }
    if (en) {
      var fa = aciFark(Math.atan2(en.y - P.y, en.x - P.x), nisanAci), lim = AYAR.nisanYardim * D2R;
      a = nisanAci + Math.max(-lim, Math.min(lim, fa));
    }
    S.aimKurtar = aciYon(a) !== aciYon(nisanAci);
    S.nisanTaze = true;
    // tempo: öfkede hızlı; atılma çıkışı / balta yakalama sonrası hazırlık kısa ("hızlı vuruş")
    var tempo = ofk ? AYAR.ofkeTempo : 1;
    var hizli = S.hizliT > 0; S.hizliT = 0;
    S.sv = {
      z: z, aci: a, agir: !!z.agir, hedef: en, hedefD: enD,
      yay: (ofk ? Math.max(AYAR.ofkeYay, z.yay) : z.yay) * D2R,
      menzil: menzil,
      hasar: z.hasar *(ofk ? AYAR.ofkeHasar : 1), guc: z.guc * (ofk ? 1.25 : 1),
      hazir: z.hazir / tempo * (hizli ? AYAR.hizliHazir : 1), etkin: z.etkin / tempo, toparla: z.toparla / tempo
    };
    S.vurulan = []; S.sekenler = []; S.svOldur = 0; S.svVaril = false; S.svTotem = false;
    P.durum = 'savur'; S.faz = 'hazir'; S.fazT = S.sv.hazir; S.yuruyor = false; S.kilitAd = '';
    yonGuncelle(a);
    var an = z.anim;
    if (z.agir && P.sprite && P.sprite.animVar && P.sprite.animVar('vur3') && !P.sprite.yerTutucu) an = 'vur3';
    // kareler savurmanın evrelerine eşlenir: hazırlanma → vuruş karesi (hasar) → toparlanma
    var tn = animTanim(an), n = (tn && tn.n) || 6;
    var hk = tn && isFinite(tn.vurusKare) ? tn.vurusKare : tn && isFinite(tn.vurus) ? tn.vurus : Math.round(n * AYAR.vurusOran);
    S.sv.n = n; S.sv.hk = Math.max(1, Math.min(n - 2, hk));
    S.sonraki = false; S.sonrakiAgir = false;
    anim(an, { dongu: false, bastan: true, hiz: 0 });
    savurKare();
    // 'savur' olayı (yay izi + ses) hazırlanma bitince, balta vuruş karesine geldiğinde yayılır (savurGuncelle)
    S.sv.zincir = S.zNo % 3;
  }
  // animasyon, savurmanın toplam süresine sığsın
  function animHiz(ad, sure) {
    try {
      var an = animTanim(cozAd(ad));
      if (an && an.n && an.fps) return Math.max(0.5, Math.min(3, (an.n / an.fps) / sure));
    } catch (e) {}
    return 1;
  }
  function savurKare() {
    var sv = S.sv; if (!sv) return;
    var t;
    // etkin evre, kalan karelerin süresine düşen payını oynar (çok kareli pakette vuruş karesinde donup kalmaz)
    var ke = Math.max(1, Math.min(sv.n - sv.hk - 1, Math.round((sv.n - sv.hk) * sv.etkin / (sv.etkin + sv.toparla))));
    if (S.faz === 'hazir') t = sv.hk * (1 - Math.max(0, S.fazT) / sv.hazir);
    else if (S.faz === 'etkin') t = sv.hk + ke * (1 - Math.max(0, S.fazT) / sv.etkin);
    else t = sv.hk + ke + (sv.n - sv.hk - ke) * (1 - Math.max(0, S.fazT) / sv.toparla);
    kareKoy(t);
  }
  function savurGuncelle(dt, g, nisan) {
    var sv = S.sv, z = sv.z;
    S.fazT -= dt;
    // sektirme penceresi hazırlığın son anında açılır (ok/kaya "tam vaktinde" karşılanır)
    if (S.faz === 'hazir' && S.fazT <= AYAR.sektirErken) sektirTara();
    if (S.faz === 'hazir' && S.fazT <= 0) {
      S.faz = 'etkin'; S.fazT += sv.etkin;
      emit('savur', { x: P.x, y: P.y, aci: sv.aci, ofkeli: P.ofkeli, zincir: sv.zincir, agir: sv.agir, yay: sv.yay, menzil: sv.menzil });
      // öne adım (lunge) + hedefe mıknatıs: hedef yakınsa aradaki boşluğu (hedefBosluk'a kadar) kapat, dibindeyse adım atma
      var adim = z.adim * (P.ofkeli ? 1.15 : 1);
      var h = sv.hedef;
      if (h && !h.olu) {
        var bosluk = Math.hypot(h.x - P.x, h.y - P.y) - (h.r || 20) - P.r;
        var git = Math.max(0, Math.min(AYAR.miknatisEn, bosluk - AYAR.hedefBosluk));
        if (bosluk < AYAR.miknatisMenzil + AYAR.hedefBosluk) {
          adim = git * AYAR.disSonum;
          // hedefe doğru (nişan yönünden biraz hedefe çekilmiş) adım
          var ha = Math.atan2(h.y - P.y, h.x - P.x), ya = sv.aci + aciFark(ha, sv.aci) * 0.6;
          P.dvx += Math.cos(ya) * adim; P.dvy += Math.sin(ya) * adim;
          adim = 0;
        }
      }
      if (adim) { P.dvx += Math.cos(sv.aci) * adim; P.dvy += Math.sin(sv.aci) * adim; }
    }
    if (S.faz === 'etkin') {
      vurusTara();
      sektirTara();
      if (S.fazT <= 0) { S.faz = 'toparla'; S.fazT += sv.toparla; }
    } else if (S.faz === 'toparla' && g && (S.sonraki || g.savurTut) && P.baltaVar && !g.balta && S.fazT <= sv.toparla * (z.agir ? AYAR.zincirKesAgir : AYAR.zincirKes)) {
      // tamponlanmış sıradaki vuruş: toparlanmanın kuyruğu kesilir, zincir aynı ritimde akar
      var agirSonra = S.sonrakiAgir || !!g.agirBas;
      P.durum = 'serbest'; S.faz = ''; S.sv = null;
      S.zNo = z.agir ? 0 : S.zNo + 1; S.zPencere = z.agir ? 0 : AYAR.zincirPencere;
      S.sonraki = false; S.sonrakiAgir = false; S.tSavur = 0; S.tAgir = 0; savurBasla(nisan, agirSonra); return;
    } else if (S.faz === 'toparla' && S.fazT <= 0) {
      P.durum = 'serbest'; S.faz = ''; S.sv = null;
      S.zNo = z.agir ? 0 : S.zNo + 1;
      S.zPencere = z.agir ? 0 : AYAR.zincirPencere;
      // sıradaki vuruş tamponlandıysa / tuş basılıysa aynı karede başla (araya yürüme karesi girmez)
      if (g && P.baltaVar && !g.balta && (S.sonraki || S.tSavur > 0 || g.savurTut)) {
        var agirSonra2 = S.sonrakiAgir || S.tAgir > 0 || !!g.agirBas;
        S.sonraki = false; S.sonrakiAgir = false; S.tSavur = 0; S.tAgir = 0; savurBasla(nisan, agirSonra2); return;
      }
      S.sonraki = false; S.sonrakiAgir = false;
      return;
    }
    savurKare();
  }
  function yayIcinde(px, py, x, y, r, sv) {
    var dx = x - px, dy = y - py, m = Math.hypot(dx, dy);
    if (m - r > sv.menzil) return false;
    if (m < r + P.r + 4) return true;     // dibindeyse her yönden say
    var tol = Math.atan2(r, m);
    return Math.abs(aciFark(Math.atan2(dy, dx), sv.aci)) <= sv.yay / 2 + tol;
  }
  function vurusTara() {
    var sv = S.sv;
    var cx = P.x + Math.cos(sv.aci) * (sv.menzil * 0.48), cy = P.y + Math.sin(sv.aci) * (sv.menzil * 0.48), cr = sv.menzil * 0.68;
    var cevreIsabet = false;
    if (!S.svVaril) {
      var vr = vurVaril(cx, cy, cr, sv.hasar);
      if (vr !== 0) { S.svVaril = true; if (vr > 0) cevreIsabet = true; }
    }
    if (!S.svTotem) {
      var tr = vurTotem(cx, cy, cr, sv.hasar, sv.agir ? 'agir' : 'savur');
      if (tr !== 0) { S.svTotem = true; if (tr > 0) cevreIsabet = true; }
    }
    var aday = dusmanlar(P.x, P.y, sv.menzil + 80), vurulanlar = [];
    for (var i = 0; i < aday.length; i++) {
      var d = aday[i]; if (d.olu || S.vurulan.indexOf(d) >= 0) continue;
      if (!yayIcinde(P.x, P.y, d.x, d.y, d.r || 20, sv)) continue;
      S.vurulan.push(d); vurulanlar.push(d);
    }
    if (!vurulanlar.length) {
      if (cevreIsabet) { dondur(0.025); sars(sv.agir ? 3 : 2, 0.09); }
      return;
    }
    var n = 0, blok = 0;
    for (var k = 0; k < vurulanlar.length; k++) {
      var d2 = vurulanlar[k];
      // itiş yönü: dışa doğru savurma + baltanın süpürme yönünde teğetsel momentum
      var dx2 = d2.x - P.x, dy2 = d2.y - P.y, m2 = Math.hypot(dx2, dy2);
      var ad = m2 > 1 ? Math.atan2(dy2, dx2) : sv.aci;
      var sapma = aciFark(ad, sv.aci);
      var disAci = sv.aci + sapma * (m2 < 36 ? 0.35 : 0.72);
      var teget = sv.z.teget || 0;
      var aci = Math.atan2(Math.sin(disAci) + Math.cos(ad) * teget, Math.cos(disAci) - Math.sin(ad) * teget);
      var guc = sv.guc * (0.88 + 0.12 * (1 - Math.min(1, Math.abs(sapma) / ((sv.yay * 0.5) || 1))));
      var son = hasarVer(d2, sv.hasar, { aci: aci, guc: guc, tur: 'savur', agir: sv.agir }) || {};
      if (son.blok) blok++; else { n++; if (son.oldu) S.svOldur++; }
      isabetSonrasi(d2, son, aci, guc, 'savur', sv.agir);
    }
    var toplamN = S.vurulan.length;
    if (n) {
      // duraksama/sarsıntı eğrisi: savurmadaki toplam isabet (+öldürme) arttıkça büyür, üst sınırlı
      var ek = Math.min(toplamN - 1, 5), t, sg;
      if (sv.agir) {
        t = Math.min(AYAR.donAgirEn, AYAR.donAgir + AYAR.donAgirEk * ek + AYAR.donOldur * Math.min(2, S.svOldur));
        sg = Math.min(AYAR.sarsAgirEn, AYAR.sarsAgir + AYAR.sarsAgirEk * ek);
      } else {
        t = Math.min(AYAR.donEn, AYAR.donTaban + AYAR.donEk * ek + AYAR.donOldur * Math.min(2, S.svOldur));
        sg = Math.min(AYAR.sarsEn, AYAR.sarsTaban + AYAR.sarsEk * ek);
      }
      if (P.ofkeli) t *= 1.15;
      dondur(t);
      sars(sg, sv.agir ? 0.22 : 0.12);
      // bitirici: duraksamadan sonra kısa ağır çekim (yalnız savurmanın ilk isabetinde)
      if (sv.agir && !sv.yavasladi && OYUN.zaman && OYUN.zaman.yavaslat) { sv.yavasladi = true; OYUN.zaman.yavaslat(AYAR.agirYavas, AYAR.agirYavasSure); }
    } else if (blok) {
      dondur(0.05); sars(4, 0.1);
      P.dvx -= Math.cos(sv.aci) * 160; P.dvy -= Math.sin(sv.aci) * 160;   // kalkandan geri sekme
    }
  }
  function sektirTara() {
    var sv = S.sv, cx = P.x, cy = P.y;   // mermi x,y yerdeki izdüşüm (yükseklik m.z ayrı)
    // Taze savuruş kayayı geri gönderir. Zincirin ağır bitirişi yalnız yana iter.
    var kayaTaze = OYUN.zaman.t - S.kayaSavurT <= 0.27;
    var kaya = (kayaTaze || sv.agir) && window.DEV && DEV.kayaSektir && DEV.kayaSektir(cx, cy, sv.aci, sv.menzil, sv.yay / 2, kayaTaze);
    if (kaya) { S.kayaSavurT = -Infinity; sektirGeriBildirim(kaya); }
    if (!window.MERMI || !MERMI.liste) return;
    for (var i = 0; i < MERMI.liste.length; i++) {
      var m = MERMI.liste[i];
      if (!m || m.sahip !== 'dusman' || S.sekenler.indexOf(m) >= 0 || m.olu || m.bitti) continue;
      if (!yayIcinde(cx, cy, m.x, m.y, (m.r || 6) + 10, sv)) continue;
      // tam zamanında (mermi göğse çok yakınken) karşılanırsa daha hızlı ve en yakın düşmana yönelir
      var kus = Math.hypot(m.x - cx, m.y - (cy - AYAR.nisanYuksek)) < AYAR.sektirKusursuz || Math.hypot(m.x - cx, m.y - cy) < AYAR.sektirKusursuz;
      var h = Math.hypot(m.vx || 0, m.vy || 0) * (kus ? AYAR.sektirKusursuzHiz : AYAR.sektirHiz) || 500;
      // geldiği yöne (ters hız) ile nişanın ortası
      var geri = Math.atan2(-(m.vy || 0), -(m.vx || 0));
      var a = sv.aci + aciFark(geri, sv.aci) * 0.4;
      if (kus) {
        var en = null, enD = 1e9, ds = (window.DUSMAN && DUSMAN.liste) || [];
        for (var j = 0; j < ds.length; j++) {
          var d = ds[j]; if (d.olu) continue;
          var da = Math.atan2(d.y - m.y, d.x - m.x), dm = Math.hypot(d.x - m.x, d.y - m.y);
          if (dm < 700 && Math.abs(aciFark(da, a)) < AYAR.sektirHedefYay * D2R && dm < enD) { enD = dm; en = d; }
        }
        if (en) a = Math.atan2(en.y - m.y, en.x - m.x);
      }
      if (MERMI.sektir) MERMI.sektir(m, a, h);
      else { m.vx = Math.cos(a) * h; m.vy = Math.sin(a) * h; m.sahip = 'oyuncu'; }
      S.sekenler.push(m);
      sektirGeriBildirim({ x: m.x, y: m.y, aci: a, tur: m.tur, kusursuz: kus });
    }
  }
  function sektirGeriBildirim(olay) {
    emit('sektir', olay);
    var kus = olay.kusursuz;
    dondur(kus ? 0.075 : 0.05); sars(kus ? 4.5 : 3, 0.1);
    if (!P.ofkeli) P.ofke = Math.min(100, P.ofke + AYAR.ofkeIsabet + (kus ? AYAR.sektirKusursuzOfke : 0));
  }

  // ---------------------------------------------------------------- atılma
  function atilBasla(g) {
    var a;
    if (Math.abs(g.hx) + Math.abs(g.hy) > 0.1) a = Math.atan2(g.hy, g.hx); else a = P.aci;
    P.durum = 'atil'; S.atilT = AYAR.atilSure; S.atilAci = a; S.atilBekle = AYAR.atilBekle; S.atilVurulan = [];
    P.tutusT = 0;   // atılma tutuşmayı söndürür
    S.faz = ''; S.sv = null; S.yuruyor = false; S.sonraki = false; S.aimKurtar = false; P.dvx = 0; P.dvy = 0;
    P.dokunulmazSure = Math.max(P.dokunulmazSure, AYAR.atilSure + AYAR.atilEkDokunulmaz);
    yonGuncelle(a);
    anim('atil', { dongu: false, bastan: true, hiz: animHiz('atil', AYAR.atilSure + 0.06) });
    kilit('atil', AYAR.atilSure + AYAR.kilitPay);
    emit('atil', { x: P.x, y: P.y, aci: a });
  }
  function atilGuncelle(dt, g, nisan) {
    // patlayıcı çıkış + yumuşak fren (integrali = 1 -> toplam mesafe korunur)
    var u = 1 - Math.max(0, S.atilT) / AYAR.atilSure;
    var h = (AYAR.atilMesafe / AYAR.atilSure) * 1.315 * (1 - 0.72 * u * u);
    P.vx = Math.cos(S.atilAci) * h; P.vy = Math.sin(S.atilAci) * h;
    S.atilT -= dt;
    var aday = dusmanlar(P.x, P.y, P.r + 70), n = 0;
    for (var i = 0; i < aday.length; i++) {
      var d = aday[i]; if (d.olu || S.atilVurulan.indexOf(d) >= 0) continue;
      if (Math.hypot(d.x - P.x, d.y - P.y) > P.r + (d.r || 20) + 12) continue;
      S.atilVurulan.push(d);
      // yana savur: atılma çizgisine göre teğetsel + yana açılma (savur ile uyumlu)
      var df = aciFark(Math.atan2(d.y - P.y, d.x - P.x), S.atilAci);
      var yan = df >= 0 ? 1 : -1;
      var aci = S.atilAci + yan * (0.72 + Math.min(0.38, Math.abs(Math.sin(df)) * 0.45));
      var hs = AYAR.atilHasar * (P.ofkeli ? AYAR.ofkeHasar : 1);
      var son = hasarVer(d, hs, { aci: aci, guc: AYAR.atilGuc, tur: 'atilma' });
      n++; isabetSonrasi(d, son, aci, AYAR.atilGuc, 'atilma', false);
    }
    if (n) { dondur(0.025); sars(3, 0.08); }
    if (S.atilT <= 0) {
      P.durum = 'serbest'; S.hizliT = AYAR.hizliPencere;
      P.dvx = P.vx * 0.15; P.dvy = P.vy * 0.15;   // yumuşak bitiş kayması
      P.vx *= 0.55; P.vy *= 0.55;
      if (g && P.baltaVar && !g.balta && S.tBalta <= 0 && (S.tSavur > 0 || g.savurTut)) {
        var agirAtil = S.tAgir > 0 || !!g.agirBas;
        S.tSavur = 0; S.tAgir = 0; savurBasla(nisan, agirAtil);
      }
    }
  }

  // ---------------------------------------------------------------- can / öfke
  function hasarAl(miktar, o) {
    o = o || {};
    if (!P.canli || OYUN.durum !== 'oyun') return false;
    if (P.dokunulmazSure > 0) return false;
    if (P.ofkeli) miktar *= (1 - AYAR.ofkeKalkan);
    var aci = o.aci;
    if (aci === undefined && isFinite(o.x)) aci = Math.atan2(P.y - o.y, P.x - o.x);
    if (aci === undefined || !isFinite(aci)) aci = isFinite(P.aci) ? P.aci + PI : 0;   // NaN koruması (yönetici)
    if (!isFinite(miktar) || miktar < 0) miktar = 0;
    var once = P.can;
    P.can = Math.max(OLUMSUZ ? 1 : 0, P.can - miktar);
    if (!P.ofkeli) P.ofke = Math.min(100, P.ofke + miktar * AYAR.ofkeHasarAl);
    P.dokunulmazSure = AYAR.dokunulmaz;
    var guc = (o.guc !== undefined && isFinite(o.guc)) ? o.guc : AYAR.itilme;
    var donusSuruyor = P.durum === 'kasirga' && P.kasirgaFaz >= 0 && guc < AYAR.kasirga.kesilmeGucu;
    var itis = guc * (donusSuruyor ? 0.4 : 1);
    P.dvx += Math.cos(aci) * itis; P.dvy += Math.sin(aci) * itis;
    emit('oyuncuHasar', { miktar: miktar, canKaybi: once - P.can, x: P.x, y: P.y, aci: aci });
    sars(Math.min(12, 3 + miktar * 0.35), 0.18);
    if (P.can <= 0) { olum(); return true; }
    dondur(Math.min(0.07, AYAR.hasarDondur + miktar * 0.0015));   // darbe "oturur": kısa, adil
    // öfkedeyken sersemlemez (zırh); savurmanın etkin anı da kesilmez
    if (!P.ofkeli && !donusSuruyor && P.durum !== 'atil' && !(P.durum === 'savur' && S.faz === 'etkin')) {
      if (P.durum === 'kasirga') {
        P.kasirgaFaz = -1;
        S.kasirgaVurulan.clear();
      }
      P.durum = 'sersem'; S.sersemT = AYAR.sersemSure; S.faz = ''; S.sv = null; S.yuruyor = false; S.sonraki = false; S.aimKurtar = false;
      anim('sersem', { dongu: false, bastan: true, hiz: animHiz('sersem', AYAR.sersemSure + 0.08) });
      kilit('sersem', AYAR.sersemSure + AYAR.kilitPay);
    }
    S.parlaT = AYAR.hasarParla;
    return true;
  }
  // 19 Kasım (Yakıcı): yanma hasarı — vuruş değil; titreme/sersem/geri itme ve dokunulmazlık penceresi yok
  function yanmaAl(miktar, o) {
    if (!P.canli || OYUN.durum !== 'oyun' || P.durum === 'atil') return false;   // atılma alevin içinden geçirir
    if (P.ofkeli) miktar *= (1 - AYAR.ofkeKalkan);
    if (!isFinite(miktar) || miktar <= 0) return false;
    var once = P.can;
    P.can = Math.max(OLUMSUZ ? 1 : 0, P.can - miktar);
    if (!P.ofkeli) P.ofke = Math.min(100, P.ofke + miktar * AYAR.ofkeHasarAl);
    emit('oyuncuHasar', { miktar: miktar, canKaybi: once - P.can, x: P.x, y: P.y, aci: 0, yanma: true, kaynak: o && o.kaynak });
    if (P.can <= 0) { olum(); return true; }
    S.parlaT = Math.max(S.parlaT || 0, 0.05);
    return true;
  }
  function tutus(sure) {
    if (!P.canli || P.durum === 'atil') return;
    if (!(P.tutusT > 0)) S.tutusTik = 0;
    P.tutusT = Math.max(P.tutusT || 0, sure || 1.5);
  }
  function tutusGuncelle(dt) {
    if (!(P.tutusT > 0)) return;
    if (P.durum === 'atil' || !P.canli) { P.tutusT = 0; return; }   // atılma söndürür
    P.tutusT -= dt; S.tutusTik = (S.tutusTik || 0) + dt;
    var D = window.DUSMAN && DUSMAN.AYAR && DUSMAN.AYAR.ates, tik = (D && D.tik) || 0.25, m = (D && D.tutusTik) || 1;
    while (S.tutusTik >= tik) { S.tutusTik -= tik; yanmaAl(m, { kaynak: 'tutus' }); }
    if (P.tutusT <= 0) P.tutusT = 0;
  }
  function iyiles(m) {
    if (!P.canli) return;
    var once = P.can;
    P.can = Math.min(P.canMax, P.can + (m || 0));
    if (P.can > once) emit('oyuncuIyilesti', { miktar: P.can - once });
  }
  function olum() {
    P.canli = false; P.durum = 'olu'; P.vx = P.vy = 0; P.tutusT = 0;
    S.faz = ''; S.sv = null; S.atBekleyen = null; S.kilitAd = ''; S.sonraki = false; S.parlaT = 0;
    baltaSil();
    if (P.ofkeli) { P.ofkeli = false; emit('ofke', { acik: false }); }
    anim('ol', { dongu: false, bastan: true });
    // ölüm anı: ağır duraksama + yavaş çöküş
    dondur(AYAR.olumDondur); sars(12, 0.45);
    if (OYUN.zaman && OYUN.zaman.yavaslat) OYUN.zaman.yavaslat(AYAR.olumYavas, AYAR.olumYavasSure);
    emit('oyuncuOldu', { x: P.x, y: P.y });
    if (OYUN.durumYap) OYUN.durumYap('oldu');
  }
  // Başlangıç yönü sprite'ın sekiz yönden seçtiği yönle aynı tutulur.
  function kasirgaBasla(nisan) {
    if (OYUN.bolum < 2 || P.durum !== 'serbest' || !P.baltaVar || P.ofkeli || P.ofke <= 0) return false;
    if (!P.sprite || !P.sprite.animVar || !P.sprite.animVar('kasirga_don')) return false;
    S.sonIsabet = 0; S.tSavur = 0; S.tAgir = 0; S.tBalta = 0; S.zNo = 0; S.zPencere = 0;
    yonGuncelle(nisan);
    P.kasirgaAci = yonMerkez(P.yon); P.kasirgaFaz = -1;
    S.kasirgaT = 0; S.kasirgaEvre = 'hazir';
    P.durum = 'kasirga';
    anim('kasirga', { dongu: false, bastan: true, hiz: 0 });
    return true;
  }
  function kasirgaTurBasla() {
    var ilk = S.kasirgaEvre === 'hazir';
    S.kasirgaEvre = 'don'; P.kasirgaFaz = 0;
    S.kasirgaVurulan.clear(); S.kasirgaCevre = false;
    if (P.sprite.anim !== 'kasirga_don') P.sprite.oynat('kasirga_don', 0, { dongu: true, hiz: 0 });
    emit('kasirga', { x: P.x, y: P.y, aci: P.kasirgaAci, ilk: ilk });
  }
  function kasirgaBitir() {
    if (P.kasirgaFaz >= 0) {
      P.yon = (P.yon + Math.round(P.kasirgaFaz * 8)) % 8;
      P.aci = yonMerkez(P.yon);
    }
    S.kasirgaT = 0; S.kasirgaEvre = 'toparla'; P.kasirgaFaz = -1;
    S.kasirgaVurulan.clear();
    anim('kasirga', { dongu: false, bastan: true, hiz: 0 });
    kareKoy(P.sprite._a.n * 0.4);
  }
  function kasirgaVur(c0, c1) {
    var a = AYAR.kasirga;
    var orta = P.kasirgaAci + ((c0 + c1) * 0.5 - 0.22) * PI * 2;
    var yay = (c1 - c0) * PI + 0.36;
    var adaylar = dusmanlar(P.x, P.y, a.menzil);
    for (var i = 0; i < adaylar.length; i++) {
      var d = adaylar[i], kim = d.id != null ? d.id : d;
      if (d.olu || S.kasirgaVurulan.has(kim)) continue;
      if (Math.hypot(d.x - P.x, d.y - P.y) > a.menzil + (d.r || 20)) continue;
      var aci = Math.atan2(d.y - P.y, d.x - P.x);
      if (Math.abs(aciFark(aci, orta)) > yay) continue;
      S.kasirgaVurulan.add(kim);
      var sonuc = hasarVer(d, a.hasar, { aci: aci, guc: a.guc, tur: 'savur', agir: true });
      isabetSonrasi(d, sonuc, aci, a.guc, 'kasirga', false, { ofkeHarca: true });
    }
    if (!S.kasirgaCevre && c1 >= 0.65) {
      S.kasirgaCevre = true;
      vurVaril(P.x, P.y, a.menzil, a.hasar);
      vurTotem(P.x, P.y, a.menzil, a.hasar, 'agir');
    }
  }
  function kasirgaGuncelle(dt, tutuluyor) {
    var a = AYAR.kasirga;
    if (S.kasirgaEvre === 'toparla') {
      S.kasirgaT += dt;
      kareKoy((0.4 + 0.6 * Math.min(1, S.kasirgaT / a.toparlan)) * P.sprite._a.n);
      if (S.kasirgaT >= a.toparlan) P.durum = 'serbest';
      return;
    }
    if (!tutuluyor || P.ofke <= 0 || !P.baltaVar) { kasirgaBitir(); return; }
    var aktifDt = Math.min(dt, P.ofke / a.ofkeSaniye);
    P.ofke = Math.max(0, P.ofke - dt * a.ofkeSaniye);
    S.sonIsabet = 0;
    if (S.kasirgaEvre === 'hazir') {
      var hazirDt = Math.min(aktifDt, a.hazirlik - S.kasirgaT);
      S.kasirgaT += hazirDt;
      aktifDt -= hazirDt;
      kareKoy(S.kasirgaT / a.hazirlik * 6);
      if (S.kasirgaT >= a.hazirlik && (aktifDt > 0 || P.ofke > 0)) {
        S.kasirgaT = 0;
        kasirgaTurBasla();
      }
    }
    while (aktifDt > 0 && S.kasirgaEvre === 'don') {
      var kalan = a.donus - S.kasirgaT;
      var adim = Math.min(aktifDt, kalan);
      var once = S.kasirgaT / a.donus;
      S.kasirgaT += adim;
      aktifDt -= adim;
      P.kasirgaFaz = Math.min(1, S.kasirgaT / a.donus);
      kasirgaVur(once, P.kasirgaFaz);
      if (adim < kalan || (aktifDt <= 0 && P.ofke <= 0)) break;
      S.kasirgaT = 0;
      kasirgaTurBasla();
    }
    if (S.kasirgaEvre === 'don') kareKoy(((P.yon / 8 + P.kasirgaFaz) % 1) * P.sprite._a.n);
    if (P.ofke <= 0) kasirgaBitir();
  }

  function ofkeGuncelle(dt, g) {
    if (P.ofkeli) {
      S.ofkeT -= dt;
      P.ofke = Math.max(0, 100 * S.ofkeT / AYAR.ofkeSure);
      if (S.ofkeT <= 0) { P.ofkeli = false; P.ofke = 0; emit('ofke', { acik: false }); }
    } else {
      S.sonIsabet += dt;
      if (S.sonIsabet > AYAR.ofkeAzalBekle && P.ofke < 100) P.ofke = Math.max(0, P.ofke - AYAR.ofkeAzal * dt);
      if (g.ofke && P.ofke >= 100 && P.canli && P.durum !== 'kasirga') {
        P.ofkeli = true; S.ofkeT = AYAR.ofkeSure;
        S.ofkeCanKaldi = AYAR.ofkeCanSiniri;
        if (P.durum === 'serbest' && P.baltaVar && P.sprite && P.sprite.animVar && P.sprite.animVar('ofke_kukre')) {
          S.kukreT = 0; P.durum = 'kukre';
          anim('ofke_kukre', { dongu: false, bastan: true, hiz: 0 });
        }
        emit('ofke', { acik: true, x: P.x, y: P.y });
        sars(AYAR.ofkeAcSars, 0.30);
        P.dokunulmazSure = Math.max(P.dokunulmazSure, AYAR.ofkeAcDokunulmaz);
        // açılış itiş dalgası: çevredekiler dışa savrulur
        var ay = dusmanlar(P.x, P.y, AYAR.ofkeDalgaR + 40);
        for (var i = 0; i < ay.length; i++) {
          var d = ay[i]; if (d.olu) continue;
          if (Math.hypot(d.x - P.x, d.y - P.y) > AYAR.ofkeDalgaR + (d.r || 20)) continue;
          var a = Math.atan2(d.y - P.y, d.x - P.x);
          var son = hasarVer(d, AYAR.ofkeDalgaHasar, { aci: a, guc: AYAR.ofkeDalgaGuc, tur: 'savur', agir: true }, true);
          isabetSonrasi(d, son, a, AYAR.ofkeDalgaGuc, 'savur', true);
        }
        vurVaril(P.x, P.y, AYAR.ofkeDalgaR, AYAR.ofkeDalgaHasar);
        vurTotem(P.x, P.y, AYAR.ofkeDalgaR, AYAR.ofkeDalgaHasar, 'agir');
      }
    }
  }

  // ---------------------------------------------------------------- ana döngü
  function guncelle(dt) {
    if (!P.sprite) spriteKur();
    if (!P.canli) { spriteYerlestir(dt); return; }
    var g = girdiOku(dt);
    var nisan = Math.atan2(g.ny - (P.y - AYAR.nisanYuksek), g.nx - P.x);

    // tampon (balta elde değilken basılan tık daha uzun saklanır: balta ele gelince hemen vuruş olur)
    var saldiriBas = !!(g.savurBas || g.agirBas);
    if (saldiriBas) S.kayaSavurT = OYUN.zaman.t;
    var tamponSure = P.baltaVar ? (P.durum === 'atil' ? Math.max(AYAR.tampon, AYAR.atilSure + 0.05) : AYAR.tampon) : AYAR.baltaTampon;
    S.tSavur = saldiriBas ? tamponSure : Math.max(0, S.tSavur - dt);
    S.tAgir = g.agirBas ? tamponSure : (g.savurBas ? 0 : Math.max(0, S.tAgir - dt));
    // savururken basılan tık kaybolmaz: sıradaki vuruş olarak saklanır
    if (saldiriBas && P.durum === 'savur') {
      S.sonraki = true;
      S.sonrakiAgir = !!g.agirBas;
    }
    // imleç ekranda oynadı mı? (ekran kayınca dünya noktası değişir; bu bakışı çevirmesin)
    var F = (window.GIRDI && GIRDI.fare) || {};
    if (g.klavyeNisan) S.nisanTaze = false;
    else if (OTO || !isFinite(F.ex)) S.nisanTaze = true;
    else {
      if (S.fex !== null && Math.abs(F.ex - S.fex) + Math.abs(F.ey - S.fey) > 3) S.nisanTaze = true;
      S.fex = F.ex; S.fey = F.ey;
    }
    S.tAtil = g.atil ? AYAR.tampon : Math.max(0, S.tAtil - dt);
    S.tBalta = (g.balta && P.baltaVar) ? AYAR.tampon : Math.max(0, S.tBalta - dt);
    // balta dışarıdayken sağ tık: geri çağır (giderken/beklerken, atış başına bir kez; dönüyorsa etkisiz)
    if (g.balta && !P.baltaVar && P.balta) baltaCagir();
    S.atilBekle = Math.max(0, S.atilBekle - dt);
    P.dokunulmazSure = Math.max(0, P.dokunulmazSure - dt);
    if (S.zPencere > 0) { S.zPencere -= dt; if (S.zPencere <= 0) S.zNo = 0; }

    ofkeGuncelle(dt, g);
    if (g.kasirgaTut && P.durum === 'serbest') kasirgaBasla(nisan);
    tutusGuncelle(dt);

    // durum geçişleri
    var atilHazir = S.tAtil > 0 && S.atilBekle <= 0;
    S.hizliT = Math.max(0, S.hizliT - dt);
    // atılma keser: savurmanın hazırlığı/toparlanması, fırlatmanın bırakış sonrası, sersemlemenin ilk anından sonrası
    if (atilHazir && ((P.durum === 'savur' && S.faz !== 'etkin') ||
        (P.durum === 'at' && S.atBekleyen === null) ||
        (P.durum === 'sersem' && AYAR.sersemSure - S.sersemT >= AYAR.sersemKacis) ||
        (P.durum === 'kukre' && S.kukreT >= 0.14))) { S.tAtil = 0; atilBasla(g); }
    if (P.durum === 'sersem') { S.sersemT -= dt; if (S.sersemT <= 0) P.durum = 'serbest'; }
    if (P.durum === 'at') { S.atT -= dt; if (S.atT <= 0) P.durum = 'serbest'; }
    // savurmanın toparlanmasında sağ tık: savurma kesilir, fırlatma pozuna geçilir (balta elde savurma pozu kalmaz)
    if ((g.balta || S.tBalta > 0) && P.baltaVar && P.durum === 'savur' && S.faz === 'toparla') {
      P.durum = 'serbest'; S.faz = ''; S.sv = null; S.sonraki = false; S.zNo = 0; S.zPencere = 0;
    }
    if (P.durum === 'serbest' || P.durum === 'at') {
      if (atilHazir) { S.tAtil = 0; atilBasla(g); }
      // balta elde DEĞİLSE savurma yok (balta dönünce tampon / basılı tuş hemen vuruşa döner)
      else if (P.durum === 'serbest' && P.baltaVar && !g.balta && S.tBalta <= 0 && (S.tSavur > 0 || g.savurTut)) {
        var agirSerbest = S.tAgir > 0 || !!g.agirBas;
        S.tSavur = 0; S.tAgir = 0; savurBasla(nisan, agirSerbest);
      }
      else if ((g.balta || S.tBalta > 0) && P.baltaVar && S.atBekleyen === null) {
        S.tBalta = 0;
        yonGuncelle(nisan);
        P.durum = 'at'; S.atT = AYAR.baltaAtSure; S.yuruyor = false;
        // kol geri → balta elden çıkar (birakKare) → takip: kareler bu sıraya eşlenir
        var ta = animTanim(cozAd('at'));
        S.atE = 0; S.atBirak = ta && isFinite(ta.birakKare) ? AYAR.baltaBirak : 0;
        S.atBekleyen = nisan;
        if (S.atBirak <= 0) { baltaAt(nisan); S.atBekleyen = null; }
        anim('at', { dongu: false, bastan: true, hiz: 0 });
        kilit('at', AYAR.baltaAtSure + AYAR.kilitPay);
        atKare();
      }
    }
    // fırlatma pozu: balta bırakma karesinde elden çıkar
    if (S.atBekleyen !== null || S.animAd === 'at') {
      S.atE += dt;
      if (S.atBekleyen !== null && (S.atE >= S.atBirak || P.durum !== 'at')) { var ba = S.atBekleyen; S.atBekleyen = null; if (P.baltaVar) baltaAt(ba); }
      if (S.animAd === 'at') atKare();
    }

    // hareket
    var hiz = AYAR.hiz * (P.ofkeli ? AYAR.ofkeHiz : 1);
    var hx = g.hx, hy = g.hy, hl = Math.hypot(hx, hy); if (hl > 1) { hx /= hl; hy /= hl; }
    if (P.durum === 'atil') atilGuncelle(dt, g, nisan);
    else {
      var carp = P.durum === 'kasirga' ? (S.kasirgaEvre === 'don' ? 1 : 0.82) : P.durum === 'kukre' ? 0.30 : P.durum === 'savur' ? AYAR.savurHareket : P.durum === 'sersem' ? 0.2 : P.durum === 'at' ? 0.6 : 1;
      var tx = hx * hiz * carp, ty = hy * hiz * carp, k = Math.min(1, dt * AYAR.ivme);
      P.vx += (tx - P.vx) * k; P.vy += (ty - P.vy) * k;
    }
    var sk = Math.exp(-AYAR.disSonum * dt);
    if (!isFinite(P.vx) || !isFinite(P.vy)) { P.vx = 0; P.vy = 0; }
    if (!isFinite(P.dvx) || !isFinite(P.dvy)) { P.dvx = 0; P.dvy = 0; }   // NaN koruması (yönetici): bozuk itiş konumu kalıcı bozmasın
    var _ex = P.x, _ey = P.y;
    P.x += (P.vx + P.dvx) * dt; P.y += (P.vy + P.dvy) * dt;
    if (!isFinite(P.x) || !isFinite(P.y)) { P.x = isFinite(_ex) ? _ex : 640; P.y = isFinite(_ey) ? _ey : (OYUN.kamera.y + 400); }
    P.dvx *= sk; P.dvy *= sk;
    var b = sinir();
    var kn = (window.BOLUM && BOLUM.kenar) ? BOLUM.kenar(P.y) : null;
    var sol = kn && isFinite(kn.sol) ? Math.max(b.sol, kn.sol) : b.sol, sag = kn && isFinite(kn.sag) ? Math.min(b.sag, kn.sag) : b.sag;
    // duvar kayması: kenara dayanınca duvara dik hız kesilir, paralel hız akıcı kayar
    if (P.x <= sol + P.r) { P.x = sol + P.r; if (P.vx < 0) P.vx = 0; if (P.dvx < 0) P.dvx = 0; }
    else if (P.x >= sag - P.r) { P.x = sag - P.r; if (P.vx > 0) P.vx = 0; if (P.dvx > 0) P.dvx = 0; }
    if (P.y <= b.ust + P.r) { P.y = b.ust + P.r; if (P.vy < 0) P.vy = 0; if (P.dvy < 0) P.dvy = 0; }
    else if (P.y >= b.alt) { P.y = b.alt; if (P.vy > 0) P.vy = 0; if (P.dvy > 0) P.dvy = 0; }

    if (P.durum === 'savur') savurGuncelle(dt, g, nisan);
    else if (P.durum === 'kasirga') kasirgaGuncelle(dt, g.kasirgaTut);
    else if (P.durum === 'kukre') {
      S.kukreT += dt;
      kareKoy(Math.min(1, S.kukreT / AYAR.ofkeKukre) * P.sprite._a.n);
      if (S.kukreT >= AYAR.ofkeKukre) P.durum = 'serbest';
    }

    // bakış + animasyon
    var hareketli = hl > 0.1;
    // gerçek yer değiştirme hızı (sınıra dayanınca / kamera itince de doğru; ayak kaymaz)
    if (dt > 0) {
      if (S.ox !== null) {
        var gv = Math.hypot(P.x - S.ox, P.y - S.oy) / dt;
        S.gv = Math.min(gv, 900);   // bu karedeki gerçek hız: adım evresi buna bağlı (ayak yerde kaymaz)
        S.vR += (S.gv - S.vR) * Math.min(1, dt * 18);
        if (gv > 1) { S.vx = (P.x - S.ox) / dt; S.vy = (P.y - S.oy) / dt; }
      }
      S.ox = P.x; S.oy = P.y;
    }
    if (hareketli) S.nisanTaze = false;
    var onceBalta = P.baltaVar;
    baltaGuncelle(dt);
    // balta bu karede ele döndüyse ve 0.3 sn savurma belleği / basılı sol tık varsa ölü kare olmadan hemen vur
    if (!onceBalta && P.baltaVar && P.durum === 'serbest' && !g.balta && S.tBalta <= 0 && (S.tSavur > 0 || g.savurTut)) {
      var agirYakala = S.tAgir > 0 || !!g.agirBas;
      S.tSavur = 0; S.tAgir = 0; savurBasla(nisan, agirYakala);
    }

    if (P.durum === 'serbest') {
      // bakış kuralı: yürürken gidilen yöne; dururken imlece (imleç oynadıysa) — saldırı anında hep imlece
      var nm = Math.hypot(g.nx - P.x, g.ny - (P.y - AYAR.nisanYuksek));
      var kilitli = S.kilitAd && (S.kilitAd === 'at' ? S.atE < AYAR.baltaAtSure + AYAR.kilitPay : OYUN.zaman.t < S.kilitSon) && P.sprite && !P.sprite.bitti && S.animAd === S.kilitAd;
      // yürümek isteyen oyuncuda atılma/fırlatma kuyruğu bacakları yerde kaydırmasın
      if (kilitli && hareketli && ((S.kilitAd === 'atil' && S.vR < AYAR.hiz * 1.1) || (S.kilitAd === 'at' && S.atBekleyen === null && S.atE > AYAR.baltaAtSure + 0.04))) {
        kilitli = false;
      }
      // atılma/fırlatma/sersem pozunun kuyruğunda gövde dönmez (poz yön değiştirip sıçramasın)
      if (kilitli) P.aci = hareketli ? Math.atan2(hy, hx) : P.aci;
      else if (g.cubukNisan) { S.aimKurtar = false; yonYumusak(nisan, dt); }
      else if (hareketli) { S.aimKurtar = false; yonYumusak(Math.atan2(hy, hx), dt); }
      else if (S.nisanTaze && nm > AYAR.nisanYakin) {
        if (S.aimKurtar) { S.hedefYon = aciYon(nisan); S.aimKurtar = false; }
        yonYumusak(nisan, dt);
      }
      else yonYumusak(g.klavyeNisan ? nisan : yonMerkez(S.hedefYon), dt);
      // yürüme ↔ duruş (eşik payı ile; gerçek hıza göre)
      var gvA = S.gv || 0;
      var fazOturuyor = false;
      if (S.yuruyor) {
        if (!hareketli) {
          var yarim = (S.yFaz * 2) % 1;
          if (gvA < AYAR.yuruBit && (yarim < 0.08 || yarim > 0.92 || S.vR < AYAR.yuruBit * 0.45)) {
            S.yFaz = (Math.round(S.yFaz * 2) * 0.5) % 1;
            S.yuruyor = false;
          } else if (gvA < 115) {
            fazOturuyor = true;
          }
        } else if (S.vR < AYAR.yuruBit * 0.45 && gvA < AYAR.yuruBit * 0.45) {
          S.yuruyor = false;
        }
      } else if (hareketli ? (S.vR > AYAR.yuruBasla || gvA > AYAR.yuruBasla) : (S.durT > 0.06 && S.vR > AYAR.yuruItme && gvA > AYAR.yuruItme)) {
        S.yuruyor = true;
        if (S.durT > 0.25) S.yFaz = 0.04;
      }
      if (!kilitli) {
        S.kilitAd = '';
        if (S.yuruyor) {
          S.durT = 0;
          var tn = animTanim(cozAd('yuru')), n = (tn && tn.n) || 8, fps = (tn && tn.fps) || 12;
          // bir döngüde alınan yol (paket söylerse onu kullan): ayak yere oturur
          var dongu = ((tn && tn.adimPx) || AYAR.hiz * n / fps) * (tn && tn.adimPx ? AYAR.boyOlcek : 1);
          // gidiş bakışın tersineyse döngü geri oynar (geri geri yürüme)
          var bm = yonMerkez(P.yon), ileri = (S.vx || 0) * Math.cos(bm) + (S.vy || 0) * Math.sin(bm);
          // (yön tuşu basılıyken gövde zaten gidilen yöne döner; ters oynatma yalnız itilirken/kayarken)
          var yonu = !hareketli && ileri < -0.35 * S.vR ? -1 : 1;
          var once = S.yFaz;
          // eğik kamera: dikey yürürken resimdeki adım ekranda kısa görünür → döngü o oranda hızlı döner (ayak yerde sabit kalır)
          var kd = (tn && tn.adimDikey) || AYAR.yerKisalma, vl = Math.hypot(S.vx || 0, S.vy || 0);
          var kis = vl > 1 ? Math.hypot((S.vx || 0) / vl, (S.vy || 0) / vl / kd) : 1;
          var hizFaz = gvA < 5 ? 0 : Math.min(gvA, S.vR * 1.35);
          if (fazOturuyor) {
            // adım ortasındayken tuş bırakıldıysa en yakın ayak-yerde noktasına (0.5 veya 1.0) hızlıca tamamla
            var yOnc = Math.floor(S.yFaz * 2);
            S.yFaz += Math.max(hizFaz * kis / dongu, 2.2) * dt;
            if (Math.floor(S.yFaz * 2) !== yOnc) {
              S.yFaz = (Math.floor(S.yFaz * 2) * 0.5) % 1;
              S.yuruyor = false;
              emit('adim', { x: P.x, y: P.y });
              anim('dur');
            } else {
              S.yFaz -= Math.floor(S.yFaz);
              anim('yuru', { hiz: 0 });
              kareKoy(S.yFaz * n);
            }
          } else {
            S.yFaz += yonu * hizFaz * kis * dt / dongu;
            S.yFaz -= Math.floor(S.yFaz);
            // adım sesi: ayak yere bastığında (döngünün başı ve ortası)
            var y0 = Math.floor(once * 2), y1 = Math.floor(S.yFaz * 2);
            if (y0 !== y1 && dt > 0) emit('adim', { x: P.x, y: P.y });
            anim('yuru', { hiz: 0 });
            kareKoy(S.yFaz * n);
          }
        } else {
          S.durT += dt;
          anim('dur');
        }
      } else if (P.sprite && P.sprite.yon !== P.yon) P.sprite.oynat(P.sprite.anim, P.yon, {});
    }

    spriteYerlestir(dt);
  }
  function spriteYerlestir(dt) {
    var s = P.sprite; if (!s) return;
    var tit = P.canli && P.durum === 'sersem' ? Math.sin(OYUN.zaman.t * 95) * 2.5 : 0;
    // aygıt pikseline oturt (kamera da öyle): resim yarım piksele düşüp bulanıklaşmaz / titremez
    var cr = (OYUN.app && OYUN.app.renderer && OYUN.app.renderer.resolution) || 1;
    s.x = Math.round((P.x + tit) * cr) / cr; s.y = Math.round(P.y * cr) / cr; s.zIndex = P.y;
    // Ölçek yalnızca görüntüye uygulanır; ayak çapası ve çarpışma ölçüleri korunur.
    var hedef = P.canli && P.ofkeli ? 1 : 0;
    S.ofkeGorunum += (hedef - S.ofkeGorunum) * (1 - Math.exp(-(hedef ? 12 : 10) * (dt || 0)));
    if (Math.abs(S.ofkeGorunum - hedef) < 0.005) S.ofkeGorunum = hedef;
    s.scale.set(1 + S.ofkeGorunum * 0.16, 1 + S.ofkeGorunum * 0.15);
    s.ofkeGorunum = S.ofkeGorunum;
    // Öfke açılırken zemin dalgası silüetin içinden görünmesin.
    var ofkeGiris = P.ofkeli && S.ofkeT > AYAR.ofkeSure - AYAR.ofkeAcDokunulmaz;
    var yanip = P.canli && P.dokunulmazSure > 0 && !ofkeGiris && P.durum !== 'atil' && ((OYUN.zaman.t * 20) | 0) % 2 === 0;
    s.alpha = yanip ? 0.45 : 1;
    if (s.renk) {
      if (S.parlaT > 0) S.parlaT -= OYUN.zaman.dt || 0;
      // öfkede kızıl-turuncu çamura bulanmasın; barbar kendi net renkleriyle kalabalıktan ayrılsın
      var r = S.parlaT > 0 && P.canli ? 0xff6a5a : 0xffffff;
      if (s._renk !== r) { s.renk(r); s._renk = r; }
    }
  }

  function baslangicYeri() {
    var b = sinir();
    if (window.BOLUM && BOLUM.baslangic) return { x: BOLUM.baslangic.x, y: BOLUM.baslangic.y };
    return { x: (b.sol + b.sag) / 2, y: b.alt - 90 };
  }
  function sifirla() {
    baltaSil(); iciSifirla(); baltaIstSifirla();
    OTO = varmi('oto'); OLUMSUZ = varmi('olumsuz');
    var og = parseFloat(prm('otoGecikme')); if (isFinite(og) && og >= 0) AYAR.otoGecikme = og > 5 ? og / 1000 : og;   // ms ya da sn
    var y = baslangicYeri();
    P.x = y.x; P.y = y.y; P.vx = P.vy = P.dvx = P.dvy = 0;
    S.ox = P.x; S.oy = P.y; S.gv = 0; S.vR = 0;
    P.can = P.canMax = AYAR.canMax; P.ofke = 0; P.ofkeli = false; P.baltaVar = true; P.canli = true;
    P.kasirgaFaz = -1; P.kasirgaAci = 0;
    P.durum = 'serbest'; P.dokunulmazSure = 0; P.aci = -PI / 2; P.yon = 4; P.tutusT = 0;
    if (P.sprite) { P.sprite.alpha = 1; }
    spriteKur();
    anim('dur', { bastan: true });
    spriteYerlestir();
  }

  OYUN.sistem('oyuncu', {
    baslat: function () { OTO = varmi('oto'); OLUMSUZ = varmi('olumsuz'); spriteKur(); sifirla(); },
    guncelle: guncelle,
    sifirla: sifirla
  });
})();
