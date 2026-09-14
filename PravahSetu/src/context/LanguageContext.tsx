import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Language = 'en' | 'hi';

interface Translations {
  [key: string]: {
    en: string;
    hi: string;
  };
}

export const TRANSLATIONS: Translations = {
  portalName: {
    en: 'Pravah Setu',
    hi: 'प्रवाह सेतु',
  },
  portalTagline: {
    en: 'Report Cybercrime. Protect Yourself.',
    hi: 'साइबर अपराध की रिपोर्ट करें। सुरक्षित रहें।',
  },
  navHome: {
    en: 'Home',
    hi: 'मुख्य पृष्ठ',
  },
  navReport: {
    en: 'Report Crime',
    hi: 'अपराध रिपोर्ट करें',
  },
  navTrack: {
    en: 'Track Complaint',
    hi: 'शिकायत ट्रैक करें',
  },
  navAwareness: {
    en: 'Awareness',
    hi: 'साइबर जागरूकता',
  },
  navAbout: {
    en: 'About',
    hi: 'हमारे बारे में',
  },
  navContact: {
    en: 'Contact & Help',
    hi: 'संपर्क एवं सहायता',
  },
  login: {
    en: 'Citizen Login',
    hi: 'नागरिक लॉगिन',
  },
  dashboard: {
    en: 'Dashboard',
    hi: 'डैशबोर्ड',
  },
  helplineBanner: {
    en: 'National Cyber Crime Helpline: Dial 1930 for financial frauds | 24×7 Citizen Support',
    hi: 'राष्ट्रीय साइबर अपराध हेल्पलाइन: वित्तीय धोखाधड़ी के लिए 1930 डायल करें | 24×7 नागरिक सहायता',
  },
  heroTitle: {
    en: 'Report Cybercrime. Protect Yourself.',
    hi: 'साइबर अपराध की रिपोर्ट करें। स्वयं को सुरक्षित रखें।',
  },
  heroSubtitle: {
    en: 'A secure and easy-to-use digital platform to report cybercrime, track your complaint in real-time, and get immediate help against online fraud.',
    hi: 'साइबर अपराध की तुरंत रिपोर्ट करने, अपनी शिकायत को लाइव ट्रैक करने और डिजिटल धोखाधड़ी से निपटने के लिए एक सुरक्षित नागरिक मंच।',
  },
  ctaReport: {
    en: 'Report a Cybercrime',
    hi: 'साइबर अपराध रिपोर्ट करें',
  },
  ctaTrack: {
    en: 'Track Complaint',
    hi: 'शिकायत ट्रैक करें',
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en');

  const t = (key: string): string => {
    if (TRANSLATIONS[key]) {
      return TRANSLATIONS[key][language] || TRANSLATIONS[key].en;
    }
    return key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
