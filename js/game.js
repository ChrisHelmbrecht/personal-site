// Owl Night Long: the game hidden in the skull's left cheekbone.
// The moon is gone. An owl looks for it in the four cities of the drawing and finally in the skull itself.
// Everything is drawn in the site's own ink on a 176 px wide canvas and scaled up with hard pixels.
(() => {
  const cv = document.getElementById('game');
  if (!cv) return;
  let g = cv.getContext('2d');
  const W = 176; let H = 230, S = 2;
  const INK = '#1f3f97', DEEP = '#12265f', LIGHT = '#f6f8f5', HOT = '#e23d7a';
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = matchMedia('(hover: none), (pointer: coarse)').matches;
  const rnd = n => Math.random() * n, pick = a => a[Math.floor(rnd(a.length))], clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // Pixel art. a = ink, b = deep ink, w = paper white, c = the colour that cycles
  const ART = /*SPRITES*/{
    "owl1": ["bb.............bb", "abb..b.....b..bba", "aabb.bbbbbbb.bbaa", ".aabbwwwbwwwbbaa.", "..aabwbwbwbwbaa..", "...abwwwawwwba...", "....bbbbabbbb....", "....babababab....", "....bbabababb....", ".....bababab.....", "......bbbbb......", "......w...w......"],
    "owl2": [".................", ".....b.....b.....", ".....bbbbbbb.....", "....bwwwbwwwb....", "..abbwbwbwbwbba..", ".aabbwwwawwwbbaa.", "aabbbbbbabbbbbbaa", "abbbbababababbbba", "bb...bababab...bb", ".....bababab.....", "......bbbbb......", "......w...w......"],
    "hoot": [".bbb.", "b...b", ".....", "..b..", ".b.b."],
    "moth1": ["...b...b...", "aa..b.b..aa", "aaaabbbaaaa", "awaabbbaawa", "aaaabbbaaaa", ".aaa.b.aaa.", "..a..b..a.."],
    "moth2": ["...b...b...", "....b.b....", ".aaabbbaaa.", ".awabbbawa.", ".aaabbbaaa.", "..aa.b.aa..", ".....b....."],
    "bug1": ["..b.....b..", "...b...b...", "b.bbbbbbb.b", ".bbwbbbwbb.", "..baabaab..", "bbbaabaabbb", "..baabaab..", ".b.bbbbb.b."],
    "bug2": ["...b...b...", "...b...b...", "..bbbbbbb..", "bbbwbbbwbbb", "..baabaab..", ".bbaabaabb.", "b.baabaab.b", "...bbbbb..."],
    "mush": ["...bbbbb...", ".bbawaaabb.", "bawaaaawaab", "baaawaaaaab", "bbbbbbbbbbb", "...bwwwb...", "...bwbwb...", "...bwwwb...", "..bbwwwbb..", "..bb...bb.."],
    "dollL": [".....bbbbb.....", "...bbaaaaabb...", "..baaaaaaaaab..", "..baawwwwwaab..", ".baawwwwwwwaab.", ".baawbwwwbwaab.", ".baawwwwwwwaab.", ".baaawwbwwaaab.", "..baaawwwaaab..", "..bbaaaaaaabb..", ".baaabaaabaaab.", "baaaaabbbaaaaab", "baaawaaaaawaaab", "baawawaaawawaab", "baaawaawaawaaab", "baaaaawawaaaaab", "baaaaaawaaaaaab", ".baaaaaaaaaaab.", ".bbaaaaaaaaabb.", "..bbbbbbbbbbb.."],
    "dollM": ["...bbbbb...", "..baaaaab..", ".baawwwaab.", ".bawbwbwab.", ".bawwwwwab.", ".baawbwaab.", "..baaaaab..", ".baabbbaab.", "baaaawaaaab", "baaawawaaab", "baaaawaaaab", "baaaaaaaaab", ".baaaaaaab.", "..bbbbbbb.."],
    "dollS": ["..bbb..", ".bawab.", ".bwwwb.", ".bawab.", "bbaaabb", "baawaab", "baaaaab", "baaaaab", ".bbbbb."],
    "swallow1": ["....b....", "b..bbb..b", "bbbbbbbbb", ".bbbwbbb.", "...bbb...", "..b...b.."],
    "swallow2": ["....b....", "...bbb...", ".bbbbbbb.", "bbbbwbbbb", "b..bbb..b", "..b...b.."],
    "girl": [".........b.bb....", "........bbbbbb...", "....b...bbbbbb...", ".....bbbbbbbb....", "..........bbbbbbb", "...aaaaaaabb.....", "..aaaaaaaab......", "..aaaaaaaa.......", ".b.aaaaaa........", "bb...aaa........."],
    "star": ["...c...", "...c...", "..cwc..", "cccwccc", "..cwc..", "...c...", "...c..."],
    "life": ["b.....b", "bbbbbbb", "bwbbbwb", "bbbabbb", ".bbbbb."],
    "ink": [".b.", ".b.", "bbb", "bbb", ".b."],
    "bit": ["bb.", ".bb", "bb.", ".bb"],
    "spore": [".c.", "cbc", ".c."],
    "tooth": ["bbbbb", "bwwwb", "bwwwb", "bwwwb", ".bwb.", "..b.."],
    "shard": ["..ccc..", ".cwwwc.", "cwwwwwc", "cwwwwwc", "cwwwwwc", ".cwwwc.", "..ccc.."],
    "bud": ["....b....", "...bab...", "..babab..", "..babab..", "...bbb..."],
    "bloom": [".cc...c...cc.", "cccc.ccc.cccc", ".ccccccccccc.", "..cccwwwccc..", "...ccwwwcc...", "....bbbbb...."]
  }/*END*/;
  // The skull and its jaw are drawn by rule: dome, flower eyes, heart nose, a blossom on the brow, a row of teeth
  (() => {
    const w = 64, h = 54, px = [...Array(h)].map(() => Array(w).fill('.'));
    const inside = (x, y) => { const dx = x - 31.5; return (dx / 30) ** 2 + ((y - 23.5) / 23) ** 2 < 1 || (y >= 36 && y < h && Math.abs(dx) < 16.5 - Math.max(0, y - 50) * .5); };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      const dx = x - 31.5, rim = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      let c = rim ? 'b' : 'w';
      for (const ex of [18.5, 44.5]) {                                    // eye sockets with a ring of petals
        const d = Math.hypot(x - ex, y - 26), a = Math.atan2(y - 26, x - ex);
        if (d < 6.6) c = d < 1.6 ? 'w' : 'b'; else if (d < 9.6 && d > 7.4 && Math.cos(a * 8) > -.2) c = 'a';
      }
      if (y >= 35 && y <= 40 && Math.abs(dx) <= (y - 35) * .7 + .6) c = 'b';   // nose
      const f = Math.hypot(dx, y - 9.5), fa = Math.atan2(y - 9.5, dx);       // blossom on the brow
      if (f < 1.6 || (f > 2.6 && f < 5.6 && Math.cos(fa * 6) > 0)) c = 'a';
      if (!rim && y >= 45) c = y === 45 || Math.round(Math.abs(dx) + .5) % 5 === 0 ? 'a' : c;   // teeth
      if (!rim && [[9, 36], [54, 36], [7, 20], [56, 20], [24, 14], [39, 14], [31, 18], [32, 18]].some(([a, b]) => a === x && b === y)) c = 'a';
      px[y][x] = c;
    }
    ART.skull = px.map(r => r.join(''));
    const jw = 30, jh = 9, jx = [...Array(jh)].map(() => Array(jw).fill('.'));
    const inJaw = (x, y) => x >= 0 && y >= 0 && y < jh && Math.abs(x - 14.5) < 15 - Math.max(0, y - 3) * 1.1;
    for (let y = 0; y < jh; y++) for (let x = 0; x < jw; x++) if (inJaw(x, y)) {
      const rim = !inJaw(x - 1, y) || !inJaw(x + 1, y) || !inJaw(x, y - 1) || !inJaw(x, y + 1);
      jx[y][x] = rim ? 'b' : y === 4 || (y < 4 && Math.round(Math.abs(x - 14.5) + .5) % 5 === 0) ? 'a' : 'w';
    }
    ART.jaw = jx.map(r => r.join(''));
  })();
  for (const n of [1, 2]) ART['shell' + n] = ART['bug' + n].map((r, j) => j > 3 ? r.replace(/a/g, 'w') : r);
  const cache = new Map();
  const paint = (name, mode = '') => {                      // mode: '' as drawn, 'hit' turns the ink hot pink, a number is the hue of the cycling colour
    const key = name + '|' + mode; let c = cache.get(key); if (c) return c;
    const rows = ART[name]; c = document.createElement('canvas'); c.width = rows[0].length; c.height = rows.length;
    const x = c.getContext('2d');
    rows.forEach((r, j) => [...r].forEach((ch, i) => {
      if (ch === '.') return;
      x.fillStyle = ch === 'w' ? LIGHT : mode === 'hit' ? HOT : ch === 'a' ? INK : ch === 'b' ? DEEP : `hsl(${mode || 0} 85% 55%)`;
      x.fillRect(i, j, 1, 1);
    }));
    cache.set(key, c); return c;
  };
  const draw = (name, x, y, mode) => { const c = paint(name, mode); g.drawImage(c, Math.round(x - c.width / 2), Math.round(y - c.height / 2)); };
  const moon = (cx, cy, r, lit) => {                        // lit: 0 new moon ... 1 full moon
    const key = 'moon|' + r + '|' + lit.toFixed(2); let c = cache.get(key);
    if (!c) {
      c = document.createElement('canvas'); c.width = c.height = r * 2 + 1; const x = c.getContext('2d');
      for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
        const d = i * i + j * j; if (d > r * r + r * .8) continue;
        const rim = d > (r - 1) * (r - 1) + (r - 1) * .8, on = lit > 0 && i >= (1 - 2 * lit) * Math.sqrt(Math.max(0, r * r - j * j));
        x.fillStyle = rim ? INK : on ? LIGHT : DEEP; x.fillRect(i + r, j + r, 1, 1);
      }
      cache.set(key, c);
    }
    g.drawImage(c, Math.round(cx - r), Math.round(cy - r));
  };

  // A 3×5 pixel alphabet
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
  const text = (str, x, y, s = 1, col = INK, align = 'c') => {
    str = String(str); let w = 0; for (const ch of str) w += (GLYPH[ch] ? GLYPH[ch].w : 2) + 1; w = (w - 1) * s;
    let cx = Math.round(align === 'c' ? x - w / 2 : align === 'r' ? x - w : x);
    g.fillStyle = col;
    for (const ch of str) {
      const gl = GLYPH[ch]; if (!gl) { cx += 3 * s; continue; }
      gl.rows.forEach((r, j) => { for (let i = 0; i < gl.w; i++) if (r[i] === '1') g.fillRect(cx + i * s, y + j * s, s, s); });
      cx += (gl.w + 1) * s;
    }
  };

  // Sound: synthesised the way an 80s cabinet did it, with square waves, a triangle and crunchy noise. Nothing is recorded.
  // The game has its own switch, so muting the night sound on the skull does not silence it
  const LOUD = 3;
  let ac = null, out = null, echo = null, noise = null, muted = false;
  try { muted = localStorage.getItem('owl-sound') === 'off'; } catch (e) {}
  const audio = () => {
    if (muted) return;
    try {
      if (!ac) {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        // loud enough to be heard on laptop speakers; a soft clip catches the moments when everything fires at once
        const soft = ac.createWaveShaper(); soft.curve = Float32Array.from({ length: 513 }, (_, i) => Math.tanh((i / 256 - 1) * 1.4) / Math.tanh(1.4)); soft.connect(ac.destination);
        out = ac.createGain(); out.gain.value = LOUD; out.connect(soft);
        const d = ac.createDelay(.5), back = ac.createGain(); d.delayTime.value = .17; back.gain.value = .3;    // a short echo for whatever should sparkle
        echo = ac.createGain(); echo.connect(out); echo.connect(d); d.connect(back); back.connect(d); d.connect(out);
        noise = ac.createBuffer(1, Math.floor(ac.sampleRate * .5), ac.sampleRate); const n = noise.getChannelData(0); for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1;
      }
      if (ac.state !== 'running') ac.resume();
    } catch (e) { ac = null; }
  };
  // browsers only let sound start inside a real gesture, and for a finger that is the lift, not the touch
  const unlock = () => { audio(); if (ac && ac.state === 'running') ['pointerup', 'touchend', 'click', 'keydown'].forEach(n => removeEventListener(n, unlock)); };
  ['pointerup', 'touchend', 'click', 'keydown'].forEach(n => addEventListener(n, unlock, { passive: true }));
  const now = () => ac ? ac.currentTime : 0;
  const midi = m => 440 * 2 ** ((m - 69) / 12);
  const glide = (a, b, n = 12) => Array.from({ length: n }, (_, i) => a * (b / a) ** (i / (n - 1)));
  // one voice. f is a pitch in Hz, or a list of pitches it slides through
  const tone = (f, dur, vol = .08, type = 'square', when = 0, bus = out) => {
    if (!ac || muted) return; const t = when || ac.currentTime, o = ac.createOscillator(), v = ac.createGain();
    o.type = type; if (Array.isArray(f)) o.frequency.setValueCurveAtTime(Float32Array.from(f), t, dur); else o.frequency.setValueAtTime(f, t);
    v.gain.setValueAtTime(.0001, t); v.gain.linearRampToValueAtTime(vol, t + .004); v.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(v).connect(bus); o.start(t); o.stop(t + dur + .03);
  };
  // noise. Played slowly it turns into the gritty rumble of an old explosion chip; the speed slides from r0 to r1
  const crunch = (dur, vol = .08, r0 = 1, r1 = r0, when = 0, high = 0) => {
    if (!ac || muted) return; const t = when || ac.currentTime, n = ac.createBufferSource(), v = ac.createGain(); n.buffer = noise; n.loop = true;
    n.playbackRate.setValueAtTime(r0, t); if (r1 !== r0) n.playbackRate.exponentialRampToValueAtTime(r1, t + dur);
    v.gain.setValueAtTime(vol, t); v.gain.exponentialRampToValueAtTime(.0001, t + dur);
    if (high) { const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = high; n.connect(f).connect(v); } else n.connect(v);
    v.connect(out); n.start(t, Math.random() * .3); n.stop(t + dur + .03);
  };
  // a row of notes (MIDI numbers, 0 is a rest)
  const tune = (notes, gap, vol = .06, type = 'square', bus = out, wait = 0) => { if (ac && !muted) notes.forEach((m, i) => { if (m) tone(midi(m), gap * 1.5, vol, type, ac.currentTime + wait + i * gap, bus); }); };
  const sfx = {
    start: () => tune([72, 76, 79, 84], .06, .06),                                                              // a coin drops
    night: n => tune(LEVELS[n].motif, .1, .05, 'square', echo, .35),                                              // every city has its own few notes
    hoot: () => tone([540, 470, 430, 400], .1, .04, 'sine'),
    moth: () => { tone(glide(1100, 300), .09, .05, 'triangle'); crunch(.07, .05, 1.6, 1, 0, 3000); },            // papery
    bug: () => { tone(glide(1500, 120), .11, .05); crunch(.1, .05, .5, .15); },                                  // a zap and some static
    mush: () => { tone(glide(260, 900), .1, .05, 'sine'); tone(glide(180, 520), .14, .04, 'sine', now() + .05); },   // bloop
    doll: d => { const f = [220, 330, 520][d.size]; tone(glide(f * 1.6, f), .08, .07, 'triangle'); crunch(.04, .04, 1.2); if (d.size < 2) tone(glide(f * 2, f * 2.7), .07, .04, 'square', now() + .07); }, // a wooden knock, and the next one pops out
    pop: () => { tone(glide(500, 120), .12, .06); crunch(.14, .07, .6, .2); },
    clink: () => { tone(2093, .04, .03); tone(2794, .05, .02); },
    dive: () => tone(glide(1300, 600), .32, .022, 'sine'),
    plink: () => tone(glide(420, 240), .06, .028),                                                              // something is dropped
    spit: () => tone(glide(520, 140), .16, .05, 'sawtooth'),                                                    // the skull's eyes
    teeth: () => { for (let i = 0; i < 6; i++) crunch(.03, .05, 2.4, 2.4, now() + i * .045, 2500); },
    yawn: () => tone([70, 95, 150, 170, 150, 110], .7, .07, 'sawtooth'),
    hurt: () => { tone(glide(240, 70), .2, .07); crunch(.16, .07, .35, .12); },
    boom: () => { crunch(.9, .12, .3, .05); tone(glide(140, 30), .8, .1, 'triangle'); },
    glitch: () => tune([91, 67, 86, 62, 89], .028, .035),
    through: () => tune([57, 0, 57, 0, 57], .09, .06, 'sawtooth'),
    land: () => { tone(glide(160, 60), .1, .06, 'triangle'); crunch(.2, .04, 1.5, 2.5, now() + .03, 4000); },
    girl: () => tune([96, 91, 88, 84], .07, .025, 'triangle', echo),
    star: () => { tune([76, 79, 84, 88, 91], .05, .05, 'square', echo); for (let i = 0; i < 3; i++) tone(glide(3200, 4600), .05, .025, 'sine', now() + .3 + i * .09); }, // and the swallows chirp
    fade: () => tune([72, 67], .1, .04),
    die: () => { tone([420, 380, 300, 330, 220, 250, 140, 160, 60], .75, .08, 'sawtooth'); crunch(.6, .08, .5, .08); },
    clear: () => tune([72, 76, 79, 84, 0, 79, 84, 88], .09, .06, 'triangle', echo),
    over: () => tune([64, 0, 60, 0, 57, 0, 52, 52], .16, .06, 'triangle', echo),
    win: () => tune([69, 72, 76, 81, 0, 76, 81, 84, 0, 88, 86, 84, 88, 93], .11, .06, 'square', echo, .3),
    pause: () => tune([72, 60], .06, .04),
  };
  let step = 0, nextT = 0;
  const music = () => {                // four on the floor and an off-beat bass; hats from New York, an arpeggio from Tenerife, a clap from Moscow
    if (!ac || muted || ac.state !== 'running' || (state !== 'play' && state !== 'intro')) { nextT = 0; return; }
    const spb = 60 / (LEVELS[level].bpm + night * 4) / 4;
    if (nextT < ac.currentTime) { nextT = ac.currentTime + .05; step = 0; }
    while (nextT < ac.currentTime + .15) {
      const s = step % 16, root = (level === 3 ? [45, 50, 52, 45] : level === 4 ? [45, 45, 46, 44] : [45, 41, 48, 43])[(step >> 4) % 4], third = root === 41 || root === 48 || root === 43 || root === 52 ? 4 : 3;
      if (s % 4 === 0) tone(glide(150, 45), .13, .085, 'sine', nextT);
      if (s % 4 === 2) { tone(midi(root + 12), .12, .05, 'triangle', nextT); if (level > 0) crunch(.03, .014, 1, 1, nextT, 6000); }
      if (level > 2 && s % 8 === 4) crunch(.07, .02, 1.4, 1.4, nextT, 1500);
      const k = [0, 3, 6, 9, 12, 14].indexOf(s);
      if (level > 1 && k >= 0) { const n = root + 24 + [0, third, 7, 12, 7, third][k]; tone(midi(n), .1, .016, 'square', nextT); }
      nextT += spb; step++;
    }
  };

  // State
  let state = 'title', t = 0, frame = 0, paused = false;
  let level = 0, night = 0, score = 0, hi = 0, spare = 2, shake = 0;
  let foes = [], shots = [], drops = [], sparks = [], lv = null, boss = null, girl = null, star = null, girlIn = 500, stars = [];
  let P = { x: W / 2, cd: 0, safe: 0, wing: 0, dead: 0 };
  const keys = {}; let held = false, aim = null, lastX = 0;
  try { hi = +localStorage.getItem('owl-hi') || 0; } catch (e) {}
  const saveHi = () => { if (score > hi) { hi = score; try { localStorage.setItem('owl-hi', hi); } catch (e) {} } };
  const speed = () => 1 + night * .22;
  const go = s => { state = s; t = 0; };
  const hit = (a, b) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2;
  const burst = (x, y, n = 10) => { const h0 = rnd(360); for (let i = 0; i < n; i++) { const a = rnd(6.283), v = .4 + rnd(1.6); sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 18 + rnd(16), hue: h0 + i * 36 }); } };
  const kill = e => { foes.splice(foes.indexOf(e), 1); score += e.pts * (e.dive ? 2 : 1); burst(e.x, e.y); (sfx[e.kind] || sfx.pop)(e); };
  const ink = (x, y, vx, vy) => ({ kind: 'ink', x, y, vx, vy, w: 3, h: 5 });
  const die = () => { P.dead = 80; P.wing = 0; spare--; burst(P.x, H - 24, 26); shake = 14; sfx.die(); };

  // Night 1, Munich: moths hold a formation, peel off one by one and flutter down at the owl
  const mothStep = (m, sway) => {
    if (m.dive) {
      m.dt++; m.y += 1.3 * speed(); m.x += Math.sin(m.dt / 11) * 1.7 + clamp((P.x - m.x) * .012, -.7, .7);
      if (m.dt === m.fireAt && !P.dead) { drops.push(ink(m.x, m.y + 4, 0, 1.9)); sfx.plink(); }
      if (m.y > H + 10) { m.y = -14; m.dive = false; }
    } else { m.x += (m.sx + sway - m.x) * .07; m.y += (m.sy + Math.sin(frame / 23 + m.ph) * 2 - m.y) * .07; }
  };
  const sendMoth = () => { const home = foes.filter(m => m.kind === 'moth' && !m.dive && Math.abs(m.y - m.sy) < 6); if (home.length) { Object.assign(pick(home), { dive: true, dt: 0, fireAt: 24 + Math.floor(rnd(40)) }); sfx.dive(); } };
  const moth = (sx, sy, x, y) => ({ kind: 'moth', sx, sy, x, y, w: 11, h: 7, pts: 20, ph: rnd(6) });
  const moths = () => {
    for (let r = 0; r < (night ? 5 : 4); r++) for (let c = 0; c < 6; c++) foes.push(moth(28 + c * 24, 36 + r * 17, 28 + c * 24 + (c - 2.5) * 30, -20 - r * 26 - c * 8));
    let next = 150;
    return {
      update() { const sway = Math.sin(frame / 70) * 16; foes.forEach(m => mothStep(m, sway)); if (--next <= 0) { sendMoth(); next = (40 + foes.length * 4) / speed(); } },
      done: () => !foes.length,
    };
  };
  // Night 2, New York: bugs in the system. Rows scroll against each other, wrap round the screen, sink, and now and then glitch.
  // The pale-shelled ones in the two top rows take two hoots
  const bugs = () => {
    const WR = 200, total = 25, rows = [0, 1, 2, 3, 4].map(r => ({ off: r * 16, v: (r % 2 ? -1 : 1) * (.4 + r * .07), glitch: 0 }));
    let down = -120, fireIn = 110, glitchIn = 260;
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) foes.push({ kind: 'bug', r, c, x: -20, y: -20, w: 11, h: 8, hp: r < 2 ? 2 : 1, pts: r < 2 ? 50 : 30, hurt: 0 });
    return {
      update() {
        const k = speed() * (1 + (total - foes.length) / total * 1.2);
        rows.forEach(r => { r.off += r.v * k; if (r.glitch) r.glitch--; });
        down += down < 0 ? 1.6 : .03 * k;
        if (--glitchIn <= 0) { const r = pick(rows); r.v = -r.v; r.glitch = 24; glitchIn = 200 + rnd(160); sfx.glitch(); }
        foes.forEach(b => { const row = rows[b.r]; if (b.hurt) b.hurt--; b.x = ((b.c * 40 + row.off) % WR + WR) % WR - 12 + (row.glitch ? (frame % 4 < 2 ? 3 : -3) : 0); b.y = 34 + b.r * 15 + down; });
        if (--fireIn <= 0) { const b = pick(foes.filter(b => b.x > 6 && b.x < W - 6)); if (b && !P.dead) { drops.push({ kind: 'bit', x: b.x, y: b.y + 5, vx: 0, vy: 1.7 * speed(), w: 3, h: 4 }); sfx.plink(); } fireIn = (30 + foes.length * 1.4) / speed(); }
        if (foes.some(b => b.y > H - 40)) { down -= 80; sfx.through(); if (!P.dead && !P.safe) die(); }   // they got through
      },
      shot(b) { if (b.hp > 1) { b.hp--; b.hurt = 8; sfx.clink(); } else kill(b); },
      done: () => !foes.length,
    };
  };
  // Night 3, Tenerife: mushrooms sail down. Those that land throw their spores back up. The colours go for a walk
  const spores = () => {
    const quota = 30 + night * 6; let sent = 0, next = 30;
    return {
      update() {
        if (sent < quota && --next <= 0) { sent++; next = (48 - sent * .5) / speed(); foes.push({ kind: 'mush', x0: 22 + rnd(W - 44), x: -20, y: -8, vy: .42 + rnd(.3), ph: rnd(6), w: 11, h: 10, pts: 50, puff: rnd(1) < .4 ? 60 + rnd(H * .35) : 0 }); }
        for (const m of [...foes]) {
          m.y += m.vy * speed(); m.x = m.x0 + Math.sin(frame / 26 + m.ph) * 14;
          if (m.puff && m.y > m.puff) { m.puff = 0; drops.push({ kind: 'spore', x: m.x, y: m.y + 6, vx: 0, vy: 1.2, wav: rnd(60), w: 3, h: 3 }); }
          if (m.y > H - 17) { foes.splice(foes.indexOf(m), 1); burst(m.x, m.y, 6); sfx.land(); for (const vx of [-.8, 0, .8]) drops.push({ kind: 'spore', x: m.x, y: m.y - 4, vx, vy: -2.1, g: .05, w: 3, h: 3 }); }
        }
      },
      done: () => sent >= quota && !foes.length && !drops.length,
    };
  };
  // Night 4, Moscow: every doll has two smaller ones inside. Only the smallest come all the way down
  const dolls = () => {
    const SIZE = [{ art: 'dollL', w: 13, h: 18, pts: 30, floor: 74 }, { art: 'dollM', w: 9, h: 12, pts: 40, floor: 58 }, { art: 'dollS', w: 6, h: 8, pts: 60, floor: 18 }];
    const add = (x, y, vx, vy, size) => foes.push({ kind: 'doll', size, x, y, vx, vy, ...SIZE[size], drip: 120 + rnd(160), born: size ? 24 : 0 });
    const n = 3 + Math.min(night, 2);
    for (let i = 0; i < n; i++) add((i + .5) * W / n, -20 - i * 14, (i % 2 ? -1 : 1) * (.5 + rnd(.25)), .5 + rnd(.2), 0);
    return {
      update() {
        const k = speed();
        for (const d of foes) {
          d.x += d.vx * k; d.y += d.vy * k; if (d.born) d.born--;
          if ((d.x < 9 && d.vx < 0) || (d.x > W - 9 && d.vx > 0)) d.vx = -d.vx;
          if ((d.y < 24 && d.vy < 0) || (d.y > H - d.floor && d.vy > 0)) d.vy = -d.vy;
          if (d.size < 2 && --d.drip <= 0) { d.drip = 150 + rnd(170); if (!P.dead) { drops.push(ink(d.x, d.y + d.h / 2, 0, 1.6)); sfx.plink(); } }
        }
      },
      shot(d) { kill(d); if (d.size < 2) for (const s of [-1, 1]) add(d.x + s * 4, d.y, s * (Math.abs(d.vx) * 1.2 + .15), -Math.abs(d.vy) * 1.15, d.size + 1); },
      done: () => !foes.length,
    };
  };
  // Night 5, the skull: it swallowed the moon. Hoots only count while it yawns
  const skullBoss = () => {
    const B = boss = { x: W / 2, y: -40, hp: 24 + night * 6, t: 0, jaw: 0, flash: 0, dying: 0 }, full = B.hp;
    let waves = 0, eye = 1, next = 200;
    return {
      update() {
        if (B.dying) { if (++B.dying % 6 === 0 && B.dying < 130) { burst(B.x + rnd(60) - 30, B.y + rnd(60) - 30, 12); sfx.pop(); shake = 4; } return; }
        B.t++; if (B.flash) B.flash--;
        const k = speed() * (B.hp < full / 2 ? 1.25 : 1), c = B.t % 420;
        B.x = W / 2 + Math.sin(B.t / 95 * k) * 50; B.y += (62 + Math.sin(B.t / 50) * 5 - B.y) * .04;
        // one breath: shut, a tremble as a warning, a long yawn, shut again
        B.jaw = c < 250 ? (c > 205 && frame % 6 < 3 ? 1 : 0) : c < 270 ? (c - 250) * .4 : c < 395 ? 8 : (420 - c) * .32;
        if (c === 250) sfx.yawn();
        const top = B.y - 27;
        if (B.t > 90 && B.t % Math.round(84 / k) === 0 && !P.dead) {            // the eyes take turns
          eye = -eye; const ex = B.x + eye * 13, ey = top + 26, dx = P.x - ex, dy = H - 24 - ey, n = Math.hypot(dx, dy);
          drops.push(ink(ex, ey, dx / n * 1.7, dy / n * 1.7)); sfx.spit();
        }
        if (c === 110 && !P.dead) { sfx.teeth(); const gap = Math.floor(rnd(7)); for (let i = 0; i < 7; i++) if (i !== gap) drops.push({ kind: 'tooth', x: B.x + (i - 3) * 5, y: top + 56, vx: (i - 3) * .36, vy: 1.3, w: 5, h: 6 }); }
        if (waves < 2 && B.hp <= full * (2 - waves) / 3) { waves++; for (let i = 0; i < 4; i++) foes.push(moth(28 + i * 40, 122, B.x, B.y + 20)); }
        const sway = Math.sin(frame / 70) * 16; foes.forEach(m => mothStep(m, sway));
        if (--next <= 0) { sendMoth(); next = 110 / k; }
      },
      hoot(s) {
        if (B.dying) return;
        const dx = s.x - B.x, y = s.y - (B.y - 27);
        const inJaw = Math.abs(dx) < 15 && y > 44 && y < 63 + B.jaw, inDome = y <= 47 && (dx / 30) ** 2 + ((y - 23.5) / 23) ** 2 < 1;
        if (!inJaw && !inDome) return;
        s.gone = true;
        if (inJaw && B.jaw >= 4) {
          if (B.flash > 3) return;                                       // one hoot at a time counts, swallows or not
          B.hp--; B.flash = 10; score += 100; burst(s.x, s.y, 8); sfx.hurt(); shake = 5;
          if (B.hp <= 0) { sfx.boom(); B.dying = 1; score += 2000; foes.forEach(m => burst(m.x, m.y)); foes = []; drops = []; }
        } else { sfx.clink(); sparks.push({ x: s.x, y: s.y, vx: rnd(1) - .5, vy: 1, life: 8, hue: 220 }); }
      },
      done: () => B.dying > 170,
    };
  };
  const LEVELS = [
    { city: 'MUNICH', motif: [67, 72, 76, 79, 76, 79], lines: ['MOTHS ATE THE MOONLIGHT.'], sky: 'munich', skyX: 116, make: moths, bpm: 112 },
    { city: 'NEW YORK', motif: [69, 72, 75, 76, 79, 81], lines: ['BUGS IN THE SYSTEM.'], sky: 'nyc', skyX: 29, make: bugs, bpm: 116 },
    { city: 'TENERIFE', motif: [60, 62, 64, 66, 68, 70, 72], lines: ['SOMETHING IS IN THE AIR.'], sky: 'teide', skyX: 13, make: spores, bpm: 118 },
    { city: 'MOSCOW', motif: [69, 76, 72, 71, 69, 68, 69], lines: ['DOLLS WITHIN DOLLS.'], sky: 'moscow', skyX: 8, make: dolls, bpm: 122 },
    { city: 'THE SKULL', motif: [45, 0, 45, 46, 0, 45, 51, 50], lines: ['IT SWALLOWED THE MOON.', 'HOOT WHEN IT YAWNS.'], make: skullBoss, bpm: 128 },
  ];
  const SKY = {};
  LEVELS.forEach(l => { if (l.sky) { SKY[l.sky] = new Image(); SKY[l.sky].src = 'assets/game/' + l.sky + '.png'; } });

  // Flow
  const begin = () => { go('intro'); foes = []; shots = []; drops = []; boss = null; girl = null; star = null; girlIn = 420; lv = null; P.cd = 0; P.safe = 0; P.dead = 0; sfx.night(level); };
  const newGame = () => { const jump = +location.hash.slice(1); score = 0; spare = 2; night = 0; level = jump >= 1 && jump <= 5 ? jump - 1 : 0; P = { x: W / 2, cd: 0, safe: 0, wing: 0, dead: 0 }; begin(); };
  const movePlayer = () => {
    const l = keys.ArrowLeft || keys.a, r = keys.ArrowRight || keys.d;
    if (l || r) { aim = null; P.x += ((r ? 1 : 0) - (l ? 1 : 0)) * 2.2; } else if (aim !== null) P.x += clamp(aim - P.x, -3.5, 3.5);
    P.x = clamp(P.x, 10, W - 10);
  };
  const fire = () => {
    if (P.cd > 0) P.cd--;
    if (!(keys[' '] || keys.ArrowUp || keys.w || held) || P.cd > 0 || shots.length >= (P.wing ? 9 : 3)) return;
    const y = H - 32; shots.push({ x: P.x, y, w: 5, h: 5 });
    if (P.wing) shots.push({ x: P.x - 15, y: y + 6, w: 5, h: 5 }, { x: P.x + 15, y: y + 6, w: 5, h: 5 });
    P.cd = 13; sfx.hoot();
  };
  const play = () => {
    const Py = H - 24;
    if (P.dead) { if (--P.dead === 0) { if (spare < 0) { saveHi(); sfx.over(); return go('over'); } P.x = W / 2; P.safe = 130; aim = null; } } else { movePlayer(); fire(); }
    if (P.safe) P.safe--;
    if (P.wing && --P.wing === 110) sfx.fade();
    shots.forEach(s => { s.y -= 4.6; if (s.y < -6) s.gone = true; });
    lv.update();
    drops.forEach(d => { d.vy += d.g || 0; d.x += d.vx + (d.wav ? Math.sin((frame + d.wav) / 9) * .6 : 0); d.y += d.vy; if (d.y > H + 8 || d.y < -60 || d.x < -8 || d.x > W + 8) d.gone = true; });
    for (const s of shots) {
      if (s.gone) continue;
      const e = foes.find(e => hit(s, e));
      if (e) { s.gone = true; lv.shot ? lv.shot(e) : kill(e); continue; }
      const d = drops.find(d => d.kind === 'tooth' && !d.gone && hit(s, d));
      if (d) { s.gone = d.gone = true; score += 10; burst(d.x, d.y, 4); sfx.clink(); continue; }
      if (lv.hoot) lv.hoot(s);
    }
    shots = shots.filter(s => !s.gone); drops = drops.filter(d => !d.gone);
    if (!P.dead && !P.safe) { const me = { x: P.x, y: Py, w: 9, h: 7 }; if (foes.some(e => !e.born && hit(me, e)) || drops.some(d => hit(me, d))) die(); }
    // the flying girl crosses now and then and lets a star fall: catch it and two swallows join in
    if (!girl && --girlIn <= 0) girl = { x: -10, at: 40 + rnd(W - 80), gave: false };
    if (girl) { girl.x += .85; if (!girl.gave && girl.x >= girl.at) { girl.gave = true; star = { x: girl.x, y: 30, w: 7, h: 7 }; sfx.girl(); } if (girl.x > W + 12) { girl = null; girlIn = 700 + rnd(300); } }
    if (star) { star.y += .8; if (!P.dead && hit(star, { x: P.x, y: Py, w: 15, h: 12 })) { P.wing = 720; score += 250; sfx.star(); star = null; } else if (star.y > H) star = null; }
    if (lv.done()) { go('clear'); drops = []; score += 500; if (spare < 4) spare++; sfx.clear(); }
  };
  const tick = () => {
    frame++; t++;
    if (shake) shake--;
    sparks = sparks.filter(s => { s.x += s.vx; s.y += s.vy; s.vy += .03; return --s.life > 0; });
    if (state === 'intro') { movePlayer(); if (t > 150) { lv = LEVELS[level].make(); go('play'); } }
    else if (state === 'play') play();
    else if (state === 'clear') { movePlayer(); shots = shots.filter(s => (s.y -= 4.6) > -6); if (t > 140) { if (++level === 5) { level = 4; saveHi(); go('win'); sfx.win(); } else begin(); } }
    music();
  };

  // Drawing
  const pad = n => String(n).padStart(6, '0');
  const render = () => {
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
    if (shake && !calm) g.translate(Math.round(rnd(4) - 2), Math.round(rnd(4) - 2));
    const hue = Math.floor(frame / 8) * 30 % 360, Py = H - 24, L = LEVELS[level], mid = Math.round(H / 2);
    g.fillStyle = INK; stars.forEach((s, i) => { if ((frame + i * 37) % 170 > 26) g.fillRect(s[0], s[1], 1, 1); });
    if (state === 'title') {
      const o = Math.floor((H - 230) / 2), owl = paint(frame % 40 < 20 ? 'owl1' : 'owl2');
      moon(W / 2, o + 18, 10, 0);
      text('OWL NIGHT', W / 2, o + 36, 4, DEEP); text('LONG', W / 2, o + 60, 4, DEEP); text('A GAME HIDDEN IN A SKULL', W / 2, o + 88);
      g.drawImage(owl, Math.round(W / 2 - 25.5), o + 100 + (frame % 40 < 20 ? 0 : 2), 51, 36);
      text('THE MOON IS GONE.', W / 2, o + 146, 1, DEEP); text('ONE OWL GOES LOOKING FOR IT', W / 2, o + 156); text('IN THE FOUR CITIES OF A LIFE.', W / 2, o + 166);
      if (frame % 60 < 40) text(touch ? 'TAP TO START' : 'PRESS SPACE OR CLICK', W / 2, o + 182, 2, DEEP);
      text(touch ? 'DRAG TO FLY. HOLD TO HOOT.' : 'ARROWS FLY. SPACE HOOTS.', W / 2, o + 200);
      if (hi) text('BEST ' + pad(hi), W / 2, o + 212);
      return;
    }
    // the city of the night, pale, and the ground
    const sky = SKY[L.sky];
    if (sky && sky.complete && sky.naturalWidth) { g.globalAlpha = .3; g.drawImage(sky, L.skyX, H - 9 - sky.naturalHeight); g.globalAlpha = 1; }
    g.fillStyle = INK; for (let x = 0; x < W; x += 2) g.fillRect(x, H - 9, 1, 1);
    if (girl) draw('girl', girl.x, 22 + Math.sin(frame / 14) * 2);
    for (const e of foes) {
      if (e.born && frame % 4 < 2) continue;
      if (e.kind === 'moth') draw(Math.floor(frame / (e.dive ? 4 : 9) + e.ph) % 2 ? 'moth1' : 'moth2', e.x, e.y);
      else if (e.kind === 'bug') draw((e.hp > 1 ? 'shell' : 'bug') + (Math.floor(frame / 16 + e.r) % 2 + 1), e.x, e.y, e.hurt ? 'hit' : '');
      else if (e.kind === 'mush') draw('mush', e.x, e.y);
      else draw(e.art, e.x, e.y + Math.sin(frame / 9 + e.x / 20));
    }
    if (boss && boss.dying < 130) {
      const x = Math.round(boss.x), top = Math.round(boss.y - 27), mode = boss.flash || (boss.dying && frame % 6 < 3) ? 'hit' : '', jaw = Math.round(boss.jaw);
      if (jaw) { g.fillStyle = DEEP; g.fillRect(x - 13, top + 53, 26, jaw + 2); }
      if (jaw >= 4) draw('shard', x, top + 54 + jaw / 2, hue);
      draw('jaw', x, top + 58.5 + jaw, mode); draw('skull', x, top + 27, mode);
      draw(jaw >= 4 ? 'bloom' : 'bud', x, top - 1, hue);
    }
    for (const d of drops) draw(d.kind, d.x, d.y, d.kind === 'spore' ? hue : '');
    for (const s of shots) draw('hoot', s.x, s.y);
    if (star) draw('star', star.x, star.y, hue);
    if (!P.dead && !(P.safe && frame % 6 < 3)) {
      const flap = frame % 20 < 10;
      draw(flap ? 'owl1' : 'owl2', P.x, Py);
      if (P.wing && (P.wing > 120 || frame % 8 < 4)) { draw(flap ? 'swallow1' : 'swallow2', P.x - 15, Py + 3); draw(flap ? 'swallow2' : 'swallow1', P.x + 15, Py + 3); }
    }
    for (const s of sparks) { g.fillStyle = `hsl(${s.hue % 360} 85% 55%)`; g.fillRect(Math.round(s.x), Math.round(s.y), s.life > 10 ? 2 : 1, s.life > 10 ? 2 : 1); }
    g.setTransform(1, 0, 0, 1, 0, 0);
    // score, best, spare owls, and the moon as it comes back
    text(pad(score), 5, 5, 1, DEEP, 'l'); if (hi) text('BEST ' + pad(Math.max(hi, score)), W / 2, 5);
    const back = state === 'win' ? 5 : level + (state === 'clear' ? Math.min(1, t / 60) : 0);
    moon(W - 10, 9, 5, back / 5);
    for (let i = 0; i < spare; i++) draw('life', W - 24 - i * 9, 7);
    const card = (h) => { g.fillStyle = 'rgba(214, 217, 214, .86)'; g.fillRect(0, mid - h / 2, W, h); g.fillStyle = INK; g.fillRect(0, mid - h / 2, W, 1); g.fillRect(0, mid + h / 2 - 1, W, 1); };
    const again = touch ? 'TAP' : 'PRESS SPACE';
    if (paused) { card(46); text('PAUSED', W / 2, mid - 12, 3, DEEP); text(again + ' TO GO ON', W / 2, mid + 10); }
    else if (state === 'intro') { text('NIGHT ' + (night * 5 + level + 1), W / 2, mid - 34); text(L.city, W / 2, mid - 22, 3, DEEP); L.lines.forEach((l, i) => text(l, W / 2, mid + 2 + i * 10)); }
    else if (state === 'clear') { text(level === 4 ? 'THE MOON IS FREE' : 'A PIECE OF THE MOON IS BACK', W / 2, mid - 10, level === 4 ? 2 : 1, DEEP); }
    else if (state === 'over') { card(74); text('GAME OVER', W / 2, mid - 26, 3, DEEP); text('THE MOON STAYS DARK TONIGHT.', W / 2, mid - 2); text('SCORE ' + pad(score), W / 2, mid + 10, 1, DEEP); if (t > 50 && frame % 60 < 40) text(again, W / 2, mid + 24); }
    else if (state === 'win') {
      const o = Math.floor((H - 230) / 2);
      moon(W / 2, o + 34, 14, 1); draw('owl1', W / 2, o + 62 + Math.sin(frame / 20) * 2);
      text('THE MOON IS BACK', W / 2, o + 78, 2, DEEP);
      text('THE SKULL GAVE IT UP AND KEPT', W / 2, o + 98); text('THE OWL, THE MOON AND FOUR CITIES.', W / 2, o + 108); text('THAT IS THE PICTURE YOU CAME FROM.', W / 2, o + 118);
      text('NOW GO DANCE.', W / 2, o + 134, 2, DEEP); text('SCORE ' + pad(score), W / 2, o + 154, 1, DEEP);
      if (t > 90 && frame % 60 < 40) text(again + ' FOR MORE NIGHTS', W / 2, o + 168);
    }
  };

  // Size: whole pixels where the screen allows, and a taller field on phones
  const hint = document.getElementById('keys'), pauseBtn = document.getElementById('pause');
  let sized = false;
  const fit = () => {
    const box = cv.parentElement, cs = getComputedStyle(box);
    const aw = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const ah = box.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - (hint ? hint.offsetHeight + 12 : 0);
    let s = Math.min(aw / W, ah / 230); if (s >= 2) s = Math.floor(s);
    S = Math.max(.5, s); const h = clamp(Math.floor(ah / S), 230, 340);
    if (!sized || h !== H) { sized = true; H = h; cv.width = W; cv.height = H; g = cv.getContext('2d'); g.imageSmoothingEnabled = false; stars = [...Array(26)].map(() => [Math.floor(rnd(W)), 16 + Math.floor(rnd(H - 60))]); }
    cv.style.width = W * S + 'px'; cv.style.height = H * S + 'px';
  };
  addEventListener('resize', fit); fit();

  // Controls
  const setPause = v => { if (paused !== (v && state === 'play')) sfx.pause(); paused = v && state === 'play'; if (pauseBtn) pauseBtn.textContent = paused ? 'Go on' : 'Pause'; };
  const startKey = () => {
    audio();
    if (paused) return setPause(false);
    if (state === 'title') { sfx.start(); return newGame(); }
    if (state === 'over' && t > 50) return go('title');
    if (state === 'win' && t > 90) { night++; level = 0; begin(); }
  };
  addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key, onControl = e.target instanceof Element && e.target.closest('button, a');
    if ([' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(k) && !onControl) e.preventDefault();
    if (e.repeat || (onControl && (k === ' ' || k === 'Enter'))) return;
    keys[k] = true;
    if (k === ' ' || k === 'Enter') startKey();
    if (k === 'p' || k === 'Escape') setPause(!paused);
    if (k === 'm') setMuted(!muted);
  });
  addEventListener('keyup', e => { keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = false; });
  const lx = e => (e.clientX - cv.getBoundingClientRect().left) / S;
  cv.addEventListener('pointerdown', e => {
    e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    startKey(); held = true; lastX = e.clientX; if (e.pointerType === 'mouse') aim = lx(e);
  });
  cv.addEventListener('pointermove', e => {
    if (e.pointerType === 'mouse') aim = lx(e);
    else if (held && !P.dead && !paused && state !== 'title') { P.x = clamp(P.x + (e.clientX - lastX) / S * 1.3, 10, W - 10); lastX = e.clientX; }
  });
  ['pointerup', 'pointercancel'].forEach(n => cv.addEventListener(n, () => { held = false; }));
  cv.addEventListener('contextmenu', e => e.preventDefault());
  if (pauseBtn) pauseBtn.addEventListener('click', () => { setPause(!paused); pauseBtn.blur(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) setPause(true); });
  addEventListener('blur', () => { setPause(true); for (const k in keys) keys[k] = false; held = false; });
  const burger = document.getElementById('burger'); if (burger) burger.addEventListener('click', () => setPause(true));
  const keysText = document.getElementById('keys-text');
  if (keysText) keysText.textContent = touch ? 'Drag to fly · hold to hoot' : 'Arrows or A/D fly · Space hoots';

  // Sound switch in the top bar, same look as on the start page
  const tools = document.querySelector('.bar .tools');
  let soundBtn = null; const sndBtn = document.getElementById('snd');
  if (sndBtn) sndBtn.addEventListener('click', () => { setMuted(!muted); sndBtn.blur(); });
  const setMuted = (v, keep = true) => {
    muted = v; if (keep) { try { localStorage.setItem('owl-sound', muted ? 'off' : 'on'); } catch (e) {} audio(); }
    if (out) out.gain.value = muted ? 0 : LOUD;
    if (soundBtn) { soundBtn.classList.toggle('playing', !muted); soundBtn.classList.toggle('muted', muted); soundBtn.setAttribute('aria-pressed', !muted); soundBtn.setAttribute('aria-label', muted ? 'Play sound' : 'Mute sound'); }
    if (sndBtn) sndBtn.textContent = muted ? 'Sound off' : 'Sound on';
  };
  if (tools) {
    tools.insertAdjacentHTML('afterbegin', '<button class="audio" id="gsound" type="button"><i></i><i></i><i></i><i></i></button>');
    soundBtn = document.getElementById('gsound'); soundBtn.addEventListener('click', () => { setMuted(!muted); soundBtn.blur(); });
    setMuted(muted, false);
  }

  // Sixty steps a second whatever the screen does; the colours wander through Tenerife, as they do on the skull
  let last = 0, acc = 0;
  const loop = now => {
    requestAnimationFrame(loop);
    const d = Math.min(100, now - last); last = now;
    if (!paused && !document.hidden) { acc += d; while (acc >= 16.667) { tick(); acc -= 16.667; } }
    render();
    const trip = level === 2 && (state === 'intro' || state === 'play' || state === 'clear') ? `hue-rotate(${Math.round(frame * (calm ? .3 : 1.1)) % 360}deg) saturate(1.7)` : '';
    if (cv.style.filter !== trip) cv.style.filter = trip;
  };
  requestAnimationFrame(loop);
})();
