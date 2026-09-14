/**
 * What an account needs beyond its name, currency and balance: a colour.
 *
 * `colorHex` is required on create and is what an account is drawn in
 * everywhere — the list row's dot, its band on the share bar, its heading on
 * the detail screen. As of v9 the design lets someone pick it: six presets on
 * the form, and a custom colour behind them. `ACCOUNT_SWATCHES` is that
 * preset row, and `newAccountColor` is what the form opens on.
 *
 * The account *type* the earlier design collected is gone — v8 dropped the
 * picker and the subtitle, and v9 has neither — so nothing is written to the
 * API's `description` any more.
 */

/**
 * `--ch1`..`--ch6` as the nearest sRGB at the light theme's lightness.
 *
 * The tokens themselves are `oklch(0.58 0.11 h)` and lighten in the dark
 * theme; a stored hex is one colour and cannot. Since accounts are drawn in
 * the colour stored against them, these are picked at the light theme's
 * lightness as the compromise: mid-toned enough to stay legible on the dark
 * ground too. An account created in another client can hold any hex at all,
 * including one that reads faintly in one theme or the other.
 */
export const ACCOUNT_SWATCHES = [
    "#4B7CBA",
    "#B1604C",
    "#448C56",
    "#8A68AE",
    "#98741A",
    "#008D94",
] as const;

/**
 * The swatch the form opens on, cycled by how many accounts are already held
 * so the first six differ.
 *
 * Only a suggestion at the moment of creation: the colour is stored on the
 * account and stays with it, so a later account being deleted never recolours
 * the ones around it.
 */
export function newAccountColor(existing: number): string {
    const index = Math.max(0, existing) % ACCOUNT_SWATCHES.length;
    return ACCOUNT_SWATCHES[index];
}

/**
 * The pool a share is measured against: the balances in credit, added up.
 *
 * The design divides by the sum of *every* balance, which its own sample data
 * never makes negative. Real data does. An overdrawn account subtracts from a
 * total it cannot take a band of, so measuring against the whole sum would let
 * one card in the red inflate every other account's share past 100% — and, if
 * the balances happened to cancel, divide by zero. The credited sum is what
 * the share bar is actually made of, so it is what a share is of.
 */
export function creditedTotal(worths: number[]): number {
    return worths.reduce((sum, worth) => (worth > 0 ? sum + worth : sum), 0);
}

/**
 * One balance's share of that pool, as a fraction of 1.
 *
 * Zero for an account in the red and for an empty pool: neither has a share to
 * draw, and both are the cases that would otherwise produce a negative width
 * or a division by zero.
 */
export function shareOfTotal(worth: number, pool: number): number {
    if (pool <= 0 || worth <= 0) return 0;
    return worth / pool;
}
