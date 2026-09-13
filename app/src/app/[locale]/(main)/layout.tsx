import { setRequestLocale } from "next-intl/server";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileHeader } from "@/components/layout/mobile-header";
import { PeriodProvider } from "@/contexts/period-context";
import { UserProvider } from "@/contexts/user-context";

/**
 * The signed-in shell: the design's grid, a fixed 208px rail and a 1120px
 * reading measure. Below ~768px the rail is replaced by a drawer.
 *
 * Neither provider here holds the page back. The chrome is outside them
 * because nothing in the sidebar depends on the user record — it is
 * navigation, a theme toggle and a link. Inside, the user read is started as
 * early as it can be but is not waited on: the period is the browser's own
 * clock, so a title and a month strip can be on the screen while `users/me` is
 * still in flight, and every screen's own read can go out alongside it rather
 * than queued behind it.
 *
 * What genuinely needs the record — anything that formats money — sits behind
 * `AccountGate` on each screen, which is also where preferences are mounted.
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
                <UserProvider>
                    <PeriodProvider>{children}</PeriodProvider>
                </UserProvider>
            </main>
        </div>
    );
}
