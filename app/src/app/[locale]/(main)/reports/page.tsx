"use client";

import { useTranslations } from "next-intl";

import { PageHeader } from "@/components/layout/page-header";
import { Placeholder } from "@/components/layout/placeholder";

/**
 * Reports carries its own from/to range with presets, rather than the month
 * strip: it is the one screen where a period can straddle months.
 */
export default function ReportsPage() {
    const t = useTranslations("nav");
    const tReports = useTranslations("reports");

    return (
        <>
            <PageHeader title={t("reports")} />

            <Placeholder label={tReports("flow")} className="mt-7">
                Range presets and a from/to pair, then income, spent and the
                difference with proportion bars; operations, net per day and
                spent per day; the flow chart; and category and account
                breakdowns with amount and count bars.
            </Placeholder>
        </>
    );
}
