(() => {
  const $ = id => document.getElementById(id);

  // Header + hamburger menu, shared by every page
  const NAV = [
    ['Music', 'music.html'], ['Bio', 'bio.html'], ['Writing', 'writing.html'], ['Timeline', 'timeline.html'],
    ['Blog', 'blog.html'], ['Contact', 'contact.html'],
  ];
  const OUT = [
    ['Shop', 'https://sublime1.myspreadshop.de/'], ['Fucking Moskau', 'https://fuckingmoskau.de'], ['dieneue.social', 'https://dieneue.social'],
  ];
  document.body.insertAdjacentHTML('afterbegin', `
    <header class="bar">
      <a class="name" href="index.html">Chris Helmbrecht</a>
      <div class="tools">
        ${document.getElementById('skull') ? '<button class="audio" id="audio" type="button" aria-label="Sound" aria-pressed="false"><i></i><i></i><i></i><i></i></button>' : ''}
        <button class="burger" id="burger" aria-label="Menu" aria-expanded="false" aria-controls="menu"><span></span><span></span></button>
      </div>
    </header>
    <nav class="menu" id="menu" aria-label="Site">
      <a href="index.html">The Skull</a>
      ${NAV.map(([t, h]) => `<a href="${h}">${t}</a>`).join('')}
      <small>Elsewhere</small>
      ${OUT.map(([t, h]) => `<a href="${h}" target="_blank" rel="noopener">${t}</a>`).join('')}
    </nav>`);
  const burger = $('burger'), menu = $('menu');
  const setMenu = open => { menu.classList.toggle('open', open); burger.setAttribute('aria-expanded', open); };
  burger.addEventListener('click', () => setMenu(!menu.classList.contains('open')));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

  // Skull: a pool of colour follows the pointer and swells over each doorway
  const skull = $('skull');
  if (skull) {
    const spots = [...skull.querySelectorAll('.spot')];
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mouse = matchMedia('(hover: hover) and (pointer: fine)').matches; // touch devices get no pointer-following
    const pool = skull.querySelector('.trip'), tilt = skull.querySelector('.tilt'), owlBox = $('owl'), city = skull.querySelector('.city');
    // the pool is a disc 60% of the skull wide that is only ever scaled down: x/y in % of the skull, r in px
    const light = (x, y, r) => { pool.style.transform = `translate3d(${(x / .6).toFixed(2)}%, ${(y / .6).toFixed(2)}%, 0) scale(${Math.min(1, r / (skull.clientWidth * .3)).toFixed(3)})`; };
    const lightSpot = s => {
      const st = s.style, w = parseFloat(st.width), h = parseFloat(st.height);
      light(parseFloat(st.left) + w / 2, parseFloat(st.top) + h / 2, Math.max(w, h) / 100 * skull.clientWidth * .72);
    };
    let idle = true, tour = 0, lit = null;
    const wander = () => {
      if (!idle || document.hidden) return;
      lit && lit.classList.remove('lit');
      lit = spots[tour++ % spots.length]; lit.classList.add('lit'); lightSpot(lit);
    };
    if (!calm) { wander(); setInterval(wander, 2600); } else lightSpot(spots[1]);
    spots.forEach(s => s.addEventListener('focus', () => { idle = false; lightSpot(s); }));

    // Depth. With a mouse the skull leans towards the pointer; on touch it sways on its own (CSS only, nothing per frame)
    let diving = false;
    if (calm) { /* rests */ }
    else if (!mouse) skull.classList.add('sway');
    else {
      skull.addEventListener('pointermove', e => {
        idle = false; lit && lit.classList.remove('lit');
        const spot = e.target.closest('.spot');
        skull.classList.toggle('follow', !spot);
        if (spot) return lightSpot(spot);
        const b = skull.getBoundingClientRect();
        light((e.clientX - b.left) / b.width * 100, (e.clientY - b.top) / b.height * 100, b.width * .075);
      }, { passive: true });
      skull.addEventListener('pointerleave', () => { idle = true; skull.classList.remove('follow'); });
      let goal = [0, 0], now = [0, 0], lastMove = 0;
      addEventListener('pointermove', e => { goal = [(e.clientX / innerWidth - .5) * 2, (e.clientY / innerHeight - .5) * 2]; lastMove = performance.now(); }, { passive: true });
      const lean = t => {
        requestAnimationFrame(lean);
        if (diving || document.hidden) return;
        if (t - lastMove > 2500) goal = [Math.sin(t / 2900) * .55, Math.cos(t / 3700) * .4];
        now = now.map((v, k) => v + (goal[k] - v) * .06);
        const [x, y] = now;
        tilt.style.transform = `perspective(1100px) rotateX(${(-y * 3.2).toFixed(2)}deg) rotateY(${(x * 3.2).toFixed(2)}deg)`;
        owlBox.style.transform = `translate3d(${(x * 1.1).toFixed(2)}%, ${(y * .7).toFixed(2)}%, 0)`;
        city.style.transform = `translate3d(${(x * .42).toFixed(2)}%, ${(y * .2).toFixed(2)}%, 0)`;
      };
      requestAnimationFrame(lean);
    }

    // Stars in the dome
    const stars = $('stars');
    [[37, 17], [40.5, 12.5], [43, 19.5], [44.5, 10.5], [41, 23], [60.5, 11], [62.5, 16], [64, 21.5], [59.5, 18.5], [66, 26], [35, 25], [61.5, 24]].forEach(([x, y], k) => {
      stars.insertAdjacentHTML('beforeend', `<i style="left:${x}%;top:${y}%;animation-delay:${-(k * .83 % 3.4).toFixed(2)}s;animation-duration:${2.6 + k % 4 * .7}s"></i>`);
    });

    // The Frauenkirche clocks show Munich time
    const clocks = skull.querySelectorAll('.clock');
    const tick = () => {
      const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()).split(':').map(Number);
      clocks.forEach(c => { c.querySelector('.h').style.setProperty('--a', (h % 12 + m / 60) * 30 + 'deg'); c.querySelector('.m').style.setProperty('--a', m * 6 + 'deg'); });
    };
    tick(); setInterval(tick, 20000);

    // The owl blinks, and now and then leans over for a look
    const owl = $('owl');
    const once = (cls, ms) => { owl.classList.add(cls); setTimeout(() => owl.classList.remove(cls), ms); };
    const blink = () => { if (!owl.classList.contains('away')) once('blink', 170); if (Math.random() < .25) setTimeout(() => once('blink', 150), 320); setTimeout(blink, 2600 + Math.random() * 4200); };
    if (!calm) { setTimeout(blink, 1800); setInterval(() => once('peek', 2400), 17000); }
    // A snowboarder drops in on the Teide when the pointer reaches the mountain (tap on touch)
    const rider = $('rider');
    const ride = () => { if (!calm && !rider.classList.contains('go')) { rider.classList.add('go'); setTimeout(() => rider.classList.remove('go'), 3500); } };
    $('teide').addEventListener('pointerenter', ride);
    $('teide').addEventListener('click', ride);

    // Mushroom men come down the upper path and slip away behind the teeth, before the figure further down
    const PATH = [[47.2, 64.1], [45.2, 65.3], [43.9, 67.2], [45.4, 68.9], [47.6, 70.1], [48.7, 70.6]]; // feet, in % of the skull
    const TURN = 2, LAST = PATH.length - 1, WALK = 13000;                                                // they turn around at the bend
    const march = $('march');
    const walk = (k, delay) => {
      const man = document.createElement('span');
      man.innerHTML = `<b><img src="assets/mushman-${k}.webp" alt=""></b>`;
      march.appendChild(man);
      const opts = { duration: WALK, delay, fill: 'both', easing: 'linear' };
      const run = man.animate(PATH.map(([x, y], i) => ({ transform: `translate3d(${x}%, ${y}%, 0)`, opacity: i === 0 || i === LAST ? 0 : 1, offset: i / LAST })), opts);
      const size = i => (.5 + i / LAST * .4).toFixed(2);
      const frames = PATH.map((p, i) => ({ transform: `scale(${i <= TURN ? -size(i) : size(i)}, ${size(i)})`, offset: i / LAST }));
      frames.splice(TURN + 1, 0, { transform: `scale(${size(TURN)}, ${size(TURN)})`, offset: (TURN + .22) / LAST }); // quick turn, then on
      man.firstChild.animate(frames, opts);
      run.onfinish = () => man.remove();
    };
    let marching = false;
    const parade = () => {
      if (calm || marching || document.hidden) return;
      marching = true; [1, 2, 3, 4, 5].forEach((k, i) => walk(k, i * 2300)); setTimeout(() => { marching = false; }, WALK + 4 * 2300 + 500);
    };
    skull.querySelector('.spot[href="timeline.html"]').addEventListener('pointerenter', parade);
    setTimeout(parade, 9000); setInterval(parade, 48000);

    // Mushrooms sprout wherever you click the skull itself
    const sprouts = $('sprouts');
    let grown = 0;
    tilt.addEventListener('click', e => {
      if (e.target.closest('.spot, .branch, .teide')) return;
      const b = tilt.getBoundingClientRect(), x = (e.clientX - b.left) / b.width * 100, y = (e.clientY - b.top) / b.height * 100;
      if (Math.hypot(x - 50, (y - 50) * .82) > 37) return; // only on the skull, not the paper
      const m = document.createElement('span');
      m.style.cssText = `left:${x}%;top:${y}%`; m.innerHTML = '<img src="assets/mushrooms.webp" alt="">';
      if (Math.random() < .5) m.firstChild.style.transform = 'scaleX(-1)';
      sprouts.appendChild(m); setTimeout(() => m.remove(), 7000);
      // easter egg: ten mushrooms and the whole skull trips for a while
      if (++grown % 10 === 0) { skull.classList.add('full'); setTimeout(() => skull.classList.remove('full'), 9000); }
    });

    // Easter egg: shake the branch three times and the owl takes off
    let shakes = 0, gone = false;
    $('branch').addEventListener('click', () => {
      if (gone) return;
      if (++shakes < 3) return once('hoot', 700);
      shakes = 0; gone = true; owl.classList.add('away');
      setTimeout(() => { owl.classList.remove('away'); owl.classList.add('back'); }, 14000);
      setTimeout(() => { owl.classList.remove('back'); gone = false; }, 15700);
    });
    // Dive: fly into the clicked doorway, then open its page. The sharp 4K image loads in the background for the close-up
    const hires = $('hires'), veil = $('veil');
    if (!calm && mouse) addEventListener('load', () => { hires.onload = () => hires.classList.add('ready'); hires.src = 'assets/skull-4k.webp'; });
    spots.filter(s => !s.target).forEach(s => s.addEventListener('click', e => {
      if (calm || e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      const st = s.style;
      diving = true; tilt.style.transform = '';
      tilt.style.transformOrigin = `${parseFloat(st.left) + parseFloat(st.width) / 2}% ${parseFloat(st.top) + parseFloat(st.height) / 2}%`;
      document.documentElement.classList.add('diving'); skull.classList.add('dive'); veil.classList.add('on');
      setTimeout(() => { location.href = s.href; }, 1000);
    }));
    addEventListener('pageshow', () => { // coming back with the browser's back button
      document.documentElement.classList.remove('diving'); skull.classList.remove('dive'); veil.classList.remove('on'); diving = false;
    });
    window.owlHoot = () => { if (!calm && !owl.classList.contains('hoot')) once('hoot', 700); };
  }

  // Night sound: a quiet loop through the Web Audio API. Browsers only let audio start on a real
  // gesture (click, tap or key; scrolling alone does not count), so it fades in on the first one.
  const audioBtn = $('audio');
  if (audioBtn) {
    const SRC = 'assets/audio/night-owl.mp3', VOL = .15, FADE = 3;
    const GESTURES = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'];
    let ctx, gain, el, started = false, loading = false, muted = false;
    try { muted = localStorage.getItem('sound') === 'off'; } catch (e) {}
    const paint = () => {
      const playing = started && !muted;
      audioBtn.classList.toggle('playing', playing); audioBtn.classList.toggle('muted', muted);
      audioBtn.setAttribute('aria-pressed', playing); audioBtn.setAttribute('aria-label', playing ? 'Mute sound' : 'Play sound');
    };
    const fade = (to, secs) => {
      if (gain) { const t = ctx.currentTime; gain.gain.cancelScheduledValues(t); gain.gain.setValueAtTime(gain.gain.value, t); gain.gain.linearRampToValueAtTime(to, t + secs); }
      if (el) { el.volume = to; to ? el.play().catch(() => {}) : el.pause(); }
    };
    const start = async () => {
      if (started || loading || muted) return;
      try {
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
        ctx.resume();
        if (ctx.state !== 'running') { ctx.onstatechange = () => { if (ctx.state === 'running') start(); }; return; } // waits for a gesture the browser accepts
        loading = true;
        const buf = await ctx.decodeAudioData(await (await fetch(SRC)).arrayBuffer());
        const node = ctx.createBufferSource(); node.buffer = buf; node.loop = true;
        gain = ctx.createGain(); gain.gain.value = 0; node.connect(gain).connect(ctx.destination); node.start();
        // the owl in the picture moves when the owl in the recording calls
        const ear = ctx.createAnalyser(); ear.fftSize = 1024; node.connect(ear);
        const samples = new Float32Array(ear.fftSize);
        const listen = () => {
          ear.getFloatTimeDomainData(samples);
          const rms = Math.sqrt(samples.reduce((a, v) => a + v * v, 0) / samples.length);
          if (!muted && rms > .09 && window.owlHoot) window.owlHoot();
          requestAnimationFrame(listen);
        };
        listen();
      } catch (err) { // opened straight from disk: plain audio element instead
        el = Object.assign(new Audio(SRC), { loop: true, volume: 0 });
      }
      started = true; loading = false;
      GESTURES.forEach(g => removeEventListener(g, onGesture));
      fade(VOL, FADE); paint();
    };
    const onGesture = e => { if (!(e.target instanceof Element && e.target.closest('#audio'))) start(); }; // the button decides for itself
    GESTURES.forEach(g => addEventListener(g, onGesture, { passive: true }));
    audioBtn.addEventListener('click', () => {
      if (!started) { muted = false; start(); }
      else { muted = !muted; fade(muted ? 0 : VOL, muted ? .4 : 1.2); paint(); }
      try { localStorage.setItem('sound', muted ? 'off' : 'on'); } catch (e) {}
    });
    paint();
  }

  // Timeline: one cover per year, pop-up gallery that closes itself after the last photo
  const years = $('years');
  if (years) {
    const data = window.TIMELINE || [], dlg = $('gallery'), slide = $('g-slide');
    if (data.some(y => !y.images.length)) $('tl-note').textContent = 'Photos still to come. The dashed frames are where they go.';
    let cur = null, i = 0;
    const frames = y => y.images.length || 4;
    const show = () => {
      const src = cur.images[i];
      slide.innerHTML = src ? `<img src="${src}" alt="${cur.year}, photo ${i + 1}">` : `<span class="ph">${cur.year}<br>photo ${i + 1} of ${frames(cur)} goes here</span>`;
      $('g-count').textContent = `${i + 1} / ${frames(cur)}`;
    };
    const next = () => { if (++i >= frames(cur)) return dlg.close(); show(); };
    data.forEach(y => {
      const li = document.createElement('li'), cover = y.cover || y.images[0];
      li.innerHTML = `<button class="cover" type="button" aria-label="Open ${y.year} gallery" ${cover ? `style="background-image:url('${cover}')"` : ''}>${cover ? '' : 'Cover photo'}</button>
        <div><div class="year">${y.year}</div>${y.label ? `<p>${y.label}</p>` : ''}</div>`;
      li.querySelector('button').addEventListener('click', () => { cur = y; i = 0; $('g-year').textContent = y.year + (y.label ? ' · ' + y.label : ''); show(); dlg.showModal(); });
      years.appendChild(li);
    });
    slide.addEventListener('click', next);
    $('g-close').addEventListener('click', () => dlg.close());
    dlg.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft' && i > 0) { i--; show(); }
    });
  }
})();
