// "Was soll das werden?" – a hidden hovering game in the bio. Whoever catches the Alouette in mid-flight gets Chris's first
// flying lesson: hold a helicopter still over a meadow while a flight instructor shouts. A deliberately simplified game of
// skill, not a flight simulation. Loaded by js/bio.js only when the helicopter is caught; draws everything itself (prototype
// graphics in the site's ink on paper), needs no images and no sound files to work.
(() => {
  if (window.flightLesson) return;
  const FT = 3.2808, G = 9.81, rad = d => d * Math.PI / 180, clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // Everything that tunes the feel of the game lives here. None of it claims to be real Alouette II performance
  const CFG = {
    alt: 150 / FT, climbTo: 170 / FT,             // hover height and the height of the climb task, in metres
    tilt: rad(13), lag: .45,                      // full stick = this much bank or pitch; seconds the attitude takes to follow
    drag: .15,                                    // 1/s: how strongly the air slows the helicopter (and how the wind pushes it)
    lift: 12, sink: .6, c0: .5,                   // collective: m/s² per unit above the hover setting, vertical damping, hover setting
    pedal: .9, yawDamp: 1, torque: 1,             // pedals rad/s² at full deflection, yaw damping, yaw pull per unit of collective
    gust: { wind: 7, secs: 6, yaw: .03, warn: 2.2 },   // one gust from the left: m/s at its peak, length, yaw kick per m/s, warning time
    breeze: 1.5,                                  // m/s of slow, light air movement all the time, so that doing nothing is not enough
    ok: { pos: 9, hdg: rad(15), alt: 12 / FT },   // "stable" means inside all three
    lost: { pos: 32, hdg: rad(75), alt: 45 / FT, secs: 2.5, floor: 8 },   // beyond these for `secs` (or below `floor` m) the instructor takes over
    hold: { tutorial: 4, hover: 8, gust: 5, climb: 3, back: 4 },          // seconds of stable flight each task asks for
    decay: .5,                                    // progress lost per second while unstable
    shout: { gap: 6.5, far: 14, shaky: 5, swings: 3, swingWindow: 2.6 },  // instructor: pause between remarks and what sets him off
    stick: 3.2, collective: .28,                  // keyboard: how fast stick and pedals deflect (1/s), collective change per second
    step: 1 / 120,
  };

  const QUOTES = [                                // Chris's instructor, word for word. Never reworded
    ['„Was machen Sie denn? Bringen Sie das Ding unter Kontrolle!“', 'What are you doing? Get that thing under control!'],
    ['„Oh jeh! Das wird nichts, so werden Sie nie Pilot“', 'Oh dear! This is going nowhere. You will never be a pilot like this.'],
    ['„Was soll das werden?“', 'What is that supposed to be?'],
  ];
  const SAY = {                                   // the instructor's other lines, from the concept
    help: ['„Ich helfe noch.“', 'I am still helping.'], hold: ['„Halten Sie die Position.“', 'Hold your position.'],
    gust: ['„Was machen Sie denn?“', 'What are you doing?'], climb: ['„Höher. Und wieder zurück.“', 'Higher. And back down again.'],
    done: ['„Na gut. Für heute reicht’s.“', 'All right. That will do for today.'], mine: ['„Ich habe die Steuerung!“', 'I have control!'],
    invite: ['„Sie wollten doch Pilot werden.“', 'You wanted to be a pilot, didn’t you.'],
  };
  const TEXT = {
    de: { sub: 'Meine erste Flugstunde. Jetzt Ihre.', intro: 'Halten Sie die Alouette über der Wiese: Position, Richtung, Höhe. Jede zu große Korrektur verlangt die nächste.',
      note: 'Vereinfachtes Geschicklichkeitsspiel, keine Flugsimulation für Ausbildungszwecke.', motion: 'Die Sicht aus dem Cockpit bewegt sich stark.',
      touch: 'Rechter Daumen: Steuerknüppel, er neigt die Maschine. Linker Daumen: hoch und runter für die Höhe (Collective), links und rechts für die Richtung (Pedale).',
      keys: 'Pfeiltasten oder Maus im rechten Feld: Steuerknüppel. A und D: Pedale. W und S: Collective. Leertaste: Pause.',
      start: 'Flugstunde beginnen', skip: 'Einweisung überspringen', again: 'Noch einmal', close: 'Schließen', resume: 'Weiter', paused: 'Pause', pause: 'Pause',
      soundOn: 'Ton an', soundOff: 'Ton aus', stick: 'Knüppel', left: 'Höhe · Pedale',
      tasks: { a: 'Nur der Steuerknüppel. Bleiben Sie über dem Platz.', b: 'Jetzt die Pedale dazu. Halten Sie die Nase zur Bahn.', c: 'Und das Collective. Halten Sie 150 ft.',
        hover: '150 ft, Nase zur Bahn. Acht Sekunden ruhig.', warn: 'Böe von links', gust: 'Fangen Sie die Maschine wieder ein.', climb: 'Steigen Sie auf 170 ft und halten Sie.', back: 'Zurück auf 150 ft. Position und Richtung halten.' },
      alt: 'Höhe', vs: 'Steigen', hdg: 'Richtung', map: 'Position',
      passed: 'Flugstunde bestanden', taken: 'Vom Lehrer übernommen', stable: 'Stabile Schwebezeit', longest: 'Längste ruhige Phase', far: 'Größte Abweichung', climbed: 'Höhenaufgabe', yes: 'geschafft', no: 'nicht geschafft', best: 'Bisher beste ruhige Phase', s: 's', m: 'm' },
    en: { sub: 'My first flying lesson. Now yours.', intro: 'Hold the Alouette over the meadow: position, heading, height. Every correction that is too big calls for the next one.',
      note: 'A simplified game of skill, not a flight simulation for training.', motion: 'The view from the cockpit moves a lot.',
      touch: 'Right thumb: the stick, it tilts the helicopter. Left thumb: up and down for height (collective), left and right for heading (pedals).',
      keys: 'Arrow keys or the mouse in the right-hand field: stick. A and D: pedals. W and S: collective. Space: pause.',
      start: 'Start the lesson', skip: 'Skip the briefing', again: 'Once more', close: 'Close', resume: 'Continue', paused: 'Paused', pause: 'Pause',
      soundOn: 'Sound on', soundOff: 'Sound off', stick: 'Stick', left: 'Height · Pedals',
      tasks: { a: 'The stick only. Stay over the field.', b: 'Now the pedals as well. Keep the nose on the runway.', c: 'And the collective. Hold 150 ft.',
        hover: '150 ft, nose on the runway. Eight calm seconds.', warn: 'Gust from the left', gust: 'Catch the helicopter again.', climb: 'Climb to 170 ft and hold.', back: 'Back to 150 ft. Hold position and heading.' },
      alt: 'Height', vs: 'Climb', hdg: 'Heading', map: 'Position',
      passed: 'Lesson passed', taken: 'Taken over by the instructor', stable: 'Stable hover time', longest: 'Longest calm spell', far: 'Furthest off', climbed: 'Climb task', yes: 'done', no: 'not done', best: 'Best calm spell so far', s: 's', m: 'm' },
  };
  const store = { get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  let lang = store.get('flight-lang') || ((navigator.language || 'en').toLowerCase().startsWith('de') ? 'de' : 'en');
  const t = () => TEXT[lang], line = pair => lang === 'de' ? pair[0] : `${pair[0]}<small>${pair[1]}</small>`;

  // ---- the scenery, in metres. x: right, y: ahead, z: up. An artistic Munich, not a real airfield
  const rnd = (seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647)(7);
  const TUFTS = Array.from({ length: 520 }, () => [(rnd() - .5) * 340, -30 + rnd() * 152, .5 + rnd() * .9]);
  const ridge = (x0, x1, n, lo, hi) => Array.from({ length: n + 1 }, (_, i) => [x0 + (x1 - x0) * i / n, lo + (hi - lo) * (.35 + .65 * rnd()) * (.6 + .4 * Math.sin(i * 1.7))]);
  const WOOD = [ridge(-1700, 1700, 150, 12, 26), ridge(-1900, 1900, 120, 16, 30)], PEAKS = [ridge(-46000, 46000, 46, 700, 2700), ridge(-46000, 46000, 60, 400, 1500)];
  const TOWN = ridge(-1500, 1500, 90, 25, 95);
  const SKY = 3600, K = 1.5;                      // the skyline stands 3.6 km off and is drawn one and a half times life size so it can be recognised

  // ---- state
  const S = { x: 0, y: 0, z: CFG.alt, vx: 0, vy: 0, vz: 0, yaw: 0, r: 0, roll: 0, pitch: 0, c: CFG.c0, wind: 0, t: 0 };
  const IN = { sx: 0, sy: 0, ped: 0, c: CFG.c0 };                         // what the pilot asks for: stick right, stick forward, right pedal, collective
  const keys = new Set();
  let phase = 'idle', step = '', progress = 0, need = 1, target = CFG.alt, clock = 0, paused = false, open = false, raf = 0, last = 0, acc = 0;
  let score, shoutAt = -99, lastShout = -1, shaky = 0, lostFor = 0, swings = [], prevStick = [0, 0], auto = 0, sub = 0;
  let el, cv, g, W = 0, H = 0, F = 0, dpr = 1, ui = {}, trigger = null, sound = null, soundOn = store.get('flight-sound') !== false, debug = false, fps = 0;

  const fresh = () => Object.assign(S, { x: 0, y: 0, z: CFG.alt, vx: 0, vy: 0, vz: 0, yaw: 0, r: 0, roll: 0, pitch: 0, c: CFG.c0, wind: 0, t: 0 });
  const errors = () => ({ pos: Math.hypot(S.x, S.y), hdg: Math.abs(S.yaw), alt: Math.abs(S.z - target) });
  const stable = e => e.pos < CFG.ok.pos && e.hdg < CFG.ok.hdg && e.alt < CFG.ok.alt;

  // ---- flight model: attitude follows the stick with a lag, tilt gives acceleration, the air drags, collective lifts and twists
  const fly = dt => {
    const help = phase === 'tutorial' ? step : '', mine = phase === 'takeover';
    let sx = IN.sx, sy = IN.sy, ped = IN.ped, c = IN.c;
    if (mine) {                                   // "Ich habe die Steuerung!": a calm hand brings everything back
      const fw = Math.sin(S.yaw) * S.x + Math.cos(S.yaw) * S.y, rt = Math.cos(S.yaw) * S.x - Math.sin(S.yaw) * S.y;
      const vf = Math.sin(S.yaw) * S.vx + Math.cos(S.yaw) * S.vy, vr = Math.cos(S.yaw) * S.vx - Math.sin(S.yaw) * S.vy;
      sx = clamp(-.05 * rt - .32 * vr, -.8, .8); sy = clamp(-.05 * fw - .32 * vf, -.8, .8); ped = clamp(-1.6 * S.yaw - 1.4 * S.r, -1, 1);
      c = clamp(CFG.c0 + .03 * (CFG.alt - S.z) - .06 * S.vz, 0, 1); IN.c = c;
    }
    const k = Math.min(1, dt / CFG.lag);
    S.roll += (sx * CFG.tilt - S.roll) * k; S.pitch += (-sy * CFG.tilt - S.pitch) * k;
    const right = G * Math.tan(S.roll), ahead = -G * Math.tan(S.pitch), drag = CFG.drag * (help === 'a' || help === 'b' ? 2.2 : help === 'c' ? 1.5 : 1);
    S.vx += (right * Math.cos(S.yaw) + ahead * Math.sin(S.yaw) + drag * (S.wind - S.vx)) * dt;
    S.vy += (-right * Math.sin(S.yaw) + ahead * Math.cos(S.yaw) - drag * S.vy) * dt;
    S.x += S.vx * dt; S.y += S.vy * dt;
    if (help === 'a' || help === 'b') { S.vz += (1.2 * (target - S.z) - 2 * S.vz) * dt; IN.c = S.c = CFG.c0; }       // height held for the beginner
    else { S.c = c; S.vz += (CFG.lift * (c - CFG.c0) - CFG.sink * (help === 'c' ? 1.6 : 1) * S.vz - G * (1 - Math.cos(S.roll) * Math.cos(S.pitch))) * dt; }
    S.z = Math.max(1.5, S.z + S.vz * dt); if (S.z <= 1.5) S.vz = Math.max(0, S.vz);
    if (help === 'a') S.r += (-2.5 * S.yaw - 2.4 * S.r) * dt;                                                           // heading held too
    else S.r += (CFG.pedal * ped - CFG.torque * (S.c - CFG.c0) + (help === 'b' ? -.1 : 0) + CFG.gust.yaw * S.wind - CFG.yawDamp * S.r) * dt;
    S.yaw += S.r * dt; if (S.yaw > Math.PI) S.yaw -= 2 * Math.PI; if (S.yaw < -Math.PI) S.yaw += 2 * Math.PI;
    S.t += dt;
  };

  // ---- the lesson: phases, progress, the instructor
  const say = (pair, hold = 4) => { ui.say.innerHTML = line(pair); ui.say.classList.add('on'); sub = S.t + hold; };
  const shout = n => { if (S.t - shoutAt < CFG.shout.gap || n === lastShout) return; shoutAt = S.t; lastShout = n; say(QUOTES[n], 4.5); ui.say.classList.add('loud'); };
  const task = (text, sayPair) => { ui.task.textContent = text; if (sayPair) { say(sayPair, 3.5); ui.say.classList.remove('loud'); } };
  const go = (p, st = '') => {
    phase = p; step = st; progress = 0; clock = 0; lostFor = 0; shaky = 0; if (p === 'takeover' || p === 'success') S.wind = 0;
    const T = t().tasks;
    if (p === 'tutorial') { need = CFG.hold.tutorial; target = CFG.alt; task(T[st], st === 'a' ? SAY.help : null); }
    if (p === 'hover') { need = CFG.hold.hover; target = CFG.alt; task(T.hover, SAY.hold); }
    if (p === 'gust') { need = CFG.hold.gust; task(T.warn); }
    if (p === 'climb') { need = CFG.hold.climb; target = CFG.climbTo; task(T.climb, SAY.climb); }
    if (p === 'back') { need = CFG.hold.back; target = CFG.alt; task(T.back); }
    if (p === 'takeover') { task(''); say(SAY.mine, 5); ui.say.classList.add('loud'); auto = S.t; }
    if (p === 'success') { task(''); say(SAY.done, 5); ui.say.classList.remove('loud'); auto = S.t; score.passed = true; }
    ui.bar.style.transform = 'scaleX(0)';
  };
  const lesson = dt => {
    if (phase === 'idle' || phase === 'result') return;
    if (phase === 'takeover' || phase === 'success') { if (S.t - auto > (phase === 'success' ? 3.2 : 5)) result(); return; }
    clock += dt;
    const air = CFG.breeze * (Math.sin(.9 * S.t + 1) + .6 * Math.sin(.37 * S.t + 2.1)) / 1.6 * (phase === 'tutorial' ? .6 : 1);   // always the same, so every attempt is alike
    const e = errors(), calm = stable(e), scored = phase !== 'tutorial';
    if (phase === 'gust') {                       // one gust from the left, the same every time: announced, swelling, fading
      const u = (clock - CFG.gust.warn) / CFG.gust.secs;
      S.wind = air + (u > 0 && u < 1 ? CFG.gust.wind * Math.sin(Math.PI * u) ** 2 : 0);
      if (u > 0 && ui.task.textContent === t().tasks.warn) task(t().tasks.gust, SAY.gust);
      if (u < .55) { progress = 0; }              // steadiness only counts once the gust has shown its hand
    } else S.wind = air;
    const fine = phase === 'tutorial' ? (step === 'a' ? e.pos < CFG.ok.pos * 1.3 : step === 'b' ? e.pos < CFG.ok.pos * 1.6 && e.hdg < CFG.ok.hdg : calm)
      : phase === 'climb' ? e.alt < CFG.ok.alt && e.pos < CFG.ok.pos * 1.6 && e.hdg < CFG.ok.hdg * 1.5 : calm;
    progress = clamp(progress + (fine ? dt : -CFG.decay * dt), 0, need);
    ui.bar.style.transform = `scaleX(${(progress / need).toFixed(3)})`;
    if (scored) {
      if (calm) { score.stable += dt; score.run += dt; score.longest = Math.max(score.longest, score.run); } else score.run = 0;
      score.far = Math.max(score.far, e.pos);
      // the instructor reacts to what is happening, never to a timer
      shaky = calm ? 0 : shaky + dt;
      [IN.sx, IN.sy].forEach((v, i) => { if (Math.abs(v) > .6 && Math.sign(v) !== prevStick[i]) { if (prevStick[i]) swings.push(S.t); prevStick[i] = Math.sign(v); } });   // a hard throw of the stick from one side to the other
      swings = swings.filter(s => S.t - s < CFG.shout.swingWindow);
      if (swings.length >= CFG.shout.swings) { shout(2); swings = []; } else if (shaky > CFG.shout.shaky) { shout(1); shaky = 0; } else if (e.pos > CFG.shout.far && S.t - shoutAt > CFG.shout.gap) shout(0);
      const gone = e.pos > CFG.lost.pos || e.hdg > CFG.lost.hdg || e.alt > CFG.lost.alt;
      lostFor = gone ? lostFor + dt : 0;
      if (lostFor > CFG.lost.secs || S.z < CFG.lost.floor) return go('takeover');
    } else if (e.pos > 40 || e.hdg > rad(100) || S.z < CFG.lost.floor || S.z > CFG.alt * 2) { Object.assign(S, { x: 0, y: 0, vx: 0, vy: 0, z: CFG.alt, vz: 0, yaw: 0, r: 0 }); say(SAY.help, 3); }   // in the briefing he simply puts it back
    if (progress >= need) {
      if (phase === 'tutorial') return step === 'a' ? go('tutorial', 'b') : step === 'b' ? go('tutorial', 'c') : (store.set('flight-briefed', true), go('hover'));
      if (phase === 'hover') return go('gust');
      if (phase === 'gust') return go('climb');
      if (phase === 'climb') { score.climbed = true; return go('back'); }
      if (phase === 'back') return go('success');
    }
  };

  // ---- drawing. The cockpit is the fixed frame; the world moves as the helicopter does
  const INK = '18, 38, 95', LOOK = rad(-11);     // the pilot's eyes rest a little below the horizon
  let cs, sn, ca, sa;
  const P = (x, y, z) => {                        // world point to screen (relative to the centre, before roll); null when behind
    const dx = x - S.x, dy = y - S.y, dz = z - S.z, xr = dx * cs - dy * sn, yr = dx * sn + dy * cs, d = yr * ca + dz * sa;
    return d < 1.5 ? null : [xr / d * F, -(-yr * sa + dz * ca) / d * F, d];
  };
  const path = (pts, close) => { let on = false; g.beginPath(); for (const p of pts) { if (!p) { if (close) return false; on = false; continue; } on ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); on = true; } if (close) g.closePath(); return true; };
  const ink = (a, w) => { g.strokeStyle = `rgba(${INK}, ${a})`; g.lineWidth = w * dpr; };
  const wash = a => { g.fillStyle = `rgba(31, 63, 151, ${a})`; };
  const wall = (pts, y, fill, a = .8, w = 1) => { if (path(pts.map(([x, z]) => P(x, y, z)), true)) { if (fill) { wash(fill); g.fill(); } ink(a, w); g.stroke(); } };
  const band = (top, y, fill, a) => { const pts = top.map(([x, z]) => P(x, y, z)); if (pts.some(p => !p)) return; const lo = [P(top[top.length - 1][0], y, 0), P(top[0][0], y, 0)]; if (lo.some(p => !p)) return; path([...pts, ...lo], true); wash(fill); g.fill(); path(pts); ink(a, 1); g.stroke(); };
  const draw = () => {
    cs = Math.cos(S.yaw); sn = Math.sin(S.yaw); const a = S.pitch + LOOK; ca = Math.cos(a); sa = Math.sin(a);
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#d6d9d6'; g.fillRect(0, 0, W, H);
    g.translate(W / 2, H * .46); g.rotate(-S.roll); g.lineJoin = g.lineCap = 'round';
    const hz = F * Math.tan(a), far = Math.hypot(W, H);
    // sky: a few ruled lines, like the paper of the site
    ink(.07, 1); for (let i = 1; i < 9; i++) { g.beginPath(); g.moveTo(-far, hz - i * i * 6 * dpr); g.lineTo(far, hz - i * i * 6 * dpr); g.stroke(); }
    band(PEAKS[1], 46000, .05, .22); band(PEAKS[0], 38000, .08, .34);                                      // the Alps
    wash(.07); g.fillRect(-far, hz, far * 2, far * 2); ink(.5, 1); g.beginPath(); g.moveTo(-far, hz); g.lineTo(far, hz); g.stroke();   // the ground, up to the horizon
    band(TOWN, SKY + 300, .1, .3);                                                                           // roofs of the city
    const sky = (pts, f, al = .75) => wall(pts.map(([x, z]) => [x * K, z * K]), SKY, f, al, 1);
    sky([[-246, 0], [-243, 172], [-252, 176], [-252, 190], [-244, 196], [-241, 240], [-239.6, 291], [-238.2, 240], [-235, 196], [-227, 190], [-227, 176], [-236, 172], [-233, 0]], .3);   // Olympiaturm
    sky([[-520, 0], [-505, 34], [-480, 12], [-455, 44], [-428, 14], [-400, 50], [-372, 16], [-345, 40], [-322, 10], [-305, 30], [-290, 0]], .16, .6);                                  // the tent roof of the Olympiastadion
    for (const x of [196, 228]) sky([[x, 0], [x, 78], [x + 2, 86], [x + 6, 93], [x + 10, 99], [x + 14, 93], [x + 18, 86], [x + 20, 78], [x + 20, 0]], .34);                           // Frauenkirche, two towers
    sky([[218, 0], [218, 46], [300, 46], [318, 30], [318, 0]], .2, .6);                                                                                                                 // ... and its nave
    band(WOOD[1], 700, .2, .4); band(WOOD[0], 540, .34, .6);                                                // the wood
    wall([[-190, 0], [-190, 9], [-145, 16], [-100, 9], [-100, 0]], 236, .22); wall([[-176, 0], [-176, 7], [-114, 7], [-114, 0]], 236, .12, .5);                 // hangar with its door
    wall([[26, 0], [26, 20], [34, 20], [34, 0]], 240, .2); wall([[21, 20], [19, 27], [41, 27], [39, 20]], 240, .3); wall([[30, 27], [30, 36]], 240, 0, .8);       // tower
    const rw = [P(-460, 132, 0), P(460, 132, 0), P(460, 162, 0), P(-460, 162, 0)];
    if (path(rw, true)) { g.fillStyle = 'rgba(230, 232, 229, .9)'; g.fill(); ink(.75, 1.2); g.stroke();
      ink(.55, 1.6); for (let x = -440; x < 440; x += 44) { const p = P(x, 147, 0), q = P(x + 22, 147, 0); if (p && q) { g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke(); } }
      for (const e of [-1, 1]) for (let i = 0; i < 6; i++) { const p = P(e * 452, 135 + i * 4.6, 0), q = P(e * 432, 135 + i * 4.6, 0); if (p && q) { g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke(); } } }
    ink(.4, 1); for (let x = -330; x <= 330; x += 11) { const p = P(x, 126, 0), q = P(x, 126, 1.2); if (p && q) { g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke(); } }        // fence along the runway
    const f1 = P(-330, 126, 1), f2 = P(330, 126, 1); if (f1 && f2) { g.beginPath(); g.moveTo(f1[0], f1[1]); g.lineTo(f2[0], f2[1]); g.stroke(); }
    ink(.13, 1); for (let y = -16; y < 124; y += 14) { const p = P(-400, y, 0), q = P(400, y, 0); if (p && q) { g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke(); } }              // mowing lines
    const ws = P(70, 118, 0), wt = P(70, 118, 7), we = P(70 + 5 + S.wind * .8, 118, 6.4 - S.wind * .15); if (ws && wt && we) { ink(.8, 1.2); g.beginPath(); g.moveTo(ws[0], ws[1]); g.lineTo(wt[0], wt[1]); g.stroke(); ink(.8, 3); g.beginPath(); g.moveTo(wt[0], wt[1]); g.lineTo(we[0], we[1]); g.stroke(); }   // windsock
    for (const [x, y, s] of TUFTS) {              // grass: what makes drifting visible
      const p = P(x, y, 0); if (!p || p[2] > 190 || Math.abs(p[0]) > far) continue;
      const k = F / p[2] * s; ink(clamp(1.1 - p[2] / 170, .12, .7), clamp(k * .12 / dpr, .6, 2.2));
      g.beginPath(); g.moveTo(p[0] - k * .5, p[1]); g.lineTo(p[0] - k * .15, p[1] - k * .9); g.moveTo(p[0], p[1]); g.lineTo(p[0] + k * .1, p[1] - k * 1.3); g.moveTo(p[0] + k * .5, p[1]); g.lineTo(p[0] + k * .3, p[1] - k * .8); g.stroke();
    }
    // the cockpit: a schematic placeholder for the Alouette's bubble until a proper drawing is in
    g.setTransform(1, 0, 0, 1, 0, 0); const u = Math.min(W, H * 1.5);
    g.fillStyle = 'rgba(18, 38, 95, .92)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(u * .2, 0); g.quadraticCurveTo(u * .04, H * .1, u * .035, H * .5); g.lineTo(u * .05, H); g.lineTo(0, H); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(W, 0); g.lineTo(W - u * .2, 0); g.quadraticCurveTo(W - u * .04, H * .1, W - u * .035, H * .5); g.lineTo(W - u * .05, H); g.lineTo(W, H); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(W * .5 - u * .012, 0); g.lineTo(W * .5 + u * .012, 0); g.lineTo(W * .5 + u * .006, H * .09); g.lineTo(W * .5 - u * .006, H * .09); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255, 255, 255, .28)'; g.lineWidth = 1.5 * dpr; g.beginPath(); g.moveTo(u * .19, H * .012); g.quadraticCurveTo(u * .05, H * .1, u * .045, H * .5); g.moveTo(W - u * .19, H * .012); g.quadraticCurveTo(W - u * .05, H * .1, W - u * .045, H * .5); g.stroke();
  };
  const gauges = () => {
    const e = S.z * FT, v = S.vz * FT * 60;
    ui.alt.textContent = Math.round(e); ui.goal.textContent = Math.round(target * FT) + ' ft';
    ui.vs.style.transform = `translateY(${(clamp(-v / 600, -1, 1) * 42).toFixed(1)}cqh)`;
    ui.hdg.style.transform = `translateX(${clamp(S.yaw / rad(40), -1, 1) * 44}cqw)`; ui.hdgBox.classList.toggle('off', Math.abs(S.yaw) > CFG.ok.hdg);
    ui.dot.style.transform = `translate(${clamp(S.x / 34, -1, 1) * 42}cqw, ${clamp(-S.y / 34, -1, 1) * 42}cqw) rotate(${S.yaw}rad)`;
    ui.altBox.classList.toggle('off', Math.abs(S.z - target) > CFG.ok.alt); ui.mapBox.classList.toggle('off', Math.hypot(S.x, S.y) > CFG.ok.pos);
    ui.col.style.transform = `scaleY(${IN.c.toFixed(3)})`; ui.ped.style.transform = `translateX(${(IN.ped * 38).toFixed(1)}cqw)`; ui.knob.style.transform = `translate(${(IN.sx * 30).toFixed(1)}cqw, ${(-IN.sy * 30).toFixed(1)}cqw)`;
    if (sub && S.t > sub) { ui.say.classList.remove('on'); sub = 0; }
    if (debug) ui.debug.textContent = `phase ${phase} ${step}  ${fps} fps\npos ${S.x.toFixed(1)} ${S.y.toFixed(1)}  v ${S.vx.toFixed(2)} ${S.vy.toFixed(2)}\nalt ${e.toFixed(0)} ft  vs ${v.toFixed(0)} ft/min\nhdg ${(S.yaw * 57.3).toFixed(1)}°  r ${(S.r * 57.3).toFixed(1)}°/s\nstick ${IN.sx.toFixed(2)} ${IN.sy.toFixed(2)}  ped ${IN.ped.toFixed(2)}  col ${IN.c.toFixed(2)}\nwind ${S.wind.toFixed(1)}  progress ${progress.toFixed(1)}/${need}\nhelp ${phase === 'tutorial' ? step : '-'}`;
  };

  // ---- input. Keys deflect gradually; pads work with mouse, pen and several fingers at once
  const held = (a, b) => (keys.has(a) ? 1 : 0) - (keys.has(b) ? 1 : 0);
  const pads = { stick: null, left: null };       // { id, x, y, c } of the pointer that holds the pad
  const controls = dt => {
    const kx = held('ArrowRight', 'ArrowLeft'), ky = held('ArrowUp', 'ArrowDown'), kp = held('d', 'a'), kc = held('w', 's'), ease = CFG.stick * dt;
    if (!pads.stick) { IN.sx += clamp((kx || 0) - IN.sx, -ease, ease); IN.sy += clamp((ky || 0) - IN.sy, -ease, ease); }
    if (!pads.left) IN.ped += clamp((kp || 0) - IN.ped, -ease, ease);
    if (kc) IN.c = clamp(IN.c + kc * CFG.collective * dt, 0, 1);
  };
  const padDown = (name, e) => { if (pads[name] || paused || phase === 'idle' || phase === 'result') return; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); pads[name] = { id: e.pointerId, x: e.clientX, y: e.clientY, c: IN.c, size: e.currentTarget.clientWidth }; };
  const padMove = (name, e) => { const p = pads[name]; if (!p || p.id !== e.pointerId) return; const dx = (e.clientX - p.x) / (p.size * .36), dy = (e.clientY - p.y) / (p.size * .36);
    if (name === 'stick') { IN.sx = clamp(dx, -1, 1); IN.sy = clamp(-dy, -1, 1); } else { IN.ped = clamp(dx, -1, 1); IN.c = clamp(p.c - dy * .18, 0, 1); } };
  const padUp = (name, e) => { const p = pads[name]; if (p && p.id === e.pointerId) pads[name] = null; };   // stick and pedals then ease back to the middle; the collective stays where it is
  const letGo = () => { keys.clear(); pads.stick = pads.left = null; };

  // ---- sound: the Alouette's own recording, quietly, only if wanted and only after a click
  const hum = on => {
    if (!on || !soundOn) { if (sound) { try { sound.gain.gain.setTargetAtTime(0, sound.ctx.currentTime, .15); } catch (e) {} } return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    if (!sound) { const ctx = new AC(), gain = ctx.createGain(); gain.gain.value = 0; gain.connect(ctx.destination); sound = { ctx, gain, src: null };
      fetch('assets/audio/alouette.mp3').then(r => r.arrayBuffer()).then(b => new Promise((ok, no) => ctx.decodeAudioData(b, ok, no))).then(buf => { if (!sound) return; const src = sound.src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.loopStart = .1; src.loopEnd = 10.1; src.connect(gain); src.start(); }).catch(() => {}); }
    sound.ctx.resume(); sound.gain.gain.setTargetAtTime(.2, sound.ctx.currentTime, .4);
  };

  // ---- loop, with a fixed step for the physics and no leaps after a pause
  const frame = now => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(.1, (now - last) / 1000); last = now; fps = Math.round(.9 * fps + .1 / Math.max(dt, .001));
    if (!paused && phase !== 'idle' && phase !== 'result') { acc += dt; while (acc >= CFG.step) { controls(CFG.step); fly(CFG.step); lesson(CFG.step); acc -= CFG.step; if (phase === 'result') break; }
      if (sound && sound.src) sound.src.playbackRate.value = .95 + S.c * .12; }
    draw(); gauges();
  };
  let watch = null;
  const size = () => { const r = cv.getBoundingClientRect(); if (r.width < 2) return; dpr = Math.min(window.devicePixelRatio || 1, r.width > 900 ? 1.5 : 2); W = cv.width = Math.round(r.width * dpr); H = cv.height = Math.round(r.height * dpr); F = .62 * Math.max(W, H * .8); };

  // ---- cards: start, pause, result
  const card = html => { ui.card.innerHTML = html; ui.card.hidden = !html; el.classList.toggle('carded', !!html); if (html) { const b = ui.card.querySelector('button'); if (b) b.focus(); } };
  const startCard = () => { phase = 'idle'; const T = t(), touch = matchMedia('(pointer: coarse)').matches;
    card(`<p class="fl-kicker">${line(SAY.invite)}</p><h2>Was soll das werden?</h2><p class="fl-sub">${T.sub}</p><p>${T.intro}</p><p class="fl-how">${touch ? T.touch : T.keys}</p>
      <p class="fl-note">${T.note}${matchMedia('(prefers-reduced-motion: reduce)').matches ? ' ' + T.motion : ''}</p>
      <div class="fl-row"><button type="button" data-do="start" class="fl-go">${T.start}</button>${store.get('flight-briefed') ? `<button type="button" data-do="skip">${T.skip}</button>` : ''}<button type="button" data-do="lang">${lang === 'de' ? 'English' : 'Deutsch'}</button></div>`); };
  const begin = skip => { fresh(); Object.assign(IN, { sx: 0, sy: 0, ped: 0, c: CFG.c0 }); letGo(); score = { passed: false, stable: 0, longest: 0, run: 0, far: 0, climbed: false }; shoutAt = -99; lastShout = -1; swings = []; paused = false; acc = 0; card(''); hum(true); go(skip ? 'hover' : 'tutorial', skip ? '' : 'a'); };
  const pause = on => { if (phase === 'idle' || phase === 'result' || paused === on) return; paused = on; letGo(); hum(!on); if (on) card(`<h2>${t().paused}</h2><div class="fl-row"><button type="button" data-do="resume" class="fl-go">${t().resume}</button><button type="button" data-do="close">${t().close}</button></div>`); else { card(''); last = performance.now(); acc = 0; } };
  const result = () => { phase = 'result'; hum(false); letGo(); const T = t(), best = store.get('flight-best') || 0; if (score.longest > best) store.set('flight-best', +score.longest.toFixed(1));
    card(`<p class="fl-kicker">${line(score.passed ? SAY.done : SAY.mine)}</p><h2>${score.passed ? T.passed : T.taken}</h2>
      <dl><dt>${T.stable}</dt><dd>${score.stable.toFixed(1)} ${T.s}</dd><dt>${T.longest}</dt><dd>${score.longest.toFixed(1)} ${T.s}</dd><dt>${T.far}</dt><dd>${score.far.toFixed(0)} ${T.m}</dd><dt>${T.climbed}</dt><dd>${score.climbed ? T.yes : T.no}</dd><dt>${T.best}</dt><dd>${Math.max(best, score.longest).toFixed(1)} ${T.s}</dd></dl>
      <div class="fl-row"><button type="button" data-do="skip" class="fl-go">${T.again}</button><button type="button" data-do="close">${T.close}</button></div>`); };
  const labels = () => { const T = t(); ui.snd.textContent = soundOn ? T.soundOn : T.soundOff; ui.snd.setAttribute('aria-pressed', soundOn); ui.pause.textContent = T.pause; ui.x.setAttribute('aria-label', T.close);
    el.querySelector('[data-l="alt"]').textContent = T.alt; el.querySelector('[data-l="vs"]').textContent = T.vs; el.querySelector('[data-l="hdg"]').textContent = T.hdg; el.querySelector('[data-l="map"]').textContent = T.map; el.querySelector('[data-l="stick"]').textContent = T.stick; el.querySelector('[data-l="left"]').textContent = T.left; };

  // ---- opening and closing: everything is built on opening and torn down on closing
  const onKey = e => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (e.type === 'keyup') return void keys.delete(k);
    if (k === ' ' && !e.target.closest('button')) { e.preventDefault(); if (phase !== 'idle' && phase !== 'result') pause(!paused); return; }
    if (k === '`' || k === '^') { debug = !debug; ui.debug.hidden = !debug; return; }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's'].includes(k)) { e.preventDefault(); keys.add(k); } };
  const onHide = () => { if (document.hidden) pause(true); };
  const close = () => { if (!open) return; open = false; cancelAnimationFrame(raf); removeEventListener('keydown', onKey); removeEventListener('keyup', onKey); removeEventListener('blur', letGo); if (watch) watch.disconnect(); document.removeEventListener('visibilitychange', onHide);
    if (sound) { try { sound.src && sound.src.stop(); sound.ctx.close(); } catch (e) {} sound = null; }
    if (el.open) el.close(); el.remove(); document.documentElement.classList.remove('lesson'); document.dispatchEvent(new Event('lesson:close')); if (trigger && trigger.focus) trigger.focus({ preventScroll: true }); };
  const build = () => {
    el = document.createElement('dialog'); el.className = 'fl'; el.setAttribute('aria-label', 'Was soll das werden? ' + t().sub);
    el.innerHTML = `<canvas class="fl-view" aria-hidden="true"></canvas>
      <header class="fl-top"><div class="fl-task"><span id="fl-task"></span><i><b id="fl-bar"></b></i></div><div class="fl-tools"><button type="button" id="fl-snd"></button><button type="button" id="fl-pause"></button><button type="button" id="fl-x">×</button></div></header>
      <p class="fl-say" id="fl-say" aria-live="assertive"></p>
      <div class="fl-gauges" aria-hidden="true">
        <div class="fl-g" id="fl-altbox"><span data-l="alt"></span><strong id="fl-alt">150</strong><em id="fl-goal"></em></div>
        <div class="fl-g fl-vs"><span data-l="vs"></span><i><b id="fl-vs"></b></i></div>
        <div class="fl-g fl-hdg" id="fl-hdgbox"><span data-l="hdg"></span><i><b id="fl-hdg"></b></i></div>
        <div class="fl-g fl-map" id="fl-mapbox"><span data-l="map"></span><i><u></u><b id="fl-dot"></b></i></div>
      </div>
      <div class="fl-pad fl-left" id="fl-left"><i class="fl-col"><b id="fl-col"></b></i><i class="fl-ped"><b id="fl-ped"></b></i><span data-l="left"></span></div>
      <div class="fl-pad fl-stick" id="fl-stick"><b id="fl-knob"></b><span data-l="stick"></span></div>
      <div class="fl-card" id="fl-card"></div><pre class="fl-debug" id="fl-debug" hidden></pre>`;
    document.body.appendChild(el);
    const $ = id => el.querySelector('#fl-' + id);
    ui = { task: $('task'), bar: $('bar'), say: $('say'), alt: $('alt'), goal: $('goal'), vs: $('vs'), hdg: $('hdg'), dot: $('dot'), altBox: $('altbox'), hdgBox: $('hdgbox'), mapBox: $('mapbox'), col: $('col'), ped: $('ped'), knob: $('knob'), card: $('card'), debug: $('debug'), snd: $('snd'), pause: $('pause'), x: $('x') };
    cv = el.querySelector('canvas'); g = cv.getContext('2d');
    for (const [name, pad] of [['stick', $('stick')], ['left', $('left')]]) { pad.addEventListener('pointerdown', e => padDown(name, e)); pad.addEventListener('pointermove', e => padMove(name, e)); pad.addEventListener('pointerup', e => padUp(name, e)); pad.addEventListener('pointercancel', e => padUp(name, e)); pad.addEventListener('lostpointercapture', e => padUp(name, e)); }
    ui.card.addEventListener('click', e => { const d = e.target.closest('[data-do]'); if (!d) return; const w = d.dataset.do;
      if (w === 'start') begin(false); else if (w === 'skip') begin(true); else if (w === 'resume') pause(false); else if (w === 'close') close(); else if (w === 'lang') { lang = lang === 'de' ? 'en' : 'de'; store.set('flight-lang', lang); labels(); startCard(); } });
    ui.snd.addEventListener('click', () => { soundOn = !soundOn; store.set('flight-sound', soundOn); labels(); hum(soundOn && !paused && phase !== 'idle' && phase !== 'result'); });
    ui.pause.addEventListener('click', () => pause(!paused)); ui.x.addEventListener('click', close);
    el.addEventListener('cancel', e => { e.preventDefault(); if (phase !== 'idle' && phase !== 'result' && !paused) pause(true); else close(); });   // Escape pauses first, then closes
  };
  const start = from => {
    if (open) return; open = true; trigger = from || null;
    if (!document.querySelector('link[data-flight]')) document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: 'css/flight.css' })).dataset.flight = '1';
    build(); labels(); document.documentElement.classList.add('lesson'); document.dispatchEvent(new Event('lesson:open'));
    el.showModal ? el.showModal() : el.setAttribute('open', '');
    fresh(); size(); startCard();
    addEventListener('keydown', onKey); addEventListener('keyup', onKey); addEventListener('blur', letGo); watch = new ResizeObserver(size); watch.observe(cv);   // also catches the moment the game's stylesheet arrives document.addEventListener('visibilitychange', onHide);
    last = performance.now(); raf = requestAnimationFrame(frame);
  };
  window.flightLesson = { open: start, close, CFG, state: S, input: IN, get phase() { return phase + (step ? ':' + step : ''); }, get score() { return score; }, get progress() { return progress / need; } };
})();
