import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

/**
 * shadcn's Input, restyled to the design.
 *
 * Forms here are ruled rows, not boxes: the label sits at a fixed width on the
 * left, the field fills the rest, and the only line is the row's own bottom
 * rule. So the field itself is chromeless by default — a border on it would
 * draw a second box inside the row.
 *
 * `size` sets the type scale rather than a height, because the row's padding
 * already gives the control its height. Amounts run large; the rest run at
 * body size.
 *
 * A placeholder is set in the rule colour rather than in `mute`: it is a hint
 * about an empty field, not a value, and at `mute` it reads as one.
 */
const inputVariants = cva(
    "w-full min-w-0 bg-transparent text-ink outline-none placeholder:text-rule disabled:pointer-events-none disabled:opacity-50",
    {
        variants: {
            variant: {
                /** Inside a ruled form row. The default, and the common case. */
                bare: "border-none px-0 py-[2px]",
                /** Standalone, where nothing else draws the line. */
                boxed: "border border-rule px-3 py-2 focus-visible:border-ink",
                /** Its own hairline, for a field that sits alone in a column. */
                underlined:
                    "border-0 border-b border-rule px-0 py-[2px] focus-visible:border-ink",
            },
            inputSize: {
                sm: "text-xs",
                default: "text-base",
                /** A description, on the entry form. */
                lg: "text-[17px]",
                /** An amount, set large. `tnum` on <html> lines the digits up. */
                amount: "text-[26px]",
            },
        },
        defaultVariants: {
            variant: "bare",
            inputSize: "default",
        },
    },
);

function Input({
    className,
    type,
    variant,
    inputSize,
    ...props
}: Omit<React.ComponentProps<"input">, "size"> &
    VariantProps<typeof inputVariants>) {
    return (
        <input
            type={type}
            data-slot="input"
            className={cn(inputVariants({ variant, inputSize, className }))}
            {...props}
        />
    );
}

export { Input, inputVariants };
