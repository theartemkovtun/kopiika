"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";
import { usePreferences } from "@/contexts/preferences-context";
import { useAccountsBalance } from "@/hooks/use-accounts";
import { Link } from "@/i18n/navigation";
import { creditedTotal, shareOfTotal } from "@/lib/accounts";
import { storedColor } from "@/lib/charts";
import { currencyLabel, toNumber } from "@/lib/money";

/**
 * The whole of the Accounts screen: the combined total, the share bar under
 * it, and one ruled row per account.
 *
 * Four things about it are worth knowing before changing any of it:
 *
 *  - **The converted figure leads.** Each row's large number is the balance in
 *    the display currency, because that is the one that adds up to the total
 *    above it; the account's own currency follows underneath, small, and only
 *    when the two differ. The API hands back both, so nothing is converted
 *    here.
 *  - **A colour comes from the account.** Each row is drawn in the account's
 *    own `colorHex`, so it keeps that colour wherever it appears and however
 *    the response happens to be ordered — the colour is assigned before the
 *    sort below, so re-ordering never recolours anything. The Overview reads
 *    the same field. An account whose stored value is not a hex colour falls
 *    back to `--ch*` by position; see `storedColor`.
 *  - **The bar is what the total is made of**, so only accounts in credit take
 *    a band; one in the red subtracts from the total rather than adding to it.
 *    See `creditedTotal` for why the share is measured against that pool and
 *    not against every balance summed.
 *  - **The rows are the part that scrolls.** The panel is capped to the
 *    viewport by the page, and this is the region that takes the overflow —
 *    which is what keeps the New-account row below it on screen however many
 *    accounts there are. The cap is lifted below `md`; see the page.
 *
 * The header and the rows are a fragment rather than a panel because the
 * New-account row is a sibling of both and outlives them — see the page.
 */
export function AccountBalances() {
    const t = useTranslations("accounts");

    const { format } = usePreferences();
    const { data } = useAccountsBalance();

    // Which band the pointer is on, by account id rather than by index — the
    // list re-sorts as balances move, and an index would follow the position
    // instead of the account.
    const [hovered, setHovered] = useState<string | null>(null);

    if (!data) return <AccountBalancesFallback />;

    const accounts = data.accounts
        .map((account, index) => ({
            ...account,
            color: storedColor(account.colorHex, index),
            worth: toNumber(account.localizedAmount.value),
        }))
        .sort((a, b) => b.worth - a.worth);

    const pool = creditedTotal(accounts.map((account) => account.worth));

    const shares = accounts
        .map((account) => ({
            ...account,
            share: shareOfTotal(account.worth, pool),
        }))
        .filter((account) => account.share > 0);

    // Each band's midpoint along the bar, so the tooltip can sit over the
    // middle of the band it describes rather than over the pointer. Summed
    // from the front per band rather than carried in a running total: there
    // are as many bands as the account list is long, and an accumulator
    // reassigned during render is exactly what the compiler rejects.
    const bands = shares.map((account, index) => ({
        ...account,
        center:
            shares.slice(0, index).reduce((sum, band) => sum + band.share, 0) +
            account.share / 2,
    }));

    const tip = bands.find((band) => band.id === hovered) ?? null;

    return (
        <>
            <div className="grid grid-cols-[minmax(0,1fr)] items-end gap-5 pb-[22px]">
                <div>
                    <div className="font-mono text-[11px] tracking-[0.16em] text-mute uppercase">
                        {t("totalBalance")}
                    </div>
                    <div className="mt-3 font-mono text-[clamp(26px,3.4vw,40px)] leading-none tracking-[-0.03em]">
                        {format(data.total)}
                    </div>
                </div>

                {/* Every figure in the bar is also in the list below, so it is
                    decoration over data that is already reachable — hiding it
                    keeps a row of unlabelled divs out of the reading order
                    rather than adding one stop per account to it. */}
                {bands.length > 0 ? (
                    <div
                        aria-hidden
                        className="relative col-span-full flex h-[9px] gap-[2px]"
                    >
                        {bands.map((band) => (
                            <div
                                key={band.id}
                                onMouseEnter={() => setHovered(band.id)}
                                onMouseLeave={() => setHovered(null)}
                                className="min-w-[3px] cursor-default transition-opacity duration-150"
                                style={{
                                    flex: `${band.share} 1 0`,
                                    background: band.color,
                                    opacity:
                                        tip && tip.id !== band.id ? 0.3 : 1,
                                }}
                            />
                        ))}

                        {tip ? (
                            <div
                                className="pointer-events-none absolute top-[calc(100%+9px)] z-[5] -translate-x-1/2 bg-ink px-[13px] py-[9px] whitespace-nowrap text-bg shadow-[0_6px_20px_rgba(0,0,0,0.18)]"
                                style={{
                                    left: `${(tip.center * 100).toFixed(2)}%`,
                                }}
                            >
                                <div className="flex items-baseline gap-3">
                                    <span className="text-sm font-medium">
                                        {tip.name}
                                    </span>
                                    <span className="font-mono text-xs opacity-[0.72]">
                                        {Math.round(tip.share * 100)}%
                                    </span>
                                </div>
                                <div className="mt-[5px] flex items-baseline gap-3 font-mono text-xs">
                                    <span>{format(tip.localizedAmount)}</span>
                                    {tip.amount.currency !==
                                    tip.localizedAmount.currency ? (
                                        <span className="opacity-[0.66]">
                                            {format(tip.amount)}
                                        </span>
                                    ) : null}
                                </div>
                                <div className="mt-1 font-mono text-[10px] tracking-[0.12em] uppercase opacity-[0.62]">
                                    {currencyLabel(tip.amount.currency)}
                                </div>
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </div>

            <div className="no-scrollbar min-h-0 flex-[0_1_auto] overflow-y-auto overscroll-contain border-y border-rule2">
                {accounts.length === 0 ? (
                    <p className="py-[14px] text-[15px] text-mute">
                        {t("empty")}
                    </p>
                ) : (
                    accounts.map((account, index) => (
                        <div
                            key={account.id}
                            className={`grid min-h-[76px] grid-cols-[minmax(0,1fr)_auto] items-center gap-6 py-[15px] ${
                                index === 0 ? "" : "border-t border-rule2"
                            }`}
                        >
                            <div className="min-w-0">
                                <div className="flex min-w-0 items-center gap-[14px]">
                                    <span
                                        aria-hidden
                                        className="size-[9px] flex-none rounded-full"
                                        style={{ background: account.color }}
                                    />
                                    <Link
                                        href={`/accounts/${account.id}`}
                                        className="block max-w-full truncate border-b border-transparent text-base leading-[1.15] font-medium tracking-[-0.012em] text-ink transition-colors hover:border-ink"
                                    >
                                        {account.name}
                                    </Link>
                                </div>
                                {/* 23px is the dot plus its gap, so the code
                                    hangs under the name rather than under the
                                    dot. */}
                                <div className="mt-[6px] pl-[23px] font-mono text-[11px] tracking-[0.1em] text-mute uppercase">
                                    {currencyLabel(account.amount.currency)}
                                </div>
                            </div>

                            <div className="text-right">
                                <div className="font-mono text-[22px] leading-none tracking-[-0.03em] whitespace-nowrap">
                                    {format(account.localizedAmount)}
                                </div>
                                {/* The account's own currency, and only when
                                    that is a different one — the figure above
                                    already says what it is worth. */}
                                {account.amount.currency !==
                                account.localizedAmount.currency ? (
                                    <div className="mt-[7px] font-mono text-xs whitespace-nowrap text-mute">
                                        {format(account.amount)}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </>
    );
}

/**
 * The screen before the account record has landed.
 *
 * The balance read is kicked off by the page, above the gate, alongside the
 * user read itself — so by the time `AccountBalances` mounts its own loading
 * branch has usually nothing left to wait for, and this is the state actually
 * on the screen. Both draw the same skeleton.
 */
export function AccountBalancesFallback() {
    const t = useTranslations("accounts");

    return (
        <>
            <div className="grid grid-cols-[minmax(0,1fr)] items-end gap-5 pb-[22px]">
                <div>
                    <div className="font-mono text-[11px] tracking-[0.16em] text-mute uppercase">
                        {t("totalBalance")}
                    </div>
                    {/* A line box at the total's own size and leading, so the
                        rule under it does not move when the figure lands. */}
                    <div className="mt-3 flex h-[1em] items-center font-mono text-[clamp(26px,3.4vw,40px)] leading-none">
                        <Skeleton className="h-[0.7em] w-[6ch] bg-rule2" />
                    </div>
                </div>
                <div className="col-span-full h-[9px] bg-rule2" />
            </div>

            <AccountRowsSkeleton />
        </>
    );
}

// Widths, not a count off real data — this is the loading state, so there is
// nothing to size it against yet. One pair per row, so the row count is just
// how many pairs are listed here.
const ACCOUNT_SKELETON_WIDTHS: [name: number, amount: number][] = [
    [128, 92],
    [104, 78],
    [148, 86],
];

function AccountRowsSkeleton() {
    return (
        <div className="border-y border-rule2" aria-hidden>
            {ACCOUNT_SKELETON_WIDTHS.map(([nameWidth, amountWidth], index) => (
                <div
                    key={index}
                    className={`grid min-h-[76px] grid-cols-[minmax(0,1fr)_auto] items-center gap-6 py-[15px] ${
                        index === 0 ? "" : "border-t border-rule2"
                    }`}
                >
                    <div className="min-w-0">
                        <span className="flex items-center gap-[14px]">
                            <Skeleton className="size-[9px] flex-none rounded-full bg-rule2" />
                            <Skeleton
                                className="h-[18px] bg-rule2"
                                style={{ width: nameWidth }}
                            />
                        </span>
                        <Skeleton className="mt-[6px] ml-[23px] h-[11px] w-[34px] bg-rule2" />
                    </div>
                    <Skeleton
                        className="h-[22px] justify-self-end bg-rule2"
                        style={{ width: amountWidth }}
                    />
                </div>
            ))}
        </div>
    );
}
