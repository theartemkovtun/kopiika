"use client";

import "aws-amplify/auth/enable-oauth-listener";

import { fetchAuthSession } from "aws-amplify/auth";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { useRouter } from "@/i18n/navigation";

/**
 * Where Cognito's hosted UI lands after a federated sign-in.
 *
 * The import above is the whole of the exchange: it attaches Amplify's OAuth
 * listener, which reads the code out of the URL and trades it for tokens. There
 * is no promise to await, but `fetchAuthSession` blocks on an OAuth flow that
 * is still in flight, so awaiting it once is the same as waiting for the
 * exchange to finish — and it answers the only question that matters
 * afterwards: are there tokens?
 *
 * Either way the visitor is sent on: to the Overview with a session, back to
 * the sign-in form without one.
 *
 * It sits outside the `(auth)` group on purpose. Everything in that group is a
 * screen with something to read — a wordmark over it, a language to read it in
 * — and this is neither. It is a moment between two pages, and it is drawn as
 * one: an empty ground and a turning ring, nothing else.
 */
export default function ExternalAuthPage() {
    const t = useTranslations("auth");
    const router = useRouter();

    useEffect(() => {
        let cancelled = false;

        const send = (path: "/" | "/login") => {
            if (!cancelled) router.replace(path);
        };

        fetchAuthSession()
            .then((session) => send(session.tokens ? "/" : "/login"))
            .catch(() => send("/login"));

        return () => {
            cancelled = true;
        };
    }, [router]);

    return (
        <div className="flex min-h-screen items-center justify-center">
            {/* The one spinner in the app. The design has no loading state at
                all — every other wait here is a skeleton, drawn in rules — so
                this is built out of the same hairline the icons are: a full
                ring in the rule colour, one quarter of it in ink, turning.

                24px on a 24 viewBox, so the 1.6 stroke lands at exactly the
                weight every other piece of chrome is drawn at — sized down any
                further and the ring would thin out of the set.

                The label is read aloud and never drawn: a screen with a single
                unlabelled shape on it still has to say what it is waiting for. */}
            <svg
                role="status"
                aria-label={t("signingIn")}
                viewBox="0 0 24 24"
                fill="none"
                strokeWidth={1.6}
                className="size-6 animate-spin"
            >
                <circle cx="12" cy="12" r="10" className="stroke-rule" />
                <path
                    d="M22 12a10 10 0 0 0 -10 -10"
                    strokeLinecap="round"
                    className="stroke-ink"
                />
            </svg>
        </div>
    );
}
