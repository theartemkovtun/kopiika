/**
 * Wire types for kopiika-api-go.
 *
 * These mirror `src/schemas/*.go` one for one. Two conventions carry over from
 * the Go side and are easy to trip over:
 *
 *  - Every monetary figure is a **string**, not a number. The API uses
 *    shopspring/decimal, which marshals quoted, so that no amount is ever put
 *    through a float. Parse at the edge with `toNumber` in `@/lib/money`,
 *    never with a bare `Number(...)` scattered through a component.
 *  - Currency codes are **lower case** everywhere (`uah`, `usd`). That is what
 *    the rates table holds and what the API expects to be sent.
 */

/** A monetary value and the currency it is denominated in. */
export type Amount = {
    /** Decimal, serialized as a string. */
    value: string;
    /** ISO 4217, lower case. */
    currency: string;
};

export type Paginated<T> = {
    total: number;
    page: number;
    take: number;
    items: T[];
};

// --- users -----------------------------------------------------------------

export type UserProfile = {
    email: string;
    name: string | null;
    picture: string | null;
    /** The federated identity signed in through; null for a password sign-up. */
    externalProvider: string | null;
};

export type User = {
    id: string;
    language: string;
    currency: string;
    name: string;
    pictureUrl: string | null;
    /** Present only when the request asked for it — it costs a user-pool call. */
    profile?: UserProfile;
};

export type UpdateUserPayload = {
    language?: string;
    currency?: string;
};

export type ConfigureUserPayload = {
    /** Picks the language and currency the new user starts with. */
    countryCode?: string;
};

// --- accounts --------------------------------------------------------------

export type Account = {
    id: string;
    name: string;
    description: string | null;
    colorHex: string;
    amount: Amount;
    /** `amount` converted into the user's own currency, so accounts total. */
    localizedAmount: Amount;
};

/** An account without its balance, as embedded in another resource. */
export type AccountBase = {
    id: string;
    name: string;
    description: string | null;
    currency: string;
    colorHex: string;
};

export type AccountsBalance = {
    total: Amount;
    accounts: Account[];
};

export type CreateAccountPayload = {
    name: string;
    description?: string | null;
    colorHex: string;
    currency: string;
    defaultValue?: string | null;
};

/**
 * Currency and balance are absent on purpose — the API treats currency as an
 * invariant every posted transaction relies on, and balance only ever moves
 * through transaction posting, never a direct write.
 */
export type UpdateAccountPayload = {
    name?: string;
    description?: string | null;
    colorHex?: string;
};

// --- categories ------------------------------------------------------------

export type Category = {
    id: number;
    name: string;
    icon: string;
    /** Spelled `hexColor` here and `colorHex` on accounts — the API's shape. */
    hexColor: string;
};

export type CreateCategoryPayload = {
    name: string;
    icon: string;
    hexColor: string;
};

// --- transactions ----------------------------------------------------------

export type TransactionType = "income" | "outcome";

export type Transaction = {
    id: string;
    /** YYYY-MM-DD. */
    date: string;
    type: TransactionType;
    title: string;
    description: string | null;
    amount: Amount;
    /** Converted at the rate for the transaction's own date, not today's. */
    localizedAmount: Amount;
    category: Category | null;
    account: AccountBase | null;
    /** Always empty: tags are not ported yet. */
    tags: string[];
};

/** One day's transactions. The list endpoint pages over days, not over rows. */
export type DateTransactions = {
    date: string;
    transactions: Transaction[];
};

export type TransactionsConfiguration = {
    categories: Category[];
    accounts: AccountBase[];
    tags: string[];
};

export type CreateTransactionPayload = {
    type: TransactionType;
    title: string;
    value: string;
    currency: string;
    description?: string | null;
    categoryId?: number | null;
    accountId?: string | null;
    year: number;
    /** 1-indexed, unlike a JS Date. */
    month: number;
    day: number;
};

/**
 * The id travels in the body rather than the path, which is how the endpoint is
 * shaped. Every field is replaced: an omitted description, category or account
 * clears the stored one, and the date cannot be changed at all.
 */
export type UpdateTransactionPayload = {
    id: string;
    type: TransactionType;
    title: string;
    value: string;
    currency: string;
    description?: string | null;
    categoryId?: number | null;
    accountId?: string | null;
};

export type ListTransactionsQuery = {
    page?: number;
    /** Days per page, not rows per page. */
    take?: number;
    type?: TransactionType;
    search?: string;
    fromDate?: string;
    toDate?: string;
    categoryIds?: number[];
    accountIds?: string[];
};

// --- statistics ------------------------------------------------------------

/** One day of the range. Days with no activity are included, as zeroes. */
export type DateStatistics = {
    date: string;
    income: Amount;
    outcome: Amount;
};

/**
 * A monetary figure alongside how much it moved against the comparable
 * period immediately before the requested range. Positive means it grew.
 */
export type AmountWithPreviousPeriodDiff = Amount & {
    previousPeriodDiff: string;
};

export type CategoryStatistics = Category & {
    localizedAmount: Amount;
};

export type CategoryTransactionCount = Category & {
    totalTransactions: number;
};

export type AccountStatistics = AccountBase & {
    localizedAmount: Amount;
};

export type AccountTransactionCount = AccountBase & {
    totalTransactions: number;
};

/**
 * Everything below `categoryOutcomeStatistics` is populated only when the
 * request asks for `full`; otherwise those fields hold zero values, which is
 * what keeps the response shape constant.
 */
export type TransactionsStatistics = {
    income: AmountWithPreviousPeriodDiff;
    outcome: AmountWithPreviousPeriodDiff;
    difference: AmountWithPreviousPeriodDiff;
    /** Every day in the range, oldest first. */
    rangeStatistics: DateStatistics[];
    /** Largest first. Uncategorised spending is left out, not pooled. */
    categoryOutcomeStatistics: CategoryStatistics[];

    totalTransactions: number;
    incomeTransactions: number;
    outcomeTransactions: number;
    /** A rate, not a count, and a string like every other number here. */
    transactionsPerDay: string;

    minIncome: Transaction | null;
    maxIncome: Transaction | null;
    averageIncome: Amount;

    minOutcome: Transaction | null;
    maxOutcome: Transaction | null;
    averageOutcome: Amount;

    categoryOutcomeTransactions: CategoryTransactionCount[];
    accountOutcomeStatistics: AccountStatistics[];
    accountOutcomeTransactions: AccountTransactionCount[];
};

export type StatisticsQuery = {
    fromDate: string;
    toDate: string;
    /** Asks for the expensive half of the response. */
    full?: boolean;
};
