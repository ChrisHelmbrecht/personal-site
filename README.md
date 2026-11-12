# personal-site

Chris Helmbrecht's private website. A blue-ink skull is the navigation: every element in it is a door.

## Run it

No build step. Serve the folder (`python3 -m http.server`) and open it, or open `index.html` directly.

## Files

- `index.html` – start page: the skull and the night-sound switch
- `music.html`, `bio.html`, `writing.html`, `timeline.html`, `blog.html`, `contact.html` – one page per room
- `css/site.css`, `js/site.js` – shared styles and script (the menu is built in `site.js`)
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
