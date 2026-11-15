// DONT WALK: the game hidden under New York in the bio. An avenue in Manhattan, some year between 1997 and 2002. The light
// says DONT WALK and never changes, the traffic comes from the right, and the other side of the street is where everything is:
// coffee, a slice, the subway, a pay phone, the papers. Played like the road half of Frogger, drawn the way an early-80s
// console would have drawn New York: 176 pixels wide, hard edges. The colours are the site's own, ink on paper, and one more:
// the yellow of the cabs, which the light and the last seconds of the clock borrow. Nothing is loaded, nothing is recorded.
(() => {
  const cv = document.getElementById('walk');
  if (!cv) return;
  let g = cv.getContext('2d');
  const W = 176, H = 170, CELL = 16, COLS = 11, LANES = 6;
  const TOP = 14, STORES = 30, ROAD = TOP + STORES, WALK = ROAD + LANES * CELL, BAR = WALK + 18;   // HUD, shop fronts, the avenue, the near sidewalk, the status line
  const PAL = { b: '#12265f', a: '#1f3f97', w: '#f6f8f5', g: '#a7b4d6', y: '#f5c518', k: '#7385b8', s: '#e6e8e5', d: '#c5cbd8' };   // deep ink, ink, paper white, pale ink, cab yellow, mid ink, sidewalk, asphalt
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rnd = n => Math.random() * n, pick = a => a[Math.floor(rnd(a.length))], clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const YEARS = [1997, 1998, 1999, 2000, 2001, 2002];
  const GOALS = [0, 2, 4, 6, 8];                    // the columns with a door on the far side; the corner on the right belongs to the light

  // ---- pixel art. Vehicles are built from boxes, all facing left, because the avenue is one-way
  const grid = (w, h) => [...Array(h)].map(() => Array(w).fill('.'));
  const R = (m, x, y, w, h, c) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (m[j] && i >= 0 && i < m[j].length) m[j][i] = c; };
  const car = (len, body, extra) => {               // a sedan of the nineties: long hood, long trunk, square cabin
    const m = grid(len, 10), c0 = Math.round(len * .27), c1 = len - Math.round(len * .25);
    R(m, c0, 1, c1 - c0, 1, 'b'); R(m, c0 - 1, 2, c1 - c0 + 2, 2, 'g');
    for (const x of [c0 - 1, c0 + Math.round((c1 - c0) * .36), c1 - Math.round((c1 - c0) * .28), c1]) R(m, x, 2, 1, 2, 'b');
    R(m, 1, 4, len - 2, 1, body); R(m, 0, 5, len, 3, body); R(m, 2, 8, len - 4, 1, body);
    m[6][0] = 'w'; m[6][len - 1] = 'b';
    R(m, 3, 8, 4, 2, 'b'); R(m, len - 7, 8, 4, 2, 'b'); m[8][4] = m[8][5] = m[8][len - 6] = m[8][len - 5] = 'k';
    if (extra) extra(m, len);
    return m.map(r => r.join(''));
  };
  const ART = {
    cab: car(26, 'y', (m, l) => { R(m, 11, 0, 5, 1, 'w'); for (let x = 3; x < l - 3; x++) m[6][x] = x % 2 ? 'b' : 'y'; }),                       // roof light and the checker stripe
    cop: car(26, 'w', (m, l) => { m[0][10] = m[0][11] = 'b'; m[0][12] = 'w'; m[0][13] = m[0][14] = 'a'; R(m, 1, 6, l - 2, 1, 'a'); R(m, 0, 8, 2, 1, 'k'); R(m, l - 2, 8, 2, 1, 'k'); }),           // white with blue stripes, as the NYPD had just repainted them
    sedan: car(24, 'a'), wagon: car(24, 'k'),
    limo: car(44, 'b', (m, l) => { R(m, 1, 4, l - 2, 1, 'k'); R(m, 1, 7, l - 2, 1, 'k'); for (let x = 14; x < l - 12; x += 5) R(m, x, 2, 1, 2, 'b'); m[2][l - 5] = m[1][l - 4] = m[2][l - 3] = 'k'; }),   // chrome, many windows, the TV antenna on the trunk
    bus: (() => { const m = grid(48, 13); R(m, 1, 0, 46, 1, 'b'); R(m, 0, 1, 48, 10, 'a'); R(m, 1, 1, 46, 9, 'w'); R(m, 0, 7, 48, 1, 'a'); R(m, 0, 8, 48, 1, 'a');
      for (let x = 3; x < 43; x += 6) R(m, x, 2, 4, 4, 'g'); R(m, 1, 2, 1, 5, 'g'); m[9][0] = 'w'; m[9][47] = 'b'; R(m, 5, 10, 5, 3, 'b'); R(m, 36, 10, 5, 3, 'b'); m[11][7] = m[11][38] = 'k'; return m.map(r => r.join('')); })(),
    truck: (() => { const m = grid(36, 14); R(m, 9, 0, 27, 11, 'a'); R(m, 10, 1, 25, 9, 'w'); R(m, 2, 4, 7, 7, 'a'); R(m, 0, 7, 3, 4, 'a'); R(m, 3, 5, 4, 3, 'g'); m[9][0] = 'w'; m[9][35] = 'b';
      R(m, 3, 11, 5, 3, 'b'); R(m, 26, 11, 5, 3, 'b'); m[12][5] = m[12][28] = 'k'; return m.map(r => r.join('')); })(),
    bike: ['....bb......', '...bwwb.....', '....ww.aa...', '..bbbbaaa...', '.wbbbb.a....', 'w...aa......', '....aaa.....', '.kkk.a.kkk..', 'k.k.kbk.k.k.', 'k.kk...kk.k.', '.kkk...kkk..'],
    // the one who has to get across: seen from behind, dark jacket, two steps, and what a bumper makes of him
    me1: ['..bbbbb..', '..bbbbb..', '...www...', '.bbbbbbb.', 'wbbbwbbbw', '.bbbbbbb.', '.bbbbbbb.', '..aa.aa..', '..aa.aa..', '..bb.....', '.........'],
    me2: ['..bbbbb..', '..bbbbb..', '...www...', '.bbbbbbb.', 'wbbbwbbbw', '.bbbbbbb.', '.bbbbbbb.', '..aa.aa..', '..aa.aa..', '.....bb..', '.........'],
    meL: ['..bbbb...', '..wwbb...', '..www....', '.bbbbbb..', 'wbbwbbb..', '.bbbbbbw.', '.bbbbbb..', '..aa.aa..', '.aa...aa.', '.bb...bb.', '.........'],
    hit: ['.........', 'w.......w', '.b.....b.', '..bbwbb..', 'a.bwwwb.a', '.abbwbba.', '..bbbbb..', '.w.....w.', '.........', '....a....', '...aaa...'],
    head: ['.bbb.', '.bbb.', '.www.', 'bbbbb'],
    // what waits on the other side
    coffee: ['..w.w..', '.w.w...', '.......', 'wwwwww.', 'wggggwk', 'wgwwgwk', 'wggggw.', '.wwww..'],
    slice: ['wwwwwww', 'wgwwwgw', '.wwgww.', '.wwwww.', '..wgw..', '..www..', '...w...'],
    globe: ['..www..', '.wgwww.', '.wwwww.', '..www..', '...k...', '...k...', 'kkkkkkk', 'k.k.k.k'],
    phone: ['.kkkkk.', '.kgggk.', '.kgwgk.', '.kgggk.', '.kwwwk.', '.kwwwk.', '.kkkkk.', '...k...'],
    news: ['ggggggg', 'gwgwgwg', 'ggggggg', 'k.w.w.k', 'kwwwwwk', 'kw.w.wk', 'kwwwwwk', 'kkkkkkk'],
    hydrant: ['.aa.', 'aaaa', '.aa.', 'aaaa', '.aa.'], cart: ['awawawa', '.aaaaa.', '...k...', 'wwwwwww', 'wkkkkkw', '.k...k.'],
  };
  const cache = new Map();
  const paint = (name, flip) => {
    const key = name + (flip ? '<' : ''); let c = cache.get(key); if (c) return c;
    const rows = ART[name]; c = document.createElement('canvas'); c.width = rows[0].length; c.height = rows.length; const x = c.getContext('2d');
    rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') { x.fillStyle = PAL[ch]; x.fillRect(flip ? c.width - 1 - i : i, j, 1, 1); } }));
    cache.set(key, c); return c;
  };
  const put = (name, x, y, flip) => g.drawImage(paint(name, flip), Math.round(x), Math.round(y));
  const size = name => [ART[name][0].length, ART[name].length];

  // a 3×5 pixel alphabet
  const GLYPH = {};
  Object.entries({
    A: '010/101/111/101/101', B: '110/101/110/101/110', C: '011/100/100/100/011', D: '110/101/101/101/110', E: '111/100/110/100/111', F: '111/100/110/100/100',
    G: '011/100/101/101/011', H: '101/101/111/101/101', I: '111/010/010/010/111', J: '001/001/001/101/010', K: '101/110/100/110/101', L: '100/100/100/100/111',
    M: '10001/11011/10101/10001/10001', N: '1001/1101/1011/1001/1001', O: '010/101/101/101/010', P: '110/101/110/100/100', Q: '010/101/101/110/011', R: '110/101/110/101/101',
    S: '011/100/010/001/110', T: '111/010/010/010/010', U: '101/101/101/101/111', V: '101/101/101/101/010', W: '10001/10001/10101/11011/10001', X: '101/101/010/101/101',
    Y: '101/101/010/010/010', Z: '111/001/010/100/111', 0: '111/101/101/101/111', 1: '010/110/010/010/111', 2: '110/001/010/100/111', 3: '110/001/010/001/110',
    4: '101/101/111/001/001', 5: '111/100/110/001/110', 6: '011/100/111/101/111', 7: '111/001/010/010/010', 8: '111/101/111/101/111', 9: '111/101/111/001/110',
    '.': '0/0/0/0/1', ',': '00/00/00/01/10', ':': '0/1/0/1/0', '!': '1/1/1/0/1', '?': '110/001/010/000/010', '-': '000/000/111/000/000', "'": '1/1/0/0/0', '/': '001/001/010/100/100',
  }).forEach(([k, v]) => { const rows = v.split('/'); GLYPH[k] = { w: rows[0].length, rows }; });
  const width = (str, s = 1) => { let w = 0; for (const ch of String(str)) w += (GLYPH[ch] ? GLYPH[ch].w : 2) + 1; return (w - 1) * s; };
  const text = (str, x, y, s = 1, col = PAL.w, align = 'c') => {
    str = String(str); const w = width(str, s); let cx = Math.round(align === 'c' ? x - w / 2 : align === 'r' ? x - w : x);
    g.fillStyle = col;
    for (const ch of str) { const gl = GLYPH[ch]; if (!gl) { cx += 3 * s; continue; }
      gl.rows.forEach((r, j) => { for (let i = 0; i < gl.w; i++) if (r[i] === '1') g.fillRect(cx + i * s, y + j * s, s, s); }); cx += (gl.w + 1) * s; }
  };

  // ---- sound: square waves and noise, as a console of the time would have made them
  let ac = null, out = null, noise = null, muted = false;
  try { muted = localStorage.getItem('walk-sound') === 'off'; } catch (e) {}
  const audio = () => { if (muted) return; try {
    if (!ac) { ac = new (window.AudioContext || window.webkitAudioContext)(); out = ac.createGain(); out.gain.value = 1.6; out.connect(ac.destination);
      noise = ac.createBuffer(1, Math.floor(ac.sampleRate * .5), ac.sampleRate); const n = noise.getChannelData(0); for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1; }
    if (ac.state !== 'running') ac.resume(); } catch (e) { ac = null; } };
  const unlock = () => { audio(); if (ac && ac.state === 'running') ['pointerup', 'touchend', 'click', 'keydown'].forEach(n => removeEventListener(n, unlock)); };
  ['pointerup', 'touchend', 'click', 'keydown'].forEach(n => addEventListener(n, unlock, { passive: true }));
  const tone = (f, dur, vol = .07, type = 'square', wait = 0) => { if (!ac || muted) return; const t = ac.currentTime + wait, o = ac.createOscillator(), v = ac.createGain();
    o.type = type; if (Array.isArray(f)) o.frequency.setValueCurveAtTime(Float32Array.from(f), t, dur); else o.frequency.setValueAtTime(f, t);
    v.gain.setValueAtTime(.0001, t); v.gain.linearRampToValueAtTime(vol, t + .004); v.gain.exponentialRampToValueAtTime(.0001, t + dur); o.connect(v).connect(out); o.start(t); o.stop(t + dur + .03); };
  const crunch = (dur, vol = .09, rate = .5) => { if (!ac || muted) return; const t = ac.currentTime, n = ac.createBufferSource(), v = ac.createGain(); n.buffer = noise; n.loop = true; n.playbackRate.value = rate;
    v.gain.setValueAtTime(vol, t); v.gain.exponentialRampToValueAtTime(.0001, t + dur); n.connect(v).connect(out); n.start(t, Math.random() * .3); n.stop(t + dur + .03); };
  const midi = m => 440 * 2 ** ((m - 69) / 12);
  const tune = (notes, gap, vol = .06) => notes.forEach((m, i) => { if (m) tone(midi(m), gap * 1.4, vol, 'square', i * gap); });
  const sfx = {
    hop: () => tone([520, 760], .06, .05),
    bonk: () => tone(110, .08, .06),
    honk: deep => { const f = deep ? 190 : 370; tone(f, .16, .05); tone(f * 1.26, .16, .05); },                 // two notes a third apart: a car horn
    bell: () => tone([1400, 1200], .12, .04, 'triangle'),
    hit: () => { crunch(.45, .12, .35); tone([300, 60], .4, .08, 'sawtooth'); },
    home: () => tune([72, 76, 79, 84], .07),
    year: () => tune([67, 72, 76, 79, 0, 76, 79, 84], .1, .07),
    over: () => tune([64, 60, 57, 52], .2, .07),
    tick: () => tone(980, .03, .04),
    start: () => tune([60, 67, 72], .08),
  };

  // ---- the avenue. Each lane repeats a row of vehicles; everything drives from right to left
  const LANE = [                                    // from the near sidewalk outwards: speed in px/s, what drives there, how much room between
    { v: 26, row: ['cab', 'sedan', 'cab', 'cab'], gap: [54, 86] },
    { v: 40, row: ['cab', 'cop', 'cab', 'wagon', 'cab'], gap: [62, 104] },
    { v: 19, row: ['bus', 'truck', 'cab', 'truck'], gap: [50, 78] },
    { v: 58, row: ['cab', 'cab', 'sedan', 'cab'], gap: [84, 150] },
    { v: 33, row: ['limo', 'cab', 'wagon', 'cab'], gap: [56, 96] },
    { v: 84, row: ['bike', 'bike', 'cab'], gap: [120, 220] },
  ];
  const SAID = ["WATCH IT, PAL!", "HEY! HEY!", "USE THE CROSSWALK!", "YOU BLIND?", "MOVE IT!", "NICE TRY."];
  let lanes = [], me, state = 'title', t = 0, year = 0, score = 0, best = 0, lives = 3, clock = 0, homes = [], far = 0, said = null, paused = false, steam = [], horn = 0, lastTick = 0;
  try { best = +localStorage.getItem('walk-best') || 0; } catch (e) {}
  const TIME = 30;
  const rowY = r => r === 0 ? WALK + 9 : r > LANES ? ROAD - 8 : ROAD + (LANES - r) * CELL + 8;      // centre line of the row the walker stands in
  const build = () => {
    const speed = 1 + year * .13, tight = 1 - year * .06;
    lanes = LANE.map(L => { let x = rnd(60); const cars = [];
      for (let k = 0; k < 2; k++) for (const type of L.row) { cars.push({ type, x }); x += size(type)[0] + (L.gap[0] + rnd(L.gap[1] - L.gap[0])) * tight; }
      return { v: L.v * speed, len: Math.max(x, W + 80), cars }; });
  };
  const spawn = () => { me = { c: 5, r: 0, x: 5 * CELL + 8, y: rowY(0), fx: 0, fy: 0, hop: 0, face: 0, step: 0, dead: 0 }; clock = TIME; far = 0; };
  const newGame = () => { year = 0; score = 0; lives = 3; homes = []; build(); spawn(); state = 'play'; t = 0; sfx.start(); };
  const lose = why => { if (me.dead) return; me.dead = 1.1; lives--; said = [why || pick(SAID), 1.1]; sfx.hit(); };
  const move = (dc, dr) => {
    if (state !== 'play' || paused || me.dead || me.hop > 0) return;
    const c = me.c + dc, r = me.r + dr;
    if (c < 0 || c >= COLS || r < 0) return void sfx.bonk();
    if (r > LANES) { if (!GOALS.includes(c) || homes.includes(c)) return void sfx.bonk(); }                    // only a free door lets him in
    me.fx = me.x; me.fy = me.y; me.c = c; me.r = r; me.hop = 1; me.face = dc; me.step ^= 1; sfx.hop();
    if (r > far) { far = r; score += 10; }
  };
  const arrive = () => {
    if (me.r <= LANES) return;
    homes.push(me.c); score += 50 + Math.ceil(clock) * 10; sfx.home();
    if (homes.length === GOALS.length) { score += 1000; state = 'clear'; t = 0; sfx.year(); if (lives < 5) lives++; } else spawn();
  };
  const update = dt => {
    t += dt;
    if (state === 'title' || paused) return;
    for (const L of lanes) for (const c of L.cars) { c.x -= L.v * dt; if (c.x + size(c.type)[0] < -10) c.x += L.len; }
    if (!calm && Math.random() < dt * .9) steam.push({ x: 122 + rnd(4), y: ROAD + 2.5 * CELL, a: 1, vx: -4 - rnd(6) });
    steam.forEach(s => { s.y -= 9 * dt; s.x += s.vx * dt; s.a -= dt * .55; }); steam = steam.filter(s => s.a > 0);
    if (said) { said[1] -= dt; if (said[1] <= 0) said = null; }
    if (state === 'clear') { if (t > 3.2) { year++; if (year >= YEARS.length) { state = 'won'; t = 0; record(); } else { homes = []; build(); spawn(); state = 'play'; } } return; }
    if (state !== 'play') return;
    if (me.dead) { me.dead -= dt; if (me.dead <= 0) { me.dead = 0; if (lives <= 0) { state = 'over'; t = 0; record(); sfx.over(); } else spawn(); } return; }
    if (me.hop > 0) { me.hop = Math.max(0, me.hop - dt / .09); const k = 1 - me.hop, tx = me.c * CELL + 8, ty = rowY(me.r); me.x = me.fx + (tx - me.fx) * k; me.y = me.fy + (ty - me.fy) * k - Math.sin(k * Math.PI) * 2; if (!me.hop) arrive(); }
    clock -= dt; if (clock <= 0) return lose('TOO SLOW FOR THIS TOWN.');
    if (clock < 8 && Math.floor(clock * 2) !== lastTick) { lastTick = Math.floor(clock * 2); sfx.tick(); }
    const lane = me.r >= 1 && me.r <= LANES ? lanes[me.r - 1] : null; horn -= dt;
    if (lane) for (const c of lane.cars) { const w = size(c.type)[0];
      if (me.x + 3 > c.x + 1 && me.x - 3 < c.x + w - 1) return lose();
      if (horn <= 0 && c.x > me.x && c.x - me.x < 26) { horn = .9; c.type === 'bike' ? sfx.bell() : sfx.honk(c.type === 'bus' || c.type === 'truck'); } }
  };
  const record = () => { if (score > best) { best = score; try { localStorage.setItem('walk-best', String(best)); } catch (e) {} } };   // the best score stays on this device, nothing else is kept

  // ---- drawing
  const DOOR = { 0: 'coffee', 2: 'slice', 4: 'globe', 6: 'phone', 8: 'news' };
  const street = () => {
    g.fillStyle = PAL.s; g.fillRect(0, 0, W, TOP);
    g.fillStyle = PAL.a; g.fillRect(0, TOP, W, STORES - 6);                                              // the block across the street
    g.fillStyle = PAL.b; for (let x = 3; x < W; x += 8) g.fillRect(x, TOP + 2, 4, 5);                     // its windows, most of them dark
    g.fillStyle = PAL.w; for (const x of [11, 43, 67, 115, 131, 163]) g.fillRect(x, TOP + 2, 4, 5);
    for (const c of GOALS) { const x = c * CELL;                                                          // five doors, each under its awning
      const home = homes.includes(c); g.fillStyle = home ? PAL.w : PAL.b; g.fillRect(x + 1, TOP + 10, 14, 14);                  // a door he has reached is lit, and he stands in it
      for (let i = 0; i < 16; i += 2) { g.fillStyle = (i / 2) % 2 ? PAL.w : PAL.b; g.fillRect(x + i, TOP + 8, 2, 3); }
      if (home) put('me1', x + 4, TOP + 12); else put(DOOR[c], x + 4, TOP + 13); }
    g.fillStyle = PAL.s; g.fillRect(0, ROAD - 6, W, 6); g.fillStyle = PAL.k; g.fillRect(0, ROAD - 1, W, 1);   // far kerb
    put('hydrant', 20, ROAD - 6); put('cart', 84, ROAD - 7);
    g.fillStyle = PAL.d; g.fillRect(0, ROAD, W, LANES * CELL);                                           // asphalt
    g.fillStyle = PAL.w; for (let l = 1; l < LANES; l++) for (let x = 2; x < W; x += 14) g.fillRect(x, ROAD + l * CELL, 7, 1);
    g.fillStyle = PAL.k; g.fillRect(120, ROAD + 2.5 * CELL - 1, 7, 3);                                    // the manhole the steam comes from
    g.fillStyle = PAL.w; for (let x = 68; x < 108; x += 6) g.fillRect(x, ROAD, 3, LANES * CELL);          // crosswalk bars, worn
    g.fillStyle = PAL.d; for (let x = 68; x < 108; x += 6) for (let y = ROAD + 5; y < WALK; y += 11) g.fillRect(x, y, 3, 2 + (x + y) % 3);
    g.fillStyle = PAL.s; g.fillRect(0, WALK, W, 18); g.fillStyle = PAL.k; g.fillRect(0, WALK, W, 1); for (let x = 12; x < W; x += 24) g.fillRect(x, WALK + 1, 1, 17);
    g.fillStyle = PAL.s; g.fillRect(0, BAR, W, H - BAR); g.fillStyle = PAL.k; g.fillRect(0, BAR, W, 1); g.fillRect(0, TOP - 1, W, 1);
  };
  const signal = () => {                             // the box on the far corner: DONT WALK, without the apostrophe, as the city spelled it
    const x = 152, y = TOP + 9, go = state === 'clear', on = go || calm || state !== 'play' || clock > 8 || Math.floor(t * 4) % 2 === 0;
    g.fillStyle = PAL.k; g.fillRect(x + 9, y + 14, 1, 7); g.fillStyle = PAL.b; g.fillRect(x, y, 21, 15); g.fillStyle = PAL.k; g.fillRect(x, y, 21, 1);
    if (!on) return;
    if (go) text('WALK', x + 11, y + 5, 1, PAL.w); else { text('DONT', x + 11, y + 2, 1, PAL.y); text('WALK', x + 11, y + 9, 1, PAL.y); }
  };
  const hud = () => {
    text(String(score).padStart(5, '0'), 3, 4, 1, PAL.b, 'l'); text(YEARS[Math.min(year, YEARS.length - 1)], W / 2, 4, 1, PAL.a); text('HI ' + String(Math.max(best, score)).padStart(5, '0'), W - 3, 4, 1, PAL.k, 'r');
    for (let i = 0; i < lives; i++) put('head', 3 + i * 7, BAR + 4);
    const w = 70, x = W - w - 3; g.fillStyle = PAL.d; g.fillRect(x, BAR + 4, w, 4); g.fillStyle = clock < 8 ? PAL.y : PAL.a; g.fillRect(x + w - Math.round(w * clamp(clock / TIME, 0, 1)), BAR + 4, Math.round(w * clamp(clock / TIME, 0, 1)), 4);
  };
  const panel = (lines, y) => { const h = lines.length * 9 + 8; g.fillStyle = PAL.b; g.fillRect(14, y, W - 28, h); g.fillStyle = PAL.k; g.fillRect(14, y, W - 28, 1); g.fillRect(14, y + h - 1, W - 28, 1);
    lines.forEach(([s, col, big], i) => text(s, W / 2, y + 5 + i * 9, big || 1, col || PAL.w)); };
  const draw = () => {
    street(); signal();
    for (const L of lanes) { const i = lanes.indexOf(L); for (const c of L.cars) { const [w, h] = size(c.type); if (c.x < W && c.x + w > 0) put(c.type, c.x, ROAD + (LANES - 1 - i) * CELL + 15 - h); } }
    for (const s of steam) { g.fillStyle = `rgba(246, 248, 245, ${(s.a * .85).toFixed(2)})`; g.fillRect(Math.round(s.x), Math.round(s.y), 3, 2); }
    if (state === 'play' || state === 'clear') { if (state === 'play') { if (me.dead) put('hit', me.x - 4, me.y - 6); else put(me.face ? 'meL' : me.step ? 'me2' : 'me1', me.x - 4, me.y - 6, me.face > 0); } hud(); }
    if (said && state === 'play') { const w = width(said[0]) + 8; g.fillStyle = PAL.b; g.fillRect((W - w) / 2, ROAD + 40, w, 11); text(said[0], W / 2, ROAD + 43, 1, PAL.w); }
    if (state === 'title') {
      g.fillStyle = PAL.b; g.fillRect(30, 44, 116, 52); g.fillStyle = PAL.k; g.fillRect(30, 44, 116, 1); g.fillRect(30, 95, 116, 1);
      const on = calm || Math.floor(t * 1.6) % 4 !== 3; if (on) { text('DONT', W / 2, 50, 4, PAL.y); text('WALK', W / 2, 73, 4, PAL.y); }
      panel([['NEW YORK, 1997-2002', PAL.g], ['GET TO THE OTHER SIDE.'], ['THE LIGHT WILL NOT CHANGE.', PAL.g]], 102);
      text(touch() ? 'TAP TO START - SWIPE TO WALK' : 'SPACE TO START - ARROWS TO WALK', W / 2, 142, 1, PAL.b);
      if (best) text('BEST ' + best, W / 2, BAR + 4, 1, PAL.a);
    }
    if (state === 'clear') panel([[YEARS[year] + ' - MADE IT', PAL.w], [year + 1 < YEARS.length ? 'NEXT: ' + YEARS[year + 1] : 'THAT WAS THE LAST YEAR', PAL.g]], ROAD + 34);
    if (state === 'over') { panel([['GAME OVER', PAL.w, 2], [''], ['WELCOME TO NEW YORK.', PAL.g], ['SCORE ' + score + (score >= best && score ? '  - YOUR BEST' : ''), PAL.w]], ROAD + 18); if (t > 1.2) text(touch() ? 'TAP' : 'SPACE', W / 2, WALK + 6, 1, PAL.b); }
    if (state === 'won') { panel([['SIX YEARS,', PAL.w, 2], [''], ['AND STILL IN ONE PIECE.', PAL.g], ['SCORE ' + score, PAL.w]], ROAD + 18); if (t > 1.2) text(touch() ? 'TAP' : 'SPACE', W / 2, WALK + 6, 1, PAL.b); }
    if (paused) panel([['PAUSE', PAL.w, 2], ['']], ROAD + 34);
  };

  // ---- size: whole pixels where the screen allows
  const hint = document.getElementById('keys'), pauseBtn = document.getElementById('pause'), sndBtn = document.getElementById('snd'), keysText = document.getElementById('keys-text');
  const touch = () => matchMedia('(hover: none), (pointer: coarse)').matches;
  let S = 2;
  const fit = () => { const box = cv.parentElement, cs = getComputedStyle(box);
    const aw = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), ah = box.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - (hint ? hint.offsetHeight + 12 : 0);
    let s = Math.min(aw / W, ah / H); if (s >= 2) s = Math.floor(s); S = Math.max(.5, s);
    cv.width = W; cv.height = H; g = cv.getContext('2d'); g.imageSmoothingEnabled = false; cv.style.width = W * S + 'px'; cv.style.height = H * S + 'px'; };
  addEventListener('resize', fit); fit();
  if (keysText) keysText.textContent = touch() ? 'Swipe or tap to walk' : 'Arrows or WASD walk · Space pauses';

  // ---- controls
  const setPause = v => { paused = v && state === 'play'; if (pauseBtn) pauseBtn.textContent = paused ? 'Go on' : 'Pause'; };
  const go = () => { audio(); if (paused) return setPause(false); if (state === 'title') return newGame(); if ((state === 'over' || state === 'won') && t > 1.2) { state = 'title'; t = 0; } };
  const DIR = { ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0], ArrowUp: [0, 1], w: [0, 1], ArrowDown: [0, -1], s: [0, -1] };
  addEventListener('keydown', e => { if (e.target.closest && e.target.closest('button, a, input')) return; const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === ' ' || k === 'Enter') { e.preventDefault(); if (e.repeat) return; if (state === 'play') setPause(!paused); else go(); return; }
    if (k === 'p') return setPause(!paused);
    if (k === 'Escape') { if (history.length > 1) history.back(); else location.href = 'bio.html'; return; }
    if (DIR[k]) { e.preventDefault(); if (e.repeat) return; if (state !== 'play') return; audio(); move(...DIR[k]); } });
  let down = null;
  cv.addEventListener('pointerdown', e => { e.preventDefault(); down = [e.clientX, e.clientY]; });
  cv.addEventListener('pointerup', e => { if (!down) return; const dx = e.clientX - down[0], dy = e.clientY - down[1]; down = null;
    if (state !== 'play' || paused) return go();
    let ax = dx, ay = dy;
    if (Math.hypot(dx, dy) < 14) { const r = cv.getBoundingClientRect(); ax = (e.clientX - r.left) / S - me.x; ay = (e.clientY - r.top) / S - me.y; if (Math.hypot(ax, ay) < 5) ay = -1; }   // a tap walks towards the finger, a swipe in its own direction
    Math.abs(ax) > Math.abs(ay) ? move(Math.sign(ax), 0) : move(0, ay < 0 ? 1 : -1); });
  cv.addEventListener('pointercancel', () => { down = null; }); cv.addEventListener('contextmenu', e => e.preventDefault());
  if (pauseBtn) pauseBtn.addEventListener('click', () => { setPause(!paused); pauseBtn.blur(); });
  const setMuted = v => { muted = v; try { localStorage.setItem('walk-sound', v ? 'off' : 'on'); } catch (e) {} if (!v) audio(); if (sndBtn) sndBtn.textContent = v ? 'Sound off' : 'Sound on'; };
  if (sndBtn) { sndBtn.textContent = muted ? 'Sound off' : 'Sound on'; sndBtn.addEventListener('click', () => { setMuted(!muted); sndBtn.blur(); }); }
  document.addEventListener('visibilitychange', () => { if (document.hidden) setPause(true); });
  addEventListener('blur', () => setPause(true));
  const burger = document.getElementById('burger'); if (burger) burger.addEventListener('click', () => setPause(true));

  build(); spawn();
  let last = performance.now();
  const frame = now => { const dt = Math.min(.05, (now - last) / 1000); last = now; update(dt); draw(); requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
  window.dontWalk = { get state() { return state; }, get me() { return me; }, get lanes() { return lanes; }, get year() { return year; }, get score() { return score; }, get lives() { return lives; }, get homes() { return homes; }, move, size, GOALS, LANES, CELL, rowY };   // for testing
})();
