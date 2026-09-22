/**
 * The sidebar, in order. The design numbers the items 01..05 from this order,
 * so inserting one renumbers the rest by itself.
 *
 * `match` is the prefix that lights an item up: /accounts/new belongs to
 * Accounts, and a bare "/" would otherwise match everything, so the Overview
 * is compared exactly.
 */
export const NAV_ITEMS = [
    { id: "overview", href: "/", exact: true },
    { id: "transactions", href: "/transactions", exact: false },
    { id: "accounts", href: "/accounts", exact: false },
    { id: "reports", href: "/reports", exact: false },
    { id: "add", href: "/add", exact: false },
    { id: "categories", href: "/categories", exact: false },
] as const;

export type NavId = (typeof NAV_ITEMS)[number]["id"];

export function isNavActive(
    item: (typeof NAV_ITEMS)[number],
    pathname: string,
): boolean {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
