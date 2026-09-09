// Cross-bot user profile for "My Real Intelligence".
//
// Where heroProfile.ts tracks the Superhero game only, this tracks lightweight
// engagement that spans every bot: a day streak, per-bot visit/session counts,
// how many sessions turned into a real reflection, and a shelf of badges the
// bots award. Lives in localStorage, namespaced by the logged-in email so each
// user keeps their own record. Every read tolerates missing / corrupt data and
// falls back to a blank profile, exactly like heroProfile.ts.

import * as authService from './authService';
import { CHATBOTS } from '../constants';

export interface StreakState {
  count: number;
  /** local YYYY-MM-DD of the last day the user was active, or null */
  lastActiveDay: string | null;
}

export interface PerBotStats {
  visits: number;
  sessions: number;
  messagesSent: number;
  reflections: number;
  lastVisit: string | null;
}

export interface Badge {
  id: string;
  label: string;
  botId: string;
  at: string;
}

export interface UserProfile {
  version: 1;
  streak: StreakState;
  perBot: Record<string, PerBotStats>;
  badges: Badge[];
  totalVisits: number;
  totalReflections: number;
}

const KEY = 'mri-profile';

/** A session counts as a "reflection" once the user has sent this many messages. */
export const REFLECTION_MESSAGE_THRESHOLD = 3;

function blankPerBot(): PerBotStats {
  return { visits: 0, sessions: 0, messagesSent: 0, reflections: 0, lastVisit: null };
}

export function blankProfile(): UserProfile {
  return {
    version: 1,
    streak: { count: 0, lastActiveDay: null },
    perBot: {},
    badges: [],
    totalVisits: 0,
    totalReflections: 0,
  };
}

function storageKey(): string {
  const email = authService.getCurrentUser();
  return email ? `${KEY}:${email}` : KEY;
}

/** Local calendar day as YYYY-MM-DD (not UTC). */
export function localDay(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysBetween(fromDay: string, toDay: string): number {
  const a = new Date(`${fromDay}T00:00:00`).getTime();
  const b = new Date(`${toDay}T00:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return NaN;
  return Math.round((b - a) / 86400000);
}

/** slug used to build a stable badge id from a human label */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'badge';
}

export function loadProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return blankProfile();
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    const base = blankProfile();
    const perBot: Record<string, PerBotStats> = {};
    if (parsed.perBot && typeof parsed.perBot === 'object') {
      for (const [botId, stats] of Object.entries(parsed.perBot)) {
        perBot[botId] = { ...blankPerBot(), ...(stats as Partial<PerBotStats>) };
      }
    }
    return {
      ...base,
      ...parsed,
      version: 1,
      streak: { ...base.streak, ...(parsed.streak || {}) },
      perBot,
      badges: Array.isArray(parsed.badges) ? parsed.badges.filter(b => b && b.id) : [],
      totalVisits: typeof parsed.totalVisits === 'number' ? parsed.totalVisits : 0,
      totalReflections: typeof parsed.totalReflections === 'number' ? parsed.totalReflections : 0,
    };
  } catch {
    return blankProfile();
  }
}

export function saveProfile(p: UserProfile): void {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(p));
  } catch {
    /* private mode / quota — engagement just won't persist */
  }
}

// ---- mutations (return a new object; caller persists) ----

function bumpStreak(streak: StreakState, today: string): StreakState {
  if (streak.lastActiveDay === today) return streak;
  const gap = streak.lastActiveDay ? daysBetween(streak.lastActiveDay, today) : NaN;
  const count = gap === 1 ? streak.count + 1 : 1;
  return { count, lastActiveDay: today };
}

function withBot(p: UserProfile, botId: string, patch: (s: PerBotStats) => PerBotStats): UserProfile {
  const current = p.perBot[botId] || blankPerBot();
  return { ...p, perBot: { ...p.perBot, [botId]: patch(current) } };
}

export function registerVisit(p: UserProfile, botId: string): UserProfile {
  const now = new Date();
  const next = withBot(p, botId, s => ({
    ...s,
    visits: s.visits + 1,
    lastVisit: now.toISOString(),
  }));
  return {
    ...next,
    totalVisits: next.totalVisits + 1,
    streak: bumpStreak(next.streak, localDay(now)),
  };
}

/** Count a user message toward this bot's running total for the current visit. */
export function registerMessage(p: UserProfile, botId: string): UserProfile {
  return withBot(p, botId, s => ({ ...s, messagesSent: s.messagesSent + 1 }));
}

export function recordSessionEnd(p: UserProfile, botId: string, userMessageCount: number): UserProfile {
  const isReflection = userMessageCount >= REFLECTION_MESSAGE_THRESHOLD;
  const next = withBot(p, botId, s => ({
    ...s,
    sessions: s.sessions + 1,
    reflections: s.reflections + (isReflection ? 1 : 0),
  }));
  return isReflection ? { ...next, totalReflections: next.totalReflections + 1 } : next;
}

export function awardBadge(
  p: UserProfile,
  badge: { id: string; label: string; botId: string },
): UserProfile {
  if (p.badges.some(b => b.id === badge.id)) return p;
  return {
    ...p,
    badges: [...p.badges, { ...badge, at: new Date().toISOString() }],
  };
}

// ---- display helpers ----

function botTitle(botId: string): string {
  return CHATBOTS.find(c => c.id === botId)?.title || botId;
}

export interface ProfileBotRow {
  botId: string;
  title: string;
  visits: number;
  sessions: number;
  reflections: number;
  lastVisit: string | null;
}

export interface ProfileSummary {
  streakCount: number;
  streakActiveToday: boolean;
  totalVisits: number;
  totalReflections: number;
  badgeCount: number;
  rows: ProfileBotRow[];
  badges: Badge[];
}

export function buildProfileSummary(p: UserProfile): ProfileSummary {
  const rows: ProfileBotRow[] = Object.entries(p.perBot)
    .map(([botId, s]) => ({
      botId,
      title: botTitle(botId),
      visits: s.visits,
      sessions: s.sessions,
      reflections: s.reflections,
      lastVisit: s.lastVisit,
    }))
    .sort((a, b) => (b.lastVisit || '').localeCompare(a.lastVisit || ''));

  return {
    streakCount: p.streak.count,
    streakActiveToday: p.streak.lastActiveDay === localDay(),
    totalVisits: p.totalVisits,
    totalReflections: p.totalReflections,
    badgeCount: p.badges.length,
    rows,
    badges: p.badges.slice().sort((a, b) => (b.at || '').localeCompare(a.at || '')),
  };
}
