"use client";

import { useTranslations } from "next-intl";
import { cn } from "cn";

import { Link, usePathname } from "@/i18n/navigation";
import { NAV_ITEMS, isNavActive } from "@/lib/nav";

/**
 * The numbered nav, shared by the desktop rail and the mobile drawer.
 *
 * The numbers are positional, not identifiers: they come from the order of
 * NAV_ITEMS, so inserting a route renumbers the rest by itself.
 *
 * The rules are what carry the structure. Every item reserves a 2px bottom
 * border whether or not it is active, so selecting one thickens a line that was
 * already there instead of nudging the column by two pixels.
 */
export function SidebarNav({
    onNavigate,
    className,
}: {
    onNavigate?: () => void;
    className?: string;
}) {
    const t = useTranslations("nav");
    const pathname = usePathname();

    return (
        <nav
            className={cn("flex flex-col border-b border-rule", className)}
            aria-label={t("overview")}
        >
            {NAV_ITEMS.map((item, index) => {
                const active = isNavActive(item, pathname);

                return (
                    <Link
                        key={item.id}
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                            "flex items-baseline gap-3 border-b-2 py-2 text-left transition-colors",
                            index > 0 && "border-t border-t-rule",
                            active
                                ? "border-b-blue font-medium text-blue"
                                : "border-b-transparent text-ink hover:text-blue",
                        )}
                    >
                        <span className="font-mono text-[11px] text-mute">
                            {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="text-[15px]">{t(item.id)}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
