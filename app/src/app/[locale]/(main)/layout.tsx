import { setRequestLocale } from "next-intl/server";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileHeader } from "@/components/layout/mobile-header";
import { PeriodProvider } from "@/contexts/period-context";
import { PreferencesProvider } from "@/contexts/preferences-context";
import { UserProvider } from "@/contexts/user-context";
import { getValidLocale } from "@/lib/locales";

/**
 * The signed-in shell: the design's grid, a fixed 208px rail and a 1120px
 * reading measure. Below ~768px the rail is replaced by a drawer.
 *
 * The chrome is deliberately *outside* the providers. Nothing in the sidebar
 * depends on the user record — it is navigation, a theme toggle and a link —
 * so gating it on a network round trip would leave the rail blank on a cold
 * load for no reason. Only the page content waits.
 *
 * Inside, the order is a dependency chain rather than a preference: preferences
 * read the display currency and language off the user, so the user resolves
 * first.
 */
export default async function MainLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);

    return (
        <div className="min-h-screen md:grid md:grid-cols-[var(--spacing-sidebar)_minmax(0,1fr)]">
            <MobileHeader />
            <AppSidebar className="hidden md:flex" />

            <main className="mx-auto w-full max-w-[var(--spacing-content)] px-5 pt-8 pb-16 md:px-14 md:pt-10 md:pb-[72px]">
                <UserProvider fallback={<ContentFallback />}>
                    <PreferencesProvider locale={getValidLocale(locale)}>
                        <PeriodProvider>{children}</PeriodProvider>
                    </PreferencesProvider>
                </UserProvider>
            </main>
        </div>
    );
}

/**
 * Shown while the user record is in flight. It draws the shapes the content
 * will take — the title plate, then the period strip — so the page settles into
 * them rather than jumping when they land.
 */
function ContentFallback() {
    return (
        <div aria-hidden>
            <div className="h-[clamp(40px,6vw,72px)] w-[min(320px,60%)] animate-pulse bg-rule2" />
            <div className="mt-[10px] h-5 w-20 animate-pulse bg-rule2" />
            <div className="mt-7 h-[42px] border-y border-rule" />
        </div>
    );
}
