import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import ChatbotCard from './components/ChatbotCard';
import ChatModal from './components/ChatModal';
import LoginPage from './components/LoginPage';
import LogViewerModal from './components/LogViewerModal';
import { CHATBOTS } from './constants';
import * as authService from './services/authService';
import type { Chatbot } from './types';

const App: React.FC = () => {
  const [activeChatbot, setActiveChatbot] = useState<Chatbot | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(authService.isAuthenticated());
  const [language, setLanguage] = useState('en');
  const [isLogViewerOpen, setIsLogViewerOpen] = useState(false);

  const openChat = (chatbot: Chatbot) => {
    setActiveChatbot(chatbot);
  };

  const closeChat = () => {
    setActiveChatbot(null);
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    authService.logout();
    setIsAuthenticated(false);
  };

  const botsFor11To15 = CHATBOTS.filter(bot => bot.ageGroup === '11-15');
  const botsForOlder = CHATBOTS.filter(bot => bot.ageGroup === '16+' || bot.ageGroup === 'all');

  return (
    <div className="min-h-screen text-gray-800 font-sans">
      <div 
        className="fixed inset-0 bg-cover bg-center -z-10"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1506260408121-e353d10b87c7?q=80&w=2728&auto=format&fit=crop')" }}
      />
      <div className="fixed inset-0 bg-gradient-to-br from-purple-100/70 via-indigo-100/70 to-blue-200/70 -z-10" />

      <Header 
        onLogout={handleLogout} 
        language={language} 
        onLanguageChange={setLanguage}
        onViewLogs={() => setIsLogViewerOpen(true)}
      />
      <main className="container mx-auto px-4 py-8 md:py-12">
        
        <section className="mb-16">
          <h2 className="text-4xl font-bold text-center text-indigo-700 mb-2">For Ages 11-15</h2>
          <p className="text-center text-gray-600 mb-8 max-w-2xl mx-auto">Discover stories and explore what it means to be a hero in your own life.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {botsFor11To15.map(bot => (
              <ChatbotCard key={bot.id} chatbot={bot} onStartChat={() => openChat(bot)} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-4xl font-bold text-center text-indigo-700 mb-2">For Deeper Exploration (16+)</h2>
          <p className="text-center text-gray-600 mb-8 max-w-2xl mx-auto">Engage in deeper conversations, explore fundamental beliefs, and work on personal growth.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {botsForOlder.map(bot => (
              <ChatbotCard key={bot.id} chatbot={bot} onStartChat={() => openChat(bot)} />
            ))}
          </div>
        </section>
        
      </main>
      
      {activeChatbot && <ChatModal chatbot={activeChatbot} onClose={closeChat} language={language} />}
      {isLogViewerOpen && <LogViewerModal onClose={() => setIsLogViewerOpen(false)} />}
    </div>
  );
};

export default App;