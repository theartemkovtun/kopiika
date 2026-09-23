"use client";

import { createContext, use, useCallback, useMemo, useState } from "react";

import {
    FIRST_YEAR,
    daysInMonth,
    fromIsoDate,
    previousMonthRange,
    toIsoDate,
} from "@/lib/dates";
import { SUPPORTED_LOCALES } from "@/lib/locales";

/**
 * The period the Overview is looking at: one month, or a whole year.
 *
 * It lives above the routes rather than inside the Overview because the design
 * keeps the month strip pinned under the page title — walking off to the ledger
 * and back should land on the month you left, not on today.
 *
 * The selection is also what the API wants: every read is bounded by a
 * `fromDate`/`toDate` pair, which `range` derives.
 */

export type Period = {
    /** 0-indexed, like a JS Date. */
    month: number;
    year: number;
    /** True when the whole year is selected rather than one month. */
    yearView: boolean;
};

export type DateRange = { fromDate: string; toDate: string };

/**
 * The period a figure is measured against, and enough about it for the note
 * under the figure to say what that period was.
 *
 * The wording is left to the Overview — this says what the range *is*, not how
 * to write it, because the two scopes are worded differently and only one of
 * them names a day.
 */
export type Comparison = {
    /** The range read for the figure the selection is measured against. */
    range: DateRange;
    /** Which kind of period was selected, and so which wording it takes. */
    scope: "month" | "year";
    /**
     * The day the previous period was cut at, when the selection is still
     * running and that cut landed on today's own date.
     *
     * Null when the whole previous period was read — nothing to name — and
     * null again when the previous period was too short to hold today's day
     * (the 31st against a 30-day month): the range is clamped to its last day,
     * and naming that day would claim a span nobody asked for.
     */
    throughDate: string | null;
};

type PeriodContextValue = Period & {
    /** Today, as the app sees it. Fixed per mount so a render is stable. */
    today: { year: number; month: number; day: number };
    /** True when the selection is the month we are actually living in. */
    isCurrentMonth: boolean;
    /** The last month the selected year can offer: December, or this month. */
    maxMonth: number;
    canGoBack: boolean;
    canGoForward: boolean;

    selectMonth: (month: number) => void;
    selectYear: () => void;
    previousYear: () => void;
    nextYear: () => void;

    /**
     * The selection as the inclusive day range the API takes, cut at today
     * while the selected period is still running.
     */
    range: DateRange;
    /**
     * What the selection is read against: the period before it — the previous
     * month, or the previous year — cut to the same span while the selected
     * one is still running, so that a month three days old is not measured
     * against a whole one.
     */
    comparison: Comparison;
};

const PeriodContext = createContext<PeriodContextValue | null>(null);

/**
 * The last month a given year can offer: December, except in the year we are
 * living in, which stops at the month we are in — the strip shows the rest but
 * will not select them.
 */
export function lastSelectableMonth(
    year: number,
    today: { year: number; month: number },
): number {
    return year === today.year ? today.month : 11;
}

/**
 * True when the period is the month we are actually living in — which is what
 * decides whether a total is written as one still running ("Kept so far") or
 * one that is closed ("Kept").
 *
 * Exported alongside `derivePeriodFromParams` and for the same reason: the
 * page has to answer this on the server, about the period the address bar
 * names, before the context has an address bar to read.
 */
export function isCurrentMonthPeriod(
    period: Period,
    today: { year: number; month: number },
): boolean {
    return (
        !period.yearView &&
        period.year === today.year &&
        period.month === today.month
    );
}

/**
 * True on the Overview route itself ("/" or "/<locale>") — the only place the
 * month strip lives, and so the only place a `year`/`month`/`view` triple in
 * the URL means anything. A query string left over from some other bookmarked
 * page is not something the period should pick up.
 */
function isOverviewPathname(pathname: string): boolean {
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length === 0) return true;
    return (
        segments.length === 1 &&
        (SUPPORTED_LOCALES as readonly string[]).includes(segments[0])
    );
}

/**
 * The URL carries no params at all for the current month — that is the
 * default a bare visit opens on. A `year` with no `month` means year view;
 * both together mean a specific month. There is no separate `view` flag —
 * which params are present already says which of the three it is.
 *
 * Exported so the Overview page can derive the same period from its
 * server-visible `searchParams` prop, ahead of the client mount below ever
 * seeing `window.location` — that's what lets the title come out right in
 * the very first render instead of showing today's month until hydration
 * catches up with the address bar.
 */
export function derivePeriodFromParams(
    params: { year?: string; month?: string },
    today: { year: number; month: number },
): Period {
    const hasYearParam = params.year !== undefined;
    const hasMonthParam = params.month !== undefined;

    if (!hasYearParam && !hasMonthParam) {
        return { month: today.month, year: today.year, yearView: false };
    }

    const yearParam = Number(params.year);
    const year =
        hasYearParam &&
        Number.isInteger(yearParam) &&
        yearParam >= FIRST_YEAR &&
        yearParam <= today.year
            ? yearParam
            : today.year;

    if (!hasMonthParam) {
        return { month: today.month, year, yearView: true };
    }

    const maxMonth = lastSelectableMonth(year, today);
    const monthParam = Number(params.month) - 1;
    const month =
        Number.isInteger(monthParam) &&
        monthParam >= 0 &&
        monthParam <= maxMonth
            ? monthParam
            : Math.min(today.month, maxMonth);

    return { month, year, yearView: false };
}

/**
 * The period a fresh load opens on: whatever the Overview's own URL says,
 * falling back to today when the query is missing, foreign, or out of range.
 * Read once, into the state below — a client-side visit to Overview reuses
 * whatever the period already is rather than re-reading the address bar, so
 * only an actual reload restores it from the URL.
 */
function readInitialPeriod(today: { year: number; month: number }): Period {
    if (
        typeof window === "undefined" ||
        !isOverviewPathname(window.location.pathname)
    ) {
        return { month: today.month, year: today.year, yearView: false };
    }

    const params = new URLSearchParams(window.location.search);
    return derivePeriodFromParams(
        {
            year: params.get("year") ?? undefined,
            month: params.get("month") ?? undefined,
        },
        today,
    );
}

export function PeriodProvider({ children }: { children: React.ReactNode }) {
    const [today] = useState(() => {
        const now = new Date();
        return {
            year: now.getFullYear(),
            month: now.getMonth(),
            day: now.getDate(),
        };
    });

    const [period, setPeriod] = useState<Period>(() =>
        readInitialPeriod(today),
    );

    const { month, year, yearView } = period;
    const maxMonth = lastSelectableMonth(year, today);

    const selectMonth = useCallback(
        (next: number) => {
            // The strip shows all twelve months; the ones ahead of today are
            // dimmed and inert rather than hidden, so the row never reflows.
            setPeriod((current) => {
                const limit = lastSelectableMonth(current.year, today);
                if (next > limit) return current;
                return { ...current, month: next, yearView: false };
            });
        },
        [today],
    );

    const selectYear = useCallback(
        () => setPeriod((current) => ({ ...current, yearView: true })),
        [],
    );

    const previousYear = useCallback(() => {
        setPeriod((current) =>
            current.year <= FIRST_YEAR
                ? current
                : { ...current, year: current.year - 1 },
        );
    }, []);

    const nextYear = useCallback(() => {
        setPeriod((current) => {
            if (current.year >= today.year) return current;
            const nextYearValue = current.year + 1;
            const limit = lastSelectableMonth(nextYearValue, today);
            return {
                ...current,
                year: nextYearValue,
                month: Math.min(current.month, limit),
            };
        });
    }, [today]);

    const value = useMemo<PeriodContextValue>(() => {
        const isCurrentMonth = isCurrentMonthPeriod(
            { month, year, yearView },
            today,
        );

        // A period that is still running is read only as far as today. The
        // days ahead hold nothing to count, and asking for them makes the
        // API answer for a span that has not happened yet — the same cut
        // `comparison` below makes on the period it measures against.
        const isCurrentYear = yearView && year === today.year;

        const range: DateRange = yearView
            ? {
                  fromDate: toIsoDate(year, 0, 1),
                  toDate: isCurrentYear
                      ? toIsoDate(year, today.month, today.day)
                      : toIsoDate(year, maxMonth, daysInMonth(year, maxMonth)),
              }
            : {
                  fromDate: toIsoDate(year, month, 1),
                  toDate: isCurrentMonth
                      ? toIsoDate(year, month, today.day)
                      : toIsoDate(year, month, daysInMonth(year, month)),
              };

        const comparison: Comparison = yearView
            ? ((): Comparison => {
                  const previous = year - 1;
                  const isCurrentYear = year === today.year;

                  // The same cut the month view makes, a scale up: a year
                  // still running is read against the same stretch of the one
                  // before it. February 29th has no counterpart in three years
                  // out of four, so the day is clamped to that month's last.
                  const toDate = isCurrentYear
                      ? toIsoDate(
                            previous,
                            today.month,
                            Math.min(
                                today.day,
                                daysInMonth(previous, today.month),
                            ),
                        )
                      : toIsoDate(previous, 11, 31);

                  return {
                      range: { fromDate: toIsoDate(previous, 0, 1), toDate },
                      scope: "year",
                      throughDate: isCurrentYear ? toDate : null,
                  };
              })()
            : ((): Comparison => {
                  const previous = previousMonthRange(
                      year,
                      month,
                      isCurrentMonth ? today.day : undefined,
                  );

                  return {
                      range: {
                          fromDate: previous.fromDate,
                          toDate: previous.toDate,
                      },
                      scope: "month",
                      throughDate:
                          isCurrentMonth &&
                          fromIsoDate(previous.toDate).day === today.day
                              ? previous.toDate
                              : null,
                  };
              })();

        return {
            month,
            year,
            yearView,
            today,
            isCurrentMonth,
            maxMonth,
            canGoBack: year > FIRST_YEAR,
            canGoForward: year < today.year,
            selectMonth,
            selectYear,
            previousYear,
            nextYear,
            range,
            comparison,
        };
    }, [
        maxMonth,
        month,
        nextYear,
        previousYear,
        selectMonth,
        selectYear,
        today,
        year,
        yearView,
    ]);

    return (
        <PeriodContext.Provider value={value}>
            {children}
        </PeriodContext.Provider>
    );
}

export function usePeriod() {
    const context = use(PeriodContext);
    if (!context) {
        throw new Error("usePeriod must be used within a PeriodProvider");
    }
    return context;
}
