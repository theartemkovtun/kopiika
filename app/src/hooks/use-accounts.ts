"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { accounts, queryKeys } from "@/api/endpoints";
import type { CreateAccountPayload, UpdateAccountPayload } from "@/api/types";

/**
 * Every account with its balance, plus their combined worth in the user's own
 * currency — one call, which is why the Overview's accounts panel does not
 * also list accounts.
 *
 * A balance moves only when an entry naming an account is written, and both
 * writes already drop the `accounts` tree, so nothing here has to poll.
 */
export function useAccountsBalance() {
    return useQuery({
        queryKey: queryKeys.accounts.balance(),
        queryFn: () => accounts.balance(),
    });
}

/**
 * Opening an account.
 *
 * It moves two caches, and the second is the one that is easy to forget: the
 * entry form's account picker comes out of `transactions/configuration`, which
 * is held for five minutes — so without dropping it a new account could not be
 * posted to until that expired.
 *
 * The rest of the transactions tree is deliberately left alone: an account
 * opens with a balance, not with an entry, so no ledger row and no statistic
 * has moved.
 */
export function useCreateAccount() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: CreateAccountPayload) => accounts.create(payload),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: queryKeys.accounts.all,
            });
            void queryClient.invalidateQueries({
                queryKey: queryKeys.transactions.configuration(),
            });
        },
    });
}

/**
 * Editing an account's name or colour — the only fields the API lets a
 * client write back; see `UpdateAccountPayload`.
 *
 * Drops the same two caches `useCreateAccount` does: the balance tree, which
 * carries the name and colour the detail and list screens draw, and the entry
 * form's account picker, which holds its own copy of both.
 */
export function useUpdateAccount() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            accountId,
            payload,
        }: {
            accountId: string;
            payload: UpdateAccountPayload;
        }) => accounts.update(accountId, payload),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: queryKeys.accounts.all,
            });
            void queryClient.invalidateQueries({
                queryKey: queryKeys.transactions.configuration(),
            });
        },
    });
}

/**
 * One account, read out of the balance response rather than from
 * `accounts/{id}`.
 *
 * The detail screen needs more than the single-account endpoint answers: the
 * share of the total is a figure about the *set*, so the other balances have
 * to be in hand anyway. Reading the set once therefore costs a call rather
 * than saving one — and it is the same call the list screen has already made,
 * so arriving from the list paints immediately instead of re-reading.
 *
 * `missing` separates "no such account" from "not loaded yet": both leave
 * `account` null, and only the first should draw the not-found branch.
 */
export function useAccount(accountId: string) {
    const query = useAccountsBalance();
    const account =
        query.data?.accounts.find(({ id }) => id === accountId) ?? null;

    return {
        ...query,
        account,
        missing: Boolean(query.data) && !account,
    };
}

/**
 * Closing an account.
 *
 * It drops more than the balances. The entry form's account picker comes out
 * of `transactions/configuration`, which is held for five minutes, so without
 * dropping it a closed account would stay in the picker. The ledger goes too:
 * entries recorded on the account stay in the book — the design says so on the
 * confirmation — but they no longer carry the account, so every row and
 * statistic that named it is now stale.
 */
export function useDeleteAccount() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (accountId: string) => accounts.remove(accountId),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: queryKeys.accounts.all,
            });
            void queryClient.invalidateQueries({
                queryKey: queryKeys.transactions.all,
            });
        },
    });
}
