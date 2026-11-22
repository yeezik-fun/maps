// ================= Percorso attivo e navigazione passo passo =================
'use strict';

// ---------- Icone delle manovre ----------
const SHAPES = {
  'straight':     { p: 'M24 44V13', h: [24, 9, -90] },
  'right':        { p: 'M19 44V27Q19 18 28 18H33', h: [37, 18, 0], g: 'M19 27V5' },
  'left':         { p: 'M29 44V27Q29 18 20 18H15', h: [11, 18, 180], g: 'M29 27V5' },
  'slight right': { p: 'M20 44V30L31 17', h: [33.6, 13.9, -50], g: 'M20 30V5' },
  'slight left':  { p: 'M28 44V30L17 17', h: [14.4, 13.9, -130], g: 'M28 30V5' },
  'sharp right':  { p: 'M18 44V15L31 28', h: [33.8, 30.8, 45], g: 'M18 15V4' },
  'sharp left':   { p: 'M30 44V15L17 28', h: [14.2, 30.8, 135], g: 'M30 15V4' },
  'uturn':        { p: 'M30 44V18Q30 8 22 8Q14 8 14 18V27', h: [14, 31, 90] }
};
const HEAD = (x, y, a, fill = '#fff') => `<g transform="translate(${x} ${y}) rotate(${a})"><path class="mh" d="M8.5 0-4.5-8.2-4.5 8.2Z" fill="${fill}" stroke="${fill}" stroke-width="2" stroke-linejoin="round"/></g>`;
const SW = 5.5;
function shapeSVG(mod, { ghost = true, sw = SW } = {}) {
  const sh = SHAPES[mod] || SHAPES.straight;
  return `<svg viewBox="0 0 48 48" fill="none" stroke-linecap="round" stroke-linejoin="round">` +
    (ghost && sh.g ? `<path class="gh" d="${sh.g}" stroke="rgba(255,255,255,.28)" stroke-width="${sw}"/>` : '') +
    `<path class="mv" pathLength="1" d="${sh.p}" stroke="#fff" stroke-width="${sw}"/>` + HEAD(...sh.h) + `</svg>`;
}
function roundaboutSVG(exit) {
  const cx = 24, cy = 23, r = 8, th = Math.max(-225, 90 - 90 * (exit || 1)), t = rad(th);
  const P = k => [(cx + k * Math.cos(t)).toFixed(2), (cy + k * Math.sin(t)).toFixed(2)];
  const [ex, ey] = P(r), [ox, oy] = P(12), [hx, hy] = P(15);
  const large = (90 - th) > 180 ? 1 : 0;
  return `<svg viewBox="0 0 48 48" fill="none" stroke-linecap="round" stroke-linejoin="round">` +
    `<circle class="gh" cx="${cx}" cy="${cy}" r="${r}" stroke="rgba(255,255,255,.3)" stroke-width="3.5"/>` +
    `<path class="mv" pathLength="1" d="M24 45V${cy + r}A${r} ${r} 0 ${large} 0 ${ex} ${ey}L${ox} ${oy}" stroke="#fff" stroke-width="5"/>` +
    HEAD(hx, hy, th) +
    `<text class="gh" x="${cx}" y="${cy + 3}" text-anchor="middle" font-size="8.5" font-weight="800" fill="#fff" stroke="none" font-family="-apple-system,Arial">${exit || 1}</text></svg>`;
}
const FLAG_SVG = `<svg viewBox="0 0 48 48" fill="none" stroke-linecap="round" stroke-linejoin="round"><path class="mv" pathLength="1" d="M15 44V7" stroke="#fff" stroke-width="5"/><path class="mh" d="M17 8h18l-4.5 7 4.5 7H17Z" fill="#ff8ee0" stroke="#fff" stroke-width="2.5"/></svg>`;
const TURN_IT = { 'left': 'Svolta a sinistra', 'right': 'Svolta a destra', 'slight left': 'Tieni la sinistra', 'slight right': 'Tieni la destra', 'sharp left': 'Svolta decisamente a sinistra', 'sharp right': 'Svolta decisamente a destra', 'straight': 'Prosegui dritto', 'uturn': 'Fai inversione' };
function describe(step) {
  const m = step.maneuver, name = step.name || '';
  if (m.type === 'arrive') return { verb: 'Arrivo', street: destName || 'Destinazione', svg: FLAG_SVG, short: 'arrivo', mod: 'straight', arrive: true };
  if (/roundabout|rotary/.test(m.type)) { const verb = `Alla rotonda, ${m.exit || 1}ª uscita`; return { verb, street: name || verb, svg: roundaboutSVG(m.exit), short: `rotonda, ${m.exit || 1}ª uscita`, mod: 'straight', round: m.exit || 1 }; }
  const mod = m.type === 'depart' ? 'straight' : (m.modifier || 'straight');
  const verb = m.type === 'depart' ? 'Parti' : m.type === 'merge' ? 'Immettiti' : m.type === 'on ramp' ? 'Prendi la rampa' : m.type === 'off ramp' ? 'Prendi l\'uscita' : (TURN_IT[mod] || 'Prosegui');
  return { verb, street: name || verb, svg: shapeSVG(mod), short: name || verb.toLowerCase(), mod };
}

// ---------- Percorso attivo ----------
let route = null, rerouting = false, routeSeq = 0, dest = null, destName = '';
const nav = { mode: null, d: 0, idx: 0, kmh: 0, startTime: 0, overview: false };
const NAV_VIEW = { car: { pitch: 52, zoom: 16.8 }, bike: { pitch: 50, zoom: 17.3 }, foot: { pitch: 48, zoom: 17.8 } };

function setRoute(data, { animate = true } = {}) {
  const coords = data.coords, cum = [0];
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + dist(coords[i - 1], coords[i]));
  let acc = 0; const steps = data.steps.map(s => { const o = { startDist: acc, step: s }; acc += s.distance; return o; });
  route = { mode: data.mode || 'car', coords, cum, total: cum[cum.length - 1] || 1, duration: data.duration, steps, maxspeed: data.maxspeed || [], cams: [], ztl: [], ztlEntries: [], sigs: [], seq: ++routeSeq, data };
  matchSignals();
  nav.d = 0; nav.idx = 0; stepKey = null;
  map.getSource('cams').setData(emptyFC); map.getSource('ztl').setData(emptyFC);
  winKey = ''; setRouteWindow(0, animate ? 1e-5 : 1.0001);
  map.getSource('route').setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords } });
  if (coords.length > 1) camB = bearing(coords[0], coords[1]);
  if (animate) drawRouteAnimated();
  if (route.mode === 'car') loadExtras(route);
}
function clearRoute() {
  route = null; cancelAnimationFrame(drawRaf); drawing = false;
  ['route', 'route-alt', 'cams', 'ztl'].forEach(s => map.getSource(s) && map.getSource(s).setData(emptyFC));
}

let drawRaf, drawing = false, winKey = '';
const CLEAR = 'rgba(0,0,0,0)';
function setRouteWindow(f0, f1) {
  f0 = Math.max(0, Math.min(1, f0)); if (f1 >= 0.9999) f1 = 1.0001; f1 = Math.max(f0 + 1e-5, Math.min(1.0001, f1));
  const key = f0.toFixed(4) + '|' + f1.toFixed(4);
  if (key === winKey || !map.getLayer('route-line')) return;
  winKey = key;
  map.setPaintProperty('route-line', 'line-gradient', ['step', ['line-progress'], CLEAR, f0, '#ff8ee0', f1, CLEAR]);
  map.setPaintProperty('route-core', 'line-gradient', ['step', ['line-progress'], CLEAR, f0, '#ffc6f0', f1, CLEAR]);
}
function drawRouteAnimated() {
  cancelAnimationFrame(drawRaf); drawing = true;
  const rt = route, t0 = performance.now(), dur = Math.min(1600, 700 + rt.total / 10);
  const f = t => {
    if (rt !== route) { drawing = false; return; }
    const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3), f0 = nav.d / rt.total;
    setRouteWindow(f0, f0 + (1 - f0) * e);
    if (k < 1) drawRaf = requestAnimationFrame(f); else drawing = false;
  };
  drawRaf = requestAnimationFrame(f);
}
function pointAt(d) {
  const { coords, cum } = route;
  if (coords.length < 2) return coords[0];
  let i = 1; while (i < cum.length - 1 && cum[i] < d) i++;
  const a = coords[i - 1], b = coords[i], seg = cum[i] - cum[i - 1] || 1, t = Math.min(1, Math.max(0, (d - cum[i - 1]) / seg));
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
function project(p, from = 0, to = Infinity) {
  const { coords, cum } = route, kx = 111320 * Math.cos(rad(p[1])), ky = 110540;
  let best = { off: Infinity, d: 0, idx: 0 };
  const a0 = Math.max(0, from), a1 = Math.min(coords.length - 1, to);
  for (let i = a0; i < a1; i++) {
    const ax = (coords[i][0] - p[0]) * kx, ay = (coords[i][1] - p[1]) * ky;
    const bx = (coords[i + 1][0] - p[0]) * kx, by = (coords[i + 1][1] - p[1]) * ky;
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-9;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L2));
    const ox = ax + dx * t, oy = ay + dy * t, off = Math.hypot(ox, oy);
    if (off < best.off) best = { off, d: cum[i] + t * (cum[i + 1] - cum[i]), idx: i };
  }
  return best;
}
function matchSignals() {
  if (!route) return;
  const out = [];
  for (const f of sigFeatures.values()) {
    const k = f.properties.k; if (k === 'crossing') continue;
    const pr = project(f.geometry.coordinates);
    if (pr.off < 14) out.push({ d: pr.d, k });
  }
  out.sort((a, b) => a.d - b.d);
  route.sigs = out.filter((x, i) => !i || x.d - out[i - 1].d > 25 || x.k !== out[i - 1].k);
}

// ---------- Autovelox e ZTL lungo il percorso ----------
function stitch(ways) {
  const same = (a, b) => Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7;
  const rings = [], pool = ways.filter(w => w.length > 1).map(w => w.slice());
  while (pool.length) {
    let ring = pool.shift(), changed = true;
    while (changed && !same(ring[0], ring[ring.length - 1])) {
      changed = false;
      for (let i = 0; i < pool.length; i++) {
        const w = pool[i], end = ring[ring.length - 1];
        if (same(end, w[0])) ring = ring.concat(w.slice(1));
        else if (same(end, w[w.length - 1])) ring = ring.concat(w.slice(0, -1).reverse());
        else continue;
        pool.splice(i, 1); changed = true; break;
      }
    }
    if (ring.length > 3 && same(ring[0], ring[ring.length - 1])) rings.push(ring);
  }
  return rings;
}
async function loadExtras(rt) {
  let s = 90, w = 180, n = -90, e = -180;
  rt.coords.forEach(([x, y]) => { s = Math.min(s, y); n = Math.max(n, y); w = Math.min(w, x); e = Math.max(e, x); });
  s -= 0.004; n += 0.004; w -= 0.004; e += 0.004;
  if ((n - s) * (e - w) > 3) return;
  const bb = `${s},${w},${n},${e}`, nm = '"name"~"ZTL|[Zz]ona a [Tt]raffico [Ll]imitato|^Area C$"';
  let data;
  try { data = await overpass(`[out:json][timeout:25];(node["highway"="speed_camera"](${bb});way["boundary"="low_emission_zone"](${bb});relation["boundary"="low_emission_zone"](${bb});way[${nm}][!"highway"](${bb});relation[${nm}](${bb}););out geom;`); }
  catch (err) { return; }
  if (rt !== route) return;
  const cams = [], polys = [];
  for (const el of data.elements || []) {
    if (el.type === 'node') {
      const p = [el.lon, el.lat], pr = project(p);
      if (pr.off < 30) cams.push({ p, d: pr.d, max: parseInt((el.tags || {}).maxspeed) || null });
    } else if (el.type === 'way' && el.geometry) {
      const ring = el.geometry.map(g => [g.lon, g.lat]);
      if (ring.length > 3 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) polys.push({ rings: [ring] });
    } else if (el.type === 'relation' && el.members) {
      const rings = stitch(el.members.filter(m => m.type === 'way' && m.role !== 'inner' && m.geometry).map(m => m.geometry.map(g => [g.lon, g.lat])));
      if (rings.length) polys.push({ rings });
    }
  }
  cams.sort((a, b) => a.d - b.d);
  rt.cams = cams; rt.ztl = polys;
  const inside = p => polys.some(z => z.rings.some(r => inRing(p, r)));
  let was = inside(rt.coords[0]);
  if (was) rt.ztlEntries.push(0);
  for (let i = 1; i < rt.coords.length; i++) { const now = inside(rt.coords[i]); if (now && !was) rt.ztlEntries.push(rt.cum[i]); was = now; }
  map.getSource('cams').setData({ type: 'FeatureCollection', features: cams.map(c => ({ type: 'Feature', geometry: { type: 'Point', coordinates: c.p }, properties: {} })) });
  map.getSource('ztl').setData({ type: 'FeatureCollection', features: polys.map(z => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: z.rings }, properties: {} })) });
  if (typeof onExtrasLoaded === 'function') onExtrasLoaded(rt);
  renderAlerts();
}

// ---------- Limiti di velocità ----------
let limit = 50, limitEstimated = true, offSince = 0, lastLimitCheck = 0;
const LIMITS = { motorway: 130, trunk: 90, primary: 50, secondary: 50, tertiary: 50, minor: 30, service: 30, track: 30 };
const ROAD_LAYERS = ['road-motorway', 'road-primary', 'road-secondary', 'road-minor'];
function estimateLimit(p) {
  const pt = map.project(p);
  const feats = map.queryRenderedFeatures([[pt.x - 6, pt.y - 6], [pt.x + 6, pt.y + 6]], { layers: ROAD_LAYERS });
  const rank = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service', 'track'];
  const best = feats.map(f => f.properties.class).sort((a, b) => rank.indexOf(a) - rank.indexOf(b))[0];
  return best && LIMITS[best] ? LIMITS[best] : null;
}
function updateLimit(p) {
  if (route.mode !== 'car') return;
  const real = route.maxspeed[nav.idx];
  if (real) { limit = real; limitEstimated = false; }
  else if (performance.now() - lastLimitCheck > 500) {
    lastLimitCheck = performance.now();
    const est = estimateLimit(p); if (est) limit = est; limitEstimated = true;
  }
}
function updateSpeed() {
  setText('limit', limit);
  $('limit').classList.toggle('est', limitEstimated);
  setText('curVal', Math.round(nav.kmh));
  const over = nav.mode && route && route.mode === 'car' && nav.kmh > limit + 2;
  $('cur').classList.toggle('over', !!over);
  $('overGlow').classList.toggle('on', !!over);
}

// ---------- Riquadro delle indicazioni ----------
let stepKey = null, swapping = false;
function fillStep(next, after) {
  const info = describe(next.step), arrow = $('arrow');
  arrow.innerHTML = info.svg;
  arrow.classList.remove('draw'); void arrow.offsetWidth; arrow.classList.add('draw');
  $('verb').textContent = info.street === info.verb ? '' : info.verb;
  $('instr').textContent = info.street;
  const lanes = ((next.step.intersections || [])[0] || {}).lanes || [];
  $('lanes').innerHTML = (route.mode === 'car' && lanes.length >= 2) ? lanes.map(l => {
    const ind = (l.indications || ['straight']).find(x => SHAPES[x]) || 'straight';
    return `<div class="lane ${l.valid ? 'on' : 'off'}">${shapeSVG(ind, { ghost: false, sw: 6 })}</div>`;
  }).join('') : '';
  if (after && after.startDist - next.startDist < 400 && after.step.maneuver.type !== 'arrive') {
    const a = describe(after.step);
    $('thenArrow').innerHTML = a.round ? roundaboutSVG(a.round) : shapeSVG(a.mod, { ghost: false, sw: 6 });
    $('thenText').textContent = a.short;
    $('then').classList.remove('hidden');
    $('then').animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'ease-out' });
  } else $('then').classList.add('hidden');
}
function swapStep(next, after, animate) {
  const main = $('gMain');
  if (!animate || swapping || !main.animate) { fillStep(next, after); return; }
  swapping = true;
  main.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-16px)' }], { duration: 170, easing: 'ease-in', fill: 'forwards' }).finished.then(() => {
    fillStep(next, after);
    main.animate([{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.9,.3,1.2)', fill: 'forwards' }).finished.then(() => { swapping = false; });
  });
}
function setDistance(m) {
  let num, unit;
  if (m < 15) { num = 'Ora'; unit = ''; }
  else if (m < 1000) { num = String(m < 100 ? Math.round(m / 5) * 5 : Math.round(m / 10) * 10); unit = 'm'; }
  else { num = (m / 1000).toFixed(m < 10000 ? 1 : 0).replace('.', ','); unit = 'km'; }
  setText('distNum', num); setText('distUnit', unit);
}
function updatePanels(d) {
  if (!route) return;
  const i = route.steps.findIndex(s => s.startDist > d + 1);
  const idx = i >= 0 ? i : route.steps.length - 1;
  const next = route.steps[idx], after = route.steps[idx + 1] || null;
  const key = route.seq + ':' + idx;
  if (key !== stepKey) { const first = !stepKey || !stepKey.startsWith(route.seq + ':'); stepKey = key; swapStep(next, after, !first); }
  const toMan = Math.max(0, next.startDist - d);
  setDistance(toMan);
  const prevStart = idx > 0 ? route.steps[idx - 1].startDist : 0;
  const win = Math.min(500, Math.max(50, next.startDist - prevStart));
  const w = (Math.max(0, Math.min(1, 1 - toMan / win)) * 100).toFixed(0) + '%', bar = $('gProg').firstElementChild;
  if (bar.style.width !== w) bar.style.width = w;
  $('guide').classList.toggle('now', !!nav.mode && toMan < (route.mode === 'car' ? 60 : 25) && next.step.maneuver.type !== 'depart');
  const remaining = Math.max(0, route.total - d), secs = route.duration * (remaining / route.total);
  setText('etaTime', fmtTime(new Date(Date.now() + secs * 1000)));
  setText('etaMin', Math.max(0, Math.round(secs / 60)));
  setText('etaKm', (remaining / 1000).toFixed(remaining < 10000 ? 1 : 0).replace('.', ','));
}
const SIG_LABEL = {
  signal: ['Semaforo', '<svg viewBox="0 0 16 24" width="13" height="20"><rect x="1" y="1" width="14" height="22" rx="5" fill="#14152e" stroke="#fff" stroke-width="1.5"/><circle cx="8" cy="6.5" r="2.4" fill="#ff3b47"/><circle cx="8" cy="12" r="2.4" fill="#ffc53d"/><circle cx="8" cy="17.5" r="2.4" fill="#3ddc84"/></svg>'],
  stop: ['Stop', '<span style="font-size:9px;font-weight:900">STOP</span>'],
  give_way: ['Dare precedenza', '<svg viewBox="0 0 24 22" width="22" height="20"><path d="M1 1h22L12 21Z" fill="#fff"/><path d="M5 3.5h14L12 16Z" fill="none" stroke="#e5222a" stroke-width="2.8" stroke-linejoin="round"/></svg>']
};
function renderAlerts() {
  const box = $('alerts'), want = [];
  if (rerouting) want.push({ id: 'rr', cls: 'info', ic: '↻', html: 'Ricalcolo del percorso…' });
  if (route && nav.mode) {
    const d = nav.d;
    if (route.mode === 'car') {
      const cam = route.cams.find(c => c.d > d - 15 && c.d - d < 700);
      if (cam) want.push({ id: 'cam', cls: 'cam', ic: '📷', html: `Autovelox tra ${fmtDist(Math.max(0, cam.d - d))}<small>Limite ${cam.max || limit} km/h</small>` });
      const sg = (route.sigs || []).find(x => x.d > d + 3 && x.d - d < 200);
      if (sg) want.push({ id: 'sig-' + sg.k, cls: 'sig ' + sg.k, ic: SIG_LABEL[sg.k][1], html: `${SIG_LABEL[sg.k][0]} tra ${fmtDist(sg.d - d)}` });
      const z = route.ztlEntries.find(e => e > d - 5 && e - d < 800);
      if (z !== undefined) want.push({ id: 'ztl', cls: 'ztl', ic: 'ZTL', html: `${z - d < 20 ? 'Stai entrando in una ZTL' : 'ZTL tra ' + fmtDist(z - d)}<small>Controlla di avere il permesso</small>` });
    }
  }
  const ids = want.map(a => a.id);
  [...box.children].forEach(el => { if (!ids.includes(el.dataset.id)) el.remove(); });
  want.forEach((a, i) => {
    let el = box.querySelector(`[data-id="${a.id}"]`);
    if (!el) { el = document.createElement('div'); el.dataset.id = a.id; el.className = 'alert ' + a.cls; el.innerHTML = `<div class="ic">${a.ic}</div><div class="tx"></div>`; }
    if (box.children[i] !== el) box.insertBefore(el, box.children[i] || null);
    const tx = el.querySelector('.tx'); if (tx.innerHTML !== a.html) tx.innerHTML = a.html;
  });
}
function placeAlerts() { const g = $('guide'); $('alerts').style.top = (g.offsetTop + g.offsetHeight + 10) + 'px'; }
if (window.ResizeObserver) new ResizeObserver(placeAlerts).observe($('guide')); else setInterval(placeAlerts, 500);

// ---------- Posizione durante la guida ----------
let camB = 0, lastPosT = 0, here = null;
let padCache = null, padH = 0;
function camPadding() {
  const h = window.innerHeight;
  if (h !== padH) { padH = h; padCache = { top: h * 0.45, bottom: 0, left: 0, right: 0 }; }
  return padCache;
}
function onPosition(p, b, kmh) {
  here = p; nav.kmh = kmh;
  const now = performance.now(), dt = lastPosT ? Math.min(0.2, (now - lastPosT) / 1000) : 0.016; lastPosT = now;
  const diff = ((b - camB + 540) % 360) - 180;
  camB = (camB + diff * (1 - Math.exp(-dt * 6)) + 360) % 360;
  puck.setLngLat(p).setRotation(camB);
  if (!route) return;
  const offMax = route.mode === 'car' ? 35 : 25;
  const pr = project(p, nav.idx - 3, nav.idx + 400);
  const pf = pr.off > offMax ? project(p) : pr;
  if (pf.off > offMax) {
    if (!offSince) offSince = now;
    if (now - offSince > 1500) reroute(p);
  } else { offSince = 0; nav.d = pf.d; nav.idx = pf.idx; }
  updateLimit(p); updateSpeed(); updatePanels(nav.d); renderAlerts();
  if (!drawing) setRouteWindow(nav.d / route.total, 1.0001);
  const v = NAV_VIEW[route.mode] || NAV_VIEW.car;
  if (!nav.overview) map.jumpTo({ center: p, bearing: camB, zoom: v.zoom, pitch: v.pitch, padding: camPadding() });
  if (route.total - nav.d < 15 && !rerouting && pf.off < offMax) arrive();
}
async function reroute(p) {
  if (rerouting || !dest) return;
  rerouting = true; renderAlerts();
  try {
    const r = await fetchRoutes(route.mode, p, dest, false);
    setRoute(r[0]);
    sim.detour = null; sim.travelled = 0;
  } catch (e) { toast('Ricalcolo non riuscito'); }
  rerouting = false; offSince = 0; renderAlerts();
}

// ---------- Simulazione ----------
const sim = { on: false, travelled: 0, last: 0, detour: null };
const SIM = { car: { play: 4 }, bike: { play: 4, kmh: 18 }, foot: { play: 6, kmh: 5 } };
function simFrame(t) {
  if (!sim.on || nav.mode !== 'sim' || !route) return;
  const dt = sim.last ? Math.min(0.1, (t - sim.last) / 1000) : 0; sim.last = t;
  const cfg = SIM[route.mode] || SIM.car;
  let target = cfg.kmh ? cfg.kmh * (0.9 + 0.2 * Math.sin(t / 3000)) : limit * (0.85 + 0.25 * (0.5 + 0.5 * Math.sin(t / 2500)));
  const ns = route.steps.find(s => s.startDist > nav.d + 1);
  if (route.mode === 'car' && ns && !/arrive|depart/.test(ns.step.maneuver.type) && (ns.step.maneuver.modifier || '') !== 'straight') {
    const toMan = ns.startDist - nav.d;
    if (toMan < 90) target = Math.min(target, 22 + toMan * 0.35);
  }
  const kmh = nav.kmh + (target - nav.kmh) * Math.min(1, dt * (target < nav.kmh ? 1.6 : 0.7));
  const step = (kmh / 3.6) * cfg.play * dt;
  let p, b;
  if (sim.detour) {
    const dd = sim.detour; dd.done = Math.min(dd.len, dd.done + step);
    const f = dd.done / dd.len; p = [dd.from[0] + (dd.to[0] - dd.from[0]) * f, dd.from[1] + (dd.to[1] - dd.from[1]) * f]; b = dd.b;
  } else {
    if (!rerouting) sim.travelled = Math.min(route.total, sim.travelled + step);
    p = pointAt(sim.travelled);
    b = sim.travelled < route.total ? bearing(p, pointAt(Math.min(route.total, sim.travelled + 40))) : camB;
  }
  onPosition(p, b, kmh);
  requestAnimationFrame(simFrame);
}
function wrongTurn() {
  if (!route || sim.detour) return;
  const p = pointAt(sim.travelled), b = bearing(p, pointAt(Math.min(route.total, sim.travelled + 40)));
  const nb = (b + (Math.random() < 0.5 ? 70 : -70) + 360) % 360, len = route.mode === 'car' ? 220 : 90;
  sim.detour = { from: p, to: destPoint(p, nb, len), len, done: 0, b: nb };
  toast('Hai sbagliato strada (simulato)');
}

// ---------- GPS reale (movimento fluido tra una lettura e l'altra) ----------
let watchId = null, lastFix = null, lastB = 0, gpsAnim = null, gpsRaf;
function gpsFrame() {
  if (nav.mode !== 'gps' || !gpsAnim) return;
  const g = gpsAnim, k = Math.min(1, (performance.now() - g.t0) / g.dur);
  onPosition([g.from[0] + (g.to[0] - g.from[0]) * k, g.from[1] + (g.to[1] - g.from[1]) * k], g.b, g.kmh);
  gpsRaf = requestAnimationFrame(gpsFrame);
}
function startGps() {
  if (!navigator.geolocation) { toast('Posizione non disponibile su questo dispositivo'); exitNav(); return; }
  watchId = navigator.geolocation.watchPosition(pos => {
    const p = [pos.coords.longitude, pos.coords.latitude];
    let kmh = pos.coords.speed != null && pos.coords.speed >= 0 ? pos.coords.speed * 3.6 : 0;
    let b = pos.coords.heading, interval = 1000;
    if (lastFix) {
      const dd = dist(lastFix.p, p), dt = (pos.timestamp - lastFix.t) / 1000;
      interval = Math.max(300, Math.min(1600, dt * 1000));
      if (pos.coords.speed == null && dt > 0) kmh = dd / dt * 3.6;
      if ((b == null || isNaN(b)) && dd > 3) b = bearing(lastFix.p, p);
    }
    if (b == null || isNaN(b) || kmh < 3) b = lastB; lastB = b;
    lastFix = { p, t: pos.timestamp };
    const first = !gpsAnim;
    gpsAnim = { from: first ? p : (here || p), to: p, t0: performance.now(), dur: first ? 1 : interval, b, kmh };
    if (first) { cancelAnimationFrame(gpsRaf); gpsRaf = requestAnimationFrame(gpsFrame); }
  }, err => { toast('Non riesco a leggere il GPS: ' + err.message); exitNav(); }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
}

// ---------- Avvio e fine della navigazione ----------
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
    else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) {}
}
function startNavigation(kind, toPlace) {
  if (!route) return;
  dest = toPlace.p; destName = toPlace.name || 'Destinazione';
  document.body.classList.add('nav'); document.body.classList.toggle('car', route.mode === 'car');
  meMarker.remove(); placePin.remove(); startPin.remove();
  map.getSource('route-alt').setData(emptyFC); map.getSource('results').setData(emptyFC);
  destPin.setLngLat(dest).addTo(map);
  puck.setLngLat(route.coords[0]).setRotation(camB).addTo(map);
  nav.mode = kind; nav.startTime = Date.now(); nav.overview = false; nav.kmh = 0; nav.d = 0; nav.idx = 0; stepKey = null;
  sim.travelled = 0; sim.detour = null; lastPosT = 0; offSince = 0;
  $('btnOverview').classList.remove('on');
  if (kind === 'sim') { sim.on = true; sim.last = 0; }
  updatePanels(0); updateSpeed(); renderControls(); keepAwake(true);
  drawRouteAnimated();
  if (kind === 'sim') { requestAnimationFrame(simFrame); onPosition(route.coords[0], camB, 0); }
  else { onPosition(me.p || route.coords[0], camB, 0); startGps(); }
}
function stopMotion() {
  sim.on = false; sim.detour = null;
  if (watchId != null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
  lastFix = null; cancelAnimationFrame(gpsRaf); gpsAnim = null;
}
function exitNav() {
  stopMotion();
  nav.mode = null; nav.kmh = 0; nav.overview = false;
  document.body.classList.remove('nav', 'car');
  $('overGlow').classList.remove('on'); $('guide').classList.remove('now');
  puck.remove(); keepAwake(false);
  if (me.p) meMarker.setLngLat(me.p).addTo(map);
  $('alerts').innerHTML = '';
  if (typeof onNavExit === 'function') onNavExit();
}
function arrive() {
  const mins = nav.mode === 'sim' ? Math.round(route.duration / 60) : Math.round((Date.now() - nav.startTime) / 60000);
  $('arrName').textContent = destName || 'Destinazione';
  $('arrTime').textContent = fmtTime(new Date());
  $('arrMin').textContent = mins;
  $('arrKm').textContent = (route.total / 1000).toFixed(1).replace('.', ',');
  stopMotion(); nav.mode = 'arrived'; nav.kmh = 0; updateSpeed(); renderControls();
  $('arrive').classList.remove('hidden');
}
function renderControls() {
  const c = $('controls'); c.innerHTML = '';
  const add = (label, fn, cls) => { const b = document.createElement('button'); b.textContent = label; b.onclick = fn; if (cls) b.className = cls; c.appendChild(b); };
  if (nav.mode === 'sim') {
    add(sim.on ? '❚❚ Pausa' : '▶ Riprendi', () => { sim.on = !sim.on; if (sim.on) { sim.last = 0; requestAnimationFrame(simFrame); } else { nav.kmh = 0; updateSpeed(); } renderControls(); });
    if (sim.on) add('↪ Sbaglia strada', wrongTurn);
    add('Termina', exitNav, 'stop');
  } else if (nav.mode === 'gps') add('Termina', exitNav, 'stop');
}
function overviewRoute() {
  if (!route) return;
  if (nav.overview) { nav.overview = false; $('btnOverview').classList.remove('on'); return; }
  nav.overview = true; $('btnOverview').classList.add('on');
  const b = bboxOf(route.coords); if (here) b.extend(here);
  const W = window.innerWidth, H = window.innerHeight;
  map.fitBounds(b, { padding: { top: Math.min(H * 0.32, 220), bottom: Math.min(H * 0.2, 110), left: Math.min(W * 0.12, 60), right: Math.min(W * 0.12, 80) }, pitch: 0, bearing: 0, duration: 900, maxZoom: 16 });
}
async function shareTrip(arrived) {
  const name = destName || 'destinazione', pos = here || me.p;
  const link = pos ? `https://maps.apple.com/?ll=${pos[1].toFixed(5)},${pos[0].toFixed(5)}&q=${encodeURIComponent('La mia posizione')}` : '';
  const text = arrived ? `Sono arrivato a ${name} ✅` : `Sto arrivando a ${name} 🚗 Arrivo previsto alle ${$('etaTime').textContent} (tra ${$('etaMin').textContent} min).` + (link ? `\nLa mia posizione: ${link}` : '');
  if (navigator.share) { try { await navigator.share({ title: 'Yeezik Maps', text }); } catch (e) {} return; }
  try { await navigator.clipboard.writeText(text); toast('Messaggio copiato: incollalo dove vuoi'); } catch (e) { toast(text); }
}
