// Écran principal : la liste des tâches, la saisie rapide et les propositions.

import { db, tasks, projects, newTask, putTask, removeTask, save, local, score, quadrant, QUADRANTS, ENERGY, people } from './store.js';
import { analyze, completeTask, propagate } from './sched.js';
import { suggestions, dismiss } from './suggest.js';
import { openTaskEditor } from './editor.js';
import { slider, bindSliders, info, LV, EN, energyChip, levelChip, projectChip, whenLabel, dueLabel, toast } from './ui.js';
import { esc, icon, toDateStr } from './util.js';

const F = Object.assign({ status: 'open', project: '', energy: '', q: '', sort: 'score', mode: 'list', sugg: true }, local.get('listFilters', {}));
const Q = Object.assign({ urgency: 3, importance: 3, energy: 3 }, local.get('quick', {}));
const activeFilters = () => [F.project, F.energy, F.sort !== 'score' ? 1 : ''].filter(Boolean).length;
const persist = () => { local.set('listFilters', F); local.set('quick', Q); };

function filtered() {
  const q = F.q.trim().toLowerCase();
  return tasks().filter((t) => {
    if (F.status === 'open' && t.status === 'done') return false;
    if (F.status === 'doing' && t.status !== 'doing') return false;
    if (F.status === 'done' && t.status !== 'done') return false;
    if (F.project === '_none' && t.projectId) return false;
    if (F.project && F.project !== '_none' && t.projectId !== F.project) return false;
    if (F.energy === 'low' && t.energy > 2) return false;
    if (F.energy === 'high' && t.energy < 3) return false;
    if (/^[1-4]$/.test(F.energy) && t.energy !== Number(F.energy)) return false;
    if (q && !(`${t.title} ${t.notes}`.toLowerCase().includes(q))) return false;
    return true;
  });
}

function sorted(list) {
  const by = {
    score: (a, b) => score(b) - score(a) || (a.due || '9').localeCompare(b.due || '9') || a.energy - b.energy,
    due: (a, b) => (a.due || '9999').localeCompare(b.due || '9999') || score(b) - score(a),
    start: (a, b) => (a.start || '9999').localeCompare(b.start || '9999') || score(b) - score(a),
    energy: (a, b) => a.energy - b.energy || score(b) - score(a),
    created: (a, b) => b.createdAt - a.createdAt,
  }[F.sort];
  return list.sort((a, b) => (a.status === 'done') - (b.status === 'done') || by(a, b));
}

function row(t, an) {
  const a = an[t.id] || {};
  const p = db.projects[t.projectId];
  const del = t.delegate && db.resources[t.delegate];
  const subDone = t.subtasks.filter((s) => s.done).length;
  const flags = [];
  if (a.late) flags.push(`<span class="badge danger" title="Finira après l’échéance">${icon('alert', 13)} Critique</span>`);
  else if (a.critical) flags.push(`<span class="badge warn" title="Sur le chemin critique : aucune marge">Chemin critique</span>`);
  if (t.slips) flags.push(`<span class="badge muted" title="Reportée automatiquement">Reportée ×${t.slips}</span>`);
  return `
    <li class="task-row q-${quadrant(t)} ${t.status === 'done' ? 'done' : ''} ${a.late ? 'is-late' : ''}" data-id="${t.id}">
      <button class="check ${t.status}" data-check aria-label="${t.status === 'done' ? 'Marquer à faire' : 'Marquer comme faite'}">${icon('check', 16)}</button>
      <div class="tr-main" data-open>
        <div class="tr-title">${esc(t.title)}${t.status === 'doing' ? ' <span class="badge accent">En cours</span>' : ''}</div>
        <div class="tr-meta">
          ${levelChip('U', t.urgency)}${levelChip('I', t.importance)}${energyChip(t.energy)}
          ${projectChip(p)}
          ${t.start ? `<span class="meta">${icon('calendar', 13)} ${esc(whenLabel(t))}</span>` : ''}
          ${t.due ? `<span class="meta ${t.due < toDateStr(new Date()) && t.status !== 'done' ? 'danger-text' : ''}">${esc(dueLabel(t))}</span>` : ''}
          ${t.subtasks.length ? `<span class="meta">${icon('check', 13)} ${subDone}/${t.subtasks.length}</span>` : ''}
          ${del ? `<span class="meta">${icon('user', 13)} ${esc(del.name)}</span>` : ''}
          ${t.recur ? `<span class="meta" title="Récurrente">${icon('repeat', 13)}</span>` : ''}
          ${t.preds.length ? `<span class="meta" title="A des prédécesseurs">${icon('link', 13)} ${t.preds.length}</span>` : ''}
          ${flags.join('')}
        </div>
      </div>
      <div class="tr-score" title="Score de priorité = importance × 2 + urgence">${score(t)}</div>
    </li>`;
}

function suggestionsHtml(an) {
  const list = suggestions(an);
  if (!list.length) return '';
  return `
    <section class="card suggest ${F.sugg ? 'open' : ''}">
      <div class="suggest-head">
        <button class="suggest-toggle" data-toggle-sugg aria-expanded="${F.sugg}">
          ${icon('bulb', 18)} <b>Propositions</b> <span class="count">${list.length}</span>
          <span class="caret ${F.sugg ? 'open' : ''}">${icon('chevR', 16)}</span>
        </button>
        ${info('propositions')}
      </div>
      ${F.sugg ? `<ul class="suggest-list">${list.slice(0, 8).map((s, i) => {
        const t = s.taskId && db.tasks[s.taskId];
        return `
        <li class="sg tone-${s.tone}" data-sg="${i}">
          <div class="sg-txt"><b>${esc(s.title)}</b>${t ? `<span>${esc(t.title)}</span>` : ''}</div>
          ${info('', s.text)}
          <div class="sg-actions">
            ${s.actions.slice(0, 1).map((a) => a.href ? `<a class="btn sm" href="${a.href}">${esc(a.label)}</a>` : `<button class="btn sm primary" data-sga="${i}:0">${esc(a.label)}</button>`).join('')}
            ${s.actions.length > 1 ? `<select class="sm" data-sgsel="${i}" aria-label="Autres choix"><option value="">…</option>${s.actions.slice(1).map((a, j) => `<option value="${j + 1}">${esc(a.label)}</option>`).join('')}</select>` : ''}
            <button class="icon-btn xs" data-sgx="${i}" title="Masquer 7 jours" aria-label="Masquer">${icon('close', 14)}</button>
          </div>
        </li>`;
      }).join('')}</ul>` : ''}
    </section>`;
}

function matrixHtml(list, an) {
  return `<div class="matrix">${Object.entries(QUADRANTS).map(([k, q]) => {
    const items = list.filter((t) => quadrant(t) === k);
    return `<section class="quad q-${k}"><header><b>${q.label}</b><small>${q.hint}</small><span class="count">${items.length}</span></header>
      <ul class="tasks">${items.map((t) => row(t, an)).join('') || '<li class="empty-sm">—</li>'}</ul></section>`;
  }).join('')}</div>`;
}

let lastSuggestions = [];

export function renderList(el) {
  const an = analyze();
  lastSuggestions = suggestions(an);
  const list = sorted(filtered());
  const all = tasks();
  const openCount = all.filter((t) => t.status !== 'done').length;
  const heavyOpen = all.filter((t) => t.status !== 'done' && t.energy <= 2).length;

  el.innerHTML = '<div class="view-root"></div>';
  const root = el.firstChild;
  root.innerHTML = `
    <section class="view list-view">
      <form class="card quick" data-quick autocomplete="off">
        <div class="quick-line">
          <input type="text" name="title" placeholder="Nouvelle tâche…" aria-label="Nouvelle tâche" enterkeyhint="done">
          <button type="button" class="icon-btn" data-details title="Fiche complète">${icon('settings', 20)}</button>
          <button class="btn primary" type="submit" aria-label="Ajouter">${icon('plus', 18)}<span class="hide-sm">Ajouter</span></button>
        </div>
        <div class="quick-crit">
          ${slider('urgency', { label: 'Urgence', ...LV, value: Q.urgency, kind: 'heat', compact: true })}
          ${slider('importance', { label: 'Importance', ...LV, value: Q.importance, kind: 'heat', compact: true })}
          ${slider('energy', { label: 'Énergie', ...EN, value: Q.energy, kind: 'energy', compact: true })}
          ${info('criteres')}
        </div>
      </form>

      ${suggestionsHtml(an)}

      <div class="toolbar">
        <label class="search">${icon('search', 16)}<input type="search" placeholder="Rechercher" value="${esc(F.q)}" data-filter="q"></label>
        <select data-filter="status" aria-label="Statut">
          <option value="open" ${F.status === 'open' ? 'selected' : ''}>À faire (${openCount})</option>
          <option value="doing" ${F.status === 'doing' ? 'selected' : ''}>En cours</option>
          <option value="done" ${F.status === 'done' ? 'selected' : ''}>Faites</option>
          <option value="all" ${F.status === 'all' ? 'selected' : ''}>Toutes</option>
        </select>
        <button class="icon-btn filt ${F.more ? 'on' : ''}" data-more title="Filtres et tri" aria-expanded="${F.more}">${icon('filter', 18)}${activeFilters() ? `<i class="dotn">${activeFilters()}</i>` : ''}</button>
        <div class="seg sm mode" role="group" aria-label="Affichage">
          <button class="seg-opt ${F.mode === 'list' ? 'on' : ''}" data-mode="list" title="Liste">${icon('list', 16)}</button>
          <button class="seg-opt ${F.mode === 'matrix' ? 'on' : ''}" data-mode="matrix" title="Matrice urgence / importance">${icon('grid', 16)}</button>
        </div>
        ${F.mode === 'matrix' ? info('matrice') : ''}
      </div>
      ${F.more ? `<div class="toolbar more">
        <select data-filter="project" aria-label="Projet">
          <option value="">Tous les projets</option><option value="_none" ${F.project === '_none' ? 'selected' : ''}>Sans projet</option>
          ${projects().map((p) => `<option value="${p.id}" ${F.project === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
        </select>
        <select data-filter="energy" aria-label="Énergie">
          <option value="">Toutes énergies</option>
          <option value="low" ${F.energy === 'low' ? 'selected' : ''}>Plombantes / fatigantes (${heavyOpen})</option>
          <option value="high" ${F.energy === 'high' ? 'selected' : ''}>Stimulantes / dynamisantes</option>
          ${[1, 2, 3, 4].map((v) => `<option value="${v}" ${F.energy === String(v) ? 'selected' : ''}>${ENERGY[v].label}</option>`).join('')}
        </select>
        <select data-filter="sort" aria-label="Tri">
          <option value="score" ${F.sort === 'score' ? 'selected' : ''}>Tri : priorité</option>
          <option value="due" ${F.sort === 'due' ? 'selected' : ''}>Tri : échéance</option>
          <option value="start" ${F.sort === 'start' ? 'selected' : ''}>Tri : date prévue</option>
          <option value="energy" ${F.sort === 'energy' ? 'selected' : ''}>Tri : plombantes d’abord</option>
          <option value="created" ${F.sort === 'created' ? 'selected' : ''}>Tri : plus récentes</option>
        </select>
      </div>` : ''}

      ${list.length === 0 ? emptyHtml(all.length) : F.mode === 'matrix' ? matrixHtml(list, an) : `<ul class="tasks">${list.map((t) => row(t, an)).join('')}</ul>`}
    </section>`;

  bind(root, el);
}

function emptyHtml(total) {
  return total
    ? `<div class="empty"><p>Aucune tâche pour ces filtres.</p></div>`
    : `<div class="empty"><h3>Aucune tâche</h3><p>Saisissez-en une ci-dessus ${info('criteres')}</p></div>`;
}

function bind(root, el) {
  const form = root.querySelector('[data-quick]');
  bindSliders(form, (name, v) => { Q[name] = Number(v); persist(); });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = form.title.value.trim();
    if (!title) { form.title.focus(); return; }
    const t = newTask({ title, urgency: Q.urgency, importance: Q.importance, energy: Q.energy });
    if (F.project && F.project !== '_none') t.projectId = F.project;
    form.title.value = '';
    putTask(t);
    toast(`« ${title} » ajoutée`, { action: { label: 'Détails', run: () => openTaskEditor(t.id) } });
    setTimeout(() => document.querySelector('[data-quick] input[name="title"]')?.focus(), 0);
  });
  form.querySelector('[data-details]').onclick = () => {
    const title = form.title.value.trim();
    openTaskEditor({ title, urgency: Q.urgency, importance: Q.importance, energy: Q.energy, projectId: F.project && F.project !== '_none' ? F.project : null });
  };

  root.querySelectorAll('[data-sgsel]').forEach((sel) => sel.addEventListener('change', () => {
    const s = lastSuggestions[Number(sel.dataset.sgsel)]; const a = s?.actions[Number(sel.value)];
    if (a?.run) { a.run(); toast('C’est noté.'); }
  }));
  root.querySelectorAll('[data-filter]').forEach((inp) => {
    inp.addEventListener(inp.type === 'search' ? 'input' : 'change', () => {
      F[inp.dataset.filter] = inp.value; persist();
      if (inp.type === 'search') { clearTimeout(inp._t); inp._t = setTimeout(() => { renderList(el); const s = el.querySelector('input[type="search"]'); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }, 200); }
      else renderList(el);
    });
  });

  root.addEventListener('click', (e) => {
    const m = e.target.closest('[data-mode]');
    if (m) { F.mode = m.dataset.mode; persist(); renderList(el); return; }
    if (e.target.closest('[data-more]')) { F.more = !F.more; persist(); renderList(el); return; }
    if (e.target.closest('[data-toggle-sugg]')) { F.sugg = !F.sugg; persist(); renderList(el); return; }
    const sga = e.target.closest('[data-sga]');
    if (sga) {
      const [i, j] = sga.dataset.sga.split(':').map(Number);
      const s = lastSuggestions[i]; const a = s?.actions[j];
      if (a?.open) openTaskEditor(s.taskId);
      else if (a?.run) { a.run(); toast('C’est noté.'); }
      return;
    }
    const sgx = e.target.closest('[data-sgx]');
    if (sgx) { const s = lastSuggestions[Number(sgx.dataset.sgx)]; if (s) { dismiss(s.key); renderList(el); } return; }
    const rowEl = e.target.closest('.task-row');
    if (!rowEl) return;
    const t = db.tasks[rowEl.dataset.id];
    if (!t) return;
    if (e.target.closest('[data-check]')) { toggleDone(t); return; }
    if (e.target.closest('[data-open]') || e.target.closest('.tr-score')) openTaskEditor(t.id);
  });
}

export function toggleDone(t) {
  if (t.status === 'done') {
    t.status = 'todo'; t.doneAt = null; putTask(t);
    return;
  }
  const prev = t.status;
  const next = completeTask(t);
  propagate([t.id]);
  save('task');
  toast(next ? `Bravo ! Prochaine occurrence créée.` : 'Bravo, tâche terminée !', {
    action: { label: 'Annuler', run: () => { t.status = prev; t.doneAt = null; t.recurSpawned = false; putTask(t, { silent: true }); if (next) removeTask(next.id); else save('task'); } },
  });
}
