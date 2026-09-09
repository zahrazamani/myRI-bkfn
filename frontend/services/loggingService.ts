import type { ChatMessage } from '../types';
import { CHATBOTS } from '../constants';
import { getHumanToken } from './geminiService';
import * as authService from './authService';

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export interface ChatLog {
  id: string;
  chatbotId: string;
  chatbotTitle: string;
  timestamp: string;
  messages: ChatMessage[];
}

/** Thrown by getLogs/clearLogs when the admin token is missing or wrong. */
export class LogAccessError extends Error {}

const ADMIN_TOKEN_KEY = 'mri-admin-token';

export const getAdminToken = (): string => {
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY) || '';
  } catch {
    return '';
  }
};

export const setAdminToken = (token: string): void => {
  try {
    if (token) sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
    else sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    /* ignore */
  }
};

/**
 * Log one finished conversation to the backend in a SINGLE request (S2).
 * Called once, at session end. Idempotent per session id on the backend.
 */
export const logChat = async (
  chatbotId: string,
  messages: ChatMessage[],
  language?: string,
): Promise<void> => {
  if (messages.length <= 1) return;

  const chatbot = CHATBOTS.find(cb => cb.id === chatbotId);
  if (!chatbot) return;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getHumanToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    await fetch(`${API_URL}/log/session`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        sessionId: `session-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        chatbotId,
        chatbotTitle: chatbot.title,
        identity: authService.getCurrentUser() || undefined,
        language: language || undefined,
        messages: messages.map(m => ({
          sender: m.sender,
          text: m.text || '',
          sources: m.sources && m.sources.length ? m.sources : undefined,
        })),
      }),
    });
  } catch (error) {
    console.error('Failed to log session to backend:', error);
  }
};

const adminHeaders = (token: string): Record<string, string> => {
  if (!token) throw new LogAccessError('An admin token is required.');
  return { 'Content-Type': 'application/json', 'X-Admin-Token': token };
};

/** Fetch grouped chat sessions. Needs the admin token. */
export const getLogs = async (token: string): Promise<ChatLog[]> => {
  const response = await fetch(`${API_URL}/logs`, { headers: adminHeaders(token) });
  if (response.status === 403) {
    throw new LogAccessError('That admin token was rejected.');
  }
  if (!response.ok) {
    throw new Error(`Error fetching logs: ${response.status}`);
  }
  return response.json();
};

/** Delete every stored transcript. Needs the admin token. */
export const clearLogs = async (token: string): Promise<void> => {
  const response = await fetch(`${API_URL}/logs`, {
    method: 'DELETE',
    headers: adminHeaders(token),
  });
  if (response.status === 403) {
    throw new LogAccessError('That admin token was rejected.');
  }
  if (!response.ok) {
    throw new Error(`Error clearing logs: ${response.status}`);
  }
};
