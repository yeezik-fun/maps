// ================= Avvio =================
'use strict';

$('btnMode').onclick = cycleMode;
$('btnModeNav').onclick = cycleMode;
$('btn3D').textContent = viewPref === '3d' ? '3D' : '2D';
$('btn3D').onclick = () => setView3D(viewPref === '3d' ? '2d' : '3d');
$('btnLocate').onclick = locateMe;
$('btnCompass').onclick = () => map.easeTo({ bearing: 0, pitch: BROWSE_PITCH(), duration: 500 });
map.on('rotate', () => {
  const b = map.getBearing();
  $('btnCompass').classList.toggle('hidden', Math.abs(b) < 1);
  $('btnCompass').firstElementChild.style.transform = `rotate(${-b}deg)`;
});

// Tocchi sulla mappa: risultati, percorsi alternativi, punti d'interesse, tieni premuto per un segnaposto
const CLICK_LAYERS = ['results', 'route-alt', 'poi'];
map.on('click', e => {
  if (document.body.classList.contains('nav')) return;
  const layers = CLICK_LAYERS.filter(l => map.getLayer(l));
  const f = map.queryRenderedFeatures([[e.point.x - 8, e.point.y - 8], [e.point.x + 8, e.point.y + 8]], { layers })[0];
  if (f) {
    if (f.layer.id === 'results') { const pl = S.results[f.properties.i]; if (pl) openPlace(pl); return; }
    if (f.layer.id === 'route-alt' && S.view === 'dir') { selectRoute(f.properties.i, false); return; }
    if (f.layer.id === 'poi' && f.properties.name) {
      const [e2, label] = kindOf(f.properties.subclass, f.properties.class);
      openPlace({ p: f.geometry.coordinates, name: f.properties.name, sub: label !== 'Luogo' ? label : '', kind: e2, fromPoi: true }, { fly: false });
      return;
    }
  }
  if (S.view === 'place') back();
});
['results', 'route-alt', 'poi'].forEach(l => {
  map.on('mouseenter', l, () => map.getCanvas().style.cursor = 'pointer');
  map.on('mouseleave', l, () => map.getCanvas().style.cursor = '');
});
map.on('contextmenu', e => { if (!document.body.classList.contains('nav')) dropPin(e.lngLat); });
let pressT = null;
map.on('touchstart', e => {
  clearTimeout(pressT);
  if (e.originalEvent.touches.length !== 1 || document.body.classList.contains('nav')) return;
  const ll = e.lngLat;
  pressT = setTimeout(() => { if (navigator.vibrate) navigator.vibrate(15); dropPin(ll); }, 550);
});
['touchend', 'touchcancel', 'touchmove', 'movestart', 'zoomstart'].forEach(ev => map.on(ev, () => clearTimeout(pressT)));

map.on('load', () => {
  addLayers();
  applyMode();
  setInterval(() => { if (modePref === 'auto') applyMode(); }, 60000);
  setInterval(() => { if (map.getSource('signals')) loadSignals(); }, 1500);
  // Link condiviso: ?p=lat,lon&n=nome
  const q = new URLSearchParams(location.search), pp = q.get('p');
  if (pp) {
    const [lat, lon] = pp.split(',').map(Number);
    if (isFinite(lat) && isFinite(lon)) { map.jumpTo({ center: [lon, lat], zoom: 16 }); openPlace({ p: [lon, lat], name: q.get('n') || 'Luogo condiviso', sub: '' }); }
  }
});

// Prima posizione: centra la mappa su di te se non c'era una vista salvata
onFirstFix = () => {
  if (!lastView && !new URLSearchParams(location.search).get('p')) map.flyTo({ center: me.p, zoom: 15.5, padding: mapPadding() });
  if (S.view === 'home') renderHome();
  onFirstFix = () => {};
};
startLocating();

renderHome();
setSheet('peek');
window.addEventListener('resize', () => setSheet(sheetState));

// App installabile (funziona anche offline per l'interfaccia)
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
