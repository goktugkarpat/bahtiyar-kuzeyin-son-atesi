// src/dev.js — bölüm sonu devi (DEV)
// Heybetli, yavaş, her hareketi yerde kırmızı telgrafla okunur; cezası ağır.
// Ebeveynin değişikliği (korunuyor): yere vurma + şok halkası yok; büyük vuruş = sopa savurma.
// Evre 1 (%100–60): sopa, ara sıra tek kaya · Evre 2 (%60–30): + 2 kaya, goblin çağırma
// Evre 3 (%30–0): hızlanır (hazırlık en az minTelgraf), + 3 kaya, hücum (duvara çarpınca sersemler).
// 4. tur: aynı saldırı art arda gelmez; telgraf şekli = hasar alanı; dev ekranın üst-ortasına döner ("geri").
// 19 Kasım: saldırılar arası dev dikilmez, barbarın çevresinde ağır adımlarla dolanır (dolas); sıradaki saldırı
// önceden seçilir (planSec: mesafe + "açlık" + evre), hücum her evrede, kükre → hücum kombosu; yön dilim dilim döner.
(function () {
  'use strict';

  var AYAR = {
    canMax: 3500 /*19 Kasım zorluk: 3200→3500 (+%9); &devZor ile ölçeklenir*/, r: 70, olcek: 1,       // 4. tur: insan gibi deneme oyuncusu (0,25–0,35 sn tepki) ≈60–70 sn'de kesiyor (savurma ≈60 hasar/sn + kaya sektirme)
    ustPay: 380,                          // ayak noktası ekranın üst kenarından en az bu kadar aşağıda (gövde ve baş üstteki can çubuğu tarafından örtülmesin)
    yuruHiz: 60, yuruHiz3: 100,          // px/sn (19 Kasım zorluk: evre 3 88→100)
    hizCarpan3: 1.4,                      // evre 3'te hazırlık/toparlanma süreleri bu kadar kısalır (19 Kasım zorluk: 1,3→1,4; hazırlık yine ≥ minTelgraf)
    donusHiz: 2.2,                        // hazırlıkta oyuncuya dönme hızı (rad/sn)
    kilitSure: 0.25,                      // hazırlığın son bu kadarında yön kilitlenir
    minToparlan: 0.58,                     // saldırılar arası en az boşluk (sn)
    irkilmeEsik: 40, irkilmeSure: 0.22,   // tek vuruşta bu kadar hasar → kısa irkilme (yalnız boşta/yürürken)
    sersemCarpan: 1.25,                   // sersemken alınan hasar çarpanı
    // 1) sopa savurma
    sopaMenzil: 270, sopaYariAci: 1.05, sopaHazirlik: 0.8, sopaHasar: 20, sopaGuc: 750, sopaToparlan: 1.0,
    // 4. tur: adalet ve ritim
    telgrafPay: 4,                        // hasar alanı = yerdeki şekil + kenar çizgisinin yarısı (ayak noktası şeklin içindeyse vurur)
    minTelgraf: 0.65,                     // hiçbir hazırlık (evre 3 hızlanması dahil) bundan kısa olmaz (sn)
    evreNefes: 1.3,                       // evre geçişinde kükremeden sonra saldırısız nefes (sn)
    evYEkran: 360, evYPay: 120,           // dev ekranın üst-ortasında durmaya eğilimli: ayak noktası ekran y ≈ evYEkran (+evYPay'e kadar)
    geriSure: 1.1, geriHiz: 95,           // aynı saldırı art arda gelmesin diye araya giren "yerine dön" yürüyüşü
    hucumYari: 88, hucumAltEkran: 615, hucumOn: 42,           // şerit, hücumun önde taradığı alanı da kapsar
    olumDondur: 0.14, olumYereSars: 18,   // ölüm: vuruş anı duraksaması + yere çarpınca ikinci sarsıntı
    // 2) yere vurma + şok halkası
    yvMesafe: 140, yvR: 125, yvHazirlik: 0.9, yvHasar: 34, yvGuc: 550, yvToparlan: 1.15,
    halkaHiz: 430, halkaMax: 600, halkaKalin: 26, halkaHasar: 18, halkaGuc: 350,
    yvArtArda: 3, yvArtArdaHazirlik: 0.65, yvAraSure: 0.24, // evre 3: art arda vuruş sayısı, hazırlık ve ara bekleme
    // 3) kaya fırlatma
    kayaHazirlik: 0.9, kayaKilit: 0.27, kayaOngor: [0, 0.34, 0.57, 0.72], kayaElY: 208, kayaUcus: 0.79, kayaR: 49, kayaHasar: 20, kayaYanR: 34, kayaYanHasar: 16, kayaGuc: 450, kayaYukseklik: 138,
    kayaSayi1: 1, kayaSayi2: 2, kayaSayi3: 3, kayaYayilma: 148, kayaToparlan: 0.9,
    kayaSekmeHasar: 90, kayaTamHasar: 125, kayaSekmeUcus: 0.56, kayaSekmeSersem: 0.90, kayaTamSersem: 1.16,
    // 4) hücum
    hucumHazirlik: 1.12 /*19 Kasım 0,95→1,12: kükreme klibi (1,15 sn) kendi hızında; uyarı biraz uzun = daha adil*/,hucumHiz: 780, hucumMax: 1300, hucumHasar: 23, hucumGuc: 950, hucumSersem: 1.8 /*19 Kasım zorluk: 2,3→1,8*/, hucumToparlan: 1.0,
    // evreler
    evre2: 0.6, evre3: 0.3, kukreSure: 1.25, girisSure: 1.5, sarsGuc: 14,
    cagir2: ['goblin', 'goblin', 'okcu', 'goblin'],
    cagir3: ['goblin', 'kalkanli', 'goblin', 'okcu'],
    cagirArasi: [0, 0, 12.7, 9.9], cagirUst: 5, cagirHazir: 0.65, cagirAralik: 0.17,
    // karar
    yakinMesafe: 300, uzakMesafe: 460, yuruSure: 1.3,
    // ölüm
    kendiBaslatBolumlu: 8,               // ?dev: bölüm DEV.basla'yı bu kadar sn içinde çağırmazsa dev kendini başlatır
    olumYavas: 0.25, olumYavasSure: 1.5, kazanmaGecikme: 3.2, // ölüm (9 kare) ağır çekimle ≈2,4 sn sürer; son kare (sırtüstü yerde) görünsün
    renk: 0xff6a1a,
    // görünürlük: barbar devin arkasında (devin gövde dikdörtgeninde) kalırsa dev yana çekilir
    ortGen: 105, ortBoy: 330, ortKacHiz: 95,
    yanPay: 1.25,                         // dev ekranın yanlarından en az r*bu kadar içeride
    // akıcılık (3. tur; denge değil): boşta/yürürken dönüş = donusHiz × bu (≈ 4,4 rad/s), yürüme hızı yumuşak oturur
    bostaDonus: 2, yuruYumusak: 0.12, azamiKareHiz: 60, azamiHiz60: 1.6,
    // 19 Kasım (ebeveyn: "çok statik, takıla takıla, yeteneklerini az kullanıyor"):
    // saldırılar arasında dev DİKİLMEZ: barbarın çevresinde ağır adımlarla dolanır, sıradaki saldırıya göre mesafe ayarlar
    dolanHiz: [0, 60, 72, 92],            // evreye göre dolanma hızı (px/sn) (19 Kasım zorluk: 58/66/76 → 60/72/92)
    dolanDonus: 2.2,                      // dolanırken en büyük dönüş hızı = donusHiz × bu (≈4,8 rad/sn)
    donusIvme: 14,                        // dolanırken dönüş hızı en çok bu kadar değişir (rad/sn²)
    sonDonus: 0.45,                       // saldırıdan bu kadar önce barbara döner, yavaşlar
    ara: [null, [0.75, 1.15], [0.57, 0.90], [0.44, 0.72]], // evreye göre saldırı sonu → sonraki saldırı kararı (sn; toparlanma dahil) (19 Kasım zorluk: eskisi 0,95–1,45 / 0,8–1,25 / 0,65–1,0)
    yaklasMax: 1.6,                       // sopa için barbara yürüme en çok bu kadar; yetişemezse kaya/hücum
    istMesafe: { sopa: 200, kaya: 340, hucum: 360 }, // dolanırken sıradaki saldırıya göre istenen uzaklık
    aclik: 0.45,                          // uzun süre kullanılmayan saldırının seçilme ağırlığı (saldırı başına) artar
    toparlanFps: 18,                     // vuruş/atış sonu kalan resimler en az bu hızla oynar (son karede donmaz)
    kukreAnim: 1.0,                       // kükreme resmi en çok bu sürede oynar (≈16 resim/sn); kalan sürede dev yürür
    sersemHiz: 1.6, yuruMinFps: 18,       // sersem döngüsü ≈16 resim/sn; yürüme en az 18 resim/sn
    hucumIvme: 0.28,                      // hücum bu sürede tam hıza çıkar (ani fırlama yok; bitişte hız yumuşak söner)
    // 19 Kasım akşam — ZORLUK (ebeveyn: "son boss hâlâ kolay"). Yeni saldırı yok; var olanlar zincirlenir.
    zorluk: 1,                            // TEK ayar: 0,8 = biraz kolay · 1 = varsayılan · 1,2 = daha zor (URL: &devZor=1.2). Can, hasar, saldırı arası, kombo sıklığı
    kombo: [0, 0.2, 0.45, 0.65],          // evreye göre: sopadan sonra ikinci hamle olasılığı (yakındaysa geniş sopa, kaçtıysa kaya)
    komboAra: 0.22,                       // ilk sopa ile ikinci hamlenin telgrafı arası (sn; ikinci telgraf yine ≥ minTelgraf)
    genisYariAci: 1.4,                    // ikinci (geniş) sopanın yarı açısı (ilk 1,05); telgraf aynı şekli çizer
    genisHazirlik: 0.75,                  // ikinci sopanın hazırlığı
    kayaArt3: 0.4, kayaArtAra: 0.3,       // evre 3: kayadan hemen sonra ikinci yaylım olasılığı (1 kaya eksik) ve ara
    hucumIki3: 0.5, hucumIkiSersem: 0.55, // evre 3: duvara çarpan hücum kısa sersemden sonra dönüp bir kez daha gelir
    dipSure: 2.2, dipMesafe: 190, dipAgirlik: 0.4, // barbar devin dibinde inatla duruyorsa (bu kadar sn, bu uzaklıktan yakın) sopa ağırlığı bu kadar artar
    baltaKesSersem: 1.35, baltaKesBekle: 9  // kükrerken/hücum hazırlığında balta isabeti: devi sersemletir, hamleyi keser; sonra bu kadar sn yalnız hasar
  };
  (function () { // &devZor=1.2 ile tek sayıdan dene
    try { var z = parseFloat(new URLSearchParams(location.search).get('devZor')); if (isFinite(z) && z > 0.3 && z < 3) AYAR.zorluk = z; } catch (e) {}
  })();
  function Z() { return AYAR.zorluk > 0 ? AYAR.zorluk : 1; }
  function zCan() { return Math.round(AYAR.canMax * (1 + (Z() - 1) * 0.6)); }   // 1,2 → can +%12
  function zHasar(h) { return Math.round(h * Z()); }                             // 1,2 → hasar +%20

  // ---------- yardımcılar ----------
  function var_(o) { return typeof o !== 'undefined' && o !== null; }
  function oyuncu() { return (typeof OYUNCU !== 'undefined' && OYUNCU && OYUNCU.canli !== false) ? OYUNCU : null; }
  function olay(ad, veri) { try { if (typeof OLAY !== 'undefined') OLAY.emit(ad, veri); } catch (e) { console.error(e); } }
  function sars(g, s) { try { OYUN.kamera.sars(g, s); } catch (e) {} }
  function rast(a, b) { try { return OYUN.rast(a, b); } catch (e) { return a + Math.random() * (b - a); } }
  function aciFark(a, b) { var d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
  function sinir() {
    var s = (typeof BOLUM !== 'undefined' && BOLUM && BOLUM.sinir) ? BOLUM.sinir : null;
    if (s && isFinite(s.sol) && isFinite(s.sag) && isFinite(s.ust) && isFinite(s.alt)) return s;
    var ky = (OYUN.kamera && isFinite(OYUN.kamera.y)) ? OYUN.kamera.y : 0;
    return { sol: 0, sag: OYUN.W, ust: ky, alt: ky + OYUN.H };
  }
  function oyuncuVur(miktar, x, y, guc, saldiri) {
    var o = oyuncu(); if (!o || typeof o.hasarAl !== 'function') return;
    var aci = Math.atan2(o.y - y, o.x - x);
    if (!isFinite(aci)) aci = Math.PI / 2; // NaN itiş açısı barbarın konumunu bozmasın
    if (!isFinite(guc)) guc = 0;
    try { o.hasarAl(miktar, { x: x, y: y, aci: aci, guc: guc, kaynak: DEV, saldiri: saldiri || DEV.durum }); } catch (e) { console.error(e); }
  }
  function liste() { return (typeof DUSMAN !== 'undefined' && DUSMAN && Array.isArray(DUSMAN.liste)) ? DUSMAN.liste : null; }
  function paramVar(ad) { try { return new URLSearchParams(location.search).has(ad); } catch (e) { return false; } }

  // ---------- durum ----------
  var DEV = {
    tur: 'dev', AYAR: AYAR, aktif: false, olu: false,
    x: 0, y: 0, r: AYAR.r, can: AYAR.canMax, canMax: AYAR.canMax, hiz: 0, aci: Math.PI / 2, sersem: 0,
    evre: 1, durum: 'yok', sprite: null, devMi: true
  };
  var st = null;          // iç durum
  var tg = null;          // telgraf çizimi (katman.leke)
  var golge = null;       // gövde gölgesi (katman.golge)
  var halkalar = [], kayalar = [];
  var kendiBaslatT = 0;

  function yeniDurum() {
    return { d: 'yok', t: 0, sure: 0, hazir: 0, kilitAci: 0, sonSaldiri: [], artArda: 0, hucumYol: 0, hucumVurdu: false,
      bekleyenEvre: 0, irkilT: 0, renkT: 0, anim: '', yon: -1, olumT: -1, kazandi: false, ileriDurum: null,
      yonS: -1, yon4: -1, animKilit: 0, vHiz: 0, esne: 0, esneAci: 0, yanKac: 0, avx: 0, avy: 0,
      plan: null, kul: {}, sayac: 0, dT: 0, dYon: 0, kayaHedefleri: null,
      cagirT: 0, cagirKuyruk: [], yardim: [], yardimKimlik: new WeakMap(), hucumEzilen: null, karsiSaldiri: false };
  }

  function hc() { return DEV.evre >= 3 ? AYAR.hizCarpan3 : 1; }
  function hazirSure(s) { return Math.max(AYAR.minTelgraf, s / hc()); }
  function toparlanSure(s) { return Math.max(AYAR.minToparlan, s / hc() / Z()); }

  // ---------- sprite ----------
  function spriteKur() {
    var s = null;
    try { s = VARLIK.sprite('dev', { olcek: AYAR.olcek }); } catch (e) { console.error(e); }
    if (!s) { // çekirdek yoksa en basit gövde
      s = new PIXI.Container(); var g = new PIXI.Graphics();
      g.beginFill(0x4a3a30).drawEllipse(0, -180, 85, 180).endFill(); s.addChild(g);
      s.oynat = function () {}; s.renk = function (c) { g.tint = c; }; s.sil = function () { if (s.parent) s.parent.removeChild(s); s.destroy({ children: true }); };
    }
    try { OYUN.katman.varlik.addChild(s); } catch (e) {}
    DEV.sprite = s;
    golge = new PIXI.Graphics();
    golge.beginFill(0x000000, 0.45).drawEllipse(0, 0, AYAR.r * 1.35, AYAR.r * 0.5).endFill();
    try { OYUN.katman.golge.addChild(golge); } catch (e) {}
  }
  function yuruHiz(ya) {
    if (!ya) ya = paketAnim('yuru');
    if (!ya) return 1;
    var dng = (ya.n || 6) / (ya.fps || 6), adm = ya.adim > 0 ? ya.adim : ya.adimPx > 0 ? ya.adimPx : AYAR.yuruHiz * dng;
    return kareSinir(ya, Math.max(OYUN.sinirla((st ? st.vHiz : 0) * dng / adm, 0.35, 3.2), (ya.n || 0) >= 12 ? AYAR.yuruMinFps / (ya.fps || 8) : 0)); // en az ~18 resim/sn
  }
  function oynat(anim, secenek, zorla) {
    var s = DEV.sprite; if (!s || typeof s.oynat !== 'function') return;
    var yon = yonH(anim);
    if (!zorla && st.anim === anim && st.yon === yon) return;
    var eskiAnim = st.anim;
    st.anim = anim; st.yon = yon;
    var opt = secenek ? Object.assign({}, secenek) : {};
    if (zorla && opt.bastan === undefined) opt.bastan = true;
    if (anim === 'dur' && opt.hiz === undefined) opt.hiz = yuksekFps('dur') ? 1 : 1.45; // 30 resim/sn'lik pakette tam hızında
    if (anim === 'yuru' && opt.hiz === undefined) opt.hiz = yuruHiz();
    try { s.oynat(anim, yon, opt); } catch (e) { console.error(e); }
    // duruş/vuruştan yürümeye yumuşak geçiş: çökük başlangıç karesi (0) yerine dik geçiş karesinden başla
    if (anim === 'yuru' && !zorla && eskiAnim !== 'yuru' && s._a && (s._a.n || 0) >= 12 && !s.yerTutucu) {
      s._t = s._a.n / 3; s.kare = s._t | 0; if (s._ciz) s._ciz();
    }
  }
  // yön histerezisi: dilim ortasından ~32° sapmadan yön değişmez (yürürken titreme yok)
  var YON_ACI = [Math.PI / 2, Math.PI * 3 / 4, Math.PI, -Math.PI * 3 / 4, -Math.PI / 2, -Math.PI / 4, 0, Math.PI / 4];
  function dortYonMu(anim) {
    var a = paketAnim(anim);
    return !!(a && Array.isArray(a.yon) && a.yon[1] === a.yon[0] && a.yon[3] === a.yon[2]);
  }
  function yonH(anim) {
    var h = OYUN.aciYon ? OYUN.aciYon(DEV.aci) : 0;
    if (st.yonS == null || st.yonS < 0) { st.yonS = h; }
    var simdi = OYUN.zaman ? OYUN.zaman.t : 0; // ~40° pay + en az 0,25 sn bekleme: yön gidip gelmez
    // 19 Kasım: yön her seferinde TEK dilim döner (hızlı dönüşte 7→1 gibi atlayıp geri gelmez); dilimler arası en az 0,12 sn
    if (h !== st.yonS && Math.abs(aciFark(DEV.aci, YON_ACI[st.yonS])) > Math.PI / 8 + 0.3 && !(simdi - (st.yonZ || -9) < 0.12 && simdi >= (st.yonZ || -9))) {
      var fy = ((h - st.yonS) % 8 + 8) % 8;
      st.yonS = (st.yonS + (fy <= 4 ? 1 : 7)) % 8; st.yonZ = simdi;
    }
    if (anim && dortYonMu(anim)) {
      // 4 yönlü animasyonlarda (kukre/sersem/ol) çapraz açılarda aynalı-aynasız titremesini önle: en yakın ana yön (0,2,4,6)
      var ana = [0, 2, 4, 6], en = ana[0], enF = Math.abs(aciFark(DEV.aci, YON_ACI[en]));
      for (var i = 1; i < 4; i++) {
        var f = Math.abs(aciFark(DEV.aci, YON_ACI[ana[i]]));
        if (f < enF) { enF = f; en = ana[i]; }
      }
      if (st.yon4 == null || st.yon4 < 0) st.yon4 = en;
      else if (en !== st.yon4 && Math.abs(aciFark(DEV.aci, YON_ACI[st.yon4])) > Math.PI / 4 + 0.25) st.yon4 = en;
      return st.yon4;
    }
    return st.yonS;
  }
  function paketAnim(anim) {
    try {
      if (DEV.sprite && DEV.sprite._animTanim) return DEV.sprite._animTanim(anim);
      var p = VARLIK._paket ? VARLIK._paket('dev') : (VARLIK.paketler ? VARLIK.paketler.dev : null);
      return (p && p.anim && p.anim[anim]) || null;
    } catch (e) { return null; }
  }
  function vurusKare(a) {
    if (a.vurus != null && isFinite(a.vurus)) return Math.max(0.5, Math.min(a.n, a.vurus + 0.5)); // hasar vuruş karesinin ortasında (kare ekranda)
    return Math.max(1, Math.round(a.n * 0.6));
  }
  // saldırı bitince kalan kareler (toparlanma) akıcı oynasın, bitince son karede donmasın
  function toparlanAnim(anim, sure) {
    var a = paketAnim(anim), s = DEV.sprite;
    if (!a || !a.fps || !s || !s.oynat || s.anim !== anim || s.bitti) { st.animKilit = 0; return; }
    var kalan = Math.max(1, a.n - vurusKare(a));
    var hiz = a.fps >= 50 ? 1 /* 60'lık klip: kalan resimler kendi hızında */ :
      kareSinir(a, OYUN.sinirla(Math.max(AYAR.toparlanFps / a.fps, (kalan / a.fps) / Math.max(0.18, sure)), 0.55, 3));
    try { s.oynat(anim, yonH(anim), { hiz: hiz }); } catch (e) {}
    st.animKilit = Math.min(sure, kalan / (a.fps * hiz));
  }
  // animasyon hızı: kare/sn ekran tazelemesini aşmasın (kare atlanmaz) — paketin fps'ine göre
  // 60 resim/sn'lik kliplerde 1,6 kata kadar hızlanmaya izin var (kare atlar ama 60'lık kaynakta görünmez; vuruş zamanlaması bozulmaz)
  function kareSinir(a, h) { var f = (a && a.fps) || 8; return Math.min(h, f >= 50 ? AYAR.azamiHiz60 : AYAR.azamiKareHiz / f); }
  function yuksekFps(anim) { var a = paketAnim(anim); return !!(a && a.fps >= 24); }
  // eski (düşük resim/sn) pakette hızlandır; 30/60'lık pakette klip kendi süresinde, tam hızında oynar
  function sersemHizi() { return yuksekFps('sersem') ? 1 : AYAR.sersemHiz; }
  function kukreSuresi(sure) {
    var a = paketAnim('kukre');
    if (a && a.fps >= 24 && a.n) return Math.min(sure, a.n / a.fps);
    return Math.min(sure, AYAR.kukreAnim);
  }
  // çizim konumu aygıt pikseline (yarım piksel titremesi yok)
  function cp(v) { var r = (OYUN.app && OYUN.app.renderer && OYUN.app.renderer.resolution) || 1; return Math.round(v * r) / r; }
  function renk(c) { try { if (DEV.sprite && DEV.sprite.renk) DEV.sprite.renk(c); } catch (e) {} }

  // ---------- telgraf çizimi ----------
  function tgKur() {
    tg = new PIXI.Graphics();
    try { OYUN.katman.leke.addChild(tg); } catch (e) {}
  }
  function koni(x, y, aci, R, yari, p) {
    var rP = Math.max(1, R * p);
    // yüksek kontrastlı koyu siyah alt çizgi + kor-turuncu ana kenar + iç dolgu: kanlı zeminde net seçilir
    tg.lineStyle(8, 0x000000, 0.58); tg.moveTo(x, y); tg.arc(x, y, R, aci - yari, aci + yari); tg.lineTo(x, y);
    tg.lineStyle(3.5, 0xff7a22, 0.94); tg.beginFill(0xff5511, 0.08);
    tg.moveTo(x, y); tg.arc(x, y, R, aci - yari, aci + yari); tg.lineTo(x, y); tg.endFill();
    tg.lineStyle(2, AYAR.renk, 0.65); tg.beginFill(0xff5511, 0.10 + 0.14 * p);
    tg.moveTo(x, y); tg.arc(x, y, rP, aci - yari, aci + yari); tg.lineTo(x, y); tg.endFill();
    // ilerleyen ön yay: vuruş anını netleştirir
    tg.lineStyle(3, 0xffe4a8, 0.68 + 0.3 * p);
    tg.arc(x, y, rP, aci - yari, aci + yari);
    sonUyari(p, function () { tg.moveTo(x, y); tg.arc(x, y, R, aci - yari, aci + yari); tg.lineTo(x, y); });
  }
  // vuruştan hemen önce (son ~%22) kenar sıcak kemik-altın yanıp söner: "şimdi"
  function sonUyari(p, sekil) {
    if (p < 0.78) return;
    var t = OYUN.zaman ? OYUN.zaman.t : 0;
    var k = (p - 0.78) / 0.22, nb = 0.6 + 0.4 * Math.sin(t * 40);
    tg.lineStyle(4.5, 0xffe4a8, (0.45 + 0.55 * k) * nb); sekil(); tg.lineStyle(0);
  }
  function daire(x, y, R, p, alfa) {
    var rP = Math.max(1, R * p); alfa = var_(alfa) ? alfa : 1;
    tg.lineStyle(8, 0x000000, 0.58 * alfa); tg.drawCircle(x, y, R);
    tg.lineStyle(3.5, 0xff7a22, 0.94 * alfa); tg.beginFill(0xff5511, 0.08 * alfa); tg.drawCircle(x, y, R); tg.endFill();
    tg.lineStyle(2, AYAR.renk, 0.65 * alfa); tg.beginFill(0xff5511, (0.10 + 0.14 * p) * alfa); tg.drawCircle(x, y, rP); tg.endFill();
    tg.lineStyle(2.5, 0xffe4a8, (0.65 + 0.32 * p) * alfa); tg.drawCircle(x, y, rP);
    sonUyari(p, function () { tg.drawCircle(x, y, R); });
  }
  function kesikliDaire(x, y, R, parca, alfa, renkC) {
    var adim = (Math.PI * 2) / parca, yay = adim * 0.52;
    tg.lineStyle(5, 0x000000, 0.45 * alfa);
    for (var i = 0; i < parca; i++) {
      var a0 = i * adim;
      tg.moveTo(x + Math.cos(a0) * R, y + Math.sin(a0) * R);
      tg.arc(x, y, R, a0, a0 + yay);
    }
    tg.lineStyle(2.5, renkC, 0.72 * alfa);
    for (var j = 0; j < parca; j++) {
      var b0 = j * adim;
      tg.moveTo(x + Math.cos(b0) * R, y + Math.sin(b0) * R);
      tg.arc(x, y, R, b0, b0 + yay);
    }
    tg.lineStyle(0);
  }
  function serit(x, y, aci, uzun, gen, p) {
    var cx = Math.cos(aci), cy = Math.sin(aci), nx = -cy * gen / 2, ny = cx * gen / 2;
    var L = Math.max(1, uzun * p);
    function dortgen(len) { return [x + nx, y + ny, x + cx * len + nx, y + cy * len + ny, x + cx * len - nx, y + cy * len - ny, x - nx, y - ny]; }
    tg.lineStyle(8, 0x000000, 0.58); tg.drawPolygon(dortgen(uzun));
    tg.lineStyle(3.5, 0xff7a22, 0.94); tg.beginFill(0xff5511, 0.08); tg.drawPolygon(dortgen(uzun)); tg.endFill();
    tg.lineStyle(2, AYAR.renk, 0.65); tg.beginFill(0xff5511, 0.10 + 0.14 * p); tg.drawPolygon(dortgen(L)); tg.endFill();
    tg.lineStyle(3, 0xffe4a8, 0.68 + 0.3 * p); tg.moveTo(x + cx * L + nx, y + cy * L + ny); tg.lineTo(x + cx * L - nx, y + cy * L - ny);
    sonUyari(p, function () { tg.drawPolygon(dortgen(uzun)); });
  }
  function kayaHedefCiz(x, y, R, p, ana) {
    daire(x, y, R, p, ana ? 1 : 0.78);
    var rIc = Math.max(5, 16 * (1 - p)), c = p >= 0.78 ? 0xffe4a8 : 0xff7a22;
    var c0 = R - 6, c1 = R + 5;
    // koyu alt çizgi + hedef artısı + 4 kenar çentiği (çoklu kayada merkez net seçilsin)
    tg.lineStyle(5, 0x000000, 0.58);
    tg.moveTo(x - rIc, y); tg.lineTo(x + rIc, y);
    tg.moveTo(x, y - rIc); tg.lineTo(x, y + rIc);
    tg.moveTo(x - c1, y); tg.lineTo(x - c0, y); tg.moveTo(x + c0, y); tg.lineTo(x + c1, y);
    tg.moveTo(x, y - c1); tg.lineTo(x, y - c0); tg.moveTo(x, y + c0); tg.lineTo(x, y + c1);
    tg.lineStyle(2.5, c, 0.78 + 0.22 * p);
    tg.moveTo(x - rIc, y); tg.lineTo(x + rIc, y);
    tg.moveTo(x, y - rIc); tg.lineTo(x, y + rIc);
    tg.moveTo(x - c1, y); tg.lineTo(x - c0, y); tg.moveTo(x + c0, y); tg.lineTo(x + c1, y);
    tg.moveTo(x, y - c1); tg.lineTo(x, y - c0); tg.moveTo(x, y + c0); tg.lineTo(x, y + c1);
    tg.lineStyle(0);
  }
  function telgrafCiz() {
    if (!tg) return; tg.clear();
    if (!DEV.aktif) return;
    var d = st.d, p = st.hazir > 0 ? OYUN.sinirla(st.t / st.hazir, 0, 1) : 0;
    if (d === 'sopa' && st.t < st.hazir) koni(DEV.x, DEV.y, DEV.aci, AYAR.sopaMenzil, sopaYari(), p);
    if (d === 'yerevur' && st.t < st.hazir) {
      var n = yvNokta();
      // kesikli dış halka: şok dalgasının ulaşacağı sınır (ana darbe alanından ayrışır)
      kesikliDaire(n.x, n.y, AYAR.halkaMax, 24, 0.45 + 0.45 * p, p >= 0.78 ? 0xffe4a8 : 0xff7a22);
      // şok dalgası ön uyarısı: darbe noktasına daralan halka (p 0.3 -> 1.0)
      if (p > 0.3) {
        var kp = (p - 0.3) / 0.7, rOn = AYAR.yvR + (1 - kp) * 52;
        tg.lineStyle(2.5, p >= 0.78 ? 0xffe4a8 : 0xff9b44, 0.35 + 0.55 * kp);
        tg.drawCircle(n.x, n.y, rOn);
      }
      daire(n.x, n.y, AYAR.yvR, p);
    }
    if (d === 'kaya' && st.kayaHedefleri) {
      var hedefP = 0.22 * OYUN.sinirla((st.t - st.hazir + AYAR.kayaKilit) / AYAR.kayaKilit, 0, 1);
      for (var i = 0; i < st.kayaHedefleri.length; i++) {
        var h0 = st.kayaHedefleri[i]; kayaHedefCiz(h0.x, h0.y, kayaIsabetR(h0.r), hedefP, h0.ana);
      }
    }
    if (d === 'hucumHaz') serit(DEV.x, DEV.y, DEV.aci, hucumUzunluk() + AYAR.hucumOn, AYAR.hucumYari * 2, p);
    for (var i2 = 0; i2 < kayalar.length; i2++) {
      var k = kayalar[i2]; if (k.sahip !== 'dusman') continue;
      kayaHedefCiz(k.x1, k.y1, kayaIsabetR(k.r), 0.22 + 0.78 * Math.min(k.t / k.T, 1), k.ana);
    }
    for (var ci = 0; ci < st.cagirKuyruk.length; ci++) cagirIsareti(st.cagirKuyruk[ci]);
    for (var j = 0; j < halkalar.length; j++) {
      var h = halkalar[j], a = 1 - h.R / AYAR.halkaMax, yK = AYAR.halkaKalin / 2 - 1;
      // koyu alt çizgi (zeminden ayrışsın) + kor-turuncu gövde + iç ve dış parlak kenarlar: şok halkası net okunur
      tg.lineStyle(AYAR.halkaKalin + 10, 0x000000, 0.45 * a + 0.16); tg.drawCircle(h.x, h.y, h.R);
      tg.lineStyle(AYAR.halkaKalin, 0xff7a22, 0.45 + 0.49 * a); tg.drawCircle(h.x, h.y, h.R);
      tg.lineStyle(3, 0xffe4a8, 0.55 + 0.4 * a); tg.drawCircle(h.x, h.y, h.R + yK);
      if (h.R > yK + 2) { tg.lineStyle(2, 0xffb366, 0.35 + 0.35 * a); tg.drawCircle(h.x, h.y, h.R - yK); }
    }
  }

  // ---------- geometri ----------
  function yvNokta() { return { x: DEV.x + Math.cos(DEV.aci) * AYAR.yvMesafe, y: DEV.y + Math.sin(DEV.aci) * AYAR.yvMesafe }; }
  function hucumUzunluk() { // duvara kadar mesafe
    // 19 Kasım: duvar payı devin gövde sınırıyla aynı (önceden sınır daha içerideydi: dev yan duvara yaslanıp
    // 1,7 sn kayıyor, "duvara çarptı" sayılmadığı için sersemlemiyordu)
    var s = sinir(), cx = Math.cos(DEV.aci), cy = Math.sin(DEV.aci), L = AYAR.hucumMax, m = AYAR.r * 0.6, mx = DEV.r * AYAR.yanPay;
    if (cx > 1e-3) L = Math.min(L, (s.sag - mx - DEV.x) / cx);
    if (cx < -1e-3) L = Math.min(L, (s.sol + mx - DEV.x) / cx);
    var ky = (OYUN.kamera && isFinite(OYUN.kamera.y)) ? OYUN.kamera.y : s.ust;
    var alt = Math.min(s.alt - Math.max(m, DEV.r * 0.5), ky + AYAR.hucumAltEkran); // alt kenara yapışmaz: barbar devin altında kaybolmasın
    if (cy > 1e-3) L = Math.min(L, (alt - DEV.y) / cy);
    if (cy < -1e-3) L = Math.min(L, (Math.max(s.ust + DEV.r * 0.5, ky + AYAR.ustPay) - DEV.y) / cy);
    return Math.max(0, L);
  }
  function sopaYari() { return st && st.genis ? AYAR.genisYariAci : AYAR.sopaYariAci; }
  function oyuncuyaAci() { var o = oyuncu(); return o ? Math.atan2(o.y - DEV.y, o.x - DEV.x) : DEV.aci; }
  function oyuncuMesafe() { var o = oyuncu(); return o ? Math.hypot(o.x - DEV.x, o.y - DEV.y) : 1e9; }
  function don(dt, hizli) { // hazırlıkta oyuncuya doğru yavaş dön
    var hedef = oyuncuyaAci(), fark = aciFark(hedef, DEV.aci), m = AYAR.donusHiz * (hizli || 1) * dt;
    DEV.aci += OYUN.sinirla(fark, -m, m);
  }

  // ---------- durum geçişleri ----------
  function gec(d, sure) {
    if (DEV._zc && DEV._zc.length < 600) DEV._zc.push([d, +((OYUN.zaman && OYUN.zaman.t) || 0).toFixed(2), DEV.evre]);
    if (d !== 'toparlan' && d !== 'giris' && d !== 'kukre') st.w = 0;   // dolanma dönüş hızı başka durumlarda sıfırlanır
    st.d = d; st.t = 0; st.sure = sure || 0; st.hazir = 0; st.vurdu = false; DEV.durum = d; }
  function toparlan(sure) {
    gec('toparlan', sure);
    if (!(st.animKilit > 0) && !(DEV.sprite && DEV.sprite.anim === 'yuru' && st.vHiz >= 12)) oynat('dur');
  }
  // saldırı bitti: kısa toparlanma + dolanma, sonra yeni karar (evre ilerledikçe kısalır)
  function araVer() { st.ikinciHucum = false; var a = AYAR.ara[Math.min(3, DEV.evre)] || AYAR.ara[1]; toparlan(Math.max(AYAR.minToparlan, rast(a[0], a[1]) / Z())); }

  // ---------- dolanma (saldırılar arası; dev dikilmez) ----------
  function istMesafe(plan) { return (plan && AYAR.istMesafe[plan]) || 260; }
  function alan() {
    var s = sinir(), ky = (OYUN.kamera && isFinite(OYUN.kamera.y)) ? OYUN.kamera.y : s.ust, p = DEV.r * AYAR.yanPay + 12;
    var yMin = Math.max(s.ust + DEV.r * 0.5, ky + AYAR.ustPay);
    var A = { x0: s.sol + p, x1: s.sag - p, y0: yMin, y1: Math.max(yMin + 40, ev().y + AYAR.evYPay) };
    // 19 Kasım yakınlaştırma: dolanırken görüşte (ekranda görünen dünyada) kalır; görüş dar ise alan ona daraltılır
    var g = OYUN.gorus;
    if (g && isFinite(g.sol) && isFinite(g.w)) {
      var gx0 = Math.max(A.x0, g.sol - DEV.r * 0.2), gx1 = Math.min(A.x1, g.sol + g.w + DEV.r * 0.2); // gövdenin büyük kısmı görünür; dar tutmak devi barbarın dibine itiyordu
      if (gx1 - gx0 > 260) { A.x0 = gx0; A.x1 = gx1; }
      var gy0 = Math.max(A.y0, g.ust + 120), gy1 = Math.min(A.y1, g.ust + g.h - 20);
      if (gy1 - gy0 > 60) { A.y0 = gy0; A.y1 = gy1; }
    }
    return A;
  }
  // devin gövdesi görüşte mi (merkezi en çok yarıçap kadar dışarıda olabilir)? Tamamen görüş dışındaysa saldırı başlatmaz.
  function devGoruste() {
    var g = OYUN.gorus;
    if (!g || !isFinite(g.sol) || !isFinite(g.w)) return true;
    var r = DEV.r * 0.5;
    return DEV.x > g.sol - r && DEV.x < g.sol + g.w + r && DEV.y > g.ust + 40 && DEV.y < g.ust + g.h + r;
  }
  // dolanma yönü: barbara bakış açısı ± sapma. Uzaksa çapraz yaklaşır (≈30°), istenen uzaklıktaysa yanlamasına
  // çember çizer (≈70°), çok yakınsa çapraz açılır. Gövde baktığı yöne yürür (yan kayma yok); barbara bakış en çok
  // birkaç yön kayar, saldırı başında az döner. Alan kenarına gelince kenar boyunca ya da öbür yana döner.
  function dolasYonu(A) {
    var m = oyuncuMesafe(), P = oyuncuyaAci(), ist = istMesafe(st.plan);
    var sap = OYUN.sinirla(1.2 + (ist - m) / 110 * 0.8, 0.55, 2.0); // uzak: çapraz yaklaş · istenen uzaklık: yanlama · yakın: açıl (sürekli, sıçramasız)
    // saldırı yaklaştıkça sapma azalır: dev yavaş yavaş barbara döner (sonda ani geri dönüş, yön gidip-gelmesi yok)
    sap *= OYUN.sinirla((st.sure - st.t - AYAR.sonDonus) / 0.8, 0, 1);
    // kenara gelince kenar boyunca kayar (o eksendeki bileşen atılır); geriye az yol kalırsa öbür yana döner
    function kay(h) {
      var vx = Math.cos(h), vy = Math.sin(h), L = 60;
      if ((vx > 0 && DEV.x + vx * L > A.x1) || (vx < 0 && DEV.x + vx * L < A.x0)) vx = 0;
      if ((vy > 0 && DEV.y + vy * L > A.y1) || (vy < 0 && DEV.y + vy * L < A.y0)) vy = 0;
      return { a: Math.atan2(vy, vx), k: Math.hypot(vx, vy) };
    }
    var k1 = kay(P + st.dYon * sap);
    if (k1.k >= 0.5) return k1.a;
    var k2 = kay(P - st.dYon * sap);
    if (k2.k >= 0.5) { st.dYon = -st.dYon; st.dT = rast(1.6, 2.8); return k2.a; }
    return Math.atan2((A.y0 + A.y1) / 2 - DEV.y, (A.x0 + A.x1) / 2 - DEV.x); // köşe: alanın ortasına
  }
  // barbar devin arkasında (gövdesinin örttüğü dikdörtgende) mi? → çekilinecek yan (−1 sol, +1 sağ), değilse 0
  function ortuYon(o) {
    var odx = o.x - DEV.x, ody = o.y - DEV.y;
    if (!(ody < -10 && ody > -AYAR.ortBoy && Math.abs(odx) < AYAR.ortGen)) return 0;
    var s0 = sinir(), yon = odx > 0 ? -1 : 1;
    if (Math.abs(odx) < 8) yon = DEV.x > (s0.sol + s0.sag) / 2 ? -1 : 1;
    // duvara dayandıysa öbür yana (oyuncunun yanından) geç
    if ((yon < 0 && DEV.x < s0.sol + DEV.r * AYAR.yanPay + 20) || (yon > 0 && DEV.x > s0.sag - DEV.r * AYAR.yanPay - 20)) yon = -yon;
    return yon;
  }
  // dev baktığı yöne yürür, ağır döner; saldırı yaklaşınca barbara döner. İstenen hızı döndürür.
  function dolas(dt) {
    var o = oyuncu();
    if (!o) { return 0; }
    st.dT = (st.dT || 0) - dt;
    if (!st.dYon) { st.dYon = rast(0, 1) < 0.5 ? -1 : 1; st.dT = rast(1.6, 2.8); }
    else if (st.dT <= 0) { if (rast(0, 1) < 0.5) st.dYon = -st.dYon; st.dT = rast(1.6, 2.8); } // ara sıra yön değiştirir
    var H = dolasYonu(alan());
    var hiz = AYAR.dolanHiz[Math.min(3, DEV.evre)] || AYAR.dolanHiz[1];
    var son = st.sure - st.t < AYAR.sonDonus;
    var ort = ortuYon(o);
    if (ort) { H = ort > 0 ? 0 : Math.PI; son = false; hiz = Math.max(hiz, AYAR.ortKacHiz * 0.8); } // barbarı örtüyorsa yana yürü
    // dönüş açısal hızla: ağır gövde dönüşe yavaş girer, yavaş çıkar (yön birden tersine dönüp gidip-gelmez)
    var hedefAci = son ? oyuncuyaAci() : H, wMax = AYAR.donusHiz * AYAR.dolanDonus;
    var wHedef = OYUN.sinirla(aciFark(hedefAci, DEV.aci) * 5, -wMax, wMax), wa = AYAR.donusIvme * dt;
    st.w = (st.w || 0) + OYUN.sinirla(wHedef - (st.w || 0), -wa, wa);
    DEV.aci += st.w * dt;
    var v = son ? hiz * 0.45 : hiz;
    v *= Math.max(0.6, Math.cos(aciFark(H, DEV.aci)));    // dönerken yay çizerek (biraz yavaşlayarak) yürür
    if (son && oyuncuMesafe() < AYAR.r + 70) v = 0;      // dibindeyken barbarı itmesin
    if (v < 24) v = 0;                                   // ya gerçekten yürür ya durur (duruş resmiyle kayma yok)
    DEV.x += Math.cos(DEV.aci) * v * dt; DEV.y += Math.sin(DEV.aci) * v * dt;
    return v;
  }
  // boşta resim: yürüme/duruş arasında histerezis (her kare gidip gelmez)
  function notrAnim(v) {
    var s = DEV.sprite, yuruyor = s && s.anim === 'yuru';
    // ayak kaymasın ve vuruş sonu sıçramasın: yürüme yalnız dev gerçekten yol alırken (≈ ≥16 px/sn); yavaşlayınca canlı duruşa geçer
    if (yuruyor) { if (st.vHiz < 12 && v <= 0) yuruyor = false; }
    else if (v > 0 && st.vHiz >= 16) yuruyor = true;
    oynat(yuruyor ? 'yuru' : 'dur');
  }

  // evin (ekranın üst-ortası) dünya konumu: dev buraya dönmeye eğilimli, barbar altında/arkasında kaybolmaz
  function ev() {
    var s = sinir(), ky = (OYUN.kamera && isFinite(OYUN.kamera.y)) ? OYUN.kamera.y : s.ust;
    return { x: (s.sol + s.sag) / 2, y: ky + AYAR.evYEkran };
  }
  function evUzak() { var e = ev(); return Math.hypot(DEV.x - e.x, (DEV.y - e.y) * 1.4); }
  function karar() {
    var o = oyuncu();
    if (!o) { toparlan(0.5); return; }
    if (st.bekleyenEvre) { evreGecis(st.bekleyenEvre); return; }
    // görüş dışındaysa önce görüşe dolanır (görmediğin yerden kaya/hücum yok); en çok ~2 sn erteler
    if (!devGoruste() && (st.gorErt || 0) < 4) { st.gorErt = (st.gorErt || 0) + 1; toparlan(0.5); return; }
    st.gorErt = 0;
    if (DEV.evre > 1 && st.cagirT <= 0 && st.cagirKuyruk.length === 0 && st.yardim.length <= 2) {
      cagirBaslat(DEV.evre, false); return;
    }
    var secim = st.plan || planSec(); st.plan = null;
    // sopa menzil dışındaysa önce barbara yürü (en çok yaklasMax), menzile girince vurur
    if (secim === 'sopa' && oyuncuMesafe() > AYAR.sopaMenzil * 0.85) { gec('yuru', AYAR.yaklasMax); notrAnim(1); return; }
    bak(0.5);
    saldir(secim);
  }
  // barbara anlık en çok m radyan dön (resim yönü sıçramasın; kalanını hazırlıktaki don() tamamlar)
  function bak(m) { DEV.aci += OYUN.sinirla(aciFark(oyuncuyaAci(), DEV.aci), -m, m); }
  // 19 Kasım: sıradaki saldırı, bir önceki biter bitmez seçilir; dev dolanırken ona göre mesafe ayarlar (sopa: yaklaşır,
  // kaya/hücum: açılır). Mesafeye göre ağırlık + uzun süre kullanılmayana "açlık" payı + evreyle artan hücum. Aynı saldırı art arda gelmez.
  function planSec() {
    var m = oyuncuMesafe(), e = Math.min(3, DEV.evre), sec;
    if (m < AYAR.yakinMesafe) sec = [['sopa', 3], ['kaya', [0, 0.6, 1, 1][e]], ['hucum', [0, 0.35, 0.7, 1.4][e]]];
    else if (m < AYAR.uzakMesafe) sec = [['sopa', 1.5], ['kaya', [0, 2, 2.5, 2.5][e]], ['hucum', [0, 0.8, 1.5, 2.2][e]]];
    else sec = [['sopa', 0.5], ['kaya', 3], ['hucum', [0, 1.2, 2, 3][e]]];
    var s2 = st.sonSaldiri, son = s2.length ? s2[s2.length - 1] : '';
    if (son === 'sopa' && e >= 2) sec[1][1] += 1.2;          // kombo: sopa → geri çekil → kaya
    if ((st.dip || 0) > AYAR.dipSure) sec[0][1] += AYAR.dipAgirlik;      // 19 Kasım zorluk: dibine yapışan barbara sopa (hep dipte durmak çözüm olmasın)
    if (m >= AYAR.uzakMesafe) sec[2][1] *= 1.4;              // uzaktan balta atana hücum
    sec = sec.filter(function (x) { return x[0] !== son; });
    // hücum için barbara doğru en az 260 px yol olmalı (duvar dibinde sıfır boylu hücum + bedava sersemleme olmasın)
    var a0 = DEV.aci; DEV.aci = oyuncuyaAci(); var yolH = hucumUzunluk(); DEV.aci = a0;
    if (yolH < 260 && sec.length > 1) sec = sec.filter(function (x) { return x[0] !== 'hucum'; });
    var top = 0;
    sec.forEach(function (x) { var k = st.kul[x[0]]; x[1] *= 1 + AYAR.aclik * Math.min(5, st.sayac - (k == null ? -2 : k)); top += x[1]; });
    var r = rast(0, top);
    for (var i = 0; i < sec.length; i++) { r -= sec[i][1]; if (r <= 0) return sec[i][0]; }
    return sec[0][0];
  }
  function saldir(ad) {
    var s2 = st.sonSaldiri; s2.push(ad); if (s2.length > 4) s2.shift();
    st.kul[ad] = st.sayac; st.sayac++;
    baslat(ad);
  }
  function baslat(ad) {
    if (ad === 'yuru') { gec('yuru', AYAR.yuruSure); notrAnim(1); return; }
    if (ad === 'geri') { gec('geri', AYAR.geriSure); notrAnim(1); return; }
    if (ad === 'sopa' || ad === 'yerevur') { gec('sopa'); st.genis = false; st.hazir = hazirSure(AYAR.sopaHazirlik); oynat('vur', { dongu: false, hiz: animHiz('vur', st.hazir) }, true); return; }
    if (ad === 'kaya') { kayaHazirla(); return; }
    if (ad === 'hucum') {
      st.karsiSaldiri = false; gec('hucumHaz'); st.hazir = hazirSure(AYAR.hucumHazirlik);
      oynat('kukre', { dongu: false, hiz: animHiz('kukre', st.hazir, true) }, true);
      olay('devKukre', { x: DEV.x, y: DEV.y, kisa: true });
      return;
    }
    toparlan(0.5);
  }
  function yerevurBasla(hazir) {
    gec('yerevur'); st.hazir = hazir; DEV.aci = oyuncuyaAci();
    oynat('yerevur', { dongu: false, hiz: animHiz('yerevur', hazir) }, true);
  }
  // animasyonun süresini (paket biliniyorsa) hazırlık süresine uydur
  // vuruş karesi (paket 'vurus' verirse o, yoksa %60) tam hazırlık sonunda gelsin; tum: bütün animasyon
  function animHiz(anim, sure, tum) {
    try {
      var a = paketAnim(anim);
      if (a && a.n && a.fps && sure > 0) {
        var h = OYUN.sinirla(((tum ? a.n : vurusKare(a)) / a.fps) / sure, 0.4, 3);
        if (Math.abs(h - 1) < 0.04) h = 1;   // ±%4: klip kendi hızında (tam 30/60 resim/sn), vuruş anı en çok ~30 ms kayar
        return kareSinir(a, h);
      }
    } catch (e) {}
    return 1;
  }

  function evreGecis(evre) {
    st.bekleyenEvre = 0; st.karsiSaldiri = false; DEV.evre = evre;
    cagirBaslat(evre, true);
  }
  function cagirBaslat(evre, evreDegisti) {
    var sure = evreDegisti ? AYAR.kukreSure : 0.95;
    gec(evreDegisti ? 'kukre' : 'yardim', sure); bak(0.8);
    oynat('kukre', { dongu: false, hiz: animHiz('kukre', kukreSuresi(sure), true) }, true);
    st.sonSaldiri.push('kukre'); if (st.sonSaldiri.length > 4) st.sonSaldiri.shift();
    st.plan = 'hucum'; st.cagirT = AYAR.cagirArasi[evre];
    sars(AYAR.sarsGuc, 0.36);
    olay('devKukre', { x: DEV.x, y: DEV.y, evre: evre, cagri: true });
    cagirPlanla(evre === 3 ? AYAR.cagir3 : AYAR.cagir2, !evreDegisti);
  }
  function cagirPlanla(turler, tekrar) {
    var s = sinir(), p = oyuncu(), g = OYUN.gorus;
    if (!p) return;
    var sol = Math.max(s.sol + 72, g && isFinite(g.sol) ? g.sol + 80 : s.sol);
    var sag = Math.min(s.sag - 72, g && isFinite(g.w) ? g.sol + g.w - 80 : s.sag);
    if (sag - sol < 140) { sol = s.sol + 45; sag = s.sag - 45; }
    var alt = Math.min(s.alt - 66, g && isFinite(g.h) ? g.ust + g.h - 70 : s.alt);
    var ust = Math.max(s.ust + 132, g && isFinite(g.ust) ? g.ust + 140 : s.ust);
    if (alt - ust < 100) { ust = s.ust + 100; alt = s.alt - 42; }
    var n = Math.min(tekrar ? 3 : turler.length, AYAR.cagirUst - st.yardim.length - st.cagirKuyruk.length);
    var taraf = p.x < DEV.x ? 1 : -1;
    for (var i = 0; i < n; i++) {
      var yon = i % 2 ? -taraf : taraf;
      var x = OYUN.sinirla(DEV.x + yon * (238 + 52 * Math.floor(i / 2)), sol, sag);
      var y = OYUN.sinirla(DEV.y + (i < 2 ? 41 : 152), ust, alt);
      if (Math.hypot(x - p.x, y - p.y) < 170) {
        x = p.x < (sol + sag) / 2 ? sag : sol;
        y = p.y < (ust + alt) / 2 ? alt : ust;
      }
      var konum = bosCagriYeri(x, y, sol, sag, ust, alt, p);
      if (!konum) continue;
      st.cagirKuyruk.push({ x: konum.x, y: konum.y, tur: turler[i], kalan: AYAR.cagirHazir + i * AYAR.cagirAralik });
    }
  }
  function bosCagriYeri(x, y, sol, sag, ust, alt, p) {
    var kaymalar = [0, -46, 46, -88, 88];
    for (var i = 0; i < kaymalar.length; i++) {
      var k = { x: OYUN.sinirla(x, sol, sag), y: OYUN.sinirla(y + kaymalar[i], ust, alt) };
      if (Math.hypot(k.x - p.x, k.y - p.y) < 116 || Math.hypot(k.x - DEV.x, k.y - DEV.y) < 120) continue;
      if (window.BOLUM && BOLUM.engelIt && BOLUM.engelIt(k, 26)) continue;
      if (st.cagirKuyruk.some(function (d) { return Math.hypot(k.x - d.x, k.y - d.y) < 66; })) continue;
      return k;
    }
    return null;
  }
  function cagirIsareti(k) {
    var p = 1 - Math.min(1, k.kalan / AYAR.cagirHazir);
    tg.lineStyle(2, 0xb99a7e, 0.40 + p * 0.43);
    tg.drawEllipse(k.x, k.y, 23 + p * 8, 11 + p * 4);
    tg.lineStyle(0);
  }
  function cagirGuncelle(dt) {
    var l = liste();
    if (!l || !window.DUSMAN) return;
    for (var j = st.yardim.length - 1; j >= 0; j--) {
      var y = st.yardim[j];
      if (y.d.olu || y.d.id !== y.id || l.indexOf(y.d) < 0) st.yardim.splice(j, 1);
    }
    if (st.cagirT > 0) st.cagirT -= dt;
    for (var i = st.cagirKuyruk.length - 1; i >= 0; i--) {
      var k = st.cagirKuyruk[i]; k.kalan -= dt;
      if (k.kalan > 0) continue;
      st.cagirKuyruk.splice(i, 1);
      var o = oyuncu();
      if (!o) continue;
      if (Math.hypot(k.x - o.x, k.y - o.y) < 100) {
        if (k.tasindi) continue;
        // Barbar işaretin üstüne girdiyse yeni giriş yerini de önceden göster.
        var s = sinir(), sol = s.sol + 72, sag = s.sag - 72;
        var yer = bosCagriYeri(o.x < (sol + sag) / 2 ? sag : sol, k.y, sol, sag, s.ust + 110, s.alt - 66, o);
        if (yer) { k.x = yer.x; k.y = yer.y; k.kalan = 0.45; k.tasindi = true; st.cagirKuyruk.push(k); }
        continue;
      }
      var d = DUSMAN.dogur(k.tur, k.x, k.y, { aci: Math.atan2(o.y - k.y, o.x - k.x) });
      if (d) { st.yardim.push({ d: d, id: d.id }); st.yardimKimlik.set(d, d.id); }
    }
  }
  function yardimiDurdur() {
    for (var i = 0; i < st.yardim.length; i++) {
      var y = st.yardim[i];
      if (y.d.id !== y.id) continue;
      if (y.d.olu) continue;
      y.d.sersem = AYAR.kazanmaGecikme + 0.5;
      y.d.vx = y.d.vy = 0;
    }
    if (!window.MERMI || !MERMI.birak) return;
    for (var j = MERMI.liste.length - 1; j >= 0; j--) {
      var m = MERMI.liste[j];
      if (m.sahip !== 'dusman' || !m.kaynak) continue;
      var kimlik = st.yardimKimlik.get(m.kaynak);
      if (kimlik !== undefined && kimlik === m.kaynak.id) MERMI.birak(m);
    }
  }
  function hucumYardimiEz(x, y, adim) {
    if (!st.yardim.length || !window.DUSMAN || adim <= 0) return;
    for (var i = st.yardim.length - 1; i >= 0; i--) {
      var y0 = st.yardim[i], hedef = y0.d;
      if (hedef.olu || hedef.id !== y0.id || st.hucumEzilen.has(y0.id)) continue;
      if (!seritIcinde(hedef.x, hedef.y, x, y, DEV.aci, adim + AYAR.hucumOn, AYAR.hucumYari, 0)) continue;
      st.hucumEzilen.add(y0.id);
      var sonuc = DUSMAN.hasarVer(hedef, hedef.tur === 'kalkanli' ? 55 : 70, { aci: DEV.aci, guc: 320, tur: 'carpma' });
      if (sonuc) olay('vurus', { hedef: hedef, x: hedef.x, y: hedef.y, aci: DEV.aci, guc: 320, tur: 'carpma', oldurdu: sonuc.oldu, agir: true });
    }
  }

  // ---------- saldırı anları ----------
  // yerdeki koni şekliyle BİREBİR: ayak noktası koninin içinde ya da kenar çizgisine telgrafPay kadar yakınsa vurur
  function koniIcinde(px, py, x, y, aci, R, yari, pay) {
    var dx = px - x, dy = py - y, m = Math.hypot(dx, dy);
    if (m > R + pay) return false;
    var f = Math.abs(aciFark(Math.atan2(dy, dx), aci));
    if (f <= yari) return true;
    if (f - yari >= Math.PI / 2) return m <= pay;
    return m * Math.sin(f - yari) <= pay;  // kenar ışınına dik uzaklık
  }
  function seritIcinde(px, py, x, y, aci, L, yari, pay) {
    var cx = Math.cos(aci), cy = Math.sin(aci), vx = px - x, vy = py - y;
    var ileri = vx * cx + vy * cy, yan = -vx * cy + vy * cx;
    return ileri >= -pay && ileri <= L + pay && Math.abs(yan) <= yari + pay;
  }
  DEV._geo = { koni: koniIcinde, serit: seritIcinde }; // deneme ölçümü için
  // deneme ölçümü: her saldırı anında barbarın ayak noktasının yerdeki şeklin kenarına uzaklığı (+ dışarıda, − içeride)
  DEV._olc = []; DEV._zc = []; DEV._st = function () { return st; };
  function olcKaydet(tur, o, vurdu) {
    if (DEV._olc.length > 300) return;
    var dx = o.x - DEV.x, dy = o.y - DEV.y, m = Math.hypot(dx, dy), u;
    if (tur === 'sopa') {
      var f = Math.abs(aciFark(Math.atan2(dy, dx), DEV.aci)), R = AYAR.sopaMenzil, y = AYAR.sopaYariAci;
      if (f <= y) u = m - R > 0 ? m - R : -Math.min(R - m, m * Math.sin(y - f));
      else u = f - y >= Math.PI / 2 ? m : Math.max(m * Math.sin(f - y), m - R);
    } else u = 0;
    DEV._olc.push([tur, Math.round(u), vurdu ? 1 : 0, +(st.hazir || 0).toFixed(2)]);
  }
  function sopaVur() {
    var o = oyuncu(); sars(8, 0.25);
    if (!o) return;
    var sx0 = DEV.x + Math.cos(DEV.aci) * AYAR.sopaMenzil * 0.55, sy0 = DEV.y + Math.sin(DEV.aci) * AYAR.sopaMenzil * 0.55;
    olay('devYereVur', { x: sx0, y: sy0, r: 70, sopa: true }); // tek iniş olayı: toz/çatlak ve sopa sesi
    var ic = koniIcinde(o.x, o.y, DEV.x, DEV.y, DEV.aci, AYAR.sopaMenzil, sopaYari(), AYAR.telgrafPay);
    olcKaydet('sopa', o, ic);
    if (ic) oyuncuVur(zHasar(AYAR.sopaHasar), DEV.x, DEV.y, AYAR.sopaGuc, 'sopa');
  }
  function yereVur() {
    sopaVur();
  }
  function kayaIsabetR(yaricap) { var o = oyuncu(); return yaricap + (o ? o.r : 18); }
  function kayaHazirla() {
    gec('kaya'); st.hazir = hazirSure(AYAR.kayaHazirlik); st.kayaHedefleri = null;
    oynat('kayaat', { dongu: false, hiz: animHiz('kayaat', st.hazir) }, true);
  }
  function kayaHedefle() {
    var o = oyuncu();
    var ongor = AYAR.kayaOngor[DEV.evre];
    var vx = o && (o.vx || 0), vy = o && (o.vy || 0), hiz = Math.hypot(vx, vy);
    var ileri = hiz > 0 ? Math.min(ongor, 160 / hiz) : 0;
    var hx = o ? o.x + vx * ileri : DEV.x + Math.cos(DEV.aci) * 300;
    var hy = o ? o.y + vy * ileri : DEV.y + Math.sin(DEV.aci) * 300;
    var s = sinir(), n = DEV.evre >= 3 ? AYAR.kayaSayi3 : DEV.evre >= 2 ? AYAR.kayaSayi2 : AYAR.kayaSayi1;
    if (st.ikinciKaya) n = Math.max(1, n - 1);
    var yana = (hiz > 35 ? Math.atan2(vy, vx) : oyuncuyaAci()) + Math.PI / 2;
    var son = [], r = kayaIsabetR(AYAR.kayaR);
    for (var i = 0; i < n; i++) {
      var sap = !i ? 0 : i === 1 ? AYAR.kayaYayilma : -AYAR.kayaYayilma;
      var x = OYUN.sinirla(hx + Math.cos(yana) * sap, s.sol + 18, s.sag - 18);
      var y = OYUN.sinirla(hy + Math.sin(yana) * sap, s.ust + 18, s.alt - 12);
      // Duvarda aynı noktaya sıkışan hedefleri çıkar: işaretler üst üste gelmesin.
      if (son.some(function (k) { return Math.hypot(x - k.x, y - k.y) < r * 1.55; })) continue;
      son.push({ x: x, y: y, ana: i === 0, r: i === 0 ? AYAR.kayaR : AYAR.kayaYanR });
    }
    st.kayaHedefleri = son;
    olay('gormagulKayaHazir', { x: son[0].x, y: son[0].y, adet: son.length });
  }
  function kayaAt() {
    if (!st.kayaHedefleri) kayaHedefle();
    var sx = DEV.x + Math.cos(DEV.aci) * 40, sy = DEV.y + Math.sin(DEV.aci) * 20;
    for (var i = 0; i < st.kayaHedefleri.length; i++) {
      var k = st.kayaHedefleri[i];
      var u = AYAR.kayaUcus - (DEV.evre - 1) * 0.038 + i * 0.115;
      kayaOlustur(sx, sy, k, u);
    }
    olay('mermi', { tur: 'kaya', x: sx, y: sy, sahip: 'dusman' });
    st.kayaHedefleri = null;
  }
  function kayaOlustur(x0, y0, hedef, T) {
    var g, d = window.VARLIK && VARLIK.doku('efekt', 'kaya');
    if (d && d.valid && d !== PIXI.Texture.EMPTY) {
      g = new PIXI.Sprite(d); g.anchor.set(0.5); g.scale.set(hedef.r * 1.93 / d.width);
    } else {
      g = new PIXI.Graphics();
      g.lineStyle(4, 0x1a1512, 1).beginFill(0x6b5f55).drawPolygon([-35, -7, -19, -30, 17, -32, 38, -10, 31, 23, -7, 29, -37, 12]).endFill();
      g.beginFill(0x8c8075, 0.8).drawEllipse(-10, -10, 13, 7).endFill();
      g.scale.set(hedef.r / AYAR.kayaR);
    }
    var gg = new PIXI.Graphics(); gg.beginFill(0x000000, 0.46).drawEllipse(0, 0, hedef.r * 0.82, hedef.r * 0.45).endFill();
    g.name = 'gormagul_kaya';
    OYUN.katman.varlik.addChild(g); OYUN.katman.golge.addChild(gg);
    var k = { x0: x0, y0: y0, x1: hedef.x, y1: hedef.y, r: hedef.r, ana: hedef.ana, t: 0, T: T, sahip: 'dusman', h0: AYAR.kayaElY,
      H: AYAR.kayaYukseklik, g: g, gg: gg, x: x0, y: y0, h: AYAR.kayaElY, don: rast(2.8, 4.9) };
    kayalar.push(k); kayaKonum(k, 0);
  }
  function kayaSektirilebilir(k) { return k.sahip === 'dusman' && k.t >= k.T * 0.64 && k.h <= 143; }
  function kayaKonum(k, dt) {
    var p = Math.min(k.t / k.T, 1);
    k.x = k.x0 + (k.x1 - k.x0) * p; k.y = k.y0 + (k.y1 - k.y0) * p;
    k.h = k.h0 * (1 - p) + 4 * k.H * p * (1 - p);
    k.g.x = k.x; k.g.y = k.y - k.h; k.g.zEk = k.h; k.g.rotation += k.don * dt;
    k.g.tint = k.sahip === 'oyuncu' ? 0xffd5a6 : kayaSektirilebilir(k) ? (k.ana ? 0xffedbb : 0xe2dacc) : 0xffffff;
    k.gg.x = k.x; k.gg.y = k.y; var sc = Math.max(0.4, 1 - k.h / 475); k.gg.scale.set(sc); k.gg.alpha = sc;
  }
  function kayaSil(k) { k.g.destroy(); k.gg.destroy(); }
  function kayaTemizle() {
    for (var i = 0; i < kayalar.length; i++) kayaSil(kayalar[i]);
    kayalar.length = 0;
  }
  function kayaGuncelle(dt) {
    for (var i = kayalar.length - 1; i >= 0; i--) {
      var k = kayalar[i];
      if (k.sahip === 'oyuncu') { k.x1 = DEV.x; k.y1 = DEV.y; }
      k.t += dt; kayaKonum(k, dt);
      if (k.t < k.T) continue;
      kayalar.splice(i, 1); kayaSil(k);
      if (k.sahip === 'dusman') {
        olay('devKaya', { x: k.x, y: k.y }); sars(6, 0.18);
        var o = oyuncu();
        if (o && Math.hypot(o.x - k.x, o.y - k.y) <= kayaIsabetR(k.r)) oyuncuVur(zHasar(k.ana ? AYAR.kayaHasar : AYAR.kayaYanHasar), k.x, k.y, AYAR.kayaGuc, 'kaya');
      } else if (k.sahip === 'yana') {
        olay('devKaya', { x: k.x, y: k.y, sektirildi: true });
      } else if (DEV.aktif && !DEV.olu) {
        var aci = Math.atan2(DEV.y - k.y0, DEV.x - k.x0);
        var sonuc = DEV.hasarAl(k.kusursuz ? AYAR.kayaTamHasar : AYAR.kayaSekmeHasar, { aci: aci, tur: 'sekme', kaya: true, kusursuz: k.kusursuz });
        olay('vurus', { hedef: DEV, x: DEV.x, y: DEV.y - 120, aci: aci, guc: 0, tur: 'sekme', oldurdu: sonuc.oldu, agir: true });
        if (sonuc.oldu) break;
      }
    }
  }
  DEV.kayaSektir = function (x, y, aci, menzil, yari, taze) {
    if (OYUN.bolum !== 1 || !DEV.aktif || DEV.olu) return null;
    var k = null, enYakin = Infinity;
    for (var i = 0; i < kayalar.length; i++) {
      var aday = kayalar[i]; if (!kayaSektirilebilir(aday)) continue;
      var dx = aday.x - x, dy = aday.y - y, m = Math.hypot(dx, dy);
      if (m >= enYakin || m > menzil + aday.r * 0.55) continue;
      if (m > 38 && Math.abs(aciFark(Math.atan2(dy, dx), aci)) > yari + 0.18) continue;
      k = aday; enYakin = m;
    }
    if (!k) return null;
    var dogrudan = taze && k.ana;
    k.kusursuz = dogrudan && k.t >= k.T * 0.82 && enYakin <= 80;
    k.x0 = k.x; k.y0 = k.y; k.h0 = k.h; k.H = 76; k.t = 0;
    var yon = Math.atan2(DEV.y - k.y, DEV.x - k.x);
    if (dogrudan) {
      k.sahip = 'oyuncu'; k.T = AYAR.kayaSekmeUcus; k.x1 = DEV.x; k.y1 = DEV.y;
    } else {
      // Yan kayalar ve zincirin ağır bitirişi savrulur. Büyük ana kaya zamanlı savuruşla döner.
      k.sahip = 'yana'; k.T = 0.39; k.H = 52;
      yon += aciFark(aci, yon) < 0 ? -Math.PI / 2 : Math.PI / 2;
      var s = sinir();
      k.x1 = OYUN.sinirla(k.x + Math.cos(yon) * 180, s.sol + 18, s.sag - 18);
      k.y1 = OYUN.sinirla(k.y + Math.sin(yon) * 180, s.ust + 18, s.alt - 12);
    }
    return { tur: 'kaya', x: k.x, y: k.y, aci: yon, geri: dogrudan, kusursuz: k.kusursuz };
  };

  // ---------- halkalar ----------
  function halkaGuncelle(dt) {
    var o = oyuncu();
    for (var i = halkalar.length - 1; i >= 0; i--) {
      var h = halkalar[i]; h.R += AYAR.halkaHiz * dt;
      if (h.R >= AYAR.halkaMax) { halkalar.splice(i, 1); continue; }
      if (!h.vurdu && o) {
        var m = Math.hypot(o.x - h.x, o.y - h.y);
        if (Math.abs(m - h.R) < AYAR.halkaKalin / 2 + (o.r || 18) * 0.6) { h.vurdu = true; oyuncuVur(AYAR.halkaHasar, h.x, h.y, AYAR.halkaGuc); }
      }
    }
  }

  function sersemle(sure) {
    if (DEV.olu) return;
    gec('sersem', sure); DEV.sersem = sure;
    oynat('sersem', { dongu: true, hiz: sersemHizi() }, true);
  }

  // ---------- hasar alma ----------
  DEV.hasarAl = function (miktar, o) {
    o = o || {};
    if (!DEV.aktif || DEV.olu || !(miktar > 0)) return { oldu: false, blok: false };
    if (st.d === 'sersem') miktar *= AYAR.sersemCarpan;
    var once = DEV.can;
    DEV.can = Math.max(0, DEV.can - miktar);
    olay('dusmanHasar', { hedef: DEV, miktar: once - DEV.can });
    st.renkT = 0.09; renk(0xff9a9a);
    if (isFinite(o.aci)) { st.esne = 1; st.esneAci = o.aci; }
    if (DEV.can <= 0) { olumBasla(o); return { oldu: true, blok: false }; }
    if (o.kaya && st.d !== 'sersem') {
      try { OYUN.zaman.dondur(0.08); } catch (e) {}
      sars(12, 0.3); sersemle(o.kusursuz ? AYAR.kayaTamSersem : AYAR.kayaSekmeSersem);
      st.karsiSaldiri = DEV.evre === 3;
    }
    // 19 Kasım (ebeveyn onayı): kükrerken ya da hücum hazırlığında gelen balta hamleyi keser, devi sersemletir; sonra baltaKesBekle sn yalnız hasar
    var zt = OYUN.zaman ? OYUN.zaman.t : 0;
    if (o.tur === 'balta' && (st.d === 'kukre' || st.d === 'yardim' || st.d === 'hucumHaz') && !(zt < (st.kesmeT || -1))) {
      st.kesmeT = zt + AYAR.baltaKesBekle; st.plan = null; st.ikinciHucum = false;
      if (st.d === 'yardim') st.cagirKuyruk.length = 0;
      sars(12, 0.3); sersemle(AYAR.baltaKesSersem);
      st.kesildi = true;  // oyuncu.js dönüşteki kesme:true'yu 'vurus' olayına yazar (efekt/ses)
    }
    var oran = DEV.can / DEV.canMax;
    if (DEV.evre < 3 && oran <= AYAR.evre3) st.bekleyenEvre = 3;
    else if (DEV.evre < 2 && oran <= AYAR.evre2) st.bekleyenEvre = 2;
    if (miktar >= AYAR.irkilmeEsik && (st.d === 'yuru' || st.d === 'toparlan')) {
      gec('irkil', AYAR.irkilmeSure); oynat('sersem', { dongu: false, hiz: sersemHizi() }, true);
    }
    if (st.kesildi) { st.kesildi = false; return { oldu: false, blok: false, kesme: true }; }
    return { oldu: false, blok: false };
  };

  function olumBasla(o) {
    DEV.olu = true; DEV.can = 0; gec('ol', 0); st.olumT = 0;
    var l = liste(); if (l) { var i = l.indexOf(DEV); if (i >= 0) l.splice(i, 1); }
    halkalar.length = 0; st.cagirKuyruk.length = 0;
    yardimiDurdur();
    kayaTemizle();
    // vuranın yönüne dönüp geriye düşer; 4 yönlü ol animasyonunda eski yön kilidi kalmasın
    if (o && isFinite(o.aci)) { DEV.aci = o.aci + Math.PI; st.yonS = OYUN.aciYon ? OYUN.aciYon(DEV.aci) : st.yonS; }
    st.yon4 = -1; st.yonZ = -9;
    st.animKilit = 0;
    oynat('ol', { dongu: false }, true);
    st.yereDustu = false;
    try { OYUN.zaman.dondur(AYAR.olumDondur); } catch (e) {}
    try { OYUN.zaman.yavaslat(AYAR.olumYavas, AYAR.olumYavasSure); } catch (e) {}
    sars(AYAR.sarsGuc * 1.5, 1.2);
    olay('devOldu', { x: DEV.x, y: DEV.y, aci: o && o.aci });
  }

  // ---------- başlatma ----------
  DEV.basla = function (x, y) {
    if (OYUN.bolum !== 1) return DEV;
    if (DEV.aktif) return DEV;
    temizle();
    st = yeniDurum();
    var s0 = sinir(), ky0 = (typeof OYUN !== 'undefined' && OYUN.kamera && isFinite(OYUN.kamera.y)) ? OYUN.kamera.y : s0.ust;
    y = Math.max(y, Math.max(s0.ust + AYAR.r * 0.5, ky0 + AYAR.ustPay));
    DEV.aktif = true; DEV.olu = false; DEV.x = x; DEV.y = y; DEV.r = AYAR.r;
    DEV.can = DEV.canMax = zCan(); DEV.evre = 1; DEV.sersem = 0;
    DEV.aci = Math.PI / 2;
    spriteKur(); tgKur();
    var l = liste(); if (l && l.indexOf(DEV) < 0) l.push(DEV);
    st.plan = 'kaya';
    gec('giris', AYAR.girisSure); oynat('kukre', { dongu: false, hiz: animHiz('kukre', kukreSuresi(AYAR.girisSure), true) }, true); // kükreme bitince kalan girişte yürür (son resimde donmaz)
    sars(AYAR.sarsGuc, 1.0);
    olay('devBasla', { x: x, y: y });
    konumla();
    return DEV;
  };

  function konumla() {
    var s = DEV.sprite;
    if (s) {
      var e = st && st.esne > 0 ? st.esne * st.esne : 0, ec = e ? Math.cos(st.esneAci) : 0;
      s.x = cp(DEV.x + ec * 5 * e); s.y = cp(DEV.y); s.zIndex = DEV.y;
      s.rotation = e ? ec * 0.045 * e : 0;          // her vuruşta hafif geri esneme
    }
    if (golge) { golge.x = cp(DEV.x); golge.y = cp(DEV.y); }
  }

  function temizle() {
    kayaTemizle(); halkalar.length = 0;
    try { if (DEV.sprite && DEV.sprite.sil) DEV.sprite.sil(); else if (DEV.sprite) DEV.sprite.destroy({ children: true }); } catch (e) {}
    try { if (tg) tg.destroy(); if (golge) golge.destroy(); } catch (e) {}
    var l = liste(); if (l) { var i = l.indexOf(DEV); if (i >= 0) l.splice(i, 1); }
    DEV.sprite = null; tg = null; golge = null;
    DEV.aktif = false; DEV.olu = false; DEV.durum = 'yok'; DEV.can = DEV.canMax = AYAR.canMax; DEV.evre = 1; DEV.sersem = 0;
    st = yeniDurum();
  }

  // ---------- kare güncellemesi ----------
  function guncelle(dt) {
    if (OYUN.bolum !== 1) return;
    if (!DEV.aktif) {
      // ?dev ile doğrudan açıldıysa ve bölüm devi başlatmadıysa kendimiz başlatalım (yalnız Bölüm I'de)
      if (paramVar('dev')) {
        kendiBaslatT += dt;
        if (kendiBaslatT > (typeof BOLUM !== 'undefined' && BOLUM ? AYAR.kendiBaslatBolumlu : 2.5)) {
          var o = oyuncu(), s = sinir();
          var ky0 = (OYUN.kamera && isFinite(OYUN.kamera.y)) ? OYUN.kamera.y : s.ust;
          DEV.basla(OYUN.sinirla(o ? o.x : OYUN.W / 2, s.sol + 120, s.sag - 120), ky0 + AYAR.ustPay + 20);
        }
      }
      return;
    }
    if (st.olumT >= 0) { // ölüm: gerçek zamanla say (ağır çekimden bağımsız)
      var gd = (OYUN.zaman && isFinite(OYUN.zaman.gercekDt)) ? OYUN.zaman.gercekDt : dt;
      st.olumT += gd;
      if (st.renkT > 0) { st.renkT -= gd; if (st.renkT <= 0) renk(0xffffff); }
      if (st.esne > 0) st.esne = Math.max(0, st.esne - gd / 0.25);
      if (golge) {
        var sOl = DEV.sprite, aOl = sOl && sOl._a && sOl._a.n > 1 ? sOl._a.n - 1 : 0;
        var olP = aOl > 0 ? OYUN.sinirla((sOl.kare || 0) / aOl, 0, 1) : OYUN.sinirla(st.olumT / 1.8, 0, 1);
        var eOl = olP * olP * (3 - 2 * olP);
        if (golge.scale && golge.scale.set) golge.scale.set(1 + 0.24 * eOl, 1 + 0.14 * eOl);
        golge.alpha = 1 - 0.18 * eOl;
      }
      // gövde yere çarpınca (ölüm animasyonunun son karelerinde) ikinci, ağır sarsıntı + toz
      var sY = DEV.sprite, aY = sY && sY._a && sY._a.n > 1 ? sY._a.n : 0;
      if (!st.yereDustu && ((aY && ((sY.kare || 0) >= aY - 2 || sY.bitti)) || st.olumT > 2.4)) {
        st.yereDustu = true; sars(AYAR.olumYereSars, 0.7);
        olay('devYereVur', { x: DEV.x, y: DEV.y, r: 170, olum: true });
      }
      if (!st.kazandi && st.olumT >= AYAR.kazanmaGecikme) {
        st.kazandi = true; olay('kazandi', {});
        try { OYUN.durumYap('kazandi'); } catch (e) {}
      }
      konumla(); if (tg) tg.clear(); return;
    }
    st.t += dt;
    if (st.renkT > 0) { st.renkT -= dt; if (st.renkT <= 0) renk(0xffffff); }
    if (st.animKilit > 0) {
      st.animKilit -= dt;
      if (DEV.sprite && DEV.sprite.bitti) st.animKilit = 0;
    }
    if (st.esne > 0) st.esne = Math.max(0, st.esne - dt / 0.2);
    var x0 = DEV.x, y0 = DEV.y;
    DEV.sersem = st.d === 'sersem' ? Math.max(0, st.sure - st.t) : 0;

    var o = oyuncu(), d = st.d;
    // barbar devin dibinde inatla duruyor mu (dipteyken artar, açılınca hızla söner)
    if (o) st.dip = oyuncuMesafe() < AYAR.dipMesafe ? (st.dip || 0) + dt : Math.max(0, (st.dip || 0) - dt * 2);
    if (d === 'giris' || d === 'kukre' || d === 'yardim') {
      // kükreme resmi bitince kalan sürede dolanır (son resimde donmaz)
      if (DEV.sprite && DEV.sprite.bitti && DEV.sprite.anim === 'kukre' || DEV.sprite && DEV.sprite.anim !== 'kukre') notrAnim(dolas(dt));
      if (st.t >= st.sure) toparlan(d === 'kukre' ? AYAR.evreNefes : 0.5); // evre geçişi: kükremeden sonra kısa nefes (dolanarak)
    }
    else if (d === 'toparlan') {
      // önce vuruşun kalan resimleri yerinde oynar, sonra dev sıradaki saldırıya göre barbarın çevresinde dolanır
      if (!st.plan && oyuncu()) st.plan = planSec();
      if (st.animKilit > 0) don(dt, AYAR.bostaDonus);
      else notrAnim(dolas(dt));
      if (st.t >= st.sure) karar();
    }
    else if (d === 'irkil') { if (st.t >= st.sure) toparlan(0.35); }
    else if (d === 'sersem') {
      if (st.t >= st.sure) {
        if (st.ikinciHucum && o && devGoruste()) { // ikinci hücum: yol yeterliyse yeniden kükre-hazırlan (tam telgraf)
          var a0 = DEV.aci; DEV.aci = oyuncuyaAci(); var yolH = hucumUzunluk(); DEV.aci = a0;
          if (yolH >= 260) { bak(0.8); saldir('hucum'); }
          else { st.ikinciHucum = false; toparlan(0.5); }
        } else {
          st.ikinciHucum = false;
          if (st.karsiSaldiri && !st.bekleyenEvre && o) {
            // Son evrede geri sektirilen kayadan doğrulduğunda mesafeye göre karşılık verir.
            var eskiAci = DEV.aci; DEV.aci = oyuncuyaAci();
            var alanHucum = hucumUzunluk(); DEV.aci = eskiAci;
            st.plan = oyuncuMesafe() > 220 && alanHucum >= 240 ? 'hucum' : 'sopa';
          }
          st.karsiSaldiri = false;
          toparlan(0.5);
        }
      }
    }
    else if (d === 'geri') { // yerine (ekranın üst-ortası) dön
      if (!st.geriHedef) { // evdeyse yana bir adım (barbardan uzağa): kısa nefes, yer değiştirme
        var e1 = ev(), sk = sinir();
        if (evUzak() < 70 && o) e1.x = OYUN.sinirla(e1.x + (o.x > DEV.x ? -1 : 1) * 150, sk.sol + DEV.r * AYAR.yanPay, sk.sag - DEV.r * AYAR.yanPay);
        st.geriHedef = e1;
      }
      var e0 = st.geriHedef, gx = e0.x - DEV.x, gy = e0.y - DEV.y, gm = Math.hypot(gx, gy);
      if (gm > 20) {
        var ga = Math.atan2(gy, gx), gf = aciFark(ga, DEV.aci), gmx = AYAR.donusHiz * AYAR.bostaDonus * dt;
        DEV.aci += OYUN.sinirla(gf, -gmx, gmx);
        var gh = AYAR.geriHiz * Math.max(0, Math.cos(gf));
        DEV.x += Math.cos(DEV.aci) * gh * dt; DEV.y += Math.sin(DEV.aci) * gh * dt; notrAnim(gh);
      } else { don(dt, AYAR.bostaDonus); notrAnim(0); }
      if (st.t >= st.sure || gm <= 20) { st.geriHedef = null; toparlan(0.25); }
    }
    else if (d === 'yuru') {
      don(dt, AYAR.bostaDonus);
      var hiz = DEV.evre >= 3 ? AYAR.yuruHiz3 : AYAR.yuruHiz;
      var yAlt = ev().y + AYAR.evYPay, vyY = Math.sin(DEV.aci) * hiz * dt;
      if (DEV.y + vyY > yAlt && vyY > 0) vyY = Math.max(0, Math.min(vyY, yAlt - DEV.y)); // üst-ortadan çok aşağı inmez
      if (o && oyuncuMesafe() > AYAR.sopaMenzil * 0.7) { DEV.x += Math.cos(DEV.aci) * hiz * dt; DEV.y += vyY; notrAnim(hiz); }
      else if (!o) notrAnim(0);
      // sopa için yaklaşma: menzile girince vurur; barbar kaçarsa (ya da aşağıda kalırsa) kaya/hücuma geçer
      if (!o) toparlan(0.5);
      else if (oyuncuMesafe() <= AYAR.sopaMenzil * 0.8) { bak(0.5); saldir('sopa'); }
      else if (st.t >= st.sure) { var s3 = st.sonSaldiri, sn = s3.length ? s3[s3.length - 1] : ''; bak(0.5); saldir(sn !== 'kaya' ? 'kaya' : 'hucum'); }
    }
    else if (d === 'sopa') {
      if (st.t < st.hazir - AYAR.kilitSure) don(dt);
      if (st.t >= st.hazir && !st.vurdu) { st.vurdu = true; sopaVur(); }
      if (st.vurdu) {
        st.vurdu = false; var ts = toparlanSure(AYAR.sopaToparlan);
        // 19 Kasım zorluk: sopadan sonra ikinci hamle (ilk sopanın kombosu; ikincinin ardından kombo yok)
        if (!st.genis && rast(0, 1) < Math.min(0.95, (AYAR.kombo[Math.min(3, DEV.evre)] || 0) * Z())) { toparlanAnim('vur', AYAR.komboAra); gec('komboAra', AYAR.komboAra); }
        else { toparlanAnim('vur', ts * 0.7); araVer(); }
      }
    }
    else if (d === 'komboAra') { // ikinci hamle: barbar menzildeyse geniş sopa, kaçtıysa (evre 2+) kaya; ikisi de yeni, tam telgraflı hamle
      don(dt, AYAR.bostaDonus);
      if (st.t >= st.sure) {
        var km = oyuncuMesafe();
        if (o && km <= AYAR.sopaMenzil * 0.95) { bak(0.6); saldir('sopa'); st.genis = true; st.hazir = hazirSure(AYAR.genisHazirlik); oynat('vur', { dongu: false, hiz: animHiz('vur', st.hazir) }, true); }
        else if (o && DEV.evre >= 2 && devGoruste()) { bak(0.6); saldir('kaya'); }
        else araVer();
      }
    }
    else if (d === 'yerevur') {
      if (st.t < st.hazir - AYAR.kilitSure) don(dt);
      if (st.t >= st.hazir) {
        yereVur();
        if (st.artArda > 0) { st.artArda--; gec('yvAra', AYAR.yvAraSure); }
        else { var ty = toparlanSure(AYAR.yvToparlan); toparlanAnim('yerevur', ty * 0.7); toparlan(ty); }
      }
    }
    else if (d === 'yvAra') { if (st.t >= st.sure) { DEV.aci = oyuncuyaAci(); yerevurBasla(hazirSure(AYAR.yvArtArdaHazirlik)); } }
    else if (d === 'kaya') {
      if (st.t < st.hazir - AYAR.kayaKilit) don(dt, 2);
      else if (!st.kayaHedefleri) kayaHedefle();
      if (st.t >= st.hazir) {
        kayaAt(); var tk = toparlanSure(AYAR.kayaToparlan);
        if (DEV.evre >= 3 && !st.ikinciKaya && rast(0, 1) < Math.min(0.95, AYAR.kayaArt3 * Z())) { st.ikinciKaya = true; toparlanAnim('kayaat', AYAR.kayaArtAra); gec('kayaAra', AYAR.kayaArtAra); }
        else { st.ikinciKaya = false; toparlanAnim('kayaat', tk * 0.7); araVer(); }
      }
    }
    else if (d === 'kayaAra') { // evre 3: ikinci yaylım (yeni hazırlık + yeni hedef halkaları)
      don(dt, 2);
      if (st.t >= st.sure) { if (o && devGoruste()) { bak(0.6); kayaHazirla(); } else { st.ikinciKaya = false; araVer(); } }
    }
    else if (d === 'hucumHaz') {
      if (st.t < st.hazir - 0.45) don(dt, 1.5);   // son 0,45 sn yön kilitli: şeritten çıkmaya zaman var
      if (st.t >= st.hazir && hucumUzunluk() < 120) araVer();   // önü duvar: hücum etmez (sıfır boylu hücum + sersem olmasın)
      else if (st.t >= st.hazir) { gec('hucum'); st.hucumYol = 0; st.hucumVurdu = false; st.hucumEzilen = new Set(); oynat('yuru', { dongu: true, hiz: 2.4 }, true); }
    }
    else if (d === 'hucum') {
      var iv = OYUN.sinirla(st.t / AYAR.hucumIvme, 0, 1), adim = AYAR.hucumHiz * (0.3 + 0.7 * iv * (2 - iv)) * dt, kalan = hucumUzunluk();
      var duvar = kalan <= adim;
      adim = Math.min(adim, kalan);
      var hx0 = DEV.x, hy0 = DEV.y;
      DEV.x += Math.cos(DEV.aci) * adim; DEV.y += Math.sin(DEV.aci) * adim; st.hucumYol += adim;
      // hasar alanı = yerde çizilen şerit (devin bu karede taradığı parça, ön yüzü dahil)
      if (o && !st.hucumVurdu && seritIcinde(o.x, o.y, hx0, hy0, DEV.aci, adim + AYAR.hucumOn, AYAR.hucumYari, AYAR.telgrafPay)) {
        st.hucumVurdu = true; oyuncuVur(zHasar(AYAR.hucumHasar), DEV.x, DEV.y, AYAR.hucumGuc, 'hucum');
      }
      hucumYardimiEz(hx0, hy0, adim);
      // 19 Kasım: duvara çarpınca duraksama (dondur 0,1) kaldırıldı — ebeveyn donma istemiyor
      if (duvar) {
        sars(AYAR.sarsGuc * 1.4, 0.6); olay('devYereVur', { x: DEV.x + Math.cos(DEV.aci) * DEV.r, y: DEV.y + Math.sin(DEV.aci) * DEV.r, r: 60, duvar: true });
        // 19 Kasım zorluk: evre 3'te kısa sersemden sonra dönüp bir kez daha hücum (ikincisi tam sersemle biter)
        if (DEV.evre >= 3 && !st.ikinciHucum && rast(0, 1) < Math.min(0.95, AYAR.hucumIki3 * Z())) { st.ikinciHucum = true; sersemle(AYAR.hucumIkiSersem); }
        else { st.ikinciHucum = false; sersemle(AYAR.hucumSersem); }
      }
      else if (st.hucumYol >= AYAR.hucumMax) { st.ikinciHucum = false; araVer(); }
    }

    // barbar devin arkasında kalıyorsa (dev onu örtüyor) boşta/yürürken yana çekil
    // (toparlan'da bunu dolas() yapar: yana yürür; burada ayrıca itilirse iki hareket çakışıp dev yerinde titriyordu)
    st.yanKac = 0;
    if (o && (st.d === 'yuru' || st.d === 'geri')) {
      var yon = ortuYon(o);
      if (yon) { DEV.x += yon * AYAR.ortKacHiz * dt; st.yanKac = yon; }
    }

    // boşta/yürürken hız yumuşak oturur (kalkış/duruş/yana çekilme sıçramasız); saldırı ve hücum aynen
    if (dt > 0) {
      var hvx = (DEV.x - x0) / dt, hvy = (DEV.y - y0) / dt;
      // saldırı hazırlığına geçerken de yürüme hızı birden sıfırlanmaz (birkaç piksel süzülerek durur)
      if (st.d === 'yuru' || st.d === 'toparlan' || st.d === 'geri' || st.d === 'giris' || st.d === 'kukre' ||
          ((st.d === 'sopa' || st.d === 'kaya' || st.d === 'hucumHaz') && st.t < 0.4)) {
        var kv = 1 - Math.exp(-dt / AYAR.yuruYumusak);
        st.avx += (hvx - st.avx) * kv; st.avy += (hvy - st.avy) * kv;
        DEV.x = x0 + st.avx * dt; DEV.y = y0 + st.avy * dt;
      } else { st.avx = hvx; st.avy = hvy; }
    }

    halkaGuncelle(dt);
    kayaGuncelle(dt);
    if (!DEV.olu) cagirGuncelle(dt);

    // yürüme animasyonu gerçek hıza bağlı (ayak kaymasın)
    var vAn = dt > 0 ? Math.hypot(DEV.x - x0, DEV.y - y0) / dt : 0;
    st.vHiz += (vAn - st.vHiz) * (1 - Math.exp(-10 * dt));
    if (DEV.sprite && DEV.sprite.anim === 'yuru' && DEV.sprite._a) {
      DEV.sprite._hiz = st.d === 'hucum' ? kareSinir(DEV.sprite._a, 2.4) : yuruHiz(DEV.sprite._a);
    }

    // gövde: bölge içinde kal (ekrandan taşmasın), oyuncuyu içinden geçirme (itilmez)
    var s2 = sinir();
    DEV.x = OYUN.sinirla(DEV.x, s2.sol + DEV.r * AYAR.yanPay, s2.sag - DEV.r * AYAR.yanPay);
    var ky = (OYUN.kamera && isFinite(OYUN.kamera.y)) ? OYUN.kamera.y : s2.ust;
    DEV.y = OYUN.sinirla(DEV.y, Math.max(s2.ust + DEV.r * 0.5, ky + AYAR.ustPay), s2.alt - DEV.r * 0.5);
    if (o && st.d !== 'ol' && o.durum !== 'atil') { // atılırken devin içinden geçebilir
      var dx = o.x - DEV.x, dy = o.y - DEV.y, m = Math.hypot(dx, dy), en = DEV.r + (o.r || 18);
      if (m < en && m > 0.01) { o.x = DEV.x + dx / m * en; o.y = DEV.y + dy / m * en; }
    }
    konumla();
    telgrafCiz();
  }


  OYUN.sistem('dev', {
    baslat: function () { st = yeniDurum(); },
    guncelle: function (dt) {
      try { guncelle(dt); } catch (e) { console.error('dev.js', e); }
    },
    sifirla: function () { temizle(); kendiBaslatT = 0; }
  });

  // deneme kancası: DEV.saldir('sopa'|'yerevur'|'kaya'|'hucum') — yalnız boşta/toparlanırken
  DEV.saldir = function (ad) { if (DEV.aktif && !DEV.olu && st && (st.d === 'toparlan' || st.d === 'yuru')) { baslat(ad); return true; } return false; };
  window.DEV = DEV;
})();
