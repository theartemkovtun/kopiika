import type { NextFetchEvent, NextRequest, NextResponse } from "next/server";

export type CustomMiddleware = (
    request: NextRequest,
    event: NextFetchEvent,
    response: NextResponse,
) => NextResponse | Promise<NextResponse>;

type MiddlewareFactory = (middleware: CustomMiddleware) => CustomMiddleware;

/**
 * Runs middlewares in order, threading one response through all of them, so
 * that cookies set by an earlier link (next-intl's locale) survive a later
 * one's rewrite.
 */
export function chain(
    factories: MiddlewareFactory[],
    index = 0,
): CustomMiddleware {
    const current = factories[index];

    if (current) return current(chain(factories, index + 1));

    return (_request, _event, response) => response;
}
