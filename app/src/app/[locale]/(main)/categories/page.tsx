"use client";

import { useTranslations } from "next-intl";

import {
    CategoryList,
    CategoryListFallback,
} from "@/components/categories/category-list";
import { AccountGate } from "@/components/layout/account-gate";
import { PageHeader } from "@/components/layout/page-header";
import { QueryError } from "@/components/layout/query-error";
import { useCategories } from "@/hooks/use-categories";
import { Link } from "@/i18n/navigation";

/**
 * Categories. It carries a title and no month strip — the list is the whole of
 * someone's categories, not a period's worth of them, so there is nothing for
 * a period to filter.
 *
 * The panel is a column capped to the viewport with the rows as the only part
 * that scrolls, so the New-category row stays on screen however many
 * categories there are — the same shape as Accounts, and lifted below `md` for
 * the same reason: a scroll region nested inside a scrolling page is miserable
 * on a phone.
 *
 * The read is started here, above the gate, so it runs alongside the user read
 * rather than queued behind it.
 *
 * The New-category row appears with the list and not before it. Both reasons
 * the skeleton is on the screen — no account record yet, no categories yet —
 * hide it: the first because it sits inside the gate, the second because it
 * waits on the read settling. A way out of a list that is still a row of grey
 * bars reads as part of the placeholder rather than as a control. It does
 * survive a *failed* read, though, which is the one case where it is the only
 * thing left to do on the screen.
 */
export default function CategoriesPage() {
    const t = useTranslations("categoryList");
    const { data, error, refetch } = useCategories();

    // Whether the read is over, either way — not whether it succeeded. The
    // gate holds the other half of the wait, so inside it this is the only
    // question left.
    const settled = Boolean(data) || Boolean(error);

    return (
        <div className="flex min-h-0 flex-col pt-8 pb-2 md:max-h-dvh md:pt-10 md:pb-3">
            <PageHeader title={t("title")} className="mb-[30px] flex-none" />

            {/* `PreferencesProvider` renders no element of its own, so both of
                these stay direct children of the column and the row below keeps
                its place at the foot of it. */}
            <AccountGate fallback={<CategoryListFallback />}>
                {error ? (
                    <QueryError onRetry={() => void refetch()} />
                ) : (
                    <CategoryList />
                )}

                {/* Centred, where every category row is ruled left-to-right: it
                    is the way out of the list rather than another line in it. */}
                {settled ? (
                    <Link
                        href="/categories/new"
                        className="flex min-h-[56px] w-full flex-none items-center justify-center gap-[10px] border-t border-rule py-[18px] text-center text-mute transition-colors hover:text-ink"
                    >
                        <span aria-hidden className="text-sm leading-none">
                            +
                        </span>
                        <span className="text-[13px] leading-none font-medium tracking-[-0.006em]">
                            {t("addCategory")}
                        </span>
                    </Link>
                ) : null}
            </AccountGate>
        </div>
    );
}
