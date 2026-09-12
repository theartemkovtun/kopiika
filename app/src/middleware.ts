import { chain } from "./middlewares/chain";
import { withAuthMiddleware } from "./middlewares/auth";
import { withLocaleMiddleware } from "./middlewares/locale";

// Locale first: the auth link needs the resolved locale to redirect into.
export const middleware = chain([withLocaleMiddleware, withAuthMiddleware]);

export const config = {
    matcher: [
        "/((?!api|_next/static|_next/image|favicon.ico|images|fonts|.*\\..*).*)",
    ],
};
