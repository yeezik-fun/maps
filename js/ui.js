// ================= Interfaccia: pannello, ricerca, luoghi, indicazioni =================
'use strict';

const S = {
  view: 'home', stack: [], place: null, from: null, to: null,
  mode: store.get('yz-tmode', 'car'), routes: [], sel: 0, itins: [], itin: null,
  tt: { type: 'now', value: '' }, pick: null, results: [], cat: null, dirToken: 0
};
let favs = store.get('yz-favs', []), recents = store.get('yz-recents', []);

// ---------- Tipi di luogo ----------
const KIND = {
  restaurant: ['🍽️', 'Ristorante'], fast_food: ['🍔', 'Fast food'], cafe: ['☕', 'Bar'], bar: ['🍸', 'Bar'], pub: ['🍺', 'Pub'], nightclub: ['🎧', 'Discoteca'],
  ice_cream: ['🍦', 'Gelateria'], fuel: ['⛽', 'Distributore'], charging_station: ['🔌', 'Ricarica auto'], parking: ['🅿️', 'Parcheggio'], pharmacy: ['💊', 'Farmacia'],
  hospital: ['🏥', 'Ospedale'], clinic: ['🏥', 'Clinica'], doctors: ['🩺', 'Medico'], dentist: ['🦷', 'Dentista'], bank: ['🏦', 'Banca'], atm: ['🏧', 'Bancomat'],
  supermarket: ['🛒', 'Supermercato'], convenience: ['🛒', 'Minimarket'], bakery: ['🥐', 'Panetteria'], clothes: ['👕', 'Abbigliamento'], shoes: ['👟', 'Scarpe'],
  hairdresser: ['💇', 'Parrucchiere'], hotel: ['🏨', 'Hotel'], guest_house: ['🏨', 'B&B'], hostel: ['🏨', 'Ostello'], apartment: ['🏨', 'Appartamento'],
  station: ['🚆', 'Stazione'], halt: ['🚆', 'Stazione'], subway_entrance: ['🚇', 'Metro'], bus_stop: ['🚏', 'Fermata bus'], tram_stop: ['🚋', 'Fermata tram'], aerodrome: ['✈️', 'Aeroporto'],
  school: ['🏫', 'Scuola'], university: ['🎓', 'Università'], museum: ['🏛️', 'Museo'], attraction: ['📸', 'Attrazione'], viewpoint: ['🌄', 'Panorama'], park: ['🌳', 'Parco'], garden: ['🌳', 'Giardino'],
  cinema: ['🎬', 'Cinema'], theatre: ['🎭', 'Teatro'], place_of_worship: ['⛪', 'Luogo di culto'], police: ['👮', 'Polizia'], post_office: ['📮', 'Poste'],
  fitness_centre: ['🏋️', 'Palestra'], sports_centre: ['🏟️', 'Centro sportivo'], stadium: ['🏟️', 'Stadio'], marketplace: ['🧺', 'Mercato'], mall: ['🛍️', 'Centro commerciale'],
  city: ['🏙️', 'Città'], town: ['🏘️', 'Paese'], village: ['🏘️', 'Paese'], suburb: ['🏘️', 'Quartiere'], quarter: ['🏘️', 'Quartiere'], neighbourhood: ['🏘️', 'Quartiere'],
  house: ['🏠', 'Indirizzo'], street: ['🛣️', 'Via'], road: ['🛣️', 'Via'], residential: ['🛣️', 'Via'], primary: ['🛣️', 'Via'], secondary: ['🛣️', 'Via'], tertiary: ['🛣️', 'Via'], pedestrian: ['🚶', 'Zona pedonale']
};
function kindOf(...vals) { for (const v of vals) if (v && KIND[v]) return KIND[v]; return ['📍', 'Luogo']; }
function kindFromTags(t = {}) { return kindOf(t.amenity, t.shop, t.tourism, t.railway, t.public_transport === 'station' ? 'station' : null, t.leisure, t.aeroway, t.highway, t.place, t.building === 'house' ? 'house' : null); }
function addrFromTags(t = {}) {
  const st = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' ');
  return [st, t['addr:city'] || t['addr:place']].filter(Boolean).join(', ');
}

// ---------- Categorie ----------
const CATS = [
  { id: 'food', e: '🍽️', name: 'Ristoranti', q: 'nwr["amenity"="restaurant"]' },
  { id: 'cafe', e: '☕', name: 'Bar e caffè', q: 'nwr["amenity"~"^(cafe|bar)$"]' },
  { id: 'night', e: '🎧', name: 'Locali', q: 'nwr["amenity"~"^(nightclub|pub)$"]' },
  { id: 'fuel', e: '⛽', name: 'Benzina', q: 'nwr["amenity"="fuel"]' },
  { id: 'ev', e: '🔌', name: 'Ricarica', q: 'nwr["amenity"="charging_station"]' },
  { id: 'parking', e: '🅿️', name: 'Parcheggi', q: 'nwr["amenity"="parking"]["access"!~"^(private|no|customers)$"]' },
  { id: 'super', e: '🛒', name: 'Supermercati', q: 'nwr["shop"~"^(supermarket|convenience)$"]' },
  { id: 'pharma', e: '💊', name: 'Farmacie', q: 'nwr["amenity"="pharmacy"]' },
  { id: 'atm', e: '🏧', name: 'Bancomat', q: 'nwr["amenity"="atm"]' },
  { id: 'hotel', e: '🏨', name: 'Hotel', q: 'nwr["tourism"~"^(hotel|guest_house|hostel)$"]' },
  { id: 'station', e: '🚆', name: 'Stazioni', q: 'nwr["railway"~"^(station|halt)$"]' }
];

// ---------- Foglio in basso (iPhone) ----------
let sheetState = 'peek';
const safeProbe = document.createElement('div');
safeProbe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:env(safe-area-inset-top,0px);visibility:hidden;pointer-events:none';
document.body.appendChild(safeProbe);
const safeTop = () => safeProbe.offsetHeight || 0;
function sheetPx(state) {
  const H = window.innerHeight, panelH = H - 52 - safeTop();
  if (state === 'full') return panelH;
  if (state === 'half') return Math.min(panelH, Math.round(H * 0.5));
  // "peek": barra di ricerca + categorie
  return Math.min(panelH, 168 + (parseFloat(getComputedStyle($('views')).paddingBottom) || 16) - 16);
}
function setSheet(state) {
  sheetState = state;
  document.documentElement.style.setProperty('--sheet', sheetPx(state) + 'px');
}
const DEFAULT_SHEET = { home: 'peek', search: 'full', place: 'half', dir: 'half', itin: 'full', settings: 'full' };
(function sheetDrag() {
  const panel = $('panel'); let startY = 0, startH = 0, moved = false, active = false;
  panel.addEventListener('pointerdown', e => {
    if (isDesktop()) return;
    const zone = e.target.closest('#grab, .drag-zone');
    if (!zone || e.target.closest('input, select')) return;
    active = true; moved = false; startY = e.clientY; startH = sheetPx(sheetState);
  });
  window.addEventListener('pointermove', e => {
    if (!active) return;
    const dy = e.clientY - startY;
    if (!moved && Math.abs(dy) < 6) return;
    moved = true; panel.classList.add('dragging');
    const h = Math.max(110, Math.min(sheetPx('full'), startH - dy));
    document.documentElement.style.setProperty('--sheet', h + 'px');
  });
  window.addEventListener('pointerup', () => {
    if (!active) return; active = false; panel.classList.remove('dragging');
    if (!moved) return;
    const h = parseFloat(document.documentElement.style.getPropertyValue('--sheet'));
    const opts = ['peek', 'half', 'full'].map(s => [s, Math.abs(sheetPx(s) - h)]).sort((a, b) => a[1] - b[1]);
    setSheet(opts[0][0]);
    const kill = ev => { ev.stopPropagation(); ev.preventDefault(); window.removeEventListener('click', kill, true); };
    window.addEventListener('click', kill, true); setTimeout(() => window.removeEventListener('click', kill, true), 50);
  });
  $('grab').addEventListener('click', () => setSheet(sheetState === 'full' ? 'peek' : sheetState === 'half' ? 'full' : 'half'));
})();

// ---------- Viste ----------
const VIEWS = ['home', 'search', 'place', 'dir', 'itin', 'settings'];
function show(view, { push = true, sheet } = {}) {
  if (push && S.view !== view) S.stack.push(S.view);
  S.view = view;
  VIEWS.forEach(v => $('v-' + v).classList.toggle('hidden', v !== view));
  $('views').scrollTop = 0;
  setSheet(sheet || DEFAULT_SHEET[view]);
}
function back() {
  const from = S.view, to = S.stack.pop() || 'home';
  if (from === 'place') { placePin.remove(); if (to === 'home') map.getSource('results').setData(emptyFC); }
  if (from === 'search' && S.pick) { S.pick = null; }
  if (from === 'dir') { clearDirections(); }
  if (from === 'itin') { /* torna all'elenco degli itinerari */ }
  show(to, { push: false });
  if (to === 'home') renderHome();
}
function goHome() {
  clearDirections(); placePin.remove(); map.getSource('results').setData(emptyFC);
  S.stack = []; S.pick = null; S.place = null;
  show('home', { push: false }); renderHome();
}
document.querySelectorAll('[data-back]').forEach(b => b.onclick = back);
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => { if (S.view === 'dir') goHome(); else back(); });
document.querySelectorAll('.view-head, #v-home .search-row').forEach(el => el.classList.add('drag-zone'));

// ---------- Home ----------
function renderHome() {
  $('cats').innerHTML = CATS.map(c => `<button class="chip" data-cat="${c.id}"><span class="e">${c.e}</span>${c.name}</button>`).join('');
  $('cats').querySelectorAll('[data-cat]').forEach(b => b.onclick = () => searchCategory(CATS.find(c => c.id === b.dataset.cat)));
  const fv = $('homeFavs'), items = [];
  [['casa', '🏠', 'Casa'], ['lavoro', '💼', 'Lavoro']].forEach(([t, e, n]) => {
    const f = favs.find(x => x.type === t);
    items.push(`<div class="fav ${f ? 'set' : ''}" data-fav="${t}"><div class="ic">${e}</div><span>${n}</span><small>${f ? esc(etaLabel(f.p)) : 'Aggiungi'}</small></div>`);
  });
  favs.filter(f => f.type === 'fav').forEach((f, i) => items.push(`<div class="fav set" data-fi="${i}"><div class="ic">★</div><span>${esc(f.name)}</span><small>${esc(etaLabel(f.p))}</small></div>`));
  items.push(`<div class="fav" data-add="1"><div class="ic">＋</div><span>Aggiungi</span></div>`);
  fv.innerHTML = items.join('');
  fv.querySelectorAll('[data-fav]').forEach(el => el.onclick = () => {
    const f = favs.find(x => x.type === el.dataset.fav);
    if (f) openDirections({ p: f.p, name: f.type === 'casa' ? 'Casa' : 'Lavoro', sub: f.name });
    else startPick(el.dataset.fav);
  });
  const custom = favs.filter(f => f.type === 'fav');
  fv.querySelectorAll('[data-fi]').forEach(el => el.onclick = () => { const f = custom[+el.dataset.fi]; openPlace({ p: f.p, name: f.name, sub: f.sub || '' }); });
  fv.querySelector('[data-add]').onclick = () => startPick('fav');
  $('recentsTitle').classList.toggle('hidden', !recents.length);
  $('recents').innerHTML = recents.map((r, i) => rowHTML(r, i, 'r')).join('');
  $('recents').querySelectorAll('[data-r]').forEach(el => el.onclick = () => openPlace(recents[+el.dataset.r]));
  const iOS = /iPhone|iPad|iPod/.test(navigator.userAgent), standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  $('installHint').classList.toggle('hidden', !iOS || standalone || store.get('yz-hint', false));
}
$('installClose').onclick = () => { store.set('yz-hint', true); $('installHint').classList.add('hidden'); };
function etaLabel(p) { const o = me.p; if (!o) return ''; const d = dist(o, p); return d < 50 ? 'Sei qui' : fmtDist(d); }
function rowHTML(r, i, key) {
  const k = r.kind || '📍', d = me.p ? fmtDist(dist(me.p, r.p)) : '';
  return `<div class="row" data-${key}="${i}"><div class="ic">${k}</div><div class="tx"><b>${esc(r.name)}</b><small>${esc(r.sub || '')}</small></div><div class="side">${d}</div></div>`;
}
function addRecent(pl) {
  recents = [{ p: pl.p, name: pl.name, sub: pl.sub || '', kind: pl.kind || '📍', osm: pl.osm || null }, ...recents.filter(r => !(r.name === pl.name && dist(r.p, pl.p) < 30))].slice(0, 12);
  store.set('yz-recents', recents);
}

// ---------- Ricerca ----------
let searchT, searchSeq = 0;
$('homeSearch').onclick = () => openSearch();
function openSearch(hint) {
  show('search', { sheet: 'full' });
  $('q').value = ''; $('qClear').classList.add('hidden');
  $('qHint').textContent = hint || ''; $('qHint').classList.toggle('hidden', !hint);
  renderSearchSuggestions();
  setTimeout(() => $('q').focus(), 60);
}
function startPick(target) {
  S.pick = target;
  const hints = { from: 'Scegli il punto di partenza', to: 'Scegli la destinazione', casa: "Cerca l'indirizzo di Casa", lavoro: "Cerca l'indirizzo di Lavoro", fav: 'Cerca il luogo da aggiungere ai preferiti' };
  openSearch(hints[target]);
}
function renderSearchSuggestions() {
  const rows = [];
  if (S.pick === 'from' || S.pick === 'to') rows.push(`<div class="row" data-me="1"><div class="ic">📍</div><div class="tx"><b>La mia posizione</b><small>${me.p ? 'Usa la posizione attuale' : 'Consenti la posizione nel browser'}</small></div></div>`);
  if (!S.pick) rows.push(...CATS.slice(0, 6).map(c => `<div class="row" data-c="${c.id}"><div class="ic">${c.e}</div><div class="tx"><b>${c.name}</b><small>Vicino a te</small></div></div>`));
  rows.push(...recents.map((r, i) => rowHTML(r, i, 'r')));
  $('sResults').innerHTML = rows.join('') || '<div class="empty-note">Scrivi un indirizzo, una via o il nome di un posto</div>';
  bindResultRows($('sResults'));
}
function bindResultRows(box) {
  box.querySelectorAll('[data-r]').forEach(el => el.onclick = () => choose(recents[+el.dataset.r]));
  box.querySelectorAll('[data-s]').forEach(el => el.onclick = () => choose(S.results[+el.dataset.s]));
  box.querySelectorAll('[data-c]').forEach(el => el.onclick = () => searchCategory(CATS.find(c => c.id === el.dataset.c)));
  const m = box.querySelector('[data-me]');
  if (m) m.onclick = () => { if (!me.p) { locateMe(); toast('Attendo la tua posizione…'); return; } choose({ p: me.p, name: 'La mia posizione', me: true }); };
}
// Un risultato scelto: dipende da cosa stavamo facendo
function choose(pl) {
  const pick = S.pick;
  if (pick === 'from' || pick === 'to') {
    S.pick = null; S[pick] = pl; if (!pl.me) addRecent(pl);
    S.stack.pop(); show('dir', { push: false }); renderDirHead(); computeDir(); return;
  }
  if (pick === 'casa' || pick === 'lavoro' || pick === 'fav') {
    S.pick = null;
    favs = favs.filter(f => !(pick !== 'fav' && f.type === pick));
    favs.push({ type: pick, name: pl.name, sub: pl.sub || '', p: pl.p });
    store.set('yz-favs', favs);
    toast(pick === 'fav' ? `${pl.name} aggiunto ai preferiti` : `${pick === 'casa' ? 'Casa' : 'Lavoro'} salvato`);
    goHome(); return;
  }
  openPlace(pl);
}
$('q').addEventListener('input', e => {
  const v = e.target.value; $('qClear').classList.toggle('hidden', !v);
  clearTimeout(searchT); searchT = setTimeout(() => runSearch(v), 280);
});
$('q').addEventListener('keydown', e => { if (e.key === 'Enter') { clearTimeout(searchT); runSearch(e.target.value); e.target.blur(); } });
$('qClear').onclick = () => { $('q').value = ''; $('qClear').classList.add('hidden'); renderSearchSuggestions(); $('q').focus(); };

function photonPlace(f) {
  const pr = f.properties, [e, label] = kindOf(pr.osm_value, pr.type);
  const street = [pr.street, pr.housenumber].filter(Boolean).join(' ');
  const name = pr.name || street || pr.city || 'Luogo';
  const sub = [label !== 'Luogo' && label !== 'Indirizzo' ? label : '', pr.name ? street : '', pr.city || pr.county || pr.state, pr.country && !/^Itali/.test(pr.country) ? pr.country : ''].filter(Boolean).join(' · ');
  return { p: f.geometry.coordinates, name, sub, kind: e, osm: pr.osm_id ? { type: { N: 'node', W: 'way', R: 'relation' }[pr.osm_type], id: pr.osm_id } : null };
}
async function runSearch(text) {
  const seq = ++searchSeq;
  if (text.trim().length < 2) { renderSearchSuggestions(); return; }
  $('sResults').innerHTML = '<div class="empty-note">Cerco…</div>';
  const c = map.getCenter(), bias = me.p || [c.lng, c.lat];
  try {
    const r = await getJSON(`https://photon.komoot.io/api/?q=${encodeURIComponent(text)}&lang=it&limit=12&lat=${bias[1]}&lon=${bias[0]}`);
    if (seq !== searchSeq) return;
    S.results = (r.features || []).map(photonPlace);
    if (!S.results.length) { $('sResults').innerHTML = '<div class="empty-note">Nessun risultato. Prova a scrivere anche la città.</div>'; return; }
    $('sResults').innerHTML = S.results.map((p, i) => rowHTML(p, i, 's')).join('');
    bindResultRows($('sResults'));
  } catch (e) { if (seq === searchSeq) $('sResults').innerHTML = '<div class="empty-note">Ricerca non disponibile, riprova tra poco.</div>'; }
}

async function searchCategory(cat) {
  if (!cat) return;
  if (S.view !== 'search') show('search', { sheet: 'half' }); else setSheet('half');
  $('q').value = cat.name; $('qClear').classList.remove('hidden'); $('qHint').classList.add('hidden'); $('q').blur();
  $('sResults').innerHTML = `<div class="empty-note">Cerco ${cat.name.toLowerCase()} qui intorno…</div>`;
  const c = map.getCenter(), b = map.getBounds();
  const rMap = Math.min(dist([c.lng, c.lat], [b.getEast(), c.lat]), dist([c.lng, c.lat], [c.lng, b.getNorth()]));
  const r = Math.max(600, Math.min(4000, rMap * 1.1)), seq = ++searchSeq;
  try {
    const res = await overpass(`[out:json][timeout:20];(${cat.q}(around:${Math.round(r)},${c.lat},${c.lng}););out center tags 80;`);
    if (seq !== searchSeq) return;
    const center = me.p || [c.lng, c.lat];
    S.results = (res.elements || []).map(el => {
      const t = el.tags || {}, p = el.type === 'node' ? [el.lon, el.lat] : [el.center.lon, el.center.lat];
      const [e, label] = kindFromTags(t);
      return { p, name: t.name || t.brand || label, sub: [t.name ? label : '', addrFromTags(t)].filter(Boolean).join(' · '), kind: e, tags: t, osm: { type: el.type, id: el.id } };
    }).sort((a, b) => dist(center, a.p) - dist(center, b.p)).slice(0, 50);
    if (!S.results.length) { $('sResults').innerHTML = '<div class="empty-note">Niente qui intorno. Sposta o allarga la mappa e riprova.</div>'; map.getSource('results').setData(emptyFC); return; }
    $('sResults').innerHTML = S.results.map((p, i) => rowHTML(p, i, 's')).join('');
    bindResultRows($('sResults'));
    showResultsOnMap(S.results);
  } catch (e) { if (seq === searchSeq) $('sResults').innerHTML = '<div class="empty-note">Ricerca non disponibile, riprova tra poco.</div>'; }
}
function showResultsOnMap(list) {
  map.getSource('results').setData({ type: 'FeatureCollection', features: list.map((p, i) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: p.p }, properties: { i, name: p.name } })) });
  fitCoords(list.map(p => p.p), { pitch: map.getPitch(), maxZoom: 16 });
}

// ---------- Scheda del luogo ----------
async function openPlace(pl, { fly = true } = {}) {
  if (!pl.kind && pl.tags) pl.kind = kindFromTags(pl.tags)[0];
  S.place = pl; if (!pl.me && !pl.dropped) addRecent(pl);
  show('place', { push: S.view !== 'place' });
  $('pName').textContent = pl.name;
  const d = me.p ? fmtDist(dist(me.p, pl.p)) : '';
  $('pSub').textContent = [pl.sub, d ? 'a ' + d : ''].filter(Boolean).join(' · ');
  $('pGoTxt').textContent = me.p ? 'Indicazioni' : 'Indicazioni';
  updateSaveBtn();
  placePin.setLngLat(pl.p).addTo(map);
  if (fly) map.flyTo({ center: pl.p, zoom: Math.max(map.getZoom(), 16), speed: 1.4, padding: mapPadding() });
  $('pDetails').innerHTML = '';
  const tags = pl.tags || await fetchPlaceTags(pl);
  if (S.place !== pl) return;
  if (tags) { pl.tags = tags; renderDetails(pl); }
  else $('pDetails').innerHTML = `<div class="drow"><div class="k">Coordinate</div><div class="v">${pl.p[1].toFixed(5)}, ${pl.p[0].toFixed(5)}</div></div>`;
}
async function fetchPlaceTags(pl) {
  try {
    if (pl.osm && pl.osm.type) {
      const r = await overpass(`[out:json][timeout:10];${pl.osm.type}(${pl.osm.id});out tags center;`, 12000);
      return (r.elements[0] || {}).tags || null;
    }
    if (pl.fromPoi && pl.name) {
      const n = pl.name.replace(/["\\]/g, '');
      const r = await overpass(`[out:json][timeout:10];nwr(around:80,${pl.p[1]},${pl.p[0]})["name"="${n}"];out tags center 1;`, 12000);
      return (r.elements[0] || {}).tags || null;
    }
  } catch (e) {}
  return null;
}
const DAYS = { Mo: 'Lun', Tu: 'Mar', We: 'Mer', Th: 'Gio', Fr: 'Ven', Sa: 'Sab', Su: 'Dom', PH: 'Festivi' };
function fmtHours(oh) {
  return oh.split(';').map(s => s.trim()).filter(Boolean).map(s => s.replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH)\b/g, m => DAYS[m]).replace(/\boff\b|\bclosed\b/g, 'chiuso').replace('24/7', 'Sempre aperto'));
}
function renderDetails(pl) {
  const t = pl.tags, rows = [];
  const [e, label] = kindFromTags(t);
  if (label !== 'Luogo' && !pl.sub) $('pSub').textContent = label;
  const addr = addrFromTags(t); if (addr) rows.push(['Indirizzo', esc(addr)]);
  if (t.opening_hours) rows.push(['Orari', '<div>' + fmtHours(t.opening_hours).map(esc).join('<br>') + '</div>']);
  const phone = t.phone || t['contact:phone']; if (phone) rows.push(['Telefono', `<a href="tel:${esc(phone.replace(/\s/g, ''))}">${esc(phone)}</a>`]);
  const web = t.website || t['contact:website']; if (web) rows.push(['Sito', `<a href="${esc(/^https?:/.test(web) ? web : 'https://' + web)}" target="_blank" rel="noopener">${esc(web.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</a>`]);
  const ig = t['contact:instagram']; if (ig) rows.push(['Instagram', `<a href="${esc(/^https?:/.test(ig) ? ig : 'https://instagram.com/' + ig.replace('@', ''))}" target="_blank" rel="noopener">${esc(ig.replace(/^https?:\/\/(www\.)?instagram\.com\//, '@'))}</a>`]);
  if (t.cuisine) rows.push(['Cucina', esc(t.cuisine.split(';').join(', ').replace(/_/g, ' '))]);
  if (t.socket_type2 || t['socket:type2'] || t['socket:type2_combo']) rows.push(['Prese', esc(['type2', 'type2_combo', 'chademo'].filter(k => t['socket:' + k]).map(k => ({ type2: 'Tipo 2', type2_combo: 'CCS', chademo: 'CHAdeMO' }[k]) + ' ×' + t['socket:' + k]).join(', '))]);
  if (t.operator) rows.push(['Gestore', esc(t.operator)]);
  if (t.fee) rows.push(['A pagamento', t.fee === 'yes' ? 'Sì' : t.fee === 'no' ? 'No' : esc(t.fee)]);
  if (t.wheelchair) rows.push(['Accessibile', t.wheelchair === 'yes' ? '♿ Sì' : t.wheelchair === 'limited' ? 'In parte' : 'No']);
  rows.push(['Coordinate', `${pl.p[1].toFixed(5)}, ${pl.p[0].toFixed(5)}`]);
  $('pDetails').innerHTML = rows.map(([k, v]) => `<div class="drow"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('');
}
function isSaved(pl) { return favs.some(f => f.type === 'fav' && dist(f.p, pl.p) < 25); }
function updateSaveBtn() { const on = S.place && isSaved(S.place); $('pSave').classList.toggle('on', on); $('pSave').querySelector('span').textContent = on ? '★' : '☆'; }
$('pSave').onclick = () => {
  const pl = S.place; if (!pl) return;
  if (isSaved(pl)) { favs = favs.filter(f => !(f.type === 'fav' && dist(f.p, pl.p) < 25)); toast('Rimosso dai preferiti'); }
  else { favs.push({ type: 'fav', name: pl.name, sub: pl.sub || '', p: pl.p }); toast('Salvato nei preferiti'); }
  store.set('yz-favs', favs); updateSaveBtn();
};
$('pShare').onclick = async () => {
  const pl = S.place; if (!pl) return;
  const url = `${location.origin}${location.pathname}?p=${pl.p[1].toFixed(6)},${pl.p[0].toFixed(6)}&n=${encodeURIComponent(pl.name)}`;
  if (navigator.share) { try { await navigator.share({ title: pl.name, text: pl.name, url }); } catch (e) {} return; }
  try { await navigator.clipboard.writeText(url); toast('Link copiato'); } catch (e) { toast(url); }
};
$('pGo').onclick = () => S.place && openDirections(S.place);
async function dropPin(lngLat) {
  const p = [lngLat.lng, lngLat.lat], pl = { p, name: 'Punto selezionato', sub: '', kind: '📍', dropped: true };
  openPlace(pl, { fly: false });
  try {
    const r = await getJSON(`https://photon.komoot.io/reverse?lon=${p[0]}&lat=${p[1]}&lang=it`);
    const f = (r.features || [])[0];
    if (f && S.place === pl) { const x = photonPlace(f); pl.sub = [x.name, x.sub].filter(Boolean).join(' · '); $('pSub').textContent = pl.sub; }
  } catch (e) {}
}

// ---------- Indicazioni ----------
function myPlace() { return me.p ? { p: me.p, name: 'La mia posizione', me: true } : null; }
function openDirections(to, from) {
  S.to = to; S.from = from || myPlace(); S.routes = []; S.itins = [];
  placePin.remove(); map.getSource('results').setData(emptyFC);
  show('dir');
  renderDirHead();
  if (!S.from) { $('dResults').innerHTML = '<div class="empty-note">Scegli il punto di partenza oppure consenti la posizione.</div>'; locateMe(); return; }
  computeDir();
}
function renderDirHead() {
  const f = $('dFrom'), t = $('dTo');
  f.textContent = S.from ? S.from.name : 'Scegli la partenza'; f.classList.toggle('me', !!(S.from && S.from.me));
  t.textContent = S.to ? S.to.name : 'Scegli la destinazione'; t.classList.toggle('me', !!(S.to && S.to.me));
  $('dModes').innerHTML = Object.entries(MODE_INFO).map(([k, m]) => `<button data-m="${k}" class="${k === S.mode ? 'sel' : ''}"><span>${m.icon}</span><small>${m.name}</small></button>`).join('');
  $('dModes').querySelectorAll('[data-m]').forEach(b => b.onclick = () => { S.mode = b.dataset.m; store.set('yz-tmode', S.mode); renderDirHead(); computeDir(); });
  $('dTime').classList.toggle('hidden', S.mode !== 'transit');
}
$('dFrom').onclick = () => startPick('from');
$('dTo').onclick = () => startPick('to');
$('dSwap').onclick = () => { [S.from, S.to] = [S.to, S.from]; renderDirHead(); computeDir(); };
$('dTimeType').onchange = e => {
  S.tt.type = e.target.value; $('dTimeVal').classList.toggle('hidden', S.tt.type === 'now');
  if (S.tt.type !== 'now' && !$('dTimeVal').value) { const d = new Date(Date.now() + 15 * 60000 - new Date().getTimezoneOffset() * 60000); $('dTimeVal').value = d.toISOString().slice(0, 16); }
  S.tt.value = $('dTimeVal').value; computeDir();
};
$('dTimeVal').onchange = e => { S.tt.value = e.target.value; computeDir(); };

function clearDirections() {
  S.dirToken++; clearRoute();
  map.getSource('transit').setData(emptyFC); map.getSource('transit-stops').setData(emptyFC);
  destPin.remove(); startPin.remove();
  $('dStart').classList.add('hidden'); $('dSteps').innerHTML = ''; $('dStepsTitle').classList.add('hidden');
}
async function computeDir() {
  if (!S.from || !S.to) return;
  clearDirections();
  const tok = S.dirToken;
  destPin.setLngLat(S.to.p).addTo(map);
  if (!S.from.me) startPin.setLngLat(S.from.p).addTo(map);
  if (dist(S.from.p, S.to.p) < 20) { $('dResults').innerHTML = '<div class="empty-note">Partenza e arrivo coincidono.</div>'; return; }
  $('dResults').innerHTML = `<div class="empty-note">Calcolo ${S.mode === 'transit' ? 'gli itinerari con i mezzi' : 'il percorso'}…</div>`;
  fitCoords([S.from.p, S.to.p]);
  try {
    if (S.mode === 'transit') {
      const res = await fetchTransit(S.from.p, S.to.p, S.tt);
      if (tok !== S.dirToken) return;
      S.itins = res.itins; S.direct = res.direct;
      renderItinCards();
    } else {
      const rs = await fetchRoutes(S.mode, S.from.p, S.to.p, true);
      if (tok !== S.dirToken) return;
      S.routes = rs; selectRoute(0, true);
    }
  } catch (e) {
    if (tok !== S.dirToken) return;
    $('dResults').innerHTML = `<div class="empty-note">${S.mode === 'transit' ? 'Non trovo itinerari con i mezzi per questo tragitto (o il servizio non risponde). Prova un altro orario.' : 'Non riesco a calcolare il percorso. Riprova tra qualche secondo.'}</div>`;
  }
}
function selectRoute(i, fit) {
  S.sel = i;
  const r = S.routes[i];
  destName = S.to.name;
  setRoute(r);
  map.getSource('route-alt').setData({ type: 'FeatureCollection', features: S.routes.map((x, j) => j === i ? null : { type: 'Feature', geometry: { type: 'LineString', coordinates: x.coords }, properties: { i: j } }).filter(Boolean) });
  const fastest = Math.min(...S.routes.map(x => x.duration));
  $('dResults').innerHTML = S.routes.map((x, j) => `<div class="rcard ${j === i ? 'sel' : ''}" data-ri="${j}">
    <div class="top"><b>${fmtDur(x.duration)}</b><span class="km">${fmtDist(x.distance)}</span>${x.duration === fastest && S.routes.length > 1 ? '<span class="tag">PIÙ VELOCE</span>' : ''}</div>
    <div class="via">${x.via.length ? 'via ' + esc(x.via.join(', ')) : MODE_INFO[x.mode].name} · arrivo alle ${fmtTime(new Date(Date.now() + x.duration * 1000))}</div></div>`).join('');
  $('dResults').querySelectorAll('[data-ri]').forEach(el => el.onclick = () => selectRoute(+el.dataset.ri, false));
  $('dStart').classList.remove('hidden');
  $('dGo').textContent = S.from.me ? 'Avvia' : 'Avvia (dalla tua posizione)';
  renderSteps(r);
  if (fit) fitCoords(S.routes.flatMap(x => x.coords));
}
function renderSteps(r) {
  $('dStepsTitle').classList.remove('hidden');
  $('dSteps').innerHTML = r.steps.map((s, i) => {
    const info = describe(s), icon = info.arrive ? FLAG_SVG : info.round ? roundaboutSVG(info.round) : shapeSVG(info.mod, { ghost: false, sw: 6 });
    const txt = info.arrive ? 'Arrivo a destinazione' : (info.street !== info.verb ? `${info.verb} su ${info.street}` : info.verb);
    return `<div class="row" data-st="${i}"><div class="ic">${icon}</div><div class="tx"><b>${esc(txt)}</b><small>${s.distance > 0 ? fmtDist(s.distance) : ''}</small></div></div>`;
  }).join('');
  $('dSteps').querySelectorAll('[data-st]').forEach(el => el.onclick = () => {
    const s = r.steps[+el.dataset.st];
    map.flyTo({ center: s.maneuver.location, zoom: 17.5, padding: mapPadding(), pitch: 45 });
  });
}
$('dGo').onclick = () => {
  if (!route) return;
  if (!S.from.me) {
    if (!me.p) { toast('Per la guida reale serve la tua posizione'); locateMe(); return; }
    // ricalcola dalla posizione attuale
    S.from = myPlace(); renderDirHead();
    fetchRoutes(S.mode, me.p, S.to.p, false).then(rs => { setRoute(rs[0], { animate: false }); startNavigation('gps', S.to); }).catch(() => toast('Non riesco a calcolare il percorso'));
    return;
  }
  startNavigation('gps', S.to);
};
$('dSim').onclick = () => { if (route) startNavigation('sim', S.to); };

// Mezzi pubblici
function legBadge(l) {
  if (l.walk) return `<span class="lbadge walk">🚶 ${Math.max(1, Math.round(l.duration / 60))}′</span>`;
  return `<span class="lbadge" style="background:${l.color};color:${l.text}">${l.e} ${esc(l.name)}</span>`;
}
function renderItinCards() {
  const its = S.itins;
  if (!its.length) {
    const d = (S.direct || [])[0];
    $('dResults').innerHTML = `<div class="empty-note">Nessun itinerario con i mezzi trovato${d ? ` — a piedi ci metti ${fmtDur(d.duration)}` : ''}.</div>`;
    return;
  }
  $('dResults').innerHTML = its.map((it, i) => {
    const first = it.legs.find(l => !l.walk);
    return `<div class="rcard" data-ii="${i}">
      <div class="top"><b>${fmtDur(it.duration)}</b><span class="km">${fmtTime(it.start)} – ${fmtTime(it.end)}</span>${i === 0 ? '<span class="tag">CONSIGLIATO</span>' : ''}</div>
      <div class="legs">${it.legs.filter(l => !l.walk || l.duration > 60).map(legBadge).join('<span class="sep">›</span>')}</div>
      <div class="via">${first ? 'da ' + esc(first.from.name) + ' alle ' + fmtTime(first.start) : ''}${it.transfers ? ' · ' + it.transfers + (it.transfers === 1 ? ' cambio' : ' cambi') : ''}${it.walkDist ? ' · ' + fmtDist(it.walkDist) + ' a piedi' : ''}</div></div>`;
  }).join('');
  $('dResults').querySelectorAll('[data-ii]').forEach(el => el.onclick = () => openItin(+el.dataset.ii));
  drawItin(its[0]);
}
function drawItin(it) {
  map.getSource('transit').setData({ type: 'FeatureCollection', features: it.legs.map(l => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: l.coords }, properties: { color: l.color, walk: l.walk } })) });
  const stops = [];
  it.legs.filter(l => !l.walk).forEach(l => { stops.push([l.from.p, l.color]); stops.push([l.to.p, l.color]); });
  map.getSource('transit-stops').setData({ type: 'FeatureCollection', features: stops.map(([p, c]) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: p }, properties: { color: c } })) });
  fitCoords(it.legs.flatMap(l => l.coords));
}
function openItin(i) {
  const it = S.itins[i]; S.itin = it;
  drawItin(it);
  show('itin');
  $('iTitle').textContent = `${fmtDur(it.duration)} · ${fmtTime(it.start)} – ${fmtTime(it.end)}`;
  $('iSub').textContent = [it.transfers ? it.transfers + (it.transfers === 1 ? ' cambio' : ' cambi') : 'Nessun cambio', it.walkDist ? fmtDist(it.walkDist) + ' a piedi' : ''].filter(Boolean).join(' · ');
  const rows = [];
  it.legs.forEach((l, k) => {
    const late = l.delay > 0 ? `<small>+${l.delay}′</small>` : '';
    if (l.walk) {
      rows.push(`<div class="tl walk"><div class="t">${fmtTime(l.start)}</div><div class="bar"><i style="--c:#fff"></i></div><div class="body"><b>${k === 0 ? esc(S.from.name) : esc(l.from.name)}</b><div class="sub">🚶 A piedi ${fmtDur(l.duration)}${l.distance ? ' · ' + fmtDist(l.distance) : ''} → ${esc(l.to.name)}</div></div></div>`);
    } else {
      rows.push(`<div class="tl" style="--c:${l.color}"><div class="t">${fmtTime(l.start)}${late}</div><div class="bar"><i></i></div><div class="body"><b>${esc(l.from.name)}${l.from.track ? ' · binario ' + esc(l.from.track) : ''}</b>${legBadge(l)} ${l.headsign ? '<span class="muted small">→ ' + esc(l.headsign) + '</span>' : ''}<div class="sub">${l.stops ? (l.stops + 1) + ' fermate · ' : ''}${fmtDur(l.duration)}${l.agency ? ' · ' + esc(l.agency) : ''}</div></div></div>`);
    }
  });
  const last = it.legs[it.legs.length - 1];
  rows.push(`<div class="tl end"><div class="t">${fmtTime(it.end)}</div><div class="bar"><i style="--c:#ff8ee0"></i></div><div class="body"><b>${esc(S.to.name)}</b><div class="sub">Arrivo${last && !last.walk ? ' a ' + esc(last.to.name) : ''}</div></div></div>`);
  $('iLegs').innerHTML = rows.join('');
}

// Quando la navigazione finisce si torna alle indicazioni
function onNavExit() {
  if (route) { setRouteWindow(0, 1.0001); nav.d = 0; }
  map.easeTo({ pitch: BROWSE_PITCH(), padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: 0 });
  if (S.view === 'dir' && S.routes.length) fitCoords(route ? route.coords : S.routes[S.sel].coords);
}
$('arrClose').onclick = () => { $('arrive').classList.add('hidden'); exitNav(); goHome(); };
$('arrShare').onclick = () => shareTrip(true);
$('btnShare').onclick = () => shareTrip(false);
$('btnOverview').onclick = overviewRoute;

// ---------- Impostazioni ----------
$('btnSettings').onclick = () => { renderSettings(); show('settings'); };
function renderSettings() {
  $('modeSeg').innerHTML = MODES.map(m => `<button data-md="${m}" class="${m === modePref ? 'sel' : ''}">${MODE_NAMES[m]}</button>`).join('');
  $('modeSeg').querySelectorAll('[data-md]').forEach(b => b.onclick = () => { setMode(b.dataset.md); renderSettings(); });
  $('viewSeg').querySelectorAll('[data-v]').forEach(b => { b.className = b.dataset.v === viewPref ? 'sel' : ''; b.onclick = () => { setView3D(b.dataset.v); renderSettings(); }; });
  $('puckOpts').innerHTML = Object.entries(PUCKS).map(([k, v]) => `<div class="opt ${k === puckPref ? 'sel' : ''}" data-pk="${k}"><div class="prev">${v.svg.replace(/id="(\w+)"/g, 'id="$1_' + k + '"').replace(/url\(#(\w+)\)/g, 'url(#$1_' + k + ')')}</div>${v.name}</div>`).join('');
  $('puckOpts').querySelectorAll('[data-pk]').forEach(el => el.onclick = () => { setPuck(el.dataset.pk); renderSettings(); });
}
