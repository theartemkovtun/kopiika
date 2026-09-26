"use client";

import type { Experiment, StatsigClient } from "@statsig/js-client";
import { useCallback, useEffect, useSyncExternalStore } from "react";

import { getClient } from "@/lib/analytics";

/**
 * A Statsig experiment for the current user, re-read whenever their values change.
 * With `logExposure: false`, call `trackExperiment` once the change is on screen.
 */
export function useExperiment(
    name: string,
    { logExposure = true }: { logExposure?: boolean } = {},
) {
    // The SDK memoizes the experiment until the values change, so it is a stable snapshot.
    const read = useCallback(() => {
        const client = getClient();
        if (!client) return noExperiment(name);
        return client.getExperiment(name, { disableExposureLog: true });
    }, [name]);

    const experiment = useSyncExternalStore(subscribe, read, () =>
        noExperiment(name),
    );

    // Logs only once the user is set and their values have loaded.
    const trackExperiment = useCallback(() => {
        const client = getClient();
        if (!client || !isAssigned(client)) return;
        client.getExperiment(name);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [name, experiment]);

    useEffect(() => {
        if (logExposure) getClient()?.getExperiment(name);
    }, [logExposure, name, experiment]);

    return { experiment, trackExperiment };
}

function subscribe(onChange: () => void) {
    const client = getClient();
    if (!client) return () => {};

    client.on("values_updated", onChange);
    return () => client.off("values_updated", onChange);
}

function isAssigned(client: StatsigClient) {
    return (
        client.loadingStatus === "Ready" &&
        Boolean(client.getContext().user.userID)
    );
}

// With no client, `.get` returns the caller's default; one object per name keeps it stable.
const noExperiments = new Map<string, Experiment>();

function noExperiment(name: string): Experiment {
    let experiment = noExperiments.get(name);
    if (!experiment) {
        experiment = {
            name,
            ruleID: "",
            details: { reason: "NoClient" },
            value: {},
            groupName: null,
            idType: null,
            __evaluation: null,
            get: ((_key: string, fallback?: unknown) =>
                fallback ?? null) as Experiment["get"],
        };
        noExperiments.set(name, experiment);
    }
    return experiment;
}
