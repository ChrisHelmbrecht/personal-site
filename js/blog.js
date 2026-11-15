/* The blog. One list of articles is written into the page by scripts/build-blog.py; this script shows it two ways.
   Explore: a few cards float in fixed places: the newest as the large one, those marked "featured" next, then the
   most recent. Resting the pointer on one, tapping it or reaching it with the keyboard unfolds it into a preview:
   the card itself grows from where it hangs, and goes back there. A plain click opens the article.
   Archive: the whole list with search, categories, order and pages. Its state lives in the address
   (?view=archive&q=...&cat=...&sort=old&page=2), so links can be shared and back/forward work.
   Changing the view, the cards that are in both move to their new places.
   On an article page the script looks after the way back and tells the reading line where the text ends. */
(() => {
  const root = document.getElementById('blog'), page = root || document.querySelector('.article-page');
  if (!page) return;
  const lang = page.dataset.lang, HOME = page.dataset.home, KEY = 'blog-' + lang;
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const moves = () => !calm.matches && 'animate' in Element.prototype;
  const keep = { get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch (e) { return null; } }, set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private window: no memory, nothing breaks */ } } };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const plain = e => !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button);
  // the picture that was clicked becomes the article's picture, where the browser can do that
  const carry = el => { const img = el && el.querySelector('img'); if (img && !calm.matches) { document.querySelectorAll('img').forEach(i => { i.style.viewTransitionName = ''; }); img.style.viewTransitionName = 'post-pic'; } };

  if (!root) {                                           // ---- an article
    const back = document.getElementById('b-home'), was = keep.get(KEY);
    if (back && was && was.url) {                         // came from the overview: go back to where it was left (view, filters, page, place)
      back.href = was.url;
      back.addEventListener('click', () => keep.set(KEY, { ...was, back: true }));
    }
    const others = document.querySelector('.others');
    if (others) {
      document.addEventListener('click', e => { if (others.open && !others.contains(e.target)) others.open = false; });
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && others.open) { others.open = false; others.querySelector('summary').focus(); } });
    }
    document.addEventListener('click', e => { const a = e.target.closest('a.mini'); if (a && plain(e)) carry(a); });
    const line = document.querySelector('.reading'), text = document.querySelector('.article-text');
    if (line && text) {                                   // the line is full where the text ends, not where the page with its recommendations ends
      const measure = () => { const end = Math.round(text.getBoundingClientRect().bottom + scrollY - innerHeight); line.hidden = end < 80; line.style.setProperty('--end', Math.max(1, end) + 'px'); };
      measure(); addEventListener('resize', measure); addEventListener('load', measure);
      if ('ResizeObserver' in window) new ResizeObserver(measure).observe(page);      // pictures arriving, fonts, the table of contents opening
    }
    return;
  }

  // ---- the overview
  const $ = id => document.getElementById('b-' + id);
  const LBL = JSON.parse(root.dataset.labels), MAX = +root.dataset.explore, FRESH = +root.dataset.fresh, PER = +root.dataset.perPage;
  const fold = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');          // Dämmerung = dammerung, Straße = strasse
  const fold2 = s => fold(s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue'));              // ... and = daemmerung
  const list = $('list'), bar = $('bar'), tools = $('tools'), drift = $('drift'), peek = $('peek');
  const all = [...list.children].map((li, i) => {
    const a = li.querySelector('.entry-link'), title = li.querySelector('.entry-title').textContent, intro = li.querySelector('.entry-intro'), text = `${title} ${intro.textContent} ${li.dataset.tags}`;
    return { li, i, id: li.dataset.id, date: li.dataset.date, when: li.querySelector('time').textContent, cats: li.dataset.cats.split(' '), featured: 'featured' in li.dataset,
      title, short: li.dataset.short || '', intro: intro.textContent, peek: li.dataset.peek || intro.textContent, mins: LBL.mins.replace('{n}', li.dataset.mins || 1),
      href: a.getAttribute('href'), pic: li.querySelector('.entry-pic').firstElementChild, box: li.querySelector('.entry-pic'), hay: fold(text), hay2: fold2(text), a };
  });
  document.documentElement.classList.add('blog-on');
  bar.hidden = tools.hidden = false;
  all.forEach((x, k) => {                                 // the intro of an archive entry opens on request, not on arrival
    const p = x.li.querySelector('.entry-intro'), b = document.createElement('button');
    p.id = 'b-i' + k; b.type = 'button'; b.className = 'entry-peek'; b.textContent = LBL.intro; b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-controls', p.id);
    b.addEventListener('click', () => b.setAttribute('aria-expanded', x.li.classList.toggle('open')));
    p.before(b);
  });

  // ---- state: what the address says, else what this visit last chose, else Explore
  const read = () => {
    const q = new URLSearchParams(location.search), v = q.get('view');
    return { view: v === 'archive' || v === 'explore' ? v : (q.has('q') || q.has('cat') || q.has('page') || q.has('sort') ? 'archive' : keep.get('blog-view') || 'explore'),
      q: q.get('q') || '', cat: q.get('cat') || '', sort: q.get('sort') === 'old' ? 'old' : 'new', page: Math.max(1, parseInt(q.get('page'), 10) || 1) };
  };
  const query = s => { const q = new URLSearchParams(); q.set('view', s.view); if (s.view === 'archive') { if (s.q) q.set('q', s.q); if (s.cat) q.set('cat', s.cat); if (s.sort === 'old') q.set('sort', 'old'); if (s.page > 1) q.set('page', s.page); } return '?' + q; };
  let S = read();
  const write = push => { try { history[push ? 'pushState' : 'replaceState'](null, '', location.pathname + query(S)); } catch (e) { /* e.g. opened as a file */ } };

  // ---- Archive
  const qin = $('q'), sort = $('sort'), cats = $('cats'), count = $('count'), none = $('none'), pages = $('pages');
  const archive = () => {
    const a = fold(S.q.trim()), b = fold2(S.q.trim());
    const hit = all.filter(x => (!S.cat || x.cats.includes(S.cat)) && (!a || x.hay.includes(a) || x.hay2.includes(b)));
    hit.sort((x, y) => (S.sort === 'old' ? 1 : -1) * (x.date < y.date ? -1 : x.date > y.date ? 1 : 0) || x.i - y.i);
    const n = hit.length, last = Math.max(1, Math.ceil(n / PER));
    S.page = Math.min(S.page, last);
    const from = (S.page - 1) * PER, on = new Set(hit.slice(from, from + PER));
    hit.forEach(x => list.append(x.li));
    all.forEach(x => { x.li.hidden = !on.has(x); });
    count.textContent = n > PER ? LBL.of.replace('{a}', from + 1).replace('{b}', Math.min(n, from + PER)).replace('{n}', n) : n === 1 ? LBL.count_1 : n ? LBL.count_n.replace('{n}', n) : '';
    none.hidden = n > 0;
    pages.hidden = last < 2;
    const link = (p, label, cur) => `<a href="${esc(HOME + query({ ...S, page: p }))}" data-page="${p}"${cur ? ' aria-current="page"' : ''}>${label}</a>`;
    const near = [...Array(last)].map((_, k) => k + 1).filter(p => p === 1 || p === last || Math.abs(p - S.page) < 2);
    pages.innerHTML = last < 2 ? '' : (S.page > 1 ? link(S.page - 1, '← ' + LBL.prev) : '') + near.map((p, k) => (k && p - near[k - 1] > 1 ? '<span>…</span>' : '') + link(p, p, p === S.page)).join('') + (S.page < last ? link(S.page + 1, LBL.next + ' →') : '');
    if (qin.value !== S.q) qin.value = S.q;
    $('clear').hidden = !S.q;
    sort.value = S.sort;
    cats.querySelectorAll('button').forEach(c => c.setAttribute('aria-pressed', c.dataset.cat === S.cat));
  };
  let typing = 0;
  qin.addEventListener('input', () => { S.q = qin.value; S.page = 1; archive(); clearTimeout(typing); typing = setTimeout(() => write(false), 300); });
  tools.addEventListener('submit', e => e.preventDefault());
  $('clear').addEventListener('click', () => { S.q = ''; S.page = 1; archive(); write(true); qin.focus(); });
  cats.addEventListener('click', e => { const c = e.target.closest('button'); if (!c) return; S.cat = c.dataset.cat; S.page = 1; archive(); write(true); });
  sort.addEventListener('change', () => { S.sort = sort.value; S.page = 1; archive(); write(true); });
  $('reset').addEventListener('click', () => { S.q = S.cat = ''; S.page = 1; archive(); write(true); qin.focus(); });
  pages.addEventListener('click', e => {
    const a = e.target.closest('a'); if (!a || !plain(e)) return;
    e.preventDefault(); S.page = +a.dataset.page; archive(); write(true);
    $('archive').scrollIntoView({ behavior: calm.matches ? 'auto' : 'smooth', block: 'start' }); count.setAttribute('tabindex', '-1'); count.focus({ preventScroll: true });
  });

  // ---- Explore: which cards, their weight, and the cards themselves.
  // The newest is the large one. Featured articles and, after them, the next newest are the two middle ones; the rest are small.
  const chosen = (() => {
    const fresh = all.slice(0, Math.min(FRESH, MAX)), feat = all.filter(x => x.featured && !fresh.includes(x)).slice(0, MAX - fresh.length);
    const rest = all.filter(x => !fresh.includes(x) && !feat.includes(x)).slice(0, MAX - fresh.length - feat.length);
    const pool = [...fresh, ...feat, ...rest].sort((x, y) => x.i - y.i), lead = pool.shift();
    const mids = [...pool.filter(x => x.featured), ...pool.filter(x => !x.featured)].slice(0, 2), small = pool.filter(x => !mids.includes(x));
    // three columns on a wide screen: the lead with two small ones under it; a middle one over a small one; a small one over a middle one
    return [[lead, 'lead', 0], [small[2], 'small', 0], [small[3], 'small', 0], [mids[0], 'mid', 1], [small[1], 'small', 1], [small[0], 'small', 2], [mids[1], 'mid', 2]].filter(c => c[0]).map(([x, size, col]) => ({ ...x, x, size, col }));
  })();
  const cols = [0, 1, 2].map(() => { const d = document.createElement('div'); d.className = 'drift-col'; drift.append(d); return d; });
  const weight = [...chosen].sort((p, q) => 'lms'.indexOf(p.size[0]) - 'lms'.indexOf(q.size[0]) || p.i - q.i);      // on a narrow screen there are no columns: the lead, the two middle ones, then the small ones by date
  const cards = chosen.map((c, k) => {
    const a = document.createElement('a'), tag = k === 0 ? LBL.lead : c.featured ? LBL.picked : '', v = weight.indexOf(c);
    a.className = `float ${c.size} t${k % 4} a${k % 3}${v % 2 ? ' r' : ''}`;       // tilt and rhythm of the swaying by place; the lower column on a phone by weight. Steady, nothing random
    a.style.setProperty('--o', v);
    a.href = c.href; a.setAttribute('aria-describedby', 'b-d' + k);
    if (c.short) a.setAttribute('aria-label', c.title);
    a.innerHTML = `<span class="float-in">${tag ? `<span class="float-tag">${esc(tag)}</span>` : ''}<span class="float-pic"></span><strong>${esc(c.short || c.title)}</strong><time datetime="${c.date}">${esc(c.when)}</time></span><span id="b-d${k}" hidden>${esc(c.peek)}</span>`;
    const pic = c.pic.cloneNode(true);
    if (pic.tagName === 'IMG') { pic.sizes = c.size === 'lead' ? '(min-width: 1000px) 480px, (min-width: 641px) 30vw, 46vw' : '(min-width: 1000px) 330px, (min-width: 641px) 30vw, 46vw'; pic.loading = 'eager'; }
    a.querySelector('.float-pic').append(pic);
    cols[c.col].append(a);
    return a;
  });

  // ---- the preview: the card itself unfolds. It rights itself, grows from where it hangs, and the intro follows
  let open = -1, how = '', dwell = 0, leave = 0, over = -1, lastPointer = 'mouse', quiet = false, act = null, sent = -1;
  // act: the one animation the preview has at a time, unfolding or folding, and what is left to do when it ends. sent: the card whose preview was just closed on purpose
  const flight = (card, sheet) => {                       // from the small card's place to the open sheet's place
    const r = card.getBoundingClientRect(), p = sheet.getBoundingClientRect(), s = r.width / p.width;
    return [{ transformOrigin: '0 0', transform: `translate(${r.left - p.left}px, ${r.top - p.top}px) scale(${s}) rotate(${getComputedStyle(card).getPropertyValue('--tilt') || '0deg'})`, clipPath: `inset(0 0 ${Math.max(0, p.height - r.height / s)}px 0 round 3px)` },
      { transformOrigin: '0 0', transform: 'none', clipPath: 'inset(0 0 0 0 round 3px)' }];
  };
  const settle = () => { if (act) { const a = act; act = null; a.anim.cancel(); a.done(); } };      // end whatever runs, at once: afterwards the preview is open or closed, never in between
  const run = (anim, done, opening) => { act = { anim, done, opening }; anim.onfinish = () => { if (act && act.anim === anim) { act = null; if (!opening) done(); } }; };
  const mark = () => { const sheet = peek.firstElementChild; if (sheet) sheet.classList.toggle('kbd', open >= 0 && how === 'focus'); };      // the keyboard's focus is on the card, and the card is the preview now: the preview wears the ring
  const shut = (focusBack, now) => {
    clearTimeout(leave);
    if (open < 0) return;
    const card = cards[open], sheet = peek.firstElementChild, rising = act && act.opening ? act.anim : null;
    open = -1; act = null; mark();
    const done = () => { peek.hidden = true; peek.replaceChildren(); drift.classList.remove('has-peek'); card.classList.remove('sel'); rest(); };
    if (focusBack) { quiet = true; card.focus({ preventScroll: true }); quiet = false; }      // giving the focus back must not open it again
    if (now || !moves() || !sheet) { if (rising) rising.cancel(); return done(); }
    sheet.classList.remove('unfolding'); sheet.classList.add('folding');
    if (rising) { rising.effect.updateTiming({ fill: 'both' }); rising.reverse(); return run(rising, done); }      // closed while still unfolding: the same movement turns round where it is
    run(sheet.animate(flight(card, sheet).reverse(), { duration: 300, easing: 'cubic-bezier(.4, 0, .6, 1)', fill: 'forwards' }), done);
  };
  const show = (k, by) => {
    clearTimeout(dwell); clearTimeout(leave);
    if (open === k) { how = by === 'hover' ? how : by; mark(); return; }
    sent = -1;
    if (open >= 0) shut(false, true);
    settle();
    const c = chosen[k], card = cards[k];
    open = k; how = by;
    const pic = c.pic.cloneNode(true);
    if (pic.tagName === 'IMG') { pic.sizes = '(min-width: 640px) 580px, 94vw'; pic.loading = 'eager'; }
    peek.innerHTML = `<div class="peek-card" role="group" aria-label="${esc(LBL.preview + ': ' + c.title)}">
      <button type="button" class="peek-x" aria-label="${esc(LBL.close)}">×</button>
      <a class="peek-pic" href="${esc(c.href)}" tabindex="-1" aria-hidden="true"></a>
      <div class="peek-body"><h2><a href="${esc(c.href)}" tabindex="-1">${esc(c.title)}</a></h2><time datetime="${c.date}">${esc(c.when)} · ${esc(c.mins)}</time><p class="peek-intro">${esc(c.peek)}</p></div>
      <div class="peek-foot"><a class="peek-read" href="${esc(c.href)}"${by === 'focus' ? ' tabindex="-1"' : ''}>${esc(LBL.read)}</a></div></div>`;
    peek.querySelector('.peek-pic').append(pic);
    peek.hidden = false; drift.classList.add('has-peek'); card.classList.add('sel'); rest();
    const r = card.getBoundingClientRect(), w = peek.offsetWidth, h = peek.offsetHeight, vw = document.documentElement.clientWidth;
    const left = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), vw - w - 12);
    let top = r.top - 26, to = null;
    if (by === 'focus' && (r.top < 0 || r.bottom > innerHeight)) {      // reached with the keyboard while out of sight: the browser is about to scroll to the small card. The page goes where the whole preview is in sight instead
      top = Math.max(10 - scrollY, top);
      to = top < 10 ? scrollY + top - 10 : top + h > innerHeight - 10 ? scrollY + top + h - innerHeight + 10 : null;
    } else top = Math.max(10, Math.min(top, innerHeight - h - 10));      // in sight: the preview stays inside the window
    peek.style.left = left + scrollX + 'px'; peek.style.top = top + scrollY + 'px';
    if (to !== null && getComputedStyle(peek).position !== 'fixed') requestAnimationFrame(() => { if (open === k) scrollTo({ top: to, behavior: calm.matches ? 'instant' : 'smooth' }); });
    const sheet = peek.firstElementChild;
    mark();
    if (moves()) { sheet.classList.add('unfolding'); run(sheet.animate(flight(card, sheet), { duration: 440, easing: 'cubic-bezier(.2, .75, .2, 1)' }), () => sheet.classList.remove('unfolding'), true); }
    if (by === 'tap') peek.querySelector('.peek-read').focus({ preventScroll: true });
  };
  const later = () => { clearTimeout(leave); leave = setTimeout(() => { if (how === 'hover' && open >= 0) { shut(); if (over >= 0 && over !== sent) dwell = setTimeout(() => show(over, 'hover'), 350); } }, 380); };
  cards.forEach((a, k) => {
    a.addEventListener('pointerdown', e => { lastPointer = e.pointerType || 'mouse'; });
    a.addEventListener('pointerenter', e => {
      if (e.pointerType !== 'mouse') return;
      over = k; clearTimeout(dwell);
      if (sent === k) return;                               // closed with Escape or the cross while the pointer rests here: it stays closed until the pointer has been away
      if (open === k) return clearTimeout(leave);
      if (open < 0) dwell = setTimeout(() => show(k, 'hover'), 350);      // passing over a card opens nothing: the pointer has to rest on it
    });
    a.addEventListener('pointerleave', e => { if (e.pointerType !== 'mouse') return; if (over === k) over = -1; clearTimeout(dwell); if (sent === k && open < 0 && !act) sent = -1; if (open === k && how === 'hover') later(); });
    a.addEventListener('click', e => {
      if (!plain(e)) return;
      if (lastPointer !== 'mouse' && lastPointer !== 'key') { e.preventDefault(); show(k, 'tap'); return; }      // a finger: first the preview
      clearTimeout(dwell); leaving(chosen[k]); carry(a);
    });
    a.addEventListener('keydown', () => { lastPointer = 'key'; });
    a.addEventListener('focus', () => { if (!quiet && a.matches(':focus-visible')) show(k, 'focus'); });
    a.addEventListener('blur', () => { if (open === k && how === 'focus') shut(); });
  });
  peek.addEventListener('pointerenter', () => clearTimeout(leave));
  peek.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && how === 'hover') later(); });
  peek.addEventListener('click', e => {
    if (e.target.closest('.peek-x')) { sent = open; return shut(how !== 'hover'); }
    const a = e.target.closest('a'); if (a && plain(e)) { leaving(chosen[open]); carry(peek.querySelector('.peek-pic')); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && open >= 0) { e.preventDefault(); sent = open; shut(how !== 'hover'); } });
  document.addEventListener('pointerdown', e => { if (open >= 0 && !peek.contains(e.target) && !e.target.closest('.float')) shut(); });
  addEventListener('resize', () => { shut(false, true); settle(); });

  // ---- movement: rests when asked to, in a hidden tab, out of sight, and while a preview is open
  const motion = $('motion');
  let paused = false, seen = true;
  try { paused = localStorage.getItem('blog-motion') === 'paused'; } catch (e) { /* no memory */ }
  function rest() {
    drift.classList.toggle('still', paused || document.hidden || !seen || open >= 0 || !!act || S.view !== 'explore');
    motion.setAttribute('aria-pressed', paused); motion.textContent = paused ? LBL.play : LBL.pause;
  }
  motion.addEventListener('click', () => { paused = !paused; try { localStorage.setItem('blog-motion', paused ? 'paused' : 'on'); } catch (e) { /* fine */ } rest(); });
  document.addEventListener('visibilitychange', rest);
  if ('IntersectionObserver' in window) new IntersectionObserver(es => { seen = es[0].isIntersecting; rest(); }).observe(drift);

  // ---- the two views. Changing between them, a card that is in both travels to its new place; the others follow quietly
  const apply = () => {
    const ex = S.view === 'explore';
    $('explore').hidden = !ex; $('archive').hidden = ex;
    motion.hidden = ex ? calm.matches : true;
    document.querySelectorAll('[data-view]').forEach(a => { if (a.closest('.views')) a.dataset.view === S.view ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current'); });
    if (!ex) { shut(false, true); settle(); archive(); }
    rest();
  };
  const inSight = r => r.width > 0 && r.bottom > 0 && r.top < innerHeight;
  const places = () => S.view === 'explore'
    ? new Map(chosen.map((c, k) => [c.id, { r: cards[k].querySelector('.float-pic').getBoundingClientRect(), tilt: getComputedStyle(cards[k]).getPropertyValue('--tilt') || '0deg' }]))
    : new Map(all.filter(x => !x.li.hidden).map(x => [x.id, { r: x.box.getBoundingClientRect(), tilt: '0deg' }]));
  const travel = (el, to, from, n) => {
    const move = from && inSight(from.r) && inSight(to);
    el.animate(move
      ? [{ transformOrigin: '0 0', transform: `translate(${from.r.left - to.left}px, ${from.r.top - to.top}px) scale(${from.r.width / to.width}) rotate(${from.tilt})` }, { transformOrigin: '0 0', transform: 'none' }]
      : [{ opacity: 0 }, { opacity: 0, offset: .4 }, { opacity: 1 }],
    { duration: move ? 620 : 760, delay: move ? n * 24 : 0, easing: move ? 'cubic-bezier(.2, .75, .2, 1)' : 'ease-out', fill: 'backwards' });
  };
  const turn = view => {
    shut(false, true); settle();
    const from = moves() ? places() : null;
    S = { ...S, view }; keep.set('blog-view', view); apply(); write(true);
    if (!from) return;
    if (view === 'archive') all.filter(x => !x.li.hidden).forEach((x, n) => travel(x.li, x.box.getBoundingClientRect(), from.get(x.id), n));
    else cards.forEach((card, k) => travel(card, card.querySelector('.float-pic').getBoundingClientRect(), from.get(chosen[k].id), k));
  };
  document.addEventListener('click', e => {
    const a = e.target.closest('a[data-view]'); if (!a || !plain(e)) return;
    e.preventDefault();
    const down = !!a.closest('.to-archive');
    if (down) scrollTo({ top: Math.max(0, bar.getBoundingClientRect().top + scrollY - 90), behavior: 'instant' });      // the archive starts at its head, and the cards are still in sight to travel
    if (a.dataset.view !== S.view) turn(a.dataset.view);
    if (down) document.querySelector('.views [aria-current]').focus({ preventScroll: true });
  });
  addEventListener('popstate', () => { S = read(); apply(); });

  // ---- leaving for an article, and coming back to the same place
  function leaving(x) { keep.set(KEY, { url: HOME + query(S), y: scrollY, peek: open >= 0 && how !== 'hover' ? chosen[open].id : '', id: x ? x.id : '', back: false }); }
  list.addEventListener('click', e => { const a = e.target.closest('.entry-link'); if (a && plain(e)) { leaving(all.find(x => x.a === a)); carry(a); } });
  apply();
  const was = keep.get(KEY), nav = (performance.getEntriesByType('navigation')[0] || {}).type;
  if (was && (was.back || nav === 'back_forward')) {
    keep.set(KEY, { ...was, back: false });
    requestAnimationFrame(() => {
      scrollTo({ top: was.y || 0, behavior: 'instant' });
      const k = chosen.findIndex(c => c.id === was.peek);
      if (k >= 0 && S.view === 'explore') show(k, 'tap');
    });
  }
  addEventListener('pageshow', e => { if (e.persisted) rest(); });
  window.blogPage = { state: () => ({ ...S, open, how, paused, folding: !!act && !act.opening, moving: !!act, shown: all.filter(x => !x.li.hidden).length, cards: cards.length, order: chosen.map(c => c.size[0] + ':' + c.id.slice(0, 10)) }) };
})();
