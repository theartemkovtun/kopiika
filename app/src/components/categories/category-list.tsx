"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "cn";

import { ApiError } from "@/api/client";
import type { Category } from "@/api/types";
import { ColorField } from "@/components/accounts/color-field";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
    useCategories,
    useDeleteCategory,
    useUpdateCategory,
} from "@/hooks/use-categories";
import {
    CATEGORY_SWATCHES,
    GLOBAL_CATEGORY_SLUGS,
    categoryLabel,
    categoryNameTaken,
    isGlobalCategory,
} from "@/lib/categories";
import { storedColor } from "@/lib/charts";

/**
 * The category list: the ten the API ships with, then the user's own.
 *
 * The order is the API's — `GET /v1/categories` sorts by id, and the seed
 * reserves 1..11, so every global row sorts above every user row without this
 * screen re-sorting anything. That is what the heavier rule under the last
 * global marks: the two halves of the list are a fact about the data, not a
 * grouping applied here, so there is no heading over either.
 *
 * **A built-in row carries no action.** Names and colours on the global rows
 * are fixed — they are shared by every user, and `PUT`/`DELETE` match on the
 * owner, so the API answers 404 rather than writing one. The design's Hide is
 * out: nothing in the API stores which categories a user has put away, and a
 * per-browser flag would be a setting that silently does not travel.
 *
 * Editing happens in the row rather than on a screen of its own, which is why
 * this is one component and not a list plus a form: the row is the thing being
 * changed, and replacing it in place is what the design draws.
 */
export function CategoryList() {
    const t = useTranslations("categoryList");
    const tCategories = useTranslations("categories");
    const tCommon = useTranslations("common");

    const { data: categories } = useCategories();

    // The row open for editing, and the row queued for deletion. Both by id —
    // the list re-reads after every write, so a held object would go stale.
    const [editing, setEditing] = useState<number | null>(null);
    const [deleting, setDeleting] = useState<number | null>(null);

    if (!categories) return <CategoryListFallback />;

    // Where the API's own ordering stops being global rows and starts being
    // the user's, so the boundary can take the heavier rule.
    const lastGlobal = categories.findLastIndex(isGlobalCategory);
    const queued = categories.find(({ id }) => id === deleting) ?? null;

    return (
        <>
            <div className="no-scrollbar min-h-0 flex-[0_1_auto] overflow-y-auto overscroll-contain border-t border-rule">
                {categories.map((category, index) => (
                    <div
                        key={category.id}
                        className={cn(
                            "border-b",
                            index === lastGlobal ? "border-rule" : "border-rule2",
                        )}
                    >
                        {editing === category.id ? (
                            <CategoryEditRow
                                category={category}
                                all={categories}
                                onDone={() => setEditing(null)}
                            />
                        ) : (
                            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-5 px-4 py-[15px] sm:grid-cols-[minmax(0,1fr)_150px_168px]">
                                <div className="flex min-w-0 items-center gap-[14px]">
                                    <span
                                        aria-hidden
                                        className="size-3 flex-none rounded-full"
                                        style={{
                                            background: storedColor(
                                                category.hexColor,
                                                index,
                                            ),
                                        }}
                                    />
                                    <span
                                        className={cn(
                                            "min-w-0 truncate text-base tracking-[-0.012em] text-ink",
                                            isGlobalCategory(category)
                                                ? "font-normal"
                                                : "font-medium",
                                        )}
                                    >
                                        {categoryLabel(category, tCategories)}
                                    </span>
                                </div>

                                {/* Blank on a built-in: the design tags only
                                    the user's own rows, and the absence of the
                                    tag is what says a row is not theirs. */}
                                <span className="hidden text-[10.5px] tracking-[0.12em] whitespace-nowrap text-mute uppercase sm:block">
                                    {isGlobalCategory(category)
                                        ? ""
                                        : t("yoursTag")}
                                </span>

                                <div className="flex items-center justify-self-end">
                                    {isGlobalCategory(category) ? null : (
                                        <span className="flex items-center gap-4">
                                            <Button
                                                variant="quiet"
                                                onClick={() => {
                                                    setEditing(category.id);
                                                    setDeleting(null);
                                                }}
                                            >
                                                {tCommon("edit")}
                                            </Button>
                                            <Button
                                                variant="quiet"
                                                onClick={() => {
                                                    setDeleting(category.id);
                                                    setEditing(null);
                                                }}
                                                className="hover:border-red hover:text-red"
                                            >
                                                {tCommon("delete")}
                                            </Button>
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <DeleteCategoryDialog
                category={queued}
                onClose={() => setDeleting(null)}
            />
        </>
    );
}

/**
 * A row being edited: the name, the colour, and the two ways out.
 *
 * The colour row is the same picker the account forms use, on the design's own
 * five category swatches. The design's inline editor draws those five and
 * nothing else, which would leave a category created on a custom colour with
 * no swatch selected and no way back to the colour it already has — so the
 * chip that opens the full range comes along too, exactly as the new-category
 * form draws it.
 */
function CategoryEditRow({
    category,
    all,
    onDone,
}: {
    category: Category;
    all: Category[];
    onDone: () => void;
}) {
    const t = useTranslations("categoryList");
    const tCategories = useTranslations("categories");
    const tCommon = useTranslations("common");

    const update = useUpdateCategory();

    const [name, setName] = useState(category.name);
    const [color, setColor] = useState(category.hexColor);
    const [error, setError] = useState<string | null>(null);

    function edit<T>(set: (value: T) => void) {
        return (value: T) => {
            set(value);
            setError(null);
        };
    }

    function submit(event: React.FormEvent) {
        event.preventDefault();
        // Enter in the field submits even while the button is disabled.
        if (update.isPending) return;

        const trimmed = name.trim();
        if (!trimmed) {
            setError(t("errName"));
            return;
        }
        if (categoryNameTaken(trimmed, all, tCategories, category.id)) {
            setError(t("errDupe"));
            return;
        }

        update.mutate(
            {
                categoryId: category.id,
                // `icon` is left out rather than resent: the update is partial,
                // and this screen has no icon to write. See DEFAULT_CATEGORY_ICON.
                payload: { name: trimmed, hexColor: color },
            },
            {
                onSuccess: onDone,
                onError: (cause) =>
                    setError(
                        cause instanceof ApiError
                            ? cause.message
                            : t("updateFailed"),
                    ),
            },
        );
    }

    return (
        <form
            onSubmit={submit}
            noValidate
            className="flex flex-col gap-[18px] px-4 pt-5 pb-6"
        >
            <label className="flex items-baseline gap-4">
                <span className="shrink-0 basis-[76px] text-[11px] tracking-[0.1em] text-mute uppercase">
                    {t("name")}
                </span>
                <Input
                    autoFocus
                    autoComplete="off"
                    required
                    maxLength={64}
                    placeholder={t("nameHint")}
                    value={name}
                    onChange={(event) => edit(setName)(event.target.value)}
                    className="max-w-[380px] text-[19px]"
                />
            </label>

            {/* Swatches are buttons, so this row is a div: a label wrapping
                them would swallow the click. */}
            <div className="flex items-center gap-4">
                <span className="shrink-0 basis-[76px] text-[11px] tracking-[0.1em] text-mute uppercase">
                    {t("color")}
                </span>
                <ColorField
                    value={color}
                    swatches={CATEGORY_SWATCHES}
                    onChange={edit(setColor)}
                />
            </div>

            {/* Indented past the label column, so the buttons line up with the
                fields they belong to rather than with the labels. */}
            <div className="flex flex-wrap items-center gap-[18px] pl-0 sm:pl-[92px]">
                <Button type="submit" size="sm" disabled={update.isPending}>
                    {tCommon("save")}
                </Button>
                <Button
                    type="button"
                    variant="quiet"
                    disabled={update.isPending}
                    onClick={onDone}
                >
                    {tCommon("cancel")}
                </Button>
                <span role="status" className="text-xs text-red">
                    {error ?? ""}
                </span>
            </div>
        </form>
    );
}

/**
 * The delete confirmation.
 *
 * It reports what will survive rather than what will go: the API soft-deletes
 * the row and leaves every `category_id` pointing at it, so entries recorded
 * under the category keep their history and simply stop naming a category the
 * pickers list. The count comes off the list read — see `Category.transactions`
 * — and the note is left out entirely when there is nothing to reassure about.
 */
function DeleteCategoryDialog({
    category,
    onClose,
}: {
    /** The category queued for deletion, or null when the dialog is closed. */
    category: Category | null;
    onClose: () => void;
}) {
    const t = useTranslations("categoryList");
    const tCommon = useTranslations("common");

    const remove = useDeleteCategory();

    return (
        <Dialog
            open={category !== null}
            onOpenChange={(open) => {
                if (open) return;
                // The outcome described the category being closed on, so it
                // must not still be on the screen when the next one opens.
                remove.reset();
                onClose();
            }}
        >
            <DialogContent className="max-w-[420px] px-6 pt-[22px] pb-5">
                <DialogTitle className="text-[21px] font-medium tracking-[-0.015em] text-ink normal-case">
                    {category?.name ?? ""}
                </DialogTitle>

                <p className="mt-[10px] text-[13.5px] leading-[1.5] text-pretty text-mute">
                    {t("deleteAsk")}
                </p>

                {category && category.transactions > 0 ? (
                    <p className="mt-3 border-l border-rule pl-3 text-[13px] leading-[1.5] text-pretty text-ink">
                        {t("deleteKeepsEntries", {
                            count: category.transactions,
                        })}
                    </p>
                ) : null}

                <DialogFooter>
                    <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        disabled={remove.isPending}
                        onClick={() => {
                            if (!category) return;
                            remove.mutate(category.id, { onSuccess: onClose });
                        }}
                    >
                        {tCommon("delete")}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={remove.isPending}
                        onClick={onClose}
                    >
                        {tCommon("cancel")}
                    </Button>
                    {remove.isError ? (
                        <span className="text-[13px] text-red">
                            {t("deleteFailed")}
                        </span>
                    ) : null}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/**
 * The list before it lands.
 *
 * It draws the ten global categories, because those are the ten every response
 * opens with — so this is not a guess at a shape, it is the shape, and the
 * user's own rows are the only part that arrives unknown.
 *
 * Every measurement is the real row's rather than a skeleton's own: the same
 * grid and columns, the same padding, and a line box at the name's own leading
 * so a row is the same 54px before and after the read. A bar sized to the
 * label it stands in for — `ch` against the name's own type — means the rows
 * do not visibly re-flow either, in whichever language the labels are set.
 */
export function CategoryListFallback() {
    const t = useTranslations("categories");

    return (
        <div
            className="no-scrollbar min-h-0 flex-[0_1_auto] overflow-y-auto overscroll-contain border-t border-rule"
            aria-hidden
        >
            {GLOBAL_CATEGORY_SLUGS.map((slug, index) => (
                <div
                    key={slug}
                    className={cn(
                        "border-b",
                        index === GLOBAL_CATEGORY_SLUGS.length - 1
                            ? "border-rule"
                            : "border-rule2",
                    )}
                >
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-5 px-4 py-[15px] sm:grid-cols-[minmax(0,1fr)_150px_168px]">
                        <div className="flex min-w-0 items-center gap-[14px]">
                            <Skeleton className="size-3 flex-none rounded-full bg-rule2" />
                            {/* `h-6` is `text-base`'s line box, which is what
                                sets the height of the row this stands in for.
                                Without it every rule sits 6px above where it
                                lands, and the whole list steps down when the
                                names arrive. */}
                            <span className="flex h-6 min-w-0 items-center">
                                <Skeleton
                                    className="h-[15px] max-w-full bg-rule2"
                                    style={{
                                        width: `${(t.has(slug) ? t(slug) : slug).length}ch`,
                                    }}
                                />
                            </span>
                        </div>

                        {/* A global row carries neither the tag nor the
                            actions, so both columns are held open and empty —
                            exactly as they are once the read lands. */}
                        <span className="hidden sm:block" />
                        <span />
                    </div>
                </div>
            ))}
        </div>
    );
}
