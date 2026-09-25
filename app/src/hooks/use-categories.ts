"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { categories, queryKeys } from "@/api/endpoints";
import type { CreateCategoryPayload, UpdateCategoryPayload } from "@/api/types";
import { track } from "@/lib/analytics";

/**
 * The category reads and writes the Categories screen needs.
 *
 * `src/api/` stays free of react-query, so this is where caching is decided —
 * the same split `use-accounts` and `use-transactions` follow.
 *
 * Every write here drops two trees, and the second is the one that is easy to
 * forget. The entry form's category picker comes out of
 * `transactions/configuration`, which is held for five minutes, so a category
 * created, renamed or deleted without dropping it would not reach the form
 * until that expired. The rest of the transactions tree is left alone on
 * purpose: none of these writes moves an amount, and the ledger rows that name
 * a category carry only its id.
 */

/**
 * The ten global defaults and the user's own, in one unpaginated response.
 *
 * This is the only call that counts entries per category — see
 * `Category.transactions` — which is what the delete confirmation reports.
 */
export function useCategories() {
    return useQuery({
        queryKey: queryKeys.categories.list(),
        queryFn: () => categories.list(),
    });
}

function useCategoryWrite() {
    const queryClient = useQueryClient();

    return () => {
        void queryClient.invalidateQueries({
            queryKey: queryKeys.categories.all,
        });
        void queryClient.invalidateQueries({
            queryKey: queryKeys.transactions.configuration(),
        });
    };
}

export function useCreateCategory() {
    const settle = useCategoryWrite();

    return useMutation({
        mutationFn: (payload: CreateCategoryPayload) =>
            categories.create(payload),
        onSuccess: () => {
            track("category_created", {});
            settle();
        },
    });
}

/**
 * Renaming or recolouring one of the user's own categories.
 *
 * Partial, so only what changed is sent. The API matches on the owner, which
 * is what makes a global default answer 404 rather than being edited — the
 * list screen offers Edit on the user's own rows only, and this is the check
 * behind that.
 */
export function useUpdateCategory() {
    const settle = useCategoryWrite();

    return useMutation({
        mutationFn: ({
            categoryId,
            payload,
        }: {
            categoryId: number;
            payload: UpdateCategoryPayload;
        }) => categories.update(categoryId, payload),
        onSuccess: () => {
            track("category_updated", {});
            settle();
        },
    });
}

/**
 * Deleting one of the user's own categories.
 *
 * A soft delete on the API's side, and entries that name it keep naming it —
 * which is what the confirmation promises. Those entries now point at a row
 * that no longer lists, so the ledger and the statistics that grouped by it
 * are stale; the whole transactions tree goes rather than the picker alone.
 */
export function useDeleteCategory() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (categoryId: number) => categories.remove(categoryId),
        onSuccess: () => {
            track("category_deleted", {});
            void queryClient.invalidateQueries({
                queryKey: queryKeys.categories.all,
            });
            void queryClient.invalidateQueries({
                queryKey: queryKeys.transactions.all,
            });
        },
    });
}
