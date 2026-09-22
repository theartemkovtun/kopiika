import { getRequestConfig } from "next-intl/server";

import { getValidLocale } from "@/lib/locales";

export default getRequestConfig(async ({ requestLocale }) => {
    const locale = getValidLocale(await requestLocale);

    return {
        locale,
        messages: (await import(`../../messages/${locale}.json`)).default,
        timeZone: "UTC",
    };
});
