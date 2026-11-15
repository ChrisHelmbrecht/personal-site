/* The blog. One list of articles is written into the page by scripts/build-blog.py; this script shows it two ways.
   Explore: a few cards (the newest, and those marked "featured") float in fixed places. Resting the pointer on
   one, tapping it or reaching it with the keyboard opens a preview with the intro; a plain click opens the article.
   Archive: the whole list with search, categories, order and pages. Its state lives in the address
   (?view=archive&q=...&cat=...&sort=old&page=2), so links can be shared and back/forward work.
   On an article page it only looks after the way back. */
(() => {
  const root = document.getElementById('blog'), page = root || document.querySelector('.article-page');
  if (!page) return;
  const lang = page.dataset.lang, HOME = page.dataset.home, KEY = 'blog-' + lang;
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
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
      title, short: li.dataset.short || '', intro: intro.textContent, href: a.getAttribute('href'), pic: li.querySelector('.entry-pic').firstElementChild, hay: fold(text), hay2: fold2(text), a };
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

  // ---- Explore: which cards, and the cards themselves
  const chosen = (() => {
    const fresh = all.slice(0, Math.min(FRESH, MAX)), feat = all.filter(x => x.featured && !fresh.includes(x)).slice(0, MAX - fresh.length);
    const rest = all.filter(x => !fresh.includes(x) && !feat.includes(x)).slice(0, MAX - fresh.length - feat.length);
    return [...fresh, ...feat, ...rest].sort((x, y) => x.i - y.i);                    // newest first, steady from visit to visit
  })();
  const cards = chosen.map((x, k) => {
    const a = document.createElement('a');
    a.className = 'float'; a.href = x.href; a.setAttribute('aria-describedby', 'b-d' + k);
    if (x.short) a.setAttribute('aria-label', x.title);
    a.innerHTML = `<span class="float-in"><span class="float-pic"></span><strong>${esc(x.short || x.title)}</strong><time datetime="${x.date}">${esc(x.when)}</time></span><span id="b-d${k}" hidden>${esc(x.intro)}</span>`;
    const pic = x.pic.cloneNode(true);
    if (pic.tagName === 'IMG') { pic.sizes = '(min-width: 1000px) 262px, (min-width: 641px) 30vw, 46vw'; pic.loading = 'eager'; }
    a.querySelector('.float-pic').append(pic);
    drift.append(a);
    return a;
  });

  // ---- the preview
  let open = -1, how = '', dwell = 0, leave = 0, over = -1, lastPointer = 'mouse';
  const shut = (focusBack) => {
    clearTimeout(leave);
    if (open < 0) return;
    const card = cards[open];
    peek.hidden = true; peek.replaceChildren(); drift.classList.remove('has-peek'); card.classList.remove('sel');
    open = -1; rest();
    if (focusBack) card.focus({ preventScroll: true });
  };
  const show = (k, by) => {
    clearTimeout(dwell); clearTimeout(leave);
    if (open === k) { how = by === 'hover' ? how : by; return; }
    if (open >= 0) shut();
    const x = chosen[k], card = cards[k];
    open = k; how = by;
    const pic = x.pic.cloneNode(true);
    if (pic.tagName === 'IMG') { pic.sizes = '(min-width: 640px) 580px, 94vw'; pic.loading = 'eager'; }
    peek.innerHTML = `<div class="peek-card" role="group" aria-label="${esc(LBL.preview + ': ' + x.title)}">
      <button type="button" class="peek-x" aria-label="${esc(LBL.close)}">×</button>
      <a class="peek-pic" href="${esc(x.href)}" tabindex="-1" aria-hidden="true"></a>
      <div class="peek-body"><time datetime="${x.date}">${esc(x.when)}</time><h2><a href="${esc(x.href)}" tabindex="-1">${esc(x.title)}</a></h2>
      <p class="peek-intro">${esc(x.intro)}</p><a class="peek-read" href="${esc(x.href)}"${by === 'focus' ? ' tabindex="-1"' : ''}>${esc(LBL.read)}</a></div></div>`;
    peek.querySelector('.peek-pic').append(pic);
    peek.hidden = false; drift.classList.add('has-peek'); card.classList.add('sel'); rest();
    const r = card.getBoundingClientRect(), w = peek.offsetWidth, h = peek.offsetHeight, vw = document.documentElement.clientWidth;
    const left = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), vw - w - 12);
    let top = r.top - 26;
    if (top + h > innerHeight - 12) top = innerHeight - h - 12;
    peek.style.left = left + scrollX + 'px'; peek.style.top = Math.max(scrollY + 8, top + scrollY) + 'px';
    if (by === 'tap') peek.querySelector('.peek-read').focus({ preventScroll: true });
  };
  const later = () => { clearTimeout(leave); leave = setTimeout(() => { if (how === 'hover') { shut(); if (over >= 0) dwell = setTimeout(() => show(over, 'hover'), 350); } }, 380); };
  cards.forEach((a, k) => {
    a.addEventListener('pointerdown', e => { lastPointer = e.pointerType || 'mouse'; });
    a.addEventListener('pointerenter', e => {
      if (e.pointerType !== 'mouse') return;
      over = k; clearTimeout(dwell);
      if (open === k) return clearTimeout(leave);
      if (open < 0) dwell = setTimeout(() => show(k, 'hover'), 350);      // passing over a card opens nothing: the pointer has to rest on it
    });
    a.addEventListener('pointerleave', e => { if (e.pointerType !== 'mouse') return; if (over === k) over = -1; clearTimeout(dwell); if (open === k && how === 'hover') later(); });
    a.addEventListener('click', e => {
      if (!plain(e)) return;
      if (lastPointer !== 'mouse' && lastPointer !== 'key') { e.preventDefault(); show(k, 'tap'); return; }      // a finger: first the preview
      clearTimeout(dwell); leaving(chosen[k]); carry(a);
    });
    a.addEventListener('keydown', () => { lastPointer = 'key'; });
    a.addEventListener('focus', () => { if (a.matches(':focus-visible')) show(k, 'focus'); });
    a.addEventListener('blur', () => { if (open === k && how === 'focus') shut(); });
  });
  peek.addEventListener('pointerenter', () => clearTimeout(leave));
  peek.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && how === 'hover') later(); });
  peek.addEventListener('click', e => {
    if (e.target.closest('.peek-x')) return shut(how !== 'hover');
    const a = e.target.closest('a'); if (a && plain(e)) { leaving(chosen[open]); carry(peek.querySelector('.peek-pic')); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && open >= 0) { e.preventDefault(); shut(how !== 'hover'); } });
  document.addEventListener('pointerdown', e => { if (open >= 0 && !peek.contains(e.target) && !e.target.closest('.float')) shut(); });
  addEventListener('resize', () => shut());

  // ---- movement: rests when asked to, in a hidden tab, out of sight, and while a preview is open
  const motion = $('motion');
  let paused = false, seen = true;
  try { paused = localStorage.getItem('blog-motion') === 'paused'; } catch (e) { /* no memory */ }
  function rest() {
    drift.classList.toggle('still', paused || document.hidden || !seen || open >= 0 || S.view !== 'explore');
    motion.setAttribute('aria-pressed', paused); motion.textContent = paused ? LBL.play : LBL.pause;
  }
  motion.addEventListener('click', () => { paused = !paused; try { localStorage.setItem('blog-motion', paused ? 'paused' : 'on'); } catch (e) { /* fine */ } rest(); });
  document.addEventListener('visibilitychange', rest);
  if ('IntersectionObserver' in window) new IntersectionObserver(es => { seen = es[0].isIntersecting; rest(); }).observe(drift);

  // ---- the two views
  const apply = () => {
    const ex = S.view === 'explore';
    $('explore').hidden = !ex; $('archive').hidden = ex;
    motion.hidden = ex ? calm.matches : true;
    document.querySelectorAll('[data-view]').forEach(a => { if (a.closest('.views')) a.dataset.view === S.view ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current'); });
    if (!ex) { shut(); archive(); }
    rest();
  };
  document.addEventListener('click', e => {
    const a = e.target.closest('a[data-view]'); if (!a || !plain(e)) return;
    e.preventDefault();
    if (a.dataset.view !== S.view) { S = { ...S, view: a.dataset.view }; keep.set('blog-view', S.view); apply(); write(true); }
    if (a.closest('.to-archive')) { bar.scrollIntoView({ behavior: calm.matches ? 'auto' : 'smooth', block: 'start' }); document.querySelector('.views [aria-current]').focus({ preventScroll: true }); }
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
      const k = chosen.findIndex(x => x.id === was.peek);
      if (k >= 0 && S.view === 'explore') show(k, 'tap');
    });
  }
  addEventListener('pageshow', e => { if (e.persisted) rest(); });
  window.blogPage = { state: () => ({ ...S, open, how, paused, shown: all.filter(x => !x.li.hidden).length, cards: cards.length }) };
})();
