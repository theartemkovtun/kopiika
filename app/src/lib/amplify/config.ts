import type { ResourcesConfig } from "aws-amplify";

/**
 * Shared between the browser and the server runner, so both halves of auth
 * read one configuration.
 *
 * The Go API validates the **id** token against this pool's JWKS and takes the
 * `sub` claim as the user id; there is no separate identity table.
 */
export const authConfig: ResourcesConfig["Auth"] = {
    Cognito: {
        userPoolId: process.env.NEXT_PUBLIC_USER_POOL_ID!,
        userPoolClientId: process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID!,
        loginWith: {
            oauth: {
                domain: process.env.NEXT_PUBLIC_USER_POOL_DOMAIN!,
                scopes: [
                    "email",
                    "openid",
                    "profile",
                    "aws.cognito.signin.user.admin",
                ],
                redirectSignIn: (
                    process.env.NEXT_PUBLIC_COGNITO_OAUTH_REDIRECT_SIGN_IN ?? ""
                )
                    .split(",")
                    .filter(Boolean),
                redirectSignOut: (
                    process.env.NEXT_PUBLIC_COGNITO_OAUTH_REDIRECT_SIGN_OUT ??
                    ""
                )
                    .split(",")
                    .filter(Boolean),
                responseType: "code",
            },
        },
    },
};
