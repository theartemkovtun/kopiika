"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { GearIcon, MenuIcon } from "@/components/icons";
import { NewEntryButton } from "./new-entry-button";
import { SidebarNav } from "./sidebar-nav";
import { ThemeToggle } from "./theme-toggle";
import { Wordmark } from "./wordmark";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { Link, usePathname } from "@/i18n/navigation";

/**
 * The rail does not survive a phone: a 208px fixed column plus a reading column
 * has nowhere to go under ~700px. Below that the same nav moves into a drawer
 * behind a bar, which leaves the desktop layout exactly as designed.
 *
 * The title and description are visually hidden rather than dropped — a drawer
 * still has to announce itself to a screen reader.
 *
 * New entry sits at the foot of the drawer as it does at the foot of the rail:
 * it is no longer in the nav, so the drawer has to carry it itself or the
 * phone loses the action entirely.
 */
export function MobileHeader() {
    const t = useTranslations("nav");
    const [open, setOpen] = useState(false);
    const pathname = usePathname();
    const onSettings = pathname === "/settings";

    return (
        <header className="sticky top-0 z-40 flex items-center gap-4 border-b border-rule bg-bg px-5 py-3 md:hidden">
            <Wordmark className="text-[28px]" />

            <div className="ml-auto flex items-center gap-2">
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
                    >
                        <GearIcon />
                    </Link>
                </Button>

                <Sheet open={open} onOpenChange={setOpen}>
                    <SheetTrigger asChild>
                        <Button variant="icon" aria-label={t("overview")}>
                            <MenuIcon />
                        </Button>
                    </SheetTrigger>
                    <SheetContent
                        side="left"
                        showCloseButton={false}
                        className="w-[260px] gap-0 px-7 pt-9 pb-[18px]"
                    >
                        <SheetTitle className="sr-only">
                            {t("overview")}
                        </SheetTitle>
                        <SheetDescription className="sr-only">
                            {t("overview")}
                        </SheetDescription>

                        <Wordmark className="text-[38px]" />
                        <SidebarNav
                            className="mt-9"
                            onNavigate={() => setOpen(false)}
                        />
                        <NewEntryButton onNavigate={() => setOpen(false)} />
                    </SheetContent>
                </Sheet>
            </div>
        </header>
    );
}
