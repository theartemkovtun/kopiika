"use client";

import { useLocale } from "next-intl";
import { cn } from "cn";

import { ThemeToggle } from "@/components/layout/theme-toggle";
import { usePathname, useRouter } from "@/i18n/navigation";
import {
    LOCALE_LABELS,
    SUPPORTED_LOCALES,
    type SupportedLocale,
} from "@/lib/locales";

/**
 * The strip under every signed-out screen: the two languages, and the theme.
 *
 * Both settings live on the user record once there is one, but there is no
 * record here — so language is a plain move to the same route under the other
 * locale, and the theme is the same toggle the sidebar carries. Whatever is
 * chosen here is what the sign-in screen is *read* in; the account's own
 * preferences take over the moment there is an account.
 */
export function AuthFooter() {
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();

    return (
        <div className="mt-[34px] flex items-center gap-[18px] border-t border-rule pt-4">
            {SUPPORTED_LOCALES.map((code) => (
                <LocaleButton
                    key={code}
                    code={code}
                    active={code === locale}
                    onSelect={() =>
                        router.replace(pathname, {
                            locale: code,
                            scroll: false,
                        })
                    }
                />
            ))}

            <div className="ml-auto">
                <ThemeToggle />
            </div>
        </div>
    );
}

function LocaleButton({
    code,
    active,
    onSelect,
}: {
    code: SupportedLocale;
    active: boolean;
    onSelect: () => void;
}) {
    return (
        <button
            type="button"
            aria-pressed={active}
            onClick={onSelect}
            className={cn(
                "cursor-pointer text-[13px] transition-colors",
                active ? "text-ink" : "text-mute hover:text-blue",
            )}
        >
            {LOCALE_LABELS[code]}
        </button>
    );
}
