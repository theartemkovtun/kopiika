"use client";

import { useQuery } from "@tanstack/react-query";

import { accounts, queryKeys } from "@/api/endpoints";

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
