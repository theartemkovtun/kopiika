"use client";

import { useTranslations } from "next-intl";

import { Placeholder } from "@/components/layout/placeholder";

export default function TotpPage() {
    const t = useTranslations("auth");

    return (
        <>
            <h1 className="font-serif text-[40px] leading-[0.95] font-normal tracking-[-0.02em]">
                {t("confirmTitle")}
            </h1>
            <Placeholder label={t("confirmTitle")} className="mt-7">
                The six-digit code from the confirmation email, with a resend
                countdown.
            </Placeholder>
        </>
    );
}
