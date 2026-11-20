/* Ayaz Hisarı: Kırçıl Kurt, dünyaya basan pençeler ve kar izleri. */
(function () {
  'use strict';

  var tur = 'kircil_kurt';
  var ayar = {
    can: 53, hiz: 198, r: 18, kutle: .74, sersem: .4, hazir: .55, ara: 1.48,
    menzil: 160, hasar: 13, sicraHiz: 530, sicraSure: .34, temasPayi: 10
  };
  var gizliAlfa = .16, izHavuzu = [], kabin, uyari, izSirasi = 0;
  var kesitler = [0, .20, .40, .60, .77, .90, 1];
  var kesitBukum = kesitler.map(function (t) { return Math.sin(t * Math.PI); });
  var kesitEn = kesitler.map(function (t) { return .79 + .21 * Math.sin((1 - t) * Math.PI * .50); });
  var yavasAdim = [.25, .50, .75, 0], kosuAdim = [0, .51, .50, .01];
  var cizim = {
    on: {
      govde: [1.0, -34.0, 90.39, 0.5191, 0.4958, 0.8841],
      bas: [-29.202, -18.261, 46.92, 0.621, 0.5405, 0.8841],
      kuyruk: [32.686, -55.657, 48.3, 0.1989, 0.324, 0.8841],
      ileri: [-.83, .56], yan: [.56, .83],
      bacaklar: [
        [-21, -36, 19, -11], [21, -39, -17, -11],
        [-9, -35, 22, 12], [29, -37, -20, 12]
      ]
    },
    arka: {
      govde: [-1.0, -34.0, 90.39, 0.4809, 0.5557, 0.8841],
      bas: [29.202, -56.408, 46.92, 0.379, 0.6129, 0.8841],
      kuyruk: [-32.686, -15.636, 48.3, 0.8011, 0.1841, 0.8841],
      ileri: [.83, -.56], yan: [.56, .83],
      bacaklar: [
        [22, -38, 19, -11], [-24, -32, -17, -11],
        [24, -34, 22, 11], [-18, -26, -20, 15]
      ]
    },
    duzOn: {
      govde: [0.0, -34.0, 43.56, 0.5, 0.477, 0.7879],
      bas: [0.0, -13.002, 34.32, 0.5, 0.3762, 0.7879],
      kuyruk: [0.0, -60.416, 25.74, 0.3333, 0.5204, 0.7879],
      ileri: [0, .86], yan: [1, 0],
      bacaklar: [
        [-17, -31, 16, -18], [-12, -52, -19, -14],
        [17, -31, 16, 18], [12, -52, -19, 14]
      ]
    },
    duzArka: {
      govde: [0.0, -34.0, 43.56, 0.5, 0.545, 0.7879],
      bas: [0.0, -60.684, 34.98, 0.5094, 0.7139, 0.7879],
      kuyruk: [-0.0, -10.392, 25.74, 0.6667, 0.1479, 0.7879],
      ileri: [0, -.86], yan: [1, 0],
      bacaklar: [
        [-18, -51, 20, -18], [-12, -33, -18, -16],
        [18, -51, 20, 18], [12, -33, -18, 16]
      ]
    }
  };

  var varliklar;
  function doku(ad) {
    var paket = VARLIK.paketler.ayaz_kurt;
    if (!paket || paket.tekil[ad] === undefined) return null;
    var k = VARLIK.kare('ayaz_kurt', ad);
    if (!k || !k.doku || !k.doku.valid) return null;
    if (paket.cizgi && paket.cizgi[ad]) k.doku.kurtCizgi = paket.cizgi[ad];
    return k.doku;
  }
  function resimler() {
    if (varliklar) return varliklar;
    var v = {
      on: {
        govde: doku('govde_on'), bas: doku('bas_on'), kuyruk: doku('kuyruk_on'),
        onBacak: doku('bacak_on'), arkaBacak: doku('bacak_art')
      },
      arka: {
        govde: doku('govde_arka'), bas: doku('bas_arka'), kuyruk: doku('kuyruk_arka'),
        onBacak: doku('bacak_arka_on'), arkaBacak: doku('bacak_arka_art')
      }
    };
    if (!Object.keys(v).every(function (bakis) {
      return Object.keys(v[bakis]).every(function (ad) { return v[bakis][ad]; });
    })) return null;
    v.duzOn = {
      govde: doku('govde_duz_on'), bas: doku('bas_duz_on'), kuyruk: doku('kuyruk_duz_on'),
      onBacak: v.on.onBacak, arkaBacak: v.on.arkaBacak
    };
    v.duzArka = {
      govde: doku('govde_duz_arka'), bas: doku('bas_duz_arka'), kuyruk: doku('kuyruk_duz_arka'),
      onBacak: v.arka.onBacak, arkaBacak: v.arka.arkaBacak
    };
    v.oluOn = doku('olu_on'); v.oluArka = doku('olu_arka');
    varliklar = v;
    return varliklar;
  }
  var uv = new Float32Array(kesitler.length * 4);
  var ucgen = new Uint16Array((kesitler.length - 1) * 6);
  kesitler.forEach(function (y, i) {
    uv.set([0, y, 1, y], i * 4);
    if (i < kesitler.length - 1) {
      var a = i * 2;
      ucgen.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], i * 6);
    }
  });
  function bacak() {
    var m = new PIXI.SimpleMesh(PIXI.Texture.EMPTY, new Float32Array(uv.length), uv, ucgen, PIXI.DRAW_MODES.TRIANGLES);
    m.autoUpdate = false;
    m.tint = 0xffffff;
    return m;
  }
  function spriteYap() {
    var s = new PIXI.Container();
    s.boy = 76;
    s.yerTutucu = true;
    s.anim = 'dur';
    s.yon = 6;
    s.kurtTemas = { x: 0, y: 0 };
    s.kurtYedek = new PIXI.Sprite(PIXI.Texture.EMPTY);
    s.kurtYedek.visible = false;
    s.kurtCeset = new PIXI.Sprite(PIXI.Texture.EMPTY);
    s.kurtCeset.anchor.set(.5, .65);
    s.kurtCeset.visible = false;
    s.kurtGovde = new PIXI.Sprite(PIXI.Texture.EMPTY);
    s.kurtBas = new PIXI.Sprite(PIXI.Texture.EMPTY);
    s.kurtKuyruk = new PIXI.Sprite(PIXI.Texture.EMPTY);
    s.kurtBacaklar = [bacak(), bacak(), bacak(), bacak()];
    s.kurtRig = new PIXI.Container();
    s.kurtOnce = new PIXI.Container();
    s.kurtOnce.visible = false;
    s.kurtOnce.addChild(new PIXI.Sprite(), new PIXI.Sprite(), new PIXI.Sprite());
    // Uzak ayaklar önce, yakın ayaklar gövdenin önünde. Üst kökler iki katmanda da kürkün içine oturur.
    s.kurtRig.addChild(s.kurtKuyruk, s.kurtBacaklar[0], s.kurtBacaklar[1], s.kurtBacaklar[2],
      s.kurtBacaklar[3], s.kurtGovde, s.kurtBas);
    s.addChild(s.kurtYedek, s.kurtOnce, s.kurtRig, s.kurtCeset);
    s.g = s.kurtGovde;
    s.oynat = function (anim, yon) { s.anim = anim; s.yon = yon; };
    s.renk = function (renk) {
      s.renkSon = renk;
      s.kurtBas.tint = s.kurtGovde.tint = s.kurtKuyruk.tint = s.kurtYedek.tint = renk;
    };
    return s;
  }
  function durum(d) {
    if (d.kurt && d.kurt.id === d.id) return d.kurt;
    d.kurt = {
      id: d.id, zaman: 0, x: d.x, y: d.y, aci: d.aci, faz: (d.id * .173) % 1,
      alfa: gizliAlfa, arka: Math.sin(d.aci) < -.16, yon: Math.cos(d.aci) < 0 ? -1 : 1,
      tekrarGizlen: 0, adimBoyu: 54, tempo: 0, kuyrukFazi: d.id * .92,
      ayaklar: [null, null, null, null], yol: 0, kalan: 0, kilitli: false
    };
    d.kurtGizli = true;
    return d.kurt;
  }
  function sinirla(k, alt, ust) { return Math.max(alt, Math.min(ust, k)); }
  function karis(a, b, u) { return a + (b - a) * u; }
  function yumusak(u) { u = sinirla(u, 0, 1); return u * u * (3 - 2 * u); }
  function don(d, x, y, dt) {
    if (Math.abs(x) + Math.abs(y) < 1e-4) return;
    var hedef = Math.atan2(y, x);
    d.aci += sinirla(OYUN.aciFark(d.aci, hedef), -dt * 11, dt * 11);
  }
  function icMesafeKare(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay, payda = dx * dx + dy * dy;
    var t = payda ? sinirla(((px - ax) * dx + (py - ay) * dy) / payda, 0, 1) : 0;
    var ex = px - ax - t * dx, ey = py - ay - t * dy;
    return ex * ex + ey * ey;
  }

  // Ayak çarpışmasındaki genişlik ve derinlikle en yakın dikdörtgenin girişini bul.
  function engeleKadar(x, y, dx, dy, boy, r) {
    var liste = window.BOLUM && BOLUM.engeller, ry = r * .55;
    if (!liste) return boy;
    for (var i = 0; i < liste.length; i++) {
      var e = liste[i];
      if (e.kapali) continue;
      var x1 = e.x1 - r, x2 = e.x2 + r, y1 = e.y1 - ry, y2 = e.y2 + ry;
      if (x > x1 && x < x2 && y > y1 && y < y2) continue;
      var giris = 0, cikis = boy;
      if (Math.abs(dx) < 1e-6) { if (x <= x1 || x >= x2) continue; }
      else {
        var a = (x1 - x) / dx, b = (x2 - x) / dx;
        giris = Math.max(giris, Math.min(a, b)); cikis = Math.min(cikis, Math.max(a, b));
      }
      if (Math.abs(dy) < 1e-6) { if (y <= y1 || y >= y2) continue; }
      else {
        var c = (y1 - y) / dy, d = (y2 - y) / dy;
        giris = Math.max(giris, Math.min(c, d)); cikis = Math.min(cikis, Math.max(c, d));
      }
      if (cikis > giris + 1e-5 && giris < boy) boy = Math.max(0, giris - .30);
    }
    return boy;
  }
  // Gösterilen sıçrama çizgisi ve isabet süpürmesi aynı ekseni kullanır.
  function sicramaBoyu(d, aci, boy) {
    var sinir = DUSMAN.alan(d), dx = Math.cos(aci), dy = Math.sin(aci);
    if (dx > 1e-5) boy = Math.min(boy, (sinir.sag - d.x) / dx);
    else if (dx < -1e-5) boy = Math.min(boy, (sinir.sol - d.x) / dx);
    if (dy > 1e-5) boy = Math.min(boy, (sinir.alt - d.y) / dy);
    else if (dy < -1e-5) boy = Math.min(boy, (sinir.ust - d.y) / dy);
    return engeleKadar(d.x, d.y, dx, dy, Math.max(0, boy), d.r * .80);
  }
  function dislerUlasir(d, p) {
    var dx = p.x - d.x, dy = p.y - d.y, boy = Math.hypot(dx, dy);
    return boy < .01 || engeleKadar(d.x, d.y, dx / boy, dy / boy, boy, 1) >= boy - .01;
  }
  function yonKilitle(d, p, k, a) {
    d.kilitAci = Math.atan2(p.y - d.y, p.x - d.x);
    k.yol = sicramaBoyu(d, d.kilitAci, a.sicraHiz * a.sicraSure);
    d.hx = d.x + Math.cos(d.kilitAci) * k.yol; d.hy = d.y + Math.sin(d.kilitAci) * k.yol;
  }
  function toparla(d, a, sure) {
    d.durum = 'toparlan';
    d.t = sure;
    d.hop = 0;
    d.bekle = a.ara + (d.id % 5) * .093;
  }
  function yuru(d, dx, dy, hiz, dt) {
    var mes = Math.hypot(dx, dy);
    if (mes > 1) {
      d.x += dx / mes * hiz * dt; d.y += dy / mes * hiz * dt;
      don(d, dx, dy, dt);
    }
  }
  function davranis(d, dt, p, a) {
    var k = durum(d), dx = p.x - d.x, dy = p.y - d.y, mes = Math.hypot(dx, dy);
    k.zaman += dt;
    if (d.durum === 'toparlan') {
      d.t -= dt;
      if (d.t <= 0) d.durum = 'yaklas';
      return;
    }
    if (d.durum === 'sicra') {
      var adim = Math.min(k.kalan, a.sicraHiz * Math.min(dt, Math.max(0, d.t)));
      var ox = d.x, oy = d.y;
      d.x += Math.cos(d.kilitAci) * adim;
      d.y += Math.sin(d.kilitAci) * adim;
      k.kalan -= adim;
      d.t -= dt;
      var u = sinirla(1 - d.t / (k.sicraSure || a.sicraSure), 0, 1);
      d.hop = -25 * Math.sin(Math.PI * u);
      var pay = d.r + p.r + a.temasPayi;
      if (!d.vurdu && icMesafeKare(p.x, p.y, ox, oy, d.x, d.y) < pay * pay && dislerUlasir(d, p)) {
        d.vurdu = true;
        p.hasarAl(a.hasar, { aci: d.kilitAci, guc: 180, kaynak: d });
      }
      if (d.t <= 0 || k.kalan <= .001) { k.inis = true; toparla(d, a, .43); }
      return;
    }
    if (d.durum === 'hazirlik') {
      d.t -= dt;
      if (!k.kilitli) {
        yonKilitle(d, p, k, a);
        if (d.t <= a.hazir * .58) k.kilitli = true;
      }
      don(d, Math.cos(d.kilitAci), Math.sin(d.kilitAci), dt);
      if (d.t <= 0) {
        if (k.yol < 24) { toparla(d, a, .40); return; }
        d.aci = d.kilitAci; d.durum = 'sicra'; d.t = Math.min(a.sicraSure, k.yol / a.sicraHiz);
        k.sicraSure = d.t; k.kalan = k.yol; d.vurdu = false;
      }
      return;
    }

    d.bekle = Math.max(0, d.bekle - dt);
    // İlk girişte izleri görmeye zaman verilir. Yaklaşan barbar kurdu erken ortaya çıkarır.
    if (mes < 119 || d.parla > 0) k.tekrarGizlen = 0;
    else if (mes > 270) k.tekrarGizlen += dt;
    var gorunebilir = k.zaman > 1.40 || mes < 119 || d.parla > 0;
    if (gorunebilir && mes < a.menzil && d.bekle === 0) {
      var list = DUSMAN.liste, tek = true;
      for (var i = 0; i < list.length && tek; i++) {
        var o = list[i];
        if (o !== d && o.tur === tur && !o.olu && (o.durum === 'hazirlik' || o.durum === 'sicra')) tek = false;
      }
      if (tek) {
        yonKilitle(d, p, k, a);
        if (k.yol < 24) {
          // Önü kapanmışsa boşuna çömelmez; kayanın veya surun yanına geçer.
          yuru(d, dx * .42 - dy * d.yanYon, dy * .42 + dx * d.yanYon, d.hiz * .87, dt);
          return;
        }
        d.durum = 'hazirlik'; d.t = a.hazir;
        k.kilitli = false;
        OLAY.emit('ayazKurtHazir', { x: d.x, y: d.y });
        return;
      }
    }

    var taban = mes > 157 ? 1 : mes < 101 ? -.33 : .13;
    var yan = d.yanYon * (mes > 250 ? .37 : .64);
    // Başka kurt atak yaparken yanlarda yer açar, arka arkaya birbirlerinin üstüne yığılmazlar.
    if (mes > 165 || mes < 108 || d.bekle > .18) {
      yuru(d, dx * taban - dy * yan, dy * taban + dx * yan, d.hiz * (gorunebilir ? 1 : .85), dt);
    } else don(d, dx, dy, dt);
  }

  function resimYerlestir(s, meta, tex) {
    if (s.texture !== tex) { s.texture = tex; s.anchor.set(meta[3], meta[4]); }
    var oran = meta[2] / tex.orig.width;
    s.scale.set(oran, oran * (meta[5] || 1));
    s.position.set(meta[0], meta[1]);
  }
  function bacakCiz(m, tex, x, y, ayakX, ayakY, bukum, en, ton) {
    if (m.texture !== tex) m.texture = tex;
    m.tint = ton;
    var v = m.vertices, tabanEgimi = sinirla((ayakX - x) * -.16, -4, 4);
    for (var i = 0; i < kesitler.length; i++) {
      var t = kesitler[i], ortaX = karis(x, ayakX, t) + kesitBukum[i] * bukum;
      var ortaY = karis(y, ayakY, t), yari = en * kesitEn[i];
      // Son kesit yatay kalır. Pençenin tabanı anlık yürüme açısına göre havalanmaz.
      var egim = (1 - t) * tabanEgimi;
      var j = i * 4;
      var merkez = tex.kurtCizgi ? tex.kurtCizgi[i] : .5;
      ortaX -= (merkez - .5) * yari * (i < kesitler.length - 1 ? 1.65 : 2);
      v[j] = ortaX - yari; v[j + 1] = ortaY - egim;
      v[j + 2] = ortaX + yari; v[j + 3] = ortaY + egim;
    }
    m.geometry.getBuffer('aVertexPosition').update();
  }
  function bakisDegistir(s, k) {
    var eski = s.kurtOnce, b = eski.children;
    function anlik(kaynak, hedef) {
      hedef.texture = kaynak.texture;
      hedef.position.copyFrom(kaynak.position); hedef.anchor.copyFrom(kaynak.anchor);
      hedef.scale.copyFrom(kaynak.scale); hedef.rotation = kaynak.rotation;
      hedef.tint = kaynak.tint;
    }
    anlik(s.kurtKuyruk, b[0]); anlik(s.kurtGovde, b[1]); anlik(s.kurtBas, b[2]);
    eski.scale.copyFrom(s.kurtRig.scale);
    eski.visible = true; eski.alpha = .78;
    k.bakisBas = OYUN.zaman.t;
  }
  function eskiResim(s, k) {
    var paket = VARLIK.paketler.ayaz;
    var ad = k.arka ? 'kircil_kurt_arka' : s.anim === 'yuru' ? 'kircil_kurt_yuru' : 'kircil_kurt_dur';
    if (!paket || paket.tekil[ad] === undefined) return;
    var kare = VARLIK.kare('ayaz', ad), g = s.kurtYedek;
    g.texture = kare.doku;
    g.anchor.set(-kare.ox / kare.w, -kare.oy / kare.h);
    var mag = 73 / kare.h;
    g.scale.set((k.arka ? k.yon : -k.yon) * mag, mag);
    s.kurtRig.visible = false; s.kurtOnce.visible = false; s.kurtCeset.visible = false;
    g.visible = true; s.g = g; s.temas = null;
  }
  function izKur() {
    if (kabin) return;
    var c = document.createElement('canvas'); c.width = c.height = 36;
    var g = c.getContext('2d');
    // Geniş taban ve önde dört küçük parmak: kar üzerinde insan çizmesiyle karışmaz.
    function iz(x, y, w, h, angle) {
      g.fillStyle = '#bacee3';
      g.beginPath(); g.ellipse(x + 1, y + 1.3, w + .9, h + .8, angle, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#293f55';
      g.beginPath(); g.ellipse(x, y, w, h, angle, 0, Math.PI * 2); g.fill();
    }
    iz(14, 18, 5.6, 4.4, 0);
    iz(19, 11, 2.3, 2.7, .32); iz(23, 15, 2.8, 2.4, .12);
    iz(24, 20, 2.7, 2.5, -.14); iz(20, 24, 2.4, 2.8, -.40);
    var tex = PIXI.Texture.from(c);
    kabin = new PIXI.ParticleContainer(96, { position: true, rotation: true, alpha: true, vertices: true });
    kabin.name = 'ayaz_kurt_izleri'; OYUN.katman.leke.addChild(kabin);
    uyari = new PIXI.Graphics(); uyari.name = 'ayaz_kurt_sicrama'; OYUN.katman.leke.addChild(uyari);
    for (var i = 0; i < 96; i++) {
      var s = new PIXI.Sprite(tex); s.anchor.set(.5); s.alpha = 0; kabin.addChild(s);
      izHavuzu.push({ s: s, bitis: 0, sure: 0, alfa: 0 });
    }
  }
  function izYaz(x, y, aci, buyuk, gizli) {
    var r = izHavuzu[izSirasi];
    izSirasi = (izSirasi + 1) % izHavuzu.length;
    r.s.position.set(x, y); r.s.rotation = aci; r.s.scale.set(buyuk ? .75 : .57);
    r.sure = gizli ? 1.65 : .84; r.bitis = OYUN.zaman.t + r.sure;
    r.alfa = gizli ? .78 : .46; r.s.alpha = r.alfa;
  }
  function ayakBul(d, k, i, meta, aynala, kip, dt) {
    var on = i % 2 === 0, poz = meta.bacaklar[i], tw = k.kareX, th = k.kareY;
    var baseX = (meta.ileri[0] * poz[2] + meta.yan[0] * poz[3]) * aynala;
    var baseY = meta.ileri[1] * poz[2] + meta.yan[1] * poz[3] + 2;
    var ax = d.x + baseX, ay = d.y + baseY;
    var f = k.ayaklar[i];
    if (!f) f = k.ayaklar[i] = { x: ax, y: ay, basX: ax, basY: ay, z: 0, havada: false, sabit: false, kip: kip };
    var yeniKip = kip !== f.kip;
    if (yeniKip) {
      f.kip = kip;
      f.basX = f.x;
      f.basY = f.y;
    }
    if (kip === 'yuru') {
      var faz = (k.faz + karis(yavasAdim[i], kosuAdim[i], k.tempo)) % 1;
      var taban = karis(.64, .52, k.tempo), yol = k.adimBoyu * taban;
      var adimX = tw * yol, adimY = th * yol;
      if (faz <= taban) {
        if (f.havada || !f.sabit || Math.hypot(f.x - ax, f.y - ay) > 46) {
          var merkez = .5 - faz / taban;
          f.x = ax + merkez * adimX; f.y = ay + merkez * adimY;
          if (f.havada && (on || k.alfa < .45)) izYaz(f.x, f.y, k.aci, on, k.alfa < .45);
        }
        f.havada = false; f.sabit = true; f.z = 0;
      } else {
        if (!f.havada || !f.sabit) {
          f.basX = f.sabit ? f.x : ax - adimX * .5; f.basY = f.sabit ? f.y : ay - adimY * .5;
        }
        var u = (faz - taban) / (1 - taban);
        var guc = yumusak(u);
        f.x = karis(f.basX, ax + adimX * (.50 + (.48 * (1 - u))), guc);
        f.y = karis(f.basY, ay + adimY * (.50 + (.48 * (1 - u))), guc);
        f.z = Math.sin(Math.PI * u) * (on ? 13 : 11) * k.hareket;
        f.havada = true; f.sabit = true;
      }
    } else if (kip === 'dur' || kip === 'sersem') {
      // Durunca basan pençe yerinde kalır, havadaki pençe kendi yerinde tabana döner.
      if (Math.hypot(f.x - ax, f.y - ay) > (kip === 'sersem' ? 35 : 47)) { f.x = ax; f.y = ay; }
      f.z *= Math.exp(-dt * 20);
      f.havada = f.z > .3;
      if (!f.havada) { f.z = 0; f.sabit = true; }
    } else if (kip === 'hazir') {
      // Avını beklerken ön iki pençe toprağı tutar. Arka ayaklar art arda gövdenin altına alınır.
      var u = sinirla((1 - d.t / ayar.hazir - (i < 2 ? .10 : .22)) * 3.7, 0, 1);
      if (on) {
        // Temas noktası sabit. Harita veya itişme kurdu taşıdığında bacağı doğal erişiminde tut.
        var tasX = f.basX - ax, tasY = f.basY - ay, uzak = Math.hypot(tasX, tasY);
        var azalt = uzak > 29 ? 29 / uzak : 1;
        f.x = ax + tasX * azalt;
        f.y = ay + sinirla(tasY * azalt, -8, 15);
        if (azalt !== 1 || f.y !== f.basY) { f.basX = f.x; f.basY = f.y; }
        f.z = Math.min(f.z, 5) * Math.exp(-dt * 19);
      } else {
        f.x = karis(f.basX, ax + k.yuzX * 8, yumusak(u));
        f.y = karis(f.basY, ay + k.yuzY * 8, yumusak(u));
        f.z = Math.sin(Math.PI * u) * 5.2;
      }
      f.havada = f.z > .3; f.sabit = !f.havada;
    } else if (kip === 'sicra') {
      var u2 = sinirla(1 - d.t / (k.sicraSure || ayar.sicraSure), 0, 1);
      var uzat = on ? karis(29, 11, u2) : karis(-23, 5, u2);
      f.x = ax + k.yuzX * uzat; f.y = ay + k.yuzY * uzat;
      f.z = (on ? 12 : 17) * Math.sin(Math.PI * u2) - (d.hop || 0);
      f.havada = true; f.sabit = false;
    } else if (kip === 'inis') {
      if (yeniKip) { f.x = ax + k.yuzX * (on ? 4 : 1); f.y = ay + k.yuzY * (on ? 4 : 1); }
      f.z = 0; f.havada = false; f.sabit = true;
    } else if (kip === 'ol') {
      var agirlik = 1 - Math.exp(-dt * 14);
      f.x = karis(f.x, ax + (i % 2 ? -7 : 13) * aynala, agirlik);
      f.y = karis(f.y, ay + (i < 2 ? 3 : 13), agirlik);
      f.z = karis(f.z, i < 2 ? 4 : 1, agirlik);
      f.havada = false; f.sabit = false;
    }
    return f;
  }

  function ritim(d, k, dt) {
    var xx = d.x - k.x, yy = d.y - k.y, m = Math.hypot(xx, yy);
    k.x = d.x; k.y = d.y;
    if (d.durum === 'sicra') k.aci = d.kilitAci;
    else k.aci += sinirla(OYUN.aciFark(k.aci, d.aci), -dt * 14, dt * 14);
    k.yuzX = Math.cos(k.aci); k.yuzY = Math.sin(k.aci);
    if (Math.abs(k.yuzX) > .15) k.yon = k.yuzX >= 0 ? 1 : -1;
    if (Math.abs(k.yuzY) > .26) k.arka = k.yuzY < 0;
    k.dik = Math.abs(k.yuzY) > (k.dik ? .83 : .91);
    if (m > 64) {
      k.ayaklar.fill(null);
      return 'dur';
    }
    if (d.olu) return 'ol';
    if (d.sersem > 0) return 'sersem';
    if (d.durum === 'sicra') return 'sicra';
    if (d.durum === 'hazirlik') return 'hazir';
    if (d.durum === 'toparlan') return 'inis';
    if (m > .13 && dt > 0 && m / dt > 18) {
      k.kareX = xx / m; k.kareY = yy / m;
      var hiz = m / dt;
      var kosu = k.alfa < .43 ? 0 : yumusak((hiz - 125) / 65);
      k.tempo = karis(k.tempo, kosu, 1 - Math.exp(-dt * 5.5));
      k.adimBoyu = karis(46, 69, k.tempo);
      k.hareket = sinirla(hiz / 190, .43, 1);
      k.faz = (k.faz + m / k.adimBoyu) % 1;
      return 'yuru';
    }
    return 'dur';
  }
  function yerdekiPoz(s, k, d, r) {
    var yatis = d.olu ? yumusak((d.cesetT - .16) / .21) : 0;
    var doku = k.arka ? r.oluArka : r.oluOn, g = s.kurtCeset;
    g.visible = yatis > 0 && !!doku;
    s.kurtRig.alpha = g.visible ? 1 - yatis : 1;
    if (!g.visible) return;
    g.texture = doku;
    var olcek = 110 / doku.orig.width;
    g.scale.set((k.arka ? k.yon : -k.yon) * olcek, olcek * .89);
    g.position.set(0, 12);
    g.alpha = yatis;
    if (yatis >= .999) { s.kurtRig.visible = false; s.g = g; }
  }
  function ciz(d, dt) {
    var k = durum(d), s = d.sprite, p = window.OYUNCU, kip = ritim(d, k, dt);
    var mes = p ? Math.hypot(d.x - p.x, d.y - p.y) : 300;
    var gizli = kip !== 'ol' && (kip === 'yuru' || kip === 'dur') && mes > 119 &&
      (k.zaman < 1.55 || (k.tekrarGizlen > 1.25 && mes > 245)) && !(d.parla > 0);
    var hedef = gizli ? gizliAlfa : 1, yum = 1 - Math.exp(-dt * (hedef > k.alfa ? 15 : 7));
    k.alfa = karis(k.alfa, hedef, yum);
    if (kip === 'ol' && d.cesetT >= .35) k.alfa = 1;
    d.kurtGizli = !d.olu && k.alfa < .42;
    // Gizli yakalanan kurt düşerken belirir. Sonraki solmayı ortak ceset sistemi sürdürür.
    if (!d.olu || d.cesetT <= .43) s.alpha = k.alfa;
    var rs = resimler();
    s.anim = kip; s.yon = OYUN.aciYon(k.aci);
    if (!rs) { eskiResim(s, k); return; }
    if (!d.olu && !OYUN.gorusteMi(d.x, d.y, 105)) return;
    var bakis = k.dik ? (k.arka ? 'duzArka' : 'duzOn') : (k.arka ? 'arka' : 'on');
    var dik = k.dik && !!(rs[bakis].govde && rs[bakis].bas && rs[bakis].kuyruk);
    if (!dik) bakis = k.arka ? 'arka' : 'on';
    var meta = cizim[bakis], r = rs[bakis], aynala = dik ? 1 : k.arka ? k.yon : -k.yon;
    s.g = s.kurtGovde;
    if (k.bakisCizildi && s.kurtRig.visible && (s.kurtBakis !== bakis || s.kurtAyna !== aynala) &&
      kip !== 'ol' && kip !== 'sicra') bakisDegistir(s, k);
    k.bakisCizildi = true; s.kurtAyna = aynala;
    s.kurtRig.visible = true; s.kurtYedek.visible = false;
    if (s.kurtBakis !== bakis) {
      s.kurtBakis = bakis;
      s.kurtRig.setChildIndex(s.kurtKuyruk, dik && k.arka ? s.kurtRig.children.length - 1 : 0);
    }
    var perspektif = dik ? 1 : .83 + Math.abs(k.yuzX) * .17;
    s.kurtRig.scale.set(aynala * perspektif, 1);
    var nefes = Math.sin(OYUN.zaman.t * 7 + d.id * .72);
    var salinim = kip === 'yuru' ? Math.sin(k.faz * Math.PI * 4) : nefes * .25;
    var buk = kip === 'hazir' ? yumusak(1 - d.t / ayar.hazir) : 0;
    var inis = kip === 'inis' ? yumusak((d.t - .18) / .25) : 0;
    var olu = kip === 'ol' ? yumusak(d.cesetT / .31) : 0;
    var yuk = salinim * 2.8 + buk * 12 + inis * 9 + olu * 22;
    resimYerlestir(s.kurtGovde, meta.govde, r.govde);
    resimYerlestir(s.kurtBas, meta.bas, r.bas);
    resimYerlestir(s.kurtKuyruk, meta.kuyruk, r.kuyruk);
    var tilt = kip === 'sicra' ? Math.cos((1 - d.t / (k.sicraSure || ayar.sicraSure)) * Math.PI) * -.25 :
      buk * .13 + inis * .17 + salinim * .038 - olu * .28;
    var a = s.renkSon || 0xffffff;
    var tGecis = k.bakisBas === undefined ? 1 : sinirla((OYUN.zaman.t - k.bakisBas) / .084, 0, 1);
    if (kip === 'sicra' || kip === 'ol') tGecis = 1;
    s.kurtOnce.visible = tGecis < 1; s.kurtOnce.alpha = .78 * (1 - yumusak(tGecis));
    s.kurtGovde.alpha = s.kurtBas.alpha = s.kurtKuyruk.alpha = .54 + .46 * yumusak(tGecis);
    var yonEgilimi = dik ? k.yuzX * (k.arka ? .37 : -.37) : 0;
    var vucut = s.kurtGovde;
    vucut.rotation = dik ? yonEgilimi + tilt * .28 : tilt;
    vucut.y += yuk;
    var gen = 1 + salinim * k.tempo * .036;
    var boy = 1 - buk * .07 - inis * .09 - olu * .19;
    vucut.scale.x *= gen; vucut.scale.y *= boy;
    var vc = Math.cos(vucut.rotation), vs = Math.sin(vucut.rotation);

    // Baş ve kuyruk kendi kemerlerinde sağa sola oynarken omuzlarını terk etmesin.
    var bas = s.kurtBas, kuyruk = s.kurtKuyruk;
    var bx = (meta.bas[0] - meta.govde[0]) * gen, by = (meta.bas[1] - meta.govde[1]) * boy;
    bas.x = vucut.x + bx * vc - by * vs;
    bas.y = vucut.y + bx * vs + by * vc;
    bas.rotation = vucut.rotation - buk * .065 + .028 * nefes;
    bas.y += buk * (dik ? k.yuzY * 2 : 1);
    bas.x += dik ? k.yuzX * (4 + buk * 2) : buk * (k.arka ? 1 : -1);
    bas.scale.y *= 1 - olu * .11;
    k.kuyrukFazi += dt * (kip === 'yuru' ? karis(5.8, 12.7, k.tempo) : 3.6);
    var kx = (meta.kuyruk[0] - meta.govde[0]) * gen, ky = (meta.kuyruk[1] - meta.govde[1]) * boy;
    kuyruk.x = vucut.x + kx * vc - ky * vs;
    kuyruk.y = vucut.y + kx * vs + ky * vc;
    kuyruk.rotation = vucut.rotation - .04 + Math.sin(k.kuyrukFazi) * .11 - tilt * .56;
    var destek = null;
    for (var i = 0; i < 4; i++) {
      var f = ayakBul(d, k, i, meta, aynala, kip, dt);
      if (f.sabit && !f.havada && (!destek || f.y > destek.y)) destek = f;
      var on = i % 2 === 0, poz = meta.bacaklar[i], kenar = dik ? (i < 2 ? -1 : 1) : (k.arka ? 1 : -1) * (on ? -1 : 1);
      var ton = d.parla > 0 ? (i < 2 ? 0xdbb0b0 : 0xffc9c9) : (i < 2 ? 0xbdc8d4 : a);
      var ox = (poz[0] - meta.govde[0]) * gen, oy = (poz[1] - meta.govde[1]) * boy;
      var omuzX = vucut.x + ox * vc - oy * vs;
      var omuzY = vucut.y + ox * vs + oy * vc;
      var ayakY = f.y - d.y - f.z - (d.hop || 0);
      bacakCiz(s.kurtBacaklar[i], on ? r.onBacak : r.arkaBacak, omuzX, omuzY,
        (f.x - d.x) / (aynala * perspektif), ayakY, kenar * (on ? 1.5 : 5) + kenar * f.z * .27,
        dik ? (on ? 12.6 : 13.8) : (i < 2 ? .86 : 1) * (on ? 13.8 : 15.9), ton);
    }
    s.temas = null;
    if (destek && (d.hop || 0) > -.75) {
      s.kurtTemas.x = destek.x - s.x;
      s.kurtTemas.y = destek.y - s.y;
      s.temas = s.kurtTemas;
    }
    yerdekiPoz(s, k, d, rs);
    if (k.inis) {
      k.inis = false;
      if (izHavuzu.length) {
        for (var iInis = -1; iInis <= 1; iInis += 2) {
          var x = d.x - k.yuzY * iInis * 9, y = d.y + k.yuzX * iInis * 9;
          izYaz(x, y, k.aci, true, false);
          OLAY.emit('ayazBotBas', { x: x, y: y, tur: tur, agir: false, aci: k.aci });
        }
      }
    }
  }

  function uyariCiz(d, k) {
    if (k.yol < 24) return;
    var ca = Math.cos(d.kilitAci), sa = Math.sin(d.kilitAci), r = d.r + ayar.temasPayi;
    var ax = d.x, ay = d.y, bx = ax + ca * k.yol, by = ay + sa * k.yol, n = d.kilitAci + Math.PI * .5;
    var u = sinirla(1 - d.t / ayar.hazir, 0, 1);
    var renk = k.kilitli ? 0xffaf80 : 0x9ad9f3;
    var g = uyari, nx = Math.cos(n) * r, ny = Math.sin(n) * r;
    g.lineStyle(2.3, k.kilitli ? 0x7a3c2d : 0x416b8a, .25 + u * .37);
    g.beginFill(renk, .09 + u * .19);
    g.moveTo(ax + nx, ay + ny).lineTo(bx + nx, by + ny);
    g.arc(bx, by, r, n, n - Math.PI, true).lineTo(ax - nx, ay - ny);
    g.arc(ax, ay, r, n - Math.PI, n, true).closePath().endFill();
    g.lineStyle(2.25, k.kilitli ? 0x954633 : 0x4b86a7, .40 + u * .43);
    for (var i = 1; i <= 3; i++) {
      var px = karis(ax, bx, i / 4), py = karis(ay, by, i / 4), a = 7 + u * 3;
      g.moveTo(px - ca * a - sa * a * .60, py - sa * a + ca * a * .60);
      g.lineTo(px, py).lineTo(px - ca * a + sa * a * .60, py - sa * a - ca * a * .60);
    }
  }
  function herKare() {
    if (OYUN.bolum !== 3) {
      if (kabin) { kabin.visible = false; uyari.visible = false; }
      return;
    }
    izKur();
    kabin.visible = true; uyari.visible = true;
    var t = OYUN.zaman.t, dt = sinirla(t - herKare.sonT, 0, .065);
    herKare.sonT = t;
    uyari.clear();
    for (var i = 0; i < izHavuzu.length; i++) {
      var j = izHavuzu[i];
      if (j.s.alpha || j.bitis > t) j.s.alpha = j.alfa * sinirla((j.bitis - t) / (j.sure * .64), 0, 1);
    }
    var list = DUSMAN.liste;
    for (var n = 0; n < list.length; n++) {
      var d = list[n];
      if (d.tur !== tur || d.olu) continue;
      if (dt > 0 || !d.kurt || d.kurt.id !== d.id) ciz(d, dt);
      if (d.durum === 'hazirlik' && d.sersem <= 0 && OYUN.gorusteMi(d.x, d.y, 170)) uyariCiz(d, durum(d));
    }
    var ceset = DUSMAN.cesetler;
    for (var x = 0; x < ceset.length; x++) {
      var v = ceset[x];
      if (v.tur === tur && dt > 0 && v.cesetT <= .43) ciz(v, dt);
    }
  }
  herKare.sonT = 0;
  DUSMAN.turEkle(tur, ayar, davranis, spriteYap);
  OYUN.sistem('ayaz_kurt', { herKare: herKare, sifirla: function () {
    herKare.sonT = 0;
    izSirasi = 0;
    if (uyari) { uyari.clear(); uyari.visible = false; }
    if (kabin) kabin.visible = false;
    izHavuzu.forEach(function (iz) { iz.bitis = 0; iz.s.alpha = 0; });
  } });
})();

