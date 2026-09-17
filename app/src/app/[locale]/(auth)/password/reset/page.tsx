"use client";

import { confirmResetPassword, resetPassword } from "aws-amplify/auth";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { toast } from "sonner";
import { cn } from "cn";

import { AuthField, ShowPasswordButton } from "@/components/auth/auth-field";
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
import { Link, useRouter } from "@/i18n/navigation";
import { authErrorKey } from "@/lib/auth/errors";
import { MIN_PASSWORD_LENGTH, isValidEmail } from "@/lib/auth/validate";

const RESEND_MS = 60_000;

/**
 * Resetting a password, both halves of it.
 *
 * Cognito's reset is two calls with a code in between, and the design draws
 * them as two states of one screen rather than two routes: the address typed
 * in the first is what the second is about, so splitting them would mean
 * carrying an email address through a URL for no gain. A reload drops back to
 * the first step, which is the honest answer — the code is in the inbox, and
 * asking for the address again costs one line of typing.
 *
 * `UserNotFoundException` is worth showing here, unlike on the sign-in form: a
 * reset that silently does nothing for a mistyped address is a dead end. A
 * pool with "prevent user existence errors" turned on never sends it anyway.
 */
export default function PasswordResetPage() {
    const t = useTranslations("auth");
    const router = useRouter();

    const emailId = useId();
    const passwordId = useId();
    const repeatId = useId();

    const [step, setStep] = useState<"email" | "code">("email");
    const [sentAt, setSentAt] = useState<number | null>(null);
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [password, setPassword] = useState("");
    const [repeat, setRepeat] = useState("");
    const [shown, setShown] = useState(false);
    const [outcome, setOutcome] = useState<AuthOutcome>(null);
    const [isPending, setIsPending] = useState(false);

    const left = useCountdown(sentAt ? sentAt + RESEND_MS : null);

    function edit<T>(set: (value: T) => void) {
        return (value: T) => {
            set(value);
            setOutcome(null);
        };
    }

    /** Asks for a code. Shared by the first step and by "Resend code". */
    async function sendCode(): Promise<boolean> {
        const { nextStep } = await resetPassword({ username: email.trim() });

        if (nextStep.resetPasswordStep === "DONE") {
            // The pool reset it without a code — nothing left to confirm.
            toast.success(t("passwordSaved"));
            router.replace("/login");
            return false;
        }

        setSentAt(Date.now());
        return true;
    }

    async function requestCode(event: React.FormEvent) {
        event.preventDefault();
        if (isPending) return;

        if (!isValidEmail(email)) {
            setOutcome({ kind: "error", text: t("errEmail") });
            return;
        }

        setIsPending(true);
        setOutcome(null);

        try {
            if (await sendCode()) {
                setStep("code");
                setIsPending(false);
            }
        } catch (error) {
            const key =
                error instanceof Error && error.name === "UserNotFoundException"
                    ? "errNoAccount"
                    : authErrorKey(error);

            setOutcome({ kind: "error", text: t(key) });
            setIsPending(false);
        }
    }

    async function savePassword(event: React.FormEvent) {
        event.preventDefault();
        if (isPending) return;

        if (!isCompleteCode(code)) {
            setOutcome({ kind: "error", text: t("errCode") });
            return;
        }
        if (password.length < MIN_PASSWORD_LENGTH) {
            setOutcome({ kind: "error", text: t("errPassword") });
            return;
        }
        if (repeat !== password) {
            setOutcome({ kind: "error", text: t("errRepeat") });
            return;
        }

        setIsPending(true);
        setOutcome(null);

        try {
            await confirmResetPassword({
                username: email.trim(),
                confirmationCode: codeDigits(code),
                newPassword: password,
            });

            toast.success(t("passwordSaved"));
            router.replace("/login");
        } catch (error) {
            setOutcome({ kind: "error", text: t(authErrorKey(error)) });
            setIsPending(false);
        }
    }

    async function resend() {
        if (left > 0 || isPending) return;

        try {
            if (await sendCode()) {
                setCode("");
                setOutcome({ kind: "ok", text: t("codeResent") });
            }
        } catch (error) {
            setOutcome({ kind: "error", text: t(authErrorKey(error)) });
        }
    }

    if (step === "email") {
        return (
            <>
                <AuthTitle>{t("resetTitle")}</AuthTitle>

                <AuthForm onSubmit={requestCode}>
                    <AuthNote>{t("resetNote")}</AuthNote>

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

                    <AuthMessage outcome={outcome} />

                    <Button type="submit" disabled={isPending}>
                        {isPending ? t("resetWorking") : t("resetButton")}
                    </Button>

                    <Link
                        href="/login"
                        className={cn(authTextClass, "self-start")}
                    >
                        {t("backToSignIn")}
                    </Link>
                </AuthForm>
            </>
        );
    }

    return (
        <>
            <AuthTitle>{t("newPasswordTitle")}</AuthTitle>

            <AuthForm onSubmit={savePassword}>
                <AuthNote>
                    {t("newPasswordNote", { email: email.trim() })}
                </AuthNote>

                <CodeInput
                    label={t("code")}
                    value={code}
                    onChange={(next) => edit(setCode)(next)}
                    disabled={isPending}
                />

                <AuthField
                    id={passwordId}
                    label={t("newPassword")}
                    type={shown ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder={t("newPasswordHint")}
                    value={password}
                    onChange={(event) => edit(setPassword)(event.target.value)}
                    action={
                        <ShowPasswordButton
                            shown={shown}
                            onToggle={() => setShown(!shown)}
                        />
                    }
                />

                <AuthField
                    id={repeatId}
                    label={t("repeatNewPassword")}
                    type={shown ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder={t("repeatPasswordHint")}
                    value={repeat}
                    onChange={(event) => edit(setRepeat)(event.target.value)}
                />

                <AuthMessage outcome={outcome} />

                <Button type="submit" disabled={isPending}>
                    {isPending ? t("savingPassword") : t("savePassword")}
                </Button>

                <div className="flex flex-wrap items-center gap-4">
                    <button
                        type="button"
                        onClick={() => {
                            setStep("email");
                            setOutcome(null);
                        }}
                        className={authTextClass}
                    >
                        {t("back")}
                    </button>

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
        </>
    );
}
