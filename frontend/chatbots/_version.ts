/**
 * Prompt version switch for every MYRI bot.
 *
 *   v1 - the original bot prompts, exactly as they were before the 2026-09
 *        "make it land for teens/youth" rework.
 *   v2 - the reworked prompts: an applied-examples directive on every bot, a
 *        narrow "ask one clarifying question only when truly needed" rule on the
 *        advice bots, plus per-bot changes (objection-first framing, life-texture
 *        scenarios, story "make it theirs" beats, superhero side-quests, the
 *        Better Me weekly loop, etc.).
 *
 * Both versions ship in the bundle. To roll every bot back to v1, set
 *   VITE_PROMPT_VERSION=v1
 * in frontend/.env and rebuild. Anything other than "v1" (including unset)
 * means v2.
 */
export type PromptVersion = 'v1' | 'v2';

export const PROMPT_VERSION: PromptVersion =
  (import.meta.env.VITE_PROMPT_VERSION as string | undefined) === 'v1' ? 'v1' : 'v2';

/** Pick the v1 or v2 variant of any per-bot value (systemPrompt, stages, ...). */
export const byVersion = <T>(v1: T, v2: T): T => (PROMPT_VERSION === 'v1' ? v1 : v2);
