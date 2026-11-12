# personal-site

Chris Helmbrecht's private website. A blue-ink skull is the navigation: every element in it is a door.

## Run it

Open `index.html` in a browser. No build step.

## Files

- `index.html` – the page (markup, styles, script)
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
