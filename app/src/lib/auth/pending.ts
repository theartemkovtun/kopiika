/**
 * The address waiting on a confirmation code, handed from the form that
 * caused it to the `/totp` screen that clears it.
 *
 * It is in session storage rather than in a query string because it is an
 * email address and there is no reason to put one in a URL, and rather than in
 * a context because `/totp` is a route of its own — a context above both would
 * have to sit above the whole signed-out shell to survive the navigation.
 *
 * The password is deliberately **not** kept. Signing up arms Amplify's own
 * auto sign-in, which finishes the job without one; arriving from the sign-in
 * form with an unconfirmed account cannot, so that path confirms the address
 * and asks for the password again.
 *
 * The keys are exported because `/totp` reads them through `useSessionItem`
 * rather than in an effect, and that hook wants the key itself.
 */

export const PENDING_EMAIL_KEY = "kopiika.pendingEmail";
export const PENDING_ORIGIN_KEY = "kopiika.pendingOrigin";
export const PENDING_SENT_AT_KEY = "kopiika.pendingCodeSentAt";

/** Which form sent them here, which decides what happens after the code. */
export type PendingOrigin = "signup" | "signin";

export function setPendingConfirmation(email: string, origin: PendingOrigin) {
    try {
        window.sessionStorage.setItem(PENDING_EMAIL_KEY, email);
        window.sessionStorage.setItem(PENDING_ORIGIN_KEY, origin);
        window.sessionStorage.removeItem(PENDING_SENT_AT_KEY);
    } catch {
        // Site data blocked. `/totp` will send them back to sign up, which is
        // the honest outcome: it has nothing to confirm.
    }
}

/**
 * Notes that a code has just gone out, which is what the resend countdown
 * counts from. Kept beside the address so that reloading the code screen does
 * not hand back a fresh countdown — or a way around one.
 *
 * Returns the moment it recorded, for the screen to hold in state: storage is
 * read once at hydration and is not watched for changes.
 */
export function markCodeSent(): number {
    const sentAt = Date.now();

    try {
        window.sessionStorage.setItem(PENDING_SENT_AT_KEY, String(sentAt));
    } catch {
        // The countdown still runs for this screen; it just will not survive
        // a reload.
    }

    return sentAt;
}

export function clearPendingConfirmation() {
    try {
        window.sessionStorage.removeItem(PENDING_EMAIL_KEY);
        window.sessionStorage.removeItem(PENDING_ORIGIN_KEY);
        window.sessionStorage.removeItem(PENDING_SENT_AT_KEY);
    } catch {
        // Nothing was stored in the first place.
    }
}
