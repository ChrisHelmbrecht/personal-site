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
    plate.querySelectorAll('canvas.heli').forEach(c => on ? heli(c) : c.film && c.film.pause());
  };
  // The helicopter is a little film on white. Each frame is drawn to a canvas and everything white is made see-through,
  // so the engraving hovers on the paper itself
  const heli = c => {
    if (c.film) return void c.film.play().catch(() => {});
    const v = c.film = Object.assign(document.createElement('video'), { muted: true, loop: true, playsInline: true, src: c.dataset.src });
    const ctx = c.getContext('2d', { willReadFrequently: true }), w = c.width, h = c.height;
    const frame = () => {
      if (v.paused || v.ended) return;
      ctx.drawImage(v, 0, 0, w, h);
      const im = ctx.getImageData(0, 0, w, h), d = im.data;
      for (let i = 0; i < d.length; i += 4) { const light = Math.min(d[i], d[i + 1], d[i + 2]); d[i + 3] = light > 232 ? 0 : light < 150 ? 255 : (232 - light) * 3.1; }
      ctx.putImageData(im, 0, 0);
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
  // Easter egg: click the helicopter and it flies a round over the page. A film cannot really turn, so at the far end
  // it is squeezed flat and opened again facing the other way, which reads as a turn
  document.querySelectorAll('.flight').forEach(f => f.addEventListener('click', () => {
    if (calm || f.away || !f.classList.contains('on')) return;
    const r = f.getBoundingClientRect(), out = Math.max(40, innerWidth - r.right - 16), up = -clamp(r.top - 90, 30, 240);
    const at = (x, y, tilt, face) => ({ transform: `translate3d(${(out * x).toFixed(0)}px, ${(up * y).toFixed(0)}px, 0) rotate(${tilt}deg) scaleX(${face})` });
    f.away = true;
    f.animate([{ ...at(0, 0, 0, 1), offset: 0 }, { ...at(.12, .5, -7, 1), offset: .12 }, { ...at(.7, 1, 5, 1), offset: .36 }, { ...at(1, .85, 0, 1), offset: .46 }, { ...at(1, .8, 0, -1), offset: .53 },
      { ...at(.4, .9, 5, -1), offset: .72 }, { ...at(.04, .1, -4, -1), offset: .9 }, { ...at(0, 0, 0, -1), offset: .94 }, { ...at(0, 0, 0, 1), offset: 1 }], { duration: 11000, easing: 'ease-in-out' }).onfinish = () => { f.away = false; };
  }));
  // the towers of the Frauenkirche show Munich time, as they do on the skull
  const tick = () => {
    const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()).split(':').map(Number);
    document.querySelectorAll('.dial').forEach(d => { d.querySelector('.h').style.setProperty('--a', (h % 12 + m / 60) * 30 + 'deg'); d.querySelector('.m').style.setProperty('--a', m * 6 + 'deg'); });
  };
  tick(); setInterval(tick, 20000);
  mode();
})();
