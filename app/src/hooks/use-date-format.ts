"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { usePreferences } from "@/contexts/preferences-context";
import { fromIsoDate, toIsoDate, todayParts } from "@/lib/dates";

/**
 * The three ways a date is written in this app, all of them locale-dependent
 * and all of them anchored to the same "today".
 *
 * They live together because they share that anchor: a label that says
 * "Today" and a row that drops the year both have to agree on what today is,
 * and reading the clock twice in one render can disagree across midnight.
 */
export function useDateFormat() {
    const t = useTranslations("calendar");
    const tCommon = useTranslations("common");
    const { locale } = usePreferences();

    // Fixed per mount, so one render measures every date against one day.
    const [today] = useState(todayParts);

    const months = t.raw("months") as string[];
    const monthsShort = t.raw("monthsShort") as string[];
    const weekdays = t.raw("weekdaysShort") as string[];

    return useMemo(() => {
        const todayIso = toIsoDate(today.year, today.month, today.day);

        const yesterday = new Date(today.year, today.month, today.day - 1);
        const yesterdayIso = toIsoDate(
            yesterday.getFullYear(),
            yesterday.getMonth(),
            yesterday.getDate(),
        );

        return {
            /**
             * `Today`, `Yesterday`, or the day written out with its weekday —
             * the heading over a single day's entries. The year is added only
             * when it is not this one, so the common case stays short.
             */
            dayLabel(date: string): string {
                if (date === todayIso) return tCommon("today");
                if (date === yesterdayIso) return tCommon("yesterday");

                const { year, month, day } = fromIsoDate(date);
                const weekday = weekdays[new Date(year, month, day).getDay()];
                const written =
                    locale === "uk"
                        ? `${weekday}, ${day} ${monthsShort[month]}`
                        : `${weekday}, ${monthsShort[month]} ${day}`;

                return year === today.year ? written : `${written} ${year}`;
            },

            /**
             * The date cell in a ledger row: as short as it can be, because it
             * sits in a 72px column. Ukrainian leads with the day, as it does
             * everywhere else.
             */
            rowLabel(date: string): string {
                const { year, month, day } = fromIsoDate(date);
                const written =
                    locale === "uk"
                        ? `${day} ${monthsShort[month]}`
                        : `${monthsShort[month]} ${day}`;

                return year === today.year
                    ? written
                    : `${written} ${String(year).slice(2)}`;
            },

            /** The rule between months in the ledger: `September 2026`. */
            monthLabel(date: string): string {
                const { year, month } = fromIsoDate(date);
                return `${months[month]} ${year}`;
            },
        };
    }, [locale, months, monthsShort, tCommon, today, weekdays]);
}
