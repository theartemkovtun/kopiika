"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { DayEntries } from "@/components/entry/day-entries";
import { EntryCalendar } from "@/components/entry/entry-calendar";
import { EntryForm } from "@/components/entry/entry-form";
import { AccountGate } from "@/components/layout/account-gate";
import { PageHeader } from "@/components/layout/page-header";
import { todayIso } from "@/lib/dates";

/**
 * New entry. The design puts the calendar on the *left* and the form on the
 * right — the aside is `order: 1` and the form `order: 2` — so the day you are
 * writing against is read before the amount you are writing.
 *
 * The selected day is the one piece of state the two halves share: the calendar
 * sets it, the form files against it, and the day list underneath shows what is
 * already there. Everything else belongs to whichever half owns it.
 */
export default function AddEntryPage() {
    const t = useTranslations("nav");

    const [date, setDate] = useState(todayIso);
    const [lastCreatedId, setLastCreatedId] = useState<string | null>(null);

    return (
        <>
            <PageHeader title={t("add")} />

            <AccountGate>
                <div className="mt-9 grid items-start gap-x-7 gap-y-12 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,3fr)]">
                    <aside className="order-1 flex flex-col gap-[30px]">
                        <EntryCalendar
                            selected={date}
                            onSelect={(next) => {
                                setDate(next);
                                setLastCreatedId(null);
                            }}
                        />
                        <DayEntries date={date} highlightId={lastCreatedId} />
                    </aside>

                    <EntryForm
                        date={date}
                        onDateChange={setDate}
                        onCreated={(created) => setLastCreatedId(created.id)}
                        className="order-2 border-rule lg:border-l lg:pl-7"
                    />
                </div>
            </AccountGate>
        </>
    );
}
