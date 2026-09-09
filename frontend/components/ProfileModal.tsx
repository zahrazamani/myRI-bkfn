import React, { useMemo } from 'react';
import { loadProfile, buildProfileSummary } from '../services/profile';
import { t, type Lang } from '../i18n';

interface ProfileModalProps {
  onClose: () => void;
  language?: Lang;
}

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const fmtDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString() : '—';

const ProfileModal: React.FC<ProfileModalProps> = ({ onClose, language = 'en' }) => {
  // Read-only snapshot taken when the modal opens.
  const summary = useMemo(() => buildProfileSummary(loadProfile()), []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl h-[90vh] max-h-[800px] flex flex-col">
        <header className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-indigo-700">{t(language, 'profile.title')}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 transition-colors">
            <CloseIcon />
          </button>
        </header>

        <div className="flex-grow overflow-y-auto bg-gray-50 p-4 space-y-6">
          {/* Headline stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-indigo-100 p-4 text-center">
              <div className="text-2xl font-bold text-indigo-700">
                🔥 {summary.streakCount}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {t(language, 'profile.dayStreak')}{summary.streakActiveToday ? ` · ${t(language, 'profile.activeToday')}` : ''}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-indigo-100 p-4 text-center">
              <div className="text-2xl font-bold text-indigo-700">{summary.totalVisits}</div>
              <div className="text-xs text-gray-500 mt-1">{t(language, 'profile.totalVisits')}</div>
            </div>
            <div className="bg-white rounded-xl border border-indigo-100 p-4 text-center">
              <div className="text-2xl font-bold text-indigo-700">{summary.totalReflections}</div>
              <div className="text-xs text-gray-500 mt-1">{t(language, 'profile.reflections')}</div>
            </div>
          </div>

          {/* Per-bot table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <h3 className="font-bold text-gray-800 px-4 py-3 border-b border-gray-200">{t(language, 'profile.guides')}</h3>
            {summary.rows.length === 0 ? (
              <p className="text-sm text-gray-500 px-4 py-6 text-center">
                {t(language, 'profile.noVisits')}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left rtl:text-right text-xs text-gray-500 border-b border-gray-200">
                      <th className="px-4 py-2 font-semibold">{t(language, 'profile.colGuide')}</th>
                      <th className="px-4 py-2 font-semibold text-right rtl:text-left">{t(language, 'profile.colVisits')}</th>
                      <th className="px-4 py-2 font-semibold text-right rtl:text-left">{t(language, 'profile.colSessions')}</th>
                      <th className="px-4 py-2 font-semibold text-right rtl:text-left">{t(language, 'profile.colReflections')}</th>
                      <th className="px-4 py-2 font-semibold text-right rtl:text-left">{t(language, 'profile.colLastVisit')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.rows.map(row => (
                      <tr key={row.botId} className="border-b border-gray-100 last:border-0">
                        <td className="px-4 py-2 text-gray-800" dir="auto">{row.title}</td>
                        <td className="px-4 py-2 text-right rtl:text-left text-gray-600">{row.visits}</td>
                        <td className="px-4 py-2 text-right rtl:text-left text-gray-600">{row.sessions}</td>
                        <td className="px-4 py-2 text-right rtl:text-left text-gray-600">{row.reflections}</td>
                        <td className="px-4 py-2 text-right rtl:text-left text-gray-500">{fmtDate(row.lastVisit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Badge shelf */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-bold text-gray-800 mb-3">{t(language, 'profile.badges')}</h3>
            {summary.badges.length === 0 ? (
              <p className="text-sm text-gray-500">
                {t(language, 'profile.noBadges')}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {summary.badges.map(badge => (
                  <span
                    key={badge.id}
                    title={`${badge.label} · ${fmtDate(badge.at)}`}
                    className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-full px-3 py-1 text-xs font-semibold"
                  >
                    🏅 {badge.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
