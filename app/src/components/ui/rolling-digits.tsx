"use client";

import { cn } from "cn";

/**
 * A figure whose digits roll to their new value, an odometer wheel per column.
 *
 * The sibling of `rolling-number.tsx`, and the two are not interchangeable.
 * That one tweens the *value* and reformats it every frame, which is what a
 * total wants: a sum climbing from nothing to ₴12,480 reads as a tally. Sent
 * from 2025 to 2026 it would have nothing to count through — every frame in
 * between rounds to one year or the other, so the whole 600ms would show as
 * the last digit flicking over, late. A year does not add up; it steps. So
 * this one leaves the number alone and moves the glyphs.
 *
 * Every column holds all ten digits stacked and is clipped to one line, with
 * the stack shifted to put the right one in the window. That makes the whole
 * thing a single inline style and no state at all: React re-renders with a new
 * transform and CSS covers the distance, digits that did not change do not
 * move, and the direction falls out of the arithmetic — forward a year rolls
 * up, back a year rolls down, with no need to be told which button was
 * pressed. A decade turning over (2029 → 2030) spins the last wheel the long
 * way round, which is what the mechanism it is imitating does too.
 *
 * Anything that is not a digit — a minus sign, a separator — is passed
 * through as itself.
 */

const WHEEL = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function RollingDigits({
    value,
    className,
}: {
    value: number;
    className?: string;
}) {
    const text = String(value);

    return (
        <span className={cn("inline-flex", className)}>
            {/* The wheels are ten digits of nonsense to a screen reader. */}
            <span className="sr-only">{text}</span>

            <span aria-hidden className="inline-flex">
                {[...text].map((character, index) => {
                    const digit = WHEEL.indexOf(character);
                    if (digit < 0) return <span key={index}>{character}</span>;

                    return (
                        <span
                            key={index}
                            className="relative inline-block overflow-hidden align-bottom"
                        >
                            {/* Sizes the window: one digit wide — the app sets
                                tabular figures, so any of them would do — and
                                one line tall, in whatever type it inherits. */}
                            <span className="invisible">0</span>

                            {/* Out of flow, so the stack is ten lines tall and
                                a tenth of it is exactly one line: the shift is
                                a share of its own height rather than a length
                                this component would have to know. */}
                            <span
                                style={{
                                    transform: `translateY(-${digit * 10}%)`,
                                }}
                                className="absolute inset-x-0 top-0 transition-transform duration-[240ms] ease-out motion-reduce:transition-none"
                            >
                                {WHEEL.map((face) => (
                                    <span key={face} className="block">
                                        {face}
                                    </span>
                                ))}
                            </span>
                        </span>
                    );
                })}
            </span>
        </span>
    );
}
