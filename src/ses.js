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
      ofke:        { g: 1.75, sinir: 1, aralik: 0.5,  enUzun: 1.7, yanki: 0, perde: 0 },
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
      ses.playbackRate.value = p * 0.92;
      ses.connect(o);
      ses.start(t);
      return ses.buffer.duration / ses.playbackRate.value;
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
  var CEKIL = { vurus: 0.42, blok: 0.3, sektir: 0.25, oyuncuHasar: 0.45, devYereVur: 0.5, devSopa: 0.45, devKaya: 0.35, devBasla: 0.4, devOldu: 0.5, ofke: 0.76, atil: 0.15, varilPatla: 0.38, totemKir: 0.28, ayazBuzKir: 0.16, skarnZincir: 0.25, ayazZincirKes: 0.15, ayazKurtHazir: 0.15 };
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
    var nara = ad === 'ofke';
    if (CEKIL[ad] && (nara || t > this.cekilSon - 0.05)) {
      var cp = this.cekil.gain, dz = CEKIL[ad] * (v.agir || v.oldurdu ? 1.25 : 1);
      if (cp.cancelAndHoldAtTime) cp.cancelAndHoldAtTime(t); else cp.cancelScheduledValues(t);
      var cekilBitis = t + (nara ? d : 0.07);
      cp.linearRampToValueAtTime(1 - Math.min(nara ? 0.76 : 0.6, dz), t + 0.012);
      cp.setTargetAtTime(1, cekilBitis, nara ? 0.16 : 0.11);
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

  // Welvyn Z. Porter — Kingly Yell (dry), CC0: https://freesound.org/people/WelvynZPorterSamples/sounds/623449/
  // Mono PCM; yerel dosyadan açıldığında da ilk tetiklemede hazırdır.
  var OFKE_NARA_PCM =
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD//wAAAAAAAAAAAAAAAAAAAQABAAEAAQAAAAAAAAD/////////////AAABAAEA' +
    'AgACAAIAAgABAAAA///+//3//f/9//z//f/+//7/AQADAAUABQAFAAUAAwABAP7//P/6//r/+//7//3/AAABAAMABAAFAAQABAADAAIAAQD///3/+v/6//v/' +
    '/f///wAAAgADAAQABQAFAAUABAACAP///f/7//j/9v/2//j/+v/+/wIABQAJAAsACwAIAAMAAQD8//v/+//6//v/+//8//z//f///wAAAAAAAP7//P/7//n/' +
    '+P/4//f/9v/5//v//v8AAAIABQAGAAYABwAIAAkACgAIAAYAAgD///3//P/9////AgAEAAQABgAGAAcABwAHAAYAAwAAAP7//f///wIABgAHAAkACwAMAAoA' +
    'BwAGAAEA+//2//T/9f/6//7/BQAIAAwADgAOAAwACgALAAgAAwD///3/+//7//z//f/+//7/AAACAAYACAAJAAoACQAGAAQAAwD///z//P/5//X/9P/0//X/' +
    '9//7/////v8AAP//AAAAAAEAAgABAP///f/7//z//f/+////AAADAAIABQAKAAsACgAKAAcABAABAAMAAwAEAAYABgAGAAgACwALAAwACwAKAAkABAAAAPz/' +
    '9//1//L/8f/w//H/8f/z//f/+/8AAAEAAAACAAQAAgABAAAA///9//7//v/9////AAABAAAAAQD///7/+v/7//3//P/8//3//f/8//////8BAAAA/v/+//z/' +
    '+//7//v/+f/6//7//////wIAAAD+/wAA/v/8//r/+//7//n/+v/7//v/9f/v/+7/6f/j/+L/4P/f/9//4f/g/+H/4P/b/9j/0v/K/8P/uv+y/67/q/+p/6X/' +
    'of+h/6H/ov+n/6z/sP+0/7z/xP/K/8//z//O/8v/yv/I/8r/zP/T/93/7f/7/wYAFgAmADMAQABNAFAASQBHAEMANAA0ADkAQABRAG8AiACSAMoAFAFGAZQB' +
    'BAI4AhkC/wHhAXMBFwHsAKQAYQBAADoAUgBqAKYA7AAEAQ8BDwH5AL4AbAAgANH/iP9F/w3/7f7E/pf+gv55/mv+ZP6F/qv+wf7z/i//Tv96/6D/v//F/5T/' +
    'X/8i/9L+tf6u/sT+BP8y/4H/6f8tAHcArwDIAMwAuACkAHkASwAiAPr/7//m/+P/7f/m/+H/3//m//L/+/8PABUADwAVAPH/xv+i/1X/Ff/e/qT+ff5j/m7+' +
    'jv6v/vn+N/9b/5P/qv+q/6v/k/9+/3L/bf9n/2H/cf+B/4P/q//d/wwAQABjAJoA8AA9Aa0BEQI7ApgC/QIiA1gDvwPTA08D2AKNAvEBlgGLAXkBhAGOAbYB' +
    'BAIqAlYCeAJYAvkBfwEFAVgApv8c/6H+V/4L/sr9x/2z/Zf9kf2X/Y39d/2d/cL9yv31/QL+8v33/fr9K/5N/kn+R/5K/ln+gP7P/kP/uf8VAGQAxgAAARsB' +
    'PQE7ASsBHwEPAfcAvQCcAJUAhgCfALAAwgDSALMAkgByAE4ALADw/73/gv8t/9z+kP5Y/ib+C/4g/iH+Jf4z/j/+T/5Y/nf+lv6U/pb+if6L/oD+XP6R/uD+' +
    '/v48/4//yv/N/73/1v/A/9f/IgBpAC4BFQKCAmgDYwQbBe4FggbFBjwGFQVWBEwDPgIWAgIC/wExAnYCGAOIA8wDMwQkBKsDDwNEAkABOgBa/5L+Ef6S/Qb9' +
    'wPxX/N/7o/u1+8774ft5/En9if3d/TP+Av7I/Z79TP3p/Gr85/ub+677Jvz3/Nr9x/6z/0sA8ABgAWQBkAF6AUYBSgElAQcB0wCCAGUARgBdAH8AbgB1AG0A' +
    'bQCJAKUA1gDdALgAUwDO/yz/e/7t/Vz99fzb/JX8cfzK/Ev9s/34/bX+S/8w/2z/sf+N/yH/zP7h/qL+yP6M/x8A9AD6AfsCNARDBYoGtAcBCDwIBQjjBjAG' +
    'XQVPBB8E/gOTA4cDvwP2A0wEpAQGBfsEggTrAxUDHQIFAf3/7v7j/fv8MPx/+8L6O/oF+h/6cfrG+lH7+vsP/Aj8U/w8/Pn7svsr+736M/rg+Q/6R/rf+ub7' +
    'w/yy/bP+Y//o/1IAlQDcAO0A8ADcALgAkwBfAD8ATgB1AIIAdwC8AMoAkADiAA4BEQFmAXYBZAHzAHIAUADG/27/Yv8o/y7/9f7I/iH/aP/3/0YAyQDuARsC' +
    'SQIuAzEDAgM3A0gD1gK5Au0CwwK3AiIDkgMiBMAEPQX0BTIGLwb5BWwFxwQMBE8DuwJTAugBTwEaASUB1gCvALkAGgBG/9r+Hv5T/dX8dfz8+4/7K/v0+rf6' +
    'X/oU+r35zfne+ej5U/rD+gf7YPvL+wP8KPw4/Br86/vr++n7Afx4/Mf8P/37/Zf+/P5c/77/x/8TAG8AWABmAKAAaABdALEA7gBjAcABZQJzAkQCyAJcAkgC' +
    '0QIlA3oDngMBBN0DtQMYBPYDLARYBNADjANNA4MC8QL9ArcCOgOJA7EDlQOOA54DJQOuAo0CIQLiAUUBkgB5AOf/i//1/6b/Uf9D/zz/3v7g/hf/DP9o/0b/' +
    'QP9e/w7/lv4f/rP9i/00/d38wfx//Cz8Nvw4/IP8t/z4/Dn98/wR/WT9Pv1U/Yj9Vf2C/Yv9Pf0x/Sb96fzr/Ab9K/1I/S39Nf3R/AH9bv04/Qv9of09/kv+' +
    'UP6K/9YAAQEwAUACVgPuAkEC0gKFAkwBGwLmAhYEdAUSBsAHnQi0B8wI1QmbCNEHcAfRBsYF5gQhBYsFCwWjBMAEnwSfA9ICpwLlAdQAFAFNAWsATQAvAKv/' +
    '0v5L/ZP8VPzC+uP5BvrI+Wr5nflj+hn7EPsG+wD7Z/q++cv50fnF+SP6a/ry+lX7Qvu7+wj8uPu++zn8tfzh/GD96/2x/cr9g/6c/kr+Mf66/r3+X/42/3cA' +
    'hgDzAEIC9wK3AmcD/gPJAq8C1wLvASEDYQToA9QEUgaGBiwG2AarBykHegaSBg0G4AWvBQ4FiQWQBTAFeQXwBIQDDgOeApIBVwGUAYcBYgHNADQAZgB5AEkA' +
    'YgCWABsAFv95/iX9zvvt+zP7vflY+Rz5QPiY9yH4A/mG+YX6Ivvu+hL7JfvW+tP6Fvsv+1v7OfvJ+rX6Kfuu+7b7DfzE/Cn8r/sG/DT8gfwL/vz/dAALAVMD' +
    'NgRVBO8E9gTMBM8DQgOMA6ADqQQ/BZIFYAelB8wHJQkQCFwHSwgcB1IGKwcxB9gGmwZjBmEGUgU/BJ8DJAKdAB8ADQCh/4H/2P90AB0Alv8jAGD/+v1f/Yj8' +
    'dPyX/C38Xfyd/N781Pzr+yz8aPuE+aP5O/mr+Ev5mPkO+gn7lvvz+8L8Af1Z/DH84fzx/LP8xfzi/FH8ffv4+zL8ffvV+/z6jPos/NL9P//nAJ0CjwOTApUC' +
    'OwN5AvkBjAF2AW0CowJQA80EKQb+BvgGSQe9B2wH9QYvBzIHagZ4BywJOAmaCSoKxwjOBr0ETAOrAiUC3QF7ASUB6QCiAE0BhwFmASwCFQES/8f+WP7t/Y/9' +
    'nvy0/Pr7s/kq+ID3qPbJ9dL2Nvhh+AH5Evrk+Rn6tvrF+l/6Qvp/+aD4ofjg+Br5Fvr5+rL6fvr8+nH6L/np+YL7zvsD/Dr+pgA9AVMBTgNlBKED0AOWBBkE' +
    'TgSCBesGKwhnCXgKMQs5DPcLtgtKDW4M6QkxCkcKXAmICYgJkgiWB0sGUwSGA1cDXwLUAUMBSgDL/6D/T/77/MP8h/wh/A78zvuz/Dz91fuK+3X8rfrE+EX4' +
    '8vYC9T31N/b99Xv2MPju+AL5+flf+qn6NfvV+ij7Avzr+z/8wPzq+6H7Wvwj+775nfrp+lX5rvmn/Dz9+fwgAEUD1APvA/UFHAiSBtMFWQgdCVsJcAszDX4N' +
    'EgwaCrIJOgkFCJgIOwoZCZIHnghLCcoJKAtlCw4Khwd6BKYBMQB1/1b/G/+V/pf9sfu3+WH5Gvpa+lj7dv2+/Vn9IP3I/JT8tfuY+rT4XvUn8zzy/vF48yj2' +
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
