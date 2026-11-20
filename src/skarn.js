/* Ayaz Hisarı'nın zincir muhafızı. Ayak koordinatları, saldırı uyarıları ve isabet alanları aynı uzayı kullanır. */
(function () {
  'use strict';

  var BOLUM_NO = 3;
  var SKARN = window.SKARN = {
    ad: 'SKARN', unvan: 'Zincir Muhafızı', tur: 'skarn', devMi: true, boss: true,
    aktif: false, olu: false, canli: false, evre: 1, durum: 'yok',
    x: 0, y: 0, r: 53, aci: Math.PI / 2, can: 4200, canMax: 4200,
    evre2: 0.66, evre3: 0.33, sersem: 0, sprite: null, basla: basla, hasarAl: hasarAl, bilgi: bilgi, saldir: saldir
  };
  var KAP = { kalin: 24, kazikR: 22, cekme: 520, dayak: 28, sersem: 1.72 };
  var HAMLE = {
    zincir: { isabet: .18, sure: 0.86, kilit: 0.39, aktif: 0.31, sonra: 0.60, boy: 465, pay: KAP.kalin },
    savur: { isabet: .11, sure: 0.63, kilit: 0.26, aktif: 0.22, sonra: 0.54, boy: 181, aci: 0.88, hasar: 24 },
    ez: { isabet: .11, sure: 0.79, kilit: 0.01, aktif: 0.30, sonra: 0.68, boy: 139, hasar: 29 },
    atil: { sure: 0.66, kilit: 0.29, aktif: 0.29, sonra: 0.28, boy: 314, pay: 40, hasar: 23 }
  };
  var SIRA = [
    null,
    ['zincir', 'savur', 'zincir', 'ez', 'savur'],
    ['zincir', 'ez', 'savur', 'zincir', 'savur'],
    ['atil', 'savur', 'ez', 'atil', 'savur', 'ez']
  ];
  var SOGUK = 0xe2f5ff, KEHRIBAR = 0xffc579, KIZIL = 0xf77954;
  var POZLAR = {
    dur: { ad: 'skarn_dur', elX: 0.83, elY: 0.62 },
    zincir: { ad: 'skarn_zincir', elX: 0.95, elY: 0.40 },
    atil: { ad: 'skarn_atil', elX: 0.92, elY: 0.43 },
    sersem: { ad: 'skarn_sersem', elX: 0.67, elY: 0.83 }
  };
  var RESIM_OLCEK = 0.322, AYAK_UST = 246;
  var kasa, st, dokular;

  function sin(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function karis(a, b, t) { return a + (b - a) * t; }
  function emit(ad, v) { if (window.OLAY) OLAY.emit(ad, v); }
  function zaman() { return OYUN.zaman ? OYUN.zaman.t : 0; }
  function isik(k, ren, a, x, y, r) {
    k.beginFill(ren, a); k.drawEllipse(x, y, r, r * 0.54); k.endFill();
  }

  function yol(g, p, renk, cizgi, kalin) {
    g.beginPath(); g.moveTo(p[0], p[1]);
    for (var i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]);
    g.closePath();
    if (renk) { g.fillStyle = renk; g.fill(); }
    if (cizgi) { g.strokeStyle = cizgi; g.lineWidth = kalin || 2; g.stroke(); }
  }
  function ciz(g, p, renk, kalin) {
    g.beginPath(); g.moveTo(p[0], p[1]);
    for (var i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]);
    g.strokeStyle = renk; g.lineWidth = kalin; g.stroke();
  }
  function metal(g, x0, y0, x1, y1, renk) {
    var l = g.createLinearGradient(x0, y0, x1, y1);
    for (var i = 0; i < renk.length; i++) l.addColorStop(i / (renk.length - 1), renk[i]);
    return l;
  }
  function doku(w, h, yap) {
    var c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2;
    var g = c.getContext('2d'); g.scale(2, 2); g.lineCap = g.lineJoin = 'round';
    yap(g);
    return PIXI.Texture.from(c, { resolution: 2 });
  }
  function parca(ebeveyn, t, x, y, ax, ay) {
    var s = new PIXI.Sprite(t);
    s.anchor.set(ax, ay); s.position.set(x, y); ebeveyn.addChild(s);
    return s;
  }
  function percin(g, x, y, r, ice) {
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = ice ? '#bde7ec' : '#a39988'; g.fill();
    g.beginPath(); g.arc(x + r * 0.23, y + r * 0.23, r * 0.67, 0, Math.PI * 2);
    g.fillStyle = ice ? '#567e9a' : '#4f4650'; g.fill();
  }
  function cizDokular() {
    if (dokular) return dokular;
    dokular = {
      palto: doku(168, 164, function (g) {
        var dis = [73,6,100,9,129,22,147,53,142,80,157,132,166,146,133,157,114,150,88,161,64,152,47,160,30,149,5,153,17,107,28,66,26,44,44,22];
        yol(g, dis, metal(g, 33, 16, 108, 158, ['#526277','#2b3548','#151a27','#252534']), '#101521', 5);
        yol(g, [35,47,78,21,60,61,42,110,31,148,15,148,24,107], '#435063', null);
        yol(g, [106,33,125,49,127,80,148,145,122,150,102,109], '#293242', null);
        ciz(g, [48,64,39,106,28,141], '#73829470', 3.6);
        ciz(g, [101,61,110,91,116,137], '#66708270', 2.4);
        ciz(g, [18,149,47,147,62,151,86,154,110,145,129,151,155,143], '#88929b', 2.2);
        for (var i = 0; i < 34; i++) {
          var x = 43 + (i * 43 % 80), y = 45 + (i * 67 % 96);
          ciz(g, [x,y,x-2,y+8+i%6], i % 2 ? '#9ca6ac25' : '#141c3444', 0.9);
        }
      }),
      govde: doku(154, 118, function (g) {
        var dis = [30,34,45,15,62,12,74,1,91,5,102,16,122,19,139,45,126,60,119,86,112,108,82,114,52,109,36,87,18,57];
        yol(g, dis, '#1b252d', '#0a1019', 5);
        yol(g, [31,31,49,16,70,10,74,19,84,7,99,15,122,18,137,43,118,48,127,48,105,64,99,56,84,69,72,59,65,68,56,60,43,62,32,48,25,50,20,42],
          metal(g, 31, 15, 112, 77, ['#c8d8dc','#879fae','#677b86','#435965']), '#121a23', 2);
        for (var i = 0; i < 25; i++) {
          var x = 27 + i * 12 % 106, y = 22 + i * 17 % 29;
          ciz(g,[x,y,x + (x > 77 ? 7 : -6),y + 9],i % 3 ? '#d9e6e77e' : '#354854a2',i % 3 ? 1.2 : 2);
        }
        yol(g, [49,48,65,35,84,41,99,35,118,47,111,82,96,104,74,105,58,90],
          metal(g, 50, 43, 105, 96, ['#9cafbc','#496177','#283c54','#223042']), '#121b26', 3.5);
        yol(g, [60,52,78,46,93,47,105,54,99,69,82,83,70,71], '#496d8e', '#182435', 1.6);
        ciz(g, [83,44,83,77,72,86,64,86], '#bcd9ed', 2.4);
        ciz(g, [59,53,70,50,78,51], '#b4d8e0', 1.8);
        ciz(g, [89,53,96,55,104,56,99,69], '#7da0bb', 1.3);
        ciz(g, [46,80,57,91,73,95,92,94,105,87,113,78], '#182334', 3);
        yol(g, [42,92,63,99,90,99,114,91,112,107,93,112,67,113,47,108], '#353034', '#141823', 3);
        yol(g, [72,98,84,98,92,104,82,113,73,110,70,103], '#7d776b', '#272531', 2);
        yol(g, [75,101,84,101,87,104,81,109,76,107], '#263b4a', '#a49e8d', 1);
        [[55,49],[109,48],[57,73],[103,75],[54,101],[101,101]].forEach(function (p) { percin(g, p[0], p[1], 2.4, p[1] < 99); });
      }),
      kafa: doku(92, 83, function (g) {
        yol(g, [13,36,6,24,9,7,28,26,38,37,49,33,62,29,81,6,86,15,83,33,76,46,56,52,31,52],
          metal(g, 24, 13, 64, 48, ['#e1f4f4','#7faabf','#475b70']), '#121d2a', 3);
        ciz(g, [11,13,14,28,22,34,33,38], '#e4fbff', 1.4);
        ciz(g, [81,12,79,26,68,38,61,40], '#e4fbff', 1.4);
        yol(g, [26,35,31,26,47,19,67,24,76,44,72,66,64,78,45,81,27,67,22,51],
          metal(g, 30, 27, 70, 66, ['#a9c5d3','#65859c','#32495f','#293446']), '#101622', 4);
        yol(g, [24,47,40,43,48,47,57,41,73,46,68,59,59,64,51,67,41,64,33,58], '#131d2c', '#213248', 2.2);
        yol(g, [48,26,55,25,57,41,54,52,55,67,48,70,45,57,48,42], '#789bb3', '#24374a', 1.6);
        ciz(g, [33,49,40,50,44,52], '#e3fcff', 3.1);
        ciz(g, [57,51,62,48,67,49], '#d7faff', 2.9);
        ciz(g, [39,68,45,73,51,71,61,72,65,66], '#a1b8bb', 1.9);
        ciz(g, [37,31,46,27,54,28], '#cadce3', 2.1);
        percin(g, 30, 59, 2.4, true); percin(g, 68, 61, 2.4, true);
      }),
      kol: doku(57, 98, function (g) {
        yol(g, [22,4,43,12,49,27,43,48,46,66,37,85,30,94,14,89,6,77,12,56,9,30],
          metal(g, 13, 14, 45, 79, ['#8ca5bc','#557188','#3e5061','#202d3f']), '#101823', 4);
        yol(g, [9,23,27,16,45,24,41,45,25,51,12,42], '#677c8d', '#273c49', 2.1);
        yol(g, [11,51,29,46,42,55,41,67,33,80,14,76], '#334e63', '#172438', 2.3);
        ciz(g, [15,53,28,50,37,54], '#a0c3d5', 2);
        ciz(g, [13,67,19,71,30,73,37,68], '#6493ad', 1.9);
        percin(g, 15, 59, 2.5, true); percin(g, 34, 62, 2.1, true);
      }),
      bot: doku(53, 76, function (g) {
        yol(g, [12,5,39,6,44,30,40,57,49,63,45,71,11,71,4,62,8,47,6,23],
          metal(g, 9, 18, 42, 53, ['#7f919d','#4b6077','#293849','#213141']), '#0d131b', 4.4);
        yol(g, [8,56,20,57,33,57,46,63,45,71,12,71,5,63], '#302c32', '#161820', 3);
        ciz(g, [12,14,23,18,35,15,41,13], '#8dabb9', 3);
        ciz(g, [10,38,22,44,33,44,40,39], '#96b7c5', 1.8);
        ciz(g, [20,59,28,59,36,60], '#738591', 1.7);
      }),
      kaya: doku(62, 110, function (g) {
        yol(g, [6,101,7,89,14,84,15,29,9,22,17,11,43,7,54,16,49,30,49,85,57,92,58,103,47,107,12,108],
          metal(g, 15, 34, 53, 60, ['#607784','#456374','#314c60','#273848']), '#121b23', 3);
        yol(g, [14,31,28,25,28,86,15,89], '#7294a7', '#364e5e', 1.5);
        yol(g, [28,26,47,23,47,85,28,88], '#466577', '#263a4a', 1);
        yol(g, [11,21,15,12,42,4,51,8,56,18,46,23,22,25],
          metal(g, 11, 10, 40, 25, ['#eefbff','#b8dbe8','#88aebf']), '#203c4f', 2);
        yol(g, [12,69,24,63,48,58,50,68,36,73,13,79], '#574e48', '#263641', 2);
        ciz(g, [15,67,30,62,48,59], '#8d908f', 1.6);
        ciz(g, [31,36,37,43,34,49,41,58], '#acdbec', 1.4);
        ciz(g, [21,84,25,92,20,98], '#9cc8d6', 1.7);
        ciz(g, [12,96,28,99,47,95], '#8eb7c5', 2);
      })
    };
    return dokular;
  }
  function golge(katman, x, y, r) {
    var g = new PIXI.Graphics();
    isik(g, 0x0d1928, 0.20, 0, 0, r);
    isik(g, 0x0b1421, 0.30, 0, 0, r * 0.74);
    isik(g, 0x0b1119, 0.42, 0, 0, r * 0.49);
    g.position.set(x, y); katman.addChild(g);
    return g;
  }
  function ayazKaresi(ad) {
    var atlas = window.VARLIK && VARLIK.paketler.ayaz;
    if (!atlas || !atlas.tekil || atlas.tekil[ad] === undefined) return null;
    var k = VARLIK.kare('ayaz', ad);
    return k.doku.baseTexture.valid ? k : null;
  }
  function resimPozlari() {
    var kareler = {};
    for (var ad in POZLAR) {
      var p = POZLAR[ad], k = ayazKaresi(p.ad);
      if (!k) return null;
      kareler[ad] = { doku: k.doku, ayakX: -k.ox / k.w, ayakY: -k.oy / k.h,
        elX: k.ox + p.elX * k.w, elY: k.oy + p.elY * k.h };
    }
    return kareler;
  }
  function yedekKukla(kap, d) {
    var palto = parca(kap, d.palto, 0, -31, 0.5, 0.91);
    var solBot = parca(kap, d.bot, -21, -66, 0.5, 0.09);
    var sagBot = parca(kap, d.bot, 21, -65, 0.5, 0.09);
    var solKol = parca(kap, d.kol, -46, -123, 0.53, 0.20);
    solKol.scale.x = -0.97;
    var govde = parca(kap, d.govde, 1, -42, 0.51, 0.94);
    var kafa = parca(kap, d.kafa, 0, -139, 0.52, 0.79);
    var sagKol = parca(kap, d.kol, 47, -119, 0.47, 0.19);
    return { palto: palto, solBot: solBot, sagBot: sagBot, solKol: solKol, govde: govde, kafa: kafa, sagKol: sagKol };
  }
  function gorselKur(x, y) {
    var K = OYUN.katman, kap = new PIXI.Container(), kaya = [];
    var pozlar = resimPozlari(), sutun = window.AYAZ && AYAZ.stilKare && AYAZ.stilKare('art_ayaz_sutun') || ayazKaresi('art_ayaz_sutun');
    var d = pozlar && sutun ? null : cizDokular();
    K.varlik.addChild(kap);
    var kukla = pozlar ? null : yedekKukla(kap, d);
    var resim = pozlar ? parca(kap, pozlar.dur.doku, 0, 0, pozlar.dur.ayakX, pozlar.dur.ayakY) : null;
    var kip = new PIXI.Graphics();
    kip.lineStyle(3, 0xff9c6b, 0.84); kip.moveTo(0, -123); kip.lineTo(0, -94); kip.lineTo(-16, -82);
    kip.lineStyle(1.4, 0xffd7ab, 0.89); kip.moveTo(5, -112); kip.lineTo(18, -106); kip.lineTo(12, -96);
    kip.alpha = 0; kap.addChild(kip);
    var gon = golge(K.golge, x, y + 5, 79), uyari = new PIXI.Graphics(), halat = new PIXI.Graphics(), kipIsik = new PIXI.Graphics();
    K.leke.addChild(uyari); K.efekt.addChild(halat); K.leke.addChild(kipIsik);
    var eList = window.BOLUM && Array.isArray(BOLUM.engeller) ? BOLUM.engeller : [];
    for (var i = 0; i < 2; i++) {
      var kx = x + (i ? 170 : -170), ky = y + 120;
      var r = sutun ? parca(K.varlik, sutun.doku, kx, ky, -sutun.ox / sutun.w, -sutun.oy / sutun.h)
        : parca(K.varlik, d.kaya, kx, ky, 0.5, 0.94);
      if (sutun) r.scale.set(0.117, 0.171);
      r.zIndex = ky;
      var en = { x1: kx - 17, x2: kx + 17, y1: ky - 12, y2: ky + 6, t: 'ayaz_sutun', kapali: false };
      eList.push(en);
      kaya.push({ x: kx, y: ky, kancaY: ky - (sutun ? 43 : 41), s: r, golge: golge(K.golge, kx, ky, 35), en: en, eList: eList });
    }
    SKARN.sprite = kap; kap.g = resim || kukla.govde; kap.anim = 'dur'; kap.yerTutucu = false;
    return { kap: kap, kukla: kukla, kip: kip, golge: gon, pozlar: pozlar, resim: resim, resimPoz: null,
      uyari: uyari, halat: halat, kipIsik: kipIsik, kaya: kaya };
  }


  function sinirlar() {
    var s = window.BOLUM && BOLUM.sinir;
    return s && isFinite(s.sol) && isFinite(s.sag) && isFinite(s.ust) && isFinite(s.alt)
      ? s : { sol: 95, sag: 1185, ust: 76, alt: 667 };
  }
  function setDurum(ad, sure) {
    SKARN.durum = ad; st.t = 0; st.sure = sure || 0;
    if (ad !== 'sersem') SKARN.sersem = 0;
  }
  function duvarMesafe(x, y, ux, uy, pay, en, ust) {
    var s = sinirlar(), max = en;
    if (ux > 0.001) max = Math.min(max, (s.sag - pay - x) / ux);
    else if (ux < -0.001) max = Math.min(max, (s.sol + pay - x) / ux);
    if (uy > 0.001) max = Math.min(max, (s.alt - pay - y) / uy);
    else if (uy < -0.001) max = Math.min(max, (Math.max(s.ust + pay, ust || 0) - y) / uy);
    return Math.max(0, max);
  }
  function kayaCarpisi(x, y, ux, uy, boy, pay) {
    var sutun = null, mesafe = boy, r = KAP.kazikR + pay;
    for (var i = 0; i < kasa.kaya.length; i++) {
      var k = kasa.kaya[i], dx = k.x - x, dy = k.y - y, ileri = dx * ux + dy * uy;
      if (ileri <= 0 || ileri - r > mesafe) continue;
      var sag = -dx * uy + dy * ux;
      if (Math.abs(sag) >= r) continue;
      var giris = ileri - Math.sqrt(r * r - sag * sag);
      if (giris <= mesafe) { sutun = k; mesafe = Math.max(0, giris); }
    }
    return { sutun: sutun, mesafe: mesafe };
  }
  function hedefle(ad, p) {
    var a = HAMLE[ad], x = SKARN.x, y = SKARN.y, dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy);
    var yon = d > 0.01 ? Math.atan2(dy, dx) : SKARN.aci, ux = Math.cos(yon), uy = Math.sin(yon);
    var boy = a.boy, sutun = null;
    if (ad === 'zincir') {
      boy = duvarMesafe(x, y, ux, uy, 2, boy);
      var k = kayaCarpisi(x, y, ux, uy, boy, 4);
      sutun = k.sutun; boy = k.mesafe;
      // Kapalı sütunun içini ya da arkasını kapsülün yuvarlak ucu vuramaz.
      if (sutun) boy = Math.max(0, boy - a.pay);
    } else if (ad === 'atil') {
      boy = duvarMesafe(x, y, ux, uy, 40, Math.min(boy, Math.max(105, d + 44)), AYAK_UST);
      boy = kayaCarpisi(x, y, ux, uy, boy, 29).mesafe;
    }
    return { x: x, y: y, ux: ux, uy: uy, aci: yon, boy: boy, sutun: sutun };
  }
  function kapsulIcinde(p, q, b0, b1, pay) {
    var dx = p.x - q.x, dy = p.y - q.y;
    var k = sin(dx * q.ux + dy * q.uy, b0, b1);
    return Math.hypot(dx - q.ux * k, dy - q.uy * k) <= pay;
  }
  function yakinKaya(x, y, pay) {
    for (var i = 0; i < kasa.kaya.length; i++) {
      var k = kasa.kaya[i];
      if (Math.hypot(x - k.x, y - k.y) < KAP.kazikR + pay) return true;
    }
    return false;
  }
  function yanaDon(a) {
    SKARN.aci = a;
    if (Math.abs(Math.cos(a)) > 0.18) st.yon = Math.cos(a) >= 0 ? 1 : -1;
  }
  function yuruyus(p, dt) {
    var dx = p.x - SKARN.x, dy = p.y - SKARN.y, d = Math.hypot(dx, dy);
    if (d < 1) return;
    var aci = Math.atan2(dy, dx);
    yanaDon(aci);
    if (d < 118) return;
    var s = sinirlar(), adim = (SKARN.evre === 3 ? 95 : 63) * dt;
    var yollar = [0, 0.80, -0.80, 1.40, -1.40];
    for (var i = 0; i < yollar.length; i++) {
      var a = aci + yollar[i];
      var x = sin(SKARN.x + Math.cos(a) * adim, s.sol + 31, s.sag - 31);
      var y = sin(SKARN.y + Math.sin(a) * adim * 0.86, Math.max(AYAK_UST, s.ust + 34), s.alt - 27);
      if (yakinKaya(x, y, 38)) continue;
      SKARN.x = x; SKARN.y = y; st.adim += adim / 12; return;
    }
  }
  function saldir(ad) {
    if (!st || !HAMLE[ad] || !SKARN.aktif || SKARN.olu || !window.OYUNCU ||
        (SKARN.durum !== 'dolas' && SKARN.durum !== 'toparla')) return false;
    if (ad === 'zincir' && SKARN.evre === 3) return false;
    var a = HAMLE[ad], ikincisi = ad === 'atil' && st.ciftKalan === 1;
    var sure = a.sure * (ikincisi ? 0.83 : 1);
    st.hamle = ad;
    st.yonKilit = false; st.vurdu = false; st.vurusIslendi = false; st.carpanSutun = null;
    st.plan = hedefle(ad, OYUNCU);
    yanaDon(st.plan.aci);
    setDurum('tele', sure);
    emit('skarnUyari', { boss: SKARN, saldiri: ad, x: st.plan.x, y: st.plan.y, sure: sure });
    return true;
  }
  function sonrakiHamle(p) {
    var a = SIRA[SKARN.evre], d = Math.hypot(p.x - SKARN.x, p.y - SKARN.y);
    if (SKARN.evre === 3 && st.ciftKalan === 1) { return saldir('atil'); }
    if (d > (SKARN.evre === 3 ? 355 : 490)) return false;
    var ad = a[st.hamleSira++ % a.length];
    if (ad === 'ez' && d > 188) ad = SKARN.evre === 3 ? 'atil' : 'zincir';
    if (ad === 'savur' && d > 228) ad = SKARN.evre === 3 ? 'atil' : 'zincir';
    if (ad === 'atil' && d < 96 && st.sonHamle !== 'ez') ad = 'ez';
    if (ad === 'atil') st.ciftKalan = 2;
    return saldir(ad);
  }
  function vur(p, hasar, x, y, itis, cek) {
    if (!p || !p.canli || typeof p.hasarAl !== 'function') return false;
    var aci = cek ? Math.atan2(y - p.y, x - p.x) : Math.atan2(p.y - y, p.x - x);
    return p.hasarAl(hasar, { x: x, y: y, aci: aci, guc: itis, kaynak: SKARN, saldiri: st.hamle }) !== false;
  }
  function sars(guc, sure) {
    if (OYUN.kamera && OYUN.kamera.sars) OYUN.kamera.sars(guc, sure);
  }
  function aktifHamle(p) {
    var ad = st.hamle, a = HAMLE[ad], q = st.plan, t = st.t;
    if (ad === 'atil') {
      var mesafe = q.boy * sin(t / a.aktif, 0, 1);
      if (!st.vurdu && kapsulIcinde(p, q, st.sonAtim, mesafe, a.pay)) {
        st.vurdu = vur(p, a.hasar, SKARN.x, SKARN.y, 270, false);
      }
      SKARN.x = q.x + q.ux * mesafe; SKARN.y = q.y + q.uy * mesafe;
      st.adim += (mesafe - st.sonAtim) / 15; st.sonAtim = mesafe;
      return;
    }
    if (st.vurusIslendi || t < a.isabet) return;
    st.vurusIslendi = true;
    var dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy);
    if (ad === 'zincir') {
      var icinde = kapsulIcinde(p, q, 0, q.boy, a.pay);
      if (icinde) st.vurdu = vur(p, KAP.dayak, q.x, q.y, KAP.cekme, true);
      if (q.sutun) {
        st.carpanSutun = q.sutun;
        emit('skarnZincir', { boss: SKARN, x: q.sutun.x, y: q.sutun.y, takildi: true });
        sars(10, 0.21);
      } else {
        emit('skarnZincir', { boss: SKARN, x: q.x + q.ux * q.boy, y: q.y + q.uy * q.boy, isabet: st.vurdu });
      }
    } else if (ad === 'savur') {
      if (d <= a.boy && (d < 1 || Math.abs(Math.atan2(dy * q.ux - dx * q.uy, dx * q.ux + dy * q.uy)) <= a.aci)) {
        st.vurdu = vur(p, a.hasar, q.x, q.y, 318, false);
      }
      emit('devSopa', { x: q.x + q.ux * 120, y: q.y + q.uy * 120, skarn: true });
    } else {
      if (d <= a.boy) st.vurdu = vur(p, a.hasar, q.x, q.y, 465, false);
      emit('devYereVur', { x: q.x, y: q.y, r: a.boy, skarn: true });
      sars(12, 0.26);
    }
    emit('skarnSonuc', { boss: SKARN, saldiri: ad, isabet: st.vurdu, takildi: !!st.carpanSutun });
  }
  function toparlan(a) {
    var ad = st.hamle;
    if (ad === 'atil') {
      st.ciftKalan = Math.max(0, st.ciftKalan - 1);
      emit('skarnSonuc', { boss: SKARN, saldiri: ad, isabet: st.vurdu, kalan: st.ciftKalan });
    }
    st.sonHamle = ad;
    if (st.carpanSutun) {
      var sure = SKARN.evre === 2 ? KAP.sersem - 0.13 : KAP.sersem;
      setDurum('sersem', sure); SKARN.sersem = sure;
      emit('skarnAcik', { boss: SKARN, x: SKARN.x, y: SKARN.y, sure: sure });
      return;
    }
    var bekle = ad === 'atil' && st.ciftKalan === 0 ? 0.58 : a.sonra;
    setDurum('toparla', bekle);
  }

  function canliTakviye() {
    var n = 0;
    for (var i = 0; i < st.yardim.length; i++) {
      var f = st.yardim[i];
      if (!f.d.olu && f.d.id === f.id) n++;
    }
    return n;
  }
  var I_YARDIM = [['kircil_kurt', 'goblin'], ['ayaz_mizrak', 'okcu']];
  var II_YARDIM = [['ayaz_zincir', 'baskinci'], ['buz_muhafiz', 'kalkanli'], ['kircil_kurt', 'goblin']];
  function takviyeHazirla(yardim, neden) {
    var s = sinirlar();
    for (var i = 0; i < yardim.length && canliTakviye() + st.yardimKuyruk.length < 5; i++) {
      var sag = (i + st.takviyeSayac) % 2 === 0;
      var P = window.OYUNCU;
      var x = sag ? s.sag - 74 : s.sol + 74;
      var y = sin(395 + (i % 3) * 61, s.ust + 60, s.alt - 62);
      if (P && Math.hypot(P.x - x, P.y - y) < 112) y = sin(y + 124, s.ust + 50, s.alt - 50);
      st.yardimKuyruk.push({ tur: yardim[i], x: x, y: y, sure: 0.60 + i * 0.42 });
    }
    st.takviyeSayac++;
    emit('skarnTakviye', { boss: SKARN, neden: neden, evre: SKARN.evre, adet: st.yardimKuyruk.length });
  }
  function takviyeGuncelle(dt, p) {
    for (var i = st.yardimKuyruk.length - 1; i >= 0; i--) {
      var q = st.yardimKuyruk[i]; q.sure -= dt;
      if (q.sure > 0) continue;
      st.yardimKuyruk.splice(i, 1);
      if (!window.DUSMAN || !DUSMAN.AYAR || canliTakviye() >= 5) continue;
      var tur = DUSMAN.AYAR[q.tur[0]] ? q.tur[0] : q.tur[1];
      var d = DUSMAN.dogur(tur, q.x, q.y, { aci: Math.atan2(p.y - q.y, p.x - q.x) });
      if (d) st.yardim.push({ d: d, id: d.id });
    }
    if (st.ekTakviye > 0 && canliTakviye() <= 2) {
      st.ekTakviyeT -= dt;
      if (st.ekTakviyeT <= 0 && SKARN.durum === 'dolas') {
        st.ekTakviye--; st.ekTakviyeT = 14;
        takviyeHazirla([I_YARDIM[0]], 'yan');
      }
    }
  }
  function takviyeMermileriniDurdur() {
    if (!window.MERMI || !MERMI.liste) return;
    for (var i = 0; i < MERMI.liste.length; i++) {
      var m = MERMI.liste[i], kaynak = m.kaynak;
      if (m.sahip !== 'dusman' || !kaynak || !st.yardim.some(function (e) { return e.d === kaynak && e.id === kaynak.id; })) continue;
      // Son darbeyi sektirilen mermi verebilir. Listeyi değiştirmeden döngünün mermiyi iade etmesini bekle.
      m.yay = null; m.omur = 0;
      if (m.kap) m.kap.visible = false;
      if (m.golge) m.golge.visible = false;
    }
  }
  function takviyeTemizle() {
    if (!st) return;
    takviyeMermileriniDurdur();
    if (window.DUSMAN && DUSMAN.hasarVer) {
      for (var i = 0; i < st.yardim.length; i++) {
        var e = st.yardim[i];
        if (e.d.id === e.id && !e.d.olu && DUSMAN.liste.indexOf(e.d) >= 0) DUSMAN.hasarVer(e.d, e.d.can, { tur: 'ates' });
      }
    }
    st.yardim.length = st.yardimKuyruk.length = 0;
  }
  function evreyeGec(evre) {
    SKARN.evre = evre;
    st.hamle = null; st.plan = null; st.carpanSutun = null; st.ciftKalan = 0; st.hamleSira = 0;
    st.sonHamle = '';
    setDurum('evre', evre === 3 ? 1.2 : 0.83);
    takviyeHazirla(evre === 3 ? II_YARDIM : I_YARDIM, 'evre');
    if (evre === 3) { st.ekTakviye = 2; st.ekTakviyeT = 13; }
    emit('skarnEvre', { boss: SKARN, x: SKARN.x, y: SKARN.y, evre: evre });
    sars(10, 0.25);
  }
  function zinciriKopar() {
    st.zincirKirik = true;
    st.zincirKirT = 0.52;
    emit('skarnZincir', { boss: SKARN, x: SKARN.x, y: SKARN.y, kirildi: true });
    emit('devYereVur', { x: SKARN.x, y: SKARN.y, r: 77, skarn: true });
    sars(15, 0.32);
  }
  function hasarAl(miktar, ops) {
    if (!st || !SKARN.aktif || SKARN.olu || !(miktar > 0) || !isFinite(miktar)) return { oldu: false, blok: false };
    var pay = SKARN.durum === 'sersem' ? 1.34 : 1;
    var once = SKARN.can;
    SKARN.can = Math.max(0, once - Math.max(1, Math.round(miktar * pay)));
    st.parlak = 0.13;
    emit('dusmanHasar', { hedef: SKARN, miktar: once - SKARN.can });
    if (SKARN.can <= 0) { olumBasla(); return { oldu: true, blok: false }; }
    var oran = SKARN.can / SKARN.canMax;
    if (oran <= SKARN.evre3) st.hedefEvre = 3;
    else if (oran <= SKARN.evre2) st.hedefEvre = Math.max(st.hedefEvre, 2);
    return { oldu: false, blok: false };
  }
  function listedenCikar() {
    var l = window.DUSMAN && DUSMAN.liste;
    if (!l) return;
    var i = l.indexOf(SKARN);
    if (i >= 0) l.splice(i, 1);
  }
  function olumBasla() {
    SKARN.olu = true; SKARN.canli = false; SKARN.aktif = false; SKARN.can = 0;
    st.hamle = null; st.plan = null; st.carpanSutun = null;
    st.parlak = 0; setDurum('olum', 1.86);
    listedenCikar(); takviyeTemizle();
    if (OYUN.zaman && OYUN.zaman.yavaslat) OYUN.zaman.yavaslat(0.4, 0.38);
    sars(18, 0.42);
    emit('devOldu', { bolum: 3, ad: SKARN.ad, x: SKARN.x, y: SKARN.y, boss: SKARN });
  }
  function guncelle(dt) {
    if (!st || OYUN.bolum !== BOLUM_NO || !(dt > 0)) return;
    if (SKARN.durum === 'olum') {
      st.t += dt;
      if (!st.dustu && st.t >= st.sure * OLUM_TEMAS) {
        st.dustu = true;
        emit('skarnZeminTemas', { x: SKARN.x, y: SKARN.y });
      }
      if (st.t >= st.sure) {
        setDurum('bitti', 0);
        if (window.BOLUM) { BOLUM.arenaKilitli = false; BOLUM.bitti = true; }
        emit('kazandi', { bolum: 3, ad: SKARN.ad, x: SKARN.x, y: SKARN.y, boss: SKARN });
        OYUN.durumYap('kazandi');
      }
      return;
    }
    var p = window.OYUNCU;
    if (!SKARN.aktif || !p || !p.canli) return;
    st.t += dt; st.parlak = Math.max(0, st.parlak - dt); st.zincirKirT = Math.max(0, st.zincirKirT - dt);
    takviyeGuncelle(dt, p);
    var d = SKARN.durum, a = HAMLE[st.hamle];
    if (d === 'giris' || d === 'evre') {
      if (d === 'evre' && SKARN.evre === 3 && !st.zincirKirik && st.t >= 0.49) zinciriKopar();
      if (st.t >= st.sure) setDurum('dolas', d === 'giris' ? 0.25 : 0.36);
      return;
    }
    if (d === 'sersem') {
      SKARN.sersem = Math.max(0, st.sure - st.t);
      if (!SKARN.sersem) {
        st.carpanSutun = null;
        setDurum('toparla', 0.24);
      }
      return;
    }
    if (d === 'tele') {
      if (!st.yonKilit) {
        st.plan = hedefle(st.hamle, p);
        yanaDon(st.plan.aci);
        if (st.t >= a.kilit) {
          st.yonKilit = true;
          if (st.hamle === 'zincir' && st.plan.sutun) emit('skarnSutunIsaret', { boss: SKARN, x: st.plan.sutun.x, y: st.plan.sutun.y });
        }
      }
      if (st.t >= st.sure) { st.sonAtim = 0; setDurum('vur', a.aktif); }
      return;
    }
    if (d === 'vur') {
      aktifHamle(p);
      if (st.t >= st.sure) toparlan(a);
      return;
    }
    if (d === 'toparla' && st.t < st.sure) return;
    if (SKARN.evre < st.hedefEvre && st.ciftKalan === 0) { evreyeGec(SKARN.evre + 1); return; }
    if (d === 'toparla') {
      if (st.ciftKalan === 1) { saldir('atil'); return; }
      st.hamle = null; st.plan = null;
      setDurum('dolas', SKARN.evre === 3 ? 0.19 : 0.35);
      return;
    }
    if (st.t >= st.sure && sonrakiHamle(p)) return;
    yuruyus(p, dt);
  }


  function kapsulCiz(g, q, pay, alfa, renk) {
    g.rotation = q.aci; g.position.set(q.x, q.y);
    g.lineStyle(1.7, renk, Math.min(0.97, alfa * 2.8));
    g.beginFill(renk, alfa); g.drawRoundedRect(-pay, -pay, q.boy + pay * 2, pay * 2, pay); g.endFill();
    g.lineStyle(2.4, renk, Math.min(0.84, alfa * 2));
    for (var x = 36; x < q.boy - 11; x += 30) {
      g.moveTo(x - 6, -6); g.lineTo(x, 0); g.lineTo(x - 6, 6);
    }
    g.lineStyle(2, 0xffe1b9, Math.min(0.84, alfa * 2));
    g.drawEllipse(q.boy, 0, pay * 0.71, pay * 0.71);
  }
  function dilimCiz(g, q, h, alfa, renk) {
    g.position.set(0, 0); g.rotation = 0;
    g.lineStyle(2, renk, Math.min(0.94, alfa * 2.6));
    g.beginFill(renk, alfa);
    g.moveTo(q.x, q.y);
    g.arc(q.x, q.y, h.boy, q.aci - h.aci, q.aci + h.aci);
    g.lineTo(q.x, q.y); g.endFill();
    g.lineStyle(1.2, 0xffeed3, Math.min(0.59, alfa * 2.1));
    g.arc(q.x, q.y, h.boy * 0.78, q.aci - h.aci, q.aci + h.aci);
  }
  function cemberCiz(g, q, h, t, alfa, renk) {
    g.position.set(0, 0); g.rotation = 0;
    g.lineStyle(2.2, renk, Math.min(0.9, alfa * 3.0));
    g.beginFill(renk, alfa); g.drawCircle(q.x, q.y, h.boy); g.endFill();
    g.lineStyle(2.9, 0xffddae, Math.min(0.77, alfa * 2.2));
    g.drawCircle(q.x, q.y, h.boy * (0.27 + t * 0.69));
  }
  function zincirCiz(g, x, y, ucX, ucY, canli, t) {
    var dx = ucX - x, dy = ucY - y, uzak = Math.hypot(dx, dy);
    var bol = Math.max(6, Math.min(21, Math.round(uzak / 19))), tutuk = st.carpanSutun ? 1 : 0;
    var sal = canli ? 13 : 22, a = tutuk ? 0.98 : 0.94;
    var x0 = x, y0 = y, i;
    for (i = 1; i <= bol; i++) {
      var p = i / bol, u = Math.sin(p * Math.PI);
      var x1 = x + dx * p, y1 = y + dy * p + u * (sal + Math.sin(p * 13 - t * 17) * (tutuk ? 3 : 9));
      g.lineStyle(i % 2 ? 5.9 : 4.7, 0x08111a, a);
      g.moveTo(x0, y0); g.lineTo(x1, y1);
      g.lineStyle(i % 2 ? 2.4 : 1.6, i % 2 ? 0xc3d8df : 0x697f90, a);
      g.moveTo(x0, y0 - 1); g.lineTo(x1, y1 - 1);
      if (i % 2) {
        g.lineStyle(1.2, 0xe8f0e7, a * 0.71);
        g.drawEllipse(x0, y0, 3.4, 3.2);
      }
      x0 = x1; y0 = y1;
    }
    var aci = Math.atan2(dy, dx), w = Math.cos(aci), z = Math.sin(aci);
    g.lineStyle(4.2, 0x142330, 0.95);
    g.moveTo(ucX - w * 10, ucY - z * 10);
    g.lineTo(ucX + w * 14, ucY + z * 14);
    g.lineTo(ucX + w * 4 - z * 12, ucY + z * 4 + w * 12);
    g.lineStyle(2, tutuk ? KEHRIBAR : 0xe6f4f5, 0.94);
    g.moveTo(ucX - w * 8, ucY - z * 8);
    g.lineTo(ucX + w * 13, ucY + z * 13);
    g.lineTo(ucX + w * 4 - z * 10, ucY + z * 4 + w * 10);
  }
  function buzKirintisi(g, x, y, t) {
    var u = sin(t / 0.38, 0, 1);
    if (u >= 1) return;
    for (var i = 0; i < 8; i++) {
      var a = i * 2.40, r = (10 + i * 5) * u;
      var px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * 0.64 - (21 + i) * u + 40 * u * u;
      var b = (i % 3 + 2) * (1 - u * 0.45);
      g.lineStyle(0.8, 0x5c99b3, (1 - u) * 0.55);
      g.beginFill(i % 2 ? 0xe2f5ff : 0x92d0e8, (1 - u) * 0.92);
      g.drawPolygon([px - b, py + b, px + b * 0.7, py + b * 0.35, px + b * 0.85, py - b]);
      g.endFill();
    }
  }
  function uyarilarZemin() {
    var k = kasa, g = k.uyari, q = st.plan, ad = st.hamle, d = SKARN.durum, s = HAMLE[ad];
    g.clear(); g.position.set(0, 0); g.rotation = 0; k.kipIsik.clear();
    if (q && s && (d === 'tele' || d === 'vur')) {
      var tele = d === 'tele', u = sin(st.t / st.sure, 0, 1);
      var renk = tele ? KEHRIBAR : KIZIL;
      var alfa = tele ? (st.yonKilit ? 0.22 + 0.14 * u : 0.13 + 0.12 * u) : 0.34 * (1 - 0.8 * u);
      if (ad === 'zincir' || ad === 'atil') {
        kapsulCiz(g, q, s.pay, alfa, renk);
        if (ad === 'atil' && tele && st.ciftKalan === 1) {
          g.lineStyle(2.2, 0xffe8c6, 0.63 + 0.30 * u);
          for (var ok = 0; ok < 2; ok++) {
            var uc = Math.min(q.boy * 0.45, 44) + ok * 13;
            g.moveTo(uc - 8, -14); g.lineTo(uc, 0); g.lineTo(uc - 8, 14);
          }
        }
      }
      else if (ad === 'savur') dilimCiz(g, q, s, alfa, renk);
      else cemberCiz(g, q, s, u, alfa, renk);
    }
    for (var i = 0; i < st.yardimKuyruk.length; i++) {
      var t = st.yardimKuyruk[i], al = t.sure < 0.7 ? Math.min(0.91, 0.35 + (0.7 - t.sure) * 0.72) : 0.30;
      var gg = k.kipIsik;
      gg.lineStyle(2.1, 0xeca462, al);
      gg.drawEllipse(t.x, t.y, 24, 10);
      gg.drawEllipse(t.x, t.y, 15 + al * 12, 6 + al * 5);
      gg.moveTo(t.x - 5, t.y - 36); gg.lineTo(t.x, t.y - 42); gg.lineTo(t.x + 5, t.y - 36);
      gg.lineStyle(0);
      isik(gg, 0xefa762, al * 0.13, t.x, t.y, 32);
    }
    var secili = st.carpanSutun || (q && st.yonKilit && d === 'tele' ? q.sutun : null);
    for (i = 0; i < k.kaya.length; i++) {
      var ka = k.kaya[i];
      ka.s.tint = ka === secili ? 0xffd5a3 : 0xffffff;
    }
    if (secili) {
      k.kipIsik.lineStyle(2, KEHRIBAR, 0.91);
      k.kipIsik.drawEllipse(secili.x, secili.y, 29, 13);
      k.kipIsik.drawEllipse(secili.x, secili.y, 35, 17);
    }
    if (d === 'sersem') {
      var g1 = k.kipIsik;
      g1.lineStyle(2, 0x8ae2f5, 0.75);
      g1.drawEllipse(SKARN.x, SKARN.y + 3, 45 + 8 * Math.sin(st.t * 9), 19 + 3 * Math.sin(st.t * 9));
    }
  }
  var KARE_HAMLE = {
    zincir: ['zincir', .32, .59, .79],
    savur: ['kopus', .31, .54, .77],
    ez: ['vur', .34, .55, .78]
  };
  var OLUM_TEMAS = .84;
  function resimOynat(k, durum, hamle, ilerleme, adim, nefes, gercekDt) {
    var hareket = k.yuruyus || (k.yuruyus = AYAZ_ANIMASYON.yeni());
    var dt = Math.min(.05, gercekDt || 0);
    var yuruyor = durum === 'dolas';
    var aci = st.plan && durum !== 'dolas' ? st.plan.aci : SKARN.aci;
    var yon = OYUN.aciYon(aci), mesafe = AYAZ_ANIMASYON.adimBoyu(110,yon);
    AYAZ_ANIMASYON.ilerlet(hareket, SKARN.x, SKARN.y, dt, mesafe, yuruyor, AYAZ_ANIMASYON.kareSayisi('skarn'));
    var saldiri = KARE_HAMLE[hamle], ad = 'dur', faz = (zaman()*.82)%1;
    if (durum === 'olum' || durum === 'bitti') {
      ad='ol';
      // The dust/sound event comes on the same frame that the body reaches the floor.
      faz=durum==='bitti' ? 1 : ilerleme < OLUM_TEMAS
        ? karis(0, .43, ilerleme/OLUM_TEMAS) : karis(.43, 1, (ilerleme-OLUM_TEMAS)/(1-OLUM_TEMAS));
    } else if (durum === 'sersem') {
      ad='sersem'; faz=ilerleme;
    } else if (durum === 'evre') {
      ad='kukre'; faz=ilerleme;
    } else if (hamle === 'atil' && durum === 'tele') {
      ad='egil'; faz=ilerleme;
    } else if (hamle === 'atil' && durum === 'vur') {
      ad='kos'; faz=ilerleme*1.5;
    } else if (hamle === 'atil' && durum === 'toparla') {
      ad='sersem'; faz=ilerleme;
    } else if (saldiri && durum === 'tele') {
      ad=saldiri[0]; faz=saldiri[1]*ilerleme;
    } else if (saldiri && durum === 'vur') {
      ad=saldiri[0];
      var isabet=HAMLE[hamle].isabet;
      faz=st.t<isabet ? karis(saldiri[1],saldiri[2],st.t/isabet)
        : karis(saldiri[2],saldiri[3],sin((st.t-isabet)/(st.sure-isabet),0,1));
    } else if (saldiri && durum === 'toparla') {
      ad=saldiri[0]; faz=karis(saldiri[3],1,ilerleme);
    } else if (yuruyor && hareket.miktar > .17) {
      ad='yuru'; faz=hareket.faz;
    }
    var kadran = AYAZ_ANIMASYON.kare('skarn',ad,yon,faz);
    var s = k.resim;
    k.kap.temas = null; k.el = null;
    if(kadran){
      k.resimPoz = ad;
      k.kap.rotation = 0;
      if(s.texture!==kadran.doku){
        s.texture=kadran.doku; s.anchor.set(-kadran.ox/kadran.w,-kadran.oy/kadran.h);
      }
      s.scale.set(kadran.olcek*st.yon,kadran.olcek);
      s.position.set(ad==='yuru'?hareket.kaymaX*st.yon:0,ad==='yuru'?hareket.kaymaY:0);
      s.rotation=0;
      s.tint=st.parlak>0?0xffb3a8:st.zincirKirik?0xffded5:0xffffff;
      if(kadran.bilgi){
        var b=kadran.bilgi, temas=k.temas || (k.temas={x:0,y:0});
        temas.x=s.x*st.yon+b[0]*kadran.olcek;
        temas.y=s.y+b[1]*kadran.olcek;
        k.kap.temas=temas;
        var el=k.elRig || (k.elRig={elX:0,elY:0});
        el.elX=b[2]; el.elY=b[3]; k.el=el;
      }
      if(ad==='yuru') AYAZ_ANIMASYON.botBas(hareket,k.kap,'skarn',true);
      return;
    }
    var poz = 'dur';
    if (durum === 'olum' || durum === 'bitti' || durum === 'sersem') poz = 'sersem';
    else if (durum === 'tele') {
      if (hamle === 'atil' && ilerleme > 0.29) poz = 'sersem';
      if (hamle === 'zincir' || hamle === 'savur') poz = 'zincir';
    } else if (durum === 'vur') {
      poz = hamle === 'zincir' ? 'zincir' : 'atil';
    } else if (durum === 'toparla' && hamle) {
      if (hamle === 'zincir' && ilerleme < 0.51) poz = 'zincir';
      if (hamle === 'atil' && ilerleme < 0.54) poz = 'sersem';
    } else if (durum === 'evre' && ilerleme > 0.16 && ilerleme < 0.78) {
      poz = 'zincir';
    }
    var kadr = k.pozlar[poz];
    if (k.resimPoz !== poz) {
      s.texture = kadr.doku; s.anchor.set(kadr.ayakX, kadr.ayakY); k.resimPoz = poz;
    }
    var yuru = durum === 'dolas';
    var gergin = durum === 'tele' ? ilerleme : 0;
    var olcek = RESIM_OLCEK * (1 + nefes * 0.003);
    s.scale.set(olcek * (1 + gergin * 0.025), olcek * (1 - gergin * 0.034));
    s.position.set(yuru ? adim * 3.1 : 0, yuru ? -Math.abs(adim) * 3.0 : nefes * 0.6);
    s.rotation = yuru ? adim * 0.026 : durum === 'sersem' ? Math.sin(zaman() * 12) * 0.024 : 0;
    s.tint = st.parlak > 0 ? 0xffb3a8 : st.zincirKirik ? 0xffded5 : 0xffffff;
  }
  function kuklaOynat(k, d, ad, u, yuruyor, yuru, bekle, t) {
    k.govde.y = -42 + (yuruyor ? -Math.abs(yuru) * 2.4 : bekle * 1.6);
    k.kafa.y = -139 + (yuruyor ? -Math.abs(yuru) * 2.8 : bekle * 1.3);
    k.solBot.rotation = yuruyor ? yuru * 0.29 : 0.06;
    k.sagBot.rotation = yuruyor ? yuru * -0.27 : -0.04;
    k.solBot.y = -66 + (yuruyor ? Math.min(0, -yuru * 5.5) : 0);
    k.sagBot.y = -65 + (yuruyor ? Math.min(0, yuru * 5) : 0);
    k.palto.rotation = yuruyor ? yuru * 0.049 : bekle * 0.011;
    k.solKol.rotation = yuruyor ? 0.22 + yuru * 0.23 : 0.24 + bekle * 0.028;
    k.sagKol.rotation = yuruyor ? -0.23 - yuru * 0.21 : -0.30 - bekle * 0.02;
    k.kafa.rotation = 0;
    if (d === 'tele') {
      k.sagKol.rotation = ad === 'zincir' ? -0.64 - u * 0.86 : ad === 'atil' ? 0.34 + u * 0.83 : -0.82 - u * 0.78;
      k.solKol.rotation = ad === 'ez' ? 0.72 + u * 0.63 : 0.26 + u * 0.27;
      k.govde.y -= u * (ad === 'atil' ? -7 : 3.5);
    } else if (d === 'vur') {
      k.sagKol.rotation = ad === 'zincir' ? -1.45 : ad === 'atil' ? -0.50 : -1.7 + Math.sin(u * Math.PI * 0.84) * 2.7;
      k.solKol.rotation = ad === 'ez' ? 1.05 - u * 1.27 : ad === 'atil' ? -0.32 : 0.51;
    } else if (d === 'sersem') {
      k.govde.y += 10; k.kafa.y += 13; k.kafa.rotation = 0.13 + Math.sin(t * 19) * 0.032;
      k.sagKol.rotation = -1.04; k.solKol.rotation = 0.70;
    } else if (d === 'evre') {
      k.sagKol.rotation = -0.58 - Math.sin(u * Math.PI) * 1.15;
      k.solKol.rotation = 0.73 + Math.sin(u * Math.PI * 1.02) * 0.6;
    }
    var yanik = st.zincirKirik ? 0xffddd1 : 0xffffff;
    k.govde.tint = st.parlak > 0 ? 0xffb3a8 : yanik;
    k.kafa.tint = st.parlak > 0 ? 0xffcec0 : yanik;
  }
  function gorselGuncelle(gercekDt) {
    if (!st || !kasa || OYUN.bolum !== BOLUM_NO || OYUN.durum === 'mola') return;
    var k = kasa, q = st.plan, d = SKARN.durum, ad = st.hamle, t = zaman(), u = sin(st.t / Math.max(0.01, st.sure), 0, 1);
    var kap = k.kap;
    kap.position.set(SKARN.x, SKARN.y); kap.zIndex = SKARN.y;
    kap.scale.x = st.yon; kap.scale.y = 1;
    k.golge.position.set(SKARN.x, SKARN.y + 5);
    var oldu = d === 'olum' || d === 'bitti';
    var yuruyor = d === 'dolas' || (d === 'vur' && ad === 'atil');
    var yuru = Math.sin(st.adim), bekle = Math.sin(t * 3.9);
    kap.anim = oldu ? 'ol' : yuruyor ? 'yuru' : d === 'sersem' ? 'sersem' : (d === 'tele' || d === 'vur' ? 'vur' : 'dur');
    var dead = d === 'bitti' ? 1 : oldu ? u : 0;
    kap.rotation = dead ? (0.20 + dead * 0.95) * dead * st.yon : (d === 'vur' && ad === 'atil' ? 0.13 * st.yon : 0);
    kap.alpha = oldu ? (d === 'bitti' ? 0.62 : 1 - 0.38 * u) : d === 'giris' ? 0.40 + u * 0.60 : 1;
    k.golge.alpha = oldu ? 1 - dead * 0.32 : 1;
    if (k.resim) resimOynat(k, d, ad, u, yuru, bekle, gercekDt);
    else kuklaOynat(k.kukla, d, ad, u, yuruyor, yuru, bekle, t);
    if (k.kap.temas && k.resimPoz === 'yuru') {
      k.golge.x += k.kap.temas.x * .17;
      k.golge.y += k.kap.temas.y * .17;
      k.golge.alpha *= .57;
    }
    k.kip.alpha = st.zincirKirik && !oldu ? 0.57 + 0.23 * Math.sin(t * 5.6) : 0;
    k.kip.y = k.resim && k.resimPoz === 'sersem' ? 24 : 0;
    var g = k.halat; g.clear();
    var kaynakX, kaynakY;
    if (k.resim) {
      var poz = k.el || k.pozlar[k.resimPoz] || k.pozlar.dur;
      var elX = poz.elX * k.resim.scale.x, elY = poz.elY * k.resim.scale.y;
      var cs = Math.cos(k.resim.rotation), sn = Math.sin(k.resim.rotation);
      kaynakX = SKARN.x + (k.resim.x + elX * cs - elY * sn) * st.yon;
      kaynakY = SKARN.y + k.resim.y + elX * sn + elY * cs;
    } else {
      var kol = k.kukla.sagKol, kolAci = kol.rotation;
      kaynakX = SKARN.x + (kol.x - Math.sin(kolAci) * 62) * st.yon;
      kaynakY = SKARN.y + kol.y + Math.cos(kolAci) * 62;
    }
    if (q && ad === 'zincir' && (d === 'vur' || d === 'sersem' || d === 'toparla')) {
      var p = d === 'sersem' ? 1 : d === 'toparla' ? 1 - u : sin(st.t / 0.18, 0.08, 1);
      var yakalanan = st.vurdu && window.OYUNCU, sutun = st.carpanSutun;
      var hx = sutun ? sutun.x : yakalanan ? yakalanan.x : q.x + q.ux * q.boy;
      var hy = sutun ? sutun.kancaY : yakalanan ? yakalanan.y - 24 : q.y + q.uy * q.boy;
      zincirCiz(g, kaynakX, kaynakY, karis(kaynakX, hx, p), karis(kaynakY, hy, p), true, t);
      if (sutun && (d === 'sersem' || d === 'vur')) {
        buzKirintisi(g, sutun.x, sutun.kancaY, d === 'sersem' ? HAMLE.zincir.aktif - 0.18 + st.t : st.t - 0.18);
      }
    } else if (!k.resim && !st.zincirKirik && !oldu) {
      zincirCiz(g, kaynakX, kaynakY, kaynakX + st.yon * (13 + (yuruyor ? yuru * 8 : bekle * 4)), kaynakY + 36, false, t);
    }
    if (st.zincirKirT > 0 && !oldu) {
      var v = 1 - st.zincirKirT / 0.52;
      for (var i = 0; i < 8; i++) {
        var a = 0.13 + i * 0.73, r = v * (47 + i * 11);
        g.lineStyle(2.8, i % 2 ? SOGUK : KEHRIBAR, (1 - v) * 0.95);
        var xx = kaynakX + Math.cos(a) * r, yy = kaynakY + Math.sin(a) * r * 0.48 + v * v * 54;
        g.drawEllipse(xx, yy, 5 - v * 2, 3 - v);
      }
    }
    uyarilarZemin();
  }

  function basla(x, y) {
    if (OYUN.bolum !== BOLUM_NO || !isFinite(x) || !isFinite(y)) return null;
    if (SKARN.aktif || SKARN.olu) return SKARN;
    sifirla();
    SKARN.x = x; SKARN.y = y + 68; SKARN.aci = Math.PI / 2;
    SKARN.aktif = SKARN.canli = true; SKARN.olu = false; SKARN.evre = 1; SKARN.can = SKARN.canMax;
    st = {
      t: 0, sure: 0, yon: -1, yonKilit: false, adim: 0, hamle: null, plan: null, sonHamle: '',
      carpanSutun: null, vurdu: false, vurusIslendi: false,
      hamleSira: 0, sonAtim: 0, ciftKalan: 0, hedefEvre: 1, parlak: 0, zincirKirik: false,
      zincirKirT: 0, yardim: [], yardimKuyruk: [], takviyeSayac: 0, ekTakviye: 0, ekTakviyeT: 0
    };
    kasa = gorselKur(x, y);
    if (window.DUSMAN && DUSMAN.liste.indexOf(SKARN) < 0) DUSMAN.liste.push(SKARN);
    setDurum('giris', 1.0);
    gorselGuncelle();
    emit('devBasla', { bolum: BOLUM_NO, boss: SKARN, tur: SKARN.tur, ad: SKARN.ad, unvan: SKARN.unvan,
      evre2: SKARN.evre2, evre3: SKARN.evre3, x: SKARN.x, y: SKARN.y });
    return SKARN;
  }
  function sifirla() {
    listedenCikar(); takviyeTemizle();
    if (kasa) {
      var d = [kasa.kap, kasa.golge, kasa.uyari, kasa.halat, kasa.kipIsik];
      for (var i = 0; i < kasa.kaya.length; i++) {
        var k = kasa.kaya[i], j = k.eList.indexOf(k.en);
        if (j !== -1) k.eList.splice(j, 1);
        d.push(k.s, k.golge);
      }
      for (i = 0; i < d.length; i++) {
        if (d[i].parent) d[i].parent.removeChild(d[i]);
        d[i].destroy({ children: true });
      }
    }
    kasa = st = null;
    SKARN.sprite = null; SKARN.aktif = SKARN.olu = SKARN.canli = false; SKARN.sersem = 0;
    SKARN.can = SKARN.canMax; SKARN.evre = 1; SKARN.durum = 'yok';
  }
  function bilgi() {
    var a = st && st.plan;
    return { aktif: SKARN.aktif, olu: SKARN.olu, evre: SKARN.evre, durum: SKARN.durum,
      can: SKARN.can, canMax: SKARN.canMax, saldiri: st && st.hamle, zaman: st ? st.t : 0,
      resim: kasa && kasa.resimPoz, tahminiEvre: st ? st.hedefEvre : 1, destek: st ? canliTakviye() : 0, zincirKirik: !!(st && st.zincirKirik),
      kapsul: a ? { x: a.x, y: a.y, aci: a.aci, boy: a.boy, kilit: st.yonKilit, sutun: a.sutun && { x: a.sutun.x, y: a.sutun.y } } : null };
  }
  if (window.OLAY) OLAY.on('bolum', function () {
    sifirla();
    if (OYUN.bolum !== BOLUM_NO) return;
    var atlas = window.VARLIK && VARLIK.paketler.ayaz;
    var k = atlas && atlas.tekil;
    if (k && k.art_ayaz_sutun !== undefined && Object.keys(POZLAR).every(function (ad) {
      return k[POZLAR[ad].ad] !== undefined;
    })) return;
    var yedek = cizDokular(), motor = OYUN.app && OYUN.app.renderer.texture;
    if (motor && motor.bind) for (var ad in yedek) motor.bind(yedek[ad].baseTexture);
  });
  OYUN.sistem('skarn', { guncelle: guncelle, herKare: gorselGuncelle, sifirla: sifirla, bilgi: bilgi });
})();

