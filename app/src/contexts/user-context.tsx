"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, use, useEffect, useRef } from "react";

import { ApiError } from "@/api/client";
import { queryKeys, users } from "@/api/endpoints";
import type { UpdateUserPayload, User } from "@/api/types";

type UserContextValue = {
    /** Undefined until the read lands. Past `AccountGate` it never is. */
    user: User | undefined;
    /** Writes language / display currency, then refreshes the cached user. */
    updateUser: (payload: UpdateUserPayload) => Promise<User>;
    isUpdating: boolean;
};

/** The same value, once the gate has established there is a record. */
type ResolvedUserContextValue = Omit<UserContextValue, "user"> & {
    user: User;
};

const UserContext = createContext<UserContextValue | null>(null);

/**
 * Best guess at the signing-up user's country, from the browser's own region.
 * The API reads it only to pick starting defaults — Ukraine gets Ukrainian and
 * hryvnia, anywhere else English and dollars — and treats an absent code as
 * "use the old defaults", so an unknown region is better left unsent than
 * guessed at.
 */
function detectCountryCode(): string | undefined {
    if (typeof navigator === "undefined") return undefined;

    try {
        const region = new Intl.Locale(navigator.language).region;
        return region ? region.toLowerCase() : undefined;
    } catch {
        return undefined;
    }
}

export function UserProvider({ children }: { children: React.ReactNode }) {
    const queryClient = useQueryClient();
    const hasAttemptedSetup = useRef(false);

    const { data: user, error } = useQuery({
        queryKey: queryKeys.user,
        queryFn: () => users.me(true),
        staleTime: Infinity,
        gcTime: Infinity,
    });

    const { mutateAsync: setupUser } = useMutation({
        mutationFn: () => users.setup({ countryCode: detectCountryCode() }),
        onSuccess: (created) => {
            queryClient.setQueryData(queryKeys.user, created);

            // On a first sign-in the screen's own reads go out beside this one
            // and are answered 401 for the same reason: there was no row yet.
            // There is now, so the ones that failed are asked again.
            void queryClient.invalidateQueries({
                predicate: (query) => query.state.status === "error",
            });
        },
    });

    const { mutateAsync: updateUser, isPending: isUpdating } = useMutation({
        mutationFn: (payload: UpdateUserPayload) => users.update(payload),
        onSuccess: (updated) =>
            queryClient.setQueryData(queryKeys.user, updated),
    });

    // The API answers 401 for a token it trusts but a user row it has never
    // seen, which is exactly the first sign-in. Create the row once, then let
    // the mutation's onSuccess seed the cache. Guarded by a ref so a genuine
    // "not signed in" 401 cannot turn into a create loop.
    useEffect(() => {
        if (!error || hasAttemptedSetup.current) return;
        if (!(error instanceof ApiError) || !error.isUnauthorized) return;

        hasAttemptedSetup.current = true;
        void setupUser().catch(() => {
            // Genuinely unauthenticated: middleware will send them to /login.
        });
    }, [error, setupUser]);

    // The provider itself holds nothing back. Most of a screen is *about* the
    // account — a figure, a currency, a balance — but the parts that are not,
    // the page title and the month strip above all, are local knowledge and
    // belong on the first paint. `AccountGate` is what waits, drawn around the
    // part that has to.
    return (
        <UserContext.Provider value={{ user, updateUser, isUpdating }}>
            {children}
        </UserContext.Provider>
    );
}

/**
 * The record as it stands, which on a cold load is nothing yet. This is the
 * gate's own hook; everything past the gate reads `useUser`.
 */
export function useMaybeUser(): User | undefined {
    const context = use(UserContext);
    if (!context) {
        throw new Error("useMaybeUser must be used within a UserProvider");
    }
    return context.user;
}

export function useUser(): ResolvedUserContextValue {
    const context = use(UserContext);
    if (!context) {
        throw new Error("useUser must be used within a UserProvider");
    }

    const { user, ...rest } = context;
    if (!user) {
        throw new Error(
            "useUser must be used inside an AccountGate: the user record is still in flight",
        );
    }

    return { user, ...rest };
}
