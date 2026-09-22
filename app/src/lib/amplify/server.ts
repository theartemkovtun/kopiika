import { NextServer, createServerRunner } from "@aws-amplify/adapter-nextjs";
import type { ResourcesConfig } from "aws-amplify";
import { fetchAuthSession, getCurrentUser } from "aws-amplify/auth/server";

import { authConfig } from "./config";

export const { runWithAmplifyServerContext } = createServerRunner({
    config: { Auth: authConfig as ResourcesConfig["Auth"] },
});

/**
 * Reads the session from the request cookies, for the auth middleware.
 * Returns undefined when there is no valid session — a thrown Amplify error
 * means the same thing here, so it is swallowed rather than propagated into a
 * 500 on every unauthenticated page view.
 */
export async function authenticatedUser(context: NextServer.Context) {
    return runWithAmplifyServerContext({
        nextServerContext: context,
        operation: async (contextSpec) => {
            try {
                const session = await fetchAuthSession(contextSpec);
                if (!session.tokens) return undefined;

                return await getCurrentUser(contextSpec);
            } catch {
                return undefined;
            }
        },
    });
}
