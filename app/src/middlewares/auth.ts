import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";

import { authenticatedUser } from "@/lib/amplify/server";
import { getValidLocale, isSupportedLocale } from "@/lib/locales";
import type { CustomMiddleware } from "./chain";

/** Reachable without a session. Matched on the locale-stripped path. */
const AUTH_ROUTES = [
    "/login",
    "/signup",
    "/totp",
    "/password/reset",
    "/password/forgot",
    "/external-auth",
];

/** Strips a leading locale segment so route matching stays locale-agnostic. */
function splitLocale(pathname: string) {
    const segments = pathname.split("/");
    const maybeLocale = segments[1];

    if (maybeLocale && isSupportedLocale(maybeLocale)) {
        return {
            locale: getValidLocale(maybeLocale),
            path: "/" + segments.slice(2).join("/"),
        };
    }

    return { locale: getValidLocale(undefined), path: pathname };
}

/** Keeps the visitor's locale segment across an auth redirect. */
function redirect(request: NextRequest, locale: string, path: string) {
    const prefix = locale === getValidLocale(undefined) ? "" : `/${locale}`;
    return NextResponse.redirect(new URL(`${prefix}${path}`, request.nextUrl));
}

export function withAuthMiddleware(
    middleware: CustomMiddleware,
): CustomMiddleware {
    return async (
        request: NextRequest,
        event: NextFetchEvent,
        response: NextResponse,
    ) => {
        const currentResponse = response ?? NextResponse.next();
        const { locale, path } = splitLocale(request.nextUrl.pathname);
        const isAuthRoute = AUTH_ROUTES.some((route) => path.startsWith(route));

        const user = await authenticatedUser({
            request,
            response: currentResponse,
        });

        if (user) {
            // Signed in, but standing on a sign-in page.
            if (isAuthRoute) return redirect(request, locale, "/");
            return middleware(request, event, currentResponse);
        }

        if (isAuthRoute) return middleware(request, event, currentResponse);
        return redirect(request, locale, "/login");
    };
}
