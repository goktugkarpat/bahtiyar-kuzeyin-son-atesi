/* Bahtiyar'ın Yolu – DOM arayüzü (sahibi: arayuz). Global: ARAYUZ.
   Başlık, hikâye kartı, oyun göstergesi (kan/öfke şeridi, tuş rozetleri), ilerleme,
   öldürme sayacı, ipuçları, boss can çubuğu, mola, ölüm, zafer. #arayuz, tuvalin dikdörtgenine oturur; içerik 1280×720 ölçeklenir. */
(function () {
  'use strict';
  var W = 1280, H = 720;
  var BOLUM_ADI = ['', 'Yanık Köy', 'Kül Geçidi', 'Ayaz Hisarı'];
  function bolumNo(no) { no = Number(no); return no === 2 || no === 3 ? no : 1; }
  var kok, gost, perdeler = {}, el = {};
  var son = {};               // son yazılan değerler (yalnız değişince DOM'a yaz)
  var ist;                    // bu koşunun istatistikleri
  var ipucu;                  // ipucu durumu
  var BOSS_BILGI = {
    1: { ad: 'GORMAGUL', unvan: 'Kemik Çukurunun Efendisi' },
    2: { ad: 'VARGOR', unvan: 'Sönmeyen Ocağın Efendisi' },
    3: { ad: 'SKARN', unvan: 'Zincir Muhafızı' }
  };
  var HIKAYE_METIN = {
    1: {
      baslik: 'BÖLÜM I — YANIK KÖY',
      metin: 'Bahtiyar, kervanlara kış geçitlerinde yol gösteren bir savaşçıydı. Kafileyle Yanık Köy’de buluşacak, onları dağın öte yanına geçirecekti. Vardığında evler yanmış, meydan boştu. Yıkık kilisenin önündeki taze tekerlek izleri Gormagul’un tuttuğu Kemik Çukuru’na uzanıyordu.'
    },
    2: {
      baslik: 'BÖLÜM II — KÜL GEÇİDİ',
      metin: 'Kemik Çukuru’ndan çıkan izler Vargor’un madenine kadar uzanıyordu. Ocakların yanında açık kafesler, taşta sürüklenmiş zincir izleri vardı. Kafileyi taşıyan arabalar kuzey yoluna çıkmıştı. O yolun sonunda Ayaz Hisarı vardı.'
    },
    3: {
      baslik: 'BÖLÜM III — AYAZ HİSARI',
      metin: 'Bahtiyar kafileyi hisarın avlusunda buldu. Sağ kalanlar Skarn’ın askerleri arasında zincire vurulmuştu. Gün ağardığında arabalar kuzeye yola çıkacaktı. Bahtiyar’ın önce tutsakları hisardan sağ çıkarması gerekiyordu.'
    }
  };
  var hikayeGorulen = {};
  var hikayeAcik = false, hikayeSoluyor = false, hikayeAcilmaT = 0, hikayeKapatZ = 0;
  var HIKAYE_OKUMA_MS = 6000;
  var hikayeX = 0, hikayeY = 0, hikayeHareketEtti = false;
  var SES_ANAHTAR = 'barbar-ses';

  function $(etiket, sinif, ebeveyn, html) {
    var e = document.createElement(etiket);
    if (sinif) e.className = sinif;
    if (html != null) e.innerHTML = html;
    if (ebeveyn) ebeveyn.appendChild(e);
    return e;
  }
  function O() { return window.OYUN; }
  function durum() { return O() ? O().durum : 'baslik'; }
  function durumYap(d) { if (O() && O().durumYap) O().durumYap(d); }

  /* ───────── simgeler (satır içi SVG) ───────── */
  var SVG = {
    kafatasi: '<svg viewBox="0 0 24 24"><path fill="#e8dcc0" stroke="#000" stroke-width="1.2" d="M12 2C6.8 2 3.5 5.6 3.5 10.2c0 2.6 1.1 4.3 2.6 5.3V19c0 .8.6 1.4 1.4 1.4H9v-2h1.3v2h3.4v-2H15v2h1.5c.8 0 1.4-.6 1.4-1.4v-3.5c1.5-1 2.6-2.7 2.6-5.3C20.5 5.6 17.2 2 12 2z"/><circle cx="8.6" cy="11" r="2.2" fill="#2a0505"/><circle cx="15.4" cy="11" r="2.2" fill="#2a0505"/><path d="M12 13.2l-1.2 2.3h2.4z" fill="#2a0505"/></svg>',
    balta: '<svg viewBox="0 0 32 32"><path d="M9 29L22 8" stroke="#000" stroke-width="5" stroke-linecap="round"/><path d="M9 29L22 8" stroke="#7a5532" stroke-width="2.6" stroke-linecap="round"/><path d="M17.5 4.5c4.5-1.5 10 1.5 11 6.5-3 .5-5.5 2.5-6.5 5.5l-7.8-5c1.6-1.8 2.8-4.3 3.3-7z" fill="#cfcac2" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/><path d="M19 7c3-.5 6 1 7.3 3.5" stroke="#fff" stroke-opacity=".6" stroke-width="1" fill="none"/></svg>',
    atil: '<svg viewBox="0 0 32 32"><g stroke="#000" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M4 10h9M2 16h12M4 22h9M17 8l9 8-9 8"/></g><g stroke="#e8dcc0" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M4 10h9M2 16h12M4 22h9M17 8l9 8-9 8"/></g></svg>',
    kilic: '<svg viewBox="0 0 520 26" preserveAspectRatio="none"><defs><linearGradient id="arkl" x1="0" x2="1"><stop offset="0" stop-color="#9b1414" stop-opacity="0"/><stop offset=".25" stop-color="#9b1414"/><stop offset=".5" stop-color="#e05a3c"/><stop offset=".75" stop-color="#9b1414"/><stop offset="1" stop-color="#9b1414" stop-opacity="0"/></linearGradient></defs><path d="M0 13h228M292 13h228" stroke="url(#arkl)" stroke-width="2"/><path d="M260 1l12 12-12 12-12-12z" fill="#1a1514" stroke="#b33a2a" stroke-width="2"/><path d="M260 7l6 6-6 6-6-6z" fill="#d22a1c"/><path d="M236 13l8-5v10zM284 13l-8-5v10z" fill="#6d625b"/></svg>',
    // boynuzlu kafatası: ilerleme çizgisinin sonundaki dev
    devKafa: '<svg viewBox="0 0 32 26"><path d="M7.6 9.6C4.4 8.6 2 5.6 1.6 1.6c2.4 2.2 5 3 7.8 3.2zM24.4 9.6c3.2-1 5.6-4 6-8-2.4 2.2-5 3-7.8 3.2z" fill="#b7a98d" stroke="#000" stroke-width="1.3" stroke-linejoin="round"/><path d="M16 3.4c-5 0-8.2 3.4-8.2 7.8 0 2.4 1 4 2.4 5v3.2c0 .8.6 1.3 1.3 1.3h1.4v-1.9h1.2v1.9h3.8v-1.9h1.2v1.9h1.4c.8 0 1.3-.6 1.3-1.3v-3.2c1.4-1 2.4-2.6 2.4-5 0-4.4-3.2-7.8-8.2-7.8z" fill="#e8dcc0" stroke="#000" stroke-width="1.3"/><circle cx="12.8" cy="11.8" r="2.1" fill="#b3170f"/><circle cx="19.2" cy="11.8" r="2.1" fill="#b3170f"/><path d="M16 14l-1.1 2.1h2.2z" fill="#2a0505"/></svg>',
    devUc: '<svg viewBox="0 0 26 38"><path d="M24 4L4 19l20 15-6-15z" fill="#2c2724" stroke="#000" stroke-width="2" stroke-linejoin="round"/><path d="M20 10L9 19l11 9" fill="none" stroke="#8a7d70" stroke-width="1.3"/></svg>'
  };
  /* oyma simgeler: önce koyu oluk, üstüne soluk kemik çizgi (el çizimi, hafif titrek) */
  function oyma(d, dolgu) {
    return '<g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="' + d + '" stroke="#050303" stroke-width="4.2" transform="translate(0 .8)"/>' +
      '<path d="' + d + '" stroke="#f1e6cc" stroke-width="2.2"/></g>' + (dolgu ? '<path d="' + dolgu + '" fill="#efe3c6" stroke="#050303" stroke-width="1.4" stroke-linejoin="round"/>' : '');
  }
  var IKON = {
    savur: '<svg class="ik" viewBox="0 0 32 32">' + oyma('M4.5 23.5C5.8 15 11.5 8.6 20.5 6.8M7.6 27C9.4 20.3 13.2 15.8 18.6 13.4M15.5 28.6l9.8-15.9') +
      oyma('', 'M23.3 9.1c2.6-1.6 6.6-.5 7.4 2.6-1.9.1-3.6 1.2-4.3 3l-4.6-2.9c.9-.7 1.3-1.6 1.5-2.7z') + '</svg>',
    balta: '<svg class="ik" viewBox="0 0 32 32">' + oyma('M7.5 25.4l10.8-11.6M3.6 13.2c1.6-4.4 5.6-7.4 10.4-7.6M3.4 19.4c.4-1.5 1-2.8 1.8-3.9M24.6 27.4c3.2-2.4 4.7-6 4.4-9.8') +
      oyma('', 'M16.5 10.6c1.7-2.6 5.8-3.2 7.9-.8-1.6 1-2.4 2.8-2.2 4.7l-5.3-.8c.3-1 .2-2.1-.4-3.1z') + '</svg>',
    atil: '<svg class="ik" viewBox="0 0 32 32">' + oyma('M3.5 10.6h9M2.2 16.2h11.6M4.2 21.8h8.4M17.4 8.2l9.2 8-9 7.9') + '</svg>',
    cagir: '<svg class="cagir-ok" viewBox="0 0 32 32">' + oyma('M22.5 4.5C30.5 9.5 29.5 23.5 12 23.6M17.4 17.6l-5.6 6 5.8 5.6') + '</svg>',   // geri çağır: dönen ok
    fareSol: '<svg class="tg" viewBox="0 0 12 16"><path d="M6 1.2C3 1.2 1.4 3.4 1.3 6.6l.1 4.6c.2 2.4 2 3.7 4.6 3.7s4.4-1.4 4.6-3.8l.1-4.4C10.6 3.4 9 1.2 6 1.2z" fill="#1b1614" stroke="#d2c5a8" stroke-width="1.1"/><path d="M5.6 1.6C3.3 1.9 2 3.6 1.9 6.4h3.7z" fill="#b3291c"/><path d="M6 1.4v5.2M1.6 6.6h8.8" stroke="#d2c5a8" stroke-width=".9"/></svg>',
    fareSag: '<svg class="tg" viewBox="0 0 12 16"><path d="M6 1.2C3 1.2 1.4 3.4 1.3 6.6l.1 4.6c.2 2.4 2 3.7 4.6 3.7s4.4-1.4 4.6-3.8l.1-4.4C10.6 3.4 9 1.2 6 1.2z" fill="#1b1614" stroke="#d2c5a8" stroke-width="1.1"/><path d="M6.4 1.6c2.3.3 3.6 2 3.7 4.8H6.4z" fill="#b3291c"/><path d="M6 1.4v5.2M1.6 6.6h8.8" stroke="#d2c5a8" stroke-width=".9"/></svg>',
    // klavye çubuğu: açık kemik renkli taş tuş, üstünde "BOŞLUK" yazısı
    bosluk: '<svg class="tg genis" viewBox="0 0 60 20"><path d="M2.4 2.6L30 1.4 57.8 2.4 58.6 17.4 30 18.6 1.6 17.6z" fill="#e3d6b8" stroke="#000" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M4.6 15.4L30 16.2 56.2 15.2" stroke="#9c8d72" stroke-width="1.2" fill="none"/>' +
      '<text x="30" y="13.4" text-anchor="middle" font-family="Palatino Linotype,Palatino,Georgia,serif" font-weight="bold" font-size="10.5" letter-spacing=".6" fill="#2a0805">BOŞLUK</text></svg>',
    // şerit uçlarındaki dövme demir kenet (el çizimi)
    kenet: '<svg viewBox="0 0 18 34"><path d="M3.2 1.8l11.6 2.6-.9 6.4 2.6 5.9-2.3 6.6 1 6.9-12 2.1-1.4-8.3 1.6-7.2-1.9-7.6z" fill="#2c2623" stroke="#030202" stroke-width="1.6" stroke-linejoin="round"/><path d="M5 5.5l7.4 1.4M4.8 28.4l7.6-1.1" stroke="#5a4f48" stroke-width="1"/><circle cx="8.6" cy="17.2" r="2.3" fill="#6f655c" stroke="#030202" stroke-width="1"/><path d="M7.6 16.4l1.6 1.4" stroke="#a69a8a" stroke-width=".7"/></svg>'
  };

  function fare(taraf) {   // 'sol' | 'sag' | '' (yalnız nişan)
    var v = '#d22a1c';
    return '<svg class="ar-fare" viewBox="0 0 22 30"><rect x="1.5" y="1.5" width="19" height="27" rx="9.5" fill="#d9ceb5" stroke="#000" stroke-width="2"/>' +
      '<path d="M11 2v11M2 13h18" stroke="#000" stroke-width="1.5"/>' +
      (taraf === 'sol' ? '<path d="M2.2 13V11a8.8 8.8 0 0 1 8.8-8.8V13z" fill="' + v + '"/>' : '') +
      (taraf === 'sag' ? '<path d="M19.8 13V11A8.8 8.8 0 0 0 11 2.2V13z" fill="' + v + '"/>' : '') +
      (taraf === '' ? '<path d="M11 18v6M8 21h6" stroke="#5a1010" stroke-width="1.6"/>' : '') + '</svg>';
  }
  function tus(t, genis) { return '<span class="ar-tus' + (genis ? ' genis' : '') + '">' + t + '</span>'; }

  function etiketAdi(ad) { return (GIRDI.pad.aktif && GIRDI.padAdi(ad)) || GIRDI.tusAdi(ad); }
  function atananTus(ad) { return tus(etiketAdi(ad).replace(/&/g, '&amp;').replace(/</g, '&lt;'), ad === 'bosluk' && !GIRDI.pad.aktif); }
  var SAVUR_TUS, BALTA_TUS, tusPanelleri = [], baglantiYazilari = [], tusSecimi = null;
  var KONTROLLER = [
    ['yukari', 'Yukarı yürü'], ['o', 'Balta savur'],
    ['sola', 'Sola yürü'], ['p', 'Baltayı fırlat / geri çağır · II. bölüm'],
    ['asagi', 'Aşağı yürü'], ['g', 'Ağır vuruş · II. bölüm'],
    ['saga', 'Sağa yürü'], ['bosluk', 'Atıl'],
    ['esc', 'Molayı aç / kapat'], ['e', 'Savaş Öfkesi'],
    ['r', 'Yeniden oyna'], ['x', 'Kasırga · III. bölüm (basılı tut)']
  ];
  var TUS_ATAMA_IPUCU = 'Bir eyleme tıkla, ardından yeni tuşa bas.';
  function tusSeciminiKapat() {
    if (!tusSecimi) return;
    tusSecimi.dugme.removeAttribute('aria-pressed');
    tusSecimi.yazi.textContent = TUS_ATAMA_IPUCU;
    GIRDI.pad.ayarlaniyor = false;
    tusSecimi = null;
  }
  function baglantiYaz() {
    var metin = GIRDI.pad.bagli ? 'Kontrolcü bağlı' : 'Kontrolcüyü bağla ve bir düğmeye bas';
    for (var yazi of baglantiYazilari) yazi.textContent = metin;
  }
  function kontrolPaneli(ebeveyn) {
    var p = $('div', 'ar-panel ar-acilir ar-tus-ayarlari gizli', ebeveyn);
    $('h3', '', p, 'KONTROLLER');
    var sekmeler = $('div', 'ar-kontrol-sekmeler', p);
    var klavye = $('div', '', p), xbox = $('div', 'gizli', p);
    function sekme(kontrolcu) {
      tusSeciminiKapat();
      klavye.classList.toggle('gizli', kontrolcu);
      xbox.classList.toggle('gizli', !kontrolcu);
      kt.setAttribute('aria-pressed', String(!kontrolcu));
      xt.setAttribute('aria-pressed', String(kontrolcu));
    }
    var kt = dugme(sekmeler, 'Klavye ve fare', function () { sekme(false); }, 'kucuk');
    var xt = dugme(sekmeler, 'Xbox kontrolcüsü', function () { sekme(true); }, 'kucuk');
    sekme(false);
    function atamalar(panel, kontrolcu) {
      if (kontrolcu) {
        baglantiYazilari.push($('p', 'ar-pad-baglanti', panel));
        $('p', 'ar-tus-fare', panel, 'Sol çubuk / D-pad ile yürü. Sağ çubukla nişan al. Menüde A seçer, B geri döner.');
      }
      var g = $('div', 'ar-kontrol', panel), dugmeler = [];
      KONTROLLER.forEach(function (k) {
        if (kontrolcu && !GIRDI.padAdi(k[0])) return;
        var b = dugme(g, '', function () {
          if (tusSecimi && tusSecimi.dugme === b) { tusSeciminiKapat(); return; }
          tusSeciminiKapat();
          GIRDI.temizle();
          GIRDI.pad.ayarlaniyor = kontrolcu;
          tusSecimi = { ad: k[0], dugme: b, yazi: durumYazisi, kontrolcu: kontrolcu };
          b.setAttribute('aria-pressed', 'true');
          durumYazisi.textContent = k[1] + (kontrolcu ? ' için kontrolcüde bir düğmeye bas.' : ' için yeni tuşa bas.');
        }, 'ar-tus-atama');
        b.dataset.eylem = k[0];
        $('span', 'ar-tus-eylem', b).textContent = k[1];
        var rozet = $('kbd', 'ar-tus', b);
        dugmeler.push({ dugme: b, eylem: k[0], ad: k[1], rozet: rozet, kontrolcu: kontrolcu });
      });
      var alt = $('div', 'ar-tus-alt', panel);
      var durumYazisi = $('p', '', alt, TUS_ATAMA_IPUCU);
      durumYazisi.setAttribute('aria-live', 'polite');
      dugme(alt, 'Varsayılanlar', function () {
        tusSeciminiKapat();
        if (kontrolcu) GIRDI.padSifirla(); else GIRDI.tuslariSifirla();
        durumYazisi.textContent = 'Varsayılan tuşlar geri yüklendi.';
      }, 'kucuk');
      if (!kontrolcu) $('p', 'ar-tus-fare', panel, 'Fare: nişan, sol tık savur, sağ tık balta · Shift + F: çözünürlük ve FPS');
      tusPanelleri.push(dugmeler);
    }
    atamalar(klavye, false); atamalar(xbox, true);
    baglantiYaz();
    return p;
  }
  function tusEtiketleriniYaz() {
    SAVUR_TUS = (GIRDI.pad.aktif ? '' : fare('sol')) + atananTus('o');
    BALTA_TUS = (GIRDI.pad.aktif ? '' : fare('sag')) + atananTus('p');
    for (var grup of tusPanelleri) for (var satir of grup) {
      var tusAdi = satir.kontrolcu ? GIRDI.padAdi(satir.eylem) : GIRDI.tusAdi(satir.eylem);
      satir.rozet.textContent = tusAdi;
      satir.dugme.setAttribute('aria-label', satir.ad + ' · ' + tusAdi);
    }
    if (!el.savur) return;
    el.savur.querySelector('.tg-yer').innerHTML = SAVUR_TUS;
    el.balta.querySelector('.tg-yer').innerHTML = BALTA_TUS;
    el.atil.querySelector('.tg-yer').innerHTML = etiketAdi('bosluk') === 'Boşluk' ? IKON.bosluk : atananTus('bosluk');
    el.kasirga.querySelector('.tg-yer').innerHTML = atananTus('x');
    var ofkeTusu = el.ofke.querySelector('.q text');
    var ofkeAdi = etiketAdi('e');
    ofkeTusu.textContent = ofkeAdi.length > 4 ? ofkeAdi.slice(0, 3) + '…' : ofkeAdi;
    ofkeTusu.setAttribute('font-size', ofkeAdi.length > 1 ? '8' : '18');
    el.ofke.title = 'Savaş Öfkesi · ' + ofkeAdi + ' · 100 öfke';
    el.kasirga.title = 'Kasırga · ' + etiketAdi('x') + ' tuşunu basılı tutarak öfke harca';
    hikayeYetenekYaz(aktifBolum());
    if (ipucu?.aktif) el.ipucu.innerHTML = '<span class="ic">' + ipucuMetinleri()[ipucu.aktif] + '</span>';
    zaferHazirla();
  }

  /* ───────── ses ayarı ───────── */
  var sesAyar = { ana: 0.8, efekt: 0.9, muzik: 0.6 };
  try { var kayit = JSON.parse(localStorage.getItem(SES_ANAHTAR) || 'null'); if (kayit) for (var k in sesAyar) if (typeof kayit[k] === 'number') sesAyar[k] = kayit[k]; } catch (e) { /* yok */ }
  function sesUygula() {
    var S = window.SES;
    if (S && typeof S.ayar === 'function') { try { S.ayar({ ana: sesAyar.ana, efekt: sesAyar.efekt, muzik: sesAyar.muzik }); } catch (e) { /* ses yok */ } }
    try { localStorage.setItem(SES_ANAHTAR, JSON.stringify(sesAyar)); } catch (e) { /* yok */ }
  }
  var sesKaydiricilar = [];
  function sesPaneli(ebeveyn) {
    var p = $('div', 'ar-panel ar-acilir gizli', ebeveyn);
    $('h3', '', p, 'SES');
    var g = $('div', 'ar-ses', p);
    [['ana', 'Ana'], ['efekt', 'Efekt'], ['muzik', 'Müzik']].forEach(function (a) {
      $('div', '', g, a[1]);
      var r = $('input', '', g); r.type = 'range'; r.min = 0; r.max = 100; r.step = 1;
      r.setAttribute('aria-label', a[1] + ' ses seviyesi');
      var d = $('span', 'd', g);
      function yaz() { var v = Math.round(sesAyar[a[0]] * 100); r.value = v; d.textContent = v; r.style.setProperty('--y', v + '%'); }
      r.addEventListener('input', function () { sesAyar[a[0]] = r.value / 100; yaz(); sesUygula(); });
      r.addEventListener('keydown', function (e) { e.stopPropagation(); });
      yaz(); sesKaydiricilar.push(yaz);
    });
    return p;
  }
  var grafikSecenekleri = [];
  function grafikPaneli(ebeveyn) {
    var p = $('div', 'ar-panel ar-acilir ar-grafik gizli', ebeveyn);
    var baslik = $('h3', '', p, 'GRAFİK');
    function secenekler(grup, ad, secimler, oku, uygula) {
      grup.setAttribute('role', 'group');
      grup.setAttribute('aria-label', ad);
      secimler.forEach(function (secim) {
        var b = dugme(grup, secim[0], function () {
          uygula(secim[1]);
          grafikSecenekleri.forEach(function (guncelle) { guncelle(); });
        }, 'kucuk');
        function guncelle() {
          b.setAttribute('aria-pressed', String(oku() === secim[1]));
        }
        guncelle(); grafikSecenekleri.push(guncelle);
      });
    }
    secenekler($('div', 'ar-grafik-dugmeler', p), baslik.textContent,
      [['Temel', 1], ['Gelişmiş', 2]], function () { return OYUN.grafik.isik; }, OYUN.grafikYap);
    var olcekSatiri = $('div', 'ar-grafik-olcek', p), olcekAdi = 'Render ölçeği';
    $('span', '', olcekSatiri, olcekAdi);
    secenekler($('div', 'ar-grafik-dugmeler ar-grafik-olcek-dugmeleri', olcekSatiri), olcekAdi,
      [['1.00×', 1], ['1.25×', 1.25], ['1.50×', 1.5]], OYUN.cizimOlcegi, OYUN.cizimOlcegiYap);
    return p;
  }
  function acKapa(panel, digerleri) {
    var ac = panel.classList.contains('gizli');
    digerleri.forEach(function (d) { panelAcikYap(d, false); });
    panelAcikYap(panel, ac);
  }
  function panelAcikYap(panel, acik) {
    if (!acik && tusSecimi && panel.contains(tusSecimi.dugme)) tusSeciminiKapat();
    panel.classList.toggle('gizli', !acik);
    if (panel._dugme) panel._dugme.setAttribute('aria-expanded', String(acik));
  }
  function panelDugmesi(panel, dugme, id) {
    panel.id = id;
    panel._dugme = dugme;
    dugme.setAttribute('aria-controls', id);
    dugme.setAttribute('aria-expanded', 'false');
  }
  function sesiAc() { var S = window.SES; if (S && S.ac) { try { S.ac(); } catch (e) { /* yok */ } } sesUygula(); }
  function dugme(ebeveyn, yazi, fn, sinif) {
    var b = $('button', 'ar-dugme' + (sinif ? ' ' + sinif : ''), ebeveyn, yazi);
    b.type = 'button';
    b.addEventListener('click', function (e) { e.stopPropagation(); fn(); });
    b.addEventListener('mousedown', function (e) { e.stopPropagation(); });
    b.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    return b;
  }

  /* ───────── dokular (bir kez üretilir; tarayıcı resim gibi saklar, her kare hesaplanmaz) ───────── */
  function svgUrl(w, h, ic) {
    var s = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">' + ic + '</svg>';
    return 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s) + '")';
  }
  function dokulariKur(k) {
    var D = {};
    // Başlıktaki yağmur, atlasların WebGL'e yüklenmesinden bağımsızdır.
    for (var kat = 0; kat < 2; kat++) {
      var damlalar = '';
      for (var i = 0; i < (kat ? 17 : 23); i++) {
        var x = 18 + (i * 71 + i * i * 13 + kat * 17) % 120;
        var y = (i * 127 + i * i * 19 + kat * 77) % 250;
        var boy = (kat ? 16 : 10) + (i * 7) % 18;
        damlalar += '<path d="M' + x + ' ' + y + 'l-' + (boy / 2).toFixed(2) + ' ' + boy +
          '" stroke-opacity="' + (0.19 + (i % 5) * 0.067).toFixed(2) + '"/>';
      }
      D['yagmur-' + kat] = svgUrl(144, 288, '<g fill="none" stroke="#b6c9d7" stroke-width="' + (kat ? 1.25 : 0.85) + '" stroke-linecap="round">' + damlalar + '</g>');
    }
    // net fırça darbeleri: keskin kenarlı, az ama belirgin (bulanık değil)
    D['firca-net'] = svgUrl(240, 22, '<g fill="none" stroke-linecap="round">' +
      '<path d="M4 6.5C50 5 92 7.6 150 5.8s70 1.4 86 .6" stroke="#ff7a5a" stroke-opacity=".35" stroke-width="1.4"/>' +
      '<path d="M10 15.5c40-1.2 70 1 120-.6 40-1.2 70 .4 104-.4" stroke="#3a0403" stroke-opacity=".45" stroke-width="2.2"/>' +
      '<path d="M30 11c24-.6 40 .4 62-.2M140 10.4c30-.4 50 .6 76 0" stroke="#5c0705" stroke-opacity=".4" stroke-width="1.3"/></g>');
    D['kor-net'] = svgUrl(260, 14, '<g fill="none" stroke-linecap="round">' +
      '<path d="M3 4.2c60-1.4 120 .8 180-.4s60 .6 74 0" stroke="#fff0b8" stroke-opacity=".55" stroke-width="1.2"/>' +
      '<path d="M8 10.6c50-.8 110 .8 160-.4 40-.6 70 .4 86 0" stroke="#6a1a04" stroke-opacity=".5" stroke-width="1.8"/></g>');
    // çerçeve: elle kesilmiş levha, siyah mürekkep + açık kemik çizgi (gerildiğinde çizgi kalınlığı değişmez)
    function levha(w, h, nokta, ust, alt, cizgi) {
      return svgUrl(w, h, '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + ust + '"/><stop offset="1" stop-color="' + alt + '"/></linearGradient></defs>' +
        '<polygon points="' + nokta + '" fill="url(#g)" stroke="#000" stroke-width="4" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>' +
        '<polygon points="' + nokta + '" fill="none" stroke="' + cizgi + '" stroke-width="1.5" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>');
    }
    var DUG = '6,2.5 90,1.2 210,2.6 296,2 299,25 295.5,48 190,48.8 70,47.6 4,48.4 1,25';
    D['dugme'] = levha(300, 50, DUG, '#4a403a', '#221c19', '#b9a682');
    D['dugme-kan'] = levha(300, 50, DUG, '#9a2216', '#4e0a07', '#efc9a0');
    D['panel'] = levha(600, 300, '10,4 200,2 420,5 594,3 597,150 595,296 380,298 160,296 5,297 3,150', 'rgba(46,40,36,.97)', 'rgba(22,19,17,.98)', '#9d8c70');
    D['tus'] = levha(40, 30, '3,2 20,1 37,2.4 38.6,15 37,28 18,29 2.4,28 1.2,15', '#e6dabe', '#b3a588', '#3a3028');
    for (var ad in D) k.style.setProperty('--d-' + ad, D[ad]);
  }

  /* ───────── kurulum ───────── */
  function kur() {
    var kap = document.getElementById('arayuz');
    if (!kap) { kap = $('div', '', document.body); kap.id = 'arayuz'; }
    kap.innerHTML = '';
    kok = $('div', 'ar-kok', kap);
    dokulariKur(kok);
    // perdelerde tıklama oyuna gitmesin
    ['mousedown', 'pointerdown', 'mouseup', 'pointerup', 'contextmenu', 'wheel'].forEach(function (t) {
      kok.addEventListener(t, function (e) { if (e.target.closest && e.target.closest('.ar-perde')) { e.stopPropagation(); if (t === 'contextmenu') e.preventDefault(); } });
    });

    /* oyun göstergesi */
    gost = $('div', 'ar-gosterge gizli', kok);
    gost.setAttribute('aria-hidden', 'true');
    // ilerleme: sol = başlangıç, kafatası = dev; kemik iğne barbarın yerini gösterir
    el.ilerleme = $('div', 'ar-ilerleme', gost, '<i></i>' + SVG.devKafa + '<b class="uc"></b>');
    el.ilerleme.title = 'Patrona giden yol ve arena ilerlemesi';
    el.ilerlemeUc = el.ilerleme.querySelector('.uc');
    el.ilerlemeDolu = el.ilerleme.firstChild;
    el.sayac = $('div', 'ar-sayac', gost, SVG.kafatasi + '<b>0</b>');
    el.sayacB = el.sayac.querySelector('b');
    // seri: kısa arayla art arda öldürme (abartısız; 3'ten itibaren görünür)
    el.seri = $('div', 'ar-seri', gost, '<b>×3</b><small>SERİ</small><i class="sure"></i>');
    el.seriB = el.seri.querySelector('b'); el.seriSure = el.seri.querySelector('.sure');
    el.uyari = $('div', 'ar-uyari', gost);
    el.sahneAdi = $('div', 'ar-sahne-adi', gost);
    el.sahneAdi.setAttribute('role', 'status');

    el.kanKenar = $('div', 'ar-kan-kenar', gost);
    el.solAlt = $('div', 'ar-sol-alt', gost);
    // can: mürekkep çizgili demir kemer içinde kan şeridi (keskin vektör kenarlar)
    el.can = $('div', 'ar-can', el.solAlt,
      '<svg class="alt" viewBox="0 0 310 30"><path d="M6 3L105 1.3 225 2.8 303 1.8 308.5 15 304 28.4 182 29.3 55 28 4 28.8 1.2 15z" fill="#2e2622" stroke="#000" stroke-width="2.2" stroke-linejoin="round"/>' +
      '<path d="M8 5.2l98-1.6 118 1.3 76-1M9 26.6l46-.8 127 1.3 118-.8" stroke="#5e5149" stroke-width="1" fill="none"/></svg>' +
      '<div class="kanal"><i class="iz"></i><i class="dolu"><i class="nabiz"></i></i></div>' +
      '<svg class="ust" viewBox="0 0 310 30"><path d="M12 6.2L125 5.4 297 6.6v17.6L178 25 12 24.2z" fill="none" stroke="#000" stroke-width="2.8" stroke-linejoin="round"/>' +
      '<path d="M12 6.2L125 5.4 297 6.6v17.6L178 25 12 24.2z" fill="none" stroke="#d9c7a1" stroke-width="1.2" stroke-linejoin="round"/>' +
      '<path d="M83 5.8v3.6M154 5.6v3.6M226 6.2v3.6M83 24.6v-3.4M154 24.9v-3.4M226 24.6v-3.4" stroke="#000" stroke-width="2"/></svg>' +
      '<span class="ad">CAN</span><b class="sayi">100</b>' +
      '<span class="kenet sol">' + IKON.kenet + '</span><span class="kenet sag">' + IKON.kenet + '</span>');
    el.canIz = el.can.querySelector('.iz'); el.canDolu = el.can.querySelector('.dolu'); el.canSayi = el.can.querySelector('.sayi');
    // öfke: kor şeridi
    el.ofke = $('div', 'ar-ofke gizli', el.solAlt,
      '<svg class="alt" viewBox="0 0 310 28"><path d="M4 3L105 1.4 306 2.6 308.5 14 305 26.4 164 27 3 25.8 1.2 14z" fill="#2e2622" stroke="#000" stroke-width="2.2" stroke-linejoin="round"/></svg>' +
      '<div class="kanal"><i class="dolu"><i class="alev"></i></i></div><span class="ad">ÖFKE</span><b class="sayi">0</b><div class="yz"><span class="ad">ÖFKE</span><b class="sayi">0</b></div>' +
      '<svg class="ust" viewBox="0 0 310 28"><path d="M12 6.2L125 5.6 297 6.6v15L143 22.4 12 21.8z" fill="none" stroke="#000" stroke-width="2.6" stroke-linejoin="round"/>' +
      '<path d="M12 6.2L125 5.6 297 6.6v15L143 22.4 12 21.8z" fill="none" stroke="#d9b98a" stroke-width="1.2" stroke-linejoin="round"/></svg>' +
      '<span class="q"><svg viewBox="0 0 28 28"><path d="M5 3.5l14-2 7 6.5.6 12-6.8 6.2-13.6.4L1.4 19 2 8.4z" fill="#e6d6b2" stroke="#000" stroke-width="2.2" stroke-linejoin="round"/>' +
      '<path d="M6.4 5.2l11.6-1.6 5.6 5.2.5 9.8-5.5 5-11 .3-4-5.9.5-8.4z" fill="none" stroke="#fff4d6" stroke-opacity=".55" stroke-width="1" stroke-linejoin="round"/>' +
      '<text x="14" y="20.2" text-anchor="middle" font-family="Palatino Linotype,Palatino,Georgia,serif" font-weight="bold" font-size="18" fill="#3a0c06">E</text></svg><b class="q-yazi">HAZIR</b></span><b class="geri">6</b>');
    el.ofkeDolu = el.ofke.querySelector('.dolu'); el.ofkeGeri = el.ofke.querySelector('.geri'); el.ofkeSayi = el.ofke.querySelector('.sayi'); el.ofkeSayi2 = el.ofke.querySelector('.yz .sayi');
    // tuş rozetleri: sol tık / sağ tık / boşluk — tuş (fare / klavye çubuğu) büyük ve net, eylem simgesi yanında
    var rz = $('div', 'ar-rozetler', el.solAlt);
    var PLAKA = '<svg class="plaka" viewBox="0 0 72 50" preserveAspectRatio="none"><path d="M4.5 3.4L40 1.6 69 4.2 70.6 25 68.4 47.4 32 48.6 3 46.6 1.4 24z" fill="#262120" stroke="#000" stroke-width="2.6" stroke-linejoin="round"/>' +
      '<path d="M6.6 6L40 4.4 66.6 6.6 68 25 66 44.8 32 46 5.4 44.2 4 24z" fill="none" stroke="#a8977a" stroke-width="1.1" stroke-linejoin="round"/></svg>';
    function rozet(sinif, ikon, tus, yazi, ek) {
      return $('div', 'ar-rozet ' + sinif, rz, '<div class="tas">' + PLAKA + (ek || '') + '<span class="tg-yer">' + tus + '</span>' + ikon + '</div><small>' + yazi + '</small>');
    }
    el.savur = rozet('savur', IKON.savur, SAVUR_TUS, 'savur');
    el.balta = rozet('balta gizli', IKON.balta, BALTA_TUS, 'fırlat', '<b class="yok-damga">YOK</b>' + IKON.cagir);   // balta dışarıdayken: dönen ok + "çağır"
    el.baltaYazi = el.balta.querySelector('small');
    el.atil = rozet('atil', IKON.atil, IKON.bosluk, 'atıl', '<i class="bekle"></i>');
    el.atilBekle = el.atil.querySelector('.bekle');
    el.ofke.title = 'Savaş Öfkesi · E · 100 öfke';
    el.kasirga = rozet('kasirga gizli', IKON.savur, atananTus('x'), 'Kasırga');
    el.kasirga.title = 'Kasırga · X tuşunu basılı tutarak öfke harca';

    el.ipucu = $('div', 'ar-ipucu', gost);

    el.hikaye = $('div', 'ar-hikaye gizli', gost,
      '<div class="ar-hikaye-kart">' +
        '<div class="ar-hikaye-baslik"></div>' +
        '<div class="ar-hikaye-ayrac"></div>' +
        '<p class="ar-hikaye-metin"></p>' +
        '<div class="ar-hikaye-yetenek gizli"></div>' +
        '<div class="ar-hikaye-ipucu">Devam etmek için yürü veya karta dokun</div>' +
      '</div>');
    el.hikayeKart = el.hikaye.querySelector('.ar-hikaye-kart');
    el.hikayeBaslik = el.hikaye.querySelector('.ar-hikaye-baslik');
    el.hikayeMetin = el.hikaye.querySelector('.ar-hikaye-metin');
    el.hikayeYetenek = el.hikaye.querySelector('.ar-hikaye-yetenek');
    hikayeYetenekYaz(aktifBolum());
    el.hikayeKart.addEventListener('click', function (e) {
      if (!hikayeAcik || performance.now() - hikayeAcilmaT < 250) return;
      e.stopPropagation();
      hikayeKapat(false);
    });

    el.hedef = $('div', 'ar-hedef gizli', gost,
      '<b class="hedef-ad"></b><div class="hedef-can"><i></i><span class="can-sayi"></span></div>');
    el.hedefAd = el.hedef.querySelector('.hedef-ad');
    el.hedefDolu = el.hedef.querySelector('.hedef-can i');
    el.hedefCan = el.hedef.querySelector('.can-sayi');

    el.dev = $('div', 'ar-dev gizli', gost,
      '<div class="ad"><b class="isim">' + BOSS_BILGI[1].ad + '</b><small>' + BOSS_BILGI[1].unvan + '</small></div>' +
      '<div class="cubuk"><div class="govde ilk"><div class="yuva"><i class="iz"></i><i class="dolu"></i></div>' +
      '<span class="can-sayi"></span><i class="centik e2" style="left:60%"><u></u><u></u><u></u></i><i class="centik e3" style="left:30%"><u></u><u></u><u></u></i>' +
      '<span class="uc sol">' + SVG.devUc + '</span><span class="uc sag">' + SVG.devUc + '</span></div></div>');
    el.vargorMekanik = $('div', 'ar-vargor-mekanik gizli', el.dev);
    el.devIsim = el.dev.querySelector('.ad .isim');
    el.devUnvan = el.dev.querySelector('.ad small');
    el.devCubuk = el.dev.querySelector('.cubuk');
    el.devIz = el.dev.querySelector('.iz'); el.devDolu = el.dev.querySelector('.dolu');
    el.devGovde = el.dev.querySelector('.govde.ilk');
    el.devCan = el.devGovde.querySelector('.can-sayi');
    el.devCentik = { 2: el.dev.querySelector('.centik.e2'), 3: el.dev.querySelector('.centik.e3') };

    /* başlık */
    var b = perdeler.baslik = $('div', 'ar-perde baslik gizli', kok);
    $('div', 'ar-baslik-yagmur', b, '<i></i><i></i>').setAttribute('aria-hidden', 'true');
    // ince hareket: yükselen közler (yalnız CSS; her kare JS yok)
    var kz = $('div', 'ar-koz', b), kzh = '';
    for (var ki = 0; ki < 26; ki++) {
      var kx = (ki * 47.3 + (ki % 3) * 13) % 100, ks = 7 + (ki * 1.7) % 6, kd = -((ki * 2.9) % ks), kb = ki % 4 === 0 ? 3 : 2;
      kzh += '<i style="left:' + kx.toFixed(1) + '%;width:' + kb + 'px;height:' + kb + 'px;animation-duration:' + ks.toFixed(1) + 's,' + (ks / 3).toFixed(1) + 's;animation-delay:' + kd.toFixed(1) + 's,' + (kd / 2).toFixed(1) + 's"></i>';
    }
    kz.innerHTML = kzh;
    var bu = $('div', 'ar-baslik-ust', b);
    $('h1', 'ar-ad', bu,
      '<svg class="ar-ad-metal" viewBox="0 0 760 160" preserveAspectRatio="none" fill="none" stroke-width="1.5" aria-hidden="true" focusable="false">' +
        '<path d="M33 143h223l18 9h212l18-9h223 M86 151h151m286 0h151" stroke="#a66940"/>' +
        '<path d="M35 143l13-5v10zm690 0l-13-5v10zM374 151l6-6 6 6-6 6z" fill="#e0a060"/>' +
      '</svg><span>BAHTİYAR</span>');
    var m = $('div', 'ar-menu', b);
    var bKontrol, bSes, bGrafik;
    bBasla = dugme(m, 'BAŞLA', basla, 'ana');
    el.baslaHata = $('p', 'ar-ipucu-alt gizli', m, 'Bölüm yüklenemedi. Tekrar deneyebilirsin.');
    el.baslaHata.setAttribute('role', 'alert');
    hazirIzle();
    var mk = $('div', 'ar-menu-yan', m);
    var bKontrolDugme = dugme(mk, 'KONTROLLER', function () { acKapa(bKontrol, [bSes, bGrafik]); }, 'kucuk');
    var bSesDugme = dugme(mk, 'SES', function () { acKapa(bSes, [bKontrol, bGrafik]); }, 'kucuk');
    var bGrafikDugme = dugme(mk, 'GRAFİK', function () { acKapa(bGrafik, [bKontrol, bSes]); }, 'kucuk');
    bKontrol = kontrolPaneli(b); bSes = sesPaneli(b); bGrafik = grafikPaneli(b);
    panelDugmesi(bKontrol, bKontrolDugme, 'ar-baslik-kontrol');
    panelDugmesi(bSes, bSesDugme, 'ar-baslik-ses');
    panelDugmesi(bGrafik, bGrafikDugme, 'ar-baslik-grafik');
    perdeler.baslik._paneller = [bKontrol, bSes, bGrafik];
    $('div', 'ar-ipucu-alt', b, 'Başlamak için ' + tus('Enter', true));

    /* mola */
    var p = perdeler.mola = $('div', 'ar-perde mola gizli', kok);
    p.setAttribute('role', 'dialog');
    p.setAttribute('aria-labelledby', 'ar-mola-baslik');
    var molaKart = $('div', 'ar-mola-kart', p);
    var molaUst = $('header', 'ar-mola-ust', molaKart);
    $('h2', 'ar-baslik-yazi', molaUst, 'Mola').id = 'ar-mola-baslik';
    $('div', 'ar-kilic', molaUst, SVG.kilic).setAttribute('aria-hidden', 'true');
    var molaGovde = $('div', 'ar-mola-govde', molaKart);
    var pm = $('div', 'ar-menu ar-mola-menu', molaGovde), mKontrol, mSes, mGrafik;
    dugme(pm, 'DEVAM ET', function () { durumYap('oyun'); }, 'ana');
    haritaDugmesi(pm);
    dugme(pm, 'BÖLÜMÜ YENİDEN BAŞLAT', yenidenBasla);
    dugme(pm, 'OYUNUN BAŞINA DÖN', function () { el.baslangicOnayi.showModal(); });
    var molaSekmeler = $('div', 'ar-mola-sekmeler', pm);
    var molaKontrolDugme = dugme(molaSekmeler, 'KONTROLLER', function () { acKapa(mKontrol, [mSes, mGrafik]); }, 'kucuk');
    var molaSesDugme = dugme(molaSekmeler, 'SES', function () { acKapa(mSes, [mKontrol, mGrafik]); }, 'kucuk');
    var molaGrafikDugme = dugme(molaSekmeler, 'GRAFİK', function () { acKapa(mGrafik, [mKontrol, mSes]); }, 'kucuk');
    mKontrol = kontrolPaneli(molaGovde); mSes = sesPaneli(molaGovde); mGrafik = grafikPaneli(molaGovde);
    panelDugmesi(mKontrol, molaKontrolDugme, 'ar-mola-kontrol');
    panelDugmesi(mSes, molaSesDugme, 'ar-mola-ses');
    panelDugmesi(mGrafik, molaGrafikDugme, 'ar-mola-grafik');
    perdeler.mola._paneller = [mKontrol, mSes, mGrafik];
    haritaKur(kok.parentNode);

    el.baslangicOnayi = $('dialog', 'ar-baslangic-onay', kok.parentNode);
    el.baslangicOnayi.setAttribute('aria-labelledby', 'ar-baslangic-baslik');
    el.baslangicOnayi.setAttribute('aria-describedby', 'ar-baslangic-aciklama');
    $('h3', '', el.baslangicOnayi, 'Oyunun başına dön?').id = 'ar-baslangic-baslik';
    $('p', '', el.baslangicOnayi, 'Bu koşudaki ilerlemen sıfırlanacak ve Yanık Köy yeniden başlayacak.').id = 'ar-baslangic-aciklama';
    var onayDugmeleri = $('div', 'ar-baslangic-dugmeler', el.baslangicOnayi);
    dugme(onayDugmeleri, 'VAZGEÇ', function () { el.baslangicOnayi.close(); }).autofocus = true;
    dugme(onayDugmeleri, 'BAŞA DÖN', function () {
      el.baslangicOnayi.close();
      oyunBasinaDon();
    }, 'ana');
    el.cizimBilgisi = $('div', 'ar-cizim-bilgisi', kok.parentNode);
    el.cizimBilgisi.hidden = true;

    var yukleme = perdeler.yukleniyor = $('div', 'ar-perde ar-yukleme gizli', kok);
    var yuklemeIcerik = $('div', 'ar-yukleme-icerik', yukleme);
    el.yuklemeAd = $('h2', '', yuklemeIcerik);
    el.yuklemeCubuk = $('progress', '', yuklemeIcerik);
    el.yuklemeCubuk.max = 100;
    el.yuklemeCubuk.setAttribute('aria-label', 'Bölüm yükleme ilerlemesi');
    el.yuklemeDurum = $('p', '', yuklemeIcerik);
    el.yuklemeDurum.setAttribute('role', 'status');

    /* ölüm */
    var o = perdeler.oldu = $('div', 'ar-perde oldu gizli', kok);
    $('h2', 'ar-buyuk', o, 'ÖLDÜN');
    $('div', 'ar-kilic ar-gec', o, SVG.kilic);
    el.olduOzet = $('div', 'ar-ozet ar-gec', o);
    var od = $('div', 'ar-gec', o);
    dugme(od, 'YENİDEN DENE', yenidenBasla, 'ana');
    $('div', 'ar-ipucu-alt ar-gec', o, atananTus('r') + ' veya ' + tus('Enter', true) + ' ile yeniden dene');

    /* zafer */
    var z = perdeler.kazandi = $('div', 'ar-perde kazandi gizli', kok);
    $('div', 'ar-isin', z); $('div', 'ar-parlama', z);
    el.zaferOzet = $('div', 'ar-ozet ar-gec', z);
    var zd = $('div', 'ar-menu ar-gec', z);
    el.zaferAna = dugme(zd, 'BÖLÜM II: KÜL GEÇİDİ ▶', function () { if (el.zaferAna._eylem) el.zaferAna._eylem(); }, 'ana');
    el.zaferIkinci = dugme(zd, 'TEKRAR OYNA', function () { if (el.zaferIkinci._eylem) el.zaferIkinci._eylem(); });
    el.zaferIpucu = $('div', 'ar-ipucu-alt ar-gec', z, tus('Enter', true) + ' veya ' + atananTus('r'));
    zaferHazirla();

    istSifirla();
    hizala();
  }

  function aktifBolum() {
    return bolumNo(O() && O().bolum);
  }
  function bolumGec(no) {
    sesiAc();
    no = bolumNo(no);
    if (O() && typeof O().bolumGec === 'function') {
      O().bolumGec(no);
    } else if (O() && typeof O().bolumYukle === 'function') {
      O().bolumYukle(no);
      if (O().yenidenBasla) O().yenidenBasla();
      else durumYap('oyun');
    } else {
      if (O()) O().bolum = no;
      yenidenBasla();
    }
  }
  function oyunBasinaDon() {
    hikayeGorulen = {};
    sonKazandiBolum = null;
    bolumGec(1);
  }

  // Resimler ekran kartına yüklenmeden oyun başlamaz (yoksa ilk 2–3 sn takılır): düğme o zamana kadar 'YÜKLENİYOR' gösterir;
  // erken basılırsa yükleme bitince kendiliğinden başlar.
  var bBasla = null, baslaBekliyor = false, hazirZ = 0, hazirSay = 0;
  function hazirMi() {
    var o = O(), y = o && o.onYukleme;
    return !o || o.bolum !== 1 || !y || y.bitti;
  }
  function hazirGuncelle() {
    var y = O() && O().onYukleme, h = hazirMi();
    if (bBasla) {
      var yz = h ? 'BAŞLA' : 'YÜKLENİYOR %' + (y && y.toplam ? Math.round(y.biten / y.toplam * 100) : 0);
      if (bBasla.textContent !== yz) bBasla.textContent = yz;
      bBasla.classList.toggle('bekle', !h);
    }
    if (el.baslaHata) el.baslaHata.classList.toggle('gizli', !(O() && O().bolumYuklemeHatasi));
    return h;
  }
  function hazirIzle(zorla) {
    var y = O() && O().onYukleme, h = hazirGuncelle();
    if (zorla && y && h) {
      if (hazirZ) { clearInterval(hazirZ); hazirZ = 0; }
      if (baslaBekliyor) { baslaBekliyor = false; if (durum() === 'baslik') durumYap('oyun'); }
      return;
    }
    if (hazirZ) return;
    hazirSay = 0;
    hazirZ = setInterval(function () {
      var yy = O() && O().onYukleme, hh = hazirGuncelle();
      hazirSay++;
      if (hh && (yy || hazirSay > 20)) {
        clearInterval(hazirZ); hazirZ = 0;
        if (baslaBekliyor) { baslaBekliyor = false; if (durum() === 'baslik') durumYap('oyun'); }
      }
    }, 60);
  }
  function basla() {
    sesiAc();
    hikayeGorulen = {};
    sonKazandiBolum = null;
    var o = O();
    baslaBekliyor = false;
    if (o && (o.bolum !== 1 || o.bolumYuklemeHatasi)) { bolumGec(1); return; }
    if (!hazirMi()) { baslaBekliyor = true; hazirIzle(); return; }
    durumYap('oyun');
  }
  function yenidenBasla() {
    sesiAc();
    if (O() && O().yenidenBasla) O().yenidenBasla(); else durumYap('oyun');
  }

  var HARITA_ANAHTAR = 'barbar-harita-onsoz';
  var haritaTamamlanan = 0, haritaSecili = 1;
  var HARITA_DURAK = [
    { x: 25, y: 73.8, sira: 'I', goruntu: 'yanik-koy' },
    { x: 45.5, y: 54.8, sira: 'II', goruntu: 'kul-gecidi' },
    { x: 78.5, y: 29.5, sira: 'III', goruntu: 'ayaz-hisari' }
  ];
  function haritaDugmesi(ebeveyn) {
    var b = dugme(ebeveyn, 'HARİTA VE HİKÂYE', haritaAc);
    b.setAttribute('aria-haspopup', 'dialog');
    b.setAttribute('aria-controls', 'ar-onsoz-harita');
  }
  function haritaKur(ebeveyn) {
    try {
      var kayit = Number(localStorage.getItem(HARITA_ANAHTAR));
      if (Number.isInteger(kayit) && kayit >= 0 && kayit <= 3) haritaTamamlanan = kayit;
    } catch (e) { /* kayıt isteğe bağlı */ }
    var pencere = el.harita = $('dialog', 'ar-harita', ebeveyn);
    pencere.id = 'ar-onsoz-harita';
    pencere.setAttribute('aria-labelledby', 'ar-harita-baslik');
    var baslik = $('header', 'ar-harita-ust', pencere);
    var basliklar = $('div', '', baslik);
    $('span', 'ar-harita-ust-yazi', basliklar, 'ÖNSÖZ HARİTASI');
    $('h2', '', basliklar, 'Kuzeyin Son Ateşi').id = 'ar-harita-baslik';
    el.haritaKapat = dugme(baslik, 'KAPAT', function () { pencere.close(); }, 'kucuk');
    var icerik = $('div', 'ar-harita-icerik', pencere);
    var arazi = $('div', 'ar-harita-arazi', icerik);
    $('div', 'ar-harita-kuzey', arazi, 'K<br>↑').setAttribute('aria-hidden', 'true');
    var yol = $('div', 'ar-harita-yol', arazi,
      '<svg viewBox="0 0 100 100" preserveAspectRatio="none">' +
      '<path d="M25 73.8 C28.5 72.7 32.5 73.8 34.2 70.8 S32.4 65.7 31.3 63.3 S34 58.6 37.4 57.3 S42.8 55.7 45.5 54.8"/>' +
      '<path d="M45.5 54.8 C51 53.7 53 52.1 57.8 52.2 S61 48.9 63.4 47.9 S74 43.8 72.2 41.4 S66.9 37.7 70.8 36.1 S77.4 34.8 77.4 32.6 S77.2 31.1 78.5 29.5"/></svg>');
    yol.setAttribute('aria-hidden', 'true');
    el.haritaYol = yol.querySelectorAll('path');
    el.haritaDuraklar = HARITA_DURAK.map(function (durak, i) {
      var b = $('button', 'ar-harita-durak', arazi);
      b.type = 'button';
      b.style.left = durak.x + '%';
      b.style.top = durak.y + '%';
      b.setAttribute('aria-controls', 'ar-harita-kart');
      $('span', 'ar-harita-isaret', b, durak.sira).setAttribute('aria-hidden', 'true');
      $('span', 'ar-harita-etiket', b, BOLUM_ADI[i + 1]);
      b.addEventListener('click', function () { haritaSecili = i + 1; haritaYaz(); });
      return b;
    });
    var kart = el.haritaKart = $('article', 'ar-harita-kart', icerik);
    kart.id = 'ar-harita-kart';
    el.haritaGorsel = $('img', '', kart);
    el.haritaGorsel.alt = '';
    el.haritaDurum = $('span', 'ar-harita-durum', kart);
    var metin = $('div', 'ar-harita-metin', kart);
    metin.setAttribute('aria-live', 'polite');
    el.haritaAd = $('h3', '', metin);
    el.haritaMetin = $('p', '', metin);
    el.haritaIlerleme = $('div', 'ar-harita-ilerleme', kart);
  }
  function haritaAc() {
    if (!el.harita || el.harita.open) return;
    var sonDurak = Math.min(3, haritaTamamlanan + 1);
    haritaSecili = durum() === 'mola' ? Math.min(aktifBolum(), sonDurak) : sonDurak;
    haritaYaz();
    GIRDI.temizle();
    el.harita.showModal();
    el.haritaDuraklar[haritaSecili - 1].focus({ preventScroll: true });
  }
  function haritaYaz() {
    var sonDurak = Math.min(3, haritaTamamlanan + 1);
    el.haritaDuraklar.forEach(function (b, i) {
      var no = i + 1, kilitli = no > sonDurak, bitti = no <= haritaTamamlanan;
      b.classList.toggle('kilitli', kilitli);
      b.setAttribute('aria-pressed', String(no === haritaSecili));
      b.setAttribute('aria-label', BOLUM_ADI[no] + (kilitli ? ', kilitli' : bitti ? ', tamamlandı' : ', açık'));
      b.firstElementChild.textContent = bitti ? '✓' : HARITA_DURAK[i].sira;
    });
    el.haritaYol.forEach(function (p, i) { p.classList.toggle('kilitli', i >= haritaTamamlanan); });
    var kilitli = haritaSecili > sonDurak;
    var gorsel = 'ekran/hikaye-' + HARITA_DURAK[haritaSecili - 1].goruntu + '.webp';
    if (el.haritaGorsel.getAttribute('src') !== gorsel) el.haritaGorsel.src = gorsel;
    el.haritaKart.classList.toggle('kilitli', kilitli);
    el.haritaDurum.textContent = kilitli ? 'Kilitli' : haritaSecili <= haritaTamamlanan ? 'Tamamlandı' : 'Açık';
    el.haritaAd.textContent = BOLUM_ADI[haritaSecili];
    el.haritaMetin.textContent = kilitli
      ? 'Önce ' + BOLUM_ADI[haritaSecili - 1] + ' bölümünü tamamla.'
      : HIKAYE_METIN[haritaSecili].metin;
    el.haritaIlerleme.textContent = haritaTamamlanan + ' / 3 bölüm tamamlandı';
  }
  function haritaBolumTamamla(no) {
    if (O().atla || no <= haritaTamamlanan) return;
    haritaTamamlanan = no;
    try { localStorage.setItem(HARITA_ANAHTAR, String(no)); } catch (e) { /* kayıt isteğe bağlı */ }
  }

  function hikayeYetenekYaz(no) {
    var acilis = no === 2 ? ipucuMetinleri().baltaAcildi : no === 3 ? ipucuMetinleri().kasirga : '';
    el.hikayeYetenek.innerHTML = acilis;
    el.hikayeYetenek.classList.toggle('gizli', !acilis);
  }
  function hikayeGoster(no) {
    if (O() && O().atla) return;
    no = bolumNo(no);
    var h = HIKAYE_METIN[no];
    if (!h || !el.hikaye) return;
    hikayeGorulen[no] = true;
    clearTimeout(hikayeKapatZ); hikayeKapatZ = 0;
    el.hikayeBaslik.textContent = h.baslik;
    el.hikayeMetin.textContent = h.metin;
    hikayeYetenekYaz(no);
    hikayeAcik = true; hikayeSoluyor = false;
    hikayeX = window.OYUNCU?.x ?? 0;
    hikayeY = window.OYUNCU?.y ?? 0;
    hikayeHareketEtti = false;
    hikayeAcilmaT = performance.now();
    el.hikaye.className = 'ar-hikaye goster';
  }
  function hikayeKapat(aninda) {
    if (!el.hikaye) return;
    clearTimeout(hikayeKapatZ); hikayeKapatZ = 0;
    if (aninda) {
      hikayeAcik = false; hikayeSoluyor = false;
      el.hikaye.className = 'ar-hikaye gizli';
      return;
    }
    if (!hikayeAcik || hikayeSoluyor) return;
    hikayeSoluyor = true; hikayeAcik = false;
    el.hikaye.className = 'ar-hikaye sol';
    hikayeKapatZ = setTimeout(function () {
      if (!hikayeAcik) { hikayeSoluyor = false; el.hikaye.className = 'ar-hikaye gizli'; }
    }, 480);
  }
  function hikayeKontrol() {
    if (O() && O().atla) return;
    var no = aktifBolum();
    if (!hikayeGorulen[no]) hikayeGoster(no);
  }

  /* ───────── hizalama: #arayuz tuvalin üstüne ───────── */
  var sonRect = '';
  function tuval() {
    var a = O() && O().app;
    var c = a && (a.view || (a.renderer && a.renderer.view));
    if (c && c.getBoundingClientRect) return c;
    return document.querySelector('#sahne canvas');
  }
  var cizimBaslangic = null, cizimKare = 0;
  function cizimBilgisiYaz(fps) {
    var c = tuval();
    if (!c) return;
    var metin = c.width + ' × ' + c.height + ' · ' + (fps == null ? '—' : fps) + ' FPS';
    if (el.cizimBilgisi.textContent !== metin) el.cizimBilgisi.textContent = metin;
  }
  function cizimBilgisiGuncelle() {
    if (el.cizimBilgisi.hidden) return;
    var simdi = performance.now();
    if (cizimBaslangic === null) { cizimBaslangic = simdi; return; }
    cizimKare++;
    var sure = simdi - cizimBaslangic;
    if (sure < 500) return;
    cizimBilgisiYaz(Math.round(cizimKare * 1000 / sure));
    cizimBaslangic = simdi;
    cizimKare = 0;
  }
  function hizala() {
    var kap = document.getElementById('arayuz'); if (!kap || !kok) return;
    var c = tuval(), x, y, w, h;
    if (c) { var r = c.getBoundingClientRect(); x = r.left; y = r.top; w = r.width; h = r.height; }
    if (!c || w < 2 || h < 2) {   // tuval yoksa pencereye 16:9 sığdır
      var iw = window.innerWidth, ih = window.innerHeight, o = Math.min(iw / W, ih / H);
      w = W * o; h = H * o; x = (iw - w) / 2; y = (ih - h) / 2;
    }
    // TAM EKRAN (19 Kasım): tuval bütün pencereyi kaplar; kök, görünen alanın mantıksal boyunu (≥ 1280×720) alır →
    // köşedeki göstergeler pencerenin gerçek köşelerine, perdeler ortasına oturur; ölçek oyunla aynı (1280×720 pencereye sığar).
    var G = (O() && O().gorunum) || { w: W, h: H }, gw = Math.max(W, G.w || W), gh = Math.max(H, G.h || H);
    var anahtar = x.toFixed(1) + ',' + y.toFixed(1) + ',' + w.toFixed(1) + ',' + h.toFixed(1) + ',' + gw.toFixed(2) + ',' + gh.toFixed(2);
    if (anahtar === sonRect) return;
    sonRect = anahtar;
    // tam cihaz pikseline otur + tek (eşit) ölçek: alt-piksel kaymasından gelen yazı/çizgi bulanıklığı olmasın
    var dpr = window.devicePixelRatio || 1, olc = Math.min(w / gw, h / gh);
    x = Math.round(x * dpr) / dpr; y = Math.round(y * dpr) / dpr;
    kap.style.left = x + 'px'; kap.style.top = y + 'px'; kap.style.width = w + 'px'; kap.style.height = h + 'px';
    kok.style.width = gw + 'px'; kok.style.height = gh + 'px';
    kok.style.transform = 'scale(' + olc + ')';
  }
  var hizalamaKaresi = 0;
  function hizalaIste() {
    if (hizalamaKaresi) return;
    hizalamaKaresi = requestAnimationFrame(function () { hizalamaKaresi = 0; hizala(); });
  }
  window.addEventListener('resize', hizalaIste);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', hizalaIste);
  var izlenenTuval = tuval();
  if (izlenenTuval && typeof ResizeObserver !== "undefined") {
    new ResizeObserver(hizalaIste).observe(izlenenTuval);
  }
  hizalaIste();

  /* ───────── istatistik + ipucu durumu ───────── */
  function istSifirla() {
    ist = { sure: 0, oldurme: 0, hasar: 0, ilerleme: 0, seri: 0, enSeri: 0, seriT: -99 };
    if (el.seri) el.seri.className = 'ar-seri';
    // uzun ipuçları yalnız ilk karşılaşmada: görülen/yapılan bir daha çıkmaz (yeniden başlayınca da)
    ipucu = {
      t: 0, sira: ['yuru', 'savur', 'atil'], aktif: null, aktifT: 0, yapildi: ipucuGorulen, kuyruk: [], gosterildi: ipucuGorulen, bekle: 1.2, sonKontrol: 0
    };
    son = {};
    if (el.ipucu) { el.ipucu.className = 'ar-ipucu'; }
    if (gost) gost.classList.remove('devli');
    if (el.dev) { el.dev.className = 'ar-dev gizli'; var ik = el.dev.querySelector('.govde.ikinci'); if (ik) ik.remove(); }
    if (el.ilerleme) el.ilerleme.classList.remove('gizlen');
    if (el.uyari) el.uyari.className = 'ar-uyari';
    if (el.sahneAdi) { el.sahneAdi.className = 'ar-sahne-adi'; el.sahneAdi.textContent = ''; }
    if (el.sayacB) el.sayacB.textContent = '0';
    hikayeKapat(true);
    devAcik = false; aktifBossRef = null; sonKazandiBolum = null;
  }

  function ipucuMetinleri() { return {
    yuru: atananTus('yukari') + atananTus('sola') + atananTus('asagi') + atananTus('saga') + ' yürü',
    savur: SAVUR_TUS + ' savur — basılı tut, zincir vur',
    atil: atananTus('bosluk') + ' atıl',
    balta: BALTA_TUS + ' baltayı fırlat — dönene dek savuramazsın',
    ok: SAVUR_TUS + ' savurarak okları geri gönder',
    kalkan: 'Kalkanlıyı yandan vur',
    baltaAcildi: 'Balta Atışı açıldı · ' + BALTA_TUS + ' ile fırlat ve geri çağır',
    cagir: BALTA_TUS + ' baltayı geri çağır — dönüşte yolundakileri biçer',
    ofke: 'Savaş Öfkesi hazır · ' + atananTus('e'),
    kasirga: 'Kasırga açıldı · ' + atananTus('x') + ' tuşunu basılı tut ve hareket et',
    yakici: SAVUR_TUS + ' savurarak çömleği geri gönder — ateşte durma',
    gormagulKaya: 'Büyük kaya alçalınca ' + SAVUR_TUS + ' savur ve geri sektir',
    vargorTotem: 'Kor totemlerine baltayla vur, Vargor’un kalkanını kır',
    ayazSkarn: 'Sütunu araya al. Zincir takılınca Skarn’a vur.',
    ayazBuz: 'Buz çatlıyor — ' + atananTus('bosluk') + ' ile atıl',
    ayazMizrak: 'Buz mızrağı yaklaşınca ' + SAVUR_TUS + ' savur',
    ayazKapi: 'Kapının zincirini baltayla kır',
    ayazZincir: 'Dönen baltayı zincirin hattından geçir.',
    ayazMuhafiz: 'Muhafız boşa vurunca yanına geç, baltayla zırhını kır.'
  };
  }
  var IPUCU_ANAHTAR = 'barbar-ipucu', ipucuGorulen = {};
  try { ipucuGorulen = JSON.parse(localStorage.getItem(IPUCU_ANAHTAR) || '{}') || {}; } catch (e) { ipucuGorulen = {}; }
  function ipucuKaydet() { try { localStorage.setItem(IPUCU_ANAHTAR, JSON.stringify(ipucuGorulen)); } catch (e) { /* yok */ } }
  function ipucuYapildi(ad) {
    if (!ipucu.yapildi[ad]) { ipucu.yapildi[ad] = true; ipucuKaydet(); }
    if (ipucu.aktif === ad) ipucuKapat();
  }
  function ipucuKapat() {
    if (!ipucu.aktif) return;
    el.ipucu.classList.add('bitti'); el.ipucu.classList.remove('goster');
    ipucu.aktif = null; ipucu.bekle = 0.7;
  }
  function ipucuIste(ad) {   // durumsal ipucu (ok, kalkan, öfke): bir kez
    if (ipucu.gosterildi[ad] || ipucu.yapildi[ad]) return;
    if (ipucu.kuyruk.indexOf(ad) < 0) ipucu.kuyruk.unshift(ad);
  }
  function patronIpucuIste(ad) {
    if (ipucu.gosterildi[ad] || ipucu.yapildi[ad]) return;
    if (ipucu.aktif && ipucu.aktif !== ad) ipucuKapat();
    ipucuIste(ad);
    ipucu.bekle = Math.min(ipucu.bekle, 0.12);
  }
  function ipucuGuncelle(dt) {
    ipucu.t += dt;
    if (ipucu.aktif) {
      ipucu.aktifT += dt;
      var sinir = ipucu.aktif === 'ofke' ? 6 : 4.5;
      if (ipucu.aktifT > sinir) ipucuKapat();
      return;
    }
    if (ipucu.bekle > 0) { ipucu.bekle -= dt; return; }
    var ad = null;
    // "okları geri gönder" yalnız balta eldeyken (baltasız savurma yok); balta dönünce gösterilir
    var bYok = window.OYUNCU && OYUNCU.baltaVar === false;
    if (bYok && ipucu.kuyruk[0] === 'ok') return;
    while (ipucu.kuyruk.length && !ad) { var a = ipucu.kuyruk.shift(); if (!ipucu.yapildi[a] && !ipucu.gosterildi[a]) ad = a; }
    if (!ad && ipucu.t < 20) {
      while (ipucu.sira.length && !ad) { var b = ipucu.sira.shift(); if (!ipucu.yapildi[b]) ad = b; }
    }
    if (!ad) return;
    ipucu.aktif = ad; ipucu.aktifT = 0; ipucu.gosterildi[ad] = true; ipucuKaydet();
    el.ipucu.innerHTML = '<span class="ic">' + ipucuMetinleri()[ad] + '</span>';
    el.ipucu.className = 'ar-ipucu goster';
  }

  function tekrarAnim(e, sinif) {
    if (!e) return;
    e.classList.remove(sinif);
    if (e._animRaf) cancelAnimationFrame(e._animRaf);
    e._animRaf = requestAnimationFrame(function () {
      e._animRaf = 0;
      e.classList.add(sinif);
    });
  }

  /* ───────── uyarı ───────── */
  var uyariZaman = null, sahneZaman = null;
  function uyar(yazi) {
    el.uyari.textContent = yazi;
    tekrarAnim(el.uyari, 'goster');
    clearTimeout(uyariZaman); uyariZaman = setTimeout(function () { el.uyari.classList.remove('goster'); }, 1600);
  }

  function sahneAdiGoster(yazi) {
    el.sahneAdi.textContent = yazi;
    tekrarAnim(el.sahneAdi, 'goster');
    clearTimeout(sahneZaman);
    sahneZaman = setTimeout(function () { el.sahneAdi.classList.remove('goster'); }, 2600);
  }

  /* ───────── dev / boss çubuğu ───────── */
  var devAcik = false, aktifBossRef = null, sonKazandiBolum = null;
  function aktifBoss() {
    if (aktifBossRef && aktifBossRef.canMax) return aktifBossRef;
    if (window.SKARN && SKARN.aktif) return SKARN;
    if (window.VARGOR && window.VARGOR.aktif) return window.VARGOR;
    if (window.DEV && window.DEV.aktif) return window.DEV;
    if (aktifBolum() === 2 && window.VARGOR && window.VARGOR.canMax) return window.VARGOR;
    return window.DEV || window.VARGOR || null;
  }
  var vargorMekanikSon = 0;
  function vargorMekanikYaz(metin, sure) {
    el.vargorMekanik.textContent = metin;
    el.vargorMekanik.classList.toggle('gizli', !metin);
    vargorMekanikSon = sure ? OYUN.zaman.t + sure : 0;
  }
  function vargorTotemYaz(adet) {
    vargorMekanikYaz('Kor totemlerini kır · ' + adet + ' kaldı');
  }
  function devGoster(v) {
    vargorMekanikYaz('');
    var bNo = v && v.bolum ? bolumNo(v.bolum) : aktifBolum();
    var bilgi = BOSS_BILGI[bNo] || BOSS_BILGI[1];
    aktifBossRef = (v && (v.boss || v.hedef)) || null;
    if (!aktifBossRef) {
      if (bNo === 2 && window.VARGOR && window.VARGOR.aktif) aktifBossRef = window.VARGOR;
      else if (window.DEV && window.DEV.aktif) aktifBossRef = window.DEV;
    }
    if (el.devIsim) el.devIsim.textContent = (v && (v.ad || v.isim)) || bilgi.ad;
    if (el.devUnvan) el.devUnvan.textContent = (v && v.unvan) || bilgi.unvan;
    var D = aktifBoss();
    canSayisiYaz(el.devCan, D);
    var e2 = (v && typeof v.evre2 === 'number') ? v.evre2 : (D && D.AYAR && typeof D.AYAR.evre2 === 'number' ? D.AYAR.evre2 : 0.6);
    var e3 = (v && typeof v.evre3 === 'number') ? v.evre3 : (D && D.AYAR && typeof D.AYAR.evre3 === 'number' ? D.AYAR.evre3 : 0.3);
    el.devCentik[2].style.left = Math.round(e2 * 100) + '%';
    el.devCentik[3].style.left = Math.round(e3 * 100) + '%';

    devAcik = true; son.devOran = null; son.devIzOran = 1; son.devIzBekle = 0; son.devIzYazilan = 1; son.devEvre = 1;
    el.dev.className = 'ar-dev giris';
    clearTimeout(devGoster.z); devGoster.z = setTimeout(function () { if (devAcik) el.dev.classList.remove('giris'); }, 1700);
    el.devCentik[2].className = 'centik e2'; el.devCentik[3].className = 'centik e3';
    el.devIz.style.transform = 'scaleX(1)'; el.devDolu.style.transform = 'scaleX(1)';
    el.ilerleme.classList.add('gizlen');
    gost.classList.add('devli');
  }
  function devKir() {
    if (!devAcik) return;
    devAcik = false;
    vargorMekanikYaz('');
    canSayisiYaz(el.devCan, { can: 0, canMax: el.devCan._max });
    el.devDolu.style.transform = el.devIz.style.transform = 'scaleX(0)';
    var ilk = el.dev.querySelector('.govde.ilk');
    var ikinci = ilk.cloneNode(true); ikinci.className = 'govde ikinci';
    ikinci.querySelector('.can-sayi').remove();
    (el.devCubuk || el.dev).appendChild(ikinci);
    el.dev.className = 'ar-dev kirik';
    setTimeout(function () { if (!devAcik) { el.dev.className = 'ar-dev gizli'; ikinci.remove(); } }, 1200);
  }

  /* ───────── her kare (yalnız 'oyun') ───────── */
  var atilSon = -99, atilSure = 0.9, CAN_G = 300, SERI_PENCERE = 2.6;
  function oyunT() { var z = O() && O().zaman; return (z && z.t) || ist.sure; }
  function seriSay() {
    var t = oyunT();
    ist.seri = (t - ist.seriT <= SERI_PENCERE) ? ist.seri + 1 : 1;
    ist.seriT = t;
    if (ist.seri > ist.enSeri) ist.enSeri = ist.seri;
    if (ist.seri >= 3) {
      el.seriB.textContent = '×' + ist.seri;
      if (!son.seriAcik) { el.seri.classList.remove('bitti'); el.seri.classList.add('acik'); son.seriAcik = true; }
      el.seri.classList.toggle('buyuk', ist.seri >= 10);
      tekrarAnim(el.seri, 'tik');
      tekrarAnim(el.seriSure, 'akar');   // pencere çizgisi baştan akar
    }
  }
  function yuzde(v) { return Math.round(v * 400) / 400; }   // 0.25% adım
  var HEDEF_ADLARI = {
    goblin: 'Goblin', okcu: 'Ork Okçu', kalkanli: 'Kalkanlı Ork',
    saman: 'Şaman', yakici: 'Yakıcı', baskinci: 'Baskıncı', infazci: 'İnfazcı',
    ayaz_mizrak: 'Ayaz Mızrakçısı', ayaz_zincir: 'Hisar Zincircisi', kircil_kurt: 'Kırçıl Kurt', buz_muhafiz: 'Buz Zırhlı Muhafız'
  };
  function canSayisiYaz(elSayi, birim) {
    var max = birim && Math.ceil(birim.canMax);
    var can = max > 0 ? Math.ceil(Math.max(0, Math.min(max, birim.can))) : 0;
    if (elSayi._can === can && elSayi._max === max) return;
    elSayi.textContent = max > 0 ? can + ' / ' + max : '';
    elSayi._can = can; elSayi._max = max;
  }
  function faredekiDusman() {
    var fare = window.GIRDI && GIRDI.fare, dusmanlar = window.DUSMAN && DUSMAN.liste;
    if (!fare || !fare.ekranda || !dusmanlar) return null;
    var hedef = null, on = -Infinity;
    for (var i = 0; i < dusmanlar.length; i++) {
      var d = dusmanlar[i], s = d.sprite;
      if (d.olu || d.kurtGizli || d.can <= 0 || !HEDEF_ADLARI[d.tur] || !s || !s.visible || !s.parent) continue;
      // Use the character frame, excluding floating armor badges and effects.
      var g = s.g, boy = s.boy || 55, yari = Math.max(20, d.r || 0);
      if (Math.abs(fare.x - s.x) > boy + yari || Math.abs(fare.y - s.y) > boy * 1.6) continue;
      var dx = fare.x - s.x, dy = fare.y - s.y;
      if (g && g.texture && g.visible) {
        var ax = g.anchor.x, ay = g.anchor.y;
        var w = g.texture.orig.width * g.scale.x, h = g.texture.orig.height * g.scale.y;
        var x1 = g.x - ax * w, x2 = x1 + w, y1 = g.y - ay * h, y2 = y1 + h;
        if (dx < Math.min(x1, x2) - 3 || dx > Math.max(x1, x2) + 3 ||
            dy < Math.min(y1, y2) - 3 || dy > Math.max(y1, y2) + 3) continue;
      } else if (Math.abs(dx) > yari || dy < -boy || dy > 5) continue;
      var kat = s.y + (s.zEk || 0);
      if (kat >= on) { hedef = d; on = kat; }
    }
    return hedef;
  }
  function hedefGuncelle() {
    var d = durum() === 'oyun' && !hikayeAcik ? faredekiDusman() : null;
    if (!d) { if (!el.hedef.classList.contains('gizli')) el.hedef.classList.add('gizli'); return; }
    if (el.hedefAd.textContent !== HEDEF_ADLARI[d.tur]) el.hedefAd.textContent = HEDEF_ADLARI[d.tur];
    canSayisiYaz(el.hedefCan, d);
    var oran = yuzde(d.can / d.canMax);
    if (son.hedefOran !== oran) {
      el.hedefDolu.style.transform = 'scaleX(' + oran + ')';
      son.hedefOran = oran;
    }
    el.hedef.classList.remove('gizli');
  }
  window.addEventListener('pointerout', function (e) {
    if (!e.relatedTarget && window.GIRDI) GIRDI.fare.ekranda = false;
  });

  function guncelle(dt) {
    var oz = O(), zt = oz && oz.zaman, gdt = dt || 0;   // oyun dt (alt adımlarda bölünmüş)
    var P = window.OYUNCU;
    if (P) {
      var cm = P.canMax || 100, c = Math.max(0, Math.min(cm, P.can != null ? P.can : cm));
      var oran = yuzde(c / cm);
      if (son.can == null) {
        son.canIzOran = oran; son.canIzBekle = 0; son.canIzYazilan = oran;
        el.canDolu.style.transform = el.canIz.style.transform = 'translateX(' + (-(1 - oran) * CAN_G).toFixed(1) + 'px)';
        var ilkKritik = oran <= 0.3 && c > 0;
        el.solAlt.classList.toggle('kritik', ilkKritik); el.kanKenar.classList.toggle('acik', ilkKritik); son.kritik = ilkKritik;
        son.can = oran;
      } else if (oran !== son.can) {
        // şerit sağdan aşınır: dolu kısım sola kayar (yalnız kaydırma; doku/maske sabit)
        el.canDolu.style.transform = 'translateX(' + (-(1 - oran) * CAN_G).toFixed(1) + 'px)';
        if (oran > son.canIzOran) {
          son.canIzOran = oran; son.canIzBekle = 0;
        } else if (oran < son.can) {
          if (son.canIzOran < son.can) son.canIzOran = son.can;
          son.canIzBekle = Math.max(son.canIzBekle || 0, 0.22);
        }
        var kritik = oran <= 0.3 && c > 0;
        if (kritik !== son.kritik) { el.solAlt.classList.toggle('kritik', kritik); el.kanKenar.classList.toggle('acik', kritik); son.kritik = kritik; }
        son.can = oran;
      }
      if (son.canIzOran > oran) {
        if (son.canIzBekle > 0) son.canIzBekle = Math.max(0, son.canIzBekle - gdt);
        else son.canIzOran = Math.max(oran, son.canIzOran - Math.max(0.22, (son.canIzOran - oran) * 3.8) * gdt);
      } else {
        son.canIzOran = oran;
      }
      if (son.canIzYazilan == null || Math.abs(son.canIzOran - son.canIzYazilan) > 0.001 || (son.canIzOran === oran && son.canIzYazilan !== oran)) {
        el.canIz.style.transform = 'translateX(' + (-(1 - son.canIzOran) * CAN_G).toFixed(1) + 'px)';
        son.canIzYazilan = son.canIzOran;
      }
      var cs = Math.ceil(c);
      if (cs !== son.canSayi) { el.canSayi.textContent = cs; son.canSayi = cs; }

      var ofkeAcik = P.yetenekAcik('ofke');
      if (ofkeAcik !== son.ofkeAcik) {
        el.ofke.classList.toggle('gizli', !ofkeAcik);
        son.ofkeAcik = ofkeAcik;
      }
      var baltaAcik = P.yetenekAcik('balta');
      if (baltaAcik !== son.baltaAcik) {
        el.balta.classList.toggle('gizli', !baltaAcik);
        son.baltaAcik = baltaAcik;
      }
      var of = yuzde(Math.max(0, Math.min(100, P.ofke || 0)) / 100);
      if (of !== son.ofke) {
        var ofkePiksel = (of * 285).toFixed(1) + 'px';
        el.ofkeDolu.style.transform = 'translateX(calc(' + ofkePiksel + ' - 100%))';
        el.ofke.style.setProperty('--of', ofkePiksel);
        son.ofke = of;
      }
      var ofs = Math.round(Math.max(0, Math.min(100, P.ofke || 0)));   // şerit içi sayı (sağ uca hizalı)
      if (ofs !== son.ofkeSayi && el.ofkeSayi) { el.ofkeSayi.textContent = ofs; if (el.ofkeSayi2) el.ofkeSayi2.textContent = ofs; son.ofkeSayi = ofs; }
      var ofDurum = P.ofkeli ? 'aktif' : (of >= 1 ? 'hazir' : '');
      if (ofDurum !== son.ofDurum) {
        el.ofke.classList.toggle('aktif', ofDurum === 'aktif');
        el.ofke.classList.toggle('hazir', ofDurum === 'hazir');
        son.ofDurum = ofDurum;
        if (ofkeAcik && ofDurum === 'hazir') ipucuIste('ofke');
        if (ofDurum === 'hazir') tekrarAnim(el.ofke, 'cagri');
      }
      // öfke açıkken geri sayım (tam saniye; yalnız değişince yazılır)
      if (P.ofkeli) {
        var gs = Math.max(0, Math.ceil(of * 6 - 0.001));
        if (gs !== son.ofGeri) { el.ofkeGeri.textContent = gs; son.ofGeri = gs; if (gs <= 2) tekrarAnim(el.ofkeGeri, 'tik'); }
      } else son.ofGeri = null;
      var bv = P.baltaVar !== false;
      var kasirgaAcik = P.yetenekAcik('kasirga');
      var kasirgaHazir = kasirgaAcik && P.ofke > 0 && !P.ofkeli && bv;
      var kasirgaDurum = kasirgaAcik ? (kasirgaHazir ? 'hazir' : 'bekle') : 'kapali';
      if (kasirgaDurum !== son.kasirga) {
        el.kasirga.classList.toggle('gizli', !kasirgaAcik);
        el.kasirga.classList.toggle('hazir', kasirgaHazir);
        son.kasirga = kasirgaDurum;
      }
      // balta dışarıda ve geri çağrılabilir: rozet "çağır" (dönen ok); çağrıldı/dönüyor: "YOK"
      var cg = !bv && !!P.baltaCagrilir;
      if (cg !== son.cagir) {
        el.balta.classList.toggle('cagir', cg);
        el.baltaYazi.textContent = cg ? 'çağır' : 'fırlat';
        if (cg) ipucuIste('cagir');
        son.cagir = cg;
      }
      if (bv !== son.balta) {
        el.balta.classList.toggle('yok', !bv);
        el.savur.classList.toggle('yok', !bv);   // balta elde değilken savurulamaz: rozet kilitli
        if (bv && son.balta === false) { parla(el.balta); parla(el.savur); }
        son.balta = bv;
      }
    }
    // atılma bekleme halkası
    var t = (zt && zt.t) || ist.sure, p;
    if (P && typeof P.atilBekle === 'number' && P.atilBekleMax) p = 1 - P.atilBekle / P.atilBekleMax;
    else p = (t - atilSon) / atilSure;
    p = Math.max(0, Math.min(1, p)); p = Math.round(p * 200) / 200;
    if (p !== son.atil) {
      el.atilBekle.style.transform = 'scaleY(' + (1 - p).toFixed(3) + ')';
      el.atil.classList.toggle('bekliyor', p < 1);
      if (p >= 1 && son.atil != null && son.atil < 1) parla(el.atil);
      son.atil = p;
    }
    // seri penceresi doldu mu
    if (ist.seri > 0 && t - ist.seriT > SERI_PENCERE) {
      ist.seri = 0;
      if (son.seriAcik) { el.seri.classList.remove('acik'); el.seri.classList.add('bitti'); son.seriAcik = false; }
    }
    // ilerleme
    var B = window.BOLUM;
    if (B && typeof B.ilerleme === 'number') {
      var il = yuzde(B.gostergeIlerlemesi);
      ist.ilerleme = Math.max(ist.ilerleme, B.ilerleme);
      if (il !== son.ilerleme) { el.ilerlemeDolu.style.transform = 'scaleX(' + il + ')'; el.ilerlemeUc.style.transform = 'translateX(' + (il * 396).toFixed(1) + 'px)'; son.ilerleme = il; }
    }
    if (vargorMekanikSon && OYUN.zaman.t >= vargorMekanikSon) vargorMekanikYaz('');
    // boss (dev / Vargor)
    var D = aktifBoss();
    if (devAcik && D && D.canMax) {
      canSayisiYaz(el.devCan, D);
      var ev = D.evre || 1;
      if (ev !== son.devEvre) {   // evre geçişi: o evrenin çentiği kırılır, çubuk sarsılır
        for (var en = 2; en <= 3; en++) if (ev >= en && son.devEvre < en) el.devCentik[en].classList.add('kirildi');
        if (ev > son.devEvre) tekrarAnim(el.devGovde, 'evre');
        son.devEvre = ev;
      }
      var d = yuzde(Math.max(0, Math.min(1, D.can / D.canMax)));
      if (son.devOran == null) {
        son.devIzOran = d; son.devIzBekle = 0; son.devIzYazilan = d;
        el.devDolu.style.transform = el.devIz.style.transform = 'scaleX(' + d + ')';
        son.devOran = d;
      } else if (d !== son.devOran) {
        el.devDolu.style.transform = 'scaleX(' + d + ')';
        if (d > (son.devIzOran || 0)) {
          son.devIzOran = d; son.devIzBekle = 0;
        } else if (d < son.devOran) {
          if (son.devIzOran < son.devOran) son.devIzOran = son.devOran;
          son.devIzBekle = Math.max(son.devIzBekle || 0, 0.24);
        }
        son.devOran = d;
      }
      if (son.devIzOran > d) {
        if (son.devIzBekle > 0) son.devIzBekle = Math.max(0, son.devIzBekle - gdt);
        else son.devIzOran = Math.max(d, son.devIzOran - Math.max(0.18, (son.devIzOran - d) * 3.4) * gdt);
      } else {
        son.devIzOran = d;
      }
      if (son.devIzYazilan == null || Math.abs(son.devIzOran - son.devIzYazilan) > 0.0005 || (son.devIzOran === d && son.devIzYazilan !== d)) {
        el.devIz.style.transform = 'scaleX(' + son.devIzOran.toFixed(4) + ')';
        son.devIzYazilan = son.devIzOran;
      }
    }
    // ipuçları
    if (window.GIRDI && (GIRDI.hx || GIRDI.hy)) ipucuYapildi('yuru');
    ipucu.sonKontrol -= gdt;
    if (ipucu.sonKontrol <= 0) {
      ipucu.sonKontrol = 0.5;
      if (!ipucu.gosterildi.kalkan && window.DUSMAN && DUSMAN.liste && oz && oz.kamera) {
        var ky = oz.kamera.y;
        for (var i = 0; i < DUSMAN.liste.length; i++) {
          var e = DUSMAN.liste[i];
          if (e.tur === 'kalkanli' && !e.olu && (oz.gorusteMi ? oz.gorusteMi(e.x, e.y, -40) : (e.y > ky + 40 && e.y < ky + H - 40))) { ipucuIste('kalkan'); break; }   // ekranda gerçekten görünüyor mu (yakınlık)
        }
      }
    }
    if (hikayeAcik) {
      if (durum() === 'oyun' && window.OYUNCU) {
        if (Math.hypot(OYUNCU.x - hikayeX, OYUNCU.y - hikayeY) >= 12) hikayeHareketEtti = true;
        if (hikayeHareketEtti && performance.now() - hikayeAcilmaT >= HIKAYE_OKUMA_MS) hikayeKapat(false);
      }
    } else {
      ipucuGuncelle(gdt);
    }
  }
  function parla(e) { tekrarAnim(e, 'hazir-oldu'); }

  /* ───────── ekran durumları ───────── */
  function zaferHazirla() {
    if (!el.zaferAna || !el.zaferIkinci) return;
    var b = sonKazandiBolum || aktifBolum();
    el.zaferIkinci.classList.toggle('gizli', b === 3);
    if (b === 1) {
      el.zaferAna.textContent = 'BÖLÜM II: KÜL GEÇİDİ ▶';
      el.zaferAna._eylem = function () { bolumGec(2); };
      el.zaferIkinci.textContent = 'TEKRAR OYNA';
      el.zaferIkinci._eylem = yenidenBasla;
      if (el.zaferIpucu) el.zaferIpucu.innerHTML = tus('Enter', true) + ' ile Bölüm II · ' + atananTus('r') + ' ile tekrar oyna';
    } else if (b === 2) {
      el.zaferAna.textContent = 'BÖLÜM III: AYAZ HİSARI ▶';
      el.zaferAna._eylem = function () { bolumGec(3); };
      el.zaferIkinci.textContent = 'TEKRAR OYNA';
      el.zaferIkinci._eylem = yenidenBasla;
      el.zaferIpucu.innerHTML = tus('Enter', true) + ' ile Bölüm III · ' + atananTus('r') + ' ile tekrar oyna';
    } else {
      el.zaferAna.textContent = 'BAŞTAN OYNA';
      el.zaferAna._eylem = oyunBasinaDon;
      el.zaferIkinci._eylem = null;
      if (el.zaferIpucu) el.zaferIpucu.innerHTML = atananTus('r') + ' veya ' + tus('Enter', true) + ' ile baştan oyna';
    }
  }
  function ozetYaz(kutu, satirlar) {
    kutu.innerHTML = satirlar.map(function (s) { return '<div><b>' + s[0] + '</b><span>' + s[1] + '</span></div>'; }).join('');
  }
  function sureYazi(sn) { sn = Math.round(sn); var d = Math.floor(sn / 60), s = sn % 60; return d + ':' + (s < 10 ? '0' : '') + s; }
  var sonDurum = null;
  function durumDegisti(d) {
    tusSeciminiKapat();
    if (!kok) return;
    if (d === sonDurum) return;
    var onceki = sonDurum; sonDurum = d;
    if (el.harita?.open && d !== 'baslik' && d !== 'mola') el.harita.close();
    document.body.className = document.body.className.replace(/\bd-\w+/g, '').trim() + ' d-' + d;
    Object.keys(perdeler).forEach(function (k) {
      var g = k !== d;
      if (!g && perdeler[k].classList.contains('gizli')) {
        perdeler[k].classList.remove('gizli');
        (perdeler[k]._paneller || []).forEach(function (pn) { panelAcikYap(pn, false); });
      } else if (g) perdeler[k].classList.add('gizli');
    });
    var gostergeGizli = d !== 'oyun';
    gost.classList.toggle('gizli', gostergeGizli);
    gost.setAttribute('aria-hidden', String(gostergeGizli));
    if (d === 'yukleniyor') {
      el.yuklemeAd.textContent = BOLUM_ADI[OYUN.bolumGecis.bolum];
      el.yuklemeCubuk.value = 0;
      el.yuklemeDurum.textContent = 'Bölüm hazırlanıyor…';
    }
    sesKaydiricilar.forEach(function (f) { f(); });
    if (d === 'baslik') hazirIzle(!!(O() && O().onYukleme));
    if (d !== 'oyun' && d !== 'mola') hikayeKapat(true);
    if (d === 'oyun' && (onceki === 'baslik' || onceki === 'oldu' || onceki === 'kazandi' || onceki === 'yukleniyor')) {
      istSifirla();
      guncelleGuvenli(0);
      hikayeKontrol();
      if (aktifBolum() === 2) ipucuIste('balta');
      else if (aktifBolum() === 3) ipucuIste('kasirga');
    }
    if (d === 'oldu') {
      var B = window.BOLUM; if (B && typeof B.ilerleme === 'number') ist.ilerleme = Math.max(ist.ilerleme, B.ilerleme);
      var os = [[sureYazi(ist.sure), 'Süre'], [ist.oldurme, 'Öldürülen'], [Math.round(ist.hasar), 'Alınan hasar']];
      if (ist.enSeri >= 3) os.push(['×' + ist.enSeri, 'En uzun seri']);
      os.push(['%' + Math.round(ist.ilerleme * 100), 'Yol']);
      ozetYaz(el.olduOzet, os);
    }
    if (d === 'kazandi') {
      haritaBolumTamamla(aktifBolum());
      zaferHazirla();
      var zs = [[sureYazi(ist.sure), 'Süre'], [ist.oldurme, 'Öldürülen'], [Math.round(ist.hasar), 'Alınan hasar']];
      if (ist.enSeri >= 3) zs.push(['×' + ist.enSeri, 'En uzun seri']);
      ozetYaz(el.zaferOzet, zs);
    }
    if (d === 'baslik' || d === 'mola' || d === 'oldu' || d === 'kazandi') {
      var ilk = perdeler[d] && perdeler[d].querySelector('.ar-dugme');
      if (ilk && d !== 'oldu' && d !== 'kazandi') setTimeout(function () { try { ilk.focus({ preventScroll: true }); } catch (e) { /* yok */ } }, 50);
    }
  }
  function guncelleGuvenli(dt) { try { guncelle(dt); } catch (e) { if (!guncelleGuvenli.hata) { guncelleGuvenli.hata = 1; console.warn('arayuz:', e); } } }

  /* ───────── klavye ve hikâye geçişi ───────── */
  var sonKlavye = 0;
  document.addEventListener('keydown', function (e) {
    if (el.harita?.open) {
      e.stopImmediatePropagation();
      if (e.key === 'Escape') { e.preventDefault(); el.harita.close(); }
      return;
    }
    if (tusSecimi && e.code !== 'Tab') {
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      var bayrak = tusSecimi;
      if (e.code === 'Escape') { tusSeciminiKapat(); return; }
      if (bayrak.kontrolcu) return;
      if (GIRDI.tusAta(bayrak.ad, e.code)) {
        tusSeciminiKapat();
        bayrak.yazi.textContent = 'Atandı · ' + bayrak.dugme.getAttribute('aria-label');
      } else bayrak.yazi.textContent = 'Bu tuş menü veya tarayıcı için ayrılmış. Başka bir tuşa bas.';
      return;
    }
    if (e.key === 'Escape'  && el.baslangicOnayi.open) {
      e.preventDefault();
      e.stopPropagation();
      el.baslangicOnayi.close();
    } else if (e.key === 'Escape' && menuPaneliKapat()) {
      e.preventDefault();
      e.stopImmediatePropagation();
    } else if (e.code === 'KeyF' && e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat) return;
      el.cizimBilgisi.hidden = !el.cizimBilgisi.hidden;
      cizimBaslangic = null;
      cizimKare = 0;
      if (!el.cizimBilgisi.hidden) cizimBilgisiYaz(null);
    }
  }, true);
  document.addEventListener('visibilitychange', function () {
    cizimBaslangic = null;
    cizimKare = 0;
  });
  document.addEventListener('keydown', function (e) {
    var k = e.key, d = durum();
    if (e.repeat) return;
    if (d === 'oyun' && hikayeAcik && k === 'Enter') {
      if (performance.now() - hikayeAcilmaT >= 250) hikayeKapat(false);
      return;
    }
    var simdi = performance.now();
    if (simdi - sonKlavye < 150) return;
    if (d === 'baslik' && (k === 'Enter' || k === ' ')) {
      var ae = document.activeElement;
      if (ae && ae.classList && ae.classList.contains('ar-dugme') && ae !== bBasla) return;
      e.preventDefault(); sonKlavye = simdi; basla(); return;
    }
    if (d === 'oldu' && (k === 'Enter' || GIRDI.tusEylemi(e.code) === 'r')) {
      if (document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('ar-dugme')) document.activeElement.blur();
      e.preventDefault(); sonKlavye = simdi; yenidenBasla(); return;
    }
    if (d === 'kazandi' && (k === 'Enter' || GIRDI.tusEylemi(e.code) === 'r')) {
      var ak = document.activeElement;
      e.preventDefault(); sonKlavye = simdi;
      if (GIRDI.tusEylemi(e.code) === 'r') {
        if (ak && ak.classList && ak.classList.contains('ar-dugme')) ak.blur();
        var eylem = el.zaferIkinci._eylem || el.zaferAna._eylem;
        if (eylem) eylem();
      } else if (ak === el.zaferIkinci && el.zaferIkinci._eylem) {
        ak.blur();
        el.zaferIkinci._eylem();
      } else {
        if (ak && ak.classList && ak.classList.contains('ar-dugme')) ak.blur();
        if (el.zaferAna && el.zaferAna._eylem) el.zaferAna._eylem(); else yenidenBasla();
      }
      return;
    }
    if (GIRDI.tusEylemi(e.code) === 'esc') {
      if (d !== 'oyun' && d !== 'mola') return;
      if (O() && O().molaTusu) return;   // çekirdek kendisi yapıyor
      // çekirdek de mola tuşunu işliyorsa çift değiştirme olmasın: kısa süre sonra durum hâlâ aynıysa biz değiştiririz
      var hedef = d === 'oyun' ? 'mola' : 'oyun';
      sonKlavye = simdi;
      setTimeout(function () { if (durum() === d) durumYap(hedef); }, 90);
    }
  });

  function menuPaneliKapat() {
    var menu = perdeler[durum()];
    var panel = (menu?._paneller || []).find(function (p) { return !p.classList.contains('gizli'); });
    if (!panel) return false;
    panelAcikYap(panel, false);
    (panel._dugme || menu.querySelector('button')).focus({ preventScroll: true });
    return true;
  }

  function kontrolcuMenuTusu(no) {
    if (tusSecimi) {
      if (!tusSecimi.kontrolcu) return;
      var secim = tusSecimi;
      if (GIRDI.padAta(secim.ad, no)) {
        tusSeciminiKapat();
        secim.yazi.textContent = 'Atandı · ' + secim.dugme.getAttribute('aria-label');
      } else secim.yazi.textContent = 'Yön tuşları hareket ve menü için ayrıldı.';
      return;
    }
    var d = durum(), pencere = el.harita.open ? el.harita : el.baslangicOnayi;
    if (no === 1 || no === 9 || (d === 'mola' && GIRDI.padEylemi(no) === 'esc' && no > 1 && no < 12)) {
      if (pencere.open) { pencere.close(); return; }
      if (!menuPaneliKapat() && d === 'mola') durumYap('oyun');
      return;
    }
    var alan = pencere.open ? pencere : perdeler[d];
    if (!alan || alan.classList.contains('gizli') || d === 'yukleniyor') return;
    var dugmeler = Array.from(alan.querySelectorAll('button')).filter(function (b) { return !b.disabled && b.getClientRects().length; });
    var secili = document.activeElement, i = dugmeler.indexOf(secili);
    if (!pencere.open && GIRDI.padEylemi(no) === 'r') {
      if (d === 'oldu') { yenidenBasla(); return; }
      if (d === 'kazandi') { (el.zaferIkinci._eylem || el.zaferAna._eylem)?.(); return; }
    }
    if (no === 0) { (dugmeler[i] || dugmeler[0])?.click(); return; }
    if (no >= 12 && no <= 15 && dugmeler.length) {
      var sonraki = i < 0 ? 0 : (i + (no === 12 || no === 14 ? -1 : 1) + dugmeler.length) % dugmeler.length;
      dugmeler[sonraki].focus();
    }
  }

  /* ───────── olaylar ───────── */
  function olaylariBagla() {
    var L = window.OLAY; if (!L || !L.on) return;
    L.on('tusAtamalari', tusEtiketleriniYaz);
    L.on('kontrolcuAtamalari', tusEtiketleriniYaz);
    L.on('kontrolcuBaglanti', function (bagli) {
      if (!bagli && tusSecimi?.kontrolcu) tusSeciminiKapat();
      baglantiYaz();
    });
    L.on('kontrolcuGiris', function (aktif) {
      document.body.classList.toggle('kontrolcu-kullaniliyor', aktif);
      tusEtiketleriniYaz();
    });
    L.on('kontrolcuTusu', kontrolcuMenuTusu);
    L.on('durum', function (v) { durumDegisti(typeof v === 'string' ? v : (v && (v.d || v.durum)) || durum()); });
    L.on('bolum', function () { hazirIzle(!!(O() && O().onYukleme)); });
    L.on('kazandi', function (v) {
      if (v && (v.bolum === 1 || v.bolum === 2 || v.bolum === 3)) {
        sonKazandiBolum = v.bolum;
        if (sonDurum === 'kazandi') zaferHazirla();
      }
    });
    L.on('olum', function (v) {
      if (!v || v.hedef === window.OYUNCU || v.tur === 'oyuncu') return;
      ist.oldurme++;
      if (el.sayacB) {
        el.sayacB.textContent = ist.oldurme;
        tekrarAnim(el.sayac, 'vur');
        seriSay();
      }
    });
    L.on('vurus', function (v) {
      var h = v && v.hedef;
      if (devAcik && h && (h === window.DEV || h === window.VARGOR || h === aktifBossRef || h.tur === 'dev' || h.tur === 'vargor' || h.devMi) && v.tur !== 'sekme') tekrarAnim(el.devGovde, 'sarsil');
    });
    L.on('oyuncuHasar', function (v) {
      ist.hasar += (v && v.miktar) || 0;
      tekrarAnim(el.solAlt, 'vuruldu');
    });
    L.on('savur', function () { ipucuYapildi('savur'); parla(el.savur); });
    L.on('atil', function () { ipucuYapildi('atil'); var z = O() && O().zaman; atilSon = (z && z.t) || ist.sure; });
    L.on('baltaAt', function () { ipucuYapildi('balta'); });
    L.on('baltaCagir', function () { ipucuYapildi('cagir'); });
    L.on('ayazBolge', function (v) {
      if (!v || !v.ad || durum() !== 'oyun') return;
      if (v.kapi) ipucuYapildi('ayazKapi');
      sahneAdiGoster(v.ad);
    });
    L.on('gormagulKayaHazir', function () { patronIpucuIste('gormagulKaya'); });
    L.on('vargorTotemler', function (v) {
      vargorTotemYaz(v.adet);
      patronIpucuIste('vargorTotem');
    });
    L.on('totemKir', function (v) {
      if (v.kalan > 0) vargorTotemYaz(v.kalan);
      else ipucuYapildi('vargorTotem');
    });
    L.on('kalkanKir', function (v) {
      if (v.boss === window.VARGOR) vargorMekanikYaz('Kalkan kırıldı · Vargor’a vur', v.sure);
    });
    L.on('skarnSutunIsaret', function () { patronIpucuIste('ayazSkarn'); });
    L.on('skarnAcik', function () { ipucuYapildi('ayazSkarn'); });
    L.on('ayazBuzCatlak', function () { patronIpucuIste('ayazBuz'); });
    L.on('ayazZincirHazir', function () { ipucuIste('ayazZincir'); });
    L.on('ayazZincirKes', function () { ipucuYapildi('ayazZincir'); });
    L.on('ayazMuhafizAcik', function () { ipucuIste('ayazMuhafiz'); });
    L.on('zirhKir', function (v) { if (v && v.hedef && v.hedef.tur==='buz_muhafiz') ipucuYapildi('ayazMuhafiz'); });
    L.on('sektir', function (v) {
      if (v && v.tur === 'kaya' && v.geri === true) ipucuYapildi('gormagulKaya');
      else if (v && v.tur === 'buz_mizrak') ipucuYapildi('ayazMizrak');
      else if (!v || v.tur === 'ok') ipucuYapildi('ok');
    });
    L.on('mermi', function (v) { if (v && v.tur === 'ok') ipucuIste('ok'); else if (v && v.tur === 'buz_mizrak') ipucuIste('ayazMizrak'); else if (v && v.tur === 'comlek' && v.sahip !== 'oyuncu') ipucuIste('yakici'); });
    L.on('blok', function (v) {
      if (v && v.vargor) patronIpucuIste('vargorTotem');
      else if (v && v.ayazKapi) ipucuIste('ayazKapi');
      else ipucuIste('kalkan');
    });
    L.on('ofke', function (v) { if (v && v.acik) ipucuYapildi('ofke'); });
    L.on('kasirga', function () { ipucuYapildi('kasirga'); tekrarAnim(el.kasirga, 'cagri'); });
    L.on('arena', function (v) {
      setTimeout(function () {
        var B = window.BOLUM, kilitli = B && typeof B.arenaKilitli === 'boolean' ? B.arenaKilitli : !(v && v.acik);
        // devin alanında uyarı yok: dev girişi (ad şeridi + kükreme) kendi başına yeter, gövdesine yazı binmesin
        var devde = devAcik || (window.SKARN && SKARN.aktif) || (window.DEV && DEV.aktif) || (window.VARGOR && VARGOR.aktif) || (v && /dev|vargor/i.test(v.ad || ''));
        if (kilitli && !devde && durum() === 'oyun') uyar('KAÇIŞ YOK');
      }, 0);
    });
    L.on('devBasla', devGoster);
    L.on('devOldu', devKir);
  }

  /* ───────── dışa açık ───────── */
  function acilisiGecir() {
    var perde = document.getElementById('acilis');
    if (!perde) return;
    if (OYUN.atla) { perde.remove(); return; }
    var ticker = OYUN.app.ticker;
    function ilkKare() {
      // Pixi sahneyi çizdikten sonra çalışır; zemin yer tutucusu hâlâ görünüyorsa bekle.
      var hazir = window.BOLUM && BOLUM.girisHazir();
      var atlasBitti = OYUN.onYukleme?.bitti;
      if (!hazir && !(atlasBitti && OYUN.katman.zemin.children.length)) return;
      ticker.remove(ilkKare);
      perde.setAttribute('aria-hidden', 'true');
      perde.classList.add('acilis-bitti');
      setTimeout(function () { perde.remove(); }, 300);
    }
    ticker.add(ilkKare, null, PIXI.UPDATE_PRIORITY.UTILITY);
  }

  window.ARAYUZ = {
    hizala: hizala,
    uyar: uyar,
    ipucu: function (ad) { ipucuIste(ad); },
    devGoster: devGoster, devKir: devKir,
    hikayeKapat: hikayeKapat,
    ist: function () { return ist; },
    sesAyar: sesAyar,
    _guncelle: guncelleGuvenli
  };

  tusEtiketleriniYaz();
  kur();
  tusEtiketleriniYaz();
  olaylariBagla();
  if (window.OYUN && OYUN.sistem) {
    OYUN.sistem('arayuz', {
      baslat: function () { sesUygula(); hazirIzle(false); durumDegisti(durum()); acilisiGecir(); },
      guncelle: guncelleGuvenli,
      herKare: function (gdt) {
        cizimBilgisiGuncelle();
        if (durum() === 'oyun' && ist) ist.sure += gdt || 0;
        hedefGuncelle();
        var gecis = OYUN.bolumGecis;
        if (durum() === 'yukleniyor' && gecis) {
          var dosya = gecis.dosyalar, yukleme = gecis.yukleme;
          var dosyaPayi = dosya.toplam ? 30 : 0;
          var yuzde = dosya.toplam ? dosyaPayi * dosya.biten / dosya.toplam : 0;
          var metin = dosya.toplam ? 'Grafik dosyaları açılıyor…' : 'Bölüm hazırlanıyor…';
          if (yukleme) {
            yuzde = dosyaPayi + (yukleme.toplam ? (88 - dosyaPayi) * yukleme.biten / yukleme.toplam : 0);
            metin = 'Grafikler hazırlanıyor…';
          }
          if (gecis.zemin) { yuzde = 94; metin = 'Zemin hazırlanıyor…'; }
          yuzde = Math.round(yuzde);
          if (el.yuklemeCubuk.value !== yuzde) el.yuklemeCubuk.value = yuzde;
          if (el.yuklemeDurum.textContent !== metin) el.yuklemeDurum.textContent = metin;
        }
      },
      sifirla: function () { istSifirla(); }
    });
  }
  durumDegisti(durum());
})();
