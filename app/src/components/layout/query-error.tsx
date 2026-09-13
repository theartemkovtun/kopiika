"use client";

import { useTranslations } from "next-intl";
import { cn } from "cn";

/**
 * A read that did not come back, said in the design's own parts: a rule, the
 * message, and the one thing to do about it.
 *
 * It sits inside the section that failed rather than replacing the screen, so
 * the panels whose reads *did* land stay on the page.
 */
export function QueryError({
    onRetry,
    className,
}: {
    onRetry: () => void;
    className?: string;
}) {
    const t = useTranslations("common");

    return (
        <div className={cn("border-t border-rule py-11", className)}>
            <p className="text-[15px] text-mute">{t("error")}</p>
            <button
                type="button"
                onClick={onRetry}
                className="mt-3 cursor-pointer border-b border-rule font-mono text-xs text-mute transition-colors hover:text-ink"
            >
                {t("retry")}
            </button>
        </div>
    );
}
