"use client";

import * as React from "react";
import { cn } from "cn";
import { Checkbox as CheckboxPrimitive } from "radix-ui";

/**
 * shadcn's Checkbox, restyled to the design's filter box.
 *
 * There is no tick. The design marks a checked box by filling it in the
 * emphasis colour and darkening its border — the same "a fill or a rule, never
 * a colour shift" rule the rest of the app follows — so the indicator would
 * have nothing to draw and is left out entirely. The box is 12px, small enough
 * to sit on the baseline of 13px type beside it.
 */
function Checkbox({
    className,
    ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
    return (
        <CheckboxPrimitive.Root
            data-slot="checkbox"
            className={cn(
                "peer size-3 shrink-0 cursor-pointer border border-rule bg-transparent outline-none transition-colors",
                "data-[state=checked]:border-blue data-[state=checked]:bg-blue",
                "disabled:cursor-not-allowed disabled:opacity-50",
                className,
            )}
            {...props}
        />
    );
}

export { Checkbox };
