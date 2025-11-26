import type { Chatbot } from './types';
import { guardiansClubBot } from './chatbots/guardians-club';
import { superheroUniverseBot } from './chatbots/superhero-universe';
import { dailyDialogueBot } from './chatbots/daily-dialogue';
import { journeyBeliefsBot } from './chatbots/journey-beliefs';
import { myCompassBot } from './chatbots/my-compass';
import { betterMeBot } from './chatbots/better-me';

export const CHATBOTS: Chatbot[] = [
  guardiansClubBot,
  superheroUniverseBot,
  dailyDialogueBot,
  journeyBeliefsBot,
  myCompassBot,
  betterMeBot,
];