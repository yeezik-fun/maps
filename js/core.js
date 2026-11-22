// ================= Yeezik Maps — strumenti di base =================
'use strict';
const $ = id => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
const setText = (id, v) => { const el = $(id); if (el && el.textContent !== String(v)) el.textContent = v; };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let toastT;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), 2800); }
const emptyFC = { type: 'FeatureCollection', features: [] };
const isDesktop = () => window.matchMedia('(min-width: 900px)').matches;

// ---------- Geometria ----------
const R = 6371000, rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
function dist(a, b) {
  const dLat = rad(b[1] - a[1]), dLon = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function bearing(a, b) {
  const y = Math.sin(rad(b[0] - a[0])) * Math.cos(rad(b[1]));
  const x = Math.cos(rad(a[1])) * Math.sin(rad(b[1])) - Math.sin(rad(a[1])) * Math.cos(rad(b[1])) * Math.cos(rad(b[0] - a[0]));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}
function destPoint(p, brg, d) {
  const φ1 = rad(p[1]), λ1 = rad(p[0]), θ = rad(brg), δ = d / R;
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return [deg(λ2), deg(φ2)];
}
function inRing(p, ring) {
  let ins = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (((yi > p[1]) !== (yj > p[1])) && (p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi)) ins = !ins;
  }
  return ins;
}
// Polilinea codificata (Google) con precisione variabile
function decodePolyline(str, precision = 6) {
  const f = Math.pow(10, precision), out = [];
  let i = 0, lat = 0, lng = 0;
  while (i < str.length) {
    let b, s = 0, r = 0;
    do { b = str.charCodeAt(i++) - 63; r |= (b & 0x1f) << s; s += 5; } while (b >= 0x20);
    lat += (r & 1) ? ~(r >> 1) : (r >> 1);
    s = 0; r = 0;
    do { b = str.charCodeAt(i++) - 63; r |= (b & 0x1f) << s; s += 5; } while (b >= 0x20);
    lng += (r & 1) ? ~(r >> 1) : (r >> 1);
    out.push([lng / f, lat / f]);
  }
  return out;
}
function bboxOf(coords) {
  const b = new maplibregl.LngLatBounds();
  coords.forEach(c => b.extend(c));
  return b;
}

// ---------- Formati ----------
function fmtDist(m) { return m >= 1000 ? (m / 1000).toFixed(m < 10000 ? 1 : 0).replace('.', ',') + ' km' : (Math.round(m / 10) * 10) + ' m'; }
const fmtTime = d => d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
function fmtDur(sec) {
  const m = Math.max(1, Math.round(sec / 60));
  if (m < 60) return m + ' min';
  const h = Math.floor(m / 60), r = m % 60;
  return h + ' h' + (r ? ' ' + r + ' min' : '');
}

// ---------- Alba e tramonto (per giorno/notte automatico) ----------
function sunTimes(date, lat, lng) {
  const dayMs = 864e5, J1970 = 2440588, J2000 = 2451545, e = rad(23.4397), J0 = 0.0009;
  const toDays = d => d.valueOf() / dayMs - 0.5 + J1970 - J2000;
  const fromJ = j => new Date((j + 0.5 - J1970) * dayMs);
  const lw = rad(-lng), phi = rad(lat), d = toDays(date);
  const n = Math.round(d - J0 - lw / (2 * Math.PI));
  const ds = J0 + lw / (2 * Math.PI) + n;
  const M = rad(357.5291 + 0.98560028 * ds);
  const C = rad(1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + rad(102.9372) + Math.PI;
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const Jnoon = J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
  const w = Math.acos((Math.sin(rad(-0.833)) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)));
  const a = J0 + (w + lw) / (2 * Math.PI) + n;
  const Jset = J2000 + a + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
  return { rise: fromJ(Jnoon - (Jset - Jnoon)), set: fromJ(Jset) };
}

// ---------- Rete ----------
async function getJSON(url, opts = {}, timeoutMs = 15000) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...opts, signal: ctl.signal });
    if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
    return await r.json();
  } finally { clearTimeout(t); }
}
const OVERPASS = 'https://overpass-api.de/api/interpreter';
function overpass(q, timeoutMs = 25000) {
  return getJSON(OVERPASS, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, timeoutMs);
}
