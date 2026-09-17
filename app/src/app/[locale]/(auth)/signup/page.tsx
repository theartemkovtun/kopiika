"use client";

import { autoSignIn, signUp } from "aws-amplify/auth";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { cn } from "cn";

import { AuthField, ShowPasswordButton } from "@/components/auth/auth-field";
import {
    type AuthOutcome,
    AuthForm,
    AuthMessage,
    AuthTitle,
} from "@/components/auth/auth-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Link, useRouter } from "@/i18n/navigation";
import { authErrorKey, isErrorNamed } from "@/lib/auth/errors";
import { markCodeSent, setPendingConfirmation } from "@/lib/auth/pending";
import {
    MIN_PASSWORD_LENGTH,
    isValidEmail,
    passwordScore,
} from "@/lib/auth/validate";

/** The strength meter, as the design draws it: a word, and a hairline. */
const METER = [
    { width: "w-0", color: "bg-red", text: "text-red" },
    { width: "w-[33%]", color: "bg-red", text: "text-red" },
    { width: "w-[66%]", color: "bg-mute", text: "text-mute" },
    { width: "w-full", color: "bg-green", text: "text-green" },
] as const;

const STRENGTH = ["", "weak", "fair", "strong"] as const;

/**
 * Opening an account: a name, an address, a password twice, and the terms.
 *
 * `name` is a user-pool attribute rather than anything this app stores — the
 * Go API reads the profile off the token's pool, so what is typed here is what
 * the sidebar greets them with later.
 *
 * `autoSignIn` is armed on the way out. Cognito answers `CONFIRM_SIGN_UP`
 * almost always, which sends them to the code screen; that screen is what
 * redeems the flow armed here, so nothing has to carry the password across.
 * A pool configured without confirmation answers `COMPLETE_AUTO_SIGN_IN`
 * instead and the session is claimed on the spot.
 */
export default function SignupPage() {
    const t = useTranslations("auth");
    const router = useRouter();

    const nameId = useId();
    const emailId = useId();
    const passwordId = useId();
    const repeatId = useId();
    const termsId = useId();

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [repeat, setRepeat] = useState("");
    const [shown, setShown] = useState(false);
    const [terms, setTerms] = useState(false);
    const [outcome, setOutcome] = useState<AuthOutcome>(null);
    const [isPending, setIsPending] = useState(false);

    const score = passwordScore(password);
    const meter = METER[score];

    function edit<T>(set: (value: T) => void) {
        return (value: T) => {
            set(value);
            setOutcome(null);
        };
    }

    async function submit(event: React.FormEvent) {
        event.preventDefault();
        if (isPending) return;

        if (!name.trim()) {
            setOutcome({ kind: "error", text: t("errName") });
            return;
        }
        if (!isValidEmail(email)) {
            setOutcome({ kind: "error", text: t("errEmail") });
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
        if (!terms) {
            setOutcome({ kind: "error", text: t("errTerms") });
            return;
        }

        const username = email.trim();

        setIsPending(true);
        setOutcome(null);

        try {
            const { nextStep } = await signUp({
                username,
                password,
                options: {
                    userAttributes: { email: username, name: name.trim() },
                    autoSignIn: true,
                },
            });

            if (nextStep.signUpStep === "CONFIRM_SIGN_UP") {
                setPendingConfirmation(username, "signup");
                markCodeSent();
                router.push("/totp");
                return;
            }

            if (nextStep.signUpStep === "COMPLETE_AUTO_SIGN_IN") {
                await autoSignIn();
                router.replace("/");
                router.refresh();
                return;
            }

            // "DONE" without an auto sign-in to claim: the account exists, and
            // signing in is a form they have already filled in once.
            router.push("/login");
        } catch (error) {
            if (isErrorNamed(error, "UserAlreadyAuthenticatedException")) {
                router.replace("/");
                router.refresh();
                return;
            }

            setOutcome({ kind: "error", text: t(authErrorKey(error)) });
            setIsPending(false);
        }
    }

    return (
        <>
            <AuthTitle>{t("signupTitle")}</AuthTitle>

            <AuthForm onSubmit={submit}>
                <AuthField
                    id={nameId}
                    label={t("name")}
                    type="text"
                    autoComplete="name"
                    maxLength={64}
                    placeholder={t("nameHint")}
                    value={name}
                    onChange={(event) => edit(setName)(event.target.value)}
                />

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
                    autoComplete="new-password"
                    placeholder={t("newPasswordHint")}
                    value={password}
                    onChange={(event) => edit(setPassword)(event.target.value)}
                    note={
                        score > 0 ? (
                            <span
                                className={cn(
                                    "text-[11px] tracking-[0.06em] uppercase",
                                    meter.text,
                                )}
                            >
                                {t(STRENGTH[score])}
                            </span>
                        ) : null
                    }
                    action={
                        <ShowPasswordButton
                            shown={shown}
                            onToggle={() => setShown(!shown)}
                        />
                    }
                    meter={
                        // Drawn over the field's own hairline rather than under
                        // it, so the row does not grow by a pixel as it fills.
                        <span
                            aria-hidden
                            className={cn(
                                "absolute bottom-[-1px] left-0 h-px transition-[width] duration-200",
                                meter.width,
                                meter.color,
                            )}
                        />
                    }
                />

                <AuthField
                    id={repeatId}
                    label={t("repeatPassword")}
                    type={shown ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder={t("repeatPasswordHint")}
                    value={repeat}
                    onChange={(event) => edit(setRepeat)(event.target.value)}
                />

                <div className="flex items-start gap-[9px]">
                    <Checkbox
                        id={termsId}
                        checked={terms}
                        onCheckedChange={(checked) =>
                            edit(setTerms)(checked === true)
                        }
                        className="mt-[3px] size-[13px]"
                    />
                    <label
                        htmlFor={termsId}
                        className="cursor-pointer text-[13px] leading-[1.45] text-pretty text-ink"
                    >
                        {t("terms")}
                    </label>
                </div>

                <AuthMessage outcome={outcome} />

                <Button type="submit" disabled={isPending}>
                    {isPending ? t("signupWorking") : t("signupButton")}
                </Button>

                <p className="mt-[6px] text-center text-[13px] text-mute">
                    {t("haveAccount")}{" "}
                    <Link
                        href="/login"
                        className="text-ink underline underline-offset-[3px]"
                    >
                        {t("signIn")}
                    </Link>
                </p>
            </AuthForm>
        </>
    );
}
