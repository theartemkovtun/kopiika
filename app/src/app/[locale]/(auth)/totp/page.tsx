"use client";

import { autoSignIn, confirmSignUp, resendSignUpCode } from "aws-amplify/auth";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "cn";

import {
    type AuthOutcome,
    AuthForm,
    AuthMessage,
    AuthNote,
    AuthTitle,
    authTextClass,
} from "@/components/auth/auth-form";
import {
    CodeInput,
    codeDigits,
    isCompleteCode,
} from "@/components/auth/code-input";
import { Button } from "@/components/ui/button";
import { useCountdown } from "@/hooks/use-countdown";
import { useSessionItem } from "@/hooks/use-stored-item";
import { Link, useRouter } from "@/i18n/navigation";
import { authErrorKey } from "@/lib/auth/errors";
import {
    PENDING_EMAIL_KEY,
    PENDING_SENT_AT_KEY,
    clearPendingConfirmation,
    markCodeSent,
} from "@/lib/auth/pending";

/** The design's own wait before a code can be asked for again. */
const RESEND_MS = 60_000;

/**
 * The six-digit code Cognito emails on sign-up.
 *
 * Which address is being confirmed comes from session storage rather than from
 * the URL — see `@/lib/auth/pending`. Without one there is nothing to confirm,
 * so a direct visit is sent back to sign up; the wait for `undefined` before
 * deciding that is the difference between "nothing stored" and "not read yet",
 * and skipping it would bounce a legitimate visitor on every hard load.
 *
 * How it ends depends on how it was reached. Signing up armed Amplify's auto
 * sign-in, so confirming the address finishes the job and lands on the
 * Overview. Arriving from the sign-in form with an account that was never
 * confirmed cannot: no password was kept, deliberately, so that path confirms
 * the address and hands them back to a form they now know the answer to.
 */
export default function TotpPage() {
    const t = useTranslations("auth");
    const router = useRouter();

    const email = useSessionItem(PENDING_EMAIL_KEY);
    const storedSentAt = useSessionItem(PENDING_SENT_AT_KEY);

    const [resentAt, setResentAt] = useState<number | null>(null);
    const [code, setCode] = useState("");
    const [outcome, setOutcome] = useState<AuthOutcome>(null);
    const [isPending, setIsPending] = useState(false);

    // Storage is read once and not watched, so a resend from this screen is
    // held here and takes precedence over what was stored on the way in.
    const sentAt = resentAt ?? (storedSentAt ? Number(storedSentAt) : null);
    const left = useCountdown(sentAt ? sentAt + RESEND_MS : null);

    useEffect(() => {
        // `undefined` is "not read yet"; only a definite absence is a redirect.
        if (email === null) router.replace("/signup");
    }, [email, router]);

    async function submit(event: React.FormEvent) {
        event.preventDefault();
        if (isPending || !email) return;

        if (!isCompleteCode(code)) {
            setOutcome({ kind: "error", text: t("errCode") });
            return;
        }

        setIsPending(true);
        setOutcome(null);

        try {
            const { nextStep } = await confirmSignUp({
                username: email,
                confirmationCode: codeDigits(code),
            });

            clearPendingConfirmation();

            if (nextStep.signUpStep === "COMPLETE_AUTO_SIGN_IN") {
                try {
                    await autoSignIn();
                    router.replace("/");
                    router.refresh();
                    return;
                } catch {
                    // The flow was armed in another tab, or has already been
                    // spent. The address is confirmed either way.
                }
            }

            // A toast rather than the message line, because the sentence has to
            // outlive this screen: it explains the form they land on.
            toast.success(t("confirmed"));
            router.replace("/login");
        } catch (error) {
            setOutcome({ kind: "error", text: t(authErrorKey(error)) });
            setIsPending(false);
        }
    }

    async function resend() {
        if (left > 0 || isPending || !email) return;

        try {
            await resendSignUpCode({ username: email });
            setResentAt(markCodeSent());
            setCode("");
            setOutcome({ kind: "ok", text: t("codeResent") });
        } catch (error) {
            setOutcome({ kind: "error", text: t(authErrorKey(error)) });
        }
    }

    return (
        <>
            <AuthTitle>{t("confirmTitle")}</AuthTitle>

            {/* Nothing is drawn until the address is known: every line below
                names it, and the alternative is a flash of the wrong screen on
                the way to sign up. */}
            {email ? (
                <AuthForm onSubmit={submit}>
                    <AuthNote>{t("confirmNote", { email })}</AuthNote>

                    <CodeInput
                        label={t("code")}
                        value={code}
                        onChange={(next) => {
                            setCode(next);
                            setOutcome(null);
                        }}
                        disabled={isPending}
                    />

                    <AuthMessage outcome={outcome} />

                    <Button type="submit" disabled={isPending}>
                        {isPending ? t("confirmWorking") : t("confirmButton")}
                    </Button>

                    <div className="flex flex-wrap items-center gap-4">
                        <Link href="/login" className={authTextClass}>
                            {t("backToSignIn")}
                        </Link>

                        <button
                            type="button"
                            onClick={resend}
                            disabled={left > 0 || isPending}
                            className={cn(authTextClass, "ml-auto")}
                        >
                            {left > 0
                                ? t("resendIn", { seconds: left })
                                : t("resend")}
                        </button>
                    </div>
                </AuthForm>
            ) : null}
        </>
    );
}
