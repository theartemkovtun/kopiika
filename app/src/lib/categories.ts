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

/**
 * The global categories' slugs, in the order the seed gives them ids — so this
 * list is what `GET /v1/categories` answers with above `LAST_GLOBAL_CATEGORY_ID`
 * before any of the user's own.
 *
 * It exists for the loading state alone, which is the one place a category has
 * to be drawn before the read has come back. Nothing else should reach for it:
 * the list on the screen is the API's, not this, and the two have drifted
 * before — a slug the API adds simply leaves the skeleton one row short, which
 * is the right way for a guess to be wrong.
 */
export const GLOBAL_CATEGORY_SLUGS = [
    "food",
    "transportation",
    "entertainment",
    "education",
    "health",
    "house",
    "savings",
    "charity",
    "clothing",
    "other",
] as const;

export function isGlobalCategory(category: Category): boolean {
    return category.id <= LAST_GLOBAL_CATEGORY_ID;
}

/**
 * The `categories` translator, plus the `has` next-intl hangs off it — which
 * is what lets a label fall back rather than throw.
 */
export type CategoryTranslator = ((key: string) => string) & {
    has: (key: string) => boolean;
};

/**
 * What to draw a category as.
 *
 * A global row's `name` is a slug the dictionary translates; a user's own is
 * the text they typed, shown as written.
 *
 * The id range is the test, and it is deliberately not the only one. Which
 * slugs the API seeds is the API's business and has drifted from this
 * dictionary before, so a global row whose slug has no entry falls back to the
 * stored name instead of throwing `MISSING_MESSAGE` — an untranslated category
 * is a label to improve, not a screen to take down. `t.has` is the check
 * rather than a try/catch, because next-intl's own missing-message handler
 * still reports it and that report is how the gap gets noticed.
 */
export function categoryLabel(
    category: Category,
    t: CategoryTranslator,
): string {
    if (!isGlobalCategory(category)) return category.name;

    return t.has(category.name) ? t(category.name) : category.name;
}

/**
 * The colour row on a category form: the design's five swatches.
 *
 * Five, not the accounts' six, and a different five — the design gives
 * categories their own preset row. They are the design's `oklch()` values
 * gamut-mapped into sRGB the same way `ACCOUNT_SWATCHES` are, because
 * `hexColor` stores one colour and cannot lighten for the dark theme. The full
 * range behind the `+` chip is shared with accounts; see `ColorField`.
 */
export const CATEGORY_SWATCHES = [
    "#CA564B",
    "#C57C2A",
    "#529E4B",
    "#2C7FD3",
    "#867CCD",
] as const;

/**
 * The swatch the new-category form opens on, cycled by how many the user
 * already owns so the first five differ — the same reasoning as
 * `newAccountColor`, and only a suggestion: the colour is stored on the row.
 *
 * The design opens every new category on the first swatch, which is fine for
 * a mock with three of them and hands a real user five identical red dots.
 */
export function newCategoryColor(existing: number): string {
    const index = Math.max(0, existing) % CATEGORY_SWATCHES.length;
    return CATEGORY_SWATCHES[index];
}

/**
 * `icon` is required by `POST /v1/categories` and there is nowhere in the v9
 * design to choose one — a category is a name and a colour, drawn as a dot.
 * So every category written from here carries the same icon as the API's own
 * `other`, which is the least specific of the ten it ships with. The column
 * stays populated for the older clients that do draw icons.
 */
export const DEFAULT_CATEGORY_ICON = "icon-dots";

/**
 * Whether a name is already in use, ignoring case — the design's "That name is
 * taken."
 *
 * The check lives here rather than in the API, which has no uniqueness
 * constraint on the column. It is compared against what is *on the screen*:
 * the translated label of a global category, and the stored name of one of the
 * user's own. So renaming a category to "Food" collides in English and not in
 * Ukrainian, which is the same rule the list the user is reading goes by.
 *
 * `selfId` is the row being edited, excluded so that saving a category without
 * renaming it does not collide with itself.
 */
export function categoryNameTaken(
    name: string,
    all: Category[],
    t: CategoryTranslator,
    selfId?: number,
): boolean {
    const wanted = name.trim().toLowerCase();

    return all.some(
        (category) =>
            category.id !== selfId &&
            categoryLabel(category, t).toLowerCase() === wanted,
    );
}
