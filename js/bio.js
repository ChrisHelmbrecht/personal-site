// Bio: a logbook. While the chapters scroll by, a swallow carries an ink line across the chart (Munich, New York, Tenerife, Moscow,
// Munich), the camera follows it, the city of the moment blooms into colour, and the station's engraving comes alive beside it.
(() => {
  const chart = document.getElementById('chart'), log = document.getElementById('log');
  if (!chart || !log) return;
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches, wide = matchMedia('(min-width: 900px)');
  const net = navigator.connection, thrifty = !!net && (net.saveData || /(^|-)2g$/.test(net.effectiveType || ''));
  const W = 1000, H = 660, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  //             pin that lights up, legs drawn, plate shown, where the camera looks: x, y on the chart and how close
  const STEPS = [['munich', 0, 'munich', [500, 330, 1]], ['newyork', 1, 'newyork', [418, 246, 1.5]], ['tenerife', 2, 'tenerife', [345, 372, 1.65]], ['moscow', 3, 'moscow', [652, 318, 1.75]],
    [null, 3, 'music', [500, 330, 1]], ['munich', 4, 'home', [716, 214, 2.4]], [null, 4, 'now', [500, 330, 1]]];
  const ARRIVE = { munich: 0, newyork: 1, tenerife: 2, moscow: 3 };          // how much of the line must be drawn before a city counts as reached
  const stage = chart.querySelector('.stage'), legs = [...chart.querySelectorAll('.trail')], pins = [...chart.querySelectorAll('.pin')];
  const bird = chart.querySelector('.carrier'), bloom = chart.querySelector('.bloom'), plates = [...chart.querySelectorAll('.plate')];
  const marks = [...log.querySelectorAll('[data-step]')], chapters = [...log.querySelectorAll('.leg')], thread = log.querySelector('.thread');
  const lens = legs.map(l => l.getTotalLength());

  if (calm || thrifty) document.querySelectorAll('.flight').forEach(f => f.classList.add('calm'));   // no film then: the helicopter is simply there
  // Films and the helicopter only run while their plate is on stage
  const wake = (plate, on) => {
    if (calm || thrifty) return;
    plate.querySelectorAll('video[data-src]').forEach(v => {
      if (!on) return v.pause();
      if (!v.src) { v.addEventListener('playing', () => v.classList.add('on'), { once: true }); v.src = v.dataset.src; }
      v.play().catch(() => {});
    });
    plate.querySelectorAll('canvas[data-src]').forEach(c => on ? film(c) : c.film && c.film.pause());
  };
  // The helicopter, the Teide and the night sky are little films of ink on white. Each frame is drawn to a canvas and the white
  // is made see-through, so the engraving lies on the paper itself. data-key gives the lightness that turns fully clear and
  // the one that stays fully solid; data-keep is a disc that is never cleared (the moon stays white). The owl film brings
  // its own outline instead, in its lower half, because the owl is partly white itself.
  // The graphics chip does this (a few lines of shader); only where WebGL is missing does the processor go through the pixels
  const VERT = 'attribute vec2 p; varying vec2 uv; void main() { uv = p * vec2(.5, -.5) + .5; gl_Position = vec4(p, 0., 1.); }';
  const FRAG = `precision mediump float; varying vec2 uv; uniform sampler2D t; uniform vec2 key; uniform vec4 keep; uniform float stacked, px;
    void main() {
      vec3 c = texture2D(t, stacked > .5 ? vec2(uv.x, uv.y * .5) : uv).rgb; float a;
      if (stacked > .5) a = texture2D(t, vec2(uv.x, .5 + uv.y * .5)).r;
      else {
        a = clamp((key.x - min(c.r, min(c.g, c.b))) / (key.x - key.y), 0., 1.);
        if (keep.z > 0.) a = max(a, clamp((keep.z - distance(vec2(uv.x, uv.y * keep.w), keep.xy)) * px + 1., 0., 1.));
      }
      gl_FragColor = vec4(c * a, a);
    }`;
  const shader = (c, v, stacked, hi, lo, keep) => {
    const gl = c.getContext('webgl', { antialias: false, preserveDrawingBuffer: true }); if (!gl) return null;
    const part = (type, src) => { const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh); return sh; };
    const pr = gl.createProgram(); gl.attachShader(pr, part(gl.VERTEX_SHADER, VERT)); gl.attachShader(pr, part(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(pr); gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const at = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(at); gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE)); [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, gl.LINEAR));
    const set = n => gl.getUniformLocation(pr, n);
    gl.uniform2f(set('key'), hi / 255, lo / 255); gl.uniform4f(set('keep'), keep[0], keep[1], keep[2], c.height / c.width); gl.uniform1f(set('stacked'), stacked ? 1 : 0); gl.uniform1f(set('px'), c.width);
    let lost = false; c.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; c.parentElement.classList.remove('on'); });   // the still picture takes over
    return () => { if (lost) return false; gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, v); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); return true; };
  };
  const byHand = (c, v, stacked, hi, lo, keep) => {
    const w = c.width, h = c.height, ctx = c.getContext('2d', { willReadFrequently: true }); if (!ctx) return null;
    const work = stacked ? Object.assign(document.createElement('canvas'), { width: w, height: h * 2 }).getContext('2d', { willReadFrequently: true }) : ctx, gain = 255 / (hi - lo);
    let solid = null;
    if (keep[2]) { solid = new Uint8Array(w * h); for (let y = 0, p = 0; y < h; y++) for (let x = 0; x < w; x++, p++) solid[p] = clamp(keep[2] * w + 1 - Math.hypot(x - keep[0] * w, y - keep[1] * w), 0, 1) * 255; }
    return () => {
      work.drawImage(v, 0, 0, w, stacked ? h * 2 : h);
      const im = work.getImageData(0, 0, w, stacked ? h * 2 : h), d = im.data, n = w * h * 4;
      if (stacked) for (let i = 0; i < n; i += 4) d[i + 3] = d[i + n];
      else for (let i = 0, p = 0; i < n; i += 4, p++) {
        const light = Math.min(d[i], d[i + 1], d[i + 2]), al = light > hi ? 0 : light < lo ? 255 : (hi - light) * gain;
        d[i + 3] = solid && solid[p] > al ? solid[p] : al;
      }
      ctx.putImageData(im, 0, 0, 0, 0, w, h); return true;
    };
  };
  const film = c => {
    if (c.film) return void c.film.play().catch(() => {});
    const v = c.film = Object.assign(document.createElement('video'), { muted: true, loop: true, playsInline: true, src: c.dataset.src });
    v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
    const [hi, lo] = (c.dataset.key || '232,150').split(',').map(Number), keep = (c.dataset.keep || '0,0,0').split(',').map(Number), stacked = 'alpha' in c.dataset;
    const draw = shader(c, v, stacked, hi, lo, keep) || byHand(c, v, stacked, hi, lo, keep);
    const frame = () => {
      if (v.paused || v.ended || !draw || !draw()) return;
      c.parentElement.classList.add('on');
      v.requestVideoFrameCallback ? v.requestVideoFrameCallback(frame) : requestAnimationFrame(frame);
    };
    v.addEventListener('playing', frame);
    v.play().catch(() => {});
  };

  // The line: `drawn` runs from 0 to 4 legs and follows `goal`; the swallow sits at its tip
  let goal = 0, drawn = 0, flying = false, step = -1, bloomAt = 0;
  const paint = () => {
    legs.forEach((l, i) => { l.style.strokeDashoffset = (1 - clamp(drawn - i, 0, 1)).toFixed(4); });
    pins.forEach(p => p.classList.toggle('seen', drawn >= ARRIVE[p.dataset.pin] - .03));
    const i = clamp(Math.ceil(drawn) - 1, 0, legs.length - 1), u = clamp(drawn - i, 0, 1), back = goal < drawn;
    const p = legs[i].getPointAtLength(u * lens[i]), q = legs[i].getPointAtLength(clamp(u + (back ? -.02 : .02), 0, 1) * lens[i]);
    const k = stage.clientWidth / W, ang = Math.atan2(q.y - p.y, q.x - p.x), z = +getComputedStyle(stage).getPropertyValue('--z') || 1;
    bird.style.transform = `translate3d(${(p.x * k).toFixed(1)}px, ${(p.y * k).toFixed(1)}px, 0) rotate(${ang.toFixed(3)}rad) scale(${(1 / z).toFixed(3)}, ${((Math.cos(ang) < 0 ? -1 : 1) / z).toFixed(3)})`;
  };
  const arrived = () => {
    const pin = step >= 0 && STEPS[step][0];
    pins.forEach(p => p.classList.toggle('now', !chart.classList.contains('all') && p.dataset.pin === pin));
    if (pin && !chart.classList.contains('all') && !calm) { const el = pins.find(p => p.dataset.pin === pin); bloom.style.left = el.style.left; bloom.style.top = el.style.top; bloom.classList.add('on'); }
  };
  const fly = () => {
    const gap = goal - drawn;
    if (Math.abs(gap) < .003) { drawn = goal; paint(); bird.classList.remove('up'); flying = false; return arrived(); }
    drawn += Math.sign(gap) * Math.min(Math.abs(gap), clamp(Math.abs(gap) * .03, .004, .0095));
    paint(); requestAnimationFrame(fly);
  };
  const send = n => {
    goal = n; bloom.classList.remove('on'); pins.forEach(p => p.classList.remove('now'));
    if (calm || Math.abs(goal - drawn) < .003) { drawn = goal; paint(); return arrived(); }
    if (!flying) { flying = true; bird.classList.add('up'); requestAnimationFrame(fly); }
  };
  const look = ([cx, cy, z]) => {
    const tx = clamp(W / 2 - cx * z, W - W * z, 0), ty = clamp(H / 2 - cy * z, H - H * z, 0);
    stage.style.setProperty('--z', z); stage.style.transform = `translate3d(${(tx / W * 100).toFixed(2)}%, ${(ty / H * 100).toFixed(2)}%, 0) scale(${z})`;
  };

  const show = n => {
    if (n === step) return; step = n;
    const [, far, plate, view] = STEPS[n];
    if (!chart.classList.contains('all')) { send(far); look(view); }
    plates.forEach(p => { const on = p.dataset.plate === plate; p.classList.toggle('on', on); if (wide.matches) wake(p, on); });
    chapters.forEach(c => c.classList.toggle('seen', +c.dataset.step <= n));
  };
  let queued = false;
  const read = () => {
    queued = false;
    const line = innerHeight * .62;                        // a chapter counts once its heading has come two thirds up the screen
    let n = 0; for (const m of marks) if (m.getBoundingClientRect().top < line) n = Math.max(n, +m.dataset.step);
    show(n);
    const box = log.getBoundingClientRect();               // phones: the thread at the edge grows with the reading
    thread.style.transform = `scale3d(1, ${clamp((line - box.top) / box.height, 0, 1).toFixed(4)}, 1)`;
  };
  const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(read); } };
  // On a phone the chart is not pinned beside the text: it shows the whole journey once, when it comes into view,
  // and the engravings in the text wake up as they are scrolled to. With reduced motion the journey is simply there
  let once = null;
  const mode = () => {
    chart.classList.remove('all'); step = -1; if (once) once.disconnect();
    if (calm || !wide.matches) {
      chart.classList.add('all'); stage.style.transform = ''; stage.style.setProperty('--z', 1); bloom.classList.remove('on');
      if (calm) send(4);
      else { drawn = goal = 0; paint(); once = new IntersectionObserver(seen => { if (seen.some(e => e.isIntersecting)) { send(4); once.disconnect(); } }, { threshold: .5 }); once.observe(chart.querySelector('.map')); }
    }
    read();
  };
  const inText = new IntersectionObserver(seen => seen.forEach(e => wake(e.target, e.isIntersecting)), { threshold: .25 });
  log.querySelectorAll('.plate').forEach(p => inText.observe(p));
  wide.addEventListener('change', mode);
  addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', () => { paint(); onScroll(); }, { passive: true });
  // Easter egg: click the helicopter and it leaves the picture to the right and comes back in from the left, with its sound.
  // It never turns round: a film seen from the side cannot, and a mirrored helicopter looks wrong
  const root = document.documentElement;
  // It is heard as well: a recording of turbine whine and rotor chop follows the flight from ear to ear, fades with the
  // distance, and drops a little in pitch while the helicopter flies away. Loaded on the first click only
  let air = null, engine = null, voice = null;
  const hear = (start, span, x0) => {                     // take-off time, length of the flight in ms, where it hovers (-1 left … 1 right)
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    air = air || new AC(); air.resume();
    engine = engine || fetch('assets/audio/alouette.mp3').then(r => r.arrayBuffer()).then(b => new Promise((ok, no) => air.decodeAudioData(b, ok, no)));
    engine.then(buf => {
      const late = (performance.now() - start) / 1000, T = span / 1000; if (late > T * .7) return;
      const src = air.createBufferSource(), vol = air.createGain(), pan = air.createStereoPanner ? air.createStereoPanner() : null;
      src.buffer = buf; src.connect(vol); (pan ? vol.connect(pan) : vol).connect(air.destination);
      const now = air.currentTime, at = f => Math.max(now, now - late + f * T);
      const line = (param, pts) => { param.setValueAtTime(pts[0][1], now); pts.forEach(([f, v]) => param.linearRampToValueAtTime(v, at(f))); };
      line(vol.gain, [[0, 0], [.05, .36], [.2, .5], [.42, .07], [.47, .07], [.8, .46], [.92, .36], [1, .2], [1.2, 0]]);
      if (pan) line(pan.pan, [[0, x0], [.12, x0], [.42, 1], [.47, -1], [.9, x0], [1.2, x0]]);   // out on the right, round the back, in on the left
      line(src.playbackRate, [[0, 1], [.12, 1.03], [.42, .95], [.47, 1.05], [.9, 1], [1.2, 1]]);
      src.start(now, Math.min(late, 1)); src.stop(at(1.21)); voice = vol;
    }).catch(() => { engine = null; });
  };
  document.querySelectorAll('.flight').forEach(f => f.addEventListener('click', () => {
    if (f.away) return void caught(f);
    if (calm || !f.classList.contains('on')) return;
    const r = f.getBoundingClientRect(), out = innerWidth - r.left + 30, back = -(r.right + 30), up = -clamp(r.top - 100, 20, 110);
    const at = (x, y, pitch) => `translate3d(${x.toFixed(0)}px, ${y.toFixed(0)}px, 0) rotate(${pitch}deg)`;
    f.away = true; f.classList.add('away'); root.classList.add('flying');
    hear(performance.now(), 9500, clamp((r.left + r.width / 2) / innerWidth * 2 - 1, -1, 1) * .8);
    f.animate([
      { transform: at(0, 0, 0), easing: 'cubic-bezier(.5, 0, .9, .6)' },                              // nose down, it gathers speed
      { transform: at(out * .07, up * .15, 7), offset: .12, easing: 'cubic-bezier(.45, 0, .9, .7)' },
      { transform: at(out, up, 9), offset: .42 },                                                    // gone on the right ...
      { transform: at(back, up * .8, 5), offset: .42, easing: 'cubic-bezier(.1, .55, .3, 1)' },      // ... and in again on the left
      { transform: at(-r.width * .1, up * .08, -6), offset: .9, easing: 'ease-out' },                // nose up, it slows down
      { transform: at(0, 0, 0) }], { duration: 9500 }).onfinish = () => { f.away = false; f.classList.remove('away'); root.classList.remove('flying'); };
  }));
  // ... and whoever manages to click it a second time, in mid-flight, has caught it: that opens "Was soll das werden?", a
  // flying lesson (js/flight.js). The game is fetched only then
  let lesson = false, fetching = null;
  const caught = f => {
    if (lesson) return; lesson = true;
    if (voice && air) { voice.gain.cancelScheduledValues(air.currentTime); voice.gain.setTargetAtTime(0, air.currentTime, .12); }   // one world of sound at a time
    fetching = fetching || new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'js/flight.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
    fetching.then(() => window.flightLesson.open(f)).catch(() => { lesson = false; fetching = null; });
  };
  document.addEventListener('lesson:open', () => rest(true));
  document.addEventListener('lesson:close', () => { lesson = false; stir(); });
  // Easter egg: when the snowboarder leans into his turn (pointer over his chapter, or a tap on him), powder flies off to the
  // left across the text: a cloud of very fine blue dots, the way the spray in the engraving is stippled
  const rider = log.querySelector('.find');
  if (rider && !calm) {
    const leg = rider.closest('.leg'), TINT = ['31, 63, 151', '31, 63, 151', '31, 63, 151', '18, 38, 95', '92, 116, 186'];
    let cv, ctx, flakes = [], snowing = false, lastSpray = 0, pour = 0, from = [0, 0, 0, 0], then = 0;
    const snow = t => {
      const k = Math.min(2.5, (t - then) / 16.7); then = t;
      if (pour > 0) {                                                 // the turn throws snow for a good half second
        pour -= k;
        for (let n = Math.round(42 * k); n > 0; n--) flakes.push({
          x: from[0] + from[2] * (.2 + Math.random() * .45), y: from[1] + from[3] * (.62 + Math.random() * .3),
          vx: -(1.6 + Math.random() * 11.4), vy: -(.1 + Math.random() * 4.6), s: .6 + Math.random() * Math.random() * 1.1, a: .3 + Math.random() * .65, age: 0, life: 44 + Math.random() * 96,
          c: TINT[Math.random() * TINT.length | 0] });
      }
      ctx.clearRect(0, 0, cv.width, cv.height);
      flakes = flakes.filter(f => f.age < f.life);
      for (const f of flakes) {
        f.x += f.vx * k; f.y += f.vy * k; f.vx *= Math.pow(.968, k); f.vy = f.vy * Math.pow(.98, k) + (.04 + (Math.random() - .5) * .16) * k; f.age += k;   // fine powder hangs in the air and drifts
        ctx.fillStyle = `rgba(${f.c}, ${(f.a * Math.min(1, (f.life - f.age) / 30)).toFixed(2)})`;
        ctx.fillRect(f.x, f.y, f.s, f.s);
      }
      if (flakes.length || pour > 0) requestAnimationFrame(snow); else snowing = false;
    };
    const spray = () => {
      const now = performance.now(); if (now - lastSpray < 1500) return; lastSpray = now;
      if (!cv) { cv = document.createElement('canvas'); cv.className = 'powder'; cv.setAttribute('aria-hidden', 'true'); leg.appendChild(cv); ctx = cv.getContext('2d'); }
      const box = leg.getBoundingClientRect(), r = rider.getBoundingClientRect();
      if (!snowing) { const d = Math.min(devicePixelRatio || 1, 2); cv.width = Math.round(box.width * d); cv.height = Math.round(box.height * d); ctx.setTransform(d, 0, 0, d, 0, 0); }
      from = [r.left - box.left, r.top - box.top, r.width, r.height]; pour = 46;
      if (!snowing) { snowing = true; then = now; requestAnimationFrame(snow); }
    };
    leg.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') spray(); });
    const carve = () => { rider.classList.add('carve'); setTimeout(() => rider.classList.remove('carve'), 1700); spray(); };
    rider.addEventListener('click', carve);
    if (matchMedia('(hover: none)').matches) {                         // no pointer to lean him: he carves once as he is scrolled into view
      const seen = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { seen.disconnect(); setTimeout(carve, 500); } }, { threshold: 1 });
      seen.observe(rider);
    }
  }
  // Nothing is decoded or drawn for a tab nobody looks at
  // ... and nothing either when the page has been left alone for three minutes; the next movement wakes it
  let resting = [], asleep = false, nap;
  const rest = on => {
    if (on && !asleep) { asleep = true; resting = [...document.querySelectorAll('video'), ...[...document.querySelectorAll('canvas[data-src]')].map(c => c.film).filter(Boolean)].filter(v => !v.paused); resting.forEach(v => v.pause()); root.classList.add('rest'); }
    else if (!on && asleep && !document.hidden) { asleep = false; resting.forEach(v => v.play().catch(() => {})); resting = []; root.classList.remove('rest'); }
  };
  const stir = () => { if (lesson) return; rest(false); clearTimeout(nap); nap = setTimeout(() => rest(true), 180000); };
  document.addEventListener('visibilitychange', () => document.hidden ? rest(true) : stir());
  if (!calm) { ['pointermove', 'pointerdown', 'touchstart', 'keydown', 'wheel', 'scroll'].forEach(k => addEventListener(k, stir, { passive: true })); stir(); }
  // the towers of the Frauenkirche show Munich time, as they do on the skull
  const tick = () => {
    const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()).split(':').map(Number);
    document.querySelectorAll('.dial').forEach(d => { d.querySelector('.h').style.setProperty('--a', (h % 12 + m / 60) * 30 + 'deg'); d.querySelector('.m').style.setProperty('--a', m * 6 + 'deg'); });
  };
  tick(); setInterval(tick, 20000);
  mode();
})();
