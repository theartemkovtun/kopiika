/**
 * The chart vocabulary, so that two charts on one screen agree.
 *
 * `--ch1`..`--ch6` are the design's own series, held at one lightness and one
 * chroma and assigned *by position*, largest share first. They are what an
 * account is drawn in, and what anything without a colour of its own falls
 * back to.
 *
 * A category is drawn in the colour stored against it instead — see
 * `categoryColor`.
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
 * A category's own colour.
 *
 * The API keeps one per category — `#00A36C` for food, `#000080` for
 * transportation — and a category someone creates carries whatever they picked,
 * so this is the colour the rest of their data is already labelled with.
 *
 * The column is a free `varchar(64)` with no format check behind it, so the
 * value is validated rather than trusted: anything that is not a hex colour
 * (an empty string, a name, junk) falls back to the positional series, which
 * keeps a bad row from drawing an invisible slice.
 *
 * One consequence worth knowing: a stored colour is one colour. It cannot
 * lighten for the dark theme the way `--ch*` does, so a category saved very
 * dark reads faintly on the dark ground, and a very pale one on the light.
 */
export function categoryColor(
    hexColor: string | null | undefined,
    index: number,
): string {
    const value = hexColor?.trim() ?? "";
    if (!HEX.test(value)) return seriesColor(index);

    return value.startsWith("#") ? value : `#${value}`;
}

/** Axis ticks are the design's mono micro-label, in the shape recharts takes. */
export const AXIS_TICK = {
    fontSize: 11,
    fill: "var(--mute)",
    fontFamily: "var(--font-jetbrains-mono), monospace",
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
 * The tooltip: a hairline box on the page ground, square, unshadowed, with the
 * figure in mono and the label it belongs to in sans.
 */
export const TOOLTIP = {
    cursor: { fill: "var(--rule2)" },
    contentStyle: {
        background: "var(--bg)",
        border: "1px solid var(--rule)",
        borderRadius: 0,
        fontFamily: "var(--font-jetbrains-mono), monospace",
        fontSize: 12,
        color: "var(--ink)",
        boxShadow: "none",
    },
    itemStyle: { color: "var(--ink)" },
    labelStyle: {
        color: "var(--mute)",
        fontFamily: "var(--font-instrument-sans), sans-serif",
    },
} as const;
