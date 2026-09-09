import React, { useEffect, useRef, useState } from 'react';
import * as authService from '../services/authService';
import { verifyHuman } from '../services/geminiService';
import { t, type Lang } from '../i18n';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
    };
  }
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  // The login screen renders before App's language state exists, so it keeps its
  // own lightweight toggle and syncs document dir/lang itself.
  const [lang, setLang] = useState<Lang>('en');
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
  }, [lang]);
  // When Turnstile is not configured, treat the user as already verified.
  const [verified, setVerified] = useState(!TURNSTILE_SITE_KEY);
  const widgetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    const scriptId = 'cf-turnstile-script';
    const render = () => {
      if (!window.turnstile || !widgetRef.current || widgetRef.current.childElementCount) return;
      window.turnstile.render(widgetRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: async (token: string) => {
          const ok = await verifyHuman(token);
          setVerified(ok);
          if (!ok) setError(t(lang, 'login.errVerify'));
        },
        'error-callback': () => setVerified(false),
        'expired-callback': () => setVerified(false),
      });
    };
    if (!document.getElementById(scriptId)) {
      const s = document.createElement('script');
      s.id = scriptId;
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      s.async = true;
      s.onload = render;
      document.head.appendChild(s);
    } else {
      render();
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!verified) {
      setError(t(lang, 'login.errHuman'));
      return;
    }
    if (authService.login(email)) {
      setError('');
      onLoginSuccess();
    } else {
      setError(t(lang, 'login.errEmail'));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-100 via-indigo-100 to-blue-200">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-2xl shadow-2xl">
        <div>
          <div className="flex justify-center gap-2 mb-4">
            {(['en', 'fa'] as Lang[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className={`text-xs font-semibold rounded-full px-3 py-1 transition-colors ${
                  lang === l ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t(lang, l === 'en' ? 'language.en' : 'language.fa')}
              </button>
            ))}
          </div>
          <h1 className="text-4xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
            My Real Intelligence
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            {t(lang, 'login.subtitle')}
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                {t(lang, 'login.emailLabel')}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                dir="ltr"
                className="appearance-none rounded-md relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder={t(lang, 'login.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {TURNSTILE_SITE_KEY && <div ref={widgetRef} className="flex justify-center" />}

          {error && (
            <p className="text-sm text-red-600 text-center">{error}</p>
          )}

          <div>
            <button
              type="submit"
              disabled={!verified}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:bg-indigo-300 disabled:cursor-not-allowed"
            >
              {t(lang, 'login.signIn')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
