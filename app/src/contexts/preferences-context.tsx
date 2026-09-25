"use client";

import { usePathname, useRouter } from "@/i18n/navigation";
import { createContext, use, useCallback, useMemo, useState } from "react";

import { useUser } from "./user-context";
import { track } from "@/lib/analytics";
import type { SupportedLocale } from "@/lib/locales";
import {
    type FormatOptions,
    formatAmount,
    formatNumber,
    formatSigned,
} from "@/lib/money";
import type { Amount } from "@/api/types";

/**
 * The two settings that change how every screen reads: which currency totals
 * are shown in, and which language labels them. Both live on the user record,
 * so they follow the account across devices.
 *
 * `showCents` is deliberately local — it is a density preference, not account
 * data, and the API has nowhere to keep it.
 */

const CENTS_STORAGE_KEY = "kopiika.showCents";

type PreferencesContextValue = {
    locale: SupportedLocale;
    setLocale: (locale: SupportedLocale) => void;

    /** Lower case, as the API stores it. */
    currency: string;
    setCurrency: (currency: string) => void;

    showCents: boolean;
    setShowCents: (showCents: boolean) => void;

    /** Formatters already bound to the current locale and cents setting. */
    format: (
        amount: Amount | null | undefined,
        options?: FormatOptions,
    ) => string;
    formatSigned: (
        amount: Amount | null | undefined,
        options?: FormatOptions,
    ) => string;
    formatValue: (
        value: number,
        currency?: string,
        options?: FormatOptions,
    ) => string;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function readStoredCents(): boolean {
    if (typeof window === "undefined") return true;
    try {
        return window.localStorage.getItem(CENTS_STORAGE_KEY) !== "false";
    } catch {
        // Private window, or site data blocked. Fall back to the default.
        return true;
    }
}

export function PreferencesProvider({
    locale,
    children,
}: {
    locale: SupportedLocale;
    children: React.ReactNode;
}) {
    const { user, updateUser } = useUser();
    const router = useRouter();
    const pathname = usePathname();

    const [showCents, setShowCentsState] = useState(readStoredCents);

    const setShowCents = useCallback((next: boolean) => {
        setShowCentsState(next);
        track("cents_toggled", { show_cents: next });
        try {
            window.localStorage.setItem(CENTS_STORAGE_KEY, String(next));
        } catch {
            // Preference is still applied for this session.
        }
    }, []);

    const setLocale = useCallback(
        (next: SupportedLocale) => {
            // Move first so the UI turns over immediately; the write-back is
            // what makes it stick on the next device, not what makes it apply.
            router.replace(pathname, { locale: next, scroll: false });
            void updateUser({ language: next }).catch(() => {});
            track("language_changed", { language: next });
        },
        [pathname, router, updateUser],
    );

    const setCurrency = useCallback(
        (next: string) => {
            void updateUser({ currency: next.toLowerCase() });
            track("currency_changed", { currency: next.toLowerCase() });
        },
        [updateUser],
    );

    const currency = user.currency;

    const value = useMemo<PreferencesContextValue>(() => {
        const defaults: FormatOptions = { locale, cents: showCents };

        return {
            locale,
            setLocale,
            currency,
            setCurrency,
            showCents,
            setShowCents,
            format: (amount, options) =>
                formatAmount(amount, { ...defaults, ...options }),
            formatSigned: (amount, options) =>
                formatSigned(amount, { ...defaults, ...options }),
            formatValue: (value, code, options) =>
                formatNumber(value, code ?? currency, {
                    ...defaults,
                    ...options,
                }),
        };
    }, [currency, locale, setCurrency, setLocale, setShowCents, showCents]);

    return (
        <PreferencesContext.Provider value={value}>
            {children}
        </PreferencesContext.Provider>
    );
}

export function usePreferences() {
    const context = use(PreferencesContext);
    if (!context) {
        throw new Error(
            "usePreferences must be used within a PreferencesProvider",
        );
    }
    return context;
}
