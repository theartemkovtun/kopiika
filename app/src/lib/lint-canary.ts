// Deliberately trips ESLint's prefer-const while still type-checking and
// formatting cleanly, so the App Linter check fails. Do not merge.
export function lintCanary(): string {
    let value = "canary";
    return value;
}
