import React from 'react';
import { t, type Lang } from '../i18n';

interface VoiceIndicatorProps {
  isListening: boolean;
  isSpeaking: boolean;
  interimTranscript: string;
  sttSupported: boolean;
  voiceUnavailableForLang: boolean;
  /** Tap the big mic: stops listening if active, otherwise starts (barge-in). */
  onTap: () => void;
  language?: Lang;
}

const BigMicIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
  </svg>
);

const VoiceIndicator: React.FC<VoiceIndicatorProps> = ({
  isListening,
  isSpeaking,
  interimTranscript,
  sttSupported,
  voiceUnavailableForLang,
  onTap,
  language = 'en',
}) => {
  const label = isListening
    ? t(language, 'voice.listening')
    : isSpeaking
      ? t(language, 'voice.speaking')
      : sttSupported
        ? t(language, 'voice.tapToTalk')
        : t(language, 'voice.repliesOn');

  return (
    <div className="px-4 pt-3">
      <div className="flex items-center gap-3 rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-purple-50 px-3 py-3">
        <button
          type="button"
          onClick={onTap}
          disabled={!sttSupported}
          aria-label={isListening ? t(language, 'voice.stopAria') : t(language, 'voice.startAria')}
          className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            isListening
              ? 'bg-red-500'
              : isSpeaking
                ? 'bg-purple-500'
                : 'bg-indigo-600 hover:bg-indigo-700'
          }`}
        >
          {isListening && (
            <span className="absolute inset-0 rounded-full bg-red-400 opacity-75 animate-ping" aria-hidden />
          )}
          {isSpeaking && !isListening && (
            <span className="absolute inset-0 rounded-full bg-purple-300 opacity-60 animate-pulse" aria-hidden />
          )}
          <span className="relative">
            <BigMicIcon />
          </span>
        </button>

        <div className="min-w-0 flex-grow">
          <p className="text-sm font-semibold text-indigo-700">{label}</p>
          {isListening && (
            <p className="truncate text-sm text-gray-600">{interimTranscript || '…'}</p>
          )}
          {!sttSupported && (
            <p className="mt-0.5 text-xs text-amber-700">
              {t(language, 'voice.notSupported')}
            </p>
          )}
          {sttSupported && voiceUnavailableForLang && (
            <p className="mt-0.5 text-xs text-amber-700">
              {t(language, 'voice.noVoiceForLang')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoiceIndicator;
