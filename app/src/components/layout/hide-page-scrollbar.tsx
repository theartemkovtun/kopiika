/**
 * Takes the page's own scrollbar off the screen for as long as the screen that
 * renders it is mounted. The page scrolls exactly as before — wheel, trackpad,
 * keys, drag — it simply stops drawing the rail down the right edge.
 *
 * It renders a marker rather than touching `document`: the rule that answers it
 * lives in `globals.css` as `html:has([data-page-scrollbar="hidden"])`, so the
 * scrollbar is already gone in the first painted frame, and it comes back by
 * the marker leaving the document rather than by a cleanup remembering to.
 */
export function HidePageScrollbar() {
    return <div hidden data-page-scrollbar="hidden" />;
}
