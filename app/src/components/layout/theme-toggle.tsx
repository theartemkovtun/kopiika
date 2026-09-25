"use client";

import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";

import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { buttonVariants } from "@/components/ui/button";
import { MoonIcon, SunIcon } from "@/components/icons";
import { track } from "@/lib/analytics";

/**
 * Flips between light and dark, wiping the new theme in from the button.
 *
 * Both icons are rendered and CSS picks one, rather than the usual `mounted`
 * flag. The server cannot know which theme the browser will resolve to, so
 * choosing in JS means either a wrong first paint or an empty slot until
 * hydration. next-themes stamps `data-theme` on <html> before first paint, and
 * the `dark:` variant is registered against that same attribute, so the right
 * icon is correct from the very first frame with no effect and no flash.
 *
 * `resolvedTheme` rather than `theme`, so a visitor still on "system" flips
 * away from whatever their OS is showing rather than from the literal string
 * "system" — which is what makes one click always do the visible thing. It is
 * undefined until next-themes mounts; "light" stands in, and nothing can be
 * clicked before then anyway.
 */
export function ThemeToggle() {
    const t = useTranslations("settings");
    const { resolvedTheme, setTheme } = useTheme();

    return (
        <AnimatedThemeToggler
            aria-label={t("theme")}
            title={t("theme")}
            theme={resolvedTheme === "dark" ? "dark" : "light"}
            onThemeChange={(theme) => {
                setTheme(theme);
                track("theme_changed", { theme });
            }}
            className={buttonVariants({ variant: "icon", size: "icon" })}
        >
            <SunIcon className="dark:hidden" />
            <MoonIcon className="hidden dark:block" />
        </AnimatedThemeToggler>
    );
}
