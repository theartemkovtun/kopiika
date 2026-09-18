"use client";

import { useTranslations } from "next-intl";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Link, usePathname } from "@/i18n/navigation";

/**
 * New entry, at the foot of the rail and of the drawer.
 *
 * It used to be item 05 of the numbered nav, which read it as another place to
 * go. It is the one thing in the app that makes a record, so it is set as the
 * one solid button on the chrome, held apart from the list of destinations and
 * pushed to the bottom of the column by `mt-auto`.
 *
 * The plus is a mark, not a word: it is hidden from a screen reader so the
 * button announces itself as "New entry" rather than as "plus New entry".
 *
 * `sm` rather than the default: a form's committing button is the tallest
 * thing on its screen because it ends the screen, and the rail's is standing
 * chrome that has to sit under a nav without out-weighing it.
 *
 * On /add itself it stays exactly as it is — a solid button has no quieter
 * state to fall to, and the design carries emphasis in a rule or a fill, not
 * in a shade. `aria-current` is what says so instead.
 */
export function NewEntryButton({
    onNavigate,
    className,
}: {
    onNavigate?: () => void;
    className?: string;
}) {
    const t = useTranslations("nav");
    const pathname = usePathname();
    const onAdd = pathname === "/add";

    return (
        <Button asChild size="sm" className={cn("mt-auto w-full", className)}>
            <Link
                href="/add"
                onClick={onNavigate}
                aria-current={onAdd ? "page" : undefined}
            >
                <span aria-hidden>+</span>
                {t("add")}
            </Link>
        </Button>
    );
}
