"use client";

import { useCallback, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { cn } from "cn";

/**
 * Magic UI's `animated-theme-toggler`, vendored and adapted.
 *
 * Three deliberate departures from the registry copy:
 *
 *  - It writes `data-theme` on <html>, not a `dark` class, because that is the
 *    attribute `globals.css` and next-themes are both keyed off here.
 *  - It is controlled only. next-themes owns persistence; the upstream
 *    uncontrolled branch wrote `localStorage.theme` itself, under the very key
 *    next-themes uses, which is a fight nobody wins.
 *  - The button's face is `children`. The icon cannot come from React state:
 *    the server cannot know which theme the browser resolves to, so a
 *    state-driven icon is either wrong on the first paint or missing until
 *    hydration. The caller renders both and lets the `dark:` variant choose.
 *
 * The theme still has to be applied *synchronously* inside the
 * `startViewTransition` callback — that is the moment the API snapshots the
 * new state. `setTheme` alone is not enough: next-themes writes the attribute
 * from an effect, which lands well after the snapshot. So the attribute is set
 * by hand and `onThemeChange` is left to record it.
 */

export type TransitionVariant =
    | "circle"
    | "square"
    | "triangle"
    | "diamond"
    | "hexagon"
    | "rectangle"
    | "star";

interface AnimatedThemeTogglerProps extends React.ComponentPropsWithoutRef<"button"> {
    duration?: number;
    variant?: TransitionVariant;
    /** Expand from the viewport centre instead of the button's. */
    fromCenter?: boolean;
    theme: "light" | "dark";
    onThemeChange: (theme: "light" | "dark") => void;
}

function polygonCollapsed(point: string, vertexCount: number): string {
    const pairs = Array.from({ length: vertexCount }, () => point).join(", ");
    return `polygon(${pairs})`;
}

// All coordinates are percentages of the snapshot reference box: Chrome 150
// renders absolute px clip-path coordinates on ::view-transition-new(root)
// unscaled on fractional display scales (e.g. Windows 150%) for the first
// transition after load, so px values land at the wrong position (#989).
function getThemeTransitionClipPaths(
    variant: TransitionVariant,
    cx: number,
    cy: number,
    maxRadius: number,
    viewportWidth: number,
    viewportHeight: number,
): [string, string] {
    const toX = (x: number) => `${(x / viewportWidth) * 100}%`;
    const toY = (y: number) => `${(y / viewportHeight) * 100}%`;
    const point = (x: number, y: number) => `${toX(x)} ${toY(y)}`;
    // circle() percentage radii resolve against hypot(w, h) / sqrt(2) of the
    // reference box.
    const toRadius = (r: number) =>
        `${(r / (Math.hypot(viewportWidth, viewportHeight) / Math.SQRT2)) * 100}%`;

    switch (variant) {
        case "square": {
            const halfW = Math.max(cx, viewportWidth - cx);
            const halfH = Math.max(cy, viewportHeight - cy);
            const halfSide = Math.max(halfW, halfH) * 1.05;
            const end = [
                point(cx - halfSide, cy - halfSide),
                point(cx + halfSide, cy - halfSide),
                point(cx + halfSide, cy + halfSide),
                point(cx - halfSide, cy + halfSide),
            ].join(", ");
            return [polygonCollapsed(point(cx, cy), 4), `polygon(${end})`];
        }
        case "triangle": {
            const scale = maxRadius * 2.2;
            const dx = (Math.sqrt(3) / 2) * scale;
            const verts = [
                point(cx, cy - scale),
                point(cx + dx, cy + 0.5 * scale),
                point(cx - dx, cy + 0.5 * scale),
            ].join(", ");
            return [polygonCollapsed(point(cx, cy), 3), `polygon(${verts})`];
        }
        case "diamond": {
            // Slightly larger than the view-transition circle radius so
            // axis-aligned coverage matches the circle reveal.
            const R = maxRadius * Math.SQRT2;
            const end = [
                point(cx, cy - R),
                point(cx + R, cy),
                point(cx, cy + R),
                point(cx - R, cy),
            ].join(", ");
            return [polygonCollapsed(point(cx, cy), 4), `polygon(${end})`];
        }
        case "hexagon": {
            const R = maxRadius * Math.SQRT2;
            const verts: string[] = [];
            for (let i = 0; i < 6; i++) {
                const a = -Math.PI / 2 + (i * Math.PI) / 3;
                verts.push(point(cx + R * Math.cos(a), cy + R * Math.sin(a)));
            }
            return [
                polygonCollapsed(point(cx, cy), 6),
                `polygon(${verts.join(", ")})`,
            ];
        }
        case "rectangle": {
            const halfW = Math.max(cx, viewportWidth - cx);
            const halfH = Math.max(cy, viewportHeight - cy);
            const end = [
                point(cx - halfW, cy - halfH),
                point(cx + halfW, cy - halfH),
                point(cx + halfW, cy + halfH),
                point(cx - halfW, cy + halfH),
            ].join(", ");
            return [polygonCollapsed(point(cx, cy), 4), `polygon(${end})`];
        }
        case "star": {
            // Small overscan so the last frames never leave a 1px seam before
            // the transition group ends.
            const R = maxRadius * Math.SQRT2 * 1.03;
            const innerRatio = 0.42;
            const starPolygon = (radius: number) => {
                const verts: string[] = [];
                for (let i = 0; i < 5; i++) {
                    const outerA = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
                    verts.push(
                        point(
                            cx + radius * Math.cos(outerA),
                            cy + radius * Math.sin(outerA),
                        ),
                    );
                    const innerA = outerA + Math.PI / 5;
                    verts.push(
                        point(
                            cx + radius * innerRatio * Math.cos(innerA),
                            cy + radius * innerRatio * Math.sin(innerA),
                        ),
                    );
                }
                return `polygon(${verts.join(", ")})`;
            };
            const startR = Math.max(2, R * 0.025);
            return [starPolygon(startR), starPolygon(R)];
        }
        case "circle":
        default:
            return [
                `circle(0% at ${point(cx, cy)})`,
                `circle(${toRadius(maxRadius)} at ${point(cx, cy)})`,
            ];
    }
}

export function AnimatedThemeToggler({
    className,
    children,
    duration = 400,
    variant = "circle",
    fromCenter = false,
    theme,
    onThemeChange,
    ...props
}: AnimatedThemeTogglerProps) {
    const buttonRef = useRef<HTMLButtonElement>(null);
    const isTransitioningRef = useRef(false);
    const activeAnimRef = useRef<Animation | null>(null);

    const cancelAnim = useCallback(() => {
        activeAnimRef.current?.cancel();
        activeAnimRef.current = null;
    }, []);

    useEffect(() => {
        return () => {
            cancelAnim();
            const root = document.documentElement;
            if (root.dataset.themeVt !== "active") return;
            delete root.dataset.themeVt;
            root.style.removeProperty("--theme-vt-duration");
            root.style.removeProperty("--theme-vt-clip-from");
        };
    }, [cancelAnim]);

    const toggleTheme = useCallback(() => {
        const button = buttonRef.current;
        const root = document.documentElement;
        if (
            !button ||
            isTransitioningRef.current ||
            root.dataset.themeVt === "active"
        )
            return;

        const next = theme === "dark" ? "light" : "dark";
        const applyTheme = () => {
            // By hand, and now: the view transition snapshots whatever is on
            // the document when this callback returns. next-themes' own write
            // happens an effect later, and would be too late.
            root.dataset.theme = next;
            root.style.colorScheme = next;
            onThemeChange(next);
        };

        if (typeof document.startViewTransition !== "function") {
            applyTheme();
            return;
        }

        // innerWidth/innerHeight (not visualViewport): percentages must resolve
        // against the snapshot reference box, which includes classic
        // scrollbars.
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let x: number;
        let y: number;
        if (fromCenter) {
            x = viewportWidth / 2;
            y = viewportHeight / 2;
        } else {
            const { top, left, width, height } = button.getBoundingClientRect();
            x = left + width / 2;
            y = top + height / 2;
        }

        const maxRadius = Math.hypot(
            Math.max(x, viewportWidth - x),
            Math.max(y, viewportHeight - y),
        );

        const clipPath = getThemeTransitionClipPaths(
            variant,
            x,
            y,
            maxRadius,
            viewportWidth,
            viewportHeight,
        );

        root.dataset.themeVt = "active";
        root.style.setProperty("--theme-vt-duration", `${duration}ms`);
        // Pin the collapsed clip-path via CSS so Firefox does not paint the new
        // theme unclipped between the snapshot and the ready.then() animation.
        root.style.setProperty("--theme-vt-clip-from", clipPath[0]);

        const cleanup = () => {
            isTransitioningRef.current = false;
            delete root.dataset.themeVt;
            root.style.removeProperty("--theme-vt-duration");
            root.style.removeProperty("--theme-vt-clip-from");
            cancelAnim();
        };

        isTransitioningRef.current = true;
        const transition = document.startViewTransition(() => {
            flushSync(applyTheme);
        });
        transition.finished.finally(cleanup).catch(() => {});

        transition.ready
            .then(() => {
                activeAnimRef.current = root.animate(
                    { clipPath },
                    {
                        duration,
                        // Star: linear avoids easing overshoot that fights
                        // polygon interpolation at t→1; the transition group's
                        // duration is synced in CSS.
                        easing: variant === "star" ? "linear" : "ease-in-out",
                        fill: "forwards",
                        pseudoElement: "::view-transition-new(root)",
                    },
                );
            })
            .catch(() => {});
    }, [variant, fromCenter, duration, theme, onThemeChange, cancelAnim]);

    return (
        <button
            type="button"
            ref={buttonRef}
            onClick={toggleTheme}
            className={cn(className)}
            {...props}
        >
            {children}
        </button>
    );
}
