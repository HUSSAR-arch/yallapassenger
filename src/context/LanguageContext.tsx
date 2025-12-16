import React, { createContext, useState, useEffect, useContext } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { I18nManager } from "react-native"; // Keep only for safety check
import { translations } from "../i18n/translations";

type Language = "en" | "ar";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: keyof typeof translations.en) => string;
  isRTL: boolean; // This is now just a boolean flag, not a native engine switch
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
);

export const LanguageProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [language, setLanguageState] = useState<Language>("en");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      // 1. SAFETY CHECK: Explicitly disable Native RTL.
      // This ensures that if the app was previously forced into RTL mode,
      // it gets reset to standard LTR so your manual flex-reverse logic works correctly.
      if (I18nManager.isRTL) {
        I18nManager.allowRTL(false);
        I18nManager.forceRTL(false);
      }

      const storedLang = await AsyncStorage.getItem("user-language");
      if (storedLang) {
        setLanguageState(storedLang as Language);
      }
    } catch (error) {
      console.log("Error loading language", error);
    } finally {
      setIsLoaded(true);
    }
  };

  const setLanguage = async (lang: Language) => {
    // 2. Simply update state and storage. No reloads.
    setLanguageState(lang);
    await AsyncStorage.setItem("user-language", lang);
  };

  const t = (key: keyof typeof translations.en) => {
    return translations[language][key] || key;
  };

  if (!isLoaded) return null;

  return (
    <LanguageContext.Provider
      // We pass 'isRTL' based purely on the string "ar"
      value={{ language, setLanguage, t, isRTL: language === "ar" }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
