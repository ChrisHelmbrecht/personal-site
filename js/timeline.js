/* The timeline. The pages are plain HTML from scripts/build-timeline.py and work without this script:
   years link to their albums, photographs link to their large files. With it:
   Overview: the list of years follows the reading (the year in view is marked, its decade opened), a year's
   small stack unfolds the first time it is seen, and coming back from an album one lands where one left.
   Album: a photograph opens large in the page's one dialog. It grows from its place on the sheet and goes back
   there. Arrows, keys and a swipe step through the year; nothing moves by itself, and after the last photograph
   comes a choice, not an exit. The open photograph is in the address (?photo=1997-03): one step back closes it. */
(() => {
  const over = document.getElementById('tl'), album = document.getElementById('tl-album');
  if (!over && !album) return;
  const root = document.documentElement, calm = matchMedia('(prefers-reduced-motion: reduce)');
  const moves = () => !calm.matches && 'animate' in Element.prototype;
  const keep = { get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch (e) { return null; } }, set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private window: no memory, nothing breaks */ } } };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const plain = e => !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button);
  const arrived = (performance.getEntriesByType('navigation')[0] || {}).type;
  const was = keep.get('tl');
  // what was clicked becomes the same thing on the next page, where the browser can do that (view transitions)
  const carry = (el, name) => { if (el && !calm.matches) el.style.viewTransitionName = name; };
  root.classList.add('tl-js');
  if (arrived === 'back_forward' || (was && was.back)) root.classList.add('tl-calm');      // seen before: no entrance a second time

  // ---- choosing a year: a list that opens from its button; on the overview on a wide screen it stands open as a rail
  const pick = document.getElementById('tl-pick'), wide = matchMedia('(min-width: 1000px)');
  const rail = () => !!over && wide.matches;
  if (pick) {
    const lay = () => { pick.open = rail(); };
    lay(); wide.addEventListener('change', lay);
    pick.addEventListener('click', e => { if (e.target.closest('nav a') && !rail()) pick.open = false; });
    document.addEventListener('click', e => { if (pick.open && !rail() && !pick.contains(e.target)) pick.open = false; });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && pick.open && !rail() && !document.querySelector('dialog[open]')) { pick.open = false; pick.querySelector('summary').focus(); } });
  }

  if (over) {                                             // ---- the overview
    const yrs = [...over.querySelectorAll('.yr')], links = new Map([...pick.querySelectorAll('a[data-year]')].map(a => [a.dataset.year, a]));
    const list = pick.querySelector('nav');
    let cur = '', tick = 0;
    const mark = () => {                                  // the year one is in: the last whose head has passed the upper third of the window
      tick = 0;
      const line = innerHeight * .3;
      let y = yrs[0];
      for (const el of yrs) { if (el.getBoundingClientRect().top <= line) y = el; else break; }
      if (!y || y.dataset.year === cur) return;
      const old = links.get(cur), a = links.get(y.dataset.year);
      if (old) old.removeAttribute('aria-current');
      yrs.forEach(el => el.classList.toggle('cur', el === y));
      cur = y.dataset.year;
      if (!a) return;
      a.setAttribute('aria-current', 'true');
      pick.querySelectorAll('.dec').forEach(d => d.classList.toggle('cur', d.contains(a)));
      if (rail()) { const r = a.getBoundingClientRect(), b = list.getBoundingClientRect(); if (r.top < b.top || r.bottom > b.bottom) list.scrollTop += r.top < b.top ? r.top - b.top - 8 : r.bottom - b.bottom + 8; }
    };
    pick.addEventListener('click', e => {                 // a year far away: go there at once. Gliding past twenty years would fetch all their pictures on the way
      const a = e.target.closest('nav a'), el = a && plain(e) && document.getElementById(a.hash.slice(1));
      if (!el || Math.abs(el.getBoundingClientRect().top) < innerHeight * 3) return;
      e.preventDefault(); root.style.scrollBehavior = 'auto'; location.hash = a.hash;
      requestAnimationFrame(() => { root.style.scrollBehavior = ''; mark(); });
    });
    addEventListener('scroll', () => { if (!tick) tick = requestAnimationFrame(mark); }, { passive: true });
    addEventListener('resize', mark); addEventListener('load', mark);
    mark(); setTimeout(mark, 900);                        // again once the page has finished arriving

    if (root.classList.contains('tl-calm') || calm.matches || !('IntersectionObserver' in window)) yrs.forEach(y => y.classList.add('in'));
    else { const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -10% 0px' }); yrs.forEach(y => io.observe(y)); }

    over.addEventListener('click', e => {                 // leaving for an album: remember the place, and hand over what was clicked
      const a = e.target.closest('.yr a'); if (!a || !plain(e)) return;
      const yr = a.closest('.yr');
      keep.set('tl', { y: scrollY, year: yr.dataset.year, back: false });
      if (a.matches('.yr-lead, .yr-pre')) carry(a.querySelector('img'), 'tl-pic'); else carry(yr.querySelector('.yr-no'), 'tl-year');
    });
    addEventListener('pagehide', () => keep.set('tl', { ...(keep.get('tl') || {}), y: scrollY, back: false }));      // wherever one goes from here
    const place = (y, near) => {                          // back at the same place. Once more when the typefaces are in, because they move things a little
      let touched = false;
      const go = () => { if (!touched && (!near || Math.abs(scrollY - y) < near)) { scrollTo({ top: y, behavior: 'instant' }); mark(); } };
      ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(t => addEventListener(t, () => { touched = true; }, { once: true, passive: true }));
      requestAnimationFrame(go);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => requestAnimationFrame(go));
    };
    if (was && was.back) {                                // back from that album by its own link: the same place, not just the same year
      keep.set('tl', { ...was, back: false });
      if (location.hash === '#' + was.year) place(was.y);
    } else if (was && arrived === 'back_forward' && was.y !== undefined) place(was.y, 260);      // the browser's own way back: it knows the place, this only corrects a small drift
    return;
  }

  // ---- an album
  const L = JSON.parse(album.dataset.labels), year = album.dataset.year;
  const frames = [...album.querySelectorAll('.frame > a')], ids = frames.map(a => a.dataset.id), n = frames.length;
  album.addEventListener('click', e => { const a = e.target.closest('a[href^="timeline.html"], a[href^="timeline/de/index.html"]'); if (a && plain(e) && was) keep.set('tl', { ...was, back: was.year === year }); });

  const $ = id => document.getElementById('lb-' + id), lb = document.getElementById('lb');
  if (!lb || !lb.showModal || !n) return;                 // no dialogs here: the photographs stay plain links to their large files
  const view = $('view'), img = $('img'), msg = $('msg'), end = $('end'), cap = $('cap'), meta = $('meta'), cnt = $('count'), bPrev = $('prev'), bNext = $('next'), bZoom = $('zoom'), bClose = $('close');
  let i = -1, from = null, pushed = false, act = null, turn = 0, zoomed = false;
  const addr = id => { const u = new URL(location.href); if (id) u.searchParams.set('photo', id); else u.searchParams.delete('photo'); return u.pathname + u.search + (id ? '' : u.hash); };
  const fit = a => {                                      // the whole photograph inside the room it has, never larger than it is
    const b = view.getBoundingClientRect(), r = a.dataset.w / a.dataset.h;
    let w = Math.min(b.width, +a.dataset.w), h = w / r;
    if (h > b.height) { h = b.height; w = h * r; }
    return [Math.round(w), Math.round(h)];
  };
  const size = (w, h) => { img.style.width = w + 'px'; img.style.height = h + 'px'; };
  const settle = () => { if (act) { const a = act; act = null; a.anim.cancel(); a.done(); } };      // one animation at a time; ended at once, the view is open or closed
  const zoom = on => {
    zoomed = on; view.classList.toggle('zoom', on);
    bZoom.setAttribute('aria-pressed', on); bZoom.textContent = on ? L.zoom_out : L.zoom_in;
    if (i < 0 || i >= n) return;
    const a = frames[i];
    if (on) { size(a.dataset.w, a.dataset.h); view.scrollLeft = (a.dataset.w - view.clientWidth) / 2; view.scrollTop = (a.dataset.h - view.clientHeight) / 2; }
    else size(...fit(a));
  };
  const load = (a, t) => {                                // the large file; what is on the sheet stands in until it is here
    const big = new Image(), ok = () => { if (t === turn) { img.src = a.href; img.hidden = false; msg.hidden = true; } };
    const no = () => { if (t !== turn) return; img.hidden = true; msg.hidden = false; msg.innerHTML = `<p>${esc(L.failed)}</p><button type="button" data-do="retry">${esc(L.retry)}</button>`; };
    big.onload = ok; big.onerror = no; big.src = a.href;
  };
  const grip = () => {                                    // a button that has just gone (Previous on the first photograph, Try again) must not take the focus with it
    const f = document.activeElement;
    if (lb.open && (!f || f === document.body || !lb.contains(f) || f.closest('[hidden]'))) (bNext.hidden ? bClose : bNext).focus();
  };
  const show = (k, quiet) => {
    settle(); zoom(false);
    i = Math.max(0, Math.min(k, n)); turn++;
    const last = i === n, held = document.activeElement;
    end.hidden = !last; msg.hidden = true; img.hidden = last;
    bPrev.hidden = i === 0; bNext.hidden = last;
    if (last) {                                           // after the last photograph: a choice, not an exit
      cnt.textContent = ''; cap.textContent = ''; meta.textContent = ''; bZoom.hidden = true;
      end.innerHTML = `<h2>${esc(L.end.replace('{y}', year))}</h2><button type="button" data-do="again">${esc(L.again)}</button>` +
        (album.dataset.after ? `<a href="${esc(album.dataset.afterHref)}">${esc(L.onward.replace('{y}', album.dataset.after))}</a>` : '') + `<button type="button" data-do="album">${esc(L.album)}</button>`;
      if (held === bNext) end.querySelector('button').focus();
      return;
    }
    const a = frames[i], small = a.querySelector('img'), [w, h] = fit(a);
    size(w, h);
    img.alt = small.alt;
    if (small.complete && small.naturalWidth) img.src = small.currentSrc || small.src; else img.removeAttribute('src');
    load(a, turn);
    cnt.textContent = L.count.replace('{a}', i + 1).replace('{n}', n);
    cap.textContent = a.dataset.cap || ''; if (a.dataset.capLang) cap.lang = a.dataset.capLang; else cap.removeAttribute('lang');
    meta.textContent = [a.dataset.place, a.dataset.when, a.dataset.credit && L.by.replace('{c}', a.dataset.credit)].filter(Boolean).join(' · ');
    const can = a.dataset.w > w * 1.25;
    bZoom.hidden = !can; img.classList.toggle('can-zoom', can);

    [i + 1, i - 1].forEach(j => { if (frames[j]) new Image().src = frames[j].href; });      // the neighbours, so stepping does not wait. Never the whole year
    if (!quiet) try { history.replaceState(history.state, '', addr(ids[i])); } catch (e) { /* opened as a file */ }
    grip();
  };
  const flight = (a, back) => {                           // between the photograph's place on the sheet and its place in the large view
    const s = a.querySelector('img').getBoundingClientRect(), p = img.getBoundingClientRect();
    if (!s.width || !p.width || s.bottom < 0 || s.top > innerHeight) return null;
    const keys = [{ transformOrigin: '0 0', transform: `translate(${s.left - p.left}px, ${s.top - p.top}px) scale(${s.width / p.width}, ${s.height / p.height})` }, { transformOrigin: '0 0', transform: 'none' }];
    return img.animate(back ? keys.reverse() : keys, { duration: back ? 320 : 440, easing: back ? 'cubic-bezier(.4, 0, .6, 1)' : 'cubic-bezier(.2, .75, .2, 1)', fill: back ? 'forwards' : 'none' });
  };
  const open = (k, trigger, push) => {
    from = trigger || frames[k];
    if (push) { try { history.pushState({ lb: true }, '', addr(ids[k])); pushed = true; } catch (e) { /* opened as a file */ } }
    const fresh = !lb.open;
    if (fresh) { root.style.setProperty('--sb', innerWidth - root.clientWidth + 'px'); root.classList.add('lb-open'); lb.classList.remove('closing'); lb.showModal(); }
    show(k, true);
    if (fresh && trigger && moves()) {
      const anim = flight(frames[k]);
      if (anim) { lb.classList.add('opening'); const done = () => lb.classList.remove('opening'); act = { anim, done }; anim.onfinish = () => { if (act && act.anim === anim) { act = null; done(); } }; }
    }
  };
  const shut = byHistory => {
    if (!lb.open || lb.classList.contains('closing')) return;
    settle();
    const done = () => { lb.classList.remove('closing', 'opening'); lb.close(); };
    if (!byHistory) { try { if (pushed) history.back(); else history.replaceState(null, '', addr('')); } catch (e) { /* opened as a file */ } }
    pushed = false;
    const anim = moves() && i < n && !zoomed && !img.hidden ? flight(frames[i], true) : null;
    if (!anim) return done();
    lb.classList.add('closing'); act = { anim, done }; anim.onfinish = () => { if (act && act.anim === anim) { act = null; done(); } };
  };
  lb.addEventListener('close', () => {
    root.classList.remove('lb-open'); img.getAnimations().forEach(a => a.cancel()); img.removeAttribute('src'); i = -1; turn++;
    const f = from; from = null; if (f) f.focus({ preventScroll: true });      // back on the sheet where one was, the focus on the photograph that was opened
  });
  lb.addEventListener('cancel', e => { e.preventDefault(); shut(); });        // Escape
  const step = d => { if (i + d >= 0 && i + d <= n) show(i + d); };
  bPrev.addEventListener('click', () => step(-1)); bNext.addEventListener('click', () => step(1));
  bClose.addEventListener('click', () => shut());
  bZoom.addEventListener('click', () => zoom(!zoomed));
  img.addEventListener('click', () => { if (!bZoom.hidden) zoom(!zoomed); });
  lb.addEventListener('click', e => {
    const b = e.target.closest('[data-do]'); if (!b) return;
    if (b.dataset.do === 'again') { show(0); bNext.focus(); } else if (b.dataset.do === 'album') shut(); else if (b.dataset.do === 'retry') { msg.hidden = true; img.hidden = false; load(frames[i], turn); grip(); }
  });
  document.addEventListener('keydown', e => {             // on the document: the keys work wherever the focus has gone inside the view
    if (!lb.open || e.altKey || e.metaKey || e.ctrlKey) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.key === 'Home') { e.preventDefault(); show(0); } else if (e.key === 'End') { e.preventDefault(); show(n - 1); }
  });
  // a swipe is an extra way to step, for one finger on a photograph that is not enlarged. Pinching and panning stay what they are
  let sx = 0, sy = 0, sid = null, many = false;
  view.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') return; if (sid !== null) { many = true; return; } sid = e.pointerId; sx = e.clientX; sy = e.clientY; many = false; });
  view.addEventListener('pointerup', e => {
    if (e.pointerId !== sid) return;
    const dx = e.clientX - sx, dy = e.clientY - sy; sid = null;
    if (many || zoomed || (window.visualViewport && visualViewport.scale > 1.05)) return;
    if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.6) step(dx < 0 ? 1 : -1);
  });
  view.addEventListener('pointercancel', () => { sid = null; });
  addEventListener('resize', () => { if (lb.open && i >= 0 && i < n && !zoomed) { settle(); size(...fit(frames[i])); } });

  album.addEventListener('click', e => {
    const a = e.target.closest('.frame > a'); if (!a || !plain(e)) return;     // with a modifier key the large file opens the browser's way
    e.preventDefault(); open(frames.indexOf(a), a, true);
  });
  const fromAddress = () => ids.indexOf(new URLSearchParams(location.search).get('photo'));
  addEventListener('popstate', () => {
    const k = fromAddress();
    if (k >= 0) { if (lb.open) show(k, true); else open(k, null, false); pushed = !!(history.state && history.state.lb); }
    else if (lb.open) shut(true);
  });
  const first = fromAddress();                            // a link to one photograph: it opens over its album
  if (first >= 0) { open(first, null, false); pushed = !!(history.state && history.state.lb); frames[first].scrollIntoView({ block: 'center', behavior: 'instant' }); }
  window.tlAlbum = { state: () => ({ open: lb.open, i, n, zoomed, pushed, moving: !!act }) };
})();
