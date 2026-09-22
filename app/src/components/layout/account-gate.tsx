"use client";

import { useLocale } from "next-intl";

import { PreferencesProvider } from "@/contexts/preferences-context";
import { useMaybeUser } from "@/contexts/user-context";
import { getValidLocale } from "@/lib/locales";

/**
 * Wraps the part of a screen that cannot be drawn without the account record —
 * which is anything carrying money, since the display currency and the cents
 * setting come off the user.
 *
 * It is deliberately *not* the whole page. A month name, a year, the strip of
 * twelve months: the browser already knows all of it, and holding it behind a
 * round trip bought a skeleton where a title could simply have been. So the
 * titles render on the first paint and only the figures wait.
 *
 * Preferences are mounted here rather than in the layout for the same reason
 * they are consumed here: they need the user, so they belong on the far side
 * of the gate. Reading `usePreferences` outside one is a mistake, and throws
 * like one.
 */
export function AccountGate({
    children,
    fallback = null,
}: {
    children: React.ReactNode;
    /** Holds the shape the content will take, so nothing jumps when it lands. */
    fallback?: React.ReactNode;
}) {
    const locale = getValidLocale(useLocale());
    const user = useMaybeUser();

    if (!user) return <>{fallback}</>;

    return (
        <PreferencesProvider locale={locale}>{children}</PreferencesProvider>
    );
}
