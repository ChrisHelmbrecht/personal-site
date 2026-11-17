/* Contact: the postcard. Everything here is an extra: without this script the address is a normal mail link and can be
   selected and copied by hand.

   1. "Copy address" puts the address on the clipboard, and only when that has really happened a postmark falls onto
      the card, with today's date. If the browser refuses, the address is selected instead and the card says so.
   2. A press on the mail link lifts the card for a moment. The link is not held back by that, and nothing claims a
      message was sent.
   3. The stamp is alive, and nothing points at it: the first press makes the owl look round (its film, fetched only
      then), the second lets it fly out of the stamp onto the card's edge, the third sends it home. With reduced
      motion it changes places without flying and without the film. */
(() => {
  const $ = id => document.getElementById('pc-' + id);
  const card = $('card'), copy = $('copy'), mark = $('mark'), say = $('say'), mail = $('mail');
  if (!card || !copy || !mail) return;
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const address = mail.textContent.trim(), two = n => String(n).padStart(2, '0');

  // ---- copying, and the postmark
  const postmark = () => {
    const d = new Date();
    $('date').textContent = `${two(d.getDate())}.${two(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)}`;
    $('hour').textContent = `–${two(d.getHours())}`;
    mark.hidden = false; mark.classList.remove('hit'); void mark.offsetWidth; mark.classList.add('hit');   // a second copy stamps again
  };
  const select = () => { const r = document.createRange(), s = getSelection(); r.selectNodeContents(mail); s.removeAllRanges(); s.addRange(r); };
  const done = () => { postmark(); say.textContent = say.dataset.copied; };
  const byHand = () => {                                  // the older way; if that fails too, the address stays selected for the reader's own copy
    select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
    if (ok) { getSelection().removeAllRanges(); done(); } else say.textContent = say.dataset.failed;
  };
  copy.hidden = false;
  copy.addEventListener('click', () => {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(address).then(done, byHand); else byHand();
  });

  // ---- the card is taken off the table for a moment
  card.addEventListener('animationend', e => { if (e.target === card) card.classList.remove('lift'); });
  card.querySelectorAll('a[href^="mailto:"]').forEach(a => a.addEventListener('click', () => { if (calm.matches) return; card.classList.remove('lift'); void card.offsetWidth; card.classList.add('lift'); }));

  // ---- the stamp
  const stamp = $('stamp'), owl = $('owl'); if (!stamp || !owl) return;
  const pic = stamp.querySelector('.pc-pic'), still = pic.querySelector('img'), FROM = 2.4;   // the film's owl looks straight ahead there, like the drawn one
  let state = 0, busy = false, film = null;              // 0 at home · 1 has looked round · 2 out on the edge
  const rest = () => { pic.classList.remove('filmed'); if (film) film.pause(); };
  const look = () => {
    if (film) { film.currentTime = FROM; return; }
    const frame = document.createElement('i'); film = document.createElement('video');
    film.muted = true; film.playsInline = true; film.setAttribute('playsinline', ''); film.preload = 'auto'; film.tabIndex = -1; film.setAttribute('aria-hidden', 'true');
    film.addEventListener('loadedmetadata', () => { film.currentTime = FROM; }, { once: true });
    film.addEventListener('seeked', () => { if (state === 1) film.play().catch(rest); });
    film.addEventListener('playing', () => { if (state === 1) pic.classList.add('filmed'); });
    film.addEventListener('ended', rest); film.addEventListener('error', rest);
    frame.appendChild(film); pic.appendChild(frame); film.src = 'assets/video/owl-ink.mp4';
  };
  // from the owl's place on the edge to its place in the stamp, measured in the card's own, slightly turned frame
  const centre = el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  const way = () => {
    const a = centre(still), b = centre(owl), m = new DOMMatrix(getComputedStyle(card).transform); m.e = m.f = 0;
    const p = m.inverse().transformPoint(new DOMPoint(a[0] - b[0], a[1] - b[1])), s = still.offsetWidth / owl.offsetWidth;
    return [`translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) scale(${s.toFixed(3)}) rotate(2.2deg)`,
            `translate(${(p.x * .42).toFixed(1)}px, ${(p.y * .5 - 46).toFixed(1)}px) scale(${((s + 1) / 2 + .06).toFixed(3)}) rotate(-9deg)`, 'none'];
  };
  const out = () => {
    rest(); owl.hidden = false; const w = way(); pic.classList.add('empty'); state = 2;
    if (calm.matches || !owl.animate) return;
    busy = true;
    owl.animate([{ transform: w[0] }, { transform: w[1], offset: .58 }, { transform: w[2] }], { duration: 1500, easing: 'cubic-bezier(.4, 0, .3, 1)' }).onfinish = () => { busy = false; };
  };
  const home = () => {
    const w = way(); state = 0;
    const land = () => { if (document.activeElement === owl) stamp.focus({ preventScroll: true }); owl.hidden = true; pic.classList.remove('empty'); busy = false; };
    if (calm.matches || !owl.animate) return land();
    busy = true;
    owl.animate([{ transform: w[2] }, { transform: w[1], offset: .42 }, { transform: w[0] }], { duration: 1400, easing: 'cubic-bezier(.4, 0, .3, 1)' }).onfinish = land;
  };
  const press = () => {
    if (busy) return;
    if (state === 2) return home();
    if (state === 0 && !calm.matches) { state = 1; return look(); }
    out();
  };
  stamp.addEventListener('click', press); owl.addEventListener('click', press);
})();
