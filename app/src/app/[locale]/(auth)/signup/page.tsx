"use client";

import { useTranslations } from "next-intl";

import { Placeholder } from "@/components/layout/placeholder";

export default function SignupPage() {
    const t = useTranslations("auth");

    return (
        <>
            <h1 className="text-[40px] leading-[0.95] font-normal tracking-[-0.02em] italic">
                {t("signupTitle")}
            </h1>
            <Placeholder label={t("signupTitle")} className="mt-7">
                Name, email and password, then the six-digit confirmation step.
            </Placeholder>
        </>
    );
}
