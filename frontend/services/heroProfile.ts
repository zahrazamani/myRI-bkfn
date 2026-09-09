// Persistent hero progress for "My Superhero Universe".
//
// Lives in localStorage, namespaced by the logged-in email so each child keeps
// their own record across visits. The Oracle (system prompt) is told the record
// on every session so returning heroes are greeted by name, keep their points
// and unlocked virtues, and get fresh side-quests instead of repeating the game.

import * as authService from './authService';

export type VirtueId = 'courage' | 'selfControl' | 'wisdom' | 'justice' | 'treasure';

export interface HeroLogEntry {
  at: string;
  text: string;
}

export interface HeroProfile {
  version: 1;
  heroName: string | null;
  emblem: string | null;
  totalPoints: number;
  missionsCompleted: number;
  sideQuestsDone: number;
  virtues: Record<VirtueId, boolean>;
  heroLog: HeroLogEntry[];
  visitCount: number;
  lastVisit: string | null;
}

const KEY = 'mri-hero-profile';

export const EMBLEM_CHOICES = ['⚡', '🔥', '🌊', '🦁', '🦅', '🐺', '🌟', '🛡️', '🗡️', '🧭'];

export const RANKS: { min: number; name: string; icon: string }[] = [
  { min: 0, name: 'Cadet', icon: '🌱' },
  { min: 30, name: 'Apprentice', icon: '🪄' },
  { min: 80, name: 'Guardian', icon: '🛡️' },
  { min: 150, name: 'Champion', icon: '🏆' },
  { min: 250, name: 'Legend', icon: '🌟' },
];

export const VIRTUE_ORDER: VirtueId[] = ['courage', 'selfControl', 'wisdom', 'justice', 'treasure'];

export const VIRTUE_META: Record<VirtueId, { label: string; icon: string }> = {
  courage: { label: 'Courage', icon: '💪' },
  selfControl: { label: 'Self-Control', icon: '🎯' },
  wisdom: { label: 'Wisdom', icon: '🦉' },
  justice: { label: 'Justice', icon: '⚖️' },
  treasure: { label: 'Treasure of the True Self', icon: '💎' },
};

function blankProfile(): HeroProfile {
  return {
    version: 1,
    heroName: null,
    emblem: null,
    totalPoints: 0,
    missionsCompleted: 0,
    sideQuestsDone: 0,
    virtues: { courage: false, selfControl: false, wisdom: false, justice: false, treasure: false },
    heroLog: [],
    visitCount: 0,
    lastVisit: null,
  };
}

function storageKey(): string {
  const email = authService.getCurrentUser();
  return email ? `${KEY}:${email}` : KEY;
}

export function loadHeroProfile(): HeroProfile {
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return blankProfile();
    const parsed = JSON.parse(raw) as Partial<HeroProfile>;
    const base = blankProfile();
    return {
      ...base,
      ...parsed,
      virtues: { ...base.virtues, ...(parsed.virtues || {}) },
      heroLog: Array.isArray(parsed.heroLog) ? parsed.heroLog.slice(-12) : [],
      version: 1,
    };
  } catch {
    return blankProfile();
  }
}

export function saveHeroProfile(p: HeroProfile): void {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(p));
  } catch {
    /* private mode / quota — progress just won't persist */
  }
}

export function rankFor(points: number) {
  let current = RANKS[0];
  for (const r of RANKS) if (points >= r.min) current = r;
  return current;
}

export function nextRank(points: number) {
  return RANKS.find(r => r.min > points) || null;
}

// ---- mutations (return a new object; caller persists) ----

export function registerVisit(p: HeroProfile): HeroProfile {
  return { ...p, visitCount: p.visitCount + 1, lastVisit: new Date().toISOString() };
}

export function addPoints(p: HeroProfile, n: number): HeroProfile {
  return { ...p, totalPoints: Math.max(0, p.totalPoints + n) };
}

export function unlockVirtue(p: HeroProfile, v: VirtueId): HeroProfile {
  if (p.virtues[v]) return p;
  return {
    ...p,
    virtues: { ...p.virtues, [v]: true },
    missionsCompleted: p.missionsCompleted + 1,
  };
}

export function addLogEntry(p: HeroProfile, text: string): HeroProfile {
  const clean = text.trim().slice(0, 200);
  if (!clean) return p;
  return { ...p, heroLog: [...p.heroLog, { at: new Date().toISOString(), text: clean }].slice(-12) };
}

export function setIdentity(p: HeroProfile, name: string, emblem: string): HeroProfile {
  return {
    ...p,
    heroName: name.trim().slice(0, 40) || p.heroName,
    emblem: emblem.trim().slice(0, 4) || p.emblem,
  };
}

export function recordSideQuest(p: HeroProfile): HeroProfile {
  return { ...p, sideQuestsDone: p.sideQuestsDone + 1 };
}

// ---- the block handed to the Oracle each session ----

function relativeVisit(iso: string | null): string {
  if (!iso) return 'never before';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'earlier today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return 'a while ago';
}

export function buildHeroContext(p: HeroProfile): string {
  const rank = rankFor(p.totalPoints);
  const next = nextRank(p.totalPoints);
  const mastered = VIRTUE_ORDER.filter(v => p.virtues[v]);
  const remaining = VIRTUE_ORDER.filter(v => !p.virtues[v]);
  const fmt = (v: VirtueId) => `${VIRTUE_META[v].icon} ${VIRTUE_META[v].label}`;
  const log = p.heroLog.slice(-3).map(e => `  - "${e.text}"`).join('\n') || '  (none yet)';

  return `=====================  THIS HERO'S RECORD  =====================
Hero name: ${p.heroName ?? 'NOT CHOSEN YET'}
Emblem: ${p.emblem ?? 'NOT CHOSEN YET'}
Rank: ${rank.icon} ${rank.name}  -  ${p.totalPoints} Hero Points${next ? ` (${next.min - p.totalPoints} to ${next.name})` : ' (max rank!)'}
Visit number: ${p.visitCount}  (last here: ${relativeVisit(p.lastVisit)})
Virtues mastered: ${mastered.length ? mastered.map(fmt).join(', ') : 'none yet'}
Virtues still to earn: ${remaining.length ? remaining.map(fmt).join(', ') : 'ALL DONE - main path complete'}
Missions completed: ${p.missionsCompleted}   Side-quests done: ${p.sideQuestsDone}
Recent Hero's Log:
${log}

HOW TO USE THIS RECORD (do this before the normal game flow):
- If Hero name is NOT CHOSEN YET -> brand-new hero. First, a 2-step onboarding: (1) ask them to invent a hero name; (2) ask them to pick an emblem from ${EMBLEM_CHOICES.join(' ')}. Once you have both, emit [HERO_IDENTITY: name | emoji] on its own line and greet them by name. THEN start "The Academy".
- If they already have a name -> greet them by name + emblem, say their rank and name one virtue they've mastered, welcome them back warmly, and give a small return bonus: [POINTS_AWARDED: 3]. Then offer their next step.
- If "Virtues still to earn" is not empty -> offer to continue training toward the first one still missing, using its stage.
- If ALL virtues are done -> offer a fresh SIDE-QUEST: one brand-new scenario (never repeat an earlier one) for a virtue they pick. On success emit [POINTS_AWARDED: 8] and treat it as a side-quest.
- When a hero finishes a stage's challenge AND writes its Hero's Log, emit [UNLOCK: <virtue>] on its own line: courage after Cave of Anger, self-control after Whispering Woods, wisdom partway through the Final Trial, then justice and treasure at the very end.
- Whenever a hero shares a real reflection, save a one-line summary with [HERO_LOG: short summary] on its own line.
- Rank thresholds: Cadet 0, Apprentice 30, Guardian 80, Champion 150, Legend 250. If a points award pushes them past one, celebrate the new rank in one line.
================================================================`;
}
