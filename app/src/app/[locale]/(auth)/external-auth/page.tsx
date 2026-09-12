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
 * the sign-in button without one.
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
        <p className="font-mono text-[11px] tracking-[0.14em] text-mute uppercase">
            {t("signingIn")}
        </p>
    );
}
