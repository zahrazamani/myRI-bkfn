// Catalog of the pre-generated story illustrations for The Lost Guardians' Club.
//
// The image files live in frontend/public/illustrations/<story>/<NN>/<letter>.jpg
// (one folder per scene, one file per variant) and are produced offline by
// backend/generate_illustrations.py, which also writes ./illustration-variants.ts
// listing which variant letters exist. The storyteller bot is told this catalog
// in its system prompt and picks images by id with [show_image: <id>]; ChatModal
// resolves the id to a URL here, choosing one variant per story session.
//
// Keep ids + captions in sync with backend/illustrations/prompts.json.

import { ILLUSTRATION_VARIANTS } from './illustration-variants';

export interface Illustration {
  id: string;
  caption: string;
}

export interface IllustratedStory {
  storyId: string;
  title: string;
  animal: string;
  /** examplePrompt keywords in guardians-club that map to this story */
  triggers: string[];
  quran: string;
  scenes: Illustration[];
}

export const PLACEHOLDER_IMAGE = '/illustrations/_placeholder.svg';

export const ILLUSTRATED_STORIES: IllustratedStory[] = [
  {
    storyId: 'cave-spider',
    title: "The Weaver's Secret Shield",
    animal: 'The Cave Spider',
    triggers: ['spider'],
    quran: 'Surah at-Tawbah 9:40 (the Cave of Thawr)',
    scenes: [
      { id: 'cave-spider-01', caption: 'A moonlit desert path winding toward a dark mountain' },
      { id: 'cave-spider-02', caption: 'The low cave mouth at night under the stars' },
      { id: 'cave-spider-03', caption: 'A small spider arrives at the cave entrance' },
      { id: 'cave-spider-04', caption: 'The spider weaves a web across the cave mouth' },
      { id: 'cave-spider-05', caption: 'A pair of doves nest on a ledge by the entrance' },
      { id: 'cave-spider-06', caption: 'The finished web glistens at dawn, dew on the threads' },
      { id: 'cave-spider-07', caption: 'Armed riders approach the foot of the mountain' },
      { id: 'cave-spider-08', caption: 'The pursuers peer at the untouched web and turn away' },
      { id: 'cave-spider-09', caption: 'The quiet interior of the cave, a shaft of light' },
      { id: 'cave-spider-10', caption: 'Morning light floods the valley, birds rising' },
    ],
  },
  {
    storyId: 'cave-dog',
    title: "The Loyal Guardian's Vigil",
    animal: 'The Dog of the Companions of the Cave',
    triggers: ['dog'],
    quran: 'Surah al-Kahf 18:9-26 (the People of the Cave)',
    scenes: [
      { id: 'cave-dog-01', caption: 'Young companions walk a hill road at sunset with their dog' },
      { id: 'cave-dog-02', caption: 'The group enters a great mountain cave; the dog pauses at the threshold' },
      { id: 'cave-dog-03', caption: 'The dog lies across the entrance, forelegs outstretched, on guard' },
      { id: 'cave-dog-04', caption: 'A sunbeam crosses the cave as years pass' },
      { id: 'cave-dog-05', caption: 'The sleepers rest wrapped in cloaks; the dog watches over them' },
      { id: 'cave-dog-06', caption: 'The mountainside outside moves through the seasons' },
      { id: 'cave-dog-07', caption: 'An ancient, unfamiliar silver coin in an open palm' },
      { id: 'cave-dog-08', caption: 'The town below has changed, with new rooftops and a dome' },
      { id: 'cave-dog-09', caption: 'Bright light and dust as the sleepers wake; the dog stands alert' },
      { id: 'cave-dog-10', caption: 'A simple stone marker and garden by the cave, visitors far off' },
    ],
  },
  {
    storyId: 'hoopoe',
    title: "The Royal Messenger's Ancient News",
    animal: 'The Hoopoe of Solomon',
    triggers: ['hoopoe'],
    quran: 'Surah an-Naml 27:20-28 (the Hoopoe and the Queen of Sheba)',
    scenes: [
      { id: 'hoopoe-01', caption: 'A vivid hoopoe with its crest raised, perched on a carved pillar' },
      { id: 'hoopoe-02', caption: 'A grand open-air court of birds; an empty ornate throne at the top' },
      { id: 'hoopoe-03', caption: 'One gap among the assembled birds, a shaft of light on the empty spot' },
      { id: 'hoopoe-04', caption: 'The hoopoe flies high over mountains and green valleys, searching' },
      { id: 'hoopoe-05', caption: 'From the air: a golden city with terraced gardens and a great palace' },
      { id: 'hoopoe-06', caption: 'The hoopoe glides down toward the palace carrying a sealed letter' },
      { id: 'hoopoe-07', caption: 'The sealed scroll rests on a polished throne-room floor' },
      { id: 'hoopoe-08', caption: 'The court of Sheba debates around the scroll' },
      { id: 'hoopoe-09', caption: 'The hoopoe flies home over the desert at sunset' },
      { id: 'hoopoe-10', caption: 'Back before the assembly of birds, the empty throne still waiting' },
    ],
  },
  {
    storyId: 'raven',
    title: 'The First Lesson of the Wise Crow',
    animal: 'The Raven of the Sons of Adam',
    triggers: ['crow', 'raven'],
    quran: "Surah al-Ma'idah 5:27-31 (the two sons of Adam)",
    scenes: [
      { id: 'raven-01', caption: 'A wide barren land at dusk, two distant figures apart on a ridge' },
      { id: 'raven-02', caption: 'Two offerings on flat stones on a hilltop' },
      { id: 'raven-03', caption: 'A lone figure kneels beside a still, cloak-covered form' },
      { id: 'raven-04', caption: 'A glossy black raven lands on a rock nearby' },
      { id: 'raven-05', caption: 'A second raven lies still on the ground; the living one approaches' },
      { id: 'raven-06', caption: 'The raven digs a hollow in the dark earth' },
      { id: 'raven-07', caption: 'The raven pushes soil over the hollow, making a small mound' },
      { id: 'raven-08', caption: 'The kneeling figure watches the raven, one hand lifted to the head' },
      { id: 'raven-09', caption: 'A fresh earth mound with a single rough headstone on the plain' },
      { id: 'raven-10', caption: 'The wide plain at last light, the raven flying off against a huge sky' },
    ],
  },
  {
    storyId: 'elephant',
    title: "The Mighty Elephant's Sacred Refusal",
    animal: 'The Elephant of the Army of the Elephant',
    triggers: ['elephant'],
    quran: 'Surah al-Fil 105 (the Year of the Elephant)',
    scenes: [
      { id: 'elephant-01', caption: 'A vast army with a towering war elephant marches across the desert' },
      { id: 'elephant-02', caption: 'Close-up of the great armoured elephant, handlers small below' },
      { id: 'elephant-03', caption: 'The army halts at a wide valley; a small plain stone sanctuary far off' },
      { id: 'elephant-04', caption: 'The huge elephant kneels in the sand and refuses to advance' },
      { id: 'elephant-05', caption: 'Turned any other way, the elephant walks eagerly' },
      { id: 'elephant-06', caption: 'A strange shadow spreads as tiny birds appear on the horizon' },
      { id: 'elephant-07', caption: 'Great flocks of small birds fill the sky, each carrying tiny stones' },
      { id: 'elephant-08', caption: 'Small stones streak down; the army scatters in the dust' },
      { id: 'elephant-09', caption: 'The empty plain after: abandoned banners, drifting sand, the elephant alone' },
      { id: 'elephant-10', caption: 'Calm golden dawn over the untouched stone sanctuary' },
    ],
  },
  {
    storyId: 'ant',
    title: "Tiny Queen's Urgent Whisper",
    animal: 'The Ant of the Valley',
    triggers: ['ant', 'ants'],
    quran: 'Surah an-Naml 27:18-19 (Solomon and the Valley of the Ants)',
    scenes: [
      { id: 'ant-01', caption: 'A sweeping low view of a dry valley full of anthills and ant trails' },
      { id: 'ant-02', caption: 'On the far horizon, a long column of marchers raising a wall of dust' },
      { id: 'ant-03', caption: 'A single ant rears up on a pebble, antennae forward, sensing the ground' },
      { id: 'ant-04', caption: 'The ant turns back to the colony; other ants stop to listen' },
      { id: 'ant-05', caption: 'Streams of ants pour back toward their hills carrying eggs and grain' },
      { id: 'ant-06', caption: 'Close-up of the anthill entrance, ants funnelling safely underground' },
      { id: 'ant-07', caption: 'Extreme low angle: a vast shadow passes over the anthill' },
      { id: 'ant-08', caption: 'Warm light returns; the distant column pauses, a gentle amusement' },
      { id: 'ant-09', caption: 'Cutaway of cozy underground tunnels, the whole colony safe, the queen among them' },
      { id: 'ant-10', caption: 'The valley quiet again, ants re-emerging into golden evening light' },
    ],
  },
  {
    storyId: 'camel',
    title: 'The Test of the Sacred Spring',
    animal: 'The She-Camel of Salih',
    triggers: ['camel', 'camels', 'she-camel'],
    quran: 'Surah al-Aʿraf 7:73-79, Surah Hud 11:64-68 (the people of Thamud)',
    scenes: [
      { id: 'camel-01', caption: 'The cliff-city of Thamud carved into red mountains' },
      { id: 'camel-02', caption: 'A crowd gathers before a great sealed rock' },
      { id: 'camel-03', caption: 'The rock splits open with light and dust' },
      { id: 'camel-04', caption: 'A magnificent she-camel emerges from the cleft rock' },
      { id: 'camel-05', caption: 'The she-camel drinks the whole spring dry' },
      { id: 'camel-06', caption: 'The next day the water returns and the camel grazes' },
      { id: 'camel-07', caption: 'Schemers watch the camel from behind the rocks' },
      { id: 'camel-08', caption: 'At dawn the spring is empty and the camel is gone' },
      { id: 'camel-09', caption: 'A dark sky rolls toward the cliff-homes' },
      { id: 'camel-10', caption: 'Silent empty doorways and hoofprints filling with sand' },
    ],
  },
  {
    storyId: 'cow',
    title: 'The Cow of a Hundred Questions',
    animal: 'The Cow of Bani Israel',
    triggers: ['cow', 'cows', 'heifer'],
    quran: 'Surah al-Baqarah 2:67-73',
    scenes: [
      { id: 'cow-01', caption: 'An ancient town at night with one lit window' },
      { id: 'cow-02', caption: 'A crowd argues in the dusty square' },
      { id: 'cow-03', caption: 'Herds of cattle graze by the river' },
      { id: 'cow-04', caption: 'One radiant golden cow stands apart in a barley field' },
      { id: 'cow-05', caption: 'The golden cow is led through the town gate' },
      { id: 'cow-06', caption: 'The cow stands calm in a ring of onlookers at dawn' },
      { id: 'cow-07', caption: 'A quiet miracle of light in the square' },
      { id: 'cow-08', caption: 'The crowd disperses in silence' },
      { id: 'cow-09', caption: 'The golden cow grazes again by the river' },
      { id: 'cow-10', caption: 'The pasture and river at golden hour' },
    ],
  },
  {
    storyId: 'calf',
    title: 'The Statue That Could Not Speak',
    animal: 'The Golden Calf of the Samiri',
    triggers: ['calf', 'golden calf'],
    quran: 'Surah Ta-Ha 20:83-98, Surah al-Aʿraf 7:148-154',
    scenes: [
      { id: 'calf-01', caption: 'A desert camp at the foot of a bare mountain' },
      { id: 'calf-02', caption: 'People pile golden jewellery onto a cloth' },
      { id: 'calf-03', caption: 'Molten gold pours into a mould' },
      { id: 'calf-04', caption: 'The finished golden calf statue on a stone platform' },
      { id: 'calf-05', caption: 'Crowds bow toward the golden calf' },
      { id: 'calf-06', caption: 'The calf casts a long hollow shadow in the wind' },
      { id: 'calf-07', caption: 'A stern figure returns down the mountain path' },
      { id: 'calf-08', caption: 'The golden calf toppled on its side' },
      { id: 'calf-09', caption: 'Gold filings wash away in the river' },
      { id: 'calf-10', caption: 'The quiet camp at dawn, the platform empty' },
    ],
  },
  {
    storyId: 'fish',
    title: "The Whale's Dark Belly",
    animal: 'The Whale of Yunus',
    triggers: ['fish', 'whale', 'yunus', 'jonah'],
    quran: 'Surah as-Saffat 37:139-148, Surah al-Anbiya 21:87-88',
    scenes: [
      { id: 'fish-01', caption: 'A wooden ship pitches on a huge night sea' },
      { id: 'fish-02', caption: 'Lots are drawn on the heaving deck' },
      { id: 'fish-03', caption: 'A figure goes into the black water' },
      { id: 'fish-04', caption: 'An enormous whale rises from the deep' },
      { id: 'fish-05', caption: 'Inside the whale, a single shaft of green light' },
      { id: 'fish-06', caption: 'Ribbons of light spiral upward as he prays' },
      { id: 'fish-07', caption: 'The whale glides through a moonlit ocean' },
      { id: 'fish-08', caption: 'The whale gently sets its passenger on the shore' },
      { id: 'fish-09', caption: 'A broad-leafed gourd vine grows over the resting figure' },
      { id: 'fish-10', caption: "Sunrise over a calm sea, the whale's tail slipping under" },
    ],
  },
  {
    storyId: 'bee',
    title: "The Little Architect's Secret",
    animal: 'The Bee',
    triggers: ['bee', 'bees', 'honey'],
    quran: 'Surah an-Nahl 16:68-69',
    scenes: [
      { id: 'bee-01', caption: 'A wildflower meadow on a mountainside at golden hour' },
      { id: 'bee-02', caption: 'A single honeybee lifts off a blossom' },
      { id: 'bee-03', caption: "The bee's-eye flight over the valley" },
      { id: 'bee-04', caption: 'Bees dance on the comb to share directions' },
      { id: 'bee-05', caption: "A cutaway of the wax comb's perfect hexagons" },
      { id: 'bee-06', caption: 'Bees fan the comb with their wings' },
      { id: 'bee-07', caption: "A beekeeper's distant silhouette sets a woven skep" },
      { id: 'bee-08', caption: 'Amber honey drips from a piece of comb' },
      { id: 'bee-09', caption: 'A clay jar of honey glows on a stone sill' },
      { id: 'bee-10', caption: 'The meadow at dusk, bees streaming home' },
    ],
  },
  {
    storyId: 'donkey',
    title: 'The Sleeper of a Hundred Years',
    animal: 'The Donkey of Uzayr',
    triggers: ['donkey', 'donkeys', 'uzayr', 'ezra'],
    quran: 'Surah al-Baqarah 2:259',
    scenes: [
      { id: 'donkey-01', caption: 'A traveller on a donkey approaches a ruined town' },
      { id: 'donkey-02', caption: 'The rider dismounts among broken walls' },
      { id: 'donkey-03', caption: 'The rider rests in the shade while the donkey grazes' },
      { id: 'donkey-04', caption: 'Sun and moon streak across the sky over the ruins' },
      { id: 'donkey-05', caption: 'White bones of the donkey lie in the grass; the figs remain' },
      { id: 'donkey-06', caption: 'Light returns and the figure stirs' },
      { id: 'donkey-07', caption: 'The figs and waterskin are still perfectly fresh' },
      { id: 'donkey-08', caption: 'The scattered bones draw together in a soft glow' },
      { id: 'donkey-09', caption: 'A living donkey stands again' },
      { id: 'donkey-10', caption: 'The rebuilt green town in the distance at golden hour' },
    ],
  },
];

const SCENE_LOC: Record<string, { story: string; num: string }> = {};
for (const story of ILLUSTRATED_STORIES) {
  for (const scene of story.scenes) {
    const num = scene.id.slice(scene.id.lastIndexOf('-') + 1);
    SCENE_LOC[scene.id] = { story: story.storyId, num };
  }
}

/** djb2 string hash -> unsigned 32-bit int. Deterministic across browsers. */
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

/** A fresh token for one story session, so each reading gets its own variant set. */
export function newStorySeed(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

/**
 * Resolve a scene id (e.g. "ant-04") to a public image URL, or null if the scene
 * is unknown or has no generated image yet.
 *
 * `seed` is a per-story-session token (see newStorySeed): every scene in one
 * telling picks the same variant slot, so the art stays consistent through the
 * story, while a different session — or a child re-reading — gets a different
 * look. With no seed (or only one variant on disk) the first variant is used.
 */
export function illustrationUrl(id: string, seed?: string): string | null {
  const key = id.trim().toLowerCase();
  const loc = SCENE_LOC[key];
  if (!loc) return null;
  const letters = ILLUSTRATION_VARIANTS[key] ?? [];
  if (letters.length === 0) return null;
  let letter = letters[0];
  if (seed && letters.length > 1) {
    letter = letters[hashString(`${seed}:${loc.story}`) % letters.length];
  }
  return `/illustrations/${loc.story}/${loc.num}/${letter}.jpg`;
}

/** True if the scene has at least one generated image on disk. */
export function hasIllustration(id: string): boolean {
  return (ILLUSTRATION_VARIANTS[id.trim().toLowerCase()] ?? []).length > 0;
}

/**
 * The catalog block injected into the storyteller's system prompt. Only scenes
 * that actually have art are listed, so the bot never asks for a missing image.
 */
export function illustrationCatalogText(): string {
  const lines: string[] = [];
  for (const story of ILLUSTRATED_STORIES) {
    const scenes = story.scenes.filter((s) => hasIllustration(s.id));
    if (scenes.length === 0) continue;
    lines.push(`${story.title} — ${story.animal} (${story.quran}):`);
    for (const scene of scenes) {
      lines.push(`  ${scene.id} — ${scene.caption}`);
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}
