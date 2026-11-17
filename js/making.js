/* Making of. Two things, both of them extras: without this script the page reads the same, the hidden things open with
   a click on their line, and a picture's link simply opens the picture.

   1. An address that asks for the hidden things (#eggs, or one of their entries, #egg-…) opens the closed section
      and goes there. Nothing else opens it: who comes to read decides for themselves.
   2. The drafts and drawings open large, in the same view as the photographs on the DJ page (the dialog's look is in
      css/site.css). Arrow keys, the buttons or a swipe step through them; Escape or "Close" ends it, and the focus
      goes back to the picture that was opened. */
(() => {
  const spoiler = document.getElementById('eggs');
  const reveal = arriving => {
    let id = ''; try { id = decodeURIComponent(location.hash.slice(1)); } catch (e) {}
    const target = id && document.getElementById(id);
    if (!spoiler || !target || !spoiler.contains(target)) return;
    spoiler.open = true;
    requestAnimationFrame(() => target.scrollIntoView({ block: 'start', behavior: arriving ? 'instant' : 'auto' }));
  };
  addEventListener('hashchange', () => reveal(false)); reveal(true);
  // The page is still settling when it arrives (it comes in slightly enlarged, and its fonts follow): go there once more
  // when it has settled, unless the reader has moved on
  let moved = false; ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(k => addEventListener(k, () => { moved = true; }, { once: true, passive: true }));
  const again = () => { if (!moved) reveal(true); };
  const page = document.querySelector('.page'); if (page) page.addEventListener('animationend', again, { once: true });
  addEventListener('load', again); if (document.fonts && document.fonts.ready) document.fonts.ready.then(again);
  setTimeout(again, 1600);

  const dlg = document.getElementById('mk-gallery'), shots = [...document.querySelectorAll('.mk-zoom')];
  if (!dlg || !dlg.showModal || !shots.length) return;
  const $ = id => document.getElementById('mk-g-' + id), slide = $('slide');
  let i = 0, from = null;
  const show = () => {
    const a = shots[i], small = a.querySelector('img'), k = i;
    const img = new Image(); img.alt = small.alt; img.src = small.currentSrc || small.src;      // the small one is there at once, the large one follows
    slide.replaceChildren(img);
    if (a.href !== img.src) { const big = new Image(); big.onload = () => { if (k === i && dlg.open) img.src = big.src; }; big.src = a.href; }
    $('title').textContent = a.dataset.name || '';
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
})();
