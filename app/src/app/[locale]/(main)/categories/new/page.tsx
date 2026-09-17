"use client";

import { useTranslations } from "next-intl";

import { NewCategoryForm } from "@/components/categories/new-category-form";
import { AccountGate } from "@/components/layout/account-gate";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/**
 * The new-category screen: a title, the way back, and the form.
 *
 * Only the form is gated, and only because it reads the category list to check
 * the name against and to cycle the suggested colour. The title and the way
 * back are on the screen from the first paint.
 */
export default function NewCategoryPage() {
    const t = useTranslations("newCategory");

    return (
        <div className="pt-8 pb-16 md:pt-10 md:pb-[72px]">
            <PageHeader title={t("title")} />

            <div className="mt-[30px] max-w-[560px]">
                <Button asChild variant="ghost" size="text">
                    <Link href="/categories" className="text-xs text-mute">
                        {t("back")}
                    </Link>
                </Button>

                <AccountGate>
                    <NewCategoryForm />
                </AccountGate>
            </div>
        </div>
    );
}
