"use client";

import { Amplify } from "aws-amplify";
import type { ResourcesConfig } from "aws-amplify";

import { authConfig } from "@/lib/amplify/config";
import { applyTokenStorage, readRememberMe } from "@/lib/amplify/remember";

// Runs on import, before any component calls fetchAuthSession.
Amplify.configure(
    { Auth: authConfig as ResourcesConfig["Auth"] },
    { ssr: true },
);

// And straight after, because `ssr: true` installs a cookie storage of its own
// with a fixed year-long expiry. Re-applying the visitor's last answer to
// "Remember me" here is what stops a token refresh from turning the session
// cookies of a deliberately unremembered sign-in into dated ones.
if (typeof window !== "undefined") {
    applyTokenStorage(readRememberMe());
}

/** Renders nothing; it exists so the configure call above is pulled in. */
export function ConfigureAmplify() {
    return null;
}
