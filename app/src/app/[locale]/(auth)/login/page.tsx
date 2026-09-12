"use client";

import { signInWithRedirect } from "aws-amplify/auth";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { GoogleIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";

/**
 * The whole of signing in: one button.
 *
 * Google is the only provider on the user pool, so there is nothing to choose
 * between and no form to fill — the button hands off to Cognito's hosted UI,
 * which comes back to `/external-auth` with the code. Amplify keeps the tokens
 * in cookies (`ssr: true`), which is what lets the auth middleware see the
 * session on the next request.
 */
export default function LoginPage() {
    const t = useTranslations("auth");
    const tApp = useTranslations("app");
    const router = useRouter();
    const [isRedirecting, setIsRedirecting] = useState(false);

    async function signIn() {
        setIsRedirecting(true);

        try {
            await signInWithRedirect({ provider: "Google" });
            // Nothing below this line runs: the browser leaves for Cognito.
        } catch (error) {
            // A session was established in another tab while this page sat
            // open. Nothing is wrong — they are already in.
            if (
                error instanceof Error &&
                error.name === "UserAlreadyAuthenticatedException"
            ) {
                router.replace("/");
                return;
            }

            toast.error(t("signInFailed"));
            setIsRedirecting(false);
        }
    }

    return (
        <div className="flex flex-col items-center text-center">
            <h1 className="font-serif text-[40px] leading-[0.95] font-normal tracking-[-0.02em]">
                {t("loginTitle")}
            </h1>

            <p className="mt-4 max-w-[30ch] text-[15px] text-pretty text-mute">
                {tApp("tagline")}
            </p>

            <Button
                type="button"
                onClick={signIn}
                disabled={isRedirecting}
                className="mt-10 w-full"
            >
                <GoogleIcon />
                {isRedirecting ? t("signingIn") : t("withGoogle")}
            </Button>
        </div>
    );
}
