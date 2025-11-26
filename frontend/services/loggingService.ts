import type { ChatMessage, Chatbot } from '../types';
import { CHATBOTS } from '../constants';


const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export interface ChatLog {
  id: string;
  chatbotId: string;
  chatbotTitle: string;
  timestamp: string;
  messages: ChatMessage[];
}

/**
 * Logs a chat session to the backend.
 *
 * @param chatbotId - The ID of the chatbot used in the session.
 * @param messages - The array of chat messages from the session.
 */
export const logChat = async (chatbotId: string, messages: ChatMessage[]): Promise<void> => {
  if (messages.length <= 1) {
    return;
  }

  const chatbot = CHATBOTS.find(cb => cb.id === chatbotId);
  if (!chatbot) return;

  const sessionId = `session-${Date.now()}-${Math.random()}`;

  // We need to send each message individually or batch them.
  // The backend expects individual messages for now based on my implementation plan,
  // but let's check the backend implementation.
  // Backend `log_message` takes one message at a time.
  // Ideally, we should batch this, but for now let's iterate.
  // Wait, the backend `log_message` inserts one row.
  // And `get_logs` groups them by session.

  // So we should iterate through messages and send them.
  // To avoid spamming requests, we could update the backend to accept a batch.
  // But strictly following the current backend `log_message` signature:

  for (const msg of messages) {
    try {
      await fetch(`${API_URL}/log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          chatbotId,
          chatbotTitle: chatbot.title,
          sender: msg.sender,
          message: msg.text || '',
          sources: msg.sources
        }),
      });
    } catch (error) {
      console.error("Failed to log message to backend:", error);
    }
  }
};

/**
 * Retrieves all chat logs from the backend.
 * @returns An array of ChatLog objects.
 */
export const getLogs = async (): Promise<ChatLog[]> => {
  try {
    const response = await fetch(`${API_URL}/logs`);
    if (!response.ok) {
      throw new Error(`Error fetching logs: ${response.statusText}`);
    }
    const logs = await response.json();
    return logs;
  } catch (error) {
    console.error("Could not retrieve logs from backend:", error);
    return [];
  }
};

/**
 * Clears all chat logs from the backend.
 */
export const clearLogs = async (): Promise<void> => {
  try {
    await fetch(`${API_URL}/logs`, {
      method: 'DELETE',
    });
  } catch (error) {
    console.error("Could not clear logs from backend:", error);
  }
};