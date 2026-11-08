// Application : navigation, réglages, synchronisation automatique, installation.

import { db, onChange, setSettings, local, exportJson, replaceDb, mergeRemote, tasks, newTask, putTask, newProject, putProject, newResource, putResource, save } from './store.js';
import { rollOverdue, propagate } from './sched.js';
import { renderList } from './list.js';
import { renderCalendar, calendarRoute, setCalendarHooks } from './calendar.js';
import { renderGantt } from './gantt.js';
import { renderResources } from './resources.js';
import { openTaskEditor } from './editor.js';
import * as ms from './outlook.js';
import { notifSupported, notifEnabled, enableNotifications, disableNotifications, show, startReminders } from './notify.js';
import { toast, confirmDialog, seg, bindSeg } from './ui.js';
import { $, esc, icon, debounce, download, toLocal, toDateStr, addDays, startOfDay, fmt } from './util.js';

const VERSION = '1.0.0';
const TABS = [
  { id: 'taches', label: 'Tâches', icon: 'list', render: renderList },
  { id: 'calendrier', label: 'Calendrier', icon: 'calendar', render: renderCalendar },
  { id: 'gantt', label: 'Gantt', icon: 'gantt', render: renderGantt },
  { id: 'ressources', label: 'Ressources', icon: 'people', render: renderResources },
  { id: 'reglages', label: 'Réglages', icon: 'settings', render: renderSettings },
];

let current = 'taches';
let installEvent = null;

// ---------- Thème ----------
function applyTheme() {
  const t = db.settings.theme;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

// ---------- Navigation ----------
function route() {
  const [tab, ...rest] = (location.hash.replace(/^#\/?/, '') || 'taches').split('/');
  current = TABS.some((t) => t.id === tab) ? tab : 'taches';
  if (current === 'calendrier') calendarRoute(rest);
  document.querySelectorAll('[data-tab]').forEach((a) => a.classList.toggle('on', a.dataset.tab === current));
  render();
}

function render() {
  const main = $('#view');
  const tab = TABS.find((t) => t.id === current);
  document.body.dataset.view = current;
  const y = window.scrollY;
  tab.render(main);
  if (current !== 'taches') window.scrollTo(0, y);
}
let pendingRender = false;
const rerender = debounce(() => {
  // Ne pas effacer une saisie en cours : on attend que le champ perde le focus.
  const a = document.activeElement;
  if (a && a.closest('#view') && a.matches('input:not([type]), input[type="text"], input[type="search"], input[type="email"], input[type="number"], textarea') && a.value) {
    if (!pendingRender) { pendingRender = true; a.addEventListener('blur', () => { pendingRender = false; render(); }, { once: true }); }
    return;
  }
  render();
}, 60);

function shell() {
  const nav = TABS.map((t) => `<a href="#${t.id}" data-tab="${t.id}">${icon(t.icon, 20)}<span>${t.label}</span></a>`).join('');
  document.getElementById('app').innerHTML = `
    <header class="topbar">
      <a class="brand" href="#taches"><img src="icons/icon.svg" alt="" width="28" height="28"><span>Gestion des plannings</span></a>
      <nav class="tabs" aria-label="Navigation">${nav}</nav>
      <span class="spacer"></span>
      <button class="sync-ind" data-syncnow title="Synchronisation"></button>
      <button class="btn primary sm add-btn" data-add title="Nouvelle tâche">${icon('plus', 18)}<span class="hide-sm">Tâche</span></button>
    </header>
    <main id="view" tabindex="-1"></main>
    <nav class="bottom-nav" aria-label="Navigation">${nav}</nav>
    <button class="fab" data-add aria-label="Nouvelle tâche">${icon('plus', 26)}</button>`;
  document.body.addEventListener('click', (e) => {
    if (e.target.closest('[data-add]')) openTaskEditor();
    if (e.target.closest('[data-syncnow]')) {
      if (ms.isConnected()) manualSync(); else location.hash = '#reglages';
    }
  });
  updateSyncIndicator(ms.getStatus());
}

function updateSyncIndicator(s) {
  const el = document.querySelector('.sync-ind');
  if (!el) return;
  const connected = ms.isConnected();
  const last = s.last ? `Dernière synchronisation : ${fmt.time.format(new Date(s.last))}` : '';
  const map = {
    off: [connected ? 'idle' : 'off', connected ? 'Synchronisé' : 'Local', 'Données sur cet appareil uniquement. Connectez Outlook dans les réglages pour synchroniser.'],
    idle: ['idle', 'Synchronisé', last],
    syncing: ['syncing', 'Synchronisation…', s.detail || ''],
    offline: ['offline', 'Hors connexion', 'Les modifications sont enregistrées et seront synchronisées au retour du réseau.'],
    error: ['error', 'Erreur de synchro', s.error || ''],
  }[s.state] || ['off', '', ''];
  el.className = `sync-ind ${map[0]}`;
  el.innerHTML = `${icon('sync', 16)}<span class="hide-sm">${map[1]}</span>`;
  el.title = map[2];
}

async function manualSync() {
  try {
    const r = await ms.syncAll({ manual: true });
    if (r) toast(`Synchronisé · ${r.pulled} reçue(s) d’Outlook, ${r.pushed} envoyée(s), ${r.removed} retirée(s).`);
  } catch (e) {
    toast(`Synchronisation impossible : ${ms.getStatus().error || e.message}`, { tone: 'danger', timeout: 6000 });
  }
}

const autoSync = debounce(() => { if (ms.isConnected()) ms.syncAll(); }, 4000);

// ---------- Réglages ----------
function renderSettings(el) {
  const S = db.settings;
  const st = ms.getStatus();
  const connected = ms.isConnected();
  const hours = (from, to, v) => Array.from({ length: to - from + 1 }, (_, i) => from + i).map((h) => `<option value="${h}" ${v === h ? 'selected' : ''}>${h} h</option>`).join('');
  const WD = [[1, 'Lun'], [2, 'Mar'], [3, 'Mer'], [4, 'Jeu'], [5, 'Ven'], [6, 'Sam'], [0, 'Dim']];
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;

  el.innerHTML = `
    <section class="view settings">
      <h2>Réglages</h2>

      <section class="card set">
        <h3>${icon('sun', 18)} Journée de travail</h3>
        <div class="grid3">
          <label class="field"><span>Début de journée</span><select data-s="dayStart">${hours(5, 12, S.dayStart)}</select></label>
          <label class="field"><span>Fin de matinée</span><select data-s="morningEnd">${hours(9, 14, S.morningEnd)}</select></label>
          <label class="field"><span>Fin de journée</span><select data-s="dayEnd">${hours(15, 23, S.dayEnd)}</select></label>
        </div>
        <div class="field"><span>Jours travaillés</span><div class="weekdays">${WD.map(([v, l]) => `<button type="button" class="wd ${S.workDays.includes(v) ? 'on' : ''}" data-wd="${v}">${l}</button>`).join('')}</div></div>
        <label class="switch"><input type="checkbox" data-s="autoShift" ${S.autoShift ? 'checked' : ''}><span></span> Décaler automatiquement les tâches en retard et leurs successeurs</label>
        <p class="hint">Une tâche non terminée dont la fin est passée est reportée au prochain créneau ; ses successeurs suivent. Celles qui dépassent alors leur échéance apparaissent en rouge.</p>
        <label class="field"><span>Rappel par défaut des nouvelles tâches</span>
          <select data-s="reminder">${[[null, 'Aucun'], [0, 'À l’heure'], [5, '5 min avant'], [10, '10 min avant'], [15, '15 min avant'], [30, '30 min avant'], [60, '1 h avant']].map(([v, l]) => `<option value="${v ?? ''}" ${S.reminder === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      </section>

      <section class="card set">
        <h3>${icon('sync', 18)} Outlook et synchronisation entre appareils</h3>
        <p>La connexion à votre compte Microsoft permet :</p>
        <ul class="bullets">
          <li><b>Outlook dans les deux sens</b> : vos tâches planifiées deviennent des rendez-vous (avec rappel) ; si vous en déplacez un dans Outlook, la tâche suit. Vos autres rendez-vous s’affichent dans le calendrier pour planifier autour.</li>
          <li><b>Téléphone ↔ ordinateur</b> : les données sont copiées dans un fichier privé de votre OneDrive (dossier « Applications »), sans autre compte à créer.</li>
        </ul>
        ${connected ? `
          <p class="ok-text">${icon('check', 16)} Connecté : <b>${esc(ms.accountLabel())}</b></p>
          <label class="field"><span>Calendrier Outlook utilisé</span><select data-cal><option value="">Calendrier principal</option></select></label>
          <div class="row wrap gap">
            <button class="btn primary" data-act="sync">${icon('sync', 16)} Synchroniser maintenant</button>
            <button class="btn ghost" data-act="logout">Se déconnecter</button>
          </div>
          <p class="hint">${st.last ? `Dernière synchronisation : ${fmt.dayShort.format(new Date(st.last))} à ${fmt.time.format(new Date(st.last))}.` : 'Pas encore synchronisé.'}
            ${st.error ? `<br><span class="danger-text">${esc(st.error)}</span>` : ''}</p>`
        : `
          <label class="field"><span>Identifiant d’application Microsoft (client ID)</span>
            <input type="text" data-clientid value="${esc(ms.clientId())}" placeholder="00000000-0000-0000-0000-000000000000" spellcheck="false" autocomplete="off"></label>
          <div class="row wrap gap">
            <button class="btn primary" data-act="login" ${window.msal ? '' : 'disabled'}>Se connecter à Microsoft</button>
          </div>
          ${st.error ? `<p class="danger-text">${esc(st.error)}</p>` : ''}
          <details class="howto"><summary>Comment obtenir l’identifiant d’application (une seule fois, 5 minutes)</summary>
            <ol>
              <li>Ouvrez <b>portal.azure.com</b> → « Microsoft Entra ID » → « Inscriptions d’applications » → « Nouvelle inscription ».</li>
              <li>Nom : <i>Gestion des plannings</i>. Types de comptes : <b>« Comptes dans un annuaire organisationnel et comptes Microsoft personnels »</b>.</li>
              <li>URI de redirection : plateforme <b>« Application monopage (SPA) »</b>, adresse :<br><code class="copy" data-copy="${esc(ms.redirectUri())}">${esc(ms.redirectUri())}</code></li>
              <li>Dans « Autorisations des API » → Microsoft Graph → autorisations déléguées : <code>Calendars.ReadWrite</code>, <code>Files.ReadWrite.AppFolder</code>, <code>User.Read</code>.</li>
              <li>Copiez « ID d’application (client) » ici, puis « Se connecter ». Faites de même sur le téléphone avec le même identifiant.</li>
            </ol></details>`}
        <hr>
        <h4>Sauvegarde manuelle</h4>
        <div class="row wrap gap">
          <button class="btn ghost" data-act="export">Exporter (.json)</button>
          <label class="btn ghost">Importer…<input type="file" accept="application/json,.json" data-import hidden></label>
        </div>
        <p class="hint">L’import fusionne le fichier avec vos données (la version la plus récente de chaque tâche est conservée). Utile aussi pour transférer vers un autre appareil sans compte Microsoft.</p>
      </section>

      <section class="card set">
        <h3>${icon('bell', 18)} Rappels</h3>
        ${!notifSupported() ? '<p class="muted">Ce navigateur ne gère pas les notifications.</p>'
          : notifEnabled() ? `<p class="ok-text">${icon('check', 16)} Notifications activées.</p>
            <div class="row gap"><button class="btn ghost" data-act="testnotif">Tester</button><button class="btn ghost" data-act="nonotif">Désactiver</button></div>`
          : `<button class="btn primary" data-act="notif">Activer les notifications</button>`}
        <p class="hint">L’application affiche les rappels et un résumé du matin quand elle est ouverte. Quand elle est fermée, ce sont les rappels des rendez-vous Outlook synchronisés qui vous préviennent (application Outlook du téléphone).</p>
      </section>

      <section class="card set">
        <h3>Apparence</h3>
        ${seg('theme', [{ v: 'auto', label: 'Automatique' }, { v: 'light', label: 'Clair' }, { v: 'dark', label: 'Sombre' }], S.theme)}
      </section>

      <section class="card set">
        <h3>Installer l’application</h3>
        ${standalone ? `<p class="ok-text">${icon('check', 16)} Application installée.</p>`
          : installEvent ? `<button class="btn primary" data-act="install">Installer sur cet appareil</button>`
          : `<p>Sur Android (Chrome) : menu ⋮ → <b>« Installer l’application »</b> ou « Ajouter à l’écran d’accueil ». Sur ordinateur (Chrome / Edge) : icône d’installation dans la barre d’adresse.</p>`}
        <p class="hint">Une fois installée, l’application s’ouvre comme une application native et fonctionne hors connexion.</p>
      </section>

      <section class="card set">
        <h3>Données</h3>
        <p>${tasks().length} tâche(s), ${Object.keys(db.projects).length} projet(s), ${Object.keys(db.resources).length} ressource(s) sur cet appareil.</p>
        <div class="row wrap gap">
          <button class="btn ghost" data-act="demo">Charger un exemple</button>
          <button class="btn ghost danger-text" data-act="wipe">Tout effacer</button>
        </div>
        <p class="hint">Version ${VERSION}</p>
      </section>
    </section>`;

  const root = el.querySelector('.settings');
  bindSeg(root, (name, v) => { if (name === 'theme') { setSettings({ theme: v }); applyTheme(); } });

  root.addEventListener('change', async (e) => {
    const k = e.target.dataset.s;
    if (k) {
      const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value === '' ? null : Number(e.target.value);
      setSettings({ [k]: v });
      if (k === 'autoShift' && v) { const m = rollOverdue(); if (m.length) toast(`${m.length} tâche(s) en retard décalée(s).`); }
    }
    if (e.target.matches('[data-cal]')) { ms.setCalendarId(e.target.value); toast('Calendrier choisi. Synchronisation…'); manualSync(); }
    if (e.target.matches('[data-clientid]')) ms.setClientId(e.target.value);
    if (e.target.matches('[data-import]')) {
      const f = e.target.files[0];
      if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        const changed = mergeRemote(data);
        toast(changed ? 'Données importées et fusionnées.' : 'Rien de nouveau dans ce fichier.');
      } catch { toast('Fichier illisible.', { tone: 'danger' }); }
    }
  });

  root.addEventListener('click', async (e) => {
    const wd = e.target.closest('[data-wd]');
    if (wd) {
      const v = Number(wd.dataset.wd);
      const set = new Set(db.settings.workDays);
      set.has(v) ? set.delete(v) : set.add(v);
      if (!set.size) return;
      setSettings({ workDays: [...set].sort() });
      return;
    }
    const cp = e.target.closest('[data-copy]');
    if (cp) { navigator.clipboard?.writeText(cp.dataset.copy); toast('Adresse copiée.'); return; }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    if (act === 'login') {
      const v = root.querySelector('[data-clientid]').value.trim();
      if (!/^[0-9a-f-]{36}$/i.test(v)) { toast('L’identifiant doit ressembler à 00000000-0000-0000-0000-000000000000.'); return; }
      ms.setClientId(v);
      try { await ms.initMs(); await ms.login(); } catch (err) { toast(err.message, { tone: 'danger' }); }
    }
    if (act === 'logout') ms.logout();
    if (act === 'sync') manualSync();
    if (act === 'export') download(`gestion-plannings-${toDateStr(new Date())}.json`, exportJson());
    if (act === 'notif') { const p = await enableNotifications(); toast(p === 'granted' ? 'Notifications activées.' : 'Notifications refusées par le navigateur.'); render(); }
    if (act === 'nonotif') { disableNotifications(); render(); }
    if (act === 'testnotif') show('Gestion des plannings', 'Les rappels fonctionnent 👍', 'test');
    if (act === 'install' && installEvent) { installEvent.prompt(); await installEvent.userChoice; installEvent = null; render(); }
    if (act === 'demo') { loadDemo(); toast('Exemple chargé : voyez la liste, le calendrier et le Gantt.'); location.hash = '#gantt'; }
    if (act === 'wipe') {
      if (await confirmDialog('Effacer toutes les données de cet appareil ? (Une copie OneDrive éventuelle n’est pas supprimée.)', { ok: 'Tout effacer' })) {
        replaceDb({}); local.set('outlookEvents', []); toast('Données effacées.');
      }
    }
  });

  if (connected) {
    ms.listCalendars().then((cals) => {
      const sel = root.querySelector('[data-cal]');
      if (!sel) return;
      sel.innerHTML = cals.map((c) => `<option value="${c.isDefaultCalendar ? '' : c.id}" ${(c.isDefaultCalendar ? '' : c.id) === ms.calendarId() ? 'selected' : ''}>${esc(c.name)}${c.isDefaultCalendar ? ' (principal)' : ''}</option>`).join('');
    }).catch(() => {});
  }
}

// ---------- Exemple ----------
function loadDemo() {
  const at = (dayOffset, h, m = 0) => { const d = addDays(startOfDay(new Date()), dayOffset); d.setHours(h, m, 0, 0); return toLocal(d); };
  const day = (dayOffset) => toDateStr(addDays(startOfDay(new Date()), dayOffset)) + 'T00:00';
  const date = (dayOffset) => toDateStr(addDays(startOfDay(new Date()), dayOffset));
  const camille = newResource({ name: 'Camille', type: 'personne' }); putResource(camille);
  const yanis = newResource({ name: 'Yanis', type: 'personne' }); putResource(yanis);
  const salle = newResource({ name: 'Salle Mistral', type: 'salle' }); putResource(salle);
  const budget = newResource({ name: 'Budget formation', type: 'budget', capacity: 5000 }); putResource(budget);
  const proj = newProject({ name: 'Session de formation de décembre', deadline: date(24) }); putProject(proj);
  const mk = (p) => { const t = newTask(p); putTask(t, { silent: true }); return t; };
  const a = mk({ title: 'Définir le programme', projectId: proj.id, urgency: 4, importance: 5, energy: 3, allDay: true, start: day(1), end: day(2), assign: [{ id: camille.id, qty: 6 }] });
  const b = mk({ title: 'Réserver la salle et le traiteur', projectId: proj.id, urgency: 3, importance: 3, energy: 2, allDay: true, start: day(3), end: day(3), preds: [{ id: a.id, lag: 0 }], assign: [{ id: salle.id }, { id: budget.id, qty: 1800 }], delegate: yanis.id });
  const c = mk({ title: 'Rédiger les supports', projectId: proj.id, urgency: 3, importance: 5, energy: 1, allDay: true, start: day(3), end: day(9), preds: [{ id: a.id, lag: 0 }], subtasks: [{ id: 's1', title: 'Module 1', done: false }, { id: 's2', title: 'Module 2', done: false }, { id: 's3', title: 'Exercices', done: false }] });
  const d = mk({ title: 'Envoyer les convocations', projectId: proj.id, urgency: 4, importance: 4, energy: 2, allDay: true, start: day(10), end: day(10), preds: [{ id: b.id, lag: 0 }, { id: c.id, lag: 0 }] });
  mk({ title: 'Animer la session', projectId: proj.id, urgency: 5, importance: 5, energy: 4, allDay: true, start: day(17), end: day(18), preds: [{ id: d.id, lag: 5 }], assign: [{ id: camille.id, qty: 14 }, { id: salle.id }, { id: budget.id, qty: 2500 }], due: date(21) });
  mk({ title: 'Relancer les factures impayées', urgency: 4, importance: 2, energy: 1, estimate: 60 });
  mk({ title: 'Point d’équipe hebdomadaire', urgency: 3, importance: 3, energy: 3, estimate: 30, start: at(1, 9), end: at(1, 9, 30), recur: { freq: 'weekly', interval: 1, days: [] } });
  mk({ title: 'Préparer la déclaration de TVA', urgency: 5, importance: 5, energy: 1, estimate: 90, due: date(3) });
  mk({ title: 'Appeler un nouveau client', urgency: 2, importance: 4, energy: 4, estimate: 30, start: at(2, 15), end: at(2, 15, 30) });
  mk({ title: 'Classer les mails', urgency: 2, importance: 1, energy: 2, estimate: 45 });
  propagate(tasks().map((t) => t.id));
  save('demo');
}

// ---------- Démarrage ----------
async function start() {
  applyTheme();
  shell();
  window.addEventListener('hashchange', route);
  window.matchMedia('(max-width: 760px)').addEventListener('change', render);

  onChange((reason) => {
    if (reason === 'settings') applyTheme();
    rerender();
    if (!['sync', 'merge'].includes(reason)) autoSync();
  });
  ms.onStatus((s) => { updateSyncIndicator(s); if (current === 'reglages' && s.state !== 'syncing') rerender(); });
  setCalendarHooks({ connected: ms.isConnected, sync: manualSync });

  const moved = rollOverdue();
  route();
  if (moved.length) toast(`${moved.length} tâche(s) en retard reportée(s) automatiquement, successeurs compris.`);

  setInterval(() => { if (rollOverdue().length) toast('Des tâches en retard ont été reportées.'); }, 10 * 60 * 1000);
  startReminders();

  // Connexion Microsoft et synchronisation
  const ok = await ms.initMs();
  updateSyncIndicator(ms.getStatus());
  if (ok) {
    ms.syncAll();
    setInterval(() => ms.syncAll(), 5 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) ms.syncAll(); });
    window.addEventListener('online', () => ms.syncAll());
  }
  window.addEventListener('offline', () => updateSyncIndicator({ ...ms.getStatus(), state: 'offline' }));
}

window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; if (current === 'reglages') render(); });

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service worker', e));
}

start();
