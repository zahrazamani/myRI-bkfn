
import React from 'react';
import type { Chatbot } from '../types';
import { t, type Lang } from '../i18n';

interface ChatbotCardProps {
  chatbot: Chatbot;
  onStartChat: () => void;
  language?: Lang;
}

const ChatbotCard: React.FC<ChatbotCardProps> = ({ chatbot, onStartChat, language = 'en' }) => {
  const description =
    (language !== 'en' && chatbot.translations?.[language]?.description) || chatbot.description;
  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden transform hover:-translate-y-2 transition-transform duration-300 ease-in-out flex flex-col h-full">
      <div className="w-full h-80 bg-gray-100">
        <img className="w-full h-full object-cover" src={chatbot.imageUrl} alt={chatbot.title} />
      </div>
      <div className="p-6 flex flex-col flex-grow">
        <h3 className="text-2xl font-bold text-gray-900 mb-2" dir="auto">{chatbot.title}</h3>
        <p className="text-gray-600 flex-grow" dir="auto">{description}</p>
        <button
          onClick={onStartChat}
          className="mt-6 w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-300"
        >
          {t(language, 'card.startChat')}
        </button>
      </div>
    </div>
  );
};

export default ChatbotCard;