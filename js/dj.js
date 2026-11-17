/* DJ page: the listening station.
   Eight recordings sit in the shelf (plain links to Mixcloud without this script). One of them is on the drawn
   turntable. Pressing play loads Mixcloud's own player, and only then: before that nothing is fetched from them.
   The record turns while the recording really plays (the drawn platter with its vinyl, and the label on it, as one
   disc), and the tonearm stands where the recording is:
   first groove at the start, last groove at the end. Lifting the arm and putting it down elsewhere jumps there.
   A sleeve in the shelf chooses a recording; if music is running the new one plays on, otherwise it waits for play.

   Mixcloud's player is spoken to with its own message protocol directly, on purpose: their widget library would
   be a foreign script on this page (the page's policy allows none), and the protocol is a handful of messages.
   All of it sits in one block below ("Mixcloud's player"). If they ever change it, the player in the frame still
   works on its own, the deck simply stops following, and "Open on Mixcloud" stays. Checked against the live
   player on 15 November 2026: methods load, play, pause, seek, getPosition, getDuration; events play, pause,
   progress(position, duration), ended, error. */
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
  // what this script says itself, in the language of the page (the page's own text is in dj.html and content/de/dj.txt)
  const TEXT = document.documentElement.lang === 'de'
    ? { fine: 'Läuft über Mixcloud. Deren Player lädt erst beim Druck auf Play.', out: 'Auf Mixcloud öffnen', play: 'Play', pause: 'Pause', deck: 'Auf dem Plattenteller', toDeck: 'Zum Plattenspieler',
        cannot: 'Mixcloud konnte diese Aufnahme nicht abspielen.', press: 'Bitte im Mixcloud-Player unten auf Play drücken.', again: 'Noch einmal versuchen', open: 'auf Mixcloud öffnen', or: ' oder ',
        failed: 'Der Mixcloud-Player wurde nicht geladen.', loading: 'Der Mixcloud-Player lädt …', player: 'Mixcloud-Player', noJump: 'Mixcloud lässt den Sprung an diese Stelle nicht zu.' }
    : { fine: 'Plays through Mixcloud. Their player loads when you press play.', out: 'Open on Mixcloud', play: 'Play', pause: 'Pause', deck: 'On the deck', toDeck: 'To the deck',
        cannot: 'Mixcloud could not play this recording.', press: 'Press play in the Mixcloud player below.', again: 'Try again', open: 'open it on Mixcloud', or: ' or ',
        failed: 'The Mixcloud player did not load.', loading: 'Loading the Mixcloud player …', player: 'Mixcloud player', noJump: 'Mixcloud does not allow jumping to that point.' };
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
  el('fine').innerHTML = `${TEXT.fine} <a id="dj-out" target="_blank" rel="noopener">${TEXT.out}</a>`;
  const out = el('out');
  document.documentElement.classList.add('dj-on');
  MIX.forEach(m => m.a.setAttribute('role', 'button'));

  let sel = 0, frame = null, api = null, loaded = -1, playing = false, pos = 0, dur = 0, onDeck = false;
  let arm = 0, held = null, wait = 0, nudge = 0, calls = {}, count = 0;
  let turn = 0;                                         // counts what goes on the deck: a late answer that belongs to an earlier recording is dropped
  let want = false;                                     // music is meant to be running: carries over a change of record, however quickly sleeves are chosen
  let settled = false;                                  // the player's positions are believed once the recording now on the deck has started

  // ---- what is shown
  const note = (text, extra) => { say.textContent = text || ''; if (extra) say.append(' ', ...extra); };
  const turnArm = deg => { if (Math.abs(deg - arm) < .02 && deg) return; arm = deg; tt.style.setProperty('--arm', deg.toFixed(2) + 'deg'); };   // small steps: over two hours the arm moves 23 degrees
  const length = () => (loaded === sel && dur) || MIX[sel].len;
  const place = () => { if (!held) turnArm(onDeck ? TURN.first + clamp(pos / length(), 0, 1) * (TURN.last - TURN.first) : 0); };
  const face = () => {
    const mine = loaded === sel;
    play.classList.toggle('playing', mine && playing);
    play.innerHTML = `<i></i>${mine && playing ? TEXT.pause : TEXT.play}`;
    play.setAttribute('aria-label', `${mine && playing ? TEXT.pause : TEXT.play}: ${MIX[sel].title}`);
    time.textContent = mine && (pos || playing) ? `${clock(pos)} / ${clock(length())}` : clock(MIX[sel].len);
    bar.style.width = (mine ? clamp(pos / length(), 0, 1) * 100 : 0).toFixed(2) + '%';
    tt.classList.toggle('playing', mine && playing);
    MIX.forEach((x, k) => x.li.classList.toggle('playing', k === sel && mine && playing));
    remote();
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

  // ---- a small remote at the foot of the screen, once a recording is in their player and the deck is out of sight.
  // No second player: it presses the same button
  const mini = document.createElement('div');
  mini.className = 'dj-mini'; mini.setAttribute('role', 'region'); mini.setAttribute('aria-label', TEXT.deck);
  mini.innerHTML = `<span id="dj-mini-t"></span><button type="button" id="dj-mini-p"></button><a href="${location.pathname}#listen" id="dj-mini-g">${TEXT.toDeck}</a>`;   // the page is named: the German page has a <base>, and a bare #listen would leave it
  document.body.append(mini);
  let away = false;
  function remote() {
    const mine = loaded === sel && playing;
    el('mini-t').textContent = `${String(sel + 1).padStart(2, '0')} · ${MIX[sel].title}`;
    el('mini-p').textContent = mine ? TEXT.pause : TEXT.play;
    el('mini-p').setAttribute('aria-label', `${mine ? TEXT.pause : TEXT.play}: ${MIX[sel].title}`);
    mini.classList.toggle('show', away && !!frame);
  }
  if ('IntersectionObserver' in window) new IntersectionObserver(es => { away = !es[0].isIntersecting; remote(); }).observe(el('now').parentNode);

  // ---- the record turns while it plays: platter, vinyl and label as one disc. It runs up and runs down like a platter does
  const disc = document.querySelector('#tt .tt-platter');
  let angle = 0, speed = 0, raf = 0, last = 0;
  const tick = t => {
    const dt = Math.min(.05, (t - last) / 1000); last = t;
    const goal = playing && loaded === sel ? SPEED : 0;
    speed += (goal - speed) * Math.min(1, dt / (goal ? .55 : .7));
    angle = (angle + speed * dt) % 360;
    cover.style.transform = disc.style.transform = `rotate(${angle.toFixed(2)}deg)`;
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
    play() { playing = true; want = true; onDeck = true; settled = true; clearTimeout(nudge); note(''); place(); face(); spin(); },
    pause() { playing = false; if (settled) want = false; face(); },      // not settled: the pause is our own, between two records
    progress(p, d) { if (!settled || typeof p !== 'number') return; pos = p; if (d > 0) dur = d; if (onDeck) place(); face(); },
    ended() { playing = false; want = false; onDeck = false; pos = 0; place(); face(); },
    error() { note(TEXT.cannot); },
  };
  const ready = () => {
    const mine = turn;
    clearTimeout(wait); note('');
    call('getDuration').then(d => { if (mine === turn && d > 0) { dur = d; face(); } });
    call('play');                                        // some browsers want the press inside their player
    clearTimeout(nudge);
    nudge = setTimeout(() => { if (mine === turn && !playing) note(TEXT.press); }, 3200);
  };
  addEventListener('message', e => {
    if (!frame || e.origin !== ORIGIN || e.source !== frame.contentWindow) return;
    let m; try { m = JSON.parse(e.data); } catch (x) { return; }
    if (!m || m.mixcloud !== 'playerWidget') return;
    if (m.type === 'ready') post({ type: 'getApi' });
    else if (m.type === 'api') { const fresh = !api; api = m.data || { methods: [], events: [] }; if (!Array.isArray(api.methods)) api.methods = []; if (fresh) ready(); }
    else if (m.type === 'event' && api && m.data && on[m.data.eventName]) on[m.data.eventName](...(m.data.args || []));
    else if (m.type === 'methodResponse' && m.data && calls[m.data.methodId]) { calls[m.data.methodId](m.data.value); delete calls[m.data.methodId]; }
  });
  const source = m => `${ORIGIN}/widget/iframe/?hide_cover=1&mini=1&light=1&autoplay=1&feed=${encodeURIComponent(m.key)}`;
  const failed = () => {
    clearTimeout(wait); clearTimeout(nudge);
    if (frame) frame.remove();
    turn++; frame = api = null; loaded = -1; settled = false; want = false; playing = false; onDeck = false; pos = dur = 0; place(); face();
    const again = document.createElement('button'); again.type = 'button'; again.textContent = TEXT.again; again.onclick = press;
    const link = document.createElement('a'); link.href = MIX[sel].href; link.target = '_blank'; link.rel = 'noopener'; link.textContent = TEXT.open;
    note(TEXT.failed, [again, TEXT.or, link, '.']);
  };
  // put the chosen recording on. With start, the needle goes to the first groove at once and the record turns when
  // sound comes; without, it only lies ready in their player (which is there already) and waits for play
  const put = start => {
    const m = MIX[sel], mine = ++turn;
    loaded = sel; pos = dur = 0; playing = false; settled = false; want = !!start; onDeck = !!start; place(); face();
    note(start ? TEXT.loading : '');
    clearTimeout(wait); clearTimeout(nudge);
    if (frame && can('load')) {
      call('load', m.key, !!start).then(() => { if (mine === turn) note(''); });       // the length comes with the first progress; asked for now, the player still names the old one
      frame.title = `${TEXT.player}: ${m.title}`;
      if (start) nudge = setTimeout(() => { if (mine === turn && !playing) note(TEXT.press); }, 5000);
      return;
    }
    api = null; calls = {};
    if (!frame) {
      frame = document.createElement('iframe');
      frame.allow = 'autoplay; encrypted-media';
      frame.addEventListener('load', () => { post({ type: 'getApi' }); clearTimeout(wait); wait = setTimeout(() => { if (!api) failed(); }, 6000); });
      box.append(frame);
    }
    frame.title = `${TEXT.player}: ${m.title}`;
    frame.src = source(m);
    wait = setTimeout(() => { if (!api) failed(); }, 14000);
  };
  function press() {
    if (!frame || loaded !== sel) return put(true);
    if (!api) return;                                     // still on its way
    if (playing) { want = false; call('pause'); } else { want = true; onDeck = true; place(); call('play'); }
  }
  // a sleeve chooses, play plays. One rule for the first choice and every later one: if music is running, the new
  // recording goes on and plays; if not, it waits. Their player is only ever loaded by play.
  const choose = i => {
    if (i === sel) return;
    const there = !!frame && !!api, carry = there && want;
    sel = i;
    const mine = ++turn;
    onDeck = false; pos = 0; settled = false; place();    // the arm goes back to its rest before the record changes
    if (playing) call('pause');
    playing = false;
    swap();
    if (there) setTimeout(() => { if (mine === turn) put(carry); }, calm.matches || !carry ? 0 : 700);
  };

  play.addEventListener('click', press);
  el('mini-p').addEventListener('click', press);
  el('mini-g').addEventListener('click', e => { e.preventDefault(); toStation(); });
  $('.tt-platter', tt).addEventListener('click', press);
  el('start').addEventListener('click', press);        // the start button drawn on the deck
  const toStation = () => {
    const r = tt.getBoundingClientRect();
    if (r.top < 70 || r.bottom > innerHeight) el('title').scrollIntoView({ behavior: calm.matches ? 'auto' : 'smooth', block: 'center' });
    play.focus({ preventScroll: true });
  };
  MIX.forEach((m, i) => m.a.addEventListener('click', e => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;      // a new tab, if somebody asks for one
    e.preventDefault(); choose(i); toStation();
  }));
  MIX.forEach(m => m.a.addEventListener('keydown', e => { if (e.key === ' ') { e.preventDefault(); m.a.click(); } }));
  document.querySelectorAll('a[data-mix]').forEach(a => a.addEventListener('click', e => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
    e.preventDefault(); choose(+a.dataset.mix - 1); toStation();
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
    if (a < TURN.first - 2) { onDeck = false; want = false; place(); if (playing) call('pause'); return; }      // back on its rest
    const to = clamp((a - TURN.first) / (TURN.last - TURN.first), 0, .998) * length(), mine = turn;
    onDeck = true;
    const ok = await call('seek', to);
    if (mine !== turn) return;                            // another recording has gone on meanwhile
    if (ok === true) { pos = to; note(''); if (!playing) call('play'); }
    else if (ok === false) note(TEXT.noJump);
    else {                                                // no answer: the arm only believes what the player itself reports
      const p = await call('getPosition');
      if (mine !== turn) return;
      if (typeof p === 'number') pos = p;
    }
    place(); face();
  };
  const letGo = () => { if (!held) return; held = null; tt.classList.remove('held'); place(); };   // interrupted, not put down: back to where the recording is
  grip.addEventListener('pointerup', drop);
  grip.addEventListener('pointercancel', letGo);
  grip.addEventListener('lostpointercapture', letGo);

  fill();
  window.djDeck = { state: () => ({ sel, loaded, playing, pos, dur, onDeck, arm, ready: !!api, speed, turn, settled }), choose, press };
})();

/* The photographs: nineteen pictures in rows of equal height, printed in ink like the sleeves until the pointer
   (or, on a phone, the middle of the screen) brings their colours back. A click opens them large; the links work
   without this script and then simply open the picture. */
(() => {
  const dlg = document.getElementById('dj-gallery'), shots = [...document.querySelectorAll('.shot')];
  if (!dlg || !dlg.showModal || !shots.length) return;
  const $ = id => document.getElementById('dj-g-' + id), slide = $('slide');
  let i = 0, from = null;
  const show = () => {
    const a = shots[i], small = a.querySelector('img'), k = i;
    const img = new Image(); img.alt = small.alt; img.src = small.currentSrc || small.src;      // the small one is there at once, the large one follows
    slide.replaceChildren(img);
    const big = new Image(); big.onload = () => { if (k === i && dlg.open) img.src = big.src; }; big.src = a.href;
    $('count').textContent = `${i + 1} / ${shots.length}`;
  };
  const go = d => { i = (i + d + shots.length) % shots.length; show(); };
  shots.forEach((a, k) => a.addEventListener('click', e => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
    e.preventDefault(); i = k; from = a; show(); dlg.showModal();
  }));
  let x0 = null, swiped = false;
  slide.addEventListener('pointerdown', e => { x0 = e.clientX; swiped = false; });
  slide.addEventListener('pointerup', e => { if (x0 !== null && Math.abs(e.clientX - x0) > 44) { swiped = true; go(e.clientX < x0 ? 1 : -1); } x0 = null; });
  slide.addEventListener('click', () => { if (!swiped) go(1); swiped = false; });
  $('next').addEventListener('click', () => go(1));
  $('prev').addEventListener('click', () => go(-1));
  $('close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
  });
  dlg.addEventListener('close', () => { slide.replaceChildren(); if (from) from.focus({ preventScroll: true }); });
  // no pointer to hover with: the picture in the middle of the screen is the one in colour
  if (matchMedia('(hover: none)').matches && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('lit', e.isIntersecting)), { rootMargin: '-44% 0px -44% 0px' });
    shots.forEach(a => io.observe(a));
  }
})();
