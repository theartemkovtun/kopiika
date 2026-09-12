/**
 * Locale configuration.
 *
 * To add one: append the code here, drop a `messages/<code>.json` beside the
 * others, and add a label to LOCALE_LABELS. Nothing else reads the list.
 */

export const SUPPORTED_LOCALES = ["en", "uk"] as const;

export const DEFAULT_LOCALE = "en" as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/** How the settings screen and the language switch name each locale. */
export const LOCALE_LABELS: Record<SupportedLocale, string> = {
    en: "EN",
    uk: "УКР",
};

/** What `Intl` should be asked for when formatting under each locale. */
export const INTL_LOCALES: Record<SupportedLocale, string> = {
    en: "en-US",
    uk: "uk-UA",
};

export function isSupportedLocale(value: string): value is SupportedLocale {
    return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function getValidLocale(locale: string | undefined): SupportedLocale {
    return locale && isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
}
