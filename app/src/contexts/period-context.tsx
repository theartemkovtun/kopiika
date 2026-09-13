"use client";

import { createContext, use, useCallback, useMemo, useState } from "react";

import {
    FIRST_YEAR,
    daysInMonth,
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

/** The period a figure is measured against, and the month to name it by. */
export type Comparison = {
    /** 0-indexed. */
    month: number;
    year: number;
    range: DateRange;
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

    /** The selection as the inclusive day range the API takes. */
    range: DateRange;
    /**
     * What the selection is read against: the month before it, cut to the same
     * span while the selected month is still running. Null in year view, where
     * the design carries no comparison at all.
     */
    comparison: Comparison | null;
};

const PeriodContext = createContext<PeriodContextValue | null>(null);

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

    const maxMonth = year === today.year ? today.month : 11;
    const monthParam = Number(params.month) - 1;
    const month =
        Number.isInteger(monthParam) && monthParam >= 0 && monthParam <= maxMonth
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
    const maxMonth = year === today.year ? today.month : 11;

    const selectMonth = useCallback(
        (next: number) => {
            // The strip shows all twelve months; the ones ahead of today are
            // dimmed and inert rather than hidden, so the row never reflows.
            setPeriod((current) => {
                const limit = current.year === today.year ? today.month : 11;
                if (next > limit) return current;
                return { ...current, month: next, yearView: false };
            });
        },
        [today.month, today.year],
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
            const limit = nextYearValue === today.year ? today.month : 11;
            return {
                ...current,
                year: nextYearValue,
                month: Math.min(current.month, limit),
            };
        });
    }, [today.month, today.year]);

    const value = useMemo<PeriodContextValue>(() => {
        const isCurrentMonth =
            !yearView && year === today.year && month === today.month;

        const range: DateRange = yearView
            ? {
                  fromDate: toIsoDate(year, 0, 1),
                  toDate: toIsoDate(
                      year,
                      maxMonth,
                      daysInMonth(year, maxMonth),
                  ),
              }
            : {
                  fromDate: toIsoDate(year, month, 1),
                  toDate: toIsoDate(year, month, daysInMonth(year, month)),
              };

        const comparison: Comparison | null = yearView
            ? null
            : (() => {
                  const previous = previousMonthRange(
                      year,
                      month,
                      isCurrentMonth ? today.day : undefined,
                  );

                  return {
                      month: previous.month,
                      year: previous.year,
                      range: {
                          fromDate: previous.fromDate,
                          toDate: previous.toDate,
                      },
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
