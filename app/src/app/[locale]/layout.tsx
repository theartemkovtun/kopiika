import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import "../globals.css";

import { routing } from "@/i18n/routing";
import { fontVariables } from "@/lib/fonts";
import { ConfigureAmplify } from "@/providers/amplify-provider";
import { Analytics } from "@/providers/analytics";
import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
    title: "Kopiika",
    description: "A monthly ledger you actually read.",
};

/**
 * This is the app's root layout: with `localePrefix: "as-needed"` every request
 * is rewritten under `[locale]`, so there is no route above it to own <html>.
 */
export function generateStaticParams() {
    return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    if (!hasLocale(routing.locales, locale)) notFound();

    // Lets the static shell of a page be rendered without opting the whole
    // subtree into dynamic rendering.
    setRequestLocale(locale);

    return (
        // next-themes writes data-theme on <html> before paint, which React
        // would otherwise flag as a hydration mismatch.
        <html lang={locale} suppressHydrationWarning className={fontVariables}>
            <body>
                <NextIntlClientProvider>
                    <QueryProvider>
                        <ThemeProvider>
                            <ConfigureAmplify />
                            <Analytics />
                            {children}
                            <Toaster position="bottom-right" />
                        </ThemeProvider>
                    </QueryProvider>
                </NextIntlClientProvider>
            </body>
        </html>
    );
}
