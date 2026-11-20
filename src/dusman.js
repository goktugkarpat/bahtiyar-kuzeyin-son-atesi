/* dusman.js — Düşman çatısı (goblin, ork okçu, kalkanlı ork, şaman, yakıcı, baskıncı, infazcı) ve mermiler (ok, büyü, kaya, çömlek).
   Global: DUSMAN, MERMI. Efekt/ses çağırmaz; yalnız OLAY yayar. Eksik modüllere karşı korumalıdır. */
(function () {
  'use strict';

  // ------------------------------------------------------------------ AYAR
  var AYAR = {
    goblin:   { can: 10, hiz: 165, hasar: 9,  r: 16, kutle: 0.7,
                menzil: 95, halka: 70, hazirlik: 0.35, sicraHiz: 520, sicraSure: 0.24,
                geriSure: 0.4, bekleMin: 0.45, bekleMax: 1.0, sersem: 0.35 },
    okcu:     { can: 28, hiz: 105, hasar: 13, r: 22, kutle: 1.0,
                yakin: 320, uzak: 420, cek: 0.8, kilit: 0.55, okHiz: 380,
                bekleMin: 1.5, bekleMax: 2.4, sersem: 0.3 },
    kalkanli: { can: 80, hiz: 88, hasar: 22, r: 26, kutle: 1.8,
                menzil: 100, darbeMenzil: 118, darbeYay: 0.95 /*±rad*/, hazirlik: 0.6, toparlan: 0.75 /*4. tur 0.6: vuruştan sonra kalkan açık pencere*/,
                bekleMin: 0.9, bekleMax: 1.5, kalkanYay: Math.PI / 3 /*±60° = 120°*/,
                donus: 1.9 /*rad/sn; 4. tur 2.4: barbar etrafında dolanınca yetişiyordu*/, kalkanAcik: 1.4, sersem: 0.25, agirSersem: 1.2 },
    saman:    { can: 26, hiz: 90, hasar: 18, r: 20, kutle: 0.9,
                yakin: 380, uzak: 500, sifaAra: 4, sifaMenzil: 280, sifaOran: 0.5, sifaHedef: 4, sifaHazirlik: 0.5,
                buyuHazirlik: 0.9, buyuHiz: 240, bekleMin: 3.5, bekleMax: 5.5, sersem: 0.35 },
    // 19 Kasım: Yakıcı — meşaleli, yağ çömleği atan ork. Orta mesafede durur, çömlek → ateş birikintisi.
    yakici:   { can: 34, hiz: 95, hasar: 9, r: 22, kutle: 1.0,
                yakin: 260, uzak: 420, kaldir: 0.6 /*çömlek baş üstünde: baltayla kesilebilir pencere*/, kilit: 0.38 /*hedef bu andan sonra sabit*/,
                ucus: 0.8, ucusH: 150, menzilEn: 480, bekleMin: 3.2, bekleMax: 4.2, esZaman: 2 /*aynı anda çömlek kaldıran*/,
                mesaleMenzil: 70, mesaleHazirlik: 0.4, mesaleToparlan: 0.45, mesaleYay: 1.0, mesaleGuc: 240, mesaleBekle: 1.2,
                tutus: 1.5 /*meşale vuruşundan sonra yanma süresi (sn)*/, kesmeHasar: 20, sersem: 0.3 },
    // Bölüm II: Çift Baltalı Akıncı — hızlı yan kanat (flank), orta mesafeden sıçrama (atil), yakında hızlı vur kombosu
    baskinci: { can: 145, hiz: 215, hasar: 12, ikinciHasar: 9, atilHasar: 14, r: 22, kutle: 1.05,
                menzil: 92, darbeMenzil: 106, darbeYay: 1.05,
                atilMin: 150, atilMax: 290, atilHazirlik: 0.56, atilHiz: 840, atilSure: 0.29, atilGuc: 290, atilBekle: 1.75,
                vurHazirlik: 0.36, vurAra: 0.16, vurIkinci: 0.26, vurGuc: 240, toparlan: 0.40,
                bekleMin: 0.65, bekleMax: 1.1, kanatAci: 0.65, donus: 10, sersem: 0.3 },
    // Bölüm II: Ağır Demir İnfazcı — yüksek can, zırh: 1 (%50 hafif hasar; ağır/öfkeli/balta/varil zırhı kırar), geniş balta savuruşu
    infazci:  { can: 360, hiz: 105, hasar: 24, r: 28, kutle: 2.4, agir: true, zirh: 1,
                menzil: 112, darbeMenzil: 136, darbeYay: 1.15, darbeGuc: 480,
                hazirlik: 0.86, toparlan: 0.84, bekleMin: 1.0, bekleMax: 1.6,
                donus: 1.7, sersem: 0.35, zirhKirSersem: 0.9 },
    // ateş birikintisi (çömlek, kesme, ölüm patlaması). Yer düzleminde basık elips: dikey yarıçap r*basik.
    ates: { r: 70, sure: 4.5, son: 1.0 /*son bu kadar sn küçülerek söner*/, basik: 0.55, azami: 4, tik: 0.25,
            oyuncuTik: 2 /*0,25 sn'de bir → 8/sn*/, dusmanTik: 2.5 /*→ 10/sn*/, tutusTik: 1 /*→ 4/sn (oyuncu.js)*/,
            olumR: 60, olumSure: 3, olumHasar: 10, olumMenzil: 60 },
    mermi: {
      ok:   { r: 7,  omur: 3.2, z: 42, sekmeCarpan: 1.5 },
      buyu: { r: 14, omur: 4.5, z: 48, sekmeCarpan: 1.5 },
      kaya: { r: 38, omur: 6.0, z: 0,  sekmeCarpan: 1.5 },
      comlek: { r: 12, omur: 3.0, z: 0, sekmeCarpan: 1 },
      buz_mizrak: { r: 10, omur: 2.4, z: 42, sekmeCarpan: 1.7 }
    },
    esZamanliSaldiri: 6,       // aynı anda saldırıya geçen yakın dövüşçü sayısı
    kulEsZamanliSaldiri: 4,    // Kül Geçidi'nde yakın saldırı ve ateşin üst üste binmesini azaltır
    baltaKesmeSersem: 1.1,     // 19 Kasım: ok geren okçuyu / büyü yapan şamanı balta keserse sersem (sn)
    baltaSersem: 0.5,          // baltanın kalkanlı dışındakilere en az sersemi (sn)
    // 4. tur: kalabalık hissi — goblinler barbarın çevresine eşit aralıklı dizilir, sırayla atılır
    kalabalik: {
      dagitAra: 0.35,          // halka yerleri bu kadar sn'de bir yeniden dağıtılır (sırayı bozmadan)
      aralik: 40,              // halkada iki goblin arası en az (px) → kalabalıkta halka genişler
      goblinSaldiri: 2,        // aynı anda hazırlık/sıçramada en çok bu kadar goblin
      goblinAra: 0.32,         // iki goblin atılışının başlaması arasında en az (sn): sırayla gelsinler
      gezinHiz: 0,             // sırasını bekleyen goblin halkada bu kadar rad/sn yana süzülür (0.35 denendi: yürü/bak kipi sürekli değişip yön titredi)
      kayEn: 0.6,              // bir dağıtımda yer en çok bu kadar rad kayar (0.9: sık koşturma)
      yerPay: 12               // halkadaki yerine bu kadar yakınsa kıpırdamaz (küçük düzeltmelerde ayak kayması/titreme yok)
    },
    okcuAcik: { genislik: 30, ara: 40, itme: 0.7, komsu: 120 }, // atış hattında dost varsa yana kay; okçular birbirinden ≥komsu px
    samanKac: { mesafe: 210, bekle: 2.6 },   // barbar bu kadar yaklaşınca yana sıçrayıp kaçar (bekleme sn)
    sifaBag: 0.7,              // şifa sonrası şaman→iyileşen çizgisi bu kadar sn görünür
    parcalaOfke: 0.45,         // öfkeliyken öldürmenin parçalama olasılığı (ağır vuruş/sekme/aşırı güç hep parçalar)
    havaEsik: 520, havaOran: 0.016, havaEn: 16, havaSure: 0.24, // savrulma gücü/kütle bu eşiği aşınca hafif düşman kısa havalanır (px)
    dominoSars: 2.5, dominoDondur: 0.025,       // savrulan düşman ötekine çarpınca sarsıntı (px) ve minik duraksama (sn)
    menzilliEsZaman: 2,        // aynı anda nişan alan (okçu çekişi + şaman büyüsü) en çok bu kadar (yönetici isteği: hasarın %55'i mermidendi)
    mermiAra: 1.2,             // barbar ok/büyüden hasar aldıktan sonra bu kadar sn ikinci ok/büyü hasar vermez (mermi kırılır)
    samanKoseBuyu: 0.75,       // köşede sıkışan şamanın kısa büyü hazırlığı (sn; 0.5 çok ani idi)
    geriSekis: 2, geriSekisH: 7, // goblin vuruştan sonra barbara bakarak bu kadar kısa sekişle (yükseklik px) geri çekilir
    kalkanAralik: 130,         // kalkanlılar birbirinden en az bu kadar açılmaya çalışır (px)
    sekmeDondur: 0.07,         // sektirilen okla öldürünce vuruş duraksaması (sn)
    parcalaAsiri: 2,          // vuruş, kalan canın canMax'in bu katından fazlasını aşarsa parçalar
    arenaTempo: 1.25,          // kilitli meydanda saldırı beklemesi bu kadar hızlı akar (2. dalga: meydan hasarı tur başı 0,72 → 0,2/sn düşmüştü; 1,5 ile 1,05 fazlaydı)
    surtunme: 6.5,             // savrulma hız sönümü (1/sn)
    savrulmaCarpma: 330,       // bu hızın üstünde savrulan düşman çarptığına hasar verir
    carpmaHasar: 6,            // 400 px/sn savrulmada; hızla orantılı (oyuncu vuruşu 14/16/30)
    parcalaGuc: 900,           // bu itişin üstünde ölüm parçalanır
    cesetSure: 12, cesetSolma: 1.5, cesetUst: 50,
    altPay: 220,               // ekranın bu kadar altındakiler silinir
    parlama: 0.1,
    // görünür oyun alanı (ayak noktası): düşmanlar buradan çıkmaz
    alan: {
      ust: { goblin: 85, okcu: 125, kalkanli: 125, saman: 120, yakici: 125, baskinci: 125, infazci: 135 }, // kameranın üst kenarından en az (uzun orkun kafası kesilmesin)
      alt: 18, yan: 50,
      ic: 40,                  // oyuncunun dolaşabildiği alandan (BOLUM.sinir) yanlarda/altta bu kadar içeride
      ustIc: 5,                // üstte: oyuncu üst sınırının hemen altı (savurma menzili ~95 px zaten yetişir)
      gostergeX: 420, gostergeY: 185, // sol alttaki can/öfke göstergesinin kapladığı köşe: düşman buraya giremez
      girisHizlan: 1.0,        // dışarıda doğan bu kadar sn'de girmediyse hızlanır
      girisAl: 1.8,            // bu kadar sn'de hâlâ dışarıdaysa kenardan içeri alınır
      duvarHiz: 230,           // bu hızın üstünde duvara savrulan kısa sersemler
      duvarSersem: 0.3,
      koseSure: 0.55,          // menzilli düşman bu kadar sn köşede sıkışırsa çare arar
      kacisSure: 0.65, kacisCarpan: 1.9,
      duzeltHiz: 320           // sınır birden kayınca düşman en çok bu hızla içeri alınır (px/sn; ışınlanma yok)
    },
    okcuYakin: { menzil: 105, hazirlik: 0.42, toparlan: 0.4, hasar: 9, guc: 260, yay: 1.0 },
    esne: 0.18,                // her vuruşta geri esneme süresi (sn)
    // akıcılık (3. tur): denge sayısı değil, yalnız hareketin görünüşü
    yumusak: 0.07,             // yürüme hızı bu kadar sn'de hedef hıza oturur (anlık dönüş/duruş yok)
    donusHiz: 11,              // yürürken gövdenin dönme hızı (rad/sn; 180° ≈ 0,3 sn)
    varis: 6,                  // hedef noktaya bu oranla yavaşlayarak varır (1/sn)
    itisAzami: 320,            // itişme ayrışması en çok bu hızla iter (px/sn; titreme yok)
    enAzYuruKare: 10,          // yürüme animasyonu en az bu kadar resim/sn oynar (yavaşta ayak kayması azalsın)
    azamiKareHiz: 60           // animasyon en çok bu kadar kare/sn oynar (kare atlanmaz)
  };
  // yön numarası → açı (OYUN.yonAci yoksa)
  var YON_ACI = [Math.PI / 2, Math.PI * 3 / 4, Math.PI, -Math.PI * 3 / 4, -Math.PI / 2, -Math.PI / 4, 0, Math.PI / 4];

  // ------------------------------------------------------------------ yardımcılar
  function rast(a, b) {
    if (window.OYUN && typeof OYUN.rast === 'function') return OYUN.rast(a, b);
    return a + Math.random() * (b - a);
  }
  function aciFark(a, b) { var d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }
  function yonu(aci) {
    if (window.OYUN && OYUN.aciYon) return OYUN.aciYon(aci);
    // 0=G(aşağı) 2=B(sol) 4=K(yukarı) 6=D(sağ); açı 0=sağ, +π/2=aşağı
    var k = Math.round(aci / (Math.PI / 4));
    k = ((k % 8) + 8) % 8;
    return (k + 6) % 8;
  }
  function emit(ad, veri) { try { if (window.OLAY) OLAY.emit(ad, veri); } catch (e) { console.error(e); } }
  function zirhOlayKancasi() {
    if (!window.OLAY || typeof OLAY.emit !== 'function' || OLAY.emit._zirhKanca) return;
    var eskiEmit = OLAY.emit;
    var yeniEmit = function (ad, veri) {
      if (ad === 'vurus' && veri && veri.hedef) {
        var h = veri.hedef;
        if (h._zirhliVurus) { h._zirhliVurus = false; if (veri.zirhli === undefined) veri.zirhli = true; }
        if (h._zirhKirildiVurus) { h._zirhKirildiVurus = false; if (veri.zirhKirildi === undefined) veri.zirhKirildi = true; }
      }
      return eskiEmit.call(this, ad, veri);
    };
    yeniEmit._zirhKanca = true;
    OLAY.emit = yeniEmit;
  }
  zirhOlayKancasi();
  function oyuncu() { return (window.OYUNCU && OYUNCU.canli !== false && typeof OYUNCU.x === 'number') ? OYUNCU : null; }
  function kamY() { return (window.OYUN && OYUN.kamera && typeof OYUN.kamera.y === 'number') ? OYUN.kamera.y : 0; }
  function kamX() { return (window.OYUN && OYUN.kamera && typeof OYUN.kamera.x === 'number') ? OYUN.kamera.x : 0; }
  function W() { return (window.OYUN && OYUN.W) || 1280; }
  function H() { return (window.OYUN && OYUN.H) || 720; }
  function ekranda(x, y, pay) {
    pay = pay || 0; var ky = kamY(), kx = kamX();
    return y > ky + pay && y < ky + H() - 6 && x > kx + pay && x < kx + W() - pay;
  }
  // 19 Kasım yakınlaştırma: OYUN.gorus = o kare ekranda GÖRÜNEN dünya (barbarı izler; tasarım penceresinden dar olabilir).
  // Saldırı başlatma yalnız düşman hem tasarım penceresinde hem görüşte iken (görmediğin yerden ok/büyü/sıçrama yok).
  function gorusIci(x, y, pay) {
    var g = window.OYUN && OYUN.gorus;
    if (!g || !isFinite(g.sol) || !isFinite(g.w)) return true;
    pay = pay || 0;
    return x > g.sol + pay && x < g.sol + g.w - pay && y > g.ust + pay + 40 && y < g.ust + g.h - 6;
  }
  function gorunur(x, y, pay) { return ekranda(x, y, pay) && gorusIci(x, y, pay); }
  // görüşe girmek için yön (−1/0/+1, x ve y): görüş dışındaki nişancı önce içeri yürür
  var _gy = { x: 0, y: 0 };
  function gorusYon(x, y, pay) {
    var g = window.OYUN && OYUN.gorus; _gy.x = 0; _gy.y = 0;
    if (!g || !isFinite(g.sol) || !isFinite(g.w)) return _gy;
    if (x < g.sol + pay) _gy.x = 1; else if (x > g.sol + g.w - pay) _gy.x = -1;
    if (y < g.ust + pay + 40) _gy.y = 1; else if (y > g.ust + g.h - 6 - pay * 0.5) _gy.y = -1;
    return _gy;
  }
  // sol alttaki can/öfke göstergesinin iç köşesi (DÜNYA): gösterge pencerenin gerçek köşesinde ve ölçeksiz;
  // dünya yakınlaşıp kaydığı için köşe mantıksal ekrandan dünyaya çevrilir
  var _gk = { x: 0, y: 0 };
  function gostergeKose() {
    var AL = AYAR.alan, O = window.OYUN;
    if (O && O.gorunum && typeof O.ekranDunya === 'function') {
      var g = O.gorunum, p = O.ekranDunya(g.x0 + AL.gostergeX, g.y0 + g.h - AL.gostergeY);
      if (p && isFinite(p.x) && isFinite(p.y)) { _gk.x = p.x; _gk.y = p.y; return _gk; }
    }
    _gk.x = kamX() + AL.gostergeX; _gk.y = kamY() + H() - AL.gostergeY; return _gk;
  }
  // çizim konumu aygıt pikseline yuvarlanır (kamera da öyle): resim yarım pikselde bulanıp titremez
  function cp(v) {
    var r = (window.OYUN && OYUN.app && OYUN.app.renderer && OYUN.app.renderer.resolution) || 1;
    return Math.round(v * r) / r;
  }
  // animasyon hızı çarpanı: kare/sn ekran tazelemesini (60) aşmasın → hiçbir kare atlanmaz
  function kareSinir(a, h) {
    var f = (a && a.fps) || 10;
    // 60 resim/sn çizilmiş klipler (19 Kasım) 1,6 kata kadar hızlanabilir (koşu/kaçışta ayak kaymasın); kare atlanabilir
    return Math.min(h, f >= 50 ? 1.6 : AYAR.azamiKareHiz / f);
  }
  function katman(ad) {
    var k = window.OYUN && OYUN.katman; if (!k) return null;
    return k[ad] || k.varlik || null;
  }

  // ------------------------------------------------------------------ DUSMAN
  var liste = [];
  var cesetler = [];
  var havuz = {};            // sprite paketi -> [d]
  var sayac = 0;
  var uyariG = null;         // telgraf / işaret çizimi (zeminde)
  var saldiranSay = 0;
  var dominoT = -9;
  var menzilliAktif = 0, mermiHasarT = -9;
  var gobAktif = 0, gobSonT = -9, dagitT = 0, _gobs = [];
  var yakAktif = 0;          // şu an çömlek kaldıran Yakıcı sayısı

  // ---- ATEŞ BİRİKİNTİSİ (Yakıcı). Nesneler havuzdan; kare başına yeni nesne yok.
  // {id, x, y, r, sure, t, sahip:'dusman'|'oyuncu'}; 'dusman' ateşi Yakıcıları yakmaz. Dev hiç yanmaz.
  var atesler = [], atesHavuz = [], atesId = 0, atesPT = 0.15, patlamaK = [], patlamaKN = 0;
  function atesEtkinR(f) { // son saniyede küçülür: çizilen alan = yakan alan
    var AT = AYAR.ates, kal = f.sure - f.t;
    return kal >= AT.son ? f.r : f.r * (0.35 + 0.65 * Math.max(0, kal) / AT.son);
  }
  function atesIcinde(x, y, yakiciMi, pay) { // bu noktayı yakan birikinti var mı (yakiciMi: yalnız oyuncu ateşi sayılır)
    var b = AYAR.ates.basik;
    for (var i = 0; i < atesler.length; i++) {
      var f = atesler[i]; if (yakiciMi && f.sahip !== 'oyuncu') continue;
      var r = atesEtkinR(f) + (pay || 0), dx = x - f.x, dy = (y - f.y) / b;
      if (dx * dx + dy * dy < r * r) return f;
    }
    return null;
  }
  function atesSil(i) {
    var f = atesler[i]; atesler.splice(i, 1); atesHavuz.push(f);
    emit('atesSon', { x: f.x, y: f.y, r: f.r, id: f.id });
  }
  function atesYak(x, y, r, sure, sahip, ek) {
    var AT = AYAR.ates;
    var sinir = (ek && ek.sinir) || AT.azami;
    while (atesler.length >= sinir) atesSil(0); // en eski söner
    var f = atesHavuz.pop() || {};
    f.id = ++atesId; f.x = x; f.y = y;
    f.r = (r > 0 && isFinite(r)) ? r : AT.r;
    f.sure = (sure > 0 && isFinite(sure)) ? sure : AT.sure;
    f.t = 0; f.sahip = sahip || 'dusman';
    atesler.push(f);
    emit('atesYak', { x: x, y: y, r: f.r, sure: f.sure, sahip: f.sahip, id: f.id, patlama: !!(ek && ek.patlama), kesme: !!(ek && ek.kesme), basik: AT.basik });
    return f;
  }
  var _atesEkleOpt = { sinir: Math.max(AYAR.ates.azami, 6) };
  function atesEkle(x, y, r, sure, sahip, ek) {
    if (!isFinite(x) || !isFinite(y)) return null;
    if (sahip && typeof sahip === 'object') { ek = sahip; sahip = ek.sahip; }
    var opt = ek ? { patlama: !!ek.patlama, kesme: !!ek.kesme, sinir: ek.sinir || Math.max(AYAR.ates.azami, 6) } : _atesEkleOpt;
    return atesYak(x, y, r, sure, sahip || 'dusman', opt);
  }
  function atesYerVar() { // havadaki düşman çömlekleri + birikintiler en çok 'azami'
    var n = atesler.length;
    for (var i = 0; i < mListe.length; i++) if (mListe[i].tur === 'comlek' && !mListe[i].olu) n++;
    return n < AYAR.ates.azami;
  }
  // Yakıcı ölüm patlaması kuyruğu: hasarVer/oldur içinden değil, karenin sonunda işlenir (zincir güvenli)
  function patlamaEkle(x, y) {
    var p = patlamaK[patlamaKN] || (patlamaK[patlamaKN] = { x: 0, y: 0 });
    p.x = x; p.y = y; patlamaKN++;
  }
  function patlamalariIsle() {
    var AT = AYAR.ates, P = oyuncu(), sinir = 0;
    for (var k = 0; k < patlamaKN && sinir < 40; k++, sinir++) {
      var px = patlamaK[k].x, py = patlamaK[k].y;
      atesYak(px, py, AT.olumR, AT.olumSure, 'oyuncu', { patlama: true });
      var R = AT.olumMenzil;
      for (var i = liste.length - 1; i >= 0; i--) {
        var d = liste[i]; if (!d || d.olu || d.tur === 'dev' || d.tur === 'vargor' || d.devMi || !AYAR[d.tur]) continue;
        var dx = d.x - px, dy = d.y - py, rr = R + (d.r || 20) * 0.5;
        if (dx * dx + dy * dy > rr * rr) continue;
        var a = Math.atan2(dy, dx);
        var s = hasarVer(d, AT.olumHasar, { aci: a, guc: 260, tur: 'patlama' }); // ölürse Yakıcı → kuyruğa eklenir (zincir)
        emit('vurus', { hedef: d, x: d.x, y: d.y, aci: a, guc: 260, tur: 'patlama', oldurdu: !!(s && s.oldu), agir: false, zirhli: !!(s && s.zirhli), zirhKirildi: !!(s && s.zirhKirildi) });
      }
      if (P && P.hasarAl) {
        var ox = P.x - px, oy = P.y - py, orr = R + (P.r || 18) * 0.5;
        if (ox * ox + oy * oy <= orr * orr) { try { P.hasarAl(AT.olumHasar, { x: px, y: py, aci: Math.atan2(oy, ox), guc: 300, kaynak: 'patlama' }); } catch (e) { console.error(e); } }
      }
    }
    patlamaKN = 0;
  }
  function atesGuncelle(dt) {
    var AT = AYAR.ates;
    for (var i = atesler.length - 1; i >= 0; i--) { atesler[i].t += dt; if (atesler[i].t >= atesler[i].sure) atesSil(i); }
    // oyuncu: 0,25 sn'de bir oyuncuTik (atılmada yanmaz: OYUNCU.yanmaAl reddeder)
    var P = oyuncu();
    if (P && P.yanmaAl && atesler.length && atesIcinde(P.x, P.y, false, -(P.r || 18) * 0.3)) {
      atesPT += dt;
      while (atesPT >= AT.tik) { atesPT -= AT.tik; try { P.yanmaAl(AT.oyuncuTik, { kaynak: 'ates' }); } catch (e) { console.error(e); } }
    } else atesPT = 0.15; // içeri girince ilk yanma 0,1 sn sonra
    // düşmanlar
    if (!atesler.length) return;
    for (var j = liste.length - 1; j >= 0; j--) {
      var d = liste[j]; if (!d || d.olu || d.tur === 'dev' || d.tur === 'vargor' || d.devMi || !AYAR[d.tur]) continue;
      if (!d.girdi) continue;
      var f = atesIcinde(d.x, d.y, d.tur === 'yakici', -(d.r || 20) * 0.3);
      if (!f) { d._yanT = 0.15; continue; }
      d._yanT = (d._yanT == null ? 0.15 : d._yanT) + dt;
      while (d._yanT >= AT.tik && !d.olu) { d._yanT -= AT.tik; hasarVer(d, AT.dusmanTik, { aci: Math.atan2(d.y - f.y, d.x - f.x), guc: 0, tur: 'ates', sahip: f.sahip }); }
    }
  }

  // goblin halkası: bekleyen goblinleri barbarın çevresine, şimdiki açı sıralarını bozmadan eşit aralıkla dağıt
  // (hepsi tek noktaya yığılıp birbirinin içinde titremesin; kimse ötekinin üstünden geçmez)
  function goblinDagit(P) {
    var g = _gobs; g.length = 0;
    for (var i = 0; i < liste.length; i++) {
      var d = liste[i];
      if (d.tur !== 'goblin' || d.olu || !d.girdi) continue; // saldıranlar da sayılır (sayı değişip herkes kaymasın), yerleri değişmez
      d._ga = Math.atan2(d.y - P.y, d.x - P.x); g.push(d);
    }
    var n = g.length; if (n < 2) { if (n === 1) g[0].halkaR = 0; return; }
    g.sort(function (a, b) { return a._ga - b._ga; });
    var adim = Math.PI * 2 / n, sx = 0, sy = 0;
    for (var j = 0; j < n; j++) { var f = g[j]._ga - adim * j; sx += Math.cos(f); sy += Math.sin(f); }
    var faz = Math.atan2(sy, sx);
    var R = Math.max(AYAR.goblin.halka, n * AYAR.kalabalik.aralik / (Math.PI * 2));
    for (var k = 0; k < n; k++) {
      var hedef = faz + adim * k;
      // yeni yer şimdikine yakın: en çok ~0,9 rad kaydır (birden karşı tarafa koşmasın)
      if (g[k].durum !== 'yaklas') continue;
      var df = aciFark(hedef, g[k]._ga);
      g[k].slot = g[k]._ga + OYUN_sinirla(df, -AYAR.kalabalik.kayEn, AYAR.kalabalik.kayEn);
      g[k].halkaR = R;
    }
  }

  var hariciSprite = Object.create(null);
  function spritePaketi(tur) {
    if (tur === 'goblin' && window.OYUN && OYUN.bolum === 3 && window.VARLIK && VARLIK.var('ayaz_goblin')) {
      return 'ayaz_goblin';
    }
    return tur;
  }
  function spriteYap(tur, paket) {
    if (hariciSprite[tur]) return hariciSprite[tur]();
    var s = null;
    var sec = {};
    try {
      if (window.VARLIK && VARLIK.yerTutucu && VARLIK.yerTutucu(paket)) {
        if (tur === 'infazci') sec.olcek = 1.45;
        else if (tur === 'baskinci') sec.olcek = 1.2;
      }
      if (window.VARLIK && VARLIK.sprite) s = VARLIK.sprite(paket, sec);
    } catch (e) { console.error(e); }
    if (!s) { // en kötü durum: çekirdek yok
      if (!window.PIXI) return { x: 0, y: 0, visible: true, alpha: 1, oynat: function () {}, renk: function () {}, sil: function () {} };
      s = new PIXI.Graphics(); s.beginFill(0x884444).drawEllipse(0, -20, 14, 20).endFill();
      s.oynat = function () {}; s.renk = function (t) { this.tint = t; }; s.sil = function () { this.destroy(); };
    }
    return s;
  }
  // İnfazcı zırh göstergesi: sprite üstünde demir kalkan rozeti + zırh çubuğu (zırh kırılınca kısa solup gizlenir)
  function zirhGuncelle(d) {
    if (!d || !d.sprite) return;
    if ((d.tur !== 'infazci' && d.tur !== 'buz_muhafiz') || d.olu) { if (d.zirhG) d.zirhG.visible = false; return; }
    if (!window.PIXI || typeof d.sprite.addChild !== 'function') return;
    var g = d.zirhG;
    if (!g) {
      g = d.zirhG = new PIXI.Graphics();
      // kalkan rozeti (sol)
      g.lineStyle(2, 0x08070a, 1);
      g.beginFill(0x9fb2c4);
      g.drawPolygon([-23, -6, -13, -6, -13, 1, -18, 6, -23, 1]);
      g.endFill();
      g.lineStyle(0);
      g.beginFill(0xe8f2fa, 0.85);
      g.drawPolygon([-21, -4.5, -15, -4.5, -15, -1, -21, -1]);
      g.endFill();
      // zırh çubuğu (sağ)
      g.lineStyle(1.8, 0x08070a, 1);
      g.beginFill(0x161a20);
      g.drawRoundedRect(-10, -4, 34, 8, 2);
      g.endFill();
      g.lineStyle(0);
      g.beginFill(0xb0c2d4);
      g.drawRect(-8.5, -2.5, 31, 5);
      g.endFill();
      g.beginFill(0xeef6ff, 0.75);
      g.drawRect(-8.5, -2.5, 31, 2);
      g.endFill();
      g.y = d.sprite.yerTutucu ? -((d.sprite.boy || 110) + 14) : -148;
      d.sprite.addChild(g);
    }
    if (d.zirh > 0) {
      g.visible = true; g.alpha = 1; g.tint = 0xffffff;
      var pk = d.parla > 0 ? Math.min(1, d.parla / AYAR.parlama) : 0;
      g.scale.set(1 + 0.14 * pk);
    } else if (d.zirhKirT > 0) {
      g.visible = true; g.tint = 0xff9a40; g.alpha = Math.min(1, d.zirhKirT / 0.45);
      g.scale.set(1 + 0.25 * (1 - g.alpha));
    } else {
      g.visible = false;
    }
  }
  // yön histerezisi: bakış açısı mevcut yön diliminin ortasından ~40° uzaklaşmadan ve soğuma süresi dolmadan sprite yönü değişmez
  function yonH(d) {
    var h = yonu(d.aci);
    if (d.yonS == null) { d.yonS = h; return h; }
    var simdi = (window.OYUN && OYUN.zaman) ? OYUN.zaman.t : 0;
    // saldırı/nişan/blok sırasında daha hızlı tepki (0.12 sn), yürürken çeyrek saniyede geri dönmeyi önlemek için 0.40 sn
    var saldiriAn = d.durum === 'cek' || d.durum === 'at' || d.durum === 'buyu' || d.durum === 'sifa' || d.durum === 'hazirlik' || d.durum === 'sicra' || d.durum === 'yakin' || d.kalkanAnimT > 0;
    var soguma = saldiriAn ? 0.12 : 0.40;
    var fark = Math.abs(aciFark(d.aci, YON_ACI[d.yonS]));
    var esik = saldiriAn ? Math.PI / 8 + 0.12 : Math.PI / 8 + 0.3;
    var sogumada = simdi - (d.yonZ || -9) < soguma && simdi >= (d.yonZ || -9);
    if (h !== d.yonS && (fark > Math.PI / 3 || (fark > esik && !sogumada))) { d.yonS = h; d.yonZ = simdi; }
    return d.yonS;
  }
  function oynat(d, anim, ops) {
    var s = d.sprite; if (!s || !s.oynat) return;
    try { s.oynat(anim, yonH(d), ops || {}); } catch (e) { /* anim yoksa sessiz geç */ }
  }
  // paketteki anim tanımı (n, fps, isteğe bağlı vurus/adim)
  function animTanim(d, ad) {
    var s = d.sprite; if (!s) return null;
    try { if (s._animTanim) return s._animTanim(ad); } catch (e) {}
    return null;
  }
  function vurusKare(a, varsayilan) {
    if (!a) return 1;
    if (a.vurus != null && isFinite(a.vurus)) return Math.max(0.5, Math.min(a.n, a.vurus + 0.5)); // hasar vuruş karesinin ortasında (kare ekranda)
    return Math.max(1, Math.min(a.n, varsayilan != null ? varsayilan : Math.round(a.n * 0.55)));
  }
  // vuruş karesi tam 'sure' sn sonra gelsin
  function hazirlikHiz(d, ad, sure, varsayilanKare) {
    var a = animTanim(d, ad); if (!a || !a.fps || !(sure > 0)) return 1;
    return kareSinir(a, OYUN_sinirla((vurusKare(a, varsayilanKare) / a.fps) / sure, 0.3, 3));
  }
  // vuruştan sonra kalan kareler 'sure' sn'de bitsin
  function toparlanHiz(d, ad, sure, varsayilanKare) {
    var a = animTanim(d, ad); if (!a || !a.fps || !(sure > 0)) return 1;
    var kalan = Math.max(1, a.n - vurusKare(a, varsayilanKare));
    return kareSinir(a, OYUN_sinirla((kalan / a.fps) / sure, 0.4, 3));
  }
  // saldırı hazırlığı: vuruştan hemen önceki okunaklı pozda kısa bir bekleme tutar
  function anticipationHiz(d, ad, sure, t, tutOran, varsayilanKare) {
    var a = animTanim(d, ad); if (!a || !a.fps || !(sure > 0)) return 1;
    var tutT = sure * (tutOran || 0.8);
    if (t < tutT) {
      var hedefKare = Math.max(1, vurusKare(a, varsayilanKare) - 1);
      return kareSinir(a, OYUN_sinirla((hedefKare / a.fps) / Math.max(0.05, tutT), 0.3, 3));
    }
    var s = d.sprite;
    var esikKare = Math.max(0, Math.floor(vurusKare(a, varsayilanKare)) - 1);
    if (s && s.kare >= esikKare) return 0.05;
    return kareSinir(a, OYUN_sinirla((1 / a.fps) / Math.max(0.04, sure - tutT), 0.3, 3));
  }
  function OYUN_sinirla(v, a, b) { return v < a ? a : v > b ? b : v; }
  // döngülü animasyonu rastgele bir karede başlat (herkes aynı adımı atmasın)
  function fazKaydir(d) {
    var s = d.sprite; if (!s || !s._a || s.yerTutucu) return;
    try { var n = s._a.n || 1; s._t = rast(0, n - 0.01); s.kare = s._t | 0; s._ciz(); } catch (e) {}
  }
  // yürüme/durma: gerçek hıza göre (histerezisli), saldırı animasyonu bitmeden bozmaz
  function yurumeAnim(d, yuruyor) {
    if (d.kilitT > 0) return;
    var s = d.sprite, simdi = s && s.anim;
    var v = d.vHiz || 0;
    var yuru = simdi === 'yuru' ? (yuruyor && v > 9) : (yuruyor && v > 24);
    if (yuru) oynat(d, 'yuru');
    else if (simdi !== 'dur') { oynat(d, 'dur'); fazKaydir(d); }
    else oynat(d, 'dur');
  }
  function renk(d, t) { var s = d.sprite; if (s && s.renk) { try { s.renk(t); } catch (e) {} } }
  // hasar parlaması: gerçek sprite'ta toplamalı (ADD) beyaz kopya; yer tutucuda renk
  function parlat(d) {
    var s = d.sprite, k = d.parla > 0 ? Math.min(1, d.parla / AYAR.parlama) : 0;
    if (!s) return;
    if (s.yerTutucu !== false || !s.g || !window.PIXI) { renk(d, k > 0 ? 0xffb0b0 : 0xffffff); return; }
    var p = d.parlaS;
    if (k <= 0) { if (p) p.visible = false; return; }
    if (!p) {
      p = d.parlaS = new PIXI.Sprite(s.g.texture); p.blendMode = PIXI.BLEND_MODES.ADD; s.addChild(p);
    }
    var g = s.g;
    p.texture = g.texture; p.x = g.x; p.y = g.y; p.scale.copyFrom(g.scale); p.anchor.copyFrom(g.anchor); p.rotation = g.rotation;
    p.visible = true; p.alpha = 0.85 * k;
  }

  function sahneyeKoy(s) {
    var k = katman('varlik');
    if (k && s.parent !== k) k.addChild(s);
    s.visible = true; s.alpha = 1;
  }
  function sahnedenAl(s) {
    if (!s) return;
    s.visible = false;
    if (s.parent) s.parent.removeChild(s);
  }

  function dogur(tur, x, y, secenek) {
    var A = AYAR[tur]; if (!A) { console.warn('DUSMAN.dogur: bilinmeyen tür', tur); return null; }
    secenek = secenek || {};
    var paket = spritePaketi(tur);
    var hv = havuz[paket] || (havuz[paket] = []);
    var d = hv.pop();
    if (!d) d = { tur: tur, paketAd: paket, sprite: spriteYap(tur, paket) };
    var canC = secenek.can || A.can;
    d.id = ++sayac; d.tur = tur; d.x = x; d.y = y; d.r = A.r; d.can = canC; d.canMax = canC;
    d.hiz = A.hiz * (secenek.hizCarpan || rast(0.92, 1.08)); d.aci = secenek.aci != null ? secenek.aci : Math.PI / 2;
    d.sersem = 0; d.olu = false; d.vx = 0; d.vy = 0; d.savrulma = 0; d.carpanlar = null;
    d.durum = 'yaklas'; d.t = 0; d.bekle = rast(0.3, 1.2); d.parla = 0; d.hop = 0;
    d.hedefAci = d.aci; d.kilitAci = d.aci; d.saldiriyor = false; d.vurdu = false;
    d.kanat = rast(-1.5, 1.5); d.slot = null; d.yanYon = rast(0, 1) < 0.5 ? -1 : 1; d.yanT = rast(1, 3);
    d.sifaT = tur === 'saman' ? rast(1.5, A.sifaAra) : 0;
    d.kalkanKapali = 0; d.kalkanAci = tur === 'kalkanli' ? d.aci : undefined;
    d.cesetT = 0; d.uyandi = !secenek.uyku; d.girdi = false; d.kalkanAnimT = 0;
    d.yonS = null; d.vHiz = d.hiz; d.kilitT = 0; d.esne = 0; d.esneAci = 0; d.disT = 0; d.kose = 0; d.kacisT = 0;
    d.kacisX = 0; d.kacisY = 0; d.animOran = rast(0.94, 1.06);
    d.avx = 0; d.avy = 0; d.yuruyor = false; d.yuzHareket = false; d.yuzT = 0;
    d._sx = null; d._sy = null; d.cekX = 0; d.cekY = 0;
    d.halkaR = 0; d.havaT = 0; d.havaH = 0; d.engel = false; d.kacCD = rast(0.5, 1.5); d.bagT = 0; d.bag = null;
    d._yanT = 0.15; d._elde = false; d.vurBekle = 0; d.hx = x; d.hy = y;
    d.agir = !!A.agir;
    d.zirh = secenek.zirh != null ? secenek.zirh : (A.zirh || 0);
    d.zirhMax = d.zirh; d.zirhKirT = 0; d._zirhliVurus = false; d._zirhKirildiVurus = false;
    d.saldiriTur = null; d.komboSay = 0; d.atilBekle = tur === 'baskinci' ? rast(0.2, 0.7) : 0;
    if (tur === 'yakici') d.bekle = rast(1.2, 2.0); // girer girmez çömlek yağdırmasın
    else if (tur === 'baskinci') d.bekle = rast(0.25, 0.75);
    // kilitli arenada dışarıda doğanlar kenarda beklemesin: doğrudan görünür arena sınırının hemen içine yerleştir
    if (window.BOLUM && BOLUM.arenaKilitli && !(window.DEV && DEV.aktif)) {
      var Ba = alanAl(d, d.y, true);
      var ax = Ba.sol + 6 <= Ba.sag - 6 ? OYUN_sinirla(d.x, Ba.sol + 6, Ba.sag - 6) : (Ba.sol + Ba.sag) * 0.5;
      var ay = Ba.ust + 6 <= Ba.alt - 6 ? OYUN_sinirla(d.y, Ba.ust + 6, Ba.alt - 6) : (Ba.ust + Ba.alt) * 0.5;
      var gk0 = gostergeKose(), gx = gk0.x, gy = gk0.y;
      if (ax < gx && ay > gy && gx <= Ba.sag) {
        if (gx - ax < ay - gy) ax = Math.min(Ba.sag - 6, gx + 6);
        else ay = Math.max(Ba.ust + 6, gy - 6);
      }
      if (ax !== d.x || ay !== d.y) {
        d.x = ax; d.y = ay; d._isin = true;
        var Pa = oyuncu();
        if (Pa && secenek.aci == null) d.aci = Math.atan2(Pa.y - d.y, Pa.x - d.x);
      }
      d.girdi = true; d._bIcerde = true;
    }
    sahneyeKoy(d.sprite);
    zirhGuncelle(d);
    d.sprite.x = d.x; d.sprite.y = d.y; d.sprite.zEk = 0; d.sprite.rotation = 0;
    renk(d, 0xffffff); parlat(d);
    oynat(d, 'yuru', { dongu: true, bastan: true });
    fazKaydir(d);
    if (d.sprite.adimla) d.sprite.adimla(d, 0, yonH(d));
    liste.push(d);
    return d;
  }

  function saldiriBirak(d) { if (d.saldiriyor) { d.saldiriyor = false; saldiranSay = Math.max(0, saldiranSay - 1); } }
  function saldiriAl(d) {
    if (d.saldiriyor) return true;
    var sinir = window.OYUN && OYUN.bolum === 2 ? AYAR.kulEsZamanliSaldiri : AYAR.esZamanliSaldiri;
    if (saldiranSay >= sinir) return false;
    d.saldiriyor = true; saldiranSay++; return true;
  }

  function canEksilt(d, miktar) {
    var once = d.can;
    d.can -= miktar;
    if (miktar > 0 && once > 0) emit('dusmanHasar', { hedef: d, miktar: once - Math.max(0, d.can) });
  }

  function hasarVer(d, miktar, ops) {
    var hasOps = !!(ops && typeof ops === 'object');
    ops = hasOps ? ops : {};
    if (!d || d.olu) return { oldu: false, blok: false };
    if (typeof d.hasarAl === 'function') return d.hasarAl(miktar, ops) || { oldu: false, blok: false };
    var A = AYAR[d.tur] || {};
    var aci = ops.aci != null ? ops.aci : Math.atan2(d.y - (window.OYUNCU ? OYUNCU.y : d.y), d.x - (window.OYUNCU ? OYUNCU.x : d.x));
    var guc = ops.guc || 0, tur = ops.tur || 'savur';
    var ofkeli = !!(ops.ofkeli || (window.OYUNCU && OYUNCU.ofkeli));
    var agir = !!ops.agir;
    // ateş birikintisi / tutuşma: sersemletmez, itmez, saldırıyı bozmaz; yalnız can + hafif parlama
    if (tur === 'ates') {
      canEksilt(d, miktar); d.parla = Math.max(d.parla || 0, AYAR.parlama * 0.5);
      if (d.can <= 0) { oldur(d, aci, 0, false, ops.sahip === 'oyuncu'); return { oldu: true, blok: false }; }
      return { oldu: false, blok: false };
    }
    d._zirhliVurus = false; d._zirhKirildiVurus = false;
    var zirhKiran = agir || ofkeli || tur === 'balta' || tur === 'varil' || !!ops.varil;
    var baskinciKesici = zirhKiran || tur === 'atilma' || tur === 'sekme' || tur === 'patlama';
    // KESME (19 Kasım balta turu + Bölüm II kesilebilir hazırlıklar)
    var kesme = (tur === 'balta' && ((d.tur === 'okcu' && d.durum === 'cek') || (d.tur === 'saman' && (d.durum === 'buyu' || d.durum === 'sifa')) || (d.tur === 'yakici' && d.durum === 'at'))) ||
                (d.tur === 'baskinci' && (d.durum === 'hazirlik' || d.durum === 'sicra') && baskinciKesici) ||
                (d.tur === 'infazci' && d.durum === 'hazirlik' && zirhKiran);
    // YAKICI: çömlek baş üstündeyken baltayla vurulursa çömlek ELİNDE patlar (kendine hasar + ayağının dibinde ateş)
    if (d.tur === 'yakici' && d.durum === 'at' && (tur === 'balta' || tur === 'savur' || tur === 'atilma' || tur === 'sekme')) {
      kesme = true; d._elde = true;
      miktar += A.kesmeHasar;
      atesYak(d.x, d.y + 4, AYAR.ates.r, AYAR.ates.sure, 'oyuncu', { kesme: true });
      emit('mermiVur', { tur: 'comlek', x: d.x, y: d.y, yer: true, elde: true });
      if (yakAktif > 0) yakAktif--;
    }

    var kirildi = false, yandan = false, zirhli = false, zirhKirildi = false;
    // İnfazcı zırhı: normal hafif saldırılar %50 hasar + zirhli:true; ağır/öfkeli/balta/varil zırhı kırar
    var buzZirh = d.tur === 'buz_muhafiz' && d.zirh > 0;
    var buzOn = buzZirh && Math.abs(aciFark(aci + Math.PI, d.aci)) < 1.24;
    var buzAcik = buzZirh && (d.durum === 'toparlan' || !buzOn);
    if ((d.tur === 'infazci' && d.zirh > 0) || (buzZirh && (buzOn || zirhKiran))) {
      if (zirhKiran && (!buzZirh || buzAcik)) {
        d.zirh = 0; zirhKirildi = true; d.zirhKirT = 0.45; d._zirhKirildiVurus = true;
        zirhGuncelle(d);
        emit('zirhKir', { hedef: d, x: d.x, y: d.y - 40, aci: aci, tur: tur });
      } else if (!buzZirh || !buzAcik) {
        miktar *= buzZirh ? 0.28 : 0.5;
        zirhli = true; d._zirhliVurus = true;
        if (hasOps) ops.zirhli = true;
      }
    }
    // kalkan
    if (d.tur === 'kalkanli' && d.kalkanKapali <= 0 && d.sersem <= 0 && d.durum !== 'toparlan' && (tur === 'savur' || tur === 'sekme' || tur === 'balta')) {
      var gelis = aci + Math.PI; // düşmandan saldırgana doğru
      if (Math.abs(aciFark(gelis, d.aci)) < A.kalkanYay) {
        if (tur === 'savur' || tur === 'sekme') {
          if (agir || ofkeli) { // kalkan açılır, vuruş yine de işler
            d.kalkanKapali = A.kalkanAcik; d.sersem = A.agirSersem; d.kalkanAci = undefined;
            d.kilitT = 0; d.kacisT = 0; d.kalkanAnimT = 0; d.yuruyor = false;
            durumSifirla(d);
            emit('blok', { x: d.x, y: d.y - 30, aci: aci, kirildi: true, hedef: d });
            kirildi = true;
          } else {
            itil(d, aci, Math.min(guc, 400) * 0.3);
            d.parla = 0; d.esne = 0.6; d.esneAci = aci;
            oynat(d, 'kalkan', { dongu: false, bastan: true });
            d.kalkanAnimT = 0.25;
            emit('blok', { x: d.x + Math.cos(d.aci) * d.r, y: d.y - 30 + Math.sin(d.aci) * d.r, aci: aci, hedef: d });
            return { oldu: false, blok: true };
          }
        }
      } else {
        yandan = true;
      }
    }

    var once = d.can;
    canEksilt(d, miktar);
    d.parla = AYAR.parlama;
    d.esne = 1; d.esneAci = aci; // her vuruşta kısa geri esneme (sersemlemeyen kalkanlı/zırhlıda da görünür)
    itil(d, aci, guc / (A.kutle || 1));
    // hafif düşman sert darbede yerden kısa kalkar (vuruş "oturur"); hop guncelle()'de yumuşakça iner
    var kalk = guc / (A.kutle || 1);
    if (kalk > AYAR.havaEsik) { d.havaH = Math.min(AYAR.havaEn, kalk * AYAR.havaOran); d.havaT = AYAR.havaSure; }
    if (d.can <= 0) {
      // parçalanma: ağır vuruş, sekme ölümü, aşırı güç ya da çok fazla hasar; öfkede yalnız bir kısmı (cesetler de görünsün)
      var parcala = agir || !!ops.parcala || guc >= AYAR.parcalaGuc || (miktar - once) >= d.canMax * AYAR.parcalaAsiri ||
                    (ofkeli && rast(0, 1) < AYAR.parcalaOfke);
      var ganimet = tur === 'savur' || tur === 'balta' || tur === 'atilma' || tur === 'sekme' || tur === 'carpma';
      oldur(d, aci, guc, parcala, ganimet);
      return { oldu: true, blok: false, parcala: parcala, kirildi: kirildi || zirhKirildi, kesme: kesme, zirhli: zirhli, zirhKirildi: zirhKirildi };
    }
    // sersemle, hazırlığı boz (kalkanlı: kalkan kırılırsa, ağır/öfkeli/atılma veya kalkan açısı dışından yandan/arkadan darbede bozulur)
    if (kirildi) {
      var ka = animTanim(d, 'sersem');
      var kh = ka && ka.fps ? kareSinir(ka, OYUN_sinirla((ka.n / ka.fps) / Math.max(0.15, d.sersem), 0.4, 2.5)) : 1;
      oynat(d, 'sersem', { dongu: false, bastan: true, hiz: kh });
      return { oldu: false, blok: false, kirildi: true };
    }
    var bozar = d.tur === 'kalkanli' ? (agir || ofkeli || tur === 'atilma' || yandan) :
                d.tur === 'baskinci' ? ((d.durum === 'hazirlik' || d.durum === 'sicra') ? baskinciKesici : true) :
                d.tur === 'infazci'  ? (d.durum === 'hazirlik' ? zirhKiran : (zirhKirildi || (d.zirh <= 0 && (zirhKiran || tur === 'atilma' || tur === 'savur')))) :
                buzZirh ? (zirhKirildi || (buzAcik && d.durum !== 'hazirlik')) : true;
    if (bozar) {
      d.sersem = Math.max(d.sersem, agir ? (A.sersem || 0.3) * 2 : (A.sersem || 0.3));
      if (zirhKirildi) {
        d.sersem = Math.max(d.sersem, A.zirhKirSersem || 0.9);
        try { OYUN.kamera.sars(5, 0.14); } catch (e) {}
      }
      // balta: kalkanlı dışındakiler en az kısa sersem; kesme olursa uzun sersem (saldırı durumSifirla ile iptal)
      if (tur === 'balta' && d.tur !== 'kalkanli') d.sersem = Math.max(d.sersem, kesme ? AYAR.baltaKesmeSersem : AYAR.baltaSersem);
      if (kesme && d.tur === 'baskinci') d.sersem = Math.max(d.sersem, (A.sersem || 0.3) * 2.2);
      if (d._elde) d.sersem = Math.max(d.sersem, AYAR.baltaKesmeSersem); // çömlek elinde patladı: her vuruş türünde uzun sersem
      if (d.tur === 'kalkanli') d.kalkanAci = undefined;
      durumSifirla(d);
      d.kilitT = 0; d.kacisT = 0;
      // sersem animasyonu sersemlik süresine yayılır (kısa paketlerde bir an görünüp kaybolmasın)
      // sersem (geri esneme) her zaman vurana dönük oynar: darbe yönüyle uyumlu
      if (aci != null && isFinite(aci) && d.tur !== 'kalkanli') {
        d.aci = aci + Math.PI; d.yonS = yonu(d.aci);
        d.yonZ = (window.OYUN && OYUN.zaman) ? OYUN.zaman.t : 0;
      }
      var sa = animTanim(d, 'sersem');
      var sh = sa && sa.fps ? kareSinir(sa, OYUN_sinirla((sa.n / sa.fps) / Math.max(0.15, d.sersem), 0.5, 2.5)) : 1;
      oynat(d, 'sersem', { dongu: false, bastan: true, hiz: sh });
    }
    d._elde = false;
    return { oldu: false, blok: false, kesme: kesme && bozar, zirhli: zirhli, zirhKirildi: zirhKirildi, kirildi: kirildi || zirhKirildi };
  }

  function itil(d, aci, guc) {
    if (!guc) return;
    d.vx += Math.cos(aci) * guc; d.vy += Math.sin(aci) * guc;
    if (guc >= AYAR.savrulmaCarpma) { d.savrulma = 0.45; d.carpanlar = d.carpanlar || {}; }
  }

  function durumSifirla(d) {
    saldiriBirak(d);
    d.durum = 'yaklas'; d.t = 0; // hop (sıçrama yüksekliği) birden sıfırlanmaz, guncelle() yumuşakça indirir
    d.saldiriTur = null; d.komboSay = 0;
    d.bekle = Math.max(d.bekle, rast(0.4, 0.9));
  }

  function oldur(d, aci, guc, parcala, ganimet) {
    d.olu = true; d.can = 0; saldiriBirak(d);
    if (d.zirhG) d.zirhG.visible = false;
    var i = liste.indexOf(d); if (i >= 0) liste.splice(i, 1);
    emit('olum', { hedef: d, tur: d.tur, x: d.x, y: d.y, aci: aci, guc: guc, parcala: !!parcala, ganimet: ganimet });
    if (d.tur === 'yakici') patlamaEkle(d.x, d.y); // belindeki çömlekler patlar (karenin sonunda: ateş + çevreye hasar, zincir)
    if (parcala) { geriVer(d); return; }
    d.parla = 0; parlat(d); renk(d, 0xffffff); d.hop = 0; d.esne = 0; d.kilitT = 0;
    if (d.sprite) { d.sprite.zEk = -40; d.sprite.rotation = 0; }
    // vuranın yönüne dönüp geriye (savrulma yönüne) düşer
    if (aci != null && isFinite(aci)) {
      d.aci = aci + Math.PI; d.yonS = yonu(d.aci);
      d.yonZ = (window.OYUN && OYUN.zaman) ? OYUN.zaman.t : 0;
    }
    oynat(d, 'ol', { dongu: false, bastan: true, hiz: rast(0.9, 1.1) });
    d.cesetT = 0; d.vx *= 0.6; d.vy *= 0.6;
    cesetler.push(d);
    if (cesetler.length > AYAR.cesetUst) {
      for (var k = 0; k < cesetler.length - AYAR.cesetUst; k++) cesetler[k].cesetT = Math.max(cesetler[k].cesetT, AYAR.cesetSure);
    }
  }

  function geriVer(d) {
    saldiriBirak(d);
    if (d.zirhG) d.zirhG.visible = false;
    sahnedenAl(d.sprite);
    var i = cesetler.indexOf(d); if (i >= 0) cesetler.splice(i, 1);
    if (d.paketAd) havuz[d.paketAd].push(d);
  }

  function sessizSil(d) { // ekranın altında kaldı: olaysız kaldır
    d.olu = true; var i = liste.indexOf(d); if (i >= 0) liste.splice(i, 1); geriVer(d);
  }

  function yakindakiler(x, y, r) {
    var c = [];
    for (var i = 0; i < liste.length; i++) {
      var d = liste[i]; if (d.olu) continue;
      var dx = d.x - x, dy = d.y - y, rr = r + (d.r || 0);
      if (dx * dx + dy * dy <= rr * rr) c.push(d);
    }
    return c;
  }

  // ---- davranışlar
  function yuruYon(d, tx, ty, hiz, dt) {
    var dx = tx - d.x, dy = ty - d.y, m = Math.sqrt(dx * dx + dy * dy);
    if (m < 2) return false;
    // hedefe yaklaşırken yavaşlayarak var (hedefin önünde ileri-geri sekip durmasın)
    var s = Math.min(m, Math.min(hiz, m * AYAR.varis) * dt);
    d.x += dx / m * s; d.y += dy / m * s;
    return true;
  }
  function bak(d, aci, hiz, dt) {
    if (hiz == null) { d.aci = aci; return; }
    var f = aciFark(aci, d.aci), m = hiz * dt;
    d.aci += Math.max(-m, Math.min(m, f));
  }

  function goblinGuncelle(d, dt, P, A) {
    var dx = P.x - d.x, dy = P.y - d.y, dist = Math.sqrt(dx * dx + dy * dy) || 1, aP = Math.atan2(dy, dx);
    switch (d.durum) {
      case 'yaklas': {
        d.bekle -= dt;
        if (d.slot == null) d.slot = Math.atan2(d.y - P.y, d.x - P.x) + d.kanat;
        // sırasını bekleyen halkada yavaşça yana süzülür (dağıtım sırayı korur, kimse donmaz)
        d.slot += d.yanYon * AYAR.kalabalik.gezinHiz * dt;
        var R = Math.max(A.halka, d.halkaR || 0) + (d.bekle > 0 ? 28 : 0); // sırası gelmeyen bir adım geride: iki katlı halka
        var hx = P.x + Math.cos(d.slot) * R, hy = P.y + Math.sin(d.slot) * R;
        var Bg = alanAl(d); // halka noktası ekran dışına düşerse içeride kalan en yakın noktaya git
        hx = hx < Bg.sol ? Bg.sol : hx > Bg.sag ? Bg.sag : hx; hy = hy < Bg.ust ? Bg.ust : hy > Bg.alt ? Bg.alt : hy;
        // uzaktayken önce yandan dolan: hedef noktaya doğrudan git, ayrışma düzeltir
        var hdx = hx - d.x, hdy = hy - d.y, hm = hdx * hdx + hdy * hdy, yp = AYAR.kalabalik.yerPay;
        if (hm > yp * yp * 4) d.yerde = false; else if (hm < yp * yp) d.yerde = true;
        var yurur = d.yerde ? false : yuruYon(d, hx, hy, d.hiz, dt);
        // bakış: guncelle() yürünen yöne (durunca oyuncuya) dönüş hızıyla çevirir
        yurumeAnim(d, yurur);
        var simdiT = (window.OYUN && OYUN.zaman) ? OYUN.zaman.t : 0;
        if (d.bekle <= 0 && dist < Math.max(A.menzil, (d.halkaR || 0) + 12) && gorunur(d.x, d.y, 10) &&
            gobAktif < AYAR.kalabalik.goblinSaldiri && !(simdiT - gobSonT < AYAR.kalabalik.goblinAra && simdiT >= gobSonT) && saldiriAl(d)) {
          gobAktif++; gobSonT = simdiT;
          d.durum = 'hazirlik'; d.t = 0; d.kilitAci = aP; d.kilitT = 0;
          // hazırlık: vur animasyonu sıçramadan hemen önce okunaklı pozda kısa süre bekler
          oynat(d, 'vur', { dongu: false, bastan: true, hiz: anticipationHiz(d, 'vur', A.hazirlik, 0, 0.75) });
        }
        break;
      }
      case 'hazirlik': // geri çekilip kısa bir an gerilerek atılmaya hazırlan
        d.t += dt;
        if (d.t < A.hazirlik * 0.75) {
          d.kilitAci = aP; bak(d, aP, AYAR.donusHiz * 1.2, dt);
          d.x -= Math.cos(aP) * 45 * dt; d.y -= Math.sin(aP) * 45 * dt;
        } else {
          bak(d, d.kilitAci, AYAR.donusHiz * 1.2, dt);
        }
        oynat(d, 'vur', { hiz: anticipationHiz(d, 'vur', A.hazirlik, d.t, 0.75) });
        d.hop = -4 * Math.min(1, d.t / (A.hazirlik * 0.75));
        if (d.t >= A.hazirlik) { d.durum = 'sicra'; d.t = 0; d.vurdu = false; oynat(d, 'atil', { dongu: false, bastan: true, hiz: hazirlikHiz(d, 'atil', A.sicraSure * 0.6) }); }
        break;
      case 'sicra': {
        d.t += dt; var k = d.t / A.sicraSure;
        d.x += Math.cos(d.kilitAci) * A.sicraHiz * dt; d.y += Math.sin(d.kilitAci) * A.sicraHiz * dt;
        d.hop = -Math.sin(Math.min(1, k) * Math.PI) * 18;
        if (!d.vurdu && dist < d.r + (P.r || 18) + 10) {
          d.vurdu = true;
          try { P.hasarAl(A.hasar, { x: d.x, y: d.y, aci: d.kilitAci, guc: 220, kaynak: d }); } catch (e) { console.error(e); }
        }
        // isabette atılma animasyonunun kalanı (toparlanma) oynasın; ıskada hemen geri dön
        if (d.t >= A.sicraSure || d.vurdu) { d.durum = 'geri'; d.t = 0; d.kilitT = d.vurdu ? 0.16 : 0; if (!d.vurdu) oynat(d, 'dur'); }
        break;
      }
      case 'geri': // 4. tur: arkasını dönmeden barbara bakarak iki kısa sekişle geri çekilir (ayak havada: kayma yok, yön zıplaması yok)
        d.t += dt;
        bak(d, aP, AYAR.donusHiz, dt);
        if (d.kilitT <= 0) { if (d.sprite && d.sprite.anim !== 'dur') { oynat(d, 'dur'); fazKaydir(d); } else oynat(d, 'dur'); }
        var gk = (d.t / (A.geriSure / AYAR.geriSekis)) % 1;
        d.hop = -Math.sin(gk * Math.PI) * AYAR.geriSekisH;
        d.x -= Math.cos(aP) * d.hiz * 0.8 * dt; d.y -= Math.sin(aP) * d.hiz * 0.8 * dt;
        if (d.t >= A.geriSure) {
          saldiriBirak(d); d.durum = 'yaklas'; d.bekle = rast(A.bekleMin, A.bekleMax);
          d.slot = Math.atan2(d.y - P.y, d.x - P.x) + rast(-0.9, 0.9);
        }
        break;
    }
  }

  // menzilli düşmanın (okçu, şaman) hareketi: uzak dur / yaklaş / yanlara süzül — hep görünür alanın içinde.
  // Kaçarken duvara gelirse duvar boyunca yana kayar; köşeye sıkışırsa 'kose' dolar → çağıran çare seçer.
  // dönüş: true ise köşede sıkıştı (çare zamanı)
  function menzilliHareket(d, dt, P, A, kacOran, yanOran) {
    var dx = P.x - d.x, dy = P.y - d.y, dist = Math.sqrt(dx * dx + dy * dy) || 1;
    var B = alanAl(d), pay = 26, mx = 0, my = 0, kac = false, hizC = 1;
    if (d.kacisT > 0) { // yer değiştirme atılışı
      d.kacisT -= dt; mx = d.kacisX; my = d.kacisY; hizC = AYAR.alan.kacisCarpan;
    } else if (dist < A.yakin) { mx = -dx / dist * kacOran; my = -dy / dist * kacOran; kac = true; }
    else if (dist > A.uzak) { mx = dx / dist; my = dy / dist; }
    else {
      d.yanT -= dt; if (d.yanT <= 0) { d.yanYon = -d.yanYon; d.yanT = rast(1.8, 3.6); }
      mx = -dy / dist * d.yanYon * yanOran; my = dx / dist * d.yanYon * yanOran;
    }
    // görüş dışındaki nişancı (kaçış atılışı değilse) önce görüşe doğru yürür; görüşe girmeden ateş etmez
    if (d.kacisT <= 0 && !gorusIci(d.x, d.y, 30)) {
      var gyn = gorusYon(d.x, d.y, 45);
      if (gyn.x) mx = gyn.x; if (gyn.y) my = gyn.y * 0.8;
      if (gyn.x && !gyn.y) my *= 0.3; else if (gyn.y && !gyn.x) mx *= 0.3;
      kac = false;
    }
    // duvara doğru olan bileşeni kes
    var solB = d.x <= B.sol + pay, sagB = d.x >= B.sag - pay, ustB = d.y <= B.ust + pay, altB = d.y >= B.alt - pay;
    var ilk = Math.sqrt(mx * mx + my * my);
    if ((mx < 0 && solB) || (mx > 0 && sagB)) mx = 0;
    if ((my < 0 && ustB) || (my > 0 && altB)) my = 0;
    var kalan = Math.sqrt(mx * mx + my * my), sikisti = false;
    if (kac && kalan < ilk * 0.45) {
      // duvar boyunca, oyuncudan uzağa kay
      if ((my === 0) && (ustB || altB)) {
        var sx = Math.abs(dx) > 12 ? (dx > 0 ? -1 : 1) : d.yanYon;
        if ((sx < 0 && solB) || (sx > 0 && sagB)) sx = -sx;
        if ((sx < 0 && solB) || (sx > 0 && sagB) || (Math.abs(dx) < 60 && ((sx < 0 && d.x < B.sol + 90) || (sx > 0 && d.x > B.sag - 90)))) sikisti = true;
        else mx = sx * kacOran;
      }
      if ((mx === 0) && (solB || sagB)) {
        var sy = Math.abs(dy) > 12 ? (dy > 0 ? -1 : 1) : d.yanYon;
        if ((sy < 0 && ustB) || (sy > 0 && altB)) sy = -sy;
        if ((sy < 0 && ustB) || (sy > 0 && altB)) sikisti = true;
        else { my = sy * kacOran; sikisti = false; }
      }
      // duvar boyunca kaçsa da oyuncu çok yakınsa yine sıkışmış say
      if (dist < A.yakin * 0.45) sikisti = true;
    }
    if (sikisti) d.kose += dt; else d.kose = Math.max(0, d.kose - dt * 0.5);
    d._yurudu = (mx !== 0 || my !== 0);
    d.x += mx * d.hiz * hizC * dt; d.y += my * d.hiz * hizC * dt;
    if (d.kose >= AYAR.alan.koseSure) { d.kose = 0; return true; }
    return false;
  }
  // köşeden kurtulma: oyuncunun yanından, alanı en geniş tarafa doğru kısa atılış
  function kacisBaslat(d, P) {
    var B = alanAl(d), dx = P.x - d.x, dy = P.y - d.y, m = Math.sqrt(dx * dx + dy * dy) || 1;
    var t1x = -dy / m, t1y = dx / m, en = -1e9, bx = t1x, by = t1y;
    for (var s = -1; s <= 1; s += 2) {
      // yana + biraz ileri (oyuncunun yanından geçer)
      var vx = t1x * s * 0.85 + dx / m * 0.5, vy = t1y * s * 0.85 + dy / m * 0.5, vm = Math.sqrt(vx * vx + vy * vy) || 1;
      vx /= vm; vy /= vm;
      var hx = d.x + vx * 220, hy = d.y + vy * 220;
      var puan = Math.min(hx - B.sol, B.sag - hx, hy - B.ust, B.alt - hy);
      if (puan > en) { en = puan; bx = vx; by = vy; }
    }
    d.kacisX = bx; d.kacisY = by; d.kacisT = AYAR.alan.kacisSure;
    d.bekle = Math.min(d.bekle, d.tur === 'saman' ? Math.max(1.2, d.bekle) : 0.35); // okçu kurtulunca hemen ateş etsin; şaman art arda büyü yağdırmasın
  }

  // atış hattı: okçu→barbar doğrusunda (yakınında) başka düşman var mı? Varsa o düşmanın hattın hangi yanında olduğu (+1/-1), yoksa 0.
  // Ayrıca yakındaki başka okçu/şamandan uzaklaşma yönü d._kx,d._ky'ye yazılır (birbirinin önüne/içine girmesinler).
  function hatEngel(d, P) {
    var O = AYAR.okcuAcik, dx = P.x - d.x, dy = P.y - d.y, L = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / L, uy = dy / L;
    var yan = 0, kx = 0, ky = 0;
    for (var i = 0; i < liste.length; i++) {
      var e = liste[i]; if (e === d || e.olu) continue;
      var ex = e.x - d.x, ey = e.y - d.y;
      if ((e.tur === 'okcu' || e.tur === 'saman' || e.tur === 'yakici') && ex * ex + ey * ey < O.komsu * O.komsu) {
        var em = Math.sqrt(ex * ex + ey * ey) || 1, kk = 1 - em / O.komsu; kx -= ex / em * kk; ky -= ey / em * kk;
      }
      if (yan) continue;
      var t = ex * ux + ey * uy; if (t < O.ara || t > L - O.ara) continue;
      var n = ex * -uy + ey * ux;
      if (Math.abs(n) < O.genislik + (e.r || 20) * 0.6) yan = n >= 0 ? 1 : -1;
    }
    d._kx = kx; d._ky = ky;
    return yan;
  }

  function komsuIt(d, dt) {
    if (!d._kx && !d._ky) return;
    var it = d.hiz * AYAR.okcuAcik.itme * dt;
    d.x += OYUN_sinirla(d._kx, -1, 1) * it; d.y += OYUN_sinirla(d._ky, -1, 1) * it;
    if (d._kx || d._ky) d._yurudu = true;
  }

  function okcuGuncelle(d, dt, P, A) {
    var dx = P.x - d.x, dy = P.y - d.y, dist = Math.sqrt(dx * dx + dy * dy) || 1, aP = Math.atan2(dy, dx);
    if (d.durum === 'cek') {
      d.t += dt;
      var ca = animTanim(d, 'cek');
      var cekHiz = anticipationHiz(d, 'cek', A.cek, d.t, 0.82, ca ? ca.n : 1);
      if (d.t < A.kilit) {
        d.kilitAci = aP;
        bak(d, d.kilitAci, AYAR.donusHiz * 1.2, dt);
      } else {
        bak(d, d.kilitAci, AYAR.donusHiz * 1.2, dt);
      }
      oynat(d, 'cek', { hiz: cekHiz });
      if (d.t >= A.cek) {
        var ux = Math.cos(d.kilitAci), uy = Math.sin(d.kilitAci);
        var uo = Math.max(20, Math.min(45, dist - 30));
        // çekerken görüşten çıktıysa (görüş barbarı izleyip kaydı) ok bırakılmaz: görmediğin yerden ok yok
        if (gorusIci(d.x, d.y, 0)) MERMI.at('ok', d.x + ux * uo, d.y + uy * uo * 0.55, d.kilitAci, { hiz: A.okHiz, hasar: A.hasar, sahip: 'dusman', kaynak: d, z: 60 }); // yayın önünden, omuz hizasından (resimden ölçüldü)
        d.durum = 'yaklas'; d.bekle = rast(A.bekleMin, A.bekleMax);
        // bırakma karesinden sonra kalan kareler (varsa) oynasın
        var sonHiz = (d.sprite && d.sprite._hiz > 0.2) ? d.sprite._hiz : 1;
        d.kilitT = (ca && ca.vurus != null && ca.n - 1 > ca.vurus) ? Math.min(0.4, (ca.n - 1 - ca.vurus) / (ca.fps * sonHiz)) : 0.12;
      }
      return;
    }
    if (d.durum === 'yakin') { // köşede sıkıştı: yay/dirsekle yakın vuruş
      var Y = AYAR.okcuYakin;
      d.t += dt;
      if (!d.vurdu) { bak(d, aP, AYAR.donusHiz * 1.2, dt); d.kilitAci = aP; }
      if (!d.vurdu && d.t >= Y.hazirlik) {
        d.vurdu = true;
        if (dist < Y.menzil + (P.r || 18) && Math.abs(aciFark(aP, d.kilitAci)) < Y.yay) {
          try { P.hasarAl(Y.hasar, { x: d.x, y: d.y, aci: aP, guc: Y.guc, kaynak: d }); } catch (e) { console.error(e); }
        }
        oynat(d, 'vur', { hiz: toparlanHiz(d, 'vur', Y.toparlan) });
      }
      if (d.t >= Y.hazirlik + Y.toparlan) { kacisBaslat(d, P); d.durum = 'yaklas'; }
      return;
    }
    d.bekle -= dt;
    // atış hattında dost varsa: onun ters yanına süzül, hat açılmadan çekme
    var engel = hatEngel(d, P);
    d.engel = !!engel;
    if (engel && d.kacisT <= 0) { d.yanYon = -engel; d.yanT = Math.max(d.yanT, 0.8); d.bekle = Math.max(d.bekle, 0.12); }
    var sikisti = menzilliHareket(d, dt, P, A, 1.05, 0.48);
    komsuIt(d, dt);
    yurumeAnim(d, d._yurudu); // bakış: guncelle() yürünen yöne çevirir
    if (sikisti) {
      if (dist < AYAR.okcuYakin.menzil + 40) {
        d.durum = 'yakin'; d.t = 0; d.vurdu = false; d.kilitT = 0;
        oynat(d, 'vur', { dongu: false, bastan: true, hiz: hazirlikHiz(d, 'vur', AYAR.okcuYakin.hazirlik) });
      } else kacisBaslat(d, P);
      return;
    }
    if (d.kacisT <= 0 && d.bekle <= 0 && dist < A.uzak + 140 && gorunur(d.x, d.y, 30) && menzilliAktif < AYAR.menzilliEsZaman) {
      menzilliAktif++;
      d.durum = 'cek'; d.t = 0; d.kilitAci = aP; d.kilitT = 0;
      // çekiş: bırakma karesi tam A.cek'te, öncesinde kısa tam-germe beklemesi
      var a = animTanim(d, 'cek');
      oynat(d, 'cek', { dongu: false, bastan: true, hiz: anticipationHiz(d, 'cek', A.cek, 0, 0.82, a ? a.n : 1) });
    }
  }

  function kalkanliGuncelle(d, dt, P, A) {
    var dx = P.x - d.x, dy = P.y - d.y, dist = Math.sqrt(dx * dx + dy * dy) || 1, aP = Math.atan2(dy, dx);
    if (d.kalkanKapali > 0) d.kalkanKapali -= dt;
    if (d.kalkanAnimT > 0) d.kalkanAnimT -= dt;
    switch (d.durum) {
      case 'yaklas': {
        d.bekle -= dt;
        bak(d, aP, A.donus, dt);
        var yurudu = false;
        // eşikte dur-kalk titremesin: yürürken menzil*0.7'ye kadar sürer, dururken menzil*0.8'i aşınca kalkar
        if (dist > A.menzil * (d.yuruyor ? 0.7 : 0.8)) { d.x += dx / dist * d.hiz * dt; d.y += dy / dist * d.hiz * dt; yurudu = true; }
        // öteki kalkanlılarla omuz omuza yığılmasın: yakındakinden yana açıl (barbarı yanlardan sarar)
        var kx = 0, ky = 0, KO = AYAR.kalkanAralik;
        for (var ki = 0; ki < liste.length; ki++) {
          var e = liste[ki]; if (e === d || e.olu || e.tur !== 'kalkanli') continue;
          var ex = d.x - e.x, ey = d.y - e.y, e2 = ex * ex + ey * ey;
          if (e2 < KO * KO && e2 > 0.01) { var em = Math.sqrt(e2), kk = 1 - em / KO; kx += ex / em * kk; ky += ey / em * kk; }
        }
        if (kx || ky) { var km = Math.sqrt(kx * kx + ky * ky), ks = Math.min(1, km) * d.hiz * 0.7 * dt; d.x += kx / km * ks; d.y += ky / km * ks; if (km > 0.3) yurudu = true; }
        d.yuruyor = yurudu;
        if (d.kalkanAnimT > 0) oynat(d, 'kalkan');
        else yurumeAnim(d, yurudu);
        if (d.bekle <= 0 && dist < A.menzil && gorunur(d.x, d.y, 10) && saldiriAl(d)) {
          d.durum = 'hazirlik'; d.t = 0; d.kilitAci = d.aci; d.kilitT = 0;
          // kaldırış yavaş ve okunur; vuruş öncesi kısa bekleme pozu
          oynat(d, 'vur', { dongu: false, bastan: true, hiz: anticipationHiz(d, 'vur', A.hazirlik, 0, 0.8) });
        }
        break;
      }
      case 'hazirlik':
        d.t += dt;
        if (d.t < A.hazirlik * 0.5) bak(d, aP, A.donus * 0.8, dt);
        if (d.kalkanAnimT <= 0) oynat(d, 'vur', { hiz: anticipationHiz(d, 'vur', A.hazirlik, d.t, 0.8) });
        d.kilitAci = d.aci;
        if (d.t >= A.hazirlik) {
          var f = Math.abs(aciFark(aP, d.kilitAci));
          if (dist < A.darbeMenzil + (P.r || 18) && f < A.darbeYay) {
            try { P.hasarAl(A.hasar, { x: d.x, y: d.y, aci: aP, guc: 420, kaynak: d }); } catch (e) { console.error(e); }
          }
          try { OYUN.kamera.sars(5, 0.15); } catch (e) {}
          d.durum = 'toparlan'; d.t = 0;
          oynat(d, 'vur', { hiz: toparlanHiz(d, 'vur', A.toparlan * 0.8) });
          d.kilitT = A.toparlan;
        }
        break;
      case 'toparlan':
        d.t += dt;
        if (d.t >= A.toparlan) { saldiriBirak(d); d.durum = 'yaklas'; d.bekle = rast(A.bekleMin, A.bekleMax); }
        break;
    }
    d.kalkanAci = (d.kalkanKapali > 0 || d.sersem > 0 || d.durum === 'toparlan') ? undefined : d.aci;
  }

  function samanGuncelle(d, dt, P, A) {
    var dx = P.x - d.x, dy = P.y - d.y, dist = Math.sqrt(dx * dx + dy * dy) || 1, aP = Math.atan2(dy, dx);
    if (d.durum === 'sifa' || d.durum === 'buyu') {
      d.t += dt;
      if (d.durum === 'buyu') {
        if (d.t < d.buyuSure * 0.78) { d.kilitAci = aP; bak(d, aP, AYAR.donusHiz * 1.2, dt); }
        else bak(d, d.kilitAci, AYAR.donusHiz * 1.2, dt);
        oynat(d, 'buyu', { hiz: anticipationHiz(d, 'buyu', d.buyuSure, d.t, 0.82) });
      }
      if (d.durum === 'sifa' && d.t >= A.sifaHazirlik) {
        var hedefler = [], ad = yakindakiler(d.x, d.y, A.sifaMenzil);
        ad.sort(function (a, b) { return (a.can / a.canMax) - (b.can / b.canMax); });
        for (var i = 0; i < ad.length && hedefler.length < A.sifaHedef; i++) {
          var h = ad[i]; if (h === d || h.tur === 'dev' || h.can >= h.canMax) continue;
          h.can = Math.min(h.canMax, h.can + Math.max(1, Math.round(h.canMax * A.sifaOran)));
          hedefler.push({ x: h.x, y: h.y, hedef: h });
        }
        if (hedefler.length) {
          emit('sifa', { x: d.x, y: d.y, hedefler: hedefler, kaynak: d });
          d.bag = hedefler.map(function (o) { return o.hedef; }); d.bagT = AYAR.sifaBag;
        }
        d.durum = 'yaklas'; d.sifaT = A.sifaAra; d.kilitT = buyuKalan(d);
      } else if (d.durum === 'buyu' && d.t >= d.buyuSure) {
        var ux = Math.cos(d.kilitAci), uy = Math.sin(d.kilitAci);
        var uc = Math.max(20, Math.min(85, dist - 30)); // yakındaki barbarın ardında doğmasın
        if (gorusIci(d.x, d.y, 0)) MERMI.at('buyu', d.x + ux * uc, d.y + uy * uc * 0.47, d.kilitAci, { hiz: A.buyuHiz, hasar: A.hasar, sahip: 'dusman', kaynak: d, z: 26 }); // asanın ucundan (büyü karesinde asa öne uzanır)
        d.durum = 'yaklas'; d.bekle = rast(A.bekleMin, A.bekleMax); d.kilitT = buyuKalan(d);
      }
      return;
    }
    d.bekle -= dt; d.sifaT -= dt; d.kacCD -= dt;
    // kaçınma: barbar yaklaşınca yana-geri sıçrayıp uzaklaşır (bekleme süreli; köşede değilse)
    if (dist < AYAR.samanKac.mesafe && d.kacCD <= 0 && d.kacisT <= 0) {
      var Bk = alanAl(d), tx = -dy / dist, ty = dx / dist, en = -1e9, bx = 0, by = 0;
      for (var sg = -1; sg <= 1; sg += 2) {
        var vx = tx * sg * 0.75 - dx / dist * 0.66, vy = ty * sg * 0.75 - dy / dist * 0.66;
        var hx = d.x + vx * 200, hy = d.y + vy * 200, pu = Math.min(hx - Bk.sol, Bk.sag - hx, hy - Bk.ust, Bk.alt - hy);
        if (pu > en) { en = pu; bx = vx; by = vy; }
      }
      d.kacCD = AYAR.samanKac.bekle;
      if (en > 20) { var bm = Math.sqrt(bx * bx + by * by) || 1; d.kacisX = bx / bm; d.kacisY = by / bm; d.kacisT = AYAR.alan.kacisSure; }
    }
    hatEngel(d, P); // yalnız komşu okçu/şamandan uzaklaşma yönü için
    var sikisti = menzilliHareket(d, dt, P, A, 1.0, 0.42);
    komsuIt(d, dt);
    yurumeAnim(d, d._yurudu); // bakış: guncelle() yürünen yöne çevirir
    if (sikisti) {
      // köşede: oyuncu dibindeyse hemen kısa büyü (yakından patlatır), değilse yana kaçış
      if (dist < 140 && gorunur(d.x, d.y, 0) && menzilliAktif < AYAR.menzilliEsZaman) { menzilliAktif++; buyuBasla(d, 'buyu', AYAR.samanKoseBuyu); return; }
      kacisBaslat(d, P); return;
    }
    if (d.kacisT > 0) return;
    if (d.sifaT <= 0) {
      var yarali = false, ys = yakindakiler(d.x, d.y, A.sifaMenzil);
      for (var j = 0; j < ys.length; j++) if (ys[j] !== d && ys[j].tur !== 'dev' && ys[j].can < ys[j].canMax) { yarali = true; break; }
      if (yarali) { buyuBasla(d, 'sifa', A.sifaHazirlik); return; }
      d.sifaT = 0.5;
    }
    if (d.bekle <= 0 && dist < 650 && gorunur(d.x, d.y, 30) && menzilliAktif < AYAR.menzilliEsZaman) { menzilliAktif++; buyuBasla(d, 'buyu', A.buyuHazirlik); }
  }
  function buyuBasla(d, durum, sure) {
    d.durum = durum; d.t = 0; d.kilitT = 0; d.buyuSure = sure;
    var P = oyuncu();
    if (P) { d.kilitAci = Math.atan2(P.y - d.y, P.x - d.x); bak(d, d.kilitAci); }
    var h = durum === 'buyu' ? anticipationHiz(d, 'buyu', sure, 0, 0.82) : hazirlikHiz(d, 'buyu', sure);
    oynat(d, 'buyu', { dongu: false, bastan: true, hiz: h });
  }
  function buyuKalan(d) { // büyü salındıktan sonra animasyonun kalanı
    var a = animTanim(d, 'buyu'); if (!a || !a.fps) return 0.15;
    var h = (d.sprite && d.sprite._hiz > 0.2) ? d.sprite._hiz : 1;
    return Math.min(0.5, Math.max(0.1, (a.n - vurusKare(a)) / a.fps / h));
  }

  // ---- YAKICI: orta mesafede durur, çömlek atar (0,6 sn kaldırma = telgraf + kesme penceresi), yakına gelene meşale
  function yakiciGuncelle(d, dt, P, A) {
    var dx = P.x - d.x, dy = P.y - d.y, dist = Math.sqrt(dx * dx + dy * dy) || 1, aP = Math.atan2(dy, dx);
    if (d.durum === 'at') {
      d.t += dt;
      if (d.t < A.kilit) { // hedef barbarı izler, sonra sabitlenir (yerdeki halka = düşeceği alan)
        var hx = P.x, hy = P.y, ux = hx - d.x, uy = hy - d.y, um = Math.sqrt(ux * ux + uy * uy) || 1;
        if (um > A.menzilEn) { hx = d.x + ux / um * A.menzilEn; hy = d.y + uy / um * A.menzilEn; }
        d.hx = hx; d.hy = hy; d.kilitAci = Math.atan2(hy - d.y, hx - d.x);
      }
      bak(d, d.kilitAci, AYAR.donusHiz * 1.2, dt);
      oynat(d, 'at', { hiz: anticipationHiz(d, 'at', A.kaldir, d.t, 0.85) });
      if (d.t >= A.kaldir) {
        var cx = Math.cos(d.kilitAci), cy = Math.sin(d.kilitAci);
        // görüşten çıktıysa çömlek atılmaz (görmediğin yerden ateş yok)
        if (gorusIci(d.x, d.y, 0)) MERMI.at('comlek', d.x + cx * 16, d.y + cy * 8, d.kilitAci,
          { yay: { x: d.hx, y: d.hy, sure: A.ucus, yukseklik: A.ucusH, z0: 95 }, sahip: 'dusman', kaynak: d, hasar: 0 });
        d.durum = 'yaklas'; d.bekle = rast(A.bekleMin, A.bekleMax);
        var aa = animTanim(d, 'at'), sh = (d.sprite && d.sprite._hiz > 0.2) ? d.sprite._hiz : 1;
        d.kilitT = (aa && aa.fps && aa.vurus != null && aa.n - 1 > aa.vurus) ? Math.min(0.45, (aa.n - 1 - aa.vurus) / (aa.fps * sh)) : 0.2;
      }
      return;
    }
    if (d.durum === 'hazirlik') { // meşale vuruşu
      d.t += dt;
      if (!d.vurdu) { bak(d, aP, AYAR.donusHiz * 1.2, dt); d.kilitAci = d.aci; }
      if (!d.vurdu && d.t >= A.mesaleHazirlik) {
        d.vurdu = true;
        if (dist < A.mesaleMenzil + (P.r || 18) && Math.abs(aciFark(aP, d.kilitAci)) < A.mesaleYay) {
          var vurdu = false;
          try { vurdu = P.hasarAl(A.hasar, { x: d.x, y: d.y, aci: aP, guc: A.mesaleGuc, kaynak: d }) !== false; } catch (e) { console.error(e); }
          if (vurdu && P.tutus) { P.tutus(A.tutus); emit('tutus', { hedef: P, x: P.x, y: P.y, sure: A.tutus, mesale: true }); }
        }
        oynat(d, 'vur', { hiz: toparlanHiz(d, 'vur', A.mesaleToparlan) });
      }
      if (d.t >= A.mesaleHazirlik + A.mesaleToparlan) { saldiriBirak(d); d.durum = 'yaklas'; d.vurBekle = A.mesaleBekle; d.bekle = Math.max(d.bekle, 0.6); }
      return;
    }
    d.bekle -= dt; d.vurBekle -= dt;
    // dibine gelen barbara meşale
    if (dist < A.mesaleMenzil + 26 && d.vurBekle <= 0 && gorunur(d.x, d.y, 10) && saldiriAl(d)) {
      d.durum = 'hazirlik'; d.t = 0; d.vurdu = false; d.kilitT = 0; d.kilitAci = aP;
      oynat(d, 'vur', { dongu: false, bastan: true, hiz: hazirlikHiz(d, 'vur', A.mesaleHazirlik) });
      return;
    }
    hatEngel(d, P); // komşu nişancılardan açıl
    var sikisti = menzilliHareket(d, dt, P, A, 1.0, 0.45);
    komsuIt(d, dt);
    yurumeAnim(d, d._yurudu);
    if (sikisti) { kacisBaslat(d, P); return; }
    if (d.kacisT <= 0 && d.bekle <= 0 && dist > A.mesaleMenzil + 50 && dist < A.uzak + 120 && gorunur(d.x, d.y, 30) &&
        yakAktif < A.esZaman && atesYerVar()) {
      yakAktif++;
      d.durum = 'at'; d.t = 0; d.kilitT = 0; d.kilitAci = aP; d.hx = P.x; d.hy = P.y;
      oynat(d, 'at', { dongu: false, bastan: true, hiz: anticipationHiz(d, 'at', A.kaldir, 0, 0.85) });
    }
  }

  // ---- BASKINCI (Çift Baltalı Akıncı): yan kanattan (flank) hızlı yaklaşır, orta mesafede (150..290) sıçrayarak vurur, yakında hızlı vur kombosu
  function baskinciGuncelle(d, dt, P, A) {
    var dx = P.x - d.x, dy = P.y - d.y, dist = Math.sqrt(dx * dx + dy * dy) || 1, aP = Math.atan2(dy, dx);
    if (d.atilBekle > 0) d.atilBekle -= dt;
    switch (d.durum) {
      case 'yaklas': {
        d.bekle -= dt;
        d.yanT -= dt;
        if (d.yanT <= 0) { d.yanYon = -d.yanYon; d.yanT = rast(1.5, 2.8); }
        // Orta mesafe (150..290 px): yüksek kontrastlı amber çizgi telgrafı + atil sıçraması
        if (d.bekle <= 0 && d.atilBekle <= 0 && dist >= A.atilMin && dist <= A.atilMax && gorunur(d.x, d.y, 15) && saldiriAl(d)) {
          d.durum = 'hazirlik'; d.saldiriTur = 'atil'; d.t = 0; d.vurdu = false; d.kilitAci = aP; d.kilitT = 0;
          d.aci = aP;
          oynat(d, 'atil', { dongu: false, bastan: true, hiz: 0.20 });
          return;
        }
        // Yakında hızlı vur kombosu
        if (d.bekle <= 0 && dist < A.menzil && gorunur(d.x, d.y, 10) && saldiriAl(d)) {
          d.durum = 'hazirlik'; d.saldiriTur = 'vur'; d.komboSay = 0; d.t = 0; d.vurdu = false; d.kilitAci = aP; d.kilitT = 0;
          oynat(d, 'vur', { dongu: false, bastan: true, hiz: anticipationHiz(d, 'vur', A.vurHazirlik, 0, 0.72) });
          return;
        }
        // Doğrudan dik yürümek yerine yan kanattan açı alarak yaklaş (flank)
        var B = alanAl(d), pay = 30, ux = dx / dist, uy = dy / dist;
        var mx, my, yurur = true;
        if (d.bekle > 0 && dist < A.atilMax) {
          var rad = OYUN_sinirla((dist - 155) / 70, -0.45, 0.85);
          mx = ux * rad - uy * d.yanYon * 0.88;
          my = uy * rad + ux * d.yanYon * 0.88;
        } else {
          var olcek = dist > 140 ? 1 : Math.max(0.25, (dist - 50) / 90);
          var fAci = aP + d.yanYon * A.kanatAci * olcek;
          mx = Math.cos(fAci); my = Math.sin(fAci);
        }
        if ((mx < -0.2 && d.x <= B.sol + pay) || (mx > 0.2 && d.x >= B.sag - pay) ||
            (my < -0.2 && d.y <= B.ust + pay) || (my > 0.2 && d.y >= B.alt - pay)) {
          d.yanYon = -d.yanYon; d.yanT = Math.max(d.yanT, 1.0);
          if (d.bekle > 0 && dist < A.atilMax) {
            var rad2 = OYUN_sinirla((dist - 155) / 70, -0.45, 0.85);
            mx = ux * rad2 - uy * d.yanYon * 0.88;
            my = uy * rad2 + ux * d.yanYon * 0.88;
          } else {
            var olcek2 = dist > 140 ? 1 : Math.max(0.25, (dist - 50) / 90);
            var fAci2 = aP + d.yanYon * A.kanatAci * olcek2;
            mx = Math.cos(fAci2); my = Math.sin(fAci2);
          }
        }
        var mm = Math.sqrt(mx * mx + my * my) || 1;
        if (dist <= 44 && d.bekle > 0) yurur = false;
        if (yurur) { d.x += mx / mm * d.hiz * dt; d.y += my / mm * d.hiz * dt; }
        yurumeAnim(d, yurur);
        break;
      }
      case 'hazirlik': {
        d.t += dt;
        if (d.saldiriTur === 'atil') {
          if (d.t < A.atilHazirlik * 0.6) { d.kilitAci = aP; bak(d, aP, AYAR.donusHiz * 1.3, dt); }
          else bak(d, d.kilitAci, AYAR.donusHiz * 1.3, dt);
          d.hop = -4 * Math.min(1, d.t / (A.atilHazirlik * 0.65));
          oynat(d, 'atil', { hiz: 0.20 });
          if (d.t >= A.atilHazirlik) {
            d.durum = 'sicra'; d.t = 0; d.vurdu = false;
            var sa = animTanim(d, 'atil'), curK = (d.sprite && !d.sprite.yerTutucu && d.sprite.kare) || 0;
            var vk = vurusKare(sa);
            var h = (sa && sa.fps) ? kareSinir(sa, OYUN_sinirla((Math.max(1, vk - curK) / sa.fps) / (A.atilSure * 0.68), 0.5, 2.2)) : 1.1;
            oynat(d, 'atil', { hiz: h });
          }
        } else {
          var hs = d.komboSay > 0 ? A.vurIkinci : A.vurHazirlik;
          if (d.t < hs * 0.55) { d.kilitAci = aP; bak(d, aP, AYAR.donusHiz * 1.4, dt); }
          else bak(d, d.kilitAci, AYAR.donusHiz * 1.4, dt);
          oynat(d, 'vur', { hiz: anticipationHiz(d, 'vur', hs, d.t, 0.72) });
          if (d.t >= hs) {
            d.x += Math.cos(d.kilitAci) * 14; d.y += Math.sin(d.kilitAci) * 14;
            if (dist < A.darbeMenzil + (P.r || 18) && Math.abs(aciFark(aP, d.kilitAci)) < A.darbeYay) {
              var hasar = d.komboSay > 0 ? A.ikinciHasar : A.hasar;
              try { P.hasarAl(hasar, { x: d.x, y: d.y, aci: aP, guc: A.vurGuc, kaynak: d }); } catch (e) { console.error(e); }
            }
            if (d.komboSay === 0) {
              d.durum = 'toparlan'; d.saldiriTur = 'vurAra'; d.t = 0;
              oynat(d, 'vur', { hiz: toparlanHiz(d, 'vur', A.vurAra * 1.5) });
            } else {
              d.durum = 'toparlan'; d.saldiriTur = 'vur'; d.t = 0; d.kilitT = A.toparlan;
              oynat(d, 'vur', { hiz: toparlanHiz(d, 'vur', A.toparlan) });
            }
          }
        }
        break;
      }
      case 'sicra': {
        d.t += dt;
        var k = d.t / A.atilSure;
        var sp = d.vurdu ? A.atilHiz * 0.25 : A.atilHiz;
        d.x += Math.cos(d.kilitAci) * sp * dt; d.y += Math.sin(d.kilitAci) * sp * dt;
        d.hop = -Math.sin(Math.min(1, k) * Math.PI) * 14;
        if (!d.vurdu && dist < d.r + (P.r || 18) + 14) {
          d.vurdu = true;
          try { P.hasarAl(A.atilHasar, { x: d.x, y: d.y, aci: d.kilitAci, guc: A.atilGuc, kaynak: d }); } catch (e) { console.error(e); }
        }
        if (d.t >= A.atilSure) {
          d.durum = 'toparlan'; d.saldiriTur = 'atil'; d.t = 0; d.kilitT = 0.22;
          oynat(d, 'atil', { hiz: toparlanHiz(d, 'atil', 0.22) });
        }
        break;
      }
      case 'toparlan': {
        d.t += dt;
        if (d.saldiriTur === 'vurAra') {
          if (d.t >= A.vurAra) {
            if (dist < A.menzil + 55 && gorunur(d.x, d.y, 10)) {
              d.komboSay = 1; d.durum = 'hazirlik'; d.saldiriTur = 'vur'; d.t = 0; d.kilitAci = aP;
              oynat(d, 'vur', { dongu: false, bastan: true, hiz: anticipationHiz(d, 'vur', A.vurIkinci, 0, 0.72) });
            } else {
              saldiriBirak(d); d.saldiriTur = null; d.komboSay = 0; d.durum = 'yaklas'; d.bekle = rast(A.bekleMin, A.bekleMax);
            }
          }
        } else {
          var topSure = d.saldiriTur === 'atil' ? 0.24 : A.toparlan;
          if (d.t >= topSure) {
            if (d.saldiriTur === 'atil') d.atilBekle = A.atilBekle;
            saldiriBirak(d); d.saldiriTur = null; d.komboSay = 0; d.durum = 'yaklas'; d.bekle = rast(A.bekleMin, A.bekleMax);
          }
        }
        break;
      }
    }
  }

  // ---- İNFAZCI: zırhlı, geniş savuruşu hazırlık konisinden okunur
  function infazciGuncelle(d, dt, P, A) {
    var dx = P.x - d.x, dy = P.y - d.y, dist = Math.sqrt(dx * dx + dy * dy) || 1, aP = Math.atan2(dy, dx);
    switch (d.durum) {
      case 'yaklas': {
        d.bekle -= dt;
        bak(d, aP, A.donus, dt);
        var yurudu = false;
        if (dist > A.menzil * (d.yuruyor ? 0.72 : 0.82)) {
          d.x += dx / dist * d.hiz * dt; d.y += dy / dist * d.hiz * dt; yurudu = true;
        }
        d.yuruyor = yurudu;
        yurumeAnim(d, yurudu);
        if (d.bekle <= 0 && dist < A.menzil + (P.r || 18) * 0.4 && gorunur(d.x, d.y, 10) && saldiriAl(d)) {
          d.durum = 'hazirlik'; d.t = 0; d.kilitAci = d.aci; d.kilitT = 0;
          oynat(d, 'vur', { dongu: false, bastan: true, hiz: anticipationHiz(d, 'vur', A.hazirlik, 0, 0.78) });
        }
        break;
      }
      case 'hazirlik': {
        d.t += dt;
        if (d.t < A.hazirlik * 0.45) bak(d, aP, A.donus * 0.65, dt);
        oynat(d, 'vur', { hiz: anticipationHiz(d, 'vur', A.hazirlik, d.t, 0.78) });
        d.kilitAci = d.aci;
        if (d.t >= A.hazirlik) {
          var f = Math.abs(aciFark(aP, d.kilitAci));
          if (dist < A.darbeMenzil + (P.r || 18) && f < A.darbeYay) {
            try { P.hasarAl(A.hasar, { x: d.x, y: d.y, aci: aP, guc: A.darbeGuc, kaynak: d }); } catch (e) { console.error(e); }
          }
          try { OYUN.kamera.sars(7, 0.18); } catch (e) {}
          d.durum = 'toparlan'; d.t = 0;
          oynat(d, 'vur', { hiz: toparlanHiz(d, 'vur', A.toparlan * 0.85) });
          d.kilitT = A.toparlan;
        }
        break;
      }
      case 'toparlan': {
        d.t += dt;
        if (d.t >= A.toparlan) { saldiriBirak(d); d.durum = 'yaklas'; d.bekle = rast(A.bekleMin, A.bekleMax); }
        break;
      }
    }
  }

  // ---- görünür oyun alanı (ayak noktası). Kilitli arenada da kayarken de geçerli.
  var _B = { sol: 0, sag: 0, ust: 0, alt: 0 };
  function alanAl(d, y, kutusuz) {
    var ky = kamY(), kx = kamX(), AL = AYAR.alan;
    var r = d.r || 20;
    // Düşman alanı HER ZAMAN oyuncunun ulaşabildiği alanın içinde (BOLUM.sinir'den ~40 px içeride),
    // sol alttaki göstergenin arkasına da saklanamaz.
    var ps = window.BOLUM && BOLUM.sinir, psol = 90, psag = 1190, pust = ky + 165, palt = ky + H() - 30;
    if (ps && isFinite(ps.sol) && isFinite(ps.sag) && ps.sag - ps.sol > 900) { psol = ps.sol; psag = ps.sag; }
    if (ps && isFinite(ps.ust) && Math.abs(ps.ust - ky - 165) < 120) pust = ps.ust;
    if (ps && isFinite(ps.alt) && ps.alt > ky + H() * 0.6 && ps.alt <= ky + H()) palt = ps.alt;
    _B.ust = Math.max(ky + (AL.ust[d.tur] || 100), pust + AL.ustIc);
    _B.alt = Math.min(ky + H() - AL.alt, palt - AL.ic);
    var xx = d.x;
    if (!kutusuz) { var gk1 = gostergeKose(); if (xx < gk1.x) _B.alt = Math.min(_B.alt, gk1.y); }
    _B.sol = Math.max(kx + AL.yan, psol + AL.ic) + r * 0.5; _B.sag = Math.min(kx + W() - AL.yan, psag - AL.ic) - r * 0.5;
    if (window.BOLUM && typeof BOLUM.kenar === 'function') {
      var yy = y != null ? y : d.y; yy = yy < _B.ust ? _B.ust : yy > _B.alt ? _B.alt : yy;
      var kn = null; try { kn = BOLUM.kenar(yy); } catch (e) { kn = null; }
      if (kn && isFinite(kn.sol) && isFinite(kn.sag)) {
        _B.sol = Math.max(_B.sol, kn.sol + r); _B.sag = Math.min(_B.sag, kn.sag - r);
        if (_B.sag < _B.sol) { var o = (_B.sol + _B.sag) / 2; _B.sol = _B.sag = o; }
      }
    }
    return _B;
  }
  function icinde(d, B) { return d.y >= B.ust - 1 && d.y <= B.alt + 1 && d.x >= B.sol - 1 && d.x <= B.sag + 1; }

  // dışarıda doğan: içeri yürür (yapay zekâ bekler), gecikirse hızlanır, 2.6 sn'de kenardan içeri alınır
  function girisGuncelle(d, dt, P) {
    var B = alanAl(d), AL = AYAR.alan;
    if (icinde(d, B)) { d.girdi = true; d.disT = 0; return true; }
    d.disT += dt;
    var hx = Math.max(B.sol, Math.min(B.sag, d.x)), hy = Math.max(B.ust, Math.min(B.alt, d.y));
    // biraz daha içeriye hedefle (kenarda takılmasın)
    hy += (hy === B.ust ? 30 : hy === B.alt ? -30 : 0);
    if (d.disT >= AL.girisAl) { d.x = hx; d.y = Math.max(B.ust, Math.min(B.alt, hy)); d.girdi = true; d.disT = 0; d._isin = true; return true; }
    var arena = !!(window.BOLUM && BOLUM.arenaKilitli);
    if (arena) {
      // kilitli meydanda dışarıda doğan: tamamen görünmezken ekran kenarının hemen dışına alınır (göze görünmeyen
      // yer değişimi), oradan hızla içeri yürür → ekran dışında oyalanan düşman yok
      var ky = kamY(), kx = kamX(), boy = (AL.ust[d.tur] || 100) + 6, yp = (d.r || 20) * 2.5;
      if (d.y > ky + H() + boy) { d.y = ky + H() + boy; d._isin = true; }
      else if (d.y < ky - 4) { d.y = ky - 4; d._isin = true; }
      if (d.x < kx - yp) { d.x = kx - yp; d._isin = true; } else if (d.x > kx + W() + yp) { d.x = kx + W() + yp; d._isin = true; }
    }
    if (d.sersem > 0 || d.uyandi === false) return false;
    var hiz = d.hiz * (arena || d.disT > AL.girisHizlan ? 1.8 : 1.15);
    d.aci = Math.atan2(hy - d.y, hx - d.x);
    yuruYon(d, hx, hy, hiz, dt);
    yurumeAnim(d, true);
    return false;
  }

  // alanın içinde tut; savrulup duvara çarpan kısa sersemler (duvar hissi)
  function alandaTut(d, dt) {
    var B = alanAl(d, null, true), AL = AYAR.alan, carpti = 0, px = d.x, py = d.y;
    if (d.x < B.sol) { if (d.vx < 0) { carpti = Math.max(carpti, -d.vx); d.vx = 0; } if (d.avx < 0) d.avx = 0; d.x = B.sol; }
    else if (d.x > B.sag) { if (d.vx > 0) { carpti = Math.max(carpti, d.vx); d.vx = 0; } if (d.avx > 0) d.avx = 0; d.x = B.sag; }
    if (d.y < B.ust) { if (d.vy < 0) { carpti = Math.max(carpti, -d.vy); d.vy = 0; } if (d.avy < 0) d.avy = 0; d.y = B.ust; }
    else if (d.y > B.alt) { if (d.vy > 0) { carpti = Math.max(carpti, d.vy); d.vy = 0; } if (d.avy > 0) d.avy = 0; d.y = B.alt; }
    // sol alttaki gösterge köşesi katı bir kutu: en kısa yoldan (yukarı ya da sağa) dışarı itilir.
    // (Önceden x sınırı geçilince ayak birden ~165 px yukarı ışınlanıyordu.)
    var gk2 = gostergeKose(), gx = gk2.x, gy = gk2.y;
    if (d.x < gx && d.y > gy && gx <= B.sag) {
      if (gx - d.x < d.y - gy) { if (d.vx < 0) d.vx = 0; if (d.avx < 0) d.avx = 0; d.x = gx; }
      else { if (d.vy > 0) d.vy = 0; if (d.avy > 0) d.avy = 0; d.y = gy; }
    }
    // sınır birden kayarsa (meydan kilidi açılıp kapanırken, kamera sıçrarken) düşman ışınlanmaz:
    // savrulmadan gelmeyen düzeltme en çok duzeltHiz px/sn; ekranın kendisinden yine de taşmaz
    if (!carpti && dt > 0) {
      var lim = AL.duzeltHiz * dt, ddx = d.x - px, ddy = d.y - py;
      if (ddx > lim || ddx < -lim || ddy > lim || ddy < -lim) {
        d.x = px + OYUN_sinirla(ddx, -lim, lim); d.y = py + OYUN_sinirla(ddy, -lim, lim);
        var ky = kamY(), kx = kamX(), ust = (AL.ust[d.tur] || 100) - 10;
        d.x = OYUN_sinirla(d.x, kx + 25, kx + W() - 25); d.y = OYUN_sinirla(d.y, ky + ust, ky + H() - 6);
      }
    }
    if (carpti > AL.duvarHiz && !d.olu) {
      d.savrulma = 0;
      if (d.sersem < AL.duvarSersem) {
        d.sersem = AL.duvarSersem; durumSifirla(d); d.kilitT = 0; d.kacisT = 0;
        if (d.tur === 'kalkanli') d.kalkanAci = undefined;
        oynat(d, 'sersem', { dongu: false, bastan: true });
      }
      d.esne = 1; d.esneAci = Math.atan2(-(d.y - B.ust < 2 ? -1 : d.y - B.alt > -2 ? 1 : 0), -(d.x - B.sol < 2 ? -1 : d.x - B.sag > -2 ? 1 : 0));
    }
  }

  // yürüme animasyonunun hızı gerçek yürüme hızına bağlı (ayak kaymasın).
  // Paket 'adim' (bir döngüde alınan yol, px) verirse onu, yoksa tasarım hızında 1x oynayacak şekilde hesaplar.
  function adimEsle(d, A) {
    var s = d.sprite; if (!s || s.anim !== 'yuru' || !s._a) return;
    var a = s._a, dongu = (a.n || 8) / (a.fps || 10);
    var adim = (a.adim > 0) ? a.adim : (a.adimPx > 0) ? a.adimPx : A.hiz * dongu;
    var h = OYUN_sinirla(d.vHiz * dongu / adim, 0.24, 2.4) * (d.animOran || 1);
    // yavaş süzülürken bile en az ~10 resim/sn: kesik kesik görünmesin ve yavaşta ayak kayması azalsın
    if ((a.n || 0) >= 12) h = Math.max(h, AYAR.enAzYuruKare / (a.fps || 10));
    s._hiz = kareSinir(a, h);
  }

  // Yürüme akıcılığı: yapay zekânın bu karedeki yer değiştirmesi (hedef hız) kısa bir sürede yumuşakça
  // uygulanır → anlık dönüş/duruş/kalkış sıçraması yok. Yürürken gövde yürüdüğü yöne (durunca oyuncuya)
  // dönüş hızıyla döner → geri geri / yan yan "ay yürüyüşü" (ayak kayması) ve yön çırpınması yok.
  // Saldırı durumları (hazırlık, sıçrama, çekiş, büyü) etkilenmez: zamanlamaları aynen kalır.
  function yuruYumusat(d, dt, x0, y0, aci0, P) {
    if (d._isin) { d._isin = false; d.avx = 0; d.avy = 0; return; } // görünmez yer değişimi: hız sayılmaz
    var vx = (d.x - x0) / dt, vy = (d.y - y0) / dt;
    var serbest =(d.durum === 'yaklas' || d.durum === 'geri') && !(d.sersem > 0);
    var yuzSerbest = d.durum !== 'geri'; // geri sekişte bakış barbarda kalır
    if (!serbest) { d.avx = vx; d.avy = vy; return; }
    var k = 1 - Math.exp(-dt / AYAR.yumusak);
    d.avx = (d.avx || 0) + (vx - (d.avx || 0)) * k; d.avy = (d.avy || 0) + (vy - (d.avy || 0)) * k;
    d.x = x0 + d.avx * dt; d.y = y0 + d.avy * dt;
    if (d.tur === 'kalkanli' || !yuzSerbest) return; // kalkanlı kalkanıyla oyuncuya döner (oynanış), yalnız ileri yürür
    var v = Math.sqrt(d.avx * d.avx + d.avy * d.avy);
    d.yuzT = (d.yuzT || 0) + dt;
    var yh = d.yuzHareket ? v > 10 : v > 36;
    if (yh !== d.yuzHareket && d.yuzT > 0.45) { d.yuzHareket = yh; d.yuzT = 0; } // en az 0,45 sn bir bakış kipinde kalır
    var hedef = d.yuzHareket ? Math.atan2(d.avy, d.avx) : (P ? Math.atan2(P.y - d.y, P.x - d.x) : aci0);
    d.aci = aci0; bak(d, hedef, AYAR.donusHiz, dt);
  }

  var DAVRANIS = { goblin: goblinGuncelle, okcu: okcuGuncelle, kalkanli: kalkanliGuncelle, saman: samanGuncelle, yakici: yakiciGuncelle, baskinci: baskinciGuncelle, infazci: infazciGuncelle };

  function guncelle(dt) {
    if (!dt) { ciz(0); return; }
    var P = oyuncu(), ky = kamY(), alt = ky + H() + AYAR.altPay;
    var surt = Math.exp(-AYAR.surtunme * dt);
    gobAktif = 0; menzilliAktif = 0; yakAktif = 0;
    for (var gi = 0; gi < liste.length; gi++) {
      var gd = liste[gi];
      if (gd.tur === 'goblin' && (gd.durum === 'hazirlik' || gd.durum === 'sicra')) gobAktif++;
      else if (gd.durum === 'cek' || (gd.tur === 'saman' && gd.durum === 'buyu')) menzilliAktif++;
      else if (gd.tur === 'yakici' && gd.durum === 'at') yakAktif++;
    }
    dagitT -= dt;
    if (P && dagitT <= 0) { dagitT = AYAR.kalabalik.dagitAra; goblinDagit(P); }

    for (var i = liste.length - 1; i >= 0; i--) {
      var d = liste[i];
      if (!d || d.olu) { liste.splice(i, 1); continue; }
      if (d.tur === 'dev' || d.tur === 'vargor' || d.devMi || !AYAR[d.tur]) continue; // dev/vargor kendini yönetir
      var A = AYAR[d.tur];
      if (d.y > alt) { sessizSil(d); continue; }
      if (d.parla > 0) d.parla -= dt;
      if (d.zirhKirT > 0) d.zirhKirT = Math.max(0, d.zirhKirT - dt);
      // başka bir sistem (ör. bölümün "takılan düşmanı içeri al" güvencesi) düşmanı kareler arasında birden
      // taşıdıysa ışınlanma görünmesin: yer değişimi duzeltHiz ile birkaç karede yürütülür
      if (d._sx != null) {
        var jx = d.x - d._sx, jy = d.y - d._sy;
        if (jx * jx + jy * jy > 400) { d.cekX = (d.cekX || 0) + jx; d.cekY = (d.cekY || 0) + jy; d.x = d._sx; d.y = d._sy; }
      }
      if (d.cekX || d.cekY) {
        var cm = Math.sqrt(d.cekX * d.cekX + d.cekY * d.cekY), cl = AYAR.alan.duzeltHiz * dt, cf = cm > cl ? cl / cm : 1;
        d.x += d.cekX * cf; d.y += d.cekY * cf; d.cekX -= d.cekX * cf; d.cekY -= d.cekY * cf;
        if (cf >= 1) { d.cekX = 0; d.cekY = 0; }
      }

      // savrulma: üstel sönümün analitik integrali (kare hızından bağımsız, akıcı)
      if (d.vx || d.vy) {
        var adim = (1 - surt) / AYAR.surtunme;
        d.x += d.vx * adim; d.y += d.vy * adim;
        d.vx *= surt; d.vy *= surt;
        if (d.vx * d.vx + d.vy * d.vy < 16) { d.vx = 0; d.vy = 0; }
      }
      if (d.savrulma > 0) d.savrulma -= dt;
      if (d.kilitT > 0) d.kilitT -= dt;
      if (d.esne > 0) d.esne = Math.max(0, d.esne - dt / AYAR.esne);
      if (d.havaT > 0 && d.durum !== 'hazirlik' && d.durum !== 'sicra') { // darbe havalanması: yumuşak yay (ışınlanma yok)
        d.havaT -= dt; var hk = 1 - Math.max(0, d.havaT) / AYAR.havaSure;
        d.hop = Math.min(d.hop || 0, -d.havaH * Math.sin(hk * Math.PI)); if (d.havaT <= 0) d.havaT = 0;
        if (hk > 0.5) d.hop = -d.havaH * Math.sin(hk * Math.PI);
      } else if (d.hop && d.durum !== 'hazirlik' && d.durum !== 'sicra') { // sıçrama bitince yere yumuşak iniş (ışınlanma yok)
        d.hop *= Math.exp(-22 * dt); if (d.hop > -0.3 && d.hop < 0.3) d.hop = 0;
      }
      var x0 = d.x, y0 = d.y, aci0 = d.aci, ai = false;

      if (!d.girdi && !girisGuncelle(d, dt, P)) {
        if (d.sersem > 0) d.sersem -= dt;
        ai = true;
      } else if (d.sersem > 0) {
        d.sersem -= dt;
        if (d.sersem <= 0) { d.vHiz = 0; yurumeAnim(d, false); }
      } else if (P && d.uyandi !== false) {
        DAVRANIS[d.tur](d, dt, P, A); ai = true;
        // kilitli meydanda saldırılar arası bekleme daha kısa (düşmanlar artık kaçamıyor; meydan baskısı eski düzeye yakın kalsın)
        if (d.bekle > 0 && OYUN.bolum !== 2 && window.BOLUM && BOLUM.arenaKilitli && !(window.DEV && DEV.aktif)) d.bekle -= dt * (AYAR.arenaTempo - 1);
      } else if (!P) {
        saldiriBirak(d); if (d.durum !== 'yaklas') durumSifirla(d);
        yurumeAnim(d, false);
      }
      if (ai && !d.olu) yuruYumusat(d, dt, x0, y0, aci0, P);
      if (d.uyandi === false && P && Math.abs(P.y - d.y) < H() * 0.8) d.uyandi = true;
      // yürüyüşün gerçek hızı (savrulma ve itişme hariç) → adım animasyonu buna bağlı
      if (!d.olu) {
        var vAn = ai ? Math.min(d.hiz * 2.5, Math.sqrt((d.x - x0) * (d.x - x0) + (d.y - y0) * (d.y - y0)) / dt) : 0;
        d.vHiz += (vAn - d.vHiz) * (1 - Math.exp(-12 * dt));
        adimEsle(d, A);
      }
    }

    ayristir(P, dt);
    atesGuncelle(dt);
    if (patlamaKN) patlamalariIsle();

    // sınırlar + sprite
    for (var j = 0; j < liste.length; j++) {
      var e = liste[j]; if (e.tur === 'dev' || e.tur === 'vargor' || e.devMi || !AYAR[e.tur]) continue;
      if (e.girdi) alandaTut(e, dt);
      else { // henüz girmedi: yalnız yanlardan taşmasın
        var Bx = alanAl(e); e.x = Math.max(Bx.sol, Math.min(Bx.sag, e.x));
      }
      e._sx = e.x; e._sy = e.y; // bu karenin son konumu (kareler arası dış ışınlanmayı yakalamak için)
      var s = e.sprite; if (!s) continue;
      var es = e.esne > 0 ? e.esne * e.esne : 0, ec = es ? Math.cos(e.esneAci) : 0;
      s.x = cp(e.x + ec * 7 * es); s.y = cp(e.y + (e.hop || 0) + (es ? Math.sin(e.esneAci) * 3 * es : 0)); s.zEk = -(e.hop || 0);
      s.rotation = es ? ec * 0.16 * es : 0;
      if (s.adimla) s.adimla(e, dt, yonH(e));
      parlat(e);
      if (e.zirhMax > 0) zirhGuncelle(e);
    }

    // cesetler
    for (var c = cesetler.length - 1; c >= 0; c--) {
      var k = cesetler[c];
      k.cesetT += dt;
      if (k.vx || k.vy) {
        var kAdim = (1 - surt) / AYAR.surtunme;
        k.x += k.vx * kAdim; k.y += k.vy * kAdim;
        k.vx *= surt; k.vy *= surt;
        if (k.vx * k.vx + k.vy * k.vy < 25) { k.vx = k.vy = 0; }
      }
      if (k.vx || k.vy) { // savrulan ceset ekranın üstünden/yanından uçup gitmesin
        var Bc = alanAl(k, k.y);
        if (k.x < Bc.sol) { k.x = Bc.sol; k.vx = 0; } else if (k.x > Bc.sag) { k.x = Bc.sag; k.vx = 0; }
        if (k.y < Bc.ust - 30) { k.y = Bc.ust - 30; k.vy = 0; }
      }
      var ks = k.sprite;
      if (ks) {
        ks.x = cp(k.x); ks.y = cp(k.y);
        if (ks.olumla && k.cesetT < .65) ks.olumla(k.cesetT);
      }
      if (k.cesetT > AYAR.cesetSure) {
        var a = 1 - (k.cesetT - AYAR.cesetSure) / AYAR.cesetSolma;
        if (ks) ks.alpha = Math.max(0, a);
        if (a <= 0) { geriVer(k); continue; }
      }
      if (k.y > alt) geriVer(k);
    }

    ciz(dt);
  }

  // yumuşak ayrışma + savrulan düşmanın kalabalığa çarpması
  function ayristir(P, dt) {
    // döngü sınırı her turda liste.length (çarpma ölümü listeyi döngü sırasında kısaltabilir)
    var azami = AYAR.itisAzami * (dt || 1 / 60); // bir karede en çok bu kadar itilir: yığında titreme/ışınlanma yok
    for (var i = 0; i < liste.length; i++) {
      var a = liste[i]; if (!a || a.olu) continue;
      var aDev = a.tur === 'dev' || a.tur === 'vargor' || a.devMi || !AYAR[a.tur];
      var ma = aDev ? 1e6 : ((AYAR[a.tur] && AYAR[a.tur].kutle) || 1);
      for (var j = i + 1; j < liste.length; j++) {
        var b = liste[j]; if (!b || b.olu) continue;
        var bDev = b.tur === 'dev' || b.tur === 'vargor' || b.devMi || !AYAR[b.tur];
        if (aDev && bDev) continue;
        var dx = b.x - a.x, dy = b.y - a.y, rr = (a.r || 20) + (b.r || 20);
        if (dx > rr || dx < -rr || dy > rr || dy < -rr) continue;
        var m2 = dx * dx + dy * dy; if (m2 >= rr * rr) continue;
        var m, ux, uy;
        if (m2 < 0.0001) {
          m = 0;
          var a0 = ((a.id || i) * 2.39996) % (Math.PI * 2);
          ux = Math.cos(a0); uy = Math.sin(a0);
        } else {
          m = Math.sqrt(m2); ux = dx / m; uy = dy / m;
        }
        var ust = rr - m;
        // savrulma çarpması (liste kısalırsa indeks kaymasını düzelt)
        carpma(a, b, ux, uy);
        if (!a.olu && !b.olu) carpma(b, a, -ux, -uy);
        if (a.olu) { if (liste[i] !== a) i--; break; }
        if (b.olu) { if (liste[j] !== b) j--; continue; }
        var mb = bDev ? 1e6 : ((AYAR[b.tur] && AYAR[b.tur].kutle) || 1);
        var ka = aDev ? 0 : (bDev ? 1 : mb / (ma + mb)), kb = 1 - ka;
        var yum = ust > rr * 0.35 ? 0.8 : 0.55; // hafif temasta yumuşak, derin çakışmada daha belirgin
        var it = Math.min(ust * yum, azami * (aDev || bDev ? 2 : 1));
        a.x -= ux * it * ka; a.y -= uy * it * ka;
        b.x += ux * it * kb; b.y += uy * it * kb;
      }
      // oyuncunun içine girme
      if (P && !aDev && !a.olu) {
        var px = a.x - P.x, py = a.y - P.y, pr = (a.r || 20) + (P.r || 18);
        var p2 = px * px + py * py;
        if (p2 < pr * pr) {
          var pm = p2 > 0.0001 ? Math.sqrt(p2) : 0;
          var pux = pm ? px / pm : Math.cos(((a.id || i) * 2.39996) % (Math.PI * 2));
          var puy = pm ? py / pm : Math.sin(((a.id || i) * 2.39996) % (Math.PI * 2));
          var pit = Math.min((pr - pm) * 0.7, azami * 1.5);
          a.x += pux * pit; a.y += puy * pit;
        }
      }
    }
  }

  function carpma(s, h, ux, uy) { // s savruluyor, h'ye çarptı
    if (!(s.savrulma > 0) || h.olu || s.olu) return;
    var v = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
    if (v < AYAR.savrulmaCarpma) return;
    if (!s.carpanlar) s.carpanlar = {};
    if (s.carpanlar[h.id]) return;
    s.carpanlar[h.id] = 1;
    var aci = Math.atan2(uy, ux);
    var sonuc = hasarVer(h, AYAR.carpmaHasar * Math.min(2.5, v / 400), { aci: aci, guc: v * 0.55, tur: 'carpma' });
    emit('vurus', { hedef: h, x: h.x, y: h.y, aci: aci, guc: v * 0.55, tur: 'carpma', oldurdu: !!(sonuc && sonuc.oldu), agir: false, zirhli: !!(sonuc && sonuc.zirhli), zirhKirildi: !!(sonuc && sonuc.zirhKirildi) });
    s.vx *= 0.7; s.vy *= 0.7;
    // domino: her çarpışma kısa bir sarsıntı; ard arda çarpışmalarda en çok 0,12 sn'de bir minik duraksama
    var tt = (window.OYUN && OYUN.zaman) ? OYUN.zaman.t : 0;
    try { OYUN.kamera.sars(AYAR.dominoSars, 0.08); if (!(tt - dominoT < 0.12 && tt >= dominoT)) { dominoT = tt; OYUN.zaman.dondur(AYAR.dominoDondur); } } catch (e) {}
  }

  // telgraf ve işaretler (zemine)
  function ciz(dt) {
    if (!window.PIXI) return;
    if (!uyariG || uyariG.destroyed) {
      var k = katman('golge'); if (!k) return;
      uyariG = new PIXI.Graphics(); k.addChild(uyariG);
    } else if (!uyariG.parent) { var k2 = katman('golge'); if (k2) k2.addChild(uyariG); }
    var g = uyariG; g.clear();
    var t = (window.OYUN && OYUN.zaman) ? OYUN.zaman.t : 0;
    var P = oyuncu();
    for (var i = 0; i < liste.length; i++) {
      var d = liste[i]; if (d.olu || !AYAR[d.tur]) continue;
      var A = AYAR[d.tur];
      if (d.tur === 'goblin' && d.durum === 'hazirlik') {
        // atılış koridoru: sıçrama yolu (sicraHiz*sicraSure) + gövde; genişliği vuruş yarıçapı (d.r+10) → çizilen alan = vuran alan
        var k1 = Math.min(1, d.t / A.hazirlik);
        var ca = Math.cos(d.kilitAci), sa = Math.sin(d.kilitAci), nx = -sa, ny = ca;
        var L = (A.sicraHiz * A.sicraSure + d.r) * (0.35 + 0.65 * k1), w = (d.r + 10) * (0.6 + 0.4 * k1), bx = d.x + ca * d.r * 0.5, by = d.y + sa * d.r * 0.5;
        var ux0 = d.x + ca * L, uy0 = d.y + sa * L;
        g.beginFill(0xff2a10, 0.1 + 0.14 * k1);
        g.moveTo(bx + nx * w, by + ny * w).lineTo(ux0 - ca * 14 + nx * w, uy0 - sa * 14 + ny * w).lineTo(ux0, uy0)
         .lineTo(ux0 - ca * 14 - nx * w, uy0 - sa * 14 - ny * w).lineTo(bx - nx * w, by - ny * w).lineTo(bx + nx * w, by + ny * w);
        g.endFill();
        g.lineStyle(2.5, 0xff3b1f, 0.45 + 0.5 * k1);
        g.moveTo(ux0 - ca * 14 + nx * w, uy0 - sa * 14 + ny * w).lineTo(ux0, uy0).lineTo(ux0 - ca * 14 - nx * w, uy0 - sa * 14 - ny * w);
        g.lineStyle(0);
      } else if (d.tur === 'okcu' && d.durum === 'cek') {
        var k2b = Math.min(1, d.t / A.cek), kilitli = d.t >= A.kilit;
        var uz = P ? Math.min(700, Math.hypot(P.x - d.x, P.y - d.y) + 90) : 400;
        var oc = Math.cos(d.kilitAci), os = Math.sin(d.kilitAci), on = 22;
        if (!kilitli) { // nişan alıyor (hâlâ seni izliyor): kesik turuncu çizgi
          g.lineStyle(2, 0xffb070, 0.3 + 0.45 * k2b);
          for (var q = on; q < uz; q += 26) { var q2 = Math.min(uz, q + 14); g.moveTo(d.x + oc * q, d.y + os * q).lineTo(d.x + oc * q2, d.y + os * q2); }
        } else { // kilitlendi (artık dönmez; yana çekil): ok koridoru (ok + barbar yarıçapı) + parlak kırmızı çizgi
          var ow = AYAR.mermi.ok.r + 4, onx = -os * ow, ony = oc * ow, ex2 = d.x + oc * uz, ey2 = d.y + os * uz;
          g.beginFill(0xff2a10, 0.06 + 0.1 * k2b);
          g.moveTo(d.x + oc * on + onx, d.y + os * on + ony).lineTo(ex2 + onx, ey2 + ony).lineTo(ex2 - onx, ey2 - ony).lineTo(d.x + oc * on - onx, d.y + os * on - ony);
          g.endFill();
          g.lineStyle(3, 0xff2a10, 0.55 + 0.4 * k2b);
          g.moveTo(d.x + oc * on, d.y + os * on).lineTo(ex2, ey2);
        }
        g.lineStyle(0);
      } else if (d.tur === 'kalkanli' && d.durum === 'hazirlik') {
        var k3 = d.t / A.hazirlik;
        // dolgu hafif (≤0,12; barbar ve zemin kırmızı çamura bulanmasın), okunurluğu net ince kenar verir
        g.lineStyle(2, 0xff4020, 0.5 + 0.4 * k3);
        g.beginFill(0xff2a10, 0.04 + 0.08 * k3);
        dilim(g, d.x, d.y, A.darbeMenzil, d.kilitAci - A.darbeYay, d.kilitAci + A.darbeYay);
        g.endFill();
        g.lineStyle(2, 0xff4020, 0.3 + 0.6 * k3);
        g.arc(d.x, d.y, A.darbeMenzil * k3, d.kilitAci - A.darbeYay, d.kilitAci + A.darbeYay);
        g.lineStyle(0);
      } else if (d.tur === 'saman') {
        // öncelikli hedef: yeşil nabızlı halka
        var nb = 0.5 + 0.5 * Math.sin(t * 5 + d.id);
        g.lineStyle(3, 0x7dff6a, 0.35 + 0.35 * nb); // gövdenin altından taşan halka (resim küçüğünü örtüyordu)
        g.drawEllipse(d.x, d.y, d.r + 22 + 5 * nb, (d.r + 22 + 5 * nb) * 0.5);
        g.lineStyle(0);
        if (d.durum === 'buyu') {
          var bs = d.buyuSure || A.buyuHazirlik;
          var k4 = Math.min(1, d.t / bs), sKilit = d.t >= bs * 0.78;
          // büyü: ayağında mor halka büyür; nişan çizgisi barbara kadar (önce kesik = izliyor, sonra dolu + koridor = kilitli)
          var bc = Math.cos(d.kilitAci), bsn = Math.sin(d.kilitAci), bu = P ? Math.min(650, Math.hypot(P.x - d.x, P.y - d.y) + 60) : 300;
          g.lineStyle(3, sKilit ? 0xff70ff : 0xc070ff, 0.35 + 0.5 * k4);
          g.drawEllipse(d.x, d.y, (d.r + 18) * (0.6 + 0.4 * k4), (d.r + 18) * (0.6 + 0.4 * k4) * 0.5);
          if (!sKilit) {
            g.lineStyle(2, 0xc070ff, 0.3 + 0.45 * k4);
            for (var bq = 24; bq < bu; bq += 26) { var bq2 = Math.min(bu, bq + 14); g.moveTo(d.x + bc * bq, d.y + bsn * bq).lineTo(d.x + bc * bq2, d.y + bsn * bq2); }
          } else {
            var bw = AYAR.mermi.buyu.r + 4, bnx = -bsn * bw, bny = bc * bw, bex = d.x + bc * bu, bey = d.y + bsn * bu;
            g.lineStyle(0); g.beginFill(0xd966ff, 0.12);
            g.moveTo(d.x + bc * 24 + bnx, d.y + bsn * 24 + bny).lineTo(bex + bnx, bey + bny).lineTo(bex - bnx, bey - bny).lineTo(d.x + bc * 24 - bnx, d.y + bsn * 24 - bny);
            g.endFill();
            g.lineStyle(3, 0xff70ff, 0.8); g.moveTo(d.x + bc * 24, d.y + bsn * 24).lineTo(bex, bey);
          }
          g.lineStyle(0);
        } else if (d.durum === 'sifa') {
          var k5 = Math.min(1, d.t / A.sifaHazirlik);
          g.lineStyle(3, 0x9dff80, 0.3 + 0.5 * k5);
          g.drawEllipse(d.x, d.y, A.sifaMenzil * k5, A.sifaMenzil * k5 * 0.5);
          // şifa bağı: iyileşecek yaralılara uzanan titrek yeşil çizgiler (şamanı öldürürsen kesilir)
          var yy = yakindakiler(d.x, d.y, A.sifaMenzil), nb2 = 0;
          for (var yi = 0; yi < yy.length && nb2 < A.sifaHedef; yi++) {
            var yh = yy[yi]; if (yh === d || yh.tur === 'dev' || yh.can >= yh.canMax) continue;
            nb2++; bagCiz(g, d, yh, 0.25 + 0.5 * k5, t);
          }
          g.lineStyle(0);
        }
        if (d.bagT > 0 && d.bag) {
          d.bagT -= dt;
          var ba = Math.max(0, d.bagT / AYAR.sifaBag);
          for (var bi = 0; bi < d.bag.length; bi++) if (!d.bag[bi].olu) bagCiz(g, d, d.bag[bi], 0.8 * ba, t);
          g.lineStyle(0);
          if (d.bagT <= 0) d.bag = null;
        }
      }
      if (d.tur === 'yakici') {
        if (d.durum === 'at') { // çömleğin düşeceği yer: ateşin gerçek alanı (kilitlenince dolu kenar)
          var ky1 = Math.min(1, d.t / A.kaldir), kl = d.t >= A.kilit, AR = AYAR.ates.r, BS = AYAR.ates.basik;
          g.lineStyle(kl ? 3 : 2, kl ? 0xff6a14 : 0xffa050, 0.35 + 0.5 * ky1);
          g.beginFill(0xff4a10, 0.05 + 0.1 * ky1);
          g.drawEllipse(d.hx, d.hy, AR, AR * BS);
          g.endFill();
          g.lineStyle(2, 0xffb060, 0.5 * ky1);
          g.drawEllipse(d.hx, d.hy, AR * ky1, AR * BS * ky1);
          g.lineStyle(0);
        } else if (d.durum === 'hazirlik' && !d.vurdu) { // meşale: kısa koni
          var km = Math.min(1, d.t / A.mesaleHazirlik);
          g.lineStyle(2, 0xff7a20, 0.45 + 0.45 * km);
          g.beginFill(0xff4a10, 0.05 + 0.1 * km);
          dilim(g, d.x, d.y, A.mesaleMenzil + 18, d.kilitAci - A.mesaleYay, d.kilitAci + A.mesaleYay);
          g.endFill(); g.lineStyle(0);
        }
      }
      if (d.tur === 'kalkanli' && d.kalkanAci !== undefined) { // kalkanın önü (korunan yay) + arkası kesik (vurulabilir yer)
        g.lineStyle(4, 0xc8d0d8, 0.5);
        g.arc(d.x, d.y, d.r + 20, d.aci - A.kalkanYay, d.aci + A.kalkanYay);
        g.lineStyle(0);
      } else if (d.tur === 'kalkanli' && (d.kalkanKapali > 0 || d.durum === 'toparlan')) {
        // kalkan açık: her yerden vurulur → altın sarısı nabızlı halka (kırık kalkanda daha güçlü)
        var ac = 0.5 + 0.5 * Math.sin(t * 16 + d.id), kir = d.kalkanKapali > 0;
        var ar = d.r + 26 + 4 * ac; // gövdenin altından taşsın (iri ork resmi küçük halkayı örtüyordu)
        g.lineStyle(kir ? 4.5 : 3.5, 0xffd040, (kir ? 0.5 : 0.35) + 0.4 * ac);
        g.drawEllipse(d.x, d.y, ar, ar * 0.5);
        g.lineStyle(0);
      } else if (d.tur === 'baskinci' && d.durum === 'hazirlik') {
        if (d.saldiriTur === 'atil') {
          // yüksek kontrastlı amber çizgi telgrafı (0xff7a22 + koyu siyah kenar)
          var kb = Math.min(1, d.t / A.atilHazirlik);
          var bca = Math.cos(d.kilitAci), bsa = Math.sin(d.kilitAci), bnx = -bsa, bny = bca;
          var bL = A.atilHiz * A.atilSure + d.r, bw2 = (d.r + 12) * 0.72, okB = 18;
          var bbx = d.x + bca * d.r * 0.4, bby = d.y + bsa * d.r * 0.4;
          var bux = d.x + bca * bL, buy = d.y + bsa * bL;
          g.lineStyle(0);
          g.beginFill(0xff7a22, 0.08 + 0.14 * kb);
          g.moveTo(bbx + bnx * bw2, bby + bny * bw2)
           .lineTo(bux - bca * okB + bnx * bw2, buy - bsa * okB + bny * bw2)
           .lineTo(bux, buy)
           .lineTo(bux - bca * okB - bnx * bw2, buy - bsa * okB - bny * bw2)
           .lineTo(bbx - bnx * bw2, bby - bny * bw2)
           .lineTo(bbx + bnx * bw2, bby + bny * bw2);
          g.endFill();
          g.lineStyle(6.5, 0x000000, 0.8 + 0.15 * kb);
          g.moveTo(bbx, bby).lineTo(bux, buy);
          g.moveTo(bux - bca * okB + bnx * bw2, buy - bsa * okB + bny * bw2).lineTo(bux, buy).lineTo(bux - bca * okB - bnx * bw2, buy - bsa * okB - bny * bw2);
          g.lineStyle(4, 0x000000, 0.65);
          g.moveTo(bbx + bnx * bw2, bby + bny * bw2).lineTo(bux - bca * okB + bnx * bw2, buy - bsa * okB + bny * bw2);
          g.moveTo(bbx - bnx * bw2, bby - bny * bw2).lineTo(bux - bca * okB - bnx * bw2, buy - bsa * okB - bny * bw2);
          g.lineStyle(3, 0xff7a22, 0.8 + 0.2 * kb);
          g.moveTo(bbx, bby).lineTo(bux, buy);
          g.moveTo(bux - bca * okB + bnx * bw2, buy - bsa * okB + bny * bw2).lineTo(bux, buy).lineTo(bux - bca * okB - bnx * bw2, buy - bsa * okB - bny * bw2);
          g.lineStyle(1.8, 0xff7a22, 0.5 + 0.35 * kb);
          g.moveTo(bbx + bnx * bw2, bby + bny * bw2).lineTo(bux - bca * okB + bnx * bw2, buy - bsa * okB + bny * bw2);
          g.moveTo(bbx - bnx * bw2, bby - bny * bw2).lineTo(bux - bca * okB - bnx * bw2, buy - bsa * okB - bny * bw2);
          g.lineStyle(2.5, 0xffc070, 0.9);
          g.moveTo(bbx, bby).lineTo(bbx + bca * ((bL - d.r * 0.4) * kb), bby + bsa * ((bL - d.r * 0.4) * kb));
          g.lineStyle(0);
        } else {
          var hs2 = d.komboSay > 0 ? A.vurIkinci : A.vurHazirlik;
          var kv = Math.min(1, d.t / hs2);
          var va0 = d.kilitAci - A.darbeYay, va1 = d.kilitAci + A.darbeYay;
          g.lineStyle(5, 0x000000, 0.75);
          dilim(g, d.x, d.y, A.darbeMenzil, va0, va1);
          g.lineStyle(0);
          g.beginFill(0xff7a22, 0.06 + 0.12 * kv);
          dilim(g, d.x, d.y, A.darbeMenzil, va0, va1);
          g.endFill();
          g.lineStyle(2.5, 0xff7a22, 0.75 + 0.25 * kv);
          dilim(g, d.x, d.y, A.darbeMenzil, va0, va1);
          g.lineStyle(0);
        }
      } else if (d.tur === 'infazci') {
        if (d.zirh > 0) {
          var zr = d.r + 14;
          g.lineStyle(5, 0x000000, 0.65);
          g.drawEllipse(d.x, d.y, zr, zr * 0.5);
          g.lineStyle(2.5, 0xb8c8d8, 0.8);
          g.drawEllipse(d.x, d.y, zr, zr * 0.5);
          g.lineStyle(0);
        }
        if (d.durum === 'hazirlik') {
          var ki2 = Math.min(1, d.t / A.hazirlik);
          var ia0 = d.kilitAci - A.darbeYay, ia1 = d.kilitAci + A.darbeYay, iR = A.darbeMenzil;
          // Koyu kenarlıklı (0x000000 alt çizgi) turuncu-amber (0xff7a22) koni/yelpaze telgrafı
          g.lineStyle(6, 0x000000, 0.8 + 0.15 * ki2);
          dilim(g, d.x, d.y, iR, ia0, ia1);
          g.lineStyle(0);
          g.beginFill(0xff7a22, 0.08 + 0.15 * ki2);
          dilim(g, d.x, d.y, iR, ia0, ia1);
          g.endFill();
          g.lineStyle(2.8, 0xff7a22, 0.8 + 0.2 * ki2);
          dilim(g, d.x, d.y, iR, ia0, ia1);
          var iRk = iR * ki2;
          if (iRk > 4) {
            g.lineStyle(4.5, 0x000000, 0.75);
            g.moveTo(d.x + Math.cos(ia0) * iRk, d.y + Math.sin(ia0) * iRk);
            g.arc(d.x, d.y, iRk, ia0, ia1);
            g.lineStyle(2.2, 0xffa84c, 0.75 + 0.25 * ki2);
            g.moveTo(d.x + Math.cos(ia0) * iRk, d.y + Math.sin(ia0) * iRk);
            g.arc(d.x, d.y, iRk, ia0, ia1);
          }
          g.lineStyle(0);
        }
      }
    }
    MERMI._uyari(g);
  }
  // şamandan (asa hizası) hedefe dalgalı yeşil bağ + hedefin ayağında küçük halka
  function bagCiz(g, d, h, al, t) {
    var x0 = d.x, y0 = d.y - 55, x1 = h.x, y1 = h.y - 25, dx = x1 - x0, dy = y1 - y0, L = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = -dy / L, ny = dx / L, n = Math.max(4, Math.min(12, (L / 28) | 0));
    g.lineStyle(2.5, 0x9dff80, al);
    g.moveTo(x0, y0);
    for (var i = 1; i <= n; i++) {
      var k = i / n, o = i < n ? Math.sin(k * 9 + t * 14 + d.id) * 5 * Math.sin(k * Math.PI) : 0;
      g.lineTo(x0 + dx * k + nx * o, y0 + dy * k + ny * o);
    }
    g.lineStyle(2, 0x9dff80, al * 0.8);
    g.drawEllipse(h.x, h.y, (h.r || 20) + 6, ((h.r || 20) + 6) * 0.5);
  }
  function dilim(g, x, y, r, a0, a1) {
    g.moveTo(x, y);
    var n = 14;
    for (var i = 0; i <= n; i++) { var a = a0 + (a1 - a0) * i / n; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    g.lineTo(x, y);
  }

  function temizle() {
    for (var i = liste.length - 1; i >= 0; i--) {
      var d = liste[i];
      if (AYAR[d.tur]) { d.olu = true; geriVer(d); }
    }
    liste.length = 0;
    for (var c = cesetler.length - 1; c >= 0; c--) geriVer(cesetler[c]);
    while (atesler.length) atesSil(atesler.length - 1);
    patlamaKN = 0; atesPT = 0.15; yakAktif = 0;
    cesetler.length = 0; saldiranSay = 0; gobAktif = 0; menzilliAktif = 0; mermiHasarT = -9; gobSonT = -9; dagitT = 0;
    if (uyariG) uyariG.clear();
  }

  var DUSMAN = window.DUSMAN = {
    AYAR: AYAR,
    liste: liste,
    cesetler: cesetler,
    dogur: dogur,
    turEkle: function (ad, ayar, davranis, sprite) {
      AYAR[ad] = ayar; DAVRANIS[ad] = davranis; hariciSprite[ad] = sprite;
    },
    hasarVer: hasarVer,
    yakindakiler: yakindakiler,
    temizle: temizle,
    guncelle: guncelle,
    sinirKendi: true,          // görünür alan sınırını dusman.js kendisi uygular (bolum.js dokunmaz)
    alan: function (d) { var B = alanAl(d); return { sol: B.sol, sag: B.sag, ust: B.ust, alt: B.alt }; },
    atesler: atesler,          // ateş birikintileri {id,x,y,r,sure,t,sahip} (salt okunur: efekt/oto)
    atesSondur: function (f, id) {
      if (!f || f.id !== id) return;
      var i = atesler.indexOf(f);
      if (i >= 0) atesSil(i);
    },
    atesEkle: atesEkle,        // ortak sıfır-GC yer ateşi/lav havuzu (Bölüm II yağ varilleri ve Vargor lavları)
    atesIcinde: function (x, y, pay) { return atesIcinde(x, y, false, pay || 0); },
    atesR: atesEtkinR,
    say: function (tur) { var n = 0; for (var i = 0; i < liste.length; i++) if (!liste[i].olu && (!tur || liste[i].tur === tur)) n++; return n; }
  };

  // ------------------------------------------------------------------ MERMI
  var mListe = [];
  var mHavuz = {};

  function mGorunum(tur, r) {
    var c = new PIXI.Container();
    var doku = null;
    try {
      var pk = window.VARLIK && VARLIK.paketler && VARLIK.paketler.efekt;
      if (pk && pk.tekil && pk.tekil[tur] !== undefined) doku = VARLIK.doku('efekt', tur);
      var py = window.VARLIK && VARLIK.paketler && VARLIK.paketler.yakici; // çömlek resmi Yakıcı paketinin tekil karesinde
      if (tur === 'comlek' && py && py.tekil && py.tekil.comlek !== undefined) doku = VARLIK.doku('yakici', 'comlek');
    } catch (e) { doku = null; }
    var ic;
    if (doku && doku.valid !== false && doku !== PIXI.Texture.EMPTY) {
      ic = new PIXI.Sprite(doku); ic.anchor.set(0.5);
      if (tur === 'kaya') { var o = (r * 2.2) / Math.max(1, doku.width); ic.scale.set(o); }
      // çömlek resmi pakette 1:1 boyda (34×36): ölçek yok
    } else {
      ic = new PIXI.Graphics();
      if (tur === 'ok') {
        ic.lineStyle(3, 0x3a2414, 1).moveTo(-16, 0).lineTo(12, 0);
        ic.lineStyle(2, 0xd8d0c0, 1).moveTo(-16, 0).lineTo(-22, -4).moveTo(-16, 0).lineTo(-22, 4);
        ic.lineStyle(0).beginFill(0xc8ccd0).drawPolygon([12, -4, 20, 0, 12, 4]).endFill();
      } else if (tur === 'buz_mizrak') {
        ic.lineStyle(4,0x27475d,1).moveTo(-27,0).lineTo(12,0);
        ic.lineStyle(2,0xa6d6e3,1).moveTo(-26,0).lineTo(12,0);
        ic.lineStyle(1.8,0x385d74,1).beginFill(0xb0f4ff).drawPolygon([7,-6,27,0,7,6,10,0]).endFill();
      } else if (tur === 'comlek') { // yer tutucu: koyu konturlu kil çömlek + bez tıpa + fitil alevi (sprite paketi yoksa)
        ic.lineStyle(2, 0x1a0e08, 1).beginFill(0x8a4e2c).drawEllipse(0, 2, 10, 11).endFill();
        ic.lineStyle(0).beginFill(0xa86638).drawEllipse(-3, -1, 4, 6).endFill();
        ic.lineStyle(2, 0x1a0e08, 1).beginFill(0x6e3c22).drawRect(-4, -12, 8, 5).endFill();
        ic.lineStyle(0).beginFill(0x2a1a10).drawRect(-6, 3, 12, 2).endFill();
        ic.beginFill(0xff8a20, 0.95).drawEllipse(0, -17, 3.5, 6).endFill();
        ic.beginFill(0xffe08a, 1).drawEllipse(0, -16, 1.6, 3).endFill();
      } else if (tur === 'buyu') {
        ic.beginFill(0x6a1fb0, 0.35).drawCircle(0, 0, r * 1.6).endFill();
        ic.beginFill(0x9d4dff, 0.8).drawCircle(0, 0, r).endFill();
        ic.beginFill(0xe6c8ff, 1).drawCircle(0, 0, r * 0.45).endFill();
      } else {
        ic.beginFill(0x4a4540).drawCircle(0, 0, 1).endFill();
        ic.beginFill(0x6e665c).drawCircle(-0.15, -0.15, 0.8).endFill();
        ic.scale.set(r);
      }
    }
    c.addChild(ic); c.ic = ic;
    var golge = new PIXI.Graphics();
    golge.beginFill(0x000000, 0.35).drawEllipse(0, 0, 1, 0.5).endFill();
    return { kap: c, golge: golge };
  }

  function at(tur, x, y, aci, secenek) {
    secenek = secenek || {};
    var MA = AYAR.mermi[tur] || AYAR.mermi.ok;
    var hv = mHavuz[tur] || (mHavuz[tur] = []);
    var m = hv.pop();
    var r = secenek.r || MA.r;
    if (!m || m.rYap !== r) { m = { tur: tur }; if (window.PIXI) { var gr = mGorunum(tur, r); m.kap = gr.kap; m.golge = gr.golge; } m.rYap = r; }
    var hiz = secenek.hiz || (tur === 'buyu' ? 220 : tur === 'kaya' ? 300 : 380);
    m.tur = tur; m.x = x; m.y = y; m.r = r; m.hiz = hiz;
    m.vx = Math.cos(aci) * hiz; m.vy = Math.sin(aci) * hiz;
    m.sahip = secenek.sahip || 'dusman'; m._sahip = m.sahip;
    m.hasar = secenek.hasar != null ? secenek.hasar : 12;
    m.omur = secenek.omur || MA.omur; m.t = 0; m.z = secenek.z != null ? secenek.z : MA.z;
    m.vurulanlar = null; m.kaynak = secenek.kaynak || null; m.bitti = false; m.olu = false;
    m.kilitliHedef = null;
    m.yay = null;
    if (secenek.yay) {
      var hx, hy;
      if (typeof secenek.yay === 'object' && secenek.yay.x != null) { hx = secenek.yay.x; hy = secenek.yay.y; }
      else { var mz = secenek.menzil || 420; hx = x + Math.cos(aci) * mz; hy = y + Math.sin(aci) * mz; }
      var uz = Math.hypot(hx - x, hy - y);
      var sure = (secenek.yay.sure) || Math.max(0.5, uz / hiz);
      m.yay = { x0: x, y0: y, x1: hx, y1: hy, sure: sure, h: (secenek.yay.yukseklik) || Math.max(120, uz * 0.45), z0: secenek.yay.z0 || 0 }; // z0: elden çıkış yüksekliği
      m.vx = (hx - x) / sure; m.vy = (hy - y) / sure;
      m.omur = Math.max(m.omur, sure + 0.1);
    }
    if (m.kap) {
      var kv = katman('varlik'); if (kv) kv.addChild(m.kap);
      var kg = katman('golge'); if (kg) kg.addChild(m.golge);
      m.kap.visible = m.golge.visible = true; m.kap.alpha = 1;
    }
    mListe.push(m);
    mCiz(m);
    emit('mermi', { tur: tur, x: x, y: y, sahip: m.sahip });
    return m;
  }

  function mBirak(m, i) {
    m.bitti = true; m.olu = true; m.kilitliHedef = null;
    if (m.kap) { m.kap.visible = false; if (m.kap.parent) m.kap.parent.removeChild(m.kap); }
    if (m.golge) { m.golge.visible = false; if (m.golge.parent) m.golge.parent.removeChild(m.golge); }
    if (i == null) i = mListe.indexOf(m);
    if (i >= 0) mListe.splice(i, 1);
    (mHavuz[m.tur] || (mHavuz[m.tur] = [])).push(m);
  }

  function mCiz(m) {
    if (!m.kap) return;
    m.kap.x = m.x; m.kap.y = m.y - m.z; m.kap.zEk = m.z + 2;
    if (m.tur === 'kaya') m.kap.rotation += 0.05;
    else if (m.tur === 'comlek') m.kap.rotation = m.t * 9 * (m.vx >= 0 ? 1 : -1); // havada döner
    else m.kap.rotation = Math.atan2(m.vy, m.vx);
    var gs = m.r * (m.tur === 'kaya' || m.tur === 'comlek' ? 1 : 1.3) * (1 - Math.min(0.5, m.z / 500));
    m.golge.x = m.x; m.golge.y = m.y; m.golge.scale.set(gs, gs);
    m.golge.alpha = (m.tur === 'kaya' || m.tur === 'comlek') ? 0.5 + 0.4 * (1 - Math.min(1, m.z / 300)) : 0.6;
    if (m.tur === 'buyu' && m.kap.ic) { var p = 1 + 0.12 * Math.sin(m.t * 18); m.kap.ic.scale.set(p); }
  }

  function sektir(m, aci, hiz) { // oyuncu.js kullanabilir
    if (!m || m.bitti) return;
    hiz = hiz || m.hiz * 1.3;
    if (m.tur === 'comlek') { // kavisle geri: sahibine (yöne yakınsa) ya da savrulan yöne düşer; ateş artık oyuncunun
      var k = m.kaynak && !m.kaynak.olu && m.kaynak.tur === 'yakici' ? m.kaynak : null, tx, ty;
      if (k && Math.abs(aciFark(Math.atan2(k.y - m.y, k.x - m.x), aci)) < 1.2) { tx = k.x; ty = k.y; }
      else { tx = m.x + Math.cos(aci) * 280; ty = m.y + Math.sin(aci) * 280; }
      var ux = tx - m.x, uy = ty - m.y, uz = Math.sqrt(ux * ux + uy * uy) || 1;
      if (uz > 520) { tx = m.x + ux / uz * 520; ty = m.y + uy / uz * 520; uz = 520; }
      var su = OYUN_sinirla(uz / 560, 0.4, 0.85);
      m.yay = { x0: m.x, y0: m.y, x1: tx, y1: ty, sure: su, h: Math.max(80, uz * 0.32), z0: m.z || 30 };
      m.t = 0; m.omur = su + 0.5; m.vx = (tx - m.x) / su; m.vy = (ty - m.y) / su;
      m.sahip = 'oyuncu'; m._sahip = 'oyuncu';
      return;
    }
    m.vx = Math.cos(aci) * hiz; m.vy = Math.sin(aci) * hiz;
    m.sahip = 'oyuncu'; m.hasar *= (AYAR.mermi[m.tur] || {}).sekmeCarpan || 1.5;
  }

  function mGuncelle(dt) {
    if (!dt) return;
    var P = oyuncu(), ky = kamY();
    for (var i = mListe.length - 1; i >= 0; i--) {
      var m = mListe[i];
      // sahip değişti (sektirildi)
      if (m.sahip !== m._sahip) {
        m._sahip = m.sahip; m.t = 0; m.omur = (AYAR.mermi[m.tur] || {}).omur || 3;
        m.vurulanlar = null;
        if (m.yay) { m.yay = null; m.z = Math.max(m.z, 30); }
      }
      m.t += dt;
      if (m.yay) {
        var Y = m.yay, k = Math.min(1, m.t / Y.sure);
        m.x = Y.x0 + (Y.x1 - Y.x0) * k; m.y = Y.y0 + (Y.y1 - Y.y0) * k;
        m.z = Y.h * 4 * k * (1 - k) + (Y.z0 || 0) * (1 - k);
        if (k >= 1) { // yere düştü
          m.z = 0;
          if (m.tur === 'comlek') { // kırılır → ateş birikintisi (sahibi: atan ya da sektiren)
            atesYak(m.x, m.y, AYAR.ates.r, AYAR.ates.sure, m.sahip);
            emit('mermiVur', { tur: m.tur, x: m.x, y: m.y, yer: true, r: AYAR.ates.r, sahip: m.sahip });
            mBirak(m, i); continue;
          }
          if (m.sahip === 'dusman' && P) {
            var rr = m.r + (P.r || 18);
            if ((P.x - m.x) * (P.x - m.x) + (P.y - m.y) * (P.y - m.y) < rr * rr) {
              try { P.hasarAl(m.hasar, { x: m.x, y: m.y, aci: Math.atan2(P.y - m.y, P.x - m.x), guc: 380, kaynak: m }); } catch (e) { console.error(e); }
            }
          }
          emit('mermiVur', { tur: m.tur, x: m.x, y: m.y, yer: true, r: m.r });
          mBirak(m, i); continue;
        }
        mCiz(m); continue;
      }
      var onceX = m.x, onceY = m.y, buzEngeli = null;
      var buzMizrak = m.tur === 'buz_mizrak' && window.BOLUM && BOLUM.ayazAtisEngeli;
      m.x += m.vx * dt; m.y += m.vy * dt;
      if (buzMizrak) {
        buzEngeli = BOLUM.ayazAtisEngeli(onceX, onceY, m.x, m.y);
        if (buzEngeli !== null) {
          m.x = onceX + (m.x - onceX) * buzEngeli;
          m.y = onceY + (m.y - onceY) * buzEngeli;
        }
      }
      var kx = kamX();
      if (m.t > m.omur || m.y > ky + H() + 200 || m.y < ky - 300 || m.x < kx - 200 || m.x > kx + W() + 200) {
        mBirak(m, i); continue;
      }
      var vurdu = false;
      if (m.sahip === 'dusman') {
        if (P) {
          var r2 = m.r + (P.r || 18);
          if ((P.x - m.x) * (P.x - m.x) + (P.y - m.y) * (P.y - m.y) < r2 * r2 &&
              (!buzMizrak || BOLUM.ayazAtisEngeli(onceX, onceY, P.x, P.y) === null)) {
            var oldu = true, mt = (window.OYUN && OYUN.zaman) ? OYUN.zaman.t : 0;
            // adil kural: ok/büyü hasarından sonra kısa süre ikinci mermi hasar vermez (görünmeyen kalabalıkta üst üste yemesin)
            if ((m.tur === 'ok' || m.tur === 'buyu' || m.tur === 'buz_mizrak') && mt - mermiHasarT < AYAR.mermiAra && mt >= mermiHasarT && P.hasarAl) {
              emit('mermiVur', { tur: m.tur, x: m.x, y: m.y, sahip: m.sahip, bos: true }); mBirak(m, i); continue;
            }
            try { oldu = P.hasarAl(m.hasar, { x: m.x, y: m.y, aci: Math.atan2(m.vy, m.vx), guc: m.tur === 'kaya' ? 380 : 160, kaynak: m }) !== false; } catch (e) { console.error(e); }
            vurdu = oldu; // dokunulmazken (atılma) içinden geçer
            if (oldu && (m.tur === 'ok' || m.tur === 'buyu' || m.tur === 'buz_mizrak')) mermiHasarT = mt;
          }
        }
      } else {
        var ad = yakindakiler(m.x, m.y, m.r);
        for (var j = 0; j < ad.length; j++) {
          var d = ad[j];
          if (m.kilitliHedef && m.kilitliHedef !== d) continue;
          if (buzMizrak && BOLUM.ayazAtisEngeli(onceX, onceY, d.x, d.y) !== null) continue;
          if (m.vurulanlar && m.vurulanlar[d.id || d.tur]) continue;
          var aci = Math.atan2(m.vy, m.vx);
          var guc = m.tur === 'kaya' ? 700 : 350;
          // geri sektirilen mermiyle öldürmek ödül: parçalanır, kısa duraksama + sarsıntı
          var s = hasarVer(d, m.hasar, { aci: aci, guc: guc, tur: 'sekme', parcala: true }) || {};
          if (!s.blok) emit('vurus', { hedef: d, x: d.x, y: d.y, aci: aci, guc: guc, tur: 'sekme', oldurdu: !!s.oldu, agir: m.tur === 'kaya' || !!s.oldu, zirhli: !!s.zirhli, zirhKirildi: !!s.zirhKirildi });
          if (s.oldu && d.tur !== 'dev') {
            try { OYUN.zaman.dondur(AYAR.sekmeDondur); OYUN.kamera.sars(5, 0.14); } catch (e) {}
          }
          if (m.tur === 'kaya') { (m.vurulanlar || (m.vurulanlar = {}))[d.id || d.tur] = 1; }
          else { vurdu = true; break; }
        }
      }
      if (vurdu || buzEngeli !== null) {
        emit('mermiVur', { tur: m.tur, x: m.x, y: m.y, sahip: m.sahip, yer: !vurdu });
        mBirak(m, i); continue;
      }
      mCiz(m);
    }
  }

  function mUyari(g) { // havadaki kayaların düşeceği yer
    for (var i = 0; i < mListe.length; i++) {
      var m = mListe[i]; if (!m.yay) continue;
      var k = Math.min(1, m.t / m.yay.sure);
      if (m.tur === 'comlek') { // çömlek: ateşin yayılacağı alan (sektirilen de; o zaman sıcak sarı)
        var CR = AYAR.ates.r, CB = AYAR.ates.basik, oy = m.sahip === 'oyuncu';
        g.lineStyle(3, oy ? 0xffd060 : 0xff6a14, 0.5 + 0.4 * k);
        g.beginFill(oy ? 0xffb030 : 0xff4a10, 0.08 + 0.12 * k);
        g.drawEllipse(m.yay.x1, m.yay.y1, CR, CR * CB);
        g.endFill(); g.lineStyle(0);
        continue;
      }
      if (m.tur === 'kor_kure') {
        // Yere düşen közün dış sınırı, dairesel isabet alanıyla aynı kalır.
        g.lineStyle(4, 0x1c0907, 0.8).drawCircle(m.yay.x1, m.yay.y1, m.r);
        g.lineStyle(2, 0xff9c48, 0.72 + 0.23 * k).drawCircle(m.yay.x1, m.yay.y1, m.r);
        g.lineStyle(0).beginFill(0xff591e, 0.16 + 0.20 * k);
        g.drawCircle(m.yay.x1, m.yay.y1, m.r * (0.25 + 0.75 * k));
        g.endFill();
        continue;
      }
      g.lineStyle(2, 0xff3010, 0.3 + 0.5 * k);
      g.beginFill(0xff2000, 0.08 + 0.22 * k);
      g.drawEllipse(m.yay.x1, m.yay.y1, m.r * (0.6 + 0.4 * k), m.r * (0.6 + 0.4 * k) * 0.55);
      g.endFill(); g.lineStyle(0);
    }
  }

  function mTemizle() { for (var i = mListe.length - 1; i >= 0; i--) mBirak(mListe[i], i); }

  window.MERMI = {
    liste: mListe,
    at: at,
    sektir: sektir,
    birak: function (m) {
      var i = mListe.indexOf(m);
      if (i >= 0) mBirak(m, i);
    },
    guncelle: mGuncelle,
    temizle: mTemizle,
    _uyari: mUyari
  };

  // ------------------------------------------------------------------ kayıt
  function kaydol() {
    if (!window.OYUN || typeof OYUN.sistem !== 'function') { console.warn('dusman.js: OYUN.sistem yok'); return; }
    OYUN.sistem('dusman', {
      baslat: function () { zirhOlayKancasi(); },
      guncelle: function (dt) { guncelle(dt); mGuncelle(dt); },
      sifirla: function () { temizle(); mTemizle(); }
    });
  }
  kaydol();
})();
