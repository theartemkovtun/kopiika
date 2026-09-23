"use client";

import { useTranslations } from "next-intl";
import { cn } from "cn";
import { useState } from "react";

import { RollingNumber } from "@/components/ui/rolling-number";
import { Skeleton } from "@/components/ui/skeleton";
import { usePeriod } from "@/contexts/period-context";
import { usePreferences } from "@/contexts/preferences-context";
import { useDateFormat } from "@/hooks/use-date-format";
import { useStatistics } from "@/hooks/use-statistics";
import { MINUS, toNumber } from "@/lib/money";

/**
 * Income, spent and kept, across the top of the Overview.
 *
 * The three read as one ruled band rather than as three cards: a hairline
 * under the row, one between each pair, and no fill anywhere. Only the figures
 * carry colour, and only the two that have a direction — income green,
 * spending red, kept whichever it turned out to be.
 *
 * A comparison note sits under each figure — "−₴4,000 vs Aug 12" — using the
 * `previousPeriodDiff` the statistics endpoint already computed against the
 * comparable previous period, so drawing it costs nothing beyond the one read.
 */
export function OverviewSummary() {
    const t = useTranslations("overview");
    const tCommon = useTranslations("common");

    const { range, comparison, isCurrentMonth } = usePeriod();
    const { formatValue } = usePreferences();
    const { rowLabel } = useDateFormat();

    const { data, isPlaceholderData } = useStatistics(range);

    // `comparison` switches the moment a month is picked, but `data` keeps
    // showing the outgoing period's figures until the new read lands (see
    // `useStatistics`). Reading `comparison` straight would relabel the note
    // ("vs Aug 15" → "vs previous month") a beat before the number under it
    // catches up — the blink this state avoids by holding the wording back
    // until the figures it describes actually arrive together.
    const [shown, setShown] = useState({ data, comparison });
    if (data !== shown.data && !isPlaceholderData) {
        setShown({ data, comparison });
    }

    const income = toNumber(shown.data?.income.value);
    const outcome = toNumber(shown.data?.outcome.value);
    const kept = toNumber(shown.data?.difference.value);

    // How the note names the span it read. A month names the day it was cut
    // at when there is one to name; a year says so in words, because "vs Sep
    // 14" over a figure covering nine months would read as a single day.
    const against =
        shown.comparison.scope === "year"
            ? shown.comparison.throughDate
                ? t("vsTodayPreviousYear")
                : t("vsPreviousYear")
            : shown.comparison.throughDate
              ? t("vsDate", { date: rowLabel(shown.comparison.throughDate) })
              : t("vsPreviousMonth");

    // Null while the read is in flight. The sign is the *change*, not the
    // direction of the money — `+₴500` under Spent means five hundred more
    // went out than by the same point before.
    const change = (diff: string | undefined) =>
        diff === undefined
            ? null
            : `${formatValue(toNumber(diff), undefined, { signed: true })} ${against}`;

    return (
        <Band>
            <Figure
                label={tCommon("income")}
                value={
                    shown.data ? (
                        <RollingNumber
                            value={income}
                            format={(value) => `+${formatValue(value)}`}
                        />
                    ) : null
                }
                tone="text-green"
                note={change(shown.data?.income.previousPeriodDiff)}
            />
            <Figure
                label={tCommon("spent")}
                value={
                    shown.data ? (
                        <RollingNumber
                            value={outcome}
                            format={(value) => `${MINUS}${formatValue(value)}`}
                        />
                    ) : null
                }
                tone="text-red"
                note={change(shown.data?.outcome.previousPeriodDiff)}
                divided
            />
            <Figure
                label={isCurrentMonth ? t("keptSoFar") : t("kept")}
                value={
                    shown.data ? (
                        <RollingNumber
                            value={kept}
                            format={(value) =>
                                formatValue(value, undefined, { signed: true })
                            }
                        />
                    ) : null
                }
                tone={kept >= 0 ? "text-green" : "text-red"}
                note={change(shown.data?.difference.previousPeriodDiff)}
                divided
            />
        </Band>
    );
}

/**
 * The band before the account record has landed.
 *
 * Its three labels are translations and its period is the browser's clock, so
 * none of it waits on the network — and since a figure in flight is a
 * skeleton square either way, this is the same empty state the band already
 * shows while the statistics are being read. The page therefore opens at its
 * full height, and the figures arrive into a band that is already drawn.
 */
export function OverviewSummaryFallback({
    isCurrentMonth,
}: {
    /**
     * Passed in rather than read off the context, for the reason
     * `FlowChartFallback` takes its period that way: this is a panel the
     * server renders, and there the context knows only today. A reload on a
     * period that is not this month would write "Kept so far" into the HTML
     * and correct it to "Kept" on hydration.
     */
    isCurrentMonth: boolean;
}) {
    const t = useTranslations("overview");
    const tCommon = useTranslations("common");

    return (
        <Band>
            <Figure label={tCommon("income")} value={null} note={null} />
            <Figure label={tCommon("spent")} value={null} note={null} divided />
            <Figure
                label={isCurrentMonth ? t("keptSoFar") : t("kept")}
                value={null}
                note={null}
                divided
            />
        </Band>
    );
}

function Band({ children }: { children: React.ReactNode }) {
    return (
        <div className="grid grid-cols-1 border-b border-rule sm:grid-cols-3">
            {children}
        </div>
    );
}

function Figure({
    label,
    value,
    tone,
    note,
    divided = false,
}: {
    label: string;
    /**
     * The figure itself — a `RollingNumber` on every live caller, since the
     * formatting differs per figure and the sign is part of it. Null while the
     * read is in flight.
     */
    value: React.ReactNode | null;
    tone?: string;
    /** The comparison note — see `OverviewSummary`. Null while in flight. */
    note: string | null;
    /** Carries the rule that separates it from the figure before it. */
    divided?: boolean;
}) {
    return (
        <div
            className={cn(
                "pt-[22px]",
                // Stacked on a phone the separator is a light hairline above
                // each figure; side by side it is the structural rule between
                // the columns, and the padding that rule needs appears with it.
                divided &&
                    "border-t border-rule2 sm:border-t-0 sm:border-l sm:border-rule sm:px-4 lg:px-7",
            )}
        >
            <div className="text-[11px] tracking-[0.14em] text-mute uppercase">
                {label}
            </div>
            <div
                className={cn(
                    "mt-[10px] mb-[6px] text-[clamp(19px,2.3vw,34px)] leading-none whitespace-nowrap",
                    tone,
                )}
            >
                {value === null ? (
                    <Skeleton className="h-[1em] w-[200px] bg-rule2" />
                ) : (
                    value
                )}
            </div>
            {/* Two lines' worth of height — 13px text on the page's 1.5
                line-height, so 39px, not the 36 this used to ask for — so that
                a note which has not landed, or one that happens to fit on a
                single line, cannot shorten the band. A band that shortens
                moves every rule below it, the one under the charts included.
                This is also the band's bottom padding. */}
            <div className="min-h-[39px] text-[13px] text-mute text-pretty">
                {note === null ? (
                    <Skeleton className="h-[1em] w-[140px] bg-rule2" />
                ) : (
                    note
                )}
            </div>
        </div>
    );
}
