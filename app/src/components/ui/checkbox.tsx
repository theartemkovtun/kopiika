"use client";

import * as React from "react";
import { cn } from "cn";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { motion } from "motion/react";

/**
 * Animate UI's Radix checkbox, vendored and adapted.
 *
 * Four deliberate departures from the registry copy:
 *
 *  - Its primitive/component split is collapsed into one file. Upstream ships
 *    a headless `Checkbox` + `CheckboxIndicator` pair wired through a strict
 *    context so a caller can compose them; nothing here composes them, and the
 *    context is only ever read by the tick that sits inside the same tree.
 *  - No `rounded-*` and no focus ring. The radius scale is `0` on purpose and
 *    the design's own emphasis is the rule and the fill.
 *  - No `size` variants. The box is 12px to sit on the baseline of the 13px
 *    type beside it, and the two auth forms nudge it to 13px; the tick is
 *    sized as a percentage of the box rather than in px, so those overrides
 *    keep working without a matching variant.
 *  - The tick is drawn in `bg` over the filled box. The design marks a checked
 *    box by filling it in the emphasis colour, which the fill still does — the
 *    stroke is what there is to animate, and it needs the page colour to read
 *    against blue.
 *
 * The checked value is read back out alongside Radix rather than only handed
 * to it: the tick has to know which way it is going to pick the
 * `checked`/`unchecked` variant. A controlled caller — which is all three of
 * ours — is read straight from the prop, and the local state is only there for
 * an uncontrolled one. `forceMount` keeps the svg in the tree either way, so
 * the erase can play on the way back out.
 */
function Checkbox({
    className,
    checked,
    defaultChecked,
    onCheckedChange,
    disabled,
    required,
    name,
    value,
    ...props
}: Omit<
    React.ComponentProps<typeof CheckboxPrimitive.Root>,
    "asChild" | keyof React.ComponentProps<typeof motion.button>
> &
    Omit<React.ComponentProps<typeof motion.button>, "children">) {
    const [ownChecked, setOwnChecked] = React.useState<
        boolean | "indeterminate"
    >(defaultChecked ?? false);
    const isChecked = checked ?? ownChecked;

    const change = (next: boolean | "indeterminate") => {
        setOwnChecked(next);
        onCheckedChange?.(next);
    };

    return (
        <CheckboxPrimitive.Root
            checked={checked}
            defaultChecked={defaultChecked}
            onCheckedChange={change}
            disabled={disabled}
            required={required}
            name={name}
            value={value}
            asChild
        >
            <motion.button
                data-slot="checkbox"
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.08 }}
                className={cn(
                    "peer flex size-3 shrink-0 cursor-pointer items-center justify-center border border-rule bg-transparent text-bg outline-none transition-colors",
                    "data-[state=checked]:border-blue data-[state=checked]:bg-blue",
                    "data-[state=indeterminate]:border-blue data-[state=indeterminate]:bg-blue",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    className,
                )}
                {...props}
            >
                <CheckboxPrimitive.Indicator forceMount asChild>
                    <motion.svg
                        data-slot="checkbox-indicator"
                        xmlns="http://www.w3.org/2000/svg"
                        className="size-[78%]"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="3.5"
                        stroke="currentColor"
                        initial="unchecked"
                        animate={isChecked ? "checked" : "unchecked"}
                    >
                        {isChecked === "indeterminate" ? (
                            <motion.line
                                x1="5"
                                y1="12"
                                x2="19"
                                y2="12"
                                strokeLinecap="round"
                                initial={{ pathLength: 0, opacity: 0 }}
                                animate={{
                                    pathLength: 1,
                                    opacity: 1,
                                    transition: { duration: 0.2 },
                                }}
                            />
                        ) : (
                            <motion.path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M4.5 12.75l6 6 9-13.5"
                                variants={{
                                    checked: {
                                        pathLength: 1,
                                        opacity: 1,
                                        transition: {
                                            duration: 0.2,
                                            delay: 0.1,
                                        },
                                    },
                                    unchecked: {
                                        pathLength: 0,
                                        opacity: 0,
                                        transition: { duration: 0.2 },
                                    },
                                }}
                            />
                        )}
                    </motion.svg>
                </CheckboxPrimitive.Indicator>
            </motion.button>
        </CheckboxPrimitive.Root>
    );
}

export { Checkbox };
