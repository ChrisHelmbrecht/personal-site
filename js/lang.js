/* Which language a visitor gets. Loaded in the head of every page that exists in two languages, before anything is drawn.

   The rule: a browser set to German gets German, every other browser gets English. Whoever uses the language switch in
   the header has chosen for themselves, and that choice is kept (in this browser only) and wins from then on.

   The pages are real pages in both languages (bio.html and de/bio.html), each naming its twin in the head
   (<link rel="alternate" hreflang="…">). All this script does is send a visitor who wants German from an English page
   to its German twin. It never sends anyone from a German page to the English one: whoever opens a German address asked
   for it, and a search engine reading the German pages must be able to stay on them. */
(() => {
  const root = document.documentElement, here = root.lang === 'de' ? 'de' : 'en';
  let chosen = null; try { chosen = localStorage.getItem('lang'); } catch (e) {}
  if (chosen !== 'de' && chosen !== 'en') chosen = null;
  const browser = (navigator.language || '').toLowerCase().startsWith('de') ? 'de' : 'en';
  const twin = l => { const a = document.querySelector(`link[rel="alternate"][hreflang="${l}"]`); return a ? new URL(a.href).pathname : null; };   // the path only: the same pages work at any address
  const lang = window.siteLang = {
    here, want: chosen || browser, leaving: false, twin,
    choose(l) { try { localStorage.setItem('lang', l); } catch (e) {} },
  };
  // The page for an address that does not exist is one file holding both languages: it shows the one that fits
  if (root.hasAttribute('data-both')) {
    lang.here = chosen || (/(^|\/)de\//.test(location.pathname) ? 'de' : browser);
    root.lang = lang.here; root.classList.add('picked');
    return;
  }
  const to = lang.want === 'de' && here === 'en' && twin('de');
  if (!to || to === location.pathname) return;
  lang.leaving = true;
  root.style.visibility = 'hidden';                                   // nothing of the English page flashes up on the way
  setTimeout(() => { root.style.visibility = ''; lang.leaving = false; }, 4000);   // should the German page not come, this one is shown after all
  location.replace(to + location.search + location.hash);
})();
