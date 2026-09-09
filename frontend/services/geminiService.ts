// All model calls now go through the MYRI backend (/chat), so the API key never
// ships to the browser. The backend also does RAG retrieval and enforces rate
// limits + a daily budget.
//
// Runtime image generation (Imagen) was removed to cut cost. The storyteller bot
// shows pre-generated illustrations from frontend/public/illustrations/ via
// [show_image: <id>] commands — see frontend/data/illustrations.ts.

import * as authService from './authService';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const HUMAN_TOKEN_KEY = 'mri-human-token';

export function setHumanToken(token: string): void {
  try {
    localStorage.setItem(HUMAN_TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

export function getHumanToken(): string | null {
  try {
    return localStorage.getItem(HUMAN_TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Thrown when the backend has hit its daily budget and is "resting". */
export class RestingError extends Error {}

export interface ChatReply {
  text: string;
  sources?: string[];
}

export interface ChatSession {
  sendMessage: (input: { message: string }) => Promise<ChatReply>;
}

interface Turn {
  role: 'user' | 'model';
  text: string;
}

/**
 * Opens a chat session bound to one chatbot. Conversation history is kept here
 * and sent to the backend on each turn.
 */
export const startChat = async (
  systemInstruction: string,
  chatbotId: string,
  language: string = 'en',
): Promise<ChatSession> => {
  const history: Turn[] = [];

  return {
    async sendMessage({ message }): Promise<ChatReply> {
      history.push({ role: 'user', text: message });

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = getHumanToken();
      if (token) headers.Authorization = `Bearer ${token}`;

      let res: Response;
      try {
        res = await fetch(`${API_BASE}/chat`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            chatbotId,
            systemInstruction,
            messages: history,
            identity: authService.getCurrentUser(),
            language,
          }),
        });
      } catch (err) {
        history.pop();
        throw new Error('Could not reach MYRI. Please check your connection and try again.');
      }

      if (res.status === 429) {
        history.pop();
        const body = await res.json().catch(() => ({}));
        throw new RestingError(
          body.message || 'MYRI is resting for now. Please try again a little later.',
        );
      }
      if (res.status === 401) {
        history.pop();
        throw new Error('Please refresh the page and verify you are human to continue.');
      }
      if (!res.ok) {
        history.pop();
        throw new Error(`MYRI had a problem answering (${res.status}). Please try again.`);
      }

      const data = await res.json();
      const reply: ChatReply = { text: (data.text || '').trim(), sources: data.sources || [] };
      history.push({ role: 'model', text: reply.text });
      return reply;
    },
  };
};

/**
 * "Bring it to life": turns a child's own description of a story scene into one
 * illustration, styled to match that story's artwork. Heavily rate-limited and
 * budget-capped on the backend. Returns a `data:image/...;base64,...` URL.
 */
export async function generateKidIllustration(
  storyId: string,
  description: string,
): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getHumanToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/illustrate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        storyId,
        description,
        identity: authService.getCurrentUser(),
      }),
    });
  } catch {
    throw new Error('Could not reach MYRI. Please check your connection and try again.');
  }

  if (res.status === 429) {
    const body = await res.json().catch(() => ({}));
    throw new RestingError(
      body.message || 'MYRI has drawn a lot of pictures today. Please try again a little later.',
    );
  }
  if (res.status === 401) {
    throw new Error('Please refresh the page and verify you are human to continue.');
  }
  if (!res.ok) {
    throw new Error(`MYRI could not draw that this time (${res.status}). Please try again.`);
  }

  const data = await res.json();
  if (!data.image) throw new Error('MYRI could not draw that this time. Please try again.');
  return data.image as string;
}

/**
 * Exchanges a Cloudflare Turnstile token for a short-lived "human verified"
 * token. Safe to call when Turnstile is disabled server-side (returns quietly).
 */
export const verifyHuman = async (turnstileToken: string): Promise<boolean> => {
  try {
    const res = await fetch(`${API_BASE}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: turnstileToken, identity: authService.getCurrentUser() }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.token) {
      setHumanToken(data.token);
      return true;
    }
    return false;
  } catch {
    return false;
  }
};
