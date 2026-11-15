/* DJ page: the listening station.
   Eight recordings sit in the shelf (plain links to Mixcloud without this script). One of them is on the drawn
   turntable. Pressing play loads Mixcloud's own player, and only then: before that nothing is fetched from them.
   The record's label turns while the recording really plays, and the tonearm stands where the recording is:
   first groove at the start, last groove at the end. Lifting the arm and putting it down elsewhere jumps there.
   The player is spoken to with its postMessage protocol directly, so no script of theirs runs on this page. */
(() => {
  const tt = document.getElementById('tt');
  if (!tt) return;
  const $ = (s, r = document) => r.querySelector(s);
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const ORIGIN = 'https://player-widget.mixcloud.com';
  const TURN = { first: 18.34, last: 41.34 };          // degrees from the arm's rest to the first and the last groove (scripts/deck-art.py)
  const PIVOT = [.81436, .25642];                       // the point the arm turns about, as a share of the deck's box
  const SPEED = 200;                                    // 33⅓ turns a minute, in degrees a second
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const clock = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

  const MIX = [...document.querySelectorAll('.mix')].map(li => ({
    li, a: $('a', li), key: li.dataset.key, len: +li.dataset.len, href: $('a', li).href,
    title: $('.mix-title', li).textContent, meta: `${$('.mix-when', li).textContent} · ${$('.mix-where', li).textContent}`,
    kind: $('.mix-kind', li).textContent, note: $('.mix-note', li).textContent, tags: $('.mix-tags', li).textContent,
    art: $('img', li).getAttribute('src'),
  }));
  const el = id => document.getElementById('dj-' + id);
  const now = el('now'), cover = el('cover'), label = cover.parentNode, say = el('say'), bar = el('bar'), time = el('time'), box = el('mc'), grip = el('grip');

  // the plain link becomes the play button; the way out to Mixcloud moves into the small print
  const play = document.createElement('button');
  play.type = 'button'; play.className = 'dj-play'; play.id = 'dj-play';
  el('play').replaceWith(play);
  el('fine').innerHTML = 'Plays through Mixcloud. Their player loads when you press play. <a id="dj-out" target="_blank" rel="noopener">Open on Mixcloud</a>';
  const out = el('out');
  document.documentElement.classList.add('dj-on');
  MIX.forEach(m => m.a.setAttribute('role', 'button'));

  let sel = 0, frame = null, api = null, loaded = -1, playing = false, pos = 0, dur = 0, onDeck = false;
  let arm = 0, held = null, wait = 0, nudge = 0, calls = {}, count = 0;

  // ---- what is shown
  const note = (text, extra) => { say.textContent = text || ''; if (extra) say.append(' ', ...extra); };
  const turnArm = deg => { if (Math.abs(deg - arm) < .02 && deg) return; arm = deg; tt.style.setProperty('--arm', deg.toFixed(2) + 'deg'); };   // small steps: over two hours the arm moves 23 degrees
  const length = () => (loaded === sel && dur) || MIX[sel].len;
  const place = () => { if (!held) turnArm(onDeck ? TURN.first + clamp(pos / length(), 0, 1) * (TURN.last - TURN.first) : 0); };
  const face = () => {
    const mine = loaded === sel;
    play.classList.toggle('playing', mine && playing);
    play.innerHTML = `<i></i>${mine && playing ? 'Pause' : 'Play'}`;
    play.setAttribute('aria-label', `${mine && playing ? 'Pause' : 'Play'}: ${MIX[sel].title}`);
    time.textContent = mine && (pos || playing) ? `${clock(pos)} / ${clock(length())}` : clock(MIX[sel].len);
    bar.style.width = (mine ? clamp(pos / length(), 0, 1) * 100 : 0).toFixed(2) + '%';
    tt.classList.toggle('playing', mine && playing);
  };
  const fill = () => {
    const m = MIX[sel];
    el('no').textContent = String(sel + 1).padStart(2, '0');
    el('kind').textContent = m.kind; el('title').textContent = m.title; el('meta').textContent = m.meta; el('note').textContent = m.note; el('tags').textContent = m.tags;
    out.href = m.href;
    MIX.forEach((x, k) => { x.li.classList.toggle('on', k === sel); x.a.setAttribute('aria-pressed', k === sel); });
    face();
  };
  let swapping = 0;
  const swap = () => {                                   // texts and label change together, quietly
    clearTimeout(swapping);
    if (calm.matches) { cover.src = MIX[sel].art; fill(); return; }
    now.classList.add('swap'); label.classList.add('swap');
    swapping = setTimeout(() => {
      fill();
      const done = () => { now.classList.remove('swap'); label.classList.remove('swap'); };
      cover.onload = cover.onerror = done; cover.src = MIX[sel].art;
      if (cover.complete) done();
    }, 320);
  };

  // ---- the label turns while it plays: it runs up and runs down like a platter does
  let angle = 0, speed = 0, raf = 0, last = 0;
  const tick = t => {
    const dt = Math.min(.05, (t - last) / 1000); last = t;
    const goal = playing && loaded === sel ? SPEED : 0;
    speed += (goal - speed) * Math.min(1, dt / (goal ? .55 : .7));
    angle = (angle + speed * dt) % 360;
    cover.style.transform = `rotate(${angle.toFixed(2)}deg)`;
    raf = goal || speed > .6 ? requestAnimationFrame(tick) : 0;
  };
  const spin = () => { if (!raf && !calm.matches) { last = performance.now(); raf = requestAnimationFrame(tick); } };

  // ---- Mixcloud's player, spoken to directly
  const post = m => { try { frame.contentWindow.postMessage(JSON.stringify(m), ORIGIN); } catch (e) { /* not there yet */ } };
  const can = name => !!api && api.methods.includes(name);
  const call = (name, ...args) => new Promise(done => {
    if (!can(name)) return done(undefined);
    const id = ++count; calls[id] = done;
    post({ type: 'method', data: { methodId: id, methodName: name, args } });
    setTimeout(() => { if (calls[id]) { delete calls[id]; done(undefined); } }, 4000);
  });
  const on = {
    play() { playing = true; onDeck = true; clearTimeout(nudge); note(''); place(); face(); spin(); },
    pause() { playing = false; face(); },
    progress(p, d) { if (typeof p !== 'number') return; pos = p; if (d > 0) dur = d; if (onDeck) place(); face(); },
    ended() { playing = false; onDeck = false; pos = 0; place(); face(); },
    error() { note('Mixcloud could not play this recording.'); },
  };
  const ready = () => {
    clearTimeout(wait); note('');
    call('getDuration').then(d => { if (d > 0) { dur = d; face(); } });
    call('play');                                        // some browsers want the press inside their player
    clearTimeout(nudge);
    nudge = setTimeout(() => { if (!playing) note('Press play in the Mixcloud player below.'); }, 3200);
  };
  addEventListener('message', e => {
    if (!frame || e.origin !== ORIGIN || e.source !== frame.contentWindow) return;
    let m; try { m = JSON.parse(e.data); } catch (x) { return; }
    if (!m || m.mixcloud !== 'playerWidget') return;
    if (m.type === 'ready') post({ type: 'getApi' });
    else if (m.type === 'api') { const fresh = !api; api = m.data || { methods: [], events: [] }; if (!Array.isArray(api.methods)) api.methods = []; if (fresh) ready(); }
    else if (m.type === 'event' && m.data && on[m.data.eventName]) on[m.data.eventName](...(m.data.args || []));
    else if (m.type === 'methodResponse' && m.data && calls[m.data.methodId]) { calls[m.data.methodId](m.data.value); delete calls[m.data.methodId]; }
  });
  const source = m => `${ORIGIN}/widget/iframe/?hide_cover=1&mini=1&light=1&autoplay=1&feed=${encodeURIComponent(m.key)}`;
  const failed = () => {
    clearTimeout(wait); clearTimeout(nudge);
    if (frame) frame.remove();
    frame = api = null; loaded = -1; playing = false; onDeck = false; pos = dur = 0; place(); face();
    const again = document.createElement('button'); again.type = 'button'; again.textContent = 'Try again'; again.onclick = press;
    const link = document.createElement('a'); link.href = MIX[sel].href; link.target = '_blank'; link.rel = 'noopener'; link.textContent = 'open it on Mixcloud';
    note('The Mixcloud player did not load.', [again, ' or ', link, '.']);
  };
  const put = () => {                                    // put the chosen recording on: the needle goes to the first groove at once, the label turns when sound comes
    const m = MIX[sel];
    loaded = sel; pos = dur = 0; playing = false; onDeck = true; place(); face();
    note('Loading the Mixcloud player …');
    clearTimeout(wait); clearTimeout(nudge);
    if (frame && can('load')) {
      call('load', m.key, true).then(() => note(''));       // the length comes with the first progress; asked for now, the player still names the old one
      frame.title = `Mixcloud player: ${m.title}`;
      nudge = setTimeout(() => { if (!playing && loaded === sel) note('Press play in the Mixcloud player below.'); }, 5000);
      return;
    }
    api = null; calls = {};
    if (!frame) {
      frame = document.createElement('iframe');
      frame.allow = 'autoplay; encrypted-media';
      frame.addEventListener('load', () => { post({ type: 'getApi' }); clearTimeout(wait); wait = setTimeout(() => { if (!api) failed(); }, 6000); });
      box.append(frame);
    }
    frame.title = `Mixcloud player: ${m.title}`;
    frame.src = source(m);
    wait = setTimeout(() => { if (!api) failed(); }, 14000);
  };
  function press() {
    if (!frame || loaded !== sel) return put();
    if (!api) return;                                     // still on its way
    if (playing) call('pause'); else { onDeck = true; place(); call('play'); }
  }
  const choose = (i, show) => {
    if (i === sel) { if (show) press(); return; }
    sel = i;
    const running = !!frame && !!api;
    onDeck = false; pos = 0; place();                    // the arm goes back to its rest before the record changes
    if (running && playing) call('pause');
    swap();
    if (running) setTimeout(() => { if (sel === i) put(); }, calm.matches ? 0 : 700);
  };

  play.addEventListener('click', press);
  $('.tt-platter', tt).addEventListener('click', press);
  const toStation = () => {
    const r = tt.getBoundingClientRect();
    if (r.top < 70 || r.bottom > innerHeight) el('title').scrollIntoView({ behavior: calm.matches ? 'auto' : 'smooth', block: 'center' });
    play.focus({ preventScroll: true });
  };
  MIX.forEach((m, i) => m.a.addEventListener('click', e => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;      // a new tab, if somebody asks for one
    e.preventDefault(); choose(i, true); toStation();
  }));
  MIX.forEach(m => m.a.addEventListener('keydown', e => { if (e.key === ' ') { e.preventDefault(); m.a.click(); } }));
  document.querySelectorAll('a[data-mix]').forEach(a => a.addEventListener('click', e => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
    e.preventDefault(); choose(+a.dataset.mix - 1, false); toStation();
  }));

  // ---- the arm in the hand: lift it, put it down somewhere else
  const bearing = e => { const r = tt.getBoundingClientRect(); return Math.atan2(e.clientY - r.top - r.height * PIVOT[1], e.clientX - r.left - r.width * PIVOT[0]) * 180 / Math.PI; };
  grip.addEventListener('pointerdown', e => {
    if (e.button) return;
    if (!api || loaded !== sel) return press();           // nothing on yet: touching the arm starts it
    e.preventDefault();
    try { grip.setPointerCapture(e.pointerId); } catch (x) { /* fine without */ }
    held = { off: bearing(e) - arm, moved: false };
    tt.classList.add('held');
  });
  grip.addEventListener('pointermove', e => {
    if (!held) return;
    const a = clamp(bearing(e) - held.off, 0, TURN.last + 1.2);
    if (Math.abs(a - arm) > .15) held.moved = true;
    turnArm(a);
  });
  const drop = async () => {
    if (!held) return;
    const moved = held.moved, a = arm;
    held = null; tt.classList.remove('held');
    if (!moved) return place();
    if (a < TURN.first - 2) { onDeck = false; place(); if (playing) call('pause'); return; }      // back on its rest
    const to = clamp((a - TURN.first) / (TURN.last - TURN.first), 0, .998) * length();
    onDeck = true;
    const ok = await call('seek', to);
    if (ok === false) note('Mixcloud does not allow jumping to that point.');
    else { pos = to; note(''); if (!playing) call('play'); }
    place(); face();
  };
  grip.addEventListener('pointerup', drop);
  grip.addEventListener('pointercancel', drop);
  grip.addEventListener('lostpointercapture', drop);

  fill();
  window.djDeck = { state: () => ({ sel, loaded, playing, pos, dur, onDeck, arm, ready: !!api, speed }), choose, press };
})();
