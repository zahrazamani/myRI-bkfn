import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Hands-free "Voice Mode" conversation loop for the chat.
 *
 * State machine (per turn):
 *   idle ──speakReply(text, isFinal)──▶ speaking
 *   speaking ──utterance.onend / watchdog──▶ (isFinal ? listening : idle)
 *   speaking ──startListening() (barge-in)──▶ listening   (speech cancelled)
 *   listening ──recognition final transcript / onend──▶ sending ──▶ idle
 *   listening ──tap indicator (stopListening)──▶ sending (partial) ──▶ idle
 *
 * All Web Speech usage is behind feature checks + try/catch — a missing or
 * throwing speech API must never crash the app.
 */

const VOICE_MODE_KEY = 'mri-voice-mode';

function readStoredVoiceMode(): boolean {
  try {
    return localStorage.getItem(VOICE_MODE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeStoredVoiceMode(on: boolean): void {
  try {
    localStorage.setItem(VOICE_MODE_KEY, on ? '1' : '0');
  } catch {
    /* ignore — storage may be unavailable (private mode etc.) */
  }
}

function getSpeechRecognitionCtor(): any {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

interface UseVoiceConversationOptions {
  /** Full locale, e.g. languageMap[language] -> 'en-US'. */
  locale: string;
  /** Base language key, e.g. 'en'. */
  baseLang: string;
  /** Voices loaded from window.speechSynthesis (may be empty early on). */
  voices: SpeechSynthesisVoice[];
  /** Called with a final recognised transcript while Voice Mode is on. */
  onFinalTranscript: (text: string) => void;
}

export interface VoiceConversation {
  voiceMode: boolean;
  toggleVoiceMode: () => void;
  isSpeaking: boolean;
  isListening: boolean;
  interimTranscript: string;
  /** Web Speech recognition available in this browser. */
  sttSupported: boolean;
  /** speechSynthesis has voices, but none usable for the current language. */
  voiceUnavailableForLang: boolean;
  /**
   * Speak a bot reply aloud. When Voice Mode is on and `isFinal` is true, the
   * mic auto-starts once speech finishes. `isFinal` is false only for the
   * non-last paragraph of a journey-beliefs multi-paragraph reply.
   */
  speakReply: (rawText: string, isFinal?: boolean) => void;
  startListening: () => void;
  stopListening: () => void;
  /** Full teardown: cancel synthesis + recognition + timers. */
  cancelAll: () => void;
}

export function useVoiceConversation(opts: UseVoiceConversationOptions): VoiceConversation {
  const { locale, baseLang, voices, onFinalTranscript } = opts;

  const [voiceMode, setVoiceMode] = useState<boolean>(readStoredVoiceMode);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');

  const sttSupported = !!getSpeechRecognitionCtor();

  const hasSynth = typeof window !== 'undefined' && !!window.speechSynthesis;
  // Only flag "no voice for this language" when we actually have a voice list to
  // check against — an empty list usually just means voices haven't loaded yet.
  const voiceUnavailableForLang =
    hasSynth &&
    voices.length > 0 &&
    !voices.some(
      v => v.lang === locale || v.lang.toLowerCase().startsWith(baseLang.toLowerCase()),
    );

  // --- refs (avoid stale closures in the async speech callbacks) ---
  const recognitionRef = useRef<any>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speechCancelledRef = useRef(false);
  const watchdogRef = useRef<number | null>(null);
  const finalTranscriptRef = useRef('');

  const voiceModeRef = useRef(voiceMode);
  const onFinalRef = useRef(onFinalTranscript);
  const localeRef = useRef(locale);
  const baseLangRef = useRef(baseLang);
  const voicesRef = useRef(voices);

  useEffect(() => { voiceModeRef.current = voiceMode; }, [voiceMode]);
  useEffect(() => { onFinalRef.current = onFinalTranscript; }, [onFinalTranscript]);
  useEffect(() => { localeRef.current = locale; }, [locale]);
  useEffect(() => { baseLangRef.current = baseLang; }, [baseLang]);
  useEffect(() => { voicesRef.current = voices; }, [voices]);

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current != null) {
      try { window.clearTimeout(watchdogRef.current); } catch { /* ignore */ }
      watchdogRef.current = null;
    }
  }, []);

  const stopListening = useCallback(() => {
    const rec = recognitionRef.current;
    if (rec) {
      try { rec.stop(); } catch { /* ignore */ }
    }
  }, []);

  const abortListening = useCallback(() => {
    const rec = recognitionRef.current;
    if (rec) {
      try { rec.abort(); } catch { /* ignore */ }
    }
    finalTranscriptRef.current = '';
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  const cancelSpeech = useCallback(() => {
    speechCancelledRef.current = true;
    clearWatchdog();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
    }
    utteranceRef.current = null;
    setIsSpeaking(false);
  }, [clearWatchdog]);

  const cancelAll = useCallback(() => {
    cancelSpeech();
    abortListening();
  }, [cancelSpeech, abortListening]);

  const startListening = useCallback(() => {
    // Barge-in: any in-progress speech is cancelled before we listen.
    cancelSpeech();

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return; // no STT in this browser — caller surfaces the note

    let rec = recognitionRef.current;
    if (!rec) {
      try {
        rec = new Ctor();
      } catch {
        return;
      }
      recognitionRef.current = rec;
    }

    try {
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = localeRef.current;
    } catch { /* ignore */ }

    finalTranscriptRef.current = '';
    setInterimTranscript('');

    rec.onresult = (event: any) => {
      let interim = '';
      let added = '';
      try {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const chunk = result[0]?.transcript ?? '';
          if (result.isFinal) added += chunk;
          else interim += chunk;
        }
      } catch { /* ignore malformed event */ }
      if (added) finalTranscriptRef.current += added;
      setInterimTranscript((finalTranscriptRef.current + interim).trim());
    };

    rec.onerror = (event: any) => {
      // 'no-speech', 'aborted', 'not-allowed', 'network', ... — never throw.
      // eslint-disable-next-line no-console
      console.warn('[voice] recognition error:', event?.error);
      setIsListening(false);
      setInterimTranscript('');
    };

    rec.onend = () => {
      setIsListening(false);
      const text = finalTranscriptRef.current.trim();
      finalTranscriptRef.current = '';
      setInterimTranscript('');
      if (text && voiceModeRef.current) {
        try { onFinalRef.current(text); } catch { /* ignore */ }
      }
    };

    try {
      rec.start();
      setIsListening(true);
    } catch {
      // start() throws if it's already running — recycle it.
      try { rec.stop(); } catch { /* ignore */ }
      setIsListening(false);
    }
  }, [cancelSpeech]);

  const speakReply = useCallback((rawText: string, isFinal: boolean = true) => {
    if (!voiceModeRef.current || !rawText) return;

    const afterSpeech = () => {
      clearWatchdog();
      utteranceRef.current = null;
      setIsSpeaking(false);
      if (voiceModeRef.current && isFinal && !speechCancelledRef.current) {
        startListening();
      }
    };

    // Read the words, not the markdown punctuation (mirrors ChatModal.speak).
    const text = rawText.replace(/[*_`#]/g, '').replace(/^\s*[-•]\s+/gm, '').trim();

    const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    if (!text || !synth) {
      // Nothing to say / no TTS engine — keep the loop alive so we still listen.
      speechCancelledRef.current = false;
      try { window.setTimeout(afterSpeech, 0); } catch { afterSpeech(); }
      return;
    }

    speechCancelledRef.current = false;
    try { synth.cancel(); } catch { /* ignore */ }

    let utterance: SpeechSynthesisUtterance;
    try {
      utterance = new SpeechSynthesisUtterance(text);
    } catch {
      window.setTimeout(afterSpeech, 0);
      return;
    }

    const lc = localeRef.current;
    const base = baseLangRef.current;
    const vs = voicesRef.current;
    utterance.lang = lc;
    const picked =
      vs.find(v => v.lang === lc && v.name.toLowerCase().includes('male') && v.name.toLowerCase().includes('google')) ||
      vs.find(v => v.lang === lc && v.name.toLowerCase().includes('male')) ||
      vs.find(v => v.lang.startsWith(base) && v.name.toLowerCase().includes('male')) ||
      vs.find(v => v.lang === lc) ||
      vs.find(v => v.lang.startsWith(base));
    if (picked) utterance.voice = picked;

    utterance.onend = afterSpeech;
    utterance.onerror = afterSpeech;
    utteranceRef.current = utterance;
    setIsSpeaking(true);

    // Watchdog — some engines never fire onend (especially right after a
    // cancel()). Estimate ~14 chars/sec + 3s slack, then force the loop on.
    clearWatchdog();
    try {
      watchdogRef.current = window.setTimeout(() => {
        if (utteranceRef.current === utterance) {
          try { synth.cancel(); } catch { /* ignore */ }
          afterSpeech();
        }
      }, Math.min(60000, 3000 + (text.length / 14) * 1000));
    } catch { /* ignore */ }

    try {
      synth.speak(utterance);
    } catch {
      afterSpeech();
    }
  }, [clearWatchdog, startListening]);

  const toggleVoiceMode = useCallback(() => {
    setVoiceMode(prev => {
      const next = !prev;
      voiceModeRef.current = next;
      writeStoredVoiceMode(next);
      if (!next) {
        // Turning off mid-turn: tear everything down.
        cancelSpeech();
        abortListening();
      }
      return next;
    });
  }, [cancelSpeech, abortListening]);

  // Language changed — recycle the recognition instance so the next listen
  // picks up the new locale cleanly.
  useEffect(() => {
    const rec = recognitionRef.current;
    if (rec) {
      try { rec.abort(); } catch { /* ignore */ }
    }
    recognitionRef.current = null;
    setIsListening(false);
    setInterimTranscript('');
  }, [locale]);

  // Full teardown on unmount.
  useEffect(() => {
    return () => {
      cancelSpeech();
      abortListening();
    };
  }, [cancelSpeech, abortListening]);

  return {
    voiceMode,
    toggleVoiceMode,
    isSpeaking,
    isListening,
    interimTranscript,
    sttSupported,
    voiceUnavailableForLang,
    speakReply,
    startListening,
    stopListening,
    cancelAll,
  };
}
