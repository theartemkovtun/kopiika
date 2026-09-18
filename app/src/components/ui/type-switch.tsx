"use client";

import { useTranslations } from "next-intl";
import { cn } from "cn";

import type { TransactionType } from "@/api/types";

/**
 * The Expense / Income choice, as one control rather than two chips.
 *
 * Joining them is what makes the movement possible. The segments share a box
 * and take a column each, so the fill is exactly half the control's width and
 * the slide is a plain `translateX(100%)` — no measuring, whatever the labels
 * say in whichever language, and nothing to re-measure when the font lands.
 * The colour crosses with it, red to green over the same 200ms: an entry
 * changing side is one switch thrown, not two buttons pressed.
 *
 * The fill is born where it stands — a browser starts no transition on the
 * style an element is inserted with — so only the throws animate, and
 * `motion-reduce` sits both of them out.
 */
export function TypeSwitch({
    value,
    onChange,
    className,
}: {
    value: TransactionType;
    onChange: (value: TransactionType) => void;
    className?: string;
}) {
    const t = useTranslations("entry");
    const income = value === "income";

    const segments: { id: TransactionType; label: string }[] = [
        { id: "outcome", label: t("expense") },
        { id: "income", label: t("income") },
    ];

    return (
        <div
            className={cn(
                "relative inline-grid grid-cols-2 border border-rule",
                className,
            )}
        >
            <span
                aria-hidden
                style={{ transform: `translateX(${income ? "100%" : "0%"})` }}
                className={cn(
                    "pointer-events-none absolute inset-y-0 left-0 w-1/2 transition-[transform,background-color] duration-200 ease-out motion-reduce:transition-none",
                    income ? "bg-green" : "bg-red",
                )}
            />

            {segments.map((segment) => (
                <button
                    key={segment.id}
                    type="button"
                    aria-pressed={value === segment.id}
                    onClick={() => onChange(segment.id)}
                    // Over the fill, so the picked label reads on it.
                    className={cn(
                        "relative cursor-pointer px-4 py-[7px] text-[13px] transition-colors",
                        value === segment.id
                            ? "text-white"
                            : "text-mute hover:text-ink",
                    )}
                >
                    {segment.label}
                </button>
            ))}
        </div>
    );
}
