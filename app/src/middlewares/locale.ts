import createMiddleware from "next-intl/middleware";
import type { NextFetchEvent, NextRequest, NextResponse } from "next/server";

import { routing } from "@/i18n/routing";
import type { CustomMiddleware } from "./chain";

const intlMiddleware = createMiddleware(routing);

export function withLocaleMiddleware(
    middleware: CustomMiddleware,
): CustomMiddleware {
    return async (
        request: NextRequest,
        event: NextFetchEvent,
        response: NextResponse,
    ) => {
        const intlResponse = intlMiddleware(request);

        // A locale redirect is terminal: there is no point authenticating a
        // URL the browser is about to leave.
        if (intlResponse.status === 307 || intlResponse.status === 308) {
            return intlResponse;
        }

        return middleware(request, event, intlResponse ?? response);
    };
}
