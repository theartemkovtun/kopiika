/** The design's own rule, and the floor the sign-up form checks against. */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Enough to catch a typo before a round trip; Cognito is the real judge.
 * Deliberately the same expression the design validates with.
 */
export function isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/**
 * How the sign-up form's meter reads a password: 0 (nothing typed) to 3.
 * Length carries two of the three points, because length is the only thing
 * that reliably helps; the third is for mixing in something that is not a
 * letter.
 */
export function passwordScore(password: string): 0 | 1 | 2 | 3 {
    if (!password) return 0;

    let score = 0;
    if (password.length >= MIN_PASSWORD_LENGTH) score++;
    if (password.length >= 12) score++;
    if (/[^a-zA-Z]/.test(password) && /[a-zA-Z]/.test(password)) score++;

    return Math.min(3, score) as 0 | 1 | 2 | 3;
}
