// ================= Ricerca: lista animata (React Bits · AnimatedList) =================
// AnimatedList: React Bits di David Haz — https://reactbits.dev (licenza MIT + Commons Clause).
// Adattato: compilato con esbuild (React da esm.sh), icone Lucide.
import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as Lucide from 'lucide-react';
import { createElement as lucideEl, icons as lucideIcons } from 'lucide';


// ---------- Icone ----------
const Icon = ({ name, size = 18 }) => {
  const C = Lucide[name] || Lucide.MapPin;
  return <C size={size} strokeWidth={1.8} />;
};
// Per le parti dell'app scritte senza React: restituisce l'SVG come testo
function iconSVG(name, size = 18) {
  const node = lucideIcons[name] || lucideIcons.MapPin;
  const el = lucideEl(node);
  el.setAttribute('width', size); el.setAttribute('height', size); el.setAttribute('stroke-width', '1.8');
  return el.outerHTML;
}

// ---------- AnimatedList (React Bits) ----------
const HIDDEN = {
  pop: { above: 'translate3d(0, -12px, 0) scale(0.8)', below: 'translate3d(0, 12px, 0) scale(0.8)' },
  slide: { above: 'translate3d(0, -28px, 0) scale(0.98)', below: 'translate3d(0, 28px, 0) scale(0.98)' },
  fade: { above: 'translate3d(0, -4px, 0)', below: 'translate3d(0, 4px, 0)' }
};
const SPRING = 'linear(0, 0.0603, 0.2033, 0.3821, 0.5633, 0.7258, 0.8584, 0.9574, 1.0242, 1.0634, 1.0809, 1.0828, 1.0747, 1.0613, 1.046, 1.0313, 1.0186, 1.0085, 1.0012, 0.9965, 0.994, 0.9931, 0.9933, 0.9941, 0.9953, 0.9966, 0.9978, 0.9988, 1)';

function AnimatedList({
  items, onItemSelect, renderItem, initialSelectedIndex = -1, selectOnHover = true, enableArrowNavigation = true,
  loop = false, animation = 'slide', stagger = 0.035, radius = 14, gap = 6, accentColor, style
}) {
  const rootRef = useRef(null), viewportRef = useRef(null), trackRef = useRef(null), indicatorRef = useRef(null), ringRef = useRef(null);
  const itemRefs = useRef([]), engineRef = useRef(null), keyboardRef = useRef(false), navigatingRef = useRef(false);
  const [selected, setSelected] = useState(initialSelectedIndex);
  const baseId = useId();
  const settingsRef = useRef({});
  settingsRef.current = { items, onItemSelect, selected, selectOnHover, enableArrowNavigation, loop, animation, stagger };

  useLayoutEffect(() => {
    const root = rootRef.current, viewport = viewportRef.current, track = trackRef.current, indicator = indicatorRef.current, ring = ringRef.current;
    if (!root || !viewport || !track || !indicator || !ring) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const springEase = CSS.supports && CSS.supports('transition-timing-function', 'linear(0, 1)') ? SPRING : 'cubic-bezier(0.34, 1.4, 0.64, 1)';
    const transition = `transform 620ms ${springEase}, opacity 300ms cubic-bezier(0.22, 1, 0.36, 1), filter 200ms ease`;
    const motion = { y: 0, h: 0, vy: 0, vh: 0, ty: 0, th: 0, ready: false };
    let boxes = [], current = null, entered = false, engaged = false, pointer = [0, 0], raf = 0, last = 0;
    const mode = () => { const c = settingsRef.current.animation; if (c === 'none' || !HIDDEN[c]) return 'none'; return reduced ? 'fade' : c; };
    const apply = (el, state) => {
      el.dataset.state = state;
      const pose = current && current !== 'none' && state !== 'in' ? HIDDEN[current][state] : '';
      el.style.transform = pose; el.style.opacity = pose ? '0' : '';
    };
    const syncRing = () => {
      const item = itemRefs.current[settingsRef.current.selected]; if (!item) return;
      const state = item.dataset.state || 'in'; if (state === ring.dataset.state) return;
      ring.style.transitionDelay = item.style.transitionDelay; apply(ring, state);
    };
    const write = () => { indicator.style.transform = `translate3d(0, ${motion.y.toFixed(2)}px, 0)`; indicator.style.height = `${motion.h.toFixed(2)}px`; };
    const frame = now => {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
      const omega = 30, zeta = 0.78, steps = Math.max(1, Math.ceil(dt / (1 / 240))), h = dt / steps;
      for (let i = 0; i < steps; i++) {
        motion.vy += (omega * omega * (motion.ty - motion.y) - 2 * zeta * omega * motion.vy) * h;
        motion.vh += (omega * omega * (motion.th - motion.h) - 2 * zeta * omega * motion.vh) * h;
        motion.y += motion.vy * h; motion.h += motion.vh * h;
      }
      const moving = Math.abs(motion.ty - motion.y) > 0.05 || Math.abs(motion.th - motion.h) > 0.05 || Math.abs(motion.vy) + Math.abs(motion.vh) > 0.5;
      if (!moving) { motion.y = motion.ty; motion.h = motion.th; motion.vy = motion.vh = 0; }
      write();
      if (moving) raf = requestAnimationFrame(frame);
    };
    const place = snap => {
      const item = itemRefs.current[settingsRef.current.selected];
      if (!item) { indicator.style.opacity = '0'; motion.ready = false; return; }
      indicator.style.opacity = '1';
      motion.ty = item.offsetTop; motion.th = item.offsetHeight;
      if (snap || reduced || !motion.ready) { motion.y = motion.ty; motion.h = motion.th; motion.vy = motion.vh = 0; motion.ready = true; write(); return; }
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
    };
    const measure = () => { const off = track.offsetTop; boxes = itemRefs.current.map(it => it ? [off + it.offsetTop, it.offsetHeight] : null); };
    const reveal = entrance => {
      if (!entered) return;
      const s = settingsRef.current;
      let order = 0;
      itemRefs.current.forEach((item, index) => {
        if (!item || !boxes[index]) return;
        if (item.dataset.state === 'in') return;
        const delay = entrance ? (order++ * Math.max(0, s.stagger)).toFixed(3) : 0;
        item.style.transitionDelay = delay ? `${delay}s, ${delay}s, 0s` : '';
        apply(item, 'in');
      });
      syncRing();
    };
    const sync = () => {
      const s = settingsRef.current;
      itemRefs.current.length = s.items.length;
      const list = itemRefs.current.filter(Boolean), next = mode(), changed = next !== current;
      const restyle = changed ? list : list.filter(it => !it.dataset.state);
      current = next;
      if (current === 'none') entered = true;
      if (restyle.length) {
        const els = changed ? [...restyle, ring] : restyle;
        for (const el of els) el.style.transition = 'none';
        for (const it of restyle) apply(it, current === 'none' ? 'in' : it.dataset.state || 'below');
        if (changed) apply(ring, (itemRefs.current[s.selected] && itemRefs.current[s.selected].dataset.state) || 'in');
        void root.offsetHeight;
        for (const el of els) el.style.transition = transition;
      }
      measure(); reveal(restyle.length > 0);
    };
    sync();
    entered = true; measure(); reveal(true);
    const ro = new ResizeObserver(() => { place(true); measure(); });
    ro.observe(track);
    const onKey = e => {
      const s = settingsRef.current;
      if (!s.enableArrowNavigation || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const active = document.activeElement, focused = active === viewport;
      const idle = !active || active === document.body || active === document.documentElement;
      if (!focused && !(engaged && idle)) return;
      const count = s.items.length; if (!count) return;
      const index = s.selected; let next = null;
      if (e.key === 'ArrowDown') next = index < 0 ? 0 : index + 1;
      else if (e.key === 'ArrowUp') next = index < 0 ? count - 1 : index - 1;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = count - 1;
      else if ((e.key === 'Enter' || (focused && e.key === ' ')) && index >= 0 && index < count) { e.preventDefault(); s.onItemSelect && s.onItemSelect(s.items[index], index); return; }
      if (next === null) return;
      e.preventDefault();
      next = s.loop ? (next + count) % count : Math.min(count - 1, Math.max(0, next));
      keyboardRef.current = true; navigatingRef.current = true; setSelected(next);
    };
    const onPointerMove = e => {
      const moved = e.clientX !== pointer[0] || e.clientY !== pointer[1]; pointer = [e.clientX, e.clientY];
      if (!navigatingRef.current || !moved) return;
      navigatingRef.current = false;
      const it = e.target instanceof Element ? e.target.closest('[data-index]') : null;
      if (it && root.contains(it) && settingsRef.current.selectOnHover) setSelected(Number(it.dataset.index));
    };
    const onEnter = () => { engaged = true; }, onLeave = () => { engaged = false; };
    window.addEventListener('keydown', onKey);
    root.addEventListener('pointerenter', onEnter); root.addEventListener('pointerleave', onLeave); root.addEventListener('pointermove', onPointerMove);
    place(true); syncRing();
    engineRef.current = { place, syncRing, sync };
    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      window.removeEventListener('keydown', onKey);
      root.removeEventListener('pointerenter', onEnter); root.removeEventListener('pointerleave', onLeave); root.removeEventListener('pointermove', onPointerMove);
      engineRef.current = null;
    };
  }, []);
  useLayoutEffect(() => { engineRef.current && engineRef.current.sync(); }, [items, animation]);
  useEffect(() => {
    const engine = engineRef.current; if (!engine) return;
    engine.place(false); engine.syncRing();
    if (!keyboardRef.current) return;
    keyboardRef.current = false;
    const item = itemRefs.current[selected];
    if (item) item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selected]);
  // se la lista cambia, la selezione non deve restare su una riga che non esiste più
  useEffect(() => { if (selected >= items.length) setSelected(-1); }, [items.length]);

  const hover = i => { if (!navigatingRef.current) setSelected(i); };
  const choose = (item, i) => { setSelected(i); onItemSelect && onItemSelect(item, i); };
  return (
    <div ref={rootRef} className="animated-list" data-animated={animation !== 'none' ? '' : undefined}
      style={{ '--al-radius': radius + 'px', '--al-gap': gap + 'px', '--al-accent': accentColor || 'var(--al-ink)', ...(accentColor ? { '--al-ring': accentColor, '--al-ring-fill': `color-mix(in srgb, ${accentColor} 9%, transparent)` } : {}), ...style }}>
      <div ref={viewportRef} className="animated-list__viewport" role="listbox" tabIndex={0}
        aria-activedescendant={selected >= 0 && selected < items.length ? `${baseId}-${selected}` : undefined}>
        <div ref={trackRef} className="animated-list__track">
          {items.map((item, index) => {
            const isSel = index === selected;
            return (
              <div key={item.id ?? index} ref={el => { itemRefs.current[index] = el; }} id={`${baseId}-${index}`}
                className="animated-list__item" role="option" aria-selected={isSel} data-index={index} data-selected={isSel ? '' : undefined}
                onPointerEnter={selectOnHover ? () => hover(index) : undefined} onClick={() => choose(item, index)}>
                {renderItem(item, index, isSel)}
                <span className="animated-list__rim" aria-hidden="true" />
              </div>
            );
          })}
          <span ref={indicatorRef} className="animated-list__indicator" aria-hidden="true"><span ref={ringRef} className="animated-list__ring" /></span>
        </div>
      </div>
    </div>
  );
}

// ---------- Contenuto della ricerca ----------
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// Evidenzia la parte del nome che corrisponde a ciò che hai scritto
function Highlight({ text, query }) {
  const words = norm(query).split(/[\s,]+/).filter(w => w.length > 1);
  if (!words.length) return text;
  const n = norm(text), marks = new Array(text.length).fill(false);
  words.forEach(w => { let i = n.indexOf(w); while (i >= 0) { for (let k = i; k < i + w.length; k++) marks[k] = true; i = n.indexOf(w, i + w.length); } });
  const out = []; let buf = '', on = marks[0];
  for (let i = 0; i <= text.length; i++) {
    if (i === text.length || marks[i] !== on) { if (buf) out.push(on ? <mark key={i}>{buf}</mark> : buf); buf = ''; on = marks[i]; }
    if (i < text.length) buf += text[i];
  }
  return out;
}
function Row({ item, query }) {
  return (
    <>
      <span className={'animated-list__lead' + (item.accent ? ' accent' : '')}><Icon name={item.icon} /></span>
      <span className="animated-list__text">
        <span className="animated-list__title"><Highlight text={item.title} query={item.highlight ? query : ''} /></span>
        {item.description ? <span className="animated-list__description">{item.description}</span> : null}
      </span>
      {item.meta ? <span className="animated-list__meta">{item.meta}</span> : null}
      {item.action ? <span className="animated-list__go"><Icon name="ArrowUpRight" size={16} /></span> : null}
    </>
  );
}
function Skeleton() {
  return <div className="sr-skeleton">{[0, 1, 2, 3].map(i => <div key={i} className="sk-row" style={{ animationDelay: i * 0.08 + 's' }}><i /><span><b /><em /></span></div>)}</div>;
}
function SearchView({ model }) {
  if (!model) return null;
  const { query = '', sections = [], loading, empty, hint } = model;
  return (
    <div className="sr">
      {hint ? <div className="sr-hint">{hint}</div> : null}
      {sections.filter(s => s.items.length).map(sec => (
        <section key={sec.key || sec.title} className="sr-section">
          <h5>{sec.title}</h5>
          <AnimatedList key={sec.key || sec.title} items={sec.items} accentColor="#ff8ee0"
            onItemSelect={it => it.onSelect && it.onSelect()} renderItem={it => <Row item={it} query={query} />} />
        </section>
      ))}
      {loading ? <Skeleton /> : null}
      {!loading && empty ? (
        <div className="sr-empty"><span className="sr-empty-ic"><Icon name={empty.icon || 'SearchX'} size={22} /></span><b>{empty.title}</b>{empty.text ? <span>{empty.text}</span> : null}</div>
      ) : null}
    </div>
  );
}

const mount = document.getElementById('sResults');
mount.innerHTML = '';
const root = createRoot(mount);
window.YZIcon = iconSVG;
window.YZSearch = { render: model => root.render(<SearchView model={model} />) };
window.dispatchEvent(new Event('yz-ui-ready'));
