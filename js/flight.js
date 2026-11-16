// "Was soll das werden?" – a hidden hovering game in the bio. Whoever catches the Alouette in mid-flight gets Chris's first
// flying lesson: hold a helicopter still over a meadow while a flight instructor shouts. A deliberately simplified game of
// skill, not a flight simulation. Loaded by js/bio.js only when the helicopter is caught. The cockpit and the landscape are ink
// drawings (assets/flight/, made see-through by scripts/flight-art.py), the instructor has a voice and the cabin a sound
// (assets/audio/flight/). Without any of these files the game still works: it then draws everything itself and stays silent.
(() => {
  if (window.flightLesson) return;
  const FT = 3.2808, G = 9.81, rad = d => d * Math.PI / 180, clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // Everything that tunes the feel of the game lives here. None of it claims to be real Alouette II performance
  const CFG = {
    alt: 150 / FT, climbTo: 170 / FT,             // hover height and the height of the climb task, in metres
    c0: .5, maxTilt: rad(50),                     // collective setting that holds a hover; the attitude never goes beyond this
    gust: { secs: 6, warn: 2.2 },                 // one gust from the left: its length and the warning time before it
    lost: { pos: 32, hdg: rad(75), alt: 45 / FT, secs: 2.5, floor: 8 },   // beyond these for `secs` (or below `floor` m) the instructor takes over
    hold: { tutorial: 4, hover: 8, gust: 5, climb: 3, back: 4 },          // seconds of stable flight each task asks for
    decay: .5,                                    // progress lost per second while unstable
    shout: { gap: 6.5, far: 14, shaky: 5, swings: 3, swingWindow: 2.6 },  // instructor: pause between remarks and what sets him off
    stick: 3.2, collective: .28,                  // keyboard: how fast stick and pedals deflect (1/s), collective change per second
    step: 1 / 120,
  };

  // Three levels. The attitude obeys  rate' = auth·stick − stiff·tilt − damp·rate.  With a lot of `stiff` the helicopter levels
  // itself and the stick sets the tilt (easy). With hardly any, the stick sets how fast it tilts and the tilt stays (realistic):
  // every input has to be taken out again, which is what makes a real hover hard.
  const LEVELS = {
    easy: { auth: 5.3, stiff: 20, damp: 9, drag: .16, lift: 11, sink: .65, torque: .9, pedal: .9, yawDamp: 1.05, breeze: 1.4, gust: 6.5, gustYaw: .03, ok: { pos: 9.5, hdg: rad(15), alt: 12 / FT } },
    mid: { auth: 3.4, stiff: 9, damp: 3.3, drag: .11, lift: 14, sink: .5, torque: 1.2, pedal: 1.05, yawDamp: .85, breeze: 2, gust: 8, gustYaw: .036, ok: { pos: 9, hdg: rad(14), alt: 11 / FT } },
    real: { auth: 1.2, stiff: .6, damp: 2.2, drag: .06, lift: 17, sink: .35, torque: 1.6, pedal: 1.2, yawDamp: .55, breeze: 2.6, gust: 9.5, gustYaw: .045, ok: { pos: 8, hdg: rad(12), alt: 10 / FT } },
  };   // drag 1/s (how the air slows the helicopter and the wind pushes it) · lift m/s² per unit of collective · sink: vertical damping · torque: yaw pull of the
       // collective · pedal rad/s² · breeze and gust in m/s · gustYaw: yaw kick per m/s of wind · ok: "stable" means inside all three

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
    de: { sub: 'Meine erste Flugstunde. Jetzt Ihre.', intro: 'Halten Sie die Alouette über der Wiese: Position, Richtung, Höhe.', tip: 'Kleine Bewegungen. Jede zu große Korrektur verlangt die nächste.',
      note: 'Vereinfachtes Geschicklichkeitsspiel, keine Flugsimulation für Ausbildungszwecke.', motion: 'Die Sicht aus dem Cockpit bewegt sich stark.',
      ctl: { stick: ['Steuerknüppel', 'Neigt die Maschine. Sie fliegt dorthin, wohin sie sich neigt.'], ped: ['Pedale', 'Drehen die Nase nach links oder rechts.'], col: ['Collective', 'Mehr davon und sie steigt. Weniger und sie sinkt.'] },
      by: { keys: ['Pfeiltasten', 'A und D', 'W und S, oder X'], touch: ['Rechter Daumen', 'Linker Daumen, seitlich', 'Linker Daumen, hoch und runter'] },
      also: 'Die zwei Felder unten lassen sich auch mit der Maus ziehen. Leertaste: Pause.',
      level: 'Stufe', levels: { easy: ['Easy', 'Die Maschine richtet sich von selbst auf und verzeiht viel.'], mid: ['Mittel', 'Sie reagiert schneller, pendelt nach, und der Wind ist stärker.'], real: ['Realistisch', 'Sie bleibt nicht von selbst gerade. Jede Bewegung am Knüppel wirkt nach. Sehr empfindlich.'] }, menu: 'Stufe wählen',
      start: 'Flugstunde beginnen', skip: 'Einweisung überspringen', again: 'Noch einmal', close: 'Schließen', resume: 'Weiter', paused: 'Pause', pause: 'Pause',
      soundOn: 'Ton an', soundOff: 'Ton aus', stick: 'Knüppel', left: 'Höhe · Pedale',
      tasks: { a: 'Nur der Steuerknüppel. Bleiben Sie über dem Platz.', b: 'Jetzt die Pedale dazu. Halten Sie die Nase zur Bahn.', c: 'Und das Collective. Halten Sie 150 ft.',
        hover: '150 ft, Nase zur Bahn. Acht Sekunden ruhig.', warn: 'Böe von links', gust: 'Fangen Sie die Maschine wieder ein.', climb: 'Steigen Sie auf 170 ft und halten Sie.', back: 'Zurück auf 150 ft. Position und Richtung halten.' },
      alt: 'Höhe', vs: 'Steigen', hdg: 'Richtung', map: 'Position',
      passed: 'Flugstunde bestanden', taken: 'Vom Lehrer übernommen', stable: 'Stabile Schwebezeit', longest: 'Längste ruhige Phase', far: 'Größte Abweichung', climbed: 'Höhenaufgabe', yes: 'geschafft', no: 'nicht geschafft', best: 'Bisher beste ruhige Phase', s: 's', m: 'm' },
    en: { sub: 'My first flying lesson. Now yours.', intro: 'Hold the Alouette over the meadow: position, heading, height.', tip: 'Small movements. Every correction that is too big calls for the next one.',
      note: 'A simplified game of skill, not a flight simulation for training.', motion: 'The view from the cockpit moves a lot.',
      ctl: { stick: ['Stick', 'Tilts the helicopter. It flies where it leans.'], ped: ['Pedals', 'Turn the nose left or right.'], col: ['Collective', 'More of it and the helicopter climbs. Less and it sinks.'] },
      by: { keys: ['Arrow keys', 'A and D', 'W and S, or X'], touch: ['Right thumb', 'Left thumb, sideways', 'Left thumb, up and down'] },
      also: 'The two fields at the bottom can also be dragged with the mouse. Space: pause.',
      level: 'Level', levels: { easy: ['Easy', 'The helicopter levels itself and forgives a lot.'], mid: ['Medium', 'It reacts faster, swings back, and the wind is stronger.'], real: ['Realistic', 'It does not level itself. Every move of the stick lingers. Very sensitive.'] }, menu: 'Choose level',
      start: 'Start the lesson', skip: 'Skip the briefing', again: 'Once more', close: 'Close', resume: 'Continue', paused: 'Paused', pause: 'Pause',
      soundOn: 'Sound on', soundOff: 'Sound off', stick: 'Stick', left: 'Height · Pedals',
      tasks: { a: 'The stick only. Stay over the field.', b: 'Now the pedals as well. Keep the nose on the runway.', c: 'And the collective. Hold 150 ft.',
        hover: '150 ft, nose on the runway. Eight calm seconds.', warn: 'Gust from the left', gust: 'Catch the helicopter again.', climb: 'Climb to 170 ft and hold.', back: 'Back to 150 ft. Hold position and heading.' },
      alt: 'Height', vs: 'Climb', hdg: 'Heading', map: 'Position',
      passed: 'Lesson passed', taken: 'Taken over by the instructor', stable: 'Stable hover time', longest: 'Longest calm spell', far: 'Furthest off', climbed: 'Climb task', yes: 'done', no: 'not done', best: 'Best calm spell so far', s: 's', m: 'm' },
  };
  const store = { get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  let lang = store.get('flight-lang') || (document.documentElement.lang === 'de' ? 'de' : 'en');   // the page's language, until the game's own switch is used
  let level = LEVELS[store.get('flight-level')] ? store.get('flight-level') : 'easy', LV = LEVELS[level];
  const t = () => TEXT[lang], line = pair => lang === 'de' ? pair[0] : `${pair[0]}<small>${pair[1]}</small>`;

  // ---- the scenery, in metres. x: right, y: ahead, z: up. An artistic Munich, not a real airfield
  const rnd = (seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647)(7);
  const TUFTS = Array.from({ length: 520 }, () => [(rnd() - .5) * 340, -30 + rnd() * 152, .5 + rnd() * .9]);
  const ridge = (x0, x1, n, lo, hi) => Array.from({ length: n + 1 }, (_, i) => [x0 + (x1 - x0) * i / n, lo + (hi - lo) * (.35 + .65 * rnd()) * (.6 + .4 * Math.sin(i * 1.7))]);
  const WOOD = [ridge(-1700, 1700, 150, 12, 26), ridge(-1900, 1900, 120, 16, 30)], PEAKS = [ridge(-46000, 46000, 46, 700, 2700), ridge(-46000, 46000, 60, 400, 1500)];
  const TOWN = ridge(-1500, 1500, 90, 25, 95);
  const SKY = 3600, K = 1.5;                      // the skyline stands 3.6 km off and is drawn larger than life so it can be recognised
  const SKYW = 4000, WOODW = 340, FIELDW = 106;   // metres: width of the skyline drawing, of one forest strip (edge plus mirror image), of hangar and tower
  const PIC = 709, HOOD = 492, DIALS = [[643, 406], [695, 407], [747, 408], [643, 453], [695, 456], [749, 457]];   // cockpit drawing, in its own pixels: height of the picture (the grip reaches further down), lower edge of the binnacle, the six dials
  const ALPS = { span: rad(146), top: rad(5.5), ink: .66 };  // the panorama of the Alps (scripts/alps.py) holds 112° of compass and 1.36° of height: drawn a little wider and much taller, as a long lens shows them, and pale
  const ART = {};

  // ---- state
  const S = { x: 0, y: 0, z: CFG.alt, vx: 0, vy: 0, vz: 0, yaw: 0, r: 0, roll: 0, pitch: 0, p: 0, q: 0, c: CFG.c0, wind: 0, t: 0 };   // p, q: roll and pitch rate
  const IN = { sx: 0, sy: 0, ped: 0, c: CFG.c0 };                         // what the pilot asks for: stick right, stick forward, right pedal, collective
  const keys = new Set();
  let phase = 'idle', step = '', progress = 0, need = 1, target = CFG.alt, clock = 0, paused = false, open = false, raf = 0, last = 0, acc = 0;
  let score, shoutAt = -99, lastShout = -1, shaky = 0, lostFor = 0, swings = [], prevStick = [0, 0], auto = 0, sub = 0;
  let el, cv, g, W = 0, H = 0, F = 0, far = 0, dpr = 1, ui = {}, trigger = null, sound = null, soundOn = true, debug = false, fps = 0;

  const fresh = () => Object.assign(S, { x: 0, y: 0, z: CFG.alt, vx: 0, vy: 0, vz: 0, yaw: 0, r: 0, roll: 0, pitch: 0, p: 0, q: 0, c: CFG.c0, wind: 0, t: 0 });
  const errors = () => ({ pos: Math.hypot(S.x, S.y), hdg: Math.abs(S.yaw), alt: Math.abs(S.z - target) });
  const stable = e => e.pos < LV.ok.pos && e.hdg < LV.ok.hdg && e.alt < LV.ok.alt;

  // ---- flight model: the stick moves the attitude, tilt gives acceleration, the air drags, collective lifts and twists
  const fly = dt => {
    const help = phase === 'tutorial' ? step : '', mine = phase === 'takeover', m = mine ? LEVELS.easy : LV;   // the instructor flies it the easy way
    let sx = IN.sx, sy = IN.sy, ped = IN.ped, c = IN.c;
    if (mine) {                                   // "Ich habe die Steuerung!": a calm hand brings everything back
      const fw = Math.sin(S.yaw) * S.x + Math.cos(S.yaw) * S.y, rt = Math.cos(S.yaw) * S.x - Math.sin(S.yaw) * S.y;
      const vf = Math.sin(S.yaw) * S.vx + Math.cos(S.yaw) * S.vy, vr = Math.cos(S.yaw) * S.vx - Math.sin(S.yaw) * S.vy;
      sx = clamp(-.05 * rt - .32 * vr, -.8, .8); sy = clamp(-.05 * fw - .32 * vf, -.8, .8); ped = clamp(-1.6 * S.yaw - 1.4 * S.r, -1, 1);
      c = clamp(CFG.c0 + .03 * (CFG.alt - S.z) - .06 * S.vz, 0, 1); IN.c = c;
    }
    S.p += (m.auth * sx - m.stiff * S.roll - m.damp * S.p) * dt; S.q += (-m.auth * sy - m.stiff * S.pitch - m.damp * S.q) * dt;
    S.roll += S.p * dt; S.pitch += S.q * dt;
    if (Math.abs(S.roll) > CFG.maxTilt) { S.roll = Math.sign(S.roll) * CFG.maxTilt; S.p = 0; } if (Math.abs(S.pitch) > CFG.maxTilt) { S.pitch = Math.sign(S.pitch) * CFG.maxTilt; S.q = 0; }
    const right = G * Math.tan(S.roll), ahead = -G * Math.tan(S.pitch), drag = m.drag * (help === 'a' || help === 'b' ? 2.2 : help === 'c' ? 1.5 : 1);
    S.vx += (right * Math.cos(S.yaw) + ahead * Math.sin(S.yaw) + drag * (S.wind - S.vx)) * dt;
    S.vy += (-right * Math.sin(S.yaw) + ahead * Math.cos(S.yaw) - drag * S.vy) * dt;
    S.x += S.vx * dt; S.y += S.vy * dt;
    if (help === 'a' || help === 'b') { S.vz += (1.2 * (target - S.z) - 2 * S.vz) * dt; IN.c = S.c = CFG.c0; }       // height held for the beginner
    else { S.c = c; S.vz += (m.lift * (c - CFG.c0) - m.sink * (help === 'c' ? 1.6 : 1) * S.vz - G * (1 - Math.cos(S.roll) * Math.cos(S.pitch))) * dt; }
    S.z = Math.max(1.5, S.z + S.vz * dt); if (S.z <= 1.5) S.vz = Math.max(0, S.vz);
    if (help === 'a') S.r += (-2.5 * S.yaw - 2.4 * S.r) * dt;                                                           // heading held too
    else S.r += (m.pedal * ped - m.torque * (S.c - CFG.c0) + (help === 'b' ? -.1 : 0) + m.gustYaw * S.wind - m.yawDamp * S.r) * dt;
    S.yaw += S.r * dt; if (S.yaw > Math.PI) S.yaw -= 2 * Math.PI; if (S.yaw < -Math.PI) S.yaw += 2 * Math.PI;
    S.t += dt;
  };

  // ---- the lesson: phases, progress, the instructor
  const say = (pair, hold = 4) => { ui.say.innerHTML = line(pair); ui.say.classList.add('on'); sub = S.t + hold; speak(pair); };
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
    const air = LV.breeze * (Math.sin(.9 * S.t + 1) + .6 * Math.sin(.37 * S.t + 2.1)) / 1.6 * (phase === 'tutorial' ? .6 : 1);   // always the same, so every attempt is alike
    const e = errors(), calm = stable(e), scored = phase !== 'tutorial';
    if (phase === 'gust') {                       // one gust from the left, the same every time: announced, swelling, fading
      const u = (clock - CFG.gust.warn) / CFG.gust.secs;
      S.wind = air + (u > 0 && u < 1 ? LV.gust * Math.sin(Math.PI * u) ** 2 : 0);
      if (u > 0 && ui.task.textContent === t().tasks.warn) task(t().tasks.gust, SAY.gust);
      if (u < .55) { progress = 0; }              // steadiness only counts once the gust has shown its hand
    } else S.wind = air;
    const fine = phase === 'tutorial' ? (step === 'a' ? e.pos < LV.ok.pos * 1.3 : step === 'b' ? e.pos < LV.ok.pos * 1.6 && e.hdg < LV.ok.hdg : calm)
      : phase === 'climb' ? e.alt < LV.ok.alt && e.pos < LV.ok.pos * 1.6 && e.hdg < LV.ok.hdg * 1.5 : calm;
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
    } else if (e.pos > 40 || e.hdg > rad(100) || S.z < CFG.lost.floor || S.z > CFG.alt * 2) { Object.assign(S, { x: 0, y: 0, vx: 0, vy: 0, z: CFG.alt, vz: 0, yaw: 0, r: 0, roll: 0, pitch: 0, p: 0, q: 0 }); say(SAY.help, 3); }   // in the briefing he simply puts it back
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
  let cs, sn, ca, sa, seat = null;
  const P = (x, y, z) => {                        // world point to screen (relative to the centre, before roll); null when behind
    const dx = x - S.x, dy = y - S.y, dz = z - S.z, xr = dx * cs - dy * sn, yr = dx * sn + dy * cs, d = yr * ca + dz * sa;
    return d < 1.5 ? null : [xr / d * F, -(-yr * sa + dz * ca) / d * F, d];
  };
  const path = (pts, close) => { let on = false; g.beginPath(); for (const p of pts) { if (!p) { if (close) return false; on = false; continue; } on ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); on = true; } if (close) g.closePath(); return true; };
  const ink = (a, w) => { g.strokeStyle = `rgba(${INK}, ${a})`; g.lineWidth = w * dpr; };
  const wash = a => { g.fillStyle = `rgba(31, 63, 151, ${a})`; };
  const wall = (pts, y, fill, a = .8, w = 1) => { if (path(pts.map(([x, z]) => P(x, y, z)), true)) { if (fill) { wash(fill); g.fill(); } ink(a, w); g.stroke(); } };
  const band = (top, y, fill, a) => { const pts = top.map(([x, z]) => P(x, y, z)); if (pts.some(p => !p)) return; const lo = [P(top[top.length - 1][0], y, 0), P(top[0][0], y, 0)]; if (lo.some(p => !p)) return; path([...pts, ...lo], true); wash(fill); g.fill(); path(pts); ink(a, 1); g.stroke(); };
  // a drawing standing upright in the landscape: from (xa, y) to (xb, y), `h` metres tall, cut into `n` upright strips so it turns in perspective
  const board = (img, xa, xb, y, h, n) => {
    const iw = img.width, ih = img.height; let prev = null;
    for (let i = 0; i <= n; i++) {
      const x = xa + (xb - xa) * i / n, lo = P(x, y, 0), hi = lo && P(x, y, h), cur = hi ? [lo[0], lo[1], hi[1]] : null;
      if (prev && cur && cur[0] > prev[0] && cur[0] > -far && prev[0] < far) { const top = (prev[2] + cur[2]) / 2, x0 = Math.round(prev[0]); g.drawImage(img, (i - 1) / n * iw, 0, iw / n, ih, x0, top, Math.round(cur[0]) - x0, (prev[1] + cur[1]) / 2 - top); }
      prev = cur;
    }
  };
  // the chain of the Alps: a panorama so far away that it only turns with the helicopter and never shifts. Each column of the
  // picture is a compass direction, its lower edge the horizon
  const Q = (b, e) => { const x0 = Math.sin(b) * Math.cos(e), y0 = Math.cos(b) * Math.cos(e), z0 = Math.sin(e), xr = x0 * cs - y0 * sn, yr = x0 * sn + y0 * cs, d = yr * ca + z0 * sa; return d < .12 ? null : [xr / d * F, -(-yr * sa + z0 * ca) / d * F]; };
  const chain = img => { const n = 60, iw = img.width; let prev = null;
    for (let i = 0; i <= n; i++) { const b = (i / n - .5) * ALPS.span, lo = Q(b, 0), hi = lo && Q(b, ALPS.top), cur = hi ? [lo[0], lo[1], hi[1]] : null;
      if (prev && cur && cur[0] > prev[0] && cur[0] > -far && prev[0] < far) { const top = (prev[2] + cur[2]) / 2, x0 = Math.round(prev[0]); g.drawImage(img, (i - 1) / n * iw, 0, iw / n, img.height, x0, top, Math.round(cur[0]) - x0, (prev[1] + cur[1]) / 2 - top); }
      prev = cur; } };
  const draw = () => {
    cs = Math.cos(S.yaw); sn = Math.sin(S.yaw); const a = S.pitch + LOOK; ca = Math.cos(a); sa = Math.sin(a);
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#d6d9d6'; g.fillRect(0, 0, W, H);
    g.translate(W / 2, H * .46); g.rotate(-S.roll); g.lineJoin = g.lineCap = 'round';
    const hz = F * Math.tan(a); far = Math.hypot(W, H);
    // sky: a few ruled lines, like the paper of the site
    ink(.07, 1); for (let i = 1; i < 9; i++) { g.beginPath(); g.moveTo(-far, hz - i * i * 6 * dpr); g.lineTo(far, hz - i * i * 6 * dpr); g.stroke(); }
    const sk = ART.skyline;
    if (ART.alps) { g.globalAlpha = ALPS.ink; chain(ART.alps); g.globalAlpha = 1; } else { band(PEAKS[1], 46000, .05, .22); band(PEAKS[0], 38000, .08, .34); }   // the Alps: the real chain, or two plain ridges
    wash(.07); g.fillRect(-far, hz, far * 2, far * 2); ink(.5, 1); g.beginPath(); g.moveTo(-far, hz); g.lineTo(far, hz); g.stroke();   // the ground, up to the horizon
    if (sk) board(sk, -SKYW / 2, SKYW / 2, SKY, SKYW * sk.height / sk.width, 28);                         // Olympiaturm, tent roof, Frauenkirche: one drawing
    else {
      band(TOWN, SKY + 300, .1, .3);                                                                         // roofs of the city
      const sky = (pts, f, al = .75) => wall(pts.map(([x, z]) => [x * K, z * K]), SKY, f, al, 1);
      sky([[-246, 0], [-243, 172], [-252, 176], [-252, 190], [-244, 196], [-241, 240], [-239.6, 291], [-238.2, 240], [-235, 196], [-227, 190], [-227, 176], [-236, 172], [-233, 0]], .3);   // Olympiaturm
      sky([[-520, 0], [-505, 34], [-480, 12], [-455, 44], [-428, 14], [-400, 50], [-372, 16], [-345, 40], [-322, 10], [-305, 30], [-290, 0]], .16, .6);                                  // the tent roof of the Olympiastadion
      for (const x of [196, 228]) sky([[x, 0], [x, 78], [x + 2, 86], [x + 6, 93], [x + 10, 99], [x + 14, 93], [x + 18, 86], [x + 20, 78], [x + 20, 0]], .34);                           // Frauenkirche, two towers
      sky([[218, 0], [218, 46], [300, 46], [318, 30], [318, 0]], .2, .6);                                                                                                                 // ... and its nave
    }
    if (ART.forest) { const fw = WOODW, fh = fw * ART.forest.height / ART.forest.width; for (let i = -9; i < 9; i++) board(ART.forest, i * fw, (i + 1) * fw, 540, fh, 20); }   // the edge of the wood
    else { band(WOOD[1], 700, .2, .4); band(WOOD[0], 540, .34, .6); }
    if (ART.airfield) board(ART.airfield, -146, -146 + FIELDW, 236, FIELDW * ART.airfield.height / ART.airfield.width, 10);   // hangar and tower
    else {
      wall([[-190, 0], [-190, 9], [-145, 16], [-100, 9], [-100, 0]], 236, .22); wall([[-176, 0], [-176, 7], [-114, 7], [-114, 0]], 236, .12, .5);                 // hangar with its door
      wall([[26, 0], [26, 20], [34, 20], [34, 0]], 240, .2); wall([[21, 20], [19, 27], [41, 27], [39, 20]], 240, .3); wall([[30, 27], [30, 36]], 240, 0, .8);       // tower
    }
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
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (seat) {                                   // the cockpit drawing, with needles that live
      g.drawImage(seat.cv, 0, 0);
      const v = S.vz * FT * 60, turn = [-2.2 + clamp(Math.hypot(S.vx, S.vy) / 18, 0, 1) * 4.4, -Math.PI / 2 + S.z * FT / 500 * 2 * Math.PI, Math.PI + clamp(v / 1000, -1, 1) * 2.4, -.7 + (S.c - CFG.c0) * .3 + .02 * Math.sin(S.t * 9), -Math.PI / 2 - S.yaw, -2.2 + S.c * 4.4];
      g.strokeStyle = 'rgba(240, 242, 238, .95)'; g.fillStyle = 'rgba(240, 242, 238, .95)'; g.lineWidth = Math.max(1, 1.7 * seat.s); g.lineCap = 'round';
      DIALS.forEach(([x, y], i) => { const cx = seat.x + x * seat.s, cy = seat.y + y * seat.s, r = 15 * seat.s; g.beginPath(); g.moveTo(cx - Math.cos(turn[i]) * r * .25, cy - Math.sin(turn[i]) * r * .25); g.lineTo(cx + Math.cos(turn[i]) * r, cy + Math.sin(turn[i]) * r); g.stroke(); g.beginPath(); g.arc(cx, cy, 1.6 * seat.s, 0, 7); g.fill(); });
      return;
    }
    // no drawing (yet): a schematic bubble
    const u = Math.min(W, H * 1.5);
    g.fillStyle = 'rgba(18, 38, 95, .92)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(u * .2, 0); g.quadraticCurveTo(u * .04, H * .1, u * .035, H * .5); g.lineTo(u * .05, H); g.lineTo(0, H); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(W, 0); g.lineTo(W - u * .2, 0); g.quadraticCurveTo(W - u * .04, H * .1, W - u * .035, H * .5); g.lineTo(W - u * .05, H); g.lineTo(W, H); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(W * .5 - u * .012, 0); g.lineTo(W * .5 + u * .012, 0); g.lineTo(W * .5 + u * .006, H * .09); g.lineTo(W * .5 - u * .006, H * .09); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255, 255, 255, .28)'; g.lineWidth = 1.5 * dpr; g.beginPath(); g.moveTo(u * .19, H * .012); g.quadraticCurveTo(u * .05, H * .1, u * .045, H * .5); g.moveTo(W - u * .19, H * .012); g.quadraticCurveTo(W - u * .05, H * .1, W - u * .045, H * .5); g.stroke();
  };
  // ---- the drawings. Each one replaces its hand-drawn stand-in as soon as it has loaded
  const fit = () => {                             // the cockpit, laid out once per window size: it is the frame, so it never moves
    const img = ART.cockpit; seat = null; if (!img || !W) return;
    const iw = img.width, ih = img.height, s = Math.max(W / iw, Math.min(H / PIC, .34 * W / 202));   // fill the width, but on an upright phone keep the instruments from filling it
    let y = H - s * PIC; const x = (W - s * iw) / 2, pr = ui.panel.getBoundingClientRect(), cr = cv.getBoundingClientRect(), top = (pr.top - cr.top) * dpr - 6 * dpr;
    if (pr.height && y + s * HOOD > top) y = top - s * HOOD;                                           // the binnacle sits on top of the game's own instruments, never behind them
    const c = document.createElement('canvas'); c.width = W; c.height = H; const k = c.getContext('2d');
    k.drawImage(img, x, y, s * iw, s * ih);
    if (y + s * PIC < H - 1) { k.fillStyle = '#12265f'; k.fillRect(x + s * 630, y + s * (PIC - 3), s * 138, H); }   // the pedestal goes on down to the floor
    if (y > 2) { const fade = k.createLinearGradient(0, y, 0, y + s * PIC * .2); fade.addColorStop(0, 'rgba(0,0,0,1)'); fade.addColorStop(1, 'rgba(0,0,0,0)'); k.globalCompositeOperation = 'destination-out'; k.fillStyle = fade; k.fillRect(0, 0, W, y + s * PIC * .2); }   // ... and the frame fades out where it would end in mid-air
    seat = { cv: c, x, y, s };
  };
  const art = () => { for (const name of ['alps', 'skyline', 'forest', 'airfield', 'cockpit']) { const img = new Image(); img.decoding = 'async';
    img.onload = () => { if (!open) return;
      if (name === 'forest') { const c = document.createElement('canvas'), w = img.width; c.width = w * 2; c.height = img.height; const k = c.getContext('2d'); k.drawImage(img, 0, 0); k.translate(w * 2, 0); k.scale(-1, 1); k.drawImage(img, 0, 0); ART.forest = c; }   // the edge and its mirror image: a strip that repeats without a seam
      else ART[name] = img; if (name === 'cockpit') fit(); };
    img.src = `assets/flight/${name}.webp`; } };
  const gauges = () => {
    const e = S.z * FT, v = S.vz * FT * 60;
    ui.alt.textContent = Math.round(e); ui.goal.textContent = Math.round(target * FT) + ' ft';
    ui.vs.style.transform = `translateY(${(clamp(-v / 600, -1, 1) * 42).toFixed(1)}cqh)`;
    ui.hdg.style.transform = `translateX(${clamp(S.yaw / rad(40), -1, 1) * 44}cqw)`; ui.hdgBox.classList.toggle('off', Math.abs(S.yaw) > LV.ok.hdg);
    ui.dot.style.transform = `translate(${clamp(S.x / 34, -1, 1) * 42}cqw, ${clamp(-S.y / 34, -1, 1) * 42}cqw) rotate(${S.yaw}rad)`;
    ui.altBox.classList.toggle('off', Math.abs(S.z - target) > LV.ok.alt); ui.mapBox.classList.toggle('off', Math.hypot(S.x, S.y) > LV.ok.pos);
    ui.col.style.transform = `scaleY(${IN.c.toFixed(3)})`; ui.ped.style.transform = `translateX(${(IN.ped * 38).toFixed(1)}cqw)`; ui.knob.style.transform = `translate(${(IN.sx * 30).toFixed(1)}cqw, ${(-IN.sy * 30).toFixed(1)}cqw)`;
    if (sub && S.t > sub) { ui.say.classList.remove('on'); sub = 0; }
    if (debug) ui.debug.textContent = `${level}  phase ${phase} ${step}  ${fps} fps\npos ${S.x.toFixed(1)} ${S.y.toFixed(1)}  v ${S.vx.toFixed(2)} ${S.vy.toFixed(2)}\nalt ${e.toFixed(0)} ft  vs ${v.toFixed(0)} ft/min\nhdg ${(S.yaw * 57.3).toFixed(1)}°  r ${(S.r * 57.3).toFixed(1)}°/s\nstick ${IN.sx.toFixed(2)} ${IN.sy.toFixed(2)}  ped ${IN.ped.toFixed(2)}  col ${IN.c.toFixed(2)}\nwind ${S.wind.toFixed(1)}  progress ${progress.toFixed(1)}/${need}\nhelp ${phase === 'tutorial' ? step : '-'}`;
  };

  // ---- input. Keys deflect gradually; pads work with mouse, pen and several fingers at once
  const held = (a, b) => (keys.has(a) ? 1 : 0) - (keys.has(b) ? 1 : 0);
  const pads = { stick: null, left: null };       // { id, x, y, c } of the pointer that holds the pad
  const controls = dt => {
    const kx = held('ArrowRight', 'ArrowLeft'), ky = held('ArrowUp', 'ArrowDown'), kp = held('d', 'a'), kc = (keys.has('w') ? 1 : 0) - (keys.has('s') || keys.has('x') ? 1 : 0), ease = CFG.stick * dt;
    if (!pads.stick) { IN.sx += clamp((kx || 0) - IN.sx, -ease, ease); IN.sy += clamp((ky || 0) - IN.sy, -ease, ease); }
    if (!pads.left) IN.ped += clamp((kp || 0) - IN.ped, -ease, ease);
    if (kc) IN.c = clamp(IN.c + kc * CFG.collective * dt, 0, 1);
  };
  const padDown = (name, e) => { if (pads[name] || paused || phase === 'idle' || phase === 'result') return; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); pads[name] = { id: e.pointerId, x: e.clientX, y: e.clientY, c: IN.c, size: e.currentTarget.clientWidth }; };
  const padMove = (name, e) => { const p = pads[name]; if (!p || p.id !== e.pointerId) return; const dx = (e.clientX - p.x) / (p.size * .36), dy = (e.clientY - p.y) / (p.size * .36);
    if (name === 'stick') { IN.sx = clamp(dx, -1, 1); IN.sy = clamp(-dy, -1, 1); } else { IN.ped = clamp(dx, -1, 1); IN.c = clamp(p.c - dy * .18, 0, 1); } };
  const padUp = (name, e) => { const p = pads[name]; if (p && p.id === e.pointerId) pads[name] = null; };   // stick and pedals then ease back to the middle; the collective stays where it is
  const letGo = () => { keys.clear(); pads.stick = pads.left = null; };

  // ---- sound, only if wanted and only after a click: the cabin of an Alouette in flight as a loop (a recording from freeSFX,
  // credited on the making-of page), and the instructor's voice on top.
  // His lines are always on screen as well, so nothing is lost without sound
  const VOICE = new Map([[QUOTES[0], 'q1'], [QUOTES[1], 'q2'], [QUOTES[2], 'q3'], ...Object.keys(SAY).map(k => [SAY[k], k])]), CABIN = .34;
  const fetched = name => sound.bufs[name] || (sound.bufs[name] = fetch(`assets/audio/flight/${name}.mp3`).then(r => r.ok ? r.arrayBuffer() : Promise.reject()).then(b => new Promise((ok, no) => sound.ctx.decodeAudioData(b, ok, no))).catch(() => null));
  const wake = ctx => window.siteSound ? window.siteSound.wake(ctx) : ctx.resume();      // inside the tap that starts or resumes a round
  const audio = () => {
    if (sound) return sound; const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    const ctx = new AC(), cabin = ctx.createGain(), duck = ctx.createGain(), voice = ctx.createGain(); cabin.gain.value = 0; cabin.connect(duck); duck.connect(ctx.destination); voice.connect(ctx.destination);
    const me = sound = { ctx, cabin, duck, voice, src: null, talk: null, bufs: {} };
    fetched('cabin').then(buf => { if (sound !== me || !buf) return; const src = me.src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.loopStart = .2; src.loopEnd = 14.2; src.connect(cabin); src.start(); });   // the file holds a seamless fourteen seconds between these two marks
    VOICE.forEach(fetched);
    return me;
  };
  const hush = () => { if (sound && sound.talk) { try { sound.talk.onended = null; sound.talk.stop(); } catch (e) {} sound.talk = null; sound.duck.gain.setTargetAtTime(1, sound.ctx.currentTime, .2); } };
  const hum = on => {
    if (!on || !soundOn) { if (sound) { sound.cabin.gain.setTargetAtTime(0, sound.ctx.currentTime, .15); if (!soundOn) hush(); } return; }
    const a = audio(); if (!a) return; wake(a.ctx); a.cabin.gain.setTargetAtTime(CABIN, a.ctx.currentTime, .4);
  };
  const speak = pair => {
    const name = VOICE.get(pair); if (!name || !soundOn) return; const a = audio(); if (!a) return; if (a.ctx.state !== 'running') a.ctx.resume();
    fetched(name).then(buf => { if (sound !== a || !buf || !soundOn || a.ctx.state !== 'running') return;   // one voice at a time: a new line cuts the old one off
      hush(); const src = a.talk = a.ctx.createBufferSource(); src.buffer = buf; src.connect(a.voice); a.duck.gain.setTargetAtTime(.5, a.ctx.currentTime, .05);
      src.onended = () => { if (a.talk === src) { a.talk = null; a.duck.gain.setTargetAtTime(1, a.ctx.currentTime, .3); } }; src.start(); });
  };

  // ---- loop, with a fixed step for the physics and no leaps after a pause
  const frame = now => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(.1, (now - last) / 1000); last = now; fps = Math.round(.9 * fps + .1 / Math.max(dt, .001));
    if (!paused && phase !== 'idle' && phase !== 'result') { acc += dt; while (acc >= CFG.step) { controls(CFG.step); fly(CFG.step); lesson(CFG.step); acc -= CFG.step; if (phase === 'result') break; }
      if (sound && sound.src) sound.src.playbackRate.value = .97 + S.c * .06; }
    draw(); gauges();
  };
  let watch = null;
  const size = () => { const r = cv.getBoundingClientRect(); if (r.width < 2) return; dpr = Math.min(window.devicePixelRatio || 1, r.width > 900 ? 1.5 : 2); W = cv.width = Math.round(r.width * dpr); H = cv.height = Math.round(r.height * dpr); F = .62 * Math.max(W, H * .8); fit(); };

  // ---- cards: start, pause, result
  const card = html => { ui.card.innerHTML = html; ui.card.hidden = !html; el.classList.toggle('carded', !!html); if (html) { const b = ui.card.querySelector('.fl-go') || ui.card.querySelector('button'); if (b) b.focus(); } };
  // the three controls as pictures: what it does to the helicopter, and what the hand does
  const svg = (body, box = '0 0 64 64') => `<svg viewBox="${box}" aria-hidden="true">${body}</svg>`, tip = (x, y, r) => `<path d="M-4 3 0 -4 4 3" transform="translate(${x} ${y}) rotate(${r})"/>`;
  const above = '<circle cx="32" cy="29" r="19" stroke-dasharray="2 4"/><ellipse cx="32" cy="29" rx="6" ry="9" class="f"/><path d="M32 38V56M28 56h8"/>';
  const PICT = {
    stick: svg(`<g transform="translate(0 4)">${above}</g>${tip(32, 5, 0)}${tip(59, 33, 90)}${tip(5, 33, -90)}${tip(32, 67, 180)}`, '0 0 64 72'),
    ped: svg(`${above}<path d="M19 9A23 23 0 0 1 45 9"/>${tip(17, 11, -125)}${tip(47, 11, 125)}`),
    col: svg('<circle cx="22" cy="37" r="9" class="f"/><path d="M31 36l24-2M22 28v-6M4 22h36M12 50h22M16 46v4M28 46v4"/><circle cx="56" cy="33" r="3.5"/><path d="M50 16V6M50 52v10"/>' + tip(50, 5, 0) + tip(50, 63, 180)),
  };
  const key = k => `<kbd>${k}</kbd>`, thumb = d => svg(`<rect x="3" y="3" width="34" height="34" rx="${d === 'o' ? 17 : 7}"/>${d === 'o' ? '<circle cx="20" cy="20" r="5" class="f"/>' + tip(20, 8, 0) + tip(32, 20, 90) + tip(20, 32, 180) + tip(8, 20, -90) : d === 'h' ? '<path d="M10 20h20"/>' + tip(9, 20, -90) + tip(31, 20, 90) : '<path d="M20 10v20"/>' + tip(20, 9, 0) + tip(20, 31, 180)}`, '0 0 40 40');
  const HAND = { keys: [`<span class="fl-arrows">${key('↑')}<br>${key('←')}${key('↓')}${key('→')}</span>`, `<span class="fl-arrows">${key('A')}${key('D')}</span>`, `<span class="fl-arrows">${key('W')}<br>${key('S')}</span>`], touch: [thumb('o'), thumb('h'), thumb('v')] };
  const startCard = () => { phase = 'idle'; const T = t(), how = matchMedia('(pointer: coarse)').matches ? 'touch' : 'keys';
    card(`<div class="fl-start"><div class="fl-intro"><p class="fl-kicker">${line(SAY.invite)}</p><h2>Was soll das werden?</h2><p class="fl-sub">${T.sub}</p><p>${T.intro} ${T.tip}</p></div>
      <ul class="fl-how">${['stick', 'ped', 'col'].map((c, i) => `<li>${PICT[c]}<div><b>${T.ctl[c][0]}</b><span>${T.ctl[c][1]}</span></div><div class="fl-by fl-by-${how}">${HAND[how][i]}<small>${T.by[how][i]}</small></div></li>`).join('')}</ul>
      <div class="fl-pick"><div class="fl-levels" role="radiogroup" aria-label="${T.level}">${Object.keys(LEVELS).map(l => `<button type="button" role="radio" aria-checked="${l === level}" data-level="${l}">${T.levels[l][0]}</button>`).join('')}</div><p class="fl-lv" id="fl-lv">${T.levels[level][1]}</p></div>
      <p class="fl-note">${how === 'keys' ? T.also + ' ' : ''}${T.note}${matchMedia('(prefers-reduced-motion: reduce)').matches ? ' ' + T.motion : ''}</p>
      <div class="fl-row"><button type="button" data-do="start" class="fl-go">${T.start}</button>${store.get('flight-briefed') ? `<button type="button" data-do="skip">${T.skip}</button>` : ''}<button type="button" data-do="lang">${lang === 'de' ? 'English' : 'Deutsch'}</button></div></div>`); };
  const pick = l => { if (!LEVELS[l]) return; level = l; LV = LEVELS[l]; store.set('flight-level', l); ui.card.querySelectorAll('[data-level]').forEach(b => b.setAttribute('aria-checked', b.dataset.level === l)); const d = ui.card.querySelector('#fl-lv'); if (d) d.textContent = t().levels[l][1]; };
  const begin = skip => { fresh(); Object.assign(IN, { sx: 0, sy: 0, ped: 0, c: CFG.c0 }); letGo(); score = { level, passed: false, stable: 0, longest: 0, run: 0, far: 0, climbed: false }; shoutAt = -99; lastShout = -1; swings = []; prevStick = [0, 0]; paused = false; acc = 0; card(''); hush(); hum(true); go(skip ? 'hover' : 'tutorial', skip ? '' : 'a'); };
  const pause = on => { if (phase === 'idle' || phase === 'result' || paused === on) return; paused = on; letGo(); hum(!on); if (on) { hush(); card(`<h2>${t().paused}</h2><div class="fl-row"><button type="button" data-do="resume" class="fl-go">${t().resume}</button><button type="button" data-do="close">${t().close}</button></div>`); } else { card(''); last = performance.now(); acc = 0; } };
  const bests = () => { const b = store.get('flight-best'); return b && typeof b === 'object' ? b : b ? { easy: +b } : {}; };   // one best value per level; an older single value was flown on what is now "easy"
  const result = () => { phase = 'result'; hum(false); letGo(); const T = t(), all = bests(), best = all[level] || 0; if (score.longest > best) { all[level] = +score.longest.toFixed(1); store.set('flight-best', all); }
    card(`<p class="fl-kicker">${line(score.passed ? SAY.done : SAY.mine)}</p><h2>${score.passed ? T.passed : T.taken}</h2>
      <dl><dt>${T.level}</dt><dd>${T.levels[level][0]}</dd><dt>${T.stable}</dt><dd>${score.stable.toFixed(1)} ${T.s}</dd><dt>${T.longest}</dt><dd>${score.longest.toFixed(1)} ${T.s}</dd><dt>${T.far}</dt><dd>${score.far.toFixed(0)} ${T.m}</dd><dt>${T.climbed}</dt><dd>${score.climbed ? T.yes : T.no}</dd><dt>${T.best}</dt><dd>${Math.max(best, score.longest).toFixed(1)} ${T.s}</dd></dl>
      <div class="fl-row"><button type="button" data-do="skip" class="fl-go">${T.again}</button><button type="button" data-do="menu">${T.menu}</button><button type="button" data-do="close">${T.close}</button></div>`); };
  const labels = () => { const T = t(); ui.snd.innerHTML = `<span>${soundOn ? T.soundOn : T.soundOff}</span>`; ui.snd.setAttribute('aria-pressed', soundOn); ui.snd.setAttribute('aria-label', soundOn ? T.soundOn : T.soundOff); ui.pause.innerHTML = `<span>${T.pause}</span>`; ui.pause.setAttribute('aria-label', T.pause); ui.x.setAttribute('aria-label', T.close);
    el.querySelector('[data-l="alt"]').textContent = T.alt; el.querySelector('[data-l="vs"]').textContent = T.vs; el.querySelector('[data-l="hdg"]').textContent = T.hdg; el.querySelector('[data-l="map"]').textContent = T.map; el.querySelector('[data-l="stick"]').textContent = T.stick; el.querySelector('[data-l="left"]').textContent = T.left; };

  // ---- opening and closing: everything is built on opening and torn down on closing
  const onKey = e => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (e.type === 'keyup') return void keys.delete(k);
    if (k === ' ' && !e.target.closest('button')) { e.preventDefault(); if (phase !== 'idle' && phase !== 'result') pause(!paused); return; }
    if (k === '`' || k === '^') { debug = !debug; ui.debug.hidden = !debug; return; }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's', 'x'].includes(k)) { e.preventDefault(); keys.add(k); } };
  const onHide = () => { if (document.hidden) pause(true); };
  const close = () => { if (!open) return; open = false; cancelAnimationFrame(raf); removeEventListener('keydown', onKey); removeEventListener('keyup', onKey); removeEventListener('blur', letGo); if (watch) watch.disconnect(); document.removeEventListener('visibilitychange', onHide);
    if (sound) { try { hush(); sound.src && sound.src.stop(); sound.ctx.close(); } catch (e) {} sound = null; } seat = null; for (const k in ART) delete ART[k];
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
    ui = { task: $('task'), bar: $('bar'), say: $('say'), alt: $('alt'), goal: $('goal'), vs: $('vs'), hdg: $('hdg'), dot: $('dot'), altBox: $('altbox'), hdgBox: $('hdgbox'), mapBox: $('mapbox'), col: $('col'), ped: $('ped'), knob: $('knob'), card: $('card'), debug: $('debug'), snd: $('snd'), pause: $('pause'), x: $('x'), panel: el.querySelector('.fl-gauges') };
    cv = el.querySelector('canvas'); g = cv.getContext('2d');
    for (const [name, pad] of [['stick', $('stick')], ['left', $('left')]]) { pad.addEventListener('pointerdown', e => padDown(name, e)); pad.addEventListener('pointermove', e => padMove(name, e)); pad.addEventListener('pointerup', e => padUp(name, e)); pad.addEventListener('pointercancel', e => padUp(name, e)); pad.addEventListener('lostpointercapture', e => padUp(name, e)); }
    ui.card.addEventListener('keydown', e => { const lv = e.target.closest('[data-level]'), d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]; if (!lv || !d) return; e.preventDefault(); e.stopPropagation(); const ks = Object.keys(LEVELS), n = ks[(ks.indexOf(lv.dataset.level) + d + ks.length) % ks.length]; pick(n); ui.card.querySelector(`[data-level="${n}"]`).focus(); });   // a radio group: the arrow keys move the choice
    ui.card.addEventListener('click', e => { const lv = e.target.closest('[data-level]'); if (lv) return pick(lv.dataset.level); const d = e.target.closest('[data-do]'); if (!d) return; const w = d.dataset.do;
      if (w === 'start') begin(false); else if (w === 'skip') begin(true); else if (w === 'resume') pause(false); else if (w === 'close') close(); else if (w === 'menu') startCard(); else if (w === 'lang') { lang = lang === 'de' ? 'en' : 'de'; store.set('flight-lang', lang); labels(); startCard(); } });
    ui.snd.addEventListener('click', () => { soundOn = !soundOn; store.set('flight-sound', soundOn); labels(); if (soundOn && window.siteSound) window.siteSound.loud();      // switched on by hand: also heard on a phone whose ringer is off
      hum(soundOn && !paused && phase !== 'idle' && phase !== 'result'); if (!soundOn) hush(); });
    ui.pause.addEventListener('click', () => pause(!paused)); ui.x.addEventListener('click', close);
    el.addEventListener('cancel', e => { e.preventDefault(); if (phase !== 'idle' && phase !== 'result' && !paused) pause(true); else close(); });   // Escape pauses first, then closes
  };
  const start = from => {
    if (open) return; open = true; trigger = from || null;
    const own = store.get('flight-sound'); let site = true; try { site = localStorage.getItem('sound') !== 'off'; } catch (e) {}
    soundOn = own === null ? site : own !== false;      // the game has a sound switch of its own; until it has been used, the site's switch decides
    if (!document.querySelector('link[data-flight]')) document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: 'css/flight.css' })).dataset.flight = '1';
    build(); labels(); document.documentElement.classList.add('lesson'); document.dispatchEvent(new Event('lesson:open'));
    el.showModal ? el.showModal() : el.setAttribute('open', '');
    fresh(); size(); art(); startCard(); speak(SAY.invite);
    addEventListener('keydown', onKey); addEventListener('keyup', onKey); addEventListener('blur', letGo); document.addEventListener('visibilitychange', onHide);
    watch = new ResizeObserver(size); watch.observe(cv); watch.observe(ui.panel);   // also catches the moment the game's stylesheet arrives
    last = performance.now(); raf = requestAnimationFrame(frame);
  };
  window.flightLesson = { open: start, close, CFG, LEVELS, state: S, input: IN, get level() { return level; }, set level(l) { if (LEVELS[l]) { level = l; LV = LEVELS[l]; } }, get phase() { return phase + (step ? ':' + step : ''); }, get score() { return score; }, get progress() { return progress / need; } };
})();
