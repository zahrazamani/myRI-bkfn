
import React from 'react';
import type { Chatbot } from '../types';

interface ChatbotCardProps {
  chatbot: Chatbot;
  onStartChat: () => void;
}

const ChatbotCard: React.FC<ChatbotCardProps> = ({ chatbot, onStartChat }) => {
  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden transform hover:-translate-y-2 transition-transform duration-300 ease-in-out flex flex-col h-full">
      <div className="w-full h-80 bg-gray-100">
        <img className="w-full h-full object-cover" src={chatbot.imageUrl} alt={chatbot.title} />
      </div>
      <div className="p-6 flex flex-col flex-grow">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">{chatbot.title}</h3>
        <p className="text-gray-600 flex-grow">{chatbot.description}</p>
        <button
          onClick={onStartChat}
          className="mt-6 w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-300"
        >
          Start Chat
        </button>
      </div>
    </div>
  );
};

export default ChatbotCard;