"use client";

import { useTranslations } from "next-intl";
import { cn } from "cn";

import { usePreferences } from "@/contexts/preferences-context";
import { useDateFormat } from "@/hooks/use-date-format";
import { useDayTransactions } from "@/hooks/use-transactions";
import type { Transaction } from "@/api/types";
import { categoryLabel } from "@/lib/categories";
import { signedValue } from "@/lib/money";

/**
 * What is already on the selected day, under the calendar.
 *
 * It is the entry form's receipt: post an entry and it appears here, against
 * the day it was filed under. A day with nothing on it shows nothing at all —
 * the design has no empty state here, because the calendar above already says
 * which day is selected.
 *
 * Each row carries the amount in the currency it was recorded in; only the
 * day's total is converted, which is the one figure that has to add up across
 * currencies.
 */
export function DayEntries({
    date,
    highlightId,
}: {
    /** The selected day, YYYY-MM-DD. */
    date: string;
    /** The entry just added, painted as the design paints a fresh row. */
    highlightId?: string | null;
}) {
    const t = useTranslations("common");
    const tCategories = useTranslations("categories");
    const { formatValue } = usePreferences();

    const { dayLabel } = useDateFormat();

    const { data } = useDayTransactions(date);
    const entries = data?.transactions ?? [];
    const heading = dayLabel(date);

    if (entries.length === 0) return null;

    const total = entries.reduce(
        (sum, entry) => sum + signedValue(entry.localizedAmount, entry.type),
        0,
    );

    return (
        <section aria-label={heading}>
            <div className="flex items-baseline justify-between gap-3 border-b border-rule pb-2">
                <h2 className="font-mono text-[11px] tracking-[0.1em] text-mute uppercase">
                    {heading}
                </h2>
                <span className="font-mono text-xs text-mute">
                    {formatValue(total, undefined, { signed: true })}
                </span>
            </div>

            <div className="flex flex-col">
                {entries.map((entry) => (
                    <EntryRow
                        key={entry.id}
                        entry={entry}
                        isNew={entry.id === highlightId}
                        categoryName={
                            entry.category
                                ? categoryLabel(entry.category, tCategories)
                                : t("noCategory")
                        }
                        amount={formatValue(
                            signedValue(entry.amount, entry.type),
                            entry.amount.currency,
                            { signed: true },
                        )}
                    />
                ))}
            </div>
        </section>
    );
}

function EntryRow({
    entry,
    isNew,
    categoryName,
    amount,
}: {
    entry: Transaction;
    isNew: boolean;
    categoryName: string;
    amount: string;
}) {
    return (
        <div
            className={cn(
                "grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 border-b border-rule2 py-[10px]",
                // The one pale fill in the design, marking the row that was
                // not there a moment ago.
                isNew && "-mx-2 bg-blue-soft px-2",
            )}
        >
            <span className="flex min-w-0 items-baseline gap-[9px]">
                <span className="min-w-0 truncate text-sm">{entry.title}</span>
                {entry.type === "outcome" ? (
                    <span className="font-mono text-[10px] tracking-[0.08em] whitespace-nowrap text-mute uppercase">
                        {categoryName}
                    </span>
                ) : null}
            </span>
            <span
                className={cn(
                    "font-mono text-sm whitespace-nowrap",
                    entry.type === "income" ? "text-green" : "text-red",
                )}
            >
                {amount}
            </span>
        </div>
    );
}
