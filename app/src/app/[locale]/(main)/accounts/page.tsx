"use client";

import { useTranslations } from "next-intl";

import { Placeholder } from "@/components/layout/placeholder";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/**
 * Accounts. Like the ledger it has no page header — the screen opens on the
 * total balance, and that number is the title.
 */
export default function AccountsPage() {
    const t = useTranslations("accounts");

    return (
        <div className="flex flex-col">
            <div className="border-b border-rule pb-[26px]">
                <div className="font-mono text-sm tracking-[0.14em] text-mute uppercase">
                    {t("totalBalance")}
                </div>
                <div className="mt-[10px] font-mono text-[clamp(28px,3.4vw,38px)] leading-[1.05] tracking-[-0.02em] text-mute">
                    —
                </div>
            </div>

            <Placeholder label={t("totalBalance")} className="border-t-0">
                A stacked share bar under the total, then one ruled row per
                account: a colour dot, the name and type, the approximate value
                in your display currency, and the balance in its own.
            </Placeholder>

            <Button
                asChild
                variant="ghost"
                size="text"
                className="flex items-baseline gap-3 border-b border-rule2 py-4 text-[15px] text-mute"
            >
                <Link href="/accounts/new">
                    <span className="w-[9px] shrink-0 text-center font-mono text-[15px]">
                        +
                    </span>
                    <span>{t("addAccount")}</span>
                </Link>
            </Button>
        </div>
    );
}
