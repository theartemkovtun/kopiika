"use client";

import {
    keepPreviousData,
    useInfiniteQuery,
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";

import { queryKeys, transactions } from "@/api/endpoints";
import type {
    CreateTransactionPayload,
    ListTransactionsQuery,
    UpdateTransactionPayload,
} from "@/api/types";
import { monthRange } from "@/lib/dates";

/**
 * The transaction reads and the one write the entry screen needs.
 *
 * `src/api/` stays free of react-query, so this is where caching is decided:
 * the keys come from the factory in `src/api/endpoints.ts`, and the prefixes
 * nest, which is what lets one write drop every list under it.
 */

/** Categories and accounts for the entry form, in one response. */
export function useTransactionsConfiguration() {
    return useQuery({
        queryKey: queryKeys.transactions.configuration(),
        queryFn: () => transactions.configuration(),
        // Neither list moves on its own; only creating a category or an account
        // changes it, and both invalidate.
        staleTime: 5 * 60_000,
    });
}

/**
 * Which days of a month already carry entries.
 *
 * The list endpoint pages by *day*, so a single page of 31 covers any month —
 * and the days it answers with are exactly the days that have something on
 * them, which is the whole question the calendar's dots ask.
 */
export function useMonthEntryDays(year: number, month: number) {
    const query: ListTransactionsQuery = {
        page: 1,
        take: 31,
        ...monthRange(year, month),
    };

    return useQuery({
        queryKey: queryKeys.transactions.list(query),
        queryFn: () => transactions.list(query),
        select: (page) => new Set(page.items.map((day) => day.date)),
    });
}

/**
 * The newest entries overall, whatever the period strip says.
 *
 * The Overview's list is deliberately not bounded by the selected month: it
 * answers "what have I written lately", which a month-bounded read cannot on
 * the 1st. That is also why it is this endpoint and not a one-page `list`.
 */
export function useLatestTransactions(limit = 10) {
    return useQuery({
        queryKey: queryKeys.transactions.latest(limit),
        queryFn: () => transactions.latest(limit),
    });
}

/** One day's entries. The API answers null for a day with nothing on it. */
export function useDayTransactions(date: string) {
    return useQuery({
        queryKey: queryKeys.transactions.byDate(date),
        queryFn: () => transactions.byDate(date),
    });
}

export function useCreateTransaction() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: CreateTransactionPayload) =>
            transactions.create(payload),
        onSuccess: () => invalidateLedger(queryClient),
    });
}

/**
 * Writing a transaction moves two things: the ledger, and — when the entry
 * names an account — that account's balance. Both trees are dropped, so the
 * calendar, the day list, the ledger and the balances all re-read rather than
 * showing the totals from before the write.
 */
function invalidateLedger(queryClient: ReturnType<typeof useQueryClient>) {
    void queryClient.invalidateQueries({
        queryKey: queryKeys.transactions.all,
    });
    void queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
}

/**
 * What the ledger's filter rail narrows by. Paging is not part of it: the page
 * is owned by the infinite query, and changing a filter starts a new one.
 */
export type LedgerFilters = Omit<
    ListTransactionsQuery,
    "page" | "take" | "search"
>;

/** Days per page. One screenful of ledger, give or take a quiet week. */
const LEDGER_TAKE = 20;

/**
 * The ledger, paged as it is scrolled.
 *
 * The API cuts a page by **day** rather than by row, so `total` counts days and
 * a page can hold any number of entries — which is why "is there more" is a
 * comparison of days seen against days available, and never of rows.
 */
export function useLedger(filters: LedgerFilters) {
    return useInfiniteQuery({
        queryKey: queryKeys.transactions.infinite(filters),
        queryFn: ({ pageParam }) =>
            transactions.list({
                ...filters,
                page: pageParam,
                take: LEDGER_TAKE,
            }),
        initialPageParam: 1,
        getNextPageParam: (last) =>
            last.page * last.take < last.total ? last.page + 1 : undefined,
        // Narrowing the ledger keeps the rows that are already on screen until
        // the new ones land. Blanking the list on every checkbox would make the
        // rail unreadable — you would be aiming at something that vanishes — so
        // the previous answer stands in, and `isPlaceholderData` marks it.
        placeholderData: keepPreviousData,
    });
}

/**
 * Editing an entry replaces every field, so an omitted description, category or
 * account clears the stored one — the dialog always sends the whole record. The
 * date is not in the payload at all and cannot be changed.
 */
export function useUpdateTransaction() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: UpdateTransactionPayload) =>
            transactions.update(payload),
        onSuccess: () => invalidateLedger(queryClient),
    });
}

export function useDeleteTransaction() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (transactionId: string) =>
            transactions.remove(transactionId),
        onSuccess: () => invalidateLedger(queryClient),
    });
}
