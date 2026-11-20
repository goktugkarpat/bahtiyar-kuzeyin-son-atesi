/* efekt.js – kan, yerde kalan lekeler, parçalar, kıvılcım, toz, savurma izi, ışık ve karartma.
   YALNIZ OLAY dinler; oynanışa hiçbir şey yazmaz (istisna: OYUN.kamera.sars).
   Bütün dokular çalışma anında <canvas> ile çizilir (file:// sorunsuz). Global: EFEKT */
(function () {
  'use strict';

  // ------------------------------------------------------------------ AYARLAR
  var AYAR = {
    kan: 1.0,              // kan miktarı çarpanı (damla sayısı, leke boyu, göl boyu)
    parcaSayi: [5, 8],     // parçalanan düşmandan çıkan parça sayısı (en az, en çok)
    havuzNormal: 1050,     // normal parçacık (kan damlası, toz, duman, parça)
    havuzParlak: 450,      // parlayan parçacık (kıvılcım, kor, büyü)
    havuzEsik: 0.3,        // normal havuz bu orandan fazla doluysa yeni kan azaltılır (4. tur: 60 düşmanda havuz taşmasın)
    damgaKare: 500,        // bir karede en çok leke damgası
    dilimY: 512,           // leke dokusu dilim yüksekliği (dünya px)
    dilimSayi: 5,          // aynı anda tutulan dilim sayısı (kamerayla kayan halka)
    dilimKenar: 160,       // dilimlerin sağ/sol taşması (px)
    sarsinti: 1.0,         // efektin istediği sarsıntıların çarpanı (0 = kapalı)
    vurusYukseklik: 40,    // vuruş noktası yerden kaç px yukarıda sayılır
    vinyet: 0,             // ekran kenarı karartması (3. tur: kapalı; ışık haritasındaki çok hafif kenar yeterli)
    ton: 0xc9d2d4,         // (eski) tek renk ton; artık ışık haritası kullanılıyor
    ortam: 0x828d96,      // Yanık Köy: sağanak altındaki ıslak taş.
    ortamDev: 0x88949f,
    ortamVolkan: 0x94837c, // Kül Geçidi: kuru sıcak bazalt ve kömür.
    ortamVolkanDev: 0x998981,
    ortamAyaz: 0x8b969f,  // Ayaz Hisarı: kardan seken mavi ışık.
    ortamAyazDev: 0x919da7,
    isikIki: true,        // 2× çarpma (false: eski düz çarpma)
    atesGuc: 0.2,      // ateş havuzunun haritadaki gücü (2× çarpmada)
    flasGuc: 0.32,         // vuruş/şok ışıklarının haritadaki gücü çarpanı
    haritaVinyet: 0.055,
    haritaVinyetVolkan: 0.095,
    volkanVinyet: 0.105,
    volkanAltIsik: 0.075,
    haritaOlcek: 2,        // ışık haritası çözünürlük bölücüsü (1280×720 → 640×360; 4'te küçük ışıklar kaba lekeydi)
    kahramanIsik: 0.12,    // barbarın çevresindeki çok hafif sıcak ışık havuzu (zemin; ışıl ışıl olmasın)
    kahramanYaricap: 120,  // px
    barbarKenar: false,    // barbarın çevresine açık renkli kenar çizgisi (ebeveyn: 'kalın beyaz çizgi çok kötü' → KAPALI; hiç üretilmez)
    kontur: 0xe8c890,      // (barbarKenar açıksa) kenar rengi
    konturAlfa: 0.5,
    ayLift: 0x000000,      // (3. tur: kapalı → siyah kontur gerçekten siyah, çizgiler gıcır) gölgeleri çok hafif serin griye kaldıran eklemeli 'ay ışığı' (siyah = yok; fazlası sahneyi mavi-gri düzleştiriyordu)
    barbarSicak: 0,        // barbarın kendisine eklenen sıcak aydınlık (kapalı: sprite kendi rengiyle görünsün)
    lekeSolma: 1.0,        // eski kan lekelerinin solma hızı çarpanı (kalabalıkta hızlanır)
    rontgen: 0.92,         // barbar örtülünce üstten görünen siluetin gücü (yalnız örtülünce)
    rontgenKenar: 0.35,    // örtülünce siluetin ince kenarının gücü
    rontgenRenk: 0xffd690, // örtülünce görünen kenarın rengi
    koyuKenar: 0.85,       // barbar devle üst üste gelince çevresinde KOYU ince ayırma çizgisi (ışıltı değil; 0 = kapalı)
    koyuKenarPx: 1.5,      // çizgi kalınlığı (ekran px)
    sis: 0,                // yavaş sürüklenen sis/toz katmanı (ebeveyn: bulanık olmasın → kapalı)
    kul: 70,               // havada uçuşan kül + kor sayısı
    atesIsik: 1.0,         // ateş ışığı gücü
    oyuncuIsik: 0,         // barbarın etrafındaki (eklemeli) aydınlık: kapalı (çıkartma gibi durmasın)
    dusukCan: 0.3,         // can bu oranın altındayken nabız atan kırmızı kenar
    hasarSayisi: true,     // isabet başına can kaybı, aynı hedefte kısa aralıkla birleşir
    turRenk: { goblin: 0x7d8f46, okcu: 0x6f7f48, kalkanli: 0x5e7044, saman: 0x8a7458, yakici: 0x6b7c46, baskinci: 0x8e929c, infazci: 0x5a5e66, vargor: 0x4c464a, dev: 0x9a8670, barbar: 0xc89b7c },
    kanRenk: [0x6e0808, 0x7c0b0a, 0x5a0606, 0x861210],      // havadaki damla (4. tur: koyu, doygun; eski 0x7a0b0b/0x8c1010/0x660808/0x9a1414)
    lekeRenk: [0x420505, 0x4c0707, 0x360404, 0x560a08],     // yerdeki leke (4. tur: biraz koyu ve kahveye yakın; eski 0x4e0606/0x5c0909/0x430404/0x6a0c0c)
    golRenk: 0x3e0505,     // ceset altı göl (4. tur: büyürken de aynı koyu renk; eski büyürken 0x7e0c0c parlak 'plastik' kırmızıydı)
    golSure: [4.5, 7],     // göl büyüme süresi sn (eski 2,2–3,2: yavaş yayılan göl)
    golBoy: [0.62, 0.86],  // göl boyu (eski 0,5–0,72)
    tazeRenk: 0x6a0a0a,    // taze kanın ıslak parıltısı (eski 0xa81414)
    jet: 1.0,              // vuruş yönündeki kan fışkırması çarpanı (dar koni, hızlı uzun damlalar)
    hat: 1.0,              // yere vuruş yönünde düşen sıçrama hattı (damla dizisi) çarpanı
    izSans: 0.35,          // ölümde cesetten vuruş yönüne sürüklenme izi çıkma olasılığı
    flasKare: 3,           // bir karede en çok tam vuruş parlaması (kalabalığı biçerken ekran beyaza boğulmasın)
    hasarEn: 0.6,          // hasar alınca kırmızı kenarın en yüksek gücü (eski ≈0,9; ekranın ortası hiç boyanmaz)
    dusukEn: 0.55,         // düşük canda nabız atan kenarın en yüksek gücü (eski ≈0,42 ve ekranın tamamına yayılıyordu)
    gerilim: 0.16,         // arena kilidinde ışık haritası kenarına eklenen koyu-kırmızı gerilim (0 = kapalı)
    devHava: 0.14,         // dev alanında kenar karartması + mor-kırmızı uğursuz ton (0 = kapalı)
    ayakIzi: 7,            // kan gölüne basınca barbarın bıraktığı kanlı ayak izi sayısı (0 = kapalı)
    okIzSure: 0.16, okIzAlfa: 0.7,     // uçan ok izi (eski 0,12 sn, 0,35 alfa)
    buyuIzSure: 0.42, buyuIzAlfa: 0.8, // büyü topu izi (eski 0,3 sn, 0,55 alfa)
    atesNefes: 1.6,        // ateş ışığı titreşim çarpanı (eski 1: çok durgundu)
    sifaMenzil: 230
  };

  var PI2 = Math.PI * 2;
  // Sıfır-GC sabit renk tabloları (olay/kare başına dizi tahsisi yok)
  var KUL_KOR_1 = [0xff9a3a, 0xffb050, 0xff6a20];
  var KUL_KUL_1 = [0x9a958e, 0x7a7670, 0xb4aea6];
  var KUL_KOR_2 = [0xff5a14, 0xff8c24, 0xff360c, 0xffb840];
  var KUL_KUL_2 = [0x342829, 0x51413e, 0x74605a, 0x211b1d];
  var ATES_KOR = [0xffb850, 0xff8c30, 0xff6a20, 0xffd278];
  var ZIRH_KIV_RENK = [0xffffff, 0xdcf0ff, 0xb8dcff, 0xffe4a8];
  var ZIRH_CELIK_RENK = [0xe8f4ff, 0xc8e4ff, 0xffffff];
  var VARIL_ATES_RENK = [0xffe080, 0xff8a20, 0xff5214, 0xffffff];
  var VARIL_KOZ_RENK = [0xffb848, 0xff7018, 0xff4010, 0xffe080];
  var VARIL_DUMAN_RENK = [0x1c1412, 0x2a1c18, 0x38241c];
  var VARIL_KIYMIK_RENK = [0x3a2018, 0x4a2a1c, 0x281612];
  var KOZ_RENK = [0xffb840, 0xff7a1c, 0xff5014, 0xffe080];
  var TOTEM_RUN_RENK = [0xffa829, 0xffe68c, 0xff5a14, 0xffd058];
  var TOTEM_KIV_RENK = [0xffe080, 0xffa828, 0xff6218, 0xffffff];
  var TOTEM_TAS_RENK = [0x2c2632, 0x221d28, 0x38303e];
  var TOTEM_DUMAN_RENK = [0x2c2428, 0x1e181c, 0x3a2a24];
  function r(a, b) { return a + Math.random() * (b - a); }   // efektler oynanış tohumunu bozmasın diye Math.random
  function ri(a, b) { return Math.floor(r(a, b + 1)); }
  function sec(d) { return d[(Math.random() * d.length) | 0]; }
  function sars(g, s) { try { if (AYAR.sarsinti > 0 && OYUN.kamera && OYUN.kamera.sars) OYUN.kamera.sars(g * AYAR.sarsinti, s); } catch (e) {} }

  // ------------------------------------------------------------------ DOKULAR (canvas)
  var D = {};
  // Dokular TUV_K kat pikselle çizilir, mantıksal boyut aynı kalır (retina 2× ekranda büyütülüp bulanıklaşmasın: "gıcır gıcır")
  var TUV_K = 3;
  function tuval(w, h, ciz) {
    var c = document.createElement('canvas'); c.width = w * TUV_K; c.height = h * TUV_K;
    var g = c.getContext('2d'); g.scale(TUV_K, TUV_K); ciz(g, w, h);
    return PIXI.Texture.from(c, { resolution: TUV_K });
  }
  function yumusakDaire(g, cx, cy, rr, duraklar) {
    var gr = g.createRadialGradient(cx, cy, 0, cx, cy, rr);
    for (var i = 0; i < duraklar.length; i++) gr.addColorStop(duraklar[i][0], duraklar[i][1]);
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, rr, 0, PI2); g.fill();
  }
  function lekeCiz(g, w, h, uzun) {   // düzensiz kan sıçraması (beyaz; renk tint ile)
    var cx = w / 2, cy = h / 2, R = w * 0.22;
    g.fillStyle = '#fff';
    g.beginPath();
    var n = 14;
    for (var i = 0; i <= n; i++) {
      var a = i / n * PI2, rr = R * r(0.7, 1.15);
      var x = cx + Math.cos(a) * rr * (uzun ? 1.35 : 1), y = cy + Math.sin(a) * rr * 0.9;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.fill();
    var k = uzun ? 16 : 11;
    for (i = 0; i < k; i++) {            // uydu damlalar
      var aa = uzun ? r(-0.5, 0.5) : r(0, PI2), dd = R * r(1.05, uzun ? 2.1 : 1.8), rd = R * r(0.06, 0.22);
      var px = cx + Math.cos(aa) * dd, py = cy + Math.sin(aa) * dd * 0.9;
      g.beginPath(); g.arc(px, py, rd, 0, PI2); g.fill();
      if (Math.random() < 0.5) {         // damla kuyruğu
        g.beginPath(); g.moveTo(cx + Math.cos(aa) * R * 0.8, cy + Math.sin(aa) * R * 0.7);
        g.lineTo(px + Math.sin(aa) * rd * 0.6, py - Math.cos(aa) * rd * 0.6);
        g.lineTo(px - Math.sin(aa) * rd * 0.6, py + Math.cos(aa) * rd * 0.6); g.fill();
      }
    }
    // boyalı doku: kenarda koyu kuruma halkası, içte fırça lekeleri (tint ile renk)
    g.globalCompositeOperation = 'source-atop';
    yumusakDaire(g, cx, cy, R * 1.9, [[0, 'rgba(225,225,225,1)'], [0.45, 'rgba(250,250,250,1)'], [0.62, 'rgba(190,190,190,1)'], [1, 'rgba(120,120,120,1)']]);
    for (i = 0; i < 9; i++) {
      var bx = cx + r(-R, R), by = cy + r(-R, R) * 0.8, br = R * r(0.15, 0.45), ac = Math.random() < 0.5;
      g.fillStyle = ac ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.22)';
      g.beginPath(); g.ellipse(bx, by, br, br * r(0.4, 0.8), r(0, 3), 0, PI2); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  }
  function parcaCiz(g, w, h, tur) {
    var cx = w / 2, cy = h / 2;
    if (tur === 'tahta') {
      // kalkan kıymığı: sivri, kırık uçlu sıcak koyu meşe parçası
      var l = w * 0.42, k = h * 0.26;
      var pts = [
        [cx - l * r(0.75, 1.0), cy + r(-k * 0.4, k * 0.2)],
        [cx - l * 0.25, cy - k * r(0.7, 1.05)],
        [cx + l * 0.35, cy - k * r(0.5, 0.9)],
        [cx + l * r(0.8, 1.0), cy + r(-k * 0.25, k * 0.35)],
        [cx + l * 0.2, cy + k * r(0.65, 1.0)],
        [cx - l * 0.35, cy + k * r(0.55, 0.95)]
      ];
      g.beginPath(); pts.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.closePath();
      g.fillStyle = '#6b4324'; g.fill();
      g.lineWidth = 2.2; g.strokeStyle = '#1e120a'; g.stroke();
      g.save(); g.clip();
      g.fillStyle = '#9c6c40'; g.fillRect(cx + l * 0.18, cy - k, l, k * 2);   // kırık açık ahşap kesiti
      g.strokeStyle = '#422612'; g.lineWidth = 1.4;
      for (var d = -1; d <= 1; d++) {
        g.beginPath(); g.moveTo(cx - l, cy + d * k * 0.45); g.lineTo(cx + l, cy + d * k * 0.35 + r(-1.5, 1.5)); g.stroke();
      }
      g.restore();
      return;
    }
    if (tur === 'kemik') {
      g.lineCap = 'round'; g.strokeStyle = '#2a2018'; g.lineWidth = 9;
      g.beginPath(); g.moveTo(cx - 11, cy + 3); g.lineTo(cx + 11, cy - 3); g.stroke();
      g.strokeStyle = '#e6dcc4'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(cx - 11, cy + 3); g.lineTo(cx + 11, cy - 3); g.stroke();
      g.fillStyle = '#e6dcc4';
      [[-12, 1], [-10, 6], [12, -6], [10, -1]].forEach(function (p) { g.beginPath(); g.arc(cx + p[0], cy + p[1], 3.2, 0, PI2); g.fill(); });
      g.fillStyle = '#8a1010'; g.beginPath(); g.arc(cx + 2, cy, 3, 0, PI2); g.fill();
      return;
    }
    // et/deri parçası: düzensiz çokgen, koyu kontur
    var n = 9, R = w * 0.3, pts = [];
    for (var i = 0; i < n; i++) { var a = i / n * PI2; pts.push([cx + Math.cos(a) * R * r(0.6, 1.1), cy + Math.sin(a) * R * r(0.5, 0.9)]); }
    g.beginPath(); pts.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.closePath();
    g.fillStyle = tur === 'et' ? '#8e1a16' : '#d8d8d8'; g.fill();
    g.lineWidth = 2.5; g.strokeStyle = tur === 'et' ? '#2a0404' : '#3a3a3a'; g.stroke();
    // kesik yüzey (kanlı)
    g.save(); g.clip();
    g.fillStyle = tur === 'et' ? '#5a0606' : '#9a2a22';
    g.beginPath(); g.ellipse(cx + R * 0.35, cy + R * 0.1, R * 0.55, R * 0.75, 0.4, 0, PI2); g.fill();
    if (tur !== 'et') { g.fillStyle = '#5a0808'; g.beginPath(); g.ellipse(cx + R * 0.45, cy + R * 0.15, R * 0.3, R * 0.45, 0.4, 0, PI2); g.fill(); }
    if (tur === 'et') { g.fillStyle = '#c84a3a'; g.beginPath(); g.arc(cx - R * 0.3, cy - R * 0.2, R * 0.18, 0, PI2); g.fill(); }
    g.restore();
  }
  function parcaHazirYukle() {
    if (D.parcaHazir) return;
    try {
      if (!window.VARLIK || !VARLIK.var || !VARLIK.var('efekt')) return;
      var pe = VARLIK.paketler && VARLIK.paketler.efekt;
      if (!pe || !pe.tekil) return;
      var hazir = [];
      for (var i = 0; i < 12; i++) {
        if (pe.tekil['parca_' + i] === undefined) continue;
        var t = VARLIK.doku('efekt', 'parca_' + i);
        if (t && t !== PIXI.Texture.EMPTY) hazir.push(t);
      }
      if (!hazir.length) return;
      // Paket atlası 3× çözünürlüklü: yere damgalanırken atlas karesi yanlış birimle okunup gri kutu
      // çıkabiliyordu. Her parçayı sınır kontrolüyle kendi küçük tuvaline (gerçek pikselle) kopyala.
      var kopya = [];
      for (i = 0; i < hazir.length; i++) {
        var td = hazir[i], bt = td.baseTexture, src = bt && bt.valid && bt.resource && bt.resource.source;
        if (!src || !src.width || !src.height) return;
        var rs = bt.resolution || 1, f = td.frame;
        if (!f || f.width <= 0 || f.height <= 0) return;
        var sx = Math.max(0, Math.round(f.x * rs)), sy = Math.max(0, Math.round(f.y * rs));
        var sw = Math.min(src.width - sx, Math.round(f.width * rs)), sh = Math.min(src.height - sy, Math.round(f.height * rs));
        if (sw <= 0 || sh <= 0) return;
        var c = document.createElement('canvas'); c.width = sw; c.height = sh;
        c.getContext('2d').drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
        var kt = PIXI.Texture.from(c, { resolution: rs });
        if (!kt || !kt.valid || kt.width <= 0 || kt.height <= 0) return;
        kopya.push(kt);
      }
      if (kopya.length === hazir.length) D.parcaHazir = kopya;
    } catch (e) {}
  }

  function dokulariUret() {
    if (D.damla) return;
    D.damla = tuval(16, 16, function (g) { yumusakDaire(g, 8, 8, 7.5, [[0, 'rgba(255,255,255,1)'], [0.68, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]); });
    D.korNokta = tuval(20, 20, function (g) {
      yumusakDaire(g, 10, 10, 9.5, [
        [0, 'rgba(255,247,224,1)'], [.27, 'rgba(255,227,195,.99)'],
        [.49, 'rgba(255,161,104,.64)'], [.73, 'rgba(255,96,61,.22)'], [1, 'rgba(255,96,61,0)']
      ]);
    });
    D.yumusak = tuval(128, 128, function (g) { yumusakDaire(g, 64, 64, 64, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.55)'], [0.6, 'rgba(255,255,255,0.15)'], [1, 'rgba(255,255,255,0)']]); });
    D.duman = tuval(64, 64, function (g) {
      for (var i = 0; i < 7; i++) yumusakDaire(g, r(22, 42), r(22, 42), r(12, 20), [[0, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]);
    });
    D.cizgi = tuval(64, 8, function (g) {   // kıvılcım / hız çizgisi (sağa bakar, keskin uçlu)
      var gr = g.createLinearGradient(0, 0, 64, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,1)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, 4); g.lineTo(59, 1.3); g.arc(59, 4, 2.7, -Math.PI / 2, Math.PI / 2); g.lineTo(0, 4); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.moveTo(26, 4); g.lineTo(61, 2.8); g.lineTo(61, 5.2); g.closePath(); g.fill();
    });
    D.ofkeKivilcim = tuval(60, 12, function (g) {
      var iz = g.createLinearGradient(0, 0, 60, 0);
      iz.addColorStop(0, 'rgba(228,13,22,0)');
      iz.addColorStop(0.47, 'rgba(243,22,32,0.55)');
      iz.addColorStop(0.83, 'rgba(255,62,47,0.96)');
      iz.addColorStop(1, 'rgba(255,116,73,0.98)');
      g.fillStyle = iz;
      g.beginPath(); g.moveTo(0, 6); g.quadraticCurveTo(28, 4.8, 53, 1.2);
      g.quadraticCurveTo(59, 1.2, 60, 6); g.quadraticCurveTo(57, 10.5, 52, 10.2); g.closePath(); g.fill();
      var cekirdek = g.createLinearGradient(18, 0, 58, 0);
      cekirdek.addColorStop(0, 'rgba(255,43,32,0)');
      cekirdek.addColorStop(0.62, 'rgba(255,121,85,0.95)');
      cekirdek.addColorStop(1, 'rgba(255,237,209,1)');
      g.strokeStyle = cekirdek; g.lineWidth = 2.2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(18, 6); g.lineTo(56, 5.8); g.stroke();
    });
    D.yildiz = tuval(96, 96, function (g) {  // vuruş parlaması (keskin çizgili)
      yumusakDaire(g, 48, 48, 20, [[0, 'rgba(255,255,255,1)'], [0.45, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)']]);
      g.fillStyle = 'rgba(255,255,255,0.98)';
      for (var i = 0; i < 6; i++) {
        var a = i / 6 * PI2 + r(-0.15, 0.15), L = i % 2 ? 46 : 33;
        g.beginPath(); g.moveTo(48 + Math.cos(a) * L, 48 + Math.sin(a) * L);
        g.lineTo(48 + Math.cos(a + 1.57) * 2.8, 48 + Math.sin(a + 1.57) * 2.8);
        g.lineTo(48 + Math.cos(a - 1.57) * 2.8, 48 + Math.sin(a - 1.57) * 2.8); g.fill();
      }
    });
    D.isik = tuval(128, 128, function (g) { yumusakDaire(g, 64, 64, 64, [[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,255,255,0.7)'], [0.65, 'rgba(255,255,255,0.22)'], [1, 'rgba(255,255,255,0)']]); });
    D.halka = tuval(128, 128, function (g) {
      g.strokeStyle = 'rgba(255,255,255,1)'; g.lineWidth = 6; g.beginPath(); g.arc(64, 64, 56, 0, PI2); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 14; g.beginPath(); g.arc(64, 64, 54, 0, PI2); g.stroke();
    });
    function hilalCelikCiz(yarimYay, R) {
      return tuval(280, 280, function (g) {   // dış kenar: keskin soğuk çelik parıltısı (bulanıklık yok)
        var cx = 140, cy = 140, n = 128, ic = [], dis = [];
        for (var i = 0; i <= n; i++) {
          var u = i / n, a = (u * 2 - 1) * yarimYay;
          var kalin = Math.pow(u, 0.85) * Math.sin(Math.pow(u, 0.72) * Math.PI);
          var w = 1.0 + 18 * kalin;
          dis.push([cx + Math.cos(a) * (R + 0.16 * w), cy + Math.sin(a) * (R + 0.16 * w)]);
          ic.push([cx + Math.cos(a) * (R - 0.58 * w), cy + Math.sin(a) * (R - 0.58 * w)]);
        }
        var dolgu = 'rgba(255,255,255,0.65)';
        if (g.createConicGradient) {
          dolgu = g.createConicGradient(-yarimYay, cx, cy);
          var span = (yarimYay * 2) / PI2;
          for (i = 0; i <= 24; i++) {
            var uu = i / 24, alfa = Math.min(0.92, 0.02 + 0.90 * Math.pow(uu, 1.55) * (1 - 0.28 * Math.pow(uu, 5)));
            dolgu.addColorStop(Math.min(1, uu * span), 'rgba(255,255,255,' + alfa.toFixed(3) + ')');
          }
          dolgu.addColorStop(Math.min(1, span + 0.008), 'rgba(255,255,255,0)');
        }
        g.fillStyle = dolgu; g.beginPath(); g.moveTo(dis[0][0], dis[0][1]);
        for (i = 1; i <= n; i++) g.lineTo(dis[i][0], dis[i][1]);
        for (i = n; i >= 0; i--) g.lineTo(ic[i][0], ic[i][1]);
        g.closePath(); g.fill();
        // jilet gibi keskin dış bıçak kenarı + ön uç çelik parıltısı
        g.lineCap = 'round';
        g.strokeStyle = 'rgba(255,255,255,0.96)'; g.lineWidth = 2.6;
        g.beginPath(); g.arc(cx, cy, R + 2.5, -yarimYay * 0.55, yarimYay * 0.96); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,1)'; g.lineWidth = 3.4;
        g.beginPath(); g.arc(cx, cy, R + 3.2, yarimYay * 0.45, yarimYay * 0.98); g.stroke();
      });
    }
    function hilalIcCiz(yarimYay, R) {
      return tuval(280, 280, function (g) {   // iç kenar: keskin şeritli sıcak hareket izi
        var cx = 140, cy = 140, n = 96;
        function serit(rOfset, basU, bitU, kalinPx, alfaMax) {
          g.lineCap = 'round';
          var parcaSayi = 16;
          for (var p = 0; p < parcaSayi; p++) {
            var u0 = basU + (bitU - basU) * (p / parcaSayi);
            var u1 = basU + (bitU - basU) * ((p + 1) / parcaSayi);
            var uMid = (u0 + u1) * 0.5;
            var a0 = (u0 * 2 - 1) * yarimYay, a1 = (u1 * 2 - 1) * yarimYay;
            var prof = Math.sin(((uMid - basU) / (bitU - basU)) * Math.PI);
            var alf = alfaMax * Math.pow(uMid, 0.9) * Math.pow(Math.max(0, prof), 0.7);
            if (alf < 0.02) continue;
            g.strokeStyle = 'rgba(255,255,255,' + alf.toFixed(3) + ')';
            g.lineWidth = Math.max(0.8, kalinPx * (0.4 + 0.6 * prof));
            g.beginPath(); g.arc(cx, cy, R + rOfset, a0, a1); g.stroke();
          }
        }
        // dışa yakın sıcak çekirdek + içte 2 keskin hız şeridi
        serit(-7, 0.08, 0.96, 3.2, 0.85);
        serit(-13, 0.14, 0.90, 2.0, 0.68);
        serit(-19, 0.22, 0.82, 1.3, 0.48);
      });
    }
    D.hilal = hilalCelikCiz(1.31, 96);         // 150° normal savurma (vur, vur2)
    D.hilalIc = hilalIcCiz(1.31, 96);
    D.hilalGenis = hilalCelikCiz(1.66, 96);    // 190° geniş 3. vuruş (vur3)
    D.hilalGenisIc = hilalIcCiz(1.66, 96);
    D.kenar = tuval(320, 180, function (g, w, h) {   // ekran kenarı karartma (beyaz; tint ile renk)
      var gr = g.createRadialGradient(w / 2, h / 2, h * 0.28, w / 2, h / 2, w * 0.62);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,1)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    D.altIsik = tuval(64, 180, function (g, w, h) {  // Bölüm II: alttan yukarı sıcak volkanik alt ışık (üst/orta temiz)
      var gr = g.createLinearGradient(0, h, 0, 0);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.28, 'rgba(255,255,255,0.45)');
      gr.addColorStop(0.58, 'rgba(255,255,255,0.08)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    D.beyaz = PIXI.Texture.WHITE;
    D.leke = []; for (var i = 0; i < 4; i++) D.leke.push(tuval(96, 96, function (g, w, h) { lekeCiz(g, w, h, false); }));
    D.lekeUzun = []; for (i = 0; i < 3; i++) D.lekeUzun.push(tuval(128, 96, function (g, w, h) { lekeCiz(g, w, h, true); }));
    // 4. tur: göl tek düz oval değil; birkaç loblu, kenarı koyu kurumuş, içi derin, ince ıslak yansımalı (renk tint ile)
    function golCiz(g) {
      g.fillStyle = '#fff';
      var lob = ri(4, 6);
      g.beginPath(); g.ellipse(64, 64, 40, 25, r(-0.2, 0.2), 0, PI2); g.fill();
      for (var i = 0; i < lob; i++) {
        var a = i / lob * PI2 + r(-0.4, 0.4), d = r(14, 26), lr = r(13, 22);
        g.beginPath(); g.ellipse(64 + Math.cos(a) * d * 1.25, 64 + Math.sin(a) * d * 0.7, lr * 1.2, lr * 0.75, r(-0.3, 0.3), 0, PI2); g.fill();
      }
      for (i = 0; i < 7; i++) {   // kenardan kopmuş küçük damlalar
        var aa = r(0, PI2), dd = r(44, 58);
        g.beginPath(); g.arc(64 + Math.cos(aa) * dd, 64 + Math.sin(aa) * dd * 0.62, r(1.5, 3.5), 0, PI2); g.fill();
      }
      g.globalCompositeOperation = 'source-atop';
      yumusakDaire(g, 64, 64, 62, [[0, 'rgba(150,150,150,1)'], [0.55, 'rgba(205,205,205,1)'], [0.82, 'rgba(255,255,255,1)'], [1, 'rgba(130,130,130,1)']]);
      for (i = 0; i < 6; i++) { g.fillStyle = 'rgba(0,0,0,' + r(0.1, 0.22).toFixed(2) + ')'; g.beginPath(); g.ellipse(64 + r(-30, 30), 64 + r(-16, 16), r(6, 16), r(3, 8), r(0, 3), 0, PI2); g.fill(); }   // pıhtı / derinlik
      g.fillStyle = 'rgba(255,255,255,0.28)'; g.beginPath(); g.ellipse(52, 55, 15, 3.2, -0.18, 0, PI2); g.fill();  // ince ıslak yansıma
      g.fillStyle = 'rgba(255,255,255,0.16)'; g.beginPath(); g.ellipse(74, 70, 8, 2, -0.1, 0, PI2); g.fill();
      g.globalCompositeOperation = 'source-over';
    }
    D.gol = tuval(128, 128, golCiz);
    D.golCesit = [D.gol, tuval(128, 128, golCiz), tuval(128, 128, golCiz)];
    // sürüklenme izi: sağa doğru incelen, fırça kıllı kan şeridi
    D.iz = []; for (i = 0; i < 2; i++) D.iz.push(tuval(160, 48, function (g, w, h) {
      g.fillStyle = '#fff';
      for (var k = 0; k < 9; k++) {
        var y0 = h / 2 + r(-9, 9), kal = r(2, 6), L = r(0.55, 1) * (w - 14);
        g.beginPath(); g.moveTo(8, y0 - kal); g.quadraticCurveTo(8 + L * 0.5, y0 + r(-3, 3) - kal * 0.6, 8 + L, y0 + r(-2, 2));
        g.quadraticCurveTo(8 + L * 0.5, y0 + r(-3, 3) + kal * 0.6, 8, y0 + kal); g.fill();
      }
      g.beginPath(); g.ellipse(14, h / 2, 12, 13, 0, 0, PI2); g.fill();
      for (k = 0; k < 6; k++) { g.beginPath(); g.arc(r(30, w - 10), h / 2 + r(-16, 16), r(1, 2.6), 0, PI2); g.fill(); }
      g.globalCompositeOperation = 'source-atop';
      var gr = g.createLinearGradient(0, 0, w, 0);
      gr.addColorStop(0, 'rgba(235,235,235,1)'); gr.addColorStop(0.6, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(170,170,170,1)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'source-over';
    }));
    D.ayak = tuval(14, 22, function (g) {   // tek çizme izi (taban + topuk), yukarı bakar
      g.fillStyle = '#fff';
      g.beginPath(); g.ellipse(7, 7, 4.6, 6.2, 0, 0, PI2); g.fill();
      g.beginPath(); g.ellipse(7, 17, 3.6, 3.8, 0, 0, PI2); g.fill();
    });
    // hasar/düşük can kenarı: yalnız ekranın dış şeridi (orta tamamen temiz)
    D.kenarInce = tuval(320, 180, function (g, w, h) {
      var b = 30, i;
      var yonler = [[0, 0, 0, b, w, b], [0, h, 0, h - b, w, b], [0, 0, b, 0, b, h], [w, 0, w - b, 0, b, h]];
      for (i = 0; i < 4; i++) {
        var y = yonler[i], gr = g.createLinearGradient(y[0], y[1], y[2], y[3]);
        gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.42)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr;
        if (i === 0) g.fillRect(0, 0, w, b); else if (i === 1) g.fillRect(0, h - b, w, b); else if (i === 2) g.fillRect(0, 0, b, h); else g.fillRect(w - b, 0, b, h);
      }
    });
    D.catlak = tuval(256, 160, function (g) {   // dev yere vurunca çatlak: kırık, incelen, dallanan çizgiler
      g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round';
      function kol(x, y, a, w, n, dal) {
        for (var s = 0; s < n; s++) {
          a += r(-0.55, 0.55); var L = r(7, 15), nx = x + Math.cos(a) * L, ny = y + Math.sin(a) * L * 0.62;
          g.lineWidth = Math.max(0.8, w * (1 - s / n)); g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke();
          x = nx; y = ny;
          if (dal && Math.random() < 0.18) kol(x, y, a + r(-1, 1), g.lineWidth * 0.7, ri(2, 4), false);
        }
      }
      for (var i = 0; i < 9; i++) kol(128 + r(-6, 6), 80 + r(-4, 4), i / 9 * PI2 + r(-0.25, 0.25), r(7, 10), ri(6, 9), true);
      yumusakDaire(g, 128, 80, 30, [[0, 'rgba(255,255,255,0.85)'], [1, 'rgba(255,255,255,0)']]);
      g.globalCompositeOperation = 'destination-in';
      yumusakDaire(g, 128, 80, 78, [[0, 'rgba(255,255,255,1)'], [0.72, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]);
      g.globalCompositeOperation = 'source-over';
    });
    D.parca = { deri: [], et: [], kemik: [], tahta: [] };
    for (i = 0; i < 3; i++) {
      D.parca.deri.push(tuval(40, 40, function (g, w, h) { parcaCiz(g, w, h, 'deri'); }));
      D.parca.et.push(tuval(36, 36, function (g, w, h) { parcaCiz(g, w, h, 'et'); }));
      D.parca.tahta.push(tuval(42, 22, function (g, w, h) { parcaCiz(g, w, h, 'tahta'); }));
    }
    D.parca.kemik.push(tuval(34, 24, function (g, w, h) { parcaCiz(g, w, h, 'kemik'); }));
    D.tas = []; for (i = 0; i < 3; i++) D.tas.push(tuval(24, 24, function (g) {
      g.fillStyle = '#8a8478'; g.strokeStyle = '#2a2622'; g.lineWidth = 2; g.beginPath();
      for (var k = 0; k < 7; k++) { var a = k / 7 * PI2, rr = r(6, 10); var x = 12 + Math.cos(a) * rr, y = 12 + Math.sin(a) * rr; if (k) g.lineTo(x, y); else g.moveTo(x, y); }
      g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#b0a898'; g.beginPath(); g.arc(10, 9, 3, 0, PI2); g.fill();
    }));
    // varsa hazır sanat (varlik/efekt.js): parca_*
    parcaHazirYukle();
  }

  // ------------------------------------------------------------------ PARÇACIK HAVUZU (sabit boyutlu diziler)
  // tür: 1 damla (yere düşer → leke) · 2 bulut (toz/duman/sis) · 3 kıvılcım · 4 parça (seker, durur → damgalanır)
  //      5 kül/kor (ekranda dolaşır) · 6 sabit (parlama/halka) · 7 taş
  var DAMLA = 1, BULUT = 2, KIV = 3, PARCA = 4, KUL = 5, SABIT = 6, TAS = 7;
  function Havuz(n, kap, karisim) {
    this.n = n; this.kap = kap;
    var F = function () { return new Float32Array(n); };
    this.x = F(); this.y = F(); this.z = F(); this.vx = F(); this.vy = F(); this.vz = F();
    this.om = F(); this.omMax = F(); this.s0 = F(); this.s1 = F(); this.a0 = F(); this.rot = F(); this.vrot = F();
    this.surt = F(); this.yer = F(); this.boy = F(); this.sayac = F();
    this.tur = new Uint8Array(n); this.canli = new Uint8Array(n); this.renk = new Uint32Array(n); this.ek = new Uint8Array(n);
    this.bos = new Int32Array(n); this.bosN = n; for (var i = 0; i < n; i++) this.bos[i] = n - 1 - i;
    this.sp = []; this.aktif = 0;
    for (i = 0; i < n; i++) {
      var s = new PIXI.Sprite(D.damla); s.anchor.set(0.5); s.visible = false; if (karisim) s.blendMode = karisim;
      kap.addChild(s); this.sp.push(s);
    }
  }
  Havuz.prototype.al = function (tur, doku, x, y, z, omur) {
    if (this.bosN === 0) return -1;
    var i = this.bos[--this.bosN];
    this.canli[i] = 1; this.tur[i] = tur; this.aktif++;
    this.x[i] = x; this.y[i] = y; this.z[i] = z || 0; this.vx[i] = this.vy[i] = this.vz[i] = 0;
    this.om[i] = this.omMax[i] = omur; this.s0[i] = this.s1[i] = 1; this.a0[i] = 1; this.rot[i] = 0; this.vrot[i] = 0;
    this.surt[i] = 0; this.yer[i] = 0; this.boy[i] = 1; this.sayac[i] = 0; this.renk[i] = 0xffffff; this.ek[i] = 0;
    var s = this.sp[i]; s.texture = doku; s.visible = true; s.alpha = 1; s.rotation = 0; s.scale.set(1);
    // kıvılcım ilk güncellemeye kadar görünmesin: yoksa bir kare boyunca tam boy, YATAY sarı çizgi olarak çiziliyordu (19 Kasım)
    if (tur === KIV || tur === KUL) s.alpha = 0;
    return i;
  };
  Havuz.prototype.birak = function (i) {
    if (!this.canli[i]) return;
    this.canli[i] = 0; this.sp[i].visible = false; this.bos[this.bosN++] = i; this.aktif--;
  };
  Havuz.prototype.temizle = function () { for (var i = 0; i < this.n; i++) this.birak(i); };

  // ------------------------------------------------------------------ DURUM
  var hazir = false, kok = {}, N, P;   // N: normal havuz, P: parlak (additive) havuz
  var renderer = null, bosKap = null;
  var dilimler = [], damgaKap = null, damgaSp = [], damgaN = 0, damgaKayip = 0;
  var gecici = [];          // {sp, om, omMax, tip, ...} kısa ömürlü tekil sprite'lar (hilal, göl, hayalet, bağ çizgisi)
  var tekilHavuz = { normal: [], parlak: [], leke: [] };
  var ofkeAcik = false, ofkeT = 0, ofkeGiris = 0, ofkeKozAra = 0, hasarDarbe = 0, gT = 0;
  var atilma = null;        // {t, aci}
  var baltaUcuyor = false, sonBalta = null, baltaIzT = 0, baltaIzAra = 0;
  var atesIsiklari = [], atesSayac = [];
  var istatistik = { damga: 0, vurus: 0, olum: 0 };
  var flasBuKare = 0;       // bu karedeki tam vuruş parlaması sayısı (AYAR.flasKare)
  var bolumNo = 1;
  var olcum = { n: 0, top: 0, en: 0, son: 0 };   // efektin kare başına maliyeti (ms): guncelle + herKare

  function aktifBolum() {
    return window.OYUN ? OYUN.bolum : 1;
  }
  function bolumAtmosferUygula(no) {
    bolumNo = no;
    if (!hazir) return;
    var v2 = bolumNo === 2;
    kok.vinyet.tint = v2 ? 0x480e04 : 0x000000;
    kok.vinyet.alpha = v2 ? AYAR.volkanVinyet : AYAR.vinyet;
    if (kok.volkan) {
      kok.volkan.visible = v2 && AYAR.volkanAltIsik > 0;
      kok.volkan.tint = 0xe83c0c;
      kok.volkan.alpha = v2 ? AYAR.volkanAltIsik : 0;
    }
    if (IH) {
      IH.ortam.tint = haritaOrtam(true, false);
      IH.vinyet.tint = v2 ? 0x420e04 : 0x000000;
      IH.vinyet.alpha = v2 ? AYAR.haritaVinyetVolkan : AYAR.haritaVinyet;
    }
    if (kulKuruldu) {
      // mevcut sabit boyutlu havuzu sıfır tahsisle yeni bölüm stiline çevir
      var i;
      for (i = 0; i < P.n; i++) if (P.canli[i] && P.tur[i] === KUL && P.ek[i] === 0) kulDogur(P, i, true);
      for (i = 0; i < N.n; i++) if (N.canli[i] && N.tur[i] === KUL && N.ek[i] === 0) kulDogur(N, i, true);
    }
  }

  var hasarSayilari = [];
  var HASAR_SAYI_SURE = 0.68, HASAR_BIRLESIM = 0.20;
  function hasarSayilariKur(ust) {
    if (!AYAR.hasarSayisi) return;
    var ad = 'BarbarHasar';
    PIXI.BitmapFont.from(ad, { fontFamily: 'Arial', fontWeight: 'bold', fontSize: 26, fill: '#ffffff', stroke: '#1b1110', strokeThickness: 4 },
      { chars: '0123456789−', resolution: 2 });
    var kapSayi = kap('hasarSayilari', ust);
    // İlk yuva Bahtiyar için ayrılır, sekiz yuva düşmanlar arasında paylaşılır.
    for (var i = 0; i < 9; i++) {
      var yazi = new PIXI.BitmapText('0', { fontName: ad, fontSize: i === 0 ? 26 : 22, tint: i === 0 ? 0xff765e : 0xffe7bd });
      yazi.anchor.set(0.5); yazi.visible = false;
      kapSayi.addChild(yazi);
      hasarSayilari.push({ yazi: yazi, bitis: -1, son: -1 });
    }
  }

  function hasarSayisiGoster(hedef, miktar, gelen) {
    if (!hasarSayilari.length || !hedef || !(miktar > 0) || !isFinite(miktar) || OYUN.durum !== 'oyun') return;
    var t = OYUN.zaman.gercekT;
    var yuva = hasarSayilari[0];
    if (!gelen) {
      yuva = hasarSayilari[1];
      for (var i = 1; i < hasarSayilari.length; i++) {
        var aday = hasarSayilari[i];
        if (aday.hedef === hedef && aday.id === hedef.id && aday.bitis > t) { yuva = aday; break; }
        if (aday.bitis < yuva.bitis) yuva = aday;
      }
    }
    var birlesir = yuva.hedef === hedef && yuva.id === hedef.id && t - yuva.son <= HASAR_BIRLESIM && t < yuva.bitis;
    yuva.miktar = (birlesir ? yuva.miktar : 0) + miktar;
    yuva.yazi.text = (gelen ? '−' : '') + Math.max(1, Math.round(yuva.miktar));
    yuva.hedef = hedef; yuva.id = hedef.id; yuva.son = t; yuva.bitis = t + HASAR_SAYI_SURE;
    if (birlesir) return;
    var buyuk = !!hedef.devMi || hedef === window.VARGOR;
    yuva.basla = t;
    var y = buyuk ? 178 : gelen ? 87 : 94;
    yuva.x = hedef.x + (gelen ? 12 : buyuk ? 0 : ((hedef.id || 0) % 3 - 1) * 18);
    yuva.y = hedef.y - y;
  }

  function hasarSayilariGuncelle() {
    var t = OYUN.zaman.gercekT, V = OYUN.gorunum;
    for (var i = 0; i < hasarSayilari.length; i++) {
      var s = hasarSayilari[i];
      if (t >= s.bitis || OYUN.durum !== 'oyun') { s.yazi.visible = false; continue; }
      var p = OYUN.dunyaEkran(s.x, s.y);
      s.yazi.visible = p.x >= V.x0 + 14 && p.x <= V.x0 + V.w - 14 && p.y >= V.y0 + 22 && p.y <= V.y0 + V.h;
      if (!s.yazi.visible) continue;
      var kalan = (s.bitis - t) / HASAR_SAYI_SURE;
      var yukselis = 1 - Math.min(1, (t - s.basla) / HASAR_SAYI_SURE);
      s.yazi.position.set(p.x, Math.max(V.y0 + 24, p.y - 34 * (1 - yukselis * yukselis)));
      s.yazi.alpha = Math.min(1, kalan * 2.8);
    }
  }

  function kap(ad, ust, karisim) { var c = new PIXI.Container(); c.name = 'efekt_' + ad; if (karisim) c.blendMode = karisim; ust.addChild(c); return c; }

  function kur() {
    if (hazir) return true;
    if (!window.OYUN || !OYUN.katman || !OYUN.app) return false;
    dokulariUret();
    renderer = OYUN.app.renderer; bosKap = new PIXI.Container();
    AYAR.lekeCoz = Math.max(1, Math.min(2, Math.round(renderer.resolution || 1)));
    var K = OYUN.katman, ADD = PIXI.BLEND_MODES.ADD;
    // leke katmanı: dilimler + büyüyen göller
    kok.dilim = kap('dilim', K.leke); kok.gol = kap('gol', K.leke);
    // efekt katmanı: normal parçacıklar, hayaletler, parlak parçacıklar
    kok.hayalet = kap('hayalet', K.efekt); kok.normal = kap('normal', K.efekt); kok.tekilN = kap('tekilN', K.efekt);
    kok.kasirgaArka = new PIXI.Graphics();
    kok.kasirgaOn = new PIXI.Graphics();
    kok.kasirgaArka.zEk = -32; kok.kasirgaOn.zEk = 36;
    kok.kasirgaArka.visible = kok.kasirgaOn.visible = false;
    K.varlik.addChild(kok.kasirgaArka, kok.kasirgaOn);
    // ışık katmanı: önce soğuk ton (çarpma), sonra sıcak ışıklar ve parlayan parçacıklar (toplama; tonla kararmasın)
    kok.ton = new PIXI.Sprite(D.beyaz); kok.ton.tint = AYAR.ton; kok.ton.blendMode = PIXI.BLEND_MODES.MULTIPLY; K.isik.addChild(kok.ton);
    kok.isik = kap('isik', K.isik); kok.parlak = kap('parlak', K.isik); kok.tekilP = kap('tekilP', K.isik);
    // üst: vinyet, Bölüm II volkanik alt ışık, öfke tonu, hasar kenarı
    kok.vinyet = new PIXI.Sprite(D.kenar); kok.vinyet.tint = 0x000000; kok.vinyet.alpha = AYAR.vinyet; K.ust.addChild(kok.vinyet);
    kok.volkan = new PIXI.Sprite(D.altIsik); kok.volkan.tint = 0xe83c0c; kok.volkan.blendMode = ADD; kok.volkan.alpha = 0; kok.volkan.visible = false; K.ust.addChild(kok.volkan);
    kok.ofkeTon = new PIXI.Sprite(D.beyaz); kok.ofkeTon.tint = 0xff3a14; kok.ofkeTon.blendMode = ADD; kok.ofkeTon.alpha = 0; K.ust.addChild(kok.ofkeTon);
    kok.ofkeKenar = new PIXI.Sprite(D.kenar); kok.ofkeKenar.tint = 0xc02008; kok.ofkeKenar.blendMode = ADD; kok.ofkeKenar.alpha = 0; K.ust.addChild(kok.ofkeKenar);
    kok.hasar = new PIXI.Sprite(D.kenarInce); kok.hasar.tint = 0xa00a08; kok.hasar.alpha = 0; K.ust.addChild(kok.hasar);
    hasarSayilariKur(K.ust);

    N = new Havuz(AYAR.havuzNormal, kok.normal, 0);
    P = new Havuz(AYAR.havuzParlak, kok.parlak, ADD);

    // leke dilimleri (RenderTexture halkası)
    var gen = (OYUN.W || 1280) + AYAR.dilimKenar * 2;
    for (var i = 0; i < AYAR.dilimSayi; i++) {
      var rt = PIXI.RenderTexture.create({ width: gen, height: AYAR.dilimY, resolution: AYAR.lekeCoz });   // retina: lekeler ekran pikseliyle net
      var sp = new PIXI.Sprite(rt); sp.x = -AYAR.dilimKenar; sp.visible = false; kok.dilim.addChild(sp);
      dilimler.push({ rt: rt, sp: sp, k: -999999, dolu: false });
    }
    damgaKap = new PIXI.Container();
    for (i = 0; i < AYAR.damgaKare; i++) { var d = new PIXI.Sprite(D.damla); d.anchor.set(0.5); d.visible = false; damgaKap.addChild(d); damgaSp.push(d); }
    // ateş ışıkları
    for (i = 0; i < 16; i++) {
      var a = new PIXI.Sprite(D.yumusak); a.anchor.set(0.5); a.blendMode = ADD; a.visible = false; kok.isik.addChild(a);
      var c = new PIXI.Sprite(D.yumusak); c.anchor.set(0.5); c.blendMode = ADD; c.visible = false; kok.isik.addChild(c);
      atesIsiklari.push([a, c]);
    }
    kok.oyuncuIsik = new PIXI.Sprite(D.yumusak); kok.oyuncuIsik.anchor.set(0.5); kok.oyuncuIsik.blendMode = ADD; kok.oyuncuIsik.tint = 0xffe2c0; kok.isik.addChild(kok.oyuncuIsik);
    kok.ofkeHale = new PIXI.Sprite(D.yumusak); kok.ofkeHale.anchor.set(0.5); kok.ofkeHale.blendMode = ADD; kok.ofkeHale.tint = 0xff2a10; kok.ofkeHale.visible = false; kok.isik.addChild(kok.ofkeHale);
    kok.ton.blendMode = ADD; kok.ton.tint = AYAR.ayLift;   // artık: gölgeleri serin mavi-griye kaldıran hafif ay ışığı
    kok.silgi = new PIXI.Sprite(PIXI.Texture.WHITE); kok.silgi.blendMode = PIXI.BLEND_MODES.ERASE;
    haritaKur(); kahramanKur(); sisKur();
    hazir = true;
    bolumAtmosferUygula(aktifBolum());
    return true;
  }

  // ------------------------------------------------------------------ KALICI LEKELER (dilimli RenderTexture)
  function dilimAraligi() {
    // yakınlık: görünen dünyanın (OYUN.gorus) ±260 px çevresi; tasarım penceresi de her zaman dahil (oynanış alanında leke kaybolmasın)
    var ky = (OYUN.kamera && OYUN.kamera.y) || 0, H = OYUN.H || 720, Y = AYAR.dilimY, V = gorD();
    var a = Math.min(ky, V.y), b = Math.max(ky + H, V.y + V.h);
    return [Math.floor((a - 260) / Y), Math.floor((b + 260) / Y)];
  }
  function dilimleriGuncelle() {
    var ar = dilimAraligi(), Y = AYAR.dilimY;
    for (var k = ar[0]; k <= ar[1]; k++) {
      var var_ = false;
      for (var i = 0; i < dilimler.length; i++) if (dilimler[i].k === k) { var_ = true; break; }
      if (var_) continue;
      // aralık dışında kalan, en uzaktaki dilimi yeniden kullan
      var en = -1, enU = -1;
      for (i = 0; i < dilimler.length; i++) {
        var dk = dilimler[i].k;
        if (dk >= ar[0] && dk <= ar[1]) continue;
        var u = dk < -99999 ? 1e9 : Math.abs(dk - k);
        if (u > enU) { enU = u; en = i; }
      }
      if (en < 0) continue;
      var dl = dilimler[en]; dl.k = k; dl.sp.y = k * Y; dl.sp.visible = true;
      if (dl.dolu) { renderer.render(bosKap, { renderTexture: dl.rt, clear: true }); dl.dolu = false; }
    }
  }
  // dünyaya leke damgası koy (bu kare sonunda dokuya yazılır)
  function damga(doku, x, y, rot, sx, sy, renk, alfa) {
    if (!doku || doku === PIXI.Texture.EMPTY || !doku.valid) return;
    if (damgaN >= damgaSp.length) { damgaKayip++; return; }
    var s = damgaSp[damgaN++];
    s.texture = doku; s.x = x; s.y = y; s.rotation = rot || 0; s.scale.set(sx, sy === undefined ? sx : sy);
    s.tint = renk === undefined ? 0xffffff : renk; s.alpha = alfa === undefined ? 1 : alfa; s.visible = true;
    istatistik.damga++;
  }
  // eski lekeler zamanla solar (kalabalıkta daha hızlı): zemin tümüyle kana boyanmasın, yol okunur kalsın
  var solT = 0, sonDamga = 0;
  function lekeSoldur(gd) {
    if (OYUN.durum !== 'oyun') return;
    solT += gd; if (solT < 2) return; solT = 0;
    var yeni = istatistik.damga - sonDamga; sonDamga = istatistik.damga;   // son 2 sn'deki damga
    var a = Math.min(0.06, Math.max(0, yeni - 160) / 14000 * AYAR.lekeSolma);   // kan kalıcı: yalnız çok yoğun birikimde (2 sn'de 160+ damga) eskiler solar
    if (a <= 0.002) return;
    var sg = kok.silgi; sg.alpha = a; sg.width = (OYUN.W || 1280) + AYAR.dilimKenar * 2; sg.height = AYAR.dilimY; sg.x = 0; sg.y = 0;
    for (var d = 0; d < dilimler.length; d++) { var dl = dilimler[d]; if (dl.dolu && dl.sp.visible) renderer.render(sg, { renderTexture: dl.rt, clear: false }); }
  }
  function damgalariYaz() {
    if (!damgaN) return;
    var Y = AYAR.dilimY, kx = AYAR.dilimKenar;
    for (var d = 0; d < dilimler.length; d++) {
      var dl = dilimler[d]; if (!dl.sp.visible) continue;
      var y0 = dl.k * Y, y1 = y0 + Y, say = 0;
      for (var i = 0; i < damgaN; i++) {
        var s = damgaSp[i], h = Math.max(s.texture.width * Math.abs(s.scale.x), s.texture.height * Math.abs(s.scale.y)) * 0.6;
        var ic = s.y + h > y0 && s.y - h < y1;
        s.visible = ic; if (ic) say++;
      }
      if (!say) continue;
      damgaKap.x = kx; damgaKap.y = -y0;
      renderer.render(damgaKap, { renderTexture: dl.rt, clear: false });
      dl.dolu = true;
    }
    for (i = 0; i < damgaN; i++) damgaSp[i].visible = false;
    damgaN = 0;
  }

  // ------------------------------------------------------------------ TEKİL KISA ÖMÜRLÜ SPRITE'LAR
  function tekil(tip, doku, ust, karisim) {
    var dz = tekilHavuz[tip], s = null;
    for (var i = 0; i < dz.length; i++) if (!dz[i]._kullan) { s = dz[i]; break; }
    if (!s) {
      if (dz.length >= 48) return null;
      s = new PIXI.Sprite(doku); s.anchor.set(0.5); if (karisim) s.blendMode = karisim; ust.addChild(s); dz.push(s);
    }
    s._kullan = true; s.texture = doku; s.visible = true; s.alpha = 1; s.rotation = 0; s.scale.set(1); s.skew.set(0, 0); s.anchor.set(0.5); s.tint = 0xffffff;
    return s;
  }
  function geciciEkle(s, om, guncelle, bitince) { if (s) gecici.push({ s: s, om: om, omMax: om, g: guncelle, b: bitince }); }

  // ------------------------------------------------------------------ YAYICILAR
  function kanDamlasi(x, y, z, aci, yay, hizA, hizB, boyA, boyB) {
    var dl = N.aktif / N.n; if (dl > 0.5 && Math.random() < (dl - 0.5) * 2.5) return;   // havuz dolarken damlalar seyrelir (taşma yok)
    var i = N.al(DAMLA, D.damla, x, y, z, 3);
    if (i < 0) return;
    var a = aci + r(-yay, yay), h = r(hizA, hizB);
    N.vx[i] = Math.cos(a) * h; N.vy[i] = Math.sin(a) * h * 0.75; N.vz[i] = r(40, 260);
    N.boy[i] = r(boyA, boyB); N.renk[i] = sec(AYAR.kanRenk); N.sp[i].tint = N.renk[i];
  }
  function bulut(x, y, z, renk, boyA, boyB, om, alfa, buyu, vx, vy, vz) {
    var i = N.al(BULUT, D.duman, x, y, z, om);
    if (i < 0) return -1;
    N.s0[i] = boyA; N.s1[i] = boyB; N.a0[i] = alfa; N.surt[i] = 2.2; N.renk[i] = renk; N.sp[i].tint = renk;
    N.vx[i] = vx || 0; N.vy[i] = vy || 0; N.vz[i] = vz || 0; N.rot[i] = r(0, PI2); N.vrot[i] = r(-1, 1);
    return i;
  }
  function kivilcim(x, y, z, aci, hiz, renk, om, boy, yercekim) {
    var i = P.al(KIV, D.cizgi, x, y, z, om);
    if (i < 0) return -1;
    P.vx[i] = Math.cos(aci) * hiz; P.vy[i] = Math.sin(aci) * hiz * 0.8; P.vz[i] = r(-40, 160);
    P.surt[i] = 3.5; P.yer[i] = yercekim === undefined ? 1 : yercekim; P.boy[i] = boy || 1; P.renk[i] = renk; P.sp[i].tint = renk;
    return i;
  }
  function parla(havuz, doku, x, y, renk, s0, s1, om, alfa, rot) {
    var i = havuz.al(SABIT, doku, x, y, 0, om);
    if (i < 0) return -1;
    havuz.s0[i] = s0; havuz.s1[i] = s1; havuz.a0[i] = alfa === undefined ? 1 : alfa; havuz.renk[i] = renk; havuz.sp[i].tint = renk;
    havuz.rot[i] = rot === undefined ? r(0, PI2) : rot;
    return i;
  }
  function parca(x, y, z, aci, guc, doku, renk, tasMi) {
    var H = tasMi ? N : N, i = H.al(tasMi ? TAS : PARCA, doku, x, y, z, 12);
    if (i < 0) return;
    var a = aci + r(-1.1, 1.1), h = r(120, 340) * guc;
    H.vx[i] = Math.cos(a) * h; H.vy[i] = Math.sin(a) * h * 0.7; H.vz[i] = r(180, 420);
    H.vrot[i] = r(-14, 14); H.rot[i] = r(0, PI2); H.boy[i] = tasMi ? r(0.6, 1.2) : r(1.0, 1.45); H.renk[i] = renk; H.sp[i].tint = renk;
  }

  function kanFiskirt(x, y, aci, guc, carpim) {   // vuruş yönünde kan
    var k = AYAR.kan * carpim, z = AYAR.vurusYukseklik;
    // havuz doldukça kan azalır (kalabalıkta havuz taşmasın, ekran kırmızı halıya dönmesin)
    var dolu = N.aktif / N.n; if (dolu > AYAR.havuzEsik) k *= Math.max(0.2, 1 - (dolu - AYAR.havuzEsik) * 2.2);
    var n = Math.round((10 + 6 * guc) * k);
    for (var j = 0; j < n; j++) kanDamlasi(x, y, z + r(-8, 8), aci, 0.55, 120, 380 + 120 * guc, 0.35, 0.8);
    for (j = 0; j < Math.round(n * 0.35); j++) kanDamlasi(x, y, z, aci, 1.4, 40, 160, 0.25, 0.5);   // yana sıçrayan
    // 4. tur: dar koni, hızlı, uzun damlalı fışkırma (vuruşun yönü bir bakışta okunur; güçle büyür)
    var nj = Math.round((5 + 7 * guc) * k * AYAR.jet);
    for (j = 0; j < nj; j++) {
      if (N.aktif > N.n * 0.6) break;
      var ji = N.al(DAMLA, D.damla, x + Math.cos(aci) * 8, y + Math.sin(aci) * 5, z + r(-4, 10), 3);
      if (ji < 0) break;
      var ja = aci + r(-0.16, 0.16), jh = r(420, 640 + 160 * guc);
      N.vx[ji] = Math.cos(ja) * jh; N.vy[ji] = Math.sin(ja) * jh * 0.75; N.vz[ji] = r(60, 200 + 40 * guc);
      N.boy[ji] = r(0.45, 0.85 + 0.12 * guc); N.renk[ji] = sec(AYAR.kanRenk); N.sp[ji].tint = N.renk[ji];
    }
    kanHatti(x, y, aci, guc, k);
    // havada kan sisi
    for (j = 0; j < 2 + Math.round(guc * k); j++) {
      var a = aci + r(-0.4, 0.4), h = r(60, 160);
      bulut(x + Math.cos(aci) * 10, y, z, sec(AYAR.kanRenk), 0.2, r(0.5, 0.8) * (0.8 + 0.3 * guc), r(0.2, 0.32), 0.45, 0, Math.cos(a) * h, Math.sin(a) * h * 0.7, r(-20, 40));
    }
    // yere hemen düşen ana sıçrama (vuruş yönünde)
    var d = 30 + 14 * guc;
    var lu = sec(D.lekeUzun), lx = x + Math.cos(aci) * d, ly = y + Math.sin(aci) * d * 0.7, ls = 0.5 * (0.8 + 0.3 * guc) * Math.sqrt(k);
    damga(lu, lx, ly, aci, ls, ls, sec(AYAR.lekeRenk), 0.85);
    if (guc >= 1.4) tazeIz(lu, lx, ly, aci, ls, ls, 3.5, 0.45);
  }
  var goller = [], kanliAdim = 0, adimSag = 1;   // son göllerin yeri (ayak izi için), kalan kanlı adım
  function golKaydet(x, y, R) { goller.push({ x: x, y: y, r: R }); if (goller.length > 40) goller.shift(); }
  function kanGolu(x, y, boy, sure) {   // ölüm yerinde yavaşça büyüyen göl → bitince damgalanır
    golKaydet(x, y, boy * 52);
    var doku = sec(D.golCesit || [D.gol]);
    var s = tekil('leke', doku, kok.gol);
    var renk = AYAR.golRenk, rot = r(-0.35, 0.35), sxO = r(0.9, 1.15);
    if (!s) { damga(doku, x, y, rot, boy * sxO, boy, renk, 0.95); return; }
    // 4. tur: büyürken de son koyu rengiyle (eski: parlak 0x7e0c0c → plastik kırmızı levha); hızlı başlar, yavaşça yayılır
    s.x = x + r(-6, 6); s.y = y + r(-4, 4); s.tint = renk; s.alpha = 0.95; s.rotation = rot; s.scale.set(0.05);
    geciciEkle(s, sure, function (s, t) { var e = 1 - Math.pow(1 - t, 2.6); s.scale.set((0.08 + (boy - 0.08) * e) * sxO, 0.08 + (boy - 0.08) * e); },
      function (s) { damga(doku, s.x, s.y, rot, boy * sxO, boy, renk, 0.95); s._kullan = false; s.visible = false; tazeIz(doku, s.x, s.y, rot, boy * sxO, boy, 6, 0.32); });
  }
  // yere vuruş yönünde düşen sıçrama hattı: büyükten küçüğe damla dizisi (yönlü ve okunur)
  function kanHatti(x, y, aci, guc, k) {
    var n = Math.round((4 + 3 * guc) * AYAR.hat * Math.min(1.6, k)); if (n <= 0) return;
    var L = (60 + 55 * guc) * Math.min(1.4, Math.sqrt(k)), ca = Math.cos(aci), sa = Math.sin(aci);
    for (var j = 0; j < n; j++) {
      var u = (j + r(0.2, 0.9)) / n, d = 18 + L * Math.pow(u, 0.85), yan = r(-1, 1) * (6 + 16 * u);
      var px = x + ca * d - sa * yan, py = y + (sa * d + ca * yan) * 0.7, b = (0.34 - 0.22 * u) * (0.8 + 0.25 * guc);
      if (Math.random() < 0.55) damga(sec(D.lekeUzun), px, py, aci + r(-0.2, 0.2), b * 0.9, b * 0.55, sec(AYAR.lekeRenk), 0.9);
      else damga(D.damla, px, py, aci, b * 2.6 * (1.2 - u * 0.4), b * 1.6, sec(AYAR.lekeRenk), 0.92);
    }
  }
  // sürüklenme izi (ceset vuruşla kayınca)
  function kanIzi(x, y, aci, uzun) {
    if (!D.iz) return;
    // kalın baş (dokunun solu) vuruş yerinde, incelen uç gövdenin savrulduğu yöne
    var sx = uzun / 150, ca = Math.cos(aci), sa = Math.sin(aci) * 0.7;
    damga(sec(D.iz), x + ca * uzun * 0.45, y + sa * uzun * 0.45, Math.atan2(sa, ca), sx, r(0.65, 0.95), sec(AYAR.lekeRenk), 0.85);
  }

  // ------------------------------------------------------------------ OLAY İŞLEYİCİLERİ
  var ADDm = function () { return PIXI.BLEND_MODES.ADD; };

  function onSavur(v) {
    if (!kur()) return;
    var ofk = !!v.ofkeli, agir = !!v.agir, zincir = v.zincir || 0;
    var aci = v.aci || 0, yon = zincir === 1 ? -1 : 1;
    // Animasyon kareleriyle senkronizasyon:
    // vur (zincir=0): n=16, fps=36, vurusKare=9  -> etkin+takip ~0.165 sn (sağdan sola)
    // vur2 (zincir=1): n=16, fps=36, vurusKare=7 -> seri dönüş ~0.150 sn (soldan sağa)
    // vur3 (zincir=2): n=18, fps=32, vurusKare=9 -> ağır geniş ~0.230 sn (geniş 3. vuruş)
    var genis = agir || zincir === 2 || (v.yay && v.yay > 2.95);
    var sure = zincir === 1 ? (ofk ? 0.17 : 0.15) : (genis ? (ofk ? 0.25 : 0.23) : (ofk ? 0.185 : 0.165));
    var menzil = v.menzil || (genis ? 110 : 95);
    var bazOlcek = (menzil / 96) * (ofk ? 1.04 : 1.0);
    var yayYari = genis ? 1.66 : 1.31;
    var basAci = genis ? -0.40 : (zincir === 1 ? -0.28 : -0.32);
    var bitAci = genis ? 0.32 : (zincir === 1 ? 0.26 : 0.28);
    var ox = v.x + Math.cos(aci) * 4, oy = v.y - 46 + Math.sin(aci) * 4;

    // 1) İç kenarda sıcak hareket izi (kehribar/turuncu keskin hız şeritleri)
    var sIc = tekil('parlak', genis ? D.hilalGenisIc : D.hilalIc, kok.tekilP, ADDm());
    if (sIc) {
      sIc.x = ox; sIc.y = oy;
      sIc.rotation = aci + yon * basAci;
      sIc.scale.set(bazOlcek * 0.96, yon * bazOlcek * 0.96 * 0.82);
      sIc.tint = ofk ? 0xff4818 : (genis ? 0xffa43c : 0xff8428);
      sIc.alpha = 0;
      geciciEkle(sIc, sure + 0.02, function (s, t) {
        var e = 1 - Math.pow(1 - t, 2.2);
        var gir = Math.min(1, t / 0.14);
        var cik = 1 - Math.max(0, t - 0.20) / 0.80;
        s.alpha = gir * cik * cik * (ofk ? 0.88 : (genis ? 0.72 : 0.58));
        var k = bazOlcek * (0.94 + 0.06 * e);
        s.scale.set(k, yon * k * 0.82);
        s.rotation = aci + yon * (basAci + (bitAci - basAci) * e - 0.04 * (1 - t));
      }, function (s) { s._kullan = false; s.visible = false; });
    }

    // 2) Dış kenarda soğuk çelik parıltısı (keskin bıçak ucu)
    var s = tekil('parlak', genis ? D.hilalGenis : D.hilal, kok.tekilP, ADDm());
    if (s) {
      s.x = ox; s.y = oy;
      s.rotation = aci + yon * basAci;
      s.scale.set(bazOlcek, yon * bazOlcek * 0.82);
      s.tint = ofk ? 0xffd2b8 : (genis ? 0xf2f8ff : 0xe2f0ff);
      s.alpha = 0;
      geciciEkle(s, sure, function (s, t) {
        var e = 1 - Math.pow(1 - t, 2.4);
        var gir = Math.min(1, t / 0.12);
        var cik = 1 - Math.max(0, t - 0.22) / 0.78;
        s.alpha = gir * Math.pow(cik, 1.35) * (ofk ? 0.95 : (genis ? 0.82 : 0.70));
        var k = bazOlcek * (0.96 + 0.06 * e);
        s.scale.set(k, yon * k * 0.82);
        s.rotation = aci + yon * (basAci + (bitAci - basAci) * e);
      }, function (s) { s._kullan = false; s.visible = false; });
    }

    // 3) Balta ucu soğuk çelik parıltısı (yayın ucunu takip eden keskin kıvılcım yıldızı)
    var uc = tekil('parlak', D.yildiz, kok.tekilP, ADDm());
    if (uc) {
      var ucA0 = aci + yon * (basAci + yayYari * 0.72);
      uc.x = ox + Math.cos(ucA0) * menzil;
      uc.y = oy + Math.sin(ucA0) * menzil * 0.82;
      uc.tint = ofk ? 0xffccb0 : 0xeaf6ff;
      uc.scale.set(genis ? 0.52 : 0.40);
      uc.alpha = 0;
      geciciEkle(uc, sure * 0.82, function (sp, t) {
        var e = 1 - Math.pow(1 - t, 2.3);
        var a = aci + yon * (basAci + (bitAci - basAci) * e + yayYari * 0.88);
        var rAn = menzil * (0.98 + 0.04 * e);
        sp.x = ox + Math.cos(a) * rAn;
        sp.y = oy + Math.sin(a) * rAn * 0.82;
        sp.rotation = a + t * 2.5 * yon;
        var b = (genis ? 0.52 : 0.38) * Math.sin(t * Math.PI);
        sp.scale.set(Math.max(0.05, b));
        sp.alpha = Math.sin(t * Math.PI) * (ofk ? 0.95 : 0.82);
      }, function (sp) { sp._kullan = false; sp.visible = false; });
    }

    isikPatla(v.x + Math.cos(aci) * 50, v.y - 30 + Math.sin(aci) * 40, ofk ? 0xff7040 : 0xdce8f4, ofk ? 150 : (genis ? 130 : 105), 0.12, ofk ? 0.6 : 0.35);
    if (ofk || genis) {
      var kSayi = ofk ? 6 : 3;
      for (var j = 0; j < kSayi; j++) {
        var ka = aci + r(-yayYari * 0.75, yayYari * 0.75);
        kivilcim(v.x + Math.cos(ka) * menzil * 0.9, v.y + Math.sin(ka) * menzil * 0.72, 46, ka + yon * 1.1, r(90, 210), ofk ? 0xff6a20 : 0xdceeff, r(0.14, 0.26), 0.5, 0.25);
      }
    }
  }

  function zirhKivilcimi(x, y, hz, aci, guc, agir, ofk) {
    // İnfazcı zırhı kırılmadan darbe aldığında: kan yok, sert çelik kıvılcımları + metalik halka parıltısı
    var j, tam = flasBuKare <= AYAR.flasKare || agir;
    parla(P, D.halka, x, y - hz, 0xd8f0ff, 0.12, (tam ? 0.90 : 0.65) * Math.min(1.25, guc), 0.14, tam ? 0.96 : 0.72, 0);
    if (tam) {
      parla(P, D.halka, x, y - hz, 0xfff0c8, 0.16, 0.54, 0.10, 0.70, 0);
      parla(P, D.yildiz, x - Math.cos(aci) * 6, y - hz, 0xf2f8ff, 0.42, 0.96, 0.10, 0.98);
      for (j = 0; j < 10; j++) {
        kivilcim(x, y, hz, aci + Math.PI + r(-1.25, 1.25), r(260, 560), sec(ZIRH_KIV_RENK), r(0.11, 0.24), r(0.48, 0.68), 0.45);
      }
      for (j = 0; j < 6; j++) {
        kivilcim(x, y, hz, r(0, PI2), r(180, 380), sec(ZIRH_CELIK_RENK), r(0.09, 0.18), r(0.38, 0.54), 0.3);
      }
      var kc = tekil('parlak', D.cizgi, kok.tekilP, ADDm());
      if (kc) {
        kc.x = x; kc.y = y - hz; kc.rotation = aci + Math.PI / 2 + r(-0.3, 0.3);
        kc.tint = 0xe8f6ff; kc.scale.set(1.45, 0.85);
        geciciEkle(kc, 0.085, function (s, t) { s.alpha = 1 - t; s.scale.y = 0.85 * (1 - t * 0.75); }, function (s) { s._kullan = false; s.visible = false; });
      }
      isikPatla(x, y - hz * 0.5, ofk ? 0xffd0a0 : 0xd8ecff, 130, 0.14, 0.75);
    } else {
      for (j = 0; j < 6; j++) {
        kivilcim(x, y, hz, aci + Math.PI + r(-1.1, 1.1), r(240, 480), sec(ZIRH_KIV_RENK), r(0.09, 0.16), 0.48, 0.35);
      }
    }
  }

  function onVurus(v) {
    if (!kur()) return;
    istatistik.vurus++;
    var aci = v.aci || 0, agir = !!v.agir, old = !!v.oldurdu, ofk = !!(v.ofkeli || ofkeAcik || (window.OYUNCU && OYUNCU.ofkeli)), x = v.x, y = v.y, z = AYAR.vurusYukseklik;
    var guc = 1 + (agir ? 0.8 : 0) + (old ? 0.6 : 0) + (ofk ? 0.25 : 0);
    if (v.tur === 'sekme') guc *= 0.7;
    if (v.guc > 0) guc *= 0.85 + 0.15 * Math.min(2, v.guc / 300);   // savurmanın itiş gücü (vur 270 · vur2 320 · ağır 600) kanı ve parlamayı ölçekler
    var hedefTur = v.hedef && (v.hedef.tur || (window.VARGOR && v.hedef === window.VARGOR ? 'vargor' : undefined));
    // İri düşmanlar ve zırhlı boss için temas yüksekliği.
    var hz = z;
    if (hedefTur === 'dev' || hedefTur === 'vargor' || hedefTur === 'skarn') {
      var fark = (v.hedef.y || y) - y;
      hz = fark > 40 ? z : z * (hedefTur === 'dev' ? 3 : hedefTur === 'vargor' ? 2.2 : 1.75);
    } else if (hedefTur === 'infazci') {
      hz = z * 1.15;
    }
    flasBuKare++;
    var zirhliVurus = !!(v.zirhli || (v.hedef && v.hedef._zirhliVurus));
    if (zirhliVurus) {
      zirhKivilcimi(x, y, hz, aci, guc, agir, ofk);
      return;
    }
    if (v.zirhKirildi || (v.hedef && v.hedef._zirhKirildiVurus)) {
      zirhKivilcimi(x, y, hz, aci, guc * 1.15, true, ofk);
    }
    var kanCarp = hedefTur === 'dev' ? 0.55 : hedefTur === 'vargor' ? 0.7 : hedefTur === 'skarn' ? 0.62 : 1;
    kanFiskirt(x, y, aci, guc, kanCarp * (flasBuKare > AYAR.flasKare ? 0.55 : 1));   // aynı karede çok isabet: her biri biraz daha az kan
    // kalabalığı biçerken: bu karede yeterince parlama olduysa yalnız kan + birkaç kıvılcım (ekran dolu ama okunur)
    if (flasBuKare > AYAR.flasKare && !agir) {
      for (var q = 0; q < 2; q++) kivilcim(x, y, hz, aci + r(-0.7, 0.7), r(250, 480), ofk ? 0xff9838 : 0xffe0a0, r(0.08, 0.14), 0.45, 0.2);
      return;
    }
    if (agir) {   // 3. ağır vuruş: keskin beyaz şok halkası + koyu kan sisi halkası + kısa ağır sarsıntı
      parla(P, D.halka, x, y - hz, ofk ? 0xffb080 : 0xf4f8ff, 0.12, 0.95, 0.12, 0.95, 0);
      parla(N, D.halka, x, y - hz * 0.6, 0x3a0606, 0.2, 1.25, 0.3, 0.55, 0);
    }
    if (ofk) {    // öfkeli vuruş: kızıl-turuncu parlama + yanan kor saçılması
      parla(P, D.yumusak, x, y - hz, 0xff3a10, 0.4, 1.1, 0.16, 0.5);
      for (var o2 = 0; o2 < 5; o2++) {
        var ck = P.al(KUL, D.damla, x + r(-10, 10), y + r(-6, 6), hz + r(-10, 10), r(0.35, 0.7));
        if (ck >= 0) { P.ek[ck] = 2; var oa = aci + r(-0.9, 0.9), oh = r(60, 160); P.vx[ck] = Math.cos(oa) * oh; P.vy[ck] = Math.sin(oa) * oh * 0.7; P.vz[ck] = r(30, 110); P.boy[ck] = r(0.2, 0.34); P.sayac[ck] = r(0, 6); P.renk[ck] = sec([0xff6a20, 0xffa040, 0xff4818]); P.sp[ck].tint = P.renk[ck]; }
      }
    }
    // vuruş parlaması
    parla(P, D.yildiz, x - Math.cos(aci) * 8, y - hz, ofk ? 0xffd288 : (agir || old ? 0xfff2c0 : 0xffffff), 0.35 * guc, 0.9 * guc, 0.09 + 0.03 * guc, 1);
    parla(P, D.yumusak, x, y - hz, ofk ? 0xff8038 : 0xffb060, 0.35 * guc, 0.65 * guc, 0.09, 0.16);   // küçük, kısa sıcak parıltı (kalabalıkta üst üste binip sahneyi yıkamasın)
    var kSay = 3 + Math.round(2 * guc) + (ofk ? 3 : 0) + (agir ? 2 : 0);
    for (var j = 0; j < kSay; j++) {
      var kRenk = ofk ? sec([0xffe098, 0xff9838, 0xff6220, 0xfff2c0]) : (agir ? sec([0xffe8a8, 0xffc870, 0xffffff]) : 0xffe0a0);
      kivilcim(x, y, hz, aci + r(-0.9, 0.9), r(250, ofk || agir ? 560 : 520), kRenk, r(0.09, ofk || agir ? 0.22 : 0.18), ofk || agir ? r(0.48, 0.66) : 0.5, 0.2);
    }
    if (v.tur === 'balta') {
      // fırlatılan balta çarpma kıvılcımları: soğuk çelik + sıcak kıvılcım + keskin halka
      parla(P, D.halka, x, y - hz, 0xd8ecff, 0.15, 0.65, 0.15, 0.7, 0);
      parla(P, D.yildiz, x, y - hz, 0xeaf6ff, 0.45, 0.95, 0.11, 0.95);
      for (j = 0; j < 6; j++) kivilcim(x, y, hz, aci + Math.PI + r(-1.35, 1.35), r(220, 480), sec([0xffffff, 0xd8ecff, 0xffe0a0]), r(0.10, 0.22), 0.52, 0.45);
    }
    // kesik: vuruş yönüne dik, keskin çizgi (çok kısa)
    var kc = tekil('parlak', D.cizgi, kok.tekilP, ADDm());
    var ka = aci + Math.PI / 2 + r(-0.35, 0.35), kb = 0.9 + 0.35 * guc;
    if (kc) {
      kc.x = x; kc.y = y - hz; kc.rotation = ka; kc.tint = ofk ? 0xffcfa0 : (agir ? 0xfff0d0 : 0xffffff); kc.scale.set(kb * (ofk || agir ? 1.75 : 1.5), ofk || agir ? 1.0 : 0.9);
      geciciEkle(kc, ofk || agir ? 0.105 : 0.09, function (s, t) { s.alpha = 1 - t; s.scale.y = (ofk || agir ? 1.0 : 0.9) * (1 - t * 0.7); }, function (s) { s._kullan = false; s.visible = false; });
    }
    if (ofk || agir) {
      var kc2 = tekil('parlak', D.cizgi, kok.tekilP, ADDm());
      if (kc2) {
        kc2.x = x; kc2.y = y - hz; kc2.rotation = ka + (Math.random() < 0.5 ? 1 : -1) * r(0.38, 0.65);
        kc2.tint = ofk ? 0xff9a58 : 0xfff4dc; kc2.scale.set(kb * 1.35, 0.62);
        geciciEkle(kc2, 0.08, function (s, t) { s.alpha = (1 - t) * 0.85; s.scale.y = 0.62 * (1 - t * 0.75); }, function (s) { s._kullan = false; s.visible = false; });
      }
    }
    isikPatla(x, y - hz * 0.5, ofk ? 0xffb878 : (agir || old ? 0xffd8a0 : 0xffe8c8), 90 + 40 * guc, 0.1 + 0.03 * guc, 0.5);
    if (agir || old) sars(agir ? 5 : 3, 0.12);
  }

  function turRengi(tur, hedef) {
    var c = AYAR.turRenk[tur];
    return c === undefined ? 0xa09080 : c;
  }
  function onOlum(v) {
    if (!kur()) return;
    istatistik.olum++;
    var dev = v.tur === 'dev', vargor = v.tur === 'vargor', aci = v.aci || 0, x = v.x, y = v.y, guc = Math.max(1, Math.min(3, (v.guc || 300) / 300));
    var b = dev ? 2.6 : (vargor ? 2.0 : (v.tur === 'infazci' ? 1.25 : (v.tur === 'goblin' ? 0.8 : 1)));
    var iri = dev || vargor;
    kanGolu(x, y + 4, (iri ? (dev ? 2.2 : 1.75) : r(AYAR.golBoy[0], AYAR.golBoy[1]) * b) * Math.sqrt(AYAR.kan), iri ? 6 : r(AYAR.golSure[0], AYAR.golSure[1]));   // göl ölçülü: kalabalıkta zemin tek kırmızı levhaya dönmesin
    kanFiskirt(x, y, aci, 1.4 * guc, (v.parcala ? 1.6 : 1.1) * b);
    if (!iri && !v.parcala && Math.random() < AYAR.izSans) kanIzi(x, y + 2, aci, (50 + 30 * guc) * b);
    if (v.parcala) {
      if (!D.parcaHazir) parcaHazirYukle();
      var n = ri(AYAR.parcaSayi[0], AYAR.parcaSayi[1]) + (iri ? 6 : 0), renk = turRengi(v.tur, v.hedef);
      for (var j = 0; j < n; j++) {
        var tip = j < n * 0.45 ? 'deri' : (j < n - 1 ? 'et' : 'kemik');
        var hzr = D.parcaHazir && Math.random() < 0.6, doku = hzr ? sec(D.parcaHazir) : sec(D.parca[tip]);
        parca(x, y, 40 * (iri ? 1.8 : 1), aci, guc * (iri ? 1.35 : 1), doku, (!hzr && tip === 'deri') ? renk : 0xffffff, false);
      }
      // patlayan kan bulutu
      for (j = 0; j < 6; j++) { var a = r(0, PI2), h = r(30, 120); bulut(x, y, 40, sec(AYAR.kanRenk), 0.4, r(0.9, 1.4), r(0.28, 0.45), 0.5, 0, Math.cos(a) * h, Math.sin(a) * h * 0.7, r(0, 60)); }
      // her yöne damla
      for (j = 0; j < Math.round(25 * AYAR.kan * b); j++) kanDamlasi(x, y, 40, r(0, PI2), 0.1, 60, 300, 0.4, 0.9);
      sars(4, 0.15);
    }
  }

  function onBlok(v) {
    if (!kur()) return;
    var aci = (v.aci || 0) + Math.PI, z = 12, kirildi = !!v.kirildi;   // olay y'si zaten kalkan yüksekliğinde; kıvılcımlar saldırana geri sıçrar
    var kSayi = kirildi ? 18 : 14;
    for (var j = 0; j < kSayi; j++) kivilcim(v.x, v.y, z, aci + r(-1.1, 1.1), r(220, kirildi ? 620 : 560), sec(kirildi ? [0xffe6a0, 0xffb858, 0xffd080, 0xffffff] : [0xffe6a0, 0xffc060, 0xffffff]), r(0.15, 0.36), kirildi ? 0.62 : 0.55, 1);
    if (kirildi) {
      // kalkan parçalanması: sıcak koyu meşe kıymıkları + toz halkası + ahşap tozu
      var tahta = D.parca && D.parca.tahta;
      if (tahta && tahta.length) {
        for (j = 0; j < 9; j++) {
          var kAci = j < 5 ? aci + r(-1.2, 1.2) : r(0, PI2);
          parca(v.x, v.y, z + r(8, 22), kAci, r(0.75, 1.3), sec(tahta), sec([0xffffff, 0xf2dfc8, 0xd8be9e]), true);
        }
      }
      parla(N, D.halka, v.x, v.y - z, 0xa88c6c, 0.16, 1.15, 0.24, 0.72, 0);
      for (j = 0; j < 6; j++) {
        var ba = r(0, PI2), bh = r(45, 145);
        bulut(v.x + r(-8, 8), v.y + r(-4, 4), z + 10, sec([0x7a5c42, 0x664d38, 0x8c7258]), 0.26, r(0.75, 1.15), r(0.28, 0.45), 0.52, 0, Math.cos(ba) * bh, Math.sin(ba) * bh * 0.7, r(18, 60));
      }
    }
    parla(P, D.yildiz, v.x, v.y - z, kirildi ? 0xffe4b8 : 0xd8ecff, 0.4, kirildi ? 1.2 : 1.0, kirildi ? 0.13 : 0.1, 1);
    parla(P, D.yumusak, v.x, v.y - z, kirildi ? 0xffc078 : 0x9fc8ff, 0.4, kirildi ? 1.1 : 0.9, kirildi ? 0.2 : 0.16, kirildi ? 0.7 : 0.6);
    isikPatla(v.x, v.y, kirildi ? 0xffe0b0 : 0xc8dcff, kirildi ? 165 : 130, kirildi ? 0.18 : 0.14, kirildi ? 0.85 : 0.7);
    sars(kirildi ? 4.5 : 2, kirildi ? 0.14 : 0.08);
  }
  function onSektir(v) {
    if (!kur()) return;
    var z = AYAR.vurusYukseklik, aci = v.aci;
    // keskin soğuk-çelik seken kıvılcım çizgileri
    for (var j = 0; j < 14; j++) {
      var a = j / 14 * PI2 + r(-0.15, 0.15);
      kivilcim(v.x, v.y, z, a, r(260, 440), sec([0xe8f4ff, 0xc8e4ff, 0xffffff, 0xffe8b8]), r(0.11, 0.21), r(0.50, 0.68), 0);
    }
    if (aci !== undefined) {
      for (j = 0; j < 8; j++) kivilcim(v.x, v.y, z, aci + r(-0.38, 0.38), r(420, 700), sec([0xffffff, 0xd8eeff, 0xb8dcff]), r(0.11, 0.20), r(0.64, 0.84), 0.08);
    }
    // keskin metalik çizgi parlaması (çelik çarpışma anı)
    var kc = tekil('parlak', D.cizgi, kok.tekilP, ADDm());
    if (kc) {
      var ka = (aci !== undefined ? aci : 0) + Math.PI / 2 + r(-0.25, 0.25);
      kc.x = v.x; kc.y = v.y - z; kc.rotation = ka; kc.tint = 0xe8f6ff; kc.scale.set(1.45, 0.85);
      geciciEkle(kc, 0.085, function (s, t) { s.alpha = 1 - t; s.scale.y = 0.85 * (1 - t * 0.75); }, function (s) { s._kullan = false; s.visible = false; });
    }
    // keskin metalik flaş halkası + sıcak çekirdek yankısı
    parla(P, D.halka, v.x, v.y - z, 0xd8efff, 0.10, 0.86, 0.14, 0.98, 0);
    parla(P, D.halka, v.x, v.y - z, 0xffe4b0, 0.18, 0.60, 0.11, 0.62, 0);
    parla(P, D.yildiz, v.x, v.y - z, 0xf2f8ff, 0.45, 1.05, 0.10, 1);
    isikPatla(v.x, v.y - z * 0.5, 0xd8ecff, 155, 0.15, 0.85);
    if (v.kusursuz) {   // tam zamanında sektirme: altın şok halkası + ek parlak kıvılcım
      parla(P, D.halka, v.x, v.y - z, 0xffd890, 0.15, 1.3, 0.2, 1, 0);
      for (j = 0; j < 10; j++) kivilcim(v.x, v.y, z, r(0, PI2), r(380, 620), sec([0xffe8a0, 0xffffff]), r(0.14, 0.24), 0.7, 0.1);
      isikPatla(v.x, v.y - z * 0.5, 0xffe0a0, 200, 0.2, 1);
    }
    sars(v.kusursuz ? 4 : 2.5, 0.08);
  }
  function onAtil(v) {
    if (!kur()) return;
    var aci = v.aci || 0;
    for (var j = 0; j < 7; j++) { var a = aci + Math.PI + r(-0.9, 0.9), h = r(40, 140); bulut(v.x + r(-10, 10), v.y + r(-4, 4), 4, 0x6e655a, 0.3, r(0.9, 1.4), r(0.4, 0.7), 0.55, 0, Math.cos(a) * h, Math.sin(a) * h * 0.6, r(10, 40)); }
    atilma = { t: 0.26, aci: aci, ara: 0 };
  }
  function onAdim(v) {
    if (!kur()) return;
    if (AYAR.ayakIzi > 0 && v.x !== undefined) {
      for (var gi = goller.length - 1; gi >= 0; gi--) { var gg = goller[gi], gx = (v.x - gg.x) / gg.r, gy = (v.y - gg.y) / (gg.r * 0.62); if (gx * gx + gy * gy < 0.8) { kanliAdim = AYAR.ayakIzi; break; } }
      if (kanliAdim > 0) {
        var p = oyuncuKonum(), yon = p && p.aci !== undefined ? p.aci : -Math.PI / 2;
        try { if (p && (p.vx || p.vy)) yon = Math.atan2(p.vy, p.vx); } catch (e) {}
        adimSag = -adimSag; var yx = -Math.sin(yon) * 6 * adimSag, yy = Math.cos(yon) * 6 * adimSag * 0.7;
        damga(D.ayak, v.x + yx, v.y + yy, yon + Math.PI / 2, 1.15, 1.05, sec(AYAR.lekeRenk), 0.25 + 0.6 * (kanliAdim / AYAR.ayakIzi));
        kanliAdim--;
      }
    }
    if (N.aktif > N.n * 0.8) return;
    bulut(v.x + r(-6, 6), v.y, 2, 0x5e564c, 0.2, 0.5, 0.4, 0.2, 0, r(-20, 20), r(-6, 6), 8);
  }
  function onMermiVur(v) {
    if (!kur()) return;
    var t = v.tur;
    if (t === 'buyu') {
      parla(P, D.yumusak, v.x, v.y - 30, 0x5cff7a, 0.5, 1.8, 0.35, 0.9);
      parla(P, D.halka, v.x, v.y - 30, 0x8affa0, 0.1, 0.9, 0.3, 0.9, 0);
      for (var j = 0; j < 16; j++) kivilcim(v.x, v.y, 30, r(0, PI2), r(120, 320), sec([0x6aff8a, 0xb0ffb8, 0x30d060]), r(0.25, 0.5), 0.5, 0.3);
      for (j = 0; j < 4; j++) bulut(v.x, v.y, 20, 0x2e5a34, 0.4, 1.2, 0.6, 0.4, 0, r(-40, 40), r(-30, 30), 20);
      isikPatla(v.x, v.y - 20, 0x60ffb0, 190, 0.4, 0.9);
    } else if (t === 'buz_mizrak') {
      ayazParcalari(v.x, v.y, 28, 5, .72);
    } else if (t === 'kaya') {
      tozPatlat(v.x, v.y, 1);
    } else if (t === 'comlek') {   // kil çömlek kırılır: kiremit parçaları (yerde kalır) + toz + yağ sıçraması
      var kd = null; try { var pk = VARLIK.paketler && VARLIK.paketler.yakici; if (pk && pk.tekil && pk.tekil.comlek_kirik !== undefined) kd = VARLIK.doku('yakici', 'comlek_kirik'); } catch (e) {}
      if (kd) damga(kd, v.x + r(-6, 6), v.y + 6, r(-0.3, 0.3), 0.85, 0.85, 0xffffff, 1);   // TEK kırık çömlek resmi (yerde kalır; sade)
      else for (j = 0; j < 4; j++) parca(v.x, v.y, v.elde ? 70 : 8, r(0, PI2), 0.55, sec(D.tas), sec([0x8a4e2c, 0x7a4426, 0x9c5a34]), true);
      for (j = 0; j < 3; j++) bulut(v.x, v.y, 8, 0x5a4a3c, 0.4, r(1.0, 1.5), 0.5, 0.4, 0, r(-50, 50), r(-30, 30), r(10, 40));
      for (j = 0; j < 8; j++) kivilcim(v.x, v.y, 10, r(0, PI2), r(80, 240), 0xffb040, r(0.2, 0.4), 0.45, 0.6);
    } else {
      for (j = 0; j < 4; j++) kivilcim(v.x, v.y, 26, r(0, PI2), r(60, 160), 0xc8b090, 0.15, 0.4, 1);
      bulut(v.x, v.y, 6, 0x6a6258, 0.15, 0.5, 0.3, 0.4);
    }
  }
  function ayazParcalari(x, y, z, adet, boy) {
    if (!kur()) return;
    var tonlar = [0xbbe9f6, 0x8cbfd8, 0xf0fbff];
    for (var i = 0; i < adet; i++) {
      parca(x, y, z, r(0, PI2), boy * r(.30, 1), sec(D.tas), sec(tonlar), false);
      kivilcim(x, y, z, r(0, PI2), r(80, 190), sec(tonlar), r(.14, .31), .48, .25);
    }
  }
  function onAyazBotBas(v) {
    if (!kur() || N.aktif >= N.n*.65) return;
    // Kısa, mat kar buğusu. Saldırı kıvılcımı veya zemin tehlikesi gibi yanmaz.
    var say=v.agir?2:1, boy=v.tur==='skarn'?.61:v.agir?.46:.31;
    for(var i=0;i<say;i++){
      var a=v.aci+Math.PI+r(-.74,.74), h=r(17,33);
      bulut(v.x+r(-3,3),v.y+r(-2,2),2,0xc3d6df,.18,boy,.17,.23,0,Math.cos(a)*h,Math.sin(a)*h*.62,r(5,11));
    }
  }
  function onAyazBuzKir(v) {
    ayazParcalari(v.x, v.y, 7, 10, 1);
    if (!kur()) return;
    for (var i = 0; i < 3; i++) bulut(v.x, v.y, 5, 0xbddae5, .32, 1.45, .48, .4, 0, r(-38, 38), r(-21, 21), r(30, 65));
    isikPatla(v.x, v.y, 0xa3d7ee, 96, .20, .41);
  }
  function onAyazZincirKes(v) {
    if (!kur()) return;
    for (var i = 0; i < 10; i++) {
      kivilcim(v.x, v.y, 32, v.aci + r(-1.6, 1.6), r(180, 360), 0xffc487, r(.11, .22), .55, .33);
    }
    parla(P, D.yildiz, v.x, v.y - 32, 0xffe4bf, .15, .7, .14, .75);
  }
  function onSifa(v) {
    if (!kur()) return;
    var hedefler = v.hedefler;
    if (!hedefler) {
      hedefler = [];
      try {
        var L = (window.DUSMAN && DUSMAN.liste) || [], R2 = AYAR.sifaMenzil * AYAR.sifaMenzil;
        for (var i = 0; i < L.length && hedefler.length < 6; i++) {
          var d = L[i]; if (d.olu || d.tur === 'dev') continue;
          var dx = d.x - v.x, dy = d.y - v.y, dd = dx * dx + dy * dy;
          if (dd > 16 && dd < R2) hedefler.push(d);
        }
      } catch (e) {}
    }
    parla(P, D.yumusak, v.x, v.y - 60, 0x50ff70, 0.4, 1.4, 0.5, 0.8);
    isikPatla(v.x, v.y - 40, 0x58ffc0, 200, 0.6, 0.8);
    hedefler.forEach(function (h) {
      var s = tekil('parlak', D.cizgi, kok.tekilP, ADDm()); if (!s) return;
      var x0 = v.x, y0 = v.y - 70, x1 = h.x, y1 = h.y - 50, L = Math.hypot(x1 - x0, y1 - y0);
      s.anchor.set(0, 0.5); s.x = x0; s.y = y0; s.rotation = Math.atan2(y1 - y0, x1 - x0); s.tint = 0x60ff80;
      s.scale.set(L / 60, 1.6);
      geciciEkle(s, 0.55, function (s, t) { s.alpha = (1 - t) * (0.6 + 0.4 * Math.sin(t * 40)); },
        function (s) { s.anchor.set(0.5); s._kullan = false; s.visible = false; });
      parla(P, D.yumusak, h.x, h.y - 50, 0x6aff8a, 0.3, 0.9, 0.5, 0.7);
      for (var j = 0; j < 6; j++) { var k = P.al(KUL, D.damla, h.x + r(-18, 18), h.y + r(-6, 6), r(10, 70), r(0.5, 0.9)); if (k >= 0) { P.vz[k] = r(40, 90); P.boy[k] = r(0.3, 0.55); P.renk[k] = 0x90ffa0; P.sp[k].tint = 0x90ffa0; P.ek[k] = 1; } }
    });
  }
  function tozPatlat(x, y, b) {
    for (var j = 0; j < Math.round(9 * b); j++) { var a = r(0, PI2), h = r(40, 170) * b; bulut(x, y, 6, sec([0x6e6458, 0x7c7266, 0x5a5248]), 0.5 * b, r(1.4, 2.2) * b, r(0.6, 1.0), 0.6, 0, Math.cos(a) * h, Math.sin(a) * h * 0.6, r(10, 50)); }
    for (j = 0; j < Math.round(5 * b); j++) parca(x, y, 10, r(0, PI2), 0.7 * b, sec(D.tas), 0xffffff, true);
    sars(5 * b, 0.25);
  }
  // ---- dev: yeni dev yere vurma/sopa/kükreme için olay yaymıyor → DEV.durum geçişinden okunur (yalnız okuma).
  // dev.js 'devYereVur' yayarsa (istek yazıldı) o olay kullanılır, tahmin aynı vuruş için ikinci kez çizmez.
  var zamanli = [], devOnceki = null, sonDevVurT = -9, devT = 0, gerT = 0, arenaKapali = false;
  function sonra(sn, fn) { zamanli.push({ t: sn, fn: fn }); }
  function devAyar(ad, vars) { try { var a = DEV.AYAR || null; if (a && a[ad] !== undefined) return a[ad]; } catch (e) {} return vars; }
  function devIzle() {
    var dv = null; try { dv = window.DEV; } catch (e) {}
    if (!dv || !dv.aktif || dv.olu) { devOnceki = dv && dv.aktif ? dv.durum : null; return; }
    var d = dv.durum; if (d === devOnceki) return;
    var o = devOnceki; devOnceki = d;
    if ((o === 'sopa' || o === 'yerevur') && (d === 'toparlan' || d === 'yvAra')) {
      if (gT - sonDevVurT < 0.2) return;
      var yer = o === 'yerevur', m = yer ? devAyar('yvMesafe', 140) : devAyar('sopaMenzil', 150) * 0.75, a = dv.aci || 0;
      devDarbe(dv.x + Math.cos(a) * m, dv.y + Math.sin(a) * m * 0.8, yer ? devAyar('yvR', 125) : 85, !yer);
    } else if (d === 'kukre' || d === 'giris' || d === 'hucumHaz') kukreDalga(dv, d === 'hucumHaz' ? 2 : 3);
  }
  var sonKukreT = -9, devDustu = false;
  function kukreDalga(dv, n) {   // kükreme: ağızdan yayılan soluk hava halkaları + ayak dibinde kalkan toz
    if (gT - sonKukreT < 1.0) return; sonKukreT = gT;
    for (var i = 0; i < n; i++) sonra(0.12 + i * 0.26, function () {
      var D_ = window.DEV; if (!D_ || D_.olu) return;
      var hx = D_.x + Math.cos(D_.aci || 1.57) * 30, hy = D_.y - 210;
      parla(N, D.halka, hx, hy, 0xe6ddd0, 0.3, 4.2, 0.55, 0.32, 0);
      parla(N, D.halka, hx, hy, 0x2a2018, 0.25, 3.4, 0.5, 0.22, 0);
      for (var j = 0; j < 8; j++) { var a = j / 8 * PI2 + r(-0.2, 0.2), h = r(120, 220); bulut(D_.x + Math.cos(a) * 60, D_.y + Math.sin(a) * 30, 4, sec([0x8a7e6c, 0x7a6e5e]), 0.6, r(1.4, 2.0), r(0.6, 0.9), 0.4, 0, Math.cos(a) * h, Math.sin(a) * h * 0.6, r(10, 30)); }
      sars(3, 0.2);
    });
  }
  function devDarbe(x, y, R, hafif) {   // yere vuruş: çatlak + taş + yayılan toz halkası + şok ışığı
    sonDevVurT = gT;
    var k = hafif ? 0.6 : 1;
    damga(D.catlak, x, y, r(-0.2, 0.2), R / 90 * k, R / 90 * k * 0.85, 0x0e0a08, 0.9);
    var nb = Math.round(22 * k);
    for (var j = 0; j < nb; j++) { var a = j / nb * PI2 + r(-0.1, 0.1), h = r(170, 300) * k; bulut(x + Math.cos(a) * R * 0.25, y + Math.sin(a) * R * 0.15, 6, sec([0x9a8e7c, 0xa89c88, 0x857a6a]), 0.7, r(1.6, 2.4) * k + 0.4, r(0.8, 1.3), 0.62, 0, Math.cos(a) * h, Math.sin(a) * h * 0.6, r(5, 30)); }
    for (j = 0; j < Math.round(12 * k); j++) parca(x, y, 10, r(0, PI2), 1.3 * k, sec(D.tas), 0xffffff, true);
    parla(N, D.halka, x, y, 0x6a5e4e, 0.3, R / 42, 0.42, 0.75, 0);
    parla(P, D.halka, x, y - 4, 0xffe0b0, 0.2, R / 50, 0.2, 0.6 * k, 0);
    isikPatla(x, y, 0xfff0d8, R * 1.4, 0.14, 0.9 * k);
    isikPatla(x, y, 0xffa060, R * 2.2, 0.4, 0.55 * k);
    for (j = 0; j < 10; j++) kivilcim(x, y, 4, r(0, PI2), r(200, 420), sec([0xffe0a0, 0xffc070]), r(0.12, 0.25), 0.5, 1);
    sars(hafif ? 3 : 5, 0.2);
  }
  function onDevYereVur(v) {
    if (!kur()) return;
    if (v.olum) { devDus(v.x, v.y); return; }                                   // dev.js: ölen devin gövdesi yere çarptı
    if (v.sopa) { devDarbe(v.x, v.y, Math.max(85, v.r || 70), true); return; }  // dev.js: sopa yere indi
    if (!v.duvar) { devDarbe(v.x, v.y, v.r || 125, false); return; }
    sonDevVurT = gT;
    var R = v.r || 160, x = v.x, y = v.y;
    damga(D.catlak, x, y, r(-0.2, 0.2), R / 90, R / 90, 0x0e0a08, 0.95);
    for (var j = 0; j < 22; j++) { var a = j / 22 * PI2, h = r(160, 260); bulut(x + Math.cos(a) * R * 0.3, y + Math.sin(a) * R * 0.2, 8, sec([0x9a8e7c, 0xa89c88, 0x857a6a]), 0.8, r(1.8, 2.6), r(0.9, 1.4), 0.7, 0, Math.cos(a) * h, Math.sin(a) * h * 0.6, r(10, 40)); }
    for (j = 0; j < 10; j++) parca(x, y, 10, r(0, PI2), 1.2, sec(D.tas), 0xffffff, true);
    parla(N, D.halka, x, y, 0xb0a490, 0.4, R / 50, 0.35, 0.7, 0);
    // şok ışığı: önce beyaz parlama, sonra genişleyen sıcak halka
    isikPatla(x, y, 0xfff0d8, R * 1.6, 0.18, 1);
    isikPatla(x, y, 0xffa060, R * 2.6, 0.5, 0.7);
    parla(P, D.halka, x, y - 4, 0xffd8a0, 0.3, R / 40, 0.28, 0.75, 0);
    sars(18, 0.6);
  }
  function onDevKaya(v) { if (!kur()) return; tozPatlat(v.x, v.y, 0.8); isikPatla(v.x, v.y, 0xffe8c8, 150, 0.15, 0.6); }
  function onSkarnZeminTemas(v) {
    if (!kur()) return;
    ayazParcalari(v.x, v.y, 5, 5, .64);
    for (var i = 0; i < 5; i++) {
      bulut(v.x + r(-20, 20), v.y + r(-7, 7), 2, 0xb7c4cc, .36, 1.0, .55, .33,
        0, r(-80, 80), r(-38, 38), r(9, 34));
    }
    kanGolu(v.x, v.y + 5, 1.35 * Math.sqrt(AYAR.kan), 6);
    sars(7, .28);
  }
  function onDevOldu(v) {
    if (!kur()) return;
    if (v.bolum === 3 && v.boss && v.boss.tur === 'skarn') {
      var aciSkarn = v.boss.aci + Math.PI;
      kanFiskirt(v.x, v.y, aciSkarn, 1.9, 0.84);
      ayazParcalari(v.x, v.y, 64, 7, .86);
      isikPatla(v.x, v.y - 36, 0xd3ebf8, 225, .26, .58);
      return;
    }
    var x = v.x, y = v.y, aci = v.aci !== undefined && isFinite(v.aci) ? v.aci : r(0, PI2);
    // 4. tur: büyük son — ilk darbe, ardından ağır çekimde art arda kan fışkırmaları, en sonda gövde yere çarpar
    for (var j = 0; j < 3; j++) kanFiskirt(x, y - 60, aci + r(-0.6, 0.6), 2.6, 1.6);
    parla(P, D.halka, x, y - 120, 0xfff0d8, 0.3, 4.5, 0.3, 0.9, 0);
    parla(P, D.yildiz, x, y - 120, 0xffffff, 1.2, 3.2, 0.2, 1);
    isikPatla(x, y, 0xffe0b8, 520, 0.5, 1);
    sars(16, 0.6);
    [0.35, 0.7, 1.05, 1.4].forEach(function (t, i) {
      sonra(t, function () {
        var a = aci + r(-1.2, 1.2), ox = x + r(-50, 50), oy = y - r(20, 90);
        kanFiskirt(ox, oy, a, 2.2, 1.4);
        for (var k = 0; k < 10; k++) kanDamlasi(ox, oy, 120, r(0, PI2), 0.2, 80, 320, 0.5, 1.0);
        for (k = 0; k < 2 + i; k++) parca(ox, oy, 80, a, 1.4, D.parcaHazir && Math.random() < 0.6 ? sec(D.parcaHazir) : sec(D.parca.et), 0xffffff, false);
        isikPatla(ox, oy, 0xff9060, 260, 0.3, 0.6);
        sars(6, 0.25);
      });
    });
    devDustu = false;
    sonra(2.6, function () { if (!devDustu) devDus(x, y); });   // dev.js olay yaymazsa yedek
  }
  function devDus(x, y) {   // ölen devin gövdesi yere çarpar
    if (devDustu) return; devDustu = true;
    (function () {
      kanGolu(x, y + 10, 2.6 * Math.sqrt(AYAR.kan), 8);
      tozPatlat(x, y, 2.0);
      damga(D.catlak, x, y + 10, r(-0.2, 0.2), 2.4, 2.0, 0x0e0a08, 0.85);
      parla(N, D.halka, x, y, 0x6a5e4e, 0.4, 5.5, 0.6, 0.7, 0);
      isikPatla(x, y, 0xffd0a0, 420, 0.8, 1);
      sars(12, 0.7);
    })();
  }
  function onOyuncuHasar(v) {
    if (!kur()) return;
    hasarSayisiGoster(window.OYUNCU, v.canKaybi, true);
    if (v.yanma) { hasarDarbe = Math.max(hasarDarbe, 0.22); return; }   // ateş: kan yok, sarsıntı yok; yalnız ince kızıl kenar
    var m = v.miktar || 10;
    hasarDarbe = Math.min(1, 0.45 + m / 40);
    var x = v.x, y = v.y;
    try { if (x === undefined && window.OYUNCU) { x = OYUNCU.x; y = OYUNCU.y; } } catch (e) {}
    if (x !== undefined) kanFiskirt(x, y, v.aci || 0, 0.6, 0.6);
    sars(4 + Math.min(10, m * 0.25), 0.2);
  }
  function onOyuncuOldu() {
    if (!kur()) return;
    try { if (window.OYUNCU) { kanGolu(OYUNCU.x, OYUNCU.y + 4, 1.3, 3.5); kanFiskirt(OYUNCU.x, OYUNCU.y, r(0, PI2), 2, 1.5); } } catch (e) {}
  }
  // Balta ve rüzgâr şeritlerini dönüş yönünde, figürün önünde ve arkasında ayrı çiz.
  function kasirgaIzi() {
    var arka = kok.kasirgaArka, on = kok.kasirgaOn, p = oyuncuKonum();
    var aktif = p && p.durum === 'kasirga' && p.kasirgaFaz >= 0;
    if (!aktif) { arka.visible = on.visible = false; return; }
    arka.visible = on.visible = true;
    arka.position.set(p.x, p.y); on.position.set(p.x, p.y);
    arka.clear(); on.clear();
    var aci = p.kasirgaAci + (p.kasirgaFaz - 0.22) * PI2;
    kasirgaSerit(arka, on, aci - 2.05, 79, 25, 3.5, 10, 0xc45642, 0.43);
    kasirgaSerit(arka, on, aci - 0.62, 138, 48, 4.1, 19, 0xc0ad92, 0.42);
    kasirgaSerit(arka, on, aci + 2.13, 110, 63, 3.15, 10, 0xffd09a, 0.41);
    kasirgaSerit(arka, on, aci, 111, 40, 2.76, 21, 0xd85b36, 0.72);
    kasirgaSerit(arka, on, aci, 112, 41, 2.16, 8, 0xffedc9, 0.9);
  }
  function kasirgaSerit(arka, on, aci, cap, yukseklik, yay, kalinlik, renk, alfa) {
    var adet = 18, x0 = Math.cos(aci) * cap, y0 = Math.sin(aci) * cap * 0.51 - yukseklik, w0 = 1;
    for (var i = 1; i <= adet; i++) {
      var t = i / adet, a = aci - t * yay, r1 = cap * (1 - t * 0.24);
      var x1 = Math.cos(a) * r1, y1 = Math.sin(a) * r1 * 0.51 - yukseklik + t * 23;
      var w1 = Math.sin(Math.PI * t) * kalinlik * (1 - t * 0.6);
      var g = Math.sin(a + yay / (2 * adet)) > 0 ? on : arka;
      var opak = alfa * (0.35 + 0.65 * Math.sin(Math.PI * (t - 0.5 / adet))) * (1 - t * 0.8);
      g.beginFill(renk, opak * (g === arka ? 0.66 : 1))
        .moveTo(x0, y0 - w0 * 0.5).lineTo(x1, y1 - w1 * 0.5)
        .lineTo(x1, y1 + w1 * 0.5).lineTo(x0, y0 + w0 * 0.5).closePath().endFill();
      x0 = x1; y0 = y1; w0 = w1;
    }
  }
  function onKasirga(v) {
    if (!v || !kur()) return;
    tozPatlat(v.x, v.y, v.ilk ? 0.8 : 0.38);
    if (v.ilk) isikPatla(v.x, v.y - 32, 0xffab69, 136, 0.22, 0.3);
    for (var i = 0; i < 9; i++) {
      var a = v.aci + i * PI2 / 9 + r(-0.2, 0.2), m = r(30, 74);
      var renk = i % 3 === 0 ? 0xffe8ac : i % 3 === 1 ? 0xeb6044 : 0xd39b66;
      var k = kivilcim(v.x + Math.cos(a) * m, v.y + Math.sin(a) * m * 0.65, r(7, 34),
        a + Math.PI * 0.5, r(118, 218), renk, r(0.24, 0.45), 0.49, 0.28);
      if (k >= 0) P.vz[k] = r(42, 104);
    }
  }
  function onOfke(v) {
    if (!kur()) return;
    ofkeAcik = !!(v && v.acik);
    if (!ofkeAcik) return;
    ofkeT = 0; ofkeGiris = 0.82;
    var p = oyuncuKonum();
    if (!p) return;
    var x = p.x, y = p.y;
    isikPatla(x, y - 42, 0xff7b31, 230, 0.46, 0.74);
    isikPatla(x, y - 69, 0xffd593, 112, 0.17, 0.65);
    tozPatlat(x, y, 1.05);
    for (var i = 0; i < 42; i++) {
      var yan = i % 2 ? -1 : 1;
      var aci = (yan < 0 ? Math.PI : 0) + r(-1.02, 1.02), mesafe = r(14, 53);
      var dx = Math.cos(aci), dy = Math.sin(aci);
      var kx = x + yan * Math.max(17, Math.abs(dx) * mesafe), ky = y + dy * mesafe * 0.58;
      var c = P.al(KUL, D.damla, kx, ky, r(1, 14), r(0.42, 0.95));
      if (c < 0) break;
      P.ek[c] = 2;
      P.vx[c] = dx * r(55, 156); P.vy[c] = dy * r(15, 50); P.vz[c] = r(95, 255);
      P.boy[c] = r(0.18, 0.35); P.sayac[c] = r(0, 6);
      P.renk[c] = i % 4 ? 0xffa04c : 0xffdf9e; P.sp[c].tint = P.renk[c];
      if (i % 2 === 0) {
        var k = kivilcim(kx, ky, r(4, 20), aci, r(48, 110), P.renk[c], r(0.24, 0.56), r(0.44, 0.72), 0.16);
        if (k >= 0) P.vz[k] = r(175, 285);
      }
    }
  }
  function onBaltaAt(v) {
    baltaUcuyor = true; sonBalta = null; baltaIzAra = 0;
    if (!kur() || !v) return;
    var x = v.x, y = v.y, aci = v.aci || 0, z = 42;
    if (x === undefined || y === undefined) return;
    parla(P, D.yildiz, x, y - z, ofkeAcik ? 0xffb878 : 0xe4f2ff, 0.45, 0.12, 0.12, 0.78, aci);
    for (var j = 0; j < 3; j++) kivilcim(x, y, z, aci + r(-0.35, 0.35), r(240, 420), ofkeAcik ? 0xff8040 : 0xdceeff, r(0.08, 0.14), 0.45, 0);
  }
  function onBaltaDondu(v) {
    baltaUcuyor = false; sonBalta = null;
    if (!kur()) return;
    var p = oyuncuKonum();
    var x = (v && v.x !== undefined) ? v.x : (p ? p.x : undefined);
    var y = (v && v.y !== undefined) ? v.y : (p ? p.y : undefined);
    if (x === undefined || y === undefined) return;
    var z = 42;
    parla(P, D.yildiz, x, y - z, ofkeAcik ? 0xffc080 : 0xeaf6ff, 0.42, 0.12, 0.14, 0.85, 0.4);
    parla(P, D.halka, x, y - z, ofkeAcik ? 0xff7838 : 0xd0e8ff, 0.12, 0.42, 0.14, 0.55, 0);
    for (var j = 0; j < 4; j++) kivilcim(x, y, z, r(0, PI2), r(120, 240), ofkeAcik ? 0xffa860 : sec([0xeaf6ff, 0xffe4b0]), r(0.10, 0.16), 0.36, 0.2);
    isikPatla(x, y - z, ofkeAcik ? 0xff9050 : 0xd8ecff, 80, 0.12, 0.35);
    if (v && v.yakala) { parla(P, D.yildiz, x, y - z, 0xffffff, 0.5, 0.15, 0.1, 1, 0); for (j = 0; j < 4; j++) kivilcim(x, y, z, r(0, PI2), r(200, 340), 0xfff0d0, 0.1, 0.4, 0.2); }
  }

  // ---- Bölüm II olayları: bolum, varilPatla, kozYan, totemKir
  function onBolum(v) {
    var no = typeof v === 'number' ? v : (v && (v.bolum || v.no)) || aktifBolum();
    bolumAtmosferUygula(no);
  }
  function onVarilPatla(v) {
    if (!kur() || v.x === undefined || v.y === undefined) return;
    var x = v.x, y = v.y, rad = (v.r > 0 && isFinite(v.r)) ? v.r : 150, olc = Math.max(0.65, Math.min(2.2, rad / 140));
    var j, a, h, ck;
    // 1) Parlak alev çekirdeği + genişleyen şok halkası + zemin ışığı
    parla(P, D.yumusak, x, y - 26, 0xfff0b8, 0.55 * olc, 2.2 * olc, 0.18, 0.96);
    parla(P, D.yumusak, x, y - 28, 0xff6a18, 0.8 * olc, 3.0 * olc, 0.36, 0.86);
    parla(P, D.yildiz, x, y - 26, 0xffe898, 0.7 * olc, 2.1 * olc, 0.22, 0.96);
    parla(P, D.halka, x, y - 16, 0xff9a38, 0.22, rad / 52, 0.28, 0.94, 0);
    isikPatla(x, y - 18, 0xff9838, rad * 2.2, 0.48, 1);
    // 2) Duman bulutu halkası + merkez duman + kalıcı yanık izi
    for (j = 0; j < 12; j++) {
      a = j / 12 * PI2 + r(-0.18, 0.18); h = r(110, 230) * olc;
      bulut(x + Math.cos(a) * 18, y + Math.sin(a) * 10, r(12, 34), sec(VARIL_DUMAN_RENK), 0.45 * olc, r(1.3, 2.1) * olc, r(0.75, 1.3), 0.62, 0, Math.cos(a) * h, Math.sin(a) * h * 0.65, r(35, 95));
    }
    for (j = 0; j < 4; j++) {
      bulut(x + r(-14, 14), y + r(-8, 8), r(24, 50), 0x161212, 0.55 * olc, r(1.6, 2.4) * olc, r(1.0, 1.5), 0.54, 0, r(-28, 28), r(-18, 18), r(70, 130));
    }
    damga(yanikDoku(), x, y, r(-0.3, 0.3), rad * 1.9 / 128, rad * 1.9 / 128, 0x120a06, 0.72);
    // 3) Saçılan ateş parçacıkları (kıvılcım + süzülen kor + kömürleşmiş fıçı kıymıkları)
    for (j = 0; j < 24; j++) {
      kivilcim(x + r(-14, 14), y + r(-8, 8), r(14, 42), r(0, PI2), r(200, 520) * olc, sec(VARIL_ATES_RENK), r(0.28, 0.62), r(0.5, 0.8), 0.55);
    }
    for (j = 0; j < 14; j++) {
      ck = P.al(KUL, D.damla, x + r(-18, 18), y + r(-10, 10), r(12, 42), r(0.55, 1.15));
      if (ck >= 0) {
        a = r(0, PI2); h = r(60, 170) * olc;
        P.ek[ck] = 2; P.vx[ck] = Math.cos(a) * h; P.vy[ck] = Math.sin(a) * h * 0.65; P.vz[ck] = r(65, 160);
        P.boy[ck] = r(0.18, 0.34); P.sayac[ck] = r(0, 6); P.renk[ck] = sec(VARIL_KOZ_RENK); P.sp[ck].tint = P.renk[ck];
      }
    }
    var tahta = D.parca && D.parca.tahta;
    if (tahta && tahta.length) {
      for (j = 0; j < 6; j++) parca(x, y, r(16, 36), r(0, PI2), r(0.85, 1.4) * olc, sec(tahta), sec(VARIL_KIYMIK_RENK), true);
    }
    // 4) Güçlü ekran sarsıntısı
    sars(14, 0.42);
  }
  function onKozYan(v) {
    if (!kur() || v.x === undefined || v.y === undefined) return;
    var x = v.x, y = v.y, j, ka, kh, k, ck;
    // Sıcak kıvılcım fışkırması
    for (j = 0; j < 10; j++) {
      k = P.al(KIV, D.cizgi, x + r(-18, 18), y + r(-8, 8), r(2, 12), r(0.24, 0.48));
      if (k >= 0) {
        ka = r(0, PI2); kh = r(40, 120);
        P.vx[k] = Math.cos(ka) * kh; P.vy[k] = Math.sin(ka) * kh * 0.55; P.vz[k] = r(150, 290);
        P.surt[k] = 1.8; P.yer[k] = -0.15; P.boy[k] = r(0.36, 0.56); P.renk[k] = sec(KOZ_RENK); P.sp[k].tint = P.renk[k];
      }
    }
    for (j = 0; j < 5; j++) {
      ck = P.al(KUL, D.damla, x + r(-16, 16), y + r(-8, 8), r(4, 16), r(0.45, 0.85));
      if (ck >= 0) {
        P.ek[ck] = 2; P.vx[ck] = r(-24, 24); P.vy[ck] = r(-10, 10); P.vz[ck] = r(60, 125);
        P.boy[ck] = r(0.14, 0.26); P.sayac[ck] = r(0, 6); P.renk[ck] = sec(KOZ_RENK); P.sp[ck].tint = P.renk[ck];
      }
    }
    for (j = 0; j < 2; j++) bulut(x + r(-12, 12), y + r(-6, 6), 8, 0x281814, 0.25, r(0.7, 1.1), r(0.5, 0.8), 0.24, 0, r(-12, 12), r(-6, 6), r(35, 65));
    // Kısa ısı parıltısı
    parla(P, D.yumusak, x, y - 10, 0xff6e1a, 0.45, 1.35, 0.24, 0.65);
    parla(P, D.isik, x, y - 8, 0xffb848, 0.3, 0.9, 0.16, 0.55);
    isikPatla(x, y - 6, 0xff7a20, 150, 0.26, 0.78);
  }
  function onTotemKir(v) {
    if (!kur() || v.x === undefined || v.y === undefined) return;
    var x = v.x, y = v.y, j, a, h, ck;
    // 1) Rün parçacıkları dağılması (parlayan rün kıymıkları + kıvılcımlar + obsidyen taş parçaları)
    for (j = 0; j < 18; j++) {
      ck = P.al(KUL, j % 2 === 0 ? D.yildiz : D.damla, x + r(-18, 18), y + r(-8, 8), r(20, 110), r(0.45, 0.9));
      if (ck >= 0) {
        a = r(0, PI2); h = r(70, 190);
        P.ek[ck] = 2; P.vx[ck] = Math.cos(a) * h; P.vy[ck] = Math.sin(a) * h * 0.65; P.vz[ck] = r(40, 145);
        P.boy[ck] = j % 2 === 0 ? r(0.18, 0.30) : r(0.20, 0.38); P.sayac[ck] = r(0, 6);
        P.renk[ck] = sec(TOTEM_RUN_RENK); P.sp[ck].tint = P.renk[ck];
      }
    }
    for (j = 0; j < 16; j++) {
      kivilcim(x + r(-12, 12), y, r(25, 100), r(0, PI2), r(160, 420), sec(TOTEM_KIV_RENK), r(0.24, 0.52), r(0.45, 0.72), 0.25);
    }
    for (j = 0; j < 7; j++) {
      parca(x + r(-10, 10), y, r(20, 80), r(0, PI2), r(0.75, 1.25), sec(D.tas), sec(TOTEM_TAS_RENK), true);
    }
    for (j = 0; j < 6; j++) {
      a = r(0, PI2); h = r(55, 145);
      bulut(x + r(-12, 12), y + r(-6, 6), r(12, 48), sec(TOTEM_DUMAN_RENK), 0.45, r(1.2, 1.9), r(0.55, 0.95), 0.48, 0, Math.cos(a) * h, Math.sin(a) * h * 0.65, r(20, 65));
    }
    damga(D.catlak, x, y, r(-0.3, 0.3), 1.15, 0.95, 0x0e0a0c, 0.8);
    // 2) Turuncu-altın şok dalgası
    parla(P, D.halka, x, y - 45, 0xffb838, 0.18, 2.2, 0.34, 0.98, 0);
    parla(P, D.halka, x, y - 45, 0xff5e14, 0.28, 2.7, 0.42, 0.78, 0);
    parla(N, D.halka, x, y, 0x221614, 0.2, 1.9, 0.35, 0.55, 0);
    parla(P, D.yildiz, x, y - 55, 0xffe898, 0.5, 1.8, 0.22, 0.95);
    parla(P, D.yumusak, x, y - 50, 0xff9a28, 0.5, 2.1, 0.35, 0.75);
    isikPatla(x, y - 40, 0xffb840, 260, 0.42, 1);
    // 3) Orta ekran sarsıntısı
    sars(8, 0.28);
  }

  function oyuncuKonum() { try { if (window.OYUNCU && OYUNCU.x !== undefined) return OYUNCU; } catch (e) {} return null; }

  // ------------------------------------------------------------------ IŞIK HARİTASI
  // Düşük çözünürlüklü tek RenderTexture: serin ortam tonu + kenar karartması + eklemeli ışık havuzları.
  // Dünyanın üstüne ÇARPMA ile serilir (ışık olmayan yer serin-karanlık, ışık olan yer kendi rengini korur).
  var IH = null;   // {rt, kok, dunya, ortam, vinyet, kahraman, ates:[], flas:[], anlik:[], anlikN}
  // Her bölümün geniş çevre ışığı ve ateşe yakın yerel renkleri; aynı ışık haritasında çizilir.
  var ISIK_PALET = [
    { gok: 0xc2dff2, guc: .114, x: .15, y: .12, en: 1.62, boy: 1.88, mesale: 0xffa35e, enkaz: 0xff682b, ates: 0xff803e },
    { gok: 0xeb894e, guc: .071, x: .73, y: .93, en: 1.72, boy: 1.52, mesale: 0xff8d47, enkaz: 0xff5721, ates: 0xff6c2d },
    { gok: 0xcadfff, guc: .098, x: .19, y: .10, en: 2.08, boy: 2.34, mesale: 0xffb36b, enkaz: 0xff833d, ates: 0xff9950 }
  ];
  // TAM EKRAN: görünen alanın tamamı (mantıksal ekran koordinatı; 1280×720 ortada, x0/y0 ≤ 0). cekirdek.js OYUN.gorunum.
  function gor() { return OYUN.gorunum || { x0: 0, y0: 0, w: OYUN.W || 1280, h: OYUN.H || 720 }; }
  // YAKINLIK (19 Kasım): o kare ekranda GÖRÜNEN DÜNYA dikdörtgeni {x,y,w,h} (cekirdek.js OYUN.gorus + sarsıntı).
  // Dünya katmanındaki kapsama/ayıklama bununla yapılır; katman.ust (ekran) işleri gor() ile kalır. Tek nesne, kare başına yeni nesne yok.
  var _gd = { x: 0, y: 0, w: 1280, h: 720 };
  function gorD() {
    var g = OYUN.gorus, k = OYUN.kamera || {}, sx = k.sx || 0, sy = k.sy || 0;
    if (g && isFinite(g.sol) && isFinite(g.ust) && g.w > 0) { _gd.x = g.sol - sx; _gd.y = g.ust - sy; _gd.w = g.w; _gd.h = g.h; }
    else { var G = gor(); _gd.x = (k.x || 0) + G.x0 - sx; _gd.y = (k.y || 0) + G.y0 - sy; _gd.w = G.w; _gd.h = G.h; }
    return _gd;
  }
  function yakin() { var z = OYUN.yakinlik; return z > 0.3 && z < 4 ? z : 1; }
  function haritaOrtam(iki, dev) {
    if (bolumNo === 2) return iki ? (dev ? AYAR.ortamVolkanDev : AYAR.ortamVolkan) : 0xf0e0d2;
    if (bolumNo === 3) return iki ? (dev ? AYAR.ortamAyazDev : AYAR.ortamAyaz) : 0xdfebf0;
    return iki ? (dev ? AYAR.ortamDev : AYAR.ortam) : 0xdce7ef;
  }
  function haritaKur() {
    if (IH) return;
    var V = gorD(), b = AYAR.haritaOlcek / yakin(), ADD = PIXI.BLEND_MODES.ADD;   // yakınlaşınca harita pikseli dünyada küçülür: ekranda aynı incelik
    var w = Math.ceil(V.w / b) + 8, h = Math.ceil(V.h / b) + 8;   // görünen dünyanın tamamı + kenarda 4'er piksel pay (sarsıntı)
    IH = { rt: PIXI.RenderTexture.create({ width: w, height: h, resolution: 1 }), kok: new PIXI.Container(), dunya: new PIXI.Container(), ates: [], flas: [], anlik: [], anlikN: 0, w: w, h: h };
    IH.ortam = new PIXI.Sprite(PIXI.Texture.WHITE); IH.ortam.width = w; IH.ortam.height = h; IH.ortam.tint = AYAR.ortam; IH.kok.addChild(IH.ortam);
    IH.vinyet = new PIXI.Sprite(D.kenar); IH.vinyet.width = w; IH.vinyet.height = h; IH.vinyet.tint = 0x000000; IH.vinyet.alpha = AYAR.haritaVinyet; IH.kok.addChild(IH.vinyet);
    IH.kok.addChild(IH.dunya);
    function isikSp() { var s = new PIXI.Sprite(D.isik); s.anchor.set(0.5); s.blendMode = ADD; s.visible = false; IH.dunya.addChild(s); return s; }
    IH.dolgu = isikSp();
    IH.dolgu.visible = true;
    IH.lavIsik = [isikSp(), isikSp()];
    for (var i = 0; i < 16; i++) { var as_ = isikSp(); as_.texture = D.yumusak; IH.ates.push(as_); }   // merkezde yoğun, kenara doğru yumuşak sönen havuz (düz yayvan leke değil)
    IH.kahraman = isikSp(); IH.kahraman.tint = 0xffe2bc;
    IH.yag = []; for (i = 0; i < 6; i++) { var ys = isikSp(); ys.texture = D.yumusak; IH.yag.push(ys); }   // Yakıcı ateş birikintileri
    for (i = 0; i < 32; i++) { var f = isikSp(); f._om = 0; IH.flas.push(f); }
    for (i = 0; i < 24; i++) IH.anlik.push(isikSp());
    // ekranda: dünyanın üstünde çarpma katmanı (isik katmanının en altı)
    IH.sp = new PIXI.Sprite(IH.rt); IH.sp.blendMode = PIXI.BLEND_MODES.MULTIPLY; IH.sp.scale.set(b);
    IH.ikiId = ikiKatCarpmaKur();
    OYUN.katman.isik.addChildAt(IH.sp, 0);
  }
  // 2× çarpma (sonuç = 2·zemin·harita): 0x80 nötr; ateş havuzları zemini gerçekten aydınlatır ve ısıtır,
  // ışıksız yerler hafif serin-koyu kalır → tek, ucuz bir tam ekran geçişle kontrast + sıcak/serin ayrımı.
  function ikiKatCarpmaKur() {
    try {
      var gl = renderer.gl, st = renderer.state, id = 61;
      if (!gl || !st || !st.blendModes) return 0;
      st.blendModes[id] = [gl.DST_COLOR, gl.SRC_COLOR, gl.ZERO, gl.ONE];
      var pm = PIXI.utils && PIXI.utils.premultiplyBlendMode;
      if (pm) { pm[0][id] = id; pm[1][id] = id; }
      return id;
    } catch (e) { return 0; }
  }
  // kısa ışık patlaması (vuruş, kıvılcım, büyü, şok). yaricap: dünya px
  function isikPatla(x, y, renk, yaricap, om, alfa) {
    if (!IH) return;
    var en = null, enOm = 1e9;
    for (var i = 0; i < IH.flas.length; i++) { var f = IH.flas[i]; if (f._om <= 0) { en = f; break; } if (f._om < enOm) { enOm = f._om; en = f; } }
    en._om = en._omMax = om; en._a = alfa === undefined ? 1 : alfa; en._r = yaricap; en.x = x; en.y = y; en.tint = renk; en.visible = true;
  }
  function anlikIsik(x, y, renk, yaricap, alfa) {   // yalnız bu kare (uçan büyü vb.)
    if (!IH || IH.anlikN >= IH.anlik.length) return;
    var s = IH.anlik[IH.anlikN++]; s.visible = true; s.x = x; s.y = y; s.tint = renk; s.alpha = alfa; s.scale.set(yaricap / 64);
  }
  function atesTitresim(j, tr) {
    // Göz yormayan, doğal sıcak nefes + hafif alev kıpırtısı (yüksek frekanslı strobe yok)
    var mes = tr === 'mesale';
    var h1 = mes ? 2.8 : 2.1, h2 = mes ? 6.4 : 4.7, h3 = mes ? 10.5 : 8.2;
    var n_ = AYAR.atesNefes, g1 = (mes ? 0.048 : 0.036) * n_, g2 = (mes ? 0.028 : 0.022) * n_, g3 = (mes ? 0.012 : 0.010) * n_;
    var ani = Math.max(0, Math.sin(gT * 0.9 + j * 3.1) * Math.sin(gT * 2.3 + j)) * 0.05 * n_;   // ara sıra hafif rüzgâr sönmesi
    return 0.94 - ani + g1 * Math.sin(gT * h1 + j * 2.7) + g2 * Math.sin(gT * h2 + j * 1.3) + g3 * Math.sin(gT * h3 + j * 4.9);
  }
  function lavKiyiIsigi(ky, boy, iki) {
    var lav = bolumNo === 2 && window.BOLUM && BOLUM.lavGecidi;
    var gorunur = lav && lav.y1 < ky + boy + 125 && lav.y2 > ky - 125;
    for (var i = 0; i < IH.lavIsik.length; i++) {
      var s = IH.lavIsik[i];
      s.visible = !!gorunur;
      if (!gorunur) continue;
      s.x = i ? (lav.sag + OYUN.W) * .5 : lav.sol * .5;
      s.y = (lav.y1 + lav.y2) * .5;
      s.scale.set(8.8, 5.1);
      s.tint = 0xff793c;
      s.alpha = (iki ? .156 : .105) * (.91 + .058 * Math.sin(gT * 1.3 + i) + .032 * Math.sin(gT * 3.1));
    }
  }
  function haritaGuncelle(gd) {
    if (!IH) return;
    // yakınlık: harita GÖRÜNEN DÜNYAYI (OYUN.gorus) örter; pikseli dünyada haritaOlcek/yakinlik → ekranda hep aynı incelik
    var V = gorD(), b = AYAR.haritaOlcek / yakin();
    // tam ekran: pencere boyu / yakınlık değişince harita da büyür/küçülür (görünen alanın tamamını örter)
    var hw = Math.ceil(V.w / b) + 8, hh = Math.ceil(V.h / b) + 8;
    if (hw !== IH.w || hh !== IH.h) {
      IH.w = hw; IH.h = hh; IH.rt.resize(hw, hh);
      IH.ortam.width = hw; IH.ortam.height = hh; IH.vinyet.width = hw; IH.vinyet.height = hh;
    }
    var kx = V.x, ky = V.y;   // haritanın sol-üstü = görünen dünyanın sol-üstü
    IH.sp.scale.set(b);
    var iki = !!(AYAR.isikIki && IH.ikiId), yk = iki ? 0.5 : 1;   // 2× çarpmada ışıkların haritadaki payı yarıya iner (aynı etki)
    IH.sp.blendMode = iki ? IH.ikiId : PIXI.BLEND_MODES.MULTIPLY;
    var devVar = false; try { devVar = !!((window.DEV && DEV.sprite && DEV.can > 0) || (window.VARGOR && VARGOR.aktif && VARGOR.can > 0) || (window.SKARN && SKARN.aktif && SKARN.can > 0)); } catch (e) {}
    var v2 = bolumNo === 2;
    IH.ortam.tint = haritaOrtam(iki, devVar);
    var soguk = bolumNo === 3;
    var palet = ISIK_PALET[bolumNo - 1] || ISIK_PALET[0], dolgu = IH.dolgu;
    dolgu.tint = palet.gok;
    dolgu.alpha = palet.guc * (iki ? 1 : .60);
    dolgu.position.set(kx + V.w * palet.x, ky + V.h * palet.y);
    dolgu.scale.set(V.w * palet.en / 128, V.h * palet.boy / 128);
    // atmosfer: arena kilidinde koyu-kırmızı ince gerilim kenarı, dev/Vargor alanında uğursuz kenar, Bölüm II'de sıcak volkanik kenar (orta açık kalır)
    var kayG = Math.min(1, gd * 1.5);
    gerT += ((arenaKapali && !devVar ? 1 : 0) - gerT) * kayG; devT += ((devVar ? 1 : 0) - devT) * kayG;
    var nefes = 0.85 + 0.15 * Math.sin(gT * 1.3);
    IH.vinyet.alpha = (v2 ? AYAR.haritaVinyetVolkan : AYAR.haritaVinyet) + (AYAR.gerilim * gerT + AYAR.devHava * devT) * nefes;
    var kirm = Math.min(1, gerT + devT);
    IH.vinyet.tint = kirm < 0.02 ? (v2 ? 0x420e04 : 0x000000) : (devT > gerT ? (v2 ? 0x2c080c : 0x1e0618) : (v2 ? 0x380604 : 0x2a0404));
    // dünya → harita: (dünya - kamera + 4*b) / b
    IH.dunya.scale.set(1 / b); IH.dunya.x = -kx / b + 4; IH.dunya.y = -ky / b + 4;
    IH.sp.x = kx - 4 * b; IH.sp.y = ky - 4 * b;
    lavKiyiIsigi(ky, V.h, iki);
    // ateşler
    var at = null; try { at = window.BOLUM && BOLUM.atesler; } catch (e) {}
    var Hh = V.h, Ww = V.w, n = 0;
    if (at) for (var j = 0; j < at.length && n < IH.ates.length; j++) {
      var f = at[j]; if (!f || f.y < ky - 350 || f.y > ky + Hh + 350 || f.x < kx - 450 || f.x > kx + Ww + 450) continue;
      var g = (f.guc || 1) * AYAR.atesIsik, s = IH.ates[n++], fh = f.h || 30;
      var tr = f.tur, tit = atesTitresim(j, tr);
      var mesale = tr === 'mesale', enkaz = tr === 'enkaz';
      var yaricap = (mesale ? 138 : enkaz ? 166 : 148) + 136 * g;
      var agizY = f.agizY ?? f.y - fh * .66;
      s.visible = true;
      s.position.set(f.agizX ?? f.x, f.y + (agizY - f.y) * .40);
      s.tint = mesale ? palet.mesale : enkaz ? palet.enkaz : palet.ates;
      s.alpha = iki ? AYAR.atesGuc * (mesale ? 1.12 : .95) * tit : Math.min(1, (mesale ? .85 : .75) * tit);
      var boy = yaricap * (iki ? 1.1 : 1) / 64 * (.98 + .03 * tit);
      s.scale.set(boy * (mesale ? .86 : 1.07), boy * (soguk ? .69 : .80));
    }
    for (; n < IH.ates.length; n++) IH.ates[n].visible = false;
    yagIsik(iki, yk);
    // barbarın sıcak ışığı (karakter karanlıkta erimesin; zemin aydınlansın)
    var p = oyuncuKonum();
    if (p && p.canli !== false) {
      var k = IH.kahraman; k.visible = true; k.x = p.x; k.y = p.y - 30;
      k.alpha = yk * AYAR.kahramanIsik * (ofkeT > 0 ? 1 + 0.25 * ofkeT : v2 ? 1 : 1.15); k.tint = ofkeT > 0.3 ? 0xffc8a0 : 0xffe2bc;
      k.scale.set(AYAR.kahramanYaricap / 64);
      if (!v2 && ofkeT < 0.3) k.tint = soguk ? 0xc6e5ff : 0xe8edeb;
    } else IH.kahraman.visible = false;
    // patlamalar
    for (j = 0; j < IH.flas.length; j++) {
      var fl = IH.flas[j]; if (fl._om <= 0) { fl.visible = false; continue; }
      fl._om -= gd; var t = Math.max(0, fl._om / fl._omMax);
      fl.alpha = (iki ? AYAR.flasGuc : 1) * fl._a * t * t; fl.scale.set(fl._r / 64 * (0.8 + 0.2 * t));
      if (fl._om <= 0) fl.visible = false;
    }
    for (j = 0; j < IH.anlikN; j++) IH.anlik[j].alpha *= yk;
    for (j = IH.anlikN; j < IH.anlik.length; j++) IH.anlik[j].visible = false;
    renderer.render(IH.kok, { renderTexture: IH.rt, clear: true });
    IH.anlikN = 0;   // sonraki kare yeniden doldurulur
  }

  // ------------------------------------------------------------------ KAHRAMAN OKUNURLUĞU
  // Barbarın her karesi için (ilk kullanıldığında, bir kez) ince bir kenar halkası dokusu üretilir.
  // · kontur: barbarla aynı sırada (varlik katmanı) soğuk kenar ışığı
  // · röntgen: barbar bir düşmanın/devin arkasında kalınca, en üstte yarı saydam kopya + parlak halka
  var KH = null, halkaOnbellek = new Map(), HALKA_P = 1;
  function halkaDoku(tex) {
    // 5. tur (yönetici): KAPALI. Her yeni barbar karesinde 4096 px'lik resim sayfasından 2B tuvale 13 kez çizim yapıyordu;
    // tarayıcı büyük sayfayı her seferinde yeniden işlediği için dövüşün ortasında 120–150 ms'lik kare takılmaları oluyordu
    // (ebeveyn: "vurdukça takılıyor"). Barbar örtülünce okunurluğu artık cila.js sağlıyor (örten düşman yarı saydam).
    if (!AYAR.halkaDokuAcik) return null;
    var v = halkaOnbellek.get(tex); if (v !== undefined) return v;
    v = null;
    try {
      var kaynak = tex.baseTexture && tex.baseTexture.resource && tex.baseTexture.resource.source;
      if (kaynak && tex.baseTexture.valid && halkaOnbellek.size < 1200) {
        var fr = tex.frame, P_ = HALKA_P, w = fr.width + 2 * P_, h = fr.height + 2 * P_;
        var c = document.createElement('canvas'); c.width = w; c.height = h; var g = c.getContext('2d');
        for (var i = 0; i < 12; i++) { var a = i / 12 * PI2, sy = Math.sin(a); g.drawImage(kaynak, fr.x, fr.y, fr.width, fr.height, P_ + Math.cos(a) * P_ * 0.8, P_ + (sy < 0 ? sy * P_ : sy * P_ * 0.25), fr.width, fr.height); }
        g.globalCompositeOperation = 'source-in'; g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
        g.globalCompositeOperation = 'destination-out'; g.drawImage(kaynak, fr.x, fr.y, fr.width, fr.height, P_, P_, fr.width, fr.height);
        v = PIXI.Texture.from(c);
        v._ax = P_ / w; v._ay = P_ / h;
      }
    } catch (e) { v = null; }
    if (v || halkaOnbellek.size < 1200) halkaOnbellek.set(tex, v);
    return v;
  }
  function kahramanKur() {
    if (KH) return;
    KH = {};
    KH.kontur = new PIXI.Container(); KH.kontur.zEk = 0.5; KH.kontur.name = 'efekt_kontur';
    KH.konturSp = new PIXI.Sprite(PIXI.Texture.EMPTY); KH.kontur.addChild(KH.konturSp);
    KH.sicak = new PIXI.Sprite(PIXI.Texture.EMPTY); KH.sicak.blendMode = PIXI.BLEND_MODES.ADD; KH.sicak.tint = 0xffc890; KH.kontur.addChild(KH.sicak);   // barbarın üstüne hafif sıcak ışık
    OYUN.katman.varlik.addChild(KH.kontur);
    KH.rontgen = new PIXI.Container(); KH.rontgen.name = 'efekt_rontgen'; KH.rontgen.alpha = 0;
    KH.rKopya = new PIXI.Sprite(PIXI.Texture.EMPTY); KH.rHalka = new PIXI.Sprite(PIXI.Texture.EMPTY);
    KH.rKopya.tint = 0xf0f0ff; KH.rHalka.tint = 0xdcecff;
    // koyu ayırma çizgisi (IŞILTI DEĞİL): barbarın kendi resmi, siyaha boyanmış, 8 yöne 1,5 px kaydırılmış kopyaları.
    // Barbar devle üst üste gelince gövdesini devin benzer tenli kütlesinden keskin biçimde ayırır. Aynı doku → tek çizim.
    function koyuKenarKur(ust) {
      var c = new PIXI.Container(), L = [];
      for (var i = 0; i < 8; i++) { var s = new PIXI.Sprite(PIXI.Texture.EMPTY); s.tint = 0x000000; c.addChild(s); L.push(s); }
      c._sp = L; ust.addChild(c); return c;
    }
    KH.rKenar = koyuKenarKur(KH.rontgen);
    KH.rontgen.addChild(KH.rKopya); KH.rontgen.addChild(KH.rHalka);
    KH.koyu = new PIXI.Container(); KH.koyu.zEk = -0.5; KH.koyu.name = 'efekt_koyuKenar'; KH.koyu.visible = false;   // barbarın hemen ALTINDA (önündeyken)
    KH.kKenar = koyuKenarKur(KH.koyu); KH.koyuA = 0;
    OYUN.katman.varlik.addChild(KH.koyu);
    OYUN.katman.isik.addChild(KH.rontgen);   // en üstte: kıvılcım/parlamalar barbarı örtmesin
    KH.ortu = 0;
  }
  var BOY = { goblin: [78, 30], okcu: [135, 42], kalkanli: [135, 48], saman: [125, 40], yakici: [130, 44], baskinci: [125, 42], infazci: [150, 50],
    ayaz_mizrak: [109, 45], ayaz_zincir: [125, 54], kircil_kurt: [71, 61], buz_muhafiz: [147, 64],
    skarn: [198, 99], vargor: [270, 105], dev: [330, 135] };
  function ortulmeVeKoyuHesap(p) {   // { ortu: 0..1 örtülme, koyu: 0..1 koyu ayırma çizgisi hedefi }
    var L = null; try { L = window.DUSMAN && DUSMAN.liste; } catch (e) {}
    var o = 0, koyu = 0, yakin = 0, ust = p.y - 70;
    if (L) for (var i = 0; i < L.length; i++) {
      var d = L[i]; if (!d || d.olu) continue;
      var bw = BOY[d.tur] || [110, 40], dx = Math.abs(d.x - p.x), dy = d.y - p.y;
      if (dx < 110 && Math.abs(dy) < 90) yakin++;
      if (dx < bw[1] + 28 && dy > -90 && dy < bw[0] + 35) {
        koyu = Math.max(koyu, d.devMi || d.tur === 'dev' || d.tur === 'vargor' ? 1 : (d.tur === 'goblin' ? 0.72 : 0.9));
      }
      if (dy <= 2 || dy > bw[0] + 60) continue;               // önünde (sonra çiziliyor) olanlar
      if (d.y - bw[0] > ust + 50 || dx > bw[1] + 26) continue; // görüntüsü barbarın gövdesine binmiyor
      o = Math.max(o, d.devMi || d.tur === 'dev' || d.tur === 'vargor' ? 1 : (d.tur === 'goblin' ? 0.55 : 0.8));
    }
    if (yakin >= 4) o = Math.max(o, Math.min(0.7, 0.25 + 0.08 * yakin));   // kalabalığın içinde
    if (yakin >= 3) koyu = Math.max(koyu, Math.min(1, 0.55 + 0.12 * yakin));
    try {
      var dv = window.DEV;
      if (dv && dv.can > 0 && dv.sprite && dv.sprite.visible !== false) {
        var ddx = Math.abs(dv.x - p.x), ddy = dv.y - p.y;
        if (ddx < 150 && ddy > -150 && ddy < 380) koyu = 1;
      }
      var vg = window.VARGOR;
      if (vg && vg.aktif && vg.can > 0 && vg.sprite && vg.sprite.visible !== false) {
        var vdx = Math.abs(vg.x - p.x), vdy = vg.y - p.y;
        if (vdx < 130 && vdy > -130 && vdy < 300) koyu = 1;
      }
    } catch (e) {}
    // önündeki dekor (yıkık ev, araba, kaya...): düz resimler, dikdörtgenin iç kısmı yeterli
    var ch = OYUN.katman.varlik.children, gx = p.x, gy = p.y - 55;
    for (i = 0; i < ch.length && o < 0.9; i++) {
      var c = ch[i];
      if (!(c instanceof PIXI.Sprite) || c._alev || !c.visible || c.y <= p.y + 2 || c.y > p.y + 600 || !c.texture) continue;
      var w = Math.abs(c.texture.width * c.scale.x), h = Math.abs(c.texture.height * c.scale.y);
      var ax = c.scale.x < 0 ? 1 - c.anchor.x : c.anchor.x, sol = c.x - ax * w, ust2 = c.y - c.anchor.y * h;
      if (gx > sol + w * 0.15 && gx < sol + w * 0.85 && gy > ust2 + h * 0.12 && gy < c.y - 4) o = 0.9;
    }
    return { ortu: o, koyu: koyu };
  }
  var KK_OF = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];
  function koyuKenarYerles(c, g, alfa, olc) {
    var L = c._sp, d = AYAR.koyuKenarPx / Math.max(0.3, Math.abs(olc || 1)) / yakin();   // ekranda sabit kalınlık (yakınlıkta da)
    c.visible = alfa > 0.01; if (!c.visible) return;
    c.alpha = Math.min(1, alfa);
    for (var i = 0; i < 8; i++) {
      var s = L[i]; s.texture = g.texture; s.anchor.copyFrom(g.anchor); s.scale.copyFrom(g.scale); s.rotation = g.rotation;
      s.x = g.x + KK_OF[i][0] * d; s.y = g.y + KK_OF[i][1] * d;
    }
  }
  // Aynı atlas karesini kullan: aynı poz, ayrı doku veya ekran filtresi yok.
  var OFKE_KENAR_YON = [[-2.9, -1.2], [2.9, -1.2], [0, -3.2]];
  function ofkeKenarKur(ps) {
    var arka = new PIXI.Container(), on = new PIXI.Container();
    arka.name = 'ofke-kor-kenari'; on.name = 'ofke-zirh-isigi';
    for (var i = 0; i < OFKE_KENAR_YON.length; i++) {
      var s = new PIXI.Sprite(PIXI.Texture.EMPTY);
      s.tint = i === 2 ? 0xffb142 : 0xf06424;
      s.blendMode = ADDm(); arka.addChild(s);
    }
    var v = new PIXI.Sprite(PIXI.Texture.EMPTY);
    v.tint = 0xff7f32; v.blendMode = ADDm(); on.addChild(v);
    for (var j = 0; j < 2; j++) {
      var kor = new PIXI.Sprite(D.yumusak);
      kor.anchor.set(0.5); kor.tint = j ? 0xffad4d : 0xff6e24;
      kor.blendMode = ADDm(); on.addChild(kor);
    }
    ps.addChildAt(arka, 0); ps.addChild(on);
    KH.ofke = { sahip: ps, arka: arka, on: on };
    return KH.ofke;
  }
  function ofkeKenarGuncelle(ps, g, gorunum) {
    var k = KH.ofke;
    if (gorunum < 0.008) {
      if (k) k.arka.visible = k.on.visible = false;
      return;
    }
    if (!k || k.sahip !== ps) k = ofkeKenarKur(ps);
    k.arka.visible = k.on.visible = true;
    var guc = gorunum * (0.91 + 0.09 * Math.sin(gT * 6));
    for (var i = 0; i < 4; i++) {
      var s = i === 3 ? k.on.children[0] : k.arka.children[i];
      var yon = OFKE_KENAR_YON[i];
      s.texture = g.texture;
      s.anchor.copyFrom(g.anchor); s.scale.copyFrom(g.scale); s.rotation = g.rotation;
      s.position.set(g.x + (yon ? yon[0] : 0), g.y + (yon ? yon[1] : 0));
      s.alpha = guc * (yon ? 0.88 : 0.29);
    }
    var boy = g.texture.height * Math.abs(g.scale.y);
    var govdeY = g.y + (0.38 - g.anchor.y) * boy;
    for (var j = 0; j < 2; j++) {
      var kor = k.on.children[j + 1];
      kor.position.set(g.x + (j ? 1 : -1) * 19, govdeY + (j ? 4 : -3));
      kor.scale.set(j ? 0.19 : 0.22, j ? 0.13 : 0.17);
      kor.alpha = guc * (0.21 + 0.08 * Math.sin(gT * 7 + j * 2.3));
    }
  }
  function kahramanGuncelle(gd) {
    if (!KH) return;
    var p = oyuncuKonum(), ps = p && p.sprite, g = ps && (ps.g || sporBul(ps));
    if (!p || !g || !g.texture || g.texture === PIXI.Texture.EMPTY || ps.yerTutucu || !ps.visible) { ofkeKenarGuncelle(null, null, 0); KH.kontur.visible = false; KH.rontgen.visible = false; KH.koyu.visible = false; return; }
    var olu = p.canli === false;
    ofkeKenarGuncelle(ps, g, olu ? 0 : ps.ofkeGorunum || 0);
    var hd = AYAR.barbarKenar ? halkaDoku(g.texture) : null;   // kenar dokusu yalnız barbarKenar açıksa (röntgen artık halkasız)   // kenar dokusu yalnız gerektiğinde
    // kontur (varlik katmanı, barbarla aynı y)
    var ks = KH.konturSp;
    KH.kontur.visible = !olu && (AYAR.barbarKenar || AYAR.barbarSicak > 0); KH.konturSp.visible = !!hd && AYAR.barbarKenar;
    var sc = KH.sicak; sc.visible = AYAR.barbarSicak > 0; sc.texture = g.texture; sc.anchor.copyFrom(g.anchor); sc.x = g.x; sc.y = g.y; sc.scale.copyFrom(g.scale); sc.rotation = g.rotation; sc.alpha = AYAR.barbarSicak;
    if (!hd) { KH.kontur.x = ps.x; KH.kontur.y = ps.y; KH.kontur.scale.copyFrom(ps.scale); }
    if (hd) {
      KH.kontur.x = ps.x; KH.kontur.y = ps.y; KH.kontur.scale.copyFrom(ps.scale); KH.kontur.rotation = ps.rotation;
      ks.texture = hd; ks.anchor.set(hd._ax, hd._ay); ks.x = g.x; ks.y = g.y; ks.scale.copyFrom(g.scale); ks.rotation = g.rotation;
      ks.tint = ofkeT > 0.3 ? 0xff7040 : AYAR.kontur; ks.alpha = AYAR.konturAlfa; KH.kontur.alpha = ps.alpha;
    }
    // dev ve düşman kalabalığı ile üst üste: koyu ayırma çizgisi (önündeyken barbarın altında; arkasındayken röntgen kopyasının altında)
    var ok = olu ? { ortu: 0, koyu: 0 } : ortulmeVeKoyuHesap(p);
    var koyuH = AYAR.koyuKenar > 0 ? ok.koyu : 0;
    KH.koyuA += (koyuH - KH.koyuA) * Math.min(1, gd * 8);
    if (KH.koyuA < 0.02) KH.koyuA = koyuH ? KH.koyuA : 0;
    KH.koyu.visible = KH.koyuA > 0.02;
    if (KH.koyu.visible) {
      KH.koyu.x = ps.x; KH.koyu.y = ps.y; KH.koyu.scale.copyFrom(ps.scale); KH.koyu.rotation = ps.rotation;
      koyuKenarYerles(KH.kKenar, g, AYAR.koyuKenar * KH.koyuA * ps.alpha * ps.alpha * ps.alpha, ps.scale.x);   // yanıp sönen (yarı saydam) barbarın içinden siyah kopyalar görünüp onu karartmasın
    }
    // röntgen: örtülünce yumuşakça belirir
    var hedef = ok.ortu;
    KH.ortu += (hedef - KH.ortu) * Math.min(1, gd * (hedef > KH.ortu ? 12 : 6));
    var a = KH.ortu * AYAR.rontgen;
    KH.rontgen.visible = a > 0.02;
    if (KH.rontgen.visible) {
      // 20 Kasım: kap alfası her çocuğa ayrı uygulanıyordu → yarı saydam kopyanın ALTINDAKİ siyah kenar kopyaları gövdeden
      // görünüp barbarı kalabalıkta (ateşte) kararmış gösteriyordu. Kap tam; kopya A, siyah kenar A³ ile (içten sızma ≈ yok).
      var rA = Math.min(1, a * 1.15) * ps.alpha; KH.rontgen.alpha = 1;
      KH.rontgen.x = ps.x; KH.rontgen.y = ps.y; KH.rontgen.scale.copyFrom(ps.scale); KH.rontgen.rotation = ps.rotation;
      var rk = KH.rKopya; rk.texture = g.texture; rk.anchor.copyFrom(g.anchor); rk.x = g.x; rk.y = g.y; rk.scale.copyFrom(g.scale); rk.rotation = g.rotation; rk.alpha = rA;
      koyuKenarYerles(KH.rKenar, g, (AYAR.koyuKenar > 0 ? Math.max(AYAR.koyuKenar * 0.8, KH.koyuA * AYAR.koyuKenar) : 0) * rA * rA * rA, ps.scale.x);   // kopya devin üstünde: koyu çizgiyle ayrışsın
      var rh = KH.rHalka; rh.visible = false; hd = null;   // halka/kırmızı kenar yok: yalnız barbarın kendi renkleriyle net kopyası
      if (hd) { rh.texture = hd; rh.anchor.set(hd._ax, hd._ay); rh.x = g.x; rh.y = g.y; rh.scale.copyFrom(g.scale); rh.rotation = g.rotation; rh.tint = ofkeT > 0.3 ? 0xff8050 : AYAR.rontgenRenk; rh.alpha = AYAR.rontgenKenar; }
    }
  }

  // ------------------------------------------------------------------ SİS / TOZ KATMANI (az, yavaş)
  var yagmur = null, YAGMUR_DAMLA = 258, YAGMUR_HALKA = 66;
  function yagmurKur() {
    var damla = tuval(7, 48, function (g, w, h) {
      var iz = g.createLinearGradient(0, 0, 0, h);
      iz.addColorStop(0, 'rgba(171,205,224,0)');
      iz.addColorStop(0.36, 'rgba(171,205,224,.43)');
      iz.addColorStop(0.83, 'rgba(217,236,244,.94)');
      iz.addColorStop(1, 'rgba(212,233,243,0)');
      g.fillStyle = iz;
      g.beginPath(); g.moveTo(w * .48, 0); g.lineTo(w * .67, h * .82);
      g.lineTo(w * .5, h); g.lineTo(w * .35, h * .8); g.closePath(); g.fill();
    });
    var su = tuval(52, 28, function (g, w, h) {
      g.strokeStyle = 'rgba(199,222,235,.72)'; g.lineWidth = 1.15;
      g.beginPath(); g.ellipse(w / 2, h / 2, w * .42, h * .30, -.07, -.32, 4.53); g.stroke();
      g.strokeStyle = 'rgba(194,217,228,.39)';
      g.beginPath(); g.ellipse(w / 2, h / 2, w * .31, h * .22, -.07, 2.1, 5.6); g.stroke();
    });
    var yansi = tuval(88, 112, function (g, w, h) {
      var gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, 'rgba(255,255,255,0)');
      gr.addColorStop(.23, 'rgba(255,255,255,.59)');
      gr.addColorStop(.62, 'rgba(255,255,255,.37)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      for (var j = 0; j < 21; j++) {
        var u = j / 20, en = (11 + 40 * u) * (.43 + .57 * Math.pow(Math.sin(j * 2.6), 2));
        var x = w * .5 + Math.sin(j * 1.8) * (2 + 7 * u);
        g.fillRect(x - en / 2, 7 + u * (h - 8), en, j % 3 ? 1.5 : 2.1);
      }
    });
    var perde = new PIXI.ParticleContainer(YAGMUR_DAMLA, { position: true, rotation: true, alpha: true });
    var zemin = new PIXI.ParticleContainer(YAGMUR_HALKA, { position: true, vertices: true, alpha: true });
    perde.name = 'yanik_koy_yagmur'; zemin.name = 'yanik_koy_dalgalari';
    OYUN.katman.ust.addChildAt(perde, 0);
    OYUN.katman.leke.addChildAt(zemin, 0);
    var yansima = kap('islak_yansima', OYUN.katman.leke);
    yagmur = { perde: perde, zemin: zemin, yansima: yansima, damlalar: [], halkalar: [] };
    var i, s;
    for (i = 0; i < YAGMUR_DAMLA; i++) {
      var d = Math.random();
      s = new PIXI.Sprite(damla); s.anchor.set(.5);
      s.scale.set(.55 + d * .71, .40 + d * 1.01);
      perde.addChild(s);
      yagmur.damlalar.push({ s: s, x: Math.random(), y: Math.random(), derinlik: d });
    }
    for (i = 0; i < YAGMUR_HALKA; i++) {
      s = new PIXI.Sprite(su); s.anchor.set(.5); s.alpha = 0;
      zemin.addChild(s);
      yagmur.halkalar.push({ s: s, yas: r(.35, .7), boy: r(.55, 1), sure: r(.26, .49) });
    }
    for (i = 0; i < 10; i++) {
      s = new PIXI.Sprite(yansi);
      s.anchor.set(.5, 0);
      s.blendMode = PIXI.BLEND_MODES.ADD;
      s.tint = 0xf7ad68;
      s.visible = false;
      yansima.addChild(s);
    }
  }
  function yagmurGuncelle(gd) {
    if (bolumNo !== 1 || OYUN.durum === 'baslik' || OYUN.durum === 'yukleniyor') {
      if (yagmur) yagmur.perde.visible = yagmur.zemin.visible = yagmur.yansima.visible = false;
      return;
    }
    if (!yagmur) yagmurKur();
    yagmur.perde.visible = yagmur.zemin.visible = yagmur.yansima.visible = true;
    var dt = Math.min(gd, .055);
    if (OYUN.durum === 'mola') dt = 0;
    var kutu = gor(), gorunen = gorD();
    var hamle = .5 + .5 * Math.sin(gT * 1.02 + .68 * Math.sin(gT * .34));
    var ruzgar = .24 + .13 * hamle * hamle;
    var egim = -Math.atan2(ruzgar * (kutu.w + 64), kutu.h + 68);
    var isik = .89 + .11 * hamle;
    var i, d;
    for (i = 0; i < yagmur.damlalar.length; i++) {
      d = yagmur.damlalar[i];
      var hiz = 1.04 + d.derinlik * 1.52;
      d.x = (d.x + ruzgar * hiz * dt) % 1;
      d.y = (d.y + hiz * dt) % 1;
      d.s.position.set(kutu.x0 - 32 + d.x * (kutu.w + 64), kutu.y0 - 34 + d.y * (kutu.h + 68));
      d.s.rotation = egim;
      d.s.alpha = isik * (.23 + d.derinlik * .43);
    }
    for (i = 0; i < yagmur.halkalar.length; i++) {
      d = yagmur.halkalar[i];
      d.yas += dt;
      if (d.yas > d.sure && dt > 0) {
        d.yas = 0; d.boy = r(.45, 1); d.sure = r(.28, .56);
        d.s.position.set(r(gorunen.x, gorunen.x + gorunen.w), r(gorunen.y, gorunen.y + gorunen.h));
      }
      var p = Math.min(1, d.yas / d.sure);
      d.s.alpha = .37 * Math.min(1, p * 7) * (1 - p) * (1 - p);
      d.s.scale.set(d.boy * (.17 + p * .7));
    }
    yagmurYansimalari(gorunen);
  }
  function yagmurYansimalari(V) {
    var isiklar = window.BOLUM && BOLUM.atesler;
    var yansimalar = yagmur.yansima.children;
    var n = 0;
    if (isiklar) for (var i = 0; i < isiklar.length && n < yansimalar.length; i++) {
      var f = isiklar[i];
      if (!f || f.y < V.y - 125 || f.y > V.y + V.h + 45 || f.x < V.x - 90 || f.x > V.x + V.w + 90) continue;
      var s = yansimalar[n++], mesale = f.tur === 'mesale';
      s.visible = true;
      s.position.set(f.agizX ?? f.x, f.y + 6);
      s.scale.set(mesale ? .69 : 1.15, mesale ? .88 : .76);
      s.alpha = (mesale ? .33 : .21) * atesTitresim(i, f.tur) * (.92 + .08 * Math.sin(gT * 3 + i));
    }
    for (; n < yansimalar.length; n++) yansimalar[n].visible = false;
  }
  var sisler = [];
  function sisKur() {
    if (sisler.length) return;
    kok.sis = kap('sis', OYUN.katman.efekt);
    for (var i = 0; i < 6; i++) {
      var s = new PIXI.Sprite(D.duman); s.anchor.set(0.5); s.tint = i % 2 ? 0x8a94a6 : 0x6e7480;
      s._x = r(0, 1400); s._y = r(0, 820); s._v = r(6, 16); s._b = r(7, 11); s.rotation = r(0, PI2); s._r = r(-0.03, 0.03);
      kok.sis.addChild(s); sisler.push(s);
    }
  }
  function sisGuncelle(gd) {
    // yakınlık: sis görünen dünyanın (OYUN.gorus) çevresinde dolanır; görüş yana kayınca dünyaya yapışık kalır (x'te tam, y'de hafif paralaks)
    var V = gorD(), ky = V.y, kx = V.x, PX = Math.max(1500, V.w + 220), PY = Math.max(940, V.h + 220);
    var kizil = bolumNo === 2;
    kok.sis.visible = kizil || AYAR.sis > 0;
    if (!kok.sis.visible) return;
    for (var i = 0; i < sisler.length; i++) {
      var s = sisler[i];
      s._x += s._v * gd; s.rotation += s._r * gd;
      var ex = (((s._x - kx) % PX) + PX) % PX - 110, ey = (((s._y - ky * 0.15) % PY) + PY) % PY - 110;   // biraz paralaks
      s.x = kx + ex; s.y = ky + ey;
      s.tint = kizil ? (i % 2 ? 0xb44e44 : 0x783739) : (i % 2 ? 0x8a94a6 : 0x6e7480);
      s.scale.set(s._b * (kizil ? 1.5 : 1), s._b * (kizil ? .58 : 1));
      s.alpha = (kizil ? .17 : AYAR.sis) * (.72 + .28 * Math.sin(gT * .3 + i));
    }
  }
  // taze kan üstünde zamanla kararan parlak ıslaklık (damga dokuya yazıldıktan sonra)
  function tazeIz(doku, x, y, rot, sx, sy, sure, alfa) {
    var s = tekil('leke', doku, kok.gol); if (!s) return;
    s.x = x; s.y = y; s.rotation = rot; s.scale.set(sx, sy); s.tint = AYAR.tazeRenk; var a0 = alfa || 0.5; s.alpha = a0;
    geciciEkle(s, sure, function (s, t) { s.alpha = a0 * (1 - t) * (1 - t); }, function (s) { s._kullan = false; s.visible = false; });
  }

  // ------------------------------------------------------------------ GÜNCELLEME
  function havuzGuncelle(H, dt) {
    var g = 900;
    for (var i = 0; i < H.n; i++) {
      if (!H.canli[i]) continue;
      var tur = H.tur[i], s = H.sp[i];
      H.om[i] -= dt;
      if (tur === DAMLA) {
        H.vz[i] -= g * dt; H.x[i] += H.vx[i] * dt; H.y[i] += H.vy[i] * dt; H.z[i] += H.vz[i] * dt;
        if (H.z[i] <= 0) {
          var hz = Math.hypot(H.vx[i], H.vy[i]), b = H.boy[i] * Math.sqrt(AYAR.kan);
          if (hz > 200 && Math.random() < 0.5) damga(sec(D.lekeUzun), H.x[i], H.y[i], Math.atan2(H.vy[i], H.vx[i]), 0.24 * b * (1 + hz / 1400), 0.22 * b, sec(AYAR.lekeRenk), 0.85);
          else damga(sec(D.leke), H.x[i], H.y[i], r(0, PI2), 0.22 * b * (1 + hz / 1800), 0.19 * b, sec(AYAR.lekeRenk), 0.85);
          H.birak(i); continue;
        }
        var sy = H.vy[i] - H.vz[i];
        var sp = Math.hypot(H.vx[i], sy);
        s.x = H.x[i]; s.y = H.y[i] - H.z[i]; s.rotation = Math.atan2(sy, H.vx[i]);
        s.scale.set(H.boy[i] * (1 + sp / 600), H.boy[i] * 0.85);
        if (H.om[i] <= 0) H.birak(i);
        continue;
      }
      if (H.om[i] <= 0 && tur !== KUL) { H.birak(i); continue; }
      var t = 1 - H.om[i] / H.omMax[i];
      if (tur === BULUT) {
        var f = Math.max(0, 1 - H.surt[i] * dt);
        H.vx[i] *= f; H.vy[i] *= f; H.vz[i] *= f;
        H.x[i] += H.vx[i] * dt; H.y[i] += H.vy[i] * dt; H.z[i] += H.vz[i] * dt; H.rot[i] += H.vrot[i] * dt;
        s.x = H.x[i]; s.y = H.y[i] - H.z[i]; s.rotation = H.rot[i];
        s.scale.set(H.s0[i] + (H.s1[i] - H.s0[i]) * (1 - (1 - t) * (1 - t)));
        s.alpha = H.a0[i] * (1 - t) * Math.min(1, t * 8 + 0.3);
      } else if (tur === KIV) {
        var f2 = Math.max(0, 1 - H.surt[i] * dt);
        H.vx[i] *= f2; H.vy[i] *= f2; H.vz[i] -= 700 * H.yer[i] * dt;
        H.x[i] += H.vx[i] * dt; H.y[i] += H.vy[i] * dt; H.z[i] += H.vz[i] * dt;
        if (H.z[i] < 0) { H.z[i] = 0; H.vz[i] *= -0.3; }
        var ky = H.vy[i] - H.vz[i], kh = Math.hypot(H.vx[i], ky);
        s.x = H.x[i]; s.y = H.y[i] - H.z[i]; s.rotation = Math.atan2(ky, H.vx[i]);
        s.scale.set(Math.max(0.12, kh / 900) * H.boy[i] * 1.6, 0.55 * H.boy[i]);
        s.alpha = 1 - t * t;
      } else if (tur === PARCA || tur === TAS) {
        if (H.z[i] > 0 || H.vz[i] > 0) {
          H.vz[i] -= g * dt; H.z[i] += H.vz[i] * dt;
          H.x[i] += H.vx[i] * dt; H.y[i] += H.vy[i] * dt; H.rot[i] += H.vrot[i] * dt;
          if (H.z[i] <= 0) {
            H.z[i] = 0;
            if (H.vz[i] < -90) {                       // sek
              H.vz[i] = -H.vz[i] * 0.38; H.vx[i] *= 0.6; H.vy[i] *= 0.6; H.vrot[i] *= 0.5;
              if (tur === PARCA) damga(sec(D.leke), H.x[i], H.y[i], r(0, PI2), 0.3, 0.24, sec(AYAR.lekeRenk), 0.85);
            } else H.vz[i] = 0;
          }
        } else {                                       // yerde kayar
          var f3 = Math.max(0, 1 - 6 * dt);
          H.vx[i] *= f3; H.vy[i] *= f3; H.vrot[i] *= f3;
          H.x[i] += H.vx[i] * dt; H.y[i] += H.vy[i] * dt; H.rot[i] += H.vrot[i] * dt;
          var hiz = Math.hypot(H.vx[i], H.vy[i]);
          if (tur === PARCA && hiz > 25) {             // kan izi
            H.sayac[i] -= hiz * dt;
            if (H.sayac[i] <= 0) { H.sayac[i] = 9; damga(D.damla, H.x[i], H.y[i], Math.atan2(H.vy[i], H.vx[i]), 0.9, 0.55, sec(AYAR.lekeRenk), 0.8); }
          }
          if (hiz < 6) {
            H.ek[i] += 1;
            if (H.ek[i] > 40) {                        // durdu: yere damgala (kalıcı), parçacığı serbest bırak
              damga(s.texture, H.x[i], H.y[i], H.rot[i], H.boy[i], H.boy[i] * 0.85, H.renk[i] === 0xffffff ? 0xa8a4a0 : H.renk[i], 1);
              H.birak(i); continue;
            }
          }
        }
        s.x = H.x[i]; s.y = H.y[i] - H.z[i]; s.rotation = H.rot[i]; s.scale.set(H.boy[i], H.boy[i] * (0.85 + 0.15 * Math.cos(H.rot[i] * 2)));
      } else if (tur === SABIT) {
        s.x = H.x[i]; s.y = H.y[i]; s.rotation = H.rot[i];
        s.scale.set(H.s0[i] + (H.s1[i] - H.s0[i]) * (1 - (1 - t) * (1 - t)));
        s.alpha = H.a0[i] * (1 - t);
      } else if (tur === KUL) {
        kulGuncelle(H, i, dt, s);
      }
    }
  }

  // kül/kor: ekran çevresinde dolaşır, çıkınca yeniden doğar. ek=1 → bir kez yaşar (şifa parıltısı vb.)
  function kulDogur(H, i, ilk) {
    var V = gorD(), ky = V.y, W = V.w, Hh = V.h;   // yakınlık: GÖRÜNEN DÜNYANIN tamamında (görüş kayınca da)
    H.x[i] = V.x + r(-40, W + 40); H.y[i] = ilk ? ky + r(-40, Hh + 40) : ky + Hh + r(20, 80); H.z[i] = r(0, 140);
    var kor = H === P;
    if (bolumNo === 2) {
      // Bölüm II (Kül Geçidi): alttan yukarı yükselen parlak turuncu-kızıl közler ve koyu bazalt kül tanecikleri
      H.y[i] = ilk ? ky + r(-40, Hh + 40) : ky + Hh + r(10, 55);
      H.z[i] = ilk ? r(0, 140) : r(0, 45);
      H.vx[i] = r(-12, 56);
      H.vy[i] = kor ? r(-108, -32) : r(-83, -27);
      H.vz[i] = kor ? r(6, 26) : r(-4, 14);
      H.boy[i] = kor ? r(0.12, 0.24) : r(0.105, 0.30);
      H.sayac[i] = r(0, 10); H.om[i] = H.omMax[i] = kor ? r(5, 11) : r(6, 13);
      var renk2 = kor ? sec(KUL_KOR_2) : sec(KUL_KUL_2);
      H.renk[i] = renk2; H.sp[i].tint = renk2;
      H.sp[i].texture = kor ? D.korNokta : D.damla;
      return;
    }
    H.vx[i] = r(-18, 30); H.vy[i] = r(-70, -25); H.vz[i] = r(-6, 10); H.boy[i] = kor ? r(0.12, 0.3) : r(0.15, 0.35);
    H.sayac[i] = r(0, 10); H.om[i] = H.omMax[i] = r(6, 14);
    var renk = kor ? sec(KUL_KOR_1) : sec(KUL_KUL_1);
    H.renk[i] = renk; H.sp[i].tint = renk; H.sp[i].texture = D.damla;
  }
  function kulGuncelle(H, i, dt, s) {
    H.sayac[i] += dt;
    if (H.ek[i] === 1) {          // tek seferlik (şifa)
      if (H.om[i] <= 0) { H.birak(i); return; }
      H.z[i] += H.vz[i] * dt; s.x = H.x[i]; s.y = H.y[i] - H.z[i]; s.scale.set(H.boy[i]);
      s.alpha = Math.min(1, H.om[i] * 3); return;
    }
    if (H.ek[i] === 2) {          // süzülen sıcak köz taneciği (öfke / ateş)
      if (H.om[i] <= 0) { H.birak(i); return; }
      var yas2 = 1 - H.om[i] / H.omMax[i];
      H.x[i] += (H.vx[i] + Math.sin(H.sayac[i] * 6.5 + i * 1.7) * 20) * dt;
      H.y[i] += H.vy[i] * dt;
      H.z[i] += H.vz[i] * dt;
      s.x = H.x[i]; s.y = H.y[i] - H.z[i];
      s.scale.set(H.boy[i] * (1 - yas2 * 0.45));
      var gir2 = Math.min(1, yas2 * 6), cik2 = 1 - yas2;
      s.alpha = gir2 * Math.pow(cik2, 0.8) * (0.75 + 0.25 * Math.sin(H.sayac[i] * 14 + i));
      return;
    }
    var salinim = bolumNo === 2 ? Math.sin(H.sayac[i] * 2.4 + i) * 28 : Math.sin(H.sayac[i] * 1.7 + i) * 22;
    H.x[i] += (H.vx[i] + salinim) * dt; H.y[i] += H.vy[i] * dt; H.z[i] += H.vz[i] * dt;
    var V = gorD(), ky = V.y, Hh = V.h, W = V.w;
    if (H.om[i] <= 0 || H.y[i] - H.z[i] < ky - 60 || H.y[i] > ky + Hh + 120 || H.x[i] < V.x - 80 || H.x[i] > V.x + W + 80) kulDogur(H, i, false);
    s.x = H.x[i]; s.y = H.y[i] - H.z[i];
    var yas = 1 - H.om[i] / H.omMax[i];
    if (bolumNo === 2) {
      s.rotation = H.sayac[i] * 1.4;
      if (H === P) {
        s.scale.set(H.boy[i]);
        s.alpha = (0.75 + 0.25 * Math.sin(H.sayac[i] * 9 + i)) * Math.min(1, yas * 6, (1 - yas) * 4);
      } else {
        s.scale.set(H.boy[i] * 1.4, H.boy[i] * 0.68);
        s.alpha = 0.68 * Math.min(1, yas * 6, (1 - yas) * 4);
      }
      return;
    }
    s.rotation = H.sayac[i];
    s.scale.set(H.boy[i]);
    s.alpha = (H === P ? 0.55 + 0.45 * Math.sin(H.sayac[i] * 7 + i) : 0.5) * Math.min(1, yas * 6, (1 - yas) * 4);
  }
  var kulKuruldu = false;
  function kulleriKur() {
    if (kulKuruldu) return; kulKuruldu = true;
    var toplam = AYAR.kul + (bolumNo === 2 ? 32 : 0);
    var nKor = Math.round(toplam * 0.45), nKul = toplam - nKor;
    for (var j = 0; j < nKor; j++) { var i = P.al(KUL, D.damla, 0, 0, 0, 10); if (i >= 0) kulDogur(P, i, true); }
    for (j = 0; j < nKul; j++) { i = N.al(KUL, D.damla, 0, 0, 0, 10); if (i >= 0) kulDogur(N, i, true); }
  }

  function atesleriGuncelle(dt) {
    var at = null;
    try { at = window.BOLUM && BOLUM.atesler; } catch (e) {}
    var V = gorD(), ky = V.y, Hh = V.h, kx = V.x, Ww = V.w, n = 0;   // görünen dünya (yakınlık + görüş kayması)
    if (at && at.length) {
      for (var j = 0; j < at.length && n < atesIsiklari.length; j++) {
        var f = at[j]; if (!f || f.y < ky - 300 || f.y > ky + Hh + 300 || f.x < kx - 300 || f.x > kx + Ww + 300) continue;
        var g = (f.guc || 1) * AYAR.atesIsik, L = atesIsiklari[n++], fh = f.h || 30, tr = f.tur;
        var tit = atesTitresim(j, tr);   // göz yormayan, doğal sıcak nefes
        var agizX = f.agizX ?? f.x, agizY = f.agizY;
        L[0].visible = L[1].visible = true;
        L[0].x = agizX; L[0].y = agizY === undefined ? f.y - fh * 0.6 : agizY - 6; L[0].tint = 0xff8a3a; L[0].alpha = 0.055 * tit; L[0].scale.set((120 + 40 * g) / 64 * (0.98 + 0.03 * tit));   // asıl ışık haritada; bu yalnız alevin hemen çevresindeki hafif parıltı (geniş eklemeli pus sahneyi bulandırıyordu) L[0].texture = D.isik;
        L[1].x = agizX; L[1].y = agizY === undefined ? f.y - fh * 0.8 : agizY - 16; L[1].tint = 0xffc070; L[1].alpha = 0.18 * tit; L[1].scale.set(1.0 * g * (0.97 + 0.03 * tit));
        if (dt > 0) {
          atesSayac[j] = Math.min(0.6, (atesSayac[j] || 0) + dt);
          var yayX = (tr === 'enkaz' || tr === 'koz') ? 20 : 9;
          var korYogun = bolumNo === 2;
          var aralik = (korYogun ? .118 : .16) / g;
          while (atesSayac[j] > aralik) {
            atesSayac[j] -= aralik;
            var cx = agizX + r(-yayX, yayX) * g, cy = f.y + r(-4, 4);
            var cz = agizY === undefined ? fh * r(0.45, 0.95) : f.y - agizY + r(12, 35);
            var ck = P.al(KUL, korYogun ? D.korNokta : D.damla, cx, cy, cz, korYogun ? r(1.02, 1.83) : r(.75, 1.35));
            if (ck >= 0) {
              P.ek[ck] = 2;
              P.vx[ck] = korYogun ? r(-16, 62) : r(-18, 18);
              P.vy[ck] = korYogun ? r(-22, 3) : r(-6, 6);
              P.vz[ck] = korYogun ? r(29, 76) : r(45, 95);
              P.boy[ck] = korYogun ? r(.10, .21) : r(.14, .26);
              P.sayac[ck] = r(0, 6); P.renk[ck] = sec(korYogun ? KUL_KOR_2 : ATES_KOR); P.sp[ck].tint = P.renk[ck];
            }
            if (Math.random() < (korYogun ? .30 : .55)) {
              var k = P.al(KIV, D.cizgi, cx, cy, cz, r(0.55, 1.15));
              if (k >= 0) { P.vx[k] = r(-26, 26); P.vy[k] = r(-8, 8); P.vz[k] = r(75, 165); P.surt[k] = 0.7; P.yer[k] = -0.08; P.boy[k] = r(0.28, 0.42); P.renk[k] = sec([0xffb048, 0xff7c28, 0xffd070]); P.sp[k].tint = P.renk[k]; }
            }
            if (Math.random() < 0.28) {
              var islak = bolumNo === 1;
              bulut(f.x + r(-8, 8), f.y, fh + r(10, 30), islak ? 0x9ba5a6 : 0x2e2c2c,
                0.5, r(1.3, 1.9), r(1.6, 2.4), islak ? 0.13 : 0.16, 0, r(-10, 14), r(-6, 0), r(40, 70));
            }
          }
        }
      }
    }
    for (; n < atesIsiklari.length; n++) atesIsiklari[n][0].visible = atesIsiklari[n][1].visible = false;
  }

  function yerlesEkran(s, x0, y0, w, h) { s.x = x0; s.y = y0; s.width = w; s.height = h; }
  function ekranUstleri(gDt) {
    // tam ekran: görünen alanın tamamını örter (G.x0/G.y0 ≤ 0: 1280×720'nin dışındaki şeritler de)
    var G = gor(), W = G.w, Hh = G.h, m = 60, V = gorD();
    // ton dünya katmanında (isik) → görünen dünyaya göre (yakınlık); diğerleri ust (ekran koordinatı, pencerenin tamamı)
    kok.ton.visible = AYAR.ayLift > 0; kok.ton.x = V.x - m; kok.ton.y = V.y - m; kok.ton.width = V.w + 2 * m; kok.ton.height = V.h + 2 * m;
    var ex = G.x0 - m, ey = G.y0 - m, ew = W + 2 * m, eh = Hh + 2 * m;
    yerlesEkran(kok.vinyet, ex, ey, ew, eh); yerlesEkran(kok.volkan, ex, ey, ew, eh);
    yerlesEkran(kok.ofkeTon, ex, ey, ew, eh); yerlesEkran(kok.ofkeKenar, ex, ey, ew, eh);
    kok.hasar.x = G.x0 - 10; kok.hasar.y = G.y0 - 10; kok.hasar.width = W + 20; kok.hasar.height = Hh + 20;   // ince şerit pencerenin kenarında (sarsıntı payı 10 px)
    if (bolumNo === 2) {
      kok.vinyet.tint = 0x480e04; kok.vinyet.alpha = AYAR.volkanVinyet;
      kok.volkan.visible = AYAR.volkanAltIsik > 0;
      kok.volkan.tint = 0xe83c0c;
      kok.volkan.alpha = AYAR.volkanAltIsik * (.94 + .06 * Math.sin(gT * 1.4));
    } else {
      kok.vinyet.tint = 0x000000; kok.vinyet.alpha = AYAR.vinyet;
      kok.volkan.visible = false; kok.volkan.alpha = 0;
    }
    // öfke: görüşü boğmayan, netliği koruyan sıcak kenar vurgusu
    if (ofkeAcik) ofkeT = Math.min(1, ofkeT + gDt * 4); else ofkeT = Math.max(0, ofkeT - gDt * 2);
    var nab = 0.5 + 0.5 * Math.sin(gT * 6);
    kok.ofkeTon.alpha = 0.014 * ofkeT;
    kok.ofkeKenar.tint = 0xe84818;
    ofkeGiris = Math.max(0, ofkeGiris - gDt);
    kok.ofkeKenar.alpha = (0.18 + 0.04 * nab) * ofkeT + ofkeGiris * 0.38;
    // hasar darbesi + düşük can nabzı
    hasarDarbe = Math.max(0, hasarDarbe - gDt * 2.2);
    var dusuk = 0;
    try { if (window.OYUNCU && OYUNCU.canli !== false && OYUNCU.canMax) { var o = OYUNCU.can / OYUNCU.canMax; if (o < AYAR.dusukCan && o > 0) dusuk = (1 - o / AYAR.dusukCan) * 0.6 + 0.4; } } catch (e) {}
    var kalp = Math.pow(Math.max(0, Math.sin(gT * 5.2)), 6);
    // 4. tur: ince kenar şeridi (orta temiz); hasar ≤ hasarEn, düşük can ≤ dusukEn (eski: tüm ekrana yayılan ≈0,9)
    kok.hasar.alpha = Math.min(AYAR.hasarEn + AYAR.dusukEn, hasarDarbe * AYAR.hasarEn + dusuk * AYAR.dusukEn * (0.5 + 0.5 * kalp));
    // barbarın ışığı + öfke halesi (barbarın kendi rengini/siluetini boğmayacak kadar hafif)
    var p = oyuncuKonum();
    if (p) {
      kok.oyuncuIsik.visible = AYAR.oyuncuIsik > 0; kok.oyuncuIsik.x = p.x; kok.oyuncuIsik.y = p.y - 40; kok.oyuncuIsik.scale.set(1.8); kok.oyuncuIsik.alpha = AYAR.oyuncuIsik;
      kok.ofkeHale.visible = ofkeT > 0.01; kok.ofkeHale.x = p.x; kok.ofkeHale.y = p.y - 50; kok.ofkeHale.tint = 0xff6024;
      kok.ofkeHale.scale.set(1.45 + 0.12 * nab); kok.ofkeHale.alpha = 0.07 * ofkeT * (0.7 + 0.3 * nab);
    } else { kok.oyuncuIsik.visible = false; kok.ofkeHale.visible = false; }
  }

  function guncelle(dt) {
    if (!kur()) return;
    var gd = (OYUN.zaman && OYUN.zaman.gercekDt) || dt || 0.016;
    gT += gd;
    if (bolumNo !== 3) kulleriKur();
    devIzle();
    for (var zi = zamanli.length - 1; zi >= 0; zi--) { var zz = zamanli[zi]; zz.t -= gd; if (zz.t <= 0) { zamanli.splice(zi, 1); try { zz.fn(); } catch (e) {} } }
    var p = oyuncuKonum();
    // öfke kıvılcımları ve yukarı/geriye süzülen küçük sıcak köz tanecikleri (siluet/renk bozulmaz, hale yok)
    var ofkeSimdi = ofkeAcik || !!(p && p.ofkeli);
    if (ofkeSimdi && p && dt > 0) {
      ofkeKozAra -= dt;
      if (ofkeKozAra < -0.12) ofkeKozAra = -0.12;
      var bAci = p.aci !== undefined ? p.aci : -Math.PI / 2;
      var geriX = -Math.cos(bAci), geriY = -Math.sin(bAci) * 0.65;
      while (ofkeKozAra <= 0) {
        ofkeKozAra += 0.040;
        var a = r(0, PI2), rx = r(16, 38), ry = r(7, 15);
        var kx = p.x + Math.cos(a) * rx, ky = p.y + Math.sin(a) * ry, kz = r(27, 97);
        var ck = P.al(KUL, D.damla, kx, ky, kz, r(0.45, 0.85));
        if (ck >= 0) {
          P.ek[ck] = 2;
          P.vx[ck] = geriX * r(22, 52) + r(-14, 14);
          P.vy[ck] = geriY * r(18, 42) + r(-8, 8);
          P.vz[ck] = r(55, 115);
          P.boy[ck] = r(0.16, 0.30);
          P.sayac[ck] = r(0, 6);
          P.renk[ck] = sec([0xffb848, 0xff7a24, 0xff5018, 0xffd270]); P.sp[ck].tint = P.renk[ck];
        }
        // Kısa, beyaz çekirdekli iz omuzdan dışarı fırlar ve kor gibi söner.
        var yon = Math.random() < 0.5 ? -1 : 1;
        var k = P.al(KIV, D.ofkeKivilcim, p.x + yon * r(18, 31), p.y + r(-8, 9), r(77, 112), r(0.32, 0.54));
        if (k >= 0) {
          P.vx[k] = yon * r(70, 140) + geriX * 35;
          P.vy[k] = geriY * 24 + r(-14, 14);
          P.vz[k] = r(160, 258);
          P.surt[k] = 1.1; P.yer[k] = 0.42; P.boy[k] = r(0.84, 1.18);
          P.renk[k] = Math.random() < 0.52 ? 0xffffff : 0xff9c97; P.sp[k].tint = P.renk[k];
        }
        if (Math.random() < 0.10) bulut(p.x + r(-22, 22), p.y + r(-6, 6), r(20, 70), sec([0x2a1814, 0x3a2018]), 0.3, r(0.9, 1.4), r(0.7, 1.1), 0.28, 0, geriX * 16 + r(-10, 10), geriY * 12 + r(-4, 2), r(50, 90));
      }
    } else if (!ofkeSimdi) {
      ofkeKozAra = 0;
    }
    // atılma: hız çizgileri + silüet izi
    if (atilma && p) {
      atilma.t -= dt; atilma.ara -= dt;
      if (atilma.ara <= 0 && dt > 0) {
        atilma.ara = 0.035;
        hayalet(p);
        for (var j = 0; j < 3; j++) {
          var ai = P.al(KIV, D.cizgi, p.x + r(-26, 26), p.y + r(-10, 10), r(10, 100), 0.16);
          if (ai >= 0) { P.vx[ai] = Math.cos(atilma.aci) * 900; P.vy[ai] = Math.sin(atilma.aci) * 900 / 0.8; P.surt[ai] = 9; P.yer[ai] = 0; P.boy[ai] = 1; P.renk[ai] = 0xc0d0e0; P.sp[ai].tint = 0xc0d0e0; }
        }
      }
      if (atilma.t <= 0) atilma = null;
    }
    // balta ve mermi izleri
    if (dt > 0) mermiIzleri(dt);
    havuzGuncelle(N, dt);
    havuzGuncelle(P, dt);
    // geçici sprite'lar
    for (var i = gecici.length - 1; i >= 0; i--) {
      var e = gecici[i]; e.om -= dt;
      if (e.om <= 0) { if (e.b) e.b(e.s); else { e.s._kullan = false; e.s.visible = false; } gecici.splice(i, 1); continue; }
      if (e.g) e.g(e.s, 1 - e.om / e.omMax);
    }
    atesleriGuncelle(dt);
    yagGuncelle(dt);
  }
  // her durumda her kare (oyun adımlarından SONRA): ekran üstleri, leke dilimleri, damgaların dokuya yazılması
  function herKare(gd) {
    if (!kur()) return;
    flasBuKare = 0;
    if (OYUN.durum !== 'oyun') gT += gd;
    dilimleriGuncelle();
    ekranUstleri(gd);
    yagmurGuncelle(gd);
    kasirgaIzi();
    hasarSayilariGuncelle();
    sisGuncelle(gd);
    kahramanGuncelle(gd);
    haritaGuncelle(gd);
    damgalariYaz();
    lekeSoldur(gd);
  }

  function hayalet(p) {
    var sp = null;
    try { sp = p.sprite && (p.sprite.g || sporBul(p.sprite)); } catch (e) {}
    if (!sp || !sp.texture) return;
    var s = tekil('normal', sp.texture, kok.hayalet, ADDm()); if (!s) return;
    s.anchor.copyFrom(sp.anchor);
    try {
      var m = kok.hayalet.worldTransform.clone().invert().append(sp.worldTransform);
      s.transform.setFromMatrix(m);
    } catch (e) { s.x = p.x; s.y = p.y; }
    s.tint = ofkeAcik ? 0xff4020 : 0x6080c0;
    geciciEkle(s, 0.25, function (s, t) { s.alpha = 0.5 * (1 - t); }, function (s) { s._kullan = false; s.visible = false; s.anchor.set(0.5); s.scale.set(1); s.skew.set(0, 0); });
  }
  function sporBul(o) {
    if (o instanceof PIXI.Sprite && o.visible && o.texture && o.texture !== PIXI.Texture.EMPTY) return o;
    if (o.children) for (var i = 0; i < o.children.length; i++) { var b = sporBul(o.children[i]); if (b) return b; }
    return null;
  }

  var mKare = 0;
  function mermiIzleri(dt) {
    var L = null;
    try { L = window.MERMI && MERMI.liste; } catch (e) {}
    var baltaBul = null; mKare++;
    if (L) for (var i = 0; i < L.length; i++) {
      var m = L[i]; if (!m || m.olu) continue;
      if (m.tur === 'ok' && L.length > 6 && ((mKare + i) & 1)) continue;   // çok okta iz her iki karede bir (havuz taşmasın; iz yine kesintisiz görünür)
      var aci = Math.atan2(m.vy || 0, m.vx || 0), z = m.z !== undefined ? m.z : 34;
      if (m.tur === 'ok') {
        // 4. tur: kalabalıkta seçilsin — koyu alt çizgi (açık zeminde/kanda kontrast) + sıcak açık iz (eski: 0,35 alfa kısa soluk çizgi)
        var dus = m.sahip !== 'oyuncu', ox_ = m.x - Math.cos(aci) * 18, oy_ = m.y - z - Math.sin(aci) * 18;
        var kd = N.al(SABIT, D.cizgi, ox_, oy_ + 2, 0, AYAR.okIzSure);
        if (kd >= 0) { N.s0[kd] = N.s1[kd] = 0.85; N.a0[kd] = 0.45; N.rot[kd] = aci; N.renk[kd] = 0x000000; N.sp[kd].tint = 0x000000; }
        var k = P.al(SABIT, D.cizgi, ox_, oy_, 0, AYAR.okIzSure);
        if (k >= 0) { P.s0[k] = 0.95; P.s1[k] = 0.6; P.a0[k] = AYAR.okIzAlfa; P.rot[k] = aci; P.renk[k] = dus ? 0xffe2b0 : 0xd8ecff; P.sp[k].tint = P.renk[k]; }
      } else if (m.tur === 'buyu') {
        if (Math.random() < 0.6) bulut(m.x, m.y, z, 0x0c2410, 0.25, 0.55, 0.35, 0.5, 0, r(-10, 10), r(-10, 10), 0);   // koyu yeşil duman izi (kontrast)
        var b = P.al(SABIT, D.yumusak, m.x + r(-4, 4), m.y - z + r(-4, 4), 0, AYAR.buyuIzSure);
        if (b >= 0) { P.s0[b] = 0.5; P.s1[b] = 0.12; P.a0[b] = AYAR.buyuIzAlfa; P.renk[b] = sec([0x40ff60, 0x90ff70, 0x20c050]); P.sp[b].tint = P.renk[b]; }
        if (Math.random() < 0.5) kivilcim(m.x, m.y, z, aci + Math.PI + r(-0.6, 0.6), r(30, 90), 0x80ff90, 0.3, 0.35, -0.1);
        anlikIsik(m.x, m.y - z * 0.5, 0x50ffa8, 120, 0.55);
      } else if (m.tur === 'balta') baltaBul = m;
      else if (m.tur === 'kaya' && Math.random() < 0.4) bulut(m.x, m.y, z, 0x6e665c, 0.3, 0.8, 0.5, 0.35);
      else if (m.tur === 'comlek') {   // dönen çömleğin fitili: küçük alev + ince duman + sıcak ışık
        var fz = z + 16, fq = P.al(KIV, D.cizgi, m.x + r(-3, 3), m.y, fz, r(0.12, 0.22));
        if (fq >= 0) { P.vx[fq] = r(-20, 20); P.vy[fq] = 0; P.vz[fq] = r(60, 120); P.surt[fq] = 2; P.yer[fq] = 0; P.boy[fq] = r(0.35, 0.55); P.renk[fq] = sec([0xff8a20, 0xffc050]); P.sp[fq].tint = P.renk[fq]; }
        if (Math.random() < 0.35) bulut(m.x, m.y, fz, 0x2a2420, 0.2, 0.5, 0.4, 0.3, 0, 0, 0, 20);
        anlikIsik(m.x, m.y - z * 0.5, 0xff8a30, 100, 0.55);
      }
    }
    // balta: MERMI.liste'de tur:'balta' ya da OYUNCU.balta {x,y}
    if (!baltaBul && baltaUcuyor) { try { if (window.OYUNCU && OYUNCU.balta && OYUNCU.balta.x !== undefined) baltaBul = OYUNCU.balta; } catch (e) {} }
    if (baltaBul) {
      var bz = baltaBul.z !== undefined ? baltaBul.z : 42;
      var donYon = Math.cos(Math.atan2(baltaBul.vy || 0, baltaBul.vx || 1)) >= 0 ? 1 : -1;
      var donFaz = baltaBul.faz === 'don';
      baltaIzT += dt * 22 * donYon;
      baltaIzAra -= dt;
      if (baltaIzAra <= 0) {
        baltaIzAra = donFaz ? 0.013 : 0.015;
        for (var j = 0; j < 2; j++) {
          var a = baltaIzT + j * Math.PI;
          // dış kenar: soğuk çelik parıltısı (dönen bıçak ucu)
          var q = P.al(SABIT, D.cizgi, baltaBul.x + Math.cos(a) * 22, baltaBul.y - bz + Math.sin(a) * 22 * 0.85, 0, 0.12);
          if (q >= 0) {
            P.s0[q] = 0.62; P.s1[q] = 0.24; P.a0[q] = donFaz ? 0.78 : 0.68;
            P.rot[q] = a + donYon * Math.PI / 2;
            P.renk[q] = ofkeAcik ? 0xff7838 : 0xe4f2ff; P.sp[q].tint = P.renk[q]; P.sp[q].scale.y = 0.44;
          }
          // iç kenar: sıcak hareket izi
          var qi = P.al(SABIT, D.cizgi, baltaBul.x + Math.cos(a - donYon * 0.25) * 14, baltaBul.y - bz + Math.sin(a - donYon * 0.25) * 14 * 0.85, 0, 0.10);
          if (qi >= 0) {
            P.s0[qi] = 0.42; P.s1[qi] = 0.15; P.a0[qi] = 0.45;
            P.rot[qi] = a - donYon * 0.25 + donYon * Math.PI / 2;
            P.renk[qi] = ofkeAcik ? 0xff4018 : 0xff9848; P.sp[qi].tint = P.renk[qi]; P.sp[qi].scale.y = 0.30;
          }
        }
      }
      sonBalta = { x: baltaBul.x, y: baltaBul.y };
    } else baltaIzAra = 0;
  }

  function sifirla() {
    if (!hazir) return;
    N.temizle(); P.temizle(); kulKuruldu = false;
    for (var s = 0; s < hasarSayilari.length; s++) {
      hasarSayilari[s].bitis = -1;
      hasarSayilari[s].hedef = null;
      hasarSayilari[s].yazi.visible = false;
    }
    for (var i = 0; i < gecici.length; i++) { gecici[i].s._kullan = false; gecici[i].s.visible = false; if (gecici[i].s.anchor) gecici[i].s.anchor.set(0.5); if (gecici[i].s.skew) gecici[i].s.skew.set(0, 0); }
    gecici.length = 0;
    for (i = 0; i < dilimler.length; i++) { var d = dilimler[i]; if (d.dolu) renderer.render(bosKap, { renderTexture: d.rt, clear: true }); d.dolu = false; d.k = -999999; d.sp.visible = false; }
    for (i = 0; i < damgaN; i++) damgaSp[i].visible = false;
    damgaN = 0; damgaKayip = 0;
    goller.length = 0; kanliAdim = 0;
    for (i = 0; i < YAG.length; i++) { YAG[i].aktif = false; YAG[i].g0.visible = YAG[i].g1.visible = false; for (var ai = 0; ai < YAG[i].alev.length; ai++) YAG[i].alev[ai].visible = false; } tutusT_ = 0;
    for (i = 0; i < tutusAlev.length; i++) tutusAlev[i].visible = false; if (TG) { TG.a.clear(); TG.b.clear(); }
    zamanli.length = 0; devOnceki = null; sonKukreT = -9; devDustu = false; arenaKapali = false; gerT = 0; devT = 0; sonDevVurT = -9;
    ofkeAcik = false; ofkeT = 0; ofkeGiris = 0; ofkeKozAra = 0; hasarDarbe = 0; atilma = null; baltaUcuyor = false; sonBalta = null;
    kok.ofkeTon.alpha = kok.ofkeKenar.alpha = kok.hasar.alpha = 0;
    kok.kasirgaArka.visible = kok.kasirgaOn.visible = false;
    if (IH) for (i = 0; i < IH.flas.length; i++) { IH.flas[i]._om = 0; IH.flas[i].visible = false; }
    if (KH) { KH.ortu = 0; KH.rontgen.visible = false; KH.koyuA = 0; KH.koyu.visible = false; }
    istatistik = { damga: 0, vurus: 0, olum: 0 }; sonDamga = 0; solT = 0;
    bolumAtmosferUygula(aktifBolum());
  }


  // ------------------------------------------------------------------ YAKICI: ateş birikintisi, çömlek, tutuşma (19 Kasım)
  // Birikinti = zeminde net kenarlı yanan yağ (koyu leke + sıcak yağ + parlak kenar = yakan alan) + az sayıda alev dili/kor.
  // Sabit 6 yuva; her yuvanın iki Graphics'i bir kez kurulur, atesYak'ta bir kez çizilir; kare başına yalnız konum/ölçek/alfa.
  var YAG = [], YAG_N = 6, yagSonuc = { n: 0 };
  function yanikDoku() {
    if (D.yanik) return D.yanik;
    D.yanik = tuval(128, 72, function (g, w, h) {
      g.save(); g.translate(w / 2, h / 2); g.scale(1, h / w);
      yumusakDaire(g, 0, 0, w * 0.5, [[0, 'rgba(255,255,255,0.95)'], [0.55, 'rgba(255,255,255,0.8)'], [0.85, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]);
      g.globalCompositeOperation = 'destination-out';
      for (var i = 0; i < 9; i++) { var a = Math.random() * PI2, d = w * r(0.4, 0.52); g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d, w * r(0.06, 0.12), 0, PI2); g.fill(); }
      g.restore();
    });
    return D.yanik;
  }
  function yagYuva() {
    for (var i = 0; i < YAG.length; i++) if (!YAG[i].aktif) return YAG[i];
    if (YAG.length < YAG_N) {
      var y = { aktif: false, g0: new PIXI.Graphics(), g1: new PIXI.Graphics() };
      y.g1.blendMode = PIXI.BLEND_MODES.ADD;
      kok.gol.addChild(y.g0); kok.gol.addChild(y.g1); y.g0.visible = y.g1.visible = false;
      y.alev = []; for (var j = 0; j < ALEV_N; j++) y.alev.push(alevSprite(OYUN.katman.varlik));
      YAG.push(y); return y;
    }
    var en = YAG[0]; for (i = 1; i < YAG.length; i++) if (YAG[i].t / YAG[i].sure > en.t / en.sure) en = YAG[i];
    yagBitir(en); return en;
  }
  // 20 Kasım (ebeveyn: "çerçevesi çizgili elips gibi"): düz elips ve kenar çizgisi YOK. Leke tohumlu, loblu, sıçramalı;
  // yakan alanı alev dilleri + koyu yağ belirler. Alev dilleri elle boyanmış 3 tonlu doku (3×), varlık katmanında y sırasıyla
  // (arka yarıdakiler karakterin arkasında, ön yarıdakiler önünde). Yuva başına ALEV_N dil, bir kez kurulur (kare başına yeni nesne yok).
  var ALEV_N = 24, tutusAlev = [], TG = null;
  function tohumlu(s) { s = (Math.abs(s | 0) % 2147483646) + 1; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  var alevRenkleri = {
    normal: ['#a3300e', '#d9773a', '#eeb260', '#f3d9a0'],
    mesale: ['#a8340b', '#e16b24', '#ffbe48', '#fff0b0'],
    koz: ['#741e15', '#b53820', '#ed7337', '#ffbc70']
  };
  function ayazAlevGolge(g, cx, B, yol) {
    g.beginPath(); yol(g); g.closePath();
    var dis = g.createLinearGradient(0, B - 60, 0, B + 2);
    dis.addColorStop(0, 'rgba(204,72,24,0)');
    dis.addColorStop(.24, 'rgba(220,90,28,.47)');
    dis.addColorStop(.60, 'rgba(246,132,34,.90)');
    dis.addColorStop(.88, '#ffbe5b');
    dis.addColorStop(1, 'rgba(235,107,31,.72)');
    g.fillStyle = dis; g.fill();
    g.save(); g.translate(cx, B); g.scale(.67,.79); g.translate(-cx,-B);
    g.beginPath(); yol(g); g.closePath();
    var ic = g.createLinearGradient(0, B - 63, 0, B + 3);
    ic.addColorStop(0, 'rgba(251,154,46,0)');
    ic.addColorStop(.34, 'rgba(255,180,52,.65)');
    ic.addColorStop(.76, '#fff0a7');
    ic.addColorStop(1, '#fff6d0');
    g.fillStyle = ic; g.fill();
    g.restore();
  }
  function alevDokulari(tur) {   // 4 biçim: 0 kıvrık uçlu, 1 çatallı, 2 ince-uzun, 3 alçak-geniş (ikili uç). Mürekkep konturlu, 4 ton, soluk çekirdek
    tur = tur || 'normal';
    D.alev = D.alev || {};
    if (D.alev[tur]) return D.alev[tur];
    var B = 62, cx = 14, YOL = [
      function (g) { g.moveTo(cx - 10, B); g.bezierCurveTo(cx - 12, B - 20, cx - 6, B - 34, cx - 2, B - 44); g.bezierCurveTo(cx + 1, B - 50, cx + 6, B - 54, cx + 9, B - 50);
        g.bezierCurveTo(cx + 4, B - 48, cx + 3, B - 40, cx + 7, B - 30); g.bezierCurveTo(cx + 11, B - 20, cx + 10, B - 8, cx + 9, B); g.quadraticCurveTo(cx, B + 6, cx - 10, B); },
      function (g) { g.moveTo(cx - 11, B); g.bezierCurveTo(cx - 12, B - 18, cx - 8, B - 34, cx - 4, B - 50); g.bezierCurveTo(cx - 2, B - 40, cx + 1, B - 34, cx + 2, B - 30);
        g.bezierCurveTo(cx + 4, B - 36, cx + 7, B - 40, cx + 9, B - 44); g.bezierCurveTo(cx + 8, B - 30, cx + 12, B - 16, cx + 11, B); g.quadraticCurveTo(cx, B + 6, cx - 11, B); },
      function (g) { g.moveTo(cx - 6, B); g.bezierCurveTo(cx - 8, B - 20, cx - 1, B - 30, cx - 4, B - 44); g.bezierCurveTo(cx - 6, B - 52, cx - 3, B - 58, cx + 1, B - 60);
        g.bezierCurveTo(cx + 1, B - 52, cx + 2, B - 46, cx + 4, B - 38); g.bezierCurveTo(cx + 7, B - 26, cx + 7, B - 12, cx + 6, B); g.quadraticCurveTo(cx, B + 4, cx - 6, B); },
      function (g) { g.moveTo(cx - 13, B); g.bezierCurveTo(cx - 13, B - 8, cx - 10, B - 16, cx - 8, B - 24); g.bezierCurveTo(cx - 7, B - 18, cx - 5, B - 15, cx - 4, B - 14);   // taç: dipte birleşik 3 kısa sivri dil
        g.bezierCurveTo(cx - 3, B - 20, cx - 1, B - 26, cx, B - 31); g.bezierCurveTo(cx + 1, B - 25, cx + 3, B - 18, cx + 4, B - 14);
        g.bezierCurveTo(cx + 5, B - 15, cx + 7, B - 18, cx + 8, B - 23); g.bezierCurveTo(cx + 10, B - 15, cx + 13, B - 8, cx + 13, B); g.quadraticCurveTo(cx, B + 5, cx - 13, B); }
    ];
    var renk = alevRenkleri[tur] || alevRenkleri.mesale;
    var TON = [[1, 1, renk[0]], [.78, .79, renk[1]], [.49, .56, renk[2]], [.26, .33, renk[3]]];
    var atlas = D.alev[tur] = [];
    for (var v = 0; v < YOL.length; v++) (function (yol) {
      atlas.push(tuval(28, 66, function (g) {
        if (tur === 'ayaz') { ayazAlevGolge(g, cx, B, yol); return; }
        for (var t = 0; t < TON.length; t++) {
          g.save(); g.translate(cx, B); g.scale(TON[t][0], TON[t][1]); g.translate(-cx, -B);
          g.beginPath(); yol(g); g.closePath(); g.fillStyle = TON[t][2]; g.fill();
          if (!t) { g.lineWidth = 1.3; g.strokeStyle = 'rgba(52,12,4,0.9)'; g.stroke(); }   // ince koyu kızıl-kahve mürekkep kontur
          g.restore();
        }
      }));
    })(YOL[v]);
    return atlas;
  }
  function alevSprite(ust) {
    var s = new PIXI.Sprite(alevDokulari()[0]); s.anchor.set(0.5, 0.94); s.visible = false; s._alev = true; ust.addChild(s); return s;
  }
  function mesaleAlevi(mesale, x, y, boyCarpani, ayaz) {
    var dokular = alevDokulari(ayaz ? 'ayaz' : 'mesale'), diller = [];
    var boy = mesale.texture.height / 66 * (boyCarpani || 1), kisa = boy * .74;
    var faz = mesale.x * .014 + mesale.y * .019;
    for (var i = 0; i < 3; i++) {
      var dil = alevSprite(mesale);
      dil.texture = dokular[[0, 2, 3][i]];
      dil.visible = true;
      diller.push(dil);
    }
    return function (t, azalt) {
      if (azalt && mesale.alevSonT == null) mesale.alevSonT = t;
      var canli = azalt ? Math.max(.03, 1 - (t - mesale.alevSonT) * 2.1) : 1;
      if (!azalt) mesale.alevSonT = null;
      var ritim = t * 7.5 + faz;
      for (var j = 0; j < diller.length; j++) diller[j].alpha = canli;
      diller[0].position.set(x - boy * 1.20, y);
      diller[0].scale.set(boy * .24, kisa * (.27 + Math.sin(ritim) * .038));
      diller[0].skew.x = -.16 + Math.sin(ritim * .64) * .13;
      diller[1].position.set(x + boy * .72, y);
      diller[1].scale.set(-boy * .29, kisa * (.37 + Math.sin(ritim * 1.27 + 1.2) * .044));
      diller[1].skew.x = .12 + Math.sin(ritim * .82) * .14;
      diller[2].position.set(x, y + boy * .56);
      diller[2].scale.set(boy * .34, kisa * (.32 + Math.sin(ritim * .89 + 2.2) * .035));
    };
  }
  function yagRf(y, a) { var k = y.sek; return 1 + k[0] * Math.sin(k[3] * a + k[4]) + k[1] * Math.sin((k[3] + 3) * a + k[5]) + k[2] * Math.sin(2 * a + k[6]); }
  function lekePoli(g, y, R, cx, cy, n, sap) {   // loblu leke çokgeni (yer düzleminde basık)
    var pts = [];
    for (var i = 0; i < n; i++) { var a = i / n * PI2, q = R * yagRf(y, a + sap); pts.push(cx + Math.cos(a) * q, cy + Math.sin(a) * q * y.b); }
    g.drawPolygon(pts);
  }
  function damlaPoli(g, cx, cy, R, b, rn) {
    var pts = []; for (var i = 0; i < 8; i++) { var a = i / 8 * PI2, q = R * (0.75 + 0.45 * rn()); pts.push(cx + Math.cos(a) * q, cy + Math.sin(a) * q * b); }
    g.drawPolygon(pts);
  }
  function yagCiz(y) {
    var R0 = y.r, b = y.b, g = y.g0, h = y.g1, i, a, d, rn = tohumlu(y.tohum);
    y.sek = [0.07 + 0.07 * rn(), 0.03 + 0.04 * rn(), 0.03 + 0.05 * rn(), 5 + ((rn() * 3) | 0), rn() * PI2, rn() * PI2, rn() * PI2];
    g.clear(); h.clear();
    // kenardan dışarı sıçramış damlacıklar (koyu yağ)
    var nd = 7 + ((rn() * 5) | 0);
    for (i = 0; i < nd; i++) {
      a = rn() * PI2; d = R0 * yagRf(y, a) * (1.06 + 0.32 * rn());
      g.beginFill(0x140a05, 0.85); damlaPoli(g, Math.cos(a) * d, Math.sin(a) * d * b, R0 * (0.035 + 0.05 * rn()), b, rn); g.endFill();
    }
    // koyu parlak yağ lekesi + içi kavrulmuş
    g.beginFill(0x110703, 0.88); lekePoli(g, y, R0 * 1.05, 0, 0, 44, 0); g.endFill();
    g.beginFill(0x2e0f05, 0.9); lekePoli(g, y, R0 * 0.86, 0, 0, 40, 0.15); g.endFill();
    for (i = 0; i < 3; i++) { a = rn() * PI2; d = R0 * 0.5 * rn();   // yağın ıslak parıltısı (ince açık lekeler)
      g.beginFill(0x6a3a1e, 0.35); damlaPoli(g, Math.cos(a) * d, Math.sin(a) * d * b, R0 * (0.05 + 0.04 * rn()), b * 0.6, rn); g.endFill(); }
    // yanan yağ (eklemeli, titrer): sıcak loblu katman + düzensiz sıcak yamalar
    h.beginFill(0x881d08, 0.62); lekePoli(h, y, R0 * 0.78, 0, 0, 36, 0.3); h.endFill();
    for (i = 0; i < 6; i++) { a = rn() * PI2; d = R0 * Math.sqrt(rn()) * 0.6;
      h.beginFill(i % 2 ? 0xa83a0c : 0xd0560e, 0.32); damlaPoli(h, Math.cos(a) * d, Math.sin(a) * d * b, R0 * (0.1 + 0.12 * rn()), b, rn); h.endFill(); }
    // alev dilleri: kenarda kısa, ortada uzun; kenardakiler lekenin loblarını izler
    // Thin ember veins stay on the ground beneath the low flames.
    var damarRast = tohumlu(y.tohum + 824);
    for (i = 0; i < 7; i++) {
      a = i * PI2 / 7 + damarRast() * .3;
      d = R0 * (.60 + damarRast() * .23);
      h.lineStyle(2.1, 0xee612a, .72);
      h.moveTo(Math.cos(a) * R0 * .12, Math.sin(a) * R0 * .12 * b);
      h.lineTo(Math.cos(a - .17) * d * .44, Math.sin(a - .17) * d * .44 * b);
      h.lineTo(Math.cos(a + .11) * d * .74, Math.sin(a + .11) * d * .74 * b);
      h.lineTo(Math.cos(a) * d, Math.sin(a) * d * b);
      h.lineStyle(0);
    }
    var DK = alevDokulari('koz');
    for (i = 0; i < ALEV_N; i++) {
      var f = y.alev[i], kenar = i < 12;
      a = kenar ? (i / 12) * PI2 + (rn() - 0.5) * 0.4 : rn() * PI2;
      d = kenar ? 0.68 + 0.22 * rn() : 0.6 * Math.sqrt(rn());
      f._a = a; f._d = d * yagRf(y, a);
      f._boy = (kenar ? 0.5 + 0.28 * rn() : 1.35 - 0.6 * d / 0.6 + 0.35 * rn()) * (R0 / 70) * .57;
      f._en = (kenar ? 1.15 + 0.35 * rn() : 0.85 + 0.35 * rn()) * Math.min(1.1, 0.75 + 0.35 * R0 / 70);   // kenar dilleri geniş: dipte birleşip kesintisiz taban
      f._f = 3.2 + 2.6 * rn(); f._ph = rn() * PI2; f._sira = rn(); f._rot = (rn() - 0.5) * (kenar ? 0.12 : 0.42); f._kenar = kenar;   // kenarda ±3°, ortada ±12°
      f.texture = DK[kenar ? (rn() < 0.6 ? 3 : 0) : [0, 1, 2, 2][(rn() * 4) | 0]]; f.scale.x = f._en * 1.26 * (rn() < 0.5 ? -1 : 1);
    }
  }
  function yagEtkin(y) { var kal = y.sure - y.t; return kal >= 1 ? 1 : 0.35 + 0.65 * Math.max(0, kal); }   // dusman.js atesEtkinR ile aynı
  function onAtesYak(v) {
    if (!kur()) return;
    var y = yagYuva();
    y.aktif = true; y.id = v.id; y.x = v.x; y.y = v.y; y.r = v.r || 70; y.b = v.basik || 0.55; y.sure = v.sure || 4.5; y.t = 0; y.alevT = 0; y.ani = r(0, 9);
    y.tohum = ((v.id || 0) * 7919 + Math.round(v.x * 13 + v.y * 7)) | 0;
    yagCiz(y);
    y.g0.visible = y.g1.visible = true; y.g0.x = y.g1.x = y.x; y.g0.y = y.g1.y = y.y; y.g0.alpha = 1;
    // tutuşma "vuff": parlama + yukarı kıvılcım + kısa duman
    parla(P, D.yumusak, v.x, v.y - 10, 0xff8a28, 0.6, 2.2 * y.r / 70, 0.3, 0.7);
    for (var j = 0; j < 14; j++) kivilcim(v.x + r(-y.r, y.r) * 0.6, v.y + r(-12, 12), r(4, 20), r(0, PI2), r(60, 220), sec([0xffb040, 0xff7a20, 0xffd070]), r(0.3, 0.6), 0.5, -0.12);
    isikPatla(v.x, v.y - 10, 0xff7a20, 200 * y.r / 70, 0.45, 1);
    if (v.patlama) {   // Yakıcının belindeki çömlekler: daha iri patlama, kara duman
      parla(P, D.halka, v.x, v.y - 20, 0xffa040, 0.2, 1.6, 0.35, 0.9, 0);
      for (j = 0; j < 22; j++) kivilcim(v.x, v.y, r(10, 40), r(0, PI2), r(160, 420), sec([0xffc050, 0xff6a18, 0xffe090]), r(0.35, 0.7), 0.6, 0.4);
      for (j = 0; j < 5; j++) bulut(v.x + r(-20, 20), v.y, r(20, 50), sec([0x1c1410, 0x2a1e18]), 0.6, r(1.6, 2.4), r(1.0, 1.6), 0.5, 0, r(-30, 30), r(-14, 6), r(40, 90));
      isikPatla(v.x, v.y - 20, 0xffa040, 300, 0.5, 1);
      sars(5, 0.18);
    }
  }
  function yagBitir(y) {
    if (!y.aktif) return;
    y.aktif = false; y.g0.visible = y.g1.visible = false;
    for (var i = 0; i < y.alev.length; i++) y.alev[i].visible = false;
    damga(yanikDoku(), y.x, y.y, r(-0.12, 0.12), y.r * 2.1 / 128, y.r * 2.1 / 128 * (y.b / 0.5625), 0x120a06, 0.62);   // kalıcı yanık izi
    for (var j = 0; j < 3; j++) bulut(y.x + r(-y.r, y.r) * 0.5, y.y + r(-8, 8), 10, 0x2a2420, 0.5, r(1.2, 1.8), r(1.2, 1.8), 0.32, 0, r(-8, 8), r(-6, 0), r(30, 60));
  }
  function onAtesSon(v) { if (!kur()) return; for (var i = 0; i < YAG.length; i++) if (YAG[i].aktif && YAG[i].id === v.id) { yagBitir(YAG[i]); return; } }
  function yagGuncelle(dt) {
    var n = 0, V = gorD(), pb = oyuncuKonum();
    if (pb && pb.canli === false) pb = null;
    for (var i = 0; i < YAG.length; i++) {
      var y = YAG[i]; if (!y.aktif) continue;
      y.t += dt; if (y.t >= y.sure + 0.05) { yagBitir(y); continue; }
      n++;
      var k = yagEtkin(y), kal = y.sure - y.t, tit = 0.82 + 0.1 * Math.sin(gT * 7.3 + y.ani) + 0.08 * Math.sin(gT * 13.1 + y.ani * 2);
      var ks = y.t < 0.2 ? 0.35 + 0.65 * (1 - Math.pow(1 - y.t / 0.2, 2)) : 1;   // çömlek kırılınca 0,2 sn'de dışa yayılır
      y.g0.scale.set(k * ks); y.g1.scale.set(k * ks); y.g1.alpha = tit * Math.min(1, kal * 1.5 + 0.2);
      var gorde = !(y.y < V.y - 120 || y.y > V.y + V.h + 160), R0 = y.r * k * ks;
      // alev dilleri (y sırasıyla): ortada uzun, kenarda kısa; yükselip alçalır, yalpalar; son 1 sn kısalıp tek tük kalır
      var sonK = kal < 1 ? Math.max(0, kal) : 1, buyu = y.t < 0.2 ? 0.5 + 0.5 * ks : (y.t < 0.45 ? 1 + 0.25 * Math.sin((y.t - 0.2) / 0.25 * Math.PI) : 1);
      var ruzgar = 0.12 + 0.06 * Math.sin(gT * 0.6 + y.ani), kop = dt > 0 && gorde && Math.random() < dt * 4 * sonK;   // hepsi hafif aynı yöne yatar
      for (var j = 0; j < y.alev.length; j++) {
        var f = y.alev[j];
        if (!gorde || f._sira > sonK * 0.95 + 0.05) { f.visible = false; continue; }
        var ph = gT * f._f + f._ph + y.ani, dd = f._d * R0;
        var hy = f._boy * buyu * (0.15 + 0.85 * sonK) * (0.74 + 0.17 * Math.sin(ph) + 0.09 * Math.sin(ph * 2.3 + 1.7));
        f.visible = true;
        f.x = y.x + Math.cos(f._a) * dd + Math.sin(ph * 0.7) * 1.2; f.y = y.y + Math.sin(f._a) * dd * y.b; f.zIndex = f.y;
        if (pb) { var bdx = Math.abs(f.x - pb.x), bdy = f.y - pb.y;   // barbarın hemen önündeki diller kısalır: ateşin içinde seçilsin
          if (bdx < 34 && bdy > -6 && bdy < 46) hy *= 0.35 + 0.65 * Math.max(bdx / 34, bdy / 46); }
        f.scale.y = hy; f.skew.x = 0.1 * Math.sin(ph * 0.55 + f._ph); var ro = f._rot + ruzgar * (f._kenar ? 0.3 : 1) + 0.04 * Math.sin(ph * 0.8), rm = f._kenar ? 0.087 : 0.35;   // alev yukarı bakar: kenar ±5°, orta ±20° (yatayla ≥ 70°)
        f.rotation = ro > rm ? rm : (ro < -rm ? -rm : ro);
        f.alpha = 1;
        if (kop && j >= 12 && hy > 0.7) {   // uçtan kopan küçük alev parçası (yukarı süzülüp söner)
          kop = false; var kp = P.al(KUL, f.texture, f.x + Math.sin(f.rotation) * 50 * hy, f.y, 46 * hy, r(0.3, 0.5));
          if (kp >= 0) { P.ek[kp] = 2; P.vx[kp] = r(-8, 8) + 20 * ruzgar; P.vy[kp] = 0; P.vz[kp] = r(70, 110); P.boy[kp] = r(0.22, 0.32); P.sayac[kp] = r(0, 6); P.renk[kp] = 0xffffff; P.sp[kp].tint = 0xffffff; }
        }
      }
      if (dt <= 0 || !gorde) continue;
      // korlar (yukarı süzülen tanecik) + seyrek kısa kıvılcım + ince koyu duman (alevlerin ÜSTÜNDEN, karakterin gövdesini örtmez)
      var hiz = (P.aktif / P.n > 0.6 ? 5 : 11) * k * sonK;
      y.alevT += dt * hiz;
      while (y.alevT >= 1) {
        y.alevT -= 1;
        var a = r(0, PI2), d = R0 * Math.sqrt(Math.random()) * 0.85, fx = y.x + Math.cos(a) * d, fy = y.y + Math.sin(a) * d * y.b;
        var ck = P.al(KUL, D.damla, fx, fy, r(18, 40), r(0.8, 1.4));
        if (ck >= 0) { P.ek[ck] = 2; P.vx[ck] = r(-18, 18); P.vy[ck] = r(-5, 5); P.vz[ck] = r(50, 110); P.boy[ck] = r(0.12, 0.2); P.sayac[ck] = r(0, 6); P.renk[ck] = sec([0xffd070, 0xffa040, 0xff7a20]); P.sp[ck].tint = P.renk[ck]; }
        if (Math.random() < 0.25) {
          var q = P.al(KIV, D.cizgi, fx, fy, r(20, 40), r(0.2, 0.35));
          if (q >= 0) { P.vx[q] = r(-10, 10); P.vy[q] = 0; P.vz[q] = r(120, 180); P.surt[q] = 1.4; P.yer[q] = -0.12; P.boy[q] = r(0.25, 0.4); P.renk[q] = sec([0xffa040, 0xffc860]); P.sp[q].tint = P.renk[q]; }
        }
        if (Math.random() < 0.14) bulut(fx, fy, r(70, 95), 0x241e1a, 0.25, r(0.7, 1.1), r(1.0, 1.5), 0.13, 0, r(-6, 6), r(-4, 0), r(30, 50));
      }
    }
    yagSonuc.n = n;
    // tutuşan barbar: omzunda/sırtında 3 küçük net alev dili (atılma söndürür → OYUNCU.tutusT okunur)
    var p = oyuncuKonum();
    if (!tutusAlev.length && OYUN.katman && OYUN.katman.varlik) for (var ti = 0; ti < 3; ti++) { tutusAlev.push(alevSprite(OYUN.katman.varlik)); tutusAlev[ti].texture = alevDokulari()[ti]; }
    var yan = !!(p && p.tutusT > 0 && p.canli !== false);
    var TO = [[-9, -52, 0.5], [7, -66, 0.62], [-2, -38, 0.42]];
    for (ti = 0; ti < tutusAlev.length; ti++) {
      var ta = tutusAlev[ti]; ta.visible = yan; if (!yan) continue;
      var tp = gT * (7 + ti) + ti * 2.1, bo = (p.boyOlcek || 1.1) / 1.1;
      ta.x = p.x + TO[ti][0] * bo; ta.y = p.y + TO[ti][1] * bo; ta.zIndex = p.y + 0.6;
      ta.scale.set(TO[ti][2] * 0.8 * (ti % 2 ? -1 : 1), TO[ti][2] * (0.8 + 0.2 * Math.sin(tp))); ta.skew.x = 0.15 * Math.sin(tp * 0.6);
    }
    if (yan && dt > 0) {
      tutusT_ += dt * 6;
      while (tutusT_ >= 1) {
        tutusT_ -= 1;
        var tq = P.al(KUL, D.damla, p.x + r(-12, 12), p.y + r(-3, 3), r(50, 80), r(0.5, 0.9));
        if (tq >= 0) { P.ek[tq] = 2; P.vx[tq] = r(-14, 14); P.vy[tq] = 0; P.vz[tq] = r(60, 110); P.boy[tq] = r(0.12, 0.18); P.sayac[tq] = r(0, 6); P.renk[tq] = sec([0xffa040, 0xffc860]); P.sp[tq].tint = P.renk[tq]; }
      }
      anlikIsik(p.x, p.y - 40, 0xff7a28, 110, 0.5);
    }
    comlekHedef();
  }
  // Çömlek havadayken düşeceği yer: düz turuncu halka yerine dönen kesik çizgili ince iz + büyüyen çömlek gölgesi.
  // Alt iz karakterlerin altında (zemin), ince üst iz karakterlerin üstünde (goblin kalabalığında da seçilsin).
  // dusman.js'in kendi düz elipsi (MERMI._uyari) çömlek için atlanır (yalnız görüntü; oynanış aynı).
  function comlekHedef() {
    var M = window.MERMI;
    if (!M || !M.liste) return;
    if (M._uyari && !M._uyari._efekt) {
      var esk = M._uyari, yeni = function (g) {
        var L = M.liste, sak = [], i;
        for (i = 0; i < L.length; i++) if (L[i] && L[i].tur === 'comlek' && L[i].yay) { sak.push(L[i], L[i].yay); L[i].yay = null; }
        try { esk(g); } finally { for (i = 0; i < sak.length; i += 2) sak[i].yay = sak[i + 1]; }
      };
      yeni._efekt = 1; M._uyari = yeni;
    }
    if (!TG) {
      TG = { a: new PIXI.Graphics(), b: new PIXI.Graphics() };
      OYUN.katman.golge.addChild(TG.a); OYUN.katman.efekt.addChild(TG.b);
    }
    var a = TG.a, b = TG.b; a.clear(); b.clear();
    var AT = (window.DUSMAN && DUSMAN.AYAR && DUSMAN.AYAR.ates) || { r: 70, basik: 0.55 }, CR = AT.r, CB = AT.basik, ND = 20;
    for (var i = 0; i < M.liste.length; i++) {
      var m = M.liste[i]; if (!m || m.olu || m.tur !== 'comlek' || !m.yay) continue;
      var k = Math.min(1, m.t / m.yay.sure), cx = m.yay.x1, cy = m.yay.y1, oy = m.sahip === 'oyuncu';
      var renk = oy ? 0xffd060 : 0xff7a1e, nab = 0.75 + 0.25 * Math.sin(gT * (8 + 10 * k)), don = gT * 0.9, R = CR * (0.9 + 0.1 * k);
      // düşecek çömleğin gölgesi (yaklaştıkça büyür, koyulaşır)
      a.beginFill(0x000000, 0.35 + 0.4 * k).drawEllipse(cx, cy, 8 + 12 * k, (8 + 12 * k) * 0.5).endFill();
      a.beginFill(renk, 0.04 + 0.06 * k); a.drawEllipse(cx, cy, R, R * CB); a.endFill();
      for (var s = 0; s < 4; s++) {   // her iz: koyu dış kontur + içte kemik-sarısı çizgi (kanlı zeminde de ayrışır); 0-1 alt, 2-3 üst (karakterlerin üstünde)
        var g = s < 2 ? a : b, ust = s >= 2, kont = !(s & 1), w = ust ? 2 : 3.6;
        if (kont) g.lineStyle(w + 3, 0x0a0705, (ust ? 0.5 + 0.3 * k : 0.7 + 0.25 * k) * nab);
        else g.lineStyle(w, oy ? 0xfff0a0 : 0xf2e2b4, (ust ? 0.55 + 0.35 * k : 0.75 + 0.25 * k) * nab);
        for (var j = 0; j < ND; j++) {
          var a0 = don + j / ND * PI2, a1 = a0 + PI2 / ND * 0.55;
          g.moveTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R * CB);
          g.lineTo(cx + Math.cos((a0 + a1) / 2) * R, cy + Math.sin((a0 + a1) / 2) * R * CB);
          g.lineTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R * CB);
        }
        g.lineStyle(0);
      }
    }
  }
  var tutusT_ = 0;
  function yagIsik(iki, yk) {   // haritaGuncelle'den: birikinti başına sıcak ışık
    if (!IH || !IH.yag) return;
    for (var i = 0, n = 0; i < IH.yag.length; i++) {
      var s = IH.yag[i], y = null;
      while (n < YAG.length && !y) { if (YAG[n].aktif) y = YAG[n]; n++; }
      if (!y) { s.visible = false; continue; }
      var k = yagEtkin(y), tit = atesTitresim(i + 7, 'ates');
      s.visible = true; s.x = y.x; s.y = y.y - 8; s.tint = iki ? 0xff6a1c : 0xff9a50;
      s.alpha = (iki ? AYAR.atesGuc * 2.0 : 0.85) * tit * Math.min(1, (y.sure - y.t) * 1.2 + 0.25);
      s.scale.set(y.r * 3.0 * k / 64);
    }
  }

  // ------------------------------------------------------------------ KAYIT
  var olaylar = {
    savur: onSavur, vurus: onVurus, olum: onOlum, blok: onBlok, sektir: onSektir, atil: onAtil, adim: onAdim,
    mermiVur: onMermiVur, ayazBuzKir: onAyazBuzKir, ayazBotBas: onAyazBotBas, ayazZincirKes: onAyazZincirKes, sifa: onSifa, devYereVur: onDevYereVur, devKaya: onDevKaya, devOldu: onDevOldu, skarnZeminTemas: onSkarnZeminTemas,
    oyuncuHasar: onOyuncuHasar,
    dusmanHasar: function (v) { hasarSayisiGoster(v.hedef, v.miktar, false); }, atesYak: onAtesYak, atesSon: onAtesSon,
    tutus: function (v) { if (kur() && v.x !== undefined) { parla(P, D.yumusak, v.x, v.y - 40, 0xff7a20, 0.4, 1.4, 0.25, 0.7); for (var j = 0; j < 8; j++) kivilcim(v.x, v.y, 40, r(0, PI2), r(60, 180), 0xffa040, r(0.2, 0.4), 0.5, -0.1); } },
    devKukre: function () { if (kur()) { try { if (window.DEV && DEV.aktif) kukreDalga(DEV, 3); } catch (e) {} } }, arena: function (v) { arenaKapali = v.acik === false; }, oyuncuOldu: onOyuncuOldu, ofke: onOfke, kasirga: onKasirga, baltaAt: onBaltaAt, baltaDondu: onBaltaDondu,
    varilPatla: onVarilPatla, kozYan: onKozYan, totemKir: onTotemKir
  };
  var simdi = (window.performance && performance.now) ? function () { return performance.now(); } : function () { return Date.now(); };
  function guvenli(fn) { return function (v) { var t0 = simdi(); try {
    v = v || {};
    if ((v.x !== undefined && !isFinite(v.x)) || (v.y !== undefined && !isFinite(v.y))) return;   // NaN konum: efekt çizme (leke dokusu bozulmasın)
    if (v.aci !== undefined && !isFinite(v.aci)) v.aci = 0;
    fn(v); olcum.sonOlay = fn.name; } catch (e) { if (window.console) console.warn('efekt:', e); } olcum.son += simdi() - t0; }; }
  function olcumBitir() {   // herKare sonunda: bu karenin toplam efekt maliyeti (olaylar + guncelle + herKare)
    var m = olcum.son; olcum.son = 0; olcum.n++; olcum.top += m; if (m > olcum.en) { olcum.en = m; olcum.enAn = { kare: olcum.n, t: +gT.toFixed(2), son: olcum.sonOlay, N: N ? N.aktif : 0, g: +(olcum.gMs || 0).toFixed(1), h: +(olcum.hMs || 0).toFixed(1) }; }
    if (m > 6 && olcum.n > 1) { olcum.agir = olcum.agir || []; if (olcum.agir.length < 40) olcum.agir.push([olcum.n, +m.toFixed(1), +(olcum.gMs || 0).toFixed(1), +(olcum.hMs || 0).toFixed(1), olcum.sonOlay, N ? N.aktif : 0]); }
    olcum.gMs = 0; olcum.hMs = 0;
    olcum.sonOlay = null;
    olcum.pencere = (olcum.pencere || []); olcum.pencere.push(m); if (olcum.pencere.length > 240) olcum.pencere.shift();
  }

  window.EFEKT = {
    AYAR: AYAR,
    mesaleAlevi: mesaleAlevi,
    bilgi: function () { return { normal: N ? N.aktif : 0, parlak: P ? P.aktif : 0, damga: istatistik.damga, kayip: damgaKayip, vurus: istatistik.vurus, olum: istatistik.olum, gecici: gecici.length, rontgen: KH ? Math.round(KH.ortu * 100) / 100 : null, halka: halkaOnbellek.size, havuzN: N ? N.n : 0, havuzP: P ? P.n : 0 }; },
    turlar: function () {   // havuzlarda türe göre canlı parçacık (1 damla 2 bulut 3 kıvılcım 4 parça 5 kül 6 sabit 7 taş)
      function say(H) { var o = {}; if (H) for (var i = 0; i < H.n; i++) if (H.canli[i]) o[H.tur[i]] = (o[H.tur[i]] || 0) + 1; return o; }
      return { N: say(N), P: say(P) };
    },
    olcum: function (sifirla) {   // efekt maliyeti ms/kare: ort, en, son 240 karenin %95'i
      var pz = (olcum.pencere || []).slice().sort(function (a, b) { return a - b; });
      var o = { enAn: olcum.enAn, agir: olcum.agir, kare: olcum.n, ort: olcum.n ? +(olcum.top / olcum.n).toFixed(3) : 0, en: +olcum.en.toFixed(3), p95: pz.length ? +pz[Math.floor(pz.length * 0.95)].toFixed(3) : 0 };
      if (sifirla) { olcum.n = 0; olcum.top = 0; olcum.en = 0; olcum.pencere = []; }
      return o;
    },
    damga: function (doku, x, y, rot, sx, sy, renk, alfa) { if (kur()) damga(doku, x, y, rot, sx, sy, renk, alfa); }
  };

  if (window.OLAY && OLAY.on) {
    for (var ad in olaylar) OLAY.on(ad, guvenli(olaylar[ad]));
    OLAY.on('bolum', guvenli(onBolum));
  }
  if (window.OYUN && OYUN.sistem) {
    OYUN.sistem('efekt', {
      baslat: function () { try { kur(); } catch (e) { console.warn('efekt baslat:', e); } },
      guncelle: function (dt) { var t0 = simdi(); try { guncelle(dt); } catch (e) { if (!EFEKT._hata) { EFEKT._hata = 1; console.warn('efekt guncelle:', e); } } var d_ = simdi() - t0; olcum.son += d_; olcum.gMs = (olcum.gMs || 0) + d_; },
      herKare: function (gd) { var t0 = simdi(); try { herKare(gd); } catch (e) { if (!EFEKT._hata2) { EFEKT._hata2 = 1; console.warn('efekt herKare:', e); } } var d_ = simdi() - t0; olcum.son += d_; olcum.hMs = d_; olcumBitir(); },
      sifirla: function () { try { sifirla(); } catch (e) { console.warn('efekt sifirla:', e); } }
    });
  }
})();
