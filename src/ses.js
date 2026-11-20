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
      ofke:        { g: 1.75, sinir: 1, aralik: 0.5,  enUzun: 1.24, yanki: 0, perde: 0, muzikCekSure: 0.95 },
      kasirga:     { g: 0.98, sinir: 2, aralik: 0.19, enUzun: 0.29, yanki: 0.05, perde: 0.03 },
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
      ses.buffer = m.nara || (m.nara = naraTampon(m.c));
      ses.playbackRate.value = p;
      ses.connect(o);
      ses.start(t);
      return ses.buffer.duration / p;
    },

    kasirga: function (m, o, t, v, p) {
      gurultu(m, o, t, { d: 0.252, a: 0.046, tut: 0.023, g: 0.68,
        tip: 'bandpass', f: [[0, 460 * p], [0.07, 1800 * p], [0.18, 460 * p]], q: 1.15 });
      gurultu(m, o, t + 0.037, { d: 0.156, a: 0.025, g: 0.24,
        tip: 'highpass', f: [[0, 3670 * p], [0.055, 2520 * p], [0.15, 1140 * p]], q: 0.9 });
      ton(m, o, t + 0.015, { tip: 'triangle', f: [[0, 142 * p], [0.12, 64 * p]], d: 0.18, a: 0.04, g: 0.24, lp: 470 });
      return 0.26;
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
  var CEKIL = { vurus: 0.42, blok: 0.3, sektir: 0.25, oyuncuHasar: 0.45, devYereVur: 0.5, devSopa: 0.45, devKaya: 0.35, devBasla: 0.4, devOldu: 0.5, ofke: 0.53, atil: 0.15, varilPatla: 0.38, totemKir: 0.28, ayazBuzKir: 0.16, skarnZincir: 0.25, ayazZincirKes: 0.15, ayazKurtHazir: 0.15 };
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
    var vg = this.zincir(this.efekt, g, panDeger(v, A.yakinPan), A.yanki == null ? 0.12 : A.yanki, mes < 0.95 ? 2600 + 16000 * Math.pow(Math.max(0, mes - AYAR.mesafe.enAz) / (0.95 - AYAR.mesafe.enAz), 2) : 0);
    var dd = f(this, vg, t, v, p) || 0.5, d = Math.min(dd, A.enUzun || 3);
    if (dd > d) { vg.gain.setValueAtTime(g, Math.max(t, t + d - 0.06)); vg.gain.linearRampToValueAtTime(0, t + d); }
    if (CEKIL[ad] && t > this.cekilSon - 0.05) {   // müziği kısa süre kıs (üst üste binerse yalnız uzat)
      var cp = this.cekil.gain, dz = CEKIL[ad] * (v.agir || v.oldurdu ? 1.25 : 1);
      if (cp.cancelAndHoldAtTime) cp.cancelAndHoldAtTime(t); else cp.cancelScheduledValues(t);
      var cekilBitis = t + (A.muzikCekSure || 0.07);
      cp.linearRampToValueAtTime(1 - Math.min(0.6, dz), t + 0.012);
      cp.setTargetAtTime(1, cekilBitis, 0.11);
      this.cekilSon = cekilBitis;
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
      while (oz.kalp < t1) { m.serbest('kalp', m.efekt, oz.kalp, null, AYAR.ses.kalp.g, 0, 0.05); oz.kalp += 0.52; }
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

  function naraTampon(c) {
    var pcm = atob(OFKE_NARA_PCM);
    var tampon = c.createBuffer(1, pcm.length / 2, 22050);
    var kanal = tampon.getChannelData(0);
    for (var i = 0, j = 0; i < kanal.length; i++, j += 2) {
      var deger = pcm.charCodeAt(j) | (pcm.charCodeAt(j + 1) << 8);
      kanal[i] = ((deger << 16) >> 16) / 32768;
    }
    return tampon;
  }

  // Welvyn Z. Porter — Male Yelling out a War Cry 4 (dry), CC0: https://freesound.org/people/WelvynZPorterSamples/sounds/621335/
  // Düzenlenmiş 1,18 sn mono PCM, index.html yerel dosya olarak açıldığında da çalışır.
  var OFKE_NARA_PCM = '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' +
    'uP+8/8H/z//q/wYAGwA3AFUAWgBRAFAASgA+ADEAFgD4/+z/2f+t/5T/n/+Y/3b/dP+G/3f/YP9d/27/nP/S/w0AZQCwAMEAugCuAIUARgAQAPv/AgAJAAgA' +
    'FwAqABwAAgAHAB8AKgA2AFMAaABfAEMAIQD8/9T/rP+Y/5v/n/+i/7P/z//l//P/BwAiADQAQABRAFkASwA1ACMADQD6/+z/4f/c/9j/0P/O/9H/0P/R/9j/' +
    '2v/W/9H/wv+k/4j/fP9+/43/uf///0MAdgCSAJgAiABjADYAGgARABAAFwAkACkAHwAKAPD/3f/a/+n/CAApAD0ARABBADAAFQD8/+3/4f/T/8z/zP/M/87/' +
    '2P/i/+r/9v8GABQAJQA0ADcALwAiABUACAD+//b/7//i/9L/x//A/7v/u//C/8v/zv/S/9v/3v/c/+j/+P8EAB0AOQBHAEsASQA5ACIAEQAHAAQACQAQABMA' +
    'EwARAA8ADQAQABUAFgAUABQAEQAGAPz/9P/o/9v/1v/a/93/5f/z//v//f8CAAkADgATABwAIgAfABwAGAARAAkABAD+//b/8P/s/+f/5P/l/+b/5//o/+v/' +
    '7v/w//H/8v/y//H/8v/4/wAACAAQABQAFQAUABEADgAMAAwADQANAA0ADAALAAgABgAEAAMAAQAAAP///v/+//3/+//6//n/+P/4//r//P/9//7///8AAAEA' +
    'AgADAAQABAAEAAQAAwACAAIAAQAAAP/////+//7//v/9//7//v/+//7//v/+//7//v/+//7//v/+//7///8AAAEAAgACAAIAAgACAAIAAQABAAEAAQABAAEA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAA';

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
