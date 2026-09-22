"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { queryKeys, transactions } from "@/api/endpoints";
import type { StatisticsQuery } from "@/api/types";
import type { DateRange } from "@/contexts/period-context";

/**
 * The report behind the Overview: the three totals, the day-by-day series and
 * the per-category spending, over one inclusive day range.
 *
 * `full` is deliberately off. It buys the counts, the averages, the extremes
 * and the account breakdowns — Reports' half of the response — and the shape
 * does not change without it, so the Overview pays for what it draws.
 *
 * Every panel on the screen asks for the same range and they all land on one
 * request: the range *is* the key, so the second and third are answered from
 * the cache rather than from the network.
 */
export function useStatistics(range: DateRange) {
    const query: StatisticsQuery = {
        fromDate: range.fromDate,
        toDate: range.toDate,
        full: false,
    };

    return useQuery({
        queryKey: queryKeys.transactions.statistics(query),
        queryFn: () => transactions.statistics(query),
        // Walking the month strip keeps the figures, the chart and the donut
        // on the period just left until the new one lands, rather than
        // dropping the whole page to its loading state on every click.
        placeholderData: keepPreviousData,
    });
}
