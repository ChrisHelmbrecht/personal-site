// Bio: a logbook. While the chapters scroll by, an ink line travels across the chart: Munich, New York, Tenerife, Moscow, Munich.
(() => {
  const chart = document.getElementById('chart'), log = document.getElementById('log');
  if (!chart || !log) return;
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches, wide = matchMedia('(min-width: 900px)');
  //             pin that lights up, legs drawn so far, plate shown
  const STEPS = [['munich', 0, 'munich'], ['newyork', 1, 'newyork'], ['tenerife', 2, 'tenerife'], ['moscow', 3, 'moscow'], [null, 3, 'music'], ['munich', 4, 'home'], [null, 4, 'now']];
  const marks = [...log.querySelectorAll('[data-step]')], legs = [...chart.querySelectorAll('.trail')], pins = [...chart.querySelectorAll('.pin')];
  const plates = [...chart.querySelectorAll('.plate')], chapters = [...log.querySelectorAll('.leg')], thread = log.querySelector('.thread');
  let step = -1;
  const show = n => {
    if (n === step) return; step = n;
    const [pin, drawn, plate] = STEPS[n], seen = new Set(STEPS.slice(0, n + 1).map(s => s[0]));
    if (!chart.classList.contains('all')) {
      legs.forEach((l, i) => l.classList.toggle('drawn', i < drawn));
      pins.forEach(p => { p.classList.toggle('seen', seen.has(p.dataset.pin)); p.classList.toggle('now', p.dataset.pin === pin); });
    }
    plates.forEach(p => p.classList.toggle('on', p.dataset.plate === plate));
    chapters.forEach(c => c.classList.toggle('seen', +c.dataset.step <= n));
  };
  let queued = false;
  const read = () => {
    queued = false;
    const line = innerHeight * .62;                        // a chapter counts once its heading has come two thirds up the screen
    let n = 0; for (const m of marks) if (m.getBoundingClientRect().top < line) n = Math.max(n, +m.dataset.step);
    show(n);
    const box = log.getBoundingClientRect();               // phones: the thread at the edge grows with the reading
    thread.style.transform = `scale3d(1, ${Math.max(0, Math.min(1, (line - box.top) / box.height)).toFixed(4)}, 1)`;
  };
  const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(read); } };
  // On a phone the chart is not pinned beside the text, so it draws the whole journey once when it comes into view.
  // With reduced motion the whole journey is simply there.
  const whole = () => { chart.classList.add('all'); legs.forEach(l => l.classList.add('drawn')); pins.forEach(p => p.classList.add('seen')); };
  const mode = () => {
    chart.classList.remove('all'); step = -1;
    if (calm) whole();
    else if (!wide.matches) { legs.forEach(l => l.classList.remove('drawn')); pins.forEach(p => p.classList.remove('seen', 'now')); new IntersectionObserver((seen, io) => { if (seen.some(e => e.isIntersecting)) { whole(); io.disconnect(); } }, { threshold: .5 }).observe(chart.querySelector('.map')); }
    read();
  };
  wide.addEventListener('change', mode);
  addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll, { passive: true });
  mode();
})();
