"use client";

import { useTranslations } from "next-intl";

import { Placeholder } from "@/components/layout/placeholder";

export default function PasswordResetPage() {
    const t = useTranslations("auth");

    return (
        <>
            <h1 className="font-serif text-[40px] leading-[0.95] font-normal tracking-[-0.02em]">
                {t("resetTitle")}
            </h1>
            <Placeholder label={t("resetTitle")} className="mt-7">
                Request a code by email, then set the new password with it.
            </Placeholder>
        </>
    );
}
