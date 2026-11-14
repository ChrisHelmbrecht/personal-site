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
  // its own outline instead, frame by frame, because the owl is partly white itself
  const film = c => {
    if (c.film) return void c.film.play().catch(() => {});
    const v = c.film = Object.assign(document.createElement('video'), { muted: true, loop: true, playsInline: true, src: c.dataset.src });
    v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
    const w = c.width, h = c.height, ctx = c.getContext('2d', { willReadFrequently: true });
    const stacked = 'alpha' in c.dataset;                 // the film carries its own matte in its lower half (the owl)
    const work = stacked ? Object.assign(document.createElement('canvas'), { width: w, height: h * 2 }).getContext('2d', { willReadFrequently: true }) : ctx;
    const [hi, lo] = (c.dataset.key || '232,150').split(',').map(Number), gain = 255 / (hi - lo);
    let solid = null;
    if (c.dataset.keep) {
      const [cx, cy, r] = c.dataset.keep.split(',').map(n => n * w); solid = new Uint8Array(w * h);
      for (let y = 0, p = 0; y < h; y++) for (let x = 0; x < w; x++, p++) solid[p] = clamp(r + 1 - Math.hypot(x - cx, y - cy), 0, 1) * 255;
    }
    const frame = () => {
      if (v.paused || v.ended) return;
      work.drawImage(v, 0, 0, w, stacked ? h * 2 : h);
      const im = work.getImageData(0, 0, w, stacked ? h * 2 : h), d = im.data, n = w * h * 4;
      if (stacked) for (let i = 0; i < n; i += 4) d[i + 3] = d[i + n];
      else for (let i = 0, p = 0; i < n; i += 4, p++) {
        const light = Math.min(d[i], d[i + 1], d[i + 2]), al = light > hi ? 0 : light < lo ? 255 : (hi - light) * gain;
        d[i + 3] = solid && solid[p] > al ? solid[p] : al;
      }
      ctx.putImageData(im, 0, 0, 0, 0, w, h);
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
  // Easter egg: click the helicopter and it leaves the picture to the right and comes back in from the left.
  // It never turns round: a film seen from the side cannot, and a mirrored helicopter looks wrong
  const root = document.documentElement;
  document.querySelectorAll('.flight').forEach(f => f.addEventListener('click', () => {
    if (calm || f.away || !f.classList.contains('on')) return;
    const r = f.getBoundingClientRect(), out = innerWidth - r.left + 30, back = -(r.right + 30), up = -clamp(r.top - 100, 20, 110);
    const at = (x, y, pitch) => `translate3d(${x.toFixed(0)}px, ${y.toFixed(0)}px, 0) rotate(${pitch}deg)`;
    f.away = true; root.classList.add('flying');
    f.animate([
      { transform: at(0, 0, 0), easing: 'cubic-bezier(.5, 0, .9, .6)' },                              // nose down, it gathers speed
      { transform: at(out * .07, up * .15, 7), offset: .12, easing: 'cubic-bezier(.45, 0, .9, .7)' },
      { transform: at(out, up, 9), offset: .42 },                                                    // gone on the right ...
      { transform: at(back, up * .8, 5), offset: .42, easing: 'cubic-bezier(.1, .55, .3, 1)' },      // ... and in again on the left
      { transform: at(-r.width * .1, up * .08, -6), offset: .9, easing: 'ease-out' },                // nose up, it slows down
      { transform: at(0, 0, 0) }], { duration: 9500 }).onfinish = () => { f.away = false; root.classList.remove('flying'); };
  }));
  // Easter egg: when the snowboarder leans into his turn (pointer over his chapter, or a tap on him), powder flies off to the
  // left across the text: small square flakes, the way the spray in the engraving is made of dots
  const rider = log.querySelector('.find');
  if (rider && !calm) {
    const leg = rider.closest('.leg'), TINT = ['255, 255, 255', '255, 255, 255', '250, 252, 255', '158, 176, 218', '92, 116, 186', '31, 63, 151'];
    let cv, ctx, flakes = [], snowing = false, lastSpray = 0, pour = 0, from = [0, 0, 0, 0], then = 0;
    const snow = t => {
      const k = Math.min(2.5, (t - then) / 16.7); then = t;
      if (pour > 0) {                                                 // the turn throws snow for a good half second
        pour -= k;
        for (let n = Math.round(10 * k); n > 0; n--) flakes.push({
          x: from[0] + from[2] * (.2 + Math.random() * .45), y: from[1] + from[3] * (.62 + Math.random() * .3),
          vx: -(2.6 + Math.random() * 10.4), vy: -(.2 + Math.random() * 4.4), s: 2 + (Math.random() * 2.6 | 0), age: 0, life: 48 + Math.random() * 76,
          c: TINT[Math.random() * TINT.length | 0] });
      }
      ctx.clearRect(0, 0, cv.width, cv.height);
      flakes = flakes.filter(f => f.age < f.life);
      for (const f of flakes) {
        f.x += f.vx * k; f.y += f.vy * k; f.vx *= Math.pow(.972, k); f.vy = f.vy * Math.pow(.985, k) + .055 * k; f.age += k;
        ctx.fillStyle = `rgba(${f.c}, ${Math.min(1, (f.life - f.age) / 26).toFixed(2)})`;
        ctx.fillRect(Math.round(f.x), Math.round(f.y), f.s, f.s);
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
  // the towers of the Frauenkirche show Munich time, as they do on the skull
  const tick = () => {
    const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()).split(':').map(Number);
    document.querySelectorAll('.dial').forEach(d => { d.querySelector('.h').style.setProperty('--a', (h % 12 + m / 60) * 30 + 'deg'); d.querySelector('.m').style.setProperty('--a', m * 6 + 'deg'); });
  };
  tick(); setInterval(tick, 20000);
  mode();
})();
