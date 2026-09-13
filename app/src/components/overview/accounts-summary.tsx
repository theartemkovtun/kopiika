"use client";

import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";
import { usePreferences } from "@/contexts/preferences-context";
import { useAccountsBalance } from "@/hooks/use-accounts";
import { Link } from "@/i18n/navigation";
import { storedColor } from "@/lib/charts";
import { toNumber } from "@/lib/money";

/** How many accounts the Overview names before deferring to the Accounts screen. */
const NAMED = 5;

/**
 * What the money is sitting in: the combined total, what it is made of, and the
 * five largest accounts.
 *
 * The colour an account is drawn in is its own `colorHex`, so the segment in
 * the bar and the dot beside the name match, the Accounts screen draws it the
 * same, and adding an account never recolours the others. An account whose
 * stored value is not a hex colour falls back to the positional series, which
 * is why the index is still passed in — and why it is taken *before* the rows
 * are sorted, so such an account keeps one colour between the bar and the row.
 *
 * The bar is what the total is made up of, so only accounts in credit take a
 * segment; one in the red subtracts from the total rather than adding a band
 * to it. Each row carries its balance in its own currency — the total above is
 * the one figure converted, because it is the only one that has to add up.
 */
export function AccountsSummary() {
    const t = useTranslations("overview");
    const tNav = useTranslations("nav");
    const tAccounts = useTranslations("accounts");

    const { format } = usePreferences();
    const { data } = useAccountsBalance();

    const accounts = (data?.accounts ?? []).map((account, index) => ({
        ...account,
        color: storedColor(account.colorHex, index),
        worth: toNumber(account.localizedAmount.value),
    }));

    const credited = accounts.filter((account) => account.worth > 0);
    const pool = credited.reduce((sum, account) => sum + account.worth, 0);

    const named = [...accounts]
        .sort((a, b) => b.worth - a.worth)
        .slice(0, NAMED);

    return (
        <section>
            <div className="mb-3 flex items-baseline gap-[14px]">
                <h2 className="font-serif text-[30px] font-normal tracking-[-0.01em]">
                    {tNav("accounts")}
                </h2>
                <Link
                    href="/accounts"
                    aria-label={tNav("accounts")}
                    className="ml-auto font-mono text-xs text-mute transition-colors hover:text-blue"
                >
                    →
                </Link>
            </div>

            <div className="flex flex-col">
                <div className="border-t border-rule pt-[22px] pb-[14px]">
                    <div className="font-mono text-[11px] tracking-[0.14em] text-mute uppercase">
                        {t("totalBalance")}
                    </div>
                    {/* h-[1.5em]: unlike the summary band's figures, this
                        line has no `leading-none` — it keeps the browser's
                        inherited 1.5 line-height. Reserving that height on the
                        row itself, rather than on the skeleton bar, keeps the
                        loading state the same height as the real total
                        without drawing a bar as tall as the leading. */}
                    <div className="mt-[6px] flex h-[1.5em] items-center font-mono text-[28px] tracking-[-0.02em]">
                        {data ? (
                            format(data.total)
                        ) : (
                            <Skeleton className="h-[1em] w-[150px] bg-rule2" />
                        )}
                    </div>

                    {pool > 0 ? (
                        <div className="mt-[14px] flex h-[10px] gap-[2px]">
                            {credited.map((account) => (
                                <div
                                    key={account.id}
                                    title={`${account.name} — ${format(account.localizedAmount)}`}
                                    className="min-w-[2px]"
                                    style={{
                                        flex: `${account.worth / pool} 1 0`,
                                        background: account.color,
                                    }}
                                />
                            ))}
                        </div>
                    ) : null}
                </div>

                {!data ? (
                    <AccountRowsSkeleton />
                ) : named.length === 0 ? (
                    <p className="border-t border-rule2 pt-[9px] text-sm text-mute">
                        {tAccounts("empty")}
                    </p>
                ) : (
                    named.map((account) => (
                        <div
                            key={account.id}
                            className="flex items-baseline justify-between gap-3 border-t border-rule2 py-[9px] text-sm"
                        >
                            <span className="flex min-w-0 flex-1 items-baseline gap-[9px]">
                                <span
                                    aria-hidden
                                    className="size-[8px] flex-none rounded-full"
                                    style={{ background: account.color }}
                                />
                                <span className="min-w-0 truncate">
                                    {account.name}
                                    {account.description ? (
                                        <span className="text-xs text-mute">
                                            {" "}
                                            {account.description}
                                        </span>
                                    ) : null}
                                </span>
                            </span>
                            <span className="font-mono text-sm whitespace-nowrap">
                                {format(account.amount)}
                            </span>
                        </div>
                    ))
                )}
            </div>
        </section>
    );
}

/**
 * The panel before the account record has landed — see
 * `OverviewSummaryFallback` for why this exists as its own component rather
 * than a loading branch inside `AccountsSummary`: the accounts-balance read
 * is kicked off from the page, above the gate, alongside the statistics read,
 * so it has usually already landed by the time `AccountsSummary` itself mounts
 * and gets a chance to draw its own loading state. This fallback fills the
 * same gap the summary's does — the one actually visible while the account is
 * in flight. It cannot use `usePreferences` — that provider mounts inside the
 * gate this fallback stands in for — so unlike the real panel it has nothing
 * to format and is skeleton throughout.
 */
export function AccountsSummaryFallback() {
    const t = useTranslations("overview");
    const tNav = useTranslations("nav");

    return (
        <section>
            <div className="mb-3 flex items-baseline gap-[14px]">
                <h2 className="font-serif text-[30px] font-normal tracking-[-0.01em]">
                    {tNav("accounts")}
                </h2>
                <Link
                    href="/accounts"
                    aria-label={tNav("accounts")}
                    className="ml-auto font-mono text-xs text-mute transition-colors hover:text-blue"
                >
                    →
                </Link>
            </div>

            <div className="flex flex-col">
                <div className="border-t border-rule pt-[22px] pb-[14px]">
                    <div className="font-mono text-[11px] tracking-[0.14em] text-mute uppercase">
                        {t("totalBalance")}
                    </div>
                    <div className="mt-[6px] flex h-[1.5em] items-center font-mono text-[28px] tracking-[-0.02em]">
                        <Skeleton className="h-[1em] w-[150px] bg-rule2" />
                    </div>
                </div>

                <AccountRowsSkeleton />
            </div>
        </section>
    );
}

// Widths, not a count off real data — this is the loading state, so there is
// nothing to size it against yet. One pair per row, so the row count is just
// how many pairs are listed here (five, matching `NAMED`).
const ACCOUNT_SKELETON_WIDTHS: [name: number, amount: number][] = [
    [104, 58],
    [136, 72],
    [88, 64],
    [116, 80],
    [96, 54],
];

function AccountRowsSkeleton() {
    return (
        <div aria-hidden>
            {ACCOUNT_SKELETON_WIDTHS.map(([nameWidth, amountWidth], index) => (
                <div
                    key={index}
                    className="flex items-center justify-between gap-3 border-t border-rule2 py-[9px]"
                >
                    {/* h-[20px]: the row's real height comes from the name's
                        text-sm line-height (20px), not from either skeleton
                        bar — a shorter span here would leave the real row
                        taller than its loading state and the list would grow
                        when the data lands. */}
                    <span className="flex h-[20px] min-w-0 flex-1 items-center gap-[9px]">
                        <Skeleton className="size-[8px] flex-none rounded-full bg-rule2" />
                        <Skeleton
                            className="h-[14px] bg-rule2"
                            style={{ width: nameWidth }}
                        />
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
