import { setRequestLocale } from "next-intl/server";

import { AuthFooter } from "@/components/auth/auth-footer";
import { Wordmark } from "@/components/layout/wordmark";

/**
 * The signed-out shell: the wordmark at the top of the page, one 400px measure
 * centred under it, and the language and theme strip at its foot. There is no
 * navigation, because until you are in there is nowhere else to go.
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
        <div className="relative flex min-h-screen items-center justify-center">
            {/* Centred on the page rather than on the column, and inert: the
                Overview is behind the form, not behind the wordmark. */}
            <div className="pointer-events-none absolute top-[34px] right-0 left-0 flex justify-center">
                <Wordmark asLink={false} className="text-[38px]" />
            </div>

            <main className="flex w-full flex-col items-center px-5 pt-[104px] pb-14 sm:px-10">
                <div className="w-full max-w-[400px]">
                    {children}
                    <AuthFooter />
                </div>
            </main>
        </div>
    );
}
