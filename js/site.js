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
      <button class="burger" id="burger" aria-label="Menu" aria-expanded="false" aria-controls="menu"><span></span><span></span></button>
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
    const light = (x, y, r) => { skull.style.setProperty('--mx', x + '%'); skull.style.setProperty('--my', y + '%'); skull.style.setProperty('--r', r + 'px'); };
    const lightSpot = s => {
      const st = s.style, w = parseFloat(st.width), h = parseFloat(st.height);
      light(parseFloat(st.left) + w / 2, parseFloat(st.top) + h / 2, Math.max(w, h) / 100 * skull.clientWidth * .72);
    };
    let idle = true, tour = 0, lit = null;
    const wander = () => {
      if (!idle) return;
      lit && lit.classList.remove('lit');
      lit = spots[tour++ % spots.length]; lit.classList.add('lit'); lightSpot(lit);
    };
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) { wander(); setInterval(wander, 2600); } else lightSpot(spots[1]);
    skull.addEventListener('pointermove', e => {
      if (e.pointerType === 'touch') return;
      idle = false; lit && lit.classList.remove('lit');
      const spot = e.target.closest('.spot');
      skull.classList.toggle('follow', !spot);
      if (spot) return lightSpot(spot);
      const b = skull.getBoundingClientRect();
      light((e.clientX - b.left) / b.width * 100, (e.clientY - b.top) / b.height * 100, b.width * .075);
    });
    skull.addEventListener('pointerleave', () => { idle = true; skull.classList.remove('follow'); });
    spots.forEach(s => s.addEventListener('focus', () => { idle = false; lightSpot(s); }));

    // Depth: the skull leans towards the pointer; when nobody moves it, it sways on its own
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let goal = [0, 0], now = [0, 0], lastMove = 0;
    addEventListener('pointermove', e => {
      if (e.pointerType === 'touch') return;
      goal = [(e.clientX / innerWidth - .5) * 2, (e.clientY / innerHeight - .5) * 2]; lastMove = performance.now();
    });
    const lean = t => {
      if (t - lastMove > 2500) goal = [Math.sin(t / 2900) * .55, Math.cos(t / 3700) * .4];
      now = now.map((v, k) => v + (goal[k] - v) * .06);
      skull.style.setProperty('--tx', now[0].toFixed(3)); skull.style.setProperty('--ty', now[1].toFixed(3));
      requestAnimationFrame(lean);
    };
    if (!calm) requestAnimationFrame(lean);

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
    // A snowboarder drops in on the Teide: on hover, and every so often on his own
    const rider = $('rider');
    const ride = () => { if (!calm && !rider.classList.contains('go')) { rider.classList.add('go'); setTimeout(() => rider.classList.remove('go'), 3300); } };
    $('teide').addEventListener('pointerenter', ride);
    $('teide').addEventListener('click', ride);
    if (!calm) { setTimeout(ride, 6000); setInterval(ride, 23000); }
    // A skater rolls down the path through the jaw
    const walker = $('walker');
    const roll = () => { if (!calm && !walker.classList.contains('go')) { walker.classList.add('go'); setTimeout(() => walker.classList.remove('go'), 5300); } };
    skull.querySelector('.spot[href="timeline.html"]').addEventListener('pointerenter', roll);
    if (!calm) { setTimeout(roll, 14000); setInterval(roll, 31000); }

    // Mushrooms sprout wherever you click the skull itself
    const sprouts = $('sprouts'), tilt = skull.querySelector('.tilt');
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
    window.owlHoot = () => { if (!calm && !owl.classList.contains('hoot')) once('hoot', 700); };
  }

  // Night sound: browsers only allow audio after a click, so it starts from the switch
  const sound = $('sound');
  if (sound) {
    const SRC = 'assets/audio/night-owl.mp3', VOL = .5;
    let ctx, gain, el, on = false;
    const start = async () => {
      try { // gapless loop through Web Audio
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
        await ctx.resume();
        if (!gain) {
          const buf = await ctx.decodeAudioData(await (await fetch(SRC)).arrayBuffer());
          const node = ctx.createBufferSource(); node.buffer = buf; node.loop = true;
          gain = ctx.createGain(); gain.gain.value = 0; node.connect(gain).connect(ctx.destination); node.start();
          // the owl in the picture moves when the owl in the recording calls
          const ear = ctx.createAnalyser(); ear.fftSize = 1024; node.connect(ear);
          const buf2 = new Float32Array(ear.fftSize);
          const listen = () => {
            ear.getFloatTimeDomainData(buf2);
            const rms = Math.sqrt(buf2.reduce((a, v) => a + v * v, 0) / buf2.length);
            if (on && rms > .09 && window.owlHoot) window.owlHoot();
            requestAnimationFrame(listen);
          };
          listen();
        }
        gain.gain.linearRampToValueAtTime(VOL, ctx.currentTime + 1.5);
      } catch (err) { // opened straight from disk: plain audio element instead
        el = el || Object.assign(new Audio(SRC), { loop: true, volume: VOL });
        el.play().catch(() => {});
      }
    };
    const stop = () => {
      if (gain) { gain.gain.cancelScheduledValues(ctx.currentTime); gain.gain.linearRampToValueAtTime(0, ctx.currentTime + .6); }
      if (el) el.pause();
    };
    sound.addEventListener('click', () => {
      on = !on; sound.setAttribute('aria-pressed', on); sound.lastChild.textContent = on ? 'Sound on' : 'Sound off';
      on ? start() : stop();
    });
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
