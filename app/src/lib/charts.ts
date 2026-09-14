/**
 * The chart vocabulary, so that two charts on one screen agree.
 *
 * `--ch1`..`--ch6` are the design's own series, held at one lightness and one
 * chroma and assigned *by position*, largest share first. They are the
 * fallback for anything that has no colour of its own.
 *
 * Accounts and categories both carry a stored colour and are drawn in it — see
 * `storedColor`.
 */

const SERIES = [
    "var(--ch1)",
    "var(--ch2)",
    "var(--ch3)",
    "var(--ch4)",
    "var(--ch5)",
    "var(--ch6)",
] as const;

export function seriesColor(index: number): string {
    return SERIES[index % SERIES.length];
}

/** `#RGB`, `#RGBA`, `#RRGGBB` or `#RRGGBBAA`, with the hash optional. */
const HEX = /^#?(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * The colour a record carries itself — an account's `colorHex`, a category's
 * `hexColor`.
 *
 * This is the colour the rest of someone's data is already labelled with: the
 * hue they picked for an account, or the API's own `#00A36C` for food and
 * `#000080` for transportation. Drawing it means a record keeps its identity
 * across screens and across clients, rather than being recoloured by where it
 * happens to land in a sorted response.
 *
 * Neither column has a format check behind it, so the value is validated
 * rather than trusted: anything that is not a hex colour (an empty string, a
 * name, junk) falls back to the positional series, which keeps a bad row from
 * drawing an invisible slice.
 *
 * One consequence worth knowing: a stored colour is one colour. It cannot
 * lighten for the dark theme the way `--ch*` does, so a record saved very dark
 * reads faintly on the dark ground, and a very pale one on the light.
 */
export function storedColor(
    hexColor: string | null | undefined,
    index: number,
): string {
    return normalizeHexColor(hexColor ?? "") ?? seriesColor(index);
}

/**
 * A colour as the column should hold it — hash added, case settled — or null
 * when it is not a colour at all.
 *
 * This is the same test `storedColor` applies on the way out, applied on the
 * way in: the colour field refuses a typed value that would not survive the
 * round trip rather than storing one that draws as a fallback later.
 */
export function normalizeHexColor(value: string): string | null {
    const trimmed = value.trim();
    if (!HEX.test(trimmed)) return null;

    return (trimmed.startsWith("#") ? trimmed : `#${trimmed}`).toUpperCase();
}

/**
 * Axis ticks are the design's micro-label, in the shape recharts takes.
 *
 * recharts writes its ticks as SVG <text>, which does not inherit the page's
 * `font-feature-settings`, so the family is named here rather than left to the
 * cascade — otherwise the one place figures are drawn outside the document
 * flow would be the one place they are not tabular.
 */
export const AXIS_TICK = {
    fontSize: 11,
    fill: "var(--mute)",
    fontFamily: "var(--font-google-sans), sans-serif",
    fontFeatureSettings: '"tnum" 1',
} as const;

/**
 * A Y-axis figure, short enough for a 44px gutter: `12k`, `1.2k`, `840`.
 *
 * It is the axis only — never a figure someone might read as an amount — so
 * the rounding is free to be coarse.
 */
export function compactFigure(value: number): string {
    if (value >= 10_000) return `${Math.round(value / 1000)}k`;
    if (value >= 1000) return `${Math.round(value / 100) / 10}k`;
    return String(Math.round(value));
}

/**
 * The tooltip: a hairline box on the page ground, square and unshadowed. One
 * family throughout, with the figure held tabular so a hovered column does not
 * jitter as the digits under the pointer change width.
 */
export const TOOLTIP = {
    cursor: { fill: "var(--rule2)" },
    contentStyle: {
        background: "var(--bg)",
        border: "1px solid var(--rule)",
        borderRadius: 0,
        fontFamily: "var(--font-google-sans), sans-serif",
        fontFeatureSettings: '"tnum" 1',
        fontSize: 12,
        color: "var(--ink)",
        boxShadow: "none",
    },
    itemStyle: { color: "var(--ink)" },
    labelStyle: { color: "var(--mute)" },
} as const;
