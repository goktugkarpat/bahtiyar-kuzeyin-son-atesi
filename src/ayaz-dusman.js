
(function () {
  'use strict';
  var TURLER = {
    ayaz_mizrak: { can: 82, hiz: 117, r: 20, kutle: 1, sersem: .35, hazir: .74, ara: 2.1, menzil: 560, hasar: 15, renk: 0x8ce7f4 },
    ayaz_zincir: { can: 123, hiz: 128, r: 24, kutle: 1.28, sersem: .34, hazir: .76, ara: 2.3, menzil: 355, hasar: 16, yariGen: 17, renk: 0xffbb8a },
    buz_muhafiz: { can: 266, hiz: 83, r: 30, kutle: 2.3, sersem: .43, hazir: .92, ara: 2.5, menzil: 143, hasar: 29, renk: 0xffc48d, agir: true, zirh: 1 }
  };
  var H = 183, resimler = Object.create(null), gosterge, zincirG;
  var PI = Math.PI;
  function pol(g, renk, pts, ciz) {
    g.beginPath(); g.moveTo(pts[0], pts[1]);
    for (var i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i+1]);
    g.closePath(); g.fillStyle = renk; g.fill();
    if (ciz) { g.strokeStyle = ciz; g.lineWidth = 2; g.stroke(); }
  }
  function el(g, x, y, rx, ry, renk, aci) {
    g.beginPath(); g.ellipse(x, y, rx, ry, aci || 0, 0, PI * 2); g.fillStyle = renk; g.fill();
  }
  function cubuk(g, x0, y0, x1, y1, kalin, renk) {
    g.strokeStyle = renk; g.lineWidth = kalin; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x0,y0); g.lineTo(x1,y1); g.stroke();
  }
  function insansi(g, tur, yan, faz, poz, arka) {
    var zirhli = tur === 'buz_muhafiz', zincirci = tur === 'ayaz_zincir', pen = '#24303b';
    var k = zirhli ? 1.12 : zincirci ? 1.03 : .93, hareket = Math.sin(faz * PI / 2), ag = poz === 'yuru' ? hareket : 0;
    var hazir = poz === 'hazir', atak = poz === 'vur';
    g.translate(90 + (atak ? -10 : 0),153); g.scale(yan * k,k); g.rotate(poz === 'sersem' ? .14 : atak ? -.06 : hazir ? .06 : 0);
    var c1 = zirhli ? '#557288' : zincirci ? '#6d5862' : '#385e70';
    var c2 = zirhli ? '#93aebd' : zincirci ? '#aa8674' : '#769aa5';
    var kar = zirhli ? '#cde9ec' : '#adc5cb';
    var bot = zirhli ? '#465b6c' : '#434049';
    el(g,-2,5,33,7,'rgba(12,29,40,.32)');
    for (var i = -1; i <= 1; i += 2) {
      var x = i * 14, ayak = x + i * ag * 14;
      pol(g,i<0?'#3a4651':bot,[x-10,-55,x+11,-52,ayak+10,-5,ayak+16,2,ayak+15,9,ayak-12,8,ayak-12,-2],pen);
      pol(g,i<0?'#516575':c2,[x-8,-47,x+9,-45,ayak+8,-18,ayak-5,-17],pen);
      cubuk(g,ayak-8,-7,ayak+8,-6,3,'#9eb6bb');
    }
    var capa = arka ? '#4b5d6b' : c1;
    pol(g,capa,[-35,-105,-21,-116,18,-112,31,-104,37,-62,31,-33,16,-43,-6,-37,-22,-47,-39,-39],pen);
    for (var j = 0; j < 9; j++) {
      var x0 = -32 + j * 7.2, yy = -102 + Math.sin(j * 1.15) * 4;
      pol(g,j%3? '#738a96':'#9bb1b8',[x0-5,yy-9,x0+6,yy-10,x0+5,yy+10,x0-1,yy+19,x0-5,yy+10]);
    }
    if (zirhli) {
      pol(g,c2,[-23,-97,23,-97,28,-58,1,-45,-27,-60],pen);
      pol(g,'#b0cdd5',[-21,-93,-2,-88,-3,-52,-22,-63]);
      pol(g,'#658395',[1,-89,23,-94,24,-63,0,-49]);
      cubuk(g,0,-87,-1,-58,2,'#d4edf0');
      for (j=0;j<3;j++) cubuk(g,3,-80+j*9,15-j*3,-83+j*10,2,'#ccedf1');
      pol(g,'#688399',[-40,-105,-24,-112,-14,-97,-27,-79,-44,-84],pen);
      pol(g,'#6c8ba0',[18,-109,36,-106,44,-84,30,-76,19,-87],pen);
    } else {
      pol(g,c2,[-27,-75,28,-79,27,-69,-26,-65],pen);
      pol(g,kar,[-9,-94,11,-93,18,-77,1,-69,-17,-78],pen);
    }
    var armY = atak ? -84 : hazir ? -112 : -75 + ag * 8;
    var armX = atak ? 47 : hazir ? 27 : 33;
    pol(g,c1,[18,-105,30,-105,armX+9,armY,armX+6,armY+16,armX-6,armY+17,21,-86],pen);
    pol(g,c2,[armX-5,armY+2,armX+10,armY+1,armX+9,armY+13,armX-5,armY+15],pen);
    if (tur === 'ayaz_mizrak') {
      cubuk(g,armX-16,armY+46,armX+17,armY-35,6,pen);
      cubuk(g,armX-16,armY+46,armX+17,armY-35,3,'#aa8d74');
      pol(g,'#bce9ee',[armX+11,armY-33,armX+26,armY-60,armX+27,armY-33,armX+19,armY-25],pen);
      pol(g,'#79bdd0',[armX+16,armY-31,armX+27,armY-58,armX+24,armY-33]);
    } else if (zincirci) {
      cubuk(g,armX-1,armY+10,armX+11,armY+27,5,pen);
      for (j=0;j<5;j++) { g.strokeStyle=j%2?'#a5acaa':'#697d87';g.lineWidth=2;g.beginPath();g.ellipse(armX+11+j*3,armY+26+j*5,4,2,-.3,0,PI*2);g.stroke(); }
      pol(g,'#9aacb5',[armX+23,armY+41,armX+38,armY+48,armX+35,armY+59,armX+25,armY+56,armX+30,armY+50],pen);
    } else {
      cubuk(g,armX-15,armY+33,armX+20,armY-20,8,'#314353');
      cubuk(g,armX-15,armY+33,armX+20,armY-20,3,'#8f9fa3');
      pol(g,'#8eafbd',[armX+6,armY-25,armX+14,armY-37,armX+35,armY-29,armX+44,armY-15,armX+30,armY-10,armX+13,armY-15],pen);
      cubuk(g,armX+31,armY-27,armX+39,armY-16,2,'#d6e9ea');
    }
    pol(g,arka?'#6a8089':'#9b8c7b',[-16,-134,-10,-142,12,-142,21,-129,16,-109,-9,-110,-17,-120],pen);
    pol(g,zirhli?'#86a6b6':'#5d7687',[-21,-131,-14,-149,-2,-155,14,-149,24,-135,16,-115,9,-126,-12,-123,-16,-115],pen);
    pol(g,kar,[-17,-144,-1,-155,12,-150,18,-142,-2,-144,-18,-136]);
    if (!arka) {
      pol(g,'#283440',[-13,-132,18,-136,13,-126,-10,-124]);
      cubuk(g,5,-130,13,-132,1.8,zirhli?'#b9efff':'#f9bc8b');
    }
  }
  function parcaDoku(tur, yon, faz, poz) {
    var ad = tur + '/' + yon + '/' + faz + '/' + poz;
    if (resimler[ad]) return resimler[ad];
    var c=document.createElement('canvas'); c.width=360; c.height=H*2;
    var g=c.getContext('2d'); g.scale(2,2);
    var yan = yon >= 5 ? 1 : -1, arka = yon >= 3 && yon <= 5;
    insansi(g,tur,yan,faz,poz,arka);
    return (resimler[ad]=PIXI.Texture.from(c,{resolution:2}));
  }
  var BOY_GORSEL = { ayaz_mizrak:109, ayaz_zincir:125, buz_muhafiz:147 };
  function kaplama(tur, poz, faz, arka) {
    var a=VARLIK.paketler.ayaz; if(!a)return null;
    var s=poz==='yuru' && (faz===1 || faz===3) ? '_yuru' : poz==='vur' || poz==='hazir' ? '_vur' : '_dur';
    var ad = arka && a.tekil[tur+'_arka'] !== undefined ? tur+'_arka' : tur+s;
    if(a.tekil[ad]===undefined)ad=tur+'_dur';
    if(a.tekil[ad]===undefined)return null;
    var k=VARLIK.kare('ayaz',ad); return k.doku.baseTexture.valid?k:null;
  }
  var ADIM_UZUNLUGU = { ayaz_mizrak:71, ayaz_zincir:116, buz_muhafiz:112 };
  var SALDIRI_KARESI = { ayaz_mizrak: .545, ayaz_zincir: .58, buz_muhafiz: .64 };
  function goruntuKoy(g, k) {
    if (g.texture !== k.doku) {
      g.texture=k.doku; g.anchor.set(-k.ox/k.w,-k.oy/k.h);
    }
    g.scale.set(k.olcek);
  }
  function spriteYap(tur) {
    var s=new PIXI.Container(), g=new PIXI.Sprite(PIXI.Texture.EMPTY);
    s.g=g; s.addChild(g); s.yerTutucu=false; s.boy=BOY_GORSEL[tur];
    s.temas=null; s.atakEli=null;
    s.anim='dur'; s.yon=6; s.yan=1; s._adim=AYAZ_ANIMASYON.yeni();
    s.renk=function(t){ g.tint=t; };
    var temas={x:0,y:0}, el={x:0,y:0};
    function rigKoy(k) {
      goruntuKoy(g,k);
      if (k.bilgi) {
        temas.x=g.x+k.bilgi[0]*k.olcek;
        temas.y=g.y+k.bilgi[1]*k.olcek;
        el.x=g.x+k.bilgi[2]*k.olcek;
        el.y=g.y+k.bilgi[3]*k.olcek;
        s.temas=temas; s.atakEli=el;
      }
    }
    function cizGorsel(d, dt, yon) {
      var ad=s.anim, w=s._adim, a=TURLER[tur], faz=0;
      if (yon===undefined) yon=s.yon;
      if (yon!==0&&yon!==4) s.yan=yon>4?1:-1;
      var arka=yon>=3&&yon<=5;
      var adet=AYAZ_ANIMASYON.kareSayisi(tur);
      var adim=AYAZ_ANIMASYON.adimBoyu(ADIM_UZUNLUGU[tur],yon);
      if(d) AYAZ_ANIMASYON.ilerlet(w,d.x,d.y,dt,adim,ad==='yuru',adet);
      var geliyor=ad==='yuru' && w.miktar>=.18;
      var kes=SALDIRI_KARESI[tur];
      if (ad==='sersem' && d) faz=1-d.sersem/a.sersem;
      else if (d && d.durum==='hazirlik') {
        ad='vur'; faz=kes*(1-d.t/a.hazir);
      } else if (d && d.durum==='toparlan' && d.toparlanIlk>0) {
        ad='vur'; faz=kes+(1-kes)*(1-d.t/d.toparlanIlk);
      } else if (geliyor) faz=w.faz;
      else {
        ad='dur'; faz=d ? (OYUN.zaman.t*.91+d.id*.071)%1 : 0;
      }
      var k=AYAZ_ANIMASYON.kare(tur,ad,yon,faz);
      g.rotation=0; g.position.set(0,0); s.temas=null; s.atakEli=null;
      if(k){
        if(geliyor) g.position.set(w.kaymaX,w.kaymaY);
        rigKoy(k);
        if(d && d.hop < -2) s.temas=null;
        if(geliyor) AYAZ_ANIMASYON.botBas(w,s,tur,tur==='buz_muhafiz');
        return;
      }
      // Keep the existing static pose available when a browser cannot decode an atlas.
      k=kaplama(tur,ad,0,arka);
      if(k) {
        var olcek=s.boy/k.h;
        g.scale.set(-s.yan*olcek,olcek);
        g.texture=k.doku; g.anchor.set(-k.ox/k.w,-k.oy/k.h);
      } else {
        g.texture=parcaDoku(tur,yon,0,ad); g.anchor.set(.5,153/H); g.scale.set(1);
      }
    }
    s.olumla=function(sure){
      var k=AYAZ_ANIMASYON.kare(tur,'ol',s.yon,sure/(tur==='buz_muhafiz'?.43:.33));
      if(!k) return;
      s.atakEli=null; s.temas=null; g.position.set(0,0); g.rotation=0;
      goruntuKoy(g,k);
    };
    s.oynat=function(ad,yon){
      s.anim=ad;s.yon=yon;
      if(ad==='ol') s.olumla(0);
      else if(!s._id) cizGorsel(null,0);
    };
    s.adimla=function(d,dt,yon){
      if(s._id!==d.id){
        s._id=d.id; s._adim=AYAZ_ANIMASYON.yeni(); g.alpha=1;
        s._adim.faz=(d.id%2)*.5;
      }
      cizGorsel(d,dt,yon);
    };
    s.oynat('dur',6); return s;
  }
  function ciz(d, ad) {
    d.sprite.oynat(ad,OYUN.aciYon(d.aci));
  }
  function mesafeKare(px,py,ax,ay,bx,by) {
    var dx=bx-ax,dy=by-ay,d2=dx*dx+dy*dy;
    var t=d2?Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/d2)):0;
    var ex=px-ax-t*dx,ey=py-ay-t*dy;return ex*ex+ey*ey;
  }
  function harekete(d, x, y, hiz, dt) {
    var a=Math.atan2(y-d.y,x-d.x); d.aci=a; d.x+=Math.cos(a)*hiz*dt;d.y+=Math.sin(a)*hiz*dt;
    ciz(d,'yuru');
  }
  function toparla(d, a, sure) { d.durum='toparlan'; d.t=d.toparlanIlk=sure; d.bekle=a.ara + (d.id % 5)*.087; }
  function atisEngeli(x0,y0,x1,y1) {
    return BOLUM.ayazAtisEngeli ? BOLUM.ayazAtisEngeli(x0,y0,x1,y1) : null;
  }
  function kilit(d, p, a) {
    d.aci=d.kilitAci=Math.atan2(p.y-d.y,p.x-d.x);
    var dx=Math.cos(d.aci)*a.menzil,dy=Math.sin(d.aci)*a.menzil;
    var engel=atisEngeli(d.x,d.y,d.x+dx,d.y+dy), pay=engel===null?1:engel;
    d.hx=d.x+dx*pay; d.hy=d.y+dy*pay;
  }
  function zincirKesildi(d, p) {
    var b=p.balta;
    if(!b || b.faz!=='don') return null;
    var ax=b.donOnceX, ay=b.donOnceY, r=21*21;
    if(Number.isFinite(ax) && Number.isFinite(ay)){
      var bx=b.x-ax, by=b.y-ay, hx=d.hx-d.x, hy=d.hy-d.y;
      var k=bx*hy-by*hx;
      if(Math.abs(k)>.001){
        var dx=d.x-ax,dy=d.y-ay, t=(dx*hy-dy*hx)/k, u=(dx*by-dy*bx)/k;
        if(t>=0&&t<=1&&u>=0&&u<=1) return {x:ax+bx*t,y:ay+by*t};
      }
      if(mesafeKare(ax,ay,d.x,d.y,d.hx,d.hy)<r) return {x:ax,y:ay};
      if(mesafeKare(d.x,d.y,ax,ay,b.x,b.y)<r) return {x:d.x,y:d.y};
      if(mesafeKare(d.hx,d.hy,ax,ay,b.x,b.y)<r) return {x:d.hx,y:d.hy};
    }
    return mesafeKare(b.x,b.y,d.x,d.y,d.hx,d.hy)<r ? {x:b.x,y:b.y} : null;
  }
  function ayazDavranis(d,dt,p,a) {
    var dx=p.x-d.x,dy=p.y-d.y,mes=Math.hypot(dx,dy), menzil=a.menzil, tur=d.tur;
    var zincirci=tur==='ayaz_zincir', mizrakci=tur==='ayaz_mizrak', armor=tur==='buz_muhafiz';
    if (d.durum==='toparlan') {
      d.t-=dt; ciz(d,d.t>.38?'vur':'dur');
      if(d.t<=0){d.durum='yaklas'; d.t=0;}
      return;
    }
    if (d.durum==='hazirlik') {
      d.t-=dt;
      if (d.t>a.hazir*.46) kilit(d,p,a);
      ciz(d,'hazir');
      var kesik=zincirci && d.t<a.hazir*.48 && zincirKesildi(d,p);
      if(kesik) {
        d.zincirUcu = 0;
        toparla(d,a,1.14); d.sersem=.68; d.parla=.10;
        if (p.baltaIst) p.baltaIst.kesme++;
        OLAY.emit('ayazZincirKes', { x:kesik.x, y:kesik.y, aci:d.kilitAci });
        return;
      }
      if(d.t>0)return;
      if (mizrakci) {
        var yakin=Math.hypot(d.hx-d.x,d.hy-d.y);
        var kare=AYAZ_ANIMASYON.kare(tur,'vur',OYUN.aciYon(d.kilitAci),SALDIRI_KARESI[tur]);
        var yukseklik=kare && kare.bilgi ? OYUN.sinirla(Math.sin(d.kilitAci)*28-kare.bilgi[3]*kare.olcek,35,86) : 56;
        if(yakin>35) MERMI.at('buz_mizrak',d.x+Math.cos(d.kilitAci)*28,d.y+Math.sin(d.kilitAci)*28,d.kilitAci,
          {hiz:510,hasar:a.hasar,sahip:'dusman',kaynak:d,z:yukseklik});
        else OLAY.emit('mermiVur',{tur:'buz_mizrak',x:d.hx,y:d.hy,yer:true});
        toparla(d,a,.45);
      } else if (zincirci) {
        var temas = p.r + a.yariGen;
        d.zincirUcu = 1;
        if (mesafeKare(p.x,p.y,d.x,d.y,d.hx,d.hy) < temas*temas && atisEngeli(d.x,d.y,p.x,p.y)===null) {
          if (p.hasarAl(a.hasar,{aci:Math.atan2(d.y-p.y,d.x-p.x),guc:450,kaynak:d})) d.zincirUcu = 2;
        }
        toparla(d,a,.74);
      } else {
        var fark=Math.abs(OYUN.aciFark(Math.atan2(dy,dx),d.kilitAci));
        if(mes<menzil+p.r && fark<.91 && atisEngeli(d.x,d.y,p.x,p.y)===null) p.hasarAl(a.hasar,{aci:d.kilitAci,guc:420,kaynak:d});
        OLAY.emit('devYereVur',{x:d.x+Math.cos(d.kilitAci)*88,y:d.y+Math.sin(d.kilitAci)*88,r:48,sopa:true});
        toparla(d,a,1.03);
        if (d.zirh>0) OLAY.emit('ayazMuhafizAcik',{hedef:d});
      }
      return;
    }
    d.bekle=Math.max(0,d.bekle-dt);
    if (mes<menzil && d.bekle===0) {
      var yakinTehdit=DUSMAN.liste.some(function (o) {
        return o!==d && !o.olu && (o.durum==='hazirlik'||o.durum==='sicra') && (o.tur===tur||o.tur==='ayaz_zincir');
      });
      if (!yakinTehdit && atisEngeli(d.x,d.y,p.x,p.y)===null) {
        d.durum = 'hazirlik'; d.t = a.hazir;
        kilit(d, p, a); ciz(d, 'hazir');
        if(zincirci) OLAY.emit('ayazZincirHazir',{hedef:d});
        return;
      }
    }
    if (mizrakci && mes<215) {
      harekete(d,d.x-dx,d.y-dy,d.hiz*.83,dt);return;
    }
    if (mes>(armor?104:mizrakci?410:zincirci?275:100)) harekete(d,p.x,p.y,d.hiz,dt);
    else if (atisEngeli(d.x,d.y,p.x,p.y)!==null) harekete(d,p.x,p.y,d.hiz*.87,dt);
    else { d.aci=Math.atan2(dy,dx);ciz(d,'dur'); }
  }
  function kapsulCiz(g, x0, y0, x1, y1, r, renk, ilerleme) {
    var a = Math.atan2(y1 - y0, x1 - x0), n = a + PI * .5;
    var nx = Math.cos(n) * r, ny = Math.sin(n) * r;
    g.lineStyle(2, renk, .45 + ilerleme * .45);
    g.beginFill(renk, .07 + ilerleme * .15);
    g.moveTo(x0 + nx, y0 + ny).lineTo(x1 + nx, y1 + ny);
    g.arc(x1, y1, r, n, n - PI, true);
    g.lineTo(x0 - nx, y0 - ny);
    g.arc(x0, y0, r, n - PI, n, true);
    g.closePath(); g.endFill();
  }

  function zincirCiz(g, d) {
    var p = window.OYUNCU, t = Math.min(1, Math.max(0, (.74 - d.t) / .30));
    var oran = (1 - t) * (1 - t), bagli = d.zincirUcu === 2 && p && t < .50;
    var el=d.sprite.atakEli;
    var ax=el ? d.sprite.x+el.x : d.x+Math.cos(d.kilitAci)*13;
    var ay=el ? d.sprite.y+el.y : d.y-54;
    var bx = d.hx, by = d.hy - 34;
    if (d.zincirUcu === 2 && p) {
      bx = p.x; by = p.y - 45;
      if (bagli) oran = 1;
      else oran = (1 - t) * 2;
    }
    bx = ax + (bx - ax) * oran; by = ay + (by - ay) * oran;
    var aci = Math.atan2(by - ay, bx - ax), mesafe = Math.hypot(bx - ax, by - ay);
    var adet = Math.min(27, Math.ceil(mesafe / 13));
    if (adet < 2) return;
    for (var i = 0; i < adet; i++) {
      var u = i / adet, x = ax + (bx - ax) * u, y = ay + (by - ay) * u + Math.sin(u * PI) * 8 * oran;
      var r = i % 2 ? 3.1 : 5.6;
      g.lineStyle(3.2, 0x11191d, .91);
      g.moveTo(x - Math.cos(aci) * r, y - Math.sin(aci) * r);
      g.lineTo(x + Math.cos(aci) * r, y + Math.sin(aci) * r);
      g.lineStyle(1.15, i % 2 ? 0x9faab0 : 0xd6d0bd, .91);
      g.moveTo(x - Math.cos(aci) * r, y - Math.sin(aci) * r - 1);
      g.lineTo(x + Math.cos(aci) * r, y + Math.sin(aci) * r - 1);
    }
    g.lineStyle(2.7, 0xc7d1d4, .98);
    g.moveTo(bx - Math.cos(aci) * 6, by - Math.sin(aci) * 6).lineTo(bx, by).lineTo(bx - Math.sin(aci) * 6, by + Math.cos(aci) * 6);
  }
  function mizrakYolu(g,d,p,renk) {
    var cx=Math.cos(d.kilitAci),cy=Math.sin(d.kilitAci);
    var bas=22,boy=Math.hypot(d.hx-d.x,d.hy-d.y);
    var alfa=.48+p*.40;
    g.lineStyle(5,0x2d556a,.36);
    g.moveTo(d.x+cx*bas,d.y+cy*bas).lineTo(d.hx,d.hy);
    g.lineStyle(2,renk,alfa);
    for(var t=bas;t<boy-12;t+=24){
      var u=Math.min(boy-10,t+14+p*4);
      g.moveTo(d.x+cx*t,d.y+cy*t).lineTo(d.x+cx*u,d.y+cy*u);
    }
    for(var i=0;i<2;i++) {
      var l=boy-7-i*18,fx=d.x+cx*l,fy=d.y+cy*l;
      g.moveTo(fx-cx*9-cy*5,fy-cy*9+cx*5).lineTo(fx,fy)
        .lineTo(fx-cx*9+cy*5,fy-cy*9-cx*5);
    }
  }
  function zincirYolu(g,d,p,a) {
    kapsulCiz(g,d.x,d.y,d.hx,d.hy,a.yariGen,a.renk,p);
    var cx=Math.cos(d.kilitAci),cy=Math.sin(d.kilitAci);
    var boy=Math.hypot(d.hx-d.x,d.hy-d.y);
    g.lineStyle(2,a.renk,.47+p*.42);
    for(var t=31;t<boy-12;t+=35){
      var xx=d.x+cx*t,yy=d.y+cy*t;
      g.moveTo(xx-cx*7-cy*3,yy-cy*7+cx*3)
        .lineTo(xx+cx*7-cy*3,yy+cy*7+cx*3)
        .lineTo(xx+cx*8+cy*3,yy+cy*8-cx*3)
        .lineTo(xx-cx*6+cy*3,yy-cy*6-cx*3);
    }
  }
  function gostergeGuncelle() {
    if (OYUN.durum === 'mola') return;
    if (OYUN.bolum !== 3 || OYUN.durum !== 'oyun') {
      if (gosterge) gosterge.visible = false;
      if (zincirG) zincirG.visible = false;
      return;
    }
    if(!gosterge){gosterge=new PIXI.Graphics();gosterge.name='ayaz_dusman_isaretleri';OYUN.katman.leke.addChild(gosterge);}
    gosterge.visible = true; gosterge.clear();
    if (!zincirG) {
      zincirG = new PIXI.Graphics(); zincirG.name = 'ayaz_zincir_kanca'; OYUN.katman.efekt.addChild(zincirG);
    }
    zincirG.visible = true; zincirG.clear();
    var L=DUSMAN.liste;
    for(var i=0;i<L.length;i++){
      var d=L[i],a=TURLER[d.tur];if(!a||d.olu||!d.girdi)continue;
      if (d.tur === 'ayaz_zincir' && d.durum === 'toparlan' && d.t > .44 && d.zincirUcu) zincirCiz(zincirG, d);
      if (d.durum !== 'hazirlik') continue;
      var p = 1 - Math.max(0, d.t) / a.hazir;
      if (d.tur === 'buz_muhafiz') {
        var yay = .91, r = a.menzil;
        gosterge.lineStyle(2,a.renk,.34+p*.59);gosterge.beginFill(a.renk,.06+p*.17);
        gosterge.moveTo(d.x,d.y);
        for(var k=0;k<=14;k++){
          var gamma=d.kilitAci-yay+k*2*yay/14;
          gosterge.lineTo(d.x+Math.cos(gamma)*r,d.y+Math.sin(gamma)*r);
        }
        gosterge.lineTo(d.x,d.y);gosterge.endFill();
      } else if(d.tur==='ayaz_zincir') zincirYolu(gosterge,d,p,a);
      else mizrakYolu(gosterge,d,p,a.renk);
    }
  }
  Object.keys(TURLER).forEach(function(tur){
    DUSMAN.turEkle(tur,TURLER[tur],ayazDavranis,function(){return spriteYap(tur);});
  });
  OYUN.sistem('ayaz_dusman', { herKare:gostergeGuncelle, sifirla:function () {
    if (gosterge) gosterge.clear();
    if (zincirG) zincirG.clear();
  } });
})();



