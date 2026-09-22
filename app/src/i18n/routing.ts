import { defineRouting } from "next-intl/routing";

import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@/lib/locales";

export const routing = defineRouting({
    locales: [...SUPPORTED_LOCALES],
    defaultLocale: DEFAULT_LOCALE,
    // The default locale carries no path segment; every other one does.
    localePrefix: "as-needed",
    localeDetection: true,
});
