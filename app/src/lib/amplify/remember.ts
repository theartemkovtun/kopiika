import { cognitoUserPoolsTokenProvider } from "aws-amplify/auth/cognito";
import { CookieStorage } from "aws-amplify/utils";

/**
 * What "Remember me" on the sign-in form actually changes.
 *
 * The tokens live in cookies rather than in local storage — that is the only
 * reason middleware can see a session at all — so the checkbox is a question
 * about those cookies' lifetime, and nothing else:
 *
 *   checked    dated cookies, a year out, which survive closing the browser
 *   unchecked  session cookies, which the browser drops when it closes
 *
 * Amplify writes the cookies through the token provider's key-value storage,
 * so the choice has to be applied *before* the tokens are written, and again
 * on every load: a token refresh rewrites all three cookies, and a refresh
 * running under the stock storage would quietly promote a session cookie to a
 * dated one. Hence the stored preference, read back by the provider at boot.
 *
 * `sameSite: "lax"` matches the storage Amplify installs itself for `ssr:true`
 * — leaving it off would change the cookies in a second, unrelated way.
 */

/** Exported because the sign-in form reads it through `useLocalItem`. */
export const REMEMBER_STORAGE_KEY = "kopiika.rememberMe";

/** Amplify's own default lifetime, in days. */
const REMEMBERED_DAYS = 365;

/** Defaults to true: a first visit has never answered the question. */
export function readRememberMe(): boolean {
    if (typeof window === "undefined") return true;

    try {
        return window.localStorage.getItem(REMEMBER_STORAGE_KEY) !== "false";
    } catch {
        // Private window, or site data blocked.
        return true;
    }
}

/**
 * Points the token provider at cookies of the right lifetime. An explicit
 * `expires: undefined` is the session cookie — omitting the key entirely gets
 * CookieStorage's own 365-day default instead.
 */
export function applyTokenStorage(remember: boolean) {
    cognitoUserPoolsTokenProvider.setKeyValueStorage(
        new CookieStorage({
            sameSite: "lax",
            expires: remember ? REMEMBERED_DAYS : undefined,
        }),
    );
}

/** Records the choice and applies it, in that order. Call before signing in. */
export function setRememberMe(remember: boolean) {
    try {
        window.localStorage.setItem(REMEMBER_STORAGE_KEY, String(remember));
    } catch {
        // The choice still holds for this tab: the storage below is set either
        // way, it just will not be remembered for the next load.
    }

    applyTokenStorage(remember);
}
