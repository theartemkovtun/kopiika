"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, use, useEffect, useRef } from "react";

import { ApiError } from "@/api/client";
import { queryKeys, users } from "@/api/endpoints";
import type { UpdateUserPayload, User } from "@/api/types";

type UserContextValue = {
    user: User;
    /** Writes language / display currency, then refreshes the cached user. */
    updateUser: (payload: UpdateUserPayload) => Promise<User>;
    isUpdating: boolean;
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

export function UserProvider({
    children,
    fallback = null,
}: {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}) {
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
        onSuccess: (created) =>
            queryClient.setQueryData(queryKeys.user, created),
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

    // Nothing below this provider can render without a user, and the routes it
    // wraps are already behind the auth middleware, so the only states here are
    // "still loading" and "about to be redirected". Both show the fallback.
    if (!user) return <>{fallback}</>;

    return (
        <UserContext.Provider value={{ user, updateUser, isUpdating }}>
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    const context = use(UserContext);
    if (!context) {
        throw new Error("useUser must be used within a UserProvider");
    }
    return context;
}
