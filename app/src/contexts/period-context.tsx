"use client";

import { createContext, use, useCallback, useMemo, useState } from "react";

import { FIRST_YEAR, daysInMonth, toIsoDate } from "@/lib/dates";

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
};

const PeriodContext = createContext<PeriodContextValue | null>(null);

export function PeriodProvider({ children }: { children: React.ReactNode }) {
    const [today] = useState(() => {
        const now = new Date();
        return {
            year: now.getFullYear(),
            month: now.getMonth(),
            day: now.getDate(),
        };
    });

    const [period, setPeriod] = useState<Period>(() => ({
        month: today.month,
        year: today.year,
        yearView: false,
    }));

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

        return {
            month,
            year,
            yearView,
            today,
            isCurrentMonth:
                !yearView && year === today.year && month === today.month,
            maxMonth,
            canGoBack: year > FIRST_YEAR,
            canGoForward: year < today.year,
            selectMonth,
            selectYear,
            previousYear,
            nextYear,
            range,
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
