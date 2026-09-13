"use client";

import { useTranslations } from "next-intl";
import { cn } from "cn";

import { Skeleton } from "@/components/ui/skeleton";
import { usePeriod } from "@/contexts/period-context";
import { usePreferences } from "@/contexts/preferences-context";
import { useStatistics } from "@/hooks/use-statistics";
import { MINUS, toNumber } from "@/lib/money";

/**
 * Income, spent and kept, across the top of the Overview.
 *
 * The three read as one ruled band rather than as three cards: a hairline
 * under the row, one between each pair, and no fill anywhere. Only the figures
 * carry colour, and only the two that have a direction — income green,
 * spending red, kept whichever it turned out to be.
 */
export function OverviewSummary() {
    const t = useTranslations("overview");
    const tCommon = useTranslations("common");

    const { range, isCurrentMonth } = usePeriod();
    const { formatValue } = usePreferences();

    const { data } = useStatistics(range);

    const income = toNumber(data?.income.value);
    const outcome = toNumber(data?.outcome.value);
    const kept = toNumber(data?.difference.value);

    return (
        <Band>
            <Figure
                label={tCommon("income")}
                value={data ? `+${formatValue(income)}` : null}
                tone="text-green"
            />
            <Figure
                label={tCommon("spent")}
                value={data ? `${MINUS}${formatValue(outcome)}` : null}
                tone="text-red"
                divided
            />
            <Figure
                label={isCurrentMonth ? t("keptSoFar") : t("kept")}
                value={
                    data ? formatValue(kept, undefined, { signed: true }) : null
                }
                tone={kept >= 0 ? "text-green" : "text-red"}
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
            <Figure label={tCommon("income")} value={null} />
            <Figure label={tCommon("spent")} value={null} divided />
            <Figure
                label={isCurrentMonth ? t("keptSoFar") : t("kept")}
                value={null}
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
    divided = false,
}: {
    label: string;
    /** Null while the read is in flight. */
    value: string | null;
    tone?: string;
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
                    "mt-[10px] font-mono text-[clamp(17px,2.05vw,30px)] leading-none whitespace-nowrap",
                    tone,
                )}
            >
                {value === null ? (
                    <Skeleton className="h-[1em] w-[150px] bg-rule2" />
                ) : (
                    value
                )}
            </div>
        </div>
    );
}
