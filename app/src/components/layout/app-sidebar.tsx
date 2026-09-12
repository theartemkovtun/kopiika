"use client";

import { useTranslations } from "next-intl";
import { cn } from "cn";

import { GearIcon } from "@/components/icons";
import { SidebarNav } from "./sidebar-nav";
import { ThemeToggle } from "./theme-toggle";
import { Wordmark } from "./wordmark";
import { Button } from "@/components/ui/button";
import { Link, usePathname } from "@/i18n/navigation";

/**
 * The desktop rail: a fixed 208px column that does not scroll with the page.
 *
 * Settings is deliberately not in the numbered nav — it is chrome, so it sits
 * with the theme toggle in the footer, below `mt-auto`.
 */
export function AppSidebar({ className }: { className?: string }) {
    const t = useTranslations("nav");
    const pathname = usePathname();
    const onSettings = pathname === "/settings";

    return (
        <aside
            className={cn(
                "sticky top-0 flex h-screen flex-col border-r border-rule px-7 pt-9 pb-[18px]",
                className,
            )}
        >
            <Wordmark className="text-[42px]" />

            <SidebarNav className="mt-11" />

            <div className="mt-auto flex items-center gap-[14px] border-t border-rule pt-[14px]">
                <ThemeToggle />
                <Button
                    asChild
                    variant="icon"
                    className={onSettings ? "text-blue" : undefined}
                >
                    <Link
                        href="/settings"
                        title={t("settings")}
                        aria-label={t("settings")}
                        aria-current={onSettings ? "page" : undefined}
                    >
                        <GearIcon />
                    </Link>
                </Button>
            </div>
        </aside>
    );
}
