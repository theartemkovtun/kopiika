import { StatsigClient } from "@statsig/js-client";

import type { TransactionType, User } from "@/api/types";

/**
 * Product events, sent to Statsig. This module is the only thing that touches
 * the SDK; everything else calls `track`.
 *
 * What is sent is deliberately thin. The screens are full of balances, amounts
 * and names the user typed, and none of that belongs in an analytics store, so
 * metadata is enums and booleans only — never an amount, a title, a
 * description, a name or a colour. The catalogue below is typed so that rule is
 * visible in one place, and a new field has to be added here before it can be
 * sent.
 *
 * Tracking is off when there is no key: a blank value, or the build's
 * `__NEXT_PUBLIC_…__` sentinel that the entrypoint was given nothing for. Every
 * call is then a no-op, and any SDK failure is swallowed — analytics is never
 * why a screen breaks.
 */

type NoMetadata = Record<string, never>;

export type AnalyticsEvents = {
    page_view: { path: string };

    signed_in: { method: "password" | "google" };
    signed_up: NoMetadata;
    signed_out: NoMetadata;

    transaction_created: {
        type: TransactionType;
        has_category: boolean;
        has_account: boolean;
        has_description: boolean;
    };
    transaction_updated: { type: TransactionType };
    transaction_deleted: NoMetadata;

    /** The account's currency code, lower case — not its balance. */
    account_created: { currency: string };
    account_updated: NoMetadata;
    account_deleted: NoMetadata;

    category_created: NoMetadata;
    category_updated: NoMetadata;
    category_deleted: NoMetadata;

    language_changed: { language: string };
    currency_changed: { currency: string };
    cents_toggled: { show_cents: boolean };
    theme_changed: { theme: string };
};

export type AnalyticsEvent = keyof AnalyticsEvents;

const CLIENT_KEY = process.env.NEXT_PUBLIC_STATSIG_CLIENT_KEY ?? "";

let client: StatsigClient | null = null;

/**
 * The client, created on first use in the browser. Before sign-in it logs
 * against Statsig's own anonymous stableID; `identify` attaches the user.
 */
function getClient(): StatsigClient | null {
    if (client) return client;
    if (typeof window === "undefined") return null;
    if (!CLIENT_KEY.startsWith("client-")) return null;

    try {
        client = new StatsigClient(
            CLIENT_KEY,
            {},
            {
                environment: {
                    tier:
                        process.env.NODE_ENV === "production"
                            ? "production"
                            : "development",
                },
            },
        );
        // Not awaited: events logged before it resolves are queued.
        void client.initializeAsync().catch(() => {});
    } catch {
        client = null;
    }

    return client;
}

/** Starts the session early. Called once, from `instrumentation-client.ts`. */
export function initAnalytics() {
    getClient();
}

export function track<E extends AnalyticsEvent>(
    event: E,
    metadata: AnalyticsEvents[E],
) {
    const statsig = getClient();
    if (!statsig) return;

    try {
        // Statsig's metadata is string-valued.
        const values = Object.fromEntries(
            Object.entries(metadata).map(([key, value]) => [
                key,
                String(value),
            ]),
        );
        statsig.logEvent(event, undefined, values);
    } catch {
        // Dropped, not thrown.
    }
}

/**
 * Attaches the signed-in user to every event from here on. The id is the
 * Cognito sub, which is also the API's user id; no email or name is sent.
 *
 * Sync rather than async: there are no gates to re-evaluate, so there is
 * nothing to wait on the network for.
 */
export function identify(user: User) {
    const statsig = getClient();
    if (!statsig) return;

    try {
        statsig.updateUserSync({
            userID: user.id,
            custom: { language: user.language, currency: user.currency },
        });
    } catch {
        // Events still go out, just without the user.
    }
}

/** Back to anonymous, on sign-out. */
export function resetIdentity() {
    const statsig = getClient();
    if (!statsig) return;

    try {
        statsig.updateUserSync({});
    } catch {
        // As above.
    }
}
