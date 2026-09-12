import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";

/**
 * shadcn's Button, restyled to the design.
 *
 * The design has no rounded corners, no shadows and no filled hover states —
 * emphasis is carried by a rule, a fill, or nothing. What is left is five
 * shapes, and they are named after what they do rather than how loud they are:
 *
 *   solid    the one committing action on a screen (Add entry, Create account)
 *   outline  a choice among peers (the Expense / Income toggle)
 *   quiet    a secondary action, underlined with a hairline (Cancel, Clear)
 *   link     an inline navigation, underlined in the emphasis colour
 *   ghost    no chrome at all; the sidebar and icon buttons
 *
 * `income` and `expense` are `outline` in its selected state, which the design
 * paints in the semantic colour rather than in ink; `danger` is the same red,
 * for confirming a delete.
 */
const buttonVariants = cva(
    "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap font-sans transition-[color,background-color,border-color,opacity] disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0",
    {
        variants: {
            variant: {
                solid: "border border-ink bg-ink text-bg hover:opacity-85",
                outline:
                    "border border-rule bg-transparent text-mute hover:text-ink",
                quiet: "border-b border-rule bg-transparent text-mute hover:text-ink",
                link: "border-b border-blue bg-transparent text-blue hover:border-ink hover:text-ink",
                ghost: "bg-transparent text-ink hover:text-blue",
                icon: "bg-transparent text-mute hover:text-blue",
                income: "border border-green bg-green text-white hover:opacity-85",
                expense: "border border-red bg-red text-white hover:opacity-85",
                /** Confirming a delete. Shares `expense`'s red, not its
                    meaning: the design signals destructive with --red and has
                    no other mark for it. */
                danger: "border border-red bg-red text-white hover:opacity-85",
            },
            size: {
                /** The primary action at the foot of a form. */
                default: "px-[26px] py-[13px] text-sm",
                /** Inside a dialog, where the form is already tight. */
                sm: "px-[18px] py-2 text-[13px]",
                /** A segmented choice: Expense / Income, or an account type. */
                chip: "px-4 py-[7px] text-[13px]",
                /** Text only. `quiet` and `link` are always this size. */
                text: "p-0 text-[13px]",
                icon: "size-[30px] p-0",
            },
        },
        defaultVariants: {
            variant: "solid",
            size: "default",
        },
    },
);

function Button({
    className,
    variant = "solid",
    size,
    asChild = false,
    ...props
}: React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
        asChild?: boolean;
    }) {
    const Comp = asChild ? Slot.Root : "button";

    // The text-only variants have exactly one sensible size; spelling it out at
    // every call site is noise.
    const resolvedSize =
        size ??
        (variant === "quiet" || variant === "link"
            ? "text"
            : variant === "icon"
              ? "icon"
              : "default");

    return (
        <Comp
            data-slot="button"
            data-variant={variant}
            data-size={resolvedSize}
            className={cn(
                buttonVariants({ variant, size: resolvedSize, className }),
            )}
            {...props}
        />
    );
}

export { Button, buttonVariants };
