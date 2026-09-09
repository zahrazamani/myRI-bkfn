
import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Chatbot, ChatMessage } from '../types';
import { startChat, RestingError, generateKidIllustration, type ChatSession } from '../services/geminiService';
import { logChat } from '../services/loggingService';
import { illustrationUrl, newStorySeed, PLACEHOLDER_IMAGE } from '../data/illustrations';
import GameMap from './GameMap';
import HeroCard from './HeroCard';
import RichText from './RichText';
import VoiceIndicator from './VoiceIndicator';
import { useVoiceConversation } from '../hooks/useVoiceConversation';
import { t, type Lang } from '../i18n';
import {
  loadHeroProfile, saveHeroProfile, registerVisit, addPoints, unlockVirtue,
  addLogEntry, setIdentity, recordSideQuest, buildHeroContext,
  VIRTUE_META, type HeroProfile, type VirtueId,
} from '../services/heroProfile';
import {
  loadProfile, saveProfile, registerVisit as registerProfileVisit,
  registerMessage as registerProfileMessage, recordSessionEnd, awardBadge,
  buildProfileSummary, slugify, type UserProfile,
} from '../services/profile';

interface ChatModalProps {
  chatbot: Chatbot;
  onClose: () => void;
  language: Lang;
}

// Slim, one-line cross-bot progress band shown above the chat for every bot
// except Superhero (which has its own richer HeroCard). Streak flame + count,
// this bot's visits/sessions, and the total badge count.
const ProfileStrip: React.FC<{ profile: UserProfile; botId: string; language: Lang }> = ({ profile, botId, language }) => {
  const summary = buildProfileSummary(profile);
  const here = summary.rows.find(r => r.botId === botId);
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 px-3 py-2 text-xs text-indigo-700">
      <span className="font-semibold">🔥 {summary.streakCount} {t(language, summary.streakCount === 1 ? 'chat.strip.day' : 'chat.strip.days')}</span>
      <span className="text-indigo-300" aria-hidden>·</span>
      <span>{here?.visits ?? 0} {t(language, 'chat.strip.visitsHere')}</span>
      <span className="text-indigo-300" aria-hidden>·</span>
      <span>{here?.sessions ?? 0} {t(language, 'chat.strip.sessions')}</span>
      <span className="text-indigo-300" aria-hidden>·</span>
      <span>🏅 {summary.badgeCount} {t(language, summary.badgeCount === 1 ? 'chat.strip.badge' : 'chat.strip.badges')}</span>
    </div>
  );
};

// --- START: ICONS ---
const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const SendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);

const MicIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
  </svg>
);

const SpeakerOnIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
  </svg>
);

const SpeakerOffIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l-2-2m0 0l-2-2m2 2l2-2m-2 2l-2 2" />
    </svg>
);
// --- END: ICONS ---

const languageMap: { [key: string]: string } = {
  en: 'en-US',
  ar: 'ar-SA',
  fa: 'fa-IR',
};

const ChatModal: React.FC<ChatModalProps> = ({ chatbot, onClose, language }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showExamples, setShowExamples] = useState(true);
  
  // Voice feature state
  const [isTtsEnabled, setIsTtsEnabled] = useState(false); // TTS is off by default
  const [isListening, setIsListening] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const recognitionRef = useRef<any>(null); // Using 'any' for SpeechRecognition to handle vendor prefixes

  // Gamification state
  const [heroPoints, setHeroPoints] = useState(0);
  const [currentStage, setCurrentStage] = useState(chatbot.stages ? chatbot.stages[0] : '');
  // Persistent superhero progress (localStorage, per user). Held in a ref so the
  // command handlers can update it without stale-closure issues.
  const heroRef = useRef<HeroProfile | null>(null);
  const [heroProfile, setHeroProfile] = useState<HeroProfile | null>(null);

  const persistHero = useCallback((next: HeroProfile) => {
    heroRef.current = next;
    setHeroProfile(next);
    saveHeroProfile(next);
  }, []);

  // Cross-bot user profile (streak, per-bot visits/sessions/reflections, badges).
  // Held in a ref so command handlers avoid stale closures; mirrored to state so
  // the ProfileStrip re-renders.
  const profileRef = useRef<UserProfile | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  // User messages sent in this session — drives the "reflection" tally on close.
  const userMsgCountRef = useRef(0);

  const persistProfile = useCallback((next: UserProfile) => {
    profileRef.current = next;
    setProfile(next);
    saveProfile(next);
  }, []);

  const [responseQueue, setResponseQueue] = useState<string[]>([]);
  const [queuedSources, setQueuedSources] = useState<string[]>([]);
  // Choose-your-path: the storyteller can emit [choices: A | B] to offer a
  // branch. We render the parsed options as tappable buttons under the latest
  // bot message; picking one sends it like a typed reply. Generic (any bot),
  // but only guardians-club is prompted to use it.
  const [pendingChoices, setPendingChoices] = useState<string[]>([]);
  const chatRef = useRef<ChatSession | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // "Bring it to life": after a story, the storyteller emits [offer_draw: <storyId>]
  // and the child describes their own scene, which we turn into one illustration.
  const [drawStoryId, setDrawStoryId] = useState<string | null>(null);
  const usedDrawRef = useRef(false);
  // One variant set per story session, so a re-read looks different (see illustrations.ts).
  const storySeedRef = useRef<string>(newStorySeed());

  // --- START: VOICE-OVER LOGIC ---
  useEffect(() => {
    const loadVoices = () => {
      setVoices(window.speechSynthesis.getVoices());
    };
    // Voices are loaded asynchronously
    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices(); // Initial load
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  useEffect(() => {
    // Fix: Cast window to any to access vendor-prefixed SpeechRecognition API
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.lang = languageMap[language];
      recognition.interimResults = false;
      
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setUserInput(transcript);
      };
      recognition.onend = () => {
        setIsListening(false);
      };
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };
      recognitionRef.current = recognition;
    }
  }, [language]);

  // --- Hands-free Voice Mode ---
  // `sendMessage` is defined further down; a ref keeps the voice loop's
  // "final transcript -> send" callback stable and free of stale closures.
  const sendMessageRef = useRef<(text: string) => void>(() => {});
  const handleVoiceTranscript = useCallback((text: string) => {
    sendMessageRef.current(text);
  }, []);
  const voice = useVoiceConversation({
    locale: languageMap[language] || languageMap.en,
    baseLang: language,
    voices,
    onFinalTranscript: handleVoiceTranscript,
  });
  const { voiceMode, speakReply } = voice;

  const speak = useCallback((rawText: string) => {
    // Voice Mode owns speech while it's on (it forces TTS + drives the loop).
    if (voiceMode) return;
    if (!isTtsEnabled || !rawText || typeof window === 'undefined' || !window.speechSynthesis || voices.length === 0) return;

    // Read the words, not the markdown punctuation.
    const text = rawText.replace(/[*_`#]/g, '').replace(/^\s*[-•]\s+/gm, '');
    const utterance = new SpeechSynthesisUtterance(text);
    const langCode = languageMap[language];
    utterance.lang = langCode;

    // --- Voice Selection Logic ---
    // 1. Prioritize a high-quality (e.g., Google) male voice for the specific language/locale.
    let selectedVoice = voices.find(v => v.lang === langCode && v.name.toLowerCase().includes('male') && v.name.toLowerCase().includes('google'));
    // 2. Fallback to any male voice for the specific language/locale.
    if (!selectedVoice) {
        selectedVoice = voices.find(v => v.lang === langCode && v.name.toLowerCase().includes('male'));
    }
    // 3. Fallback to a high-quality male voice for the base language (e.g., 'en' for 'en-US').
    if (!selectedVoice) {
        const baseLang = language;
        selectedVoice = voices.find(v => v.lang.startsWith(baseLang) && v.name.toLowerCase().includes('male') && v.name.toLowerCase().includes('google'));
    }
    // 4. Fallback to any male voice for the base language.
    if (!selectedVoice) {
        const baseLang = language;
        selectedVoice = voices.find(v => v.lang.startsWith(baseLang) && v.name.toLowerCase().includes('male'));
    }
    // 5. As a last resort, use any default voice for the language.
    if (!selectedVoice) {
        selectedVoice = voices.find(v => v.lang === langCode);
    }
    if (selectedVoice) {
        utterance.voice = selectedVoice;
    }

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, [isTtsEnabled, language, voices, voiceMode]);

  // Single announce path for bot replies: in Voice Mode it speaks aloud and
  // (when `isFinal`) auto-starts the mic; otherwise it defers to the manual
  // speaker-toggle behaviour. `isFinal` is false only for a non-last
  // journey-beliefs paragraph, so we don't listen between queued paragraphs.
  const announce = useCallback((text: string, isFinal: boolean = true) => {
    if (voiceMode) speakReply(text, isFinal);
    else speak(text);
  }, [voiceMode, speakReply, speak]);


  const handleMicClick = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const toggleTts = () => {
    setIsTtsEnabled(prev => {
      if (prev) { // If it was on and is being turned off
        window.speechSynthesis.cancel();
      }
      return !prev;
    });
  };
  // --- END: VOICE-OVER LOGIC ---

  const initializeChat = async () => {
    setIsLoading(true);
    voice.cancelAll(); // tear down any in-flight speech/recognition from a prior bot/language
    setDrawStoryId(null);
    setPendingChoices([]);
    usedDrawRef.current = false;
    storySeedRef.current = newStorySeed();
    try {
      // Every bot: register the visit on the cross-bot profile and reset the
      // per-session message counter. (Superhero ALSO keeps its own heroProfile
      // visit below.)
      userMsgCountRef.current = 0;
      persistProfile(registerProfileVisit(loadProfile(), chatbot.id));

      // The backend applies a full Farsi behaviour directive (see
      // backend/claude_style.py) for every bot when language === 'fa'; we add a
      // short generic hint here too so the very first turn is already localised.
      let systemPrompt = chatbot.systemPrompt;
      if (language === 'fa') {
        systemPrompt = `${chatbot.systemPrompt}\n\n**CRITICAL: The user's language is Farsi (Persian). Reply entirely in natural Farsi.**`;
      }

      let seededPoints = 0;
      if (chatbot.id === 'superhero-universe') {
        const p = registerVisit(loadHeroProfile());
        persistHero(p);
        seededPoints = p.totalPoints;
        systemPrompt = `${systemPrompt}\n\n${buildHeroContext(p)}`;
      }

      chatRef.current = await startChat(systemPrompt, chatbot.id, language);
      const welcomeText =
        chatbot.translations?.[language]?.welcomeMessage ?? chatbot.welcomeMessage;
      const welcomeMsg: ChatMessage = { sender: 'bot', text: welcomeText };
      setMessages([welcomeMsg]);
      announce(welcomeText);
      setResponseQueue([]);
      setQueuedSources([]);
      setHeroPoints(seededPoints);
      setCurrentStage(chatbot.stages ? chatbot.stages[0] : '');
    } catch (error) {
      console.error("Failed to initialize chat:", error);
      const errorMsg = t(language, 'chat.errInit');
      setMessages([{ sender: 'bot', text: errorMsg }]);
      announce(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    initializeChat();
    return () => {
      // Cleanup on unmount
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [chatbot, language]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleClose = () => {
    voice.cancelAll();
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if(messages.length > 1) {
      logChat(chatbot.id, messages, language);
    }
    if (heroRef.current) saveHeroProfile(heroRef.current);
    if (profileRef.current) {
      const ended = recordSessionEnd(profileRef.current, chatbot.id, userMsgCountRef.current);
      profileRef.current = ended;
      saveProfile(ended);
    }
    onClose();
  };

  const processBotResponse = (responseText: string, retrievedSources: string[]) => {
    let text = responseText;
    const pointsRegex = /\[POINTS_AWARDED:\s*(\d+)\s*\]/i;
    const stageRegex = /\[SET_STAGE:\s*(.*?)\s*\]/i;
    
    const pointsMatch = text.match(pointsRegex);
    if (pointsMatch && pointsMatch[1]) {
      const points = parseInt(pointsMatch[1], 10);
      setHeroPoints(prev => prev + points);
      if (heroRef.current) persistHero(addPoints(heroRef.current, points));
      text = text.replace(pointsRegex, '').trim();
    }

    const stageMatch = text.match(stageRegex);
    if (stageMatch && stageMatch[1]) {
      const newStage = stageMatch[1].trim();
      if(chatbot.stages?.includes(newStage)) {
          setCurrentStage(newStage);
      }
      text = text.replace(stageRegex, '').trim();
    }

    // --- Superhero progression commands (persist across visits) ---
    const idMatch = text.match(/\[HERO_IDENTITY:\s*([^|\]]+?)\s*\|\s*([^\]]+?)\s*\]/i);
    if (idMatch && heroRef.current) {
      persistHero(setIdentity(heroRef.current, idMatch[1], idMatch[2]));
    }
    text = text.replace(/\[HERO_IDENTITY:[^\]]*\]/gi, '').trim();

    const unlockMatch = text.match(/\[UNLOCK:\s*([a-z\s-]+?)\s*\]/i);
    if (unlockMatch && heroRef.current) {
      const key = unlockMatch[1].toLowerCase().replace(/[\s-]/g, '');
      const map: Record<string, VirtueId> = {
        courage: 'courage', selfcontrol: 'selfControl', temperance: 'selfControl',
        wisdom: 'wisdom', justice: 'justice', treasure: 'treasure',
      };
      const virtue = map[key];
      if (virtue && !heroRef.current.virtues[virtue]) {
        persistHero(unlockVirtue(heroRef.current, virtue));
        setMessages(prev => [...prev, {
          sender: 'bot',
          text: `🏅 **Virtue unlocked: ${VIRTUE_META[virtue].icon} ${VIRTUE_META[virtue].label}!** It's saved to your Hero Card forever.`,
        }]);
      }
      // Mirror every Superhero virtue onto the cross-bot badge shelf.
      if (virtue && profileRef.current) {
        persistProfile(awardBadge(profileRef.current, {
          id: `superhero:${virtue}`,
          label: VIRTUE_META[virtue].label,
          botId: 'superhero-universe',
        }));
      }
    }
    text = text.replace(/\[UNLOCK:[^\]]*\]/gi, '').trim();

    // --- Cross-bot badge command (any bot): [BADGE: <label>] ---
    const badgeMatch = text.match(/\[BADGE:\s*([^\]]+?)\s*\]/i);
    if (badgeMatch && badgeMatch[1] && profileRef.current) {
      const label = badgeMatch[1].trim();
      persistProfile(awardBadge(profileRef.current, {
        id: `${chatbot.id}:${slugify(label)}`,
        label,
        botId: chatbot.id,
      }));
    }
    text = text.replace(/\[BADGE:[^\]]*\]/gi, '').trim();

    const logMatch = text.match(/\[HERO_LOG:\s*([^\]]+?)\s*\]/i);
    if (logMatch && heroRef.current) {
      persistHero(addLogEntry(heroRef.current, logMatch[1]));
    }
    text = text.replace(/\[HERO_LOG:[^\]]*\]/gi, '').trim();

    if (/\[SIDE_QUEST_DONE\]/i.test(text) && heroRef.current) {
      persistHero(recordSideQuest(heroRef.current));
    }
    text = text.replace(/\[SIDE_QUEST_DONE\]/gi, '').trim();

    // The storyteller picks pre-generated illustrations with [show_image: <id>].
    // (Legacy [generate_image: ...] commands are also stripped so they never leak to the user.)
    const showImageRegex = /\[show_image:\s*([a-z0-9-]+)\s*\]/gi;
    const legacyImageRegex = /\[generate_image:[^\]]*\]/gi;
    // After the moral discussion it emits [offer_draw: <storyId>] to invite the
    // child to describe their own picture of the story.
    const offerDrawRegex = /\[offer_draw:\s*([a-z0-9-]+)\s*\]/i;
    // Choose-your-path branch offer: [choices: first | second | optional third].
    const choicesRegex = /\[choices:\s*([^\]]+?)\s*\]/i;
    const imageIds: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = showImageRegex.exec(text)) !== null) {
      imageIds.push(m[1]);
    }
    const drawMatch = text.match(offerDrawRegex);
    const choicesMatch = text.match(choicesRegex);
    const textOnly = text
      .replace(showImageRegex, '')
      .replace(legacyImageRegex, '')
      .replace(offerDrawRegex, '')
      .replace(choicesRegex, '')
      .replace(/\n{3,}/g, '\n\n')  // collapse gaps left by stripped commands
      .trim();

    if (textOnly) {
      const botMessage: ChatMessage = { sender: 'bot', text: textOnly, sources: retrievedSources };
      setMessages(prev => [...prev, botMessage]);
      announce(textOnly);
    }

    for (const id of imageIds) {
      const url = illustrationUrl(id, storySeedRef.current);
      if (url) {
        setMessages(prev => [...prev, { sender: 'bot', imageUrl: url }]);
      }
    }

    if (drawMatch && !usedDrawRef.current) {
      setDrawStoryId(drawMatch[1].toLowerCase());
      setPendingChoices([]);
    } else if (choicesMatch && choicesMatch[1]) {
      const opts = choicesMatch[1]
        .split('|')
        .map(s => s.trim())
        .filter(Boolean)
        .slice(0, 3);
      setPendingChoices(opts.length > 0 ? opts : []);
    } else {
      setPendingChoices([]);
    }
  };

  const submitDrawing = async (description: string) => {
    const storyId = drawStoryId;
    if (!storyId) return;
    setMessages(prev => [...prev, { sender: 'user', text: description }]);
    setUserInput('');
    setDrawStoryId(null);
    usedDrawRef.current = true;
    setIsLoading(true);
    try {
      const imageDataUrl = await generateKidIllustration(storyId, description);
      setMessages(prev => [...prev, { sender: 'bot', imageUrl: imageDataUrl }]);
      const done = t(language, 'chat.drawDone');
      setMessages(prev => [...prev, { sender: 'bot', text: done }]);
      announce(done);
    } catch (error) {
      console.error('Error generating illustration:', error);
      const errorMsg = error instanceof RestingError
        ? error.message
        : t(language, 'chat.errDraw');
      setMessages(prev => [...prev, { sender: 'bot', text: errorMsg }]);
      announce(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;
    window.speechSynthesis.cancel();
    if (voiceMode) voice.cancelAll(); // stop any speech/listening before this turn's reply
    setShowExamples(false);
    setPendingChoices([]);

    if (drawStoryId) {
      await submitDrawing(messageText.trim());
      return;
    }

    const userMessage: ChatMessage = { sender: 'user', text: messageText };
    setMessages(prev => [...prev, userMessage]);
    setUserInput('');

    // Count this toward the session's reflection tally (cross-bot profile).
    userMsgCountRef.current += 1;
    if (profileRef.current) persistProfile(registerProfileMessage(profileRef.current, chatbot.id));

    if (chatbot.id === 'journey-beliefs' && responseQueue.length > 0) {
      const nextParagraph = responseQueue[0];
      const remainingQueue = responseQueue.slice(1);
      const botMessage: ChatMessage = { sender: 'bot', text: nextParagraph, sources: remainingQueue.length === 0 ? queuedSources : undefined };
      setMessages(prev => [...prev, botMessage]);
      announce(nextParagraph, remainingQueue.length === 0);
      setResponseQueue(remainingQueue);
      if (remainingQueue.length === 0) setQueuedSources([]);
      return;
    }

    if (!chatRef.current) return;
    setIsLoading(true);

    try {
      // The backend handles RAG retrieval and grounding; the client just sends
      // the user's message and receives { text, sources }.
      const response = await chatRef.current.sendMessage({ message: messageText });
      const botResponseText = response.text.trim();
      const retrievedSources: string[] = response.sources || [];

      if (chatbot.id === 'journey-beliefs') {
        const paragraphs = botResponseText.split('\n\n').filter(p => p.trim());
        if (paragraphs.length > 0) {
          const firstParagraph = paragraphs[0];
          setMessages(prev => [...prev, { sender: 'bot', text: firstParagraph, sources: paragraphs.length === 1 ? retrievedSources : undefined }]);
          announce(firstParagraph, paragraphs.length === 1);
          if (paragraphs.length > 1) {
            setResponseQueue(paragraphs.slice(1));
            setQueuedSources(retrievedSources);
          }
        }
      } else {
        processBotResponse(botResponseText, retrievedSources);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMsg = error instanceof RestingError
        ? error.message
        : t(language, 'chat.errSend');
      const errorMessage: ChatMessage = { sender: 'bot', text: errorMsg };
      setMessages(prev => [...prev, errorMessage]);
      announce(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Keep the Voice Mode loop pointed at the current sendMessage closure.
  sendMessageRef.current = sendMessage;

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(userInput);
  };

  const handleExampleClick = (prompt: string) => {
    sendMessage(prompt);
  };

  const handleChoiceClick = (choice: string) => {
    setPendingChoices([]);
    sendMessage(choice);
  };

  const examplePrompts =
    chatbot.translations?.[language]?.examplePrompts ?? chatbot.examplePrompts;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl h-[90vh] max-h-[700px] flex flex-col">
        <header className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            <h2 className="text-xl font-bold text-indigo-700" dir="auto">{chatbot.title}</h2>
            <button
              onClick={toggleTts}
              aria-label={isTtsEnabled ? t(language, 'chat.ttsOff') : t(language, 'chat.ttsOn')}
              className="text-gray-500 hover:text-indigo-600 transition-colors"
            >
              {isTtsEnabled ? <SpeakerOnIcon /> : <SpeakerOffIcon />}
            </button>
            <button
              onClick={voice.toggleVoiceMode}
              aria-pressed={voiceMode}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                voiceMode
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
              }`}
            >
              <MicIcon />
              <span>{voiceMode ? t(language, 'chat.voiceModeOn') : t(language, 'chat.voiceMode')}</span>
            </button>
          </div>
          <div className="flex items-center space-x-4 rtl:space-x-reverse">
            <button onClick={handleClose} aria-label={t(language, 'chat.closeAria')} className="text-gray-500 hover:text-gray-800 transition-colors">
              <CloseIcon />
            </button>
          </div>
        </header>

        {chatbot.id === 'superhero-universe' && heroProfile && (
          <HeroCard profile={heroProfile} points={heroPoints} />
        )}

        {chatbot.id === 'superhero-universe' && chatbot.stages && (
          <GameMap stages={chatbot.stages} currentStage={currentStage} />
        )}

        <div className="flex-grow overflow-y-auto bg-gray-50 p-4">
          {chatbot.id !== 'superhero-universe' && profile && (
            <ProfileStrip profile={profile} botId={chatbot.id} language={language} />
          )}

          {showExamples && examplePrompts && examplePrompts.length > 0 && messages.length === 1 && (
            <div className="mb-4 p-4 bg-white rounded-lg border border-gray-200">
              <p className="font-semibold text-gray-700 mb-3">{t(language, 'chat.examplesPrompt')}</p>
              <div className="flex flex-col items-start space-y-2">
                {examplePrompts.map((prompt, index) => (
                  <button
                    key={index}
                    onClick={() => handleExampleClick(prompt)}
                    className="text-indigo-600 hover:text-indigo-800 text-left rtl:text-right bg-indigo-50 hover:bg-indigo-100 rounded-md px-3 py-2 transition-colors duration-200 w-full text-sm"
                    dir="auto"
                  >
                    "{prompt}"
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, index) => (
            <div key={index} className={`flex mb-4 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.text ? (
                <div dir="auto" className={`rounded-2xl py-2 px-4 max-w-md ${
                  msg.sender === 'user'
                    ? 'bg-indigo-500 text-white rounded-br-none rtl:rounded-br-2xl rtl:rounded-bl-none'
                    : 'bg-gray-200 text-gray-800 rounded-bl-none rtl:rounded-bl-2xl rtl:rounded-br-none'
                }`}>
                  {msg.sender === 'bot'
                    ? <RichText text={msg.text} />
                    : <p className="whitespace-pre-wrap">{msg.text}</p>}
                  {msg.sender === 'bot' && msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-300">
                      <h4 className="text-xs font-bold text-gray-600 mb-1">{t(language, 'chat.sources')}</h4>
                      <ul className="list-none pl-0">
                        {msg.sources.map((source, i) => (
                          <li key={i} className="text-xs text-gray-500" dir="auto">
                            - {source}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : msg.imageUrl ? (
                <div className="p-1 bg-gray-200 rounded-2xl rounded-bl-none rtl:rounded-bl-2xl rtl:rounded-br-none">
                  <img
                    src={msg.imageUrl}
                    alt={t(language, 'chat.storyIllustrationAlt')}
                    className="rounded-xl max-w-sm"
                    onLoad={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
                    onError={(e) => {
                      if (e.currentTarget.src.indexOf(PLACEHOLDER_IMAGE) === -1) {
                        e.currentTarget.src = PLACEHOLDER_IMAGE;
                      }
                    }}
                  />
                </div>
              ) : null}
            </div>
          ))}

          {pendingChoices.length > 0 && !drawStoryId && !isLoading && (
            <div className="mb-4">
              <p className="font-semibold text-gray-700 mb-2 text-sm">{t(language, 'chat.choosePath')}</p>
              <div className="flex flex-col items-start space-y-2">
                {pendingChoices.map((choice, index) => (
                  <button
                    key={index}
                    onClick={() => handleChoiceClick(choice)}
                    className="text-indigo-700 hover:text-indigo-900 text-left rtl:text-right bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md px-3 py-2 transition-colors duration-200 w-full text-sm font-medium"
                    dir="auto"
                  >
                    {choice}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(isLoading && messages.length > 0) && (
            <div className="flex justify-start mb-4">
              <div className="bg-gray-200 text-gray-800 rounded-2xl rounded-bl-none rtl:rounded-bl-2xl rtl:rounded-br-none py-2 px-4">
                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse delay-75"></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse delay-150"></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse delay-300"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        
        {drawStoryId && (
          <div className="px-4 pt-3 -mb-1">
            <p className="text-sm text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
              {t(language, 'chat.drawHint')}
            </p>
          </div>
        )}

        {voiceMode && (
          <VoiceIndicator
            isListening={voice.isListening}
            isSpeaking={voice.isSpeaking}
            interimTranscript={voice.interimTranscript}
            sttSupported={voice.sttSupported}
            voiceUnavailableForLang={voice.voiceUnavailableForLang}
            onTap={() => (voice.isListening ? voice.stopListening() : voice.startListening())}
            language={language}
          />
        )}

        <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200">
          <div className="flex items-center bg-gray-100 rounded-xl p-2">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder={drawStoryId ? t(language, 'chat.drawInputPlaceholder') : t(language, 'chat.inputPlaceholder')}
              className="flex-grow bg-transparent focus:outline-none px-2"
              disabled={isLoading}
              dir="auto"
            />
            {!voiceMode && (
              <button
                type="button"
                onClick={handleMicClick}
                disabled={!recognitionRef.current || isLoading}
                className={`p-2 rounded-lg transition-colors ${
                  isListening
                    ? 'text-red-500 animate-pulse'
                    : 'text-gray-500 hover:text-indigo-600'
                } disabled:text-gray-300 disabled:cursor-not-allowed`}
              >
                <MicIcon />
              </button>
            )}
            <button type="submit" disabled={isLoading || !userInput.trim()} className="bg-indigo-600 text-white p-2 rounded-lg disabled:bg-indigo-300 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors">
              <SendIcon />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatModal;
