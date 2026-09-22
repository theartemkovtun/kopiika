"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { ApiError } from "@/api/client";

export function QueryProvider({ children }: { children: React.ReactNode }) {
    // Built inside state so each browser tab — and each SSR pass — gets its
    // own client rather than sharing one module-level cache.
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 60_000,
                        refetchOnWindowFocus: false,
                        retry: (failureCount, error) => {
                            // A rejected token will be rejected again; only
                            // transient failures are worth a second attempt.
                            if (
                                error instanceof ApiError &&
                                (error.isUnauthorized || error.isNotFound)
                            ) {
                                return false;
                            }
                            return failureCount < 2;
                        },
                    },
                },
            }),
    );

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
