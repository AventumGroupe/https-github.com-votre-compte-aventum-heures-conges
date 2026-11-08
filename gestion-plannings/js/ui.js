// Composants d'interface partagés : fenêtres, notifications, sélecteurs, pastilles.

import { esc, icon, fmt, cap, parse, sameDay, addDays } from './util.js';
import { db, ENERGY, LEVELS, RES_TYPES } from './store.js';

// ---------- Messages éphémères ----------
export function toast(msg, { action, timeout = 3800, tone = '' } = {}) {
  let host = document.getElementById('toasts');
  if (!host) { host = document.createElement('div'); host.id = 'toasts'; document.body.appendChild(host); }
  const t = document.createElement('div');
  t.className = `toast ${tone}`;
  t.setAttribute('role', 'status');
  t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button class="btn ghost sm">${esc(action.label)}</button>` : ''}`;
  if (action) t.querySelector('button').onclick = () => { action.run(); t.remove(); };
  host.appendChild(t);
  setTimeout(() => t.classList.add('out'), timeout);
  setTimeout(() => t.remove(), timeout + 400);
}

// ---------- Fenêtres ----------
export function openDialog({ title, body, footer = '', onMount, wide = false, onClose }) {
  const d = document.createElement('dialog');
  d.className = `sheet${wide ? ' wide' : ''}`;
  d.innerHTML = `
    <form method="dialog" class="sheet-inner" novalidate>
      <header class="sheet-head">
        <h2>${esc(title)}</h2>
        <button type="button" class="icon-btn" data-close aria-label="Fermer">${icon('close')}</button>
      </header>
      <div class="sheet-body">${body}</div>
      ${footer ? `<footer class="sheet-foot">${footer}</footer>` : ''}
    </form>`;
  document.body.appendChild(d);
  const close = () => { d.close(); };
  d.addEventListener('close', () => { d.remove(); onClose?.(); });
  d.addEventListener('click', (e) => {
    if (e.target === d) close();
    if (e.target.closest('[data-close]')) close();
  });
  d.querySelector('form').addEventListener('submit', (e) => e.preventDefault());
  d.showModal();
  onMount?.(d, close);
  return { el: d, close };
}

export function confirmDialog(text, { ok = 'Supprimer', danger = true } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const { el, close } = openDialog({
      title: 'Confirmation',
      body: `<p>${esc(text)}</p>`,
      footer: `<button type="button" class="btn ghost" data-close>Annuler</button><button type="button" class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(ok)}</button>`,
      onClose: () => { if (!done) resolve(false); },
    });
    el.querySelector('[data-ok]').onclick = () => { done = true; resolve(true); close(); };
  });
}

// ---------- Sélecteur segmenté ----------
export function seg(name, options, value, extra = '') {
  return `<div class="seg ${extra}" role="radiogroup" data-seg="${name}">${options.map((o) => `
    <button type="button" role="radio" class="seg-opt${String(o.v) === String(value) ? ' on' : ''}" data-v="${o.v}"
      aria-checked="${String(o.v) === String(value)}" title="${esc(o.title || o.sub || '')}" ${o.style ? `style="${o.style}"` : ''}>
      <b>${esc(o.label)}</b>${o.sub ? `<small>${esc(o.sub)}</small>` : ''}
    </button>`).join('')}</div>`;
}
/** Branche les sélecteurs segmentés : onPick(name, value). */
export function bindSeg(root, onPick) {
  root.addEventListener('click', (e) => {
    const b = e.target.closest('.seg-opt');
    if (!b) return;
    const g = b.closest('[data-seg]');
    g.querySelectorAll('.seg-opt').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); });
    onPick(g.dataset.seg, b.dataset.v);
  });
}

export const levelOptions = (short = false) =>
  [1, 2, 3, 4, 5].map((v) => ({ v, label: String(v), sub: short ? '' : LEVELS[v], title: LEVELS[v] }));
export const energyOptions = (short = false) =>
  [1, 2, 3, 4].map((v) => ({ v, label: short ? String(v) : ENERGY[v].label, sub: short ? '' : String(v), title: `${ENERGY[v].label} — ${ENERGY[v].hint}`, style: `--c: var(--e${v})` }));

// ---------- Pastilles ----------
export const energyChip = (e, withLabel = true) =>
  `<span class="chip energy e${e}" title="Énergie : ${ENERGY[e].label}">${icon('sun', 13)}${withLabel ? ENERGY[e].label : e}</span>`;

export const levelChip = (kind, n) =>
  `<span class="lvl lvl${n}" title="${kind === 'U' ? 'Urgence' : 'Importance'} : ${n}/5 (${LEVELS[n]})"><i>${kind}</i>${n}</span>`;

export function projectChip(p) {
  if (!p) return '';
  return `<span class="chip project" style="--pc:${esc(p.color)}"><i></i>${esc(p.name)}</span>`;
}

export function resourceChip(r, qty) {
  if (!r) return '';
  const u = RES_TYPES[r.type]?.unit || '';
  return `<span class="chip res t-${r.type}" title="${esc(RES_TYPES[r.type]?.label || '')}">${esc(r.name)}${qty ? ` · ${esc(qty)}${u ? ' ' + u : ''}` : ''}</span>`;
}

export function whenLabel(t) {
  if (!t.start) return '';
  const s = parse(t.start);
  const today = new Date();
  const dayTxt = sameDay(s, today) ? 'Aujourd’hui' : sameDay(s, addDays(today, 1)) ? 'Demain' : cap(fmt.dayShort.format(s));
  if (t.allDay) {
    const e = parse(t.end || t.start);
    return sameDay(s, e) ? dayTxt : `${dayTxt} → ${fmt.dateShort.format(e)}`;
  }
  return `${dayTxt} ${fmt.time.format(s)}`;
}

export function dueLabel(t) {
  if (!t.due) return '';
  const d = parse(t.due);
  const n = Math.round((d - new Date(new Date().toDateString())) / 864e5);
  if (n < 0) return `Échue depuis ${-n} j`;
  if (n === 0) return 'Échéance aujourd’hui';
  if (n === 1) return 'Échéance demain';
  return `Échéance ${fmt.dateShort.format(d)}`;
}

export const resName = (id) => db.resources[id]?.name || '';
