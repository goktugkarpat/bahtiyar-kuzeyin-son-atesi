/* ses.js — SES: WebAudio ile kodla üretilen bütün sesler (dosya yok, seslendirme yok).
 *
 * Yalnız OLAY'ları dinler. Dışarıya açık:
 *   SES.ac()                       ilk dokunuşta kendiliğinden çağrılır (arayüz de çağırabilir)
 *   SES.cal(ad, veri)              ör. SES.cal('tik')
 *   SES.ayar({ana, efekt, muzik})  0..1
 *   SES.sus(b?)                    b yoksa aç/kapa; SES.acik
 *   SES.cizdir(ad, veri, sec)      OfflineAudioContext ile belleğe işler → Promise<{sure, tepe, rms, spektrumOzet, …}>
 *                                  ad: ses adı | 'ortam' | 'muzik:sakin|savas|dev'; sec: {adet, sikl (çalış/sn), sure, ham, sinirsiz, tohum}
 *   SES.cizdirSira(liste|'karma', sec)  [[t, ad, veri], …] karışımını işler ('karma' = 6 sn ~25 olay/sn + savaş müziği)
 *   SES.kayit(sn) / SES.kayitBitir()    gerçek oyunun olaylarını OfflineAudioContext'e kaydedip ölçer
 * ?sessiz iken AudioContext HİÇ kurulmaz; SES.cizdir yine çalışır (donanıma ses gitmez).
 * 19 Kasım: vuruş sesi MALZEMEYE göre (malzeme(v): et-kucuk goblin / et-iri okçu-şaman / zirh kalkanlı / dev), blok = ahşap+demir kalkan,
 *   sektirme TÜRE göre (ok "TİNK", büyü "vvVUMM"+kristal+yükselen vınlama, kaya "KRAK"+moloz). Düzeyler AYAR.darbe.{etKemik, ahsap,
 *   kalkanDemir, zirh, zirhEt, devTas, devKemik, sekOk, sekBuyu, sekKaya}. Test sayacı: SES._sayac.
 * 5. tur: vuruşlar dolgun "GÜM" (govde/slak), kalkan/zırh/sektirme çınlayan "ÇANG-GÜM" (cang); ölçüme sure40 + zarf30 eklendi.
 * 4. tur: vuruşlara 1,5–5 kHz ıslak "çat" katmanı (islak/kemik), isabet savurma "vuuş"unu kısar (sustur),
 *   ağır efektte müzik kısa süre geri çekilir (CEKIL), müzik dövüş yoğunluğuna göre tel ostinatosu ekler,
 *   devin sopa/kükreme/adım sesleri DEV.durum + yürüme karesinden (olay gelirse olaydan) çalınır.
 */
(function () {
  'use strict';

  // ───────────────────────── AYAR ─────────────────────────
  // ses başına: g = kazanç, sinir = aynı anda en çok, aralik = aynı türden iki çalış arası en az (sn),
  // enUzun = süre sınırı (sn), yanki = yankıya gönderme, perde = rastgele perde farkı (±oran), kalabalik = eşzamanlı çalarken kısma
  var AYAR = {
    ana: 0.8, efekt: 1.0, muzik: 0.29, ortam: 0.32,
    enCokSes: 26,                       // bütün efektler toplamı
    kalabalik: 0.35,
    // 20 Kasım (SES2): tek ortak "köy meydanı" yankısı: kısa yoğun oda (−20 dB ≈ 0,35 sn) + çok kısık uzak kuyruk
    yanki: { sure: 1.3, sonum: 6.4, uzak: 0.1, uzakSonum: 2.6, donus: 0.6 },
    komp: { esik: -8, diz: 8, oran: 6, atak: 0.004, birak: 0.14, cikis: 0.85 },   // transient'leri koruyan yumuşak miksaj
    mesafe: { yakin: 180, uzak: 1100, enAz: 0.5 },
    pan: 0.7,
    kisma: { mola: 0.25, oldu: 0.35, baslik: 0.7 },
    ses: {
      savur:       { g: 0.78, sinir: 3, aralik: 0.05, enUzun: 0.65, yanki: 0.10, perde: 0.06 },
      vur:         { g: 0.78, sinir: 3, aralik: 0.05, enUzun: 0.65, yanki: 0.10, perde: 0.06 },
      vur3:        { g: 0.86, sinir: 2, aralik: 0.06, enUzun: 0.72, yanki: 0.14, perde: 0.05 },
      vurus:       { g: 0.78, sinir: 4, aralik: 0.022, enUzun: 0.85, yanki: 0.2,  perde: 0.08 },
      blok:        { g: 0.72, sinir: 3, aralik: 0.04, enUzun: 0.75, yanki: 0.22, perde: 0.05 },
      kalkanKir:   { g: 0.80, sinir: 2, aralik: 0.05, enUzun: 0.78, yanki: 0.24, perde: 0.04 },
      sektir:      { g: 0.70, sinir: 3, aralik: 0.04, enUzun: 0.8,  yanki: 0.25, perde: 0.05 },
      sekti:       { g: 0.70, sinir: 3, aralik: 0.04, enUzun: 0.8,  yanki: 0.25, perde: 0.05 },
      olum:        { g: 0.7,  sinir: 3, aralik: 0.06, enUzun: 1.1,  yanki: 0.18, perde: 0.1 },
      oyuncuHasar: { g: 0.64, sinir: 2, aralik: 0.12, enUzun: 0.55, yanki: 0.1,  perde: 0.06 },
      atil:        { g: 0.82, sinir: 1, aralik: 0.1,  enUzun: 0.5,  yanki: 0.08, perde: 0.05 },
      baltaAt:     { g: 0.82, sinir: 1, aralik: 0.1,  enUzun: 1.8,  yanki: 0.1,  perde: 0.04 },
      baltaDondu:  { g: 0.78, sinir: 1, aralik: 0.1,  enUzun: 0.45, yanki: 0.1,  perde: 0.05 },
      baltaCagir:  { g: 0.72, sinir: 1, aralik: 0.1,  enUzun: 1.0,  yanki: 0.1,  perde: 0.03 },
      adim:        { g: 0.28, sinir: 2, aralik: 0.24, enUzun: 0.22, yanki: 0.0,  perde: 0.12 },
      mermi:       { g: 0.52, sinir: 4, aralik: 0.05, enUzun: 0.8,  yanki: 0.1,  perde: 0.08 },
      mermiVur:    { g: 0.5,  sinir: 4, aralik: 0.04, enUzun: 0.6,  yanki: 0.12, perde: 0.08 },
      sifa:        { g: 0.58, sinir: 2, aralik: 0.3,  enUzun: 1.8,  yanki: 0.5,  perde: 0.04 },
      ofke:        { g: 3.45, sinir: 1, aralik: 0.5,  enUzun: 2.2, yanki: 0, perde: 0 },
      kasirga:     { g: 0.88, sinir: 2, aralik: 0.19, enUzun: 0.28, yanki: 0.035, perde: 0.03 },
      dalga:       { g: 0.6,  sinir: 1, aralik: 1.0,  enUzun: 2.8,  yanki: 0.6,  perde: 0.02 },
      arena:       { g: 0.65, sinir: 1, aralik: 0.5,  enUzun: 2.0,  yanki: 0.45, perde: 0.02 },
      devBasla:    { g: 0.65, sinir: 1, aralik: 1.0,  enUzun: 3.2,  yanki: 0.35, perde: 0.02 },
      devYereVur:  { g: 0.68, sinir: 2, aralik: 0.2,  enUzun: 1.9,  yanki: 0.3,  perde: 0.05 },
      devKaya:     { g: 0.72, sinir: 2, aralik: 0.2,  enUzun: 0.8,  yanki: 0.2,  perde: 0.05 },
      devAdim:     { g: 0.62, sinir: 2, aralik: 0.16, enUzun: 0.34, yanki: 0.08, perde: 0.05 },
      devKukre:    { g: 0.66, sinir: 1, aralik: 0.8,  enUzun: 1.6,  yanki: 0.3,  perde: 0.03 },
      devSopa:     { g: 0.74, sinir: 2, aralik: 0.2,  enUzun: 0.8,  yanki: 0.22, perde: 0.05 },
      devOldu:     { g: 0.62, sinir: 1, aralik: 1.0,  enUzun: 2.4,  yanki: 0.35, perde: 0.02 },
      oyuncuOldu:  { g: 0.8,  sinir: 1, aralik: 1.0,  enUzun: 3.4,  yanki: 0.4,  perde: 0.0 },
      kazandi:     { g: 0.62, sinir: 1, aralik: 1.0,  enUzun: 3.0,  yanki: 0.4,  perde: 0.0 },
      tik:         { g: 0.75, sinir: 2, aralik: 0.03, enUzun: 0.1,  yanki: 0.0,  perde: 0.04 },
      topla:       { g: 0.65, sinir: 2, aralik: 0.08, enUzun: 0.7,  yanki: 0.22, perde: 0.05 },
      kalp:        { g: 0.42, sinir: 1, aralik: 0.3,  enUzun: 0.4,  yanki: 0.05, perde: 0.0 },
      atesYak:     { g: 0.66, sinir: 3, aralik: 0.06, enUzun: 1.4,  yanki: 0.18, perde: 0.06 },   // Yakıcı: tutuşma "vuff" / ölüm patlaması
      tutus:       { g: 0.6,  sinir: 1, aralik: 0.2,  enUzun: 0.7,  yanki: 0.1,  perde: 0.05 },   // meşale vuruşu + barbar tutuştu
      citirti:     { g: 0.3,  sinir: 3, aralik: 0.05, enUzun: 0.25, yanki: 0.04, perde: 0.15 },   // ateş birikintisi varken kısık çıtırtı
      varilPatla:  { g: 0.84, sinir: 3, aralik: 0.08, enUzun: 1.5,  yanki: 0.24, perde: 0.06 },   // Bölüm II: yağ varili patlaması
      totemKir:    { g: 0.78, sinir: 2, aralik: 0.08, enUzun: 1.4,  yanki: 0.36, perde: 0.05 },   // Bölüm II: kor totemi kırılması
      kozYan:      { g: 0.42, sinir: 2, aralik: 0.18, enUzun: 0.28, yanki: 0.06, perde: 0.12 },   // Bölüm II: köz çukuru cızırtısı
      ayazBuzKir:  { g: 0.60, sinir: 2, aralik: 0.13, enUzun: 0.88, yanki: 0.16, perde: 0.08 },
      skarnZincir:  { g: 0.66, sinir: 2, aralik: 0.11, enUzun: 0.90, yanki: 0.21, perde: 0.05 },
      skarnZeminTemas: { g: 0.19, sinir: 1, aralik: 1.7, enUzun: 0.25, yanki: 0.025, perde: 0.03, yakinPan: 315, duyma: 430 },
      ayazZincirKes: { g: 0.66 * 0.6, sinir: 2, aralik: 0.12, enUzun: 0.84, yanki: 0.15, perde: 0.06 },
      ayazKurtHazir: { g: 0.64, sinir: 2, aralik: 0.18, enUzun: 0.40, yanki: 0.035, perde: 0.07, yakinPan: 185 },
      ayazBotBas: { g: 0.12, sinir: 1, aralik: 0.24, enUzun: 0.13, yanki: 0, perde: 0.12, yakinPan: 260, duyma: 260 }
    },
    // 5. tur dolgun darbe katmanları (bkz. govde/slak/cang): ham kazançlar
    darbe: {
      govde: 1.0, et: 2.2, kuyruk: 2.4, slak: 3.0,
      metal: { g: 0.95, d: 0.5, patla: 1.1,
        f:   [310, 470, 730, 1180, 1900],      // uyumsuz kısmiler (Hz), her çalışta ±%3 oynar
        amp: [1, 0.8, 0.6, 0.38, 0.22],
        son: [1, 0.85, 0.62, 0.45, 0.3] },     // kısmi başına sönüm (d ile çarpılır)
      // 19 Kasım: malzemeye göre vuruş/sektirme katmanları (ham kazanç çarpanları; 0 = o katman yok)
      etKemik: 1.0,       // zırhsız et vuruşundaki kısa kemik çıtırtısı (goblin, okçu, şaman)
      ahsap: 1.0,         // kalkana gelen vuruşta ahşap "TOK"
      kalkanDemir: 1.0,   // kalkanın demir kuşak çınlaması (kısa)
      zirh: 1.0,          // zırhlı gövdeye (kalkanlı ork yandan/arkadan) metal "ÇANG"
      zirhEt: 1.0,        // zırhın altındaki boğuk et darbesi
      demir: 1.0,         // İnfazcı ağır çelik zırh çınlaması
      deri: 1.0,          // İnfazcı zırhsız/kırılmış zırh tok et/deri darbesi
      baskinci: 1.0,      // Baskıncı çevik deri/et darbesi
      vargor: 1.0,        // Vargor ağır ocak-demir boss darbesi
      devTas: 1.0,        // devin taş gibi kalın derisi "GÜMM" katmanı
      devKemik: 1.0,      // devin kemik kuşağı takırtısı (ara sıra)
      sekOk: 1.0, sekBuyu: 1.0, sekKaya: 1.0,  // sektirme türleri (ok "TİNK", büyü "vvVUMM", kaya "KRAK")
      kesme: 1.0,         // balta okçu/şaman/dev saldırısını kesince "kesildi" vurgusu (yay kirişi / büyü sönmesi / dev çöküşü)
      // 19 Kasım Yakıcı (ham kazanç çarpanları; 0 = o katman yok)
      hup: 1.0,           // çömlek fırlatma: kısa ork homurtusu + hava
      kirilma: 1.0,       // kil çömlek kırılması (kuru çıtırtı + tok)
      vuff: 1.0,          // yağın tutuşması: alçak hava emişi + alev gürlemesi
      citirti: 1.0,       // birikinti varken çıtırtı yoğunluğu (0 = döngü kapalı)
      mesale: 1.0,        // meşale vuruşu: alev savruluşu + cızırtı
      yanma: 1.0,         // barbar yanarken her tıkta kısık cızırtı (vuruş "GÜM"ü yerine)
      patlama: 1.0,       // Yakıcı ölüm patlaması: tok gümleme + saçılan çıtırtı
      // 20 Kasım (SES2) katmanlı darbe: catla = ilk 2–8 ms "çat" · yumruk = 60–250 Hz gövde · doku = malzeme (et şlak / yarılma)
      catla: 1.0, yumruk: 1.0, doku: 1.0
    },
    // Metronom her bölüm ve durum için ayrı. Tempo dörtlük vuruş/dk olarak tutulur.
    muz: {
      sakin: { tempo: 76, drone: 0.22, dev: 0 },
      savas: { tempo: 106, drone: 0.18, dev: 0 },
      dev:   { tempo: 82, drone: 0.22, dev: 0.26 },
      yok:   { tempo: 76, drone: 0, dev: 0 }
    },
    // Kül Geçidi: 6/8, noktalı dörtlükte iki ana vuruş.
    muz2: {
      sakin: { tempo: 92, drone: 0.15, dev: 0 },
      savas: { tempo: 138, drone: 0.12, dev: 0 },
      dev:   { tempo: 114, drone: 0.17, dev: 0.19 },
      yok:   { tempo: 92, drone: 0, dev: 0 }
    },
    // Ayaz Hisarı: 5/4, soğuk nefesli/yaylı tını ve Skarn'ın ilerleyen evreleri.
    muz3: {
      sakin: { tempo: 85, drone: 0.11, dev: 0 },
      savas: { tempo: 119, drone: 0.11, dev: 0 },
      dev:   { tempo: 99, drone: 0.17, dev: 0.24 },
      yok:   { tempo: 85, drone: 0, dev: 0 }
    }
  };

  // ───────────────────────── yardımcılar ─────────────────────────
  var R = (function () {   // kendi rastgeleliğimiz: oyunun tohumlu OYUN.rast'ını bozmayalım
    var s = (Date.now() ^ 0x9e3779b9) >>> 0;
    function f() { s = (s + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
    f.tohum = function (n) { s = n >>> 0; };
    return f;
  })();
  function ra(a, b) { return a + (b - a) * R(); }
  function sin(v, a, b) { return v < a ? a : v > b ? b : v; }

  function bolumNo(v) {
    var n = v && typeof v === 'object' ? (v.bolum == null ? v.no : v.bolum) : v;
    return n === 1 || n === 2 || n === 3 ? n : null;
  }
  function oyunBolumu() { return bolumNo(window.OYUN && OYUN.bolum) || 1; }

  // parametre eğrisi: sayı ya da [[dt, değer], …] (üstel geçiş)
  function egri(p, t, nk) {
    if (typeof nk === 'number') { p.setValueAtTime(nk, t); return; }
    if (nk[0][0] > 0) p.setValueAtTime(nk[0][1], t);
    p.setValueAtTime(Math.max(nk[0][1], 1e-4), t + nk[0][0]);
    for (var i = 1; i < nk.length; i++) p.exponentialRampToValueAtTime(Math.max(nk[i][1], 1e-3), t + nk[i][0]);
  }
  // zarf: a (yükselme), tut, d (toplam), g; ya da nk = [[dt, g], …] doğrusal noktalar
  function zarf(m, t, s) {
    var n = m.c.createGain(), p = n.gain, g = s.g == null ? 1 : s.g, a = Math.max(s.a == null ? 0.003 : s.a, 0.0005), d = s.d, tut = s.tut || 0;
    p.setValueAtTime(0, t);
    if (s.nk) {
      for (var i = 0; i < s.nk.length; i++) p.linearRampToValueAtTime(s.nk[i][1] * g, t + Math.max(s.nk[i][0], 0.001));
      p.linearRampToValueAtTime(0, t + Math.max(d, 0.005));
      return n;
    }
    p.linearRampToValueAtTime(g, t + a);
    if (tut) p.setValueAtTime(g, t + a + tut);
    var son = Math.max(d, a + tut + 0.004);
    p.exponentialRampToValueAtTime(Math.max(g * 0.0008, 1e-5), t + son);
    p.linearRampToValueAtTime(0, t + son + 0.01);
    return n;
  }
  function suruc(m, o, k) {   // yumuşak doyurma (tanh): küçük hoparlörde de "tok" duyulsun
    var w = m.c.createWaveShaper(); w.curve = m.egriSuruc(k); w.oversample = '2x'; w.connect(o); return w;
  }
  // gürültü katmanı: {d, a, g, tut, nk, tip, f, q, tip2, f2, q2, renk:'kahve', hiz}
  function gurultu(m, o, t, s) {
    var c = m.c, src = c.createBufferSource();
    src.buffer = s.renk === 'kahve' ? m.kahve : m.beyaz; src.loop = true;
    if (s.hiz) src.playbackRate.value = s.hiz;
    var son = src, fl = [[s.tip || 'bandpass', s.f, s.q], [s.tip2, s.f2, s.q2]];
    for (var i = 0; i < 2; i++) {
      var x = fl[i]; if (!x[0] || x[1] == null) continue;
      var b = c.createBiquadFilter(); b.type = x[0]; egri(b.frequency, t, x[1]); if (x[2] != null) b.Q.value = x[2];
      son.connect(b); son = b;
    }
    var z = zarf(m, t, s); son.connect(z); z.connect(s.suruc ? suruc(m, o, s.suruc) : o);
    src.start(t, R() * 1.5); src.stop(t + s.d + 0.05);
    return z;
  }
  // geçiş tıkı
  function tik(m, o, t, s) {
    return gurultu(m, o, t, { d: s.d || 0.004, a: 0.0004, g: s.g, tip: s.tip || 'highpass', f: s.f || 3000, q: s.q == null ? 0.7 : s.q });
  }
  // osilatör: {tip, f, d, a, g, tut, nk, det, lp, lpq, suruc, vib:[hz, derinlik]}
  function ton(m, o, t, s) {
    var c = m.c, os = c.createOscillator(); os.type = s.tip || 'sine'; egri(os.frequency, t, s.f);
    if (s.det) os.detune.value = s.det;
    if (s.vib) { var l = c.createOscillator(), lg = c.createGain(); l.frequency.value = s.vib[0]; lg.gain.value = s.vib[1]; l.connect(lg); lg.connect(os.frequency); l.start(t); l.stop(t + s.d + 0.05); }
    var son = os;
    if (s.lp) { var b = c.createBiquadFilter(); b.type = 'lowpass'; egri(b.frequency, t, s.lp); b.Q.value = s.lpq || 0.7; son.connect(b); son = b; }
    var z = zarf(m, t, s); son.connect(z); z.connect(s.suruc ? suruc(m, o, s.suruc) : o);
    os.start(t); os.stop(t + s.d + 0.05);
    return os;
  }
  // metal: uyumsuz kısmi sesler (çan/çınlama)
  function metal(m, o, t, s) {
    var or = s.oran || [1, 2.32, 4.25, 6.63, 9.38], amp = s.amp || [1, 0.7, 0.5, 0.35, 0.2], so = s.son || [1, 0.75, 0.55, 0.4, 0.3];
    for (var i = 0; i < or.length; i++) ton(m, o, t, { f: s.f * or[i] * ra(0.997, 1.003), d: s.d * (so[i] || 0.3), a: 0.001, g: s.g * (amp[i] || 0.2) });
  }
  // formant sesi (hırıltı/çığlık/kükreme): {f, d, a, g, tut, fm:[[f,q,g]…], titreme:[hz,derinlik], puruz:[hz,0..1], nefes, suruc, kay}
  function formant(m, o, t, s) {
    var c = m.c, d = s.d, dur = [];
    var k = c.createGain(); k.gain.value = 0.5;
    for (var j = 0; j < 2; j++) {
      var os = c.createOscillator(); os.type = s.kaynak || 'sawtooth'; egri(os.frequency, t, s.f);
      os.detune.value = j ? (s.kay == null ? 16 : s.kay) : 0; os.connect(k); dur.push(os);
      if (s.titreme) { var l = c.createOscillator(), lg = c.createGain(); l.frequency.value = s.titreme[0] * (j ? 1.13 : 1); lg.gain.value = s.titreme[1]; l.connect(lg); lg.connect(os.frequency); dur.push(l); }
    }
    var son = k;
    if (s.puruz) {   // genlik modülasyonu: boğaz pürüzü
      var am = c.createGain(); am.gain.value = 1 - s.puruz[1] * 0.5;
      var l2 = c.createOscillator(), lg2 = c.createGain(); l2.frequency.value = s.puruz[0]; lg2.gain.value = s.puruz[1] * 0.5;
      l2.connect(lg2); lg2.connect(am.gain); son.connect(am); son = am; dur.push(l2);
    }
    var z = zarf(m, t, s);
    for (var i = 0; i < s.fm.length; i++) {
      var f = s.fm[i], b = c.createBiquadFilter(), bg = c.createGain();
      b.type = 'bandpass'; egri(b.frequency, t, f[0]); b.Q.value = f[1]; bg.gain.value = f[2] * 3;
      son.connect(b); b.connect(bg); bg.connect(z);
    }
    z.connect(s.suruc ? suruc(m, o, s.suruc) : o);
    for (var n = 0; n < dur.length; n++) { dur[n].start(t); dur[n].stop(t + d + 0.05); }
    if (s.nefes) {
      var f0 = s.fm[0][0], ff = typeof f0 === 'number' ? f0 * 1.6 : f0[0][1] * 1.6;
      gurultu(m, o, t, { d: d, a: s.a, tut: s.tut, g: s.nefes, tip: 'bandpass', f: ff, q: 1.2 });
    }
  }
  // davul: alçak, deri tok
  function davul(m, o, t, f, g, uz) {
    uz = uz || 1;
    ton(m, o, t, { f: [[0, f * 1.9], [0.05, f], [0.5 * uz, f * 0.8]], d: 0.6 * uz, a: 0.002, g: g, suruc: 1.6 });
    gurultu(m, o, t, { d: 0.14, a: 0.001, g: g * 0.35, tip: 'lowpass', f: [[0, 900], [0.12, 180]], q: 1 });
  }
  // boru (savaş borusu / pirinç akor sesi)
  function boru(m, o, t, f, d, g, uzak) {
    for (var j = 0; j < 2; j++) {
      ton(m, o, t, {
        tip: 'sawtooth', f: [[0, f * 0.93], [0.22, f], [d, f * 0.985]], det: j ? 9 : -6, d: d, a: 0.22, tut: d * 0.45, g: g * 0.5,
        lp: [[0, 250], [0.3, uzak ? 750 : 1300], [d, 400]], lpq: 1.2
      });
    }
  }

  // dolgun alt-bas + alçak-orta gövde darbesi ("bom"): sert kare kırpma olmadan tok ağırlık
  function bom(m, o, t, s) {
    var d = s.d || 0.22, g = s.g == null ? 0.85 : s.g;
    ton(m, o, t, { f: [[0, s.f0 || 96], [d * 0.42, s.f1 || 42]], d: d, a: s.a || 0.002, g: g });
    if (s.mid0) {
      ton(m, o, t, { tip: 'triangle', f: [[0, s.mid0], [d * 0.45, s.mid1 || s.mid0 * 0.52]], d: d * 0.78, a: 0.002, g: s.midG == null ? g * 0.55 : s.midG, lp: s.lp || 480, lpq: 0.9, suruc: s.suruc || 1.25 });
    }
    if (s.bg) {
      gurultu(m, o, t, { d: d * 0.85, a: 0.002, g: s.bg, tip: 'lowpass', f: [[0, s.lp0 || 640], [d * 0.75, s.lp1 || 110]], q: 1.1, renk: 'kahve' });
    }
  }

  // ıslak şaplak / "çat" katmanı (1–5 kHz): küçük hoparlörde vuruşun duyulan yüzü. Çınlamaz: yalnız kısa süzülmüş gürültü.
  // s: {g, f (merkez Hz), n (ıslak kırıntı sayısı), yay (kırıntı yayılımı sn), tok (400–1500 Hz gövde kazancı), tokF, kuyruk (ıslak sönüm sn)}
  var ISLAK = { g: 3.6, tok: 2.6, kemik: 2.4, govde: 0.62 };   // ham gürültü kazancı (bant payını ölçerek ayarlandı)
  function islak(m, o, t, s) {
    var g = (s.g == null ? 0.5 : s.g) * ISLAK.g, f = s.f || 2400, i;
    // ilk "çat": geniş bant, hızla söner
    gurultu(m, o, t, { d: 0.034, a: 0.0004, g: g, tip: 'bandpass', f: [[0, f * 1.15], [0.03, f * 0.6]], q: 0.8 });
    // tok gövde (orta bant): küçük hoparlörde "güm" yerine duyulan kısım
    if (s.tok) gurultu(m, o, t + 0.002, { d: 0.08, a: 0.001, tut: 0.014, g: s.tok * ISLAK.tok, tip: 'bandpass', f: [[0, s.tokF || 900], [0.05, (s.tokF || 900) * 0.45]], q: 1.3 });
    // ıslak gövde: "çat"tan sonra 60–90 ms süren et şaplağı (üst-orta bandın asıl enerjisi)
    gurultu(m, o, t + 0.003, { d: s.govdeD || 0.11, a: 0.002, tut: 0.016, g: g * ISLAK.govde, tip: 'bandpass', f: [[0, f * 0.85], [s.govdeD || 0.11, f * 0.5]], q: 1.0 });
    // ıslak kırıntılar (şaplak sonrası et/kan)
    var n = s.n == null ? 3 : s.n, yay = s.yay || 0.045;
    for (i = 0; i < n; i++) {
      var tt = t + 0.006 + yay * Math.pow((i + ra(0.2, 0.9)) / Math.max(1, n), 1.25);
      gurultu(m, o, tt, { d: ra(0.016, 0.038), a: 0.0006, g: g * ra(0.35, 0.6) * (1 - i / (n + 2)), tip: 'bandpass', f: [[0, ra(1300, 3200)], [0.02, ra(700, 1300)]], q: ra(1.8, 3.2) });
    }
    // uzun ıslak sönüm (öldüren vuruş / parçalanma)
    if (s.kuyruk) gurultu(m, o, t + 0.01, { d: s.kuyruk, a: 0.006, g: g * 0.32, tip: 'lowpass', f: [[0, 2600], [s.kuyruk, 380]], q: 1.4, tip2: 'highpass', f2: 300, q2: 0.6 });
  }
  // kemik kırılması: art arda kuru çıtırtılar (orta+üst bant)
  function kemik(m, o, t, s) {
    var n = s.n || 4, g = (s.g || 0.3) * ISLAK.kemik;
    for (var i = 0; i < n; i++) {
      var tt = t + i * ra(0.011, 0.024);
      gurultu(m, o, tt, { d: ra(0.008, 0.016), a: 0.0004, g: g * ra(0.7, 1), tip: 'bandpass', f: ra(1700, 3600), q: ra(1.2, 2.2) });
      gurultu(m, o, tt, { d: 0.02, a: 0.0006, g: g * 0.6, tip: 'bandpass', f: ra(520, 900), q: 1.6 });
    }
  }
  // havayı yaran "vuuş": öne yüklü (tepe ~%25'te), orta bantta ince hava katmanı
  function vuus(m, o, t, s) {
    var d = s.d, k = s.k || 1, g = s.g || 0.6;
    gurultu(m, o, t, { d: d, a: d * 0.22, g: g, tip: 'lowpass', f: [[0, 160 * k], [d * 0.25, 520 * k], [d, 110]], q: 1.0, renk: 'kahve' });
    gurultu(m, o, t, { d: d * 0.9, a: d * 0.2, g: g * 0.55, tip: 'bandpass', f: [[0, 260 * k], [d * 0.26, 820 * k], [d * 0.9, 240 * k]], q: 1.2 });
    gurultu(m, o, t, { d: d * 0.6, a: d * 0.18, g: g * (s.hava == null ? 0.16 : s.hava), tip: 'bandpass', f: [[0, 900 * k], [d * 0.22, 1900 * k], [d * 0.6, 700 * k]], q: 1.6 });
  }

  // 5. tur: DOLGUN DARBE. Eski vuruşun −20 dB süresi ~0,1 sn, enerjisinin yarısı 120 Hz altındaydı (küçük hoparlör/iPad bunu çalamaz);
  // geriye yalnız 1,5–5 kHz "çat" kalıyordu → "tık". Yeni: enerji 120–600 Hz gövdeye taşındı, süre uzadı, metal çınlar.
  // govde: perde düşüşlü "GÜM" (f0→f1) + sürücüyle doyurulmuş üçgen gövde + et rezonansı (bant gürültü) + kısa oda kuyruğu
  // s: {f0, f1, d, g, et (Hz), etG, etD, kuyruk (sn), kG}
  function govde(m, o, t, s) {
    var D = AYAR.darbe, d = s.d || 0.24, g = (s.g == null ? 1 : s.g) * D.govde, f0 = s.f0 || 200, f1 = s.f1 || 70;
    // 1) perde düşüşlü alt darbe (sürücü 2.–3. harmoniği 150–450 Hz'e taşır: küçük hoparlörde de "GÜM")
    ton(m, o, t, { f: [[0, f0], [0.045, f1 * 1.35], [d * 0.7, f1]], d: d * 1.5, a: 0.0025, tut: d * 0.22, g: g * 0.66, suruc: 2.4 });
    // 2) alçak-orta gövde (üçgen, alçak geçiren): darbenin "kalınlığı"
    ton(m, o, t, { tip: 'triangle', f: [[0, f0 * 1.7], [0.06, f1 * 2.4], [d * 0.8, f1 * 2]], d: d * 1.2, a: 0.003, tut: d * 0.08, g: g * 0.7, lp: [[0, 900], [d * 0.8, 320]], lpq: 1.1, suruc: 1.6 });
    // 3) et/gövde rezonansı: 200–500 Hz bant gürültü, perdesi aşağı kayar
    var et = s.et || 320, etD = s.etD || d * 1.25;
    gurultu(m, o, t, { d: etD, a: 0.002, tut: 0.045, g: (s.etG == null ? 1 : s.etG) * g * D.et, tip: 'bandpass', f: [[0, et * 1.35], [etD, et * 0.6]], q: 1.4 });
    gurultu(m, o, t + 0.004, { d: etD * 0.7, a: 0.003, tut: 0.015, g: (s.etG == null ? 1 : s.etG) * g * D.et * 1.0, tip: 'bandpass', f: [[0, et * 2.2], [etD * 0.7, et * 1.2]], q: 2.0 });
    // 4) kısa oda/yer kuyruğu (yankıdan ayrı, kuru gövdeyi uzatır)
    if (s.kuyruk) gurultu(m, o, t + 0.015, { d: s.kuyruk, a: 0.02, g: (s.kG == null ? 1 : s.kG) * g * D.kuyruk, tip: 'lowpass', f: [[0, 1100], [s.kuyruk, 260]], q: 0.8, tip2: 'highpass', f2: 130, q2: 0.6 });
  }
  // ıslak "şlak": geniş bantlı, yumuşak başlangıçlı (sert tık değil), 15–40 ms; gövdeyle aynı anda başlar, ondan kısık
  function slak(m, o, t, s) {
    var g = (s.g == null ? 1 : s.g) * AYAR.darbe.slak, d = s.d || 0.034, f = s.f || 1100;
    gurultu(m, o, t, { d: d, a: 0.0025, g: g, tip: 'lowpass', f: [[0, f * 3], [d, f * 1.1]], q: 0.6, tip2: 'highpass', f2: 380, q2: 0.6 });
    gurultu(m, o, t + 0.006, { d: d * 1.6, a: 0.004, g: g * 0.7, tip: 'bandpass', f: [[0, f], [d * 1.6, f * 0.55]], q: 1.1 });   // ıslak sönüm
    var n = s.n || 0;
    for (var i = 0; i < n; i++) gurultu(m, o, t + 0.02 + i * ra(0.018, 0.034), { d: ra(0.02, 0.035), a: 0.002, g: g * ra(0.25, 0.4), tip: 'bandpass', f: [[0, ra(700, 1500)], [0.025, ra(350, 600)]], q: 1.6 });
  }
  // ağır çınlayan metal: uyumsuz kısmiler (her çalışta oynar) + vuruş anında hafif dövülme (iki yakın kopya → çırpıntı)
  // s: {g, d (en uzun kısmi sönümü), k (perde çarpanı), parlak (üst kısmi kazancı), alt (en alçak iki kısminin kazancı)}
  function cang(m, o, t, s) {
    var M = AYAR.darbe.metal, k = s.k || 1, g = (s.g == null ? 1 : s.g) * M.g, d = s.d || M.d, par = s.parlak == null ? 1 : s.parlak, alt = s.alt == null ? 1 : s.alt;
    if (!(g > 0)) return;
    for (var i = 0; i < M.f.length; i++) {
      var f = M.f[i] * k * ra(0.97, 1.03), dd = d * M.son[i] * ra(0.85, 1.1), gg = g * M.amp[i] * (i >= 3 ? par : i < 2 ? alt : 1);
      ton(m, o, t, { f: [[0, f * 1.012], [0.03, f]], d: dd, a: 0.0012, g: gg });
      if (i < 3) ton(m, o, t, { f: f * ra(1.004, 1.009), d: dd * 0.8, a: 0.0015, g: gg * 0.55 });   // çırpıntı: "çaaang"
    }
    // çarpma anının metalik gürültüsü (kısa, 1–3 kHz; tiz değil)
    gurultu(m, o, t, { d: 0.028, a: 0.0012, g: g * M.patla, tip: 'bandpass', f: [[0, 2600 * k], [0.025, 1300 * k]], q: 0.9 });
    gurultu(m, o, t + 0.003, { d: 0.09, a: 0.003, g: g * M.patla * 0.5, tip: 'bandpass', f: 900 * k, q: 3 });
  }

  // 19 Kasım: vurulan şeyin malzemesi. 'et-kucuk' goblin · 'et-iri' okçu/şaman/yakıcı · 'zirh' kalkanlı ork ·
  // 'demir' zırhlı infazcı · 'deri' zırhsız/zırhı kırılmış infazcı · 'baskinci' · 'vargor' · 'dev'
  function malzeme(v) {
    var h = v && v.hedef, tr = h && h.tur ? h.tur : '';
    if (tr === 'dev' || (h && window.DEV && h === window.DEV)) return 'dev';
    if (tr === 'vargor' || (h && window.VARGOR && h === window.VARGOR)) return 'vargor';
    if (tr === 'infazci') return ((h && h.zirh > 0) || (v && v.zirhli)) ? 'demir' : 'deri';
    if (tr === 'skarn') return 'demir';
    if (tr === 'kalkanli' || tr === 'buz_muhafiz') return 'zirh';
    if (tr === 'baskinci') return 'baskinci';
    if (tr === 'goblin' || tr === 'kircil_kurt') return 'et-kucuk';
    if (v && v.zirhli) return 'zirh';
    return 'et-iri';
  }
  // ahşap kalkan "TOK": tahta levhanın kısa, perdeli kipleri (190–900 Hz) + kuru vuruş gürültüsü. Çınlamaz, et yok.
  // s: {g, k (perde çarpanı), d (en uzun kip sönümü)}
  function ahsap(m, o, t, s) {
    var g = (s.g == null ? 1 : s.g) * AYAR.darbe.ahsap, k = s.k || 1, d = s.d || 0.3;
    if (!(g > 0)) return;
    var F = [196, 331, 547, 873], A = [1, 0.62, 0.4, 0.22], S = [1, 0.62, 0.42, 0.28];
    for (var i = 0; i < F.length; i++) {
      var f = F[i] * k * ra(0.97, 1.03);
      ton(m, o, t, { tip: i ? 'sine' : 'triangle', f: [[0, f * 1.06], [0.02, f]], d: d * S[i] * ra(0.9, 1.1), a: 0.0015, tut: 0.012, g: g * 1.25 * A[i], suruc: i ? 0 : 1.4 });
    }
    gurultu(m, o, t, { d: 0.05, a: 0.0012, g: g * 6, tip: 'bandpass', f: [[0, 1250 * k], [0.045, 560 * k]], q: 1.3 });       // "TOK"un kuru yüzü
    gurultu(m, o, t + 0.002, { d: 0.14, a: 0.003, tut: 0.01, g: g * 4, tip: 'bandpass', f: [[0, 460 * k], [0.12, 240 * k]], q: 2.2 });   // tahta gövde
  }

  // ── 20 Kasım (SES2): KATMANLI DARBE — geçici (catla) + gövde (yumruk) + malzeme dokusu (etDoku / cink / ahsap) + ortak yankı ──
  // catla: 2–8 ms geniş bantlı "çat" (gürültü patlaması + perdeli çok kısa tıklama). f: renk (et ~1,8 kHz mat · ahşap ~1,5 kHz kuru · metal ~4 kHz parlak)
  function catla(m, o, t, s) {
    var g = (s.g == null ? 1 : s.g) * AYAR.darbe.catla, f = s.f || 2000, d = s.d || 0.006, tf = s.tf || f * 0.4;
    if (!(g > 0)) return;
    gurultu(m, o, t, { d: d, a: 0.0003, g: g * 5, tip: 'bandpass', f: [[0, f * 1.3], [d, f * 0.7]], q: s.q || 0.7 });
    gurultu(m, o, t, { d: d * 0.6, a: 0.0002, g: g * 1.8, tip: 'highpass', f: f * 1.7, q: 0.5 });
    ton(m, o, t, { tip: 'triangle', f: [[0, tf], [0.005, tf * 0.55]], d: 0.008, a: 0.0002, g: g * 0.9 });
  }
  // yumruk: gövde 60–250 Hz, hızla düşen perde (f0→f1) + doyum (tanh) + rezonanslı kahve gürültü "tok" (salt sinüs değil: organik)
  function yumruk(m, o, t, s) {
    var g = (s.g == null ? 1 : s.g) * AYAR.darbe.yumruk, d = s.d || 0.14, f0 = s.f0 || 180, f1 = s.f1 || 55;
    if (!(g > 0)) return;
    ton(m, o, t, { f: [[0, f0], [d * 0.3, f1 * 1.2], [d, f1]], d: d * 1.1, a: 0.0009, tut: d * 0.12, g: g * 0.85, suruc: s.suruc || 1.8 });
    ton(m, o, t, { tip: 'triangle', f: [[0, f0 * 1.55], [d * 0.28, f1 * 2]], d: d * 0.7, a: 0.0012, g: g * 0.3, lp: 760, suruc: 1.5 });
    gurultu(m, o, t, { d: d * 0.85, a: 0.001, tut: d * 0.08, g: g * 1.9, tip: 'lowpass', f: [[0, s.nf || 900], [d * 0.6, f1 * 2.6]], q: 3, renk: 'kahve' });
  }
  // etDoku: ıslak "şlak/sklorç" — bant gürültü, genliği hızla titrer (30–70 Hz → yavaşlar) + rastgele gecikmeli mikro patlamalar (yırtılma) + ara sıra kemik
  function etDoku(m, o, t, s) {
    var c = m.c, g = (s.g == null ? 1 : s.g) * AYAR.darbe.doku, d = s.d || 0.09, f = s.f || 1200, i;
    if (!(g > 0)) return;
    var src = c.createBufferSource(); src.buffer = m.beyaz; src.loop = true;
    var b = c.createBiquadFilter(); b.type = 'bandpass'; egri(b.frequency, t, [[0, f * 1.4], [d, f * 0.5]]); b.Q.value = 1.1;
    var am = c.createGain(); am.gain.value = 0.55;
    var l = c.createOscillator(); l.type = 'triangle'; l.frequency.setValueAtTime(ra(38, 70), t); l.frequency.linearRampToValueAtTime(ra(16, 28), t + d);
    var lg = c.createGain(); lg.gain.value = 0.45; l.connect(lg); lg.connect(am.gain);
    var z = zarf(m, t, { d: d, a: 0.0015, tut: d * 0.15, g: g * 6 });
    src.connect(b); b.connect(am); am.connect(z); z.connect(o);
    src.start(t, R() * 2); src.stop(t + d + 0.05); l.start(t); l.stop(t + d + 0.05);
    var n = s.n == null ? 2 : s.n;
    for (i = 0; i < n; i++) gurultu(m, o, t + ra(0.008, 0.04) * (1 + i * 0.7), { d: ra(0.012, 0.028), a: 0.0008, g: g * ra(0.9, 1.6), tip: 'bandpass', f: [[0, ra(900, 2600)], [0.02, ra(400, 800)]], q: ra(1.4, 2.6) });
    if (s.kemik) kemik(m, o, t + ra(0.004, 0.014), { n: s.kemik, g: 0.1 * (s.kemikG == null ? 1 : s.kemikG) });
  }
  // yarılma: ağır/öldüren vuruşta kısa "khrrk" + ıslak sönüm
  function yarilma(m, o, t, s) {
    var g = s.g == null ? 1 : s.g, d = s.d || 0.16;
    etDoku(m, o, t, { g: g * 0.8, d: d, f: s.f || 2400, n: 3 });
    gurultu(m, o, t + 0.02, { d: d * 1.6, a: 0.01, g: g * 0.9 * AYAR.darbe.doku, tip: 'lowpass', f: [[0, 1800], [d * 1.6, 300]], q: 1.6, renk: 'kahve' });
  }
  // cink: FM metal "çınk" (taşıyıcı + hızla sönen modülatör → inharmonik parıltı)
  function cink(m, o, t, s) {
    var c = m.c, f = s.f || 3000, g = s.g == null ? 1 : s.g, d = s.d || 0.12;
    if (!(g > 0)) return;
    var os = c.createOscillator(); os.frequency.value = f;
    var md = c.createOscillator(); md.frequency.value = f * 1.414; var mg = c.createGain();
    mg.gain.setValueAtTime(f * 1.2, t); mg.gain.exponentialRampToValueAtTime(f * 0.02, t + d * 0.5);
    md.connect(mg); mg.connect(os.frequency);
    var z = zarf(m, t, { d: d, a: 0.0006, g: g * 0.22 }); os.connect(z); z.connect(o);
    os.start(t); md.start(t); os.stop(t + d + 0.05); md.stop(t + d + 0.05);
  }

  // ───────────────────────── sesler ─────────────────────────
  // her biri (m, o, t, v, p) → süre (sn). o: sesin bağlanacağı düğüm, p: rastgele perde çarpanı
  var SESLER = {
    savur: function (m, o, t, v, p) {   // ağır balta havayı yarar: derin, tok "vuuş" + alt gövde
      var of = !!v.ofkeli, ag = !!v.agir, zn = v.zincir || 0, bitir = zn === 2;
      var k = of ? 0.72 : bitir ? 0.78 : ag ? 0.84 : zn === 1 ? 1.04 : 1;
      var d = of ? 0.46 : bitir ? 0.44 : ag ? 0.39 : 0.33;
      // savur olayı vuruş anında gelir; vuruş da 0–90 ms içinde gelir. "Vuuş" öne yüklü: isabet olursa vurus onu kısar (bkz. sustur), ıskada kuyruğu duyulur
      bom(m, o, t, { f0: (bitir ? 82 : of ? 76 : 90) * p, f1: bitir ? 32 : 38, d: d * 0.6, a: d * 0.12, g: bitir ? 0.6 : of ? 0.52 : ag ? 0.46 : 0.36, mid0: (bitir ? 155 : 180) * k * p, mid1: 84 * k, midG: bitir ? 0.36 : 0.26, lp: 340 });
      vuus(m, o, t, { d: d, k: k * p, g: of ? 0.8 : bitir ? 0.84 : ag ? 0.74 : 0.66, hava: of ? 0.22 : 0.16 });
      gurultu(m, o, t, { d: d * 0.85, a: d * 0.3, g: (ag || bitir || of ? 0.7 : 0.55), tip: 'bandpass', f: [[0, 170 * k * p], [d * 0.32, 480 * k * p], [d * 0.85, 150 * k]], q: 2.2, renk: 'kahve' });   // 20 Kasım: etli alçak-orta süpürme
      return d + 0.04;
    },
    vur: function (m, o, t, v, p) { return SESLER.savur(m, o, t, { ofkeli: v.ofkeli, agir: v.agir, zincir: 0 }, p); },
    vur3: function (m, o, t, v, p) { return SESLER.savur(m, o, t, { ofkeli: v.ofkeli, agir: true, zincir: 2 }, p); },

    // 19 Kasım (balta işi): delip geçen baltada her isabet biraz daha tiz (zincir hissi; zamanlamayı dış cal() kaydırır), kısılarak
    // üst üste binme kırpmasın; kesme:true (okçu/şaman/dev saldırısı baltayla kesildi) → gövdenin üstüne "kesildi" vurgusu
    vurus: function (m, o, t, v, p) {
      var sira = v.tur === 'balta' && v.sira > 1 ? Math.min(v.sira, 6) : 1;
      if (sira > 1) { p *= 1 + 0.055 * (sira - 1); o.gain.value *= 1 / (1 + 0.1 * (sira - 1)); }
      var d = SESLER._vurusGovde(m, o, t, v, p);
      if (v.kesme && AYAR.darbe.kesme > 0) d = Math.max(d, SESLER._kesme(m, o, t + 0.012, v, p));
      return d;
    },
    _kesme: function (m, o, t, v, p) {
      var h = v.hedef, tr = h && h.tur ? h.tur : '', g = AYAR.darbe.kesme * 3, i;
      var vargorMi = tr === 'vargor' || (h && window.VARGOR && h === window.VARGOR);
      if (tr === 'dev' || vargorMi || (h && window.DEV && h === window.DEV)) {   g *= 0.5; t += 0.045;   // dev / Vargor: derin, aşağı çöken "BVOMM" — hazırlık bozuldu
        for (i = 0; i < 2; i++) ton(m, o, t, { tip: 'sawtooth', f: [[0, 96 * p], [0.32, 38 * p]], det: i ? 12 : -8, d: 0.45, a: 0.006, tut: 0.05, g: 0.3 * g, lp: [[0, 900], [0.35, 160]], lpq: 3, suruc: 1.6 });
        bom(m, o, t, { f0: 70 * p, f1: 26, d: 0.5, g: 0.6 * g, mid0: 140 * p, mid1: 55, midG: 0.35 * g, lp: 320, suruc: 1.8 });
        if (vargorMi) cang(m, o, t, { g: 0.25 * g, d: 0.28, k: 1.35 * p, parlak: 0.85, alt: 1.2 });
        gurultu(m, o, t + 0.01, { d: 0.35, a: 0.01, g: 0.5 * g, tip: 'bandpass', f: [[0, 900], [0.32, 180]], q: 2.5, renk: 'kahve' });
        return 0.55;
      }
      if (tr === 'saman') {   // büyü söner: aşağı kayan kısa "fzzt" + cam çatırtısı
        gurultu(m, o, t, { d: 0.24, a: 0.004, g: 0.55 * g, tip: 'bandpass', f: [[0, 3400 * p], [0.22, 380 * p]], q: 3 });
        ton(m, o, t, { tip: 'sawtooth', f: [[0, 1300 * p], [0.2, 170 * p]], d: 0.24, a: 0.004, g: 0.12 * g, vib: [38, 70], lp: 2600 });
        for (i = 0; i < 4; i++) {
          var tc = t + 0.012 + i * ra(0.018, 0.034), fc = ra(2600, 4600) * p;
          gurultu(m, o, tc, { d: ra(0.006, 0.012), a: 0.0006, g: ra(0.35, 0.55) * g, tip: 'bandpass', f: fc * 1.3, q: 2.5 });
          ton(m, o, tc, { f: fc, d: ra(0.05, 0.09), a: 0.001, g: 0.045 * g });
        }
        return 0.3;
      }
      if (tr === 'okcu') {   // yay kirişi kopar: sert "PAT" + titreyip sönen tıngırtı (gövdenin hemen ardından)
        t += 0.03;
        gurultu(m, o, t, { d: 0.014, a: 0.0005, g: 1.2 * g, tip: 'bandpass', f: 2300 * p, q: 1.2 });
        ton(m, o, t, { tip: 'sawtooth', f: [[0, 330 * p], [0.12, 165 * p]], d: 0.34, a: 0.001, g: 0.34 * g, vib: [15, 9], lp: [[0, 2600], [0.25, 700]], lpq: 2 });
        ton(m, o, t + 0.004, { tip: 'triangle', f: [[0, 660 * p], [0.1, 340 * p]], d: 0.16, a: 0.001, g: 0.12 * g });
        gurultu(m, o, t + 0.01, { d: 0.05, a: 0.002, g: 0.5 * g, tip: 'bandpass', f: [[0, 900 * p], [0.045, 420]], q: 2 });   // yayın ağacı esner
        return 0.32;
      }
      gurultu(m, o, t, { d: 0.03, a: 0.001, g: 0.6 * g, tip: 'bandpass', f: [[0, 2000 * p], [0.03, 700]], q: 1.4 });   // bilinmeyen: kısa "kesik"
      return 0.1;
    },
    _vurusGovde: function (m, o, t, v, p) {   // ete/kemiğe/zırha giren tok, ağır alt-bas darbe ("BUM")
      var tur = v.tur || 'savur', agir = !!v.agir, ol = !!v.oldurdu, i;
      m.sustur('savur', t, 0.28); m.sustur('vur', t, 0.28); m.sustur('vur3', t, 0.28);   // isabet "vuuş"un önüne geçer (çamur olmasın)
      if (tur === 'kasirga') {
        m.sustur('kasirga', t, 0.38);
        o.gain.value *= 1.08;
      }
      var D = AYAR.darbe;
      var mz = malzeme(v), devMi = mz === 'dev', vargorMi = mz === 'vargor', demirMi = mz === 'demir', deriMi = mz === 'deri', zirhMi = mz === 'zirh', baskinciMi = mz === 'baskinci', kucuk = mz === 'et-kucuk';
      if (tur === 'carpma') {   // düşmanların birbirine çarpması: tok gövde, kısa (zırh/vargor ise hafif metalik çarpma)
        var metalCarpma = demirMi || zirhMi || vargorMi;
        catla(m, o, t, { g: metalCarpma ? 0.42 : 0.3, f: (metalCarpma ? 1850 : 1100) * p, d: 0.007 });
        yumruk(m, o, t, { f0: ((devMi || vargorMi) ? 125 : 150) * p, f1: 46, d: 0.13, g: (devMi || vargorMi) ? 0.9 : 0.75, nf: 700 });
        if (metalCarpma) cink(m, o, t, { g: 0.16 * D.zirh, f: ra(1900, 2800) * p, d: 0.07 });
        etDoku(m, o, t + 0.002, { g: 0.3, d: 0.05, f: 900 * p, n: 0 });
        return 0.2;
      }
      // 20 Kasım (SES2) KATMANLI: catla (2–8 ms) + yumruk (60–250 Hz) + malzeme dokusu + ortak yankı (AYAR.ses.vurus.yanki).
      // 5 çeşit (sıra + ara sıra atlama), perde ±%8 (dış p) × çeşit çarpanı, 0–8 ms zamanlama, katman düzeyi ±%15 → "makineli tüfek" yok.
      t += R() * 0.008;
      m.vurusSira = (m.vurusSira + 1 + (R() < 0.35 ? 1 : 0)) % 5;
      var k = m.vurusSira, buyuk = agir || ol;
      // çeşitler: [gövde perde çarpanı, gövde son perde çarpanı, doku merkezi Hz, mikro patlama sayısı, çat rengi Hz]
      var CS = [[1, 1, 1150, 2, 2000], [0.93, 0.95, 980, 1, 1700], [1.07, 1.04, 1320, 3, 2300], [0.97, 0.92, 1050, 2, 1850], [1.04, 1.08, 1240, 1, 2150]][k];
      var tz = tur === 'atilma' ? 0.88 : tur === 'balta' ? 1.04 : 1, tu = tur === 'atilma' ? 1.2 : 1;
      if (devMi) {   // DEV: mat kalın deri "çat" + çok alçak gövde + deri "TOK" + taş hışırtısı; ara sıra kemik kuşak takırtısı
        var du = (agir ? 1.5 : ol ? 1.35 : 1) * tu;
        catla(m, o, t, { g: 1.2 * (buyuk ? 1.4 : 1) * ra(0.85, 1.15), f: CS[4] * 0.45 * p, d: 0.008, q: 0.9 });
        yumruk(m, o, t, { f0: 120 * p * CS[0], f1: 38 * CS[1], d: 0.22 * du, g: 1.15 * ra(0.85, 1.15), nf: 600, suruc: 2.6 });
        gurultu(m, o, t, { d: 0.07, a: 0.002, tut: 0.012, g: 0.9 * D.devTas, tip: 'bandpass', f: [[0, 620 * p], [0.06, 260]], q: 1.1, renk: 'kahve' });   // kalın deri "TOK"
        etDoku(m, o, t + 0.004, { g: 0.35, d: 0.07, f: CS[2] * 0.6 * p, n: CS[3] - 1 });
        gurultu(m, o, t + 0.015, { d: 0.25 * du, a: 0.01, g: 0.22 * D.devTas, tip: 'bandpass', f: [[0, 2200], [0.25 * du, 900]], q: 0.8 });   // taş hışırtısı
        if (D.devKemik > 0 && (buyuk || R() < 0.35)) kemik(m, o, t + 0.02 + R() * 0.03, { n: 2 + (R() < 0.5 ? 1 : 0), g: 0.08 * D.devKemik });
        if (buyuk) { yumruk(m, o, t + 0.03, { f0: 90 * p, f1: 30, d: 0.38 * du, g: 0.85, nf: 450, suruc: 2.4 }); yarilma(m, o, t + 0.02, { g: 0.45, d: 0.18, f: 1500 }); }
        return 0.3 * du + (buyuk ? 0.3 : 0.1);
      }
      if (vargorMi) {   // VARGOR: ağır ocak-demir zırh çınlaması + dev gövde alt-bas darbesi + yanık deri/et
        var vu = (agir ? 1.45 : ol ? 1.3 : 1) * tu, vg = D.vargor;
        catla(m, o, t, { g: 1.05 * (buyuk ? 1.35 : 1) * ra(0.85, 1.15), f: 2800 * p, d: 0.007, q: 0.85, tf: 1100 * p });
        cang(m, o, t, { g: 0.56 * D.zirh * vg * ra(0.88, 1.12), d: 0.38 * (buyuk ? 1.2 : 1), k: 1.42 * p * ra(0.95, 1.05), parlak: 0.9, alt: 1.35 });
        cink(m, o, t, { g: 0.34 * D.zirh * vg, f: ra(1850, 2900) * p, d: buyuk ? 0.14 : 0.1 });
        yumruk(m, o, t + 0.004, { f0: 110 * p * CS[0] * tz, f1: 34 * CS[1], d: 0.24 * vu, g: 1.18 * vg * ra(0.88, 1.12), nf: 560, suruc: 2.5 });
        gurultu(m, o, t + 0.004, { d: 0.075, a: 0.002, tut: 0.012, g: 0.72 * vg, tip: 'bandpass', f: [[0, 560 * p], [0.065, 220]], q: 1.2, renk: 'kahve' });
        etDoku(m, o, t + 0.008, { g: 0.42 * vg, d: 0.08, f: CS[2] * 0.65 * p, n: CS[3] - 1 });
        if (buyuk) {
          yumruk(m, o, t + 0.032, { f0: 84 * p, f1: 28, d: 0.36 * vu, g: 0.88 * vg, nf: 420, suruc: 2.4 });
          cang(m, o, t + 0.028, { g: 0.32 * D.zirh * vg, d: 0.26, k: 1.35 * p, parlak: 0.75, alt: 1.2 });
          yarilma(m, o, t + 0.02, { g: 0.45 * vg, d: 0.18, f: 1450 });
        }
        return 0.34 * vu + (buyuk ? 0.28 : 0.1);
      }
      if (demirMi) {   // İNFAZCI ZIRHLI: ağır çelik levha çınlaması (demir/zirh) + boğuk iri gövde darbesi
        var du2 = (agir ? 1.42 : ol ? 1.28 : 1) * tu, dg = D.demir;
        catla(m, o, t, { g: 0.85 * (buyuk ? 1.4 : 1) * ra(0.85, 1.15), f: 3800 * p, d: 0.006, q: 0.8, tf: 1250 * p });
        cang(m, o, t, { g: 0.86 * D.zirh * dg * ra(0.88, 1.12), d: 0.36 * (buyuk ? 1.25 : 1), k: 1.72 * p * ra(0.94, 1.06), parlak: 1.85, alt: 1.05 });
        cink(m, o, t, { g: 0.75 * D.zirh * dg, f: ra(2550, 3850) * p, d: buyuk ? 0.16 : 0.105 });
        gurultu(m, o, t + 0.004, { d: 0.065, a: 0.002, g: 0.6 * D.zirh * dg, tip: 'bandpass', f: [[0, 2600 * p], [0.06, 1450 * p]], q: 3.6 });
        yumruk(m, o, t + 0.006, { f0: 152 * p * CS[0] * tz, f1: 49 * CS[1], d: 0.17 * du2, g: 0.95 * D.zirhEt * dg * ra(0.85, 1.15), nf: 740, suruc: 2.0 });
        etDoku(m, o, t + 0.012, { g: 0.38 * D.zirhEt, d: 0.06, f: 760 * p, n: ol ? 1 : 0 });
        if (buyuk) {
          yumruk(m, o, t + 0.035, { f0: 118 * p, f1: 38, d: 0.32 * du2, g: agir ? 0.88 : 0.72, nf: 560 });
          cang(m, o, t + 0.03, { g: 0.4 * D.zirh * dg, d: 0.25, k: 1.72 * p, parlak: 1.15, alt: 0.9 });
        }
        return 0.32 * du2 + (buyuk ? 0.22 : 0.08);
      }
      if (zirhMi) {   // ZIRH: parlak "çat" + uyumsuz kısmili "ÇANG" + FM "çınk" + kenar tırtılı; altında boğuk et gövdesi
        var zu = (agir ? 1.4 : ol ? 1.25 : 1) * tu;
        catla(m, o, t, { g: 0.75 * (buyuk ? 1.4 : 1) * ra(0.85, 1.15), f: 4200 * p, d: 0.005, q: 0.8, tf: 1400 * p });
        cang(m, o, t, { g: 0.75 * D.zirh * ra(0.85, 1.15), d: 0.32 * (buyuk ? 1.25 : 1), k: 2.3 * p * ra(0.94, 1.06), parlak: 2.3, alt: 0.45 });
        cink(m, o, t, { g: 0.68 * D.zirh, f: ra(2800, 4200) * p, d: buyuk ? 0.15 : 0.1 });
        gurultu(m, o, t + 0.004, { d: 0.06, a: 0.002, g: 0.55 * D.zirh, tip: 'bandpass', f: [[0, 3000 * p], [0.055, 1800 * p]], q: 4 });   // kenar sürtünmesi
        yumruk(m, o, t + 0.006, { f0: 165 * p * CS[0] * tz, f1: 56 * CS[1], d: 0.15 * zu, g: 0.9 * D.zirhEt * ra(0.85, 1.15), nf: 800 });
        etDoku(m, o, t + 0.012, { g: 0.4 * D.zirhEt, d: 0.06, f: 800 * p, n: ol ? 1 : 0 });
        if (buyuk) {
          yumruk(m, o, t + 0.035, { f0: 125 * p, f1: 42, d: 0.3 * zu, g: agir ? 0.85 : 0.7, nf: 600 });
          cang(m, o, t + 0.03, { g: 0.35 * D.zirh, d: 0.22, k: 2.3 * p, parlak: 1.2 });   // levha bükülür: ikinci kısa çınlama
        }
        return 0.3 * zu + (buyuk ? 0.2 : 0.06);
      }
      if (deriMi) {   // İNFAZCI ZIRHI KIRILDI: tok et/deri darbesi (metal yok)
        var iu = (agir ? 1.55 : ol ? 1.38 : 1) * tu, ig = D.deri;
        catla(m, o, t, { g: 0.68 * (buyuk ? 1.4 : 1) * ra(0.85, 1.15), f: 1380 * p, d: 0.007, q: 1.0, tf: 620 * p });
        yumruk(m, o, t, { f0: 166 * CS[0] * p * tz, f1: 50 * CS[1], d: 0.2 * iu, g: (buyuk ? 1.14 : 1.0) * ig * ra(0.85, 1.15), nf: 680, suruc: 2.1 });
        gurultu(m, o, t, { d: 0.075, a: 0.002, tut: 0.014, g: 0.95 * ig, tip: 'bandpass', f: [[0, 640 * p], [0.065, 250]], q: 1.35, renk: 'kahve' });
        etDoku(m, o, t + 0.003, { g: 0.78 * ig * ra(0.85, 1.15), d: buyuk ? 0.12 : 0.085, f: 880 * p, n: CS[3] + (ol ? 1 : 0), kemik: D.etKemik > 0 && (buyuk || R() < 0.35) ? 2 : 0, kemikG: D.etKemik });
        if (buyuk) {
          yumruk(m, o, t + 0.032, { f0: 112 * p, f1: 36, d: 0.3 * iu, g: 0.88 * ig, nf: 520 });
          yarilma(m, o, t + 0.018, { g: 0.6 * ig, d: 0.17, f: 1750 });
        }
        return 0.25 * iu + (buyuk ? 0.25 : 0.06);
      }
      if (baskinciMi) {   // BASKINCI: çevik deri kayış + sıkı et darbesi
        var bu = (agir ? 1.5 : ol ? 1.32 : 1) * tu, bg = D.baskinci;
        catla(m, o, t, { g: 0.72 * (buyuk ? 1.45 : 1) * ra(0.85, 1.15), f: 1850 * p, d: 0.006, q: 0.85, tf: 860 * p });
        yumruk(m, o, t, { f0: 184 * CS[0] * p * tz, f1: 56 * CS[1], d: 0.155 * bu, g: (buyuk ? 1.08 : 0.94) * bg * ra(0.85, 1.15), nf: 860, suruc: 1.85 });
        gurultu(m, o, t + 0.002, { d: 0.05, a: 0.0012, g: 0.65 * bg, tip: 'bandpass', f: [[0, 960 * p], [0.045, 390]], q: 1.5, renk: 'kahve' });
        var bKem = D.etKemik > 0 && (buyuk || R() < 0.28) ? (buyuk ? 2 : 1) : 0;
        etDoku(m, o, t + 0.002, { g: 0.82 * bg * (tur === 'balta' ? 1.1 : 1) * ra(0.85, 1.15), d: buyuk ? 0.11 : 0.075, f: CS[2] * 1.02 * p, n: CS[3] + (ol ? 1 : 0), kemik: bKem, kemikG: D.etKemik * (buyuk ? 1.2 : 0.85) });
        if (buyuk) {
          yumruk(m, o, t + 0.028, { f0: 132 * p, f1: 42, d: 0.27 * bu, g: agir ? 0.88 : 0.72, nf: 620 });
          yarilma(m, o, t + 0.015, { g: agir ? 0.66 : 0.52, d: agir ? 0.18 : 0.14, f: 2250 });
        }
        return 0.22 * bu + (buyuk ? 0.24 : 0.05);
      }
      // ET (goblin, okçu, şaman, Yakıcı): mat "çat" + gövde + ıslak titreşimli şlak + mikro yırtılma (+ kemik); METAL YOK
      var tP = (kucuk ? 1.13 : 0.93) * tz, derin = (agir ? 0.8 : ol ? 0.87 : 1) * tP;
      var uz = (agir ? 1.6 : ol ? 1.4 : 1) * (kucuk ? 0.85 : 1.1) * tu;
      catla(m, o, t, { g: (kucuk ? 0.6 : 0.75) * (buyuk ? 1.5 : 1) * ra(0.85, 1.15), f: CS[4] * p * (kucuk ? 1.1 : 0.85), d: 0.006, q: 0.8 });
      yumruk(m, o, t, { f0: 178 * CS[0] * p * derin, f1: 50 * CS[1] * derin, d: 0.175 * uz, g: (buyuk ? 1.28 : 1.10) * ra(0.85, 1.15), nf: kucuk ? 1000 : 800 });
      gurultu(m, o, t + 0.003, { d: 0.042, a: 0.001, g: tur === 'balta' ? 0.63 : 0.46, tip: 'bandpass', f: [[0, 2400 * p], [0.04, 630 * p]], q: 1.15 });
      var kem = D.etKemik > 0 && (buyuk || R() < 0.25) ? (buyuk ? (agir ? 3 : 2) : 1) : 0;
      etDoku(m, o, t + 0.002, { g: (kucuk ? 1.06 : 1.0) * (tur === 'balta' ? 1.12 : 1) * ra(0.85, 1.15), d: (buyuk ? 0.12 : 0.08) * (kucuk ? 0.9 : 1.1),
        f: CS[2] * p * (kucuk ? 1.12 : 0.9), n: CS[3] + (ol ? 1 : 0), kemik: kem, kemikG: D.etKemik * (buyuk ? 1.3 : 0.8) });
      if (buyuk) {
        yumruk(m, o, t + 0.03, { f0: (kucuk ? 140 : 120) * p, f1: kucuk ? 46 : 40, d: (agir ? 0.32 : 0.26) * (kucuk ? 0.9 : 1.1), g: agir ? 0.9 : 0.75, nf: 600 });
        yarilma(m, o, t + 0.015, { g: agir ? 0.7 : 0.55, d: agir ? 0.2 : 0.15, f: kucuk ? 2600 : 2100 });
      }
      return 0.22 * uz + (buyuk ? 0.25 : 0.05);
    },

    blok: function (m, o, t, v, p) {   // ahşap+demir kalkana çarpan balta: tok ahşap "TOK/GÜM" + kısa demir kuşak çınlaması; et YOK
      var kir = !!v.kirildi, D = AYAR.darbe;
      t += R() * 0.005;
      m.sustur('savur', t, 0.3); m.sustur('vur', t, 0.3); m.sustur('vur3', t, 0.3);
      govde(m, o, t + 0.005, { f0: (kir ? 150 : 162) * p, f1: kir ? 52 : 58, d: kir ? 0.34 : 0.26, g: kir ? 0.65 : 0.52, et: 240 * p, etG: 0.09, kuyruk: kir ? 0.25 : 0.18 });
      catla(m, o, t, { g: 0.55, f: 1500 * p, d: 0.007, q: 1.1, tf: 700 * p });   // 20 Kasım: kuru ahşap "çat"
      ahsap(m, o, t, { g: kir ? 1.38 : 1.37, k: p * ra(0.96, 1.04), d: kir ? 0.32 : 0.27 });
      cang(m, o, t + 0.002, { g: (kir ? 0.3 : 0.38) * D.kalkanDemir, d: 0.14, k: 1.25 * p * ra(0.95, 1.05), parlak: 0.5 });
      if (!kir) cink(m, o, t + 0.002, { g: 0.34 * D.kalkanDemir, f: 3350 * p, d: 0.09 });
      // baltanın geri tepmesi: sapta titreyen kısa alçak "vung"
      ton(m, o, t + 0.01, { tip: 'triangle', f: [[0, 118 * p], [0.16, 82 * p]], d: 0.2, a: 0.004, g: 0.32, vib: [26, 7], lp: 500 });
      if (kir) {   // kalkan çatlaması: derin ikinci darbe + ahşap kırılma serisi
        catla(m, o, t + 0.014, { g: 0.8, f: 2180 * p, d: 0.011, q: 1.15, tf: 540 * p });
        ahsap(m, o, t + 0.027, { g: 0.73, k: 0.78 * p, d: 0.19 });
        var cat = [[0.015, 480, 190, 0.44], [0.052, 540, 210, 0.46], [0.092, 410, 165, 0.4], [0.138, 490, 185, 0.34]];
        for (var i = 0; i < cat.length; i++) {
          var c0 = cat[i];
          ton(m, o, t + c0[0], { tip: 'triangle', f: [[0, c0[2] * 0.9 * p], [0.032, c0[2] * 0.42]], d: 0.05, a: 0.001, g: c0[3] * 0.7, lp: 420 });
          gurultu(m, o, t + c0[0], { d: 0.042, a: 0.001, g: c0[3], tip: 'bandpass', f: [[0, c0[1] * p], [0.038, c0[2]]], q: 1.5 });
          catla(m, o, t + c0[0], { g: c0[3] * 0.78, f: (2220 - 265 * i) * p, d: 0.009, q: 1.05, tf: 660 * p });
        }
        return 0.62;
      }
      return 0.52;
    },
    kalkanKir: function (m, o, t, v, p) { return SESLER.blok(m, o, t, { kirildi: true, x: v.x, y: v.y }, p); },

    // 19 Kasım: TÜRE GÖRE ayrı sektirme (v.tur: 'ok' | 'buyu' | 'kaya'; v.kusursuz = tam zamanında → daha parlak/vurgulu)
    sektir: function (m, o, t, v, p) {
      m.sustur('savur', t, 0.35); m.sustur('vur', t, 0.35); m.sustur('vur3', t, 0.35);
      var tr = v.tur === 'buyu' ? 'buyu' : v.tur === 'kaya' ? 'kaya' : 'ok', kus = !!v.kusursuz, D = AYAR.darbe, i;
      if (tr === 'buyu') {   // BÜYÜ: kısa "vvvVUMM" + kristal/cam çınlaması + geri dönen büyünün yükselen vınlaması. Metal tık YOK, sert başlangıç YOK.
        var gb = D.sekBuyu;
        for (var j = 0; j < 2; j++) ton(m, o, t, { tip: 'sawtooth', f: [[0, 62 * p], [0.2, 128 * p], [0.42, 112 * p]], det: j ? 11 : -9, d: 0.44, a: 0.07, tut: 0.06, g: 0.4 * gb, lp: [[0, 180], [0.16, 1300], [0.42, 300]], lpq: 4, suruc: 1.5 });
        ton(m, o, t, { f: [[0, 48 * p], [0.2, 92 * p], [0.4, 80 * p]], d: 0.42, a: 0.06, tut: 0.06, g: 0.9 * gb });   // alt "VUMM"
        var KR = [1, 2.01, 2.99, 4.23], KA = [1, 0.55, 0.4, 0.22], kf = (kus ? 1568 : 1319) * p;   // cam kâse kipleri (neredeyse harmonik)
        for (i = 0; i < KR.length; i++) ton(m, o, t + 0.05 + i * 0.012, { f: kf * KR[i], d: (kus ? 0.75 : 0.6) * (1 - i * 0.15), a: 0.012, g: 0.07 * KA[i] * gb * (kus ? 1.3 : 1), vib: [6.5, kf * KR[i] * 0.004] });
        ton(m, o, t + 0.06, { f: [[0, 900 * p], [0.38, (kus ? 3000 : 2500) * p]], d: 0.52, g: 0.2 * gb, nk: [[0.04, 0.3], [0.28, 1], [0.38, 0.45], [0.47, 0.12]], vib: [11, 30] });   // yükselen vınlama
        gurultu(m, o, t + 0.06, { d: 0.52, g: 0.3 * gb, nk: [[0.04, 0.25], [0.28, 1], [0.38, 0.45], [0.47, 0.12]], tip: 'bandpass', f: [[0, 900 * p], [0.4, (kus ? 3800 : 3100) * p]], q: 7 });
        if (kus) ton(m, o, t + 0.1, { f: kf * 4, d: 0.5, a: 0.015, g: 0.035 * gb, vib: [7, 18] });   // ödül parıltısı (oktav üstü)
        return 0.75;
      }
      if (tr === 'kaya') {   // DEVİN KAYASI: ağır taş "KRAK/TOK" + moloz; metal yok
        var gk = D.sekKaya;
        bom(m, o, t, { f0: 92 * p, f1: 34, d: 0.32, g: 0.9 * gk, mid0: 190 * p, mid1: 80, midG: 0.5 * gk, lp: 460, bg: 0.6 * gk, lp0: 1100, lp1: 120, suruc: 1.8 });
        gurultu(m, o, t, { d: 0.05, a: 0.0008, g: 4.2 * gk, tip: 'bandpass', f: [[0, 1700 * p], [0.045, 600 * p]], q: 0.9 });   // "KRAK"
        gurultu(m, o, t + 0.003, { d: 0.11, a: 0.002, tut: 0.015, g: 2.6 * gk, tip: 'bandpass', f: [[0, 520 * p], [0.1, 240]], q: 1.6, renk: 'kahve' });   // taş "TOK"
        kemik(m, o, t + 0.008, { n: kus ? 4 : 3, g: 0.12 * gk });   // çatlama
        for (i = 0; i < (kus ? 9 : 6); i++) gurultu(m, o, t + 0.05 + Math.pow(i / 6, 1.3) * 0.22 + ra(0, 0.015), { d: ra(0.008, 0.02), a: 0.0006, g: ra(0.2, 0.42) * gk * (1 - i / 12), tip: 'bandpass', f: ra(800, 2600), q: ra(2, 3.5) });   // moloz
        govde(m, o, t + 0.006, { f0: 150 * p, f1: 50, d: kus ? 0.34 : 0.26, g: (kus ? 0.75 : 0.85) * gk, et: 230, etG: 0.3, kuyruk: 0.2 });
        return kus ? 0.5 : 0.42;
      }
      // OK: baltanın ağzına çarpan ok — kısa keskin metal "TİNK" + ahşap sap çıtırtısı + geri savrulan okun kısa vınlaması
      var go = D.sekOk;
      govde(m, o, t, { f0: 210 * p, f1: 80, d: 0.15, g: 0.9 * go, et: 380 * p, etG: 0.2, kuyruk: 0.08 });   // balta yüzünün küçük gövdesi
      cang(m, o, t, { g: 0.62 * go * (kus ? 1.15 : 1), d: kus ? 0.28 : 0.22, k: (kus ? 3.4 : 3.0) * p * ra(0.97, 1.03), parlak: 1.3 });   // ~0,9–6 kHz "TİNK"
      cink(m, o, t + 0.001, { g: (kus ? 0.66 : 0.54) * go, f: (kus ? 4050 : 3500) * p, d: kus ? 0.145 : 0.11 });
      gurultu(m, o, t, { d: 0.01, a: 0.0005, g: 1.18 * go, tip: 'bandpass', f: 5200 * p, q: 1.5 });   // çarpma anı
      for (i = 0; i < 3; i++) gurultu(m, o, t + 0.008 + i * ra(0.009, 0.016), { d: ra(0.006, 0.012), a: 0.0005, g: ra(0.35, 0.55) * go, tip: 'bandpass', f: ra(1100, 2000), q: 2.4 });   // ahşap sap çıtırtısı
      gurultu(m, o, t + 0.025, { d: kus ? 0.24 : 0.18, a: 0.02, tut: 0.02, g: 0.4 * go, tip: 'bandpass', f: [[0, (kus ? 4200 : 3600) * p], [kus ? 0.22 : 0.17, 1500 * p]], q: 6 });   // vınlama (uzaklaşan)
      return kus ? 0.42 : 0.34;
    },
    sekti: function (m, o, t, v, p) { return SESLER.sektir(m, o, t, v, p); },

    olum: function (m, o, t, v, p) {   // türe göre kısa hırıltı/çığlık; parcala: ıslak patlama
      var tur = v.tur, i;
      if (v.parcala) {
        gurultu(m, o, t, { d: 0.42, a: 0.003, g: 0.65, tip: 'lowpass', f: [[0, 2100], [0.4, 160]], q: 1.2 });
        ton(m, o, t, { f: [[0, 95 * p], [0.25, 32]], d: 0.36, a: 0.002, g: 0.78, suruc: 2.6 });
        for (i = 0; i < 6; i++) gurultu(m, o, t + ra(0.03, 0.32), { d: ra(0.03, 0.07), a: 0.002, g: ra(0.15, 0.35), tip: 'bandpass', f: [[0, ra(700, 2100)], [0.05, ra(250, 600)]], q: 1.5 });
        islak(m, o, t, { g: 0.55, f: 2200 * p, n: 6, yay: 0.12, tok: 0.5, tokF: 700, kuyruk: 0.4 });   // ıslak patlama
        kemik(m, o, t + 0.02, { n: 5, g: 0.26 });
        for (i = 0; i < 4; i++) islak(m, o, t + 0.16 + i * ra(0.06, 0.11), { g: ra(0.16, 0.26), f: ra(1400, 2400), n: 1, tok: 0.18, tokF: ra(380, 620) });   // yere düşen parçalar
        return 0.62;
      }
      if (tur === 'goblin') {
        formant(m, o, t, { f: [[0, 380 * p], [0.08, 640 * p], [0.42, 270 * p]], d: 0.5, a: 0.015, g: 0.6,
          fm: [[1000, 6, 1], [2700, 8, 0.6], [3600, 10, 0.3]], titreme: [11, 25], puruz: [47, 0.4], nefes: 0.12 });
        return 0.52;
      }
      if (tur === 'saman') {
        formant(m, o, t, { f: [[0, 230 * p], [0.12, 290 * p], [0.8, 115 * p]], d: 0.85, a: 0.03, g: 0.62,
          fm: [[700, 6, 1], [1200, 7, 0.6], [2500, 9, 0.35]], titreme: [7, 12], puruz: [23, 0.5], nefes: 0.25 });
        return 0.88;
      }
      if (tur === 'baskinci') {
        formant(m, o, t, { f: [[0, 205 * p], [0.09, 245 * p], [0.56, 102 * p]], d: 0.62, a: 0.018, g: 0.58,
          fm: [[620, 5, 1], [1350, 7, 0.65], [2700, 9, 0.28]], titreme: [8, 10], puruz: [35, 0.55], nefes: 0.16, suruc: 1.5 });
        return 0.65;
      }
      if (tur === 'infazci') {
        formant(m, o, t, { f: [[0, 98 * p], [0.08, 86 * p], [0.72, 46 * p]], d: 0.78, a: 0.03, g: 0.62,
          fm: [[390, 5, 1], [780, 6, 0.7], [1700, 7, 0.2]], titreme: [4, 3], puruz: [24, 0.75], nefes: 0.22, suruc: 2.0 });
        cang(m, o, t + 0.24, { g: 0.14, d: 0.22, k: 1.65 * p, parlak: 0.6, alt: 0.9 });   // ağır zırh yere çöker
        return 0.82;
      }
      // ork (okçu, kalkanlı ve bilinmeyenler): kalın
      formant(m, o, t, { f: [[0, 125 * p], [0.1, 105 * p], [0.6, 60 * p]], d: 0.7, a: 0.03, g: 0.55,
        fm: [[480, 5, 1], [950, 6, 0.7], [2300, 8, 0.25]], titreme: [5, 4], puruz: [31, 0.7], nefes: 0.18, suruc: 1.8 });
      return 0.72;
    },

    oyuncuHasar: function (m, o, t, v, p) {   // barbara inen darbe: dolgun "GÜM" + şlak + kısa homurtu
      if (v.yanma) {   // ateşte yanma tıkı: kısık cızırtı (darbe değil)
        var yg = AYAR.darbe.yanma; if (!yg) return 0.05;
        gurultu(m, o, t, { d: 0.16, a: 0.01, g: 0.22 * yg, tip: 'highpass', f: [[0, 2500 * p], [0.16, 5200]], q: 0.7 });
        gurultu(m, o, t, { d: 0.12, a: 0.005, g: 0.18 * yg, tip: 'bandpass', f: 700 * p, q: 1.2, renk: 'kahve' });
        return 0.18;
      }
      catla(m, o, t, { g: 0.55, f: 1600 * p, d: 0.007 });
      yumruk(m, o, t, { f0: 175 * p, f1: 55, d: 0.18, g: 1.0, nf: 800 });
      etDoku(m, o, t + 0.003, { g: 0.6, d: 0.07, f: 1000 * p, n: 1 });
      formant(m, o, t + 0.025, { f: [[0, 140 * p], [0.2, 98 * p]], d: 0.24, a: 0.015, g: 0.4,
        fm: [[550, 5, 1], [1000, 6, 0.6], [2400, 8, 0.2]], puruz: [33, 0.5], nefes: 0.1 });
      return 0.36;
    },

    atil: function (m, o, t, v, p) {   // güçlü alt-bas itiş + dolgun hava yarılması
      bom(m, o, t, { f0: 104 * p, f1: 44, d: 0.17, g: 0.78, mid0: 195 * p, mid1: 96, midG: 0.44, lp: 420 });
      gurultu(m, o, t, { d: 0.24, a: 0.024, g: 0.62, tip: 'lowpass', f: [[0, 220], [0.1, 640], [0.24, 170]], q: 1.05, renk: 'kahve' });
      gurultu(m, o, t, { d: 0.25, a: 0.022, g: 0.44, tip: 'bandpass', f: [[0, 380 * p], [0.11, 1450 * p], [0.25, 480]], q: 1.25 });
      for (var i = 0; i < 4; i++) gurultu(m, o, t + i * 0.02 + ra(0, 0.01), { d: 0.028, a: 0.002, g: ra(0.12, 0.2), tip: 'bandpass', f: i % 2 ? ra(1100, 1800) : ra(380, 750), q: 2.0 });
      return 0.29;
    },

    baltaAt: function (m, o, t, v, p) {   // fırlatma + dolgun dönen "vup-vup" (dönünce baltaDondu keser)
      var c = m.c, d = 1.8;
      bom(m, o, t, { f0: 118 * p, f1: 50, d: 0.16, g: 0.76, mid0: 230 * p, mid1: 115, midG: 0.44, lp: 460 });
      gurultu(m, o, t, { d: 0.17, a: 0.014, g: 0.48, tip: 'lowpass', f: [[0, 220], [0.08, 560], [0.17, 160]], q: 1, renk: 'kahve' });
      gurultu(m, o, t, { d: 0.18, a: 0.015, g: 0.4, tip: 'bandpass', f: [[0, 340 * p], [0.08, 1280 * p], [0.18, 520]], q: 1.2 });
      var src = c.createBufferSource(); src.buffer = m.beyaz; src.loop = true;
      var b = c.createBiquadFilter(); b.type = 'bandpass'; b.Q.value = 1.6;
      b.frequency.setValueAtTime(560 * p, t); b.frequency.linearRampToValueAtTime(380 * p, t + 0.6); b.frequency.linearRampToValueAtTime(510 * p, t + 1.2);
      var bAlt = c.createBiquadFilter(); bAlt.type = 'lowpass'; bAlt.frequency.value = 360;
      var srcAlt = c.createBufferSource(); srcAlt.buffer = m.kahve; srcAlt.loop = true;
      var am = c.createGain(); am.gain.value = 0.18;
      var l = c.createOscillator(); l.type = 'triangle'; l.frequency.setValueAtTime(11.5 * p, t); l.frequency.linearRampToValueAtTime(7.2, t + d);
      var lg = c.createGain(); lg.gain.value = 0.85; l.connect(lg); lg.connect(am.gain);
      var z = zarf(m, t, { d: d, g: 0.68, nk: [[0.05, 1], [0.55, 0.45], [1.1, 0.72], [1.6, 0.6]] });
      var zAlt = zarf(m, t, { d: d, g: 0.6, nk: [[0.05, 0.95], [0.6, 0.45], [1.2, 0.7], [1.65, 0.52]] });
      // dönen ağzın ince ıslığı (orta-üst bant): küçük hoparlörde "vup-vup" bununla duyulur
      var bUst = c.createBiquadFilter(); bUst.type = 'bandpass'; bUst.Q.value = 3.2;
      bUst.frequency.setValueAtTime(1500 * p, t); bUst.frequency.linearRampToValueAtTime(1150 * p, t + 0.7); bUst.frequency.linearRampToValueAtTime(1400 * p, t + 1.3);
      var gUst = c.createGain(); gUst.gain.value = 0.55; src.connect(bUst); bUst.connect(gUst); gUst.connect(am);
      gurultu(m, o, t, { d: 0.12, a: 0.01, g: 0.26, tip: 'bandpass', f: [[0, 1200 * p], [0.05, 2600 * p], [0.12, 1400 * p]], q: 1.6 });
      src.connect(b); b.connect(am); am.connect(z); z.connect(o);
      srcAlt.connect(bAlt); bAlt.connect(am); am.connect(zAlt); zAlt.connect(o);
      src.start(t, R()); src.stop(t + d + 0.05);
      srcAlt.start(t, R()); srcAlt.stop(t + d + 0.05);
      l.start(t); l.stop(t + d + 0.05);
      return d;
    },

    baltaDondu: function (m, o, t, v, p) {   // ele yakalama: tok deri+kabza "BOM" + hafif çelik oturması
      m.kesTur('baltaAt', t); m.kesTur('baltaCagir', t);
      bom(m, o, t, { f0: 128 * p, f1: 52, d: 0.15, g: 0.88, mid0: 245 * p, mid1: 112, midG: 0.52, lp: 480, bg: 0.44, lp0: 680, lp1: 160 });
      tik(m, o, t, { g: 0.22, f: 1450, d: 0.004 });
      gurultu(m, o, t, { d: 0.055, a: 0.001, g: 0.4, tip: 'bandpass', f: [[0, 920 * p], [0.05, 360]], q: 1.3 });
      gurultu(m, o, t, { d: 0.024, a: 0.0004, g: 0.34, tip: 'bandpass', f: [[0, 2300 * p], [0.02, 1300 * p]], q: 1.1 });   // avuca oturan deri sap: "şap"
      metal(m, o, t + 0.004, { f: 880 * p, oran: [1, 2.35, 3.9], amp: [1, 0.42, 0.2], son: [1, 0.6, 0.35], g: 0.1, d: 0.24 });
      if (v.yakala) islak(m, o, t, { g: 0.26, f: 2400 * p, n: 0, tok: 0.4, tokF: 1000, govdeD: 0.045 });   // havada yakalama: avuçta "ŞAK"
      return 0.28;
    },

    baltaCagir: function (m, o, t, v, p) {   // geri çağrılan balta sana döner: hızlanan, yükselen dönen bıçak "vvvınn" (uzak → biraz uzun)
      m.kesTur('baltaAt', t);
      var c = m.c, d = sin(0.38 + (v.mesafe || 300) / 1400, 0.4, 0.85);
      var am = c.createGain(); am.gain.value = 0.5;
      var l = c.createOscillator(); l.type = 'triangle'; l.frequency.setValueAtTime(7 * p, t); l.frequency.exponentialRampToValueAtTime(24 * p, t + d);
      var lg = c.createGain(); lg.gain.value = 0.48; l.connect(lg); lg.connect(am.gain);
      var src = c.createBufferSource(); src.buffer = m.beyaz; src.loop = true;
      var b = c.createBiquadFilter(); b.type = 'bandpass'; b.Q.value = 2.2; egri(b.frequency, t, [[0, 420 * p], [d, 1500 * p]]);
      var src2 = c.createBufferSource(); src2.buffer = m.kahve; src2.loop = true;
      var b2 = c.createBiquadFilter(); b2.type = 'lowpass'; egri(b2.frequency, t, [[0, 240], [d, 620]]);
      var z = zarf(m, t, { d: d + 0.04, g: 1.5, nk: [[0.04, 0.25], [d * 0.6, 0.6], [d - 0.03, 1], [d, 0.7]] });
      src.connect(b); b.connect(am); src2.connect(b2); b2.connect(am); am.connect(z); z.connect(o);
      src.start(t, R()); src.stop(t + d + 0.1); src2.start(t, R()); src2.stop(t + d + 0.1); l.start(t); l.stop(t + d + 0.1);
      ton(m, o, t, { f: [[0, 310 * p], [d, 860 * p]], d: d + 0.04, g: 0.28, nk: [[0.05, 0.2], [d * 0.7, 0.6], [d - 0.02, 1], [d, 0.6]], vib: [11, 18] });   // bıçak ıslığı
      return d + 0.05;
    },

    adim: function (m, o, t, v, p) {   // çamur ve taşlı zeminde sol/sağ değişken ağır adım
      m.adimSol = !m.adimSol;
      var asim = m.adimSol ? 0.93 : 1.07, pp = p * asim;
      if (m.bolum === 3) {
        var ayaz = window.AYAZ, tas = ayaz && v.x != null && v.y != null &&
          ayaz.bolge(v.y) !== 'buz_bogazi' && Math.abs(v.x - ayaz.yolX(v.y)) <= ayaz.yolYari(v.y);
        var ses = m.c.createBufferSource();
        ses.buffer = ayazOyuncuAdimTampon(m.c, !!tas);
        ses.playbackRate.value = pp;
        ses.connect(o); ses.start(t);
        return ses.buffer.duration / pp;
      }
      bom(m, o, t, { f0: 78 * pp, f1: 36 * pp, d: 0.09, g: 0.56, bg: 0.54, lp0: 520 * pp, lp1: 130 });
      gurultu(m, o, t + 0.014, { d: 0.05, a: 0.003, g: 0.2, tip: 'bandpass', f: [[0, 380 * pp], [0.05, 200]], q: 3.5 });
      gurultu(m, o, t + 0.004, { d: 0.045, a: 0.002, g: 0.22, tip: 'bandpass', f: [[0, ra(1500, 2400)], [0.04, 900]], q: 1.4 });   // 20 Kasım: taş/çakıl ezilmesi
      for (var ai = 0; ai < 2; ai++) gurultu(m, o, t + ra(0.008, 0.04), { d: ra(0.006, 0.012), a: 0.0005, g: ra(0.06, 0.12), tip: 'bandpass', f: ra(2000, 3600), q: 2.5 });
      return 0.11;
    },

    mermi: function (m, o, t, v, p) {
      var tur = v.tur;
      if (tur === 'buyu') {   // uğultu
        ton(m, o, t, { tip: 'sawtooth', f: [[0, 105 * p], [0.6, 112 * p]], d: 0.7, a: 0.08, g: 0.32, lp: 650 });
        ton(m, o, t, { tip: 'sawtooth', f: [[0, 108.5 * p], [0.6, 115 * p]], d: 0.7, a: 0.1, g: 0.32, lp: 650 });
        ton(m, o, t, { f: [[0, 880 * p], [0.6, 1320 * p]], d: 0.6, a: 0.05, g: 0.05, vib: [13, 60] });
        gurultu(m, o, t, { d: 0.6, a: 0.1, g: 0.14, tip: 'bandpass', f: 1500, q: 3 });
        return 0.72;
      }
      if (tur === 'comlek') {   // "hup": kısa homurtu + savrulan hava
        var hg = AYAR.darbe.hup;
        formant(m, o, t, { f: [[0, 120 * p], [0.12, 150 * p], [0.22, 95 * p]], d: 0.24, a: 0.02, g: 0.4 * hg,
          fm: [[480, 5, 1], [950, 6, 0.6], [2300, 8, 0.2]], puruz: [31, 0.6], nefes: 0.15, suruc: 1.6 });
        gurultu(m, o, t + 0.06, { d: 0.3, a: 0.06, g: 0.3 * hg, tip: 'bandpass', f: [[0, 500 * p], [0.15, 1100 * p], [0.3, 400]], q: 1.4 });
        return 0.36;
      }
      if (tur === 'kaya') {   // vınlama
        gurultu(m, o, t, { d: 0.6, a: 0.12, g: 0.6, tip: 'bandpass', f: [[0, 520 * p], [0.6, 230 * p]], q: 2, renk: 'kahve' });
        ton(m, o, t, { f: [[0, 85 * p], [0.6, 58]], d: 0.6, a: 0.12, g: 0.45 });
        return 0.62;
      }
      if (tur === 'buz_mizrak') {
        ton(m, o, t, { tip: 'triangle', f: [[0, 1050 * p], [0.13, 1700 * p], [0.28, 1140 * p]], d: 0.29, a: 0.036, g: 0.12, lp: 2200 });
        gurultu(m, o, t + 0.005, { d: 0.32, a: 0.029, g: 0.29, tip: 'bandpass', f: [[0, 1550 * p], [0.1, 2400 * p], [0.3, 780]], q: 2.3 });
        return 0.34;
      }
      // ok: yay teli + ıslık
      tik(m, o, t, { g: 0.22, f: 1200 });
      ton(m, o, t, { tip: 'triangle', f: [[0, 215 * p], [0.2, 196 * p]], d: 0.22, a: 0.001, g: 0.4 });
      ton(m, o, t, { f: 430 * p, d: 0.12, a: 0.001, g: 0.15 });
      gurultu(m, o, t + 0.02, { d: 0.36, a: 0.05, g: 0.28, tip: 'bandpass', f: [[0, 2900 * p], [0.35, 1900 * p]], q: 7 });
      return 0.4;
    },

    mermiVur: function (m, o, t, v, p) {
      var tur = v.tur;
      if (tur === 'buz_mizrak') {
        catla(m, o, t, { g: 0.28, f: 2380 * p, tf: 1260, d: 0.012 });
        SESLER._ayazCam(m, o, t + 0.012, { f: 590 * p, g: 0.11, d: 0.23 });
        gurultu(m, o, t + 0.018, { d: 0.12, a: 0.005, g: 0.15, tip: 'bandpass', f: [[0, 1960 * p], [0.12, 950]], q: 1.3 });
        return 0.26;
      }
      if (tur === 'comlek') {   // kil kırılması: kuru çatırtı + tok gövde
        var kg = AYAR.darbe.kirilma;
        ton(m, o, t, { f: [[0, 230 * p], [0.06, 110]], d: 0.1, a: 0.001, g: 0.55 * kg, suruc: 1.6 });
        gurultu(m, o, t, { d: 0.09, a: 0.001, g: 0.6 * kg, tip: 'bandpass', f: [[0, 2600 * p], [0.08, 1200]], q: 1.4 });
        for (var ci = 0; ci < 5; ci++) tik(m, o, t + 0.015 + ra(0, 0.12), { g: ra(0.1, 0.25) * kg, f: ra(1500, 4200), d: ra(0.005, 0.015), tip: 'bandpass', q: 3 });
        return 0.25;
      }
      if (tur === 'buyu') {   // cızırtılı sönme
        gurultu(m, o, t, { d: 0.3, a: 0.002, g: 0.4, tip: 'highpass', f: [[0, 600], [0.3, 4000]], q: 0.8 });
        ton(m, o, t, { f: [[0, 660 * p], [0.25, 110]], d: 0.3, a: 0.002, g: 0.22, vib: [30, 80] });
        ton(m, o, t, { f: [[0, 90], [0.2, 45]], d: 0.22, a: 0.001, g: 0.5, suruc: 2 });
        return 0.35;
      }
      if (tur === 'kaya') {   // ezilme + ufalanma
        gurultu(m, o, t, { d: 0.3, a: 0.002, g: 0.7, tip: 'lowpass', f: [[0, 1200], [0.3, 150]], q: 1, renk: 'kahve' });
        ton(m, o, t, { f: [[0, 100 * p], [0.2, 40]], d: 0.3, a: 0.001, g: 0.85, suruc: 3 });
        for (var i = 0; i < 6; i++) tik(m, o, t + 0.04 + ra(0, 0.25), { g: ra(0.08, 0.2), f: ra(900, 3000), d: ra(0.006, 0.02), tip: 'bandpass', q: 3 });
        return 0.4;
      }
      tik(m, o, t, { g: 0.4, f: 2000 });
      gurultu(m, o, t, { d: 0.06, a: 0.001, g: 0.5, tip: 'bandpass', f: [[0, 1400 * p], [0.05, 600]], q: 1.5 });
      ton(m, o, t, { f: [[0, 170 * p], [0.05, 88]], d: 0.07, a: 0.001, g: 0.45 });
      return 0.12;
    },

    atesYak: function (m, o, t, v, p) {   // tutuşma "vuff" (+ ölümde patlama)
      var vg = AYAR.darbe.vuff;
      gurultu(m, o, t, { d: 0.55, a: 0.035, g: 0.6 * vg, tip: 'lowpass', f: [[0, 160], [0.08, 1100 * p], [0.55, 220]], q: 1.1, renk: 'kahve' });
      gurultu(m, o, t + 0.02, { d: 0.5, a: 0.05, g: 0.22 * vg, tip: 'bandpass', f: [[0, 900 * p], [0.5, 2400]], q: 0.9 });
      ton(m, o, t, { f: [[0, 70 * p], [0.3, 42]], d: 0.32, a: 0.02, g: 0.45 * vg });
      if (v.patlama) {
        var pg = AYAR.darbe.patlama;
        bom(m, o, t, { f0: 110 * p, f1: 38, d: 0.45, g: 0.9 * pg, mid0: 220 * p, mid1: 90, midG: 0.4, bg: 0.5 * pg, lp0: 1400, lp1: 120 });
        for (var pi = 0; pi < 8; pi++) tik(m, o, t + 0.05 + ra(0, 0.5), { g: ra(0.08, 0.2) * pg, f: ra(1800, 5000), d: ra(0.004, 0.012), tip: 'bandpass', q: 2.5 });
        return 1.1;
      }
      return 0.6;
    },
    tutus: function (m, o, t, v, p) {   // meşale savruluşu + alev cızırtısı (darbe sesi oyuncuHasar'da)
      var mg = AYAR.darbe.mesale;
      gurultu(m, o, t, { d: 0.32, a: 0.02, g: 0.42 * mg, tip: 'bandpass', f: [[0, 400 * p], [0.12, 1500 * p], [0.32, 600]], q: 1.2, renk: 'kahve' });
      gurultu(m, o, t + 0.05, { d: 0.5, a: 0.04, g: 0.2 * mg, tip: 'highpass', f: [[0, 2200], [0.5, 4500]], q: 0.7 });
      return 0.55;
    },
    citirti: function (m, o, t, v, p) {   // tek çıtırtı kümesi (kısık)
      var cg = AYAR.darbe.citirti;
      for (var i = 0; i < 2 + (R() * 3 | 0); i++) tik(m, o, t + ra(0, 0.12), { g: ra(0.08, 0.22) * cg, f: ra(1600, 5200), d: ra(0.003, 0.01), tip: 'bandpass', q: 2.2 });
      if (R() < 0.35) gurultu(m, o, t, { d: 0.18, a: 0.03, g: 0.08 * cg, tip: 'lowpass', f: 600, q: 0.8, renk: 'kahve' });
      return 0.2;
    },

    varilPatla: function (m, o, t, v, p) {   // Bölüm II yağ varili patlaması: göğüs vurucu alt-bas boom + ahşap parçalanma + harlayan ateş hışırtısı
      var i;
      bom(m, o, t, { f0: 96 * p, f1: 28, d: 0.62, a: 0.002, g: 1.08, mid0: 192 * p, mid1: 68, midG: 0.62, lp: 420, bg: 0.74, lp0: 1200, lp1: 95, suruc: 2.3 });
      ton(m, o, t, { f: [[0, 62 * p], [0.18, 28], [0.58, 22]], d: 0.64, a: 0.003, tut: 0.05, g: 0.76, suruc: 1.8 });
      // ahşap fıçı parçalanma çıtırtısı
      ahsap(m, o, t, { g: 0.78, k: 0.92 * p, d: 0.24 });
      kemik(m, o, t + 0.008, { n: 5, g: 0.24 });
      for (i = 0; i < 6; i++) {
        var tt = t + 0.015 + Math.pow(i / 6, 1.35) * 0.34 + ra(0, 0.02);
        gurultu(m, o, tt, { d: ra(0.018, 0.042), a: 0.0008, g: ra(0.28, 0.52) * (1 - i / 8), tip: 'bandpass', f: [[0, ra(1100, 2500) * p], [0.03, ra(420, 850)]], q: ra(1.4, 2.2) });
        if (i < 4) ton(m, o, tt, { tip: 'triangle', f: [[0, ra(210, 340) * p], [0.028, ra(110, 170)]], d: 0.04, a: 0.0008, g: 0.24 * (1 - i / 6), lp: 520 });
      }
      // harlayan ateş hışırtısı
      gurultu(m, o, t + 0.01, { d: 0.88, a: 0.03, tut: 0.08, g: 0.68, tip: 'lowpass', f: [[0, 240], [0.1, 1650 * p], [0.88, 220]], q: 1.0, renk: 'kahve' });
      gurultu(m, o, t + 0.02, { d: 0.8, a: 0.045, tut: 0.06, g: 0.38, tip: 'bandpass', f: [[0, 850 * p], [0.14, 2800 * p], [0.8, 900]], q: 0.9 });
      for (i = 0; i < 7; i++) tik(m, o, t + 0.08 + ra(0, 0.58), { g: ra(0.08, 0.22), f: ra(1900, 4800), d: ra(0.004, 0.012), tip: 'bandpass', q: 2.3 });
      return 1.15;
    },

    totemKir: function (m, o, t, v, p) {   // Bölüm II kor totemi kırılması: yankılı taş/rün çatlaması + yüksek kristal-ateş sönme sesi
      var i;
      bom(m, o, t, { f0: 96 * p, f1: 34, d: 0.34, g: 0.85, mid0: 195 * p, mid1: 76, midG: 0.48, lp: 460, bg: 0.58, lp0: 1150, lp1: 120, suruc: 1.9 });
      gurultu(m, o, t, { d: 0.048, a: 0.0006, g: 3.4, tip: 'bandpass', f: [[0, 1950 * p], [0.044, 620 * p]], q: 0.95 });   // taş "KRAK"
      kemik(m, o, t + 0.006, { n: 4, g: 0.2 });
      for (i = 0; i < 6; i++) {
        var tt = t + 0.05 + Math.pow(i / 6, 1.35) * 0.35 + ra(0, 0.015);
        gurultu(m, o, tt, { d: ra(0.014, 0.032), a: 0.0008, g: ra(0.22, 0.4) * (1 - i / 8), tip: 'bandpass', f: ra(750, 2200), q: ra(1.8, 3.2) });   // taş dökülmesi
      }
      // rün enerjisi kırılır
      ton(m, o, t, { tip: 'sawtooth', f: [[0, 220 * p], [0.16, 165 * p], [0.65, 72 * p]], det: -8, d: 0.7, a: 0.008, g: 0.18, lp: [[0, 1600], [0.65, 240]], lpq: 3.5, suruc: 1.3 });
      ton(m, o, t, { tip: 'sawtooth', f: [[0, 224 * p], [0.16, 168 * p], [0.65, 74 * p]], det: 11, d: 0.7, a: 0.008, g: 0.16, lp: [[0, 1600], [0.65, 240]], lpq: 3.5 });
      // yüksek kristal-ateş sönme sesi
      var KR = [1, 1.52, 2.38, 3.41], KA = [1, 0.65, 0.42, 0.25], kf = 1480 * p;
      for (i = 0; i < KR.length; i++) {
        var fj = kf * KR[i] * ra(0.985, 1.015);
        ton(m, o, t + 0.01 + i * 0.015, { f: [[0, fj], [0.45, fj * 0.94]], d: 0.62 * (1 - i * 0.14), a: 0.003, g: 0.08 * KA[i], vib: [8, fj * 0.004] });
      }
      gurultu(m, o, t + 0.025, { d: 0.56, a: 0.01, tut: 0.04, g: 0.48, tip: 'bandpass', f: [[0, 4200 * p], [0.18, 2200 * p], [0.55, 620]], q: 2.2 });
      gurultu(m, o, t + 0.04, { d: 0.45, a: 0.015, g: 0.28, tip: 'highpass', f: [[0, 3200], [0.45, 5800]], q: 0.8 });
      ton(m, o, t + 0.03, { f: [[0, 1950 * p], [0.38, 420 * p]], d: 0.42, a: 0.005, g: 0.11, vib: [26, 45] });
      return 0.95;
    },

    kozYan: function (m, o, t, v, p) {   // Bölüm II köz çukuru: kısa keskin köz cızırtısı
      gurultu(m, o, t, { d: 0.15, a: 0.002, tut: 0.018, g: 0.52, tip: 'highpass', f: [[0, 2800 * p], [0.14, 5400]], q: 1.1 });
      gurultu(m, o, t, { d: 0.12, a: 0.001, g: 0.45, tip: 'bandpass', f: [[0, 2100 * p], [0.1, 1100 * p]], q: 1.8 });
      ton(m, o, t, { f: [[0, 340 * p], [0.025, 130]], d: 0.045, a: 0.0008, g: 0.24, suruc: 1.4 });
      for (var i = 0; i < 3; i++) tik(m, o, t + i * ra(0.018, 0.035), { g: ra(0.2, 0.38), f: ra(2600, 5800) * p, d: ra(0.003, 0.007), tip: 'bandpass', q: 2.5 });
      return 0.2;
    },

    sifa: function (m, o, t, v, p) {   // ürkütücü, alçak parıltı
      ton(m, o, t, { f: 98 * p, d: 1.6, a: 0.5, tut: 0.35, g: 0.35 });
      ton(m, o, t, { f: 138.6 * p, d: 1.5, a: 0.55, tut: 0.3, g: 0.2 });   // küçük yedili/ triton: tekinsiz
      var fs = [1175, 1480, 1760, 2217];
      for (var i = 0; i < fs.length; i++) ton(m, o, t + ra(0, 0.2), { f: fs[i] * p * ra(0.995, 1.005), d: ra(1.0, 1.4), a: ra(0.3, 0.6), g: 0.035, vib: [ra(5, 8), fs[i] * 0.004] });
      gurultu(m, o, t, { d: 1.3, a: 0.5, g: 0.05, tip: 'highpass', f: 5000, q: 0.7 });
      return 1.65;
    },

    ofke: function (m, o, t, v, p) {
      var ses = m.c.createBufferSource();
      ses.buffer = m.nara || (m.nara = pcmTampon(m.c, OFKE_NARA_PCM));
      ses.playbackRate.value = p * 0.92;
      ses.connect(o);
      ses.start(t);
      return ses.buffer.duration / ses.playbackRate.value;
    },

    kasirga: function (m, o, t, v, p) {
      var ses = m.c.createBufferSource();
      ses.buffer = m.agirBalta || (m.agirBalta = pcmTampon(m.c, AGIR_BALTA_PCM));
      ses.playbackRate.value = p;
      ses.connect(o);
      ses.start(t);
      return ses.buffer.duration / p;
    },

    kalp: function (m, o, t, v, p) {   // öfke süresince kalp atışı (lub-dub)
      ton(m, o, t, { f: [[0, 62], [0.1, 38]], d: 0.16, a: 0.002, g: 0.8, suruc: 1.5 });
      ton(m, o, t + 0.17, { f: [[0, 56], [0.1, 36]], d: 0.14, a: 0.002, g: 0.5, suruc: 1.5 });
      return 0.34;
    },

    dalga: function (m, o, t, v, p) {   // Dalga duyurusu bölümün kendi sazından kısa bir işaret.
      if (m.bolum === 3) {
        SESLER._ayazCam(m, o, t, { f: 659.25 * p, d: 0.68, g: 0.23 });
        SESLER._ayazKaval(m, o, t + 0.21, { f: 493.88 * p, d: 0.58, g: 0.29 });
      } else if (m.bolum === 2) {
        SESLER._madenOrs(m, o, t, { g: 0.34, k: 0.91, d: 0.48 });
        SESLER._kulMetal(m, o, t + 0.23, { f: 130.81 * p, d: 0.53, g: 0.32 });
      } else {
        SESLER._yanikDeri(m, o, t, { f: 77, g: 0.46 });
        SESLER._yanikKamis(m, o, t + 0.08, { f: 146.83 * p, d: 0.41, g: 0.29 });
        SESLER._yanikKamis(m, o, t + 0.41, { f: 174.61 * p, d: 0.37, g: 0.22, uzak: true });
      }
      return 0.97;
    },

    arena: function (m, o, t, v, p) {
      var bolum = m.bolum;
      if (v.acik === false) {
        var kilit = bolum === 3 ? 0.38 : 0.57;
        davul(m, o, t, bolum === 2 ? 62 : 68, 0.67);
        davul(m, o, t + kilit, bolum === 2 ? 48 : 54, 0.81, 1.28);
        gurultu(m, o, t, { d: 0.79, a: 0.17, g: 0.43, tip: 'lowpass', f: 155, q: 0.8, renk: 'kahve' });
        islak(m, o, t + kilit, { g: 0.23, f: 1400, n: 3, yay: 0.10, tok: 0.38, tokF: 520 });
        if (bolum === 3) {
          SESLER._ayazZincir(m, o, t + kilit, { g: 0.28, agir: false });
          SESLER._ayazYay(m, o, t + kilit + 0.07, { f: 164.81, d: 0.69, g: 0.28, sert: 0.55 });
        } else if (bolum === 2) {
          SESLER._madenOrs(m, o, t + kilit, { g: 0.34, k: 0.87, d: 0.76 });
          SESLER._kulMetal(m, o, t + kilit + 0.14, { f: 92.5, d: 0.40, g: 0.26 });
        } else SESLER._yanikKamis(m, o, t + kilit + 0.04, { f: 110, d: 0.75, g: 0.29 });
        return 1.48;
      }
      if (bolum === 3) SESLER._ayazCam(m, o, t, { f: 493.88 * p, d: 0.71, g: 0.25 });
      else if (bolum === 2) SESLER._kulMetal(m, o, t, { f: 130.81 * p, d: 0.65, g: 0.32 });
      else SESLER._yanikKamis(m, o, t, { f: 146.83 * p, d: 0.66, g: 0.34, uzak: true });
      return 0.90;
    },

    devBasla: function (m, o, t, v, p) {
      if (m.bolum === 3 || v.bolum === 3) {
        bom(m, o, t + 0.12, { f0: 66, f1: 30, d: 0.52, g: 0.78, mid0: 153, mid1: 57, bg: 0.37 });
        SESLER._ayazZincir(m, o, t + 0.23, { g: 0.51, agir: true });
        SESLER._ayazYay(m, o, t + 0.48, { f: 82.41, d: 1.72, g: 0.48, sert: 0.86 });
        SESLER._ayazYay(m, o, t + 0.58, { f: 116.54, d: 1.55, g: 0.24, sert: 0.47 });
        return 2.29;
      }
      var vargor = m.bolum === 2 || v.bolum === 2 || v.tur === 'vargor';
      formant(m, o, t, { f: [[0, (vargor ? 44 : 48) * p], [0.4, (vargor ? 54 : 58) * p], [2.6, 36 * p]], d: 3, a: 0.35, g: 0.75,
        fm: [[260, 3, 0.9], [560, 4, 1.05], [1100, 5, 0.7], [2200, 6, 0.18]], titreme: [3, 2], puruz: [19, 0.85], nefes: 0.3, suruc: 2.5 });
      ton(m, o, t, { f: [[0, 40], [3, 28]], d: 3, a: 0.5, g: 0.55 });
      gurultu(m, o, t, { d: 3, a: 0.6, g: 0.5, tip: 'lowpass', f: vargor ? 150 : 120, q: 0.8, renk: 'kahve' });
      SESLER.devAdim(m, o, t + 0.05, {}, p);                         // giriş: yere basan ağır ayak
      if (vargor) SESLER._madenOrs(m, o, t + 0.16, { g: 0.4, k: 0.84, d: 1.5 });   // Vargor: ağır maden örsü darbesi
      SESLER._vurgu(m, o, t + 0.4, { dev: true, d: 2.2, bolum: vargor ? 2 : 1 });           // tekinsiz boru akoru
      return 3.05;
    },

    devAdim: function (m, o, t, v, p) {   // devin ağır adımı: yer titrer (alt uç) + toprak ezilmesi (duyulan orta)
      m.devSol = !m.devSol; var pp = p * (m.devSol ? 0.94 : 1.06), h = v.hizli ? 1.15 : 1;
      bom(m, o, t, { f0: 58 * pp, f1: 27, d: 0.26, g: 0.86 * h, mid0: 118 * pp, mid1: 54, midG: 0.5, lp: 300, bg: 0.6, lp0: 520, lp1: 80, suruc: 2 });
      gurultu(m, o, t + 0.006, { d: 0.1, a: 0.002, tut: 0.016, g: 1.2, tip: 'bandpass', f: [[0, 620 * pp], [0.09, 260]], q: 1.2 });
      for (var i = 0; i < 3; i++) gurultu(m, o, t + 0.012 + i * ra(0.012, 0.03), { d: ra(0.01, 0.02), a: 0.0006, g: ra(0.08, 0.14), tip: 'bandpass', f: ra(1200, 2600), q: 2 });
      return 0.3;
    },
    devKukre: function (m, o, t, v, p) {   // evre geçişi / hücum öncesi kükreme: devBasla'dan kısa
      var kisa = !!v.kisa, d = kisa ? 0.95 : 1.5;
      formant(m, o, t, { f: [[0, 52 * p], [0.25, 64 * p], [d, 40 * p]], d: d, a: 0.12, g: 0.72,
        fm: [[300, 3, 0.85], [640, 4, 1.1], [1250, 5, 0.75], [2400, 6, 0.2]], titreme: [4, 3], puruz: [21, 0.85], nefes: 0.32, suruc: 2.5 });
      ton(m, o, t, { f: [[0, 44], [d, 30]], d: d, a: 0.2, g: 0.5, suruc: 1.6 });
      gurultu(m, o, t, { d: d, a: 0.25, g: 0.4, tip: 'lowpass', f: 140, q: 0.8, renk: 'kahve' });
      return d + 0.05;
    },
    devSopa: function (m, o, t, v, p) {   // dev sopası yere/havaya iner: ağır darbe + toprak/taş
      vuus(m, o, t - 0.0, { d: 0.18, k: 0.55 * p, g: 0.5, hava: 0.1 });
      bom(m, o, t + 0.02, { f0: 64 * p, f1: 25, d: 0.55, g: 1.0, mid0: 135 * p, mid1: 56, midG: 0.6, lp: 360, bg: 0.72, lp0: 900, lp1: 80, suruc: 2.1 });
      islak(m, o, t + 0.02, { g: 0.36, f: 1600 * p, n: 3, yay: 0.08, tok: 0.9, tokF: 620 });
      gurultu(m, o, t + 0.03, { d: 0.4, a: 0.01, tut: 0.05, g: 0.6, tip: 'bandpass', f: [[0, 800], [0.35, 280]], q: 0.9 });   // ahşap/toprak "TOK"
      for (var i = 0; i < 6; i++) gurultu(m, o, t + 0.06 + Math.pow(i / 6, 1.4) * 0.45, { d: ra(0.012, 0.03), a: 0.002, g: ra(0.08, 0.18), tip: 'bandpass', f: ra(700, 2200), q: ra(2, 3.5) });
      return 0.7;
    },

    devYereVur: function (m, o, t, v, p) {   // yer sarsan derin patlama + taş dökülmesi
      var duvar = !!v.duvar, olum = !!v.olum;
      if (olum) bom(m, o, t + 0.02, { f0: 46 * p, f1: 21, d: 1.4, g: 0.85, mid0: 96 * p, mid1: 44, midG: 0.45, lp: 260, suruc: 1.8 });   // dev yere serilir: uzun yer titremesi
      bom(m, o, t, { f0: (duvar ? 78 : 68) * p, f1: 26, d: 0.92, g: 1.0, mid0: (duvar ? 165 : 145) * p, mid1: 58, midG: 0.62, lp: 380, bg: 0.78, lp0: duvar ? 1400 : 1150, lp1: 75, suruc: 2.2 });
      // duyulan orta: yer yarılması "KRAK" + taş ezilmesi (uzak/küçük hoparlörde de)
      islak(m, o, t, { g: 0.4, f: 1500 * p, n: 4, yay: 0.1, tok: 0.62, tokF: 560, kuyruk: 0.35 });
      gurultu(m, o, t + 0.01, { d: 0.5, a: 0.01, tut: 0.07, g: 0.75, tip: 'bandpass', f: [[0, 900], [0.45, 300]], q: 0.9 });
      gurultu(m, o, t, { d: 1.05, a: 0.003, g: 0.56, tip: 'lowpass', f: [[0, duvar ? 2100 : 1750], [0.9, 85]], q: 0.85 });
      tik(m, o, t, { g: duvar ? 0.34 : 0.28, f: duvar ? 1200 : 1000, d: 0.009 });
      gurultu(m, o, t, { d: 1.3, a: 0.02, g: 0.48, tip: 'lowpass', f: 180, q: 0.7, renk: 'kahve' });
      for (var i = 0; i < 12; i++) {
        var tt = t + 0.12 + Math.pow(i / 12, 1.55) * 1.15;
        gurultu(m, o, tt, { d: ra(0.012, 0.034), a: 0.002, g: ra(0.1, 0.26) * (1 - i / 16), tip: 'bandpass', f: ra(750, 2400), q: ra(2, 4.2) });
      }
      return 1.45;
    },

    devKaya: function (m, o, t, v, p) {   // ağır kaya düşüşü: derin yer darbesi + taş kırılması
      bom(m, o, t, { f0: 82 * p, f1: 30, d: 0.4, g: 0.94, mid0: 170 * p, mid1: 72, midG: 0.54, lp: 420, bg: 0.68, lp0: 1050, lp1: 110, suruc: 2 });
      tik(m, o, t, { g: 0.26, f: 1150, d: 0.007 });
      islak(m, o, t, { g: 0.34, f: 1700 * p, n: 3, yay: 0.08, tok: 0.9, tokF: 640 });   // taş çatlaması (orta)
      kemik(m, o, t + 0.015, { n: 3, g: 0.2 });
      for (var i = 0; i < 6; i++) {
        tik(m, o, t + 0.04 + i * 0.035 + ra(0, 0.02), { g: ra(0.12, 0.22), f: ra(750, 2200), d: ra(0.005, 0.015), tip: 'bandpass', q: 2.6 });
      }
      return 0.55;
    },

    devOldu: function (m, o, t, v, p) {   // uzun çöküş
      var vargor = m.bolum === 2 || v.bolum === 2 || v.tur === 'vargor';
      formant(m, o, t, { f: [[0, 60 * p], [0.5, 52 * p], [2.0, 28 * p]], d: 2.2, a: 0.2, g: 0.7,
        fm: [[280, 3, 1], [600, 4, 0.7], [1200, 5, 0.3]], puruz: [15, 0.8], nefes: 0.35, suruc: 2 });
      // öldüren darbe anı: derin çöküş (gövdenin yere çarpışı dev.js'ten ayrı 'devYereVur' olum:true ile gelir)
      bom(m, o, t, { f0: 60 * p, f1: 24, d: 0.6, g: 0.9, mid0: 125 * p, mid1: 52, midG: 0.55, lp: 320, bg: 0.6, lp0: 700, lp1: 80, suruc: 2 });
      islak(m, o, t, { g: 0.5, f: 1900 * p, n: 5, yay: 0.1, tok: 0.7, tokF: 700, kuyruk: 0.45 });
      kemik(m, o, t + 0.02, { n: 5, g: 0.3 });
      if (vargor) cang(m, o, t + 0.08, { g: 0.36, d: 0.65, k: 1.25 * p, parlak: 0.85, alt: 1.4 });
      return 2.3;
    },

    oyuncuOldu: function (m, o, t, v, p) {   // ağır çöküş + zırh/balta düşmesi + karanlık re minör
      ton(m, o, t, { f: [[0, 92], [0.4, 28]], d: 0.62, a: 0.001, g: 1, suruc: 3 });
      gurultu(m, o, t, { d: 0.52, a: 0.002, g: 0.58, tip: 'lowpass', f: [[0, 920], [0.5, 95]], q: 1, renk: 'kahve' });
      formant(m, o, t + 0.05, { f: [[0, 122], [0.85, 64]], d: 0.95, a: 0.05, g: 0.36, fm: [[500, 5, 1], [900, 6, 0.6]], puruz: [25, 0.5], nefes: 0.26 });
      ton(m, o, t + 0.14, { f: [[0, 68], [0.16, 32]], d: 0.24, a: 0.002, g: 0.55, suruc: 2.2 });   // diz/gövde yere çarpışı
      metal(m, o, t + 0.16, { f: 380, oran: [1, 2.38, 3.9], amp: [1, 0.5, 0.25], son: [1, 0.65, 0.4], g: 0.08, d: 0.55 });   // balta/zırh sekmesi
      var fs = [55, 73.42, 87.31, 110];   // karanlık re minör
      var det = [-9, 5, -4, 11];
      for (var i = 0; i < fs.length; i++) ton(m, o, t + 0.28, { tip: 'sawtooth', f: fs[i], det: det[i], d: 2.95, a: 0.55, tut: 0.65, g: i === 3 ? 0.08 : 0.13, lp: [[0, 620], [1.2, 340], [2.95, 140]] });
      return 3.28;
    },

    kazandi: function (m, o, t, v, p) {
      if (m.bolum === 3 || v.bolum === 3) {
        davul(m, o, t, 51, 0.67, 1.34);
        SESLER._ayazYay(m, o, t + 0.07, { f: 164.81, d: 1.40, g: 0.27 });
        SESLER._ayazYay(m, o, t + 0.46, { f: 246.94, d: 1.83, g: 0.17 });
        SESLER._ayazCam(m, o, t + 0.73, { f: 329.63, d: 1.77, g: 0.17 });
        SESLER._ayazCam(m, o, t + 1.07, { f: 493.88, d: 1.35, g: 0.08 });
        return 2.55;
      }
      davul(m, o, t, 58, 0.92, 1.45);
      var a1 = [58.27, 87.31, 116.54, 146.83], a2 = [73.42, 110, 146.83, 185, 220], i;
      for (i = 0; i < 4; i++) boru(m, o, t + 0.02, a1[i], 0.72, 0.16, false);
      for (i = 0; i < 5; i++) boru(m, o, t + 0.6, a2[i], 2.15, i === 4 ? 0.09 : 0.17, false);
      davul(m, o, t + 0.6, 52, 1, 1.55);
      metal(m, o, t + 0.6, { f: 440, oran: [1, 2.41, 4.02], amp: [1, 0.55, 0.3], son: [1, 0.7, 0.45], g: 0.06, d: 1.4 });
      return 2.82;
    },

    tik: function (m, o, t, v, p) {   // arayüz tıkı
      ton(m, o, t, { f: [[0, 1100 * p], [0.03, 700 * p]], d: 0.04, a: 0.001, g: 0.3 });
      tik(m, o, t, { g: 0.25, f: 3000 });
      return 0.05;
    },

    topla: function (m, o, t, v, p) {   // can şişesi alma: cam tıkırtısı + sıcak canlanma tınısı
      tik(m, o, t, { g: 0.35, f: 3400, d: 0.004 });
      metal(m, o, t, { f: 1480 * p, oran: [1, 2.24, 3.6], amp: [1, 0.45, 0.2], son: [1, 0.55, 0.35], g: 0.14, d: 0.28 });
      ton(m, o, t + 0.03, { f: [[0, 220 * p], [0.18, 330 * p], [0.42, 440 * p]], d: 0.48, a: 0.02, g: 0.28, lp: 900 });
      ton(m, o, t + 0.08, { f: [[0, 330 * p], [0.22, 495 * p]], d: 0.42, a: 0.03, g: 0.16 });
      return 0.55;
    },

    ayazBuzKir: function (m, o, t, v, p) {
      bom(m, o, t, { f0: 118 * p, f1: 37, d: 0.26, g: 0.3, mid0: 207, mid1: 87, midG: 0.22, lp: 440 });
      catla(m, o, t + 0.009, { g: 0.56, f: 3100 * p, tf: 1170, d: 0.018 });
      for (var i = 0; i < 7; i++) {
        var d = ra(0.034, 0.085), z = t + 0.037 + i * ra(0.017, 0.032), f = ra(1200, 2900) * p;
        gurultu(m, o, z, { d: d, a: 0.002, g: 0.26 * (1 - i * 0.085), tip: 'bandpass', f: [[0, f], [d, f * 0.63]], q: 1.8 });
        if (i % 2 === 0) SESLER._ayazCam(m, o, z + 0.02, { f: f * 0.39, g: 0.04, d: 0.21 });
      }
      return 0.59;
    },
    skarnZincir: function (m, o, t, v, p) {
      var g = v.takildi ? 0.6 : v.kirildi ? 0.50 : v.isabet ? 0.50 : 0.34;
      var f = (v.kirildi ? 73 : 94) * p;
      SESLER._ayazZincir(m, o, t, { g: g, agir: !!(v.takildi || v.kirildi) });
      gurultu(m, o, t + 0.035, { d: 0.28, a: 0.021, g: g * 0.56, tip: 'bandpass', f: [[0, 2450], [0.18, 590]], q: 1.5 });
      if (v.takildi || v.kirildi) {
        bom(m, o, t + 0.08, { f0: f, f1: 31, d: 0.37, g: g * 0.74, mid0: 184, mid1: 69, lp: 360, bg: 0.23 });
        SESLER._ayazCam(m, o, t + 0.12, { f: 375 * p, g: g * 0.18, d: 0.62 });
      }
      return 0.79;
    },

    ayazZincirKes: function (m, o, t, v, p) {
      return SESLER.skarnZincir(m, o, t, { kirildi: true }, p);
    },

    ayazBotBas: function (m, o, t, v, p) {
      var src = m.c.createBufferSource();
      src.buffer = ayazBotTampon(m.c, !!v.agir);
      src.playbackRate.value = p;
      src.connect(o); src.start(t);
      return src.buffer.duration / p;
    },

    skarnZeminTemas: function (m, o, t, v, p) {
      // Yeniden üretilecek doku yok: ağır bot tamponu pes çalınır, altta kısa gövde darbesi.
      SESLER.ayazBotBas(m, o, t, { agir: true }, p * 0.66);
      ton(m, o, t + 0.006, { tip: 'triangle', f: [[0, 87], [0.055, 48], [0.17, 40]],
        d: 0.178, a: 0.007, g: 0.32, lp: 360 });
      return 0.205;
    },

    ayazKurtHazir: function (m, o, t, v, p) {
      gurultu(m, o, t, { d: 0.30, a: 0.035, g: 0.52, tip: 'bandpass', f: [[0, 312 * p], [0.12, 395 * p], [0.30, 205]], q: 1.3, renk: 'kahve' });
      ton(m, o, t + 0.02, { tip: 'triangle', f: [[0, 83 * p], [0.10, 101 * p], [0.26, 61 * p]], d: 0.27, a: 0.034, g: 0.15, lp: 415, vib: [27, 19] });
      gurultu(m, o, t + 0.041, { d: 0.17, a: 0.014, g: 0.31, tip: 'bandpass', f: [[0, 1020 * p], [0.16, 540]], q: 1.4 });
      return 0.32;
    },

    // ── ortam / müzik parçaları (zamanlayıcı çağırır) ──
    _citir: function (m, o, t) {   // ateş çıtırtısı
      if (R() < 0.12) gurultu(m, o, t, { d: ra(0.015, 0.03), a: 0.001, g: ra(0.25, 0.5), tip: 'bandpass', f: ra(500, 800), q: 1.5 });
      else tik(m, o, t, { g: ra(0.08, 0.35), f: ra(1500, 4500), d: ra(0.002, 0.008), tip: 'bandpass', q: 2 });
      return 0.05;
    },
    _karga: function (m, o, t, v, p) {   // uzak karga / çığlık
      if (R() < 0.25) {
        formant(m, o, t, { f: [[0, 820 * p], [0.15, 980 * p], [0.9, 520 * p]], d: 1.0, a: 0.1, g: 0.18, fm: [[1100, 6, 1], [2600, 8, 0.4]], titreme: [6, 18], puruz: [40, 0.3] });
        return 1.05;
      }
      var n = 2 + Math.floor(R() * 2);
      for (var i = 0; i < n; i++) {
        formant(m, o, t + i * ra(0.32, 0.42), { f: [[0, 640 * p], [0.22, 520 * p]], d: 0.24, a: 0.01, g: 0.25, fm: [[1300, 5, 1], [2500, 6, 0.5]], puruz: [70, 0.7], nefes: 0.05 });
      }
      return n * 0.42 + 0.3;
    },
    _davul: function (m, o, t, v) {
      var f = v.f || 58, g = v.g || .8, uzunluk = v.uz || 1;
      davul(m, o, t, f, g, uzunluk);
      // Drum skin and a low body note keep the impact audible on small speakers.
      ton(m, o, t + .014, {
        tip: 'triangle', f: [[0, f * 3.45], [.13, f * 1.76], [.31, f * 1.47]],
        d: .34 * Math.min(uzunluk, 1.4), a: .004, g: g * .43, lp: [[0, 780], [.30, 220]], suruc: 1.2
      });
      gurultu(m, o, t, { d: .105, a: .001, g: g * .15, tip: 'bandpass', f: [[0, 1050], [.09, 430]], q: 1.2 });
      return .65 * uzunluk;
    },
    _tom: function (m, o, t, v) {
      ton(m, o, t, { f: [[0, (v.f || 110) * 1.6], [0.04, v.f || 110], [0.3, (v.f || 110) * 0.85]], d: 0.32, a: 0.002, g: v.g || 0.4, suruc: 1.4 });
      gurultu(m, o, t, { d: 0.06, a: 0.001, g: (v.g || 0.4) * 0.3, tip: 'bandpass', f: 1200, q: 1 });
      return 0.35;
    },
    _vurgu: function (m, o, t, v) {   // arena kilidi / dev girişi vurgusu: derin vuruş + karanlık boru akoru
      var b2 = v.bolum === 2 || m.bolum === 2;
      davul(m, o, t, b2 ? 42 : 46, 1, 1.6);
      if (b2) {
        boru(m, o, t + 0.02, 65.41, v.d || 1.6, 0.34, false);
        boru(m, o, t + 0.02, 98.00, v.d || 1.6, 0.22, false);
        boru(m, o, t + 0.02, v.dev ? 92.50 : 69.30, (v.d || 1.6) * 0.9, 0.2, false);   // Vargor: triton (Gb2), arena: Db2 Frigya
        if (!v.dev) SESLER._madenOrs(m, o, t + 0.04, { g: 0.26, k: 0.9, d: 1.1 });
      } else {
        boru(m, o, t + 0.02, 73.42, v.d || 1.6, 0.34, false);
        boru(m, o, t + 0.02, 110, v.d || 1.6, 0.22, false);
        boru(m, o, t + 0.02, v.dev ? 103.83 : 87.31, (v.d || 1.6) * 0.9, 0.18, false);   // dev: triton (tekinsiz), arena: minör
      }
      return (v.d || 1.6) + 0.1;
    },
    _tak: function (m, o, t, v) {   // çubuk / davul kenarı "tak": kuru, kısa (3. davul rengi)
      var g = v.g || 0.2;
      gurultu(m, o, t, { d: 0.035, a: 0.0006, g: g * 2.2, tip: 'bandpass', f: [[0, 1900 * ra(0.9, 1.1)], [0.03, 1200]], q: 2.2 });
      ton(m, o, t, { tip: 'triangle', f: [[0, 520 * ra(0.95, 1.05)], [0.03, 380]], d: 0.05, a: 0.0008, g: g * 0.6 });
      return 0.06;
    },

    // Yanık Köy: kamışın nefesi, kuru derili davul ve bağırsağa sarılmış tel.
    _yanikKamis: function (m, o, t, v) {
      var f = v.f, d = v.d, g = v.g;
      formant(m, o, t, {
        f: [[0, f * 0.985], [0.065, f], [d, f * 0.995]], d: d,
        a: Math.min(v.uzak ? 0.095 : 0.04, d * 0.32), tut: d * 0.52, g: g * 0.75,
        kaynak: 'triangle', kay: 5, fm: [[f, 2.1, 0.92], [f * 3, 3.3, 0.30], [f * 5, 5.4, 0.19]],
        titreme: [5.1, f * 0.006], nefes: g * 0.11
      });
      return d + 0.05;
    },
    _yanikTel: function (m, o, t, v) {
      var f = v.f, d = v.d, g = v.g;
      ton(m, o, t, { tip: 'triangle', f: f, d: d, a: 0.009, tut: d * 0.15, g: g * 0.88, lp: 560 });
      ton(m, o, t + 0.008, { f: f * 2, d: d * 0.63, a: 0.008, g: g * 0.31 });
      gurultu(m, o, t, { d: 0.045, a: 0.003, g: g * 0.13, f: 1250, q: 1 });
      return d + 0.05;
    },
    _yanikDeri: function (m, o, t, v) {
      var g = v.g, f = v.f || 122, d = f < 90 ? 0.37 : 0.18;
      ton(m, o, t, { f: [[0, f * 1.38], [0.034, f], [d, f * 0.87]], d: d, a: 0.003, g: g * 0.72 });
      gurultu(m, o, t + 0.002, { d: d * 0.67, a: 0.002, g: g * 0.39, f: [[0, 810], [d * 0.60, 290]], q: 1.15 });
      return d + 0.05;
    },
    // Kül Geçidi: sıcak bronz tokmağı ve kısa, koyu demir teller.
    _kulMetal: function (m, o, t, v) {
      var f = v.f, d = v.d, g = v.g, uzun = Math.min(1.2, d * 1.33);
      metal(m, o, t, { f: f, g: g * 0.69, d: uzun, oran: [1, 2, 3.04, 4.23], amp: [1, 0.36, 0.17, 0.13], son: [1, 0.75, 0.51, 0.27] });
      ton(m, o, t + 0.006, { tip: 'triangle', f: f * 0.5, d: d * 0.72, a: 0.008, g: g * 0.39 });
      gurultu(m, o, t, { d: 0.035, a: 0.001, g: g * 0.15, f: 1230 + f, q: 1.9 });
      return uzun + 0.05;
    },
    _kulTel: function (m, o, t, v) {
      var f = v.f, d = v.d, g = v.g, sert = v.sert || 0;
      ton(m, o, t, { tip: 'square', f: [[0, f * 1.02], [0.018, f]], det: -3,
        d: d, a: 0.014, tut: d * 0.34, g: g * 0.70, lp: [[0, 750 + sert * 450], [d, 210]], lpq: 1.35 });
      ton(m, o, t + 0.007, { tip: 'triangle', f: f * 2, det: 4, d: d * 0.83, a: 0.012, g: g * 0.29 });
      return d + 0.05;
    },
    // Ayaz: yüksek nefesli hat, alttan yavaş yükselen yay ve vurguda cam.
    _ayazKaval: function (m, o, t, v) {
      var f = v.f, d = v.d, g = v.g;
      ton(m, o, t, { f: [[0, f * 0.989], [0.06, f], [d, f * 0.999]], d: d,
        a: Math.min(0.09, d * 0.32), tut: d * 0.55, g: g * 0.76, vib: [5.5, f * 0.0035] });
      ton(m, o, t + 0.021, { tip: 'triangle', f: f, det: 8, d: d * 0.91,
        a: Math.min(0.10, d * 0.30), tut: d * 0.32, g: g * 0.35, lp: [[0, f * 2], [d, f * 2.5]] });
      gurultu(m, o, t + 0.014, { d: d * 0.91, a: 0.065, tut: d * 0.41, g: g * 0.26, f: f * 3.4, q: 2.3 });
      return d + 0.06;
    },
    _ayazBas: function (m, o, t, v) {
      var d = v.d, f = v.f, g = v.g;
      ton(m, o, t, { tip: 'triangle', f: f, d: d, a: Math.min(0.22, d * 0.25), tut: d * 0.49, g: g * 0.88, lp: 700, vib: [4.3, f * 0.003] });
      ton(m, o, t + 0.029, { tip: 'sawtooth', f: f * 2, det: -5, d: d * 0.85,
        a: Math.min(0.18, d * 0.23), tut: d * 0.31, g: g * 0.42, lp: [[0, 390], [d * 0.46, 820], [d, 410]] });
      return d + 0.05;
    },


    _temaBoru: function (m, o, t, v) {
      var f = v.f, d = v.d, g = v.g, atak = v.uzak ? .14 : .055;
      // Detuned brass voices and a quiet lower horn give the tune a playable attack.
      for (var i = 0; i < 2; i++) {
        ton(m, o, t, { tip: 'sawtooth', f: [[0, f * .986], [.045, f]], det: i ? 6 : -5,
          d: d, a: Math.min(atak, d * .28), tut: d * .46, g: g * (i ? .47 : .53),
          lp: [[0, 395], [Math.min(d * .32, .12), v.uzak ? 1050 : 1750], [d, 520]], lpq: 1.25 });
      }
      ton(m, o, t, { tip: 'triangle', f: f * .5, d: d * .9, a: Math.min(.075, d * .2), g: g * .44 });
      if (!v.uzak) {
        ton(m, o, t + .012, { tip: 'square', f: f, det: -11, d: d * .92,
          a: Math.min(.08, d * .22), tut: d * .42, g: g * .23,
          lp: [[0, 440], [Math.min(.12, d * .28), 1100], [d, 370]], lpq: 1.1 });
      }
      return d + .035;
    },
    _ayazYay: function (m, o, t, v) {
      var f = v.f, d = v.d, g = v.g, sert = v.sert || 0;
      // Yay tınısı, çift tel ve orta bantta yay sürtünmesi.
      for (var i = 0; i < 2; i++) ton(m, o, t + i * 0.012, {
        tip: 'triangle', f: [[0, f * 0.992], [0.055, f]], det: i ? 7 : -5,
        d: d, a: Math.min(0.10 - sert * 0.045, d * 0.26), tut: d * 0.48, g: g * (i ? 0.38 : 0.69),
        lp: [[0, 360], [Math.min(d * 0.29, 0.14), 850 + sert * 730], [d, 520]], lpq: 1.2,
        vib: [4.8 + i * 0.4, f * 0.0038]
      });
      gurultu(m, o, t + 0.018, { d: d * 0.95, a: 0.045, tut: d * 0.4, g: g * (0.16 + sert * 0.12), tip: 'bandpass', f: 1150 + sert * 460, q: 1.15 });
      if (sert) ton(m, o, t + 0.015, { tip: 'sawtooth', f: f / 2, d: d * 0.92, a: 0.036, tut: d * 0.37, g: g * 0.42 * sert, lp: 540 + sert * 490 });
      return d + 0.045;
    },
    _ayazCam: function (m, o, t, v) {
      metal(m, o, t, { f: v.f, g: v.g, d: v.d || 0.95, oran: [1, 2.01, 2.73, 4.16], amp: [1, 0.44, 0.18, 0.12], son: [1, 0.72, 0.46, 0.29] });
      return (v.d || 0.95) + 0.025;
    },
    _ayazZincir: function (m, o, t, v) {
      for (var i = 0; i < 3; i++) {
        var tt = t + [0, 0.027, 0.074][i], f = (v.agir ? 210 : 325) - i * 23;
        catla(m, o, tt, { g: v.g * (1.08 - i * 0.20), f: f * 5, tf: f * 1.7, d: 0.012 });
        metal(m, o, tt, { f: f, g: v.g * (0.39 - i * 0.08), d: 0.33, oran: [1, 2.62, 3.84], amp: [1, 0.51, 0.24] });
      }
      return 0.43;
    },
    _ayazZincirRitim: function (m, o, t, v, p) {
      var src = m.c.createBufferSource(), g = m.c.createGain();
      src.buffer = ayazZincirTampon(m.c, !!v.agir);
      src.playbackRate.value = p;
      g.gain.value = v.g;
      src.connect(g); g.connect(o); src.start(t);
      return src.buffer.duration / p;
    },
    _ayazTipi: function (m, o, t, v) {
      var d = v.d;
      gurultu(m, o, t, { d: d, a: d * 0.29, tut: d * 0.26, g: 0.22, renk: 'kahve', tip: 'bandpass',
        f: [[0, 235], [d * 0.44, 515], [d * 0.77, 395], [d, 205]], q: 0.82 });
      gurultu(m, o, t + 0.07, { d: d - 0.07, a: d * 0.34, tut: d * 0.19, g: 0.09, tip: 'bandpass',
        f: [[0, 970], [d * 0.51, 1770], [d * 0.79, 1360], [d, 760]], q: 1.35 });
      return d + 0.02;
    },
    _kapanis: function (m, o, t, v) {   // Bölümün melodisi son akoruna çözülür.
      var b = v.bolum || m.bolum;
      if (b === 3) {
        SESLER._ayazBas(m, o, t, { f: 82.41, d: 3.6, g: 0.21 });
        SESLER._ayazKaval(m, o, t + 0.14, { f: 587.33, d: 0.52, g: 0.24 });
        SESLER._ayazCam(m, o, t + 0.75, { f: 493.88, d: 1.22, g: 0.21 });
        SESLER._ayazKaval(m, o, t + 1.27, { f: 329.63, d: 1.90, g: 0.23 });
        return 3.65;
      }
      if (b === 2) {
        SESLER._madenOrs(m, o, t, { g: 0.39, k: 0.81, d: 1.0 });
        SESLER._kulMetal(m, o, t + 0.4, { f: 138.59, d: 0.84, g: 0.32 });
        SESLER._kulMetal(m, o, t + 1.06, { f: 130.81, d: 1.0, g: 0.28 });
        SESLER._kulTel(m, o, t + 1.1, { f: 65.41, d: 1.95, g: 0.16 });
        return 3.10;
      }
      SESLER._yanikDeri(m, o, t, { f: 57, g: 0.47 });
      SESLER._yanikTel(m, o, t + 0.10, { f: 73.42, d: 2.80, g: 0.22 });
      SESLER._yanikKamis(m, o, t + 0.31, { f: 174.61, d: 0.57, g: 0.24, uzak: true });
      SESLER._yanikKamis(m, o, t + 0.92, { f: 164.81, d: 0.54, g: 0.22, uzak: true });
      SESLER._yanikKamis(m, o, t + 1.49, { f: 146.83, d: 1.97, g: 0.22, uzak: true });
      return 3.53;
    },

    _kulOrsRitim: function (m, o, t, v) {
      var c = m.c, src = c.createBufferSource(), g = c.createGain();
      src.buffer = kulOrsu(c, !!v.hafif);
      src.playbackRate.value = v.k || 1;
      g.gain.value = v.g * (v.hafif ? 0.87 : 0.98);
      src.connect(g); g.connect(o); src.start(t);
      return src.buffer.duration / src.playbackRate.value;
    },

    _madenOrs: function (m, o, t, v) {   // Bölüm II: ağır maden örsü (metalik çekiç darbesi + demir gövde + çınlama)
      var g = v.g == null ? 0.22 : v.g, hafif = !!v.hafif, k = v.k || 1, d = v.d || 0.95;
      if (hafif) {
        catla(m, o, t, { g: g * 0.9, f: 3200 * k, d: 0.004, q: 0.9, tf: 1100 * k });
        metal(m, o, t, { f: 420 * k, oran: [1, 2.34, 3.85, 5.42], amp: [1, 0.58, 0.34, 0.18], son: [1, 0.65, 0.42, 0.25], g: g * 0.46, d: 0.34 });
        return 0.38;
      }
      catla(m, o, t, { g: g * 1.25, f: 2500 * k, d: 0.006, q: 0.85, tf: 960 * k });
      ton(m, o, t, { tip: 'triangle', f: [[0, 190 * k], [0.05, 92 * k]], d: 0.14, a: 0.001, g: g * 0.72, suruc: 1.5 });
      metal(m, o, t, { f: 292 * k, oran: [1, 1.54, 2.38, 3.62, 5.18], amp: [1, 0.72, 0.55, 0.34, 0.18], son: [1, 0.8, 0.62, 0.42, 0.28], g: g * 0.58, d: d });
      metal(m, o, t + 0.002, { f: 294.2 * k, oran: [1, 1.54, 2.38], amp: [0.5, 0.36, 0.26], son: [0.85, 0.65, 0.45], g: g * 0.32, d: d * 0.85 });
      gurultu(m, o, t, { d: 0.045, a: 0.001, g: g * 1.5, tip: 'bandpass', f: [[0, 2900 * k], [0.04, 1300 * k]], q: 1.2 });
      return d + 0.05;
    }
  };

  // Bahtiyar'ın Ayaz'daki kendi adımı. Kar sesi geniş ezilme, taş daha kısa sert temas.
  var AYAZ_OYUNCU_ADIM_TAMPON = [null, null];
  function ayazOyuncuAdimTampon(c, tas) {
    var sira = tas ? 1 : 0;
    if (AYAZ_OYUNCU_ADIM_TAMPON[sira]) return AYAZ_OYUNCU_ADIM_TAMPON[sira];
    var sr = 22050, sure = tas ? 0.102 : 0.111, ikiPi = 2 * Math.PI;
    var b = c.createBuffer(1, Math.ceil(sr * sure), sr), y = b.getChannelData(0);
    var rast = 61547 + sira * 173, cabuk = 0, yavas = 0, faz = 0;
    for (var i = 0; i < y.length; i++) {
      var t = i / sr;
      rast = (Math.imul(rast, 1664525) + 1013904223) >>> 0;
      var n = rast / 2147483648 - 1;
      cabuk += (n - cabuk) * (tas ? 0.48 : 0.35);
      yavas += (cabuk - yavas) * 0.085;
      faz += ikiPi * ((tas ? 70 : 56) + 50 * Math.exp(-55 * t)) / sr;
      var govde = Math.sin(faz) * (tas ? 0.29 : 0.26) * Math.exp(-t * (tas ? 35 : 28));
      var doku;
      if (tas) {
        doku = (cabuk - yavas) * (0.33 * Math.exp(-t * 113) + 0.13 * Math.exp(-Math.pow((t - .018) / .012, 2)));
        doku += (Math.sin(ikiPi * 779 * t) + Math.sin(ikiPi * 1321 * t) * .31) * .07 * Math.exp(-t * 117);
      } else {
        doku = (cabuk - yavas + n * .08) * (0.27 * Math.exp(-t * 38) +
          0.19 * Math.exp(-Math.pow((t - 0.026) / 0.014, 2)) + 0.092 * Math.exp(-Math.pow((t - 0.055) / 0.017, 2)));
      }
      y[i] = (govde + doku) * (tas ? 1.38 : 1.20) * Math.min(1, t * 490, (sure - t) * 118);
    }
    AYAZ_OYUNCU_ADIM_TAMPON[sira] = b;
    return b;
  }

  var AYAZ_BOT_TAMPON = [null, null];
  function ayazBotTampon(c, agir) {
    var sira = agir ? 1 : 0;
    if (AYAZ_BOT_TAMPON[sira]) return AYAZ_BOT_TAMPON[sira];
    var sr = 22050, sure = agir ? 0.106 : 0.087;
    var b = c.createBuffer(1, Math.ceil(sr * sure), sr), y = b.getChannelData(0);
    var rast = 72031 + sira * 161, cabuk = 0, yavas = 0, faz = 0;
    for (var i = 0; i < y.length; i++) {
      var t = i / sr;
      rast = (Math.imul(rast, 1664525) + 1013904223) >>> 0;
      var n = rast / 2147483648 - 1;
      cabuk += (n - cabuk) * 0.33;
      yavas += (cabuk - yavas) * 0.08;
      var ezilme = 0.27 * Math.exp(-37 * t) + 0.16 * Math.exp(-Math.pow((t - 0.029) / 0.013, 2));
      var kar = (cabuk - yavas + 0.12 * n) * ezilme;
      faz += 2 * Math.PI * ((agir ? 69 : 95) + 74 * Math.exp(-58 * t)) / sr;
      var govde = Math.sin(faz) * (agir ? 0.10 : 0.065) * Math.exp(-47 * t);
      var tak = t - 0.019, zirh = 0;
      if (agir && tak > 0) {
        var celik = Math.sin(2 * Math.PI * 1471 * tak) + 0.31 * Math.sin(2 * Math.PI * 2216 * tak);
        zirh = celik * Math.exp(-98 * tak) * Math.min(1, tak * 2000) * 0.043;
      }
      y[i] = (kar + govde + zirh) * Math.min(1, t * 380, (sure - t) * 130);
    }
    AYAZ_BOT_TAMPON[sira] = b;
    return b;
  }

  // Kül Geçidi'nin sık örs vuruşları birer kısa tek-kanallı tampon çalar.
  // Dövüş efektlerindeki daha ağır örsün sentezi ve ses seviyesi ayrı kalır.
  var KUL_ORS_TAMPON = {};
  function kulOrsu(c, hafif) {
    var ad = hafif ? 'hafif' : 'agir';
    if (KUL_ORS_TAMPON[ad]) return KUL_ORS_TAMPON[ad];
    var sr = 22050, sure = hafif ? 0.34 : 0.64, n = Math.ceil(sure * sr);
    var tampon = c.createBuffer(1, n, sr), veri = tampon.getChannelData(0);
    var temel = hafif ? 422 : 290;
    var oran = hafif ? [1, 2.34, 3.85, 5.43] : [1, 1.53, 2.37, 3.61, 5.17];
    var ses = hafif ? [0.43, 0.23, 0.13, 0.07] : [0.46, 0.29, 0.19, 0.12, 0.07];
    var ikiPi = 2 * Math.PI;
    // Örsün frekans kiplerini ve azalan çınlamasını birer kez hesapla.
    for (var k = 0; k < oran.length; k++) {
      var adim = ikiPi * temel * oran[k] / sr, yd = Math.exp(-(9 + 5 * k) / sr);
      var kazanc = ses[k], ilerle = Math.cos(adim) * 2, once = 0, simdi = Math.sin(adim);
      for (var i = 0; i < n; i++) {
        veri[i] += once * kazanc;
        var sonraki = ilerle * simdi - once;
        once = simdi; simdi = sonraki; kazanc *= yd;
      }
    }
    var g = 0, faz = 0, rast = hafif ? 23437 : 40939;
    for (var j = 0; j < n; j++) {
      var t = j / sr;
      rast = (Math.imul(rast, 1664525) + 1013904223) >>> 0;
      var cur = rast / 2147483648 - 1;
      g += (cur - g) * 0.27;
      faz += ikiPi * (76 + 122 * Math.exp(-t * 43)) / sr;
      var govde = hafif ? 0 : Math.sin(faz) * Math.exp(-t * 26) * 0.24;
      var cat = (cur - g) * Math.exp(-t * (hafif ? 200 : 135)) * (hafif ? 0.30 : 0.40);
      veri[j] = (veri[j] + govde + cat) * Math.min(1, t / 0.0014, (sure - t) / 0.018);
    }
    return KUL_ORS_TAMPON[ad] = tampon;
  }

  // Müzikteki kısa zincir ritmi üç hafif metal darbesi. Skarn'ın vuruş sesi ayrı.
  var AYAZ_ZINCIR_TAMPON = [null, null];
  function ayazZincirTampon(c, agir) {
    var sec = agir ? 1 : 0;
    if (AYAZ_ZINCIR_TAMPON[sec]) return AYAZ_ZINCIR_TAMPON[sec];
    var sr = 22050, sure = 0.39, n = Math.ceil(sr * sure), buffer = c.createBuffer(1, n, sr);
    var y = buffer.getChannelData(0), ikiPi = Math.PI * 2, vuruslar = [0, 0.027, 0.074], rast = 92911;
    for (var i = 0; i < vuruslar.length; i++) {
      var ofset = Math.round(vuruslar[i] * sr), h = n - ofset, f = (agir ? 210 : 325) - i * 23;
      var once0 = 0, once1 = 0, once2 = 0, f0 = ikiPi * f / sr, f1 = f0 * 2.62, f2 = f0 * 3.84;
      var s0 = Math.sin(f0), s1 = Math.sin(f1), s2 = Math.sin(f2);
      var c0 = 2 * Math.cos(f0), c1 = 2 * Math.cos(f1), c2 = 2 * Math.cos(f2);
      var g0 = (0.32 - i * 0.066), g1 = g0 * .5, g2 = g0 * .24, lp = 0;
      for (var j = 0; j < h; j++) {
        var t = j / sr, metal = once0 * g0 + once1 * g1 + once2 * g2;
        g0 *= .99948; g1 *= .99928; g2 *= .99887;
        var k0 = c0 * s0 - once0, k1 = c1 * s1 - once1, k2 = c2 * s2 - once2;
        once0 = s0; once1 = s1; once2 = s2; s0 = k0; s1 = k1; s2 = k2;
        rast = (Math.imul(rast, 1664525) + 1013904223) >>> 0;
        var r = rast / 2147483648 - 1;
        lp += (r - lp) * .18;
        var tik = (r - lp) * Math.exp(-430 * t) * (0.26 - 0.04 * i);
        y[ofset+j] += (metal + tik) * Math.min(1, t * 640, (h-j) / (sr*.018));
      }
    }
    AYAZ_ZINCIR_TAMPON[sec] = buffer;
    return buffer;
  }

  function bolumSesleriniHazirla(m) {
    // İlk vuruş ya da ilk adıma beklemesinler; bölüm seçilirken hazırlanırlar.
    if (m.bolum === 2) { kulOrsu(m.c, true); kulOrsu(m.c, false); }
    else if (m.bolum === 3) {
      ayazOyuncuAdimTampon(m.c, false); ayazOyuncuAdimTampon(m.c, true);
      ayazBotTampon(m.c, false); ayazBotTampon(m.c, true);
      ayazZincirTampon(m.c, false); ayazZincirTampon(m.c, true);
    }
  }

  // ───────────────────────── motor ─────────────────────────
  // bu sesler çalınca müzik+ortam kısa süre bu oranda geri çekilir
  var CEKIL = { vurus: 0.42, blok: 0.3, sektir: 0.25, oyuncuHasar: 0.45, devYereVur: 0.5, devSopa: 0.45, devKaya: 0.35, devBasla: 0.4, devOldu: 0.5, ofke: 0.82, atil: 0.15, varilPatla: 0.38, totemKir: 0.28, ayazBuzKir: 0.16, skarnZincir: 0.25, ayazZincirKes: 0.15, ayazKurtHazir: 0.15 };
  function Motor(c, sec) {
    sec = sec || {};
    var m = this;
    m.c = c; m.cevrimdisi = !!sec.cevrimdisi; m.sinirsiz = !!sec.sinirsiz;
    m.bolum = bolumNo(sec.bolum) || (sec.bolum == null ? oyunBolumu() : 1);
    m.muzikCaliyor = true;
    m.sesler = {}; m.tumu = []; m.son = {}; m.vurusSira = 0; m.adimSol = false; m.kalp = false;
    m.say = { istek: 0, calinan: 0, atlanan: 0, kesilen: 0, enCokTur: {}, enCokToplam: 0 };
    m.egriler = {};
    var sr = c.sampleRate, n = Math.floor(sr * 3), i;
    m.beyaz = c.createBuffer(1, n, sr);
    var w = m.beyaz.getChannelData(0); for (i = 0; i < n; i++) w[i] = R() * 2 - 1;
    m.kahve = c.createBuffer(1, n, sr);
    var k = m.kahve.getChannelData(0), son = 0, tepe = 0;
    for (i = 0; i < n; i++) { son = (son + 0.02 * (R() * 2 - 1)) / 1.02; k[i] = son; }
    var a = k[0], b = k[n - 1];
    for (i = 0; i < n; i++) { k[i] -= a + (b - a) * i / (n - 1); if (Math.abs(k[i]) > tepe) tepe = Math.abs(k[i]); }   // döngü ekinde tık olmasın
    for (i = 0; i < n; i++) k[i] /= tepe || 1;

    // veri yolları: efekt / müzik / ortam / yankı → ana → sıkıştırıcı → koruma (yumuşak tavan) → çıkış
    m.ana = c.createGain();
    m.efekt = c.createGain(); m.muzik = c.createGain(); m.ortam = c.createGain();
    // müzik/ortam, ağır efekt gelince kısa süre geri çekilir (efektlerin önüne geçmesin)
    m.cekil = c.createGain(); m.cekil.connect(m.ana); m.yog = 0; m.cekilSon = -1;
    m.efektCekil = c.createGain(); m.efektCekil.connect(m.efekt);
    m.efekt.connect(m.ana); m.muzik.connect(m.cekil); m.ortam.connect(m.cekil);
    m.yankiGiris = c.createGain();
    var yk = c.createConvolver(); yk.buffer = yankiTampon(c); m.yankiDonus = c.createGain(); m.yankiDonus.gain.value = AYAR.yanki.donus;
    m.yankiGiris.connect(yk); yk.connect(m.yankiDonus); m.yankiDonus.connect(m.ana);
    if (sec.ham) { m.ana.connect(c.destination); }
    else {
      var kp = c.createDynamicsCompressor(), K = AYAR.komp;
      kp.threshold.value = K.esik; kp.knee.value = K.diz; kp.ratio.value = K.oran; kp.attack.value = K.atak; kp.release.value = K.birak;
      var kr = c.createWaveShaper(); kr.curve = korumaEgrisi();
      var kc = c.createGain(); kc.gain.value = K.cikis;
      m.ana.connect(kp); kp.connect(kc); kc.connect(kr); kr.connect(c.destination);
    }
  }
  Motor.prototype.egriSuruc = function (k) {
    k = Math.round(k * 10) / 10;
    if (this.egriler[k]) return this.egriler[k];
    var n = 1024, e = new Float32Array(n), th = Math.tanh(k);
    for (var i = 0; i < n; i++) { var x = i / (n - 1) * 2 - 1; e[i] = Math.tanh(k * x) / th; }
    return (this.egriler[k] = e);
  };
  function korumaEgrisi() {   // |x|<0.78 doğrusal (1:1), üstü yumuşakça ~0.95'te tavan
    var n = 4096, e = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var x = i / (n - 1) * 2 - 1, a = Math.abs(x);
      e[i] = Math.sign(x) * (a < 0.78 ? a : 0.78 + 0.18 * Math.tanh((a - 0.78) / 0.18));
    }
    return e;
  }
  function yankiTampon(c) {   // üretilmiş gürültü impulsu: taş, açık alan
    var sr = c.sampleRate, Y = AYAR.yanki, n = Math.floor(sr * Y.sure), b = c.createBuffer(2, n, sr);
    var erken = [[0.011, 0.5], [0.019, 0.35], [0.027, 0.3], [0.041, 0.22], [0.063, 0.15]];
    for (var ch = 0; ch < 2; ch++) {
      var d = b.getChannelData(ch), lp = 0;
      for (var i = 0; i < n; i++) {
        var tt = i / sr; lp += ((R() * 2 - 1) - lp) * (0.25 + 0.55 * Math.exp(-tt * 4));   // zamanla kararan kuyruk
        d[i] = lp * (Math.exp(-tt * Y.sonum) + (Y.uzak || 0) * Math.exp(-tt * (Y.uzakSonum || Y.sonum))) * (tt < 0.01 ? tt / 0.01 : 1) * 0.6;
      }
      for (var j = 0; j < erken.length; j++) { var s = Math.floor((erken[j][0] + ch * 0.003) * sr); if (s < n) d[s] += erken[j][1] * (ch ? 0.9 : 1); }
    }
    return b;
  }
  Motor.prototype.mesafe = function (v, duyma) {
    var O = window.OYUNCU, M = AYAR.mesafe;
    if (!v || v.x == null || v.y == null || !O || O.x == null) return 1;
    var d = Math.sqrt((v.x - O.x) * (v.x - O.x) + (v.y - O.y) * (v.y - O.y));
    if (duyma) { var yakinlik = sin((duyma - d) / (duyma - 75), 0, 1); return yakinlik * yakinlik; }
    return Math.max(M.enAz, 1 - Math.max(0, d - M.yakin) / (M.uzak - M.yakin) * (1 - M.enAz));
  };
  function panDeger(v, yakin) {
    if (!v || v.x == null) return 0;
    if (yakin && window.OYUNCU && isFinite(OYUNCU.x)) return sin((v.x - OYUNCU.x) / yakin, -1, 1) * 0.62;
    var O = window.OYUN, W = (O && O.W) || 1280;
    // 19 Kasım yakınlaştırma: sağ/sol denge EKRANDAKİ konuma göre (dünya yakınlaşıp barbarı izleyerek kayıyor)
    if (O && typeof O.dunyaEkran === 'function' && O.gorunum && O.gorunum.w > 0) {
      var e = O.dunyaEkran(v.x, v.y != null ? v.y : 0);
      if (e && isFinite(e.x)) return sin(((e.x - O.gorunum.x0) / O.gorunum.w) * 2 - 1, -1, 1) * AYAR.pan;
    }
    return sin((v.x / W) * 2 - 1, -1, 1) * AYAR.pan;
  }
  Motor.prototype.zincir = function (hedef, g, pan, yanki, lp, yankiHedefi) {   // ses kazancı → (uzaksa mat: alçak geçiren) → pan → veri yolu (+ yankı)
    var c = this.c, vg = c.createGain(), cik = vg; vg.gain.value = g;
    if (lp > 0) { var lf = c.createBiquadFilter(); lf.type = 'lowpass'; lf.frequency.value = Math.min(lp, 20000); lf.Q.value = 0.5; vg.connect(lf); cik = lf; }
    if (c.createStereoPanner && pan) { var pn = c.createStereoPanner(); pn.pan.value = pan; cik.connect(pn); pn.connect(hedef); }
    else cik.connect(hedef);
    if (yanki > 0) { var sg = c.createGain(); sg.gain.value = yanki; vg.connect(sg); sg.connect(yankiHedefi || this.yankiGiris); }
    return vg;
  };
  Motor.prototype.kes = function (s, t) {
    s.kesik = true;
    var gp = s.g.gain;
    if (gp.cancelAndHoldAtTime) gp.cancelAndHoldAtTime(t);
    else { gp.cancelScheduledValues(t); gp.setValueAtTime(gp.value, t); }
    gp.linearRampToValueAtTime(0, t + 0.025);
    s.bit = Math.min(s.bit, t + 0.025); this.say.kesilen++;
  };
  // çalan sesleri kısa sürede orana kıs (kesmeden): isabet gelince "vuuş" geri çekilir
  Motor.prototype.sustur = function (ad, t, oran) {
    var l = this.sesler[ad] || [];
    for (var i = 0; i < l.length; i++) {
      var s = l[i]; if (s.kesik || s.bit <= t || s.kisik) continue;
      s.kisik = true; var gp = s.g.gain;
      if (gp.cancelAndHoldAtTime) gp.cancelAndHoldAtTime(t); else { gp.cancelScheduledValues(t); gp.setValueAtTime(s.kazanc, t); }
      gp.linearRampToValueAtTime(s.kazanc * oran, t + 0.014);
      if (s.bit - 0.03 > t + 0.014) gp.setValueAtTime(s.kazanc * oran, s.bit - 0.03);
      gp.linearRampToValueAtTime(0, Math.max(t + 0.02, s.bit));
    }
  };
  Motor.prototype.kesTur = function (ad, t) {
    var l = this.sesler[ad] || [];
    for (var i = 0; i < l.length; i++) if (!l[i].kesik && l[i].bit > t) this.kes(l[i], t);
  };
  Motor.prototype.cal = function (ad, v, t) {
    var f = SESLER[ad]; if (!f) return null;
    var c = this.c, A = AYAR.ses[ad] || {};
    v = v || {};
    if (t == null) t = c.currentTime + 0.005;
    this.say.istek++;
    var son = this.son[ad];
    if (!this.sinirsiz && son != null && t >= son && t - son < (A.aralik || 0) && !(v.sira > 1)) { this.say.atlanan++; return null; }   // delip geçen baltanın zincir isabetleri atlanmaz
    var mes = this.mesafe(v, A.duyma);
    if (mes <= 0) return null;
    var l = (this.sesler[ad] || []).filter(function (s) { return s.bit > t && !s.kesik; });
    this.tumu = this.tumu.filter(function (s) { return s.bit > t && !s.kesik; });
    if (!this.sinirsiz) {
      var sn = A.sinir || 4;
      while (l.length >= sn) this.kes(l.shift(), t);   // en yeni kazanır
      while (this.tumu.length >= AYAR.enCokSes) this.kes(this.tumu.shift(), t);
      l = l.filter(function (s) { return !s.kesik; });
    }
    var p = 1 + (R() * 2 - 1) * (A.perde == null ? 0.05 : A.perde);
    var g = (A.g == null ? 1 : A.g) * mes / Math.sqrt(1 + AYAR.kalabalik * l.length);
    var nara = ad === 'ofke';
    var vg = this.zincir(nara ? this.efekt : this.efektCekil, g, panDeger(v, A.yakinPan), A.yanki == null ? 0.12 : A.yanki, mes < 0.95 ? 2600 + 16000 * Math.pow(Math.max(0, mes - AYAR.mesafe.enAz) / (0.95 - AYAR.mesafe.enAz), 2) : 0);
    var dd = f(this, vg, t, v, p) || 0.5, d = Math.min(dd, A.enUzun || 3);
    if (dd > d) { vg.gain.setValueAtTime(g, Math.max(t, t + d - 0.06)); vg.gain.linearRampToValueAtTime(0, t + d); }
    if (CEKIL[ad] && (nara || t > this.cekilSon - 0.05)) {
      var cp = this.cekil.gain, dz = CEKIL[ad] * (v.agir || v.oldurdu ? 1.25 : 1);
      if (cp.cancelAndHoldAtTime) cp.cancelAndHoldAtTime(t); else cp.cancelScheduledValues(t);
      var cekilBitis = t + (nara ? d : 0.07);
      cp.linearRampToValueAtTime(1 - Math.min(nara ? 0.82 : 0.6, dz), t + 0.012);
      cp.setTargetAtTime(1, cekilBitis, nara ? 0.16 : 0.11);
      this.cekilSon = cekilBitis;
    }
    if (nara) {
      var efektSeviyesi = this.efektCekil.gain;
      if (efektSeviyesi.cancelAndHoldAtTime) efektSeviyesi.cancelAndHoldAtTime(t);
      else efektSeviyesi.cancelScheduledValues(t);
      efektSeviyesi.linearRampToValueAtTime(0.52, t + 0.018);
      efektSeviyesi.setTargetAtTime(1, t + d, 0.14);
    }
    var s = { ad: ad, g: vg, kazanc: g, bas: t, bit: t + d };
    l.push(s); this.tumu.push(s); this.sesler[ad] = l; this.son[ad] = t;
    var S = this.say; S.calinan++;
    S.enCokTur[ad] = Math.max(S.enCokTur[ad] || 0, l.length);
    S.enCokToplam = Math.max(S.enCokToplam, this.tumu.length);
    if (!this.cevrimdisi) setTimeout(function () { try { vg.disconnect(); } catch (e) { /* yok */ } }, Math.max(0, (t + d - c.currentTime + 0.4) * 1000));
    return s;
  };
  // yönetilmeyen kısa ses (ortam/müzik zamanlayıcısı)
  Motor.prototype.serbest = function (ad, yol, t, v, g, pan, yanki, yankiHedefi) {
    var vg = this.zincir(yol, g, pan || 0, yanki || 0, 0, yankiHedefi), c = this.c, sb = this.say.serbest || (this.say.serbest = {});
    sb[ad] = (sb[ad] || 0) + 1;
    var d = SESLER[ad](this, vg, t, v || {}, 1 + (R() * 2 - 1) * 0.04) || 0.5;
    if (!this.cevrimdisi) setTimeout(function () { try { vg.disconnect(); } catch (e) { /* yok */ } }, Math.max(0, (t + d - c.currentTime + 0.4) * 1000));
  };

  Motor.prototype.nota = function (ad, t, v, pan, yanki) {
    if (!this.muzikCaliyor) return;
    var yol = this.muz.yol;
    this.serbest(ad, yol.kuru, t, v, 1, pan, yanki, yol.yanki);
  };

  function notaYankisi(m) {
    // Müzik yankısı da müzik ses düğmesine bağlı. Efektlerin yankı zinciri ayrı kalır.
    var c = m.c, filtre = c.createBiquadFilter();
    filtre.type = 'lowpass'; filtre.frequency.value = 2500;
    [[0.052, 0.46, -0.36], [0.108, 0.28, 0.32], [0.172, 0.14, -0.18]].forEach(function (s) {
      var gecikme = c.createDelay(0.2); gecikme.delayTime.value = s[0];
      filtre.connect(gecikme); gecikme.connect(m.zincir(m.muzik, s[1], s[2], 0));
    });
    return filtre;
  }

  function muzigiCoz(m, t, d) {
    var mz = m.muz, once = mz.yol, c = m.c;
    if (once) {
      once.kuru.gain.setTargetAtTime(0, t, 0.058);
      once.yanki.gain.setTargetAtTime(0, t, 0.058);
      if (!m.cevrimdisi) setTimeout(function () { once.kuru.disconnect(); once.yanki.disconnect(); }, 450);
    }
    var kuru = c.createGain(), yanki = c.createGain();
    [kuru, yanki].forEach(function (g) { g.gain.value = 0; g.gain.setTargetAtTime(1, t, 0.047); });
    kuru.connect(m.muzik); yanki.connect(m.notaYanki);
    mz.yol = { kuru: kuru, yanki: yanki };
    mz.durum = d; mz.adim = mz.olcu = 0;
    mz.tempo = muzAyar(m, d).tempo;
    mz.sonraki = t + 0.13;
  }

  // Sürekli katmanlar: rüzgâr, ateş uğultusu, pes müzik gövdesi.
  function lfo(c, hz, derinlik, hedef, tip) {
    var l = c.createOscillator(), g = c.createGain(); l.type = tip || 'sine'; l.frequency.value = hz; g.gain.value = derinlik;
    l.connect(g); g.connect(hedef); l.start(); return l;
  }
  var DRONE_F = { 1: [36.71, 55, 73.42, 36.71], 2: [32.70, 49.00, 65.41, 32.70], 3: [41.20, 61.74, 82.41, 41.20] };
  var DEV_F = { 1: [51.91, 77.78, 103.83], 2: [46.25, 69.30, 92.50], 3: [41.20, 58.27, 82.41] };
  function iklimYap(m, t, hemen) {
    var ayaz = m.bolum === 3, a = m.iklim;
    var hedef = ayaz ? [0.78, 0.092, 0.050, 510, 1170, 0] : m.bolum === 2 ? [0.38, 0.026, 0.31, 275, 740, 0] : [0.46, 0.027, 0.14, 350, 850, 0.45];
    for (var i = 0; i < a.length; i++) {
      if (hemen) a[i].value = hedef[i];
      else a[i].setTargetAtTime(hedef[i], t, 0.5);
    }
  }
  Motor.prototype.surekliKur = function () {
    var m = this, c = m.c;
    if (m.surekli) return;
    m.surekli = true;
    bolumSesleriniHazirla(m);
    // rüzgâr (kahverengi gürültü, yavaşça gezen bant)
    var r = c.createBufferSource(); r.buffer = m.kahve; r.loop = true;
    var bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 360; bp.Q.value = 0.6;
    var rg = c.createGain(); rg.gain.value = 0.55;
    lfo(c, 0.07, 170, bp.frequency); lfo(c, 0.11, 0.3, rg.gain); lfo(c, 0.029, 0.15, rg.gain);
    r.connect(bp); bp.connect(rg); rg.connect(m.ortam); r.start();
    // rüzgâr ıslığı (çok kısık)
    var w = c.createBufferSource(); w.buffer = m.beyaz; w.loop = true;
    var wb = c.createBiquadFilter(); wb.type = 'bandpass'; wb.frequency.value = 850; wb.Q.value = 9;
    var wg = c.createGain(); wg.gain.value = 0.04;
    lfo(c, 0.05, 220, wb.frequency); lfo(c, 0.17, 0.035, wg.gain);
    w.connect(wb); wb.connect(wg); wg.connect(m.ortam); w.start(0, 1.1);
    // uzak ateş uğultusu
    var a = c.createBufferSource(); a.buffer = m.kahve; a.loop = true; a.playbackRate.value = 0.7;
    var al = c.createBiquadFilter(); al.type = 'lowpass'; al.frequency.value = 240;
    var ag = c.createGain(); ag.gain.value = 0.22; lfo(c, 0.23, 0.06, ag.gain);
    a.connect(al); al.connect(ag); ag.connect(m.ortam); a.start(0, 0.7);
    // Sağanaktaki ince damlalar ve ıslak zeminin daha geniş uğultusu aynı ortam yolunu kullanır.
    var yagmur = c.createBufferSource(); yagmur.buffer = m.beyaz; yagmur.loop = true; yagmur.playbackRate.value = .86;
    var yagmurBand = c.createBiquadFilter(); yagmurBand.type = 'bandpass';
    yagmurBand.frequency.value = 1880; yagmurBand.Q.value = .43;
    var yagmurSeviye = c.createGain(); yagmurSeviye.gain.value = 0;
    yagmur.connect(yagmurBand); yagmurBand.connect(yagmurSeviye); yagmurSeviye.connect(m.ortam); yagmur.start(0, .63);
    m.iklim = [rg.gain, wg.gain, ag.gain, bp.frequency, wb.frequency, yagmurSeviye.gain];
    iklimYap(m, c.currentTime, true);
    m.notaYanki = notaYankisi(m);
    // Bölümün temel ve tehdit sesleri aynı kalıcı osilatörleri kullanır.
    var bol = m.bolum;
    m.drone = c.createGain(); m.drone.gain.value = 0;
    var dl = c.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = [0, 245, 196, 303][bol]; dl.Q.value = 1.25;
    m.droneKesim = dl.frequency;
    lfo(c, 0.06, 70, dl.frequency);
    m.droneOs = [];
    [[0, 'sawtooth', 0.5, 0], [1, 'sawtooth', 0.35, 6], [2, 'sine', 0.3, -4], [3, 'sawtooth', 0.4, 9]].forEach(function (x) {
      var o = c.createOscillator(), g = c.createGain(); o.type = x[1]; o.frequency.value = DRONE_F[bol][x[0]]; o.detune.value = x[3]; g.gain.value = x[2];
      o.connect(g); g.connect(dl); o.start();
      m.droneOs.push(o);
    });
    dl.connect(m.drone); m.drone.connect(m.muzik);
    // dev / Vargor katmanı: triton, daha parlak, nefes alır
    m.devKat = c.createGain(); m.devKat.gain.value = 0;
    var vl = c.createBiquadFilter(); vl.type = 'lowpass'; vl.frequency.value = 420; vl.Q.value = 2;
    lfo(c, 0.13, 160, vl.frequency);
    m.devOs = [];
    [[0, 'sawtooth', 0.35, 0], [1, 'sawtooth', 0.25, 7], [2, 'square', 0.12, -5]].forEach(function (x) {
      var o = c.createOscillator(), g = c.createGain(); o.type = x[1]; o.frequency.value = DEV_F[bol][x[0]]; o.detune.value = x[3]; g.gain.value = x[2];
      o.connect(g); g.connect(vl); o.start();
      m.devOs.push(o);
    });
    var vt = c.createGain(); vt.gain.value = 0.7; lfo(c, 0.25, 0.3, vt.gain);
    vl.connect(vt); vt.connect(m.devKat); m.devKat.connect(m.muzik);
    m.muz = { durum: null, yol: null, sonraki: 0, adim: 0, tempo: 0, olcu: 0, gecmis: [] };
    m.oz = { citir: c.currentTime + 0.3, karga: c.currentTime + ra(15, 35), tipi: c.currentTime + 0.12, kalp: 0 };
    m.muzikDurum('sakin', c.currentTime);
  };
  function muzAyar(m, d) {
    return (m && m.bolum === 3 ? AYAR.muz3 : m && m.bolum === 2 ? AYAR.muz2 : AYAR.muz)[d];
  }
  Motor.prototype.muzikBolum = function (no, t, durum) {
    var b = bolumNo(no) || 1;
    if (this.bolum === b) return;
    this.bolum = b;
    if (!this.surekli) return;
    bolumSesleriniHazirla(this);
    if (t == null) t = this.c.currentTime;
    iklimYap(this, t, false);
    if (b === 3) this.oz.tipi = t + 0.12;
    this.oz.citir = t + 0.12;
    this.oz.karga = t + ra(20, 46);
    this.droneKesim.setTargetAtTime([0, 245, 196, 303][b], t, 0.35);
    for (var i = 0; i < this.droneOs.length; i++) this.droneOs[i].frequency.setTargetAtTime(DRONE_F[b][i], t, 0.27);
    for (var j = 0; j < this.devOs.length; j++) this.devOs[j].frequency.setTargetAtTime(DEV_F[b][j], t, 0.27);
    this.muzikDurum(durum || 'sakin', t, true);
  };
  Motor.prototype.muzikDurum = function (d, t, yenile) {
    var mz = this.muz, M = muzAyar(this, d);
    if (!M || !mz || (!yenile && mz.durum === d)) return;
    if (t == null) t = this.c.currentTime;
    var kapanis = !yenile && mz.durum === 'dev' && d === 'sakin';
    muzigiCoz(this, t, d);
    var drone = this.drone.gain, dev = this.devKat.gain;
    drone.cancelScheduledValues(t); dev.cancelScheduledValues(t);
    if (kapanis) {
      mz.sonraki = t + 6.9;
      drone.setTargetAtTime(0.04, t, 0.28);
      drone.setTargetAtTime(M.drone, t + 6.4, 1.2);
      this.nota('_kapanis', t + 0.32, { bolum: this.bolum }, 0, 0.42);
    } else drone.setTargetAtTime(M.drone, t, 0.35);
    dev.setTargetAtTime(M.dev, t, 0.43);
  };


  // Her bölümün ölçüsü, melodisi, armonisi ve vuruşları ayrı.
  // Bir melodi notası [onaltılık konumu, MIDI nota, süre, vurgu] biçiminde.
  var BESTE = {
    1: {
      adim: 16,
      tel: '_yanikTel',
      vurgu: '_yanikDeri',
      sakin: {
        saz: '_yanikKamis', ses: 0.42, bas: [38,43,41,36,38,46,43,38],
        ezgi: [
          [[0,62,3],[4,65,2],[7,64,2],[11,62,4]],
          [[1,67,3],[6,69,2],[9,65,5]],
          [[0,60,2],[3,62,3],[8,65,2],[11,64,4]],
          [[0,57,5],[8,60,2],[12,62,4]],
          [[0,62,4],[6,65,2],[9,67,2],[12,69,4]],
          [[1,70,3],[5,69,3],[12,65,3]],
          [[0,67,3],[5,65,3],[11,64,4]],
          [[0,60,4],[7,57,3],[12,62,4]]
        ],
        ritim: ['1000000000100000', '0000001000000010', '1000000000000000', '0000100000001000']
      },
      savas: {
        saz: '_yanikKamis', ses: 0.40, bas: [38,41,36,37,43,41,36,38],
        ezgi: [
          [[0,62,2],[3,65,2],[6,64,2],[10,62,2],[13,65,2]],
          [[0,69,2],[4,67,3],[9,65,2],[12,60,2]],
          [[0,62,2],[2,60,1],[5,65,2],[8,64,3],[13,67,3]],
          [[0,69,3],[6,65,2],[9,63,2],[12,62,4]],
          [[0,67,3],[5,70,2],[8,69,2],[11,67,2],[14,65,2]],
          [[0,65,4],[6,62,2],[9,64,3],[14,65,2]],
          [[2,72,3],[7,69,3],[12,67,4]],
          [[0,65,3],[4,64,2],[8,62,7]]
        ],
        ritim: ['3020201030202000', '3010202030020320', '3002301030202010', '3020202030212220',
          '3010320030202020', '3030100202203010', '1000230030202200', '3020203030020000']
      },
      dev: {
        saz: '_temaBoru', ses: 0.57, bas: [38,37,44,38,36,44,37,38],
        ezgi: [
          [[0,50,4],[6,53,3],[11,51,4]],
          [[0,50,3],[4,44,3],[9,51,5]],
          [[0,56,5],[8,53,3],[12,51,3]],
          [[0,45,3],[5,48,2],[10,50,6]],
          [[0,48,6],[8,55,3],[13,51,3]],
          [[0,44,3],[4,51,2],[8,56,5]],
          [[0,49,4],[6,51,3],[12,53,4]],
          [[0,50,8],[12,46,3]]
        ],
        ritim: ['3000200030002000', '3020000010002000', '3000002030200010', '3000200030203220',
          '3002000030202000', '3000201030002000', '3000003030202000', '3000200010002000']
      }
    },
    2: {
      adim: 12,
      tel: '_kulTel',
      vurgu: '_kulOrsRitim',
      sakin: {
        saz: '_kulMetal', ses: 0.69, bas: [36,31,39,37,36,34,39,31],
        ezgi: [
          [[0,60,3],[3,55,2],[7,51,3],[10,54,2]],
          [[0,55,3],[4,58,2],[8,49,3]],
          [[0,51,3],[4,55,3],[8,56,3]],
          [[0,49,3],[4,48,3],[9,55,3]],
          [[0,60,2],[2,63,2],[6,61,3],[10,58,2]],
          [[0,55,4],[7,54,2],[10,51,2]],
          [[0,56,3],[5,58,3],[10,61,2]],
          [[0,48,4],[6,54,2],[9,48,3]]
        ],
        ritim: ['100000100000', '000001100000', '100000000010', '000001100001']
      },
      savas: {
        saz: '_kulMetal', ses: 0.49, bas: [36,39,42,37,34,31,42,36],
        ezgi: [
          [[0,60,2],[2,55,2],[4,51,2],[6,54,2],[9,49,2]],
          [[0,55,3],[4,58,2],[6,60,2],[8,63,2],[10,58,2]],
          [[0,54,2],[3,55,2],[6,61,2],[8,58,2],[10,54,2]],
          [[0,49,3],[4,54,2],[6,51,2],[9,48,3]],
          [[0,58,3],[4,61,2],[6,58,3],[10,54,2]],
          [[0,55,2],[2,58,2],[5,60,1],[6,63,3],[10,61,2]],
          [[0,54,3],[4,58,2],[6,61,2],[8,58,2],[10,54,2]],
          [[0,51,3],[4,54,2],[6,55,2],[9,60,3]]
        ],
        ritim: ['402104402103', '402024401204', '403104403102', '402104403224',
          '403104401202', '420102402104', '401104412102', '402104410040']
      },
      dev: {
        saz: '_kulMetal', ses: 0.53, bas: [36,42,37,34,39,37,42,36],
        ezgi: [
          [[0,48,3],[3,54,3],[6,49,3],[9,46,3]],
          [[0,42,5],[6,54,2],[8,55,2],[10,49,2]],
          [[0,49,4],[4,55,2],[6,54,2],[8,51,3]],
          [[0,46,3],[3,49,2],[6,48,3],[10,60,2]],
          [[0,51,3],[3,58,3],[6,61,4]],
          [[0,49,4],[4,54,2],[6,58,3],[10,54,2]],
          [[0,54,4],[5,49,1],[6,51,3],[9,46,3]],
          [[0,48,5],[6,54,3],[9,48,3]]
        ],
        ritim: ['430040430040', '420040430140', '430044402040', '440043430244',
          '430020430040', '420040430244', '430420400140', '430040400440']
      }
    },
    3: {
      adim: 20,
      tel: '_ayazBas',
      vurgu: '_ayazZincirRitim',
      sakin: {
        saz: '_ayazKaval', ses: 0.55, bas: [40,38,36,35,40,38,36,40],
        ezgi: [
          [[0,64,4],[5,67,3],[9,71,4],[15,74,4]],
          [[0,74,4],[5,76,3],[11,69,3],[16,71,4]],
          [[0,67,5],[7,72,3],[12,76,3],[16,74,4]],
          [[0,66,4],[6,69,3],[11,67,3],[16,64,4]],
          [[0,71,4],[5,76,4],[10,79,3],[16,76,4]],
          [[0,74,5],[7,76,3],[12,81,3],[16,79,4]],
          [[0,72,4],[6,76,4],[12,74,3],[17,71,3]],
          [[0,69,4],[6,67,4],[12,66,3],[16,64,4]]
        ],
        ritim: ['00000000000000000000']
      },
      savas: {
        saz: '_ayazKaval', ses: 0.48, bas: [40,43,36,35,38,43,36,40],
        ezgi: [
          [[0,64,2],[3,67,2],[6,71,3],[10,74,2],[13,76,3],[17,71,3]],
          [[0,74,3],[5,71,3],[9,67,2],[12,64,3],[16,67,3]],
          [[0,72,3],[5,67,2],[9,76,3],[14,74,2],[17,72,2]],
          [[0,71,2],[4,69,3],[8,66,3],[13,67,2],[17,64,3]],
          [[0,69,3],[5,74,3],[9,76,3],[13,74,2],[17,69,3]],
          [[0,67,4],[6,71,2],[10,74,5],[17,79,3]],
          [[0,76,4],[5,79,2],[9,74,4],[15,72,5]],
          [[0,71,3],[5,67,3],[9,66,2],[13,64,7]]
        ],
        ritim: ['30200020100032002010', '30100020200030100200', '30210020300030102010', '30200020102032302210',
          '30100020102032002010', '30200020300020202020', '30200040100032201220', '30102020000030002000']
      },
      dev: {
        saz: '_ayazYay', ses: 0.46, bas: [40,35,43,41,38,41,36,40],
        ezgi: [
          [[0,52,5],[7,59,3],[12,55,3],[16,54,4]],
          [[0,59,4],[5,62,4],[12,58,3],[16,54,4]],
          [[0,55,5],[7,58,3],[12,62,3],[16,64,4]],
          [[0,53,4],[5,59,3],[10,58,2],[15,52,5]],
          [[0,50,6],[8,60,4],[14,57,5]],
          [[0,53,4],[6,58,3],[11,64,4],[17,65,3]],
          [[0,60,5],[7,63,4],[12,58,3],[16,55,4]],
          [[0,59,5],[7,58,3],[12,55,2],[16,52,4]]
        ],
        ritim: ['30000040200030042000', '30020230000030204000', '30200040300030204020', '30002040200032304030',
          '30000040202030002040', '30204030000032004000', '30200040302030042000', '30002240200032004000']
      }
    }
  };

  function notaHz(nota) { return 440 * Math.pow(2, (nota - 69) / 12); }

  function bossEvre(m) {
    var boss = m.bolum === 3 ? m.ayazBoss : m.bolum === 2 ? window.VARGOR : window.DEV;
    return Math.max(1, Math.min(3, m.evre || (boss && boss.evre) || 1));
  }

  function besteAdimi(m, t, adim, adimSn) {
    var mz = m.muz, b = m.bolum, durum = mz.durum, beste = BESTE[b], p = beste[durum];
    if (!p) return;
    var bar = mz.olcu - 1, evre = durum === 'dev' ? bossEvre(m) : 1;
    var sakin = durum === 'sakin', agir = durum === 'dev';
    var kok = p.bas[bar % p.bas.length], notalar = p.ezgi[bar % p.ezgi.length];
    var yogunluk = sakin ? 0 : (m.yog || 0), vurgu = sakin ? 0.38 : 0.69 + Math.max(yogunluk, agir ? evre * 0.31 : 0) * 0.25;
    var ritim = p.ritim[bar % p.ritim.length][adim], vurusT = t + ra(0, 0.006);

    if (ritim === '4') m.nota(beste.vurgu, vurusT, { g: vurgu * (b === 3 ? 0.4 : 0.35), d: 0.64, k: agir ? 0.83 : 1, agir: agir }, 0.15, 0.27);
    else if (ritim === '3') m.nota(b === 1 ? '_yanikDeri' : '_davul', vurusT, { f: b === 1 ? 64 : agir ? 43 : 53, g: vurgu * (agir ? 0.81 : 0.64), uz: b === 1 ? 0.78 : 0.86 }, 0, 0.19);
    else if (ritim === '2') {
      m.nota(b === 2 ? '_kulOrsRitim' : b === 1 ? '_yanikDeri' : '_tom', vurusT, { f: b === 1 ? 102 : 87, g: vurgu * (0.25 + yogunluk * 0.11), hafif: true, k: 1.09 }, adim % 4 ? -0.22 : 0.21, 0.16);
    } else if (ritim === '1') m.nota(b === 2 ? '_kulOrsRitim' : '_tak', vurusT, { g: vurgu * 0.20, hafif: true, k: 1.1 }, adim % 3 ? 0.29 : -0.29, 0.20);

    var pulslar = b === 1 ? [0, 8] : b === 2 ? [0, 6] : [0, 12];
    if (adim === pulslar[0] || adim === pulslar[1]) {
      var ikinci = adim !== 0;
      var gs = sakin ? (b === 2 ? 0.25 : 0.20) : agir ? 0.33 : 0.29;
      var f = notaHz(kok + (ikinci && (b === 3 || bar % 2) ? 7 : 0));
      m.nota(beste.tel, t, { f: f, d: adimSn * (b === 3 ? 7 : sakin ? 5 : 3.2), g: gs * (ikinci ? 0.72 : 1), sert: agir ? 0.70 : 0 }, ikinci ? -0.16 : 0.04, 0.20);
    }
    if (!sakin && evre > 1 && adim === (b === 2 ? 10 : b === 3 ? 15 : 13)) {
      m.nota(beste.vurgu, t, { f: b === 1 ? 78 : 56, g: evre === 3 ? 0.26 : 0.19, d: 0.54, hafif: evre < 3, agir: true }, -0.31, 0.20);
    }

    for (var i = 0; i < notalar.length; i++) {
      var n = notalar[i]; if (n[0] !== adim) continue;
      var fNota = notaHz(n[1]), d = adimSn * n[2], g = p.ses * (n[3] || (i ? 0.89 : 1));
      var pan = i % 2 ? 0.13 : -0.12;
      m.nota(p.saz, t, { f: fNota, d: d, g: g, uzak: sakin, sert: agir ? 0.65 + 0.10 * evre : 0 }, pan, b === 2 ? 0.29 : 0.22);
      if (b === 3 && (i === 0 || i === 2)) {
        m.nota('_ayazCam', t + 0.013, { f: fNota * (agir ? 2 : 1), d: Math.min(d * 1.5 + 0.12, 1.25), g: g * (agir ? 0.39 : sakin ? 0.34 : 0.24) }, -pan * 2, 0.34);
      } else if (b === 2 && agir && i === 0) {
        m.nota('_kulTel', t + 0.021, { f: fNota / 2, d: d, g: g * 0.40, sert: 0.8 }, 0.24, 0.16);
      } else if (b === 1 && !sakin && i === 0) {
        m.nota(agir ? '_yanikKamis' : '_yanikTel', t + 0.020, { f: fNota * (agir ? 1.5 : 0.5), d: d * 0.84, g: g * 0.44, uzak: true }, 0.29, 0.25);
      }
    }

    if (agir && b === 3 && adim === 6 && evre >= 2) {
      // Skarn'ın ikinci evresinde zincirden gelen, finalde daha sertleşen karşı ritim.
      m.nota('_ayazZincirRitim', t, { g: evre === 3 ? 0.35 : 0.22, agir: evre === 3 }, -0.21, 0.25);
    }
  }

  function muzikOlcu(m) {
    var mz = m.muz;
    mz.olcu++;
    var evre = mz.durum === 'dev' ? bossEvre(m) : 1;
    mz.gecmis.push('B' + m.bolum + ':' + mz.durum + ':' + BESTE[m.bolum].adim + ':' + mz.olcu + ':' + evre);
    if (mz.gecmis.length > 600) mz.gecmis.shift();
  }


  // olay zamanlayıcısı: [şimdiye kadar … t1) aralığındaki çıtırtı, karga, davul, kalp atışlarını yerleştirir
  Motor.prototype.planla = function (t1) {
    var m = this, c = m.c, now = c.currentTime, oz = m.oz, mz = m.muz;
    if (!m.surekli) return;
    var ayaz = m.bolum === 3;
    if (ayaz) {
      if (oz.tipi < now) oz.tipi = now + 0.06;
      while (oz.tipi < t1) { m.serbest('_ayazTipi', m.ortam, oz.tipi, { d: ra(2.0, 3.9) }, ra(0.8, 1), ra(-0.37, 0.37), 0); oz.tipi += ra(4.8, 8.4); }
    }
    if (oz.citir < now) oz.citir = now;
    while (oz.citir < t1) {
      m.serbest('_citir', m.ortam, oz.citir, null, ra(0.25, 0.7) * (ayaz ? 0.37 : 1), ra(-0.5, 0.5), 0.15);
      oz.citir += -Math.log(1 - R()) / (R() < 0.1 ? 1.5 : 7) * (ayaz ? 2.7 : 1);   // kümeler halinde
    }
    if (oz.karga < now) oz.karga = now + ra(20, 50);
    while (!ayaz && oz.karga < t1) {
      m.serbest('_karga', m.ortam, oz.karga, null, ra(0.25, 0.45), ra(-0.85, 0.85), 0.7);
      oz.karga += ra(30, 70);
    }
    // Bölümün ölçüsü: Yanık Köy 4/4, Kül Geçidi 6/8, Ayaz Hisarı 5/4.
    if (mz.sonraki < now) mz.sonraki = now + 0.05;
    while (mz.durum !== 'yok' && mz.sonraki < t1) {
      var t = mz.sonraki, a = mz.adim % BESTE[m.bolum].adim, adimSn = 15 / mz.tempo;
      if (a === 0) muzikOlcu(m);
      besteAdimi(m, t, a, adimSn);
      mz.adim++; mz.sonraki += adimSn;
    }
    // öfke kalp atışı
    if (m.kalp) {
      if (m.son.ofke != null) oz.kalp = Math.max(oz.kalp, m.son.ofke + AYAR.ses.ofke.enUzun);
      if (oz.kalp < now) oz.kalp = now + 0.02;
      while (oz.kalp < t1) { m.serbest('kalp', m.efektCekil, oz.kalp, null, AYAR.ses.kalp.g, 0, 0.05); oz.kalp += 0.52; }
    }
  };

  // ───────────────────────── ölçüm (OfflineAudioContext) ─────────────────────────
  function fft(re, im) {
    var n = re.length, i, j, k;
    for (i = 1, j = 0; i < n; i++) { var bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { var tr = re[i]; re[i] = re[j]; re[j] = tr; tr = im[i]; im[i] = im[j]; im[j] = tr; } }
    for (var len = 2; len <= n; len <<= 1) {
      var ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (i = 0; i < n; i += len) {
        var cr = 1, ci = 0;
        for (k = 0; k < len / 2; k++) {
          var a = i + k, b = a + len / 2, xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
          re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
          var ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
        }
      }
    }
  }
  var BANTLAR = [['alt<120', 0, 120], ['bas120-400', 120, 400], ['orta400-1.5k', 400, 1500], ['ust1.5-5k', 1500, 5000], ['tiz>5k', 5000, 1e9]];
  function olc(buf, t0) {
    var L = buf.getChannelData(0), Rr = buf.getChannelData(1), n = L.length, sr = buf.sampleRate, i;
    var tepe = 0, son = 0, kirpma = 0, top = 0;
    for (i = 0; i < n; i++) {
      var a = Math.max(Math.abs(L[i]), Math.abs(Rr[i]));
      if (a > tepe) tepe = a; if (a > 0.001) son = i; if (a >= 0.999) kirpma++;
    }
    var son20 = 0, son40 = 0; for (i = 0; i < n; i++) { var aa = Math.max(Math.abs(L[i]), Math.abs(Rr[i])); if (aa > tepe * 0.1) son20 = i; if (aa > tepe * 0.01) son40 = i; }
    var bas = Math.floor(t0 * sr);
    // zarfın ilk 30 ms'si: 5 ms'lik dilimlerin rms'i (dB)
    var z30 = [], dl = Math.floor(sr * 0.005);
    for (var zi = 0; zi < 6; zi++) { var zt = 0; for (i = bas + zi * dl; i < bas + (zi + 1) * dl && i < n; i++) { var zx = (L[i] + Rr[i]) / 2; zt += zx * zx; } z30.push(Math.round(10 * Math.log10(zt / dl + 1e-12))); }
    for (i = bas; i <= son; i++) { var x = (L[i] + Rr[i]) / 2; top += x * x; }
    var rms = Math.sqrt(top / Math.max(1, son - bas + 1));
    var N = 2048, en = new Float64Array(BANTLAR.length), re = new Float64Array(N), im = new Float64Array(N), tum = 0;
    for (var s = bas; s + N <= Math.max(son, bas + N); s += N) {
      for (i = 0; i < N; i++) { var y = s + i < n ? (L[s + i] + Rr[s + i]) / 2 : 0; re[i] = y * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1))); im[i] = 0; }
      fft(re, im);
      for (i = 1; i < N / 2; i++) {
        var f = i * sr / N, e = re[i] * re[i] + im[i] * im[i];
        for (var b = 0; b < BANTLAR.length; b++) if (f >= BANTLAR[b][1] && f < BANTLAR[b][2]) { en[b] += e; break; }
        tum += e;
      }
    }
    var ozet = {}, enb = '', enbv = -1;
    for (var bb = 0; bb < BANTLAR.length; bb++) { var yz = tum ? Math.round(en[bb] / tum * 100) : 0; ozet[BANTLAR[bb][0]] = yz; if (yz > enbv) { enbv = yz; enb = BANTLAR[bb][0]; } }
    function db(v) { return v > 0 ? Math.round(20 * Math.log10(v) * 10) / 10 : -999; }
    return { sure: Math.round((son / sr - t0) * 1000) / 1000, sure20: Math.round((son20 / sr - t0) * 1000) / 1000, sure40: Math.round((son40 / sr - t0) * 1000) / 1000, zarf30: z30, tepe: Math.round(tepe * 1000) / 1000, tepeDb: db(tepe), rms: Math.round(rms * 10000) / 10000, rmsDb: db(rms), kirpma: kirpma, spektrumOzet: ozet, baskin: enb };
  }

  // ───────────────────────── SES (dış yüz) ─────────────────────────
  var motor = null, zamanlayici = null, kullanici = { ana: 1, efekt: 1, muzik: 1 }, acik = true, kisma = 1, muzikDurumu = 'sakin', ozelDurum = null, sakinSayac = 0;
  var aktifBolum = oyunBolumu(), ayazBoss = null, sonKozYan = -9;
  var sessiz = !!(window.OYUN && OYUN.sessiz);
  try { var kyt = JSON.parse(localStorage.getItem('barbar-ses') || 'null'); if (kyt) for (var kk in kullanici) if (typeof kyt[kk] === 'number') kullanici[kk] = kyt[kk]; } catch (e) { /* yok */ }

  function kazancUygula(ani) {
    if (!motor) return;
    var t = motor.c.currentTime, z = ani ? 0.01 : 0.15;
    motor.ana.gain.setTargetAtTime(acik ? AYAR.ana * kullanici.ana : 0, t, z);
    motor.efekt.gain.setTargetAtTime(AYAR.efekt * kullanici.efekt, t, z);
    motor.muzik.gain.setTargetAtTime(AYAR.muzik * kullanici.muzik * kisma, t, z * 3);
    // Sürgü sıfırdayken ölçü ilerler, fakat duyulmayacak nota sesleri kurulmaz.
    motor.muzikCaliyor = acik && kullanici.ana > 0 && kullanici.muzik > 0;
    motor.ortam.gain.setTargetAtTime(AYAR.ortam * Math.max(kullanici.muzik, kullanici.efekt * 0.6) * Math.max(kisma, 0.45), t, z * 3);
  }
  function sessizMi() { return sessiz || !!(window.OYUN && OYUN.sessiz); }
  function ac() {
    if (sessizMi() || document.hidden) return false;
    try {
      if (!motor) {
        var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
        if (window.OYUN && OYUN.durum !== 'baslik') aktifBolum = oyunBolumu();
        motor = new Motor(new AC({ latencyHint: 'interactive' }), { bolum: aktifBolum });
        motor.ayazBoss = ayazBoss;
        motor.ana.gain.value = 0; motor.muzik.gain.value = 0; motor.ortam.gain.value = 0;
        motor.surekliKur();
        kazancUygula(false);
        motor.muzikDurum(muzikDurumu);
        zamanlayici = setInterval(function () {
          if (motor && motor.c.state === 'running') { try { motor.planla(motor.c.currentTime + 0.35); } catch (e) { /* yok */ } }
        }, 100);
        document.addEventListener('visibilitychange', function () {
          if (!motor) return;
          if (document.hidden) motor.c.suspend().catch(function () {});
          else if (acik && !sessizMi()) motor.c.resume().catch(function () {});
        });
      }
      if (motor.c.state !== 'running' && acik) motor.c.resume().catch(function () {});
    } catch (e) { return false; }
    return true;
  }
  // kayıt (deneme kancası): oyun olaylarını gerçek zamanla OfflineAudioContext'e yazar; ?sessiz iken de çalışır
  var kayitM = null, kayitBas = 0, kayitSure = 0, kayitSay = {}, kayitZam = null;
  function kt() { return (performance.now() - kayitBas) / 1000; }
  // dövüş yoğunluğu (0..1): saniyedeki isabet/ölüm/hasar olayları + canlı düşman sayısı → müzik katmanları
  var yogOlay = 0, yogDeger = 0, YOG_OLAY = { vurus: 1, olum: 1.2, blok: 0.8, oyuncuHasar: 1.5, sektir: 0.6, devYereVur: 1.5, devSopa: 1.2, varilPatla: 1.0, totemKir: 0.8 };
  function yogunlukGuncelle(dt) {
    if (!(dt > 0)) return;
    var D = window.DUSMAN, n = D && D.liste ? D.liste.length : 0;
    yogOlay *= Math.exp(-dt / 2.5);                       // ~2,5 sn bellek
    var hedef = sin(yogOlay / 9 + n / 30, 0, 1);
    yogDeger += (hedef - yogDeger) * (1 - Math.exp(-dt / (hedef > yogDeger ? 0.8 : 3)));   // hızlı yüksel, yavaş in
    if (motor) motor.yog = yogDeger;
    if (kayitM) kayitM.yog = yogDeger;
  }
  // test sayacı (19 Kasım): hangi ses çeşidi kaç kez istendi (?sessiz iken de sayar). SES._sayac
  var sayac = {};
  function say(ad, v) {
    v = v || {};
    var c = ad === 'vurus' ? 'vurus:' + (v.tur === 'carpma' ? 'carpma' : malzeme(v)) + (v.tur && v.tur !== 'savur' && v.tur !== 'carpma' ? '/' + v.tur : '') + (v.kesme ? '+kesme:' + (v.hedef && v.hedef.tur || '?') : '') + (v.sira > 1 ? '+zincir' : '')
      : ad === 'baltaCagir' ? 'baltaCagir'
      : ad === 'sektir' ? 'sektir:' + (v.tur || '?') + (v.kusursuz ? '+kusursuz' : '')
      : ad === 'blok' ? (v.kirildi ? 'blok:kirildi' : 'blok:kalkan')
      : (ad === 'varilPatla' || ad === 'totemKir' || ad === 'kozYan') ? ad : null;
    if (c) sayac[c] = (sayac[c] || 0) + 1;
  }
  function cal(ad, v) {
    say(ad, v);
    if (YOG_OLAY[ad]) yogOlay += YOG_OLAY[ad];
    var gec = ad === 'vurus' && v && v.tur === 'balta' && v.sira > 1 ? Math.min(v.sira - 1, 5) * 0.03 : 0;   // aynı karedeki zincir isabetleri art arda duyulsun
    if (kayitM) { var t = kt(); if (t < kayitSure - 0.1) { kayitSay[ad] = (kayitSay[ad] || 0) + 1; try { kayitM.cal(ad, v, t + gec); } catch (e) { kayitSay.hata = String(e); } } }
    if (sessizMi() || !motor || motor.c.state !== 'running') return null;
    try { return motor.cal(ad, v, gec ? motor.c.currentTime + 0.005 + gec : null); } catch (e) { return null; }
  }
  function muzikYap(d) {
    muzikDurumu = d;
    if (motor) motor.muzikDurum(d);
    if (kayitM) { kayitM.muzikDurum(d, kt()); kayitSay['muzik:' + d] = (kayitSay['muzik:' + d] || 0) + 1; }
  }
  function bolumYap(no, sifirlaMuzik) {
    no = bolumNo(no) || 1;
    var degisti = no !== aktifBolum;
    if (degisti) ayazBossYap(null);
    aktifBolum = no;
    if (degisti && sifirlaMuzik) {
      ozelDurum = null; sakinSayac = 0; sonKozYan = -9; kalpYap(false);
      muzikDurumu = 'sakin';
    }
    if (motor) motor.muzikBolum(no, null, muzikDurumu);
    if (kayitM) kayitM.muzikBolum(no, kt(), muzikDurumu);
  }
  function ayazBossYap(boss) {
    ayazBoss = boss;
    if (motor) motor.ayazBoss = boss;
    if (kayitM) kayitM.ayazBoss = boss;
  }
  function kalpYap(b) { if (motor) motor.kalp = b; if (kayitM) kayitM.kalp = b; }
  function hedefMuzik() { return ozelDurum || muzikDurumu; }

  var SES = window.SES = {
    AYAR: AYAR,
    get _sayac() { return sayac; },
    ac: ac,
    bolumOnizle: function (no) {
      if (window.OYUN && OYUN.durum === 'baslik') bolumYap(no, true);
    },
    cal: function (ad, v) { return cal(ad, v); },
    ayar: function (o) {
      o = o || {};
      for (var k in kullanici) if (typeof o[k] === 'number') kullanici[k] = sin(o[k], 0, 1);
      kazancUygula(false);
    },
    sus: function (b) {
      acik = (b === undefined) ? !acik : !b;
      kazancUygula(true);
      if (motor && acik && !document.hidden && !sessizMi()) motor.c.resume().catch(function () {});
      return acik;
    },
    get acik() { return !sessiz && acik; },
    durumBilgi: function () {
      return { sessiz: sessiz, bolum: motor ? motor.bolum : aktifBolum, baglam: motor ? motor.c.state : 'yok', muzik: motor && motor.muz ? motor.muz.durum : muzikDurumu,
        ses: motor ? motor.tumu.filter(function (s) { return s.bit > motor.c.currentTime && !s.kesik; }).length : 0, say: motor ? motor.say : null };
    },
    kayit: function (sn) {
      sn = sn || 10;
      var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext, c = new OAC(2, Math.ceil(44100 * sn), 44100);
      kayitM = new Motor(c, { cevrimdisi: true, bolum: aktifBolum });
      kayitM.ayazBoss = ayazBoss;
      kayitM.ana.gain.value = AYAR.ana; kayitM.efekt.gain.value = AYAR.efekt; kayitM.muzik.gain.value = AYAR.muzik; kayitM.ortam.gain.value = AYAR.ortam;
      kayitM.surekliKur(); kayitM.muzikDurum(muzikDurumu, 0);
      kayitBas = performance.now(); kayitSure = sn; kayitSay = {};
      clearInterval(kayitZam);
      kayitZam = setInterval(function () { if (kayitM) kayitM.planla(Math.min(kt() + 0.4, kayitSure)); }, 100);
      return true;
    },
    kayitBitir: function () {
      if (!kayitM) return Promise.resolve(null);
      var m = kayitM, say = kayitSay; clearInterval(kayitZam); m.planla(kayitSure); kayitM = null;
      return m.c.startRendering().then(function (buf) { var s = olc(buf, 0); s.olaylar = say; s.say = m.say; return s; });
    },
    // Sıralı karışım ölçümü: liste = [[t, ad, veri], …] ya da 'karma' (6 sn, ~25 olay/sn, savaş müziği + ortam, yoğunluk 1)
    cizdirSira: function (liste, sec) {
      sec = sec || {};
      var sr = 44100, OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext, i;
      R.tohum(sec.tohum == null ? 11 : sec.tohum);
      if (liste === 'karma') {
        liste = []; var TUR = ['goblin', 'goblin', 'okcu', 'kalkanli', 'saman'];
        for (var tt = 0.1; tt < 6; tt += ra(0.03, 0.07)) {
          var r = R(), x = ra(200, 1080), h = { tur: TUR[Math.floor(R() * 5)] };
          if (r < 0.22) { liste.push([tt, 'savur', { x: 640, y: 400, zincir: Math.floor(R() * 3) }]); liste.push([tt + ra(0, 0.05), 'vurus', { x: x, y: 400, tur: 'savur', hedef: h, agir: R() < 0.15, oldurdu: R() < 0.3 }]); }
          else if (r < 0.42) liste.push([tt, 'vurus', { x: x, y: 400, tur: R() < 0.2 ? 'carpma' : 'savur', hedef: h, oldurdu: R() < 0.25 }]);
          else if (r < 0.52) liste.push([tt, 'olum', { x: x, y: 400, tur: h.tur, parcala: R() < 0.25 }]);
          else if (r < 0.6) liste.push([tt, 'blok', { x: x, y: 400 }]);
          else if (r < 0.7) liste.push([tt, 'adim', { x: 640, y: 400 }]);
          else if (r < 0.8) liste.push([tt, 'mermi', { x: x, y: 300, tur: R() < 0.6 ? 'ok' : 'buyu' }]);
          else if (r < 0.86) liste.push([tt, 'mermiVur', { x: x, y: 300, tur: 'ok' }]);
          else if (r < 0.9) liste.push([tt, 'oyuncuHasar', { x: 640, y: 400 }]);
          else if (r < 0.94) liste.push([tt, 'sektir', { x: x, y: 400 }]);
          else liste.push([tt, 'atil', { x: 640, y: 400 }]);
        }
        sec.muzik = sec.muzik || 'savas'; sec.sure = sec.sure || 7.5;
      }
      var sure = sec.sure || (liste.reduce(function (a, b) { return Math.max(a, b[0]); }, 0) + 2.5);
      var c = new OAC(2, Math.ceil(sr * sure), sr), m = new Motor(c, { cevrimdisi: true, bolum: sec.bolum });
      m.ana.gain.value = AYAR.ana; m.efekt.gain.value = AYAR.efekt; m.muzik.gain.value = sec.muzik ? AYAR.muzik : 0; m.ortam.gain.value = sec.muzik ? AYAR.ortam : 0;
      if (sec.muzik) { var MA = muzAyar(m, sec.muzik); m.surekliKur(); m.muzikDurum(sec.muzik, 0); m.drone.gain.value = MA.drone; m.devKat.gain.value = MA.dev; m.yog = sec.yog == null ? 1 : sec.yog; m.muz.tempo = MA.tempo; }
      liste.sort(function (a, b) { return a[0] - b[0]; });
      for (i = 0; i < liste.length; i++) m.cal(liste[i][1], liste[i][2] || {}, liste[i][0]);
      if (sec.muzik) m.planla(sure);
      return c.startRendering().then(function (buf) { var s = olc(buf, 0); if (sec.tampon) s.buf = buf; s.olay = liste.length; s.olaySn = Math.round(liste.length / 6 * 10) / 10; s.say = m.say; return s; });
    },
    sesler: function () { return Object.keys(SESLER).filter(function (k) { return k[0] !== '_'; }); },
    // Belleğe işle ve ölç (donanıma ses gitmez). sec: {adet, sikl, sure, ham, sinirsiz, tohum, kuyruk, bolum}
    cizdir: function (ad, veri, sec) {
      sec = sec || {};
      var sr = 44100, t0 = 0.02, A = AYAR.ses[ad] || {}, surekli = ad === 'ortam' || ad.indexOf('muzik') === 0;
      var sure = sec.sure || (surekli ? 8 : (A.enUzun || 2) + (sec.adet ? sec.adet / (sec.sikl || 30) : 0) + (sec.kuyruk == null ? 1.6 : sec.kuyruk));
      var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      var c = new OAC(2, Math.ceil(sr * sure), sr);
      R.tohum(sec.tohum == null ? 7 : sec.tohum);
      var md = surekli && ad !== 'ortam' ? (ad.split(':')[1] || 'savas') : null;
      var bSec = sec.bolum;
      if (md && /[23]$/.test(md)) { if (bSec == null) bSec = Number(md.slice(-1)); md = md.slice(0, -1); }
      var m = new Motor(c, { cevrimdisi: true, ham: sec.ham, sinirsiz: sec.sinirsiz, bolum: bSec });
      m.ana.gain.value = AYAR.ana; m.efekt.gain.value = AYAR.efekt; m.muzik.gain.value = AYAR.muzik; m.ortam.gain.value = AYAR.ortam;
      if (surekli) {
        m.surekliKur();
        if (ad === 'ortam') m.muzik.gain.value = 0; else { var MA = muzAyar(m, md || 'savas'); m.ortam.gain.value = 0; m.muzikDurum(md || 'savas', 0); m.drone.gain.value = MA.drone; m.devKat.gain.value = MA.dev; m.muz.tempo = MA.tempo; m.yog = sec.yog == null ? 0.8 : sec.yog; m.evre = sec.evre || 1; }
        if (sec.karga) m.oz.karga = 1;
        m.planla(sure);
        if (sec.yalnizPlan) return Promise.resolve({ olculer: m.muz.gecmis.slice() });   // ölçü çeşitliliği testi (ses işlenmez)
      } else if (sec.adet) {
        for (var i = 0; i < sec.adet; i++) {
          var v = veri || {}; if (sec.karisik) v = { x: ra(100, 1180), y: 400, agir: R() < 0.2, oldurdu: R() < 0.3 };
          m.cal(ad, v, t0 + i / (sec.sikl || 30));
        }
      } else m.cal(ad, veri || {}, t0);
      return c.startRendering().then(function (buf) {
        var s = olc(buf, t0); s.ad = ad; s.say = m.say; if (sec.tampon) s.buf = buf; if (m.muz) s.olculer = m.muz.gecmis.slice(); return s;
      });
    }
  };

  function pcmTampon(c, kod) {
    var pcm = atob(kod);
    var tampon = c.createBuffer(1, pcm.length / 2, 22050);
    var kanal = tampon.getChannelData(0);
    for (var i = 0, j = 0; i < kanal.length; i++, j += 2) {
      var deger = pcm.charCodeAt(j) | (pcm.charCodeAt(j + 1) << 8);
      kanal[i] = ((deger << 16) >> 16) / 32768;
    }
    return tampon;
  }

  // Welvyn Z. Porter — Kingly Yell (dry), CC0: https://freesound.org/people/WelvynZPorterSamples/sounds/623449/
  // Kayıttaki doğal sönüş kullanılır. İki mono PCM örneği yerel açılışta da hazırdır.
  var OFKE_NARA_PCM =
    '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' +
    'xv+y/5//iP+I/5P/i/+S/5b/e/9s/2j/XP9P/1//cP9q/2n/e/+C/37/kf+O/33/d/+B/4P/hf+N/23/Zv9T/zP/Pv9f/3j/LACnAd0C6wPhBIcEKwNJAuYB' +
    'cAF7AbEBiQC4/ur9zf3P/Zj+g/87/7f+ff+xAHQBXAKmAm4BNADg/8T/lP+g/3D/yf6p/hL/h/8fAJQAuQDNAFIBzwHeAbkBEwEHACn/yv5t/gD+CP4Y/vr9' +
    'Hv57/qz+xv46/7f/yf/d//X/tP96/3z/TP/b/oL+ZP56/tb+Zf/T/wUAJQBQAI0A2AAfATABDwHgALAAeQBNABgAyf+b/5T/n//P/y0AWwBzAI8AigCOAKsA' +
    '2QDvAPsA/QDaALIAmgB+AGgAcgBvAG8AdABvAGoAZQBIAB4ABgDt/9n/8/8RAPv/6//W/6j/k/+a/5z/kP+f/6//qP+0/7L/i/9q/1j/QP8+/1r/ZP97/5f/' +
    'nv+m/63/0/8zAN4AhQEHAk8CDwKAARMBvwBnAFkAFACD/zP/Hf8N/x7/Zf9X/zL/hv8BADIAZwB8AAgAwP+1/47/W/9T/1X/Rf+I/+X/AgAqAHMAhACfANsA' +
    '3AC0AJIAYAAHAK7/Vv///sX+0/7w/gn/Ov9d/3r/nP++/9j/5v/m/9v/wv+j/37/QP8D/9f+uv7J/sz+iP6T/pH/CwF4Ag0E7gQkBLYCFQK0AdQBiQLyATQA' +
    'xv7d/Xr9eP69/1b/nP7n/oD/ewBIAgED3gGpAPP/fv+P//r/qP9o/s/98v0z/hf/IQB7AIEAFQHhAVcCiQJoArEBdwDI/2z/x/5n/ln+Gv7O/RT+bP59/gL/' +
    'yv8VADoAZAAbAMv/xf+F/wz/r/46/u/9QP7A/ir/m//m//j/QADTADkBbwGPAWkBCAHEAJoASAD1/8n/pP+M/6//+/82AFYAZABfAEgANAA5ADsAHgAEANn/' +
    'kv9o/2//iv+t/+r/OwCVAP4AcAG/Ad4B3QG4AYgBVwEfAeEAegD+/5P/PP/9/tz+6P4C/yj/Z/+6//X/FgA1AB8A8f/Q/7T/hP9i/1P/Lv8W/yH/OP9T/4r/' +
    'yP8DAD8AeQCjAKsAmQB1AEMACADc/7//o/97/1n/Yf+c/wEAcQDWAA0B+gDVAMAApACLAFsA+v+a/1z/Nf84/2H/cP95/7L/BQBXALQA5wDZAMcAqAB6AFoA' +
    'OAD3/7j/lP90/2P/fP+e/7X/3P/9/xAAIwAuACsAGgDx/7H/df9Q/0D/P/9H/0r/T/9n/4z/xP8CACwAOwBBAEEAPQAuAA8A4v+r/3b/TP9E/0H/Rv9k/3D/' +
    'c/+z/yEApgBgAQUCVgIxAscBYQEcAf4A3ACOAAUAa/8U/zT/g/+4/9b/1//P/x4AtQANARUB3ABaAN3/s/+n/3T/Jf/q/tf+8/5c/+n/PABWAIAAsQDXAAYB' +
    'JQHgAHIAHADA/23/P/8d//X+8f4Y/0n/eP+2/+b/AwAaABgACADl/7f/kP9r/zz/Dv/5/vb+Cv9J/4//v//5/zEAVwB9AJsAnQCMAHQAWgBIADEAHwAUAP//' +
    '9f8CAA8AIgBBAE0ATgBNADcAHQAKAPT/5//g/8//xv/I/8n/2v/+/yUATwCFAL0A8gAYATkBSAE5ASMB/wDMAJwAZQAnAPz/z/+g/4n/ev9x/4D/lv+l/7f/' +
    'w//D/7//uf+p/5D/f/90/2n/Zv90/37/hP+Y/67/wf/c//n/DQAdACAAHAAUAAcABAD9/+3/4//V/8f/yv/R/9r/3v/c/9z/2v/Z/+H/5v/g/+X/9/8OAC0A' +
    'VQBzAIMAlQCrAMEA0QDUAM0AsgCPAHkAXwA/ACcACQDu/97/3f/g/9z/4P/o/+T/5//w/+n/3v/b/9T/yv/J/8n/w//E/8n/zf/S/9P/1f/V/9L/1P/S/8r/' +
    'w/+9/7j/tP+0/7X/t/+6/73/wP/B/8P/xP+//77/v/+7/73/u/+0/7b/vP/H/9f/6P8CABYAIQA5AE4AXABtAH0AhwCFAIkAoAC6AN4ACwEfARgBAwHfALoA' +
    'mQB1AEoAFADc/7H/kP96/3L/b/9u/3//oP+9/9r/7//1//f/9f/0//L/6f/f/9j/0v/W/97/6P/x//j///8EAAUAAgD3/+T/zv+2/5v/g/9z/2n/ZP9s/3b/' +
    'hP+W/6X/tP/B/8z/1v/b/9r/1f/M/8T/wf/F/9D/3f/p//j/FQA3AGMAlACwAMEA2gAFAToBZQF8AXABMgHuALwAjgBjADMA+v/B/5T/i/+R/5L/mv+n/7n/' +
    '2P8DACIAJAAdAA0A8//l/+b/4f/Y/9n/4v/q//j/CgARABEAEAAPAAYA8v/c/77/mf98/2P/Uf9N/1X/af+A/5n/rf+6/8L/yP/L/8r/wv+1/6f/mv+W/5X/' +
    'l/+c/6H/sP/N//f/KABWAIIAnwC0AMsA0wDVAOoAAQEMAQ0B/wDVAJQAZQBLACkADAD1/9f/tv+l/6r/p/+g/6n/tv/E/+D///8GAP7/AQD///T/AwAUABAA' +
    'EAAZAB0AGgAcABsABwDx/+j/3v/P/8L/s/+d/4n/gf9+/4D/jP+b/6n/tf/B/8f/x//K/83/yf/H/8f/xv/D/8P/yf/M/87/2//r//r/EAAoADcARQBWAGIA' +
    'awB3AIEAfgB8AHoAbwBjAF8AXABZAF8AbAB2AHcAdgBxAGEATgA7ACUACgDy/+D/0f/H/8T/xP/H/9H/4v/z/wQAFgAgACAAHAAUAAUA8//k/9f/yv/D/8L/' +
    'wf/D/8j/zv/T/9j/3v/h/9//2v/R/8T/uP+s/6L/m/+a/53/pP+t/7r/xv/R/9v/4//q//D/9f/4//n/+f/6//r/+//+/wQADAAVACAALAA4AEIASwBQAFQA' +
    'VABTAFEATQBGAEAAOAAyAC4ALQAyADkAQgBPAFkAXwBkAGMAXQBUAEcANgAiAA8A/P/r/97/1f/P/87/0//Z/+L/7P/0//j/+v/5//T/7//n/9//2f/T/9H/' +
    '0P/S/9b/2//f/+P/5v/n/+X/4P/a/9H/yP/A/7n/tP+0/7b/u//D/8v/0//c/+X/6//x//b/+f/7//r/+P/4//f/9v/3//n//f8DAAoAEAAXABwAHwAkACcA' +
    'LAAvAC8AMQAyADEALwAvACwAKAAmACUAIgAhACMAIgAfAB4AGwAXABUAFQAUABIAEgARAA8ADQAKAAgACAAIAAoADAALAAoACgAIAAUABQADAAAA/v/6//X/' +
    '8f/s/+j/5v/l/+T/5P/l/+X/5v/m/+X/5P/k/+P/5P/l/+X/5f/l/+b/5//p/+z/7//y//T/9f/2//f/+f/6//v//P/8//z//P/9//3//f/9//7//v8AAAIA' +
    'BQAJAAsADgAPAA8ADwAPAA4AEAARABEAEQARABEAEgASABQAFQAVABUAEwASABAADQAKAAcAAwAAAP7//v/+////AAABAAIAAwAFAAcACAAJAAoACQAHAAYA' +
    'AgAAAP///P/6//r/+f/4//n/+f/5//r/+v/6//r/+f/5//j/+P/4//f/9//4//n/+//8//3///////7//f/8//v//P/7//r/+f/4//j/+f/5//r//P/9////' +
    'AQACAAQABgAIAAgACAAIAAcABQADAAEA/v/9//v/+f/4//f/9//4//n/+v/6//v//P/9//7//v/+//7//v/+////AQACAAQABQAHAAgACAAJAAkACAAHAAUA' +
    'BAACAAEA///+//7//v/+//7///8AAAAAAQABAAEAAQABAAAAAAAAAP///////wAAAQADAAQABQAHAAcACAAIAAcABgAFAAQAAwACAAEAAAAAAP////8AAAAA' +
    'AAABAAIAAQABAAEAAAD///7//f/9//3//P/8//z//P/8//3//f/+//7//v/+//7//v/9//3//f/9//7//v///wAAAQABAAIAAgACAAIAAgACAAEAAAD/////' +
    '//////////8AAP////8AAP/////+//7//f/9//3//f/+//7//////wAAAQABAAIAAwADAAQABAAEAAQABAAEAAQABAAEAAQAAwADAAIAAgABAAAAAAD/////' +
    '/////////v//////AAAAAAEAAQABAAEAAAD///7//f/9//z/+//7//v//P/8//3//v/+////AAAAAAEAAQABAAEAAQABAAEAAgACAAIAAwADAAIAAgABAAAA' +
    '///+//7//P/8//z/+//7//z//P/8//3//////wEAAgACAAIAAwACAAMAAwADAAIAAgADAAIAAwADAAMAAwADAAMAAgACAAEAAQABAAAAAAAAAAAA//8AAP//' +
    '/v/+//7//v/+//7//v///////////wAAAAAAAAAAAAAAAAAAAAD///////////////8AAAAAAAAAAAEAAQAAAAAA//////7//v/+//7//v/+//7/////////' +
    'AAD///////////////////////8AAAEAAQACAAMAAwADAAQABQAFAAUABQAFAAUABAAEAAQAAwADAAMAAwACAAEAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    '///+//7//v/+//7//v///////////wAAAAAAAAAAAAAAAAAA//////////////7///////7//v/+//7//v/+//3//f/8//z//P/8//z//P/8//3//f/+//7/' +
    '/v/+//7//////wAAAAABAAEAAQACAAIAAwAEAAQABAAFAAUABAAEAAQABAAEAAMAAwADAAIAAgABAAEAAQAAAAAA/////////v/+//7//v//////////////' +
    'AAAAAAAAAAAAAAEAAQACAAIAAQABAAEAAQABAAEAAQAAAAAA//////7//v/9//3//P/8//z//P/8//z//f/9//3//f/9//3//f/+//7//v//////AAABAAEA' +
    'AgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAQABAAEAAQABAAEAAgACAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAAAAAAAAAEAAQABAAEAAQAAAAAA' +
    'AAAAAP//AAAAAAEAAQABAAEAAQABAAAAAAAAAP////////7//v/+//7//v/+//7//v/+//7//v/////////+//7/////////AAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAP///////wAAAAABAAEAAQABAAEAAQABAAEAAAAAAAAAAAAAAAEAAQABAAIAAQABAAEAAQABAAEAAQAAAAAAAAAAAAAAAAABAAAAAAABAAAAAAAAAAAA' +
    '////////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//////7//////wAAAAAAAAAAAAD//////////////////////////wAAAAAAAAAAAAD/////////////' +
    'AAAAAAAAAAAAAAAAAAAAAAAA//////////8AAAAAAAAAAAAAAAAAAAAAAQABAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQABAAEA' +
    'AQABAAEAAQAAAAAAAAAAAAAAAAABAAEAAQACAAIAAgABAAEAAAAAAAAA//8AAAAAAAABAAEAAQACAAIAAQABAAEAAAAAAAAAAAAAAAAAAAAAAAEAAQACAAIA' +
    'AQABAAEAAAAAAP/////+//7//v///wAAAAAAAAEAAQABAAAAAQAAAAAAAAAAAP////////////////7//v///////////////////////////wAAAAAAAP//' +
    '////////////////AAAAAAAAAAAAAAAAAAAAAAAAAAD/////////////AAAAAAAAAAABAAEAAQABAAEAAQABAAEAAQABAAEAAQAAAAAAAAAAAAAAAAABAAAA' +
    'AAAAAAAAAQAAAAAAAAAAAP//AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD///////////////8AAAAA' +
    'AAAAAAEAAQAAAAAAAAAAAP////8AAAAAAAAAAAAAAAAAAAAAAQABAAEAAAAAAAAAAAAAAAAAAAAAAAAA/////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAEAAAAAAAAAAAAAAAAAAAAAAP//AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AQABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

  // Ağır Balta, Kasırga animasyonunun her tam turunda bir kez çalar.
  var AGIR_BALTA_PCM =
    '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' +
    'kP9t/vX8B/9EAAQBEQG3AIz/bv+A/1kAZgGDAR4BJAFWAsQCwwOFA24BWgBf/yEAYP+E/pL+l/3r/WX+Tv7W/qP+Xv46/zv/5gCZAa7/EwI4BJYD5wIKAvwC' +
    '3QMaBI8DQgPJA7QCGwISA8gD5AK5AcoBtwKUAiUBgwJfBPsC3ADiAFYBVgH4AfoCJAPGAagA/wCLAC8BbAJtACMA4QH5AnwEdgKQAAIAPv9b/2X/LwDu/9z+' +
    'mf6d/pH/Jv/9/uH/+gD3AfYBbgAH/1r++v+lAB4BogFMAmICNQHZ/1/+7/3C/Rj9s/2B/tT+Sf6C/rv9WP3k/lQABQHTAJUAJQD6ABkAlAD1AUUBiQGYAfIB' +
    'GAIRAeL/AQBvAFQAbv+A/x8A3QEXAucBqwIyAsQBLwHuAcQB5wAxAFEAygCHAAX/M/5L/5cAqQK1A9kCxgHUAIwA3QB4AXwAYP7B/tj+xv44/6sAXQGSAJMA' +
    'mgCw/yj/XwDBAOX+bv7Z/lb/9P91/43/m/9r/nf/kf+e/nz9Gv3O/aT+ev6x/xYB3ACU/8/+aACfAYkCuQKfAmoBIQHVAa0BNwDp/t7/SgGmAaACxQDn/zsA' +
    'UP+h/j3/Sv8TAH3/M/4n/sX+xv99AA8Ahv9PAGsABP8f/tT+l/4n/rv+9P66/6n+W/6Q/rf9sP2s/U/9bP56/mX/+gC/AUECSwJyAUEB4gDQAEQAdv5d/sv/' +
    '6f6I/kX+9vx7/Mf8Nf11/sP9l/5m/iL+5/4KAB4Afv+Z/8r+Hv/kAFIBGwGfAIn/Qv8D/0f/a/82AGb/mv4A/3L/pgAZAVICfwK5AvEBrAArAV0BkgEyAgAC' +
    '3wDa/9f/+v///08AFwHz//3+xf8xAIH/EABQAJT/lP4l/Y/9Zf6T/kr/XP6I/dX9jPxd/Zz+qP+I/4P+kv+Y/zgA6v/6/tz/2f+X/gf/3/7L/lD/mP8GAML/' +
    '5wAHAmgCtwFmASABNQDj/j3+bf/2APMBowHGAGX/c//K/ywA4v8K/1n/Kv8C/6H+UP4y/1v/Zf+eANkBpgEVAcgAuP9O/8f/SQAJAO0AjgGAArMB2gAXAZAA' +
    'CwA7/6b/WwALACwAIQD+/6YAZADw/6f/LgCwACQBOgJ1Au4CNwJNAQEBOgDN/yL/WP8J/7z/j/8//83/x/8AAML/Tf/T/hb/x/8LARsBDgHsAJUAlwDoABIB' +
    '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';

  // ───────────────────────── olaylar ─────────────────────────
  function bagla() {
    if (!window.OLAY) return;
    ['savur', 'vurus', 'blok', 'sektir', 'oyuncuHasar', 'atil', 'baltaAt', 'baltaCagir', 'baltaDondu', 'adim', 'mermi', 'mermiVur', 'sifa', 'topla', 'dalga', 'devKaya', 'atesYak', 'tutus', 'varilPatla', 'totemKir', 'ayazBuzKir', 'skarnZincir', 'ayazZincirKes', 'ayazKurtHazir']
      .forEach(function (ad) { OLAY.on(ad, function (v) { cal(ad, v); }); });
    OLAY.on('kozYan', function (v) {
      var t = (motor && motor.c) ? motor.c.currentTime : (window.OYUN && OYUN.zaman && OYUN.durum === 'oyun' && isFinite(OYUN.zaman.t)) ? OYUN.zaman.t : performance.now() / 1000;
      if (t >= sonKozYan && t - sonKozYan < 0.16) return;
      sonKozYan = t;
      cal('kozYan', v);
    });
    OLAY.on('ayazBotBas', function (v) {
      if (aktifBolum === 3 && window.OYUN && OYUN.durum === 'oyun') cal('ayazBotBas', v);
    });
    OLAY.on('skarnZeminTemas', function (v) {
      if (aktifBolum === 3 && window.OYUN && OYUN.durum === 'oyun') cal('skarnZeminTemas', v);
    });
    OLAY.on('bolum', function (v) { bolumYap(bolumNo(v) || oyunBolumu(), true); });
    OLAY.on('olum', function (v) { if (v && (v.tur === 'dev' || v.tur === 'vargor')) return; cal('olum', v); });
    OLAY.on('ofke', function (v) {
      if (v && v.acik === false) { kalpYap(false); return; }
      kalpYap(true);
      cal('ofke', v);
    });
    OLAY.on('kasirga', function (v) { cal('kasirga', v); });
    OLAY.on('arena', function (v) {
      cal('arena', v);
      if (!ozelDurum || ozelDurum === 'savas') ozelDurum = v && v.acik === false ? 'savas' : null;
      muzikYap(ozelDurum || 'sakin');
    });
    OLAY.on('devBasla', function (v) {
      var ob = bolumNo(v) || (oyunBolumu() === 3 ? 3 : ((v && v.tur === 'vargor') || (window.VARGOR && VARGOR.aktif) ? 2 : oyunBolumu()));
      if (ob !== aktifBolum) bolumYap(ob, false);
      if (ob === 3) ayazBossYap(v && v.boss);
      cal('devBasla', v); ozelDurum = 'dev'; muzikYap('dev');
    });
    OLAY.on('devOldu', function (v) {
      cal('devOldu', v); ayazBossYap(null);
      // Arena takviyeleri zafer başlamadan önce kapanış temasını kesmesin.
      ozelDurum = 'sakin'; muzikYap('sakin');
    });
    OLAY.on('oyuncuOldu', function (v) { kalpYap(false); cal('oyuncuOldu', v); ozelDurum = 'yok'; muzikYap('yok'); });
    OLAY.on('kazandi', function (v) { kalpYap(false); cal('kazandi', v); ozelDurum = 'sakin'; muzikYap('sakin'); });
    OLAY.on('durum', function (x) {
      var d = typeof x === 'string' ? x : (x && (x.durum || x.d));
      kisma = d === 'mola' ? AYAR.kisma.mola : d === 'oldu' ? AYAR.kisma.oldu : d === 'baslik' ? AYAR.kisma.baslik : 1;
      if (d !== 'oyun') kalpYap(false);
      if (d === 'oldu') { ozelDurum = 'yok'; muzikYap('yok'); }
      else if (d === 'baslik') { ozelDurum = null; muzikYap('sakin'); }
      kazancUygula(false);
    });
  }
  bagla();

  if (!sessiz) {   // ilk kullanıcı dokunuşunda AudioContext açılır
    var ilk = function () { ac(); };
    ['pointerdown', 'keydown', 'touchend', 'mousedown'].forEach(function (e) { window.addEventListener(e, ilk, true); });
  }

  // Dev'in sopa / yere vurma / kükreme / adım anları için olay yok (dev.js yalnız duvara çarpınca devYereVur yayıyor).
  // Güvenli yedek: DEV.durum geçişlerini ve yürüme karesini OKUYARAK ses çalınır (oynanışa dokunmaz).
  // dev.js bu adlarla olay yayarsa (devAdim, devKukre, devSopa, devYereVur) o tür için okuma kendiliğinden kapanır.
  var citT = 0.05;
  var devIz = { durum: null, yarim: -1, olayla: {}, sonYV: -9 };
  ['devAdim', 'devKukre', 'devSopa'].forEach(function (ad) {
    if (window.OLAY) OLAY.on(ad, function (v) { if (!(v && v.skarn)) devIz.olayla[ad] = true; cal(ad, v); });
  });
  // devYereVur: duvar (hücum sonu), sopa:true (sopa/yere vurma inişi), olum:true (gövde yere çarpar)
  if (window.OLAY) OLAY.on('devYereVur', function (v) {
    v = v || {};
    if (v.skarn) { cal('devYereVur', v); return; }
    devIz.sonYV = performance.now() / 1000;
    if (v.sopa) {
      devIz.olayla.devSopa = devIz.olayla.devYereVur = true;
      var D = window.DEV;
      cal(D && D.durum === 'yerevur' ? 'devYereVur' : 'devSopa', v);   // yere vurma daha ağır, düz sopa inişi daha kısa
      return;
    }
    if (!v.duvar && !v.olum) devIz.olayla.devYereVur = true;
    cal('devYereVur', v);
  });
  function devDinle() {
    var D = window.DEV;
    if (!D || !D.aktif || D.olu) { devIz.durum = D ? D.durum : null; devIz.yarim = -1; return; }
    var d = D.durum, o = devIz.durum, yer = { x: D.x, y: D.y }, ol = devIz.olayla;
    if (d !== o) {
      if (o === 'sopa' && d === 'toparlan' && !ol.devSopa) cal('devSopa', yer);
      else if (o === 'yerevur' && (d === 'yvAra' || d === 'toparlan') && !ol.devYereVur && performance.now() / 1000 - devIz.sonYV > 0.3) cal('devYereVur', yer);
      if (!ol.devKukre) {
        if (d === 'kukre') cal('devKukre', yer);
        else if (d === 'hucumHaz') cal('devKukre', { x: D.x, y: D.y, kisa: true });
      }
      devIz.durum = d;
    }
    var s = D.sprite, a = s && s._a;
    if (!ol.devAdim && s && s.anim === 'yuru' && a && a.n >= 4) {
      var y = Math.floor(((s.kare % a.n) / a.n) * 2);   // 0. ve n/2. karede ayak yere basar
      if (devIz.yarim >= 0 && y !== devIz.yarim) cal('devAdim', { x: D.x, y: D.y, hizli: d === 'hucum' });
      devIz.yarim = y;
    } else devIz.yarim = -1;
  }

  if (window.OYUN && OYUN.sistem) {
    OYUN.sistem('ses', {
      baslat: function () { kazancUygula(false); },
      guncelle: function (dt) {
        if (window.OYUN && oyunBolumu() !== aktifBolum) bolumYap(oyunBolumu(), false);
        try { devDinle(); } catch (e) { /* yok */ }
        yogunlukGuncelle(dt);
        // Yakıcı ateşi: birikinti varken kısık çıtırtı döngüsü (kısa kümeler, rastgele aralık)
        var AT = window.DUSMAN && DUSMAN.atesler;
        if (AT && AT.length && AYAR.darbe.citirti > 0 && dt > 0) {
          citT -= dt;
          if (citT <= 0) { var f = AT[(R() * AT.length) | 0]; citT = ra(0.09, 0.2) / Math.sqrt(AT.length); cal('citirti', { x: f.x, y: f.y }); }
        } else citT = 0.05;
        // kendi kendine yoğunlaşma: arena/dev yokken kalabalıkta savaş, sakinleşince sakin
        if (ozelDurum) { if (muzikDurumu !== ozelDurum) muzikYap(ozelDurum); return; }
        var D = window.DUSMAN, n = D && D.liste ? D.liste.filter(function (d) { return !d.olu; }).length : 0;
        if (n >= 5) { sakinSayac = 0; if (muzikDurumu !== 'savas') muzikYap('savas'); }
        else if (muzikDurumu === 'savas' && n < 2) { sakinSayac += dt; if (sakinSayac > 6) muzikYap('sakin'); }
        else if (muzikDurumu === 'yok') muzikYap('sakin');
      },
      sifirla: function () {
        ozelDurum = null; sakinSayac = 0; sonKozYan = -9; kalpYap(false); ayazBossYap(null);
        if (window.OYUN && oyunBolumu() !== aktifBolum) bolumYap(oyunBolumu(), false);
        if (motor) {
          var t = motor.c.currentTime;
          motor.kesTur('baltaAt', t);
          if (motor.muz && (motor.muz.durum !== 'sakin' || motor.muz.olcu > 1)) motor.muzikDurum('sakin', t, true);
        }
        muzikYap('sakin');
      }
    });
  }
})();
