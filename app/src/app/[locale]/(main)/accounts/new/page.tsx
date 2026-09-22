"use client";

import { useTranslations } from "next-intl";

import { NewAccountForm } from "@/components/accounts/new-account-form";
import { AccountGate } from "@/components/layout/account-gate";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/**
 * The new-account screen. Unlike Accounts it does carry a title, because there
 * is no figure at the top of it to be one.
 *
 * Only the form is gated: it opens its currency row on the display currency,
 * which is the one thing here that comes off the user record. The title and
 * the way back are on the screen from the first paint.
 */
export default function NewAccountPage() {
    const t = useTranslations("newAccount");

    return (
        <div className="pt-8 pb-16 md:pt-10 md:pb-[72px]">
            <PageHeader title={t("title")} />

            <div className="mt-[30px] max-w-[520px]">
                <Button asChild variant="ghost" size="text">
                    <Link href="/accounts" className="text-xs text-mute">
                        {t("back")}
                    </Link>
                </Button>

                <AccountGate>
                    <NewAccountForm />
                </AccountGate>
            </div>
        </div>
    );
}
