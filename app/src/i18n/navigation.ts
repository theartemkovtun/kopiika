import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

/**
 * Locale-aware replacements for next/link and next/navigation. Use these
 * everywhere: they add or omit the locale segment to match `localePrefix`, so
 * no component has to know whether the current locale is the default one.
 *
 * `usePathname` here returns the path **without** the locale segment, which is
 * what nav active-state matching wants.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
    createNavigation(routing);
