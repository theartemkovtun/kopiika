import { INTL_LOCALES, type SupportedLocale } from "./locales";
import type { Amount } from "@/api/types";

/**
 * Currency display, matching the design exactly.
 *
 * `prefix` decides which side the symbol sits on, and a suffixed symbol is
 * joined with a non-breaking space so an amount never wraps away from its unit.
 *
 * Codes are lower case because that is what the API stores and expects; `label`
 * is the upper-case form the UI shows.
 */

export const CURRENCIES = [
    { code: "uah", label: "UAH", symbol: "₴", prefix: true },
    { code: "usd", label: "USD", symbol: "$", prefix: true },
    { code: "eur", label: "EUR", symbol: "€", prefix: true },
    { code: "pln", label: "PLN", symbol: "zł", prefix: false },
    { code: "gbp", label: "GBP", symbol: "£", prefix: true },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

const BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

export function currencyInfo(code: string) {
    return BY_CODE.get(code.toLowerCase() as CurrencyCode);
}

export function currencyLabel(code: string) {
    return currencyInfo(code)?.label ?? code.toUpperCase();
}

/**
 * The API sends every amount as a decimal string, so that no value is ever put
 * through a float on the wire. This is the one place it becomes a number.
 */
export function toNumber(value: string | number | null | undefined): number {
    if (value === null || value === undefined) return 0;
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * What someone typed in a figure field, as the decimal string the API takes —
 * or null when it is not a figure at all.
 *
 * The value is normalised as *text*: a comma becomes a point, grouping spaces
 * are dropped, and the digits themselves are handed on untouched, so an amount
 * never reaches the wire by way of a float.
 *
 * Zero passes, and so does a negative sign's absence: nothing here is signed,
 * because every field that uses it carries its sign in a type or a role.
 */
export function parseDecimalInput(input: string): string | null {
    // \s covers the non-breaking and narrow spaces `toLocaleString` groups
    // with, so a figure copied back out of the UI parses.
    const normalized = input.replace(/\s/g, "").replace(",", ".");

    if (!/^(\d+(\.\d*)?|\.\d+)$/.test(normalized)) return null;

    return normalized;
}

/**
 * The same rule a keystroke at a time: what is in a figure field, cut back to
 * the part of it that is still money.
 *
 * `parseDecimalInput` judges a finished value; this shapes an unfinished one,
 * so it has to let a half-typed figure stand — `""`, `"0."`, `"."` are all on
 * the way to an amount — while dropping what never could be one: a letter, a
 * sign, an exponent, a second separator, a third decimal place.
 *
 * The separator is left as it was typed, comma or point, because the parse
 * takes either and half the keyboards here say comma.
 */
export function filterDecimalInput(input: string): string {
    const kept = input.replace(/[^\d.,]/g, "");

    const at = kept.search(/[.,]/);
    if (at === -1) return kept;

    // Everything after the first separator is a decimal place, and there are
    // two of those in every currency the app carries.
    const fraction = kept.slice(at + 1).replace(/[.,]/g, "");
    return kept.slice(0, at) + kept[at] + fraction.slice(0, 2);
}

/**
 * The same, for a field that also has to be above zero — an entry's amount,
 * where a zero is not an entry. An opening balance is the other case: nothing
 * in an account is a real answer, so it uses `parseDecimalInput` directly.
 *
 * The parse to a number is only ever used to answer "is this above zero".
 */
export function parseAmountInput(input: string): string | null {
    const normalized = parseDecimalInput(input);
    if (normalized === null) return null;
    if (!(Number(normalized) > 0)) return null;

    return normalized;
}

export type FormatOptions = {
    locale?: SupportedLocale;
    /** Two decimal places, or none. Mirrors the design's `showCents`. */
    cents?: boolean;
    /** Force a leading + or −. Zero counts as positive, as in the design. */
    signed?: boolean;
};

/**
 * U+2212, not a hyphen: it aligns with the digits in a tabular column.
 *
 * Exported because a figure whose sign is fixed by its *role* rather than by
 * its value — spending, which is a magnitude on the wire and always shown
 * negative — has to spell the sign itself. `signed` would read `+₴0` on a
 * month with nothing spent.
 */
export const MINUS = "−";
const NBSP = " ";

/**
 * Formats a bare number. The sign is rendered separately from the magnitude so
 * that the symbol always hugs the digits: `−₴1,240.00`, never `₴−1,240.00`.
 */
export function formatNumber(
    value: number,
    currency: string,
    { locale = "en", cents = true, signed = false }: FormatOptions = {},
): string {
    const info = currencyInfo(currency);
    const digits = cents ? 2 : 0;

    const magnitude = Math.abs(value).toLocaleString(INTL_LOCALES[locale], {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });

    const symbol = info?.symbol ?? currency.toUpperCase();
    const prefix = info?.prefix ?? true;
    const body = prefix
        ? `${symbol}${magnitude}`
        : `${magnitude}${NBSP}${symbol}`;

    if (!signed) return body;
    return `${value >= 0 ? "+" : MINUS}${body}`;
}

/** Formats an `Amount` straight off the wire. */
export function formatAmount(
    amount: Amount | null | undefined,
    options?: FormatOptions,
): string {
    if (!amount) return "—";
    return formatNumber(toNumber(amount.value), amount.currency, options);
}

/** `+₴1,240.00` / `−₴1,240.00`, the ledger's own shorthand. */
export function formatSigned(
    amount: Amount | null | undefined,
    options?: FormatOptions,
): string {
    return formatAmount(amount, { ...options, signed: true });
}

/**
 * Transactions carry a type rather than a negative value, so the sign has to be
 * put back on before an amount is shown in a ledger column.
 */
export function signedValue(
    amount: Amount,
    type: "income" | "outcome",
): number {
    const value = Math.abs(toNumber(amount.value));
    return type === "income" ? value : -value;
}
