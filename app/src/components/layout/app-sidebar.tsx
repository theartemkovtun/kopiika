"use client";

import { signOut } from "aws-amplify/auth";
import { useTranslations } from "next-intl";
import { cn } from "cn";

import { GearIcon, LogoutIcon } from "@/components/icons";
import { NewEntryButton } from "./new-entry-button";
import { SidebarNav } from "./sidebar-nav";
import { ThemeToggle } from "./theme-toggle";
import { Wordmark } from "./wordmark";
import { Button } from "@/components/ui/button";
import { Link, useRouter, usePathname } from "@/i18n/navigation";
import { resetIdentity, track } from "@/lib/analytics";

/**
 * The desktop rail: a fixed 208px column that does not scroll with the page.
 *
 * Settings is deliberately not in the numbered nav — it is chrome, so it sits
 * with the theme toggle and logout in the footer. The three are spread with
 * `justify-between` rather than a fixed gap so logout lands at the far right
 * regardless of the rail's width.
 *
 * New entry is not in the nav either, for the opposite reason: it is the one
 * committing action here, so it is the one solid button, and it takes the
 * `mt-auto` that used to push the footer down — the button and the footer
 * ride the bottom of the column together.
 */
export function AppSidebar({ className }: { className?: string }) {
    const t = useTranslations("nav");
    const tSettings = useTranslations("settings");
    const router = useRouter();
    const pathname = usePathname();
    const onSettings = pathname === "/settings";

    async function logout() {
        track("signed_out", {});
        resetIdentity();
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

            <NewEntryButton />

            <div className="mt-[18px] flex items-center justify-between border-t border-rule pt-[14px]">
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
