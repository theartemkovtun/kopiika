"use client";

import { useState } from "react";

import type { Transaction } from "@/api/types";
import { Ledger } from "@/components/ledger/ledger";
import { LedgerFilterRail } from "@/components/ledger/ledger-filters";
import { TransactionDialog } from "@/components/ledger/transaction-dialog";
import type { LedgerFilters } from "@/hooks/use-transactions";

/**
 * The ledger. It has no page header by design: the rows start at the top of the
 * measure, because the first date *is* the heading.
 *
 * The layout is the reading column plus a 271px filter rail that sticks as the
 * ledger scrolls, and the ledger itself pages by day as the sentinel at its
 * foot comes into view.
 *
 * The filters live here rather than in the rail because the list is what they
 * describe; the open entry lives here for the same reason, so that saving an
 * edit can put the fresh record straight back into the dialog.
 */
export default function TransactionsPage() {
    const [filters, setFilters] = useState<LedgerFilters>({});
    const [selected, setSelected] = useState<Transaction | null>(null);

    return (
        <div className="mt-1 grid items-start gap-[22px] lg:grid-cols-[minmax(0,1fr)_271px]">
            <Ledger
                filters={filters}
                onSelect={setSelected}
                selectedId={selected?.id}
            />

            <LedgerFilterRail filters={filters} onChange={setFilters} />

            <TransactionDialog
                transaction={selected}
                onClose={() => setSelected(null)}
                onSaved={setSelected}
            />
        </div>
    );
}
