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

export type FormatOptions = {
    locale?: SupportedLocale;
    /** Two decimal places, or none. Mirrors the design's `showCents`. */
    cents?: boolean;
    /** Force a leading + or −. Zero counts as positive, as in the design. */
    signed?: boolean;
};

/** U+2212, not a hyphen: it aligns with the digits in a tabular column. */
const MINUS = "−";
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
