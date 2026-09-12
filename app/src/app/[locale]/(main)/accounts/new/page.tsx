"use client";

import { useTranslations } from "next-intl";

import { PageHeader } from "@/components/layout/page-header";
import { Placeholder } from "@/components/layout/placeholder";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function NewAccountPage() {
    const t = useTranslations("newAccount");

    return (
        <>
            <PageHeader title={t("title")} />

            <div className="mt-[30px] max-w-[520px]">
                <Button asChild variant="ghost" size="text">
                    <Link
                        href="/accounts"
                        className="font-mono text-xs text-mute"
                    >
                        {t("back")}
                    </Link>
                </Button>

                <Placeholder label={t("title")} className="mt-[18px]">
                    Name, type, currency and opening balance as ruled rows, then
                    Create account.
                </Placeholder>

                <p className="mt-[22px] text-[13px] text-pretty text-mute">
                    {t("note")}
                </p>
            </div>
        </>
    );
}
