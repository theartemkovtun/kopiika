"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * One key out of the browser's own storage, read at hydration rather than in
 * an effect after it.
 *
 * The server has no storage to read, so the three-way answer matters:
 *
 *   undefined  not read yet — the server's render, and the frame that hydrates
 *   null       read, and there is nothing under that key
 *   string     the value
 *
 * A caller that redirects on "nothing there" has to wait for the difference,
 * or it will send away a visitor whose value simply had not been read yet.
 *
 * Nothing outside this tab writes these keys, so `subscribe` has nothing to
 * watch: a value written from an event handler in this tab is held in state
 * beside this, and storage is where it is kept for the next load.
 */

export type StoredItem = string | null | undefined;

function subscribe() {
    return () => {};
}

function unknown() {
    return undefined;
}

function read(storage: Storage, key: string): string | null {
    try {
        return storage.getItem(key);
    } catch {
        // Private window, or site data blocked.
        return null;
    }
}

export function useLocalItem(key: string): StoredItem {
    const snapshot = useCallback(() => read(window.localStorage, key), [key]);
    return useSyncExternalStore(subscribe, snapshot, unknown);
}

export function useSessionItem(key: string): StoredItem {
    const snapshot = useCallback(() => read(window.sessionStorage, key), [key]);
    return useSyncExternalStore(subscribe, snapshot, unknown);
}
