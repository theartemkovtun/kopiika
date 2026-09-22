"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A figure that rolls up to its value instead of appearing at it.
 *
 * Carried over from the previous app, where the three dashboard totals were a
 * magicui `NumberTicker` tweened over 300ms from nine tenths of the target.
 * Both numbers are longer here: it climbs most of the way up, over twice the
 * time, so it reads as a figure being tallied rather than as one nudged the
 * last inch.
 *
 * Two things the original got wrong are fixed here. It animated **once**, on
 * first sight, so a figure that changed under it — which is every figure on
 * the Overview, the moment the period strip moves — snapped to its new value;
 * this one rolls from wherever it currently stands to wherever it is sent.
 * And it formatted with a hard-coded `en-US`, which is why formatting is a
 * prop here: the caller hands in the bound formatter off `usePreferences`, so
 * the locale, the currency symbol and the cents setting all still hold at
 * every frame of the roll.
 *
 * It replaces `motion` rather than pulling it in — nothing else in the app
 * animates in JavaScript, and a spring library is a lot of bundle for one
 * 600ms tween.
 */

/**
 * The previous app's were 300 and 0.9, which rolled a figure the last tenth of
 * the way in. Opening at two fifths is most of a count-up: enough distance to
 * read as one, and a power of ten crossed at most once on the way — ₴1,240
 * opens at ₴496 — so the line gains a digit as it climbs and widens with it.
 * Every figure using this sits in its own column and is `whitespace-nowrap`,
 * so nothing around it reflows; it is the digits themselves that shift. Raise
 * `START_AT` toward 0.9 to hold the width steady.
 *
 * It governs the **first** roll only. A figure already on screen rolls from
 * where it stands to where it is sent, which is what the period strip moving
 * does to the summary band's three totals at once.
 */
const DURATION = 600;
const START_AT = 0.4;

/** `easeOut`, which is what a timed `motion` tween defaults to. */
function easeOut(t: number): number {
    return 1 - (1 - t) * (1 - t);
}

export function RollingNumber({
    value,
    format,
    duration = DURATION,
}: {
    value: number;
    /** Usually a closure over `formatValue` — see the note above. */
    format: (value: number) => string;
    duration?: number;
}) {
    const [shown, setShown] = useState(() => value * START_AT);

    // What is on screen *now*, which is where the next roll starts from. A
    // ref rather than the state itself so that re-pointing the figure
    // mid-roll continues from the frame it is on instead of restarting the
    // effect against a stale value.
    const shownRef = useRef(shown);

    useEffect(() => {
        const from = shownRef.current;
        if (from === value) return;

        const settle = () => {
            shownRef.current = value;
            setShown(value);
        };

        // Someone who has asked for less movement gets the figure, not the
        // roll. `matchMedia` is read here rather than held in state because
        // nothing needs to re-render when it flips — the next roll reads it.
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            settle();
            return;
        }

        const started = performance.now();
        let frame = requestAnimationFrame(function step(now) {
            const t = Math.min((now - started) / duration, 1);

            if (t === 1) {
                // Land on the value itself rather than on the eased
                // approach to it, so the figure that rests on screen is
                // exactly the one that was passed in.
                settle();
                return;
            }

            const next = from + (value - from) * easeOut(t);
            shownRef.current = next;
            setShown(next);

            frame = requestAnimationFrame(step);
        });

        return () => cancelAnimationFrame(frame);
    }, [value, duration]);

    return <>{format(shown)}</>;
}
