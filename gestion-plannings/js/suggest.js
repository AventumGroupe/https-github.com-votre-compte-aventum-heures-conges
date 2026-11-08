// Propositions : l'application ne planifie pas seule, elle suggère.
// Logique d'énergie : les tâches plombantes plutôt le matin, ou à déléguer.

import { db, tasks, putTask, save, local, people, score, quadrant } from './store.js';
import { tStart, tEnd, setSpan, proposeSlot, analyze, propagate } from './sched.js';
import { fmt, cap, sameDay, addDays, startOfDay, toDateStr, MIN, HOUR } from './util.js';

const DISMISS_DAYS = 7;

function dismissed() {
  const d = local.get('dismissed', {});
  const now = Date.now();
  for (const k in d) if (d[k] < now) delete d[k];
  return d;
}
export function dismiss(key) {
  const d = dismissed();
  d[key] = Date.now() + DISMISS_DAYS * 864e5;
  local.set('dismissed', d);
}

const slotLabel = (d) => `${cap(fmt.dayShort.format(d))} à ${fmt.time.format(d)}`;

function placeAt(t, start) {
  t.allDay = false;
  setSpan(t, start, new Date(start.getTime() + (t.estimate || 60) * MIN));
  putTask(t, { silent: true });
  propagate([t.id]);
  save('suggest');
}

/**
 * Liste de propositions : { key, kind, tone, title, text, taskId, actions:[{label, run}] }
 */
export function suggestions(analysis = analyze()) {
  const out = [];
  const S = db.settings;
  const open = tasks().filter((t) => t.status !== 'done');
  const now = new Date();
  const horizon = addDays(now, 7);
  const dis = dismissed();
  const push = (s) => { if (!dis[s.key]) out.push(s); };
  const team = people();

  // 1. Retards prévus (rouge)
  for (const t of open) {
    const a = analysis[t.id];
    if (a?.late) {
      push({
        key: `late:${t.id}`, kind: 'late', tone: 'danger', taskId: t.id,
        title: 'Échéance menacée',
        text: `« ${t.title} » finira après son échéance${a.slackDays != null ? ` (${-a.slackDays} j de retard prévu)` : ''}.`,
        actions: [{ label: 'Ouvrir', open: true }],
      });
    }
  }

  // 2. Urgent et important non planifié
  for (const t of open.filter((t) => !t.start && quadrant(t) === 'faire').sort((a, b) => score(b) - score(a)).slice(0, 3)) {
    const slot = proposeSlot(t, { morning: t.energy <= 2 });
    if (!slot) continue;
    push({
      key: `doit:${t.id}`, kind: 'plan', tone: 'accent', taskId: t.id,
      title: 'Urgent et important, pas encore planifié',
      text: `Placer « ${t.title} » ${slotLabel(slot)} ?`,
      actions: [{ label: 'Placer', run: () => placeAt(t, slot) }],
    });
  }

  // 3. Plombantes à faire le matin
  for (const t of open.filter((t) => t.energy <= 2 && !t.start && quadrant(t) !== 'faire').sort((a, b) => score(b) - score(a)).slice(0, 4)) {
    const slot = proposeSlot(t, { morning: true });
    if (!slot) continue;
    push({
      key: `morning:${t.id}`, kind: 'morning', tone: 'energy', taskId: t.id,
      title: 'Tâche plombante : à faire le matin',
      text: `« ${t.title} » demande de l’énergie. Créneau libre : ${slotLabel(slot)}.`,
      actions: [{ label: 'Placer le matin', run: () => placeAt(t, slot) }],
    });
  }

  // 4. Plombantes planifiées l'après-midi -> avancer au matin
  for (const t of open) {
    if (t.energy > 2 || !t.start || t.allDay) continue;
    const s = tStart(t);
    if (s < now || s > horizon || s.getHours() < S.morningEnd) continue;
    let slot = proposeSlot(t, { morning: true, fromDay: s, days: 0 });
    if (!slot || !sameDay(slot, s)) slot = proposeSlot(t, { morning: true, fromDay: addDays(startOfDay(s), 1), days: 2 });
    if (!slot) continue;
    push({
      key: `pm:${t.id}:${t.start}`, kind: 'morning', tone: 'energy', taskId: t.id,
      title: 'Plombante l’après-midi',
      text: `« ${t.title} » est prévue ${slotLabel(s)}. L’avancer ${slotLabel(slot)}, quand l’énergie est plus haute ?`,
      actions: [{ label: 'Avancer au matin', run: () => placeAt(t, slot) }],
    });
  }

  // 5. À déléguer : plombante et peu importante, ou urgente et peu importante
  for (const t of open) {
    if (t.delegate) continue;
    const heavy = t.energy <= 2 && t.importance <= 2;
    const q = quadrant(t) === 'deleguer';
    if (!heavy && !q) continue;
    push({
      key: `delegate:${t.id}`, kind: 'delegate', tone: 'muted', taskId: t.id,
      title: 'À déléguer ?',
      text: heavy
        ? `« ${t.title} » est plombante et peu importante${team.length ? ` : ${team.slice(0, 3).map((p) => p.name).join(', ')} pourrai(en)t s’en charger` : ''}.`
        : `« ${t.title} » est urgente mais peu importante : un bon candidat à la délégation.`,
      actions: team.length
        ? team.slice(0, 3).map((p) => ({ label: `Confier à ${p.name}`, run: () => { t.delegate = p.id; putTask(t); } }))
        : [{ label: 'Ajouter une personne', href: '#ressources' }],
    });
  }

  // 6. Journée trop plombante
  for (let i = 0; i < 5; i++) {
    const d = addDays(startOfDay(now), i);
    const heavy = open.filter((t) => t.start && !t.allDay && t.energy <= 2 && sameDay(tStart(t), d));
    const hours = heavy.reduce((h, t) => h + (tEnd(t) - tStart(t)) / HOUR, 0);
    if (hours >= 4) {
      push({
        key: `heavy:${d.toDateString()}`, kind: 'balance', tone: 'warn',
        title: 'Journée chargée en plombant',
        text: `${cap(fmt.dayLong.format(d))} : ${hours.toFixed(1).replace('.', ',')} h de tâches plombantes. Pensez à intercaler une tâche dynamisante ou à en déléguer une.`,
        actions: [{ label: 'Voir le jour', href: `#calendrier/jour/${toDateStr(d)}` }],
      });
    }
  }

  return out;
}
