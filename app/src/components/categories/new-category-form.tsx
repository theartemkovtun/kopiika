"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { ApiError } from "@/api/client";
import { ColorField } from "@/components/accounts/color-field";
import { Button } from "@/components/ui/button";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { useCategories, useCreateCategory } from "@/hooks/use-categories";
import { Link, useRouter } from "@/i18n/navigation";
import {
    CATEGORY_SWATCHES,
    DEFAULT_CATEGORY_ICON,
    categoryNameTaken,
    isGlobalCategory,
    newCategoryColor,
} from "@/lib/categories";

/** The design's own label column on this form: 150px, no gutter. */
const LABEL = "basis-[150px] pr-0";

/**
 * Opening a category: a name and a colour, and nothing else.
 *
 * The **icon** the API requires is not a field. v9 draws a category as a
 * coloured dot and gives no way to choose one, so every category written here
 * carries the same default; see `DEFAULT_CATEGORY_ICON` for why the column is
 * still populated rather than sent empty.
 *
 * The **name** is checked for a collision before the call goes out, because
 * the API has no uniqueness constraint on the column and would happily store a
 * second "Pets". The check is against what is on the list screen — translated
 * built-in labels included — which is `categoryNameTaken`.
 *
 * The list read is already in the cache on the way here from the Categories
 * screen. It is wanted for both halves of that: the names to check against,
 * and the count of the user's own rows, which is what cycles the suggested
 * colour so the first five categories do not all open red.
 */
export function NewCategoryForm() {
    const t = useTranslations("newCategory");
    const tList = useTranslations("categoryList");
    const tCategories = useTranslations("categories");
    const tCommon = useTranslations("common");

    const router = useRouter();

    const { data: categories } = useCategories();
    const { mutate: createCategory, isPending } = useCreateCategory();

    const [name, setName] = useState("");
    const [picked, setPicked] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const owned = categories?.filter((c) => !isGlobalCategory(c)).length ?? 0;
    const color = picked ?? newCategoryColor(owned);

    /** Any edit clears the last outcome: it described the previous attempt. */
    function edit<T>(set: (value: T) => void) {
        return (value: T) => {
            set(value);
            setError(null);
        };
    }

    function submit(event: React.FormEvent) {
        event.preventDefault();
        // Enter in the field submits even while the button is disabled.
        if (isPending) return;

        const trimmed = name.trim();
        if (!trimmed) {
            setError(tList("errName"));
            return;
        }
        if (categoryNameTaken(trimmed, categories ?? [], tCategories)) {
            setError(tList("errDupe"));
            return;
        }

        createCategory(
            {
                name: trimmed,
                icon: DEFAULT_CATEGORY_ICON,
                hexColor: color,
            },
            {
                onSuccess: () => router.push("/categories"),
                onError: (cause) =>
                    setError(
                        cause instanceof ApiError
                            ? cause.message
                            : tCommon("error"),
                    ),
            },
        );
    }

    return (
        <form onSubmit={submit} noValidate className="mt-6 flex flex-col">
            <FormRow
                asLabel
                label={t("name")}
                required
                labelClassName={LABEL}
                className="border-t border-t-rule py-4"
            >
                <Input
                    autoComplete="off"
                    required
                    maxLength={64}
                    placeholder={t("nameHint")}
                    value={name}
                    onChange={(event) => edit(setName)(event.target.value)}
                    className="text-[26px]"
                />
            </FormRow>

            {/* Swatches are a row of buttons, so this row cannot be a label and
                sits on the centre line rather than on a baseline there is no
                text to share. */}
            <FormRow
                label={t("color")}
                labelClassName={LABEL}
                className="items-center border-b-rule py-[18px]"
            >
                <ColorField
                    value={color}
                    swatches={CATEGORY_SWATCHES}
                    onChange={edit(setPicked)}
                />
            </FormRow>

            <div className="mt-7 flex flex-wrap items-center gap-5">
                <Button type="submit" disabled={isPending}>
                    {t("submit")}
                </Button>
                <Button asChild variant="quiet">
                    <Link href="/categories">{t("cancel")}</Link>
                </Button>
                <span role="status" className="text-[12.5px] text-red">
                    {error ?? ""}
                </span>
            </div>
        </form>
    );
}
