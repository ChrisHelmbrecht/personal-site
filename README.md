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
- `bio.html`, `js/bio.js`, `assets/bio/` – the bio as a logbook: a chart of the North Atlantic (drawn from Natural Earth coastlines). A swallow carries an ink line from city to city as the chapters scroll, the camera follows, the current city blooms into colour, and the station's engraving (cut from the skull drawing, with the start page's films laid over it) comes alive. `assets/video/heli.mp4` is an Alouette II on white (Midjourney, Runway); `bio.js` draws it to a canvas and makes the white see-through Films of ink on white (helicopter, Teide, night sky) are drawn to a canvas with the white keyed out, so the engravings lie on the paper; `scripts/loop.py` turns a Runway clip into such a loop plus its first frame (the Teide's clouds run with `--reverse`, so they drift the way the trade wind blows there), `scripts/plate.py` turns a Midjourney ink drawing into a still plate (Saint Basil's for Moscow), `scripts/owl-matte.py` gives the owl film its own outline (picture above, matte below). Easter eggs: click the helicopter and it leaves to the right and returns from the left, with its sound (`assets/audio/alouette.mp3`, a recording of an Alouette flying by, from freeSFX, panned and faded with the flight); the snowboarder throws pixel powder across the text.
- `jaywalk.html`, `js/jaywalk.js` – DONT WALK, the game hidden under New York in the bio: click the New York engraving and a yellow cab crosses its foot (the page's only yellow); click the cab and you are on an avenue some year between 1997 and 2002. The light says DONT WALK and never changes, the traffic comes from the right, five doors wait on the far side; played like the road half of Frogger, six levels named after the years. Everything is drawn by the script on a 176 px canvas in nine colours and all sound is synthesised, so the game loads nothing. Vehicles are of the time: Crown Victoria cabs with the checker stripe, the white-and-blue police car, the city bus, a box truck, a stretch limousine with its antenna, bike messengers. No skyline is shown. The best score is kept in `localStorage` (`walk-best`, and `walk-sound` for the sound switch), nothing else.
- `js/flight.js`, `css/flight.css` – "Was soll das werden?", a hovering game hidden in the bio: click the helicopter, then click it again while it flies. Both files load only then, and so do the game's drawings and sounds. Three levels (`LEVELS` at the top of the script, next to `CFG` with the rest of the tuning): on "easy" the helicopter levels itself, on "realistic" it does not, so every input has to be taken out again. The instructor's three shouted lines are Chris's memories, word for word, and must not be reworded; they and his other lines are always shown as text (German, with an English gloss in the English version) and spoken when the sound is on. Best values are kept per level in `localStorage`, nothing else is stored. The key `` ` `` shows a debug read-out.
  - `assets/flight/*.webp` – cockpit, skyline (Olympiaturm, tent roof, Frauenkirche), forest edge, hangar with tower: Midjourney ink drawings made see-through by `scripts/flight-art.py <folder with the PNGs> assets/flight`. `alps.webp` is no drawing but the real chain as seen from the northern edge of Munich, from the Chiemgau to the Allgäu with the Zugspitze where it belongs: `scripts/alps.py <folder with the elevation tiles> assets/flight/alps.webp` computes it from SRTM elevation data (Terrain Tiles on AWS Open Data, not kept in the repository; credited on the making-of page) and renders it in ink. The game shows it as a far panorama, taller than life (`ALPS` in the script), fading out at both ends. The cockpit is the fixed frame with live needles on its six dials (their positions: `DIALS`); the others stand as upright boards in a drawn landscape. If a file is missing the script draws a plain stand-in itself.
  - `assets/audio/flight/*.mp3` – the instructor (ElevenLabs, voice "Leonard Berger", model `eleven_v4`, German) and `cabin.mp3`, the inside of an Alouette in flight (a recording from freeSFX; the file holds a seamless fourteen-second loop between 0.2 s and 14.2 s). Without them the game is silent and otherwise the same.
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

## Icon

`assets/icon.svg` is the favicon: a much simplified skull, blue line, white inside, nothing around it. `favicon.ico` (16, 32, 48 px) and `assets/icon-180.png` (the touch icon, on the site's paper because iOS wants it opaque) are rendered from it.

## Path film

`assets/video/path.mp4` is not the raw Seedance film (`assets/source/path-432x576.mp4`): in that one the lower wanderer loses his ornaments after four seconds and walks on as a plain dark puppet. `scripts/path-figure.py assets/source/path-432x576.mp4 assets/video/path.mp4` keeps him as drawn: it cuts him out of his first seconds and carries him along the puppet's way.

## Sound credits

The two helicopter recordings (`assets/audio/alouette.mp3`, `assets/audio/flight/cabin.mp3`) are cut from sound effects of [freeSFX](https://www.freesfx.co.uk/). Their licence asks for a credit with the site's URL: it stands on the making-of page under "Credits & Sound" (`making-of.html#credits`), which the menu links at its foot. Keep that credit for as long as the recordings are in use. The files are part of this site and not meant to be passed on by themselves.
