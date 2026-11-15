# personal-site

Chris Helmbrecht's private website. A blue-ink skull is the navigation: every element in it is a door.

## Run it

No build step. Serve the folder (`python3 -m http.server`) and open it, or open `index.html` directly.

## Files

- `index.html` – start page: the skull and the night-sound switch
- `dj.html`, `bio.html`, `writing.html`, `timeline.html`, `blog.html`, `press.html`, `contact.html` – one page per room
- `game.html`, `js/game.js`, `assets/game/*.png` – Owl Night Long, the hidden arcade game. Its only entrance is the unmarked `<a class="egg">` on the skull's left cheekbone in `index.html`. `game.html#3` starts at night 3 (1–5)
- `.htaccess` – security headers, no-cache while the site is being built, staging kept out of search engines, working files blocked
- `assets/fonts/` – Cormorant Garamond and DM Mono, served from the site itself (no request to Google)
- `robots.txt`, `llms.txt` – what crawlers and AI assistants may read, and a plain-text description of the site for them
- `bio.html`, `js/bio.js`, `assets/bio/` – the bio as a logbook: a chart of the North Atlantic (drawn from Natural Earth coastlines). A swallow carries an ink line from city to city as the chapters scroll, the camera follows, the current city blooms into colour, and the station's engraving (cut from the skull drawing, with the start page's films laid over it) comes alive. `assets/video/heli.mp4` is an Alouette II on white (Midjourney, Runway); `bio.js` draws it to a canvas and makes the white see-through Films of ink on white (helicopter, Teide, night sky) are drawn to a canvas with the white keyed out, so the engravings lie on the paper; `scripts/loop.py` turns a Runway clip into such a loop plus its first frame, `scripts/owl-matte.py` gives the owl film its own outline (picture above, matte below). Easter eggs: click the helicopter and it leaves to the right and returns from the left, with its sound (`assets/audio/alouette.mp3`, ElevenLabs, panned and faded with the flight); the snowboarder throws pixel powder across the text.
- Load: the films are sized for the space they fill, the page's own animation loops run at 30 pictures a second, everything pauses in a hidden tab and after three minutes without input, and the bio keys its films on the graphics chip (WebGL, with a canvas fallback). Measure on a real machine (`top` on the browser's helper processes); the headless test browser has no graphics chip and misleads here.
- Class names are shared across pages in one stylesheet: the start page owns `.film`, the bio uses `.reel`. Check the start page after touching the bio's styles.
- `css/site.css`, `js/site.js` – shared styles and script (the menu is built in `site.js`)
- `assets/video/*.mp4` – short looping films laid over parts of the skull (sky, owl, path, city, water)
- `assets/audio/night-owl.mp3` – 30-second night loop with an owl (ElevenLabs)
- `assets/skull.webp` – web version of the skull
- `assets/source/skull-master.png` – master image from Midjourney (2048 px)
- `timeline-data.js` – the timeline's years and photos (generated)
- `scripts/build-timeline.mjs` – rebuilds `timeline-data.js` from the photo folders

## Adding timeline photos

One folder per year:

```
assets/timeline/1999/cover.jpg    cover of the year (name contains "cover")
assets/timeline/1999/01.jpg ...   the gallery, in filename order
assets/timeline/1999/label.txt    optional caption, e.g. "New York"
```

Then run `node scripts/build-timeline.mjs`.

## Hotspots

The clickable areas are the `<a class="spot">` elements in `index.html`, positioned in percent of the skull image.
