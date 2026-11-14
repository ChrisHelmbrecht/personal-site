(() => {
  const $ = id => document.getElementById(id);

  // Header + hamburger menu, shared by every page
  const NAV = [
    ['DJ', 'dj.html'], ['Bio', 'bio.html'], ['Writing', 'writing.html'], ['Timeline', 'timeline.html'],
    ['Blog', 'blog.html'], ['Press', 'press.html'], ['Contact', 'contact.html'],
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
  // Inner pages leave a note, so the start page knows where a returning visitor comes from
  if (!document.getElementById('skull')) { try { sessionStorage.setItem('from', location.pathname.split('/').pop() || ''); } catch (e) {} }
  const burger = $('burger'), menu = $('menu');
  const setMenu = open => { menu.classList.toggle('open', open); burger.setAttribute('aria-expanded', open); };
  burger.addEventListener('click', () => setMenu(!menu.classList.contains('open')));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

  // Skull: a pool of colour follows the pointer and swells over each doorway
  const skull = $('skull');
  if (skull) {
    const spots = [...skull.querySelectorAll('.spot')];
    const doors = [...spots, ...skull.querySelectorAll('.egg')]; // the hidden game is a doorway too, just not part of the tour
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mouse = matchMedia('(hover: hover) and (pointer: fine)').matches; // touch devices get no pointer-following
    const pool = skull.querySelector('.trip'), tilt = skull.querySelector('.tilt'), owlBox = $('owl'), city = skull.querySelector('.city');
    // the pool is a disc 60% of the skull wide that is only ever scaled down: x/y in % of the skull, r in px
    const light = (x, y, r) => { pool.style.transform = `translate3d(${(x / .6).toFixed(2)}%, ${(y / .6).toFixed(2)}%, 0) scale(${Math.min(1, r / (skull.clientWidth * .3)).toFixed(3)})`; };
    const lightSpot = s => {
      const st = s.style, w = parseFloat(st.width), h = parseFloat(st.height);
      light(parseFloat(st.left) + w / 2, parseFloat(st.top) + h / 2, Math.max(w, h) / 100 * skull.clientWidth * .72);
    };
    // The tour: with nobody at the controls, one doorway after another blends in (colour and name), rests, and blends out again
    let idle = true, tour = 0, lit = null;
    const STAY = 3800, FADE = 1600, REST = 900;
    const dim = () => { lit && lit.classList.remove('lit'); pool.classList.remove('show'); };
    const wander = () => {
      if (!idle || document.hidden || diving) return void setTimeout(wander, 1500);
      lit = spots[tour++ % spots.length]; lightSpot(lit); lit.classList.add('lit'); pool.classList.add('show');
      setTimeout(() => { if (idle) dim(); setTimeout(wander, FADE + REST); }, STAY);
    };
    skull.classList.add('tour');
    if (!calm) setTimeout(wander, 1500); else { lit = spots[1]; lightSpot(lit); lit.classList.add('lit'); pool.classList.add('show'); }
    spots.forEach(s => s.addEventListener('focus', () => { idle = false; skull.classList.remove('tour'); lit && lit.classList.remove('lit'); lightSpot(s); pool.classList.add('show'); }));

    // Depth. With a mouse the skull leans towards the pointer; on touch it sways on its own (CSS only, nothing per frame)
    let diving = false;
    if (calm) { /* rests */ }
    else if (!mouse) skull.classList.add('sway');
    else {
      skull.addEventListener('pointermove', e => {
        idle = false; lit && lit.classList.remove('lit'); skull.classList.remove('tour'); pool.classList.add('show');
        const spot = e.target.closest('.spot');
        skull.classList.toggle('follow', !spot);
        if (spot) return lightSpot(spot);
        const b = skull.getBoundingClientRect();
        light((e.clientX - b.left) / b.width * 100, (e.clientY - b.top) / b.height * 100, b.width * .075);
      }, { passive: true });
      skull.addEventListener('pointerleave', () => { idle = true; skull.classList.remove('follow'); skull.classList.add('tour'); dim(); });
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

    // Film patches start once the page has loaded, never under reduced motion
    const loadFilm = (v, src, onPlaying) => { v.addEventListener('playing', onPlaying, { once: true }); v.src = src; v.play().catch(() => {}); };
    const owlFilm = $('owlfilm'), pathFilm = $('pathfilm');
    const net = navigator.connection, thrifty = !!net && (net.saveData || /(^|-)2g$/.test(net.effectiveType || '')); // data saver or a very slow line: the drawing stays still, 5 MB of film stay on the server
    if (!calm && !thrifty) addEventListener('load', () => {
      loadFilm(owlFilm, 'assets/video/owl.mp4', () => owlBox.classList.add('filmed'));
      ['city', 'water', 'moon', 'tree', 'crown'].forEach(n => { const v = $(n + 'film'); loadFilm(v, `assets/video/${n}.mp4`, () => v.classList.add('on')); });
      pathFilm.preload = 'auto'; pathFilm.src = 'assets/video/path.mp4'; pathFilm.load();
      pathFilm.addEventListener('canplaythrough', () => setTimeout(wanderOff, 4000), { once: true });
    });

    // The two wanderers on the path: walk off (10 s), path stays empty a moment, the drawing fades back, pause, and again
    let walking = false;
    const wanderOff = () => {
      if (calm || walking || pathFilm.readyState < 3) return;
      if (document.hidden) return void setTimeout(wanderOff, 5000);
      walking = true; pathFilm.classList.remove('leaving'); pathFilm.currentTime = 0;
      pathFilm.play().then(() => pathFilm.classList.add('on')).catch(() => { walking = false; setTimeout(wanderOff, 5000); });
    };
    pathFilm.addEventListener('ended', () => setTimeout(() => {
      pathFilm.classList.add('leaving'); pathFilm.classList.remove('on');
      setTimeout(() => { walking = false; setTimeout(wanderOff, 12000); }, 2600);
    }, 4000));
    skull.querySelector('.spot[href="timeline.html"]').addEventListener('pointerenter', wanderOff);

    // The flock: swallows and the flying girl follow one closed flight path through the whole dome, always nose first.
    // Up from the right, over to the left, down, back behind the owl and past the moon, and round again.
    const ROUTE = [[63, 25], [59.5, 17.5], [52, 13.5], [44, 15], [38, 18.5], [35, 24], [37.5, 28.5], [43.5, 29.5], [50, 27], [56.5, 29.5], [62, 32], [65.5, 29.5]]; // % of the skull
    const LAP = 44000; // one round, in ms
    const track = (() => {            // closed Catmull-Rom curve, sampled at even distances
      const n = ROUTE.length, pts = [];
      for (let i = 0; i < n; i++) {
        const [p0, p1, p2, p3] = [-1, 0, 1, 2].map(k => ROUTE[(i + k + n) % n]);
        for (let u = 0; u < 1; u += 1 / 40) pts.push([0, 1].map(d => .5 * (2 * p1[d] + (p2[d] - p0[d]) * u + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * u * u + (3 * p1[d] - p0[d] - 3 * p2[d] + p3[d]) * u * u * u)));
      }
      const len = [0]; for (let i = 1; i <= pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i % pts.length][0] - pts[i - 1][0], pts[i % pts.length][1] - pts[i - 1][1]));
      const total = len[pts.length], even = [];
      for (let k = 0, i = 0; k < 600; k++) { const want = k / 600 * total; while (len[i + 1] < want) i++; const f = (want - len[i]) / (len[i + 1] - len[i]), a = pts[i], b = pts[(i + 1) % pts.length]; even.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]); }
      return even;
    })();
    const at = s => { const f = ((s % 1) + 1) % 1 * 600, i = Math.floor(f), a = track[i % 600], b = track[(i + 1) % 600]; return [a[0] + (b[0] - a[0]) * (f - i), a[1] + (b[1] - a[1]) * (f - i)]; };
    const flock = $('flock');
    //            lag behind the leader, sideways offset (% of skull), size
    const FLYERS = [[0, 0, 1], [.014, 1.1, .85], [.021, -1, .9], [.034, .5, .78], [.043, -1.5, .82], [.055, 1.4, .72], [.1, -.4, 1]].map(([lag, side, size], k, all) => {
      const girl = k === all.length - 1, el = document.createElement('span');
      el.className = girl ? 'girl' : 'bird';
      el.innerHTML = `<img src="assets/${girl ? 'girl' : 'birds'}.png" alt=""${girl ? '' : ` style="animation-delay:${-k * .37}s;animation-duration:${1.3 + k % 3 * .25}s"`}>`;
      flock.appendChild(el); return { el, lag, side, size };
    });
    const fly = t => {
      const W = skull.clientWidth / 100, lap = t / LAP;
      for (const b of FLYERS) {
        const s = lap - b.lag, [x, y] = at(s), [x2, y2] = at(s + .004);
        const dx = x2 - x, dy = y2 - y, d = Math.hypot(dx, dy) || 1, ang = Math.atan2(dy, dx);
        const px = (x - dy / d * b.side) * W, py = (y + dx / d * b.side + Math.sin(t / 900 + b.lag * 90) * .25) * W;
        const roll = Math.max(-1, Math.min(1, dx / d * 3.5)); // banks through the turn instead of flying on its back
        b.el.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) rotate(${ang.toFixed(3)}rad) scale(${b.size}, ${(b.size * (Math.abs(roll) < .12 ? .12 * Math.sign(roll || 1) : roll)).toFixed(3)})`;
      }
    };
    fly(0);
    if (!calm) { const soar = t => { requestAnimationFrame(soar); if (!document.hidden && !diving) fly(t); }; requestAnimationFrame(soar); }

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
    const blink = () => { if (!owl.classList.contains('away') && !filmed()) once('blink', 170); if (Math.random() < .25) setTimeout(() => once('blink', 150), 320); setTimeout(blink, 2600 + Math.random() * 4200); };
    const filmed = () => owl.classList.contains('filmed'); // once the owl film runs, it does the blinking and looking itself
    if (!calm) { setTimeout(blink, 1800); setInterval(() => { if (!filmed()) once('peek', 2400); }, 17000); }
    // A snowboarder drops in on the Teide when the pointer reaches the mountain (tap on touch)
    const rider = $('rider');
    const ride = () => { if (!calm && !rider.classList.contains('go')) { rider.classList.add('go'); setTimeout(() => rider.classList.remove('go'), 3500); } };
    $('teide').addEventListener('pointerenter', ride);
    $('teide').addEventListener('click', ride);

    // Mushrooms sprout wherever you click the skull itself
    const sprouts = $('sprouts');
    let grown = 0;
    tilt.addEventListener('click', e => {
      if (e.target.closest('.spot, .egg, .branch, .teide')) return;
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
    doors.filter(s => !s.target).forEach(s => s.addEventListener('click', e => {
      if (calm || e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      diving = true; tilt.style.transition = ''; tilt.style.transform = '';
      tilt.style.transformOrigin = originOf(s);
      document.documentElement.classList.add('diving'); skull.classList.add('dive'); veil.classList.add('on');
      setTimeout(() => { location.href = s.href; }, 1000);
    }));
    // Coming back from an inner page: start inside the doorway that was left and pull back out to the whole skull
    const originOf = s => { const st = s.style; return `${parseFloat(st.left) + parseFloat(st.width) / 2}% ${parseFloat(st.top) + parseFloat(st.height) / 2}%`; };
    const settle = () => {
      document.documentElement.classList.remove('diving'); skull.classList.remove('dive'); veil.classList.remove('on', 'hold', 'lift');
      tilt.style.transition = ''; tilt.style.transform = ''; diving = false;
    };
    const readFrom = () => { try { const f = sessionStorage.getItem('from'); sessionStorage.removeItem('from'); return f; } catch (err) { return null; } };
    const zoomedIn = from => {                                           // set up before the first paint, so nothing flashes
      const door = from && doors.find(s => s.getAttribute('href') === from);
      if (door) tilt.style.transformOrigin = originOf(door); else if (from !== null) tilt.style.transformOrigin = '50% 45%';
      diving = true; skull.classList.add('dive'); veil.classList.remove('on'); veil.classList.add('hold');
      tilt.style.transition = 'none'; tilt.style.transform = 'scale(7)';
    };
    let pending = !calm && readFrom();
    if (pending !== null && pending !== false) zoomedIn(pending); else pending = null;
    addEventListener('pageshow', e => {
      if (e.persisted) {                                                 // restored by the back button, still zoomed in
        const from = readFrom();
        if (calm || !skull.classList.contains('dive')) return settle();
        zoomedIn(from);
      } else if (pending === null) return;
      pending = null;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        veil.classList.add('lift'); veil.classList.remove('hold');
        tilt.style.transition = 'transform 1.5s cubic-bezier(.16, .7, .22, 1)'; tilt.style.transform = 'scale(1)';
        setTimeout(settle, 1600);
      }));
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
    let hush; const say = text => { audioBtn.dataset.say = text; audioBtn.classList.add('say'); clearTimeout(hush); hush = setTimeout(() => audioBtn.classList.remove('say'), 2400); };
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
      fade(VOL, FADE); paint(); say('Sound on');
    };
    const onGesture = e => { if (!(e.target instanceof Element && e.target.closest('#audio'))) start(); }; // the button decides for itself
    GESTURES.forEach(g => addEventListener(g, onGesture, { passive: true }));
    audioBtn.addEventListener('click', () => {
      if (!started) { muted = false; start(); }
      else { muted = !muted; fade(muted ? 0 : VOL, muted ? .4 : 1.2); paint(); say(muted ? 'Sound off' : 'Sound on'); }
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
