"use client";

import { signOut } from "aws-amplify/auth";
import { useTranslations } from "next-intl";
import { cn } from "cn";

import { GearIcon, LogoutIcon } from "@/components/icons";
import { SidebarNav } from "./sidebar-nav";
import { ThemeToggle } from "./theme-toggle";
import { Wordmark } from "./wordmark";
import { Button } from "@/components/ui/button";
import { Link, useRouter, usePathname } from "@/i18n/navigation";

/**
 * The desktop rail: a fixed 208px column that does not scroll with the page.
 *
 * Settings is deliberately not in the numbered nav — it is chrome, so it sits
 * with the theme toggle and logout in the footer, below `mt-auto`. The three
 * are spread with `justify-between` rather than a fixed gap so logout lands
 * at the far right regardless of the rail's width.
 */
export function AppSidebar({ className }: { className?: string }) {
    const t = useTranslations("nav");
    const tSettings = useTranslations("settings");
    const router = useRouter();
    const pathname = usePathname();
    const onSettings = pathname === "/settings";

    async function logout() {
        await signOut();
        router.replace("/login");
    }

    return (
        <aside
            className={cn(
                "sticky top-0 flex h-screen flex-col border-r border-rule px-7 pt-6 pb-[18px]",
                className,
            )}
        >
            <Wordmark className="text-[54px]" />

            <SidebarNav className="mt-6" />

            <div className="mt-auto flex items-center justify-between border-t border-rule pt-[14px]">
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
                <Button
                    type="button"
                    variant="icon"
                    title={tSettings("logout")}
                    aria-label={tSettings("logout")}
                    onClick={logout}
                >
                    <LogoutIcon />
                </Button>
            </div>
        </aside>
    );
}
