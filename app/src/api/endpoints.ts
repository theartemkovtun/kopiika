import { api } from "./client";
import type {
    Account,
    AccountsBalance,
    Category,
    ConfigureUserPayload,
    CreateAccountPayload,
    CreateCategoryPayload,
    CreateTransactionPayload,
    DateTransactions,
    ListTransactionsQuery,
    Paginated,
    StatisticsQuery,
    Transaction,
    TransactionsConfiguration,
    TransactionsStatistics,
    UpdateTransactionPayload,
    UpdateUserPayload,
    User,
} from "./types";

/**
 * Every call kopiika-api-go exposes, in the order `src/api/v1/routes.go`
 * registers them. Nothing here holds state — react-query owns caching, and the
 * key factory below is what the hooks hang their caches off.
 */

export const users = {
    /** `profile` costs a call out to the user pool, so it is opt-in. */
    me: (profile = false) =>
        api.get<User>("/v1/users/me", { query: { profile } }),

    /** Creates the local row on first sign-in. Idempotent. */
    setup: (payload: ConfigureUserPayload = {}) =>
        api.post<User>("/v1/users", payload),

    update: (payload: UpdateUserPayload) =>
        api.put<User>("/v1/users/me", payload),
};

export const accounts = {
    list: (page = 1, take = 100) =>
        api.get<Paginated<Account>>("/v1/accounts", { query: { page, take } }),

    /** Every account plus their combined worth in the user's own currency. */
    balance: () => api.get<AccountsBalance>("/v1/accounts/balance"),

    get: (accountId: string) => api.get<Account>(`/v1/accounts/${accountId}`),

    create: (payload: CreateAccountPayload) =>
        api.post<Account>("/v1/accounts", payload),

    remove: (accountId: string) => api.delete(`/v1/accounts/${accountId}`),
};

export const categories = {
    /** The user's own categories plus the global defaults. Unpaginated. */
    list: () => api.get<Category[]>("/v1/categories"),

    create: (payload: CreateCategoryPayload) =>
        api.post<Category>("/v1/categories", payload),

    remove: (categoryId: number) => api.delete(`/v1/categories/${categoryId}`),
};

export const transactions = {
    /** Paged by day: `total` counts days, and one page holds any number of rows. */
    list: ({ page = 1, take = 10, ...filters }: ListTransactionsQuery = {}) =>
        api.get<Paginated<DateTransactions>>("/v1/transactions", {
            query: { page, take, ...filters },
        }),

    latest: (limit = 10) =>
        api.get<Transaction[]>("/v1/transactions/latest", { query: { limit } }),

    /** Categories and accounts for the entry form, in one response. */
    configuration: () =>
        api.get<TransactionsConfiguration>("/v1/transactions/configuration"),

    statistics: ({ fromDate, toDate, full = false }: StatisticsQuery) =>
        api.get<TransactionsStatistics>("/v1/transactions/statistics", {
            query: { fromDate, toDate, full },
        }),

    /** `date` is YYYY-MM-DD. */
    byDate: (date: string) =>
        api.get<DateTransactions>(`/v1/transactions/date/${date}`),

    get: (transactionId: string) =>
        api.get<Transaction>(`/v1/transactions/${transactionId}`),

    create: (payload: CreateTransactionPayload) =>
        api.post<Transaction>("/v1/transactions", payload),

    /** The id is in the body, and the date cannot be changed. */
    update: (payload: UpdateTransactionPayload) =>
        api.put<Transaction>("/v1/transactions", payload),

    remove: (transactionId: string) =>
        api.delete(`/v1/transactions/${transactionId}`),
};

/**
 * react-query keys. Prefixes nest, so invalidating `queryKeys.transactions.all`
 * clears every list, page and statistics range underneath it.
 */
export const queryKeys = {
    user: ["user"] as const,

    accounts: {
        all: ["accounts"] as const,
        list: (page: number, take: number) =>
            ["accounts", "list", page, take] as const,
        balance: () => ["accounts", "balance"] as const,
        detail: (id: string) => ["accounts", "detail", id] as const,
    },

    categories: {
        all: ["categories"] as const,
        list: () => ["categories", "list"] as const,
    },

    transactions: {
        all: ["transactions"] as const,
        list: (query: ListTransactionsQuery) =>
            ["transactions", "list", query] as const,
        latest: (limit: number) => ["transactions", "latest", limit] as const,
        configuration: () => ["transactions", "configuration"] as const,
        statistics: (query: StatisticsQuery) =>
            ["transactions", "statistics", query] as const,
        byDate: (date: string) => ["transactions", "date", date] as const,
        detail: (id: string) => ["transactions", "detail", id] as const,
    },
} as const;
