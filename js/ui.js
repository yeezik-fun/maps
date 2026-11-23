// ================= Interfaccia: pannello, ricerca, luoghi, indicazioni =================
'use strict';

const S = {
  view: 'home', stack: [], place: null, from: null, to: null,
  mode: store.get('yz-tmode', 'car'), routes: [], sel: 0, itins: [], itin: null,
  tt: { type: 'now', value: '' }, pick: null, results: [], cat: null, dirToken: 0
};
let favs = store.get('yz-favs', []), recents = store.get('yz-recents', []);
// Icone (Lucide) per le parti dell'interfaccia senza React; arrivano col modulo della ricerca
const ic = (name, size = 18) => window.YZIcon ? window.YZIcon(name, size) : '';
window.addEventListener('yz-ui-ready', () => {
  $('pShare').querySelector('span').innerHTML = ic('Share', 19);
  $('pGo').querySelector('svg').outerHTML = ic('Navigation', 19);
  updateSaveBtn(); renderHome();
  if (S.view === 'search') { if (lastModel) renderSearch(lastModel); else renderSearchSuggestions(); }
});

// ---------- Tipi di luogo ----------
const KIND = {
  restaurant: ['Utensils', 'Ristorante'], fast_food: ['Sandwich', 'Fast food'], cafe: ['Coffee', 'Bar'], bar: ['Martini', 'Bar'], pub: ['Beer', 'Pub'], nightclub: ['Music', 'Discoteca'],
  ice_cream: ['IceCreamCone', 'Gelateria'], fuel: ['Fuel', 'Distributore'], charging_station: ['PlugZap', 'Ricarica auto'], parking: ['SquareParking', 'Parcheggio'], pharmacy: ['Pill', 'Farmacia'],
  hospital: ['Hospital', 'Ospedale'], clinic: ['Hospital', 'Clinica'], doctors: ['Stethoscope', 'Medico'], dentist: ['Stethoscope', 'Dentista'], bank: ['Landmark', 'Banca'], atm: ['Banknote', 'Bancomat'],
  supermarket: ['ShoppingCart', 'Supermercato'], convenience: ['ShoppingCart', 'Minimarket'], bakery: ['Croissant', 'Panetteria'], clothes: ['Shirt', 'Abbigliamento'], shoes: ['Footprints', 'Scarpe'],
  hairdresser: ['Scissors', 'Parrucchiere'], hotel: ['BedDouble', 'Hotel'], guest_house: ['BedDouble', 'B&B'], hostel: ['BedDouble', 'Ostello'], apartment: ['BedDouble', 'Appartamento'],
  station: ['TrainFront', 'Stazione'], halt: ['TrainFront', 'Stazione'], subway_entrance: ['TramFront', 'Metro'], bus_stop: ['Bus', 'Fermata bus'], tram_stop: ['TramFront', 'Fermata tram'], aerodrome: ['Plane', 'Aeroporto'],
  school: ['School', 'Scuola'], university: ['GraduationCap', 'Università'], museum: ['Landmark', 'Museo'], attraction: ['Camera', 'Attrazione'], viewpoint: ['Mountain', 'Panorama'], park: ['Trees', 'Parco'], garden: ['Trees', 'Giardino'],
  cinema: ['Clapperboard', 'Cinema'], theatre: ['Drama', 'Teatro'], place_of_worship: ['Church', 'Luogo di culto'], police: ['ShieldCheck', 'Polizia'], post_office: ['Mail', 'Poste'],
  fitness_centre: ['Dumbbell', 'Palestra'], sports_centre: ['Trophy', 'Centro sportivo'], stadium: ['Trophy', 'Stadio'], marketplace: ['ShoppingBasket', 'Mercato'], mall: ['ShoppingBag', 'Centro commerciale'],
  city: ['Building2', 'Città'], town: ['Building', 'Paese'], village: ['Building', 'Paese'], suburb: ['Building', 'Quartiere'], quarter: ['Building', 'Quartiere'], neighbourhood: ['Building', 'Quartiere'],
  house: ['House', 'Indirizzo'], street: ['Route', 'Via'], road: ['Route', 'Via'], residential: ['Route', 'Via'], primary: ['Route', 'Via'], secondary: ['Route', 'Via'], tertiary: ['Route', 'Via'], pedestrian: ['Footprints', 'Zona pedonale']
};
function kindOf(...vals) { for (const v of vals) if (v && KIND[v]) return KIND[v]; return ['MapPin', 'Luogo']; }
function kindFromTags(t = {}) { return kindOf(t.amenity, t.shop, t.tourism, t.railway, t.public_transport === 'station' ? 'station' : null, t.leisure, t.aeroway, t.highway, t.place, t.building === 'house' ? 'house' : null); }
function addrFromTags(t = {}) {
  const st = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' ');
  return [st, t['addr:city'] || t['addr:place']].filter(Boolean).join(', ');
}

// ---------- Categorie ----------
const CATS = [
  { id: 'food', e: 'Utensils', name: 'Ristoranti', q: 'nwr["amenity"="restaurant"]' },
  { id: 'cafe', e: 'Coffee', name: 'Bar e caffè', q: 'nwr["amenity"~"^(cafe|bar)$"]' },
  { id: 'night', e: 'Music', name: 'Locali', q: 'nwr["amenity"~"^(nightclub|pub)$"]' },
  { id: 'fuel', e: 'Fuel', name: 'Benzina', q: 'nwr["amenity"="fuel"]' },
  { id: 'ev', e: 'PlugZap', name: 'Ricarica', q: 'nwr["amenity"="charging_station"]' },
  { id: 'parking', e: 'SquareParking', name: 'Parcheggi', q: 'nwr["amenity"="parking"]["access"!~"^(private|no|customers)$"]' },
  { id: 'super', e: 'ShoppingCart', name: 'Supermercati', q: 'nwr["shop"~"^(supermarket|convenience)$"]' },
  { id: 'pharma', e: 'Pill', name: 'Farmacie', q: 'nwr["amenity"="pharmacy"]' },
  { id: 'atm', e: 'Banknote', name: 'Bancomat', q: 'nwr["amenity"="atm"]' },
  { id: 'hotel', e: 'BedDouble', name: 'Hotel', q: 'nwr["tourism"~"^(hotel|guest_house|hostel)$"]' },
  { id: 'station', e: 'TrainFront', name: 'Stazioni', q: 'nwr["railway"~"^(station|halt)$"]' }
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
  const searching = view === 'search';
  $('searchBar').classList.toggle('hidden', view !== 'home' && !searching);
  $('sCancel').classList.toggle('hidden', !searching);
  $('btnSettings').classList.toggle('hidden', searching);
  if (!searching && document.activeElement === $('q')) $('q').blur();
  if (view === 'home') { $('q').value = ''; $('qClear').classList.add('hidden'); }
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
document.querySelectorAll('.view-head, #searchBar').forEach(el => el.classList.add('drag-zone'));
$('sCancel').onclick = back;
$('q').addEventListener('keydown', e => { if (e.key === 'ArrowDown') { const v = document.querySelector('#sResults .animated-list__viewport'); if (v) { e.preventDefault(); v.focus(); } } });

// ---------- Home ----------
function renderHome() {
  $('cats').innerHTML = CATS.map(c => `<button class="chip" data-cat="${c.id}">${ic(c.e, 16)}${c.name}</button>`).join('');
  $('cats').querySelectorAll('[data-cat]').forEach(b => b.onclick = () => searchCategory(CATS.find(c => c.id === b.dataset.cat)));
  const fv = $('homeFavs'), items = [];
  [['casa', 'House', 'Casa'], ['lavoro', 'BriefcaseBusiness', 'Lavoro']].forEach(([t, e, n]) => {
    const f = favs.find(x => x.type === t);
    items.push(`<div class="fav ${f ? 'set' : ''}" data-fav="${t}"><div class="ic">${ic(e, 22)}</div><span>${n}</span><small>${f ? esc(etaLabel(f.p)) : 'Aggiungi'}</small></div>`);
  });
  favs.filter(f => f.type === 'fav').forEach((f, i) => items.push(`<div class="fav set" data-fi="${i}"><div class="ic">${ic('Star', 22)}</div><span>${esc(f.name)}</span><small>${esc(etaLabel(f.p))}</small></div>`));
  items.push(`<div class="fav" data-add="1"><div class="ic">${ic('Plus', 22)}</div><span>Aggiungi</span></div>`);
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
  const d = me.p ? fmtDist(dist(me.p, r.p)) : '';
  return `<div class="row" data-${key}="${i}"><div class="ic">${ic(r.kind || 'Clock')}</div><div class="tx"><b>${esc(r.name)}</b><small>${esc(r.sub || '')}</small></div><div class="side">${d}</div></div>`;
}
function addRecent(pl) {
  recents = [{ p: pl.p, name: pl.name, sub: pl.sub || '', kind: pl.kind || 'MapPin', osm: pl.osm || null }, ...recents.filter(r => !(r.name === pl.name && dist(r.p, pl.p) < 30))].slice(0, 12);
  store.set('yz-recents', recents);
}

// ---------- Ricerca ----------
let searchT, searchSeq = 0;
// Tocchi la barra in Home: si passa alla ricerca tenendo la stessa casella (la tastiera resta aperta)
$('q').addEventListener('focus', () => {
  if (S.view === 'home') { show('search', { sheet: 'full' }); $('qHint').classList.add('hidden'); renderSearchSuggestions(); }
  else if (S.view === 'search') setSheet('full');
});
function openSearch(hint) {
  show('search', { sheet: 'full' });
  $('q').value = ''; $('qClear').classList.add('hidden');
  $('qHint').textContent = hint || ''; $('qHint').classList.toggle('hidden', !hint);
  renderSearchSuggestions();
  $('q').focus();
}
function startPick(target) {
  S.pick = target;
  const hints = { from: 'Scegli il punto di partenza', to: 'Scegli la destinazione', casa: "Cerca l'indirizzo di Casa", lavoro: "Cerca l'indirizzo di Lavoro", fav: 'Cerca il luogo da aggiungere ai preferiti' };
  openSearch(hints[target]);
}
// La lista dei risultati è disegnata dal modulo React (search-ui.js); qui si prepara solo il contenuto
let lastModel = null;
function renderSearch(model) {
  lastModel = model;
  if (window.YZSearch) { window.YZSearch.render(model); return; }
  // riserva semplice se il modulo non è ancora pronto
  const rows = model.sections.flatMap(sec => sec.items).map((it, i) => `<div class="row" data-k="${i}"><div class="tx"><b>${esc(it.title)}</b><small>${esc(it.description || '')}</small></div><div class="side">${esc(it.meta || '')}</div></div>`);
  $('sResults').innerHTML = (model.loading ? '<div class="empty-note">Cerco…</div>' : '') + rows.join('') + (model.empty ? `<div class="empty-note">${esc(model.empty.title)}</div>` : '');
  const all = model.sections.flatMap(sec => sec.items);
  $('sResults').querySelectorAll('[data-k]').forEach(el => el.onclick = () => all[+el.dataset.k].onSelect());
}
const distMeta = p => me.p ? fmtDist(dist(me.p, p)) : '';
const placeItem = (p, extra = {}) => ({ id: placeKey(p), icon: p.kind || 'MapPin', title: p.name, description: p.sub || '', meta: distMeta(p.p), highlight: true, onSelect: () => choose(p), ...extra });
const catItem = (c, desc) => ({ id: 'cat-' + c.id, icon: c.e, title: c.name, description: desc, accent: true, action: true, onSelect: () => searchCategory(c) });
function pickHint() {
  return { from: 'Scegli il punto di partenza', to: 'Scegli la destinazione', casa: "Cerca l'indirizzo di Casa", lavoro: "Cerca l'indirizzo di Lavoro", fav: 'Cerca il luogo da aggiungere ai preferiti' }[S.pick] || '';
}
function renderSearchSuggestions() {
  const sections = [];
  if (S.pick === 'from' || S.pick === 'to') sections.push({ title: 'Posizione', items: [{ id: 'me', icon: 'LocateFixed', accent: true, title: 'La mia posizione', description: me.p ? 'Usa la posizione attuale' : 'Consenti la posizione nel browser',
    onSelect: () => { if (!me.p) { locateMe(); toast('Attendo la tua posizione…'); return; } choose({ p: me.p, name: 'La mia posizione', me: true }); } }] });
  if (!S.pick) sections.push({ title: 'Cerca qui intorno', items: CATS.slice(0, 6).map(c => catItem(c, 'Vicino a te')) });
  sections.push({ title: 'Recenti', items: recents.map(r => ({ ...placeItem(r), icon: 'Clock', highlight: false })) });
  renderSearch({ query: '', hint: pickHint(), sections, empty: !recents.length && S.pick && S.pick !== 'from' && S.pick !== 'to' ? { icon: 'Search', title: 'Cerca una via, un indirizzo o un posto', text: 'Ad esempio "Corso Buenos Aires 12" o "Stazione Centrale"' } : null });
}
function bindResultRows() {}
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
  clearTimeout(searchT); searchT = setTimeout(() => runSearch(v), 220);
});
$('q').addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  e.preventDefault(); clearTimeout(searchT);
  runSearch(e.target.value, { submit: true }).then(() => { $('q').blur(); setSheet('half'); });
});
$('qClear').onclick = () => { $('q').value = ''; $('qClear').classList.add('hidden'); renderSearchSuggestions(); $('q').focus(); };

function photonPlace(f) {
  const pr = f.properties, [e, label] = kindOf(pr.osm_value, pr.type);
  const street = [pr.street, pr.housenumber].filter(Boolean).join(' ');
  const name = pr.name || street || pr.city || 'Luogo';
  const sub = [label !== 'Luogo' && label !== 'Indirizzo' ? label : '', pr.name ? street : '', pr.city || pr.county || pr.state, pr.country && !/^Itali/.test(pr.country) ? pr.country : ''].filter(Boolean).join(' · ');
  return { p: f.geometry.coordinates, name, sub, kind: e, osm: pr.osm_id ? { type: { N: 'node', W: 'way', R: 'relation' }[pr.osm_type], id: pr.osm_id } : null };
}
// Abbreviazioni italiane comuni negli indirizzi
const ABBR = [[/^v\.?le\b\.?/i, 'Viale'], [/^c\.?so\b\.?/i, 'Corso'], [/^p\.?zz?a\b\.?/i, 'Piazza'], [/^p\.?le\b\.?/i, 'Piazzale'], [/^l\.?go\b\.?/i, 'Largo'], [/^v\.\s*/i, 'Via '], [/^v\s+/i, 'Via ']];
function normQuery(t) {
  t = t.trim().replace(/\s+/g, ' ');
  for (const [re, rp] of ABBR) if (re.test(t)) { t = t.replace(re, rp + ' ').replace(/\s+/g, ' ').trim(); break; }
  return t;
}
// Parole che suggeriscono la ricerca per categoria
const CAT_WORDS = { food: /ristorant|mangiar|pizzeri|trattori|osteri|sushi/i, cafe: /\bbar\b|caff|colazion/i, night: /discotec|locali\b|club|\bpub\b/i, fuel: /benzin|carburant|distribut|diesel|gasolio/i,
  ev: /ricaric|colonnin|tesla|supercharg/i, parking: /parcheg|posteggi/i, super: /supermerc|spesa|alimentar/i, pharma: /farmaci/i, atm: /bancomat|\batm\b|prelev/i, hotel: /hotel|albergo|b&b|dormire/i, station: /stazion|treno/i };
function placeKey(p) { return p.osm ? p.osm.type + p.osm.id : p.name + p.p.map(v => v.toFixed(4)).join(); }

async function photonSearch(q, bias, bbox) {
  let u = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lang=it&limit=10&lat=${bias[1]}&lon=${bias[0]}`;
  if (bbox) u += `&bbox=${bbox.join(',')}`;
  const r = await getJSON(u, {}, 8000);
  return (r.features || []).map(photonPlace);
}
// Riserva quando Photon non trova niente (solo premendo Cerca, come chiede Nominatim)
async function nominatimSearch(q, bias) {
  const vb = [bias[0] - 0.6, bias[1] + 0.4, bias[0] + 0.6, bias[1] - 0.4].join(',');
  const r = await getJSON(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8&accept-language=it&viewbox=${vb}&q=${encodeURIComponent(q)}`, {}, 10000);
  return r.map(x => {
    const a = x.address || {}, street = [a.road || a.pedestrian, a.house_number].filter(Boolean).join(' ');
    const [e, label] = kindOf(x.type, x.addresstype);
    const name = x.name || street || x.display_name.split(',')[0];
    return { p: [+x.lon, +x.lat], name, sub: [label !== 'Luogo' ? label : '', x.name ? street : '', a.city || a.town || a.village].filter(Boolean).join(' · '), kind: e, osm: { type: x.osm_type, id: x.osm_id } };
  });
}
async function runSearch(text, { submit = false } = {}) {
  const seq = ++searchSeq, raw = text.trim();
  if (raw.length < 2) { lastModel = null; renderSearchSuggestions(); return; }
  const cm = raw.match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,; ]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (cm) { S.results = [{ p: [+cm[2], +cm[1]], name: `${cm[1]}, ${cm[2]}`, sub: 'Coordinate', kind: 'Crosshair' }]; renderSearch({ query: '', hint: pickHint(), sections: [{ title: 'Coordinate', items: S.results.map(p => placeItem(p, { highlight: false })) }] }); return; }
  const q = normQuery(raw);
  const sugg = Object.entries(CAT_WORDS).filter(([, re]) => re.test(raw)).slice(0, 2).map(([id]) => catItem(CATS.find(x => x.id === id), 'Mostra sulla mappa qui intorno'));
  const sec = items => [{ title: 'Suggerimenti', key: 'sugg', items: sugg }, { title: 'Risultati', key: 'res', items }];
  const prevRes = lastModel && lastModel.query ? (lastModel.sections.find(x => x.key === 'res') || { items: [] }).items : [];
  renderSearch({ query: raw, hint: pickHint(), sections: sec(prevRes), loading: !prevRes.length });
  const c = map.getCenter(), bias = me.p || [c.lng, c.lat];
  const local = [bias[0] - 0.35, bias[1] - 0.25, bias[0] + 0.35, bias[1] + 0.25]; // circa 50 km attorno a te
  const [near, all] = await Promise.allSettled([photonSearch(q, bias, local), photonSearch(q, bias)]);
  if (seq !== searchSeq) return;
  // prima i risultati della tua zona, poi il resto d'Italia e del mondo
  const seen = new Set(), list = [];
  for (const r of [near, all]) if (r.status === 'fulfilled') for (const p of r.value) { const k = placeKey(p); if (!seen.has(k)) { seen.add(k); list.push(p); } }
  let res = list;
  if (!res.length && submit) { try { res = await nominatimSearch(q, bias); } catch (e) {} if (seq !== searchSeq) return; }
  S.results = res.slice(0, 15);
  if (!S.results.length) {
    const failed = near.status === 'rejected' && all.status === 'rejected';
    renderSearch({ query: raw, hint: pickHint(), sections: sec([]), empty: failed
      ? { icon: 'WifiOff', title: 'Ricerca non disponibile', text: 'Controlla la connessione e riprova.' }
      : { icon: 'SearchX', title: 'Nessun risultato', text: submit ? 'Prova ad aggiungere la città, ad esempio "Via Roma 10, Torino".' : 'Premi Cerca sulla tastiera per una ricerca più ampia.' } });
    return;
  }
  renderSearch({ query: raw, hint: pickHint(), sections: sec(S.results.map(p => placeItem(p))) });
}

async function searchCategory(cat) {
  if (!cat) return;
  if (S.view !== 'search') show('search', { sheet: 'half' }); else setSheet('half');
  $('q').value = cat.name; $('qClear').classList.remove('hidden'); $('qHint').classList.add('hidden'); $('q').blur();
  renderSearch({ query: '', sections: [], loading: true });
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
    if (!S.results.length) { renderSearch({ query: '', sections: [], empty: { icon: cat.e, title: `Nessun risultato per ${cat.name.toLowerCase()} qui`, text: 'Sposta o allarga la mappa e riprova.' } }); map.getSource('results').setData(emptyFC); return; }
    renderSearch({ query: '', sections: [{ title: `${cat.name} · ${S.results.length}`, key: 'cat-' + cat.id, items: S.results.map(p => placeItem(p, { highlight: false })) }] });
    showResultsOnMap(S.results);
  } catch (e) { if (seq === searchSeq) renderSearch({ query: '', sections: [], empty: { icon: 'WifiOff', title: 'Ricerca non disponibile', text: 'Riprova tra poco.' } }); }
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
function updateSaveBtn() { const on = !!(S.place && isSaved(S.place)); $('pSave').classList.toggle('on', on); $('pSave').querySelector('span').innerHTML = ic('Star', 19) || (on ? '★' : '☆'); }
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
  const p = [lngLat.lng, lngLat.lat], pl = { p, name: 'Punto selezionato', sub: '', kind: 'MapPin', dropped: true };
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
