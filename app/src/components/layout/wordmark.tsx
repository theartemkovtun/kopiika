import { useTranslations } from "next-intl";
import { cn } from "cn";

import { Link } from "@/i18n/navigation";

/**
 * The wordmark, and the only script type in the app. The full stop is set in
 * the emphasis colour: it is the one flourish the design allows itself, and it
 * is also the link back to the Overview.
 */
export function Wordmark({ className }: { className?: string }) {
    const t = useTranslations("app");

    return (
        <Link
            href="/"
            className={cn(
                "font-script leading-[1.1] text-ink transition-colors",
                className,
            )}
        >
            {t("name")}
            <span className="text-blue">.</span>
        </Link>
    );
}
