/* bolum.js – Deneme bölümü: yanmış sınır köyü.
 * Zemin + çevre çizimi (parça parça, yalnız ekrana yakın olanlar), otomatik kaydırma, dalga senaryosu, arena kilitleri, dev girişi.
 *
 * BOLUM = { uzunluk, ilerleme (0..1), arenaKilitli, sinir:{sol,sag,ust,alt}, baslangic:{x,y}, atesler:[{x,y,guc,h}],
 *           kenar(y) → {sol,sag} (o y'de yürünebilir genişlik; köprü ve geçitte dar), dalgaNo, DALGALAR, ARENALAR, durumu() }
 * Olaylar: 'dalga' {no, ad, arena, adet}, 'arena' {acik, ad}, 'topla' {tur:'can', x, y} (sözleşme dışı ek; dinlemek isteğe bağlı).
 * Test: ?dalga=N (N. dalgaya ışınlan), ?dev (doğrudan dev alanı). Kancalar: BOLUM._bak(y) (oyun dururken kamerayı y'ye koy; kuşbakışı harita için),
 *       BOLUM._dekorlar(), BOLUM.nanKurtarma (oyuncu konumu NaN olup geri alındıysa sayısı).
 */
(function () {
  'use strict';
  var W = 1280, H = 720, L = 9000, PARCA = 512, KARO = 256, ZEMIN_OLC = 2;
  // KAMERA: oyuncuyu izler (kendiliğinden kayma yok). Oyuncu ekranda ODAK_Y civarında tutulur.
  var ODAK_Y = 440;             // oyuncunun ayaklarının ekrandaki hedef y'si (alt-orta)
  var BAKIS = 105;              // yukarı yürürken kamera bu kadar öne bakar (gidiş yönünü göster; yumuşak artar)
  var KAM_SURE = 0.32;          // yumuşatma süresi (sn); küçük = sıkı takip
  var KAM_MAX = 330;            // kamera en fazla bu hızla gider (px/sn; oyuncu 235)
  var GERI = 0;                 // kamera geri dönmez (geri gelme 'ekran sallanıyor' hissi veriyordu)
  var OYALANMA = 6;             // ekranda düşman yokken bu kadar sn ilerlemezse kamera yavaşça ilerler
  var SURUN_HIZ = 24;           // o yavaş ilerlemenin hızı (px/sn); oyuncuyu ASLA itmez
  var OYUNCU_UST = 130, OYUNCU_ALT = 30;   // oyuncu sınırı: kamera.y+130 .. kamera.y+H-30
  var ARENA_UST = 200, ARENA_YAN = [200, 1080]; // arena kilitliyken oyuncu üst sınırı (kavga ekranın ortasında olsun) ve meydan yan sınırı (köşe yapılarının gölgesine girmesin)
  var TAKILI_SURE = 6;          // kilitliyken oyuncunun erişemeyeceği yerde bu kadar sn kalan düşman erişilebilir yere alınır
  var DUS_UST = 90, DUS_ALT = 25, DUS_YAN = 50; // kilitliyken düşman sınırı (görünür alanın içi)
  var DUS_DIS_SURE = 8;         // kilitliyken bu kadar sn görünür alan dışında kalan düşman kenardan içeri alınır

  function aktifBolum() { return window.OYUN ? OYUN.bolum : 1; }
  function cevrePaketAd() { return aktifBolum() === 3 ? 'ayaz' : aktifBolum() === 2 ? 'cevre2' : 'cevre'; }

  // =====================================================================
  // SENARYO – bütün dalgalar burada (yönetici buradan ayarlar)
  // grup: [tür, adet, nereden, gecikme sn, aralık sn]
  //   nereden: 'ust' (ekranın üstünden) · 'sol' / 'sag' (üst köşelerden) · 'yan' (sırayla sol/sağ) · 'arka' (ekranın altından) · 'orta' (üstten, yolun ortasından)
  // tetik: kameranın üst kenarı bu dünya y'sine gelince başlar. arena: o arenanın kilidinde sırayla (biri temizlenince sonraki).
  // =====================================================================
  var ARENALAR_1 = {
    meydan: { kamY: 6200, ad: 'Yanan meydan' },
    kilise: { kamY: 3480, ad: 'Kilise meydanı' }
  };
  // nefes: dalga temizlenince sıradaki arena dalgasına kadar beklenen saniye (yoksa 1.8).
  var DALGALAR_1 = [
    // --- köy girişi: ilk dakika öğretici (her dalga TEK yeni şey öğretir), arası kısa
    { ad: 'Köy girişi', tetik: 8150, g: [['goblin', 3, 'ust', 0, 0.8], ['goblin', 4, 'yan', 2.6, 0.45]] },          // savur
    { ad: 'Okçular', tetik: 7820, g: [['goblin', 5, 'yan', 0, 0.4], ['okcu', 2, 'ust', 1.2, 0.9]] },               // oku geri savur
    { ad: 'Kalkanlı ork', tetik: 7480, g: [['kalkanli', 1, 'orta', 0, 0], ['goblin', 4, 'arka', 2.2, 0.45]] },      // kalkanı yandan/arkadan
    { ad: 'Şaman', tetik: 7130, g: [['saman', 1, 'orta', 0, 0], ['goblin', 7, 'yan', 0.8, 0.35]] },                // önce şamanı indir
    { ad: 'Yakıcı', tetik: 6800, g: [['yakici', 1, 'orta', 0, 0]] },                                                // çömleği savurarak geri gönder, ateşte durma
    // --- YANAN MEYDAN (arena 1): yükselen üç dalga, ortada nefes + şişe
    { ad: 'Yanan meydan I', arena: 'meydan', g: [['goblin', 10, 'yan', 0, 0.3], ['okcu', 1, 'ust', 2, 1], ['yakici', 1, 'ust', 2.6, 0]] },   // goblinleri ateşe sür
    { ad: 'Yanan meydan II: kalkan duvarı', arena: 'meydan', nefes: 3.2, g: [['kalkanli', 3, 'orta', 0, 0.45], ['saman', 1, 'ust', 1.4, 0], ['goblin', 6, 'yan', 2.6, 0.35]] },
    { ad: 'Yanan meydan III', arena: 'meydan', g: [['goblin', 14, 'yan', 0, 0.2], ['okcu', 3, 'ust', 1.5, 0.9], ['kalkanli', 2, 'ust', 3, 0.8], ['goblin', 9, 'arka', 4.5, 0.25]] },
    // --- tarla: arkadan goblin baskını, sonra çitlerin ardından okçu pususu
    { ad: 'Tarla baskını', tetik: 5850, g: [['goblin', 4, 'ust', 0, 0.45], ['goblin', 7, 'arka', 1.6, 0.25], ['yakici', 1, 'ust', 2.2, 0], ['kalkanli', 1, 'orta', 3.5, 0]] },
    { ad: 'Tarla pususu', tetik: 5350, g: [['okcu', 5, 'yan', 0, 0.5], ['goblin', 8, 'orta', 1, 0.3], ['saman', 1, 'ust', 3, 0]] },
    // --- köprü: kalkanlı köprüyü tutar, goblinler üstünden akar, iki goblin arkadan
    { ad: 'Köprü', tetik: 4700, g: [['kalkanli', 1, 'orta', 0, 0], ['goblin', 8, 'orta', 1.2, 0.35], ['goblin', 3, 'arka', 4, 0.5]] },
    // --- KİLİSE MEYDANI (arena 2, doruk): dört dalga, II'den sonra nefes + şişe, IV hepsi birden
    { ad: 'Kilise meydanı I', arena: 'kilise', g: [['goblin', 12, 'yan', 0, 0.28], ['okcu', 3, 'ust', 2, 0.8]] },
    { ad: 'Kilise meydanı II: şaman korumalı kalkan hattı', arena: 'kilise', nefes: 3.2, g: [['kalkanli', 3, 'orta', 0, 0.4], ['saman', 2, 'ust', 1, 1], ['goblin', 6, 'yan', 2.5, 0.35]] },
    { ad: 'Kilise meydanı III: arkadan baskın', arena: 'kilise', nefes: 2.4, g: [['goblin', 12, 'arka', 0, 0.25], ['okcu', 3, 'ust', 1, 0.8], ['kalkanli', 2, 'ust', 2.5, 0.8], ['goblin', 4, 'yan', 4, 0.3]] },
    { ad: 'Kilise meydanı IV: son direniş', arena: 'kilise', g: [['goblin', 18, 'yan', 0, 0.18], ['kalkanli', 4, 'ust', 1, 0.9], ['okcu', 2, 'ust', 2, 0.8], ['yakici', 2, 'ust', 2.5, 1.4], ['saman', 2, 'ust', 3, 1.2], ['goblin', 12, 'arka', 4.5, 0.22]] },
    // --- kayalık geçit: tepeden okçu pususu + arkadan goblinler; çıkışta kalkan hattı
    { ad: 'Geçit pususu', tetik: 2950, g: [['okcu', 5, 'ust', 0, 0.5], ['goblin', 6, 'arka', 1.5, 0.4]] },
    { ad: 'Geçit çıkışı', tetik: 2450, g: [['kalkanli', 2, 'orta', 0, 0.8], ['saman', 1, 'ust', 1, 0], ['goblin', 6, 'yan', 1.5, 0.35]] }
  ];
  var DEV_YER_1 = { x: 640, y: 260 };                      // kamera y=0'a gelince dev burada başlar

  // =====================================================================
  // BÖLÜM II: KÜL GEÇİDİ (17 dalga: baskinci, infazci, goblin, okcu, yakici, saman)
  // =====================================================================
  var ARENALAR_2 = {
    kul_ovasi: { kamY: 6050, ad: 'Kül Ovası' },
    maden_ocagi: { kamY: 3250, ad: 'Maden Ocağı' }
  };
  var DALGALAR_2 = [
    // --- Yanık demir maden girişi
    { ad: 'Maden girişi', tetik: 8140, g: [['goblin', 3, 'ust', 0, 0.7], ['baskinci', 2, 'yan', 1.8, 0.7]] },
    { ad: 'Öncü akıncılar', tetik: 7800, g: [['baskinci', 3, 'ust', 0, 0.6], ['okcu', 2, 'ust', 1.4, 0.8]] },
    { ad: 'Demir zırhlılar', tetik: 7450, g: [['infazci', 1, 'orta', 0, 0], ['goblin', 4, 'arka', 1.8, 0.4]] },
    { ad: 'Kül şamanı', tetik: 7100, g: [['saman', 1, 'ust', 0, 0], ['baskinci', 3, 'yan', 0.8, 0.55], ['goblin', 4, 'ust', 1.6, 0.35]] },
    { ad: 'Ocak yakıcıları', tetik: 6760, g: [['yakici', 2, 'ust', 0, 1.1], ['goblin', 4, 'arka', 1.4, 0.4]] },
    // --- KÜL OVASI (arena 1)
    { ad: 'Kül Ovası I', arena: 'kul_ovasi', g: [['goblin', 8, 'yan', 0, 0.28], ['baskinci', 4, 'ust', 1.2, 0.55], ['okcu', 2, 'ust', 2.4, 0.8]] },
    { ad: 'Kül Ovası II: İnfazcı hattı', arena: 'kul_ovasi', nefes: 3.0, g: [['infazci', 2, 'orta', 0, 0.7], ['saman', 1, 'ust', 1.2, 0], ['baskinci', 4, 'yan', 2.0, 0.45]] },
    { ad: 'Kül Ovası III: Ateş çemberi', arena: 'kul_ovasi', g: [['goblin', 10, 'yan', 0, 0.22], ['yakici', 2, 'ust', 1.4, 0.9], ['okcu', 3, 'ust', 2.2, 0.7], ['baskinci', 4, 'arka', 3.4, 0.4]] },
    // --- Maden yolu
    { ad: 'Vagon pususu', tetik: 5620, g: [['baskinci', 4, 'ust', 0, 0.5], ['goblin', 5, 'arka', 1.4, 0.3], ['yakici', 1, 'ust', 2.2, 0]] },
    { ad: 'Kül fırtınası', tetik: 5180, g: [['okcu', 4, 'yan', 0, 0.45], ['saman', 1, 'ust', 1.2, 0], ['infazci', 1, 'orta', 2.0, 0], ['goblin', 5, 'ust', 2.6, 0.35]] },
    // --- Dar Lav Köprüsü (düşmanlar köprü yürüme koridoru içinde doğar)
    { ad: 'Lav Köprüsü', tetik: 4780, g: [['infazci', 1, 'orta', 0, 0], ['baskinci', 3, 'orta', 1.0, 0.5], ['goblin', 6, 'orta', 2.2, 0.35], ['goblin', 3, 'arka', 3.8, 0.45]] },
    // --- MADEN OCAĞI (arena 2)
    { ad: 'Maden Ocağı I', arena: 'maden_ocagi', g: [['baskinci', 5, 'yan', 0, 0.45], ['goblin', 8, 'ust', 1.0, 0.28], ['okcu', 2, 'ust', 2.2, 0.8]] },
    { ad: 'Maden Ocağı II: Kül ayini', arena: 'maden_ocagi', nefes: 3.0, g: [['infazci', 2, 'orta', 0, 0.6], ['saman', 2, 'ust', 1.0, 0.9], ['baskinci', 4, 'yan', 2.2, 0.4]] },
    { ad: 'Maden Ocağı III: Kıskaç', arena: 'maden_ocagi', nefes: 2.2, g: [['goblin', 10, 'arka', 0, 0.24], ['yakici', 2, 'ust', 1.0, 0.9], ['infazci', 2, 'ust', 2.2, 0.8], ['okcu', 3, 'yan', 3.0, 0.6]] },
    { ad: 'Maden Ocağı IV: Ocak muhafızları', arena: 'maden_ocagi', g: [['baskinci', 6, 'yan', 0, 0.35], ['infazci', 3, 'ust', 1.2, 0.75], ['okcu', 3, 'ust', 2.0, 0.7], ['yakici', 2, 'ust', 2.6, 1.0], ['saman', 2, 'ust', 3.0, 1.0], ['goblin', 8, 'arka', 4.0, 0.25]] },
    // --- Bazalt geçidi & Sönmeyen Ocak kapısı
    { ad: 'Bazalt geçit pususu', tetik: 2780, g: [['okcu', 4, 'ust', 0, 0.5], ['baskinci', 3, 'ust', 1.0, 0.55], ['goblin', 5, 'arka', 1.8, 0.35]] },
    { ad: 'Sönmeyen Ocak kapısı', tetik: 1950, g: [['infazci', 2, 'orta', 0, 0.7], ['saman', 1, 'ust', 1.0, 0], ['yakici', 1, 'ust', 1.8, 0], ['baskinci', 4, 'yan', 2.2, 0.45]] }
  ];
  var VARGOR_YER = { x: 640, y: 260 };

  var ARENALAR_3 = {
    bugaz: { kamY: 7100, ad: 'Donmuş Boğaz' },
    avlu: { kamY: 3830, ad: 'Kuşatma Avlusu' },
    kule_yolu: { kamY: 1160, ad: 'Kule Kapısı' }
  };
  var DALGALAR_3 = [
    { ad: 'Tipideki izler', tetik: 8190, g: [['kircil_kurt', 4, 'yan', 0, .84], ['goblin', 2, 'ust', 1.9, .6]] },
    { ad: 'Buz sırtı', tetik: 7800, g: [['ayaz_mizrak', 2, 'yan', 0, 1.35], ['kircil_kurt', 2, 'ust', 1, .8]] },
    { ad: 'Donmuş Boğaz I', arena: 'bugaz', g: [['ayaz_mizrak', 2, 'yan', 0, 1.3], ['kircil_kurt', 4, 'arka', 1.2, .53]] },
    { ad: 'Donmuş Boğaz II', arena: 'bugaz', nefes: 2.2, g: [['ayaz_zincir', 2, 'yan', .25, 1.3], ['kircil_kurt', 4, 'arka', .8, .70]] },
    { ad: 'Hisar yaklaşımı', tetik: 6430, g: [['ayaz_zincir', 2, 'yan', 0, 1.2], ['ayaz_mizrak', 2, 'ust', 1.2, 1.05], ['kircil_kurt', 1, 'yan', 2.2, 0]] },
    { ad: 'Zırhlı gözcü', tetik: 5775, g: [['buz_muhafiz', 1, 'orta', .35, 0], ['kircil_kurt', 3, 'yan', 1.2, .65]] },
    { ad: 'Kırık barikat', tetik: 4890, g: [['ayaz_zincir', 1, 'ust', 0, 0], ['ayaz_mizrak', 3, 'yan', .65, .85], ['goblin', 3, 'arka', 1.8, .42]] },
    { ad: 'Kuşatma Avlusu I', arena: 'avlu', g: [['buz_muhafiz', 1, 'orta', .2, 0], ['ayaz_mizrak', 2, 'yan', 0, 1], ['kircil_kurt', 4, 'arka', 1.1, .55]] },
    { ad: 'Kuşatma Avlusu II', arena: 'avlu', nefes: 2.3, g: [['ayaz_zincir', 2, 'yan', .25, 1.2], ['buz_muhafiz', 2, 'ust', .8, 1.7], ['kircil_kurt', 3, 'arka', 1.45, .6]] },
    { ad: 'Karlı merdivenler', tetik: 2780, g: [['kircil_kurt', 5, 'yan', 0, .62], ['ayaz_mizrak', 3, 'ust', .8, .8], ['ayaz_zincir', 1, 'arka', 2.4, 0]] },
    { ad: 'İşaret Kulesi kapısı', arena: 'kule_yolu', g: [['buz_muhafiz', 2, 'orta', 0, 1.45], ['ayaz_zincir', 2, 'yan', .8, .92], ['ayaz_mizrak', 2, 'arka', 1.8, 1], ['kircil_kurt', 2, 'yan', 2.8, .95]] }
  ];
  var SKARN_YER = { x: 640, y: 260 };
  var ARENALAR = ARENALAR_1;
  var DALGALAR = DALGALAR_1;
  var DEV_YER = DEV_YER_1;
  var CAN_MIKTAR = 30;
  var CAN_GANIMETI = {
    1: { ihtimal: 0.025, azami: 5, ara: 8 },
    2: { ihtimal: 0.072, azami: 10, ara: 6 },
    3: { ihtimal: 0.052, azami: 6, ara: 8 }
  };
  var KALABALIK = 60;                                    // bu kadar canlı düşman varken yenisi doğmaz (bekler)

  // =====================================================================
  // YERLEŞİM (dünya biçimi)
  // =====================================================================
  var DERE = { y1: 4690, y2: 4870 };
  var KOPRU = { x1: 520, x2: 760, y1: 4648, y2: 4912 };
  var DARLAR_1 = [{ y1: 4682, y2: 4878, sol: 540, sag: 740 }, { y1: 2320, y2: 3060, sol: 330, sag: 950 }];
  var MEYDANLAR = [{ cx: 640, cy: 6560, rx: 600, ry: 390 }, { cx: 640, cy: 3850, rx: 600, ry: 410 }];
  var DEV_ALANI = { cx: 640, cy: 620, rx: 760, ry: 760 };

  var LAVA_2 = { y1: 4540, y2: 4920 };
  var KOPRU_2 = { x1: 480, x2: 800, y1: 4496, y2: 4964 };
  var DARLAR_2 = [{ y1: 4536, y2: 4924, sol: 500, sag: 780 }, { y1: 2350, y2: 2950, sol: 320, sag: 960 }];
  var MEYDANLAR_2 = [{ cx: 640, cy: 6420, rx: 600, ry: 400 }, { cx: 640, cy: 3620, rx: 600, ry: 410 }];
  var VARGOR_ALANI = { cx: 640, cy: 620, rx: 760, ry: 760 };
  var DARLAR_3 = [{ y1: 7550, y2: 7870, sol: 375, sag: 895 }, { y1: 2670, y2: 3150, sol: 365, sag: 925 }];
  var DARLAR = DARLAR_1;

  function ss(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  function bant(y, a, b, yum) { return ss(a - yum, a, y) * (1 - ss(b, b + yum, y)); }
  function yolX(y) {
    if (aktifBolum() === 3) return AYAZ.yolX(y);
    if (aktifBolum() === 2) {
      var f2 = ss(160, 480, Math.abs(y - 4730)) * (1 - 0.85 * bant(y, 2350, 2950, 220)) * (1 - bant(y, 0, 1320, 260));
      return 640 + f2 * (70 * Math.sin(y / 860 + 0.5) + 30 * Math.sin(y / 320));
    }
    var f = ss(150, 500, Math.abs(y - 4780)) * (1 - 0.8 * bant(y, 2320, 3060, 250)) * (1 - bant(y, 0, 1300, 300));
    return 640 + f * (80 * Math.sin(y / 820) + 35 * Math.sin(y / 310 + 1.3));
  }
  function yolYari(y) {
    if (aktifBolum() === 3) return AYAZ.yolYari(y);
    if (aktifBolum() === 2) {
      var b2 = 270 + 24 * Math.sin(y / 510 + 0.7) + 12 * Math.sin(y / 95 + 1) + 6 * Math.sin(y / 33);
      b2 = b2 * (1 - bant(y, 2350, 2950, 180)) + (245 + 10 * Math.sin(y / 41)) * bant(y, 2350, 2950, 180);
      var k2 = ss(140, 320, Math.abs(y - 4730));
      return 135 + (b2 - 135) * k2;
    }
    var b = 275 + 22 * Math.sin(y / 530) + 12 * Math.sin(y / 97 + 2) + 6 * Math.sin(y / 31);
    b = b * (1 - bant(y, 2320, 3060, 200)) + (250 + 10 * Math.sin(y / 43)) * bant(y, 2320, 3060, 200);
    var k = ss(140, 330, Math.abs(y - 4780));
    return 125 + (b - 125) * k;
  }
  function kenar(y) {
    var sol = 90, sag = 1190;
    for (var i = 0; i < DARLAR.length; i++) { var d = DARLAR[i]; if (y >= d.y1 && y <= d.y2) { sol = Math.max(sol, d.sol); sag = Math.min(sag, d.sag); } }
    return { sol: sol, sag: sag };
  }
  function bolge(y) {
    if (aktifBolum() === 3) return AYAZ.bolge(y);
    if (aktifBolum() === 2) {
      if (y > 7000) return 'maden_girisi';
      if (y > 5950) return 'kul_ovasi';
      if (y > 4980) return 'maden_yolu';
      if (y > 4500) return 'lav_koprusu';
      if (y > 3150) return 'maden_ocagi';
      if (y > 2200) return 'bazalt_gecit';
      if (y > 1350) return 'ocak_kapisi';
      return 'sonmeyen_ocak';
    }
    if (y > 7000) return 'koy';
    if (y > 6120) return 'meydan';
    if (y > 4960) return 'tarla';
    if (y > 4560) return 'dere';
    if (y > 3300) return 'kilise';
    if (y > 2200) return 'gecit';
    if (y > 1350) return 'sakin';
    return 'dev';
  }

  // tohumlu yerel rastgele (yerleşim her açılışta aynı olsun; OYUN.rast'ı tüketmesin)
  function tohumluRast(t) { return function () { t |= 0; t = t + 0x6D2B79F5 | 0; var r = Math.imul(t ^ t >>> 15, 1 | t); r = r + Math.imul(r ^ r >>> 7, 61 | r) ^ r; return ((r ^ r >>> 14) >>> 0) / 4294967296; }; }
  var YR = tohumluRast(7151);
  function yr(a, b) { return a + (b - a) * YR(); }
  function yrTam(a, b) { return Math.floor(a + (b - a + 1) * YR()); }
  function hash(a, b) { var h = Math.imul(a * 374761393 + b * 668265263, 1274126177); h ^= h >>> 13; return (h >>> 0); }
  function rast(a, b) { try { return OYUN.rast(a, b); } catch (e) { return a + Math.random() * (b - a); } }

  // =====================================================================
  // RESİM KAYNAKLARI: çevre paketi varsa onu, yoksa kodla çizilmiş yer tutucu
  // =====================================================================
  function cevreKare(ad) {
    try {
      var ana = cevrePaketAd();
      var p = VARLIK.paketler && VARLIK.paketler[ana], pk = ana;
      if (!p || !p.tekil || p.tekil[ad] === undefined) { p = VARLIK.paketler && VARLIK.paketler.efekt; pk = 'efekt'; }
      if (!p || !p.tekil || p.tekil[ad] === undefined) return null;
      var k = VARLIK.kare(pk, ad);
      if (!k || !k.doku) return null;
      return k;
    } catch (e) { return null; }
  }
  function cevreOlc(ad) {
    try {
      var p = VARLIK.paketler && VARLIK.paketler[cevrePaketAd()];
      var b = p && p.bilgi;
      return (b && b[ad] && b[ad].olcek) || 1;
    } catch (e) { return 1; }
  }
  function kareHazir(k) { return k && k.doku && k.doku.baseTexture && k.doku.baseTexture.valid; }
  function tuval(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }

  // --- yer tutucu çizimler (2B tuval) ---
  var ytOnbellek = {};
  function ytRast(ad) { var s = 0; for (var i = 0; i < ad.length; i++) s = (s * 31 + ad.charCodeAt(i)) | 0; return tohumluRast(s); }
  function ytKaro(tur, v) {
    var c = tuval(KARO, KARO), g = c.getContext('2d'), R = ytRast(tur + v);
    var renk = ({
      camur: ['#2f251c', '#241b14', '#3a2e22', '#1c1612'],
      ot: ['#25261a', '#1d1f15', '#2f2e1e', '#3a3522'],
      tas: ['#34322f', '#2a2826', '#403d38', '#211f1d'],
      kul: ['#272426', '#1e1b1d', '#332e30', '#161315'],
      bazalt: ['#212025', '#17161a', '#2e2c33', '#121114'],
      maden: ['#2a2623', '#1f1c1a', '#39332d', '#141210'],
      lav: ['#8c260a', '#cf4812', '#ff8c26', '#331208']
    })[tur] || ['#272426', '#1e1b1d', '#332e30', '#161315'];
    g.fillStyle = renk[0]; g.fillRect(0, 0, KARO, KARO);
    function sar(fn, x, y) { for (var ox = -KARO; ox <= KARO; ox += KARO) for (var oy = -KARO; oy <= KARO; oy += KARO) fn(x + ox, y + oy); }
    for (var i = 0; i < 70; i++) {
      var x = R() * KARO, y = R() * KARO, r = 8 + R() * 40, cc = renk[1 + Math.floor(R() * 3)];
      g.globalAlpha = 0.18 + R() * 0.25; g.fillStyle = cc;
      sar(function (xx, yy) { g.beginPath(); g.ellipse(xx, yy, r, r * (0.4 + R() * 0.5), R() * 3, 0, 6.3); g.fill(); }, x, y);
    }
    if (tur === 'ot') {
      g.lineWidth = 1.4;
      for (var j = 0; j < 260; j++) {
        var gx = R() * KARO, gy = R() * KARO, l = 5 + R() * 9, a = -1.57 + (R() - 0.5) * 1.2;
        g.globalAlpha = 0.25 + R() * 0.35; g.strokeStyle = R() < 0.5 ? '#4a4429' : '#2f3020';
        sar(function (xx, yy) { g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx + Math.cos(a) * l, yy + Math.sin(a) * l); g.stroke(); }, gx, gy);
      }
    } else if (tur === 'tas' || tur === 'bazalt') {
      for (var yy = 0; yy < KARO; yy += 32) for (var xx = ((yy / 32) % 2) * 24; xx < KARO + 48; xx += 48) {
        g.globalAlpha = 0.35; g.strokeStyle = tur === 'bazalt' ? '#100e13' : '#171513'; g.lineWidth = 3;
        var px = xx % KARO, w = 40 + R() * 8, h = 26 + R() * 4;
        g.strokeRect(px - 2, yy + 2, w, h); if (px + w > KARO) g.strokeRect(px - 2 - KARO, yy + 2, w, h);
        g.globalAlpha = 0.12; g.fillStyle = R() < 0.5 ? (tur === 'bazalt' ? '#3d3945' : '#57524a') : '#1d1b19'; g.fillRect(px, yy + 4, w - 4, h - 4);
      }
    } else if (tur === 'maden') {
      g.strokeStyle = '#151311'; g.lineWidth = 2; g.globalAlpha = 0.4;
      for (var my = 0; my < KARO; my += 64) for (var mx = 0; mx < KARO; mx += 64) {
        g.strokeRect(mx + 2, my + 2, 60, 60);
        g.fillStyle = '#4f463d'; g.beginPath(); g.arc(mx + 8, my + 8, 2, 0, 6.3); g.arc(mx + 56, my + 8, 2, 0, 6.3); g.arc(mx + 8, my + 56, 2, 0, 6.3); g.arc(mx + 56, my + 56, 2, 0, 6.3); g.fill();
      }
    } else {
      g.lineWidth = 3;
      for (var k = 0; k < 14; k++) { // tekerlek izleri / çatlaklar
        var cx = R() * KARO, cy = R() * KARO; g.globalAlpha = 0.25; g.strokeStyle = '#150f0b';
        sar(function (xx, yy) { g.beginPath(); g.moveTo(xx, yy); g.quadraticCurveTo(xx + 10, yy + 30, xx + (R() - 0.5) * 20, yy + 60); g.stroke(); }, cx, cy);
      }
    }
    g.globalAlpha = 1;
    return { c: c, sx: 0, sy: 0, sw: KARO, sh: KARO };
  }
  function ytSus(ad) {
    var R = ytRast(ad), c, g;
    if (ad.indexOf('leke_kul') === 0 || ad.indexOf('sus_kul') === 0) {
      c = tuval(200, 160); g = c.getContext('2d');
      for (var i = 0; i < 18; i++) {
        var x = 100 + (R() - 0.5) * 90, y = 80 + (R() - 0.5) * 60, r = 20 + R() * 45;
        var gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(8,7,7,0.35)'); gr.addColorStop(1, 'rgba(8,7,7,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 200, 160);
      }
    } else if (ad.indexOf('sus_kor') === 0) {
      c = tuval(100, 70); g = c.getContext('2d');
      for (var ki = 0; ki < 10; ki++) {
        var kx = 20 + R() * 60, ky = 15 + R() * 40, kr = 6 + R() * 14;
        var kgr = g.createRadialGradient(kx, ky, 0, kx, ky, kr); kgr.addColorStop(0, 'rgba(255,110,30,0.65)'); kgr.addColorStop(1, 'rgba(60,15,5,0)');
        g.fillStyle = kgr; g.beginPath(); g.arc(kx, ky, kr, 0, 6.3); g.fill();
      }
    } else if (ad === 'sus_zincir') {
      c = tuval(120, 44); g = c.getContext('2d'); g.strokeStyle = '#3c3734'; g.lineWidth = 4;
      for (var zi = 14; zi < 106; zi += 16) { g.beginPath(); g.ellipse(zi, 22, 9, 5, (zi % 32 ? 0.3 : -0.3), 0, 6.3); g.stroke(); }
    } else if (ad.indexOf('tas') === 0) {
      c = tuval(48, 40); g = c.getContext('2d'); g.beginPath();
      for (var a = 0; a < 6.28; a += 0.9) { var rr = 14 + R() * 8; g.lineTo(24 + Math.cos(a) * rr, 22 + Math.sin(a) * rr * 0.7); }
      g.closePath(); g.fillStyle = '#4a4741'; g.fill(); g.strokeStyle = '#141210'; g.lineWidth = 2.5; g.stroke();
      g.fillStyle = 'rgba(160,150,135,0.25)'; g.beginPath(); g.ellipse(20, 16, 7, 4, -0.3, 0, 6.3); g.fill();
    } else if (ad.indexOf('kemik') === 0 || ad.indexOf('sus_kemik') === 0) {
      c = tuval(64, 40); g = c.getContext('2d'); g.strokeStyle = '#1a1612'; g.lineCap = 'round';
      if (ad === 'kemik_3' || ad === 'sus_kemik_2') { // kafatası
        g.fillStyle = '#b3a993'; g.beginPath(); g.ellipse(32, 18, 14, 12, 0, 0, 6.3); g.fill(); g.lineWidth = 2; g.stroke();
        g.fillStyle = '#1a1612'; g.beginPath(); g.arc(27, 18, 3.5, 0, 6.3); g.arc(37, 18, 3.5, 0, 6.3); g.fill();
      } else {
        g.lineWidth = 7; g.beginPath(); g.moveTo(12, 30); g.lineTo(52, 10); g.stroke();
        g.lineWidth = 4; g.strokeStyle = '#b3a993'; g.beginPath(); g.moveTo(12, 30); g.lineTo(52, 10); g.stroke();
        g.fillStyle = '#b3a993'; [[10, 28], [13, 33], [50, 8], [54, 13]].forEach(function (p) { g.beginPath(); g.arc(p[0], p[1], 4, 0, 6.3); g.fill(); });
      }
    } else { // ot
      c = tuval(70, 50); g = c.getContext('2d'); g.lineCap = 'round';
      for (var j = 0; j < 22; j++) {
        var bx = 35 + (R() - 0.5) * 24, a2 = -1.57 + (R() - 0.5) * 1.6, l = 14 + R() * 22;
        g.strokeStyle = R() < 0.5 ? '#5a5030' : '#3c3a24'; g.lineWidth = 1.5 + R();
        g.beginPath(); g.moveTo(bx, 46); g.quadraticCurveTo(bx + Math.cos(a2) * l * 0.5, 46 + Math.sin(a2) * l * 0.6, bx + Math.cos(a2) * l, 46 + Math.sin(a2) * l); g.stroke();
      }
    }
    return { c: c, sx: 0, sy: 0, sw: c.width, sh: c.height };
  }
  // dekor yer tutucuları: ayak noktası (w/2, h-8)
  function ytDekor(ad) {
    var R = ytRast(ad), c, g, w, h;
    function tv(ww, hh) { w = ww; h = hh; c = tuval(w, h); g = c.getContext('2d'); g.lineJoin = 'round'; g.lineCap = 'round'; }
    function golge(rx, ry) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(w / 2, h - 8, rx, ry, 0, 0, 6.3); g.fill(); }
    function kiris(x1, y1, x2, y2, k) { g.strokeStyle = '#0c0a08'; g.lineWidth = k + 4; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.strokeStyle = '#2a1f17'; g.lineWidth = k; g.stroke(); }
    function kor(x, y, r) { var gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,150,50,0.9)'); gr.addColorStop(0.4, 'rgba(200,60,20,0.5)'); gr.addColorStop(1, 'rgba(120,20,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); }
    function alev(x, y, s) { g.fillStyle = 'rgba(255,120,30,0.85)'; g.beginPath(); g.moveTo(x - 9 * s, y); g.quadraticCurveTo(x - 10 * s, y - 20 * s, x, y - 38 * s); g.quadraticCurveTo(x + 10 * s, y - 20 * s, x + 9 * s, y); g.fill(); g.fillStyle = 'rgba(255,220,120,0.9)'; g.beginPath(); g.moveTo(x - 4 * s, y); g.quadraticCurveTo(x - 4 * s, y - 10 * s, x, y - 20 * s); g.quadraticCurveTo(x + 4 * s, y - 10 * s, x + 4 * s, y); g.fill(); }
    function kayaSekil(cx, cy, rx, ry, renk) {
      g.beginPath(); for (var a = 0; a < 6.3; a += 0.55) { var k = 0.8 + R() * 0.3; g.lineTo(cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k * (Math.sin(a) > 0 ? 0.6 : 1)); }
      g.closePath(); g.fillStyle = renk; g.fill(); g.strokeStyle = '#0d0c0b'; g.lineWidth = 4; g.stroke();
      g.fillStyle = 'rgba(150,145,135,0.18)'; g.beginPath(); g.ellipse(cx - rx * 0.25, cy - ry * 0.45, rx * 0.4, ry * 0.2, -0.2, 0, 6.3); g.fill();
    }
    if (ad.indexOf('ev_yanik') === 0) {
      tv(300, 320); golge(140, 34);
      g.fillStyle = '#16120f'; g.beginPath(); g.moveTo(30, h - 20); g.lineTo(270, h - 20); g.lineTo(255, h - 70); g.lineTo(45, h - 70); g.fill();
      var dx = [45, 110, 190, 255];
      for (var i = 0; i < dx.length; i++) { var top = h - 70 - 110 - R() * 70; kiris(dx[i], h - 40, dx[i] + (R() - 0.5) * 10, top, 12); }
      kiris(40, h - 170, 260, h - 175 + (R() - 0.5) * 30, 10);
      kiris(45, h - 180, 150, h - 290, 9); kiris(150, h - 290, 205, h - 235, 9); kiris(110, h - 140, 200, h - 230, 7);
      g.fillStyle = '#211a14'; g.fillRect(60, h - 110, 50, 60); g.fillRect(200, h - 100, 45, 50);
      kor(80, h - 45, 26); kor(220, h - 50, 22); kor(150, h - 172, 14); alev(80, h - 45, 1.1); alev(222, h - 52, 0.8);
    } else if (ad.indexOf('cit') === 0) {
      tv(180, 90); golge(80, 10);
      var kirik = ad === 'cit_2';
      for (var p = 0; p < 4; p++) { var x = 20 + p * 46, t = h - 70 + R() * 10; if (kirik && p === 2) t = h - 35; kiris(x, h - 10, x + (R() - 0.5) * 6, t, 7); }
      kiris(16, h - 55, kirik ? 95 : 165, h - 52, 5); kiris(16, h - 32, 165, h - 30, 5); if (kirik) kiris(105, h - 20, 160, h - 50, 5);
    } else if (ad.indexOf('agac_olu') === 0) {
      tv(240, 300); golge(40, 10);
      var dal = function (x, y, a, l, k, d) { if (d > 5 || l < 8) return; var x2 = x + Math.cos(a) * l, y2 = y + Math.sin(a) * l; kiris(x, y, x2, y2, k); dal(x2, y2, a - 0.3 - R() * 0.5, l * 0.72, k * 0.65, d + 1); if (R() < 0.8) dal(x2, y2, a + 0.3 + R() * 0.5, l * 0.68, k * 0.62, d + 1); };
      dal(w / 2, h - 10, -1.57 + (R() - 0.5) * 0.2, 95, 18, 0);
    } else if (ad.indexOf('kazik') === 0) {
      tv(110, 140); golge(40, 10);
      for (var s = 0; s < 5; s++) { var sx = 20 + s * 17 + (R() - 0.5) * 6, ty = h - 70 - R() * 50; kiris(sx, h - 10, sx + (R() - 0.5) * 18, ty, 7); }
      g.fillStyle = 'rgba(70,10,8,0.6)'; g.beginPath(); g.ellipse(55, h - 14, 26, 6, 0, 0, 6.3); g.fill();
    } else if (ad === 'araba_kirik') {
      tv(220, 140); golge(95, 16);
      g.save(); g.translate(110, h - 50); g.rotate(-0.18);
      g.fillStyle = '#2a1f17'; g.strokeStyle = '#0c0a08'; g.lineWidth = 4; g.fillRect(-80, -34, 150, 40); g.strokeRect(-80, -34, 150, 40);
      for (var b = -70; b < 70; b += 22) { g.beginPath(); g.moveTo(b, -34); g.lineTo(b, 6); g.stroke(); }
      kiris(70, -10, 112, 8, 6); g.restore();
      g.strokeStyle = '#0c0a08'; g.lineWidth = 6; g.beginPath(); g.arc(70, h - 34, 26, 0, 6.3); g.stroke();
      g.strokeStyle = '#3a2c20'; g.lineWidth = 3; g.stroke();
      for (var q = 0; q < 6; q++) { var aa = q * 1.05; g.beginPath(); g.moveTo(70, h - 34); g.lineTo(70 + Math.cos(aa) * 24, h - 34 + Math.sin(aa) * 24); g.stroke(); }
      kor(150, h - 50, 16);
    } else if (ad === 'kuyu') {
      tv(150, 170); golge(64, 14);
      g.fillStyle = '#3a3733'; g.strokeStyle = '#0d0c0b'; g.lineWidth = 4;
      g.beginPath(); g.ellipse(75, h - 40, 55, 20, 0, 0, 6.3); g.fill(); g.stroke(); g.fillRect(20, h - 70, 110, 30); g.strokeRect(20, h - 70, 110, 30);
      g.beginPath(); g.ellipse(75, h - 70, 55, 18, 0, 0, 6.3); g.fillStyle = '#4a4640'; g.fill(); g.stroke();
      g.fillStyle = '#060606'; g.beginPath(); g.ellipse(75, h - 70, 40, 11, 0, 0, 6.3); g.fill();
      kiris(28, h - 70, 30, h - 150, 8); kiris(122, h - 70, 118, h - 140, 8); kiris(20, h - 148, 130, h - 135, 6);
    } else if (ad === 'mesale') {
      tv(50, 150); golge(12, 5);
      kiris(25, h - 8, 25, h - 100, 7); g.fillStyle = '#1a120c'; g.fillRect(17, h - 112, 16, 14);
      kor(25, h - 112, 30); alev(25, h - 108, 1.0);
    } else if (ad.indexOf('enkaz_yanan') === 0) {
      tv(200, 120); golge(85, 16);
      for (var e = 0; e < 7; e++) { var ex = 30 + R() * 140, ey = h - 15 - R() * 30; kiris(ex, ey, ex + (R() - 0.5) * 110, ey - 10 - R() * 40, 8 + R() * 4); }
      kor(100, h - 30, 50); kor(60, h - 25, 22); alev(100, h - 28, 1.2); alev(70, h - 22, 0.7); alev(132, h - 26, 0.8);
    } else if (ad.indexOf('kaya_buyuk') === 0) {
      tv(240, 190); golge(105, 18);
      kayaSekil(120, h - 70, 100, 80, '#3d3a35'); if (R() < 0.6) kayaSekil(60 + R() * 120, h - 30, 40, 28, '#34312d');
    } else if (ad === 'kilise_yikik') {
      tv(480, 500); golge(220, 40);
      g.fillStyle = '#2d2b28'; g.strokeStyle = '#0d0c0b'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(40, h - 20); g.lineTo(40, h - 230); g.lineTo(80, h - 260); g.lineTo(110, h - 210); g.lineTo(150, h - 240); g.lineTo(170, h - 120); g.lineTo(300, h - 110); g.lineTo(320, h - 280); g.lineTo(350, h - 300); g.lineTo(350, h - 460); g.lineTo(420, h - 480); g.lineTo(430, h - 300); g.lineTo(440, h - 20); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#0a0909'; g.beginPath(); g.moveTo(70, h - 20); g.lineTo(70, h - 120); g.quadraticCurveTo(95, h - 170, 120, h - 120); g.lineTo(120, h - 20); g.fill();
      g.beginPath(); g.moveTo(370, h - 300); g.lineTo(370, h - 380); g.quadraticCurveTo(388, h - 410, 405, h - 380); g.lineTo(405, h - 300); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 2; for (var ry = h - 40; ry > h - 440; ry -= 26) { g.beginPath(); g.moveTo(40, ry); g.lineTo(440, ry); g.stroke(); }
      kayaSekil(200, h - 30, 70, 30, '#35322e'); kayaSekil(270, h - 25, 40, 20, '#2f2c29');
      kiris(160, h - 40, 260, h - 120, 10); kor(220, h - 50, 24); alev(220, h - 48, 0.9);
    } else if (ad.indexOf('bazalt_kaya') === 0) {
      tv(170, 130); golge(66, 16);
      kayaSekil(85, h - 42, 68, 52, '#2a2830'); kayaSekil(52, h - 22, 34, 22, '#222027');
    } else if (ad === 'bazalt_sutun') {
      tv(130, 210); golge(46, 12);
      g.fillStyle = '#26242b'; g.strokeStyle = '#0d0c0f'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(26, h - 10); g.lineTo(32, 34); g.lineTo(64, 14); g.lineTo(98, 28); g.lineTo(104, h - 10); g.closePath(); g.fill(); g.stroke();
      kor(65, h - 26, 20);
    } else if (ad.indexOf('demir_kafes') === 0) {
      tv(140, 150); golge(52, 12);
      g.fillStyle = '#1b191d'; g.strokeStyle = '#0b0a0c'; g.lineWidth = 3;
      g.fillRect(22, h - 115, 96, 98); g.strokeRect(22, h - 115, 96, 98);
      for (var kb = 34; kb <= 106; kb += 18) { kiris(kb, h - 115, kb, h - 17, 4); }
      g.fillStyle = '#4c4640'; g.fillRect(18, h - 122, 104, 12);
    } else if (ad === 'ocak_mangal') {
      tv(110, 120); golge(38, 11);
      kiris(26, h - 10, 38, h - 44, 6); kiris(84, h - 10, 72, h - 44, 6);
      g.fillStyle = '#2e2a28'; g.strokeStyle = '#0c0b0a'; g.lineWidth = 3;
      g.beginPath(); g.ellipse(55, h - 48, 34, 15, 0, 0, 6.3); g.fill(); g.stroke();
      kor(55, h - 52, 28); alev(55, h - 52, 0.9);
    } else if (ad === 'maden_vagon') {
      tv(190, 125); golge(76, 15);
      g.fillStyle = '#2b241f'; g.strokeStyle = '#0d0b09'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(22, h - 82); g.lineTo(168, h - 82); g.lineTo(154, h - 28); g.lineTo(36, h - 28); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#46413d'; g.fillRect(18, h - 88, 154, 10);
      [50, 140].forEach(function (wx) { g.fillStyle = '#383432'; g.beginPath(); g.arc(wx, h - 20, 13, 0, 6.3); g.fill(); g.stroke(); });
    } else if (ad.indexOf('sancak') === 0) {
      tv(90, 180); golge(22, 7);
      kiris(45, h - 8, 45, 16, 6);
      g.fillStyle = ad === 'sancak_2' ? '#5e1a14' : '#732418'; g.strokeStyle = '#120a09'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(47, 26); g.lineTo(78, 36); g.lineTo(68, 96); g.lineTo(47, 118); g.closePath(); g.fill(); g.stroke();
    } else if (ad === 'varil_yag') {
      tv(84, 106); golge(30, 10);
      g.fillStyle = '#5c311a'; g.strokeStyle = '#0f0a07'; g.lineWidth = 3;
      g.beginPath(); g.roundRect ? g.roundRect(18, h - 84, 48, 72, 10) : g.fillRect(18, h - 84, 48, 72);
      g.fill(); g.stroke();
      g.fillStyle = '#383534'; g.fillRect(16, h - 70, 52, 8); g.fillRect(16, h - 34, 52, 8);
      g.fillStyle = '#c83418'; g.beginPath(); g.arc(42, h - 50, 9, 0, 6.3); g.fill();
    } else if (ad.indexOf('koz_cukur') === 0) {
      tv(150, 90);
      g.fillStyle = '#181416'; g.strokeStyle = '#0a0809'; g.lineWidth = 4;
      g.beginPath(); g.ellipse(75, 45, 66, 36, 0, 0, 6.3); g.fill(); g.stroke();
      kor(75, 45, 52);
    } else if (ad === 'totem_kor') {
      tv(94, 210); golge(34, 11);
      kiris(47, h - 8, 47, 28, 12);
      g.fillStyle = '#292322'; g.fillRect(28, 34, 38, 22);
      kor(47, 36, 30); alev(47, 34, 1.05);
    } else if (ad === 'can_sisesi') {
      tv(44, 64); golge(14, 5);
      // Camın koyu kenarı, yakut renkli iksir ve aşınmış pirinç boyun.
      var cam = g.createLinearGradient(6, 24, 39, 52);
      cam.addColorStop(0, '#844d48'); cam.addColorStop(.42, '#57292b'); cam.addColorStop(1, '#28151b');
      g.lineWidth = 2.6; g.strokeStyle = '#151016'; g.fillStyle = cam;
      g.beginPath(); g.moveTo(16, 14); g.lineTo(28, 14); g.lineTo(29, 23);
      g.bezierCurveTo(40, 30, 42, 42, 34, 51); g.quadraticCurveTo(22, 58, 10, 51);
      g.bezierCurveTo(2, 42, 4, 30, 15, 23); g.closePath(); g.fill(); g.stroke();
      var iksir = g.createLinearGradient(0, 32, 0, 53);
      iksir.addColorStop(0, '#d56d61'); iksir.addColorStop(.4, '#a43239'); iksir.addColorStop(1, '#571522');
      g.fillStyle = iksir; g.beginPath(); g.moveTo(8, 36);
      g.bezierCurveTo(17, 31, 28, 40, 36, 34); g.quadraticCurveTo(40, 43, 32, 50);
      g.quadraticCurveTo(22, 54, 12, 50); g.quadraticCurveTo(5, 45, 8, 36); g.fill();
      g.strokeStyle = '#e2a190'; g.lineWidth = 1.45;
      g.beginPath(); g.moveTo(11, 37); g.quadraticCurveTo(9, 32, 17, 26);
      g.moveTo(10, 41); g.lineTo(11, 44); g.stroke();
      g.strokeStyle = '#824645'; g.beginPath(); g.moveTo(28, 51); g.lineTo(33, 48); g.stroke();
      g.fillStyle = '#ae8a5f'; g.strokeStyle = '#3e2826'; g.lineWidth = 1.7;
      g.beginPath(); g.moveTo(15, 14); g.lineTo(16, 7); g.lineTo(27, 8); g.lineTo(29, 15);
      g.quadraticCurveTo(22, 19, 15, 14); g.fill(); g.stroke();
      g.strokeStyle = '#dfbc83'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(17, 10); g.lineTo(24, 10); g.moveTo(17, 16); g.lineTo(28, 16); g.stroke();
      g.fillStyle = '#8f3034'; g.strokeStyle = '#4c2228';
      g.beginPath(); g.moveTo(29, 17); g.lineTo(34, 20); g.lineTo(31, 25); g.lineTo(27, 21);
      g.closePath(); g.fill(); g.stroke();
    } else { tv(60, 60); g.fillStyle = '#555'; g.fillRect(10, 10, 40, 40); }
    return { c: c, sx: 0, sy: 0, sw: w, sh: h, ax: 0.5, ay: (h - 8) / h };
  }

  // kaynak(ad, tur) → {c (resim/tuval), sx, sy, sw, sh, gecici?}
  function tuvalKaynak(ad, tur) {
    var k = cevreKare(ad);
    if (k) {
      if (!kareHazir(k)) return null; // gerçek resim yükleniyor → şimdilik yer tutucu, sonra yeniden çiz
      var _bt = k.doku.baseTexture, _rs = _bt.resource, src = _rs && _rs.source, f = k.doku.frame;
      // 5. tur (yönetici): büyük çevre sayfasından 2B tuvale çizerken tarayıcı resmi her seferinde yeniden çözüyordu (≈100 ms takılma).
      // Sayfanın çözülmüş bir kopyası (ImageBitmap) bir kez hazırlanır ve ondan çizilir.
      if (src && window.createImageBitmap && !_bt._bdBmpIstendi) { _bt._bdBmpIstendi = true; try { createImageBitmap(src).then(function (b) { _bt._bdBmp = b; }).catch(function () {}); } catch (e) {} }
      if (_bt._bdBmp) src = _bt._bdBmp;
      if (src) return { c: src, sx: f.x, sy: f.y, sw: f.width, sh: f.height };
    }
    return null;
  }
  var bekleyenGercek = false;
  function kaynakAl(ad, ytAd, ytFn) {
    var r = tuvalKaynak(ad);
    if (r) return r;
    if (cevreKare(ad)) bekleyenGercek = true;
    var key = 'yt:' + ytAd;
    return ytOnbellek[key] || (ytOnbellek[key] = ytFn());
  }
  // Zemin türü: pakette yoksa yedeği (yol → çamur, çukur → çamur). Çeşit sayısı paketten okunur.
  var YEDEK_TUR = { yol: 'camur', cukur: 'camur' }, cesitSay = {};
  function b2KaroMi(tur) { return tur === 'kul' || tur === 'bazalt' || tur === 'maden' || tur === 'lav'; }
  function b2KaroAd(tur, i) { return tur === 'lav' ? 'lav_kenar' : tur + '_' + i; }
  function turAl(tur) {
    if (aktifBolum() === 2 && b2KaroMi(tur)) return tur;
    return (YEDEK_TUR[tur] && !cevreKare('zemin_' + tur + '_1')) ? turAl(YEDEK_TUR[tur]) : tur;
  }
  function cesitN(tur) {
    var b = aktifBolum();
    var cKey = b + ':' + tur;
    if (cesitSay[cKey]) return cesitSay[cKey];
    var n = 0;
    if (b === 2 && b2KaroMi(tur)) {
      if (tur === 'lav') n = cevreKare('lav_kenar') ? 1 : 0;
      else while (n < 12 && cevreKare(tur + '_' + n)) n++;
      if (n) cesitSay[cKey] = n;
      return n || (tur === 'lav' ? 1 : 2);
    }
    while (n < 12 && cevreKare('zemin_' + tur + '_' + (n + 1))) n++;
    if (n) cesitSay[cKey] = n; // paket gelmeden önce sorulursa önbelleğe yazma
    return n || 2;
  }
  function karoKaynak(tur, v) { // tur: camur|ot|tas|yol|cukur  veya  kul|bazalt|maden|lav
    tur = turAl(tur);
    var b = aktifBolum();
    var n = cesitN(tur);
    if (b === 2 && b2KaroMi(tur)) {
      var idx = v % n;
      var ad2 = b2KaroAd(tur, idx);
      return kaynakAl(ad2, 'karo2_' + tur + (v % 2), function () { return ytKaro(tur, v % 2); });
    }
    var i = (v % n) + 1;
    return kaynakAl('zemin_' + tur + '_' + i, 'karo_' + tur + (v % 2), function () { return ytKaro(YEDEK_TUR[tur] ? 'camur' : tur, v % 2); });
  }
  function susKaynak(ad) { return kaynakAl(ad, 'sus_' + ad, function () { return ytSus(ad); }); }

  // =====================================================================
  // DURUM
  // =====================================================================
  var BOLUM = window.BOLUM = {
    uzunluk: L, ilerleme: 0, gostergeIlerlemesi: 0, arenaKilitli: false,
    sinir: { sol: 90, sag: 1190, ust: L - H + 50, alt: L - 30 },
    baslangic: { x: 640, y: L - 200 },
    atesler: [], kenar: kenar, dalgaNo: 0,
    lavGecidi: { y1: LAVA_2.y1, y2: LAVA_2.y2, sol: KOPRU_2.x1, sag: KOPRU_2.x2 },
    variller: [], kozler: [],
    DALGALAR: DALGALAR, ARENALAR: ARENALAR, canlar: []
  };
  var kamY = L - H;
  var kuruluBolum = 0;
  var dalgalar = [];        // çalışma durumu (DALGALAR ile aynı sıra)
  var arenaDalgaSayisi = 0;
  var arenalar = {};        // ad → {kamY, sira:[dalga i], i, basladi, bitti, bekle}
  var etkinArena = null;
  var devBasladi = false, devIstek = false;
  var ilkKare = true, isinlaKonum = null;
  var susler = [], dekorlar = [], canlar = BOLUM.canlar;
  var canTohum = 0, sonCan = -Infinity;
  var variller = [], kozler = [], varilEfektler = [];
  var kozG = null, efektG = null;
  var parcalar = {};        // i → {sprite, tex, gecici}
  var yenidenT = 0, oncekiHazir = false;
  var dokuOnbellek = {};

  function senaryoSec() {
    var b = aktifBolum();
    if (b === 3) {
      ARENALAR = ARENALAR_3; DALGALAR = DALGALAR_3; DEV_YER = SKARN_YER; DARLAR = DARLAR_3;
    } else if (b === 2) {
      ARENALAR = ARENALAR_2; DALGALAR = DALGALAR_2; DEV_YER = VARGOR_YER; DARLAR = DARLAR_2;
    } else {
      ARENALAR = ARENALAR_1; DALGALAR = DALGALAR_1; DEV_YER = DEV_YER_1; DARLAR = DARLAR_1;
    }
    BOLUM.DALGALAR = DALGALAR;
    BOLUM.ARENALAR = ARENALAR;
    BOLUM.uzunluk = L;
    BOLUM.toplamDusman = DALGALAR.reduce(function (s, w) { return s + w.g.reduce(function (t, g) { return t + g[1]; }, 0); }, 0);
  }
  senaryoSec();

  // =====================================================================
  // YERLEŞİM ÜRETİMİ (bir kez; tohumlu)
  // =====================================================================
  var BOY = {
    ayaz_cam: 226, ayaz_kaya: 114, ayaz_duvar: 179, ayaz_araba: 126, ayaz_kafes: 154, ayaz_mesale: 143, ayaz_kule: 407,
    ayaz_yamac: 305, ayaz_mancinik: 155, ayaz_sancak: 205, ayaz_kemer: 249,
    ev_yanik: 300, cit: 80, agac_olu: 290, kazik: 125, araba_kirik: 125, kuyu: 160, mesale: 140, enkaz_yanan: 110, kaya_buyuk: 175, kilise_yikik: 480, can_sisesi: 52,
    bazalt_kaya: 120, bazalt_sutun: 195, demir_kafes: 155, ocak_mangal: 112, maden_vagon: 115, sancak: 175, varil_yag: 98, koz_cukur: 85, totem_kor: 205
  };
  var ATES = {
    ev_yanik: [0.8, 0.25], mesale: [0.55, 0.75], enkaz_yanan: [1.0, 0.2], kilise_yikik: [0.6, 0.08],
    ocak_mangal: [0.75, 0.65], totem_kor: [0.85, 0.78]
  }; // [güç, alev yüksekliği / boy]
  var ATES_TUR = { ev_yanik: 'ev', mesale: 'mesale', enkaz_yanan: 'enkaz', kilise_yikik: 'ev', ocak_mangal: 'mesale', totem_kor: 'mesale' };
  var AYAZ_TABAN = {
    ayaz_cam: [.27,.14], ayaz_kaya: [1.02,.34], ayaz_duvar: [1.44,.24],
    ayaz_araba: [1.18,.36], ayaz_kafes: [.57,.24], ayaz_kule: [.46,.27],
    ayaz_yamac: [.85,.28], ayaz_mancinik: [1.05,.34], ayaz_sancak: [.28,.12]
  };
  function tabanAl(ad, gk, olc, ko, b) {
    var ayaz = AYAZ_TABAN[ad];
    if (ayaz) return [b * ayaz[0], Math.min(85, b * ayaz[1])]; // [genişlik, derinlik] oyun px (pakette bilgi.taban; yoksa tahmin)
    try {
      var p = VARLIK.paketler && VARLIK.paketler[cevrePaketAd()];
      var bi = p && p.bilgi && p.bilgi[ad];
      if (bi && bi.taban) {
        if (bi.taban.length >= 4) return [(bi.taban[2] - bi.taban[0]) * olc, (bi.taban[3] - bi.taban[1]) * olc];
        if (gk) return [bi.taban[0] * olc, bi.taban[1] * olc];
      }
    } catch (e) {}
    var w = gk ? gk.w * olc * ko : b * 0.9; return [w * 0.8, Math.min(60, b * 0.3)];
  }
  function boyu(ad) { var t = ad.replace(/_\d+$/, ''); return BOY[t] || 100; }
  function dekor(ad, x, y, sec) {
    sec = sec || {};
    var t = ad.replace(/_\d+$/, ''), olc = sec.olcek || yr(0.9, 1.1), gk = cevreKare(ad);
    var ko = gk ? cevreOlc(ad) : 1; // paket pikseli → oyun pikseli (2× çizilmiş resimde 0.5: aynı boy, daha çok piksel)
    var b = gk ? gk.h * olc * ko : (sec.boy || boyu(ad)) * olc; // paket resmi kendi ölçüsünde; yer tutucu BOY tablosuyla
    var newGw = (gk ? gk.w * olc * ko : b * 0.9) / 2;
    if (!ATES[t] && !sec.zorla) { // ateşsiz dekor (çit, kazık, ağaç, kaya, araba) bir öncekiyle iç içe girmesin
      for (var j = 0; j < dekorlar.length; j++) { var o = dekorlar[j]; if (Math.abs(o.y - y) < 70 && Math.abs(o.x - x) < newGw + o.gw + 24) return null; }
    }
    // yer izi (taban) üst üste binmesin: ev, enkaz, araba, kaya... birbirinin içine girmesin (derli toplu görünüm)
    var tb = tabanAl(ad, gk, olc, ko, b);
    if (!sec.zorla) for (var j2 = 0; j2 < dekorlar.length; j2++) {
      var o2 = dekorlar[j2];
      if (t === 'mesale' && o2.ad === 'mesale' && Math.hypot(o2.x - x, o2.y - y) < 160) return null;
      if (t === 'mesale' && Math.abs(o2.y - y) < 55 && Math.abs(o2.x - x) < o2.gw + newGw + 24) return null;
      if (Math.abs(o2.x - x) < (tb[0] + o2.tb[0]) / 2 + 20 && y - tb[1] - 20 < o2.y && o2.y - o2.tb[1] - 20 < y) return null;
      // arkada kalan nesne öndekinin resminin içine gömülmesin (çatının üstünde enkaz, evin arkasında kaybolan meşale)
      var ow = o2.gw * 0.8 + newGw * 0.35, nw = newGw * 0.8 + o2.gw * 0.35;
      if (y < o2.y && Math.abs(x - o2.x) < ow && y > o2.y - o2.boy * 0.85) return null;
      if (o2.y < y && Math.abs(x - o2.x) < nw && o2.y > y - b * 0.85) return null;
    }
    x = Math.round(x); y = Math.round(y); // tam piksel konum (yarım pikselde resim yumuşar)
    var d = { gw: gk ? gk.w * olc * ko / 2 : b * 0.45, ko: ko, tb: tb, ad: ad, x: x, y: y, boy: b, olc: olc, ayna: sec.ayna !== undefined ? sec.ayna : YR() < 0.5, s: null, ates: !!ATES[t] && sec.sonuk !== true };
    dekorlar.push(d);
    if (ad === 'varil_yag') {
      var vr = { x: x, y: y, r: 32, can: 10, canMax: 10, aktif: true, patladi: false, patliyor: false, d: d, sprite: null, engel: null };
      d._varil = vr;
      variller.push(vr);
    } else if (t === 'koz_cukur') {
      var kidx = kozler.length;
      var kz = { x: x, y: y, r: 64, ad: ad, aktif: false, sicak: false, uyari: false, faz: 'sonuk', zaman: (kidx % 2) * 0.35, hasarT: 0, d: d, sprite: null };
      d._koz = kz;
      kozler.push(kz);
    }
    if (d.ates && (t !== 'ev_yanik' || YR() < 0.7)) {
      var ates = { x: x, y: y, guc: ATES[t][0] * yr(0.85, 1.15), h: b * ATES[t][1], tur: ATES_TUR[t] || t };
      if (t === 'mesale') {
        var alevYeri = gk && gk.bilgi && gk.bilgi.alev;
        d.alevX = alevYeri ? alevYeri[0] / ko : 0;
        d.alevY = alevYeri ? alevYeri[1] / ko : -104;
        var dekorOlcegi = gk ? olc * ko : b / 150;
        ates.agizX = x + d.alevX * dekorOlcegi * (d.ayna ? -1 : 1);
        ates.agizY = y + d.alevY * dekorOlcegi;
      }
      BOLUM.atesler.push(ates);
      var kr = yr(-20, 20), kd = yr(0, 15), kb = yr(180, 260); // (YR sırası değişmesin diye önce çekilir)
      if (!(y > L - H - 100 && Math.abs(x - 640) < 420)) sus((aktifBolum() === 2 ? 'sus_kul_' + yrTam(1, 2) : 'leke_kul_' + yrTam(1, 3)), x + kr, y - kd, kb, 0.6);
    }
    return d;
  }
  function sus(ad, x, y, boy, alfa, rot) { susler.push({ ad: ad, x: x, y: y, boy: boy, a: alfa === undefined ? yr(0.7, 1) : alfa, r: rot === undefined ? yr(-3.14, 3.14) : rot, ayna: YR() < 0.5 }); }
  function yanX(taraf, ic) { return taraf < 0 ? yr(10, ic || 160) : yr(W - (ic || 160), W - 10); }
  function sec(a) { return a[Math.floor(YR() * a.length)]; }

  function yerlesimKur1() {
    YR = tohumluRast(7151);
    susler = []; dekorlar = []; BOLUM.atesler = []; variller = []; kozler = [];
    BOLUM.variller = variller; BOLUM.kozler = kozler;
    var y, t;
    // --- köy girişi (7000..9000): yolun iki yanında ANLAMLI KÜMELER (avlu: yanık ev + çit + araba/enkaz), aralarında
    // ot ve ölü ağaçlı boşluklar (ev-ev-ev koridoru değil). Sol ve sağ kümeler kaydırmalı: her ekranda bir yanda avlu, öbür yanda açıklık.
    // avlu(taraf, y): ev kenarda, çit yola bakan önünde, yanında araba ya da yanan enkaz; yol kenarında meşale
    function avlu(taraf, y, ev, yan) {
      var ic = function (dx) { return taraf < 0 ? dx : W - dx; };
      dekor(ev, ic(yr(70, 105)), y, { ayna: taraf > 0, zorla: true }); // kümeler elle yerleşik: üst üste binme denetimi kümenin kendi içinde gereksiz
      dekor(sec(['cit_1', 'cit_3']), ic(yr(235, 265)), y + yr(78, 96), { ayna: taraf > 0, zorla: true }); // avlunun önü (evle aynı sırada değil: üst üste binmesin)
      if (yan === 'araba') dekor('araba_kirik', ic(yr(300, 320)), y - yr(150, 180), { ayna: taraf < 0, zorla: true });
      else if (yan === 'enkaz') dekor(sec(['enkaz_yanan_1', 'enkaz_yanan_2']), ic(yr(255, 285)), y - yr(140, 170), { zorla: true });
      else if (yan === 'kazik') { dekor('kazik_1', ic(yr(250, 275)), y - 150, { zorla: true }); dekor('kazik_2', ic(yr(300, 320)), y - 205, { zorla: true }); }
      var my = y + yr(70, 100); dekor('mesale', yolX(my) + (taraf < 0 ? -1 : 1) * (yolYari(my) + yr(20, 40)), my, { ayna: false });
    }
    function aciklik(taraf, y) { // avlular arası: ölü ağaç + kazık ya da kırık çit
      var ic = function (dx) { return taraf < 0 ? dx : W - dx; };
      dekor(sec(['agac_olu_1', 'agac_olu_2', 'agac_olu_3']), ic(yr(60, 140)), y);
      if (YR() < 0.6) dekor('cit_2', ic(yr(240, 290)), y - yr(60, 110), { ayna: taraf > 0 });
      else dekor(sec(['kazik_1', 'kazik_2']), ic(yr(220, 270)), y - yr(50, 90));
    }
    avlu(-1, 8860, 'ev_yanik_1', 'kazik');   aciklik(1, 8900);
    aciklik(-1, 8530);                       avlu(1, 8520, 'ev_yanik_2', 'araba');
    avlu(-1, 8160, 'ev_yanik_3', 'araba');   aciklik(1, 8180);
    // kuyu meydanı (sağda, yolun kenarında küçük bir açıklık: kuyu + iki meşale + yanan enkaz + kazık)
    dekor('kuyu', 1015, 7840, { ayna: false }); dekor('mesale', 900, 7790, { ayna: false, zorla: true }); dekor('mesale', 1150, 7740, { ayna: false });
    dekor('enkaz_yanan_2', 1180, 7980); dekor('agac_olu_2', 1230, 7650); dekor('kazik_2', 905, 7600);
    aciklik(-1, 7820);
    avlu(-1, 7470, 'ev_yanik_2', 'enkaz');   avlu(1, 7330, 'ev_yanik_3', 'kazik');
    aciklik(-1, 7140);
    // --- yanan meydan (6120..7000): halka halinde yanan enkaz, köşelerde evler
    var m = MEYDANLAR[0];
    dekor('ev_yanik_2', 40, 6260); dekor('ev_yanik_3', 1240, 6300); dekor('ev_yanik_1', 60, 6930); dekor('ev_yanik_2', 1225, 6900);
    for (var a = 0; a < 6.28; a += 0.5) {
      var mx = m.cx + Math.cos(a) * (m.rx + 20), my = m.cy + Math.sin(a) * (m.ry + 10);
      if (Math.abs(mx - 640) < 330) continue;
      dekor(YR() < 0.5 ? sec(['enkaz_yanan_1', 'enkaz_yanan_2']) : 'mesale', OYUN.sinirla(mx, 20, W - 20), my);
    }
    dekor('kuyu', 185, 6470); dekor('kazik_1', 1105, 6420); dekor('araba_kirik', 1110, 6700, { ayna: true });
    // --- tarla ve çitler (4960..6120)
    for (y = 6080; y > 5000; y -= yr(110, 170)) {
      // köprüye yaklaşırken (dar yol) çit yok: yolu boğmasın
      var cs1 = YR() < 0.8, ca1 = sec(['cit_1', 'cit_2', 'cit_3']), cx1 = yolX(y) - yolYari(y) - yr(30, 70); if (cs1 && y > 5200) dekor(ca1, cx1, y);
      var cs2 = YR() < 0.8, ca2 = sec(['cit_1', 'cit_2', 'cit_3']), cx2 = yolX(y) + yolYari(y) + yr(30, 70); if (cs2 && y > 5200) dekor(ca2, cx2, y);
      if (YR() < 0.25) dekor(sec(['agac_olu_1', 'agac_olu_2', 'agac_olu_3']), yanX(YR() < 0.5 ? -1 : 1, 110), y - 40);
      if (YR() < 0.2) dekor(sec(['kazik_1', 'kazik_2']), yanX(YR() < 0.5 ? -1 : 1, 140), y - 60);
    }
    dekor('araba_kirik', 1150, 5600); dekor('ev_yanik_3', 60, 5420); dekor('enkaz_yanan_1', 185, 5475);
    // --- dere ve köprü (4560..4960)
    dekor('agac_olu_3', 260, 4960); dekor('agac_olu_1', 1000, 4945); dekor('kaya_buyuk_1', 120, 4930); dekor('kaya_buyuk_2', 1160, 4920);
    dekor('agac_olu_2', 330, 4660); dekor('kaya_buyuk_3', 1100, 4655); dekor('kazik_2', 880, 4640);
    dekor('mesale', 500, 4930, { ayna: false, zorla: true }); dekor('mesale', 780, 4930, { ayna: false, zorla: true });
    // karşı köprü başı: iki kafatası kazığı + kırık çit (kilise tarafının kapısı)
    dekor('kazik_1', 478, 4628, { ayna: false, zorla: true }); dekor('kazik_2', 802, 4628, { ayna: true, zorla: true });
    dekor('cit_2', 905, 4600, { ayna: true }); dekor('cit_2', 380, 4590, { ayna: false });
    // --- kilise yıkıntısı meydanı (3300..4560)
    dekor('ev_yanik_1', 50, 4500); dekor('ev_yanik_3', 1230, 4440); dekor('agac_olu_1', 1180, 4320);
    dekor('kilise_yikik', 1195, 3790, { ayna: false, olcek: 1, zorla: true }); dekor('enkaz_yanan_2', 1000, 3700); // kilise arena kadrajında: kule ve haç meydandan görünsün
    m = MEYDANLAR[1];
    for (a = 0.25; a < 6.28; a += 0.6) {
      var kx = m.cx + Math.cos(a) * (m.rx + 10), ky = m.cy + Math.sin(a) * (m.ry + 10);
      if (Math.abs(kx - 640) < 340 || (kx > 900 && ky < 3800)) continue;
      dekor(YR() < 0.4 ? 'mesale' : sec(['kazik_1', 'kazik_2', 'cit_2', 'enkaz_yanan_1']), OYUN.sinirla(kx, 20, W - 20), ky);
    }
    dekor('agac_olu_2', 70, 3420); dekor('ev_yanik_2', 40, 3700);
    // --- kayalık geçit (2200..3300): iki yanda yoğun kaya
    for (y = 3300; y > 2150; y -= yr(90, 140)) {
      var e = kenar(y), gen = e.sol > 100;
      // iç sıra geçidin kenarına yaslanır (dar boğaz tek bakışta okunsun), dış sıra ekran kenarında
      dekor(sec(['kaya_buyuk_1', 'kaya_buyuk_2', 'kaya_buyuk_3']), gen ? yr(e.sol - 95, e.sol - 55) : yr(10, 120), y, { olcek: yr(0.9, 1.3) });
      dekor(sec(['kaya_buyuk_1', 'kaya_buyuk_2', 'kaya_buyuk_3']), gen ? yr(e.sag + 55, e.sag + 95) : yr(W - 120, W - 10), y - yr(20, 60), { olcek: yr(0.9, 1.3) });
      if (gen && YR() < 0.7) dekor(sec(['kaya_buyuk_1', 'kaya_buyuk_3']), yr(60, e.sol - 170), y - yr(40, 80), { olcek: yr(0.8, 1.2) });
      if (gen && YR() < 0.7) dekor(sec(['kaya_buyuk_2', 'kaya_buyuk_3']), yr(e.sag + 170, W - 60), y - yr(0, 40), { olcek: yr(0.8, 1.2) });
      if (gen && YR() < 0.5) dekor(sec(['kaya_buyuk_1', 'kaya_buyuk_2']), YR() < 0.5 ? yr(10, 90) : yr(W - 90, W - 10), y - 50, { olcek: yr(1.1, 1.5) });
      if (YR() < 0.12) dekor(sec(['agac_olu_1', 'agac_olu_3']), YR() < 0.5 ? yr(20, 200) : yr(1080, 1260), y - 30);
    }
    // --- sakin yürüyüş (1350..2200): ölü ağaçlar, kazıklar, sessizlik
    // kazıklı uyarı hattı: yolun iki kenarında, deve doğru sıklaşan kafatası kazıkları (uğursuz yaklaşım); arkada ölü ağaçlar
    for (y = 2120, t = 0; y > 1330; y -= 150 - t * 6, t++) {
      dekor(t % 2 ? 'kazik_1' : 'kazik_2', yolX(y) - yolYari(y) - yr(10, 30), y, { ayna: false });
      dekor(t % 2 ? 'kazik_2' : 'kazik_1', yolX(y - 40) + yolYari(y - 40) + yr(10, 30), y - 40, { ayna: true });
      if (t % 2 === 0) dekor(sec(['agac_olu_1', 'agac_olu_2', 'agac_olu_3', 'kaya_buyuk_3']), yanX(t % 4 ? 1 : -1, 150), y - 70);
    }
    dekor('araba_kirik', 1120, 1980); dekor('enkaz_yanan_1', 170, 1760);
    dekor('mesale', yolX(1420) - yolYari(1420) - 50, 1420, { ayna: false, zorla: true }); dekor('mesale', yolX(1420) + yolYari(1420) + 50, 1420, { ayna: false, zorla: true });
    // --- devin alanı (0..1350): kenarlarda kaya, kazık halkası, kemikler
    // devin çukurunun kenarında meşaleler önce konur ki kaya/kazık halkası üstüne binmesin
    function cukurSavasAlani(x, y) {
      var ndx = (x - 640) / 390, ndy = (y - 420) / 235;
      return ndx * ndx + ndy * ndy < 1;
    }
    dekor('mesale', 225, 165, { ayna: false, zorla: true }); dekor('mesale', 1055, 165, { ayna: false, zorla: true });
    dekor('mesale', 145, 385, { ayna: false, zorla: true }); dekor('mesale', 1135, 385, { ayna: false, zorla: true });
    dekor('mesale', 165, 625, { ayna: false, zorla: true }); dekor('mesale', 1115, 625, { ayna: false, zorla: true });
    dekor('mesale', 150, 990, { ayna: false, zorla: true }); dekor('mesale', 1130, 990, { ayna: false, zorla: true });
    for (a = 0; a < 6.28; a += 0.32) {
      var dx = DEV_ALANI.cx + Math.cos(a) * yr(560, 640), dy = DEV_ALANI.cy + Math.sin(a) * yr(560, 640) * 0.85;
      if (dy > 1300 || dy < 30 || (dx > 160 && dx < 1120)) continue;
      dekor(YR() < 0.7 ? sec(['kaya_buyuk_1', 'kaya_buyuk_2', 'kaya_buyuk_3']) : sec(['kazik_1', 'kazik_2']), OYUN.sinirla(dx, 10, W - 10), dy, { olcek: yr(1, 1.5) });
    }
    // üst kenar ve yaklaşım yanlarında çukur çerçevesi (orta dövüş dairesi tamamen açık kalır)
    [220, 325, 415, 865, 955, 1060].forEach(function (rx) {
      dekor(YR() < 0.65 ? sec(['kaya_buyuk_1', 'kaya_buyuk_2', 'kaya_buyuk_3']) : sec(['kazik_1', 'kazik_2']), rx + yr(-12, 12), yr(68, 104), { olcek: yr(0.95, 1.25) });
    });
    [780, 885].forEach(function (ry) {
      dekor(YR() < 0.5 ? 'kazik_1' : 'kaya_buyuk_2', yr(115, 220), ry + yr(-15, 15), { olcek: yr(0.95, 1.2) });
      dekor(YR() < 0.5 ? 'kazik_2' : 'kaya_buyuk_1', yr(1060, 1165), ry + yr(-15, 15), { olcek: yr(0.95, 1.2) });
    });
    dekor('kaya_buyuk_2', 120, 120, { olcek: 1.6 }); dekor('kaya_buyuk_1', 1160, 140, { olcek: 1.6 }); dekor('agac_olu_3', 90, 1200); dekor('agac_olu_1', 1200, 1100);

    // --- süsler
    function serp(y1, y2, n, adlar, boyA, boyB, kenarda) {
      for (var i = 0; i < n; i++) {
        var yy = yr(y2, y1), xx;
        if (kenarda === 1) xx = YR() < 0.5 ? yr(0, yolX(yy) - yolYari(yy) + 30) : yr(yolX(yy) + yolYari(yy) - 30, W); // yol dışı
        else if (kenarda === 2) xx = yolX(yy) + yr(-1, 1) * (yolYari(yy) + 20); // yol üstü
        else xx = yr(0, W);
        if (yy > DERE.y1 - 20 && yy < DERE.y2 + 20) continue;
        if (kenarda === 3 && cukurSavasAlani(xx, yy)) continue; // boss dövüş dairesi içi temiz kalsın
        if (adlar[0].indexOf('leke_kul') === 0 && yy > L - H - 100 && Math.abs(xx - 640) < 420) continue; // açılış ekranında belirsiz koyu leke olmasın
        sus(sec(adlar), xx, yy, yr(boyA, boyB), adlar[0].indexOf('leke_kul') === 0 ? yr(0.4, 0.55) : undefined); // kül lekesi yumuşak: hafif tut (zemin bulanık görünmesin)
      }
    }
    var KUL = ['leke_kul_1', 'leke_kul_2', 'leke_kul_3'], TAS = ['tas_1', 'tas_2', 'tas_3', 'tas_4'], KEM = ['kemik_1', 'kemik_2', 'kemik_3'], OT = ['ot_1', 'ot_2', 'ot_3', 'ot_4'];
    serp(9000, 7000, 45, KUL, 140, 240, 0); serp(9000, 7000, 45, TAS, 26, 46, 0); serp(9000, 7000, 60, OT, 50, 80, 1); serp(9000, 7000, 6, KEM, 40, 56, 2);
    serp(7000, 6120, 40, KUL, 150, 260, 0); serp(7000, 6120, 25, TAS, 26, 46, 0); serp(7000, 6120, 12, KEM, 40, 56, 0);
    serp(6120, 4960, 150, OT, 50, 85, 1); serp(6120, 4960, 35, TAS, 24, 42, 0); serp(6120, 4960, 10, KUL, 140, 220, 0);
    serp(4960, 4560, 40, TAS, 26, 50, 0); serp(4960, 4560, 30, OT, 50, 80, 1);
    serp(4560, 3300, 35, KUL, 150, 250, 0); serp(4560, 3300, 45, TAS, 26, 46, 0); serp(4560, 3300, 22, KEM, 40, 56, 0); serp(4560, 3300, 25, OT, 50, 80, 1);
    serp(3300, 2200, 140, TAS, 28, 56, 0); serp(3300, 2200, 12, KEM, 40, 56, 2);
    serp(2200, 1350, 45, OT, 50, 80, 1); serp(2200, 1350, 45, TAS, 26, 46, 0); serp(2200, 1350, 28, KEM, 40, 60, 0); serp(2200, 1350, 10, KUL, 140, 220, 0);
    serp(1350, 0, 34, KEM, 40, 64, 3); serp(1350, 0, 60, TAS, 28, 60, 3); serp(1350, 0, 35, KUL, 160, 280, 0);
    // Kemik Çukuru sınır halkası: kafatası ve kemikler düzenli aralıklarla çukur çevresini sarar
    (function () {
      var kemKonum = [], MIN_K2 = 48 * 48;
      function kemikUygun(x, y) {
        if (x < 35 || x > W - 35 || y < 45 || y > 1240 || cukurSavasAlani(x, y)) return false;
        for (var i = 0; i < kemKonum.length; i++) {
          var dx = kemKonum[i].x - x, dy = kemKonum[i].y - y;
          if (dx * dx + dy * dy < MIN_K2) return false;
        }
        return true;
      }
      for (var ka = 0; ka < 6.28; ka += 0.18) {
        var kx = 640 + Math.cos(ka) * yr(425, 555), ky = 420 + Math.sin(ka) * yr(260, 355);
        if (!kemikUygun(kx, ky)) continue;
        kemKonum.push({ x: kx, y: ky });
        sus(YR() < 0.42 ? 'kemik_3' : sec(['kemik_1', 'kemik_2']), kx, ky, yr(42, 62), yr(0.75, 0.95));
      }
    })();
    // --- büyük zemin yamaları (paket varsa: su birikintisi, tekerlek izi, çamur, kurumuş kan, tahta); dönmez, kendi boyunda
    YR = tohumluRast(9203);
    var YAMA_MIN = { yama_su_: 240, yama_camur_: 240, yama_iz_: 220, yama_tas_: 180, yama_ot_: 160, yama_kan_: 180, yama_tahta_: 180, yama_kul_: 120 };
    var yamaKonum = {};
    function yamaUzak(on, x, y) {
      var minM = YAMA_MIN[on] || 180, liste = yamaKonum[on] || (yamaKonum[on] = []), m2 = minM * minM;
      for (var i = 0; i < liste.length; i++) {
        var dx = liste[i].x - x, dy = liste[i].y - y;
        if (dx * dx + dy * dy < m2) return false;
      }
      return true;
    }
    function yamaSerp(on, y1, y2, n, yer) {
      var adlar = []; for (var i = 1; i <= 6; i++) if (cevreKare(on + i)) adlar.push(on + i);
      if (!adlar.length) return;
      var liste = yamaKonum[on] || (yamaKonum[on] = []);
      for (var j = 0; j < n; j++) {
        var ekle = false, xx = 0, yy = 0;
        for (var den = 0; den < 8; den++) {
          yy = yr(y2, y1);
          if (yy > DERE.y1 - 120 && yy < DERE.y2 + 120) continue;
          if (yer === 'yol') xx = yolX(yy) + yr(-0.7, 0.7) * yolYari(yy);
          else if (yer === 'iz') xx = yolX(yy) + yr(-0.35, 0.35) * yolYari(yy);
          else if (yer === 'kenar') xx = yolX(yy) + (YR() < 0.5 ? -1 : 1) * yolYari(yy) * yr(0.75, 1.15);
          else xx = yr(80, W - 80);
          if (yamaUzak(on, xx, yy)) { ekle = true; break; }
        }
        if (!ekle) continue;
        liste.push({ x: xx, y: yy });
        susler.push({ ad: sec(adlar), x: xx, y: yy, boy: 1, kendi: true, a: 1, r: 0, ayna: on !== 'yama_su_' && YR() < 0.5 });
      }
    }
    yamaSerp('yama_iz_', 6120, 4960, 3, 'iz'); yamaSerp('yama_iz_', 2200, 1350, 2, 'iz');
    yamaSerp('yama_tas_', 6120, 4960, 6, 'yol'); yamaSerp('yama_tas_', 2200, 1350, 6, 'yol');
    yamaSerp('yama_ot_', 9000, 7000, 10, 'kenar'); yamaSerp('yama_ot_', 6120, 4960, 12, 'kenar'); yamaSerp('yama_ot_', 2200, 1350, 8, 'kenar');
    (function () { // yanık ev / enkaz önüne dökülmüş kül
      var adlar = []; for (var i = 1; i <= 4; i++) if (cevreKare('yama_kul_' + i)) adlar.push('yama_kul_' + i);
      if (!adlar.length) return;
      var liste = yamaKonum['yama_kul_'] || (yamaKonum['yama_kul_'] = []);
      BOLUM.atesler.forEach(function (a) {
        if (a.tur === 'mesale' || YR() < 0.35 || (a.y > L - H - 100 && Math.abs(a.x - 640) < 420)) return;
        var kx = a.x + yr(-40, 40), ky = a.y + yr(10, 50);
        if (!yamaUzak('yama_kul_', kx, ky)) return;
        liste.push({ x: kx, y: ky });
        susler.push({ ad: sec(adlar), x: kx, y: ky, boy: 1, kendi: true, a: 1, r: 0, ayna: YR() < 0.5 });
      });
    })();
    yamaSerp('yama_su_', 9000, 7000, 4, 'kenar'); yamaSerp('yama_su_', 6120, 4960, 4, 'yol'); yamaSerp('yama_su_', 4990, 4560, 2, 'kenar'); yamaSerp('yama_su_', 2200, 1350, 2, 'yol');
    yamaSerp('yama_camur_', 9000, 0, 22, 'kenar');
    yamaSerp('yama_kan_', 6900, 6200, 3, 'her'); yamaSerp('yama_kan_', 4560, 3300, 4, 'her'); yamaSerp('yama_kan_', 1350, 0, 7, 'her');
    yamaSerp('yama_tahta_', 9000, 6120, 8, 'her'); yamaSerp('yama_tahta_', 4560, 3300, 4, 'her');
    susler.sort(function (p, q) { return p.y - q.y; });
    dekorlar.sort(function (p, q) { return p.y - q.y; });
    engelKur();
  }

  function yerlesimKur2() {
    YR = tohumluRast(8429);
    susler = []; dekorlar = []; BOLUM.atesler = []; variller = []; kozler = [];
    BOLUM.variller = variller; BOLUM.kozler = kozler;
    var i, y;

    // 1) Maden girişi (7000..9000) – sağ/sol nöbetleşe maden avluları & kalıntılar
    function madenKumesi(taraf, cy, ana, yan1, yan2) {
      var ic = function (dx) { return taraf < 0 ? dx : W - dx; };
      dekor(ana, ic(yr(95, 130)), cy, { olcek: 1.0, ayna: taraf > 0, zorla: true });
      if (yan1) dekor(yan1, ic(yr(215, 250)), cy + yr(55, 85), { olcek: 1.0, ayna: taraf > 0, zorla: true });
      if (yan2) dekor(yan2, ic(yr(190, 240)), cy - yr(90, 125), { olcek: 1.0, zorla: true });
      var my = cy + yr(25, 65);
      dekor('ocak_mangal', yolX(my) + (taraf < 0 ? -1 : 1) * (yolYari(my) + yr(35, 60)), my, { olcek: 1.0, ayna: false, zorla: true });
    }
    madenKumesi(-1, 8820, 'demir_kafes_1', 'bazalt_kaya_1', 'sancak_1');
    madenKumesi(1, 8480, 'maden_vagon', 'bazalt_kaya_2', 'demir_kafes_2');
    madenKumesi(-1, 8080, 'bazalt_sutun', 'sancak_2', 'maden_vagon');
    madenKumesi(1, 7660, 'demir_kafes_2', 'bazalt_kaya_1', 'sancak_1');
    madenKumesi(-1, 7250, 'bazalt_kaya_2', 'demir_kafes_1', 'ocak_mangal');
    dekor('bazalt_kaya_1', 1120, 7220, { olcek: 1.0 });

    // 2) KÜL OVASI – Arena 1 (5950..7000) köşe dekorları
    [[135, 6820, 'bazalt_sutun'], [1145, 6820, 'bazalt_sutun'],
     [115, 6160, 'sancak_1'], [1165, 6160, 'sancak_2'],
     [155, 6670, 'demir_kafes_1'], [1125, 6660, 'maden_vagon'],
     [170, 6290, 'ocak_mangal'], [1110, 6290, 'ocak_mangal'],
     [110, 6020, 'bazalt_kaya_1'], [1170, 6020, 'bazalt_kaya_2']].forEach(function (it) {
      dekor(it[2], it[0], it[1], { olcek: 1.0, ayna: it[0] > 640, zorla: true });
    });

    // 3) Maden yolu (5020..5950)
    madenKumesi(-1, 5720, 'maden_vagon', 'bazalt_kaya_2', 'demir_kafes_1');
    madenKumesi(1, 5340, 'bazalt_sutun', 'maden_vagon', 'sancak_2');
    dekor('bazalt_kaya_1', 165, 5140, { olcek: 1.0, zorla: true });
    dekor('ocak_mangal', 1065, 5120, { olcek: 1.0, zorla: true });

    // 4) Lav Köprüsü dört köşe totemleri (y: 4496..4964, koridor 500..780 dışı)
    [[445, 4965], [835, 4965], [445, 4505], [835, 4505]].forEach(function (pt) {
      dekor('totem_kor', pt[0], pt[1], { olcek: 1.0, ayna: pt[0] > 640, zorla: true });
    });
    dekor('bazalt_kaya_1', 210, 4990, { olcek: 1.0 });
    dekor('bazalt_kaya_2', 1070, 4990, { olcek: 1.0 });
    dekor('sancak_1', 350, 4445, { olcek: 1.0, zorla: true });
    dekor('sancak_2', 930, 4445, { olcek: 1.0, ayna: true, zorla: true });

    // 5) MADEN OCAĞI – Arena 2 (3150..4400) köşe dekorları
    dekor('maden_vagon', 210, 4240, { olcek: 1.0 });
    dekor('demir_kafes_1', 1075, 4220, { olcek: 1.0 });
    [[125, 4020, 'bazalt_sutun'], [1155, 4020, 'bazalt_sutun'],
     [155, 3820, 'maden_vagon'], [1125, 3810, 'demir_kafes_2'],
     [165, 3440, 'ocak_mangal'], [1115, 3440, 'ocak_mangal'],
     [115, 3260, 'sancak_2'], [1165, 3260, 'sancak_1'],
     [230, 3180, 'bazalt_kaya_2'], [1050, 3180, 'bazalt_kaya_1']].forEach(function (it) {
      dekor(it[2], it[0], it[1], { olcek: 1.0, ayna: it[0] > 640, zorla: true });
    });

    // 6) Bazalt geçidi (2250..3050): yan duvar kayaları
    for (y = 2940; y >= 2340; y -= 175) {
      dekor(y % 350 < 175 ? 'bazalt_kaya_1' : 'bazalt_sutun', yr(115, 225), y, { olcek: 1.0, zorla: true });
      dekor(y % 350 < 175 ? 'bazalt_kaya_2' : 'bazalt_sutun', yr(1055, 1165), y - 55, { olcek: 1.0, ayna: true, zorla: true });
    }
    dekor('ocak_mangal', 265, 2630, { olcek: 1.0, zorla: true });
    dekor('ocak_mangal', 1015, 2630, { olcek: 1.0, zorla: true });

    // 7) Sönmeyen Ocak kapısı (y ≈ 1300) ve Boss arenası kenar süsleri
    madenKumesi(-1, 1820, 'demir_kafes_2', 'bazalt_kaya_1', 'sancak_1');
    madenKumesi(1, 1740, 'maden_vagon', 'bazalt_kaya_2', 'totem_kor');
    // Anıtsal Ocak kapısı (y=1300, ortada 520px açık geçit)
    [[370, 1320, 'bazalt_sutun'], [910, 1320, 'bazalt_sutun'],
     [435, 1295, 'totem_kor'], [845, 1295, 'totem_kor'],
     [300, 1305, 'sancak_1'], [980, 1305, 'sancak_2'],
     [155, 1340, 'bazalt_kaya_1'], [1125, 1340, 'bazalt_kaya_2']].forEach(function (it) {
      dekor(it[2], it[0], it[1], { olcek: 1.0, ayna: it[0] > 640, zorla: true });
    });
    // Boss arenası (0..720) dış çerçeve mangal & sütunları
    [[115, 630, 'bazalt_sutun'], [1165, 630, 'bazalt_sutun'],
     [140, 420, 'ocak_mangal'], [1140, 420, 'ocak_mangal'],
     [110, 210, 'totem_kor'], [1170, 210, 'totem_kor'],
     [230, 120, 'sancak_2'], [1050, 120, 'sancak_1']].forEach(function (it) {
      dekor(it[2], it[0], it[1], { olcek: 1.0, ayna: it[0] > 640, zorla: true });
    });

    // 8) 14 adet etkileşimli Yağ Varili (varil_yag)
    [
      [470, 8120], [795, 7450],
      [400, 6680], [500, 6585], [885, 6390],
      [465, 5580],
      [545, 4790], [735, 4675],
      [390, 3860], [490, 3775], [880, 3510],
      [445, 2660], [810, 1950], [270, 480]
    ].forEach(function (pt) {
      dekor('varil_yag', pt[0], pt[1], { olcek: 1.0, ayna: false, zorla: true });
    });

    // 9) 10 adet periyodik Köz Çukuru (koz_cukur_1 / koz_cukur_2)
    [
      ['koz_cukur_1', 460, 7680],
      ['koz_cukur_2', 300, 6530],
      ['koz_cukur_1', 980, 6450],
      ['koz_cukur_2', 795, 5420],
      ['koz_cukur_1', 470, 4150],
      ['koz_cukur_2', 300, 3680],
      ['koz_cukur_1', 980, 3580],
      ['koz_cukur_2', 770, 2780],
      ['koz_cukur_1', 470, 1960],
      ['koz_cukur_2', 990, 490]
    ].forEach(function (kp) {
      dekor(kp[0], kp[1], kp[2], { olcek: 1.0, ayna: false, zorla: true });
    });

    // 10) 2x Zemin süsleri: kül lekeleri, kor parçaları, zincirler, kemikler
    function sus2(ad, x, y, ytBoy, alfa, rot) {
      susler.push({
        ad: ad, x: Math.round(x), y: Math.round(y),
        boy: 1, ytBoy: ytBoy || 90, kendi: true,
        a: alfa === undefined ? yr(0.75, 0.98) : alfa,
        r: rot === undefined ? yr(-3.14, 3.14) : rot,
        ayna: YR() < 0.5
      });
    }
    for (i = 0; i < 42; i++) {
      y = yr(120, L - 160);
      if (y > LAVA_2.y1 - 40 && y < LAVA_2.y2 + 40) continue;
      sus2(YR() < 0.5 ? 'sus_kul_1' : 'sus_kul_2', yr(140, W - 140), y, 165, yr(0.65, 0.92), 0);
    }
    for (i = 0; i < 28; i++) {
      y = yr(180, L - 180);
      if (y > LAVA_2.y1 - 30 && y < LAVA_2.y2 + 30) continue;
      sus2(YR() < 0.5 ? 'sus_kor_1' : 'sus_kor_2', yolX(y) + yr(-310, 310), y, 65, yr(0.75, 0.95));
    }
    for (i = 0; i < 18; i++) {
      y = yr(220, L - 220);
      if (y > LAVA_2.y1 - 30 && y < LAVA_2.y2 + 30) continue;
      sus2('sus_zincir', yolX(y) + (YR() < 0.5 ? -1 : 1) * yr(130, 340), y, 85, yr(0.8, 1));
    }
    for (i = 0; i < 26; i++) {
      y = yr(180, L - 180);
      if (y > LAVA_2.y1 - 30 && y < LAVA_2.y2 + 30) continue;
      sus2(YR() < 0.5 ? 'sus_kemik_1' : 'sus_kemik_2', yolX(y) + yr(-360, 360), y, 56, yr(0.8, 1));
    }

    susler.sort(function (p, q) { return p.y - q.y; });
    dekorlar.sort(function (p, q) { return p.y - q.y; });
    engelKur();
  }

  function yerlesimKur() {
    var b = aktifBolum();
    kuruluBolum = b;
    if (b === 3) {
      YR = tohumluRast(3759);
      susler = []; dekorlar = []; BOLUM.atesler = []; variller = []; kozler = [];
      BOLUM.variller = variller; BOLUM.kozler = kozler;
      AYAZ.yerlesim(dekor, BOLUM.atesler);
      engelKur(); ayazSur = AYAZ.kapiKur(BOLUM.engeller);
      ayazAtisEngelleri.push.apply(ayazAtisEngelleri, ayazSur);
    } else if (b === 2) yerlesimKur2();
    else yerlesimKur1();
  }

  // =====================================================================
  // ZEMİN PARÇALARI (1280×1024 tuval → doku; yalnız ekrana yakın olanlar yaşar)
  // =====================================================================
  var tmpC = null, maskC = null, KAY = 4000;
  // ---- gürültü (dünya koordinatında; parçalar arasında kesintisiz) ----
  function h01(a, b, t) { return hash(a + t * 7919, b - t * 104729) / 4294967296; }
  function gurultu(x, y, olc, t) { // 0..1 yumuşak değer gürültüsü
    var gx = x / olc, gy = y / olc, ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    var a = h01(ix, iy, t), b = h01(ix + 1, iy, t), c = h01(ix, iy + 1, t), d = h01(ix + 1, iy + 1, t);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  function fbm(x, y, olc, t) { return gurultu(x, y, olc, t) * 0.6 + gurultu(x, y, olc * 0.43, t + 3) * 0.28 + gurultu(x, y, olc * 0.17, t + 5) * 0.12; }

  // ---- düzensiz, yumuşak kenarlı yama maskeleri (bir kez üretilir) ----
  var MASKE_P = 384, maskeler = null;
  function maskeleriKur() {
    maskeler = [];
    for (var m = 0; m < 3; m++) {
      var n = 48, kc = tuval(n, n), kg = kc.getContext('2d'), im = kg.createImageData(n, n);
      for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
        var dx = (x + 0.5) / n * 2 - 1, dy = (y + 0.5) / n * 2 - 1, rr = Math.sqrt(dx * dx + dy * dy);
        var g = fbm(x * 9, y * 9, 120, 40 + m * 11) - 0.5;
        var a = 1 - ss(0.72, 0.9, rr + g * 0.6);
        im.data[(y * n + x) * 4 + 3] = Math.round(255 * a);
      }
      kg.putImageData(im, 0, 0);
      var c = tuval(MASKE_P, MASKE_P), g2 = c.getContext('2d');
      g2.imageSmoothingEnabled = true; g2.imageSmoothingQuality = 'high'; g2.drawImage(kc, 0, 0, MASKE_P, MASKE_P);
      maskeler.push(c);
    }
  }
  // tür + çeşit + maske → yumuşak kenarlı, düzensiz biçimli yama (önbellekli)
  var yamaOnbellek = {};
  function yumusakYama(tur, v, m) {
    if (!maskeler) maskeleriKur();
    var k = karoKaynak(tur, v), key = aktifBolum() + ':' + tur + v + '_' + m, y = yamaOnbellek[key];
    if (y && y.src === k.c) return y.c;
    var c = (y && y.c) || tuval(MASKE_P, MASKE_P), g = c.getContext('2d'), S = k.sw;
    g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, MASKE_P, MASKE_P);
    var o = ((v * 97 + m * 53) % S);
    for (var yy = -o; yy < MASKE_P; yy += S) for (var xx = -o; xx < MASKE_P; xx += S) g.drawImage(k.c, k.sx, k.sy, k.sw, k.sh, xx, yy, S, S);
    g.globalCompositeOperation = 'destination-in'; g.drawImage(maskeler[m % maskeler.length], 0, 0);
    g.globalCompositeOperation = 'source-over';
    yamaOnbellek[key] = { src: k.c, c: c };
    return c;
  }
  // ızgaraya hizalı yama (taş/yol): karo fazı (ox, oy) dünya ızgarasıyla aynı; tek geçici tuval
  var hizaliC = null;
  function hizaliYama(tur, v, m, ox, oy) {
    if (!maskeler) maskeleriKur();
    var k = karoKaynak(tur, v), S = k.sw;
    if (!hizaliC) hizaliC = tuval(MASKE_P, MASKE_P);
    var g = hizaliC.getContext('2d');
    g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, MASKE_P, MASKE_P);
    for (var yy = -oy; yy < MASKE_P; yy += S) for (var xx = -ox; xx < MASKE_P; xx += S) g.drawImage(k.c, k.sx, k.sy, k.sw, k.sh, xx, yy, S, S);
    g.globalCompositeOperation = 'destination-in'; g.drawImage(maskeler[m % maskeler.length], 0, 0);
    g.globalCompositeOperation = 'source-over';
    return hizaliC;
  }
  // Döşeme: taban karosu (kendisiyle dikişsiz) + üstüne döndürülmüş/aynalanmış, düzensiz kenarlı çeşit yamaları (iki ölçekte).
  // Karolar tek tek döndürülmez (dikiş yapar); döndürme/aynalama yalnız yumuşak kenarlı yamalarda.
  function dose(g, tur, y0, h, tohum) {
    var tAl = turAl(tur), n = cesitN(tAl), r, c, k = karoKaynak(tur, 0), S = k.sw || KARO;
    tohum = tohum || 0;
    var kx = (tohum * 61) % S; // türler aynı ızgaraya oturmasın
    for (r = Math.floor((y0 - kx) / S); r * S + kx < y0 + h; r++) for (c = -1; c * S - kx < W; c++)
      g.drawImage(k.c, k.sx, k.sy, k.sw, k.sh, c * S - kx, r * S + kx - y0, S, S);
    // iki kat yama: büyük seyrek + küçük sık
    var katlar = [[300, 0.62, 1, 1], [190, 0.5, 1, 1]], izgarali = (tAl === 'tas' || tAl === 'yol' || tAl === 'maden' || tAl === 'bazalt');
    for (var q = 0; q < katlar.length; q++) {
      var A = katlar[q][0], oran = katlar[q][1], o1 = katlar[q][2], o2 = katlar[q][3];
      for (r = Math.floor((y0 - MASKE_P) / A); r * A < y0 + h + MASKE_P; r++) for (c = -1; c <= W / A + 1; c++) {
        var hs = hash(r * 3 + q + tohum * 1000, c * 5 + 77 + q * 31);
        if ((hs % 1000) / 1000 > oran) continue;
        var v = n > 1 ? (hs >>> 8) % n : 0;
        if (v === 0 && n > 1 && q === 0) v = 1;
        var m = (hs >>> 11) % 3, rot = ((hs >>> 14) % 4) * Math.PI / 2, ay = (hs >>> 17) & 1;
        var px = Math.round(c * A + ((hs >>> 18) % A) - A / 2), py = Math.round(r * A + ((hs >>> 22) % A) - A / 2);
        var bo = MASKE_P;
        if (py + bo / 2 < y0 || py - bo / 2 > y0 + h) continue;
        if (izgarali) { // taş/yol: dönme/aynalama yok, karo fazı dünya ızgarasıyla aynı (taşlar üst üste binmesin)
          var sx0 = px - bo / 2, sy0 = py - bo / 2;
          g.drawImage(hizaliYama(tur, v, m, (((sx0 + kx) % S) + S) % S, (((sy0 - kx) % S) + S) % S), sx0, sy0 - y0);
          continue;
        }
        g.save(); g.translate(px, py - y0); g.rotate(rot); g.scale(ay ? -1 : 1, 1);
        g.drawImage(yumusakYama(tur, v, m), -bo / 2, -bo / 2, bo, bo); g.restore();
      }
    }
    g.globalAlpha = 1;
  }
  // Büyük ölçekli ton değişimi: dünya koordinatlı gürültüden düşük çözünürlüklü tuval → yumuşak büyütme.
  // Koyu/aydınlık lekeler + soğuk/ılık renk kayması; parça sınırlarında kesintisiz.
  var TON_A = 16, tonC = null, tonC2 = null;
  function tonKatmani(g, y0, h) {
    var cw = Math.ceil(W / TON_A) + 1, ch = Math.ceil(h / TON_A) + 1;
    if (!tonC) { tonC = tuval(cw, Math.ceil(PARCA / TON_A) + 1); tonC2 = tuval(cw, Math.ceil(PARCA / TON_A) + 1); }
    var tg = tonC.getContext('2d'), tg2 = tonC2.getContext('2d');
    var im = tg.createImageData(cw, ch), im2 = tg2.createImageData(cw, ch), d = im.data, d2 = im2.data;
    for (var j = 0; j < ch; j++) for (var i = 0; i < cw; i++) {
      var wx = i * TON_A, wy = y0 + j * TON_A, p = (j * cw + i) * 4;
      var kar = fbm(wx, wy, 620, 1), ince = gurultu(wx, wy, 150, 9), sic = fbm(wx, wy, 900, 21);
      // çarpma katmanı: 1 = değişmez, düşük = koyu
      var v = 1 - 0.08 * ss(0.38, 0.78, kar) - 0.03 * ss(0.5, 0.9, ince);
      v = Math.max(0.88, Math.min(1, v));
      d[p] = 255 * v; d[p + 1] = 255 * v * (0.985 + 0.02 * sic); d[p + 2] = 255 * v * (0.96 + 0.06 * (1 - sic)); d[p + 3] = 255;
      // renk kayması: ılık (pas/kül) ↔ soğuk (yosun/mavi-gri)
      var a = 0.04 * Math.abs(sic - 0.5) * 2;
      if (sic > 0.5) { d2[p] = 70; d2[p + 1] = 48; d2[p + 2] = 30; } else { d2[p] = 34; d2[p + 1] = 44; d2[p + 2] = 46; }
      d2[p + 3] = Math.round(255 * a);
    }
    tg.putImageData(im, 0, 0); tg2.putImageData(im2, 0, 0);
    g.save(); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.globalCompositeOperation = 'multiply';
    g.drawImage(tonC, 0, 0, cw, ch, -TON_A / 2, -TON_A / 2, cw * TON_A, ch * TON_A);
    g.globalCompositeOperation = 'source-over';
    g.drawImage(tonC2, 0, 0, cw, ch, -TON_A / 2, -TON_A / 2, cw * TON_A, ch * TON_A);
    g.restore();
  }
  // Yol kenarı ot saçağı (paketteki gecis_* şeridi; sol taraf ot, sağ saydam). Yer tutucu modda çizilmez.
  // Kenar gürültüyle girintili-çıkıntılı; şerit çeşidi y'ye göre değişir.
  function sacak(g, y0, h) {
    var ks = []; for (var gi = 1; gi <= 3; gi++) { var kk = tuvalKaynak('gecis_' + gi); if (kk) ks.push(kk); else if (cevreKare('gecis_' + gi)) bekleyenGercek = true; }
    if (!ks.length) return;
    var D = 8;
    for (var y = Math.floor(y0 / D) * D; y < y0 + h; y += D) {
      var a = 1 - Math.max(bant(y, 6170, 6950, 150), bant(y, 3440, 4280, 150), bant(y, 4580, 4980, 120), bant(y, 2150, 3350, 150), bant(y, -500, 1350, 200));
      if (a <= 0.02) continue;
      var xs = yolX(y), yr2 = yolYari(y);
      for (var t = -1; t <= 1; t += 2) {
        var k = ks[Math.floor(gurultu(y, t * 1000, 400, 61) * ks.length * 0.999)];
        var sy = ((y % k.sh) + k.sh) % k.sh, kn = (yolKenarGur(y, t) - 0.5);
        g.globalAlpha = a * (0.75 + 0.25 * gurultu(y, t, 90, 63));
        if (t < 0) g.drawImage(k.c, k.sx, k.sy + sy, k.sw, D, xs - yr2 - 80 + kn * 50, y - y0, k.sw, D);
        else { g.save(); g.translate(xs + yr2 + 80 - kn * 50, 0); g.scale(-1, 1); g.drawImage(k.c, k.sx, k.sy + sy, k.sw, D, 0, y - y0, k.sw, D); g.restore(); }
      }
    }
    g.globalAlpha = 1;
  }
  function maskeliEkle(A, g, tur, y0, h, sekil, blur, alfa, tohum) {
    A.push(function () {
      var tg = tmpC.getContext('2d');
      tg.setTransform(ZEMIN_OLC, 0, 0, ZEMIN_OLC, 0, 0);
      tg.globalCompositeOperation = 'source-over'; tg.globalAlpha = 1; tg.clearRect(0, 0, W, h);
      dose(tg, tur, y0, h, tohum !== undefined ? tohum : (tur === 'camur' ? 17 : 31));
    });
    A.push(function () {
      var tg = tmpC.getContext('2d'), mg = maskC.getContext('2d');
      mg.setTransform(ZEMIN_OLC, 0, 0, ZEMIN_OLC, 0, 0);
      mg.clearRect(0, 0, W, h); mg.save();
      mg.shadowColor = '#000'; mg.shadowBlur = blur * ZEMIN_OLC; mg.shadowOffsetX = KAY * ZEMIN_OLC; mg.shadowOffsetY = 0;
      mg.translate(-KAY, -y0); mg.fillStyle = '#000'; mg.beginPath(); sekil(mg); mg.fill(); mg.restore();
      tg.save(); tg.setTransform(1, 0, 0, 1, 0, 0);
      tg.globalCompositeOperation = 'destination-in'; tg.drawImage(maskC, 0, 0, W * ZEMIN_OLC, h * ZEMIN_OLC, 0, 0, W * ZEMIN_OLC, h * ZEMIN_OLC);
      tg.restore();
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = alfa || 1; g.drawImage(tmpC, 0, 0, W * ZEMIN_OLC, h * ZEMIN_OLC, 0, 0, W * ZEMIN_OLC, h * ZEMIN_OLC);
      g.restore();
    });
  }
  // yol kenarı düzensizliği (−0.5..0.5 civarı, iki yan ayrı)
  function yolKenarGur(y, t) { return fbm(y, t * 5000, 140, 71); }
  function yolSekli(y0, h, daralt) {
    daralt = daralt || 0;
    return function (m) {
      var a = Math.max(0, y0 - 200), b = Math.min(L + 200, y0 + h + 200), y;
      for (y = a; y <= b; y += 10) m.lineTo(yolX(y) - yolYari(y) + daralt + (yolKenarGur(y, -1) - 0.5) * 70, y);
      for (y = b; y >= a; y -= 10) m.lineTo(yolX(y) + yolYari(y) - daralt - (yolKenarGur(y, 1) - 0.5) * 70, y);
      m.closePath();
    };
  }
  function elipsSekli(e, gur) {
    gur = gur || 0.12;
    return function (m) {
      for (var a = 0; a < 6.2832; a += 0.05) {
        var k = 1 + (fbm(Math.cos(a) * 300 + e.cx, Math.sin(a) * 300 + e.cy, 160, 83) - 0.5) * 2 * gur;
        m.lineTo(e.cx + Math.cos(a) * e.rx * k, e.cy + Math.sin(a) * e.ry * k);
      }
      m.closePath();
    };
  }
  function bantSekli(y1, y2) { return function (m) { for (var x = -40; x <= W + 40; x += 20) m.lineTo(x, y1 + 30 * Math.sin(x / 90) + (fbm(x, y1, 120, 91) - 0.5) * 90); for (x = W + 40; x >= -40; x -= 20) m.lineTo(x, y2 + 30 * Math.sin(x / 70 + 1) + (fbm(x, y2, 120, 93) - 0.5) * 90); m.closePath(); }; }
  // dağınık çamur/taş adacıkları (ot içinde çamur, çamur içinde taş): gürültü eşiğinden şekil
  function adacikSekli(y0, h, olc, esik, t, x1, x2) {
    return function (m) {
      var A = 32;
      for (var y = Math.floor((y0 - 100) / A) * A; y < y0 + h + 100; y += A) for (var x = x1; x < x2; x += A) {
        var v = fbm(x, y, olc, t); if (v < esik) continue;
        var rr = A * (0.55 + (v - esik) * 3.5);
        m.moveTo(x + rr, y); m.ellipse(x, y, rr, rr * 0.8, 0, 0, 6.2832);
      }
    };
  }
  function ortusur(y0, h, a, b) { return b > y0 - 300 && a < y0 + h + 300; }
  function yolBolgesi(y) { return y > 6050 || (y > 3300 && y < 4560); } // köy/meydan/kilise: arnavut kaldırımı yol (paket varsa)

  function kopruDetay(g, bx, by, bw, bh, R) {
    var adim = 18, nPlank = Math.floor((bh - 8) / adim);
    // ahşap tahta damarları ve demir çivi başları
    for (var p = 0; p < nPlank; p++) {
      var py = by + 4 + p * adim, ph = 15;
      var xL = bx + 11, xR = bx + bw - 11;
      // ince ahşap damar çizgileri
      for (var d = 0; d < 3; d++) {
        var gy = py + 3 + d * 4.2 + (R() - 0.5) * 1.4;
        var gx1 = xL + R() * 14, gx2 = xR - R() * 14, midX = (gx1 + gx2) * 0.5 + (R() - 0.5) * 28;
        g.strokeStyle = d === 1 ? 'rgba(165,132,98,0.14)' : 'rgba(12,8,5,0.48)';
        g.lineWidth = 0.75;
        g.beginPath(); g.moveTo(gx1, gy); g.quadraticCurveTo(midX, gy + (R() - 0.5) * 2.4, gx2, gy + (R() - 0.5) * 1.2); g.stroke();
      }
      // demir çivi başları (her tahtanın iki ucunda ikişer çivi)
      var civiX = [xL + 5 + (R() - 0.5) * 2, xR - 5 + (R() - 0.5) * 2];
      for (var cxI = 0; cxI < 2; cxI++) {
        for (var cyI = 0; cyI < 2; cyI++) {
          var nx = civiX[cxI] + (cyI ? 0.8 : -0.6), ny = py + (cyI ? ph - 3.8 : 3.8) + (R() - 0.5) * 0.8;
          g.fillStyle = '#0a0807'; g.beginPath(); g.arc(nx, ny, 1.6, 0, 6.2832); g.fill();
          g.fillStyle = '#464340'; g.beginPath(); g.arc(nx, ny, 1.1, 0, 6.2832); g.fill();
          g.fillStyle = 'rgba(215,220,225,0.38)'; g.beginPath(); g.arc(nx - 0.35, ny - 0.35, 0.45, 0, 6.2832); g.fill();
        }
      }
    }
    // yıpranmış taş korkuluk kenarları
    var tasRenk = ['#3b3834', '#33302c', '#423e39', '#2c2926'], pw = 14;
    [bx - 10, bx + bw - 4].forEach(function (px, yan) {
      var sy = by - 6, sonY = by + bh + 6, ti = yan * 2;
      while (sy < sonY) {
        var th = Math.min(22 + Math.floor(R() * 9), sonY - sy);
        if (th < 8) th = sonY - sy;
        g.fillStyle = tasRenk[ti % tasRenk.length];
        g.fillRect(px, sy, pw, th);
        // harç derzi + üst-sol pah ışığı + alt-sağ gölge
        g.strokeStyle = 'rgba(10,9,8,0.85)'; g.lineWidth = 1.1;
        g.strokeRect(px + 0.5, sy + 0.5, pw - 1, th - 1);
        g.strokeStyle = 'rgba(205,198,186,0.22)'; g.lineWidth = 0.9;
        g.beginPath(); g.moveTo(px + 1.5, sy + th - 1.5); g.lineTo(px + 1.5, sy + 1.5); g.lineTo(px + pw - 1.5, sy + 1.5); g.stroke();
        g.strokeStyle = 'rgba(8,7,6,0.65)'; g.lineWidth = 1.1;
        g.beginPath(); g.moveTo(px + pw - 1.5, sy + 1.5); g.lineTo(px + pw - 1.5, sy + th - 1.5); g.lineTo(px + 1.5, sy + th - 1.5); g.stroke();
        if (R() < 0.45) {
          g.strokeStyle = 'rgba(12,10,9,0.45)'; g.lineWidth = 0.75;
          g.beginPath(); g.moveTo(px + 3, sy + th * 0.35); g.lineTo(px + pw * 0.55, sy + th * 0.52); g.lineTo(px + pw - 3, sy + th * 0.45); g.stroke();
        }
        if (sy > by + 35 && sy < by + bh - 45 && R() < 0.55) {
          g.fillStyle = 'rgba(38,48,34,0.18)'; g.fillRect(px + 2, sy + 2, pw - 4, th * 0.45);
        }
        sy += th; ti++;
      }
    });
    // dört köşe taş babaları
    [bx - 12, bx + bw - 6].forEach(function (px) {
      [by - 10, by + bh - 12].forEach(function (py) {
        g.fillStyle = '#383430'; g.fillRect(px, py, 18, 22);
        g.strokeStyle = 'rgba(10,9,8,0.9)'; g.lineWidth = 1.3; g.strokeRect(px + 0.5, py + 0.5, 17, 21);
        g.strokeStyle = 'rgba(210,202,190,0.24)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(px + 2, py + 19); g.lineTo(px + 2, py + 2); g.lineTo(px + 16, py + 2); g.stroke();
      });
    });
  }

  function kopruCiz(g, y0, R) {
    var bx = KOPRU.x1, bw = KOPRU.x2 - KOPRU.x1, by = KOPRU.y1 - y0, bh = KOPRU.y2 - KOPRU.y1;
    // köprü altı ince su gölgesi (su yüzeyine derinlik ve kemer altı karartması)
    var sy1 = DERE.y1 - y0 - 4, sy2 = DERE.y2 - y0 + 18;
    var sg = g.createLinearGradient(0, sy1, 0, sy2);
    sg.addColorStop(0, 'rgba(4,6,8,0.44)');
    sg.addColorStop(0.55, 'rgba(4,6,8,0.28)');
    sg.addColorStop(1, 'rgba(4,6,8,0.10)');
    g.fillStyle = sg;
    g.fillRect(bx - 16, sy1, bw + 32, sy2 - sy1);
    g.fillStyle = 'rgba(3,5,7,0.34)';
    g.fillRect(bx - 10, sy1, 22, sy2 - sy1 - 8);
    g.fillRect(bx + bw - 12, sy1, 22, sy2 - sy1 - 8);

    var k = tuvalKaynak('kopru');
    if (k) { // paket köprüsü 573 geniş: yürüme yoluna sığsın diye yatayda daralt, boyu koru
      var kw = bw + 70, kh = Math.max(bh + 20, k.sh);
      g.save(); g.shadowColor = 'rgba(0,0,0,0.7)'; g.shadowBlur = 20 * ZEMIN_OLC; g.shadowOffsetY = 10 * ZEMIN_OLC;
      g.drawImage(k.c, k.sx, k.sy, k.sw, k.sh, 640 - kw / 2, (KOPRU.y1 + KOPRU.y2) / 2 - kh / 2 - y0, kw, kh); g.restore();
    } else {
      if (cevreKare('kopru')) bekleyenGercek = true;
      g.fillStyle = 'rgba(0,0,0,0.52)'; g.fillRect(bx - 8, by + 8, bw + 16, bh);
      var adim = 18, nPlank = Math.floor((bh - 8) / adim), tahtaRenk = ['#2e2117', '#35261b', '#271c14', '#3a2a1e'];
      for (var p = 0; p < nPlank; p++) {
        var o = (R() - 0.5) * 4, py = by + 4 + p * adim;
        g.fillStyle = tahtaRenk[p % tahtaRenk.length];
        g.fillRect(bx + 6 + o, py, bw - 12, 15);
        g.strokeStyle = '#0d0906'; g.lineWidth = 1.4;
        g.strokeRect(bx + 6 + o, py, bw - 12, 15);
        g.strokeStyle = 'rgba(190,158,120,0.16)'; g.lineWidth = 0.8;
        g.beginPath(); g.moveTo(bx + 8 + o, py + 1); g.lineTo(bx + bw - 8 + o, py + 1); g.stroke();
      }
      kopruDetay(g, bx, by, bw, bh, R);
    }
  }

  function dereCiz(g, y0, h) {
    if (!ortusur(y0, h, DERE.y1 - 60, DERE.y2 + 60)) return;
    var R = tohumluRast(99), x;
    function kenarY(x, alt) { return (alt ? DERE.y2 : DERE.y1) + 9 * Math.sin(x / 61 + (alt ? 2 : 0)) + 5 * Math.sin(x / 23) - y0; }
    // kıyı çamuru
    g.save(); g.shadowColor = 'rgba(12,9,6,0.9)'; g.shadowBlur = 30 * ZEMIN_OLC; g.fillStyle = 'rgba(20,15,11,0.85)';
    g.beginPath(); for (x = -20; x <= W + 20; x += 20) g.lineTo(x, kenarY(x, false) - 18); for (x = W + 20; x >= -20; x -= 20) g.lineTo(x, kenarY(x, true) + 18); g.closePath(); g.fill(); g.restore();
    // Birbirini örten boyalı akıntı bantları; dünya koordinatında sabit.
    var su = tohumluRast(1381), orta = (DERE.y1 + DERE.y2) / 2 - y0;
    var gr = g.createLinearGradient(0, DERE.y1 - y0, 0, DERE.y2 - y0);
    gr.addColorStop(0, '#10171a'); gr.addColorStop(0.27, '#223133');
    gr.addColorStop(0.53, '#263c3d'); gr.addColorStop(0.82, '#1e2f32'); gr.addColorStop(1, '#11191a');
    g.save();
    g.beginPath();
    for (x = -20; x <= W + 20; x += 20) g.lineTo(x, kenarY(x, false));
    for (x = W + 20; x >= -20; x -= 20) g.lineTo(x, kenarY(x, true));
    g.closePath(); g.clip();
    g.fillStyle = gr; g.fillRect(-20, DERE.y1 - y0 - 20, W + 40, DERE.y2 - DERE.y1 + 40);
    var tonlar = ['rgba(105,140,135,.15)', 'rgba(86,115,112,.19)', 'rgba(9,24,27,.23)', 'rgba(160,155,120,.12)'];
    for (var i = 0; i < 110; i++) {
      var rx = su() * (W + 180) - 100, ry = orta + (su()-.5)*169;
      var uzun = 34 + su()*129, egim = (su()-.5)*13, gen = 2 + su()*9;
      g.fillStyle = tonlar[i%tonlar.length];
      g.beginPath(); g.moveTo(rx,ry);
      g.bezierCurveTo(rx+uzun*.28,ry-gen,rx+uzun*.67,ry+egim-gen*.60,rx+uzun,ry+egim);
      g.bezierCurveTo(rx+uzun*.72,ry+egim+gen*.17,rx+uzun*.33,ry+gen*.04,rx,ry);
      g.fill();
    }
    for (var k = 0; k < 13; k++) {
      var cx = 42 + su() * (W - 84);
      if (cx > KOPRU.x1-36 && cx < KOPRU.x2+36) continue;
      var alt = k%2 === 0, cy = kenarY(cx, alt) + (alt ? -1 : 1)*(4+su()*15);
      var en = 4+su()*9, boy = 2+su()*4;
      g.fillStyle = '#172326'; g.beginPath();
      g.moveTo(cx-en,cy+boy*.4); g.lineTo(cx-en*.63,cy-boy);
      g.lineTo(cx+en*.4,cy-boy*.8); g.lineTo(cx+en,cy+boy*.26);
      g.lineTo(cx+en*.46,cy+boy); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(126,142,133,.43)'; g.lineWidth = 1.15;
      g.beginPath(); g.moveTo(cx-en*.67,cy-boy*.26); g.lineTo(cx-en*.41,cy-boy*.72);
      g.lineTo(cx+en*.36,cy-boy*.55); g.stroke();
      g.strokeStyle = 'rgba(154,176,159,.22)';
      g.beginPath(); g.moveTo(cx-en*1.55,cy+boy*.78);
      g.quadraticCurveTo(cx,cy+boy*2.7,cx+en*2.28,cy+boy*.87); g.stroke();
    }
    g.restore();
    kopruCiz(g, y0, R);
  }

  function kopruCiz2(g, y0, R) {
    var bx = KOPRU_2.x1, bw = KOPRU_2.x2 - KOPRU_2.x1, by = KOPRU_2.y1 - y0, bh = KOPRU_2.y2 - KOPRU_2.y1;
    // Lav üzerine düşen ağır demir köprü gölgesi
    g.fillStyle = 'rgba(0,0,0,0.62)';
    g.fillRect(bx - 12, by + 10, bw + 24, bh);

    // maden_0 / maden_1 metal döşeme
    var m0 = tuvalKaynak('maden_0'), m1 = tuvalKaynak('maden_1') || m0;
    g.save();
    g.beginPath(); g.rect(bx, by, bw, bh); g.clip();
    if (m0) {
      var S = m0.sw || 512, ds = 256, pi = 0;
      for (var py = by; py < by + bh; py += ds) for (var px = bx; px < bx + bw; px += ds) {
        var tk = (pi++ % 3 === 1 && m1) ? m1 : m0;
        g.drawImage(tk.c, tk.sx, tk.sy, tk.sw, tk.sh, px, py, ds, ds);
      }
    } else {
      if (cevreKare('maden_0')) bekleyenGercek = true;
      g.fillStyle = '#25211e'; g.fillRect(bx, by, bw, bh);
    }
    // Lavın kavurduğu uçlar ve eski demir yamalar döşemenin içine çizilir.
    var damar = tohumluRast(4712);
    [bx, bx + bw].forEach(function (x, taraf) {
      var yon = taraf ? -1 : 1, is = g.createLinearGradient(x, 0, x + yon * 75, 0);
      is.addColorStop(0, 'rgba(18,12,14,.86)');
      is.addColorStop(.43, 'rgba(32,17,14,.43)');
      is.addColorStop(1, 'rgba(42,24,18,0)');
      g.fillStyle = is;
      g.fillRect(taraf ? x - 75 : x, by, 75, bh);
      for (var i = 0; i < 70; i++) {
        var y = by + damar() * bh, bas = x + yon * (6 + damar() * 68), en = 8 + damar() * 46;
        g.beginPath(); g.moveTo(bas, y);
        g.quadraticCurveTo(bas + yon * en * .38, y - 2, bas + yon * en, y + (damar() - .5) * 4);
        g.strokeStyle = i % 4 ? 'rgba(31,21,18,.48)' : 'rgba(197,124,81,.28)';
        g.lineWidth = .6 + damar() * 2; g.stroke();
      }
    });
    [[53,73,73,-.19], [231,161,104,.10], [78,329,96,.13], [249,403,75,-.11]].forEach(function (p) {
      g.save(); g.translate(bx + p[0], by + p[1]); g.rotate(p[3]);
      var en = p[2], metal = g.createLinearGradient(0, -12, 0, 12);
      metal.addColorStop(0, '#6b5952'); metal.addColorStop(.22, '#4d4443'); metal.addColorStop(1, '#262126');
      g.beginPath();
      g.moveTo(-en / 2, -9); g.lineTo(-en / 2 + 7, -13); g.lineTo(en / 2 - 5, -11);
      g.lineTo(en / 2, -5); g.lineTo(en / 2 - 3, 8); g.lineTo(en / 2 - 10, 12);
      g.lineTo(-en / 2 + 6, 10); g.closePath();
      g.strokeStyle = '#21181a'; g.lineWidth = 3; g.stroke();
      g.fillStyle = metal; g.fill();
      for (var i = 0; i < 11; i++) {
        var x = (damar() - .5) * (en - 22), y = (damar() - .5) * 15;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + 3 + damar() * 7, y - 2);
        g.strokeStyle = 'rgba(166,144,126,.35)'; g.lineWidth = .85; g.stroke();
      }
      [-en / 2 + 11, en / 2 - 11].forEach(function (x) {
        g.beginPath(); g.arc(x, 0, 3.9, 0, Math.PI * 2); g.fillStyle = '#272023'; g.fill();
        g.beginPath(); g.arc(x - .4, -.65, 2.2, 0, Math.PI * 2); g.fillStyle = '#968074'; g.fill();
      });
      g.restore();
    });

    // Demir kirişler & perçinli geçiş plakaları
    g.strokeStyle = 'rgba(10,8,7,0.7)'; g.lineWidth = 2;
    for (var sy = by + 22; sy < by + bh; sy += 36) {
      g.beginPath(); g.moveTo(bx, sy); g.lineTo(bx + bw, sy); g.stroke();
      g.strokeStyle = 'rgba(195,165,130,0.12)';
      g.beginPath(); g.moveTo(bx, sy + 2); g.lineTo(bx + bw, sy + 2); g.stroke();
      g.strokeStyle = 'rgba(10,8,7,0.7)';
    }
    g.restore();

    // Isınmış dövme korkuluk: paneller, bindirme, perçin ve lav alan kenar.
    var firca = tohumluRast(4612), genislik = 21;
    [bx - 8, bx + bw - 13].forEach(function (rx, taraf) {
      var dis = taraf ? -1 : 1;
      g.fillStyle = '#0e0a0b';
      g.fillRect(rx-3, by-5, genislik+6, bh+10);
      for (var ry = by-4, i = 0; ry < by+bh+4; ry += 43, i++) {
        var boy = Math.min(42, by+bh+5-ry);
        var dar = 2+firca()*2, egim = (firca()-.5)*3;
        g.fillStyle = ['#353239', '#403439', '#312e35'][i%3];
        g.beginPath(); g.moveTo(rx+dar,ry);
        g.lineTo(rx+genislik-2,ry+1); g.lineTo(rx+genislik-1+egim,ry+boy-3);
        g.lineTo(rx+2,ry+boy); g.lineTo(rx-1,ry+3); g.closePath(); g.fill();
        g.fillStyle = 'rgba(15,13,16,.53)';
        g.beginPath(); g.moveTo(rx+genislik-3,ry+1); g.lineTo(rx+genislik-1+egim,ry+boy-3);
        g.lineTo(rx+genislik-6,ry+boy-1); g.lineTo(rx+genislik-7,ry+4); g.fill();
        g.strokeStyle = 'rgba(174,102,73,.42)'; g.lineWidth = 1.7;
        var kizgin = rx+(dis>0 ? 1.8 : genislik-1.9);
        g.beginPath(); g.moveTo(kizgin,ry+4); g.lineTo(kizgin+egim*.6,ry+boy-5); g.stroke();
        // Döküm çizikleri parça üzerinde farklı uzunlukta ve yönde kalır.
        g.strokeStyle = 'rgba(181,167,155,.18)'; g.lineWidth = .9;
        for (var f = 0; f < 4; f++) {
          var xx = rx+4+firca()*(genislik-9), yy = ry+4+firca()*Math.max(0,boy-8);
          g.beginPath(); g.moveTo(xx,yy); g.lineTo(xx+(firca()-.5)*6,yy+Math.min(ry+boy-yy,3+firca()*8)); g.stroke();
        }
        [5,boy-6].forEach(function (u) {
          if (boy < 15) return;
          var px = rx+genislik*.49, py = ry+u;
          g.fillStyle = '#211b20'; g.beginPath(); g.arc(px,py,2.6,0,Math.PI*2); g.fill();
          g.fillStyle = '#6d5c58'; g.beginPath(); g.arc(px-.5,py-.55,1.25,0,Math.PI*2); g.fill();
        });
      }
    });
    // Köprü ayaklarının sıkıştığı, çatlamış bazalt kaideler.
    [bx - 7, bx + bw - 15].forEach(function (px) {
      [by - 8, by + bh - 12].forEach(function (py) {
        g.fillStyle = '#171318'; g.beginPath(); g.moveTo(px-7,py+5); g.lineTo(px+3,py-7);
        g.lineTo(px+18,py-9); g.lineTo(px+29,py+4); g.lineTo(px+26,py+22);
        g.lineTo(px+11,py+28); g.lineTo(px-6,py+20); g.closePath(); g.fill();
        g.fillStyle = '#42373d'; g.beginPath(); g.moveTo(px-4,py+3); g.lineTo(px+4,py-4);
        g.lineTo(px+18,py-6); g.lineTo(px+25,py+3); g.lineTo(px+18,py+12); g.lineTo(px+2,py+13); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(144,116,111,.37)'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(px+2,py+10); g.lineTo(px+7,py+3); g.lineTo(px+5,py-3);
        g.moveTo(px+7,py+3); g.lineTo(px+17,py+2); g.stroke();
      });
    });
  }

  function lavCiz(g, y0, h) {
    if (!ortusur(y0, h, LAVA_2.y1 - 80, LAVA_2.y2 + 80)) return;
    var R = tohumluRast(187), x;
    function kenarY(x, alt) { return (alt ? LAVA_2.y2 : LAVA_2.y1) + 12 * Math.sin(x / 58 + (alt ? 1.8 : 0)) + 6 * Math.sin(x / 21) - y0; }
    // Kavrulmuş kıyı uçurum gölgesi
    g.save();
    g.shadowColor = 'rgba(255,80,15,0.45)'; g.shadowBlur = 24 * ZEMIN_OLC;
    g.fillStyle = '#120d0e';
    g.beginPath(); for (x = -20; x <= W + 20; x += 20) g.lineTo(x, kenarY(x, false) - 22); for (x = W + 20; x >= -20; x -= 20) g.lineTo(x, kenarY(x, true) + 22); g.closePath(); g.fill();
    g.restore();

    // Magma yarığı: önce kor gradyan, üstüne lav_kenar karosu (varsa)
    g.save();
    g.beginPath(); for (x = -20; x <= W + 20; x += 20) g.lineTo(x, kenarY(x, false)); for (x = W + 20; x >= -20; x -= 20) g.lineTo(x, kenarY(x, true)); g.closePath(); g.clip();
    var lgr = g.createLinearGradient(0, LAVA_2.y1 - y0, 0, LAVA_2.y2 - y0);
    lgr.addColorStop(0, '#4f1508'); lgr.addColorStop(0.25, '#a8330c'); lgr.addColorStop(0.5, '#eb6816'); lgr.addColorStop(0.75, '#b8370c'); lgr.addColorStop(1, '#441207');
    g.fillStyle = lgr; g.fillRect(-20, LAVA_2.y1 - y0 - 25, W + 40, LAVA_2.y2 - LAVA_2.y1 + 50);
    var lk = tuvalKaynak('lav_kenar');
    if (lk) {
      var S = 256;
      g.globalAlpha = 0.88;
      for (var ly = Math.floor((LAVA_2.y1 - 30) / S) * S; ly < LAVA_2.y2 + 30; ly += S) {
        for (var lx = 0; lx < W; lx += S) g.drawImage(lk.c, lk.sx, lk.sy, lk.sw, lk.sh, lx, ly - y0, S, S);
      }
      g.globalAlpha = 1;
    } else if (cevreKare('lav_kenar')) {
      bekleyenGercek = true;
    }
    // Kızgın çatlak parıltıları & uçurum kenarı çizgisi
    g.strokeStyle = 'rgba(255,190,70,0.28)'; g.lineWidth = 3;
    for (var i = 0; i < 42; i++) {
      var rx = R() * W, ry = LAVA_2.y1 + 20 + R() * (LAVA_2.y2 - LAVA_2.y1 - 40) - y0, rl = 35 + R() * 85;
      g.beginPath(); g.moveTo(rx, ry); g.quadraticCurveTo(rx + rl * 0.5, ry + (R() - 0.5) * 18, rx + rl, ry + (R() - 0.5) * 8); g.stroke();
    }
    g.restore();

    // Kıyı kayalık sınırı çizgisi (köprü dışı geçişlerin kapalı olduğunu net gösterir)
    g.strokeStyle = 'rgba(255,110,25,0.45)'; g.lineWidth = 4;
    g.beginPath(); for (x = -20; x <= W + 20; x += 20) g.lineTo(x, kenarY(x, false)); g.stroke();
    g.beginPath(); for (x = -20; x <= W + 20; x += 20) g.lineTo(x, kenarY(x, true)); g.stroke();

    // Nehrin dışında kalan yığılmış bazalt. Göz hizasındaki ince kenarlar lavı tutar.
    var kirik = tohumluRast(4593);
    for (var yan = 0; yan < 2; yan++) for (var n = 0; n < 29; n++) {
      var rx = 16 + n * 44 + kirik() * 22;
      var ry = kenarY(rx, !!yan) + (yan ? 1 : -1) * (16 + kirik() * 32);
      var en = 8 + kirik() * 15, boy = 3 + kirik() * 7;
      if (rx + en > KOPRU_2.x1 - 20 && rx - en < KOPRU_2.x2 + 20) continue;
      g.beginPath(); g.moveTo(rx - en, ry + boy * .28);
      g.lineTo(rx - en * .63, ry - boy * .73); g.lineTo(rx + en * .15, ry - boy);
      g.lineTo(rx + en, ry - boy * .2); g.lineTo(rx + en * .64, ry + boy);
      g.lineTo(rx - en * .56, ry + boy * .89); g.closePath();
      g.fillStyle = n % 3 ? '#322829' : '#443031'; g.fill();
      g.strokeStyle = 'rgba(28,18,20,.80)'; g.lineWidth = 1.7; g.stroke();
      g.beginPath(); g.moveTo(rx - en * .75, ry + (yan ? -1 : 1) * boy * .45);
      g.lineTo(rx - en * .18, ry + (yan ? -1 : 1) * boy * .78);
      g.lineTo(rx + en * .65, ry + (yan ? -1 : 1) * boy * .52);
      g.strokeStyle = 'rgba(183,100,70,.42)'; g.lineWidth = 1.25; g.stroke();
    }
    kopruCiz2(g, y0, R);
  }

  // Yerleşik yapıların dibindeki izler, aynı zemin dokusuna bir kez işlenir.
  function yanikYapiIzleri(g, y0, h) {
    for (var d of dekorlar) {
      if (d.y + 143 < y0 || d.y - 38 > y0 + h) continue;
      var kilise = d.ad === 'kilise_yikik';
      if (!kilise && !d.ad.startsWith('ev_yanik')) continue;
      var rast = tohumluRast(d.x * 31 + d.y * 9);
      var en = kilise ? 144 : 108, yon = d.x < W / 2 ? 1 : -1;
      var x = d.x + yon * (kilise ? 69 : 90), y = d.y - y0 + 22;
      g.save(); g.translate(x, y); g.scale(1, .54);
      var is = g.createRadialGradient(0, 0, 0, 0, 0, en);
      is.addColorStop(0, 'rgba(33,26,23,.71)');
      is.addColorStop(.57, 'rgba(40,31,27,.57)');
      is.addColorStop(1, 'rgba(41,29,25,0)');
      g.fillStyle = is; g.fillRect(-en, -en, en * 2, en * 2);
      g.restore();
      for (var i = 0; i < 38; i++) {
        var u = (rast() - .5) * en * 1.6 + yon * (i % 3 ? 0 : 51), v = 7 + rast() * 93;
        var yikik = i % 9 === 0;
        var w = 2 + rast() * 8 + (yikik ? 10 : 0), boy = 1.5 + rast() * 5 + (yikik ? 3 : 0);
        g.save(); g.translate(x + u, y + v); g.rotate((rast() - .5) * 2.2);
        g.beginPath(); g.moveTo(-w, -boy * .24); g.lineTo(-w * .46, -boy);
        g.lineTo(w * .54, -boy * .75); g.lineTo(w, boy * .14);
        g.lineTo(w * .29, boy); g.lineTo(-w * .77, boy * .66); g.closePath();
        g.fillStyle = kilise ? (i % 3 ? '#514a40' : '#645d4d') : (i % 3 ? '#43352b' : '#694837');
        g.fill(); g.strokeStyle = 'rgba(26,23,20,.74)'; g.lineWidth = 1.4; g.stroke();
        g.beginPath(); g.moveTo(-w * .69, -boy * .24);
        g.lineTo(-w * .38, -boy * .72); g.lineTo(w * .36, -boy * .52);
        g.strokeStyle = kilise ? 'rgba(154,148,128,.42)' : (yikik ? 'rgba(174,125,92,.62)' : 'rgba(165,119,83,.43)');
        g.lineWidth = .8; g.stroke();
        g.restore();
      }
    }
  }

  function madenVagonIzleri(g, y0, h) {
    for (var d of dekorlar) {
      if (d.ad !== 'maden_vagon' || d.y + 35 < y0 || d.y - 35 > y0 + h) continue;
      var rast = tohumluRast(d.y * 5 + d.x * 19);
      var sagda = d.x > W / 2, x = d.x + (sagda ? -28 : 28), y = d.y - y0 + 1;
      // Vagon resmi rayı yandan gösterir; raylar tekerlerin hizasında yatay uzanır.
      g.save(); g.translate(x, y); g.rotate(sagda ? Math.PI / 2 + .04 : -Math.PI / 2 - .04); g.scale(.38, 1);
      var toz = g.createLinearGradient(0, 0, 0, 131);
      toz.addColorStop(0, 'rgba(28,22,24,.58)');
      toz.addColorStop(.66, 'rgba(32,25,29,.36)');
      toz.addColorStop(1, 'rgba(32,25,29,0)');
      g.fillStyle = toz; g.fillRect(-42, -12, 84, 145);
      for (var i = 0; i < 7; i++) {
        var yy = 17 + 15 * i, ters = (rast() - .5) * 8;
        g.beginPath(); g.moveTo(-41, yy); g.lineTo(39, yy + ters);
        g.strokeStyle = 'rgba(29,22,24,.78)'; g.lineWidth = 8; g.stroke();
        g.beginPath(); g.moveTo(-37, yy - 2); g.lineTo(36, yy + ters - 2);
        g.strokeStyle = 'rgba(99,76,65,.62)'; g.lineWidth = 2; g.stroke();
      }
      [-27, 27].forEach(function (dx) {
        g.beginPath(); g.moveTo(dx, -14); g.lineTo(dx, 113);
        g.strokeStyle = '#2c2427'; g.lineWidth = 7; g.stroke();
        g.beginPath(); g.moveTo(dx - 1, -14); g.lineTo(dx - 1, 108);
        g.strokeStyle = '#796b66'; g.lineWidth = 2.25; g.stroke();
        for (var j = 0; j < 6; j++) {
          g.fillStyle = '#47393a'; g.fillRect(dx - 5, 14 + j * 15, 10, 3);
          g.fillStyle = '#a98b73'; g.fillRect(dx - 4, 14 + j * 15, 2, 1);
        }
      });
      for (var j = 0; j < 19; j++) {
        var px = (rast() - .5) * 122, py = rast() * 110, r = 2 + rast() * 4;
        g.beginPath(); g.moveTo(px - r, py); g.lineTo(px, py - r * .7);
        g.lineTo(px + r, py - r * .18); g.lineTo(px + r * .18, py + r * .65); g.closePath();
        g.fillStyle = j % 4 ? '#343037' : '#504743'; g.fill();
      }
      g.restore();
    }
  }

  function parcaIs2(i) {
    var y0 = i * PARCA, h = Math.min(PARCA, L - y0);
    var c = tuval(W * ZEMIN_OLC, h * ZEMIN_OLC), g = c.getContext('2d');
    g.setTransform(ZEMIN_OLC, 0, 0, ZEMIN_OLC, 0, 0);
    if (!tmpC) { tmpC = tuval(W * ZEMIN_OLC, PARCA * ZEMIN_OLC); maskC = tuval(W * ZEMIN_OLC, PARCA * ZEMIN_OLC); }
    var A = [];
    // 1. Taban: kül ovası
    A.push(function () { dose(g, 'kul', y0, h, 0); });
    maskeliEkle(A, g, 'bazalt', y0, h, adacikSekli(y0, h, 270, 0.58, 7, -40, W + 40), 20, 1, 29);
    // 2. Maden yolu (maden_0/1 orta şerit) ve Bazalt geçidi (2200..3080)
    if (ortusur(y0, h, 2200, 3100)) maskeliEkle(A, g, 'bazalt', y0, h, bantSekli(2280, 3040), 24, 1);
    maskeliEkle(A, g, 'maden', y0, h, yolSekli(y0, h, 20), 22, 0.92, 41);
    // 3. Arenalar (Kül Ovası & Maden Ocağı) + Sönmeyen Ocak Boss Alanı
    MEYDANLAR_2.forEach(function (e, idx) {
      if (ortusur(y0, h, e.cy - e.ry, e.cy + e.ry)) {
        maskeliEkle(A, g, idx === 0 ? 'bazalt' : 'maden', y0, h, elipsSekli(e, 0.11), 24, 1, 53 + idx * 17);
      }
    });
    if (ortusur(y0, h, 0, VARGOR_ALANI.cy + VARGOR_ALANI.ry)) maskeliEkle(A, g, 'bazalt', y0, h, elipsSekli(VARGOR_ALANI, 0.14), 26, 1, 61);
    if (ortusur(y0, h, 3150, 4150) || ortusur(y0, h, 5950, 6950))
      maskeliEkle(A, g, 'kul', y0, h, adacikSekli(y0, h, 150, 0.72, 33, 0, W), 18, 0.85, 47);
    // 4. Lav Nehri + Maden Köprüsü
    A.push(function () { lavCiz(g, y0, h); });
    // 5. Büyük ölçekli volkanik ton katmanı
    A.push(function () { tonKatmani(g, y0, h); });
    A.push(function () { madenVagonIzleri(g, y0, h); });
    // 6. 2x zemin süsleri
    A.push(function () {
      for (var s = 0; s < susler.length; s++) {
        var u = susler[s], uz = u.kendi ? 600 : u.boy;
        if (u.y + uz < y0 || u.y - uz > y0 + h) continue;
        var k = susKaynak(u.ad); if (!k) continue;
        var gercekSus = !!(cevreKare(u.ad) && kareHazir(cevreKare(u.ad)));
        var sc = (u.kendi ? (gercekSus ? u.boy * Math.max(k.sw, k.sh) * cevreOlc(u.ad) : (u.ytBoy || 90)) : u.boy) / Math.max(k.sw, k.sh);
        var don = u.ad.indexOf('sus_kul') === 0 ? 0 : u.r;
        g.save(); g.globalAlpha = u.a; g.translate(Math.round(u.x), Math.round(u.y - y0)); g.rotate(don); g.scale(u.ayna ? -sc : sc, sc);
        g.drawImage(k.c, k.sx, k.sy, k.sw, k.sh, -k.sw / 2, -k.sh / 2, k.sw, k.sh); g.restore();
      }
    });
    // 7. Kenar karartması
    A.push(function () {
      var kg = g.createLinearGradient(0, 0, W, 0);
      kg.addColorStop(0, 'rgba(0,0,0,0.24)'); kg.addColorStop(0.18, 'rgba(0,0,0,0)'); kg.addColorStop(0.82, 'rgba(0,0,0,0)'); kg.addColorStop(1, 'rgba(0,0,0,0.24)');
      g.fillStyle = kg; g.fillRect(0, 0, W, h);
    });
    return { i: i, c: c, A: A, k: 0, gecici: false };
  }

  function kemikCukuruKenar(g, y0, h) {
    if (!ortusur(y0, h, 100, 765)) return;
    var firca = tohumluRast(3537);
    // Merkez dövüş alanını açık bırak; yalnız çukurun iki yanındaki açık kaya damarı.
    [-1, 1].forEach(function (yon) {
      for (var i = 0; i < 12; i++) {
        var t = (i + firca()*.57) / 12;
        var a = (t-.5)*2.08;
        var x = 640 + yon*Math.cos(a)*(465 + firca()*53);
        var y = 420 + Math.sin(a)*314 - y0;
        var en = 14+firca()*37, boy = 8+firca()*21;
        g.save(); g.translate(x,y); g.rotate(yon*(a*.72 + firca()*.17));
        g.fillStyle = 'rgba(27,22,21,.34)'; g.beginPath(); g.moveTo(-en-9,0);
        g.quadraticCurveTo(-en*.2,boy+11,en+13,boy*.29); g.lineTo(en*.33,2); g.fill();
        g.fillStyle = ['#4a423b','#504540','#4d4341'][i%3];
        g.beginPath(); g.moveTo(-en,-boy*.1); g.lineTo(-en*.62,-boy*.6);
        g.lineTo(-en*.10,-boy*.48); g.lineTo(en*.42,-boy*.73);
        g.lineTo(en,boy*.08); g.lineTo(en*.65,boy*.33); g.lineTo(-en*.57,boy*.4);
        g.closePath(); g.fill();
        g.fillStyle = 'rgba(20,16,16,.45)'; g.beginPath(); g.moveTo(-en,-boy*.1);
        g.lineTo(-en*.57,boy*.4); g.lineTo(en*.65,boy*.33); g.lineTo(en,boy*.08);
        g.lineTo(en*.62,boy*.57); g.lineTo(-en*.72,boy*.64); g.fill();
        g.strokeStyle = 'rgba(155,135,115,.24)'; g.lineWidth = 1.25; g.beginPath();
        g.moveTo(-en*.68,-boy*.50); g.lineTo(-en*.22,-boy*.34);
        g.lineTo(en*.40,-boy*.57); g.lineTo(en*.71,-boy*.18); g.stroke();
        g.strokeStyle = 'rgba(24,19,20,.55)'; g.lineWidth = 1.1;
        g.beginPath(); g.moveTo(en*.19,-boy*.62); g.lineTo(en*.15,-boy*.24);
        g.lineTo(en*.28,boy*.06); g.lineTo(en*.13,boy*.41); g.stroke();
        g.restore();
      }
    });
  }

  function yagmurBirintileri(g, y0, h) {
    for (var sira = Math.max(0, Math.floor((y0 - 38) / 123)); sira * 123 < y0 + h + 38; sira++) {
      var rast = tohumluRast(7141 + sira * 317);
      for (var j = 0; j < 3; j++) {
        var y = sira * 123 + 14 + rast() * 95;
        var x = yolX(y) + (rast() - .5) * (j === 0 ? 380 : 870);
        var w = 15 + rast() * 40, boy = 4 + rast() * 10;
        if (y > L || y < y0 - boy - 4 || y > y0 + h + boy + 4 || x < 90 || x > W - 90) continue;
        if (y > DERE.y1 - 28 && y < DERE.y2 + 28) continue;
        var ey = y - y0;
        var renk = g.createLinearGradient(0, ey - boy, 0, ey + boy);
        renk.addColorStop(0, 'rgba(24,33,35,.41)');
        renk.addColorStop(.56, 'rgba(72,86,92,.27)');
        renk.addColorStop(1, 'rgba(142,154,157,.17)');
        g.fillStyle = renk;
        g.beginPath();
        g.moveTo(x - w, ey);
        g.bezierCurveTo(x - w * 1.01, ey - boy * .7, x - w * .63, ey - boy * 1.04, x - w * .18, ey - boy * .79);
        g.bezierCurveTo(x + w * .22, ey - boy * .98, x + w * .96, ey - boy * .61, x + w, ey + boy * .08);
        g.bezierCurveTo(x + w * .66, ey + boy, x - w * .35, ey + boy * .85, x - w * .79, ey + boy * .46);
        g.closePath(); g.fill();
        g.strokeStyle = 'rgba(188,205,211,.20)';
        g.lineWidth = 1.05;
        g.beginPath(); g.moveTo(x - w * .65, ey - boy * .44);
        g.quadraticCurveTo(x - w * .23, ey - boy * .91, x + w * .25, ey - boy * .59); g.stroke();
      }
    }
  }

  // Kuyu avlusunun taşları, ıslak izleri ve enkazı dünya koordinatında zemine işlenir.
  // Parçalar komşu olduklarında tuval sınırı aynı şekilleri kırpar.
  function kuyuAvlusu(g, y0) {
    var rast = tohumluRast(7840);
    g.save();
    g.translate(0, -y0);

    // Toprağa oturan düzensiz taş döşeme, eski yolun kenarına doğru seyrekleşir.
    var taslar = [
      [923, 7841, 29, 16, .18], [937, 7868, 24, 13, -.35], [970, 7883, 27, 16, .18],
      [1018, 7892, 25, 14, -.08], [1065, 7888, 22, 11, -.18], [1104, 7870, 27, 12, -.30],
      [1131, 7845, 20, 12, -.48], [1155, 7822, 18, 11, .22], [1143, 7798, 22, 12, -.32],
      [1094, 7789, 29, 12, .11], [902, 7870, 12, 6, -.22], [1117, 7895, 11, 7, .39]
    ];
    taslar.forEach(function (t, i) {
      var x = t[0], y = t[1], w = t[2], h = t[3];
      g.save(); g.translate(x, y); g.rotate(t[4]);
      var kenar = g.createLinearGradient(0, -h, 0, h);
      kenar.addColorStop(0, i % 3 ? '#686965' : '#797163');
      kenar.addColorStop(.43, i % 3 ? '#4e524d' : '#59574d');
      kenar.addColorStop(1, '#333a38');
      var uc = rast() - .5, kirik = rast() - .5;
      g.beginPath(); g.ellipse(0, h * .46, w * 1.12, h * .74, 0, 0, Math.PI * 2);
      g.fillStyle = 'rgba(19,21,18,.23)'; g.fill();
      g.beginPath();
      g.moveTo(-w, -h * (.20 + uc * .25));
      g.lineTo(-w * (.58 + kirik * .28), -h * .88); g.lineTo(w * (.11 + uc * .35), -h);
      g.lineTo(w * (.74 - kirik * .22), -h * (.60 - uc * .20)); g.lineTo(w, h * .13);
      g.lineTo(w * (.61 + kirik * .3), h * .90); g.lineTo(-w * (.24 + uc * .45), h);
      g.lineTo(-w * .83, h * (.59 - kirik * .32)); g.closePath();
      g.strokeStyle = 'rgba(19,22,21,.73)'; g.lineWidth = 3.6; g.stroke();
      g.fillStyle = kenar; g.fill();
      g.save(); g.clip();
      for (var j = 0; j < 23; j++) {
        var dx = (rast() * 2 - 1) * w, dy = (rast() * 2 - 1) * h;
        var iz = 2 + rast() * w * .40;
        g.beginPath(); g.moveTo(dx, dy); g.lineTo(dx + iz, dy + iz * (.15 + uc * .38));
        g.strokeStyle = j % 2 ? 'rgba(176,171,150,.21)' : 'rgba(16,30,33,.24)';
        g.lineWidth = .55 + rast() * 1.48; g.stroke();
      }
      g.strokeStyle = 'rgba(126,144,138,.46)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(-w*.84,-h*.18); g.lineTo(-w*.54,-h*.69); g.lineTo(w*.13,-h*.83);
      g.lineTo(w*.68,-h*.47); g.stroke();
      g.strokeStyle = 'rgba(24,32,32,.56)'; g.lineWidth = 1.25;
      g.beginPath(); g.moveTo(w*.29,-h); g.lineTo(w*.22,-h*.44); g.lineTo(w*.38,-h*.04);
      g.lineTo(w*.29,h*.34); g.stroke();
      g.restore(); g.restore();
    });

    // Zemindeki eski kırıklar, kaldırımın üst yüzeyine sınırlı kalır.
    var asinma = [
      [644, 7694, 45, 12], [720, 7718, 39, 11], [682, 7760, 36, 10], [790, 7775, 32, 10],
      [743, 7836, 30, 14], [796, 7860, 28, 8], [709, 7893, 34, 14], [677, 7932, 37, 9],
      [759, 7950, 34, 11], [822, 7981, 26, 8]
    ];
    asinma.forEach(function (t, i) {
      var x=t[0], y=t[1], en=t[2], boy=t[3], yon=i%2 ? -1 : 1;
      g.save(); g.translate(x,y); g.scale(yon,1);
      var islak = g.createRadialGradient(0,0,1,0,0,en);
      islak.addColorStop(0, 'rgba(42,53,54,.45)'); islak.addColorStop(1, 'rgba(42,53,54,0)');
      g.save(); g.scale(1, .43); g.fillStyle = islak; g.fillRect(-en,-en,en*2,en*2); g.restore();
      g.beginPath();
      g.moveTo(-en*.79, -boy*.5); g.lineTo(-en*.25,-boy*.17); g.lineTo(-en*.03,boy*.15);
      g.lineTo(en*.36,-boy*.14); g.lineTo(en*.61,boy*.38);
      g.strokeStyle='rgba(25,33,36,.77)'; g.lineWidth=1.55; g.stroke();
      g.translate(0, .95);
      g.strokeStyle = 'rgba(143,153,149,.25)'; g.lineWidth = .80; g.stroke();
      for (var j=0; j<14; j++) {
        var dx=(rast()*2-1)*en*.8, dy=(rast()*2-1)*boy;
        g.fillStyle=j%2 ? 'rgba(156,159,145,.23)' : 'rgba(24,28,30,.31)';
        g.fillRect(dx,dy,.7+rast()*4,.6+rast()*1.1);
      }
      g.restore();
    });

    // Taşların alt cebinde su birikir, meşale yönündeki kenar sıcak rengi tutar.
    [[900,7857,23,8],[953,7907,38,9],[1035,7914,37,11],[1110,7904,25,8]]
      .forEach(function (p) {
        var x=p[0], y=p[1], w=p[2], h=p[3];
        g.beginPath(); g.moveTo(x-w,y+1);
        g.bezierCurveTo(x-w*.74,y-h*.80,x+w*.24,y-h,x+w,y-h*.08);
        g.bezierCurveTo(x+w*.74,y+h*.68,x-w*.51,y+h,x-w,y+1);
        var su = g.createLinearGradient(0,y-h,0,y+h);
        su.addColorStop(0,'rgba(29,38,40,.81)');
        su.addColorStop(.49,'rgba(52,62,63,.69)');
        su.addColorStop(1,'rgba(129,108,76,.42)');
        g.fillStyle=su; g.fill();
        g.beginPath(); g.moveTo(x-w*.51,y-h*.46);
        g.quadraticCurveTo(x,y-h*.8,x+w*.47,y-h*.28);
        g.strokeStyle='rgba(213,183,128,.42)'; g.lineWidth=1; g.stroke();
      });

    // Çökmüş çitin kömürleşmiş tahtaları ve dökülen küçük taşlar kenarda kalır.
    [[1133,8014,58,-.40], [1097,7994,43,.19], [1152,7989,66,.54], [465,7935,53,.34]]
      .forEach(function(p) {
        g.save(); g.translate(p[0],p[1]); g.rotate(p[3]);
        var w=p[2]*.5;
        g.beginPath(); g.moveTo(-w,-4); g.lineTo(w*.56,-6); g.lineTo(w,-2);
        g.lineTo(w*.74,1); g.lineTo(w*.86,5); g.lineTo(-w*.72,6); g.lineTo(-w,2); g.closePath();
        g.fillStyle='#2f2925';g.fill();g.strokeStyle='#191a17';g.lineWidth=2.7;g.stroke();
        g.save();g.clip();
        for (var j=0;j<6;j++) {
          g.beginPath(); g.moveTo(-w,-4+j*1.8);
          g.quadraticCurveTo(w*.31,-6+j*1.9,w,-4+j*1.6);
          g.strokeStyle=j%2 ? 'rgba(127,98,67,.56)' : 'rgba(12,15,14,.56)';
          g.lineWidth=.8;g.stroke();
        }
        g.restore();g.restore();
      });
    [[1121,8000,42,25],[963,7922,60,17],[922,7873,28,17],[475,7943,44,21]]
      .forEach(function(p) {
        for (var i=0;i<18;i++) {
          var x=p[0]+(rast()*2-1)*p[2], y=p[1]+(rast()*2-1)*p[3];
          var w=1.8+rast()*5.7, h=1.2+rast()*2.9;
          g.beginPath();g.moveTo(x-w,y);g.lineTo(x-w*.27,y-h);g.lineTo(x+w,y-h*.28);
          g.lineTo(x+w*.57,y+h);g.lineTo(x-w*.42,y+h*.64);g.closePath();
          g.fillStyle=i%3===0 ? '#645c4d' : '#3e4039';g.fill();
          g.strokeStyle='rgba(27,27,22,.77)';g.lineWidth=.9;g.stroke();
        }
      });
    g.restore();
  }

  // Parça çizimi ADIM ADIM: bir parçayı tek karede çizmek ~30–70 ms sürüyordu (her ~1000 px'de bir 'takılma').
  // Ekrana girmeden önce birkaç kareye bölünerek (kare başına ≤ ~4 ms) hazırlanır; ekranda eksik kalırsa hemen çizilir.
  function parcaIs(i) {
    if (aktifBolum() === 3) {
      var ay = i * PARCA, ah = Math.min(PARCA, L - ay);
      var ac = tuval(W * ZEMIN_OLC, ah * ZEMIN_OLC), ag = ac.getContext('2d');
      ag.setTransform(ZEMIN_OLC, 0, 0, ZEMIN_OLC, 0, 0);
      return { i: i, c: ac, A: AYAZ.zeminAdimlari(ag, ay, ah), k: 0, gecici: false };
    }
    if (aktifBolum() === 2) return parcaIs2(i);
    var y0 = i * PARCA, h = Math.min(PARCA, L - y0);
    var c = tuval(W * ZEMIN_OLC, h * ZEMIN_OLC), g = c.getContext('2d');
    g.setTransform(ZEMIN_OLC, 0, 0, ZEMIN_OLC, 0, 0);
    if (!tmpC) { tmpC = tuval(W * ZEMIN_OLC, PARCA * ZEMIN_OLC); maskC = tuval(W * ZEMIN_OLC, PARCA * ZEMIN_OLC); }
    var A = [];
    // 1. taban: yanık ot; içinde dağınık çamur adacıkları
    A.push(function () { dose(g, 'ot', y0, h, 0); });
    maskeliEkle(A, g, 'camur', y0, h, adacikSekli(y0, h, 260, 0.62, 5, -40, W + 40), 18, 1, 23);
    // 2. kayalık zemin: geçit
    if (ortusur(y0, h, 2100, 3400)) maskeliEkle(A, g, 'tas', y0, h, bantSekli(2150, 3350), 24, 1);
    // 3. çamur yol (+ köy/kilise bölgesinde ortasında kaldırım, varsa)
    maskeliEkle(A, g, 'camur', y0, h, yolSekli(y0, h), 22);
    if (ortusur(y0, h, 6050, L) || ortusur(y0, h, 3300, 4560)) {
      maskeliEkle(A, g, 'tas', y0, h, function (m) {
        if (!cevreKare('zemin_tas_1')) return; // kaldırım = meydanla AYNI taş ve AYNI ızgara (iki farklı taş deseni üst üste binip 'hayalet taş' yapmasın)
        var a = Math.max(0, y0 - 200), b = Math.min(L + 200, y0 + h + 200), y, on = [];
        for (y = a; y <= b; y += 10) on.push(y);
        on.forEach(function (yy) { var k = yolBolgesi(yy) ? 55 : yolYari(yy); m.lineTo(yolX(yy) - yolYari(yy) + k + (yolKenarGur(yy, -1) - 0.5) * 60, yy); });
        on.reverse().forEach(function (yy) { var k = yolBolgesi(yy) ? 55 : yolYari(yy); m.lineTo(yolX(yy) + yolYari(yy) - k - (yolKenarGur(yy, 1) - 0.5) * 60, yy); });
        m.closePath();
      }, 20, 1, 31);
    }
    A.push(function () { sacak(g, y0, h); });
    // 4. meydanlar (taş) ve dev alanı (çukur/çamur), düzensiz kenarlı
    MEYDANLAR.forEach(function (e) { if (ortusur(y0, h, e.cy - e.ry, e.cy + e.ry)) maskeliEkle(A, g, 'tas', y0, h, elipsSekli(e, 0.1), 24, 1); });
    if (ortusur(y0, h, 0, DEV_ALANI.cy + DEV_ALANI.ry)) maskeliEkle(A, g, 'cukur', y0, h, elipsSekli(DEV_ALANI, 0.14), 25, 1);
    // taşlı alanlarda kırık taşın arasından sızan çamur
    if (ortusur(y0, h, 2100, 3400) || ortusur(y0, h, 3440, 4300) || ortusur(y0, h, 6170, 6960))
      maskeliEkle(A, g, 'camur', y0, h, adacikSekli(y0, h, 140, 0.7, 31, 0, W), 16, 1, 37);
    // 5. dere, köprü ve kemik çukurunun kaya kerterizi
    A.push(function () { dereCiz(g, y0, h); kemikCukuruKenar(g, y0, h); });
    // 6. büyük ölçekli ton/renk değişimi (tekrarı ve düz alanı kırar)
    A.push(function () { tonKatmani(g, y0, h); });
    A.push(function () { yagmurBirintileri(g, y0, h); });
    if (y0 < 8050 && y0 + h > 7660) A.push(function () { kuyuAvlusu(g, y0); });
    A.push(function () { yanikYapiIzleri(g, y0, h); });
    // 7. süsler
    A.push(function () { for (var s = 0; s < susler.length; s++) {
      // kapsam: 'kendi' boyundaki yama_* süslerde boy=1 (ölçek) → gerçek yarı boy resimden; yoksa parça sınırında yarım kalıp DÜZ DİKİŞ yapıyordu
      var u = susler[s], uz = u.kendi ? 600 : u.boy; if (u.y + uz < y0 || u.y - uz > y0 + h) continue;
      var k = susKaynak(u.ad); if (!k) continue;
      var sc = (u.kendi ? u.boy * Math.max(k.sw, k.sh) * cevreOlc(u.ad) : u.boy) / Math.max(k.sw, k.sh);
      var don = (u.ad.indexOf('ot') === 0 || u.ad.indexOf('yama_') === 0) ? 0 : u.r;
      g.save(); g.globalAlpha = u.a; g.translate(Math.round(u.x), Math.round(u.y - y0)); g.rotate(don); g.scale(u.ayna ? -sc : sc, sc);
      g.drawImage(k.c, k.sx, k.sy, k.sw, k.sh, -k.sw / 2, -k.sh / 2, k.sw, k.sh); g.restore();
    } });
    // 8. hafif karartma (aşağıdan yukarı derinlik)
    A.push(function () {
      var kg = g.createLinearGradient(0, 0, W, 0);
      kg.addColorStop(0, 'rgba(0,0,0,0.2)'); kg.addColorStop(0.18, 'rgba(0,0,0,0)'); kg.addColorStop(0.82, 'rgba(0,0,0,0)'); kg.addColorStop(1, 'rgba(0,0,0,0.2)');
      g.fillStyle = kg; g.fillRect(0, 0, W, h);
    });
    return { i: i, c: c, A: A, k: 0, gecici: false };
  }
  function isAdim(is) { // bir adım; bitti mi?
    bekleyenGercek = false;
    is.A[is.k++]();
    if (bekleyenGercek) is.gecici = true;
    return is.k >= is.A.length;
  }
  function parcaCiz(i) { var is = parcaIs(i); while (!isAdim(is)) {} return is; }
  var insa = null; // adım adım hazırlanan parça
  var sonYanGor = null; // yan aynalar en son görünür müydü (pencere boyu değişince güncellenir)
  function parcaKur(i, hazirIs) {
    var eski = parcalar[i], t0 = performance.now();
    if (insa && !hazirIs) insa = null;
    var r = hazirIs || parcaCiz(i);
    if (!hazirIs) { BOLUM.parcaMs = performance.now() - t0; BOLUM.parcaMsEn = Math.max(BOLUM.parcaMsEn || 0, BOLUM.parcaMs); BOLUM.parcaAni = (BOLUM.parcaAni || 0) + 1; (BOLUM.parcaAniLog = BOLUM.parcaAniLog || []).push([i, Math.round(kamY), Math.round(BOLUM.parcaMs), !!eski, insa ? insa.i + ':' + insa.k : null]); if (BOLUM.parcaAniLog.length > 30) BOLUM.parcaAniLog.shift(); } // ölçüm: tek karede çizilen
    var tex = PIXI.Texture.from(r.c);
    var sp = eski && eski.sprite, ay = parcaAynalari(i, tex, eski && eski.aynalar);
    if (sp) { var et = sp.texture; sp.texture = tex; sp.scale.set(1 / ZEMIN_OLC); try { et.destroy(true); } catch (e) {} }
    else { sp = new PIXI.Sprite(tex); sp.x = 0; sp.y = i * PARCA; sp.scale.set(1 / ZEMIN_OLC); OYUN.katman.zemin.addChild(sp); }
    parcalar[i] = { sprite: sp, gecici: r.gecici, aynalar: ay };
  }
  // TAM EKRAN (19 Kasım): pencere 16:9'dan geniş/uzunsa oyun alanının dışı da görünür. Orada zemin, parçanın AYNASI
  // (aynı doku, ek çizim yok; kenarda dikişsiz devam eder): yanlar x<0 ve x>W, bölüm başı/sonu ötesi y>L ve y<0.
  // Yalnız görüntü: oyuncu/düşman oraya giremez. Yan aynalar yalnız pencere 16:9'dan genişken görünür.
  function parcaAynalari(i, tex, eskiler) {
    if (eskiler) eskiler.forEach(function (s) { try { s.destroy(); } catch (e) {} });
    var y0 = i * PARCA, son = Math.floor((L - 1) / PARCA), k = 1 / ZEMIN_OLC, l = [], dikey = [[y0, k]];
    if (i === 0) dikey.push([0, -k]);              // y<0: y=0 çizgisine göre ayna
    if (i === son) dikey.push([2 * L - y0, -k]);   // y>L: y=L çizgisine göre ayna
    for (var d = 0; d < dikey.length; d++) for (var yan = -1; yan <= 1; yan++) {
      if (d === 0 && yan === 0) continue;          // asıl parça
      var s = new PIXI.Sprite(tex); s.y = dikey[d][0]; s.scale.y = dikey[d][1];
      if (yan === 0) { s.x = 0; s.scale.x = k; } else { s.scale.x = -k; s.x = yan < 0 ? 0 : 2 * W; }
      s._yan = yan !== 0; s.visible = !s._yan || yanGorunur();
      OYUN.katman.zemin.addChildAt(s, 0); l.push(s);
    }
    return l;
  }
  function gorunum() { return OYUN.gorunum || { x0: 0, y0: 0, w: W, h: H }; }
  // YAKINLIK (19 Kasım): ekranda görünen dünya = OYUN.gorus (barbarı izler; tasarım penceresinin içinde ya da dışına taşmış olabilir).
  // Kapsama = tasarım penceresi ∪ görüş penceresi (kamera.y bu karede değişse de eksik kalmasın).
  function gorusUst() { var g = OYUN.gorus; return Math.min(kamY, g ? g.ust : kamY + Math.min(0, gorunum().y0)); }
  function gorusAlt() { var g = OYUN.gorus; return Math.max(kamY + H, g ? g.ust + g.h : kamY + gorunum().y0 + gorunum().h); }
  function yanGorunur() { var g = OYUN.gorus; return g ? (g.sol < -0.5 || g.sol + g.w > W + 0.5) : gorunum().x0 < -0.5; }
  function parcaSil(i) {
    var p = parcalar[i]; if (!p) return;
    if (p.aynalar) p.aynalar.forEach(function (s) { try { s.destroy(); } catch (e) {} });
    try { p.sprite.destroy({ texture: true, baseTexture: true }); } catch (e) {}
    delete parcalar[i];
  }
  function parcalarGuncelle(gdt) {
    var son = Math.floor((L - 1) / PARCA), i;
    // görünen (+ az pay) parçalar MUTLAKA hazır; daha ilerisi (yukarı 900, aşağı 400 px) adım adım önceden hazırlanır
    var gUst = gorusUst(), gAlt = gorusAlt();   // görüş penceresi + tasarım penceresi
    var a = Math.max(0, Math.floor((gUst - 40) / PARCA)), b = Math.min(son, Math.floor((gAlt + 40) / PARCA));
    var a2 = Math.max(0, Math.floor((gUst - 900) / PARCA)), b2 = Math.min(son, Math.floor((gAlt + 400) / PARCA));
    for (i = a; i <= b; i++) if (!parcalar[i]) parcaKur(i);
    var yg = yanGorunur();
    if (yg !== sonYanGor) { sonYanGor = yg; for (var pk in parcalar) (parcalar[pk].aynalar || []).forEach(function (s) { if (s._yan) s.visible = yg; }); }
    if (insa && (insa.i < a2 || insa.i > b2 || parcalar[insa.i])) insa = null;
    if (!insa) {
      var enI = -1, enD = 1e9, orta = (kamY + H / 2) / PARCA;
      for (i = a2; i <= b2; i++) if (!parcalar[i] && Math.abs(i + 0.5 - orta) < enD) { enD = Math.abs(i + 0.5 - orta); enI = i; }
      if (enI >= 0) insa = parcaIs(enI);
    }
    if (insa) {
      var t0 = performance.now();
      while (true) { if (isAdim(insa)) { var bitti = insa; insa = null; parcaKur(bitti.i, bitti); break; } if (performance.now() - t0 > 4) break; }
    }
    for (var k in parcalar) { i = +k; if (i < a2 - 1 || i > b2 + 1) parcaSil(i); }
    yenidenT -= gdt;
    var hazir = aktifBolum() === 3 || kareHazir(cevreKare(aktifBolum() === 2 ? 'bazalt_0' : 'zemin_ot_1'));
    if (yenidenT <= 0 || (hazir && !oncekiHazir)) { // gerçek resimler yüklendiyse yer tutucuyla çizilmiş parçaları yenile
      yenidenT = 0.5;
      for (k in parcalar) if (parcalar[k].gecici) { parcaKur(+k); if (!hazir) break; }
    }
    oncekiHazir = hazir;
  }

  // =====================================================================
  // DEKOR SPRITE'LARI (y-sıralı, yalnız ekrana yakın olanlar)
  // =====================================================================
  function dekorDoku(ad) {
    var b = aktifBolum(), oKey = b + ':' + ad;
    if (dokuOnbellek[oKey]) return dokuOnbellek[oKey];
    var k = cevreKare(ad), r;
    if (b === 3 && (r = AYAZ.dekorDoku(ad))) { dokuOnbellek[oKey] = r; return r; }
    if (k) r = { tex: k.doku, ax: k.w ? -k.ox / k.w : 0.5, ay: k.h ? -k.oy / k.h : 1, h: k.h, gercek: true };
    else {
      var t = ad.replace(/_\d+$/, ''), ytKey = 'dk:' + b + ':' + t;
      var y = ytOnbellek[ytKey] || (ytOnbellek[ytKey] = ytDekor(ad));
      r = { tex: PIXI.Texture.from(y.c), ax: y.ax, ay: y.ay, h: y.sh };
    }
    dokuOnbellek[oKey] = r; return r;
  }
  function dekorSprite(d) {
    var dk = d.ayazKafesTipi ? AYAZ.dekorDoku(d.ayazKafesTipi) : null;
    if (!dk) dk = dekorDoku(d.ad);
    var s = new PIXI.Sprite(dk.tex);
    s.golgeTaban = d.tb;
    if (d._koz) {
      s.anchor.set(0.5, 0.5);
    } else {
      s.anchor.set(dk.ax, dk.ay);
    }
    var sc = dk.gercek ? d.olc * (d.ko || 1) : d.boy / (dk.h || dk.tex.height || 100);
    s.scale.set(d.ayna ? -sc : sc, sc);
    if (d.ad === "ayaz_kemer") s.zEk = 67;
    s.x = d.x; s.y = d.y;
    if (d.alevY !== undefined && window.EFEKT) {
      s.mesaleAlevi = EFEKT.mesaleAlevi(s, dk.alevX ?? d.alevX, dk.alevY ?? d.alevY, dk.alevBoy, aktifBolum() === 3 && !dk.mesaleRengi);
    }
    var katman = (d._koz && OYUN.katman.leke) ? OYUN.katman.leke : OYUN.katman.varlik;
    katman.addChild(s);
    return s;
  }
  function kozSpriteSenk(kz) {
    if (!kz || !kz.sprite) return;
    var s = kz.sprite;
    if (kz.faz === 'aktif') { s.tint = 0xffffff; s.alpha = 1; }
    else if (kz.faz === 'uyari') {
      var fl = 0.5 + 0.5 * Math.sin(kz.zaman * 24);
      s.tint = fl > 0.5 ? 0xffbb66 : 0xff6633;
      s.alpha = 0.85 + fl * 0.15;
    } else {
      s.tint = 0x55484a; s.alpha = 0.82;
    }
  }
  function dekorGuncelle() {
    var ust = gorusUst() - 60, alt = gorusAlt() + 60;   // görüş penceresi + tasarım penceresi
    for (var i = 0; i < dekorlar.length; i++) {
      var d = dekorlar[i];
      if (d.gizli) {
        if (d.s) { try { d.s.destroy({ children: true }); } catch (e) {} d.s = null; }
        if (d._varil) d._varil.sprite = null;
        continue;
      }
      var gor = d.y + 90 > ust && d.y - d.boy * 1.1 < alt;
      if (gor && !d.s) {
        d.s = dekorSprite(d);
        if (d._varil) d._varil.sprite = d.s;
        if (d._koz) { d._koz.sprite = d.s; kozSpriteSenk(d._koz); }
      } else if (!gor && d.s) {
        d.s.destroy({ children: true }); d.s = null;
        if (d._varil) d._varil.sprite = null;
        if (d._koz) d._koz.sprite = null;
      }
      if (d.s && d.ad === 'ayaz_kafes' && AYAZ.kurtarildi() && !d.s._kafesAcik) {
        var acik = AYAZ.dekorDoku('ayaz_kafes_acik');
        if (acik) {
          d.s.texture = acik.tex; d.s.anchor.set(acik.ax, acik.ay);
          d.s.scale.set((d.ayna ? -1 : 1) * d.boy / acik.h, d.boy / acik.h);
          d.s._kafesAcik = true;
        }
      }
      if (d.s && d.s.mesaleAlevi) d.s.mesaleAlevi(OYUN.zaman.t, d.ad === "ayaz_kule" && AYAZ.kurtarildi());
    }
  }
  function dekorTemizle() {
    for (var i = 0; i < dekorlar.length; i++) {
      var d = dekorlar[i];
      if (d.s) { try { d.s.destroy({ children: true }); } catch (e) {} d.s = null; }
      if (d._varil) d._varil.sprite = null;
      if (d._koz) d._koz.sprite = null;
    }
  }

  // =====================================================================
  // CAN TOPLANABİLİRLERİ
  // =====================================================================
  function canlariKur() {
    canlar.forEach(function (c) { try { c.s.destroy({ children: true }); } catch (e) {} });
    canlar.length = 0;
    sonCan = -Infinity;
    // Ganimet çekilişi düşman davranışının rastgele dizisini tüketmez.
    canTohum = ((OYUN.param('tohum') !== null ? OYUN.tohum : Math.random() * 4294967296) ^ Math.imul(aktifBolum(), 0x9e3779b9)) >>> 0;
  }
  var canSisesiGorseli;
  function canYap(p) {
    var kap = new PIXI.Container(); kap.x = Math.round(p.x); kap.y = Math.round(p.y);
    if (!canSisesiGorseli) {
      var cizim = ytDekor('can_sisesi');
      canSisesiGorseli = { tex: PIXI.Texture.from(cizim.c), ax: cizim.ax, ay: cizim.ay, olcek: BOY.can_sisesi / cizim.sh };
    }
    var dk = canSisesiGorseli, sp = new PIXI.Sprite(dk.tex);
    sp.anchor.set(dk.ax, dk.ay); sp.scale.set(dk.olcek);
    kap.addChild(sp); OYUN.katman.varlik.addChild(kap);
    return { x: kap.x, y: kap.y, s: kap, sp: sp, alindi: false, t: Math.random() * 6 };
  }
  function canNoktasi(x, y, olum) {
    var s = BOLUM.sinir, pay = 16;
    if (x < s.sol + pay || x > s.sag - pay || y < s.ust + pay || y > s.alt - pay) return false;
    for (var i = 0; i < DARLAR.length; i++) {
      var d = DARLAR[i];
      if (y >= d.y1 && y <= d.y2 && (x < d.sol + pay || x > d.sag - pay)) return false;
    }
    if (engelIt({ x: x, y: y }, pay)) return false;
    if (kozler.some(function (k) { return Math.hypot(x - k.x, y - k.y) <= k.r + pay; })) return false;
    if (olum.tur === 'yakici' && Math.hypot(x - olum.x, y - olum.y) < 80) return false;
    return !window.DUSMAN || !DUSMAN.atesIcinde || !DUSMAN.atesIcinde(x, y, pay);
  }
  function canBirak(olum) {
    var O = window.OYUNCU, ayar = CAN_GANIMETI[aktifBolum()], t = OYUN.zaman.t;
    if (OYUN.durum !== 'oyun' || !O || !O.canli || !olum || !olum.ganimet ||
        !Number.isFinite(olum.x) || !Number.isFinite(olum.y) || canlar.length >= ayar.azami || t - sonCan < ayar.ara) return;
    var eksik = 1 - OYUN.sinirla(O.can / O.canMax, 0, 1);
    canTohum = (Math.imul(canTohum, 1664525) + 1013904223) >>> 0;
    if (canTohum / 4294967296 >= ayar.ihtimal * (1 + 0.8 * eksik)) return;

    // Önce ölüm noktası, ardından yakınındaki güvenli taş/toprak.
    var s = BOLUM.sinir, aci = Math.atan2(O.y - olum.y, O.x - olum.x);
    for (var r of [0, 48, 96, 144]) {
      for (var i = 0; i < (r === 0 ? 1 : 8); i++) {
        var a = aci + i * Math.PI / 4;
        var x = Math.round(OYUN.sinirla(olum.x + Math.cos(a) * r, s.sol + 17, s.sag - 17));
        var y = Math.round(OYUN.sinirla(olum.y + Math.sin(a) * r, s.ust + 17, s.alt - 17));
        if (!canNoktasi(x, y, olum)) continue;
        canlar.push(canYap({ x: x, y: y }));
        sonCan = t;
        return;
      }
    }
  }
  function canlarGuncelle(dt) {
    var O = window.OYUNCU;
    for (var i = 0; i < canlar.length; i++) {
      var c = canlar[i]; if (c.alindi) continue;
      c.t += dt; c.sp.y = -4 - Math.abs(Math.sin(c.t * 3)) * 8;
      c.s.visible = c.y > gorusUst() - 100 && c.y < gorusAlt() + 100;
      if (O && O.canli !== false && Math.abs(O.x - c.x) < 46 && Math.abs(O.y - c.y) < 46 && (O.can === undefined || O.can < (O.canMax || 100))) {
        c.alindi = true; c.s.visible = false;
        try { if (O.iyiles) O.iyiles(CAN_MIKTAR); } catch (e) { console.error(e); }
        olay('topla', { tur: 'can', x: c.x, y: c.y });
      }
    }
  }

  // =====================================================================
  // DALGALAR ve ARENALAR
  // =====================================================================
  function olay(ad, veri) { try { OLAY.emit(ad, veri); } catch (e) { console.error('bolum olay', ad, e); } }
  function dusmanListe() { return (window.DUSMAN && Array.isArray(DUSMAN.liste)) ? DUSMAN.liste : null; }
  function canliMi(d) {
    if (!d || d.olu || !(d.can > 0)) return false;
    var l = dusmanListe(); return !l || l.indexOf(d) >= 0;
  }
  function dalgaKur() {
    dalgalar = DALGALAR.map(function (w, i) { return { i: i, def: w, basladi: false, bitti: false, t: 0, kuyruk: [], uyeler: [] }; });
    arenalar = {};
    Object.keys(ARENALAR).forEach(function (ad) {
      arenalar[ad] = { ad: ad, kamY: ARENALAR[ad].kamY, isim: ARENALAR[ad].ad, sira: [], i: -1, basladi: false, bitti: false, bekle: 0 };
    });
    DALGALAR.forEach(function (w, i) { if (w.arena && arenalar[w.arena]) arenalar[w.arena].sira.push(i); });
    arenaDalgaSayisi = 0;
    for (var ad in arenalar) arenaDalgaSayisi += arenalar[ad].sira.length;
    etkinArena = null;
  }
  function dalgaBaslat(i) {
    var w = dalgalar[i]; if (!w || w.basladi) return;
    w.basladi = true; w.t = 0; w.kuyruk = []; w.uyeler = [];
    w.def.g.forEach(function (gr) {
      for (var k = 0; k < gr[1]; k++) {
        var n = gr[2]; if (n === 'yan') n = k % 2 ? 'sag' : 'sol';
        w.kuyruk.push({ t: (gr[3] || 0) + k * (gr[4] || 0), tur: gr[0], nereden: n, ok: false });
      }
    });
    BOLUM.dalgaNo = i + 1;
    olay('dalga', { no: i + 1, ad: w.def.ad, arena: w.def.arena || null, adet: w.kuyruk.length });
  }
  function bossMu(d) { return d && (d.tur === 'dev' || d.tur === 'vargor' || d.boss); }
  function dogur(tur, nereden) {
    if (!window.DUSMAN || typeof DUSMAN.dogur !== 'function') return null;
    var x, y, e, aci = nereden === 'arka' ? -Math.PI / 2 : Math.PI / 2;
    if (etkinArena && BOLUM.arenaKilitli) { // kilitli arenada tamamen görünür arena sınırları içinde doğur (dışarıda bekleme yok)
      var aSol = ARENA_YAN[0] + 60, aSag = ARENA_YAN[1] - 60, aUst = kamY + ARENA_UST + 15, aAlt = kamY + H - 80;
      if (nereden === 'arka') { y = aAlt - rast(0, 35); x = rast(Math.max(aSol, 440), aSag); }
      else if (nereden === 'sol') { x = aSol + rast(0, 35); y = rast(aUst + 30, Math.min(aAlt, kamY + H - 200)); aci = 0; }
      else if (nereden === 'sag') { x = aSag - rast(0, 35); y = rast(aUst + 30, aAlt - 20); aci = Math.PI; }
      else if (nereden === 'orta') { y = aUst + rast(0, 35); x = rast(500, 780); }
      else { y = aUst + rast(0, 35); x = rast(aSol, aSag); }
    } else if (nereden === 'arka') { y = kamY + H + rast(50, 110); e = kenar(y); x = rast(e.sol + 45, e.sag - 45); }
    else {
      y = kamY - rast(50, 150); e = kenar(y);
      if (nereden === 'sol') x = OYUN.sinirla(rast(e.sol + 10, Math.min(e.sag - 24, e.sol + 170)), e.sol + 24, e.sag - 24);
      else if (nereden === 'sag') x = OYUN.sinirla(rast(Math.max(e.sol + 24, e.sag - 170), e.sag - 10), e.sol + 24, e.sag - 24);
      else if (nereden === 'orta') { var yx = yolX(y), yy = Math.min(yolYari(y), 200); x = OYUN.sinirla(rast(yx - yy * 0.6, yx + yy * 0.6), e.sol + 30, e.sag - 30); }
      else x = rast(e.sol + 45, e.sag - 45);
    }
    try { return DUSMAN.dogur(tur, x, y, { aci: aci }); }
    catch (err) { console.error('bolum dogur', tur, err); return null; }
  }
  function dalgaGuncelle(w, dt) {
    var l = dusmanListe(), kalabalik = l && l.length >= KALABALIK;
    w.t += dt;
    for (var k = 0; k < w.kuyruk.length; k++) {
      var q = w.kuyruk[k];
      if (q.ok || w.t < q.t) continue;
      if (kalabalik) { q.t = w.t + 0.5; continue; }
      q.ok = true; var d = dogur(q.tur, q.nereden);
      if (d) {
        w.uyeler.push(d);
        if (w.def.arena) { q.dusman = d; q.dusmanId = d.id; }
      }
      l = dusmanListe(); kalabalik = l && l.length >= KALABALIK;
    }
  }
  function dalgaTemiz(w) {
    for (var k = 0; k < w.kuyruk.length; k++) if (!w.kuyruk[k].ok) return false;
    var c = 0; for (k = 0; k < w.uyeler.length; k++) if (canliMi(w.uyeler[k])) c++;
    if (c === 0) return true;
    // ilerleme yok: 12 sn boyunca hiçbir üye ölmediyse ve en fazla 3 kaldıysa dalga bitmiş sayılır (arena kilitlenmesin)
    if (c !== w.sonC) { w.sonC = c; w.sonCT = w.t; }
    if (c <= 3 && w.t - (w.sonCT || 0) > 12) return true;
    return w.t > 90 && c <= 2; // takılı kalan bir iki düşman yüzünden kilitlenmesin
  }
  // okunur tempo: yol dalgası, bir önceki yol dalgası seyrelmeden (≤2 canlı) başlamaz → iki dalga üst üste binip yığılmaz.
  // Oyuncu koşup geçerse (kamera tetiği 380 px aştıysa) yine başlar: ölü bekleme olmasın.
  function oncekiSeyrek(i) {
    var p = i > 0 ? dalgalar[i - 1] : null;
    if (!p || p.def.arena || p.bitti) return true;
    if (!p.basladi) return false; // sıra bozulmasın: öncekinden önce başlama
    if (kamY < dalgalar[i].def.tetik - 380) return true;
    for (var k = 0; k < p.kuyruk.length; k++) if (!p.kuyruk[k].ok) return false;
    var c = 0; for (k = 0; k < p.uyeler.length; k++) if (canliMi(p.uyeler[k])) c++;
    return c <= 2;
  }
  function arenaBaslat(a, ilk) {
    a.basladi = true; a.i = ilk || 0; a.bekle = 0.6; etkinArena = a;
    BOLUM.arenaKilitli = true;
    olay('arena', { acik: false, ad: a.isim });
  }
  function arenaGuncelle(a, dt) {
    var w = a.i >= 0 && a.i < a.sira.length ? dalgalar[a.sira[a.i]] : null;
    if (w && !w.basladi) { a.bekle -= dt; if (a.bekle <= 0) dalgaBaslat(w.i); return; }
    if (w && w.basladi && dalgaTemiz(w)) {
      w.bitti = true; a.i++; a.bekle = w.def.nefes || 1.8;
      if (a.i >= a.sira.length) { a.bitti = true; etkinArena = null; BOLUM.arenaKilitli = false; olay('arena', { acik: true, ad: a.isim }); }
    }
  }
  function siradakiDurak() { // kameranın geçemeyeceği en yakın y
    var d = 0;
    for (var ad in arenalar) { var a = arenalar[ad]; if (!a.bitti && a.kamY <= kamY + 1 && a.kamY > d) d = a.kamY; }
    return d;
  }
  function ekrandakiDusman() {
    var l = dusmanListe(); if (!l) return 0;
    var n = 0; for (var i = 0; i < l.length; i++) { var d = l[i]; if (d && !d.olu && !bossMu(d) && d.y > kamY - 20 && d.y < kamY + H) n++; }
    return n;
  }

  // =====================================================================
  // KAMERA ve SINIR
  // =====================================================================
  // Kamera: kritik sönümlü yay (titreşimsiz, aşmasız). Hedef = oyuncuyu ODAK_Y'de tutan y (− öne bakış).
  // Yalnız ileri (yukarı) gider; en ileri noktadan (kamIleri) en fazla GERI px geri döner. Arena/dev durağında yumuşakça durur.
  var kamV = 0, kamIleri = L - H, bakis = 0, oncekiOy = null, oyalanT = 0, surun = 0, geriYok = false;
  function kameraGuncelle(dt) {
    var O = window.OYUNCU, durak = siradakiDurak(), hedef = kamY;
    var kilit = BOLUM.arenaKilitli && (etkinArena || devBasladi);
    if (O && isFinite(O.y)) {
      // oyuncunun dikey hızı (yumuşatılmış) → öne bakış
      var vy = oncekiOy === null ? 0 : (O.y - oncekiOy) / dt; oncekiOy = O.y;
      var bh = vy < -40 ? BAKIS * Math.min(1, -vy / 200) : 0;
      bakis += (bh - bakis) * Math.min(1, dt * 2.5);
      hedef = O.y - ODAK_Y - bakis;
      // oyalanma: ekranda düşman yok, oyuncu ilerlemiyor → çok yavaş ilerle (oyuncu alt kenara yaklaşınca dur: itme yok)
      var ilerliyor = hedef < kamIleri - 2;
      if (!kilit && !ilerliyor && ekrandakiDusman() === 0) oyalanT += dt; else oyalanT = 0;
      var surunHedef = oyalanT > OYALANMA && (O.y - kamY) < H - 150 ? SURUN_HIZ : 0;
      surun += (surunHedef - surun) * Math.min(1, dt * 0.8);
      if (surun > 0.3) { hedef = Math.min(hedef, kamY - surun * KAM_SURE * 2); geriYok = true; }
      if (ilerliyor) geriYok = false;
    }
    hedef = Math.min(hedef, kamIleri + (geriYok ? 0 : GERI)); // en fazla GERI px geri (yavaş ilerlemeden sonra hiç)
    if (kilit) hedef = Math.max(durak, kamY);           // kilitliyken ileri gitme (durağa yerleşmeyi yay bitirir)
    hedef = Math.max(durak, Math.min(L - H, hedef));
    if (kilit && etkinArena) hedef = etkinArena.kamY;
    if (devBasladi) hedef = 0;
    // kritik sönümlü yay (SmoothDamp)
    var om = 2 / KAM_SURE, x = om * dt, ex = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    var deg = kamY - hedef, mx = KAM_MAX * KAM_SURE; deg = OYUN.sinirla(deg, -mx, mx);
    var tmp = (kamV + om * deg) * dt;
    kamV = (kamV - om * tmp) * ex;
    var yeni = (kamY - deg) + (deg + tmp) * ex;
    if (Math.abs(yeni - hedef) < 0.05 && Math.abs(kamV) < 1) { yeni = hedef; kamV = 0; }
    yeni = Math.max(durak, Math.min(L - H, yeni));
    BOLUM.kaymaHiz = (yeni - kamY) / dt;
    kamY = yeni;
    if (kamY < kamIleri) kamIleri = kamY;
    kameraUygula();
  }
  function gostergeIlerlemesiniGuncelle() {
    var tamam = 0;
    for (var ad in arenalar) {
      var arena = arenalar[ad];
      if (arena.bitti) { tamam += arena.sira.length; continue; }
      if (arena !== etkinArena) continue;
      tamam += arena.i;
      var dalga = dalgalar[arena.sira[arena.i]];
      if (!dalga || !dalga.kuyruk.length) continue;
      var gecilen = 0;
      for (var i = 0; i < dalga.kuyruk.length; i++) {
        var q = dalga.kuyruk[i], d = q.dusman;
        // A dead enemy may already have been recycled for a later wave.
        if (q.ok && (!d || d.id !== q.dusmanId || d.olu)) gecilen++;
      }
      tamam += gecilen / dalga.kuyruk.length;
    }
    // Walking and the two mandatory arenas share the same route indicator.
    // The camera distance stays available separately for gameplay and the run summary.
    var dovus = arenaDalgaSayisi ? tamam / arenaDalgaSayisi : BOLUM.ilerleme;
    var pay = BOLUM.ilerleme * .65 + dovus * .35;
    BOLUM.gostergeIlerlemesi = Math.max(BOLUM.gostergeIlerlemesi, Math.min(1, pay));
  }
  function kameraUygula() {
    if (!OYUN.kamera) return;
    OYUN.kamera.y = kamY; OYUN.kamera.hedefY = null;
    BOLUM.ilerleme = OYUN.sinirla(1 - kamIleri / (L - H), 0, 1);
  }
  // Düşman sınırı (DUSMAN çağırır: BOLUM.dusmanSinirla(e); bolum.js de güvence olarak her kare uygular)
  function dusmanSinirGuncelle() {
    var d = BOLUM.dusmanSinir || (BOLUM.dusmanSinir = { sol: 0, sag: W, ust: 0, alt: 0 });
    if (BOLUM.arenaKilitli && etkinArena) { d.sol = ARENA_YAN[0]; d.sag = ARENA_YAN[1]; d.ust = kamY + ARENA_UST - 50; d.alt = kamY + H - DUS_ALT; }
    else if (BOLUM.arenaKilitli) { d.sol = DUS_YAN; d.sag = W - DUS_YAN; d.ust = kamY + DUS_UST; d.alt = kamY + H - DUS_ALT; }
    else { d.sol = 20; d.sag = W - 20; d.ust = kamY - 260; d.alt = kamY + H + 220; }
    BOLUM.dusmanSinirSiki = BOLUM.arenaKilitli;
  }
  function dusmanSinirla(e) {
    if (!e || bossMu(e) || !isFinite(e.x) || !isFinite(e.y)) return;
    var d = BOLUM.dusmanSinir; if (!d) return;
    var r = e.r || 16;
    if (BOLUM.arenaKilitli) {
      var ic = e.x >= d.sol && e.x <= d.sag && e.y >= d.ust && e.y <= d.alt;
      if (ic) { e._bIcerde = true; e._bDisT = 0; }
      if (e._bIcerde) { // içeri girdi: artık görünür alanda kalır
        e.x = OYUN.sinirla(e.x, d.sol + r * 0.5, d.sag - r * 0.5); e.y = OYUN.sinirla(e.y, d.ust, d.alt); return;
      }
      // henüz girmedi (yürüyerek giriyor): yalnız geniş sınır
      e.x = OYUN.sinirla(e.x, 20, W - 20); e.y = OYUN.sinirla(e.y, kamY - 260, kamY + H + 220);
      return;
    }
    e._bIcerde = false;
    e.x = OYUN.sinirla(e.x, d.sol, d.sag); e.y = OYUN.sinirla(e.y, d.ust, d.alt);
  }
  function takiliKurtar(dt) { // kilitliyken oyuncunun erişemeyeceği yerdeki düşmanı erişilebilir yere al
    var l = dusmanListe(), s = BOLUM.sinir; if (!l || !BOLUM.arenaKilitli) return;
    for (var i = 0; i < l.length; i++) {
      var e = l[i]; if (!e || e.olu || bossMu(e)) continue;
      var p = 40 + (e.r || 16);
      var dis = e.x < s.sol - p || e.x > s.sag + p || e.y < s.ust - p - 60 || e.y > s.alt + p;
      if (!dis) { e._bTakiliT = 0; continue; }
      e._bTakiliT = (e._bTakiliT || 0) + dt;
      if (e._bTakiliT > TAKILI_SURE) { e.x = OYUN.sinirla(e.x, s.sol + 30, s.sag - 30); e.y = OYUN.sinirla(e.y, s.ust + 20, s.alt - 20); e._bTakiliT = 0; e._bIcerde = true; if (e.girdi === false) e.girdi = true; }
    }
  }
  function dusmanlariSinirla(dt) {
    dusmanSinirGuncelle();
    takiliKurtar(dt);
    if (window.DUSMAN && DUSMAN.sinirKendi === true) return; // dusman.js kendi sınırını uyguluyor
    var l = dusmanListe(); if (!l) return;
    var d = BOLUM.dusmanSinir;
    for (var i = 0; i < l.length; i++) {
      var e = l[i]; if (!e || e.olu || bossMu(e)) continue;
      if (BOLUM.arenaKilitli && !e._bIcerde) { // 8 sn'den uzun dışarıda kalan → kenardan içeri al
        e._bDisT = (e._bDisT || 0) + dt;
        if (e._bDisT > DUS_DIS_SURE) { e.x = OYUN.sinirla(e.x, d.sol + 40, d.sag - 40); e.y = OYUN.sinirla(e.y, d.ust + 10, d.alt - 10); e._bIcerde = true; e._bDisT = 0; }
      }
      dusmanSinirla(e);
    }
  }
  BOLUM.dusmanSinirla = dusmanSinirla;
  // ---------------------------------------------------------------------
  // KATI ENGELLER (19 Kasım): ev, kilise, çit, kaya, araba, kuyu, kazık, enkaz artık içinden geçilmez.
  // Hem barbar hem düşmanlar için geçerli; düşman engele takılınca kenarından dolanır.
  // Dar geçitler (DARLAR) düşmanlara da uygulanır (eskiden yalnız barbara uygulanıyordu → erişilemeyen düşman).
  // ---------------------------------------------------------------------
  var engeller = [], ayazSur = [], ayazAtisEngelleri = [], oncekiSurX = null, oncekiSurY = null, ENGEL_YOK = { mesale: 1, ayaz_mesale: 1, can_sisesi: 1, koz_cukur: 1 };
  function engelKur() {
    engeller = []; ayazSur = []; ayazAtisEngelleri = [];
    for (var i = 0; i < dekorlar.length; i++) {
      var d = dekorlar[i], t = d.ad.replace(/_\d+$/, ''); if (ENGEL_YOK[t] || !d.tb) continue;
      if (t === "ayaz_kemer") {
        var kapsam = d.boy * .43, ayak = d.boy * .19, derin = d.boy * .18;
        engeller.push({ x1:d.x-kapsam, x2:d.x-kapsam+ayak, y1:d.y-derin, y2:d.y, t:t, kapali:false });
        engeller.push({ x1:d.x+kapsam-ayak, x2:d.x+kapsam, y1:d.y-derin, y2:d.y, t:t, kapali:false });
        continue;
      }
      var w = d.tb[0], h = d.tb[1];
      if (t === 'agac_olu') { w = Math.min(w, 40); h = Math.min(h, 28); }   // yalnız gövde
      if (t === 'cit') h = Math.max(h, 18);
      if (!(w > 12) || !(h > 6)) continue;
      var en = { x1: d.x - w / 2, x2: d.x + w / 2, y1: d.y - h, y2: d.y, t: t, kapali: false };
      if (d._varil) d._varil.engel = en;
      engeller.push(en);
      if (t === 'ayaz_kaya' || t === 'ayaz_yamac') ayazAtisEngelleri.push(en);
    }
    BOLUM.engeller = engeller;
  }
  // Dünya düzlemindeki atış hattının ilk taş/sur/kapı teması. Açık kapı yana geçişi engellemez.
  BOLUM.ayazAtisEngeli = function (x0, y0, x1, y1) {
    if (aktifBolum() !== 3 || !isFinite(x0) || !isFinite(y0) || !isFinite(x1) || !isFinite(y1)) return null;
    var dx = x1 - x0, dy = y1 - y0, ilk = Infinity;
    var sol = Math.min(x0, x1), sag = Math.max(x0, x1);
    var ust = Math.min(y0, y1), alt = Math.max(y0, y1);
    for (var i = 0; i < ayazAtisEngelleri.length; i++) {
      var e = ayazAtisEngelleri[i];
      if (e.kapali || sag < e.x1 || sol > e.x2 || alt < e.y1 || ust > e.y2) continue;
      var tg = 0, tc = 1;
      if (dx !== 0) {
        var gX = ((dx > 0 ? e.x1 : e.x2) - x0) / dx, cX = ((dx > 0 ? e.x2 : e.x1) - x0) / dx;
        tg = Math.max(tg, gX); tc = Math.min(tc, cX);
      }
      if (dy !== 0) {
        var gY = ((dy > 0 ? e.y1 : e.y2) - y0) / dy, cY = ((dy > 0 ? e.y2 : e.y1) - y0) / dy;
        tg = Math.max(tg, gY); tc = Math.min(tc, cY);
      }
      // Bir kenarda başlayıp doğrudan dışarı giden atışa engel olma.
      if (tg > tc || tc <= 0) continue;
      if (tg < ilk) ilk = tg;
      if (ilk === 0) return 0;
    }
    return ilk === Infinity ? null : ilk;
  };
  // (x,y) ayak noktası, r yarıçap. Engelin içindeyse en kısa yoldan dışarı iter; {x,y,eks,e} ya da null döner.
  function engelIt(o, r, liste) {
    var engelListesi = liste || engeller, son = null, ry = r * 0.55;
    for (var tur = 0; tur < 2; tur++) {
      var itti = false;
      for (var i = 0; i < engelListesi.length; i++) {
        var e = engelListesi[i];
        if (e.kapali) continue;
        if (o.y < e.y1 - ry || o.y > e.y2 + ry || o.x < e.x1 - r || o.x > e.x2 + r) continue;
        var sol = o.x - (e.x1 - r), sag = (e.x2 + r) - o.x, ust = o.y - (e.y1 - ry), alt = (e.y2 + ry) - o.y;
        var m = Math.min(sol, sag, ust, alt);
        if (m <= 0) continue;
        if (m === sol) { o.x = e.x1 - r; son = { eks: 'x', e: e }; }
        else if (m === sag) { o.x = e.x2 + r; son = { eks: 'x', e: e }; }
        else if (m === ust) { o.y = e.y1 - ry; son = { eks: 'y', e: e }; }
        else { o.y = e.y2 + ry; son = { eks: 'y', e: e }; }
        itti = true;
      }
      if (!itti) break;
    }
    return son;
  }
  BOLUM.engelIt = engelIt;
  function darUygula(e) { // dar geçit: barbarla aynı kural
    for (var i = 0; i < DARLAR.length; i++) {
      var d = DARLAR[i];
      if (e.y >= d.y1 && e.y <= d.y2) { if (e.x < d.sol) e.x = d.sol; else if (e.x > d.sag) e.x = d.sag; }
    }
  }
  function suraCarp(o, r) {
    var dx = o.x - oncekiSurX, dy = o.y - oncekiSurY;
    if (oncekiSurX === null || Math.abs(dy) < .01 || Math.abs(dy) > 175 || Math.abs(dx) > 175) return;
    var ry = r * .55;
    for (var i = 0; i < ayazSur.length; i++) {
      var e = ayazSur[i];
      if (e.kapali) continue;
      var y = dy > 0 ? e.y1 - ry : e.y2 + ry;
      var t = (y - oncekiSurY) / dy;
      if (t < 0 || t > 1) continue;
      var x = oncekiSurX + dx * t;
      if (x < e.x1 - r || x > e.x2 + r) continue;
      o.y = y + (dy > 0 ? -.02 : .02);
      return;
    }
  }
  function engelleriUygula(dt) {
    var O = window.OYUNCU, l = dusmanListe();
    if (O && isFinite(O.x) && isFinite(O.y)) {
      var r = (O.r || 18) * .8, ayaz = aktifBolum() === 3;
      if (ayaz) suraCarp(O, r);
      engelIt(O, r);
      if (ayaz) { oncekiSurX = O.x; oncekiSurY = O.y; }
    }
    if (!l) return;
    for (var i = 0; i < l.length; i++) {
      var e = l[i]; if (!e || e.olu || bossMu(e) || !isFinite(e.x) || !isFinite(e.y)) continue;
      var er = (e.r || 16) * 0.8;
      if (e.havaH > 2) { if (ayazSur.length) engelIt(e, er, ayazSur); continue; }
      darUygula(e);
      if (e._bGecT > 0) {
        e._bGecT -= dt; e._bEngT = 0;
        if (ayazSur.length) engelIt(e, er, ayazSur);
        continue;
      }
      var c = engelIt(e, er);
      if (!c || !O) { e._bEngT = Math.max(0, (e._bEngT || 0) - dt * 0.5); continue; }
      if (c.e.t === 'ayaz_sur' || c.e.t === 'ayaz_kapi') {
        var kapi = ayazSur[0];
        if (c.e !== kapi) {
          var fark = (kapi.x1 + kapi.x2) * .5 - e.x;
          var yana = (e.hiz || 100) * dt * .9;
          e.x += OYUN.sinirla(fark, -yana, yana);
          engelIt(e, er, ayazSur);
        }
        e._bEngT = 0;
        continue;
      }
      // Dekora takılan düşman, dalgayı durdurmamak için bir süre dekoru yok sayar.
      e._bEngT = (e._bEngT || 0) + dt;
      if (e._bEngT > 1.3) { e._bGecT = 1.6; e._bEngT = 0; continue; }
      // engelin kenarından dolan: barbara giden yolu kısaltan uca doğru kay
      var en = c.e, adim = (e.hiz || 100) * 0.9 * dt, p = (e.r || 16) * 0.8 + 6;
      if (c.eks === 'x') {
        var a1 = en.y1 - p, a2 = en.y2 + p;
        var m1 = Math.abs(e.y - a1) + Math.hypot(O.x - e.x, O.y - a1), m2 = Math.abs(e.y - a2) + Math.hypot(O.x - e.x, O.y - a2);
        e.y += (m1 < m2 ? -1 : 1) * adim;
      } else {
        var b1 = en.x1 - p, b2 = en.x2 + p;
        var n1 = Math.abs(e.x - b1) + Math.hypot(O.x - b1, O.y - e.y), n2 = Math.abs(e.x - b2) + Math.hypot(O.x - b2, O.y - e.y);
        e.x += (n1 < n2 ? -1 : 1) * adim;
      }
      engelIt(e, er);
    }
  }
  function sinirGuncelle() {
    var s = BOLUM.sinir, O = window.OYUNCU;
    s.sol = 90; s.sag = 1190; s.ust = kamY + OYUNCU_UST; s.alt = kamY + H - OYUNCU_ALT;
    if (BOLUM.arenaKilitli && etkinArena) { s.ust = kamY + ARENA_UST; s.sol = ARENA_YAN[0]; s.sag = ARENA_YAN[1]; }
    if (!O) return;
    if (!isFinite(O.x) || !isFinite(O.y)) { // güvenlik: bir itme/ışınlama konumu bozduysa son geçerli yere al (kamera NaN'a kilitlenmesin)
      if (!sonGecerli) return;
      O.x = sonGecerli.x; O.y = sonGecerli.y; BOLUM.nanKurtarma = (BOLUM.nanKurtarma || 0) + 1;
      ['vx', 'vy', 'dvx', 'dvy'].forEach(function (k) { if (typeof O[k] === 'number' && !isFinite(O[k])) O[k] = 0; });
    }
    var ust0 = s.ust;
    for (var i = 0; i < DARLAR.length; i++) {
      var d = DARLAR[i];
      if (O.y >= d.y1 && O.y <= d.y2) { s.sol = Math.max(s.sol, d.sol); s.sag = Math.min(s.sag, d.sag); }
      else if (O.x < d.sol || O.x > d.sag) {
        if (O.y > d.y2) s.ust = Math.max(s.ust, d.y2 + 1);
        else s.alt = Math.min(s.alt, d.y1 - 1);
      }
    }
    if (s.alt < s.ust + 20) { // ekranın alt kenarı oyuncuyu dar geçide itiyor → yana kaydır
      s.ust = ust0;
      for (i = 0; i < DARLAR.length; i++) { d = DARLAR[i]; if (O.y > d.y2 - 40 && O.y < d.y2 + 300) { s.sol = Math.max(s.sol, d.sol); s.sag = Math.min(s.sag, d.sag); } }
    }
    // alt kenar: görünmez duvara çarpma yerine son ALT_YUM px'de aşağı yürüyüş yavaşlayarak durur
    if (oncekiAltY !== null && O.y > oncekiAltY && O.y > s.alt - ALT_YUM && oncekiAltY < s.alt) {
      var f = OYUN.sinirla((s.alt - oncekiAltY) / ALT_YUM, 0, 1);
      O.y = oncekiAltY + (O.y - oncekiAltY) * f * f * (3 - 2 * f);
    }
    if (O.y > s.alt) O.y = s.alt;
    if (O.y < s.ust) O.y = s.ust;
    if (O.x < s.sol) O.x = s.sol; if (O.x > s.sag) O.x = s.sag;
    oncekiAltY = O.y;
    sonGecerli = { x: O.x, y: O.y };
  }
  var oncekiAltY = null, ALT_YUM = 110, sonGecerli = null;

  // =====================================================================
  // BÖLÜM II ETKİLEŞİM: YAĞ VARİLLERİ & PERİYODİK KÖZ ÇUKURLARI
  // =====================================================================
  var VARIL_PATLA_R = 155, VARIL_DUS_HASAR = 95, VARIL_OYU_HASAR = 16;
  var KOZ_SONUK = 5.5, KOZ_UYARI = 1.5, KOZ_AKTIF = 2.5, KOZ_DONGU = KOZ_SONUK + KOZ_UYARI + KOZ_AKTIF;

  function varilPatlat(v) {
    if (!v || !v.aktif || v.patladi) return false;
    v.aktif = false; v.patladi = true; v.patliyor = false;
    if (v.engel) v.engel.kapali = true;
    if (v.d) {
      v.d.gizli = true;
      if (v.d.s) { try { v.d.s.destroy(); } catch (e) {} v.d.s = null; }
    }
    v.sprite = null;

    var vx = v.x, vy = v.y, r = VARIL_PATLA_R;
    // Düşmanlara yüksek hasar + zırh kıran ağır darbe
    var l = dusmanListe();
    if (l && window.DUSMAN && typeof DUSMAN.hasarVer === 'function') {
      var kopya = l.slice();
      for (var i = 0; i < kopya.length; i++) {
        var d = kopya[i];
        if (!d || d.olu) continue;
        if (Math.hypot(d.x - vx, d.y - vy) <= r) {
          try {
            DUSMAN.hasarVer(d, VARIL_DUS_HASAR, {
              aci: Math.atan2(d.y - vy, d.x - vx),
              guc: 320,
              tur: 'patlama',
              agir: true,
              x: vx, y: vy
            });
          } catch (e) { console.error('bolum varil dusman', e); }
        }
      }
    }
    if (window.VARGOR && VARGOR.aktif && !VARGOR.olu && typeof VARGOR.hasarAl === 'function' && (!l || l.indexOf(VARGOR) < 0)) {
      if (Math.hypot((VARGOR.x || 0) - vx, (VARGOR.y || 0) - vy) <= r + (VARGOR.r || 42)) {
        try { VARGOR.hasarAl(VARIL_DUS_HASAR, { aci: Math.atan2(VARGOR.y - vy, VARGOR.x - vx), guc: 240, agir: true, tur: 'patlama', x: vx, y: vy }); }
        catch (e) {}
      }
    }
    // Yakındaki oyuncuya patlama hasarı
    var O = window.OYUNCU;
    if (O && O.canli !== false && Math.hypot(O.x - vx, O.y - vy) <= r && typeof O.hasarAl === 'function') {
      try {
        O.hasarAl(VARIL_OYU_HASAR, {
          x: vx, y: vy,
          aci: Math.atan2(O.y - vy, O.x - vx),
          guc: 260,
          tur: 'patlama',
          kaynak: 'varil'
        });
      } catch (e) { console.error('bolum varil oyuncu', e); }
    }
    // Kısa süreli yanma alanı
    try {
      if (window.DUSMAN && typeof DUSMAN.atesEkle === 'function') DUSMAN.atesEkle(vx, vy, 82, 3.0);
    } catch (e) {}

    varilEfektler.push({ x: vx, y: vy, r: r, t: 0, sure: 0.42 });
    olay('varilPatla', { x: vx, y: vy, r: r });

    // Yakındaki diğer aktif yağ varillerini zincirleme patlat
    for (var j = 0; j < variller.length; j++) {
      var b = variller[j];
      if (!b || !b.aktif || b.patladi || b === v) continue;
      if (Math.hypot(b.x - vx, b.y - vy) <= r) varilPatlat(b);
    }
    return true;
  }

  function varilVur(x, y, r, hasar) {
    if (!isFinite(x) || !isFinite(y)) return 0;
    if (aktifBolum() === 3) return AYAZ.kapiVur(x,y,r == null ? 55 : r,hasar == null ? 20 : hasar);
    if (!variller.length) return 0;
    var menzil = (r === undefined || r === null) ? 55 : r;
    var hs = (hasar === undefined || hasar === null) ? 20 : hasar;
    var vurulan = [], tetik = 0;
    for (var i = 0; i < variller.length; i++) {
      var v = variller[i];
      if (!v || !v.aktif || v.patladi) continue;
      if (Math.hypot(v.x - x, v.y - y) <= menzil + (v.r || 32)) vurulan.push(v);
    }
    for (var j = 0; j < vurulan.length; j++) {
      var b = vurulan[j];
      if (!b.aktif || b.patladi) continue;
      b.can -= hs;
      tetik++;
      if (b.can <= 0) varilPatlat(b);
      else if (b.sprite) b.sprite.tint = 0xff9966;
    }
    return tetik;
  }

  function kozlerGuncelle(dt) {
    if (!kozler.length || !dt) return;
    var O = window.OYUNCU, l = dusmanListe();
    for (var i = 0; i < kozler.length; i++) {
      var k = kozler[i];
      k.zaman = (k.zaman + dt) % KOZ_DONGU;
      if (k.zaman < KOZ_SONUK) {
        k.faz = 'sonuk'; k.uyari = false; k.aktif = false; k.sicak = false; k.hasarT = 0;
      } else if (k.zaman < KOZ_SONUK + KOZ_UYARI) {
        k.faz = 'uyari'; k.uyari = true; k.aktif = false; k.sicak = false; k.hasarT = 0;
      } else {
        k.faz = 'aktif'; k.uyari = false; k.aktif = true; k.sicak = true;
        k.hasarT -= dt;
        if (k.hasarT <= 0) {
          k.hasarT = 0.6;
          var yandi = false;
          if (O && O.canli !== false && Math.hypot(O.x - k.x, O.y - k.y) <= k.r && typeof O.hasarAl === 'function') {
            try {
              O.hasarAl(8, { x: k.x, y: k.y, aci: Math.atan2(O.y - k.y, O.x - k.x), guc: 25, tur: 'ates', kaynak: 'koz' });
              yandi = true;
            } catch (e) {}
          }
          if (l && window.DUSMAN && typeof DUSMAN.hasarVer === 'function') {
            var kopya = l.slice();
            for (var j = 0; j < kopya.length; j++) {
              var d = kopya[j];
              if (!d || d.olu) continue;
              if (Math.hypot(d.x - k.x, d.y - k.y) <= k.r) {
                try {
                  DUSMAN.hasarVer(d, 12, { aci: Math.atan2(d.y - k.y, d.x - k.x), guc: 0, tur: 'ates', x: k.x, y: k.y });
                  yandi = true;
                } catch (e) {}
              }
            }
          }
          if (yandi) olay('kozYan', { x: k.x, y: k.y });
        }
      }
      kozSpriteSenk(k);
    }
  }

  function etkilesimGorsel(gdt) {
    if (!window.PIXI || !PIXI.Graphics || !OYUN.katman) return;
    if (OYUN.katman.leke) {
      if (!kozG) { kozG = new PIXI.Graphics(); OYUN.katman.leke.addChild(kozG); }
      kozG.clear();
      var ust = gorusUst() - 100, alt = gorusAlt() + 100;
      for (var i = 0; i < kozler.length; i++) {
        var k = kozler[i];
        if (k.y + k.r < ust || k.y - k.r > alt) continue;
        if (k.faz === 'uyari') {
          var fl = 0.45 + 0.55 * Math.sin(k.zaman * 22);
          kozG.lineStyle(3, 0xff8c24, 0.45 + fl * 0.4);
          kozG.drawEllipse(k.x, k.y, k.r * 1.02, k.r * 0.56);
          kozG.lineStyle(0);
          kozG.beginFill(0xff5511, 0.14 * fl);
          kozG.drawEllipse(k.x, k.y, k.r * 0.9, k.r * 0.5);
          kozG.endFill();
        } else if (k.faz === 'aktif') {
          var nab = 0.85 + 0.15 * Math.sin(k.zaman * 14);
          kozG.lineStyle(3, 0xffcc44, 0.72 * nab);
          kozG.drawEllipse(k.x, k.y, k.r, k.r * 0.55);
          kozG.lineStyle(0);
          kozG.beginFill(0xff4408, 0.28 * nab);
          kozG.drawEllipse(k.x, k.y, k.r * 0.95, k.r * 0.52);
          kozG.endFill();
        }
      }
    }
    if (OYUN.katman.efekt) {
      if (!efektG) { efektG = new PIXI.Graphics(); OYUN.katman.efekt.addChild(efektG); }
      efektG.clear();
      for (var j = varilEfektler.length - 1; j >= 0; j--) {
        var ef = varilEfektler[j];
        ef.t += gdt;
        if (ef.t >= ef.sure) { varilEfektler.splice(j, 1); continue; }
        var p = ef.t / ef.sure, rr = ef.r * (0.25 + 0.75 * p), al = 1 - p;
        efektG.lineStyle(6 * al, 0xffaa33, 0.85 * al);
        efektG.drawCircle(ef.x, ef.y, rr);
        efektG.lineStyle(0);
        efektG.beginFill(0xff5511, 0.36 * al);
        efektG.drawCircle(ef.x, ef.y, rr * 0.78);
        efektG.endFill();
      }
    }
  }

  // =====================================================================
  // KURULUM / IŞINLAMA
  // =====================================================================
  function temizleHepsi() {
    for (var k in parcalar) parcaSil(+k);
    dekorTemizle();
    varilEfektler = [];
    if (kozG) { try { kozG.clear(); } catch (e) {} }
    if (efektG) { try { efektG.clear(); } catch (e) {} }
  }
  function kur() {
    temizleHepsi();
    oncekiSurX = oncekiSurY = null;
    var b = aktifBolum();
    if (kuruluBolum !== b) {
      dokuOnbellek = {}; yamaOnbellek = {}; cesitSay = {};
      oncekiHazir = false;
    }
    senaryoSec();
    yerlesimKur();
    BOLUM.atesler = BOLUM.atesler || [];
    dalgaKur(); canlariKur();
    kamY = L - H; devBasladi = false; devIstek = false; ilkKare = true; isinlaKonum = null;
    BOLUM.arenaKilitli = false; BOLUM.dalgaNo = 0; BOLUM.bitti = false;
    BOLUM.baslangic = { x: 640, y: L - 200 };
    var dn = parseInt(OYUN.param('dalga'), 10);
    if (OYUN.param('dev') !== null) isinlaDev();
    else if (dn >= 1) isinla(dn);
    oncekiAltY = null; kamIleri = kamY; kamV = 0; bakis = 0; oncekiOy = null; oyalanT = 0; surun = 0; geriYok = true; BOLUM.kaymaHiz = 0;
    BOLUM.gostergeIlerlemesi = 0;
    kameraUygula();
    gostergeIlerlemesiniGuncelle();
    BOLUM.sinir.ust = kamY + OYUNCU_UST; BOLUM.sinir.alt = kamY + H - OYUNCU_ALT;
    dusmanSinirGuncelle();
    if (OYUN.gorusOtur) OYUN.gorusOtur();
    parcalarGuncelle(0); dekorGuncelle();
  }
  function isinla(n) {
    if (n > DALGALAR.length) { isinlaDev(); return; }
    var hedef = n - 1, w = DALGALAR[hedef];
    for (var i = 0; i < hedef; i++) { dalgalar[i].basladi = true; dalgalar[i].bitti = true; }
    if (w.arena) {
      var a = arenalar[w.arena];
      kamY = a.kamY;
      for (var ad in arenalar) if (arenalar[ad].kamY > a.kamY) arenalar[ad].bitti = true;
      arenaBaslat(a, a.sira.indexOf(hedef));
    } else {
      kamY = Math.min(L - H, w.tetik + 40);
      for (ad in arenalar) if (arenalar[ad].kamY > kamY) arenalar[ad].bitti = true;
    }
    BOLUM.baslangic = { x: OYUN.sinirla(yolX(kamY + 520), 200, 1080), y: kamY + 520 };
    isinlaKonum = BOLUM.baslangic;
  }
  function isinlaDev() {
    dalgalar.forEach(function (w) { w.basladi = true; w.bitti = true; });
    for (var ad in arenalar) arenalar[ad].bitti = true;
    kamY = 0; BOLUM.baslangic = { x: 640, y: 600 }; isinlaKonum = BOLUM.baslangic;
  }
  function devKontrol() {
    if (devBasladi || kamY > 0.5) return;
    devBasladi = true; BOLUM.arenaKilitli = true;
    if (aktifBolum() === 3) {
      olay('arena', { acik: false, ad: 'İşaret Kulesi' });
      if (window.SKARN) SKARN.basla(SKARN_YER.x, SKARN_YER.y);
    } else if (aktifBolum() === 2) {
      olay('arena', { acik: false, ad: 'Sönmeyen Ocak' });
      try { if (window.VARGOR && typeof VARGOR.basla === 'function' && !VARGOR.aktif) VARGOR.basla(VARGOR_YER.x, VARGOR_YER.y); }
      catch (e) { console.error('bolum VARGOR.basla', e); }
    } else {
      olay('arena', { acik: false, ad: 'Devin alanı' });
      try { if (window.DEV && typeof DEV.basla === 'function' && !DEV.aktif) DEV.basla(DEV_YER.x, DEV_YER.y); }
      catch (e) { console.error('bolum DEV.basla', e); }
    }
  }

  // =====================================================================
  // DÖNGÜ
  // =====================================================================
  function guncelle(dt) {
    if (ilkKare) {
      ilkKare = false;
      var O = window.OYUNCU;
      if (isinlaKonum && O) { O.x = isinlaKonum.x; O.y = isinlaKonum.y; }
      kameraUygula(); if (OYUN.gorusOtur) OYUN.gorusOtur();   // görüş penceresi ışınlanan barbara anında otursun
      oncekiAltY = null;
      oncekiOy = null;
    }
    if (!dt) { sinirGuncelle(); return; }
    kameraGuncelle(dt);
    // tetikli dalgalar
    for (var i = 0; i < dalgalar.length; i++) {
      var w = dalgalar[i];
      if (!w.basladi && !w.def.arena && kamY <= w.def.tetik && oncekiSeyrek(i)) dalgaBaslat(i);
      if (w.basladi && !w.bitti) { dalgaGuncelle(w, dt); if (!w.def.arena && dalgaTemiz(w)) w.bitti = true; }
    }
    // arenalar
    for (var ad in arenalar) { var a = arenalar[ad]; if (!a.basladi && !a.bitti && kamY <= a.kamY + 0.5) arenaBaslat(a); }
    if (etkinArena) arenaGuncelle(etkinArena, dt);
    gostergeIlerlemesiniGuncelle();
    devKontrol();
    canlarGuncelle(dt);
    // fırlatılan balta aktif yağ variline çarparsa patlat
    if (variller.length && window.OYUNCU && OYUNCU.balta) {
      varilVur(OYUNCU.balta.x, OYUNCU.balta.y, 26, 25);
    }
    kozlerGuncelle(dt);
    sinirGuncelle();
    dusmanlariSinirla(dt);
    engelleriUygula(dt);
  }
  function herKare(gdt) {
    if (OYUN.durum === 'yukleniyor' && !OYUN.bolumGecis?.zemin) return;
    if (OYUN.durum !== 'oyun') kameraUygula();
    var t0 = performance.now();
    try { parcalarGuncelle(gdt || 0); dekorGuncelle(); etkilesimGorsel(gdt || 0); } catch (e) { console.error('bolum çizim', e); }
    var ms = performance.now() - t0; if (ms > (BOLUM.cizimMsEn || 0)) BOLUM.cizimMsEn = ms; // ölçüm: kare başına zemin/dekor hazırlama süresinin en çoğu
  }

  BOLUM.girisHazir = function () {
    var bas = Math.max(0, Math.floor((gorusUst() - 900) / PARCA));
    var son = Math.min(Math.floor((L - 1) / PARCA), Math.floor((gorusAlt() + 40) / PARCA));
    for (var i = bas; i <= son; i++) if (!parcalar[i] || parcalar[i].gecici) return false;
    return true;
  };

  BOLUM.durumu = function () {
    var w = BOLUM.dalgaNo ? dalgalar[BOLUM.dalgaNo - 1] : null;
    return {
      bolum: aktifBolum(),
      kamY: Math.round(kamY), bolge: bolge(kamY + H / 2), dalga: BOLUM.dalgaNo, arena: etkinArena ? etkinArena.ad : null,
      arenaDalga: etkinArena ? etkinArena.i + 1 : null, kilitli: BOLUM.arenaKilitli, devBasladi: devBasladi,
      bekleyen: w ? w.kuyruk.filter(function (q) { return !q.ok; }).length : 0,
      dogan: dalgalar.reduce(function (s, d) { return s + d.uyeler.length; }, 0),
      parca: Object.keys(parcalar).length, geciciParca: Object.keys(parcalar).filter(function (k) { return parcalar[k].gecici; }).length, dekor: dekorlar.filter(function (d) { return d.s; }).length,
      canAlinan: canlar.filter(function (c) { return c.alindi; }).length,
      canDusurulen: canlar.length,
      variller: variller.filter(function (v) { return v.aktif; }).length,
      kozAktif: kozler.filter(function (k) { return k.aktif; }).length
    };
  };
  BOLUM.bolge = bolge;
  BOLUM.varilVur = varilVur;
  BOLUM.sifirla = kur;
  BOLUM.isinla = isinla;
  BOLUM.isinlaDev = isinlaDev;
  BOLUM._parcaCiz = function (i) { return parcaCiz(i).c; }; // test: zemin parçasını tuval olarak verir
  BOLUM._dekorlar = function () { return dekorlar.map(function (d) { return [d.ad, d.x, d.y]; }); }; // test
  BOLUM._bak = function (y) { kamY = OYUN.sinirla(y, 0, L - H); kameraUygula(); if (OYUN.gorusOtur) OYUN.gorusOtur(); for (var k = 0; k < 40; k++) parcalarGuncelle(0.1); dekorGuncelle(); }; // test: kamerayı (oyun dururken) bir y'ye koy

  if (window.OLAY && typeof OLAY.on === 'function') {
    OLAY.on('bolum', function () { senaryoSec(); });
    OLAY.on('olum', canBirak);
    OLAY.on('savur', function (o) {
      if (aktifBolum() !== 2 || !variller.length || !o || !isFinite(o.x)) return;
      var cx = o.x + Math.cos(o.aci || 0) * 44, cy = o.y + Math.sin(o.aci || 0) * 44;
      varilVur(cx, cy, 78, 25);
    });
    OLAY.on('mermiVur', function (o) {
      if (aktifBolum() !== 2 || !variller.length || !o || !isFinite(o.x)) return;
      varilVur(o.x, o.y, o.r || 54, 20);
    });
    OLAY.on('atesYak', function (o) {
      if (aktifBolum() !== 2 || !variller.length || !o || !isFinite(o.x)) return;
      varilVur(o.x, o.y, o.r || 65, 20);
    });
  }

  OYUN.sistem('bolum', {
    baslat: function () { kur(); },
    guncelle: function (dt) { try { guncelle(dt); } catch (e) { console.error('bolum', e); } },
    sifirla: function () { kur(); },
    herKare: herKare
  });
})();
