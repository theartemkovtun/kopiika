"use client";

import { useTranslations } from "next-intl";
import { cn } from "cn";

import { usePeriod } from "@/contexts/period-context";

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
 */
export function PeriodBar({ className }: { className?: string }) {
    const t = useTranslations("calendar");
    const tPeriod = useTranslations("period");
    const {
        month,
        year,
        yearView,
        maxMonth,
        canGoBack,
        canGoForward,
        selectMonth,
        selectYear,
        previousYear,
        nextYear,
    } = usePeriod();

    const monthsShort = t.raw("monthsShort") as string[];

    return (
        <div
            className={cn(
                "flex flex-wrap items-center gap-1 border-y border-rule py-[10px] text-xs",
                className,
            )}
        >
            {monthsShort.map((label, index) => {
                const disabled = index > maxMonth;
                const selected = !yearView && index === month;

                return (
                    <button
                        key={label}
                        type="button"
                        disabled={disabled}
                        aria-pressed={selected}
                        onClick={() => selectMonth(index)}
                        className={cn(
                            "px-[7px] py-1 underline-offset-[5px] transition-colors",
                            disabled
                                ? "pointer-events-none text-rule"
                                : selected
                                  ? "text-blue underline decoration-1"
                                  : "cursor-pointer text-mute hover:text-blue",
                        )}
                    >
                        {label}
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
                        ? "text-blue underline decoration-1"
                        : "text-mute hover:text-blue",
                )}
            >
                {tPeriod("year")}
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
                <span className="text-ink">{year}</span>
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
