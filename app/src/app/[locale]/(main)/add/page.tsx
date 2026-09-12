"use client";

import { useTranslations } from "next-intl";

import { PageHeader } from "@/components/layout/page-header";
import { Placeholder } from "@/components/layout/placeholder";

/**
 * New entry. The design puts the calendar on the *left* and the form on the
 * right — the aside is `order: 1` and the form `order: 2` — so the day you are
 * writing against is read before the amount you are writing.
 */
export default function AddEntryPage() {
    const t = useTranslations("nav");
    const tEntry = useTranslations("entry");

    return (
        <>
            <PageHeader title={t("add")} />

            <div className="mt-9 grid items-start gap-x-7 gap-y-12 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,3fr)]">
                <aside className="order-1 flex flex-col gap-[30px]">
                    <Placeholder label={tEntry("date")}>
                        A month calendar with a dot on every day that already
                        has entries, and that day&rsquo;s entries listed under
                        it.
                    </Placeholder>
                </aside>

                <div className="order-2 border-rule lg:border-l lg:pl-7">
                    <Placeholder label={tEntry("type")}>
                        Expense or income, amount with its currency,
                        description, category and account — then Add entry.
                    </Placeholder>
                </div>
            </div>
        </>
    );
}
