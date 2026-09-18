"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { cn } from "cn";

import { Skeleton } from "@/components/ui/skeleton";
import { usePeriod } from "@/contexts/period-context";
import { usePreferences } from "@/contexts/preferences-context";
import { useStatistics } from "@/hooks/use-statistics";
import { AXIS_TICK, TOOLTIP, compactFigure } from "@/lib/charts";
import { daysInMonth, fromIsoDate } from "@/lib/dates";
import { toNumber } from "@/lib/money";

/**
 * The scale of a chart with nothing in it.
 *
 * The ticks are given rather than left to recharts because they are what the
 * grid rules against — with no figure to scale by, recharts settles on a
 * single tick at zero and the grid comes out as one line. Five of them, evenly
 * spaced across the panel, is what a real scale draws. Only the baseline is
 * numbered: every figure above it would be one nobody's money reached.
 */
const EMPTY_SCALE = {
    domain: [0, 4],
    ticks: [0, 1, 2, 3, 4],
    tickFormatter: (value: number) => (value === 0 ? "0" : ""),
} as const;

/** Which of the two series are drawn. Spending alone is the default. */
type Series = "income" | "expense" | "both";

/**
 * The period's flow: a bar per day of the month, or a bar per month of the
 * year.
 *
 * Both come out of the same read. `rangeStatistics` carries every day of the
 * range — including the empty ones, as zeroes — so the month view is the series
 * as given and the year view is that series folded into twelve buckets. Twelve
 * separate reads would say the same thing twelve times more slowly.
 *
 * The year keeps all twelve bars even when the year is not over, so that
 * walking back through the years never changes the width of a bar.
 *
 * Both are built from the period rather than from the rows, so a month nobody
 * spent in still draws its own grid — the same height, the same days along the
 * bottom — instead of collapsing to nothing between two months that have data.
 */
export function FlowChart() {
    const t = useTranslations("overview");
    const tCommon = useTranslations("common");
    const calendar = useTranslations("calendar");

    const { range, year, month, yearView } = usePeriod();
    const { formatValue } = usePreferences();
    const { data } = useStatistics(range);

    const [series, setSeries] = useState<Series>("expense");

    const monthsShort = calendar.raw("monthsShort") as string[];

    const bars = useMemo(() => {
        const buckets = yearView
            ? monthsShort.map((name) => ({ name, income: 0, outcome: 0 }))
            : Array.from({ length: daysInMonth(year, month) }, (_, index) => ({
                  name: String(index + 1),
                  income: 0,
                  outcome: 0,
              }));

        for (const day of data?.rangeStatistics ?? []) {
            const date = fromIsoDate(day.date);
            const bucket = buckets[yearView ? date.month : date.day - 1];
            if (!bucket) continue;

            bucket.income += toNumber(day.income.value);
            bucket.outcome += toNumber(day.outcome.value);
        }

        return buckets;
    }, [data, month, monthsShort, year, yearView]);

    // Two questions, because they have different answers: whether the period
    // holds anything at all — which is what decides if there is a series worth
    // choosing between — and whether the chosen series holds anything, which
    // is what decides whether bars are drawn. A month with only income in it
    // answers yes to the first and no to the second while Expenses is picked,
    // and the toggles have to stay put for that to be fixable.
    const anyFlow = bars.some((bar) => bar.income !== 0 || bar.outcome !== 0);
    const seriesFlow = bars.some(
        (bar) =>
            (series !== "expense" && bar.income !== 0) ||
            (series !== "income" && bar.outcome !== 0),
    );

    const toggles: { id: Series; label: string }[] = [
        { id: "income", label: tCommon("income") },
        { id: "expense", label: tCommon("expenses") },
        { id: "both", label: tCommon("both") },
    ];

    return (
        <section className="flex min-w-0 flex-col">
            <div className="mb-[18px] flex flex-wrap items-baseline gap-[18px]">
                <h2 className="text-[26px] font-normal tracking-[-0.01em] italic">
                    {yearView ? t("monthlyFlow") : t("dailyFlow")}
                </h2>
                {data && anyFlow ? (
                    <span className="ml-auto flex gap-4">
                        {toggles.map((toggle) => (
                            <button
                                key={toggle.id}
                                type="button"
                                aria-pressed={series === toggle.id}
                                onClick={() => setSeries(toggle.id)}
                                className={cn(
                                    "cursor-pointer border-b pb-[3px] text-xs transition-colors",
                                    series === toggle.id
                                        ? "border-blue text-ink"
                                        : "border-transparent text-mute hover:text-blue",
                                )}
                            >
                                {toggle.label}
                            </button>
                        ))}
                    </span>
                ) : null}
            </div>

            <div
                className={cn(
                    "flex-1",
                    !data ? "min-h-[166px] pb-[30px]" : "min-h-[196px]",
                )}
            >
                {!data ? (
                    <FlowChartSkeleton count={yearView ? 12 : 30} />
                ) : (
                    <ResponsiveContainer
                        width="100%"
                        height="100%"
                        // The dataset changes shape between a month and a
                        // year; remounting is cheaper than reasoning about
                        // what recharts keeps from the last one.
                        key={`${yearView ? "y" : "m"}-${bars.length}-${series}-${seriesFlow}`}
                    >
                        <BarChart
                            data={bars}
                            barGap={2}
                            barCategoryGap="12%"
                            margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
                        >
                            <CartesianGrid
                                vertical={false}
                                stroke="var(--rule2)"
                            />
                            <XAxis
                                dataKey="name"
                                tick={AXIS_TICK}
                                axisLine={{ stroke: "var(--rule)" }}
                                tickLine={false}
                                // Every month of a year is labelled; every
                                // fourth day of a month is, which is as many
                                // as fit.
                                interval={yearView ? 0 : 3}
                            />
                            <YAxis
                                tick={AXIS_TICK}
                                axisLine={false}
                                tickLine={false}
                                // The gutter keeps its width either way, so
                                // the grid starts where the drawn chart's
                                // does; an empty period simply has no figures
                                // to write in it.
                                width={44}
                                {...(seriesFlow
                                    ? { tickFormatter: compactFigure }
                                    : EMPTY_SCALE)}
                            />
                            {/* Nothing to read off an empty grid, and the
                                cursor would light columns that hold nothing. */}
                            {seriesFlow ? (
                                <Tooltip
                                    {...TOOLTIP}
                                    formatter={(value) =>
                                        formatValue(Number(value))
                                    }
                                />
                            ) : null}
                            {/* Left mounted through the empty state: a bar of
                                zero draws nothing, and a chart that keeps its
                                bars keeps the axes and the grid they hang off
                                exactly as the drawn one has them. */}
                            {series !== "expense" ? (
                                <Bar
                                    dataKey="income"
                                    name={tCommon("income")}
                                    fill="var(--green)"
                                    isAnimationActive={false}
                                />
                            ) : null}
                            {series !== "income" ? (
                                <Bar
                                    dataKey="outcome"
                                    name={tCommon("expenses")}
                                    fill="var(--red)"
                                    isAnimationActive={false}
                                />
                            ) : null}
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>
        </section>
    );
}

/**
 * The panel before the account record has landed — see
 * `OverviewSummaryFallback` for why this exists as its own component rather
 * than a loading branch inside `FlowChart`: the statistics read is kicked off
 * before the account does, so by the time `FlowChart` itself mounts the read
 * has usually already landed, and its own `!data` branch never gets drawn.
 * This fallback fills the same gap the summary's does — the one actually
 * visible while the account is in flight.
 */
export function FlowChartFallback() {
    const t = useTranslations("overview");
    const { yearView } = usePeriod();

    return (
        <section className="flex min-w-0 flex-col">
            <div className="mb-[18px] flex flex-wrap items-baseline gap-[18px]">
                <h2 className="text-[26px] font-normal tracking-[-0.01em] italic">
                    {yearView ? t("monthlyFlow") : t("dailyFlow")}
                </h2>
            </div>

            <div className="min-h-[166px] flex-1 pb-[30px]">
                <FlowChartSkeleton count={yearView ? 12 : 30} />
            </div>
        </section>
    );
}

/**
 * A month is thirty-odd thin bars, a year twelve wider ones — the count
 * mirrors what the real chart will hold, so the skeleton reads as the same
 * shape rather than a generic block.
 *
 * Heights come from a fixed, index-seeded pseudo-random function rather than
 * `Math.random()`: this component's first render happens on the server, and
 * a value that differs between that render and the client's hydration pass
 * would mismatch. `Math.sin` on an integer seed gives the same "random"
 * figure everywhere.
 */
function FlowChartSkeleton({ count }: { count: number }) {
    return (
        <div className="flex h-full items-end gap-[3px]" aria-hidden>
            {Array.from({ length: count }, (_, index) => (
                <Skeleton
                    key={index}
                    className="min-w-0 flex-1 bg-rule2"
                    style={{ height: `${pseudoHeight(index)}%` }}
                />
            ))}
        </div>
    );
}

function pseudoHeight(index: number) {
    const seed = Math.sin(index * 12.9898) * 43758.5453;
    return 20 + (seed - Math.floor(seed)) * 70;
}
