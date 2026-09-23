"use client";

import { useLocale, useTranslations } from "next-intl";
import { use, useEffect } from "react";

import { AccountGate } from "@/components/layout/account-gate";
import { HidePageScrollbar } from "@/components/layout/hide-page-scrollbar";
import { PageHeader } from "@/components/layout/page-header";
import { PeriodBar } from "@/components/layout/period-bar";
import { QueryError } from "@/components/layout/query-error";
import {
    AccountsSummary,
    AccountsSummaryFallback,
} from "@/components/overview/accounts-summary";
import {
    CategoryBreakdown,
    CategoryBreakdownFallback,
} from "@/components/overview/category-breakdown";
import { FlowChart, FlowChartFallback } from "@/components/overview/flow-chart";
import {
    LATEST,
    RecentEntries,
    RecentEntriesFallback,
} from "@/components/overview/recent-entries";
import {
    OverviewSummary,
    OverviewSummaryFallback,
} from "@/components/overview/summary";
import {
    derivePeriodFromParams,
    isCurrentMonthPeriod,
    usePeriod,
} from "@/contexts/period-context";
import { useAccountsBalance } from "@/hooks/use-accounts";
import { useStatistics } from "@/hooks/use-statistics";
import { useLatestTransactions } from "@/hooks/use-transactions";

/**
 * Overview. The only screen that carries the month strip — every other one
 * either picks its own range or has none.
 *
 * The title is the period itself: the month set large and italic, the year as
 * its smaller aside. In year view the year takes the plate and the aside drops
 * away. Both come off the browser's clock, and the strip under them off the
 * same, so the head of the page is drawn before anything is asked of the API —
 * and the statistics read below is issued in the same breath rather than after
 * the account record comes back.
 *
 * Below it the page is three bands, and each one narrows: the totals, then what
 * they were made of, then the entries and balances behind them.
 *
 * The three period-bound panels all read the same statistics range, so they
 * share one request — which is also why the failure is handled here rather
 * than three times over. The two panels below read their own endpoints and
 * stay on the page when this one does not land.
 *
 * All three reads — statistics, latest transactions, accounts balance — are
 * kicked off here, above the gate, alongside the account read itself, so they
 * run in parallel rather than the bottom two waiting behind the gate for the
 * account record before they even start. `RecentEntries` and `AccountsSummary`
 * ask react-query for the same keys again when they mount past the gate and
 * get the in-flight or already-settled result straight from the cache.
 *
 * The gate's fallback repeats the whole page's shape — every panel with its
 * own skeleton twin — rather than leaving any of it out: since every read
 * starts here, each has usually already landed by the time its real panel
 * mounts and gets a chance to draw its own loading state. The fallback is
 * what is actually visible while the account is in flight.
 */
export default function OverviewPage({
    searchParams,
}: {
    searchParams: Promise<{ month?: string; year?: string }>;
}) {
    const calendar = useTranslations("calendar");
    const t = useTranslations("overview");
    const locale = useLocale();
    const { month, year, yearView, isCurrentMonth, today, range } = usePeriod();

    const { error, refetch } = useStatistics(range);
    useLatestTransactions(LATEST);
    useAccountsBalance();

    const months = calendar.raw("months") as string[];
    const monthsShort = calendar.raw("monthsShort") as string[];

    // The server render has no `window`, so the context above falls back to
    // today; `searchParams` is known there too, so that's what the title and
    // the month strip read on the server. Every client render — starting with
    // the very first, since the context re-derives its own state from the real
    // `window.location` as soon as it mounts — reads the context instead,
    // because `searchParams` stays frozen at whatever the URL was on load
    // and would otherwise ignore every later click on the month strip.
    //
    // Both take the same value: a title on one month and the strip's mark on
    // another is the mismatch that shows if only one of them is handed it.
    const displayed =
        typeof window === "undefined"
            ? derivePeriodFromParams(use(searchParams), today)
            : { month, year, yearView };

    // Kept in the address bar so the period survives a reload and a shared
    // link opens on the same month. The current month is the default a bare
    // visit opens on, so it carries no params at all; year view carries only
    // `year`; any other month carries both. `replaceState` bypasses the
    // Next.js router on purpose: this is state the page already has, not a
    // navigation, so it should not re-fetch the route's server payload or
    // grow the back-button stack the way `router.replace` would.
    useEffect(() => {
        const params = new URLSearchParams();
        if (yearView) {
            params.set("year", String(year));
        } else if (!isCurrentMonth) {
            params.set("month", String(month + 1));
            params.set("year", String(year));
        }
        const query = params.toString();
        window.history.replaceState(
            null,
            "",
            query ? `?${query}` : window.location.pathname,
        );
    }, [isCurrentMonth, month, year, yearView]);

    // The sublabel under the title. A month names the year it falls in; a
    // year names the span it covers — the days read so far when it is the
    // one still running, or the whole year once it is behind us. This reads
    // off `calendar`/`useLocale` rather than `useDateFormat`, which needs
    // `usePreferences` — unavailable here, above the account gate.
    const subtitle = displayed.yearView
        ? displayed.year === today.year
            ? t("yearToDate", {
                  date:
                      locale === "uk"
                          ? `${String(today.day).padStart(2, "0")}.${String(today.month + 1).padStart(2, "0")}`
                          : `${monthsShort[today.month]} ${today.day}`,
              })
            : t("fullYear")
        : displayed.year;

    return (
        <div className="pt-8 pb-16 md:pt-10 md:pb-[72px]">
            <HidePageScrollbar />

            <PageHeader
                title={
                    displayed.yearView
                        ? displayed.year
                        : months[displayed.month]
                }
                subtitle={subtitle}
            />
            <PeriodBar period={displayed} className="mt-7" />

            <AccountGate
                fallback={
                    <>
                        <OverviewSummaryFallback
                            isCurrentMonth={isCurrentMonthPeriod(
                                displayed,
                                today,
                            )}
                        />
                        <ChartGrid>
                            <CategoryBreakdownFallback />
                            <FlowChartFallback period={displayed} />
                        </ChartGrid>
                        <div className="mt-11 grid gap-14 [grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr))]">
                            <RecentEntriesFallback />
                            <AccountsSummaryFallback />
                        </div>
                    </>
                }
            >
                {error ? (
                    <QueryError
                        onRetry={() => void refetch()}
                        className="mt-0"
                    />
                ) : (
                    <>
                        <OverviewSummary />

                        <ChartGrid>
                            <CategoryBreakdown />
                            <FlowChart />
                        </ChartGrid>
                    </>
                )}

                <div className="mt-11 grid gap-14 [grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr))]">
                    <RecentEntries />
                    <AccountsSummary />
                </div>
            </AccountGate>
        </div>
    );
}

function ChartGrid({ children }: { children: React.ReactNode }) {
    return (
        <div className="grid grid-cols-1 gap-12 border-b border-rule py-[34px] lg:gap-[72px] lg:[grid-template-columns:minmax(280px,1fr)_minmax(320px,2fr)]">
            {children}
        </div>
    );
}
