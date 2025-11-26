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
}

export interface ChatMessage {
  sender: 'user' | 'bot';
  text?: string;
  imageUrl?: string;
  sources?: string[];
}