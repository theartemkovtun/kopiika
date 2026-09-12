import { fetchAuthSession } from "aws-amplify/auth";

/**
 * Thin client over kopiika-api-go.
 *
 * The API authenticates with the Cognito **id** token (its middleware checks
 * `token_use` and reads `sub` as the user id), so that is what goes in the
 * Authorization header — not the access token.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/** A non-2xx response, carrying enough to branch on without re-parsing. */
export class ApiError extends Error {
    readonly status: number;
    readonly endpoint: string;
    readonly body: unknown;

    constructor(
        status: number,
        endpoint: string,
        body: unknown,
        message?: string,
    ) {
        super(message ?? `${status} from ${endpoint}`);
        this.name = "ApiError";
        this.status = status;
        this.endpoint = endpoint;
        this.body = body;
    }

    /** True when the session is missing or the API rejected the token. */
    get isUnauthorized() {
        return this.status === 401 || this.status === 403;
    }

    get isNotFound() {
        return this.status === 404;
    }
}

export type QueryValue =
    string | number | boolean | null | undefined | readonly (string | number)[];

export type QueryParams = Record<string, QueryValue>;

/**
 * The API takes repeated keys for id filters — `categoryIds=1&categoryIds=2` —
 * so arrays are expanded rather than joined. Empty and nullish values are
 * dropped so a cleared filter does not become `?search=`.
 */
function buildQuery(params: QueryParams | undefined): string {
    if (!params) return "";

    const search = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === "") continue;

        if (Array.isArray(value)) {
            for (const item of value) search.append(key, String(item));
        } else {
            search.append(key, String(value));
        }
    }

    const query = search.toString();
    return query ? `?${query}` : "";
}

async function authHeader(): Promise<Record<string, string>> {
    try {
        const session = await fetchAuthSession();
        const token = session.tokens?.idToken?.toString();
        return token ? { Authorization: `Bearer ${token}` } : {};
    } catch {
        // No session yet. Let the request go out unauthenticated and surface
        // the API's own 401, so there is one path for "not signed in".
        return {};
    }
}

type RequestOptions = {
    query?: QueryParams;
    body?: unknown;
    auth?: boolean;
    signal?: AbortSignal;
};

async function request<T>(
    method: string,
    endpoint: string,
    { query, body, auth = true, signal }: RequestOptions = {},
): Promise<T> {
    const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const url = `${BASE_URL}${path}${buildQuery(query)}`;

    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (auth) Object.assign(headers, await authHeader());

    const response = await fetch(url, {
        method,
        headers,
        signal,
        body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!response.ok) {
        // Errors come back as {"error": "..."}, but a proxy or a gateway in
        // front of the API may not, so the parse is allowed to fail.
        const payload = await response.json().catch(() => null);
        const message =
            payload &&
            typeof payload === "object" &&
            typeof (payload as { error?: unknown }).error === "string"
                ? (payload as { error: string }).error
                : undefined;

        throw new ApiError(response.status, path, payload, message);
    }

    // 204 on every delete, and on nothing else.
    if (response.status === 204) return undefined as T;

    return (await response.json()) as T;
}

export const api = {
    get: <T>(endpoint: string, options?: Omit<RequestOptions, "body">) =>
        request<T>("GET", endpoint, options),
    post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
        request<T>("POST", endpoint, { ...options, body }),
    put: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
        request<T>("PUT", endpoint, { ...options, body }),
    patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
        request<T>("PATCH", endpoint, { ...options, body }),
    delete: <T = void>(endpoint: string, options?: RequestOptions) =>
        request<T>("DELETE", endpoint, options),
};
