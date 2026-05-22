import { create } from "zustand";
import { persist } from "zustand/middleware";
import { translations } from "@/i18n";
import type { Lang, T } from "@/i18n";

interface LangState {
  lang: Lang;
  t: T;
  setLang: (lang: Lang) => void;
}

export const useLangStore = create<LangState>()(
  persist(
    (set) => ({
      lang: "es",
      t: translations.es as T,
      setLang: (lang) => set({ lang, t: translations[lang] as T }),
    }),
    { name: "lang-storage" }
  )
);
