"use client";

import { useTranslations } from "next-intl";
import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "cn";

import { RollingDigits } from "@/components/ui/rolling-digits";
import {
    type Period,
    lastSelectableMonth,
    usePeriod,
} from "@/contexts/period-context";
import { FIRST_YEAR } from "@/lib/dates";

/** Where `Year` sits in the row of chips, one past the twelve months. */
const YEAR_CHIP = 12;

/**
 * The month strip under the page title.
 *
 * All twelve months are always shown. The ones ahead of today are dimmed to the
 * rule colour and made inert rather than hidden, so walking back through the
 * years never reflows the row — the strip is a ruler, and a ruler does not
 * change length.
 *
 * `Year` sits past a divider because it is a different kind of choice: not a
 * thirteenth month but a way of collapsing all of them.
 *
 * The selected chip is underlined rather than ruled: at 5px of offset the line
 * belongs to the word, where a bottom border belonged to the button and had to
 * be reserved on every other chip to keep the row from shifting.
 *
 * That line is drawn once for the whole strip and slid to whichever word is
 * selected, so picking a month reads as the mark moving along the ruler rather
 * than as one underline blinking out and another blinking in. Where it lands is
 * measured off the word itself — the chips are as wide as their labels, which
 * depend on the locale and the font — and re-measured whenever anything in the
 * row changes size, including the row wrapping onto a second line on a narrow
 * screen. Until that first measurement lands, and so in the server's HTML, the
 * selected chip carries the plain text underline: the same line in the same
 * place, just not one that can move.
 *
 * The year at the end of the row steps rather than counts, so it is rolled a
 * digit at a time — see `rolling-digits.tsx` for why it is not the same
 * component the summary totals use.
 *
 * Which period is *drawn* comes in as a prop rather than off the context, for
 * the same reason the page title takes it that way: the context falls back to
 * today on the server, where there is no `window` to read the address bar
 * from, so a reload on `?month=3` would serve HTML with March in the title and
 * the mark under this month. React does not rewrite an attribute it finds
 * already in place, so that wrong `text-blue` would survive hydration and sit
 * there, on a chip the underline had since left. The page hands both the title
 * and the strip one period, derived from `searchParams` on the server and from
 * the context on the client, so the two agree in the first painted frame.
 * Everything that only follows from the selection — which months are past the
 * end of the year, whether either arrow can move — is worked out here from
 * that same period instead.
 */
export function PeriodBar({
    period,
    className,
}: {
    period: Period;
    className?: string;
}) {
    const t = useTranslations("calendar");
    const tPeriod = useTranslations("period");
    const { today, selectMonth, selectYear, previousYear, nextYear } =
        usePeriod();

    const { month, year, yearView } = period;
    const maxMonth = lastSelectableMonth(year, today);
    const canGoBack = year > FIRST_YEAR;
    const canGoForward = year < today.year;

    const monthsShort = t.raw("monthsShort") as string[];

    const strip = useRef<HTMLDivElement>(null);
    const words = useRef<(HTMLSpanElement | null)[]>([]);
    const [rule, setRule] = useState<{
        left: number;
        top: number;
        width: number;
    } | null>(null);

    const selected = yearView ? YEAR_CHIP : month;

    useLayoutEffect(() => {
        const container = strip.current;
        if (!container) return;

        const measure = () => {
            const word = words.current[selected];
            if (!word) return;

            // A pixel under the word's own box, which is a line-height tall and
            // so ends just past where the text underline is drawn.
            const next = {
                left: word.offsetLeft,
                top: word.offsetTop + word.offsetHeight + 1,
                width: word.offsetWidth,
            };

            // Returning the same object bails out of the render, so a resize
            // that moves nothing costs nothing.
            setRule((current) =>
                current &&
                current.left === next.left &&
                current.top === next.top &&
                current.width === next.width
                    ? current
                    : next,
            );
        };

        measure();

        // The strip for wrapping and for the row's own width; every word for
        // the moment the real font swaps in under it, which changes where the
        // later chips start without changing the strip at all.
        const observer = new ResizeObserver(measure);
        observer.observe(container);
        for (const word of words.current) {
            if (word) observer.observe(word);
        }

        return () => observer.disconnect();
    }, [selected]);

    return (
        <div
            ref={strip}
            className={cn(
                "relative flex flex-wrap items-center gap-1 border-y border-rule py-[10px] text-xs",
                className,
            )}
        >
            {rule ? (
                <span
                    aria-hidden
                    style={{
                        width: rule.width,
                        transform: `translate(${rule.left}px, ${rule.top}px)`,
                    }}
                    // The line is born already in place — a browser starts no
                    // transition on the style an element is inserted with — so
                    // only the moves after that one are animated.
                    className="absolute top-0 left-0 h-px bg-blue transition-[transform,width] duration-200 ease-out motion-reduce:transition-none"
                />
            ) : null}

            {monthsShort.map((label, index) => {
                const disabled = index > maxMonth;
                const current = !yearView && index === month;

                return (
                    <button
                        key={label}
                        type="button"
                        disabled={disabled}
                        aria-pressed={current}
                        onClick={() => selectMonth(index)}
                        className={cn(
                            "px-[7px] py-1 underline-offset-[5px] transition-colors",
                            disabled
                                ? "pointer-events-none text-rule"
                                : current
                                  ? cn(
                                        "text-blue",
                                        !rule && "underline decoration-1",
                                    )
                                  : "cursor-pointer text-mute hover:text-blue",
                        )}
                    >
                        <span
                            ref={(node) => {
                                words.current[index] = node;
                            }}
                            className="inline-block"
                        >
                            {label}
                        </span>
                    </button>
                );
            })}

            <span aria-hidden className="mx-2 h-4 w-px bg-rule" />

            <button
                type="button"
                aria-pressed={yearView}
                onClick={selectYear}
                className={cn(
                    "cursor-pointer px-[7px] py-1 underline-offset-[5px] transition-colors",
                    yearView
                        ? cn("text-blue", !rule && "underline decoration-1")
                        : "text-mute hover:text-blue",
                )}
            >
                <span
                    ref={(node) => {
                        words.current[YEAR_CHIP] = node;
                    }}
                    className="inline-block"
                >
                    {tPeriod("year")}
                </span>
            </button>

            <span className="ml-auto flex items-center gap-1.5">
                <button
                    type="button"
                    disabled={!canGoBack}
                    onClick={previousYear}
                    aria-label={String(year - 1)}
                    className={cn(
                        "px-1",
                        canGoBack
                            ? "cursor-pointer text-ink"
                            : "pointer-events-none text-rule",
                    )}
                >
                    ←
                </button>
                <RollingDigits value={year} className="text-ink" />
                <button
                    type="button"
                    disabled={!canGoForward}
                    onClick={nextYear}
                    aria-label={String(year + 1)}
                    className={cn(
                        "px-1",
                        canGoForward
                            ? "cursor-pointer text-ink"
                            : "pointer-events-none text-rule",
                    )}
                >
                    →
                </button>
            </span>
        </div>
    );
}
