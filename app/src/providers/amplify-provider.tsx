"use client";

import { Amplify } from "aws-amplify";
import type { ResourcesConfig } from "aws-amplify";

import { authConfig } from "@/lib/amplify/config";

// Runs on import, before any component calls fetchAuthSession.
Amplify.configure(
    { Auth: authConfig as ResourcesConfig["Auth"] },
    { ssr: true },
);

/** Renders nothing; it exists so the configure call above is pulled in. */
export function ConfigureAmplify() {
    return null;
}
