"use client";

import { useEffect, useState } from "react";

/**
 * Seconds left until `deadline`, an epoch millisecond, or zero once it has
 * passed. `null` for a countdown that is not running.
 *
 * The deadline is the state, not the number of seconds, so the count is right
 * after a reload rather than starting over — which is the point, since what it
 * is counting is how long Cognito wants to be left alone before it will send
 * another code.
 */
export function useCountdown(deadline: number | null): number {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (!deadline || deadline <= now) return;

        const timer = setTimeout(() => setNow(Date.now()), 1000);
        return () => clearTimeout(timer);
    }, [deadline, now]);

    if (!deadline) return 0;

    return Math.max(0, Math.ceil((deadline - now) / 1000));
}
