// ================= Mappa, stile, icone, livelli =================
'use strict';

// ---------- Palette giorno / notte ----------
const PALETTES = {
  notte: { bg: '#1f2278', res: '#22267f', com: '#262a88', park: '#1f4a45', water: '#12165a', minor: '#5a5ed0', path: '#4a4fc0', sec: '#6d6cc9', prim: '#7c79bf', mot: '#8a86c8', rail: '#3a3fa8', bld: '#4a53e3', label: '#d6d4ff', halo: '#1f2278', poi: '#ffffff', poiHalo: '#1a1c66', place: '#a9a6ff' },
  giorno: { bg: '#e8e5f7', res: '#e3dff5', com: '#dcd6f2', park: '#bfe5cf', water: '#a3c8f7', minor: '#ffffff', path: '#d3cdef', sec: '#ffffff', prim: '#ffd9f0', mot: '#ffbde5', rail: '#bab3dc', bld: '#d4cff6', label: '#3b3570', halo: '#ffffff', poi: '#2a2560', poiHalo: '#ffffff', place: '#5a4fa0' }
};
const MODE_ICONS = {
  auto: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16Z" fill="#fff"/></svg>',
  notte: '<svg viewBox="0 0 24 24" fill="#fff"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/></svg>',
  giorno: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg>'
};
const MODE_NAMES = { auto: 'Automatica', notte: 'Notte', giorno: 'Giorno' };
const MODES = ['auto', 'notte', 'giorno'];
let modePref = store.get('yz-mode', 'auto'), activePalette = null;
if (!MODES.includes(modePref)) modePref = 'auto';

// ---------- Mappa ----------
const DEFAULT_CENTER = [9.1900, 45.4642]; // Milano
const lastView = store.get('yz-view', null);
let viewPref = store.get('yz-3d', '3d');
const BROWSE_PITCH = () => viewPref === '3d' ? 45 : 0;

const map = new maplibregl.Map({
  container: 'map', style: 'style.json',
  center: lastView ? lastView.c : DEFAULT_CENTER, zoom: lastView ? lastView.z : 14,
  pitch: BROWSE_PITCH(), bearing: 0, maxPitch: 60, dragRotate: true, touchPitch: true,
  attributionControl: { compact: true, customAttribution: '© OpenFreeMap · © OpenMapTiles · © OpenStreetMap · Photon · FOSSGIS OSRM · <a href="https://transitous.org/sources/" target="_blank">Transitous</a>' }
});
map.on('moveend', () => { if (!document.body.classList.contains('nav')) { const c = map.getCenter(); store.set('yz-view', { c: [c.lng, c.lat], z: map.getZoom() }); } });

function autoMode() {
  const c = map.getCenter(), now = new Date(), s = sunTimes(now, c.lat, c.lng);
  if (isNaN(s.rise) || isNaN(s.set)) return 'notte';
  return (now >= s.rise && now <= s.set) ? 'giorno' : 'notte';
}
function applyMode() {
  const name = modePref === 'auto' ? autoMode() : modePref;
  $('btnMode').innerHTML = MODE_ICONS[modePref]; $('btnModeNav').innerHTML = MODE_ICONS[modePref];
  if (name === activePalette || !map.isStyleLoaded()) return;
  activePalette = name;
  document.body.dataset.theme = name;
  const P = PALETTES[name], set = (l, p, v) => { if (map.getLayer(l)) map.setPaintProperty(l, p, v); };
  set('background', 'background-color', P.bg);
  set('landuse-residential', 'fill-color', P.res); set('landuse-commercial', 'fill-color', P.com);
  set('park', 'fill-color', P.park); set('landcover-green', 'fill-color', P.park);
  set('water', 'fill-color', P.water); set('waterway', 'line-color', P.water);
  set('road-minor', 'line-color', P.minor); set('road-path', 'line-color', P.path);
  set('road-secondary', 'line-color', P.sec); set('road-primary', 'line-color', P.prim);
  set('road-motorway', 'line-color', P.mot); set('rail', 'line-color', P.rail);
  set('building-3d', 'fill-extrusion-color', P.bld);
  set('road-label', 'text-color', P.label); set('road-label', 'text-halo-color', P.halo);
  set('poi', 'text-color', P.poi); set('poi', 'text-halo-color', P.poiHalo);
  set('place-label', 'text-color', P.place); set('place-label', 'text-halo-color', P.halo);
  set('results', 'text-color', P.poi); set('results', 'text-halo-color', P.poiHalo);
  try { map.setLight({ anchor: 'viewport', color: '#ffffff', intensity: name === 'giorno' ? 0.28 : 0.5, position: [1.15, 210, 30] }); } catch (e) {}
  set('building-3d', 'fill-extrusion-vertical-gradient', name !== 'giorno');
}
function setMode(m) { modePref = m; store.set('yz-mode', m); activePalette = null; applyMode(); }
function cycleMode() {
  setMode(MODES[(MODES.indexOf(modePref) + 1) % MODES.length]);
  toast('Aspetto: ' + MODE_NAMES[modePref] + (modePref === 'auto' ? ` (ora ${autoMode()})` : ''));
}
function setView3D(v) {
  viewPref = v; store.set('yz-3d', v);
  $('btn3D').textContent = v === '3d' ? '3D' : '2D';
  if (!document.body.classList.contains('nav')) map.easeTo({ pitch: BROWSE_PITCH(), duration: 600 });
}

// ---------- Icone sulla mappa ----------
function makeIcon(draw, bg = '#fff') {
  const s = 64, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.beginPath(); g.roundRect(4, 4, s - 8, s - 8, 14); g.fill();
  g.strokeStyle = g.fillStyle = '#1c1e5e'; g.lineWidth = 4; g.lineCap = 'round'; g.lineJoin = 'round';
  draw(g);
  return g.getImageData(0, 0, s, s);
}
const ICONS = {
  'yz-food': g => { g.beginPath(); g.arc(32, 30, 14, 0, Math.PI); g.closePath(); g.fill(); g.fillRect(20, 44, 24, 4); g.beginPath(); g.moveTo(26, 24); g.lineTo(30, 16); g.moveTo(34, 24); g.lineTo(40, 14); g.stroke(); },
  'yz-bed': g => { g.beginPath(); g.moveTo(16, 18); g.lineTo(16, 46); g.moveTo(16, 38); g.lineTo(48, 38); g.lineTo(48, 46); g.stroke(); g.fillRect(28, 28, 20, 10); g.beginPath(); g.arc(22, 31, 4, 0, 7); g.fill(); },
  'yz-shop': g => { g.beginPath(); g.arc(32, 20, 4, Math.PI, 0); g.lineTo(32, 26); g.lineTo(48, 42); g.lineTo(16, 42); g.lineTo(32, 26); g.stroke(); },
  'yz-health': g => { g.beginPath(); g.moveTo(32, 46); g.bezierCurveTo(10, 32, 16, 14, 32, 24); g.bezierCurveTo(48, 14, 54, 32, 32, 46); g.fill(); },
  'yz-car': g => { g.fillRect(18, 30, 28, 10); g.beginPath(); g.moveTo(22, 30); g.lineTo(26, 22); g.lineTo(38, 22); g.lineTo(42, 30); g.fill(); g.beginPath(); g.arc(24, 42, 4, 0, 7); g.arc(40, 42, 4, 0, 7); g.fill(); },
  'yz-pin': g => { g.beginPath(); g.arc(32, 28, 9, 0, 7); g.fill(); g.beginPath(); g.moveTo(26, 34); g.lineTo(32, 46); g.lineTo(38, 34); g.fill(); },
  'yz-cam': g => { g.fillStyle = '#e5222a'; g.beginPath(); g.roundRect(14, 22, 30, 20, 4); g.fill(); g.beginPath(); g.moveTo(44, 28); g.lineTo(52, 24); g.lineTo(52, 40); g.lineTo(44, 36); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(26, 32, 5, 0, 7); g.fill(); }
};
function drawSpecialIcon(id) {
  const c = document.createElement('canvas'), g = c.getContext('2d');
  if (id === 'yz-result') {
    c.width = 48; c.height = 60;
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(24, 22, 19, Math.PI * 0.8, Math.PI * 2.2); g.lineTo(24, 57); g.closePath(); g.fill();
    const gr = g.createLinearGradient(0, 0, 48, 48); gr.addColorStop(0, '#ff8ee0'); gr.addColorStop(1, '#9b5cff');
    g.fillStyle = gr; g.beginPath(); g.arc(24, 22, 15.5, Math.PI * 0.8, Math.PI * 2.2); g.lineTo(24, 51); g.closePath(); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(24, 22, 6, 0, 7); g.fill();
  } else if (id === 'yz-giveway') {
    c.width = c.height = 48; g.lineJoin = 'round';
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(3, 6); g.lineTo(45, 6); g.lineTo(24, 44); g.closePath(); g.fill();
    g.strokeStyle = '#e5222a'; g.lineWidth = 6; g.beginPath(); g.moveTo(9, 10); g.lineTo(39, 10); g.lineTo(24, 37); g.closePath(); g.stroke();
  } else if (id === 'yz-crossing') {
    c.width = c.height = 48;
    g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect(3, 3, 42, 42, 9); g.fill();
    g.fillStyle = '#1f6fe5'; g.beginPath(); g.roundRect(6, 6, 36, 36, 7); g.fill();
    g.fillStyle = '#ffffff'; for (let i = 0; i < 4; i++) g.fillRect(10 + i * 8, 26, 5, 12);
    g.beginPath(); g.arc(24, 13, 3.5, 0, 7); g.fill(); g.fillRect(22, 16.5, 4, 8);
  } else if (id === 'yz-signal') {
    c.width = 48; c.height = 72;
    g.fillStyle = '#14152e'; g.strokeStyle = '#ffffff'; g.lineWidth = 3;
    g.beginPath(); g.roundRect(8, 3, 32, 66, 12); g.fill(); g.stroke();
    [['#ff3b47', 18], ['#ffc53d', 36], ['#3ddc84', 54]].forEach(([col, y]) => { g.fillStyle = col; g.beginPath(); g.arc(24, y, 7, 0, 7); g.fill(); });
  } else if (id === 'yz-stop') {
    c.width = c.height = 48; g.translate(24, 24); g.rotate(Math.PI / 8);
    const oct = r => { g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.lineTo(r * Math.cos(a), r * Math.sin(a)); } g.closePath(); };
    g.fillStyle = '#ffffff'; oct(22); g.fill(); g.fillStyle = '#e5222a'; oct(19); g.fill();
    g.rotate(-Math.PI / 8); g.fillStyle = '#fff'; g.font = 'bold 12px -apple-system, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('STOP', 0, 1);
  } else return null;
  return g.getImageData(0, 0, c.width, c.height);
}
map.on('styleimagemissing', e => {
  if (map.hasImage(e.id)) return;
  const special = drawSpecialIcon(e.id);
  map.addImage(e.id, special || makeIcon(ICONS[e.id] || ICONS['yz-pin']), { pixelRatio: 2 });
});

// ---------- Marker ----------
const PIN_SVG = '<svg viewBox="0 0 34 44" class="pin"><defs><linearGradient id="pg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff8ee0"/><stop offset="1" stop-color="#9b5cff"/></linearGradient></defs><path d="M17 43C17 43 3 27.5 3 17a14 14 0 0 1 28 0c0 10.5-14 26-14 26Z" fill="url(#pg)" stroke="#fff" stroke-width="2.5"/><circle cx="17" cy="17" r="5.5" fill="#fff"/></svg>';
function makePin() { const el = document.createElement('div'); el.innerHTML = PIN_SVG; return new maplibregl.Marker({ element: el, anchor: 'bottom' }); }
const placePin = makePin(), destPin = makePin();
const startEl = document.createElement('div');
startEl.style.cssText = 'width:16px;height:16px;border-radius:50%;background:#fff;border:4px solid #3d8bff;box-shadow:0 2px 8px rgba(0,0,0,.4)';
const startPin = new maplibregl.Marker({ element: startEl });
const meEl = document.createElement('div'); meEl.className = 'me-dot';
const meMarker = new maplibregl.Marker({ element: meEl });

// Indicatore di posizione in navigazione
const PUCKS = {
  disco: { name: 'Dischetto', svg: '<svg viewBox="0 0 34 34"><circle cx="17" cy="17" r="15" fill="rgba(205,203,235,.92)" stroke="#fff" stroke-width="1.5"/><path d="M17 9 23 22 17 19 11 22Z" fill="#fff" stroke="rgba(40,40,90,.6)" stroke-width=".8"/></svg>' },
  neon: { name: 'Freccia neon', svg: '<svg viewBox="0 0 34 34"><defs><filter id="glw" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2"/></filter></defs><path d="M17 2 29 31 17 24 5 31Z" fill="#ff8ee0" filter="url(#glw)" opacity=".9"/><path d="M17 3 28 29 17 23 6 29Z" fill="#ff8ee0" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>' },
  auto: { name: 'Auto', svg: '<svg viewBox="0 0 34 34"><rect x="9" y="3" width="16" height="28" rx="7" fill="#ff8ee0" stroke="#fff" stroke-width="1.5"/><path d="M11.5 10.5q5.5-3 11 0l-1.2 4.5h-8.6Z" fill="#2a1e5a"/><path d="M12.3 25.5h9.4l.8 2.5q-5.5 2-11 0Z" fill="#2a1e5a"/><rect x="10.5" y="16" width="1.6" height="7" rx=".8" fill="#2a1e5a"/><rect x="21.9" y="16" width="1.6" height="7" rx=".8" fill="#2a1e5a"/></svg>' },
  logo: { name: 'Logo Y', svg: '<svg viewBox="0 0 34 34"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff8ee0"/><stop offset="1" stop-color="#7a4dff"/></linearGradient></defs><path d="M17 0 21 5H13Z" fill="#fff"/><circle cx="17" cy="18" r="14" fill="url(#lg)" stroke="#fff" stroke-width="2"/><path d="M11.5 11.5 17 18.5l5.5-7M17 18.5V25" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>' }
};
let puckPref = store.get('yz-puck', 'disco');
const puckEl = document.createElement('div'); puckEl.className = 'puck';
function setPuck(k) { puckPref = PUCKS[k] ? k : 'disco'; puckEl.innerHTML = PUCKS[puckPref].svg; store.set('yz-puck', puckPref); }
setPuck(puckPref);
const puck = new maplibregl.Marker({ element: puckEl, rotationAlignment: 'map', pitchAlignment: 'map' });

// ---------- La mia posizione ----------
const me = { p: null, acc: null, t: 0, denied: false };
let meWatch = null;
function startLocating() {
  if (!navigator.geolocation || meWatch != null) return;
  meWatch = navigator.geolocation.watchPosition(pos => {
    const first = !me.p;
    me.p = [pos.coords.longitude, pos.coords.latitude]; me.acc = pos.coords.accuracy; me.t = Date.now(); me.denied = false;
    if (!document.body.classList.contains('nav')) meMarker.setLngLat(me.p).addTo(map);
    if (first) { onFirstFix(); }
  }, err => { if (err.code === 1) me.denied = true; }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
}
let onFirstFix = () => {};
function locateMe() {
  startLocating();
  if (me.p) map.flyTo({ center: me.p, zoom: Math.max(map.getZoom(), 15.5), speed: 1.6, padding: mapPadding() });
  else if (me.denied) toast('Posizione non autorizzata: attivala nelle impostazioni di Safari');
  else { toast('Cerco la tua posizione…'); onFirstFix = () => { map.flyTo({ center: me.p, zoom: 15.5, padding: mapPadding() }); onFirstFix = () => {}; }; }
}

// Spazio occupato dal pannello, per centrare bene la mappa
function mapPadding(extra = 40) {
  const W = window.innerWidth, H = window.innerHeight;
  if (isDesktop()) return { top: extra, bottom: extra, left: 420 + extra, right: 70 };
  const sheet = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sheet')) || 190;
  return { top: extra + 40, bottom: Math.min(H * 0.6, sheet) + 20, left: Math.min(extra, W * 0.1), right: 60 };
}
function fitCoords(coords, opts = {}) {
  if (!coords.length) return;
  map.fitBounds(bboxOf(coords), { padding: mapPadding(), pitch: 0, bearing: 0, duration: 800, maxZoom: 16.5, ...opts });
}

// ---------- Livelli (aggiunti quando lo stile è pronto) ----------
function addLayers() {
  const S = (id, opt = {}) => map.addSource(id, { type: 'geojson', data: emptyFC, ...opt });
  ['route', 'route-alt', 'cams', 'ztl', 'transit', 'transit-stops', 'signals', 'results'].forEach(id => S(id, id === 'route' ? { lineMetrics: true } : {}));
  const before = 'building-3d', W = (a, b) => ['interpolate', ['exponential', 1.5], ['zoom'], 10, a, 18, b];
  map.addLayer({ id: 'ztl-fill', type: 'fill', source: 'ztl', paint: { 'fill-color': '#ff2a4a', 'fill-opacity': 0.1 } }, 'road-minor');
  map.addLayer({ id: 'ztl-line', type: 'line', source: 'ztl', paint: { 'line-color': '#ff4a6a', 'line-width': 2.5, 'line-dasharray': [3, 2], 'line-opacity': 0.85 } }, before);
  map.addLayer({ id: 'route-alt', type: 'line', source: 'route-alt', layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#c7a3ea', 'line-opacity': 0.75, 'line-width': W(3.5, 20) } }, before);
  map.addLayer({ id: 'route-line', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#ff8ee0', 'line-width': W(4.5, 26) } }, before);
  map.addLayer({ id: 'route-core', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#ffc6f0', 'line-width': W(2.7, 15.6) } }, before);
  map.addLayer({ id: 'tr-walk', type: 'line', source: 'transit', filter: ['==', ['get', 'walk'], true], layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#ffffff', 'line-width': W(3, 7), 'line-dasharray': [0.1, 2] } }, before);
  map.addLayer({ id: 'tr-case', type: 'line', source: 'transit', filter: ['!=', ['get', 'walk'], true], layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#ffffff', 'line-width': W(6, 16) } }, before);
  map.addLayer({ id: 'tr-line', type: 'line', source: 'transit', filter: ['!=', ['get', 'walk'], true], layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': W(4, 11) } }, before);
  map.addLayer({ id: 'tr-stops', type: 'circle', source: 'transit-stops',
    paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3.5, 17, 7], 'circle-color': '#ffffff', 'circle-stroke-color': ['get', 'color'], 'circle-stroke-width': 3 } });
  map.addLayer({ id: 'signals', type: 'symbol', source: 'signals', minzoom: 15, filter: ['!=', ['get', 'k'], 'crossing'],
    layout: { 'icon-image': ['match', ['get', 'k'], 'stop', 'yz-stop', 'give_way', 'yz-giveway', 'yz-signal'], 'icon-size': ['interpolate', ['linear'], ['zoom'], 15, 0.55, 18, 0.9], 'icon-anchor': 'bottom', 'icon-allow-overlap': true, 'icon-pitch-alignment': 'viewport' } });
  map.addLayer({ id: 'crossings', type: 'symbol', source: 'signals', minzoom: 16.3, filter: ['==', ['get', 'k'], 'crossing'],
    layout: { 'icon-image': 'yz-crossing', 'icon-size': ['interpolate', ['linear'], ['zoom'], 16.3, 0.4, 18, 0.65], 'icon-anchor': 'bottom', 'icon-padding': 4, 'icon-pitch-alignment': 'viewport' } }, 'signals');
  map.addLayer({ id: 'cams', type: 'symbol', source: 'cams', layout: { 'icon-image': 'yz-cam', 'icon-size': 0.55, 'icon-anchor': 'bottom', 'icon-allow-overlap': true } });
  map.addLayer({ id: 'results', type: 'symbol', source: 'results',
    layout: { 'icon-image': 'yz-result', 'icon-size': 0.62, 'icon-anchor': 'bottom', 'icon-allow-overlap': true,
      'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': 12.5, 'text-anchor': 'top', 'text-offset': [0, 0.15], 'text-max-width': 9, 'text-optional': true },
    paint: { 'text-color': '#fff', 'text-halo-color': '#1a1c66', 'text-halo-width': 1.6 } });
}

// ---------- Semafori, stop, precedenze, strisce (da OpenStreetMap) ----------
const sigTiles = new Map(), sigFeatures = new Map(); let sigBusy = false;
function tileOf(lng, lat, z) {
  const n = 2 ** z, x = Math.floor((lng + 180) / 360 * n);
  const y = Math.floor((1 - Math.log(Math.tan(rad(lat)) + 1 / Math.cos(rad(lat))) / Math.PI) / 2 * n);
  return [x, y];
}
function tileBounds(x, y, z) {
  const n = 2 ** z, lng = v => v / n * 360 - 180, lat = v => deg(Math.atan(Math.sinh(Math.PI * (1 - 2 * v / n))));
  return { w: lng(x), e: lng(x + 1), n: lat(y), s: lat(y + 1) };
}
async function loadSignals() {
  if (sigBusy || map.getZoom() < 14.8) return;
  const Z = 15, c = map.getCenter(), [cx, cy] = tileOf(c.lng, c.lat, Z), want = [];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) want.push([cx + dx, cy + dy]);
  if (typeof route !== 'undefined' && route && document.body.classList.contains('nav')) {
    const ahead = pointAt(Math.min(route.total, nav.d + 500)), [ax, ay] = tileOf(ahead[0], ahead[1], Z);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) want.push([ax + dx, ay + dy]);
  }
  const missing = [...new Set(want.map(t => t.join('/')))].filter(k => !sigTiles.has(k)).slice(0, 12);
  if (!missing.length) return;
  sigBusy = true; missing.forEach(k => sigTiles.set(k, 'loading'));
  const parts = missing.map(k => { const [x, y] = k.split('/').map(Number), b = tileBounds(x, y, Z), bb = `${b.s},${b.w},${b.n},${b.e}`; return `node["highway"~"^(traffic_signals|stop|give_way)$"](${bb});node["highway"="crossing"](${bb});`; }).join('');
  try {
    const r = await overpass(`[out:json][timeout:20];(${parts});out;`);
    (r.elements || []).forEach(el => sigFeatures.set(el.id, { type: 'Feature', geometry: { type: 'Point', coordinates: [el.lon, el.lat] }, properties: { k: el.tags.highway === 'traffic_signals' ? 'signal' : el.tags.highway } }));
    missing.forEach(k => sigTiles.set(k, 'ok'));
    map.getSource('signals').setData({ type: 'FeatureCollection', features: [...sigFeatures.values()] });
    if (typeof matchSignals === 'function') matchSignals();
  } catch (e) { missing.forEach(k => sigTiles.delete(k)); }
  sigBusy = false;
}
