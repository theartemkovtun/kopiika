"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

import type { Transaction } from "@/api/types";
import { AccountGate } from "@/components/layout/account-gate";
import { Ledger } from "@/components/ledger/ledger";
import { LedgerFilterRail } from "@/components/ledger/ledger-filters";
import { TransactionDialog } from "@/components/ledger/transaction-dialog";
import type { LedgerFilters } from "@/hooks/use-transactions";

/**
 * The ledger. It has no page header by design: the rows start at the top of the
 * measure, because the first date *is* the heading.
 *
 * The layout is the reading column plus a 271px filter rail, and from `lg` up
 * the two scroll independently: the row is pinned to the viewport height and
 * each column carries its own overflow, top and bottom padding, so the
 * vertical rule between them spans the full height and never moves. The
 * ledger's top inset is the smaller of the two — the first date is the
 * heading, so it wants little above it — but it still lives inside the
 * scrolling columns rather than on the page wrapper: outside them it would
 * sit above a viewport-height row and force the page itself to scroll, which
 * breaks the independent-scroll illusion and stops rows from being clipped
 * cleanly as they pass the top edge. Below `lg` there is only the one column,
 * so the page scrolls normally and the page-level padding is what makes the
 * space. The ledger itself pages by day as the sentinel at its foot comes
 * into view.
 *
 * The filters live here rather than in the rail because the list is what they
 * describe; the open entry lives here for the same reason, so that saving an
 * edit can put the fresh record straight back into the dialog.
 *
 * `useSearchParams` forces whatever reads it to render on the client, so the
 * Suspense boundary is what keeps that confined to the ledger rather than
 * opting the whole route out of static rendering. It comes from
 * `next/navigation` on purpose: the rule against that import covers `Link`,
 * `useRouter` and `usePathname`, which exist in `@/i18n/navigation` because
 * they carry the locale segment. A query string does not, and next-intl's
 * `createNavigation` does not wrap this one.
 */
export default function TransactionsPage() {
    return (
        <Suspense>
            <TransactionsScreen />
        </Suspense>
    );
}

function TransactionsScreen() {
    // `?account=` is how an account's "All entries" arrives, and it *seeds* the
    // rail rather than driving it: the filters are the rail's from the first
    // render on, so narrowing further or clearing the account works normally
    // and does not fight a URL that no longer describes the list. Reading it
    // through the state initialiser is what makes it a seed — later renders do
    // not re-apply it.
    const account = useSearchParams().get("account");

    const [filters, setFilters] = useState<LedgerFilters>(() =>
        account ? { accountIds: [account] } : {},
    );
    const [selected, setSelected] = useState<Transaction | null>(null);

    return (
        <div className="pt-8 pb-16 md:pt-10 md:pb-[72px] lg:pt-0 lg:pb-0">
            <AccountGate>
                <div className="mt-1 grid items-start gap-[22px] lg:h-[calc(100vh-0.25rem)] lg:grid-cols-[minmax(0,1fr)_271px] lg:items-stretch">
                    <div className="no-scrollbar lg:h-full lg:min-h-0 lg:overflow-y-auto lg:pt-6 lg:pb-16">
                        <Ledger
                            filters={filters}
                            onSelect={setSelected}
                            selectedId={selected?.id}
                        />
                    </div>

                    <LedgerFilterRail filters={filters} onChange={setFilters} />

                    <TransactionDialog
                        transaction={selected}
                        onClose={() => setSelected(null)}
                        onSaved={setSelected}
                    />
                </div>
            </AccountGate>
        </div>
    );
}
