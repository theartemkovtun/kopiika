"use client";

import { getCurrentUser } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import { useEffect, useRef } from "react";

import { usePathname } from "@/i18n/navigation";
import { identifyById, track } from "@/lib/analytics";

const UUID_SEGMENT =
    /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi;

/**
 * Tells analytics who is signed in, and logs a `page_view` for every path the
 * visitor lands on, the first load included.
 *
 * Identity comes from the Amplify session rather than the user record, which
 * lands later and only inside the signed-in shell. `getCurrentUser` answers on
 * load — it waits out a Google hand-off still in flight — and until it does,
 * `track` holds events back, so the first page view is attributed too. After
 * that, Amplify's `signedIn` hub event carries the sub, and `signIn` awaits
 * its listeners, so the user is set before the sign-in screen navigates away.
 *
 * The pathname comes from the i18n helper, so it is already free of the locale
 * prefix and `/uk/accounts` counts as `/accounts`. Ids are folded to `:id` so
 * every account's detail screen aggregates as one page. The ref holds the last
 * raw path logged, which is what keeps Strict Mode's double effect from
 * counting a page twice.
 */
export function Analytics() {
    const pathname = usePathname();
    const lastPath = useRef<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        getCurrentUser()
            .then(({ userId }) => {
                if (!cancelled) identifyById(userId);
            })
            .catch(() => {
                if (!cancelled) identifyById(null);
            });

        const stop = Hub.listen("auth", ({ payload }) => {
            if (payload.event === "signedIn") identifyById(payload.data.userId);
            if (payload.event === "signedOut") identifyById(null);
        });

        return () => {
            cancelled = true;
            stop();
        };
    }, []);

    useEffect(() => {
        if (pathname === lastPath.current) return;

        lastPath.current = pathname;
        track("page_view", { path: pathname.replace(UUID_SEGMENT, "/:id") });
    }, [pathname]);

    return null;
}
