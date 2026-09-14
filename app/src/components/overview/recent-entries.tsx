"use client";

import { useTranslations } from "next-intl";
import { cn } from "cn";

import type { Transaction } from "@/api/types";
import { Skeleton } from "@/components/ui/skeleton";
import { usePreferences } from "@/contexts/preferences-context";
import { useDateFormat } from "@/hooks/use-date-format";
import { useLatestTransactions } from "@/hooks/use-transactions";
import { Link } from "@/i18n/navigation";
import { categoryLabel } from "@/lib/categories";
import { signedValue } from "@/lib/money";

/** What the design shows before the list is scrolled: ten entries. */
export const LATEST = 10;

/**
 * The last ten entries, whatever the period strip says.
 *
 * That independence is deliberate in the design and worth keeping: the strip
 * is for reading a month, and this column answers "what have I written
 * lately" — a question a month-bounded read cannot answer on the 1st.
 *
 * Each amount is in the currency it was recorded in, as in the ledger. Only
 * the totals above are converted, because those are the figures that have to
 * add up across currencies.
 */
export function RecentEntries() {
    const t = useTranslations("overview");
    const tNav = useTranslations("nav");

    const { data } = useLatestTransactions(LATEST);
    const entries = data ?? [];

    return (
        <section>
            <div className="mb-3 flex items-baseline gap-[14px]">
                <h2 className="text-[23px] font-normal tracking-[-0.01em] italic">
                    {t("recentTransactions")}
                </h2>
                <Link
                    href="/transactions"
                    aria-label={tNav("transactions")}
                    className="ml-auto text-xs text-mute transition-colors hover:text-blue"
                >
                    →
                </Link>
            </div>

            {!data ? (
                <EntriesSkeleton />
            ) : entries.length === 0 ? (
                <p className="border-t border-rule pt-[11px] text-[15px] text-mute">
                    {t("noEntries")}
                </p>
            ) : (
                <div className="flex flex-col">
                    {entries.map((entry, index) => (
                        <EntryRow
                            key={entry.id}
                            entry={entry}
                            first={index === 0}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}

/**
 * The panel before the account record has landed — see
 * `OverviewSummaryFallback` for why this exists as its own component rather
 * than a loading branch inside `RecentEntries`: the latest-transactions read
 * is kicked off from the page, above the gate, alongside the statistics read,
 * so it has usually already landed by the time `RecentEntries` itself mounts
 * and gets a chance to draw its own loading state. This fallback fills the
 * same gap the summary's does — the one actually visible while the account is
 * in flight.
 */
export function RecentEntriesFallback() {
    const t = useTranslations("overview");
    const tNav = useTranslations("nav");

    return (
        <section>
            <div className="mb-3 flex items-baseline gap-[14px]">
                <h2 className="text-[23px] font-normal tracking-[-0.01em] italic">
                    {t("recentTransactions")}
                </h2>
                <Link
                    href="/transactions"
                    aria-label={tNav("transactions")}
                    className="ml-auto text-xs text-mute transition-colors hover:text-blue"
                >
                    →
                </Link>
            </div>

            <EntriesSkeleton />
        </section>
    );
}

// Widths, not a count off real data — this is the loading state, so there is
// nothing to size it against yet. One pair per row, so the row count is just
// how many pairs are listed here (ten, matching `LATEST`).
const ENTRY_SKELETON_WIDTHS: [title: number, amount: number][] = [
    [140, 58],
    [96, 72],
    [168, 64],
    [110, 80],
    [84, 54],
    [152, 68],
    [100, 76],
    [128, 60],
    [92, 70],
    [144, 66],
];

function EntriesSkeleton() {
    return (
        <div className="flex flex-col" aria-hidden>
            {ENTRY_SKELETON_WIDTHS.map(([titleWidth, amountWidth], index) => (
                <div
                    key={index}
                    className={cn(
                        "grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-[14px] border-t py-[11px]",
                        index === 0 ? "border-rule" : "border-rule2",
                    )}
                >
                    <Skeleton className="h-[12px] w-[34px] bg-rule2" />
                    {/* h-[22.5px]: the row's real height comes from the
                        title's inherited line-height (the 15px base text at
                        the global 1.5), not from either skeleton bar — a
                        shorter span here would leave the real row taller than
                        its loading state and the list would grow when the
                        data lands. */}
                    <span className="flex h-[22.5px] min-w-0 items-center gap-[10px]">
                        <Skeleton
                            className="h-[15px] bg-rule2"
                            style={{ width: titleWidth }}
                        />
                        <Skeleton className="h-[11px] w-[50px] flex-none bg-rule2" />
                    </span>
                    <Skeleton
                        className="h-[14px] bg-rule2"
                        style={{ width: amountWidth }}
                    />
                </div>
            ))}
        </div>
    );
}

function EntryRow({
    entry,
    first,
}: {
    entry: Transaction;
    /** Takes the structural rule that closes the heading off from the list. */
    first: boolean;
}) {
    const tCommon = useTranslations("common");
    const tCategories = useTranslations("categories");
    const { formatValue } = usePreferences();
    const { rowLabel } = useDateFormat();

    const isIncome = entry.type === "income";

    return (
        <div
            className={cn(
                "grid grid-cols-[56px_minmax(0,1fr)_auto] items-baseline gap-[14px] border-t py-[11px]",
                first ? "border-rule" : "border-rule2",
            )}
        >
            <span className="text-xs text-mute">{rowLabel(entry.date)}</span>

            <span className="flex min-w-0 items-baseline gap-[10px]">
                <span className="truncate">{entry.title}</span>
                {/* Income has no category worth naming — it came in, and the
                    green already says so. */}
                {!isIncome ? (
                    <span className="flex-none text-xs whitespace-nowrap text-mute">
                        {entry.category
                            ? categoryLabel(entry.category, tCategories)
                            : tCommon("noCategory")}
                    </span>
                ) : null}
            </span>

            <span
                className={cn("text-sm", isIncome ? "text-green" : "text-red")}
            >
                {formatValue(
                    signedValue(entry.amount, entry.type),
                    entry.amount.currency,
                    { signed: true },
                )}
            </span>
        </div>
    );
}
