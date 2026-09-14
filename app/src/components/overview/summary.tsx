"use client";

import { useTranslations } from "next-intl";
import { cn } from "cn";

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
 * The design also puts a comparison note under each figure — "−₴4,000 vs Aug
 * 12". It is **wired but not drawn**: the statistics endpoint cannot answer it
 * in the same call, so it costs a second read of the previous period on every
 * page view, which is a request per period for one line. The two places that
 * hold it off are the disabled read below and the `{false &&` block in
 * `Figure`; turning it on is those two, plus the spacing note there.
 */
export function OverviewSummary() {
    const t = useTranslations("overview");
    const tCommon = useTranslations("common");

    const { range, comparison, isCurrentMonth } = usePeriod();
    const { formatValue } = usePreferences();
    const { rowLabel } = useDateFormat();

    const { data } = useStatistics(range);
    // The previous period, for the note. A null range leaves the query
    // disabled — the hook's own `enabled` is exactly this condition — so
    // nothing is requested; `comparison.range` is what goes here to turn the
    // note back on.
    const { data: before } = useStatistics(null);

    const income = toNumber(data?.income.value);
    const outcome = toNumber(data?.outcome.value);
    const kept = toNumber(data?.difference.value);

    // How the note names the span it read. A month names the day it was cut
    // at when there is one to name; a year says so in words, because "vs Sep
    // 14" over a figure covering nine months would read as a single day.
    const against =
        comparison.scope === "year"
            ? comparison.throughDate
                ? t("vsTodayPreviousYear")
                : t("vsPreviousYear")
            : comparison.throughDate
              ? t("vsDate", { date: rowLabel(comparison.throughDate) })
              : t("vsPreviousMonth");

    // Null until both reads have landed: a difference against a figure that is
    // not there yet would be the selection itself, drawn as a change. The sign
    // is the *change*, not the direction of the money — `+₴500` under Spent
    // means five hundred more went out than by the same point before.
    const change = (now: number, then: number) =>
        data && before
            ? `${formatValue(now - then, undefined, { signed: true })} ${against}`
            : null;

    return (
        <Band>
            <Figure
                label={tCommon("income")}
                value={data ? `+${formatValue(income)}` : null}
                tone="text-green"
                note={change(income, toNumber(before?.income.value))}
            />
            <Figure
                label={tCommon("spent")}
                value={data ? `${MINUS}${formatValue(outcome)}` : null}
                tone="text-red"
                note={change(outcome, toNumber(before?.outcome.value))}
                divided
            />
            <Figure
                label={isCurrentMonth ? t("keptSoFar") : t("kept")}
                value={
                    data ? formatValue(kept, undefined, { signed: true }) : null
                }
                tone={kept >= 0 ? "text-green" : "text-red"}
                note={change(kept, toNumber(before?.difference.value))}
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
export function OverviewSummaryFallback() {
    const t = useTranslations("overview");
    const tCommon = useTranslations("common");
    const { isCurrentMonth } = usePeriod();

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
    /** Null while the read is in flight. */
    value: string | null;
    tone?: string;
    /** The comparison note — see `OverviewSummary`; not currently drawn. */
    note: string | null;
    /** Carries the rule that separates it from the figure before it. */
    divided?: boolean;
}) {
    return (
        <div
            className={cn(
                "pt-[22px] pb-[22px]",
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
                    "mt-[10px] text-[clamp(17px,2.05vw,30px)] leading-none whitespace-nowrap",
                    tone,
                )}
            >
                {value === null ? (
                    <Skeleton className="h-[1em] w-[150px] bg-rule2" />
                ) : (
                    value
                )}
            </div>
            {/* Held off; see `OverviewSummary`. Two lines' worth of height, so
                that a note which has not landed cannot shorten the band. With
                it drawn this line is the band's bottom padding too: drop the
                `pb-[22px]` above and give the figure a `mb-[6px]`. */}
            {false && (
                <div className="min-h-[36px] text-[13px] text-mute text-pretty">
                    {note}
                </div>
            )}
        </div>
    );
}
