
export interface RagContext {
  context: string;
  sources: string[];
}

/**
 * Retrieves the most relevant context for a query using the backend RAG service.
 * @param chatbotId - The ID of the chatbot (currently only 'journey-beliefs' uses RAG).
 * @param query - The user's question.
 * @returns An object containing the context string and a list of sources, or null.
 */
export const retrieveContext = async (chatbotId: string, query: string): Promise<RagContext | null> => {
  // Only use RAG for specific chatbots if needed, or remove this check to use for all.
  if (chatbotId !== 'journey-beliefs' && chatbotId !== 'superhero-universe' && chatbotId !== 'daily-dialogue' && chatbotId !== 'my-compass' && chatbotId !== 'guardians-club') {
    return null;
  }

  try {
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, chatbotId }),
    });

    if (!response.ok) {
      throw new Error(`Backend error: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      context: data.context, // Backend now returns 'context' directly
      sources: data.sources
    };

  } catch (error) {
    console.error("Error retrieving context from RAG backend:", error);
    return null;
  }
};
