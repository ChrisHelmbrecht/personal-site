// A 360° film in a pop-up: the sea at Tenerife, filmed with a camera that sees all around. Drag to look around, as if standing
// in the water. Loaded by js/bio.js only when the Tenerife engraving is clicked. The film is fetched whole, with its progress
// shown, so that it loops without a stall; until it is there a still of its first frame can already be looked around in.
// Each pixel of the window is a direction; the shader looks that direction up in the film (longitude across, latitude down).
(() => {
  if (window.pano) return;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rad = d => d * Math.PI / 180;
  const VERT = 'attribute vec2 p; varying vec2 q; void main() { q = p; gl_Position = vec4(p, 0., 1.); }';
  const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 q; uniform sampler2D t; uniform vec2 view; uniform vec4 turn;   // view: tan of half the field of view, across and up; turn: sin and cos of yaw, sin and cos of pitch
void main() {
  vec3 d = normalize(vec3(q * view, -1.));
  d = vec3(d.x, d.y * turn.w - d.z * turn.z, d.y * turn.z + d.z * turn.w);   // look up or down ...
  d = vec3(d.x * turn.y - d.z * turn.x, d.y, d.x * turn.x + d.z * turn.y);   // ... then turn
  gl_FragColor = texture2D(t, vec2(atan(d.x, -d.z) / 6.2831853 + .5, .5 - asin(clamp(d.y, -1., 1.)) / 3.1415927));
}`;
  const TEXT = { hint: 'Drag to look around', load: 'Loading', soundOn: 'Sound on', soundOff: 'Sound off', pause: 'Pause', play: 'Play', close: 'Close', flat: 'This browser cannot show the film all around. Here it is flat.' };
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let el = null, cv, gl, tex, video, ui = {}, raf = 0, opened = false, trigger = null, abort = null, blob = '';
  let yaw = 0, pitch = 0, fov = rad(92), vy = 0, vp = 0, drift = true, dirty = true, fresh = false, held = new Map(), pinch = 0, keys = new Set(), last = 0, wantSound = true, loaded = false;

  const look = () => {                             // one frame: steer, then draw if anything changed
    raf = requestAnimationFrame(look);
    const now = performance.now(), dt = Math.min(.05, (now - last) / 1000); last = now;
    const kx = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0), ky = (keys.has('ArrowUp') ? 1 : 0) - (keys.has('ArrowDown') ? 1 : 0);
    if (kx || ky) { vy = kx * 1.1; vp = ky * .8; drift = false; }
    if (!held.size) { if (drift && !calm) vy = .035; if (Math.abs(vy) > .0005 || Math.abs(vp) > .0005) { yaw += vy * dt; pitch = clamp(pitch + vp * dt, -1.45, 1.45); dirty = true; } if (!drift) { vy *= Math.pow(.02, dt); vp *= Math.pow(.02, dt); } }
    if (video && !video.paused && !video.requestVideoFrameCallback && video.readyState >= 2) fresh = true;
    if (!gl || (!dirty && !fresh)) return;
    if (fresh && video && video.readyState >= 2) { try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video); } catch (e) {} } fresh = false; dirty = false;
    const w = cv.width, h = cv.height, T = Math.tan(fov / 2), a = w / h;
    gl.viewport(0, 0, w, h); gl.uniform2f(ui.view, a >= 1 ? T : T * a, a >= 1 ? T / a : T); gl.uniform4f(ui.turn, Math.sin(yaw), Math.cos(yaw), Math.sin(pitch), Math.cos(pitch));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const size = () => { const r = cv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2); if (r.width < 2) return; cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); dirty = true; };
  const perPixel = () => fov / Math.max(cv.clientWidth, cv.clientHeight);   // how much of the view one pixel of dragging is

  const setup = () => {
    gl = cv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' }); if (!gl) return false;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return (gl = null, false);
    gl.useProgram(prog); gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const p = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(p); gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);
    ui.view = gl.getUniformLocation(prog, 'view'); ui.turn = gl.getUniformLocation(prog, 'turn');
    tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([214, 217, 214]));
    cv.addEventListener('webglcontextlost', e => { e.preventDefault(); close(); });
    return true;
  };

  // ---- the film: fetched whole, so the percentage is true and the loop never waits for the network
  const labels = () => { ui.snd.textContent = wantSound ? TEXT.soundOn : TEXT.soundOff; ui.snd.setAttribute('aria-pressed', wantSound); ui.play.textContent = video && !video.paused ? TEXT.pause : TEXT.play; };
  const start = () => {                            // with sound if the browser lets us, otherwise silent until the visitor asks
    if (!video) return; video.muted = !wantSound;
    const p = video.play(); if (p) p.catch(() => { video.muted = true; wantSound = false; labels(); return video.play(); }).catch(() => {}).then(labels);
  };
  const film = (src, direct) => {
    video = Object.assign(document.createElement('video'), { loop: true, playsInline: true, preload: 'auto', crossOrigin: 'anonymous' }); video.setAttribute('playsinline', ''); video.className = 'pn-film'; el.appendChild(video);
    const frame = () => { fresh = true; if (video && video.requestVideoFrameCallback) video.requestVideoFrameCallback(frame); };
    video.addEventListener('canplay', () => { if (loaded) return; loaded = true; ui.load.hidden = true; ui.play.hidden = false; ui.snd.hidden = false; frame(); if (!calm) start(); labels(); }, { once: true });
    video.addEventListener('seeked', () => { fresh = true; }); video.addEventListener('play', labels); video.addEventListener('pause', labels);
    video.addEventListener('error', () => { if (!opened || loaded) return; video.remove(); video = null; direct ? next() : film(ui.url, true); }, { once: true });   // a browser that refuses the fetched copy gets the file itself, and after that the smaller film
    video.src = src;
  };
  const next = () => { const s = ui.queue.shift(); if (s) fetchFilm(s[0], s[1]); else ui.load.textContent = '–'; };
  const fetchFilm = (url, bytes) => {
    ui.url = url; abort = new AbortController(); ui.load.hidden = false; ui.load.textContent = `${TEXT.load} 0 %`;
    fetch(url, { signal: abort.signal }).then(r => { if (!r.ok) throw 'missing'; if (!r.body) throw 0; const total = +r.headers.get('content-length') || bytes, rd = r.body.getReader(), parts = []; let got = 0;
      const pump = () => rd.read().then(({ done, value }) => { if (done) return new Blob(parts, { type: 'video/mp4' }); parts.push(value); got += value.length; ui.load.textContent = `${TEXT.load} ${Math.min(99, Math.round(got / total * 100))} %`; return pump(); });
      return pump(); })
      .then(b => { if (!opened) return; blob = URL.createObjectURL(b); film(blob, false); })
      .catch(e => { if (!opened || (e && e.name === 'AbortError')) return; e === 'missing' ? next() : film(url, true); });
  };

  // ---- pointer, wheel, keys
  const down = e => { cv.setPointerCapture(e.pointerId); held.set(e.pointerId, [e.clientX, e.clientY]); drift = false; vy = vp = 0; pinch = 0; el.classList.add('looked'); };
  const move = e => { const at = held.get(e.pointerId); if (!at) return; const dx = e.clientX - at[0], dy = e.clientY - at[1]; held.set(e.pointerId, [e.clientX, e.clientY]);
    if (held.size === 2) { const [a, b] = [...held.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) fov = clamp(fov * pinch / d, rad(40), rad(110)); pinch = d; dirty = true; return; }   // two fingers: closer or wider
    const k = perPixel(); yaw -= dx * k; pitch = clamp(pitch + dy * k, -1.45, 1.45); vy = -dx * k * 60 * .6; vp = dy * k * 60 * .6; dirty = true; };   // the world is taken by the hand and let go with a little swing
  const up = e => { held.delete(e.pointerId); pinch = 0; };
  const wheel = e => { e.preventDefault(); fov = clamp(fov * Math.exp(e.deltaY * .0012), rad(40), rad(110)); drift = false; dirty = true; };
  const key = e => { if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) { if (e.type === 'keydown' && e.key === ' ' && e.target === cv && video && loaded) { e.preventDefault(); video.paused ? start() : video.pause(); } return; }
    e.preventDefault(); e.type === 'keydown' ? keys.add(e.key) : keys.delete(e.key); el.classList.add('looked'); };
  const hide = () => { if (!video || !loaded) return; if (document.hidden) { ui.was = !video.paused; video.pause(); } else if (ui.was) start(); };

  const close = () => {
    if (!opened) return; opened = false; cancelAnimationFrame(raf); removeEventListener('keydown', key); removeEventListener('keyup', key); removeEventListener('resize', size); document.removeEventListener('visibilitychange', hide);
    if (abort) abort.abort(); if (video) { video.pause(); video.removeAttribute('src'); video.load(); } if (blob) URL.revokeObjectURL(blob);
    if (gl) { const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext(); }
    if (el.open) el.close(); el.remove(); el = gl = video = null; blob = ''; loaded = false; held.clear(); keys.clear();
    document.documentElement.classList.remove('lesson'); document.dispatchEvent(new Event('lesson:close')); if (trigger && trigger.focus) trigger.focus({ preventScroll: true });
  };
  const open = (o, from) => {
    if (opened) return; opened = true; trigger = from || null; yaw = rad(o.yaw || 0); pitch = 0; fov = rad(92); vy = vp = 0; drift = true; dirty = true; wantSound = true;
    if (!document.querySelector('link[data-pano]')) document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: 'css/pano.css' })).dataset.pano = '1';
    el = document.createElement('dialog'); el.className = 'pn'; el.setAttribute('aria-label', o.label || '360° film');
    el.innerHTML = `<canvas class="pn-view" tabindex="0" aria-label="${o.label || '360° film'}. ${TEXT.hint}, or use the arrow keys."></canvas>
      <div class="pn-tools"><button type="button" id="pn-snd" hidden></button><button type="button" id="pn-play" hidden></button><button type="button" id="pn-x" aria-label="${TEXT.close}">×</button></div>
      <p class="pn-tag">${o.tag || ''}</p><p class="pn-hint">${TEXT.hint}</p><p class="pn-load" id="pn-load" role="status" hidden></p>`;
    document.body.appendChild(el); cv = el.querySelector('canvas');
    ui = { snd: el.querySelector('#pn-snd'), play: el.querySelector('#pn-play'), load: el.querySelector('#pn-load') };
    el.querySelector('#pn-x').addEventListener('click', close); el.addEventListener('cancel', e => { e.preventDefault(); close(); });
    ui.snd.addEventListener('click', () => { wantSound = !wantSound; if (video) { video.muted = !wantSound; if (wantSound && video.paused) start(); } labels(); });
    ui.play.addEventListener('click', () => { if (!video) return; video.paused ? start() : video.pause(); });
    document.documentElement.classList.add('lesson'); document.dispatchEvent(new Event('lesson:open'));   // the page behind rests, as it does for the flying lesson
    el.showModal ? el.showModal() : el.setAttribute('open', '');
    const small = (matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 700) || (navigator.connection && navigator.connection.saveData);
    if (!setup()) {                                // no WebGL: the film as it is, with the browser's own controls
      cv.remove(); el.classList.add('flat'); el.querySelector('.pn-hint').textContent = TEXT.flat;
      video = Object.assign(document.createElement('video'), { controls: true, loop: true, playsInline: true, src: o.small[0], poster: o.poster }); video.className = 'pn-flat'; el.prepend(video); return;
    }
    ui.queue = small || gl.getParameter(gl.MAX_TEXTURE_SIZE) < 3840 ? [o.small] : [o.large, o.small];
    const still = new Image(); still.onload = () => { if (opened && gl && !loaded) { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, still); dirty = true; } }; still.src = o.poster;
    size(); addEventListener('resize', size); addEventListener('keydown', key); addEventListener('keyup', key); document.addEventListener('visibilitychange', hide);
    cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); for (const n of ['pointerup', 'pointercancel', 'lostpointercapture']) cv.addEventListener(n, up);
    cv.addEventListener('wheel', wheel, { passive: false }); cv.focus({ preventScroll: true });
    next(); last = performance.now(); raf = requestAnimationFrame(look);
  };
  window.pano = { open, close, get state() { return { opened, loaded, yaw, pitch, fov, playing: !!(video && !video.paused), muted: !!(video && video.muted), src: video ? video.currentSrc.slice(0, 5) : '', w: video ? video.videoWidth : 0 }; } };
})();
