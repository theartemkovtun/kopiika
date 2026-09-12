"use client";

import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { MoonIcon, SunIcon } from "@/components/icons";

/**
 * Flips between light and dark.
 *
 * Both icons are rendered and CSS picks one, rather than the usual `mounted`
 * flag. The server cannot know which theme the browser will resolve to, so
 * choosing in JS means either a wrong first paint or an empty slot until
 * hydration. next-themes stamps `data-theme` on <html> before first paint, and
 * the `dark:` variant is registered against that same attribute, so the right
 * icon is correct from the very first frame with no effect and no flash.
 *
 * The click reads `resolvedTheme` at call time, so a visitor still on "system"
 * flips away from whatever their OS is showing rather than from the literal
 * string "system" — which is what makes one click always do the visible thing.
 */
export function ThemeToggle() {
    const t = useTranslations("settings");
    const { resolvedTheme, setTheme } = useTheme();

    return (
        <Button
            type="button"
            variant="icon"
            aria-label={t("theme")}
            onClick={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
        >
            <SunIcon className="dark:hidden" />
            <MoonIcon className="hidden dark:block" />
        </Button>
    );
}
