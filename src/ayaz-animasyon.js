(function () {
  'use strict';

  var PAKETLER = {
    ayaz_mizrak: 'ayaz_mizrak', ayaz_zincir: 'ayaz_zincirci',
    buz_muhafiz: 'ayaz_muhafiz', skarn: 'ayaz_skarn'
  };

  // In the three steel rigs the new sole plants just after the clip starts.
  var ILK_BASIS = { buz_muhafiz: .10, skarn: 5 / 48 };

  function paket(tur) { return VARLIK.paketler[PAKETLER[tur]]; }

  function kareSayisi(tur) {
    var p = paket(tur);
    return p && p.anim.yuru ? p.anim.yuru.n : 1;
  }

  function kare(tur, ad, yon, faz) {
    var p = paket(tur), a = p && p.anim[ad], y = a && a._tablo[yon];
    if (!y) return null;
    var n = a.n;
    if (ad === 'yuru') faz += ILK_BASIS[tur] || 0;
    var i = y[0] + (a.dongu ? Math.floor((((faz % 1) + 1) % 1) * n) :
      Math.min(n - 1, Math.max(0, Math.floor(faz * n))));
    var doku = p.dokular[i];
    if (!doku || !doku.baseTexture.valid) return null;
    // One cached descriptor per frame. It follows the atlas lifetime on chapter changes.
    var onbellek = p._ayazKareler || (p._ayazKareler = []);
    if (!onbellek[i]) {
      var k = VARLIK.kare(p.ad, i);
      k.olcek = p.olcek;
      k.bilgi = p.temas && p.temas[i];
      onbellek[i] = k;
    }
    return onbellek[i];
  }

  function yeni() {
    return {
      faz: 0, x: 0, y: 0, px: 0, py: 0,
      kaymaX: 0, kaymaY: 0, miktar: 0,
      hazir: false, yuruyor: false, temasAni: false
    };
  }

  function ilerlet(y, x, yy, dt, adim, istiyor, kareAdedi) {
    if (!y.hazir) {
      y.x = x;
      y.y = yy;
      y.hazir = true;
    }
    var dx = x - y.x, dy = yy - y.y;
    y.x = x;
    y.y = yy;

    var mesafe = Math.hypot(dx, dy), hiz = dt > 0 ? mesafe / dt : 0;
    var hareket = istiyor && hiz > (y.yuruyor ? 9 : 19) && mesafe < adim * 0.5;
    y.yuruyor = hareket;
    y.temasAni = false;
    if (hareket) {
      var once = Math.floor(y.faz * 2);
      y.faz = (y.faz + mesafe / adim) % 1;
      y.px = dx / mesafe;
      y.py = dy / mesafe;
      y.temasAni = Math.floor(y.faz * 2) !== once;
    }

    // Aynı yürüyüş karesi gösterilirken basan ayağın dünyada kaymasını azalt.
    y.miktar += ((hareket ? 1 : 0) - y.miktar) * (1 - Math.exp(-dt * 20));
    if (y.miktar < 0.006) y.miktar = 0;
    var f = y.faz * kareAdedi, kareNo = Math.floor(f);
    var kayma = (f - kareNo - 0.5) * adim / kareAdedi * 0.6 * y.miktar;
    y.kaymaX = -y.px * kayma;
    y.kaymaY = -y.py * kayma;
    return kareNo;
  }

  function botBas(y, s, tur, agir) {
    if (!y.temasAni || !s.temas || !s.visible) return;
    var x = s.x + s.temas.x, yy = s.y + s.temas.y;
    if (!OYUN.gorusteMi(x, yy, 45)) return;
    OLAY.emit('ayazBotBas', { x: x, y: yy, tur: tur, agir: agir, aci: Math.atan2(y.py, y.px) });
  }

  function adimBoyu(boy, yon) {
    if (yon===0 || yon===4) return boy*.78;
    if (yon===2 || yon===6) return boy;
    return boy*.90;
  }

  window.AYAZ_ANIMASYON = {
    yeni: yeni, ilerlet: ilerlet, kareSayisi: kareSayisi, botBas: botBas, kare: kare, adimBoyu: adimBoyu
  };
})();
