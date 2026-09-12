import { setRequestLocale } from "next-intl/server";

import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Wordmark } from "@/components/layout/wordmark";

/**
 * The signed-out shell: one centred measure, the wordmark above it, and no
 * navigation at all — there is nowhere else to go until you are in.
 *
 * None of the signed-in providers are mounted here. There is no user to fetch,
 * and asking for one would 401 on every page load.
 */
export default async function AuthLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);

    return (
        <div className="flex min-h-screen flex-col px-5 py-9 md:px-14">
            <div className="flex items-center gap-4">
                <Wordmark className="text-[38px]" />
                <div className="ml-auto">
                    <ThemeToggle />
                </div>
            </div>

            <main className="mx-auto flex w-full max-w-[380px] flex-1 flex-col justify-center py-12">
                {children}
            </main>
        </div>
    );
}
