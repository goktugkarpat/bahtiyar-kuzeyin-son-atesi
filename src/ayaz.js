
(function () {
  'use strict';
  var W = 1280, BOGAZ = [7380, 7910], doku = Object.create(null), kar, karlar = [], kuleAlev, kurtarildi = false;
  var buzG, buzlar = [], kapiDetay, surlar, kapiAn = 0;
  var BUZ_KIRILMA_SURESI = .84;
  var kacanlar = [], kurtarmaT;
  var ruzgarPerdesi, ruzgarSiniri, ruzgarSeritleri = [], ruzgarKenar = {};
  var tipiOran = 1;
  var yerDokulari = Object.create(null), dokuKatmani, dokuMaskesi, dekorTabanlari = [];
  var MASKE_OLCEGI = .36;
  var KAPI_X = 640, KAPI_Y = 5300, KAPI_YARI_GECIS = 72;
  var KULE_X = 1034, KULE_Y = 520, kapi, kapiG, uzakAtes, sonBolge;

  function rastgele(tohum) {
    return function () {
      tohum = (Math.imul(tohum, 1664525) + 1013904223) >>> 0;
      return tohum / 4294967296;
    };
  }
  function tuval(w, h, ciz) {
    var c = document.createElement('canvas'); c.width = Math.ceil(w * 2); c.height = Math.ceil(h * 2);
    var g = c.getContext('2d'); g.scale(2, 2); ciz(g, w, h);
    return c;
  }
  function sekil(g, renk, noktalar, cizgi) {
    g.fillStyle = renk; g.beginPath(); g.moveTo(noktalar[0], noktalar[1]);
    for (var i = 2; i < noktalar.length; i += 2) g.lineTo(noktalar[i], noktalar[i + 1]);
    g.closePath(); g.fill();
    if (cizgi) { g.strokeStyle = cizgi; g.lineWidth = 1.6; g.stroke(); }
  }
  function elips(g, x, y, rx, ry, renk, don) {
    g.fillStyle = renk; g.beginPath(); g.ellipse(x, y, rx, ry, don || 0, 0, Math.PI * 2); g.fill();
  }
  function yolX(y) {
    return 640 + Math.sin(y / 780) * (46 + 64 * gecis(y, 6450, 170)) + Math.sin(y / 319) * 30;
  }
  function gecis(y, merkez, en) {
    var a = Math.max(0, Math.min(1, (y - merkez + en) / (2 * en)));
    return a * a * (3 - 2 * a);
  }
  function yolYari(y) {
    return 320 - 90 * gecis(y, 1950, 145) + (-65 + Math.cos(y / 420) * 28) * gecis(y, 6500, 180);
  }
  function bolge(y) { return y > 6490 ? 'buz_bogazi' : y > 2100 ? 'kusatma_avlusu' : 'isaret_kulesi'; }
  function donmus(y) { return y >= BOGAZ[0] && y <= BOGAZ[1]; }
  function atlasKare(ad, paket) {
    paket = paket || 'ayaz';
    var p = VARLIK.paketler[paket];
    if (!p || p.tekil[ad] === undefined) return null;
    var k = VARLIK.kare(paket, ad);
    return k.doku.baseTexture.valid ? k : null;
  }
  function stilKare(ad, eskiPaket) {
    var k = atlasKare(ad, 'ayaz_stil');
    if (!k) return atlasKare(ad, eskiPaket);
    k.stil = true;
    return k;
  }
  function yerDokusu(ad, boy) {
    if (yerDokulari[ad]) return yerDokulari[ad];
    var k = stilKare(ad); if (!k) return null;
    var tx = k.doku, frame = tx.frame, res = tx.baseTexture.resource, src = res && res.source;
    if (!src) return null;
    var olcek = k.stil ? 2 : 1, p = boy * olcek;
    var c = document.createElement('canvas'); c.width = c.height = p;
    var g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
    g.drawImage(src, frame.x, frame.y, frame.width, frame.height, 0, 0, p, p);
    var gecis = document.createElement('canvas'); gecis.width = gecis.height = p;
    // Asimetrik taş alanında birleşim dar tutulur, derz çizgileri geri kalan alanda korunur.
    var kenarPayi = k.stil && ad === 'zemin_avlu' ? .055 : .18;
    var t = gecis.getContext('2d'), yari = Math.floor(p / 2);
    for (var dikey = 0; dikey < 2; dikey++) {
      t.clearRect(0, 0, p, p);
      if (dikey) { t.drawImage(c, 0, -yari); t.drawImage(c, 0, p - yari); }
      else { t.drawImage(c, -yari, 0); t.drawImage(c, p - yari, 0); }
      var kenar = dikey ? t.createLinearGradient(0, 0, 0, p) : t.createLinearGradient(0, 0, p, 0);
      kenar.addColorStop(0, '#000'); kenar.addColorStop(kenarPayi, 'transparent');
      kenar.addColorStop(1-kenarPayi, 'transparent'); kenar.addColorStop(1, '#000');
      t.globalCompositeOperation = 'destination-in'; t.fillStyle = kenar; t.fillRect(0, 0, p, p);
      t.globalCompositeOperation = 'source-over'; g.drawImage(gecis, 0, 0);
    }
    return (yerDokulari[ad] = { c:c, olcek:olcek });
  }
  function dokuDose(g, ad, boy, y0, h, a, xOfset) {
    var d = yerDokusu(ad, boy); if (!d) return false;
    var olcek = d.olcek, kaydir = xOfset || 0;
    g.save(); g.translate(kaydir, -y0); g.scale(1 / olcek, 1 / olcek); g.globalAlpha = a;
    g.fillStyle = g.createPattern(d.c, 'repeat'); g.fillRect(-kaydir * olcek, y0 * olcek, W * olcek, h * olcek);
    g.restore(); return true;
  }
  function karisimDoku(g, ad, boy, y0, h, alfa, kenar, ciz, secenek) {
    var alan = secenek && secenek.alan;
    var d = alan ? null : yerDokusu(ad, boy);
    if (!d && !alan) return false;
    if (!dokuMaskesi) {
      dokuMaskesi = document.createElement('canvas');
      dokuKatmani = document.createElement('canvas');
    }
    var olcek = d ? d.olcek : 2;
    if (dokuKatmani.height !== h * olcek || dokuKatmani.width !== W * olcek) {
      dokuKatmani.width = W * olcek; dokuKatmani.height = h * olcek;
      dokuMaskesi.width = Math.ceil(W * MASKE_OLCEGI);
      dokuMaskesi.height = Math.ceil(h * MASKE_OLCEGI);
    }
    var t = dokuKatmani.getContext('2d'), m = dokuMaskesi.getContext('2d');
    t.setTransform(olcek, 0, 0, olcek, 0, 0);
    t.clearRect(0, 0, W, h);
    m.clearRect(0, 0, dokuMaskesi.width, dokuMaskesi.height);
    if (alan) {
      t.save(); t.globalAlpha = alfa;
      var varMi = zeminResmi(t, ad, alan.x, alan.y-y0, alan.w, alan.h);
      t.restore();
      if (!varMi) return false;
    } else {
      dokuDose(t, ad, boy, y0, h, alfa, secenek && secenek.xOfset);
    }
    m.save(); m.scale(dokuMaskesi.width / W, dokuMaskesi.height / h);
    m.shadowColor = '#000'; m.shadowBlur = kenar * MASKE_OLCEGI;
    m.shadowOffsetX = dokuMaskesi.width * 3;
    m.translate(-W * 3, 0); m.beginPath(); ciz(m); m.closePath(); m.fill(); m.restore();
    t.save(); t.globalCompositeOperation = 'destination-in';
    t.drawImage(dokuMaskesi, 0, 0, W, h); t.restore();
    g.drawImage(dokuKatmani, 0, 0, W, h);
    return true;
  }
  function karZemin(g, y0, h) {
    var r = rastgele(3701 + y0), i, x, y, yy, b, a, gen;
    g.fillStyle = '#71848f'; g.fillRect(0, 0, W, h);
    var sanat = dokuDose(g,'zemin_kar',470,y0,h,1);
    for (i = Math.floor(y0 / 40) - 5; i <= (y0 + h) / 40 + 5; i++) {
      yy = i * 40; y = yy - y0; b = yolX(yy); gen = yolYari(yy);
      elips(g, b, y, gen + 125, 112, donmus(yy) ? 'rgba(114,169,191,.19)' : sanat ? 'rgba(217,232,238,.028)' : 'rgba(216,231,231,.13)');
      elips(g, 155 + Math.sin(i * 1.31) * 94, y + 8, 183, 61, 'rgba(36,62,78,.09)', -.24);
      elips(g, 1117 + Math.cos(i * 1.11) * 125, y, 189, 68, 'rgba(35,58,75,.12)', .2);
    }
    for (i = 0; i < (sanat ? 195 : 350); i++) {
      x = r() * W; y = r() * h; yy = y + y0; b = yolX(yy); a = Math.abs(x - b);
      if (donmus(yy) && a < yolYari(yy) - 12) continue;
      var ya = r() * 0.55 + 0.06, rz = 5 + r() * 47;
      elips(g, x, y, rz, rz * (.11 + r() * .25), i % 3 ? 'rgba(207,223,226,' + ya * .15 + ')' : 'rgba(42,71,86,' + ya * .21 + ')', -.21);
    }
  }
  function karKenar(g, y0, h) {
    karisimDoku(g, 'zemin_kir', 392, y0, h, .85, 48, function (m) {
      for (var s = -1; s <= 1; s += 2) {
        var dis = s < 0 ? -90 : W + 90;
        m.moveTo(dis, -140);
        for (var n = -140; n < h + 145; n += 36) {
          var y = y0 + n;
          m.lineTo(yolX(y) + s * (yolYari(y) + 81 + Math.cos(y / 97 + s) * 43), n);
        }
        m.lineTo(dis, h + 145);
        m.closePath();
      }
    });
  }
  function hisarTas(g, y0, h) {
    if (y0 > 6740) return;
    var bas = Math.max(0, y0), son = Math.min(y0 + h, 6530);
    var boyali = !!atlasKare('zemin_avlu', 'ayaz_stil'), karo = boyali ? 568 : 395;
    var dokulu = !!yerDokusu('zemin_avlu',karo), sacak = y0 < 6740 && y0 + h > 6410;
    if (dokulu && (son > bas || sacak)) {
      karisimDoku(g, "zemin_avlu", karo, y0, h, 1, 34, function (m) {
        if (son > bas) {
          var wy, yukari = bas - 68, asagi = son + 60;
          for (wy = yukari; wy <= asagi; wy += 13) {
            var en = (yolYari(wy) + 20) * (1 - .49 * gecis(wy, 6490, 128));
            var sol = yolX(wy) - en + Math.sin(wy/23) * 6;
            if (wy === yukari) m.moveTo(sol, wy-y0); else m.lineTo(sol, wy-y0);
          }
          for (wy -= 13; wy >= yukari; wy -= 13) {
            var sag = yolX(wy) + (yolYari(wy) + 20) * (1 - .40 * gecis(wy, 6500, 125));
            m.lineTo(sag + Math.cos(wy/17) * 9, wy-y0);
          }
          m.closePath();
        }
        if (!sacak) return;
        // Yolun boğaza bakan ucunda, taşlar karın altında parça parça kaybolur.
        var r = rastgele(34176);
        for (var i = 0; i < 14; i++) {
          var y = 6465 + i * 15 + r() * 18, yon = i % 2 ? 1 : -1;
          var x = yolX(y) + yon * (73 + r() * 140), yarim = 17 + r() * 29, py = y - y0;
          m.moveTo(x-yarim, py-8); m.lineTo(x-12, py-16-r()*8);
          m.lineTo(x+yarim, py-10); m.lineTo(x+yarim*.83, py+6);
          m.lineTo(x+5, py+12+r()*7); m.lineTo(x-yarim*.78, py+9); m.closePath();
        }
      }, { xOfset:boyali ? 35 : 0 });
      if (boyali) avluDokuYamalari(g, y0, h);
    }
    if (!dokulu) for (var q = Math.floor(bas / 33); q * 33 < son; q++) {
      var yy = q * 33, y = yy - y0, r = rastgele(8356 + q), b = yolX(yy), gen = yolYari(yy);
      var sol = Math.floor((b - gen) / 69) * 69, sag = b + gen + 10;
      for (var x = sol; x < sag; x += 69) {
        var a = x - (q % 2 ? 24 : 0), dx = r() * 7, v = 66 + Math.floor(r() * 38);
        sekil(g, 'rgba(' + v + ',' + (v + 13) + ',' + (v + 23) + ',.9)',
          [a + 2, y + 4 + dx, a + 64, y + 1, a + 67, y + 26, a + 55, y + 32, a + 5, y + 30], 'rgba(30,45,60,.7)');
        g.strokeStyle = 'rgba(187,213,222,.25)'; g.lineWidth = 1.3;
        g.beginPath(); g.moveTo(a + 6, y + 7 + dx); g.lineTo(a + 61, y + 5); g.stroke();
        if (r() > .72) elips(g, a + 9 + r() * 44, y + 9, 9 + r() * 13, 3 + r() * 4, 'rgba(206,223,225,.27)', -.1);
      }
    }
    if (y0 < 720) oymaMeydan(g, y0);
    if (y0 < 4800 && y0 + h > 2870) avluIzleri(g, y0, h);
    if (y0 < 2990 && y0 + h > 2630) merdivenIzleri(g, y0);
  }
  function avluDokuYamalari(g, y0, h) {
    // Karolar avlunun bazı yerlerinde onarılmış: taş biçimleri aynı ritimde sıra sıra tekrar etmesin.
    var yer = [
      [6202,-123,130,101], [5723,103,170,108], [4872,-132,151,111],
      [4342,54,173,139], [3906,-94,157,112], [3415,128,114,112],
      [3081,-86,151,98], [2446,96,108,89], [2078,-120,115,112], [1630,84,99,103],
      [1198,-62,107,81]
    ];
    var gorulen = yer.filter(function (d) { return d[0]+d[3]+39>=y0 && d[0]-d[3]-39<=y0+h; });
    if (!gorulen.length) return;
    karisimDoku(g, 'zemin_avlu_yama', 302, y0, h, .86, 27, function (m) {
      gorulen.forEach(function (d) {
        var x = yolX(d[0])+d[1], y = d[0]-y0, rx = d[2], ry = d[3];
        m.moveTo(x-rx, y+ry*.27); m.lineTo(x-rx*.54, y-ry*.75);
        m.lineTo(x-rx*.04, y-ry); m.lineTo(x+rx*.68, y-ry*.82);
        m.lineTo(x+rx, y-ry*.17); m.lineTo(x+rx*.74, y+ry*.72);
        m.lineTo(x+rx*.14, y+ry); m.lineTo(x-rx*.63, y+ry*.59); m.closePath();
      });
    }, {xOfset:-37});
  }
  function zeminResmi(g, ad, x, y, en, boy) {
    var k = stilKare(ad, 'ayaz_cevre2');
    if (!k) return false;
    var d = k.doku, f = d.frame, src = d.baseTexture.resource.source;
    g.drawImage(src, f.x, f.y, f.width, f.height, x - en * .5, y - boy * .5, en, boy);
    return true;
  }
  function merdivenIzleri(g, y0) {
    var merkez = yolX(2786), taban = 2786 - y0;
    if (zeminResmi(g, 'tas_merdiven', merkez, taban, 555, 279)) {
      // Kırağı, boyalı basamakların iç kenarında kalan kısa, kırık izler.
      var firca = rastgele(92214);
      for (var sira = 0; sira < 8; sira++) {
        var adimY = taban - 103 + sira * 28;
        for (var yon of [-1, 1]) {
          var bas = merkez + yon * (166 + firca() * 31), en = 15 + firca() * 19;
          g.beginPath(); g.moveTo(bas, adimY + 2);
          g.lineTo(bas - yon * en * .80, adimY + .6);
          g.lineTo(bas - yon * en, adimY - 1.8);
          g.lineTo(bas - yon * en * .30, adimY - 2.4);
          g.closePath(); g.fillStyle = 'rgba(172,201,218,.38)'; g.fill();
        }
      }
      return;
    }
    var r = rastgele(57409);
    for (var i = 0; i < 8; i++) {
      var wy = 2659 + i * 25 + (i > 3 ? 51 : 0), y = wy - y0;
      var x = yolX(wy), en = 191 + i * 2, sol = x - en, sag = x + en, di = 8 + r() * 3;
      var golge = g.createLinearGradient(0, y - 2, 0, y + 13);
      golge.addColorStop(0, "rgba(7,25,40,.64)"); golge.addColorStop(1, "rgba(22,42,57,0)");
      g.fillStyle = golge; g.beginPath(); g.moveTo(sol, y + 8);
      g.quadraticCurveTo(x, y - di, sag, y + 6); g.lineTo(sag - 2, y + 18);
      g.quadraticCurveTo(x, y + 4, sol + 4, y + 17); g.fill();
      g.strokeStyle = "rgba(192,216,229,.52)"; g.lineWidth = 2.6;
      g.beginPath(); g.moveTo(sol, y + 7); g.quadraticCurveTo(x, y - di - 1, sag, y + 5); g.stroke();
      for (var j = 0; j < 10; j++) {
        var dx = sol + r() * en * 2, k = Math.abs(dx - x) / en;
        elips(g, dx, y + k * k * 12 - 1, 2.3 + r() * 11, .65 + r() * 1.5, "rgba(213,232,240,.47)", -.05);
      }
    }
  }
  function oymaMeydan(g, y0) {
    // Taş oyma, ışık ve dövüş uyarılarının altında zeminle birlikte çizilir.
    g.save();
    var boyali = !!atlasKare('oyma_arma', 'ayaz_stil');
    if (boyali) g.globalAlpha = .73;
    zeminResmi(g, 'oyma_arma', 640, 370-y0, boyali ? 622 : 650, boyali ? 368 : 397);
    g.restore();
  }
  function avluIzleri(g, y0, h) {
    var ilk = Math.floor((y0 - 25) / 44) * 44;
    for (var wy = ilk; wy < y0 + h + 30; wy += 44) {
      if (wy < 2870 || wy > 4800) continue;
      var r = rastgele(32460 + wy), y = wy - y0, x = yolX(wy), ken = yolYari(wy);
      for (var yon = -1; yon <= 1; yon += 2) {
        var bas = x + yon * (ken - 25 + r() * 9), dis = 10 + r() * 11;
        g.strokeStyle = "rgba(20,38,49,.23)"; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(bas + yon * dis, y - 13); g.lineTo(bas, y);
        g.lineTo(bas + yon * dis, y + 16); g.stroke();
        g.strokeStyle = "rgba(201,220,229,.22)"; g.beginPath();
        g.moveTo(bas + yon * dis, y - 12); g.lineTo(bas + 1.5 * yon, y);
        g.lineTo(bas + yon * dis, y + 16); g.stroke();
      }
    }
  }
  function buzNehri(g, y0, h) {
    if (y0 + h < BOGAZ[0] - 105 || y0 > BOGAZ[1] + 105) return;
    var top = BOGAZ[0] - y0, son = BOGAZ[1] - y0;
    var gr = g.createLinearGradient(0, top - 75, 0, son + 75);
    gr.addColorStop(0, 'rgba(102,155,177,0)'); gr.addColorStop(.13, '#608aa5');
    gr.addColorStop(.54, '#88b4c9'); gr.addColorStop(.87, '#567e9a'); gr.addColorStop(1, 'rgba(100,144,166,0)');
    function buzSiniri(m) {
    for (var wy = BOGAZ[0] - 80; wy <= BOGAZ[1] + 80; wy += 18) {
      var x = yolX(wy) - 272 + Math.cos(wy / 51) * 42;
      if (wy === BOGAZ[0] - 80) m.moveTo(x, wy - y0); else m.lineTo(x, wy - y0);
    }
    for (wy -= 18; wy >= BOGAZ[0] - 80; wy -= 18) m.lineTo(yolX(wy) + 282 + Math.sin(wy / 61) * 48, wy - y0);
    }
    if (atlasKare('zemin_buz', 'ayaz_stil') &&
        karisimDoku(g, 'zemin_buz', 0, y0, h, .96, 43, buzSiniri,
          {alan:{x:643,y:7650,w:978,h:902}})) return;
    if (!karisimDoku(g, 'zemin_buz', 437, y0, h, .94, 43, buzSiniri)) {
      g.fillStyle = gr; g.beginPath(); buzSiniri(g); g.closePath(); g.fill();
    }
    var r = rastgele(34917);
    for (var i = 0; i < 67; i++) {
      var y = BOGAZ[0] + r() * (BOGAZ[1] - BOGAZ[0]), cx = yolX(y) + (r() - .5) * 505;
      var len = 18 + r() * 110, dx = (r() - .5) * len, dy = (r() - .5) * len;
      g.lineWidth = i % 3 ? 1.3 : 2.2;
      g.strokeStyle = i % 4 ? 'rgba(37,81,111,.43)' : 'rgba(216,245,247,.58)';
      g.beginPath(); g.moveTo(cx, y - y0); g.lineTo(cx + dx * .3, y - y0 + dy * .68);
      g.lineTo(cx + dx, y - y0 + dy); g.lineTo(cx + dx + len * .17, y - y0 + dy * 1.22); g.stroke();
      if (i % 2) elips(g, cx, y - y0, 14 + r() * 36, 2 + r() * 9, 'rgba(221,246,248,.15)', .24);
    }
  }
  function karIsik(g, y0, h) {
    var kg = g.createLinearGradient(0, 0, W, 0);
    kg.addColorStop(0, 'rgba(19,38,56,.5)'); kg.addColorStop(.26, 'rgba(29,58,75,.13)');
    kg.addColorStop(.55, 'rgba(198,230,239,.02)'); kg.addColorStop(.8, 'rgba(24,49,67,.18)');
    kg.addColorStop(1, 'rgba(14,30,52,.57)'); g.fillStyle = kg; g.fillRect(0, 0, W, h);
    var r = rastgele(1747 + y0);
    for (var i = 0; i < 445; i++) {
      g.fillStyle = i % 3 ? "rgba(224,239,241,.15)" : "rgba(28,53,69,.11)";
      var b = .45 + r() * 2.2;
      g.fillRect(r() * W, r() * h, b, b * .62);
    }
    for (var j = Math.floor(y0 / 91) - 1; j < (y0 + h) / 91 + 1; j++) {
      var yy = j * 91, e = rastgele(7188 + j), gen = yolYari(yy), x = yolX(yy);
      for (var yon = -1; yon <= 1; yon += 2) {
        var dx = x + (gen + 37 + e() * 80) * yon;
        var la = 67 + e() * 114;
        g.save(); g.translate(dx, yy - y0); g.rotate(-.24); g.scale(1, .28 + e() * .2);
        var kar = g.createRadialGradient(0, 0, 0, 0, 0, la);
        kar.addColorStop(0, "rgba(208,233,243,.19)"); kar.addColorStop(1, "rgba(208,233,243,0)");
        g.fillStyle = kar; g.fillRect(-la, -la, la * 2, la * 2); g.restore();
      }
    }
    if (y0 < 6360 && y0 + h > 1970) {
      // Hisarın korunaklı iç avlusunda açık boğazdan daha sıcak taş ve kahverengi kar gölgeleri.
      var avlu = g.createLinearGradient(0, 1970 - y0, 0, 6360 - y0);
      avlu.addColorStop(0, 'rgba(126,91,70,0)');
      avlu.addColorStop(.2, 'rgba(126,91,70,.10)');
      avlu.addColorStop(.7, 'rgba(118,89,72,.09)');
      avlu.addColorStop(1, 'rgba(118,89,72,0)');
      g.fillStyle = avlu; g.fillRect(0,0,W,h);
    }
    if (y0 < 850) {
      // Kuleye kadar uzanan koyu geçiş, ayın vurduğu taşları belirginleştirir.
      var gece = g.createLinearGradient(260, 0, 930, 0);
      gece.addColorStop(0, 'rgba(13,22,40,.08)');
      gece.addColorStop(.59, 'rgba(13,22,40,.32)');
      gece.addColorStop(1, 'rgba(13,22,40,.20)');
      g.fillStyle = gece; g.fillRect(0, 0, W, h);
      g.save();
      g.translate(330, 207 - y0); g.rotate(.24); g.scale(1, .82);
      var ay = g.createRadialGradient(0, 0, 0, 0, 0, 540);
      ay.addColorStop(0, 'rgba(154,200,239,.49)');
      ay.addColorStop(.38, 'rgba(118,175,223,.35)');
      ay.addColorStop(.72, 'rgba(76,129,194,.16)');
      ay.addColorStop(1, 'rgba(76,129,194,0)');
      g.globalCompositeOperation = 'screen';
      g.fillStyle = ay; g.fillRect(-540, -540, 1080, 1080);
      g.restore();
    }
  }
  function surZemin(g, y0, h) {
    var esik = KAPI_Y - y0;
    if (esik < -50 || esik > h + 48) return;
    var golge = g.createLinearGradient(0, esik - 32, 0, esik + 47);
    golge.addColorStop(0, 'rgba(16,29,39,0)');
    golge.addColorStop(.40, 'rgba(14,23,31,.60)');
    golge.addColorStop(.62, 'rgba(19,31,39,.31)');
    golge.addColorStop(1, 'rgba(19,31,39,0)');
    var sol = KAPI_X - KAPI_YARI_GECIS - 13, sag = W - sol, gecis = 25;
    g.save();
    g.fillStyle = golge;
    g.fillRect(0, esik - 32, sol, 79);
    g.fillRect(sag, esik - 32, W - sag, 79);
    // Gölge duvar diplerinde kalır, kapı açıklığına doğru yumuşakça çözülür.
    for (var i = 0; i < gecis; i++) {
      var t = 1 - (i + .5) / gecis;
      g.globalAlpha = t * t * (3 - 2 * t);
      g.fillRect(sol + i, esik - 32, 1, 79);
      g.fillRect(sag - i - 1, esik - 32, 1, 79);
    }
    g.restore();
  }
  function dekorTemasGolgeleri(g, y0, h) {
    for (var i = 0; i < dekorTabanlari.length; i++) {
      var d = dekorTabanlari[i];
      if (d.y + d.ry < y0 || d.y - d.ry > y0 + h) continue;
      g.save(); g.translate(d.x, d.y-y0); g.scale(d.rx, d.ry);
      var golge = g.createRadialGradient(0, -.12, .08, 0, 0, 1);
      golge.addColorStop(0, 'rgba(11,15,20,.54)');
      golge.addColorStop(.52, 'rgba(11,15,20,.42)');
      golge.addColorStop(.81, 'rgba(11,15,20,.19)');
      golge.addColorStop(1, 'rgba(11,15,20,0)');
      g.fillStyle = golge; g.fillRect(-1, -1, 2, 2);
      g.restore();
    }
  }
  function avluKiyisi(g, y0, h) {
    if (y0 > 672 || y0 + h < 125) return;
    var r = rastgele(48351);
    g.save(); g.translate(0, -y0);
    // Kafesler ile kule dibinde biriken kar, avlunun ortasını ve armayı boş bırakır.
    [[260, 178, 88, 30, -.24], [205, 301, 96, 37, -.22],
      [254, 497, 113, 43, -.24], [422, 533, 86, 22, .20],
      [1041, 174, 84, 26, .13], [1092, 491, 118, 41, .27],
      [1009, 535, 75, 21, .08], [1098, 598, 134, 39, -.15]]
      .forEach(function (d) {
        var en = d[2], boy = d[3];
        g.save(); g.translate(d[0], d[1]); g.rotate(d[4]); g.scale(en, boy);
        var birikinti = g.createRadialGradient(-.14, -.29, .04, 0, 0, 1);
        birikinti.addColorStop(0, 'rgba(154,181,207,.66)');
        birikinti.addColorStop(.40, 'rgba(146,174,199,.58)');
        birikinti.addColorStop(.73, 'rgba(124,159,187,.24)');
        birikinti.addColorStop(1, 'rgba(116,153,188,0)');
        g.fillStyle = birikinti; g.fillRect(-1, -1, 2, 2);
        var kar = g.createLinearGradient(0, -.55, 0, .54);
        kar.addColorStop(0, 'rgba(198,218,228,.45)');
        kar.addColorStop(.44, 'rgba(145,177,202,.43)');
        kar.addColorStop(1, 'rgba(91,131,172,0)');
        g.fillStyle = kar;
        g.beginPath(); g.moveTo(-.77, .15);
        g.bezierCurveTo(-.64,-.31,-.57,-.18,-.45,-.31);
        g.bezierCurveTo(-.22,-.62,-.03,-.25,.12,-.36);
        g.bezierCurveTo(.43,-.44,.32,-.05,.75,-.01);
        g.bezierCurveTo(.57,.28,.13,.17,-.07,.42);
        g.bezierCurveTo(-.35,.25,-.61,.34,-.77,.15);
        g.fill();
        g.restore();
        for (var i = 0; i < 22; i++) {
          var x = d[0] + (r() - .5) * en * 1.78, y = d[1] + (r() - .5) * boy * 1.22;
          var uzun = 3 + r() * 18;
          g.beginPath(); g.moveTo(x, y);
          g.quadraticCurveTo(x + uzun * .52, y - 2, x + uzun, y + uzun * d[4] * .32);
          g.lineWidth = .65 + r() * 1.2;
          g.strokeStyle = i % 4 ? 'rgba(211,229,235,.32)' : 'rgba(77,111,138,.26)';
          g.stroke();
        }
      });
    // Donmuş döşemenin birkaç kırık köşesi, ince kırağı ve tabaka ayrımı.
    [[408,205,28,9], [466,286,36,11], [347,412,24,10], [521,594,38,11],
      [768,608,36,11], [962,575,28,10], [979,177,32,10]]
      .forEach(function (p) {
        var x = p[0], y = p[1], en = p[2], boy = p[3];
        g.beginPath(); g.moveTo(x - en, y);
        g.lineTo(x - en * .48, y - boy * .73); g.lineTo(x + en * .04, y - boy);
        g.lineTo(x + en * .51, y - boy * .50); g.lineTo(x + en, y + boy * .13);
        g.lineTo(x + en * .18, y + boy); g.lineTo(x - en * .68, y + boy * .62); g.closePath();
        g.fillStyle = 'rgba(54,78,95,.36)'; g.fill();
        g.beginPath(); g.moveTo(x - en * .77, y - 1);
        g.lineTo(x - en * .40, y - boy * .55); g.lineTo(x + en * .04, y - boy * .68);
        g.lineTo(x + en * .41, y - boy * .28);
        g.strokeStyle = 'rgba(193,218,232,.46)'; g.lineWidth = 1.6; g.stroke();
      });
    g.restore();
  }
  function esikKiragi(g, y0, h) {
    // Surların iki yanında taş kırıkları ve rüzgârın biriktirdiği kar.
    var alanlar = [
      [KAPI_X - 248, KAPI_Y + 30, 119, 29, -.08],
      [KAPI_X + 243, KAPI_Y + 32, 127, 31, .11]
    ];
    for (var p of alanlar) {
      if (p[1] - p[3] - 12 > y0 + h || p[1] + p[3] + 12 < y0) continue;
      var r = rastgele(2367 + Math.round(p[0]) * 7);
      g.save(); g.translate(p[0], p[1] - y0); g.rotate(p[4]);
      var en = p[2], boy = p[3];
      g.save(); g.scale(en, boy);
      var kar = g.createRadialGradient(-.21, -.18, .08, 0, 0, 1);
      kar.addColorStop(0, 'rgba(141,168,190,.36)');
      kar.addColorStop(.47, 'rgba(121,153,178,.25)');
      kar.addColorStop(1, 'rgba(91,128,158,0)');
      g.fillStyle = kar; g.fillRect(-1, -1, 2, 2);
      for (var j = 0; j < 5; j++) {
        var bas = -.83 + j * .30 + r() * .13, seviye = -.42 + r() * .60;
        g.beginPath(); g.moveTo(bas, seviye + .18);
        g.bezierCurveTo(bas + .13, seviye - .06, bas + .30, seviye - .06, bas + .47, seviye);
        g.bezierCurveTo(bas + .30, seviye + .19, bas + .17, seviye + .19, bas, seviye + .18);
        g.fillStyle = j % 2 ? 'rgba(179,202,216,.49)' : 'rgba(139,173,197,.53)';
        g.fill();
      }
      g.restore();
      for (var i = 0; i < 29; i++) {
        var x = (r() - .5) * en * 1.75, y = (r() - .5) * boy * 1.12, w = 5 + r() * 19;
        g.beginPath(); g.moveTo(x - w * .5, y + 2);
        g.lineTo(x - w * .3, y - 3); g.lineTo(x + w * .24, y - 5); g.lineTo(x + w * .61, y);
        g.lineTo(x + w * .27, y + 3.5); g.closePath();
        g.fillStyle = i % 3 ? 'rgba(99,133,157,.42)' : 'rgba(66,91,113,.63)'; g.fill();
        g.beginPath(); g.moveTo(x - w * .44, y + 1);
        g.lineTo(x - w * .3, y - 3); g.lineTo(x + w * .19, y - 4.7);
        g.strokeStyle = 'rgba(185,210,225,.51)'; g.lineWidth = 1.15; g.stroke();
      }
      g.restore();
    }
  }

  function zeminAdimlari(g, y0, h) {
    return [function () { karZemin(g, y0, h); }, function () { karKenar(g, y0, h); },
      function () { hisarTas(g, y0, h); },
      function () { buzNehri(g, y0, h); },
      function () { esikKiragi(g, y0, h); },
      function () { avluKiyisi(g, y0, h); },
      function () { karIsik(g, y0, h); surZemin(g, y0, h); dekorTemasGolgeleri(g, y0, h); }];
  }

  var DEKOR = {
    ayaz_cam: [137, 234, function (g) {
      sekil(g, '#293b48', [62,214,75,213,76,146,63,148], '#172732');
      for (var i = 0; i < 5; i++) {
        var y = 33 + i * 30, a = 16 + i * 10;
        sekil(g, i % 2 ? '#254351' : '#355766', [69,y-21,69-a,y+36,51,y+30,68,y+40,110+i*4,y+28,79,y+5], '#1f3947');
        sekil(g, '#b2c5c9', [69,y-18,75,y+1,95+i*3,y+24,80,y+22,66,y+15,51-i*4,y+28,41-i*4,y+27], '#6e919e');
        sekil(g, 'rgba(215,231,231,.53)', [69,y-15,73,y+2,85+i*3,y+14,70,y+6,56-i*3,y+20]);
      }
    }],
    ayaz_kaya: [158, 107, function (g) {
      sekil(g, '#3d5365', [12,87,24,58,75,15,114,23,148,68,135,91,74,102], '#293c4a');
      sekil(g, '#697f8e', [24,58,75,15,106,42,65,67,39,88], '#4b6473');
      sekil(g, '#b7ced4', [24,58,75,15,114,23,130,48,104,51,93,42,73,43,64,57,36,67], '#809da9');
      sekil(g, '#526c7b', [66,63,105,52,131,46,145,69,113,73,91,83,75,81], '#344958');
    }],
    ayaz_duvar: [240, 185, function (g) {
      sekil(g, '#3d4858', [9,78,181,63,233,83,233,133,188,166,10,178], '#273747');
      sekil(g, '#687488', [10,77,181,63,230,82,188,110,10,123], '#35495d');
      for (var i = 0; i < 6; i++) {
        var x = 13 + i * 33, y = 94 - i * 2;
        sekil(g, i % 2 ? '#657689' : '#576d81', [x,y,x+29,y-1,x+29,y+18,x+1,y+19], '#394755');
        sekil(g, '#c0d2d6', [x-2,y-8,x+12,y-14,x+32,y-11,x+30,y+2,x+20,y-2,x+9,y+1,x,y+3]);
      }
      for (var j = 0; j < 2; j++) for (var k = 0; k < 5; k++) {
        var x0 = 11 + k * 35 + j * 8, y0 = 121 + j * 22 - k * 2;
        sekil(g, j ? '#526474' : '#667386', [x0,y0,x0+31,y0-1,x0+33,y0+15,x0+1,y0+18], '#334552');
      }
    }],
    ayaz_araba: [170, 148, function (g) {
      elips(g, 45,109,25,27,'#303441'); elips(g, 45,109,19,21,'#675953');
      elips(g, 130,109,25,25,'#282e35'); elips(g, 130,109,18,20,'#6d6258');
      sekil(g, '#504e4d', [20,69,137,55,159,80,137,111,39,120], '#282a30');
      for (var i = 0; i < 4; i++) sekil(g, i % 2 ? '#706760' : '#847b6f', [22+i*23,70-i*3,47+i*23,61-i*2,59+i*23,99-i*3,40+i*23,115-i*4], '#434147');
      sekil(g, '#b4cad0', [24,66,85,54,144,54,144,66,125,65,113,73,70,67,64,77,43,74,29,79]);
    }],
    ayaz_kafes: [125, 164, function (g) {
      sekil(g,'#323d4e',[13,49,58,24,112,55,111,137,51,156,10,132],'#1c2836');
      sekil(g,'#172635',[22,58,56,40,101,65,101,128,49,144,21,124]);
      elips(g, 61,82,10,11,'#b1927b');
      sekil(g,'#71656a',[49,93,65,92,77,114,70,132,45,125]);
      for (var i = 0; i < 6; i++) {
        var x = 14 + i * 17;
        g.strokeStyle = '#718491'; g.lineWidth = 4; g.beginPath(); g.moveTo(x, 53 + Math.abs(x-58)*.2); g.lineTo(x, 137 + (i % 3) * 3); g.stroke();
      }
      sekil(g,'#b2c5cb',[11,45,53,21,111,48,108,60,55,40,17,56]);
    }],
    ayaz_mesale: [92, 164, function (g) {
      sekil(g, '#384751', [42,143,53,143,52,54,43,54], '#24323d');
      sekil(g, '#768896', [31,55,60,55,57,72,37,72], '#283844');
      sekil(g, '#985836', [32,54,60,54,56,61,39,61]);
      sekil(g, '#a7c6ce', [31,144,47,136,65,142,60,150,36,150]);
    }],
    ayaz_kule: [280, 392, function (g) {
      sekil(g,'#354657',[33,347,41,137,78,104,229,116,243,335,190,372,68,381],'#243544');
      sekil(g,'#5f7284',[39,136,77,105,174,121,177,341,68,370,36,346],'#293d4c');
      sekil(g,'#42566c',[174,120,229,114,243,335,180,349],'#243d50');
      for (var k = 0; k < 8; k++) for (var i = 0; i < 3; i++) {
        var x = 49 + 40 * i + k % 2 * 5, y = 153 + 23 * k - i * 3;
        sekil(g, (i+k)%3 ? '#6b8091' : '#637788', [x,y,x+39,y+1,x+39,y+16,x+2,y+20], '#4b6070');
      }
      sekil(g,'#222e3e',[99,349,101,297,119,275,141,291,145,345]);
      sekil(g,'#a3bac3',[30,139,32,103,61,91,66,109,86,109,90,84,113,83,119,106,146,108,148,89,171,88,175,113,198,112,201,90,222,89,231,116,245,113,246,136,181,150,60,150], '#40566a');
      sekil(g,'#c6dadc',[31,103,62,92,67,104,90,105,91,84,112,83,119,102,147,103,148,89,170,87,176,107,199,105,200,91,221,89,228,111,246,109,245,119,178,124,58,119]);
      sekil(g,'#667281',[96,92,108,70,161,70,184,91,157,107,110,106],'#364459');
      elips(g, 139,82,41,11,'#db743e');
    }]
  };
  function dekorDoku(ad) {
    if (doku[ad]) return doku[ad];
    var a = DEKOR[ad] || DEKOR[ad.replace(/_\d+$/, '')];
    var art = stilKare('art_' + ad);
    if (art) {
      var detay = { tex: art.doku, ax: -art.ox / art.w, ay: -art.oy / art.h, h: art.bilgi?.renderH ?? art.h };
      if (ad === 'ayaz_kule') {
        detay.alevX = art.w * (art.bilgi?.alevX ?? .008);
        detay.alevY = art.h * (art.bilgi?.alevY ?? -.92);
        detay.alevBoy = art.stil ? .59 : .72;
        detay.mesaleRengi = !!art.stil;
      } else if (ad === 'ayaz_mesale') {
        detay.alevX = art.w * (art.bilgi?.alevX ?? .008);
        detay.alevY = art.h * (art.bilgi?.alevY ?? -.89);
        detay.alevBoy = .63;
        detay.mesaleRengi = !!art.stil;
      }
      return (doku[ad] = detay);
    }
    if (!a) return null;
    var tex = PIXI.Texture.from(tuval(a[0], a[1], a[2]), { resolution: 2 });
    return (doku[ad] = { tex: tex, ax: .5, ay: .95, h: a[1] });
  }
  function yerlesim(dekorEkle, ates) {
    var r = rastgele(59013), i, boyali = !!atlasKare('zemin_kar', 'ayaz_stil');
    dekorTabanlari.length = 0;
    function ekle(ad, x, y, sec) {
      var d = dekorEkle(ad, x, y, sec);
      if (d && boyali && d.tb) {
        var ince = ad === 'ayaz_mesale' || ad === 'ayaz_sancak';
        var rx = ince ? d.boy*.18 : Math.max(15, d.tb[0]*.55);
        var ry = ince ? d.boy*.071 : Math.max(7, Math.min(29, d.tb[1]*.40));
        dekorTabanlari.push({ x:d.x+2, y:d.y-ry*.17, rx:rx, ry:ry });
      }
      return d;
    }
    var arabalar = [[374,6000],[947,5500],[325,4110],[958,3200],[388,2240]];
    var kafesler = [[292,1830],[1040,1718],[252,1360],[971,1265],[237,481],[303,340]];
    var sabitler = arabalar.concat(kafesler);
    var izler = [
      ["ayaz_yamac", 190, 8710, 1.2], ["ayaz_yamac", 1129, 8200, 1.14, true],
      ["ayaz_yamac", 87, 7780, 1.18], ["ayaz_yamac", 1142, 7450, 1.03, true],
      ["ayaz_yamac", 126, 7050, .98, true], ["ayaz_sancak", 855, 6340, .92],
      ["ayaz_sancak", 371, 5605, 1.16, true], ["ayaz_mancinik", 1000, 4630, 1.17],
      ["ayaz_mancinik", 249, 3890, .96, true], ["ayaz_sancak", 913, 3540, .94],
      ["ayaz_mancinik", 1036, 3030, .88], ["ayaz_kemer", Math.round(yolX(2390)), 2390, 1.16],
      ["ayaz_sancak", 924, 1590, 1.07, true]
    ];
    izler.forEach(function (d) {
      if (atlasKare("art_" + d[0])) ekle(d[0], d[1], d[2], { zorla:true, olcek:d[3], ayna:!!d[4] });
    });
    var inceCam = !!atlasKare('art_ayaz_cam_2', 'ayaz_stil');
    var kirikSur = !!atlasKare('art_ayaz_duvar_2', 'ayaz_stil');
    for (i = 0; i < 61; i++) {
      var y = 550 + i * 140, s = i % 2 ? -1 : 1, x = yolX(y) + s * (y > 6400 ? 295 : 355) + (r() - .5) * 63;
      if (Math.abs(y - KAPI_Y) < 175) continue;
      var ad = y > 5700 ? (i % 3 ? 'ayaz_cam' : 'ayaz_kaya') : i % 6 === 1 ? 'ayaz_cam' : i % 3 ? 'ayaz_duvar' : 'ayaz_kaya';
      // Avluda aynı duvarı yan yana tekrar etme; enkaz ve kayalar kuşatma kalıntılarına yer açar.
      if (y === 3770 || y === 4470) ad = 'ayaz_kaya';
      var varyant = i % 5 < 2 && ((inceCam && ad === 'ayaz_cam') || (kirikSur && ad === 'ayaz_duvar'));
      var olcek = .75 + r() * .54;
      if (Math.abs(y - KULE_Y) < 126 && Math.abs(x - KULE_X) < 177) continue;
      if (ad === 'ayaz_kaya') {
        // Araba tekeri ve kafes ayakları kayanın içine oturmasın.
        for (var j = 0; j < sabitler.length; j++) {
          var sabit = sabitler[j];
          if (Math.abs(y - sabit[1]) < 35 && Math.abs(x - sabit[0]) < 132) {
            x = sabit[0] + 155 * s;
            break;
          }
        }
      }
      var agacVeyaSur = ekle(ad, x, y, { ayna: s < 0, olcek: olcek });
      // Yeni siluet aynı yer izi ve çarpışma alanını kullanır.
      if (agacVeyaSur && varyant) agacVeyaSur.ad = ad + '_2';
    }
    [8750, 8270, 7090, 6540, 5630, 5075, 4270, 3400, 2770, 1720, 1180, 480].forEach(function (y, n) {
      var sides = n % 3 ? [n % 2 ? -1 : 1] : [-1, 1];
      sides.forEach(function (s) {
        var x = yolX(y) + yolYari(y) * .82 * s;
        var d = ekle('ayaz_mesale', x, y, { zorla: true, ayna: false, olcek: .85 });
        if (d) { d.alevX = 0; d.alevY = -88; ates.push({ x: x, y: y, h: 89, guc: .72, tur: 'mesale' }); }
      });
    });
    arabalar.forEach(function (o) { ekle('ayaz_araba', o[0], o[1], { zorla: true }); });
    kafesler.forEach(function (o, i) {
      var k = ekle('ayaz_kafes', o[0], o[1], { zorla:true, ayna:false });
      if (k && i % 2) k.ayazKafesTipi = 'ayaz_kafes_kadin';
    });
    var kule = ekle('ayaz_kule', KULE_X, KULE_Y, { zorla: true, ayna: false, olcek: .96 });
    if (kule) {
      kule.alevX = 0; kule.alevY = -278;
      kuleAlev = { x: KULE_X, y: KULE_Y, h: 350, guc: 1.55, tur: 'ev' };
      ates.push(kuleAlev);
    }
  }
  function karKur() {
    if (kar) return;
    var r = rastgele(5122);
    var tex = PIXI.Texture.from(tuval(28, 14, function (g) {
      var iz = g.createLinearGradient(2, 2, 25, 11);
      iz.addColorStop(0, 'rgba(195,221,242,0)');
      iz.addColorStop(.32, 'rgba(202,231,250,.52)');
      iz.addColorStop(1, 'rgba(234,247,255,1)');
      g.strokeStyle = iz; g.lineWidth = 2.05; g.lineCap = 'round';
      g.beginPath(); g.moveTo(2,1.8); g.lineTo(25,11.4); g.stroke();
    }), { resolution: 2 });
    var ruzgarDoku = PIXI.Texture.from(tuval(256, 80, function (g) {
      var dalga = rastgele(420812);
      for (var j=0; j<28; j++) {
        var y=8+dalga()*60, x=6+dalga()*88, boy=42+dalga()*120, gen=2+dalga()*11;
        var hava=g.createLinearGradient(x,y,x+boy,y);
        hava.addColorStop(0,'rgba(210,230,248,0)');
        hava.addColorStop(.36,'rgba(207,230,249,'+(.055+dalga()*.11)+')');
        hava.addColorStop(.72,'rgba(225,240,252,.075)');
        hava.addColorStop(1,'rgba(227,241,252,0)');
        g.fillStyle=hava;
        g.beginPath(); g.ellipse(x+boy*.5,y,boy*.5,gen*.52,.12,0,Math.PI*2); g.fill();
      }
    }));
    ruzgarPerdesi = new PIXI.Container();
    ruzgarPerdesi.name = 'ayaz_ruzgar_seritleri'; ruzgarPerdesi.visible = false;
    ruzgarSiniri = new PIXI.Graphics();
    OYUN.katman.ust.addChild(ruzgarPerdesi, ruzgarSiniri);
    ruzgarPerdesi.mask = ruzgarSiniri;
    for (var j=0;j<3;j++) {
      var dalga = new PIXI.Sprite(ruzgarDoku);
      dalga.anchor.set(.5); dalga.rotation=.115;
      ruzgarPerdesi.addChild(dalga); ruzgarSeritleri.push(dalga);
    }
    uzakAtes = new PIXI.Sprite(PIXI.Texture.from(tuval(128, 106, function (g) {
      var l = g.createRadialGradient(64,53,0,64,53,47);
      l.addColorStop(0,'rgba(255,186,110,.72)'); l.addColorStop(.24,'rgba(253,117,64,.34)');
      l.addColorStop(1,'rgba(227,76,38,0)'); g.fillStyle=l; g.fillRect(0,0,128,106);
    }), { resolution: 2 }));
    uzakAtes.anchor.set(.5); uzakAtes.name = 'ayaz_uzak_isaret'; OYUN.katman.ust.addChild(uzakAtes);
    kar = new PIXI.ParticleContainer(236, { position: true, alpha: true, scale: true });
    kar.name = 'ayaz_tipisi'; kar.visible = false;
    OYUN.katman.ust.addChild(kar);
    for (var i = 0; i < 236; i++) {
      var s = new PIXI.Sprite(tex), z = r();
      s.anchor.set(.5);
      kar.addChild(s); karlar.push({ s: s, x: r(), y: r(), z: z });
    }
  }
  function karGuncelle(dt) {
    if (OYUN.bolum !== 3) {
      if (kar) kar.visible = uzakAtes.visible = ruzgarPerdesi.visible = false;
      return;
    }
    karKur(); kar.visible = ruzgarPerdesi.visible = true;
    var v = OYUN.gorunum, t = OYUN.zaman.gercekT;
    var esinti = Math.pow(.5 + Math.sin(t * .88) * .5, 3);
    var sahne = bolge(OYUN.kamera.y + 330);
    var hedef = sahne === 'kusatma_avlusu' ? .63 : sahne === 'isaret_kulesi' ? .53 : 1;
    tipiOran += (hedef - tipiOran) * (1 - Math.exp(-dt * 3.7));
    var ruzgar = (.069 + .128 * esinti + .018 * Math.sin(t * 1.59)) * (.69 + .31 * tipiOran);
    if (v.x0 !== ruzgarKenar.x || v.y0 !== ruzgarKenar.y || v.w !== ruzgarKenar.w || v.h !== ruzgarKenar.h) {
      ruzgarKenar.x=v.x0; ruzgarKenar.y=v.y0; ruzgarKenar.w=v.w; ruzgarKenar.h=v.h;
      ruzgarSiniri.clear().beginFill(0xffffff).drawRect(v.x0,v.y0,v.w,v.h).endFill();
      for (var j=0;j<ruzgarSeritleri.length;j++) {
        ruzgarSeritleri[j].width=v.w*(.70+j*.055); ruzgarSeritleri[j].height=v.h*(.18+j*.018);
      }
    }
    for (var n=0;n<ruzgarSeritleri.length;n++) {
      var serit = ruzgarSeritleri[n], u=(t*(.11+n*.018)+n*.328)%1;
      serit.position.set(v.x0+v.w*(u*1.60-.30),v.y0+v.h*(.20+n*.29+u*.05));
      serit.alpha=Math.sin(u*Math.PI)*tipiOran*(.20+.40*esinti);
    }
    var kameraY = OYUN.kamera.y;
    uzakAtes.visible = kameraY > 920;
    if (uzakAtes.visible) {
      uzakAtes.position.set(OYUN.dunyaEkran(KULE_X, kameraY + 20).x, v.y0 + 27);
      uzakAtes.alpha = Math.min(.60, .21 + (1 - kameraY / 8800) * .31 + Math.sin(t * 3.5) * .055);
      uzakAtes.scale.set(.70 + (1 - kameraY / 8800) * .55);
    }
    if (OYUN.durum === 'oyun' && kameraY < 8020 && sahne !== sonBolge) {
      sonBolge = sahne;
      OLAY.emit('ayazBolge', { ad: sahne === 'buz_bogazi' ? 'Donmuş Boğaz' : sahne === 'kusatma_avlusu' ? 'Kuşatma Avlusu' : 'İşaret Kulesi' });
    }
    for (var i = 0; i < karlar.length; i++) {
      var k = karlar[i], yakin=.27+k.z*.73;
      k.x += ruzgar * (1 + k.z * 1.9) * dt;
      k.y += (.052 + .128 * k.z + .016 * esinti) * dt;
      k.s.scale.set(yakin*(.88+esinti*.53),yakin*(.91+esinti*.08));
      if (k.x > 1.04) k.x -= 1.09;
      if (k.y > 1.04) k.y -= 1.09;
      k.s.x = v.x0 + k.x * v.w; k.s.y = v.y0 + k.y * v.h;
      var kenar = Math.max(0, Math.min(1, k.x * 18, k.y * 18, (1 - k.x) * 18, (1 - k.y) * 18));
      k.s.alpha = tipiOran * kenar * (.33 + .48 * k.z + esinti * .17);
      if (i >= 178) k.s.alpha *= Math.max(0,(tipiOran-.47)*1.85);
    }
  }
  function kurtarmaSil() {
    for (var i = 0; i < kacanlar.length; i++) {
      kacanlar[i].s.destroy();
      kacanlar[i].golge.destroy();
    }
    kacanlar.length = 0;
  }
  function kurtarmaBasla() {
    kurtarmaSil();
    kurtarmaT = OYUN.zaman.t;
    var yer = [
      { x:237, y:481, tur:'er', gecikme:.13, boy:77, ilX:-140, ilY:143, yon:1 },
      { x:303, y:340, tur:'kadin', gecikme:.28, boy:71, ilX:71, ilY:126, yon:-1 }
    ];
    var paket = VARLIK.paketler.ayaz_cevre2;
    yer.forEach(function (k) {
      k.mesafe = Math.hypot(k.ilX,k.ilY);
      var tutsak = VARLIK.paketler.ayaz_tutsak;
      if (tutsak) {
        k.kareler = [];
        for (var j=0; j<16; j++) k.kareler.push(atlasKare(k.tur+'_yuru_'+j, 'ayaz_tutsak'));
        var durus=atlasKare(k.tur+'_dur', 'ayaz_tutsak');
        if (durus && k.kareler.every(Boolean)) {
          k.kareler.push(durus);
          k.yuruKare=16; k.yon=1; k.olcek=k.boy/durus.h;
        }
      }
      if (!k.yuruKare) {
        k.kareler = [0,1,2,3].map(function (i) {
          var ad = 'kurtulan_' + k.tur + '_' + i, kare = atlasKare(ad, 'ayaz_cevre2');
          if (kare) kare.ayak = (paket.bilgi && paket.bilgi[ad] && paket.bilgi[ad].ayak) || 0;
          return kare;
        });
        if (k.kareler.some(function (q) { return !q; })) {
          var k1 = atlasKare('tutsak_' + k.tur + '_1'), k2 = atlasKare('tutsak_' + k.tur + '_2');
          if (!k1 || !k2) return;
          k.kareler = [k1,k2,k2,k1];
        }
      }
      var s = k.s = new PIXI.Sprite(k.kareler[3].doku), golge = k.golge = new PIXI.Graphics();
      s.name = 'ayaz_kurtulan_' + k.tur;
      golge.name = s.name + '_golge';
      golge.beginFill(0x1a2c3c,.32).drawEllipse(0,0,k.boy*.20,k.boy*.065).endFill();
      s.visible = golge.visible = false;
      OYUN.katman.golge.addChild(golge); OYUN.katman.varlik.addChild(s);
      kacanlar.push(k);
    });
  }
  function kurtarmaGuncelle() {
    var sira = [0,1,2,1];
    for (var i = 0; i < kacanlar.length; i++) {
      var k = kacanlar[i], s = k.s, t = OYUN.zaman.t - kurtarmaT - k.gecikme;
      if (t < 0) continue;
      var cikis = gecis(t, .12, .12), kosu = gecis(t, .875, .635);
      var mesafe = 32 * cikis + k.mesafe * kosu;
      var no = k.yuruKare
        ? (kosu === 1 ? k.yuruKare : Math.floor((mesafe / 61 % 1) * k.yuruKare))
        : (kosu === 1 ? 3 : sira[Math.floor(mesafe / 12) % sira.length]);
      var kare = k.kareler[no], olcek = k.olcek || k.boy / kare.h;
      var x = k.x + 11 + cikis * 17 + kosu * k.ilX, y = k.y + cikis * 27 + kosu * k.ilY;
      if (s.texture !== kare.doku) s.texture = kare.doku;
      s.anchor.set(-kare.ox / kare.w, -kare.oy / kare.h); s.scale.set(olcek * k.yon, olcek);
      s.position.set(x, y - (!k.yuruKare && no === 1 ? .9 : 0));
      var ayak = kare.bilgi || kare;
      k.golge.position.set(x + (ayak.ayak || 0) * olcek * k.yon, y + 1 + (ayak.ayakY || 0) * olcek);
      s.alpha = k.golge.alpha = Math.min(1, t * 8);
      s.visible = k.golge.visible = true;
    }
  }
  function buzParcasi(y, x, n) {
    var r = rastgele(8017 + n * 81), l = 57 + r() * 13;
    var s = Math.sin(n % 2 ? .38 + r() * .26 : -.25 - r() * .24);
    var co = Math.sqrt(1 - s * s), omurga = [], ust = [], alt = [];
    var derinlik = [0, 10, 19, 28, 33, 27, 14, 0];
    function don(xx, yy) { return { x: xx * co - yy * s, y: xx * s + yy * co }; }
    for (var i = 0; i < derinlik.length; i++) {
      var u = i / (derinlik.length - 1), xx = (2 * u - 1) * l;
      var yy = (r() - .5) * 13, gen = derinlik[i];
      if (i === 3 || i === 4) yy *= .35;
      omurga.push(don(xx, yy));
      ust.push(don(xx + (r() - .5) * 10, yy - gen * (.66 + r() * .43)));
      alt.push(don(xx + (r() - .5) * 10, yy + gen * (.69 + r() * .46)));
    }
    var kenar = ust.concat(alt.slice().reverse()), cokgen = [];
    var dallar = [];
    for (i = 0; i < kenar.length; i++) cokgen.push(kenar[i].x, kenar[i].y);
    for (i = 1; i < 7; i++) {
      var k = i % 2 ? ust[i] : alt[i], o = omurga[i];
      var mx = o.x + (k.x - o.x) * .57 + (r() - .5) * 9;
      var my = o.y + (k.y - o.y) * .62;
      var ip = { x: k.x + (k.x-o.x)*.20 + (r()-.5)*14, y: k.y + (k.y-o.y) * .27 };
      dallar.push([o, { x:mx, y:my }, ip]);
    }
    return {
      x:x, y:y, t:-1, bitti:false, yakinDegdi:false,
      omurga:omurga, ust:ust, alt:alt, dallar:dallar, cokgen:cokgen,
      minX:Math.min.apply(null, kenar.map(function (p) { return p.x; })),
      maxX:Math.max.apply(null, kenar.map(function (p) { return p.x; })),
      minY:Math.min.apply(null, kenar.map(function (p) { return p.y; })),
      maxY:Math.max.apply(null, kenar.map(function (p) { return p.y; }))
    };
  }
  function buzSifirla() {
    sonBolge = null; kapi = null; kurtarildi = false; kurtarmaSil();
    kapiAn = 0;
    if (kapiG) { kapiG.visible = false; kapiG.clear(); }
    buzlar = [];
    if (buzG) {
      buzG.removeChildren().forEach(function (g) { g.destroy({ children:true }); });
      buzG.visible = false;
    }
    if (OYUN.bolum !== 3) { if (kar) kar.visible = false; return; }
    // Çatlaklar kıvrılan buz yatağına dağılır; ortadan ve iki kıyıdan temiz geçiş vardır.
    var konumlar = [[7455,-121], [7455,108], [7564,-167], [7529,42],
      [7660,-80], [7632,148], [7747,-159], [7784,76]];
    konumlar.forEach(function (d, i) { buzlar.push(buzParcasi(d[0], yolX(d[0]) + d[1], i)); });
    buzGorselKur();
    buzG.visible = false;
  }
  function buzIc(b, x, y) {
    x -= b.x; y -= b.y;
    if (x < b.minX || x > b.maxX || y < b.minY || y > b.maxY) return false;
    var p = b.cokgen, ic = false;
    for (var i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
      var ay = p[i+1], by = p[j+1];
      if ((ay > y) !== (by > y) && x < p[i] + (p[j] - p[i]) * (y - ay) / (by - ay)) ic = !ic;
    }
    return ic;
  }
  function buzDusmanTemas(b, d) {
    return d && !d.olu && !d.devMi && !(d.havaH > 6) &&
      !(d.tur === 'kircil_kurt' && d.durum === 'sicra') && buzIc(b, d.x, d.y);
  }
  function buzGuncelle(dt) {
    var p = window.OYUNCU;
    if (OYUN.bolum !== 3 || !p || !dt || !p.canli || buzlar.length === 0) return;
    var dusmanlar = window.DUSMAN ? DUSMAN.liste : [];
    for (var i = 0; i < buzlar.length; i++) {
      var b = buzlar[i];
      if (b.bitti || Math.abs(b.y - p.y) > 590) continue;
      var ustunde = buzIc(b, p.x, p.y);
      if (ustunde && !b.yakinDegdi) {
        b.yakinDegdi = true;
        OLAY.emit('ayazBuzCatlak', { x:b.x, y:b.y });
      }
      if (b.t < 0) {
        if (ustunde || dusmanlar.some(function (d) { return buzDusmanTemas(b, d); })) b.t = 0;
        continue;
      }
      b.t += dt;
      if (b.t < BUZ_KIRILMA_SURESI) continue;
      b.bitti = true;
      if (ustunde) p.hasarAl(16, { guc:110, aci:Math.PI / 2, kaynak:'ayaz_buz' });
      for (var j = dusmanlar.length - 1; j >= 0; j--) {
        var d = dusmanlar[j];
        if (buzDusmanTemas(b, d)) DUSMAN.hasarVer(d, 28, { guc:120, tur:'buz' });
      }
      OLAY.emit('ayazBuzKir', { x:b.x, y:b.y });
    }
  }
  function cizgi(g, noktalar, kalinlik, renk, alfa, dy) {
    dy = dy || 0;
    g.lineStyle(kalinlik, renk, alfa).moveTo(noktalar[0].x, noktalar[0].y + dy);
    for (var i = 1; i < noktalar.length; i++) g.lineTo(noktalar[i].x, noktalar[i].y + dy);
  }
  function buzCatlakCiz(g, b) {
    cizgi(g, b.omurga, 4.3, 0x203d50, .42, 1);
    cizgi(g, b.omurga, 1.1, 0xb4e0e9, .68);
    b.dallar.forEach(function (dal) {
      cizgi(g, dal, 2.4, 0x2f5264, .33, 1);
      cizgi(g, dal, .9, 0xabd4dd, .42);
    });
  }
  function buzUyariCiz(g, b) {
    g.lineStyle(0).beginFill(0x3a849d, .32).drawPolygon(b.cokgen).endFill();
    cizgi(g, b.ust, 2.1, 0xc2eff9, .90);
    cizgi(g, b.alt, 1.4, 0x72c7df, .85);
  }
  function buzYarilmaCiz(g, b) {
    // Altındaki dokuyu tamamen örtme: burada açılan su çukuru değil, dağılıp basılabilen buz tabakası.
    g.lineStyle(0).beginFill(0x18374a, .72).drawPolygon(b.cokgen).endFill();
    cizgi(g, b.omurga, 6, 0x193747, .77);
    cizgi(g, b.alt, 4.5, 0x2d6076, .83, -1.2);
    cizgi(g, b.ust, 5.4, 0x50839a, .78, 1.6);
    var r = rastgele(27119 + b.x * 61 + b.y);
    for (var i = 0; i < b.omurga.length - 1; i++) {
      var o = b.omurga[i], n = b.omurga[i+1], a = b.ust[i], h = b.alt[i+1];
      var u = .28 + r() * .41, v = .64 + r() * .24;
      g.lineStyle(.7, 0x87b3c5, .33 + r() * .24);
      g.beginFill(i % 2 ? 0x6795a7 : 0x4e7f98, .56 + r() * .2);
      g.drawPolygon([o.x,o.y, o.x + (a.x-o.x)*v,o.y + (a.y-o.y)*v,
        n.x + (h.x-n.x)*u,n.y + (h.y-n.y)*u, n.x,n.y]).endFill();
      var kenar = i % 2 ? b.ust : b.alt;
      cizgi(g, kenar.slice(i,i+2), 1.15 + r() * 1.5, i % 2 ? 0xd3f1f2 : 0x8ec4d3, .58 + r() * .29);
    }
    b.dallar.forEach(function (dal) { cizgi(g, dal.slice(1), 1, 0xaedfe9, .40); });
  }
  function buzGorselKur() {
    if (!buzG) {
      buzG = new PIXI.Container();
      buzG.name = 'ayaz_ince_buz'; OYUN.katman.leke.addChild(buzG);
    }
    buzlar.forEach(function (b) {
      var s = new PIXI.Container();
      s.position.set(b.x, b.y); buzG.addChild(s);
      var durgun = new PIXI.Graphics(), uyari = new PIXI.Graphics(), acik = new PIXI.Graphics();
      buzCatlakCiz(durgun, b); buzUyariCiz(uyari, b); buzYarilmaCiz(acik, b);
      s.addChild(durgun, uyari, acik);
      b.sprite = s;
      b.isiklar = b.dallar.map(function (dal, i) {
        var g = new PIXI.Graphics();
        cizgi(g, i % 2 ? b.omurga.slice(i, i + 3) : dal, 4.6, 0x143847, .78, .5);
        cizgi(g, i % 2 ? b.omurga.slice(i, i + 3) : dal, 2.5, 0xcaf7ff, .96);
        s.addChild(g);
        return g;
      });
      // Çatlak çizgilerini bölüme girişte hazırla; buz ilk görünürken aynı kareye yığılmasın.
      s.children.forEach(function (g) { g.geometry.updateBatches(); });
    });
  }
  function buzCiz() {
    var y = OYUN.kamera.y;
    if (OYUN.bolum !== 3 || y < 6750 || y > 8140) { if (buzG) buzG.visible = false; return; }
    if (!buzG || buzG.children.length === 0) buzGorselKur();
    buzG.visible = true;
    for (var i = 0; i < buzlar.length; i++) {
      var b = buzlar[i], s = b.sprite;
      s.visible = OYUN.gorusteMi(b.x, b.y, 110);
      if (!s.visible) continue;
      var t = b.bitti || b.t < 0 ? 0 : b.t / BUZ_KIRILMA_SURESI;
      var aktif = t > 0 && !b.bitti;
      s.children[0].visible = !b.bitti;
      s.children[1].visible = aktif;
      s.children[1].alpha = .28 + t * .70;
      s.children[2].visible = b.bitti;
      for (var j = 0; j < b.isiklar.length; j++) {
        var isik = b.isiklar[j];
        isik.visible = aktif && t > j * .142;
        isik.alpha = Math.min(1, .58 + (t - j * .142) * 2.6);
      }
    }
  }

  function surKanatlari(g) {
    if (surlar) return;
    // Çok geniş görünümde surun uçları harita sınırında kesilmek yerine yamaca dayanır.
    var yamac = stilKare('art_ayaz_yamac');
    if (yamac) [-1, 1].forEach(function (yon) {
      var s = new PIXI.Sprite(yamac.doku);
      var olcek = yon < 0 ? .69 : .64;
      s.anchor.set(-yamac.ox / yamac.w, -yamac.oy / yamac.h);
      s.scale.set(yon * olcek, olcek);
      s.position.set(yon * (KAPI_X + 81), 6);
      g.addChild(s);
    });
    surlar = ['sur_sol', 'sur_sag'].map(function (ad, i) {
      var k = stilKare(ad, 'ayaz_cevre2');
      var yedek = k ? null : dekorDoku('ayaz_duvar');
      var s = new PIXI.Sprite(k ? k.doku : yedek.tex);
      s.anchor.set(0, k ? -k.oy / k.h : yedek.ay);
      s.width = KAPI_X - 104;
      s.height = k ? 169 : 148;
      s.position.set(i ? 104 : -KAPI_X, -2);
      if (!k && i) { s.scale.x *= -1; s.x += KAPI_X - 104; }
      g.addChildAt(s, 0);
      return s;
    });
  }
  function kapiDokuParcalari(g, k) {
    if (kapiDetay) return kapiDetay;
    var t = k.doku, f = t.frame, gen = Math.round(f.width * .23);
    var ornek = function (x, en) {
      return new PIXI.Texture(t.baseTexture, new PIXI.Rectangle(f.x + x, f.y, en, f.height));
    };
    var esikSol = new PIXI.Sprite(ornek(0, gen)), esikSag = new PIXI.Sprite(ornek(f.width - gen, gen));
    var sol = new PIXI.Sprite(ornek(gen, Math.ceil((f.width - gen * 2) / 2)));
    var sag = new PIXI.Sprite(ornek(gen + sol.texture.width, f.width - gen * 2 - sol.texture.width));
    var carp = 268 / k.w;
    esikSol.x = -134; esikSag.x = 134 - gen * carp;
    [esikSol, esikSag, sol, sag].forEach(function (s) {
      s.anchor.set(0, -.0 - k.oy / k.h);
      s.scale.set(carp); g.addChild(s);
    });
    // Sağ kanat, sağ ayağın etrafında devrilsin; kapalı duruşu kaldırmadan sabitle.
    sag.anchor.x = 1;
    kapiDetay = { esikSol:esikSol, esikSag:esikSag, sol:sol, sag:sag,
      solX:-134 + gen * carp, sagX:sag.width };
    return kapiDetay;
  }
  function kapiGuncelle(dt) {
    if (!kapi || !kapiDetay || !kapi.acik || kapiAn >= 1) return;
    kapiAn = Math.min(1, kapiAn + Math.max(0, dt) * 1.9);
    var d = kapiDetay, devrilme = 1 - Math.pow(1 - kapiAn, 2.8), dusus = kapiAn * kapiAn;
    d.sol.rotation = -.88 * devrilme; d.sag.rotation = .96 * devrilme;
    d.sol.y = 42 * dusus; d.sag.y = 36 * dusus;
    d.sol.x = d.solX - 24 * devrilme; d.sag.x = d.sagX + 27 * devrilme;
    d.sol.alpha = d.sag.alpha = 1 - gecis(kapiAn, .70, .30);
    d.sol.visible = d.sag.visible = kapiAn < 1;
  }
  function kapiCiz() {
    if (!kapiG) { kapiG = new PIXI.Graphics(); kapiG.name = 'ayaz_zincir_kapi'; OYUN.katman.varlik.addChild(kapiG); }
    kapiG.position.set(KAPI_X, KAPI_Y); kapiG.clear(); kapiG.visible = true;
    surKanatlari(kapiG);
    var kapali = !kapi.acik, art = stilKare('art_ayaz_kapi');
    if (art) {
      var ayrik = kapiDokuParcalari(kapiG, art);
      ayrik.esikSol.visible = ayrik.esikSag.visible = true;
      ayrik.sol.visible = ayrik.sag.visible = true;
      ayrik.sol.rotation = ayrik.sag.rotation = 0;
      ayrik.sol.y = ayrik.sag.y = 0;
      ayrik.sol.x = ayrik.solX; ayrik.sag.x = ayrik.sagX;
      ayrik.sol.alpha = ayrik.sag.alpha = 1;
      kapiAn = 0; kapiGuncelle(0);
      return;
    }
    kapiG.lineStyle(3,0x263745,1);
    kapiG.beginFill(0x638297); kapiG.drawPolygon([-124,4,-143,-13,-139,-118,-115,-133,-96,-113,-96,-7]);
    kapiG.drawPolygon([124,4,143,-13,139,-118,115,-133,96,-113,96,-7]); kapiG.endFill();
    kapiG.lineStyle(0); kapiG.beginFill(0xbbd6dd);
    kapiG.drawPolygon([-139,-119,-115,-134,-97,-114,-117,-119,-134,-110]);
    kapiG.drawPolygon([139,-119,115,-134,97,-114,117,-119,134,-110]); kapiG.endFill();
    if (kapali) {
      kapiG.lineStyle(5,0x2c4255,1);
      for (var x=-91;x<=91;x+=14) {kapiG.moveTo(x,-92);kapiG.lineTo(x,-12);}
      kapiG.lineStyle(5,0x59758a,1);kapiG.moveTo(-96,-90);kapiG.lineTo(96,-90);
      kapiG.moveTo(-96,-34);kapiG.lineTo(96,-34);
      kapiG.lineStyle(2,0xffbd7d,1);
      for (var i=0;i<11;i++) kapiG.drawEllipse(-64+i*12,-51+Math.sin(i*Math.PI/10)*19,6.2,3.6);
      kapiG.beginFill(0x7d4c35);kapiG.drawRoundedRect(-7,-34,14,13,2);kapiG.endFill();
    } else {
      kapiG.lineStyle(4,0x354d5b,1);
      kapiG.moveTo(-94,-60);kapiG.lineTo(-46,-38);kapiG.moveTo(94,-61);kapiG.lineTo(51,-37);
    }
  }
  function kapiKur(engeller) {
    var sol = KAPI_X - KAPI_YARI_GECIS, sag = KAPI_X + KAPI_YARI_GECIS;
    var engel = { x1:sol-2, x2:sag+2, y1:KAPI_Y-35, y2:KAPI_Y+8, t:'ayaz_kapi', kapali:false };
    kapi = { can:30, acik:false, engel:engel };
    var sur = [
      engel,
      { x1:0, x2:sol, y1:KAPI_Y-37, y2:KAPI_Y+8, t:'ayaz_sur', kapali:false },
      { x1:sag, x2:W, y1:KAPI_Y-37, y2:KAPI_Y+8, t:'ayaz_sur', kapali:false }
    ];
    engeller.push.apply(engeller, sur);
    kapiCiz();
    return sur;
  }
  function kapiHedef(x, y) {
    if (!kapi || kapi.acik || OYUN.bolum !== 3 || Math.abs(y - KAPI_Y) > 395) return null;
    return { x:KAPI_X, y:KAPI_Y, mesafe:Math.hypot(x - KAPI_X, y - KAPI_Y) };
  }
  function kapiIpucu() {
    var p = window.OYUNCU;
    if (p && p.canli && window.ARAYUZ && kapi && !kapi.acik &&
        Math.abs(p.x - KAPI_X) < 126 && Math.abs(p.y - KAPI_Y) < 122 && !kapi.ipucu) {
      kapi.ipucu = true;
      ARAYUZ.ipucu('ayazKapi');
    }
  }
  function kapiVur(x,y,r,hasar) {
    if (!kapi || kapi.acik || !(hasar>0) || Math.hypot(x-KAPI_X,y-KAPI_Y)>r+42) return 0;
    kapi.can-=hasar;
    if(kapi.can>0){OLAY.emit('blok',{x:KAPI_X,y:KAPI_Y-44,ayazKapi:true});return -1;}
    kapi.acik=kapi.engel.kapali=true; kapiCiz();
    OLAY.emit('kalkanKir',{x:KAPI_X,y:KAPI_Y-44});
    OLAY.emit('ayazBolge',{ad:'Asma kapı açıldı',kapi:true}); return 1;
  }
  OLAY.on('devOldu', function (v) {
    if (OYUN.bolum !== 3 || !v || v.bolum !== 3) return;
    kurtarildi = true;
    kurtarmaBasla();
    if (kuleAlev) kuleAlev.guc = .38;
    OLAY.emit('ayazBolge', { ad: 'Tutsaklar kurtarıldı' });
  });
  window.AYAZ = {
    kuleIsigi: function () { return kuleAlev; },
    kurtarildi: function () { return kurtarildi; }, yolX: yolX, yolYari: yolYari, bolge: bolge, stilKare: stilKare, zeminAdimlari: zeminAdimlari, dekorDoku: dekorDoku, yerlesim: yerlesim, kapiKur:kapiKur, kapiVur:kapiVur, kapiHedef:kapiHedef };
  OYUN.sistem('ayaz_cevre', { baslat: buzSifirla, sifirla: buzSifirla, guncelle: buzGuncelle,
    herKare: function (dt) {
      karGuncelle(dt); buzCiz();
      if (kapiG) kapiG.visible = OYUN.bolum === 3 && !!kapi && OYUN.gorusteMi(KAPI_X, KAPI_Y, 420);
      if (OYUN.durum === 'oyun') { kapiGuncelle(dt); kapiIpucu(); if (kurtarildi) kurtarmaGuncelle(); }
      if (kapiG) kapiG.visible = !!kapi && OYUN.bolum === 3 && OYUN.gorusteMi(KAPI_X, KAPI_Y, 665);
    } });
})();

