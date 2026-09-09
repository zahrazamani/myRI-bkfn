// Canonical list of the 31 animals mentioned BY NAME in the Qur'an.
//
// Source: "A List Of All The Animals Mentioned In Quran", thelastdialogue.org
//   https://www.thelastdialogue.org/article/list-of-all-animals-mentioned-in-quran/
//
// Used to keep The Lost Guardians' Club strictly within Qur'anic animals:
//  - the storyteller bot is told this list and must decline any other animal
//    (see frontend/chatbots/guardians-club.ts)
//  - the illustration generator refuses scene prompts naming a non-Qur'anic
//    animal (see backend/illustrations/quran_animals.json + generate_illustrations.py)
//
// Keep this file in sync with backend/illustrations/quran_animals.json.

export interface QuranAnimal {
  /** kebab-case key */
  id: string;
  /** English name */
  name: string;
  /** Arabic word(s) as given by the source */
  arabic: string;
  /** number of times the word occurs in the Qur'an */
  mentions: number;
  /** number of distinct verses */
  verses: number;
  /** other English words a child might use for this animal */
  aliases?: string[];
  /** storyId in ILLUSTRATED_STORIES if a full illustrated story exists */
  storyId?: string;
}

export const QURAN_ANIMALS: QuranAnimal[] = [
  { id: 'ant', name: 'Ant', arabic: 'نَمل', mentions: 3, verses: 1, aliases: ['ants'], storyId: 'ant' },
  { id: 'ape', name: 'Ape', arabic: 'قِرد', mentions: 3, verses: 3, aliases: ['monkey', 'monkeys', 'apes'] },
  { id: 'bee', name: 'Bee', arabic: 'نَحل', mentions: 1, verses: 1, aliases: ['bees', 'honeybee'] },
  { id: 'bird', name: 'Bird', arabic: 'طَائِر', mentions: 18, verses: 16, aliases: ['birds', 'dove', 'doves', 'swallow', 'swallows', 'ababil'] },
  { id: 'calf', name: 'Calf', arabic: 'عِجْل', mentions: 10, verses: 10, aliases: ['golden calf'] },
  { id: 'camel', name: 'Camel', arabic: 'نَاقَة / بَعِير / جَمَل', mentions: 15, verses: 15, aliases: ['camels', 'she-camel', 'she camel'] },
  { id: 'cattle', name: 'Cattle', arabic: 'أَنْعَام', mentions: 33, verses: 31, aliases: ['livestock'] },
  { id: 'cow', name: 'Cow', arabic: 'بَقَرَة', mentions: 9, verses: 9, aliases: ['cows', 'heifer'] },
  { id: 'crow', name: 'Crow', arabic: 'غُرَاب', mentions: 2, verses: 1, aliases: ['raven', 'ravens', 'crows'], storyId: 'raven' },
  { id: 'dog', name: 'Dog', arabic: 'كَلْب', mentions: 5, verses: 3, aliases: ['dogs', 'hound'], storyId: 'cave-dog' },
  { id: 'donkey', name: 'Donkey', arabic: 'حِمَار', mentions: 5, verses: 5, aliases: ['donkeys', 'ass'] },
  { id: 'elephant', name: 'Elephant', arabic: 'فِيل', mentions: 1, verses: 1, aliases: ['elephants'], storyId: 'elephant' },
  { id: 'ewe', name: 'Ewe', arabic: 'نَعْجَة', mentions: 4, verses: 2, aliases: ['ewes'] },
  { id: 'fish', name: 'Fish', arabic: 'حُوت', mentions: 5, verses: 5, aliases: ['whale', 'whales', 'great fish'] },
  { id: 'fly', name: 'Fly', arabic: 'ذُبَاب', mentions: 1, verses: 1, aliases: ['flies'] },
  { id: 'frog', name: 'Frog', arabic: 'ضِفْدَع', mentions: 1, verses: 1, aliases: ['frogs', 'toad'] },
  { id: 'goat', name: 'Goat', arabic: 'مَاعِز', mentions: 1, verses: 1, aliases: ['goats'] },
  { id: 'hoopoe', name: 'Hoopoe', arabic: 'هُدْهُد', mentions: 1, verses: 1, storyId: 'hoopoe' },
  { id: 'horse', name: 'Horse', arabic: 'خَيْل / حِصَان', mentions: 6, verses: 6, aliases: ['horses', 'steed', 'mare'] },
  { id: 'lice', name: 'Lice', arabic: 'قُمَّل', mentions: 1, verses: 1, aliases: ['louse'] },
  { id: 'lion', name: 'Lion', arabic: 'قَسْوَرَة', mentions: 1, verses: 1, aliases: ['lions'] },
  { id: 'locust', name: 'Locust', arabic: 'جَرَاد', mentions: 2, verses: 2, aliases: ['locusts'] },
  { id: 'mosquito', name: 'Mosquito', arabic: 'بَعُوضَة', mentions: 1, verses: 1, aliases: ['gnat', 'mosquitoes'] },
  { id: 'moth', name: 'Moth', arabic: 'فَرَاش', mentions: 1, verses: 1, aliases: ['moths'] },
  { id: 'mule', name: 'Mule', arabic: 'بَغْل', mentions: 1, verses: 1, aliases: ['mules'] },
  { id: 'pig', name: 'Pig', arabic: 'خِنْزِير', mentions: 5, verses: 5, aliases: ['swine', 'pigs', 'boar'] },
  { id: 'quail', name: 'Quail', arabic: 'سَلْوَى', mentions: 3, verses: 3, aliases: ['quails'] },
  { id: 'sheep', name: 'Sheep', arabic: 'غَنَم / ضَأْن', mentions: 3, verses: 3, aliases: ['lamb', 'ram', 'flock'] },
  { id: 'snake', name: 'Snake', arabic: 'ثُعْبَان / جَانّ / حَيَّة', mentions: 5, verses: 5, aliases: ['serpent', 'serpents', 'snakes', 'staff turned snake'] },
  { id: 'spider', name: 'Spider', arabic: 'عَنْكَبُوت', mentions: 2, verses: 1, aliases: ['spiders', 'web'], storyId: 'cave-spider' },
  { id: 'wolf', name: 'Wolf', arabic: 'ذِئْب', mentions: 3, verses: 3, aliases: ['wolves'] },
];

const LOOKUP: Record<string, QuranAnimal> = {};
for (const a of QURAN_ANIMALS) {
  LOOKUP[a.id] = a;
  LOOKUP[a.name.toLowerCase()] = a;
  for (const alias of a.aliases ?? []) LOOKUP[alias.toLowerCase()] = a;
}

/** Resolve free text (a word or short phrase) to a Qur'anic animal, or null. */
export function matchQuranAnimal(text: string): QuranAnimal | null {
  const t = text.trim().toLowerCase();
  if (LOOKUP[t]) return LOOKUP[t];
  // word-level scan so "tell me about the wolf" resolves
  for (const word of t.split(/[^a-z]+/).filter(Boolean)) {
    if (LOOKUP[word]) return LOOKUP[word];
  }
  return null;
}

export function isQuranAnimal(text: string): boolean {
  return matchQuranAnimal(text) !== null;
}

/** Comma list of every allowed animal, for prompts. */
export function quranAnimalNames(): string {
  return QURAN_ANIMALS.map((a) => a.name).join(', ');
}

/** The block injected into the storyteller's system prompt. */
export function quranAnimalListText(): string {
  return QURAN_ANIMALS.map(
    (a) => `- ${a.name} (${a.arabic}) — ${a.mentions}×/${a.verses} verse(s)${a.storyId ? ' — illustrated story ready' : ''}`,
  ).join('\n');
}
