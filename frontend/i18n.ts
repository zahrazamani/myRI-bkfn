// Lightweight UI-string localisation for MYRI.
//
// English + Farsi only (Arabic was dropped from the language selector). Keys are
// descriptive dotted paths; `t(lang, key)` falls back to English, then to the
// raw key, so a missing translation is always visible rather than crashing.
//
// The long chatbot *system prompts* are NOT translated here - the backend Farsi
// directive (see backend/claude_style.py) handles in-conversation translation.
// This file only covers fixed chrome: buttons, placeholders, headings, errors.

export type Lang = 'en' | 'fa';

type Entry = Record<Lang, string>;

export const STRINGS: Record<string, Entry> = {
  // --- App / brand -------------------------------------------------------
  'app.title': { en: 'My Real Intelligence', fa: 'My Real Intelligence' },

  // --- Home page (App.tsx) ---------------------------------------------
  'home.kidsHeading': { en: 'For Ages 11-15', fa: 'برای ۱۱ تا ۱۵ سال' },
  'home.kidsSubheading': {
    en: 'Discover stories and explore what it means to be a hero in your own life.',
    fa: 'داستان‌ها را کشف کن و ببین قهرمان بودن در زندگی خودت یعنی چه.',
  },
  'home.olderHeading': { en: 'For Deeper Exploration (16+)', fa: 'برای کاوش عمیق‌تر (۱۶ سال به بالا)' },
  'home.olderSubheading': {
    en: 'Engage in deeper conversations, explore fundamental beliefs, and work on personal growth.',
    fa: 'گفت‌وگوهای عمیق‌تری داشته باش، باورهای بنیادین را بررسی کن و روی رشد شخصی‌ات کار کن.',
  },

  // --- Header ----------------------------------------------------------
  'header.profile': { en: 'Profile', fa: 'پروفایل' },
  'header.viewLogs': { en: 'View Logs', fa: 'مشاهده گزارش‌ها' },
  'header.logout': { en: 'Logout', fa: 'خروج' },
  'language.en': { en: 'English', fa: 'English' },
  'language.fa': { en: 'فارسی', fa: 'فارسی' },

  // --- Chatbot card --------------------------------------------------
  'card.startChat': { en: 'Start Chat', fa: 'شروع گفت‌وگو' },

  // --- Chat modal --------------------------------------------------
  // ProfileStrip (the one-line progress band above the chat)
  'chat.strip.days': { en: 'days', fa: 'روز' },
  'chat.strip.day': { en: 'day', fa: 'روز' },
  'chat.strip.visitsHere': { en: 'visits here', fa: 'بازدید این‌جا' },
  'chat.strip.sessions': { en: 'sessions', fa: 'نشست' },
  'chat.strip.badges': { en: 'badges', fa: 'نشان' },
  'chat.strip.badge': { en: 'badge', fa: 'نشان' },
  'chat.inputPlaceholder': { en: 'Type your message...', fa: 'پیامت را بنویس...' },
  'chat.drawInputPlaceholder': { en: 'Describe your picture...', fa: 'نقاشی‌ات را توصیف کن...' },
  'chat.sources': { en: 'Sources:', fa: 'منابع:' },
  'chat.examplesPrompt': { en: 'Not sure where to start? Try asking:', fa: 'نمی‌دانی از کجا شروع کنی؟ این‌ها را بپرس:' },
  'chat.choosePath': { en: 'Choose your path:', fa: 'مسیرت را انتخاب کن:' },
  'chat.drawHint': {
    en: "🎨 Your turn! Describe the picture you imagine for this story and I'll bring it to life.",
    fa: '🎨 نوبت توست! تصویری را که برای این داستان در ذهنت داری توصیف کن تا آن را زنده کنم.',
  },
  'chat.drawDone': {
    en: 'Wow — here is your picture! You really understood this story.',
    fa: 'وای — این هم نقاشی تو! تو واقعاً این داستان را خوب فهمیدی.',
  },
  'chat.voiceMode': { en: 'Voice Mode', fa: 'حالت صوتی' },
  'chat.voiceModeOn': { en: 'Voice Mode: On', fa: 'حالت صوتی: روشن' },
  'chat.ttsOn': { en: 'Turn voice-over on', fa: 'روشن کردن صداگذاری' },
  'chat.ttsOff': { en: 'Turn voice-over off', fa: 'خاموش کردن صداگذاری' },
  'chat.closeAria': { en: 'Close chat', fa: 'بستن گفت‌وگو' },
  'chat.storyIllustrationAlt': { en: 'Story illustration', fa: 'تصویر داستان' },
  'chat.errInit': {
    en: "Sorry, I'm having trouble connecting right now. Please try again later.",
    fa: 'ببخشید، الان در برقراری ارتباط مشکل دارم. لطفاً بعداً دوباره امتحان کن.',
  },
  'chat.errDraw': {
    en: "I couldn't quite bring that picture to life right now. Try again another day!",
    fa: 'الان نتوانستم آن نقاشی را زنده کنم. یک روز دیگر دوباره امتحان کن!',
  },
  'chat.errSend': {
    en: 'Oops, something went wrong. Could you try that again?',
    fa: 'اوه، مشکلی پیش آمد. می‌شود دوباره امتحان کنی؟',
  },

  // --- Login page --------------------------------------------------
  'login.subtitle': { en: 'Please enter your email to continue', fa: 'برای ادامه، ایمیلت را وارد کن' },
  'login.signIn': { en: 'Sign In', fa: 'ورود' },
  'login.emailLabel': { en: 'Email address', fa: 'نشانی ایمیل' },
  'login.emailPlaceholder': { en: 'you@example.com', fa: 'you@example.com' },
  'login.errVerify': { en: 'Verification failed. Please try again.', fa: 'تأیید ناموفق بود. لطفاً دوباره امتحان کن.' },
  'login.errHuman': {
    en: 'Please complete the "I am human" check first.',
    fa: 'لطفاً اول بررسی «من انسان هستم» را کامل کن.',
  },
  'login.errEmail': { en: 'Please enter a valid email address.', fa: 'لطفاً یک نشانی ایمیل معتبر وارد کن.' },
  'login.errGoogle': { en: 'Google sign-in failed. Please try again.', fa: 'ورود با گوگل ناموفق بود. لطفاً دوباره امتحان کن.' },
  'login.orEmail': { en: 'or continue with email', fa: 'یا با ایمیل ادامه بده' },

  // --- Profile modal --------------------------------------------------
  'profile.title': { en: 'My Profile', fa: 'پروفایل من' },
  'profile.dayStreak': { en: 'day streak', fa: 'روز پیاپی' },
  'profile.activeToday': { en: 'active today', fa: 'امروز فعال' },
  'profile.totalVisits': { en: 'total visits', fa: 'کل بازدیدها' },
  'profile.reflections': { en: 'reflections', fa: 'تأمل‌ها' },
  'profile.guides': { en: 'Guides', fa: 'راهنماها' },
  'profile.noVisits': {
    en: 'No visits yet — open any guide to get started.',
    fa: 'هنوز بازدیدی نداری — برای شروع یکی از راهنماها را باز کن.',
  },
  'profile.colGuide': { en: 'Guide', fa: 'راهنما' },
  'profile.colVisits': { en: 'Visits', fa: 'بازدیدها' },
  'profile.colSessions': { en: 'Sessions', fa: 'نشست‌ها' },
  'profile.colReflections': { en: 'Reflections', fa: 'تأمل‌ها' },
  'profile.colLastVisit': { en: 'Last visit', fa: 'آخرین بازدید' },
  'profile.badges': { en: 'Badges', fa: 'نشان‌ها' },
  'profile.noBadges': {
    en: 'No badges yet — earn them by finishing challenges with the guides.',
    fa: 'هنوز نشانی نداری — با کامل کردن چالش‌های راهنماها آن‌ها را به دست بیاور.',
  },

  // --- Voice indicator --------------------------------------------------
  'voice.listening': { en: 'Listening… tap to stop', fa: 'در حال شنیدن… برای توقف بزن' },
  'voice.speaking': { en: 'Speaking…', fa: 'در حال صحبت…' },
  'voice.tapToTalk': { en: 'Tap to talk', fa: 'برای صحبت بزن' },
  'voice.repliesOn': { en: 'Voice replies are on', fa: 'پاسخ‌های صوتی روشن است' },
  'voice.notSupported': {
    en: "voice input isn't supported in this browser",
    fa: 'ورودی صوتی در این مرورگر پشتیبانی نمی‌شود',
  },
  'voice.noVoiceForLang': {
    en: 'no voice available for this language on your device',
    fa: 'برای این زبان روی دستگاه تو صدایی در دسترس نیست',
  },
  'voice.stopAria': { en: 'Stop listening', fa: 'توقف شنیدن' },
  'voice.startAria': { en: 'Start talking', fa: 'شروع صحبت' },
};

export const t = (lang: Lang | string, key: string): string => {
  const entry = STRINGS[key];
  if (!entry) return key;
  return entry[(lang as Lang)] ?? entry.en ?? key;
};
