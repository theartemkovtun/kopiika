"use client";

import { useEffect, useRef } from "react";

import { usePathname } from "@/i18n/navigation";
import { track } from "@/lib/analytics";

const UUID_SEGMENT =
    /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi;

/**
 * Logs a `page_view` for every path the visitor lands on, the first load
 * included.
 *
 * The pathname comes from the i18n helper, so it is already free of the locale
 * prefix and `/uk/accounts` counts as `/accounts`. Ids are folded to `:id` so
 * every account's detail screen aggregates as one page. The ref holds the last
 * raw path logged, which is what keeps Strict Mode's double effect from counting a
 * page twice.
 */
export function TrackPageViews() {
    const pathname = usePathname();
    const lastPath = useRef<string | null>(null);

    useEffect(() => {
        if (pathname === lastPath.current) return;

        lastPath.current = pathname;
        track("page_view", { path: pathname.replace(UUID_SEGMENT, "/:id") });
    }, [pathname]);

    return null;
}
