"use client"

import { I18nProvider } from "@/lib/i18n/context"
import { translations } from "@/lib/i18n/translations"

export function I18nWrapper({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider translations={translations}>
      {children}
    </I18nProvider>
  )
}
