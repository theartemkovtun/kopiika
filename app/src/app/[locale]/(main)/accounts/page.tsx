"use client";

import { useTranslations } from "next-intl";

import {
    AccountBalances,
    AccountBalancesFallback,
} from "@/components/accounts/account-balances";
import { AccountGate } from "@/components/layout/account-gate";
import { QueryError } from "@/components/layout/query-error";
import { useAccountsBalance } from "@/hooks/use-accounts";
import { Link } from "@/i18n/navigation";

/**
 * Accounts. Like the ledger it has no page header — the screen opens on the
 * total balance, and that number is the title.
 *
 * One read draws all of it: `accounts/balance` answers every account and their
 * combined worth together. It is started here, above the gate, so it runs
 * alongside the user read rather than queued behind it.
 *
 * The panel is a column capped to the viewport, with the account rows as the
 * only part that scrolls, so the New-account row stays on screen however many
 * accounts there are. Below `md` the cap is lifted and the page scrolls as one
 * — a scroll region nested inside a scrolling page is miserable on a phone.
 * 112px is the main element's own `md` padding, 40 over and 72 under.
 *
 * The New-account row sits outside the gate and outside the failure branch. It
 * is a link, not a figure — there is no reason for it to wait on the account
 * record, and every reason for it to still be there when the balances did not
 * come back.
 */
export default function AccountsPage() {
    const t = useTranslations("accounts");
    const { error, refetch } = useAccountsBalance();

    return (
        <div className="flex min-h-0 flex-col md:max-h-[calc(100dvh-112px)]">
            <AccountGate fallback={<AccountBalancesFallback />}>
                {error ? (
                    <QueryError
                        onRetry={() => void refetch()}
                        className="border-t-0"
                    />
                ) : (
                    <AccountBalances />
                )}
            </AccountGate>

            {/* Centred, where every account row is ruled left-to-right: it is
                the way out of the list rather than another line in it. */}
            <Link
                href="/accounts/new"
                className="flex min-h-[56px] w-full flex-none items-center justify-center gap-[10px] py-[14px] text-center text-mute transition-colors hover:text-ink"
            >
                <span aria-hidden className="text-sm leading-none">
                    +
                </span>
                <span className="text-[13px] leading-none font-medium tracking-[-0.006em]">
                    {t("addAccount")}
                </span>
            </Link>
        </div>
    );
}
