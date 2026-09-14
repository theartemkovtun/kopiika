"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "cn";

import { Skeleton } from "@/components/ui/skeleton";
import { usePeriod } from "@/contexts/period-context";
import { usePreferences } from "@/contexts/preferences-context";
import { useStatistics } from "@/hooks/use-statistics";
import { TOOLTIP, storedColor } from "@/lib/charts";
import { categoryLabel } from "@/lib/categories";
import { toNumber } from "@/lib/money";

/**
 * Where it went: the period's spending as a donut, with the categories named
 * underneath.
 *
 * The legend is a single scrolling line rather than a wrapped block, so the
 * chart keeps its height whether there are three categories or eleven. What
 * has scrolled out of view is said with a fade at that edge — the only soft
 * edge in the design, and it appears only when there is something behind it.
 *
 * Each slice is drawn in the colour stored against its category, so a category
 * is the same colour here as wherever else it is marked. The positional series
 * is only the fallback, for a row whose colour is missing or unreadable.
 *
 * One thing the figures do not say: the API leaves uncategorised spending out
 * of this breakdown rather than pooling it, so a share is a share of
 * *categorised* spending and the slices need not add up to Spent above.
 */
export function CategoryBreakdown() {
    const t = useTranslations("overview");
    const tCategories = useTranslations("categories");

    const { range } = usePeriod();
    const { formatValue } = usePreferences();
    const { data } = useStatistics(range);

    // Largest first is the API's order. The colour is resolved once, here, so
    // that the slice and the legend dot below it cannot disagree.
    const slices = (data?.categoryOutcomeStatistics ?? [])
        .map((entry, index) => ({
            name: categoryLabel(entry, tCategories),
            value: toNumber(entry.localizedAmount.value),
            color: storedColor(entry.hexColor, index),
        }))
        .filter((slice) => slice.value > 0);

    const total = slices.reduce((sum, slice) => sum + slice.value, 0);

    return (
        <section className="min-w-0">
            <div className="mb-[18px] flex items-baseline gap-[14px]">
                <h2 className="text-[26px] font-normal tracking-[-0.01em] italic">
                    {t("whereItWent")}
                </h2>
            </div>

            {!data ? (
                <ChartSkeleton />
            ) : slices.length === 0 ? (
                <p className="text-[15px] text-mute">{t("nothingSpent")}</p>
            ) : (
                <div className="flex min-w-0 flex-col gap-4">
                    <div className="h-[196px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart
                                margin={{
                                    top: 0,
                                    right: 0,
                                    bottom: 0,
                                    left: 0,
                                }}
                            >
                                <Tooltip
                                    {...TOOLTIP}
                                    cursor={false}
                                    formatter={(value) =>
                                        formatValue(Number(value))
                                    }
                                />
                                <Pie
                                    data={slices}
                                    dataKey="value"
                                    nameKey="name"
                                    innerRadius="38%"
                                    outerRadius="92%"
                                    paddingAngle={2}
                                    stroke="none"
                                    isAnimationActive={false}
                                >
                                    {slices.map((slice) => (
                                        <Cell
                                            key={slice.name}
                                            fill={slice.color}
                                        />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    <Legend
                        items={slices.map((slice) => ({
                            name: slice.name,
                            share: `${Math.round((slice.value / total) * 100)}%`,
                            color: slice.color,
                        }))}
                    />
                </div>
            )}
        </section>
    );
}

/**
 * The panel before the account record has landed — see
 * `OverviewSummaryFallback` for why this exists as its own component rather
 * than a loading branch inside `CategoryBreakdown`: the statistics read is
 * kicked off before the account does, so by the time `CategoryBreakdown`
 * itself mounts the read has usually already landed, and its own `!data`
 * branch never gets drawn. This fallback fills the same gap the summary's
 * does — the one actually visible while the account is in flight.
 */
export function CategoryBreakdownFallback() {
    const t = useTranslations("overview");

    return (
        <section className="min-w-0">
            <div className="mb-[18px] flex items-baseline gap-[14px]">
                <h2 className="text-[26px] font-normal tracking-[-0.01em] italic">
                    {t("whereItWent")}
                </h2>
            </div>

            <ChartSkeleton />
        </section>
    );
}

function ChartSkeleton() {
    return (
        <div className="flex min-w-0 flex-col gap-4">
            <DonutSkeleton />
            <LegendSkeleton />
        </div>
    );
}

function DonutSkeleton() {
    return (
        <div className="flex h-[196px] items-center justify-center" aria-hidden>
            <div className="relative size-[176px]">
                <Skeleton className="size-full rounded-full bg-rule2" />
                <div className="absolute inset-[30%] rounded-full bg-bg" />
            </div>
        </div>
    );
}

// Widths, not a count off real data — this is the loading state, so there is
// nothing to size it against yet. Varied rather than uniform so the row
// reads as a legend rather than a single grey bar.
const LEGEND_SKELETON_WIDTHS = [58, 72, 46, 64, 50];

function LegendSkeleton() {
    return (
        <div
            className="flex gap-[22px] overflow-hidden border-t border-rule2 pt-[10px] pr-6 pb-3"
            aria-hidden
        >
            {LEGEND_SKELETON_WIDTHS.map((width, index) => (
                // h-[19.5px]: the real legend row's height comes from the
                // 13px name text's inherited line-height (13 * 1.5), not
                // from the tallest bar — matching only the bars left this
                // row 6-7px short, which the shared chart-grid row then
                // stretched FlowChart's skeleton to as well.
                <div
                    key={index}
                    className="flex h-[19.5px] flex-none items-center gap-2"
                >
                    <Skeleton className="size-[10px] flex-none rounded-full bg-rule2" />
                    <Skeleton className="h-[13px] bg-rule2" style={{ width }} />
                    <Skeleton className="h-[11px] w-[22px] bg-rule2" />
                </div>
            ))}
        </div>
    );
}

type LegendItem = { name: string; share: string; color: string };

function Legend({ items }: { items: LegendItem[] }) {
    const scroller = useRef<HTMLDivElement>(null);
    const [edges, setEdges] = useState({ left: false, right: false });

    // Measured rather than guessed: how much overflows depends on the category
    // names, the font and the width of the column, none of which are known
    // here. Re-measured on scroll and on resize, and again whenever the legend
    // itself changes length.
    useEffect(() => {
        const element = scroller.current;
        if (!element) return;

        const update = () => {
            const left = element.scrollLeft > 1;
            const right =
                element.scrollLeft + element.clientWidth <
                element.scrollWidth - 1;

            // Returning the same object bails out of the render, so a scroll
            // that does not cross an edge costs nothing.
            setEdges((current) =>
                current.left === left && current.right === right
                    ? current
                    : { left, right },
            );
        };

        element.addEventListener("scroll", update, { passive: true });
        const observer = new ResizeObserver(update);
        observer.observe(element);
        update();

        return () => {
            element.removeEventListener("scroll", update);
            observer.disconnect();
        };
    }, [items.length]);

    return (
        <div className="relative min-w-0 border-t border-rule2">
            <div
                ref={scroller}
                className="no-scrollbar flex gap-[22px] overflow-x-auto pt-[10px] pr-6 pb-3"
            >
                {items.map((item) => (
                    <div
                        key={item.name}
                        className="flex flex-none items-baseline gap-2 text-[13px] whitespace-nowrap"
                    >
                        <span
                            aria-hidden
                            className="inline-block size-[10px] flex-none rounded-full"
                            style={{ background: item.color }}
                        />
                        <span>{item.name}</span>
                        <span className="text-xs text-mute">{item.share}</span>
                    </div>
                ))}
            </div>

            <Fade side="left" visible={edges.left} />
            <Fade side="right" visible={edges.right} />
        </div>
    );
}

function Fade({ side, visible }: { side: "left" | "right"; visible: boolean }) {
    return (
        <div
            aria-hidden
            className={cn(
                "pointer-events-none absolute inset-y-0 w-11 from-transparent to-bg to-78% transition-opacity duration-[180ms]",
                side === "left"
                    ? "left-0 bg-linear-to-l"
                    : "right-0 bg-linear-to-r",
                visible ? "opacity-100" : "opacity-0",
            )}
        />
    );
}
