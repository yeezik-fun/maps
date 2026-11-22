// ================= Calcolo dei percorsi =================
'use strict';

// Auto, a piedi e in bici: server OSRM della FOSSGIS (dati OpenStreetMap)
const OSRM = {
  car: ['https://routing.openstreetmap.de/routed-car/route/v1/driving/', 'https://router.project-osrm.org/route/v1/driving/'],
  foot: ['https://routing.openstreetmap.de/routed-foot/route/v1/driving/'],
  bike: ['https://routing.openstreetmap.de/routed-bike/route/v1/driving/']
};
const MODE_INFO = {
  car: { name: 'Auto', icon: '🚗' },
  foot: { name: 'A piedi', icon: '🚶' },
  bike: { name: 'Bici', icon: '🚲' },
  transit: { name: 'Mezzi', icon: '🚇' }
};

async function fetchRoutes(mode, from, to, alternatives = true) {
  const pts = `${from[0].toFixed(6)},${from[1].toFixed(6)};${to[0].toFixed(6)},${to[1].toFixed(6)}`;
  const q = `?overview=full&geometries=geojson&steps=true${alternatives ? '&alternatives=' + (mode === 'car' ? 3 : 'true') : ''}`;
  let lastErr;
  for (const base of OSRM[mode]) {
    let r = null;
    try {
      if (mode === 'car') { try { r = await getJSON(base + pts + q + '&annotations=maxspeed'); } catch (e) { r = null; } }
      if (!r || r.code !== 'Ok') r = await getJSON(base + pts + q);
      if (r && r.code === 'Ok' && r.routes.length) return r.routes.map(rt => toRouteData(rt, mode));
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('nessun percorso');
}
function toRouteData(rt, mode) {
  const leg = rt.legs[0], ms = (leg.annotation && leg.annotation.maxspeed) || [];
  // "via": la strada su cui si fa più strada
  const byName = {};
  leg.steps.forEach(s => { if (s.name) byName[s.name] = (byName[s.name] || 0) + s.distance; });
  const via = Object.entries(byName).sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => x[0]);
  return {
    mode, coords: rt.geometry.coordinates, steps: leg.steps, duration: rt.duration, distance: rt.distance, via,
    maxspeed: ms.map(m => (m && m.speed) ? (m.unit === 'mph' ? Math.round(m.speed * 1.609) : m.speed) : null)
  };
}

// Mezzi pubblici: Transitous (MOTIS), dati GTFS delle aziende di trasporto
const TRANSIT_API = 'https://api.transitous.org/api/';
const TMODE = {
  WALK: { label: 'A piedi', e: '🚶', c: '#ffffff' }, BUS: { label: 'Bus', e: '🚌', c: '#2f80ed' }, COACH: { label: 'Pullman', e: '🚌', c: '#2d9cdb' },
  TRAM: { label: 'Tram', e: '🚋', c: '#f2994a' }, SUBWAY: { label: 'Metro', e: '🚇', c: '#e5222a' }, METRO: { label: 'Metro', e: '🚇', c: '#e5222a' },
  SUBURBAN: { label: 'Suburbano', e: '🚆', c: '#27ae60' }, RAIL: { label: 'Treno', e: '🚆', c: '#27ae60' }, REGIONAL_RAIL: { label: 'Regionale', e: '🚆', c: '#27ae60' },
  REGIONAL_FAST_RAIL: { label: 'Regionale veloce', e: '🚆', c: '#219653' }, HIGHSPEED_RAIL: { label: 'Alta velocità', e: '🚄', c: '#b0244a' }, LONG_DISTANCE: { label: 'Intercity', e: '🚆', c: '#1e7a46' },
  NIGHT_RAIL: { label: 'Treno notte', e: '🚆', c: '#4b3fa8' }, FERRY: { label: 'Traghetto', e: '⛴️', c: '#56ccf2' }, AIRPLANE: { label: 'Aereo', e: '✈️', c: '#9b51e0' },
  FUNICULAR: { label: 'Funicolare', e: '🚞', c: '#bb6bd9' }, AERIAL_LIFT: { label: 'Funivia', e: '🚡', c: '#bb6bd9' }, AREAL_LIFT: { label: 'Funivia', e: '🚡', c: '#bb6bd9' }, CABLE_CAR: { label: 'Funivia', e: '🚡', c: '#bb6bd9' },
  BIKE: { label: 'Bici', e: '🚲', c: '#ffffff' }, RENTAL: { label: 'Mezzo in sharing', e: '🛴', c: '#ffffff' }, CAR: { label: 'Auto', e: '🚗', c: '#ffffff' }, OTHER: { label: 'Mezzo', e: '🚍', c: '#888888' }
};
const hexColor = (c, d) => { if (!c) return d; c = String(c).replace('#', ''); return /^[0-9a-f]{6}$/i.test(c) ? '#' + c : d; };

async function fetchTransit(from, to, tt) {
  const p = new URLSearchParams({ fromPlace: `${from[1].toFixed(6)},${from[0].toFixed(6)}`, toPlace: `${to[1].toFixed(6)},${to[0].toFixed(6)}`, detailedTransfers: 'true', language: 'it' });
  if (tt && tt.type !== 'now' && tt.value) { p.set('time', new Date(tt.value).toISOString()); if (tt.type === 'arr') p.set('arriveBy', 'true'); }
  let lastErr;
  for (const v of ['v5', 'v4', 'v3', 'v2']) {
    try {
      const r = await getJSON(`${TRANSIT_API}${v}/plan?${p}`, {}, 25000);
      return parseTransit(r, v);
    } catch (e) { lastErr = e; if (e.status && e.status !== 404 && e.status !== 400) break; }
  }
  throw lastErr || new Error('mezzi non disponibili');
}
function parseTransit(r, v) {
  const conv = it => {
    const legs = (it.legs || []).map(l => {
      const m = TMODE[l.mode] || TMODE.OTHER, walk = l.mode === 'WALK';
      const g = l.legGeometry || {};
      const coords = g.points ? decodePolyline(g.points, g.precision || (v === 'v1' ? 7 : 6)) : [[l.from.lon, l.from.lat], [l.to.lon, l.to.lat]];
      const delay = l.scheduledStartTime ? Math.round((new Date(l.startTime) - new Date(l.scheduledStartTime)) / 60000) : 0;
      return {
        mode: l.mode, walk, label: m.label, e: m.e,
        color: walk ? '#ffffff' : hexColor(l.routeColor, m.c), text: hexColor(l.routeTextColor, '#ffffff'),
        name: l.displayName || l.routeShortName || m.label, long: l.routeLongName || '', headsign: l.headsign || (l.tripTo && l.tripTo.name) || '',
        agency: l.agencyName || '', start: new Date(l.startTime), end: new Date(l.endTime), delay, realTime: !!l.realTime,
        from: { name: l.from.name, p: [l.from.lon, l.from.lat], track: l.from.track }, to: { name: l.to.name, p: [l.to.lon, l.to.lat], track: l.to.track },
        stops: (l.intermediateStops || []).length, duration: l.duration || (new Date(l.endTime) - new Date(l.startTime)) / 1000, distance: l.distance || 0, coords
      };
    });
    const walkDist = legs.filter(l => l.walk).reduce((a, l) => a + (l.distance || 0), 0);
    return { duration: it.duration, start: new Date(it.startTime), end: new Date(it.endTime), transfers: it.transfers || 0, legs, walkDist };
  };
  const its = (r.itineraries || []).map(conv).filter(i => i.legs.some(l => !l.walk));
  const direct = (r.direct || []).map(conv);
  return { itins: its, direct };
}
