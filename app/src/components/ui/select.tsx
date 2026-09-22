"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";

/**
 * shadcn's Select, restyled to the design's Dropdown.
 *
 * Three things make it read as the design's rather than as a stock select:
 *
 *  - the trigger is chromeless text with a drawn caret, so it sits inside a
 *    ruled form row without adding a second box;
 *  - the panel is a square sheet on a hairline border, the one place in the
 *    whole design that carries a shadow, because it floats over the page;
 *  - the selected item is marked by a small filled square at the right rather
 *    than a tick, and the hairlines between items continue the ledger's rhythm.
 */

const triggerVariants = cva(
    "group flex w-full min-w-0 cursor-pointer items-center justify-between gap-[10px] bg-transparent py-[2px] text-left leading-[1.35] outline-none disabled:cursor-not-allowed disabled:opacity-50 [&>span]:min-w-0 [&>span]:truncate",
    {
        variants: {
            underline: {
                none: "border-0 border-b border-transparent",
                rule: "border-0 border-b border-rule",
                rule2: "border-0 border-b border-rule2",
            },
            tone: {
                ink: "text-ink data-[placeholder]:text-mute",
                mute: "text-mute",
            },
            triggerSize: {
                sm: "text-[13px]",
                default: "text-[17px]",
                lg: "text-xl",
            },
        },
        defaultVariants: {
            underline: "none",
            tone: "ink",
            triggerSize: "default",
        },
    },
);

function Select({
    ...props
}: React.ComponentProps<typeof SelectPrimitive.Root>) {
    return <SelectPrimitive.Root data-slot="select" {...props} />;
}

function SelectGroup({
    ...props
}: React.ComponentProps<typeof SelectPrimitive.Group>) {
    return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

function SelectValue({
    ...props
}: React.ComponentProps<typeof SelectPrimitive.Value>) {
    return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

function SelectTrigger({
    className,
    children,
    underline,
    tone,
    triggerSize,
    ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> &
    VariantProps<typeof triggerVariants>) {
    return (
        <SelectPrimitive.Trigger
            data-slot="select-trigger"
            className={cn(
                triggerVariants({
                    underline,
                    tone,
                    triggerSize,
                    className,
                }),
            )}
            {...props}
        >
            {children}
            <SelectPrimitive.Icon asChild>
                {/* Two borders on a rotated square: the design's caret, which
                    flips to point up when the panel is open. */}
                <span
                    aria-hidden
                    data-slot="select-caret"
                    className="mb-px size-[6px] shrink-0 -translate-y-px rotate-45 border-r-[1.4px] border-b-[1.4px] border-current opacity-55 transition-transform duration-150 group-data-[state=open]:translate-y-px group-data-[state=open]:-rotate-[135deg]"
                />
            </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
    );
}

function SelectContent({
    className,
    children,
    position = "popper",
    sideOffset = 7,
    ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
    return (
        <SelectPrimitive.Portal>
            <SelectPrimitive.Content
                data-slot="select-content"
                position={position}
                sideOffset={sideOffset}
                className={cn(
                    "relative z-[90] max-h-[274px] min-w-[132px] overflow-x-hidden overflow-y-auto border border-rule bg-bg text-ink shadow-[0_14px_34px_rgba(20,18,14,0.16)]",
                    "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
                    position === "popper" &&
                        "min-w-[max(var(--radix-select-trigger-width),132px)]",
                    className,
                )}
                {...props}
            >
                <SelectScrollUpButton />
                <SelectPrimitive.Viewport
                    className={cn(
                        position === "popper" &&
                            "w-full min-w-[var(--radix-select-trigger-width)]",
                    )}
                >
                    {children}
                </SelectPrimitive.Viewport>
                <SelectScrollDownButton />
            </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
    );
}

function SelectLabel({
    className,
    ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
    return (
        <SelectPrimitive.Label
            data-slot="select-label"
            className={cn(
                "px-3 py-2 text-[10px] tracking-[0.12em] text-mute uppercase",
                className,
            )}
            {...props}
        />
    );
}

function SelectItem({
    className,
    children,
    ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
    return (
        <SelectPrimitive.Item
            data-slot="select-item"
            className={cn(
                "relative flex w-full cursor-pointer items-center justify-between gap-[14px] border-t border-rule2 px-3 py-[9px] text-sm leading-[1.3] text-mute outline-hidden select-none first:border-t-transparent",
                "focus:bg-blue-soft focus:text-ink data-[state=checked]:text-ink",
                "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                className,
            )}
            {...props}
        >
            <SelectPrimitive.ItemText asChild>
                <span className="min-w-0 truncate">{children}</span>
            </SelectPrimitive.ItemText>
            {/* A filled square, not a tick — the design marks, it does not
                confirm. The empty box holds the row's width steady. */}
            <span
                aria-hidden
                data-slot="select-item-indicator"
                className="size-[5px] shrink-0"
            >
                <SelectPrimitive.ItemIndicator asChild>
                    <span className="block size-[5px] bg-blue" />
                </SelectPrimitive.ItemIndicator>
            </span>
        </SelectPrimitive.Item>
    );
}

function SelectSeparator({
    className,
    ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
    return (
        <SelectPrimitive.Separator
            data-slot="select-separator"
            className={cn("pointer-events-none h-px bg-rule", className)}
            {...props}
        />
    );
}

function SelectScrollUpButton({
    className,
    ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
    return (
        <SelectPrimitive.ScrollUpButton
            data-slot="select-scroll-up-button"
            className={cn(
                "flex cursor-default items-center justify-center py-1 text-mute",
                className,
            )}
            {...props}
        >
            <ChevronUpIcon className="size-3" />
        </SelectPrimitive.ScrollUpButton>
    );
}

function SelectScrollDownButton({
    className,
    ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
    return (
        <SelectPrimitive.ScrollDownButton
            data-slot="select-scroll-down-button"
            className={cn(
                "flex cursor-default items-center justify-center py-1 text-mute",
                className,
            )}
            {...props}
        >
            <ChevronDownIcon className="size-3" />
        </SelectPrimitive.ScrollDownButton>
    );
}

export {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectScrollDownButton,
    SelectScrollUpButton,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
    triggerVariants,
};
