
import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Chatbot, ChatMessage } from '../types';
import { startChat } from '../services/geminiService';
import { generateImage } from '../services/geminiService';
import { logChat } from '../services/loggingService';
import * as ragService from '../services/ragService';
import type { Chat } from '@google/genai';
import GameMap from './GameMap';
import CoinTally from './CoinTally';

interface ChatModalProps {
  chatbot: Chatbot;
  onClose: () => void;
  language: string;
}

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
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [showExamples, setShowExamples] = useState(true);
  
  // Voice feature state
  const [isTtsEnabled, setIsTtsEnabled] = useState(false); // TTS is off by default
  const [isListening, setIsListening] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const recognitionRef = useRef<any>(null); // Using 'any' for SpeechRecognition to handle vendor prefixes

  // Gamification state
  const [heroPoints, setHeroPoints] = useState(0);
  const [currentStage, setCurrentStage] = useState(chatbot.stages ? chatbot.stages[0] : '');

  const [responseQueue, setResponseQueue] = useState<string[]>([]);
  const [queuedSources, setQueuedSources] = useState<string[]>([]);
  const chatRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const speak = useCallback((text: string) => {
    if (!isTtsEnabled || !text || typeof window === 'undefined' || !window.speechSynthesis || voices.length === 0) return;

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
  }, [isTtsEnabled, language, voices]);


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
    try {
      let systemPrompt = chatbot.systemPrompt;
      if (chatbot.id === 'my-compass') {
        const languageName = { en: 'English', ar: 'Arabic', fa: 'Farsi' }[language] || 'English';
        systemPrompt = `${chatbot.systemPrompt}\n\n**CRITICAL: The user's requested language is ${languageName}. All your responses must be in ${languageName}.**`;
      }
      chatRef.current = await startChat(systemPrompt);
      const welcomeMsg: ChatMessage = { sender: 'bot', text: chatbot.welcomeMessage };
      setMessages([welcomeMsg]);
      speak(chatbot.welcomeMessage);
      setResponseQueue([]);
      setQueuedSources([]);
      setHeroPoints(0);
      setCurrentStage(chatbot.stages ? chatbot.stages[0] : '');
    } catch (error) {
      console.error("Failed to initialize chat:", error);
      const errorMsg = "Sorry, I'm having trouble connecting right now. Please try again later.";
      setMessages([{ sender: 'bot', text: errorMsg }]);
      speak(errorMsg);
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
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if(messages.length > 1) {
      logChat(chatbot.id, messages);
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

    const imageCommandRegex = /\[generate_image:\s*(.*?)\s*\]/i;
    const imageMatch = text.match(imageCommandRegex);
    const textOnly = text.replace(imageCommandRegex, '').trim();

    if (textOnly) {
      const botMessage: ChatMessage = { sender: 'bot', text: textOnly, sources: retrievedSources };
      setMessages(prev => [...prev, botMessage]);
      speak(textOnly);
    }
    
    if (imageMatch && imageMatch[1]) {
      const imagePrompt = imageMatch[1];
      setIsImageLoading(true);
      generateImage(imagePrompt).then(imageUrl => {
        if (imageUrl) {
          const imageMessage: ChatMessage = { sender: 'bot', imageUrl: imageUrl };
          setMessages(prev => [...prev, imageMessage]);
        }
        setIsImageLoading(false);
      });
    }
  };

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;
    window.speechSynthesis.cancel();
    setShowExamples(false);
    const userMessage: ChatMessage = { sender: 'user', text: messageText };
    setMessages(prev => [...prev, userMessage]);
    setUserInput('');

    if (chatbot.id === 'journey-beliefs' && responseQueue.length > 0) {
      const nextParagraph = responseQueue[0];
      const remainingQueue = responseQueue.slice(1);
      const botMessage: ChatMessage = { sender: 'bot', text: nextParagraph, sources: remainingQueue.length === 0 ? queuedSources : undefined };
      setMessages(prev => [...prev, botMessage]);
      speak(nextParagraph);
      setResponseQueue(remainingQueue);
      if (remainingQueue.length === 0) setQueuedSources([]);
      return;
    }

    if (!chatRef.current) return;
    setIsLoading(true);

    try {
      let messageToSend = messageText;
      let retrievedSources: string[] = [];
      
      if (chatbot.isRag) {
        const ragResult = await ragService.retrieveContext(chatbot.id, messageText);
        messageToSend = ragResult?.context 
          ? `Based on the following context from my documents:\n\n---\n${ragResult.context}\n---\n\nMy question is: ${messageText}`
          : `I couldn't find specific context in my documents for this, but my question is: ${messageText}`;
        retrievedSources = ragResult?.sources || [];
      }
      
      const response = await chatRef.current.sendMessage({ message: messageToSend });
      const botResponseText = response.text.trim();

      if (chatbot.id === 'journey-beliefs') {
        const paragraphs = botResponseText.split('\n\n').filter(p => p.trim());
        if (paragraphs.length > 0) {
          const firstParagraph = paragraphs[0];
          setMessages(prev => [...prev, { sender: 'bot', text: firstParagraph, sources: paragraphs.length === 1 ? retrievedSources : undefined }]);
          speak(firstParagraph);
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
      const errorMsg = "Oops, something went wrong. Could you try that again?";
      const errorMessage: ChatMessage = { sender: 'bot', text: errorMsg };
      setMessages(prev => [...prev, errorMessage]);
      speak(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(userInput);
  };

  const handleExampleClick = (prompt: string) => {
    sendMessage(prompt);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl h-[90vh] max-h-[700px] flex flex-col">
        <header className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-bold text-indigo-700">{chatbot.title}</h2>
            <button onClick={toggleTts} className="text-gray-500 hover:text-indigo-600 transition-colors">
              {isTtsEnabled ? <SpeakerOnIcon /> : <SpeakerOffIcon />}
            </button>
          </div>
          <div className="flex items-center space-x-4">
            {chatbot.id === 'superhero-universe' && <CoinTally points={heroPoints} />}
            <button onClick={handleClose} className="text-gray-500 hover:text-gray-800 transition-colors">
              <CloseIcon />
            </button>
          </div>
        </header>

        {chatbot.id === 'superhero-universe' && chatbot.stages && (
          <GameMap stages={chatbot.stages} currentStage={currentStage} />
        )}

        <div className="flex-grow overflow-y-auto bg-gray-50 p-4">
          {showExamples && chatbot.examplePrompts && chatbot.examplePrompts.length > 0 && messages.length === 1 && (
            <div className="mb-4 p-4 bg-white rounded-lg border border-gray-200">
              <p className="font-semibold text-gray-700 mb-3">Not sure where to start? Try asking:</p>
              <div className="flex flex-col items-start space-y-2">
                {chatbot.examplePrompts.map((prompt, index) => (
                  <button
                    key={index}
                    onClick={() => handleExampleClick(prompt)}
                    className="text-indigo-600 hover:text-indigo-800 text-left bg-indigo-50 hover:bg-indigo-100 rounded-md px-3 py-2 transition-colors duration-200 w-full text-sm"
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
                <div className={`rounded-2xl py-2 px-4 max-w-md ${
                  msg.sender === 'user'
                    ? 'bg-indigo-500 text-white rounded-br-none'
                    : 'bg-gray-200 text-gray-800 rounded-bl-none'
                }`}>
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  {msg.sender === 'bot' && msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-300">
                      <h4 className="text-xs font-bold text-gray-600 mb-1">Sources:</h4>
                      <ul className="list-none pl-0">
                        {msg.sources.map((source, i) => (
                          <li key={i} className="text-xs text-gray-500">
                            - {source}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : msg.imageUrl ? (
                <div className="p-1 bg-gray-200 rounded-2xl rounded-bl-none">
                  <img 
                    src={msg.imageUrl} 
                    alt="Generated illustration" 
                    className="rounded-xl max-w-sm"
                    onLoad={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
                  />
                </div>
              ) : null}
            </div>
          ))}

          {(isLoading && messages.length > 0) && (
            <div className="flex justify-start mb-4">
              <div className="bg-gray-200 text-gray-800 rounded-2xl rounded-bl-none py-2 px-4">
                <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse delay-75"></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse delay-150"></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse delay-300"></div>
                </div>
              </div>
            </div>
          )}
          {isImageLoading && (
              <div className="flex justify-start mb-4">
                  <div className="bg-gray-200 text-gray-800 rounded-2xl rounded-bl-none py-2 px-4">
                      <div className="flex items-center space-x-2">
                          <svg className="animate-spin h-5 w-5 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Generating illustration...</span>
                      </div>
                  </div>
              </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        
        <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200">
          <div className="flex items-center bg-gray-100 rounded-xl p-2">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-grow bg-transparent focus:outline-none px-2"
              disabled={isLoading || isImageLoading}
            />
            <button
              type="button"
              onClick={handleMicClick}
              disabled={!recognitionRef.current || isLoading || isImageLoading}
              className={`p-2 rounded-lg transition-colors ${
                isListening 
                  ? 'text-red-500 animate-pulse' 
                  : 'text-gray-500 hover:text-indigo-600'
              } disabled:text-gray-300 disabled:cursor-not-allowed`}
            >
              <MicIcon />
            </button>
            <button type="submit" disabled={isLoading || isImageLoading || !userInput.trim()} className="bg-indigo-600 text-white p-2 rounded-lg disabled:bg-indigo-300 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors">
              <SendIcon />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatModal;
