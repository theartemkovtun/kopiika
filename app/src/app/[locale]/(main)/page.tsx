"use client";

import { useTranslations } from "next-intl";

import { PageHeader } from "@/components/layout/page-header";
import { PeriodBar } from "@/components/layout/period-bar";
import { Placeholder } from "@/components/layout/placeholder";
import { usePeriod } from "@/contexts/period-context";

/**
 * Overview. The only screen that carries the month strip — every other one
 * either picks its own range or has none.
 *
 * The title is the period itself: the month in the serif plate, the year as its
 * italic aside. In year view the year takes the plate and the aside drops away.
 */
export default function OverviewPage() {
    const calendar = useTranslations("calendar");
    const t = useTranslations("overview");
    const { month, year, yearView } = usePeriod();

    const months = calendar.raw("months") as string[];

    return (
        <>
            <PageHeader
                title={yearView ? year : months[month]}
                subtitle={yearView ? undefined : year}
            />
            <PeriodBar className="mt-7" />

            <Placeholder label={t("whereItWent")}>
                Income, spent and kept across the top; the category pie and the
                daily flow chart below; then the latest entries beside the
                account balances.
            </Placeholder>
        </>
    );
}
