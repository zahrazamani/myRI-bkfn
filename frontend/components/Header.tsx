import React from 'react';
import { t } from '../i18n';

interface HeaderProps {
  userEmail?: string | null;
  onLogout: () => void;
  language: string;
  onLanguageChange: (lang: string) => void;
  onViewLogs: () => void;
  onViewProfile: () => void;
}

const Header: React.FC<HeaderProps> = ({ userEmail, onLogout, language, onLanguageChange, onViewLogs, onViewProfile }) => {
  return (
    <header className="bg-white/30 backdrop-blur-lg shadow-sm sticky top-0 z-10">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
          My Real Intelligence
        </h1>
        <div className="flex items-center space-x-4 rtl:space-x-reverse">
          {userEmail && (
            <span className="hidden sm:inline text-sm text-gray-700 font-medium" title={userEmail}>
              {userEmail}
            </span>
          )}
          <div className="relative">
            <select
              className="appearance-none bg-white border border-gray-300 rounded-md py-2 px-4 pr-8 leading-tight focus:outline-none focus:bg-white focus:border-indigo-500"
              value={language}
              onChange={(e) => onLanguageChange(e.target.value)}
            >
              <option value="en">{t(language, 'language.en')}</option>
              <option value="fa">{t(language, 'language.fa')}</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
              </svg>
            </div>
          </div>
          <button
            onClick={onViewProfile}
            className="bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-md hover:bg-gray-300 transition-colors duration-300"
          >
            {t(language, 'header.profile')}
          </button>
          <button
            onClick={onViewLogs}
            className="bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-md hover:bg-gray-300 transition-colors duration-300"
          >
            {t(language, 'header.viewLogs')}
          </button>
          <button
            onClick={onLogout}
            className="bg-red-500 text-white font-semibold py-2 px-4 rounded-md hover:bg-red-600 transition-colors duration-300"
          >
            {t(language, 'header.logout')}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;