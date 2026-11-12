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
