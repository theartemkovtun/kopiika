"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { cn } from "cn";

import type { DateTransactions, Transaction } from "@/api/types";
import { usePreferences } from "@/contexts/preferences-context";
import { useDateFormat } from "@/hooks/use-date-format";
import { type LedgerFilters, useLedger } from "@/hooks/use-transactions";
import { categoryLabel } from "@/lib/categories";
import { signedValue } from "@/lib/money";

/**
 * The ledger: every entry, newest first, under a centred month rule.
 *
 * Two things about it are load-bearing and easy to lose. A day with more than
 * one entry writes its date **once** — the rows below it leave the date cell
 * empty — and the hairline between those rows starts where the date column
 * ends, so the eye reads them as one day rather than as three unrelated lines.
 * The last row of a month carries no rule at all; the month heading underneath
 * is the separator.
 *
 * Paging follows the API rather than the calendar: `GET /v1/transactions` cuts
 * a page by day, so scrolling asks for more days and the sentinel at the foot
 * is what asks.
 */

export function Ledger({
    filters,
    onSelect,
    selectedId,
}: {
    filters: LedgerFilters;
    onSelect: (transaction: Transaction) => void;
    selectedId?: string | null;
}) {
    const t = useTranslations("ledger");
    const tCommon = useTranslations("common");

    const {
        data,
        error,
        isLoading,
        isPlaceholderData,
        hasNextPage,
        isFetchingNextPage,
        fetchNextPage,
        refetch,
    } = useLedger(filters);

    const days = data?.pages.flatMap((page) => page.items) ?? [];
    const isEmpty = !isLoading && days.length === 0;

    const sentinel = useRef<HTMLDivElement>(null);

    // The foot of the list asks for the next page as it comes into view. The
    // observer is rebuilt whenever the answer to "is there more" changes, which
    // is also what stops it firing once the ledger has run out.
    //
    // It stays off while the rows on screen are the previous filter's: those
    // pages belong to a query that is no longer the one being read, so asking
    // them for a second page would page a list nobody is looking at.
    useEffect(() => {
        const element = sentinel.current;
        if (!element || !hasNextPage || isFetchingNextPage) return;
        if (isPlaceholderData) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) void fetchNextPage();
            },
            { rootMargin: "400px" },
        );

        observer.observe(element);
        return () => observer.disconnect();
    }, [fetchNextPage, hasNextPage, isFetchingNextPage, isPlaceholderData]);

    if (error) {
        return (
            <div className="border-t border-rule py-11">
                <p className="text-[15px] text-mute">{tCommon("error")}</p>
                <button
                    type="button"
                    onClick={() => void refetch()}
                    className="mt-3 cursor-pointer border-b border-rule text-xs text-mute transition-colors hover:text-ink"
                >
                    {tCommon("retry")}
                </button>
            </div>
        );
    }

    return (
        <div className="flex min-w-0 flex-col">
            {days.map((day, index) => (
                <DayBlock
                    key={day.date}
                    day={day}
                    startsMonth={isMonthStart(days, index)}
                    isFirst={index === 0}
                    endsMonth={isMonthEnd(days, index)}
                    onSelect={onSelect}
                    selectedId={selectedId}
                />
            ))}

            {isEmpty ? (
                <p className="border-t border-rule py-11 text-[15px] text-mute">
                    {t("noMatch")}
                </p>
            ) : null}

            <div ref={sentinel} className="h-px" />

            {isLoading || isFetchingNextPage || hasNextPage ? (
                <div
                    className="py-5 text-xs text-mute"
                    aria-label={tCommon("loading")}
                >
                    ···
                </div>
            ) : null}
        </div>
    );
}

const month = (date: string) => date.slice(0, 7);

function isMonthStart(days: DateTransactions[], index: number): boolean {
    const previous = days[index - 1];
    return !previous || month(previous.date) !== month(days[index].date);
}

function isMonthEnd(days: DateTransactions[], index: number): boolean {
    const next = days[index + 1];
    return !next || month(next.date) !== month(days[index].date);
}

function DayBlock({
    day,
    startsMonth,
    isFirst,
    endsMonth,
    onSelect,
    selectedId,
}: {
    day: DateTransactions;
    startsMonth: boolean;
    isFirst: boolean;
    endsMonth: boolean;
    onSelect: (transaction: Transaction) => void;
    selectedId?: string | null;
}) {
    const { monthLabel, rowLabel } = useDateFormat();

    return (
        <>
            {startsMonth ? (
                <div
                    className={cn(
                        "pb-[14px] text-center text-[11px] tracking-[0.18em] text-mute uppercase",
                        isFirst ? "pt-[2px]" : "pt-[34px]",
                    )}
                >
                    {monthLabel(day.date)}
                </div>
            ) : null}

            {day.transactions.map((transaction, index) => {
                const isLastOfDay = index === day.transactions.length - 1;

                return (
                    <LedgerRow
                        key={transaction.id}
                        transaction={transaction}
                        // A day writes its date once, on its first row.
                        date={index === 0 ? rowLabel(day.date) : ""}
                        rule={
                            !isLastOfDay
                                ? "shared"
                                : endsMonth
                                  ? "none"
                                  : "full"
                        }
                        isSelected={transaction.id === selectedId}
                        onSelect={onSelect}
                    />
                );
            })}
        </>
    );
}

function LedgerRow({
    transaction,
    date,
    rule,
    isSelected,
    onSelect,
}: {
    transaction: Transaction;
    date: string;
    /** How the row closes: a full hairline, one that clears the date cell, none. */
    rule: "full" | "shared" | "none";
    isSelected: boolean;
    onSelect: (transaction: Transaction) => void;
}) {
    const tCommon = useTranslations("common");
    const tCategories = useTranslations("categories");
    const { formatValue } = usePreferences();

    const isIncome = transaction.type === "income";

    return (
        <div
            className={cn(
                "relative grid grid-cols-[72px_minmax(0,1fr)_auto] items-baseline gap-[14px] py-[11px]",
                rule === "full" && "border-b border-rule2",
                // A shared day's hairline starts at 86px — the 72px date column
                // plus the 14px gap — so it clears the date cell and the rows
                // under one date read as a single day rather than as three.
                rule === "shared" &&
                    "after:absolute after:right-0 after:bottom-0 after:left-[86px] after:h-px after:bg-rule2 after:content-['']",
            )}
        >
            <span className="text-xs whitespace-nowrap text-mute">{date}</span>

            <span className="flex min-w-0 items-baseline gap-3">
                <button
                    type="button"
                    onClick={() => onSelect(transaction)}
                    className={cn(
                        "min-w-0 shrink cursor-pointer truncate border-b text-left text-base text-ink transition-colors",
                        isSelected
                            ? "border-ink"
                            : "border-transparent hover:border-ink",
                    )}
                >
                    {transaction.title}
                </button>
                {!isIncome ? (
                    <span className="min-w-0 shrink truncate text-[11px] text-mute">
                        {transaction.category
                            ? categoryLabel(transaction.category, tCategories)
                            : tCommon("noCategory")}
                    </span>
                ) : null}
            </span>

            <span
                className={cn(
                    "ml-auto text-[15px] whitespace-nowrap",
                    isIncome ? "text-green" : "text-red",
                )}
            >
                {formatValue(
                    signedValue(transaction.amount, transaction.type),
                    transaction.amount.currency,
                    { signed: true },
                )}
            </span>
        </div>
    );
}
