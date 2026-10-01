/* Vladimir & Leo World Explorers — zbori cu avionul prin orașele Europei. */
(function () {
  'use strict';

  const $ = function (id) { return document.getElementById(id); };
  const CITIES = window.VLE_CITIES;
  const byId = {};
  CITIES.forEach(function (c) { byId[c.id] = c; });
  const START = 'funchal';
  const STORE_KEY = 'vle-state';

  // ---------------------------------------------------------------------------
  // Utilitare
  // ---------------------------------------------------------------------------
  function km(a, b) {
    const R = 6371, rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
    return Math.round(2 * R * Math.asin(Math.sqrt(h)));
  }
  function flightTime(d) {
    const mins = Math.round((d / 800 * 60 + 30) / 5) * 5;
    const h = Math.floor(mins / 60), m = mins % 60;
    if (!h) return m + ' minutes';
    return h + (h === 1 ? ' hour' : ' hours') + (m ? ' ' + m + ' minutes' : '');
  }
  function fmt(n) { return n.toLocaleString('en-GB'); }
  function norm(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function plainCountry(c) { return c.country.replace(/\s*\(.*\)/, ''); }
  function flagEmoji(iso) {
    return String.fromCodePoint.apply(null, iso.toUpperCase().split('').map(function (ch) { return 0x1f1e6 + ch.charCodeAt(0) - 65; }));
  }
  function setFlag(el, iso) {
    el.textContent = '';
    const img = new Image();
    img.alt = '';
    img.src = 'https://flagcdn.com/w80/' + iso.toLowerCase() + '.png';
    img.onerror = function () { el.textContent = flagEmoji(iso); };
    el.appendChild(img);
  }

  // ---------------------------------------------------------------------------
  // Starea (se păstrează în browser)
  // ---------------------------------------------------------------------------
  function freshState() { return { current: START, visited: [START], km: 0, flights: 0, badges: [] }; }
  let state = freshState();
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (saved && byId[saved.current]) state = Object.assign(freshState(), saved);
  } catch (e) { /* fără stocare */ }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* fără stocare */ } }
  const ui = { selected: null, hover: null, sort: 'near', query: '', flying: false };

  // ---------------------------------------------------------------------------
  // Voce (engleză, voce de femeie dacă există) și sunete
  // ---------------------------------------------------------------------------
  const FEMALE = /female|woman|libby|sonia|maisie|hazel|susan|zira|jenny|aria|ava|emma|michelle|natasha|clara|samantha|karen|moira|tessa|serena|kate|fiona|victoria|allison|martha|catherine|joanna|salli|kimberly|kendra|amy|olivia/i;
  const MALE = /\bmale|guy|ryan|thomas|daniel|george|alex|fred|arthur|oliver|david|mark|james|william|christopher|eric|roger|brian|matthew|joey|justin/i;
  let voice = null, voiceFemale = false;
  function pickVoice() {
    if (!('speechSynthesis' in window)) return;
    const en = speechSynthesis.getVoices().filter(function (v) { return /^en(-|_|$)/i.test(v.lang); });
    function prefer(list) {
      return list.find(function (v) { return /en[-_]GB/i.test(v.lang); }) ||
        list.find(function (v) { return /en[-_]US/i.test(v.lang); }) || list[0] || null;
    }
    voice = prefer(en.filter(function (v) { return FEMALE.test(v.name) && !/\bmale\b/i.test(v.name); }));
    voiceFemale = !!voice;
    if (!voice) voice = prefer(en.filter(function (v) { return !MALE.test(v.name); })) || prefer(en);
  }
  if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  let soundOn = true;
  function speak(text) {
    if (!soundOn || !('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = voice ? voice.lang : 'en-GB';
    if (voice) u.voice = voice;
    u.rate = 0.92;
    u.pitch = voiceFemale ? 1.05 : 1.3;
    speechSynthesis.speak(u);
  }
  let audio = null;
  function initAudio() {
    if (audio) { if (audio.state === 'suspended') audio.resume(); return; }
    try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audio = null; }
  }
  function tone(freq, start, dur, type, vol) {
    if (!soundOn || !audio) return;
    const t0 = audio.currentTime + start;
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.15, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(audio.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  const sfx = {
    chime: function () { tone(659, 0, 0.5, 'sine', 0.18); tone(523, 0.35, 0.7, 'sine', 0.18); },
    land: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, i * 0.1, 0.3, 'triangle', 0.18); }); },
    stamp: function () { tone(120, 0, 0.12, 'square', 0.12); tone(90, 0.03, 0.15, 'sine', 0.2); },
    tap: function () { tone(700, 0, 0.06, 'sine', 0.08); }
  };

  // ---------------------------------------------------------------------------
  // Harta
  // ---------------------------------------------------------------------------
  const svg = d3.select('#map');
  const wrap = $('map-wrap');
  const topo = window.VLE_WORLD;
  const countries = topojson.feature(topo, topo.objects.countries).features.filter(function (f) { return f.id !== '010'; });
  const EUROPE = { type: 'MultiPoint', coordinates: [[-27, 28], [-27, 66], [-20, 66.5], [42, 71], [42, 34], [34, 34], [-17, 28]] };
  const projection = d3.geoAzimuthalEqualArea().rotate([-8, -52]);
  const path = d3.geoPath(projection);
  const zoomLayer = svg.append('g');
  const countryLayer = zoomLayer.append('g');
  const grat = zoomLayer.append('path').attr('class', 'graticule');
  const route = zoomLayer.append('path').attr('class', 'route');
  const cityLayer = svg.append('g');
  const plane = svg.append('g').attr('class', 'plane').style('display', 'none');
  plane.append('path').attr('d', 'M18 0 L4 -3 L-2 -14 L-6 -14 L-3 -3 L-11 -2 L-14 -7 L-17 -7 L-15 0 L-17 7 L-14 7 L-11 2 L-3 3 L-6 14 L-2 14 L4 3 Z');
  let W = 0, H = 0;
  let transform = d3.zoomIdentity;
  let routeCoords = null, routeT = 0;

  const PALETTE = ['#f7e8c4', '#e5f0d0', '#fadcd0', '#e1e7f8', '#f3e1f0', '#dcf1e9', '#fbeccf', '#e9e3f5'];
  function fillFor(f) { const n = parseInt(f.id, 10) || 7; return PALETTE[(n * 7) % PALETTE.length]; }

  function layoutMap() {
    const r = wrap.getBoundingClientRect();
    W = Math.max(200, r.width); H = Math.max(160, r.height);
    svg.attr('viewBox', '0 0 ' + W + ' ' + H);
    projection.fitExtent([[16, 16], [W - 16, H - 16]], EUROPE);
    countryLayer.selectAll('path').data(countries).join('path').attr('class', 'country').attr('d', path).attr('fill', fillFor);
    grat.attr('d', path(d3.geoGraticule10()));
    CITIES.forEach(function (c) { c.xy = projection([c.lon, c.lat]); });
    drawRoute();
    placeCities();
  }

  const zoom = d3.zoom().scaleExtent([1, 14]).clickDistance(8)
    .on('zoom', function (e) {
      transform = e.transform;
      zoomLayer.attr('transform', transform);
      placeCities();
      placePlane();
    });
  svg.call(zoom).on('dblclick.zoom', null);

  const cityG = cityLayer.selectAll('g.city').data(CITIES, function (d) { return d.id; }).join(function (enter) {
    const g = enter.append('g').attr('class', function (d) { return 'city' + (d.c ? ' capital' : ''); });
    g.append('circle').attr('class', 'hit').attr('r', 14).attr('fill', 'transparent');
    g.append('circle').attr('class', 'ring').attr('r', 12);
    g.append('path').attr('class', 'dot');
    g.append('text').attr('dy', -11).attr('text-anchor', 'middle');
    return g;
  });
  cityG.select('path.dot').attr('d', function (d) { return d.c ? d3.symbol(d3.symbolStar, 150)() : d3.symbol(d3.symbolCircle, 70)(); });
  cityG.select('text').text(function (d) { return d.name; });
  // Atingerea alege orașul cel mai apropiat de deget. Țările foarte mici (lipite de alte orașe,
  // ca Vaticanul de Roma) au o mică penalizare, ca orașul mare să fie ales primul.
  const TINY = { vatican: 7, sanmarino: 5, monaco: 5, vaduz: 4 };
  function cityAt(e) {
    const pt = d3.pointer(e, svg.node());
    let best = null, bestScore = 1e9;
    CITIES.forEach(function (c) {
      const p = transform.apply(c.xy);
      const d = Math.hypot(p[0] - pt[0], p[1] - pt[1]);
      if (d > 20) return;
      const score = d + (TINY[c.id] || 0) * Math.max(0, 3 - transform.k);
      if (score < bestScore) { bestScore = score; best = c; }
    });
    return best;
  }
  svg.on('click', function (e) {
    const d = cityAt(e);
    if (!d || ui.flying || d.id === state.current) return;
    sfx.tap();
    if (ui.selected === d.id) flyTo(d.id); else selectCity(d.id, true);
  });
  svg.on('dblclick', function (e) { const d = cityAt(e); if (d && !ui.flying && d.id !== state.current) flyTo(d.id); });
  svg.on('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;
    const d = cityAt(e);
    if ((d && d.id) === ui.hover) { if (d) showTip(d); return; }
    setHover(d ? d.id : null, true);
    if (d) showTip(d); else $('tooltip').hidden = true;
    svg.style('cursor', d ? 'pointer' : null);
  });
  svg.on('pointerleave', function () { setHover(null, true); $('tooltip').hidden = true; });

  function labelVisible(d) {
    const k = transform.k;
    return d.id === state.current || d.id === ui.selected || d.id === ui.hover || k >= 2.6 || (d.c && k >= 1.6) ||
      ['london', 'paris', 'madrid', 'rome', 'berlin', 'lisbon', 'funchal', 'moscow', 'athens', 'reykjavik', 'stockholm', 'istanbul', 'bucharest', 'warsaw', 'kyiv', 'helsinki', 'oslo', 'dublin'].indexOf(d.id) >= 0;
  }
  function placeCities() {
    const k = transform.k;
    const fs = Math.min(17, 12 + k * 0.8);
    cityG
      .attr('transform', function (d) { const p = transform.apply(d.xy); return 'translate(' + p[0] + ',' + p[1] + ')'; })
      .classed('current', function (d) { return d.id === state.current; })
      .classed('visited', function (d) { return state.visited.indexOf(d.id) >= 0; })
      .classed('selected', function (d) { return d.id === ui.selected; })
      .style('font-size', fs + 'px');
    // Pe ecran mic și la zoom mic, steluțele sunt mai mici ca să nu se suprapună.
    const ds = Math.min(1, (W < 600 ? 0.42 : 0.6) + 0.18 * k);
    cityG.select('path.dot').attr('transform', 'scale(' + ds.toFixed(2) + ')');
    cityG.select('text').style('display', function (d) { return labelVisible(d) ? null : 'none'; })
      .style('font-size', function (d) { return (d.id === state.current || d.id === ui.selected ? fs + 2 : fs) + 'px'; });
    // Orașul curent, cel ales și cel de sub cursor stau deasupra celorlalte.
    cityG.filter(function (d) { return d.id === state.current || d.id === ui.selected || d.id === ui.hover; }).raise();
  }
  function showTip(d) {
    const t = $('tooltip');
    if (d.id === state.current) {
      t.innerHTML = '<b>' + d.name + '</b><br><small>You are here!</small>';
    } else {
      t.innerHTML = '<b>' + d.name + '</b> · ' + plainCountry(d) + '<br><small>' + fmt(km(byId[state.current], d)) + ' km · ' +
        (ui.selected === d.id ? 'tap again to fly ✈️' : 'tap to choose') + '</small>';
    }
    const p = transform.apply(d.xy);
    t.style.left = p[0] + 'px';
    t.style.top = p[1] + 'px';
    t.hidden = false;
  }

  function zoomToCities(list, duration) {
    const xs = list.map(function (c) { return c.xy[0]; }), ys = list.map(function (c) { return c.xy[1]; });
    const x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    const y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    const dx = Math.max(x1 - x0, 60), dy = Math.max(y1 - y0, 60);
    const k = Math.max(1, Math.min(6, 0.7 * Math.min(W / dx, H / dy)));
    const t = d3.zoomIdentity.translate(W / 2, H / 2).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    svg.transition().duration(duration || 700).call(zoom.transform, t);
  }
  function zoomHome() { svg.transition().duration(700).call(zoom.transform, d3.zoomIdentity); }

  function drawRoute() {
    if (!routeCoords) { route.attr('d', null); return; }
    const n = Math.max(2, Math.ceil(routeCoords.length * routeT));
    route.attr('d', path({ type: 'LineString', coordinates: routeCoords.slice(0, n) }));
  }
  let planeGeo = null, planeAngle = 0;
  function placePlane() {
    if (!planeGeo) { plane.style('display', 'none'); return; }
    const p = transform.apply(projection(planeGeo));
    plane.style('display', null).attr('transform', 'translate(' + p[0] + ',' + p[1] + ') rotate(' + planeAngle + ') scale(1.4)');
  }

  // ---------------------------------------------------------------------------
  // Lista de destinații și căutarea
  // ---------------------------------------------------------------------------
  function filteredCities() {
    const here = byId[state.current];
    const q = norm(ui.query.trim());
    let list = CITIES.filter(function (c) { return c.id !== state.current; });
    if (q) list = list.filter(function (c) { return norm(c.name).indexOf(q) >= 0 || norm(c.country).indexOf(q) >= 0; });
    if (ui.sort === 'capitals') list = list.filter(function (c) { return c.c; });
    if (ui.sort === 'new') list = list.filter(function (c) { return state.visited.indexOf(c.id) < 0; });
    if (ui.sort === 'az') list.sort(function (a, b) { return a.name.localeCompare(b.name); });
    else list.sort(function (a, b) { return km(here, a) - km(here, b); });
    // Orașele care încep cu literele scrise vin primele.
    if (q) list.sort(function (a, b) { return (norm(a.name).indexOf(q) === 0 ? 0 : 1) - (norm(b.name).indexOf(q) === 0 ? 0 : 1); });
    return list;
  }

  function renderList() {
    const here = byId[state.current];
    const ul = $('list');
    const list = filteredCities();
    ul.innerHTML = '';
    if (!list.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'No city found. Try other letters!';
      ul.appendChild(li);
      return;
    }
    list.forEach(function (c) {
      const li = document.createElement('li');
      li.className = 'row' + (c.id === ui.selected ? ' selected' : '');
      li.dataset.id = c.id;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', c.id === ui.selected ? 'true' : 'false');
      const d = km(here, c);
      const flag = document.createElement('span');
      flag.className = 'row-flag';
      setFlag(flag, c.iso);
      const mid = document.createElement('div');
      mid.innerHTML = '<div class="row-name">' + c.name + (c.c ? ' <span class="star" title="Capital">★</span>' : '') +
        (state.visited.indexOf(c.id) >= 0 ? ' <span class="seen">✓ visited</span>' : '') + '</div>' +
        '<div class="row-sub">' + c.country + '</div>';
      const right = document.createElement('div');
      right.className = 'row-km';
      right.textContent = fmt(d) + ' km';
      li.appendChild(flag); li.appendChild(mid); li.appendChild(right);
      if (c.id === ui.selected) {
        const b = document.createElement('button');
        b.className = 'btn primary';
        b.textContent = 'Fly to ' + c.name + ' ✈️  (' + flightTime(d) + ')';
        b.addEventListener('click', function (e) { e.stopPropagation(); flyTo(c.id); });
        li.appendChild(b);
      }
      li.addEventListener('click', function () { if (!ui.flying) { sfx.tap(); selectCity(c.id, false, true); } });
      li.addEventListener('mouseenter', function () { setHover(c.id, false); });
      li.addEventListener('mouseleave', function () { setHover(null, false); });
      ul.appendChild(li);
    });
  }

  function setHover(id, fromMap) {
    ui.hover = id;
    placeCities();
    if (fromMap) {
      document.querySelectorAll('.row').forEach(function (r) { r.classList.toggle('hover', r.dataset.id === id); });
    }
  }

  function selectCity(id, fromMap, keepList) {
    ui.selected = id;
    const c = byId[id];
    renderList();
    placeCities();
    const d = km(byId[state.current], c);
    $('map-fly').textContent = 'Fly to ' + c.name + ' ✈️';
    $('map-fly').hidden = false;
    const row = document.querySelector('.row[data-id="' + id + '"]');
    if (row && fromMap) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    if (!keepList && fromMap) { /* nimic */ }
    // Dacă orașul nu se vede pe hartă, mutăm harta ca să se vadă și el.
    const p = transform.apply(c.xy);
    if (p[0] < 30 || p[0] > W - 30 || p[1] < 30 || p[1] > H - 30) zoomToCities([byId[state.current], c], 600);
    speak(c.name + ', ' + plainCountry(c) + '. ' + fmt(d) + ' kilometers. Press the red button to fly!');
  }

  $('search').addEventListener('input', function (e) {
    ui.query = e.target.value;
    renderList();
  });
  $('search').addEventListener('keydown', function (e) {
    const list = filteredCities();
    if (!list.length) return;
    let i = list.findIndex(function (c) { return c.id === ui.selected; });
    if (e.key === 'ArrowDown') { e.preventDefault(); i = Math.min(list.length - 1, i + 1); selectCity(list[i].id, true); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); i = Math.max(0, i - 1); selectCity(list[i].id, true); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (i >= 0) flyTo(list[i].id); else selectCity(list[0].id, true);
    }
  });
  document.querySelectorAll('.filter').forEach(function (b) {
    b.addEventListener('click', function () {
      ui.sort = b.dataset.sort;
      document.querySelectorAll('.filter').forEach(function (x) { x.classList.toggle('on', x === b); });
      renderList();
    });
  });
  $('map-fly').addEventListener('click', function () { if (ui.selected) flyTo(ui.selected); });
  $('zoom-in').addEventListener('click', function () { svg.transition().duration(300).call(zoom.scaleBy, 1.6); });
  $('zoom-out').addEventListener('click', function () { svg.transition().duration(300).call(zoom.scaleBy, 1 / 1.6); });
  $('zoom-home').addEventListener('click', zoomHome);

  // ---------------------------------------------------------------------------
  // Zborul
  // ---------------------------------------------------------------------------
  function flyTo(id) {
    if (ui.flying || id === state.current) return;
    initAudio();
    const from = byId[state.current], to = byId[id];
    const dist = km(from, to);
    ui.flying = true;
    ui.selected = null;
    $('map-fly').hidden = true;
    $('tooltip').hidden = true;
    $('choose').hidden = true;
    $('boarding').hidden = false;
    $('b-from').textContent = from.name;
    $('b-to').textContent = to.name;
    $('b-info').textContent = fmt(dist) + ' km · about ' + flightTime(dist);
    $('b-progress').style.width = '0%';
    placeCities();
    sfx.chime();
    speak('Fasten your seatbelts, Vladimir and Leo! We are flying from ' + from.name + ' to ' + to.name + '. That is ' + fmt(dist) + ' kilometers, about ' + flightTime(dist) + '.');

    const interp = d3.geoInterpolate([from.lon, from.lat], [to.lon, to.lat]);
    routeCoords = d3.range(0, 1.0001, 1 / 90).map(interp);
    routeT = 0;
    drawRoute();
    zoomToCities([from, to], 700);
    const duration = Math.min(6500, 2600 + dist * 1.1);
    setTimeout(function () {
      const timer = d3.timer(function (elapsed) {
        const raw = Math.min(1, elapsed / duration);
        const t = d3.easeSinInOut(raw);
        routeT = t;
        planeGeo = interp(t);
        const a = projection(interp(Math.max(0, t - 0.01))), b = projection(interp(Math.min(1, t + 0.01)));
        planeAngle = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
        drawRoute();
        placePlane();
        $('b-progress').style.width = (raw * 100).toFixed(1) + '%';
        $('b-info').textContent = raw < 1 ? fmt(Math.round(dist * (1 - t))) + ' km to go…' : 'Landing!';
        if (raw >= 1) { timer.stop(); land(to, dist); }
      });
    }, 750);
  }

  function land(city, dist) {
    ui.flying = false;
    planeGeo = null;
    placePlane();
    routeCoords = null;
    drawRoute();
    const first = state.visited.indexOf(city.id) < 0;
    state.current = city.id;
    state.km += dist;
    state.flights++;
    if (first) state.visited.push(city.id);
    const newBadges = checkBadges();
    save();
    $('boarding').hidden = true;
    $('choose').hidden = false;
    ui.query = '';
    $('search').value = '';
    updateHere();
    renderList();
    placeCities();
    // Arătăm orașul nou împreună cu vecinii lui cei mai apropiați.
    const near = CITIES.filter(function (c) { return c.id !== city.id; })
      .sort(function (a, b) { return km(city, a) - km(city, b); }).slice(0, 6);
    zoomToCities([city].concat(near), 900);
    sfx.land();
    setTimeout(sfx.stamp, 450);
    confetti(first ? 120 : 50);
    showCity(city, true, newBadges);
  }

  // ---------------------------------------------------------------------------
  // Cardul orașului
  // ---------------------------------------------------------------------------
  function showCity(c, arriving, newBadges) {
    $('c-emoji').textContent = c.emoji;
    $('c-eyebrow').textContent = arriving ? 'Vladimir & Leo landed in' : 'You are in';
    $('c-title').textContent = c.name;
    setFlag($('c-flag'), c.iso);
    $('c-country').textContent = c.country;
    $('c-capital').hidden = !c.c;
    $('c-airport').hidden = !c.airport;
    $('c-airport').textContent = c.airport ? '🛬 ' + c.airport : '';
    $('c-hello').innerHTML = 'Say hello in ' + c.hello[0] + ': <b>' + c.hello[1] + '</b>';
    const ul = $('c-facts');
    ul.innerHTML = '';
    c.facts.forEach(function (f) { const li = document.createElement('li'); li.textContent = f; ul.appendChild(li); });
    $('c-food').textContent = '😋 Yummy food to try: ' + c.food;
    $('stamp').innerHTML = c.emoji + '<br>' + c.name.toUpperCase().slice(0, 14) + '<br>' + new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    $('stamp').style.animation = 'none';
    void $('stamp').offsetWidth;
    $('stamp').style.animation = '';
    const badgeText = (newBadges || []).map(function (b) { return BADGES.find(function (x) { return x.id === b; }); });
    let extra = $('c-badges');
    if (!extra) { extra = document.createElement('p'); extra.id = 'c-badges'; extra.className = 'airport-note'; $('c-food').after(extra); }
    extra.hidden = !badgeText.length;
    extra.textContent = badgeText.map(function (b) { return '🏅 New badge: ' + b.name + '!'; }).join(' ');
    $('city-card').hidden = false;
    $('next-btn').focus({ preventScroll: true });

    const intro = arriving ? 'Welcome to ' + c.name + '! ' : '';
    const what = c.c ? c.name + ' is the capital of ' + plainCountry(c) + '. ' : c.name + ' is a city in ' + plainCountry(c) + '. ';
    const say = intro + what + (c.airport ? c.airport + ' ' : '') +
      'In ' + c.hello[0] + ', people say hello like this: ' + c.hello[1] + ' ' + c.facts.join(' ') +
      ' Yummy food to try: ' + c.food + '.' +
      badgeText.map(function (b) { return ' You got a new badge: ' + b.name + '!'; }).join('');
    speak(say);
  }
  $('next-btn').addEventListener('click', function () {
    $('city-card').hidden = true;
    speak('Where do you want to fly next? Choose a city from the list, type its name, or tap it on the map.');
    if (window.matchMedia('(min-width: 821px)').matches) $('search').focus();
  });
  $('card-passport').addEventListener('click', function () { $('city-card').hidden = true; openPassport(); });
  $('info-btn').addEventListener('click', function () { showCity(byId[state.current], false, []); });

  function updateHere() {
    const c = byId[state.current];
    setFlag($('here-flag'), c.iso);
    $('here-name').textContent = c.name;
    $('here-country').textContent = c.country;
    $('chip-cities').textContent = '🏙️ ' + state.visited.length;
    $('chip-km').textContent = '✈️ ' + fmt(state.km) + ' km';
  }

  // ---------------------------------------------------------------------------
  // Pașaportul și insignele
  // ---------------------------------------------------------------------------
  function visitedCount(ids) { return ids.filter(function (id) { return state.visited.indexOf(id) >= 0; }).length; }
  const BADGES = [
    { id: 'first', icon: '🛫', name: 'First flight', desc: 'Fly to your first city', ok: function () { return state.flights >= 1; } },
    { id: 'five', icon: '🖐️', name: '5 cities', desc: 'Visit 5 cities', ok: function () { return state.visited.length >= 5; } },
    { id: 'ten', icon: '🔟', name: '10 cities', desc: 'Visit 10 cities', ok: function () { return state.visited.length >= 10; } },
    { id: 'capitals', icon: '⭐', name: 'Capital collector', desc: 'Visit 10 capital cities', ok: function () { return state.visited.filter(function (id) { return byId[id].c; }).length >= 10; } },
    { id: 'islands', icon: '🏝️', name: 'Island hopper', desc: 'Visit 4 island cities', ok: function () { return visitedCount(['funchal', 'pontadelgada', 'laspalmas', 'valletta', 'nicosia', 'reykjavik']) >= 4; } },
    { id: 'tiny', icon: '🐜', name: 'Tiny countries', desc: 'Visit 3 of the smallest countries', ok: function () { return visitedCount(['vatican', 'monaco', 'sanmarino', 'vaduz', 'andorra', 'luxembourg', 'valletta']) >= 3; } },
    { id: 'romania', icon: '🌹', name: 'Romania tour', desc: 'Visit Bucharest, Timișoara and Cluj-Napoca', ok: function () { return visitedCount(['bucharest', 'timisoara', 'cluj']) === 3; } },
    { id: 'north', icon: '🌌', name: 'Far north', desc: 'Visit Reykjavík, the most northern capital', ok: function () { return state.visited.indexOf('reykjavik') >= 0; } },
    { id: 'italy', icon: '🍕', name: 'Ciao Italia', desc: 'Visit 4 cities in Italy', ok: function () { return visitedCount(['rome', 'milan', 'venice', 'florence', 'naples']) >= 4; } },
    { id: 'twentyfive', icon: '🏅', name: 'Super explorer', desc: 'Visit 25 cities', ok: function () { return state.visited.length >= 25; } },
    { id: 'all', icon: '🌍', name: 'Europe expert', desc: 'Visit every city in the game', ok: function () { return state.visited.length >= CITIES.length; } }
  ];
  function checkBadges() {
    const fresh = [];
    BADGES.forEach(function (b) {
      if (state.badges.indexOf(b.id) < 0 && b.ok()) { state.badges.push(b.id); fresh.push(b.id); }
    });
    return fresh;
  }
  function openPassport() {
    const countriesSeen = new Set(state.visited.map(function (id) { return byId[id].iso; })).size;
    $('p-stats').innerHTML =
      '<div class="stat"><b>' + state.visited.length + '</b><span>cities</span></div>' +
      '<div class="stat"><b>' + countriesSeen + '</b><span>countries</span></div>' +
      '<div class="stat"><b>' + fmt(state.km) + '</b><span>km flown</span></div>';
    $('p-badges').innerHTML = BADGES.map(function (b) {
      const got = state.badges.indexOf(b.id) >= 0;
      return '<div class="badge' + (got ? ' got' : '') + '"><span class="b-icon">' + b.icon + '</span><b>' + b.name + '</b>' + b.desc + '</div>';
    }).join('');
    const colors = ['#e63946', '#1d3557', '#2a9d8f', '#8a5cd6', '#d47a00'];
    $('p-stamps').innerHTML = state.visited.map(function (id, i) {
      const c = byId[id];
      return '<div class="pstamp" style="--c:' + colors[i % colors.length] + ';transform:rotate(' + ((i * 37) % 21 - 10) + 'deg)"><div><span>' + c.emoji + '</span>' + c.name + '</div></div>';
    }).join('');
    $('passport').hidden = false;
    speak('Your passport has ' + state.visited.length + (state.visited.length === 1 ? ' stamp' : ' stamps') + ' and ' + state.badges.length + (state.badges.length === 1 ? ' badge.' : ' badges.'));
  }
  $('passport-btn').addEventListener('click', openPassport);
  $('passport-close').addEventListener('click', function () { $('passport').hidden = true; });
  ['passport', 'city-card'].forEach(function (id) {
    $(id).addEventListener('click', function (e) { if (e.target === $(id)) $(id).hidden = true; });
  });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { $('passport').hidden = true; $('city-card').hidden = true; }
  });
  $('sound-btn').addEventListener('click', function () {
    soundOn = !soundOn;
    $('sound-btn').textContent = soundOn ? '🔊' : '🔇';
    if (!soundOn && 'speechSynthesis' in window) speechSynthesis.cancel();
  });

  // ---------------------------------------------------------------------------
  // Confetti
  // ---------------------------------------------------------------------------
  const cv = $('confetti'), cctx = cv.getContext('2d');
  let pieces = [], running = false;
  function confetti(n) {
    const dpr = window.devicePixelRatio || 1;
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const colors = ['#e63946', '#1d3557', '#ffd166', '#2a9d8f', '#a7d8f0', '#f4a261'];
    for (let i = 0; i < n; i++) {
      pieces.push({ x: innerWidth / 2 + (Math.random() - 0.5) * innerWidth * 0.4, y: innerHeight * 0.3, vx: (Math.random() - 0.5) * 13, vy: -Math.random() * 13 - 4, r: Math.random() * 6 + 4, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: colors[i % colors.length], life: 0 });
    }
    if (!running) { running = true; requestAnimationFrame(step); }
  }
  function step() {
    cctx.clearRect(0, 0, innerWidth, innerHeight);
    pieces = pieces.filter(function (p) { return p.y < innerHeight + 20 && p.life < 240; });
    pieces.forEach(function (p) {
      p.vy += 0.33; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life++;
      cctx.save(); cctx.translate(p.x, p.y); cctx.rotate(p.rot); cctx.fillStyle = p.c; cctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6); cctx.restore();
    });
    if (pieces.length) requestAnimationFrame(step); else { running = false; cctx.clearRect(0, 0, innerWidth, innerHeight); }
  }

  // ---------------------------------------------------------------------------
  // Pornirea
  // ---------------------------------------------------------------------------
  function begin() {
    initAudio();
    $('start').hidden = true;
    const c = byId[state.current];
    const near = CITIES.filter(function (x) { return x.id !== c.id; })
      .sort(function (a, b) { return km(c, a) - km(c, b); }).slice(0, 6);
    zoomToCities([c].concat(near), 900);
    if (state.current === START && state.flights === 0) {
      speak('Hello Vladimir and Leo! We are at Madeira Airport, on a beautiful island in the Atlantic Ocean. Where do you want to fly? Choose a city from the list, type its name, or tap it on the map.');
    } else {
      speak('Welcome back, explorers! You are in ' + c.name + '. Where do you want to fly next?');
    }
  }
  $('start-btn').addEventListener('click', begin);
  $('new-btn').addEventListener('click', function () {
    state = freshState();
    save();
    ui.selected = null;
    updateHere(); renderList(); placeCities(); zoomHome();
    begin();
  });
  if (state.flights > 0) {
    $('start-btn').textContent = 'Continue from ' + byId[state.current].name + ' ✈️';
    $('new-btn').hidden = false;
  }

  window.addEventListener('resize', function () { layoutMap(); });
  layoutMap();
  updateHere();
  renderList();

  // Pentru teste automate
  window.__vle = { state: function () { return state; }, flyTo: flyTo, selectCity: selectCity, ui: ui };
})();
