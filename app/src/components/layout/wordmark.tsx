import { useTranslations } from "next-intl";
import { cn } from "cn";

import { Link } from "@/i18n/navigation";

/**
 * The wordmark, and the only script type in the app. The full stop is set in
 * the emphasis colour: it is the one flourish the design allows itself, and it
 * is also the link back to the Overview.
 *
 * `asLink={false}` for the signed-out screens, where the Overview is not
 * reachable and the link would only bounce off the auth middleware and land
 * back where it started.
 */
export function Wordmark({
    className,
    asLink = true,
}: {
    className?: string;
    asLink?: boolean;
}) {
    const t = useTranslations("app");

    const content = (
        <>
            {t("name")}
            <span className="text-blue">.</span>
        </>
    );

    const classes = cn(
        "font-script leading-[1.1] text-ink transition-colors",
        className,
    );

    if (!asLink) return <span className={classes}>{content}</span>;

    return (
        <Link href="/" className={classes}>
            {content}
        </Link>
    );
}
