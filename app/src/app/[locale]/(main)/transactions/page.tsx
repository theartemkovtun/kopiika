"use client";

import { useTranslations } from "next-intl";

import { Placeholder } from "@/components/layout/placeholder";

/**
 * The ledger. It has no page header by design: the rows start at the top of the
 * measure, because the first date *is* the heading.
 *
 * The layout is the reading column plus a 271px filter rail that sticks as the
 * ledger scrolls, and the ledger itself pages by month as the sentinel at its
 * foot comes into view.
 */
export default function TransactionsPage() {
    const t = useTranslations("nav");
    const tLedger = useTranslations("ledger");

    return (
        <div className="grid items-start gap-[22px] lg:grid-cols-[minmax(0,1fr)_271px]">
            <div className="min-w-0">
                <Placeholder label={t("transactions")} className="border-t-0">
                    Entries grouped under a centred month rule, each row a date,
                    a description with its category, and the amount — days with
                    more than one entry share a single date cell.
                </Placeholder>
            </div>

            <aside className="flex flex-col gap-5 border-rule py-[14px] lg:sticky lg:top-11 lg:border-l lg:pl-[22px]">
                <Placeholder
                    label={tLedger("type")}
                    className="border-t-0 py-0"
                >
                    Type, date range with presets, then the category and account
                    checkboxes.
                </Placeholder>
            </aside>
        </div>
    );
}
