/* Vladimir's World Game (versiunea în portugheză) — un joc de geografie pentru copii. */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Date
  // ---------------------------------------------------------------------------
  const CONTINENTS = {
    WORLD: { name: 'Mundo inteiro', en: 'O mundo inteiro', emoji: '🌍', box: null },
    EU: { name: 'Europa', en: 'Europa', emoji: '🏰', box: [[-25, 34], [45, 71]], hue: 265 },
    AS: { name: 'Ásia', en: 'Ásia', emoji: '🐼', box: [[25, -11], [148, 58]], hue: 25 },
    AF: { name: 'África', en: 'África', emoji: '🦁', box: [[-19, -36], [52, 38]], hue: 48 },
    NA: { name: 'América do Norte', en: 'América do Norte', emoji: '🦅', box: [[-168, 7], [-52, 72]], hue: 120 },
    SA: { name: 'América do Sul', en: 'América do Sul', emoji: '🦜', box: [[-84, -56], [-34, 13]], hue: 170 },
    OC: { name: 'Oceânia', en: 'Oceânia', emoji: '🦘', box: [[110, -48], [180, 0]], hue: 340 }
  };

  const COUNTRIES = window.VWG_COUNTRIES.map(function (r) {
    return {
      id: r[0], iso: r[1], name: r[2], capital: r[3],
      lat: r[4], lon: r[5], conts: r[6], level: r[7]
    };
  });
  // Jocul e în portugheză: numele afișate și cele rostite vin din VWG_PT.
  // „withArt” are și articolul (a França, o Brasil), pentru frazele rostite.
  const PT = window.VWG_PT || {};
  COUNTRIES.forEach(function (c) {
    const pt = PT[c.id] || [];
    c.name = pt[0] || c.name;
    c.capital = pt[1] || c.capital;
    c.withArt = (pt[2] ? pt[2] + ' ' : '') + c.name;
  });
  const byId = new Map(COUNTRIES.map(function (c) { return [c.id, c]; }));

  const ROUND_SIZE = 10;
  const MAX_TRIES = 3;
  const STORE_KEY = 'vwg-pt-total-stars';

  const PRAISE = ['Muito bem!', 'Boa!', 'Excelente!', 'Fantástico!', 'Espetacular!', 'Que inteligente!', 'Viva!'];

  // ---------------------------------------------------------------------------
  // Stare
  // ---------------------------------------------------------------------------
  const state = {
    mode: null,        // 'find' | 'capitals' | 'explore'
    region: 'WORLD',
    level: 1,
    queue: [],
    idx: 0,
    score: 0,
    results: [],       // 'star' | 'helped' pentru fiecare întrebare
    tries: 0,
    helped: false,
    answered: false,
    current: null,
    sound: true
  };

  // ---------------------------------------------------------------------------
  // Utilitare
  // ---------------------------------------------------------------------------
  const $ = function (id) { return document.getElementById(id); };

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  function flagEmoji(iso) {
    return String.fromCodePoint.apply(null, iso.toUpperCase().split('').map(function (ch) {
      return 0x1f1e6 + ch.charCodeAt(0) - 65;
    }));
  }

  function setFlag(el, c) {
    el.textContent = '';
    if (!c) return;
    const img = new Image();
    img.alt = 'Bandeira: ' + c.name;
    img.src = 'https://flagcdn.com/w160/' + c.iso.toLowerCase() + '.png';
    img.onerror = function () { el.textContent = flagEmoji(c.iso); };
    el.appendChild(img);
  }

  function loadTotal() {
    try { return parseInt(localStorage.getItem(STORE_KEY), 10) || 0; } catch (e) { return 0; }
  }

  function saveTotal(n) {
    try { localStorage.setItem(STORE_KEY, String(n)); } catch (e) { /* fără stocare */ }
  }

  // ---------------------------------------------------------------------------
  // Voce (citește cu voce tare, în portugheză)
  // ---------------------------------------------------------------------------
  // Browserele nu spun genul vocii, așa că recunoaștem vocile feminine după nume
  // (Chrome, Edge/Windows, Apple). Dacă nu găsim niciuna, vocea e mai subțire (pitch mai mare).
  const FEMALE = /female|feminin|mulher|joana|catarina|raquel|fernanda|francisca|luciana|maria|helia|hélia|thalita|leila|leticia|letícia|manuela|brenda|elza|giovanna|yara|camila|vitoria|vitória|google portugu/i;
  const MALE = /\bmale|masculin|homem|duarte|daniel|antonio|antónio|felipe|cristiano|donato|fabio|fábio|humberto|julio|júlio|nicolau|valerio|valério|ricardo|tiago/i;
  let ptVoice = null;
  let voiceFemale = false;
  function pickVoice() {
    if (!('speechSynthesis' in window)) return;
    const voices = speechSynthesis.getVoices();
    const en = voices.filter(function (v) { return /^pt(-|_|$)/i.test(v.lang); });
    const female = en.filter(function (v) { return FEMALE.test(v.name) && !/\bmale\b/i.test(v.name); });
    const notMale = en.filter(function (v) { return !MALE.test(v.name); });
    function prefer(list) {
      return list.find(function (v) { return /pt[-_]PT/i.test(v.lang); }) ||
        list.find(function (v) { return /pt[-_]BR/i.test(v.lang); }) || list[0] || null;
    }
    ptVoice = prefer(female);
    voiceFemale = !!ptVoice;
    if (!ptVoice) ptVoice = prefer(notMale) || prefer(en);
  }
  if ('speechSynthesis' in window) {
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  }

  let lastSpoken = '';
  function speak(text, remember) {
    if (remember !== false) lastSpoken = text;
    if (!state.sound || !('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = ptVoice ? ptVoice.lang : 'pt-PT';
    if (ptVoice) u.voice = ptVoice;
    u.rate = 0.9;
    u.pitch = voiceFemale ? 1.1 : 1.35;
    speechSynthesis.speak(u);
  }

  // ---------------------------------------------------------------------------
  // Sunete (generate, fără fișiere)
  // ---------------------------------------------------------------------------
  let audio = null;
  function tone(freq, start, dur, type, vol) {
    if (!state.sound) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const t0 = audio.currentTime + start;
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(audio.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    } catch (e) { /* fără audio */ }
  }
  const sfx = {
    good: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, i * 0.09, 0.25, 'triangle', 0.25); }); },
    bad: function () { tone(220, 0, 0.18, 'sine', 0.2); tone(185, 0.16, 0.25, 'sine', 0.2); },
    tap: function () { tone(660, 0, 0.08, 'sine', 0.12); },
    win: function () { [523, 659, 784, 659, 784, 1047].forEach(function (f, i) { tone(f, i * 0.13, 0.3, 'triangle', 0.25); }); }
  };

  // ---------------------------------------------------------------------------
  // Confetti
  // ---------------------------------------------------------------------------
  const confettiCanvas = $('confetti');
  const cctx = confettiCanvas.getContext('2d');
  let pieces = [];
  let confettiRunning = false;
  function confetti(amount) {
    const dpr = window.devicePixelRatio || 1;
    confettiCanvas.width = innerWidth * dpr;
    confettiCanvas.height = innerHeight * dpr;
    cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const colors = ['#ff7b54', '#7b61ff', '#2ec27e', '#ffc93c', '#5fb7e5', '#ff5da2'];
    for (let i = 0; i < (amount || 120); i++) {
      pieces.push({
        x: innerWidth / 2 + (Math.random() - 0.5) * innerWidth * 0.4,
        y: innerHeight * 0.35,
        vx: (Math.random() - 0.5) * 14,
        vy: -Math.random() * 14 - 4,
        r: Math.random() * 6 + 4,
        rot: Math.random() * 6,
        vr: (Math.random() - 0.5) * 0.4,
        c: pick(colors),
        life: 0
      });
    }
    if (!confettiRunning) { confettiRunning = true; requestAnimationFrame(stepConfetti); }
  }
  function stepConfetti() {
    cctx.clearRect(0, 0, innerWidth, innerHeight);
    pieces = pieces.filter(function (p) { return p.y < innerHeight + 20 && p.life < 240; });
    pieces.forEach(function (p) {
      p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life++;
      cctx.save();
      cctx.translate(p.x, p.y);
      cctx.rotate(p.rot);
      cctx.fillStyle = p.c;
      cctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6);
      cctx.restore();
    });
    if (pieces.length) requestAnimationFrame(stepConfetti);
    else { confettiRunning = false; cctx.clearRect(0, 0, innerWidth, innerHeight); }
  }

  // ---------------------------------------------------------------------------
  // Harta
  // ---------------------------------------------------------------------------
  const W = 1000;
  const topo = window.VWG_WORLD;
  const OTHER_NAMES = { 'Kosovo': 'Kosovo', 'N. Cyprus': 'Chipre do Norte', 'Somaliland': 'Somalilândia' };
  const features = topojson.feature(topo, topo.objects.countries).features
    .filter(function (f) { return f.id !== '010'; }) // fără Antarctica
    .map(function (f, i) {
      if (!f.id) f.id = 'x' + i; // câteva teritorii nu au cod
      return f;
    });
  const featureById = new Map(features.map(function (f) { return [f.id, f]; }));
  const worldFC = { type: 'FeatureCollection', features: features };

  const projection = d3.geoNaturalEarth1().fitWidth(W, worldFC);
  const path = d3.geoPath(projection);
  const worldBounds = path.bounds(worldFC);
  const BASE = [0, worldBounds[0][1] - 10, W, worldBounds[1][1] - worldBounds[0][1] + 20];
  // viewBox-ul urmează forma ecranului, ca zoom-ul să folosească tot spațiul vizibil
  // (important pe telefoane ținute vertical).
  const VB = BASE.slice();

  const svg = d3.select('#map').attr('preserveAspectRatio', 'xMidYMid meet');

  function updateViewBox() {
    const r = svg.node().getBoundingClientRect();
    if (r.width && r.height) {
      const s = Math.max(BASE[2] / r.width, BASE[3] / r.height);
      VB[2] = r.width * s;
      VB[3] = r.height * s;
      VB[0] = BASE[0] + (BASE[2] - VB[2]) / 2;
      VB[1] = BASE[1] + (BASE[3] - VB[3]) / 2;
    }
    svg.attr('viewBox', VB.join(' '));
  }
  updateViewBox();

  const zoomLayer = svg.append('g');
  zoomLayer.append('path').attr('class', 'sphere').attr('d', path({ type: 'Sphere' }));
  zoomLayer.append('path').attr('class', 'graticule').attr('d', path(d3.geoGraticule10()));

  function countryColor(f) {
    const c = byId.get(f.id);
    const cont = c ? c.conts[0] : 'EU';
    const hue = CONTINENTS[cont].hue;
    // Variație mică de nuanță, ca țările vecine să se distingă.
    const n = parseInt(f.id, 10) || 0;
    const h = hue + ((n * 37) % 30) - 15;
    const l = 68 + ((n * 13) % 14);
    return c && c.level > 0 ? 'hsl(' + h + ',80%,' + l + '%)' : 'hsl(' + h + ',25%,80%)';
  }

  const countryPaths = zoomLayer.append('g').selectAll('path')
    .data(features)
    .join('path')
    .attr('class', 'country')
    .attr('d', path)
    .attr('fill', countryColor)
    .on('click', function (event, f) { onCountryClick(f); });

  const pathById = new Map();
  countryPaths.each(function (f) { pathById.set(f.id, d3.select(this)); });

  // Etichetele stau în afara stratului de zoom, ca textul să rămână mereu la fel de mare.
  const labelLayer = svg.append('g');
  let currentTransform = d3.zoomIdentity;

  function unitsPerPixel() {
    const r = svg.node().getBoundingClientRect();
    if (!r.width || !r.height) return 1;
    return Math.max(VB[2] / r.width, VB[3] / r.height);
  }

  function placeLabels() {
    const u = unitsPerPixel();
    labelLayer.selectAll('g.label').attr('transform', function (d) {
      const p = currentTransform.apply(d.xy);
      return 'translate(' + p[0] + ',' + p[1] + ') scale(' + u + ')';
    });
  }

  const zoom = d3.zoom()
    .scaleExtent([1, 40])
    .translateExtent([[-W * 0.25, BASE[1] - BASE[3] * 0.5], [W * 1.25, BASE[1] + BASE[3] * 1.5]])
    .clickDistance(10)
    .on('zoom', function (event) {
      currentTransform = event.transform;
      zoomLayer.attr('transform', currentTransform);
      placeLabels();
    });
  svg.call(zoom).on('dblclick.zoom', null); // fără zoom la dublu-tap (copiii apasă repede)
  window.addEventListener('resize', function () { updateViewBox(); placeLabels(); });

  // Cea mai mare bucată a unei țări (Franța fără Guyana, SUA fără Alaska etc.).
  function mainPart(f) {
    const g = f.geometry;
    if (g.type !== 'MultiPolygon') return f;
    let best = null;
    let bestArea = -1;
    g.coordinates.forEach(function (coords) {
      const poly = { type: 'Polygon', coordinates: coords };
      const a = d3.geoArea(poly);
      if (a > bestArea) { bestArea = a; best = poly; }
    });
    return { type: 'Feature', geometry: best };
  }

  function zoomToBounds(b, opts) {
    opts = opts || {};
    const maxK = opts.maxK || 14;
    const pad = opts.pad || 0.85;
    const dx = Math.max(b[1][0] - b[0][0], 1);
    const dy = Math.max(b[1][1] - b[0][1], 1);
    const k = Math.max(1, Math.min(maxK, pad * Math.min(VB[2] / dx, VB[3] / dy)));
    const cx = (b[0][0] + b[1][0]) / 2;
    const cy = (b[0][1] + b[1][1]) / 2;
    const t = d3.zoomIdentity
      .translate(VB[0] + VB[2] / 2, VB[1] + VB[3] / 2)
      .scale(k)
      .translate(-cx, -cy);
    svg.transition().duration(opts.duration || 900).call(zoom.transform, t);
  }

  function zoomToRegion(region) {
    const box = CONTINENTS[region].box;
    if (!box) { zoomToBounds(worldBounds, { pad: 1 }); return; }
    // Proiectăm conturul dreptunghiului lon/lat și luăm limitele.
    const xs = [];
    const ys = [];
    for (let i = 0; i <= 10; i++) {
      const lon = box[0][0] + (box[1][0] - box[0][0]) * i / 10;
      for (let j = 0; j <= 10; j++) {
        const lat = box[0][1] + (box[1][1] - box[0][1]) * j / 10;
        const p = projection([lon, lat]);
        xs.push(p[0]); ys.push(p[1]);
      }
    }
    zoomToBounds([[d3.min(xs), d3.min(ys)], [d3.max(xs), d3.max(ys)]], { pad: 1 });
  }

  function zoomToCountry(f, context) {
    const b = path.bounds(mainPart(f));
    // "context" > 1 lărgește fereastra ca să se vadă și vecinii.
    const minSize = context ? 140 : 40;
    const cx = (b[0][0] + b[1][0]) / 2;
    const cy = (b[0][1] + b[1][1]) / 2;
    const w = Math.max((b[1][0] - b[0][0]) * (context || 1), minSize);
    const h = Math.max((b[1][1] - b[0][1]) * (context || 1), minSize / 2);
    zoomToBounds([[cx - w / 2, cy - h / 2], [cx + w / 2, cy + h / 2]], { maxK: 12, pad: 0.7 });
  }

  function clearLabels() { labelLayer.selectAll('*').remove(); }

  function addCountryLabel(f, text, bad) {
    const xy = path.centroid(mainPart(f));
    const g = labelLayer.append('g').datum({ xy: xy }).attr('class', 'label');
    g.append('text').attr('class', 'country-name' + (bad ? ' bad' : '')).attr('dy', '0.35em').text(text);
    placeLabels();
    return g;
  }

  function addCapitalLabel(c) {
    if (!c.capital) return null;
    const xy = projection([c.lon, c.lat]);
    const g = labelLayer.append('g').datum({ xy: xy }).attr('class', 'label');
    g.append('circle').attr('class', 'capital-dot').attr('r', 7);
    g.append('text').attr('class', 'capital-name').attr('y', 26).text('🏰 ' + c.capital);
    placeLabels();
    return g;
  }

  function clearClasses() {
    countryPaths.classed('correct wrong target selected hint found', false);
  }

  // ---------------------------------------------------------------------------
  // Ecrane
  // ---------------------------------------------------------------------------
  function show(screen) {
    ['screen-home', 'screen-setup', 'screen-game'].forEach(function (id) {
      $(id).hidden = id !== screen;
    });
    $('end-overlay').hidden = true;
    if (screen === 'screen-game') updateViewBox();
    if (screen === 'screen-home') {
      $('total-stars').textContent = '⭐ ' + loadTotal() + ' estrelas ganhas';
    }
  }

  function goHome() {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    show('screen-home');
  }

  // Butoanele de mod de pe ecranul principal
  document.querySelectorAll('.mode-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      sfx.tap();
      state.mode = btn.dataset.mode;
      if (state.mode === 'explore') { startExplore(); return; }
      $('setup-title').textContent = state.mode === 'find'
        ? '🔍 Onde vamos procurar?'
        : '🏰 Capitais de onde?';
      show('screen-setup');
      speak('Escolhe onde queres jogar e a dificuldade.');
    });
  });

  // Regiunile
  const regionGrid = $('region-grid');
  Object.keys(CONTINENTS).forEach(function (key) {
    const r = CONTINENTS[key];
    const b = document.createElement('button');
    b.className = 'region-btn';
    b.dataset.region = key;
    b.innerHTML = '<span class="emoji">' + r.emoji + '</span>' + r.name;
    b.addEventListener('click', function () {
      sfx.tap();
      state.region = key;
      updateSetup();
      speak(r.en, false);
    });
    regionGrid.appendChild(b);
  });

  document.querySelectorAll('.level-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      sfx.tap();
      state.level = parseInt(b.dataset.level, 10);
      updateSetup();
      speak(['', 'Fácil', 'Médio', 'Difícil'][state.level], false);
    });
  });

  function updateSetup() {
    document.querySelectorAll('.region-btn').forEach(function (b) {
      b.classList.toggle('selected', b.dataset.region === state.region);
    });
    document.querySelectorAll('.level-btn').forEach(function (b) {
      b.classList.toggle('selected', parseInt(b.dataset.level, 10) === state.level);
    });
  }
  updateSetup();

  $('setup-back').addEventListener('click', goHome);
  $('play-btn').addEventListener('click', function () { sfx.tap(); startRound(); });
  $('home-btn').addEventListener('click', goHome);
  $('menu-btn').addEventListener('click', goHome);
  $('again-btn').addEventListener('click', function () {
    if (state.mode === 'explore') startExplore(); else startRound();
  });
  $('speak-btn').addEventListener('click', function () { if (lastSpoken) speak(lastSpoken); });
  $('sound-btn').addEventListener('click', function () {
    state.sound = !state.sound;
    $('sound-btn').textContent = state.sound ? '🔊' : '🔇';
    if (!state.sound && 'speechSynthesis' in window) speechSynthesis.cancel();
  });
  $('zoom-in').addEventListener('click', function () { svg.transition().duration(300).call(zoom.scaleBy, 1.6); });
  $('zoom-out').addEventListener('click', function () { svg.transition().duration(300).call(zoom.scaleBy, 1 / 1.6); });
  $('zoom-reset').addEventListener('click', function () { zoomToBounds(worldBounds, { pad: 1 }); });
  $('hint-btn').addEventListener('click', giveHint);
  $('next-btn').addEventListener('click', function () { sfx.tap(); state.idx++; nextQuestion(); });

  // ---------------------------------------------------------------------------
  // Runde
  // ---------------------------------------------------------------------------
  function buildPool() {
    const inRegion = COUNTRIES.filter(function (c) {
      return c.level > 0 && c.capital && featureById.has(c.id) &&
        (state.region === 'WORLD' || c.conts.indexOf(state.region) >= 0);
    });
    // Dacă sunt prea puține țări la nivelul ales, adăugăm și din nivelul următor.
    let lvl = state.level;
    let pool = inRegion.filter(function (c) { return c.level <= lvl; });
    while (pool.length < 6 && lvl < 3) {
      lvl++;
      pool = inRegion.filter(function (c) { return c.level <= lvl; });
    }
    return pool;
  }

  function startRound() {
    state.queue = shuffle(buildPool().slice()).slice(0, ROUND_SIZE);
    state.idx = 0;
    state.score = 0;
    state.results = [];
    clearClasses();
    clearLabels();
    show('screen-game');
    $('hint-btn').hidden = state.mode !== 'find';
    $('answers').hidden = state.mode !== 'capitals';
    zoomToRegion(state.region);
    updateScore();
    nextQuestion();
  }

  function updateScore() {
    $('score').textContent = '⭐ ' + state.score;
    const prog = $('progress');
    prog.innerHTML = '';
    if (state.mode === 'explore') return;
    state.queue.forEach(function (_, i) {
      const d = document.createElement('span');
      d.className = 'dot';
      if (state.results[i]) d.classList.add(state.results[i]);
      if (i === state.idx && !state.results[i]) d.classList.add('current');
      prog.appendChild(d);
    });
  }

  function setPrompt(small, big, extra) {
    $('prompt-small').textContent = small || '';
    $('prompt-big').textContent = big || '';
    $('prompt-extra').innerHTML = extra || '';
  }

  let toastTimer = null;
  function toast(text) {
    const t = $('toast');
    t.textContent = text;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2200);
  }

  function nextQuestion() {
    if (state.idx >= state.queue.length) { finishRound(); return; }
    const c = state.current = state.queue[state.idx];
    state.tries = 0;
    state.helped = false;
    state.answered = false;
    $('next-btn').hidden = true;
    $('toast').hidden = true;
    countryPaths.classed('correct wrong target selected hint', false);
    clearLabels();
    setFlag($('prompt-flag'), c);
    updateScore();

    if (state.mode === 'find') {
      setPrompt('Encontra no mapa:', c.name, '');
      speak('Encontra ' + c.withArt + '!');
      zoomToRegion(state.region);
    } else {
      const f = featureById.get(c.id);
      pathById.get(c.id).classed('target', true);
      zoomToCountry(f, 3);
      setPrompt('Este país é:', c.name, 'Qual é a <b>capital</b>?');
      const options = capitalOptions(c);
      renderAnswers(options);
      speak(c.name + '. Qual é a capital? ' + options.slice(0, -1).join(', ') + ' ou ' + options[options.length - 1] + '?');
    }
  }

  // ------------------------- Modul „Găsește țara” -----------------------------
  function onCountryClick(f) {
    const c = byId.get(f.id);
    if (state.mode === 'explore') { exploreCountry(f, c); return; }
    if (state.mode === 'find') { findClick(f, c); return; }
    if (state.mode === 'capitals' && c) { toast(c.name); }
  }

  function findClick(f, c) {
    if (state.answered || !state.current) return;
    const target = state.current;
    if (f.id === target.id) {
      state.answered = true;
      const star = state.tries < MAX_TRIES && !state.helped;
      if (star) state.score++;
      state.results[state.idx] = star ? 'star' : 'helped';
      countryPaths.classed('hint', false);
      pathById.get(f.id).classed('correct', true);
      clearLabels();
      addCountryLabel(f, target.name);
      addCapitalLabel(target);
      sfx.good();
      confetti(star ? 140 : 60);
      setPrompt(pick(PRAISE) + ' Encontraste!', target.name, 'A capital é <b>' + target.capital + '</b> 🏰');
      speak(pick(PRAISE) + ' Encontraste ' + target.withArt + '! A capital é ' + target.capital + '.');
      $('next-btn').hidden = false;
      updateScore();
      // Țara găsită rămâne colorată până la sfârșitul rundei.
      setTimeout(function () { pathById.get(f.id).classed('found', true); }, 50);
      return;
    }

    state.tries++;
    sfx.bad();
    const p = pathById.get(f.id);
    p.classed('wrong', true);
    setTimeout(function () { p.classed('wrong', false); }, 1200);
    if (c) {
      const lbl = addCountryLabel(f, c.name, true);
      setTimeout(function () { lbl.remove(); }, 1600);
    }
    if (state.tries >= MAX_TRIES) {
      giveHint();
    } else if (c) {
      speak('Isto é ' + c.withArt + '. Tenta outra vez!');
    } else {
      speak('Tenta outra vez!');
    }
  }

  function giveHint() {
    if (state.mode !== 'find' || !state.current || state.answered) return;
    state.helped = true;
    const f = featureById.get(state.current.id);
    pathById.get(state.current.id).classed('hint', true);
    zoomToCountry(f, 4);
    speak('Olha! O país que está a piscar é ' + state.current.withArt + '. Toca nele!');
    toast('💡 Toca no país que está a piscar!');
  }

  // ------------------------- Modul „Capitale” ---------------------------------
  function capitalOptions(c) {
    const others = COUNTRIES.filter(function (o) {
      return o.id !== c.id && o.capital && o.level > 0 && o.capital !== c.capital;
    });
    const near = others.filter(function (o) { return o.conts[0] === c.conts[0]; });
    const chosen = shuffle(near.slice()).slice(0, 2);
    while (chosen.length < 2) {
      const extra = pick(others);
      if (chosen.indexOf(extra) < 0) chosen.push(extra);
    }
    return shuffle([c.capital].concat(chosen.map(function (o) { return o.capital; })));
  }

  function renderAnswers(options) {
    const box = $('answers');
    box.innerHTML = '';
    options.forEach(function (opt) {
      const b = document.createElement('button');
      b.className = 'answer-btn';
      b.textContent = opt;
      b.addEventListener('click', function () { answerCapital(b, opt); });
      box.appendChild(b);
    });
  }

  function answerCapital(btn, opt) {
    if (state.answered || btn.disabled) return;
    const c = state.current;
    if (opt === c.capital) {
      state.answered = true;
      const star = state.tries === 0;
      if (star) state.score++;
      state.results[state.idx] = star ? 'star' : 'helped';
      btn.classList.add('right');
      document.querySelectorAll('.answer-btn').forEach(function (b) { b.disabled = true; });
      pathById.get(c.id).classed('target', false).classed('correct', true);
      addCapitalLabel(c);
      sfx.good();
      confetti(star ? 140 : 60);
      setPrompt(pick(PRAISE), c.name, 'A capital é <b>' + c.capital + '</b> 🏰');
      speak(pick(PRAISE) + ' ' + c.name + ': a capital é ' + c.capital + '.');
      $('next-btn').hidden = false;
      updateScore();
    } else {
      state.tries++;
      btn.classList.add('wrong');
      btn.disabled = true;
      sfx.bad();
      speak('Não é ' + opt + '. Tenta outra vez!');
    }
  }

  // ------------------------- Sfârșit de rundă ---------------------------------
  function finishRound() {
    const total = state.queue.length;
    const newTotal = loadTotal() + state.score;
    saveTotal(newTotal);
    const ratio = total ? state.score / total : 0;
    let title;
    let trophy;
    if (ratio >= 0.9) { title = 'Campeão do mundo, Vladimir!'; trophy = '🏆'; }
    else if (ratio >= 0.6) { title = 'Muito bem, Vladimir!'; trophy = '🥇'; }
    else if (ratio >= 0.3) { title = 'Boa, Vladimir!'; trophy = '🎖️'; }
    else { title = 'Bom começo, Vladimir!'; trophy = '🌱'; }
    $('end-trophy').textContent = trophy;
    $('end-title').textContent = title;
    $('end-text').textContent = 'Ganhaste ' + state.score + ' de ' + total + ' estrelas. No total tens ' + newTotal + ' ⭐';
    $('end-stars').textContent = '⭐'.repeat(state.score) + '☆'.repeat(total - state.score);
    $('end-overlay').hidden = false;
    sfx.win();
    confetti(250);
    speak(title + ' Ganhaste ' + state.score + (state.score === 1 ? ' estrela' : ' estrelas') + ' de ' + total + '!');
  }

  // ------------------------- Modul „Explorează” -------------------------------
  function startExplore() {
    state.mode = 'explore';
    state.current = null;
    clearClasses();
    clearLabels();
    show('screen-game');
    $('hint-btn').hidden = true;
    $('answers').hidden = true;
    $('next-btn').hidden = true;
    $('score').textContent = '🧭';
    $('progress').innerHTML = '';
    $('prompt-flag').textContent = '🗺️';
    setPrompt('Explora o mundo!', 'Toca num país', 'Eu digo-te o nome e a capital.');
    speak('Toca num país no mapa e eu digo-te o nome!');
    zoomToBounds(worldBounds, { pad: 1 });
  }

  function exploreCountry(f, c) {
    sfx.tap();
    countryPaths.classed('selected', false);
    pathById.get(f.id).classed('selected', true);
    clearLabels();
    if (!c) {
      const raw = f.properties && f.properties.name ? f.properties.name : '?';
      const name = OTHER_NAMES[raw] || raw;
      $('prompt-flag').textContent = '🗺️';
      setPrompt('Este território é:', name, '');
      addCountryLabel(f, name);
      speak(name);
      return;
    }
    setFlag($('prompt-flag'), c);
    addCountryLabel(f, c.name);
    const contName = CONTINENTS[c.conts[0]].name;
    if (c.capital) {
      addCapitalLabel(c);
      setPrompt(contName, c.name, 'Capital: <b>' + c.capital + '</b> 🏰');
      speak(c.name + '. A capital é ' + c.capital + '.');
    } else {
      setPrompt(contName, c.name, '');
      speak(c.name);
    }
  }

  // Start
  show('screen-home');
})();
