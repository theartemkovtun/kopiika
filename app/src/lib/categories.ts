import type { Category } from "@/api/types";

/**
 * Category names.
 *
 * The API seeds ten global categories whose `name` is a slug — `food`,
 * `transportation` — and those are the ten the dictionary translates. A
 * category a user creates carries the name they typed, in the language they
 * typed it, so it is shown as written rather than looked up.
 *
 * The id is what separates them: the seed reserves 1..11 and the sequence
 * starts above that, so no user-owned row can land inside the global range.
 */
export const LAST_GLOBAL_CATEGORY_ID = 10;

export function isGlobalCategory(category: Category): boolean {
    return category.id <= LAST_GLOBAL_CATEGORY_ID;
}

/** `t` is the `categories` translator. */
export function categoryLabel(
    category: Category,
    t: (key: string) => string,
): string {
    return isGlobalCategory(category) ? t(category.name) : category.name;
}
