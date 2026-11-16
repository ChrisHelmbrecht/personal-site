// Bio: a logbook. While the chapters scroll by, a swallow carries an ink line across the chart (Munich, New York, Tenerife, Moscow,
// Munich), the camera follows it, the city of the moment blooms into colour, and the station's engraving comes alive beside it.
(() => {
  const chart = document.getElementById('chart'), log = document.getElementById('log');
  if (!chart || !log) return;
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches, wide = matchMedia('(min-width: 900px)');
  const net = navigator.connection, thrifty = !!net && (net.saveData || /(^|-)2g$/.test(net.effectiveType || ''));
  const W = 1000, H = 660, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), root = document.documentElement;
  //             pin that lights up, legs drawn, plate shown, where the camera looks: x, y on the chart and how close
  const STEPS = [['munich', 0, 'munich', [500, 330, 1]], ['newyork', 1, 'newyork', [418, 246, 1.5]], ['tenerife', 2, 'tenerife', [345, 372, 1.65]], ['moscow', 3, 'moscow', [652, 318, 1.75]],
    [null, 3, 'music', [500, 330, 1]], ['munich', 4, 'home', [716, 214, 2.4]], [null, 4, 'now', [500, 330, 1]]];
  const ARRIVE = { munich: 0, newyork: 1, tenerife: 2, moscow: 3 };          // how much of the line must be drawn before a city counts as reached
  const stage = chart.querySelector('.stage'), legs = [...chart.querySelectorAll('.trail')], pins = [...chart.querySelectorAll('.pin')];
  const bird = chart.querySelector('.carrier'), bloom = chart.querySelector('.bloom'), plates = [...chart.querySelectorAll('.plate')];
  const marks = [...log.querySelectorAll('[data-step]')], chapters = [...log.querySelectorAll('.leg')], thread = log.querySelector('.thread');
  const lens = legs.map(l => l.getTotalLength());

  if (calm || thrifty) document.querySelectorAll('.flight').forEach(f => f.classList.add('calm'));   // no film then: the helicopter is simply there
  // One rule for every film on this page: it runs only while its engraving is on show, the page is being looked at and no pop-up
  // lies over it. `sync` applies the rule, and everything that changes one of the three calls it
  const inView = new Set(); let idle = false, covered = false;
  const showing = p => p.closest('.plates') ? wide.matches && p.classList.contains('on') : !wide.matches && inView.has(p);
  const sync = () => { const awake = !document.hidden && !idle && !covered; root.classList.toggle('rest', !awake); document.querySelectorAll('.plate').forEach(p => wake(p, awake && showing(p))); };
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
    const part = (type, src) => { const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh); return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null; };
    const vs = part(gl.VERTEX_SHADER, VERT), fs = part(gl.FRAGMENT_SHADER, FRAG), pr = gl.createProgram(); if (!vs || !fs) return null;   // a graphics chip that refuses the shader: the still picture stays
    gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null; gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const at = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(at); gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE)); [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, gl.LINEAR));
    const set = n => gl.getUniformLocation(pr, n);
    gl.uniform2f(set('key'), hi / 255, lo / 255); gl.uniform4f(set('keep'), keep[0], keep[1], keep[2], c.height / c.width); gl.uniform1f(set('stacked'), stacked ? 1 : 0); gl.uniform1f(set('px'), c.width);
    let lost = false; c.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; still(c); });   // the still picture takes over
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
  const still = c => { const box = c.parentElement; box.classList.remove('on'); if (box.classList.contains('flight')) box.classList.add('calm'); };   // back to the still picture; the helicopter must stay visible, it is a way in
  const film = c => {
    if (c.dead) return;
    if (c.film) return void c.film.play().catch(e => { if (e && e.name === 'NotAllowedError') held(c); });
    const v = c.film = Object.assign(document.createElement('video'), { muted: true, loop: true, playsInline: true });
    v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
    const [hi, lo] = (c.dataset.key || '232,150').split(',').map(Number), keep = (c.dataset.keep || '0,0,0').split(',').map(Number), stacked = 'alpha' in c.dataset;
    let draw = null; try { draw = shader(c, v, stacked, hi, lo, keep) || byHand(c, v, stacked, hi, lo, keep); } catch (e) {}
    const fail = () => { c.dead = true; v.pause(); still(c); };     // no way to draw it, or no film: nothing is decoded for nothing
    if (!draw) return fail();
    const frame = () => {
      if (v.paused || v.ended) return;
      let ok = false; try { ok = draw(); } catch (e) {} if (!ok) return fail();
      c.parentElement.classList.add('on');
      v.requestVideoFrameCallback ? v.requestVideoFrameCallback(frame) : requestAnimationFrame(frame);
    };
    v.addEventListener('playing', frame); v.addEventListener('error', fail);
    v.src = c.dataset.src; v.play().catch(e => { if (e && e.name === 'NotAllowedError') held(c); });
  };
  // A phone that is saving power does not start films by itself. Then the still picture stands in, and the first touch starts the films
  let waiting = false;
  const held = c => {
    still(c); if (waiting) return; waiting = true;
    const go = () => { waiting = false; ['pointerup', 'touchend', 'click', 'keydown'].forEach(k => removeEventListener(k, go)); sync(); };
    ['pointerup', 'touchend', 'click', 'keydown'].forEach(k => addEventListener(k, go, { passive: true }));
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
    plates.forEach(p => { const on = p.dataset.plate === plate; p.classList.toggle('on', on); });
    sync();
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
  const inText = new IntersectionObserver(seen => { seen.forEach(e => e.isIntersecting ? inView.add(e.target) : inView.delete(e.target)); sync(); }, { threshold: .25 });
  log.querySelectorAll('.plate').forEach(p => inText.observe(p));
  // Beside the text only one engraving is on show at a time, but the keyboard walks through all of them, and a browser scrolls
  // to whatever is focused, which can turn the page to another chapter. So whatever is focused in an engraving that is not on
  // show, or not fully in view, brings its own chapter up: nothing is ever focused unseen
  const bring = plate => {
    if (!wide.matches || !plate.contains(document.activeElement)) return;
    const r = plate.getBoundingClientRect(); if (plate.classList.contains('on') && r.top >= 0 && r.bottom <= innerHeight) return;
    const n = STEPS.findIndex(s => s[2] === plate.dataset.plate), mark = marks.find(m => +m.dataset.step === n); if (!mark) return;
    const pinned = chart.parentElement.getBoundingClientRect().top + scrollY - 82;                     // from here on the chart stands still beside the text
    scrollTo({ top: Math.max(pinned, mark.getBoundingClientRect().top + scrollY - innerHeight * .45), behavior: 'instant' }); read();
    if (!plate.classList.contains('on')) show(n);                                                       // the last chapter cannot scroll that far
  };
  let follow = []; const letGo = () => { follow.forEach(clearTimeout); follow = []; };
  chart.querySelector('.plates').addEventListener('focusin', e => { const plate = e.target.closest('.plate'); letGo(); if (plate) follow = [0, 350, 900].map(ms => setTimeout(() => bring(plate), ms)); });
  ['wheel', 'touchstart', 'keydown'].forEach(k => addEventListener(k, letGo, { passive: true }));       // whoever scrolls on by hand is not pulled back
  wide.addEventListener('change', mode);
  addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', () => { paint(); onScroll(); }, { passive: true });
  // Easter egg: click the helicopter and it leaves the picture to the right and comes back in from the left, with its sound.
  // It never turns round: a film seen from the side cannot, and a mirrored helicopter looks wrong
  // It is heard as well: a recording of turbine whine and rotor chop follows the flight from ear to ear, fades with the
  // distance, and drops a little in pitch while the helicopter flies away. Loaded on the first click only
  // Sound follows the site's own switch (the button in the header, kept in localStorage as on the start page): off means off
  let air = null, engine = null, voice = null;
  const quiet = () => { try { return localStorage.getItem('sound') === 'off'; } catch (e) { return false; } };
  const hush = (secs = .12) => { if (voice && air) { voice.gain.cancelScheduledValues(air.currentTime); voice.gain.setTargetAtTime(0, air.currentTime, secs); } };
  document.addEventListener('sound:change', () => { if (quiet()) hush(); });
  const hear = (start, span, x0) => {                     // take-off time, length of the flight in ms, where it hovers (-1 left … 1 right)
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC || quiet()) return;
    air = air || new AC(); window.siteSound.wake(air);      // inside the tap, so a phone lets the sound out
    engine = engine || fetch('assets/audio/alouette.mp3').then(r => r.arrayBuffer()).then(b => new Promise((ok, no) => air.decodeAudioData(b, ok, no)));
    engine.then(buf => {
      const late = (performance.now() - start) / 1000, T = span / 1000; if (late > T * .7 || quiet() || document.hidden) return;
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
    invite(f);
    if (calm || !f.classList.contains('on')) return;       // no flight without the film: the invitation is the way in then
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
      { transform: at(0, 0, 0) }], { duration: 9500 }).onfinish = () => { f.away = false; f.classList.remove('away'); root.classList.remove('flying'); f.setAttribute('aria-label', 'Helicopter: take off'); };
    f.setAttribute('aria-label', 'Catch the helicopter: a flying lesson');
  }));
  // ... and whoever manages to click it a second time, in mid-flight, has caught it: that opens "Was soll das werden?", a
  // flying lesson (js/flight.js). The game is fetched only then. Catching it is a game of skill before the game of skill, so the
  // first click also leaves an invitation beside the helicopter for a while: an ordinary button, for fingers and keys alike
  const loads = {};
  const note = (box, text, retry) => {                     // a small message on an engraving: loading, or failed with another try
    let n = box.querySelector('.note'); if (!text) return void (n && n.remove());
    if (!n) { n = document.createElement('p'); n.className = 'note'; n.setAttribute('role', 'status'); box.appendChild(n); }
    n.textContent = text + ' ';
    if (retry) { const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Try again'; b.addEventListener('click', e => { e.stopPropagation(); n.remove(); retry(); }); n.appendChild(b); }
  };
  const need = (src, box, what, again) => {                // fetch a script once; say so if it takes a while, and say so if it fails
    const slow = setTimeout(() => note(box, 'Loading …'), 350);
    loads[src] = loads[src] || new Promise((ok, no) => { const el = document.createElement('script'); el.src = src; el.onload = ok; el.onerror = () => { el.remove(); no(); }; document.head.appendChild(el); });
    return loads[src].then(() => { clearTimeout(slow); note(box, ''); }, () => { clearTimeout(slow); loads[src] = null; note(box, `${what} could not be loaded.`, again); throw 0; });
  };
  let lesson = false;
  const caught = f => {
    if (lesson) return; lesson = true; hush();              // one world of sound at a time
    need('js/flight.js', f.closest('.live'), 'The flying lesson', () => caught(f)).then(() => window.flightLesson.open(f)).catch(() => { lesson = false; });
  };
  const invite = f => {
    const scene = f.closest('.live'); if (scene.querySelector('.invite')) return;
    const p = document.createElement('p'); p.className = 'invite'; p.setAttribute('role', 'status');
    p.innerHTML = '<button type="button"><i lang="de">„Sie wollten doch Pilot werden.“</i><span>Flying lesson</span></button>';
    scene.appendChild(p); requestAnimationFrame(() => requestAnimationFrame(() => p.classList.add('on')));
    let t; const gone = () => { clearTimeout(t); p.classList.remove('on'); setTimeout(() => p.remove(), 700); };
    const stay = () => { clearTimeout(t); t = setTimeout(() => p.matches(':hover, :focus-within') ? stay() : gone(), calm ? 30000 : 14000); };   // it does not leave while someone is on it
    p.firstChild.addEventListener('click', () => { caught(f); gone(); }); stay();
  };
  document.addEventListener('lesson:open', () => { covered = true; sync(); });
  document.addEventListener('lesson:close', () => { covered = false; lesson = false; sync(); stir(); });
  // Two things are hidden in the engravings, with nothing to point at them: each is an invisible button over its picture, so a
  // finger, a mouse and the keyboard all find it. Tenerife opens a pop-up with a film of the sea that can be looked around in
  // (js/pano.js; viewer and film are fetched only then). New York is a plain link to DONT WALK, a game about crossing an avenue
  const PANO = [30656881, 13910081];                         // sizes of the two films in bytes, should the server not say
  const around = b => need('js/pano.js', b.closest('.live'), 'The film', () => around(b)).then(() => window.pano.open({ label: 'Tenerife, in the sea: a 360° film', tag: 'Tenerife · 360°', poster: 'assets/pano/tenerife.webp',
    large: ['assets/pano/tenerife-4k.mp4', PANO[0]], small: ['assets/pano/tenerife-2k.mp4', PANO[1]] }, b)).catch(() => {});
  document.querySelectorAll('.plate[data-plate="tenerife"] .secret').forEach(b => b.addEventListener('click', () => around(b)));
  // Easter egg: when the snowboarder leans into his turn (pointer over his chapter, or a tap on him), powder flies off his back
  // foot towards the words of the headline: a cloud of very fine blue dots, the way the spray in the engraving is stippled
  const rider = log.querySelector('.find');
  if (rider && calm) { rider.tabIndex = -1; rider.setAttribute('aria-hidden', 'true'); }   // nothing moves then, so there is nothing to press
  if (rider && !calm) {
    const leg = rider.closest('.leg'), TINT = ['31, 63, 151', '31, 63, 151', '31, 63, 151', '18, 38, 95', '92, 116, 186'];
    let cv, ctx, flakes = [], snowing = false, lastSpray = 0, pour = 0, from = [0, 0, 0], aim = [-1, -.3, 300], then = 0;   // from: back foot and size of the rider; aim: direction and distance to the headline
    const snow = t => {
      const k = Math.min(2.5, (t - then) / 16.7); then = t;
      if (pour > 0) {                                                 // the turn throws snow for a good half second
        pour -= k;
        for (let n = Math.round(42 * k); n > 0; n--) { const turn = (Math.random() - .5) * .62, c = Math.cos(turn), s = Math.sin(turn), v = aim[2] / 31 * (.12 + Math.random() * 1.05); flakes.push({   // a fan around the line to the headline; the air stops a flake after about 31 times its first step
          x: from[0] + (Math.random() - .5) * from[2] * .12, y: from[1] + (Math.random() - .5) * from[2] * .1,
          vx: (aim[0] * c - aim[1] * s) * v, vy: (aim[0] * s + aim[1] * c) * v, s: .6 + Math.random() * Math.random() * 1.1, a: .3 + Math.random() * .65, age: 0, life: 44 + Math.random() * 96,
          c: TINT[Math.random() * TINT.length | 0] }); }
      }
      ctx.clearRect(0, 0, cv.width, cv.height);
      flakes = flakes.filter(f => f.age < f.life);
      for (const f of flakes) {
        f.x += f.vx * k; f.y += f.vy * k; f.vx *= Math.pow(.968, k); f.vy = f.vy * Math.pow(.968, k) + (.03 + (Math.random() - .5) * .16) * k; f.age += k;   // fine powder hangs in the air and drifts
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
      from = [r.left - box.left + r.width * .4, r.top - box.top + r.height * .56, r.width]; pour = 46;                  // his back foot, in the drawing
      const h = leg.querySelector('h2'), tn = h && h.firstChild, at = tn && tn.nodeType === 3 ? tn.data.indexOf('Force') : -1; let to = h ? h.getBoundingClientRect() : null;
      if (at >= 0) { const rg = document.createRange(); rg.setStart(tn, at); rg.setEnd(tn, tn.data.length); const rs = [...rg.getClientRects()];   // the words "Force to Adventure", wherever the line breaks put them
        if (rs.length) to = { left: Math.min(...rs.map(q => q.left)), right: Math.max(...rs.map(q => q.right)), top: Math.min(...rs.map(q => q.top)), bottom: Math.max(...rs.map(q => q.bottom)) }; }
      if (to) { const dx = (to.left + to.right) / 2 - box.left - from[0], dy = (to.top + to.bottom) / 2 - box.top - from[1], d = Math.hypot(dx, dy) || 1; aim = [dx / d, dy / d, d]; }
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
  // Nothing is decoded or drawn for a tab nobody looks at, and nothing either when the page has been left alone for three
  // minutes; the next movement wakes it. Both only set their part of the rule and let `sync` decide (see the top)
  let nap;
  const stir = () => { if (idle) { idle = false; sync(); } clearTimeout(nap); nap = setTimeout(() => { idle = true; sync(); }, 180000); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) hush(.08); else if (!calm) stir(); sync(); });
  if (!calm) { ['pointermove', 'pointerdown', 'touchstart', 'keydown', 'wheel', 'scroll'].forEach(k => addEventListener(k, stir, { passive: true })); stir(); }
  // the towers of the Frauenkirche show Munich time, as they do on the skull
  const tick = () => {
    const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()).split(':').map(Number);
    document.querySelectorAll('.dial').forEach(d => { d.querySelector('.h').style.setProperty('--a', (h % 12 + m / 60) * 30 + 'deg'); d.querySelector('.m').style.setProperty('--a', m * 6 + 'deg'); });
  };
  tick(); setInterval(tick, 20000);
  mode();
})();
