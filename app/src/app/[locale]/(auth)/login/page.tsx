"use client";

import { signIn, signInWithRedirect } from "aws-amplify/auth";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { cn } from "cn";

import { AuthField, ShowPasswordButton } from "@/components/auth/auth-field";
import {
    type AuthOutcome,
    AuthDivider,
    AuthForm,
    AuthMessage,
    AuthTitle,
    authTextClass,
} from "@/components/auth/auth-form";
import { GoogleIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Link, useRouter } from "@/i18n/navigation";
import { useLocalItem } from "@/hooks/use-stored-item";
import { REMEMBER_STORAGE_KEY, setRememberMe } from "@/lib/amplify/remember";
import { track } from "@/lib/analytics";
import { authErrorKey, isErrorNamed } from "@/lib/auth/errors";
import { setPendingConfirmation } from "@/lib/auth/pending";
import { MIN_PASSWORD_LENGTH, isValidEmail } from "@/lib/auth/validate";

/**
 * Signing in: an email and a password, with Google beside them.
 *
 * Two of the three outcomes of `signIn` are not failures. An account that was
 * never confirmed answers `CONFIRM_SIGN_UP`, which is the code screen rather
 * than an error; a pool that has forced a reset answers `RESET_PASSWORD`, which
 * is the screen below. Everything else that is not a session is a message.
 *
 * "Remember me" is applied *before* the call, not after: it decides the
 * lifetime of the cookies the sign-in is about to write. See
 * `@/lib/amplify/remember`.
 */
export default function LoginPage() {
    const t = useTranslations("auth");
    const router = useRouter();

    const emailId = useId();
    const passwordId = useId();
    const rememberId = useId();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [shown, setShown] = useState(false);
    const [outcome, setOutcome] = useState<AuthOutcome>(null);
    const [isPending, setIsPending] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);

    // The box opens on the last answer given on this browser, which the server
    // cannot know — hence the store read rather than an initial state, and
    // hence "anything but a stored no" rather than a plain boolean: the server
    // renders it checked, and so does a browser that has never been asked.
    const stored = useLocalItem(REMEMBER_STORAGE_KEY);
    const [chosen, setChosen] = useState<boolean | null>(null);
    const remember = chosen ?? stored !== "false";

    /** Any edit clears the last outcome: it described the previous attempt. */
    function edit<T>(set: (value: T) => void) {
        return (value: T) => {
            set(value);
            setOutcome(null);
        };
    }

    async function submit(event: React.FormEvent) {
        event.preventDefault();
        // Enter in a field submits even while the button is disabled.
        if (isPending || isLeaving) return;

        if (!isValidEmail(email)) {
            setOutcome({ kind: "error", text: t("errEmail") });
            return;
        }
        if (password.length < MIN_PASSWORD_LENGTH) {
            setOutcome({ kind: "error", text: t("errPassword") });
            return;
        }

        const username = email.trim();

        setIsPending(true);
        setOutcome(null);
        setRememberMe(remember);

        try {
            const { isSignedIn, nextStep } = await signIn({
                username,
                password,
            });

            if (isSignedIn) {
                track("signed_in", { method: "password" });
                // Left pending: the screen is on its way out, and a button
                // that springs back to "Sign in" first reads as a failure.
                router.replace("/");
                router.refresh();
                return;
            }

            if (nextStep.signInStep === "CONFIRM_SIGN_UP") {
                setPendingConfirmation(username, "signin");
                router.push("/totp");
                return;
            }

            if (nextStep.signInStep === "RESET_PASSWORD") {
                router.push("/password/reset");
                return;
            }

            // A pool set up for MFA or a forced password change lands here.
            // Neither has a screen, and neither is something a visitor can act
            // on, so it is reported rather than half-handled.
            setOutcome({ kind: "error", text: t("errGeneric") });
            setIsPending(false);
        } catch (error) {
            // A session was established in another tab while this page sat
            // open. Nothing is wrong — they are already in.
            if (isErrorNamed(error, "UserAlreadyAuthenticatedException")) {
                router.replace("/");
                router.refresh();
                return;
            }

            if (isErrorNamed(error, "UserNotConfirmedException")) {
                setPendingConfirmation(username, "signin");
                router.push("/totp");
                return;
            }

            setOutcome({ kind: "error", text: t(authErrorKey(error)) });
            setIsPending(false);
        }
    }

    async function withGoogle() {
        setIsLeaving(true);
        setOutcome(null);

        try {
            await signInWithRedirect({ provider: "Google" });
            // Nothing below this line runs: the browser leaves for Cognito.
        } catch (error) {
            if (isErrorNamed(error, "UserAlreadyAuthenticatedException")) {
                router.replace("/");
                router.refresh();
                return;
            }

            setOutcome({ kind: "error", text: t("signInFailed") });
            setIsLeaving(false);
        }
    }

    return (
        <>
            <AuthTitle>{t("loginTitle")}</AuthTitle>

            <AuthForm onSubmit={submit}>
                <AuthField
                    id={emailId}
                    label={t("email")}
                    type="email"
                    autoComplete="email"
                    spellCheck={false}
                    placeholder={t("emailHint")}
                    value={email}
                    onChange={(event) => edit(setEmail)(event.target.value)}
                />

                <AuthField
                    id={passwordId}
                    label={t("password")}
                    type={shown ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder={t("passwordHint")}
                    value={password}
                    onChange={(event) => edit(setPassword)(event.target.value)}
                    action={
                        <ShowPasswordButton
                            shown={shown}
                            onToggle={() => setShown(!shown)}
                        />
                    }
                />

                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-[9px]">
                        <Checkbox
                            id={rememberId}
                            checked={remember}
                            onCheckedChange={(checked) =>
                                setChosen(checked === true)
                            }
                            className="size-[13px]"
                        />
                        <label
                            htmlFor={rememberId}
                            className="cursor-pointer text-[13px] text-ink"
                        >
                            {t("remember")}
                        </label>
                    </div>

                    <Link
                        href="/password/reset"
                        className={cn(authTextClass, "ml-auto")}
                    >
                        {t("forgotPassword")}
                    </Link>
                </div>

                <AuthMessage outcome={outcome} />

                <Button type="submit" disabled={isPending || isLeaving}>
                    {isPending ? t("loginWorking") : t("loginButton")}
                </Button>

                <AuthDivider label={t("or")} />

                <Button
                    type="button"
                    variant="outline"
                    onClick={withGoogle}
                    disabled={isPending || isLeaving}
                    className="gap-[11px] py-3 text-ink hover:border-ink"
                >
                    <GoogleIcon size={18} />
                    {isLeaving ? t("signingIn") : t("withGoogle")}
                </Button>

                <p className="mt-[6px] text-center text-[13px] text-mute">
                    {t("noAccount")}{" "}
                    <Link
                        href="/signup"
                        className="text-ink underline underline-offset-[3px]"
                    >
                        {t("createAccount")}
                    </Link>
                </p>
            </AuthForm>
        </>
    );
}
