"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"

export type Locale = "en" | "zh"

interface I18nContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string) => string
}

const I18nContext = createContext<I18nContextType>({
  locale: "en",
  setLocale: () => {},
  t: (key) => key,
})

export function I18nProvider({ children, translations }: { children: ReactNode; translations: Record<Locale, Record<string, string>> }) {
  const [locale, setLocaleState] = useState<Locale>("en")

  useEffect(() => {
    const saved = localStorage.getItem("homematch_locale") as Locale
    if (saved === "zh" || saved === "en") {
      setLocaleState(saved)
    }
  }, [])

  const setLocale = (l: Locale) => {
    setLocaleState(l)
    localStorage.setItem("homematch_locale", l)
  }

  const t = (key: string): string => {
    return translations[locale]?.[key] || translations["en"]?.[key] || key
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n()
  return (
    <button
      onClick={() => setLocale(locale === "en" ? "zh" : "en")}
      className="px-2 py-1 text-xs font-medium rounded-md border border-slate-200 hover:bg-slate-50 transition-colors"
      title={locale === "en" ? "切换到中文" : "Switch to English"}
    >
      {locale === "en" ? "中文" : "EN"}
    </button>
  )
}
