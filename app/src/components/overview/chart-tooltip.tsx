"use client";

import { cn } from "cn";

import { usePreferences } from "@/contexts/preferences-context";
import { MINUS } from "@/lib/money";

export type ChartTooltipRow = {
    name: string;
    /** A magnitude: the sign comes from `kind`, as it does on the wire. */
    value: number;
    kind: "income" | "expense";
    /** A swatch before the name, for a series drawn in a colour of its own. */
    color?: string;
};

/**
 * The body of every overview tooltip: a hairline box on the page ground,
 * square and unshadowed, with what was hovered on top and a row per figure.
 *
 * A figure is written the way the summary above writes it — income `+` in
 * green, spending `−` in red — so a number read off a chart says which way the
 * money went without the colour of the bar it came from. The sign follows the
 * role, not the value, so a day with nothing spent still reads `−₴0`.
 *
 * Drawn as HTML rather than recharts' default content, which can only colour a
 * row as a whole and has no way to put a sign on the figure alone.
 */
export function ChartTooltip({
    label,
    rows,
}: {
    label?: string;
    rows: ChartTooltipRow[];
}) {
    const { formatValue } = usePreferences();

    if (rows.length === 0) return null;

    return (
        <div className="flex flex-col gap-1 border border-rule bg-bg px-[10px] py-2 text-xs text-ink tabular-nums">
            {label ? <span className="text-mute">{label}</span> : null}
            {rows.map((row) => (
                <span
                    key={row.name}
                    className="flex items-center justify-between gap-4 whitespace-nowrap"
                >
                    <span className="flex items-center gap-2">
                        {row.color ? (
                            <span
                                aria-hidden
                                className="inline-block size-2 flex-none rounded-full"
                                style={{ background: row.color }}
                            />
                        ) : null}
                        {row.name}
                    </span>
                    <span
                        className={cn(
                            row.kind === "income" ? "text-green" : "text-red",
                        )}
                    >
                        {row.kind === "income" ? "+" : MINUS}
                        {formatValue(row.value)}
                    </span>
                </span>
            ))}
        </div>
    );
}
