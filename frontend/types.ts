import type { Lang } from './i18n';

export interface ChatbotTranslation {
  welcomeMessage?: string;
  examplePrompts?: string[];
  description?: string;
}

export interface Chatbot {
  id: string;
  title: string;
  description: string;
  ageGroup: '11-15' | '16+' | 'all';
  systemPrompt: string;
  imageUrl: string;
  welcomeMessage: string;
  examplePrompts?: string[];
  isRag?: boolean;
  stages?: string[];
  // Optional per-language overrides for the user-facing chrome of a bot. The
  // long systemPrompt stays English; the backend Farsi directive handles the
  // in-conversation translation. Currently populated for the kids' bots only.
  translations?: Partial<Record<Lang, ChatbotTranslation>>;
}

export interface ChatMessage {
  sender: 'user' | 'bot';
  text?: string;
  imageUrl?: string;
  sources?: string[];
}