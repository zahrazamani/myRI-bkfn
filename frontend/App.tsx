import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import ChatbotCard from './components/ChatbotCard';
import ChatModal from './components/ChatModal';
import LoginPage from './components/LoginPage';
import LogViewerModal from './components/LogViewerModal';
import ProfileModal from './components/ProfileModal';
import { CHATBOTS } from './constants';
import * as authService from './services/authService';
import type { Chatbot } from './types';
import { t, type Lang } from './i18n';

const App: React.FC = () => {
  const [activeChatbot, setActiveChatbot] = useState<Chatbot | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(authService.getCurrentUser());
  const [language, setLanguage] = useState<Lang>('en');
  const [isLogViewerOpen, setIsLogViewerOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const isAuthenticated = userEmail !== null;

  // Keep the document's language + direction in sync so Tailwind `rtl:` variants
  // and the Farsi font (see index.html) apply across the whole app.
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'fa' ? 'rtl' : 'ltr';
  }, [language]);

  const openChat = (chatbot: Chatbot) => {
    setActiveChatbot(chatbot);
  };

  const closeChat = () => {
    setActiveChatbot(null);
  };

  const handleLoginSuccess = () => {
    setUserEmail(authService.getCurrentUser());
  };

  const handleLogout = () => {
    authService.logout();
    setUserEmail(null);
  };

  const botsFor11To15 = CHATBOTS.filter(bot => bot.ageGroup === '11-15');
  const botsForOlder = CHATBOTS.filter(bot => bot.ageGroup === '16+' || bot.ageGroup === 'all');

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen text-gray-800 font-sans">
      <div 
        className="fixed inset-0 bg-cover bg-center -z-10"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1506260408121-e353d10b87c7?q=80&w=2728&auto=format&fit=crop')" }}
      />
      <div className="fixed inset-0 bg-gradient-to-br from-purple-100/70 via-indigo-100/70 to-blue-200/70 -z-10" />

      <Header
        userEmail={userEmail}
        onLogout={handleLogout}
        language={language}
        onLanguageChange={(lang) => setLanguage(lang as Lang)}
        onViewLogs={() => setIsLogViewerOpen(true)}
        onViewProfile={() => setIsProfileOpen(true)}
      />
      <main className="container mx-auto px-4 py-8 md:py-12">

        <section className="mb-16">
          <h2 className="text-4xl font-bold text-center text-indigo-700 mb-2">{t(language, 'home.kidsHeading')}</h2>
          <p className="text-center text-gray-600 mb-8 max-w-2xl mx-auto">{t(language, 'home.kidsSubheading')}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {botsFor11To15.map(bot => (
              <ChatbotCard key={bot.id} chatbot={bot} onStartChat={() => openChat(bot)} language={language} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-4xl font-bold text-center text-indigo-700 mb-2">{t(language, 'home.olderHeading')}</h2>
          <p className="text-center text-gray-600 mb-8 max-w-2xl mx-auto">{t(language, 'home.olderSubheading')}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {botsForOlder.map(bot => (
              <ChatbotCard key={bot.id} chatbot={bot} onStartChat={() => openChat(bot)} language={language} />
            ))}
          </div>
        </section>

      </main>

      {activeChatbot && <ChatModal chatbot={activeChatbot} onClose={closeChat} language={language} />}
      {isLogViewerOpen && <LogViewerModal onClose={() => setIsLogViewerOpen(false)} />}
      {isProfileOpen && <ProfileModal onClose={() => setIsProfileOpen(false)} language={language} />}
    </div>
  );
};

export default App;