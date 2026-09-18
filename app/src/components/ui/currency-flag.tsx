import Image from "next/image";
import { cn } from "cn";

import { currencyInfo } from "@/lib/money";

/**
 * The flag that stands beside a currency code.
 *
 * The files are the `flag-icons` set the first app carried, kept under
 * `public/images/currencies` and named by *currency* rather than by country, so
 * the code the API sends is the whole lookup. A code the app does not carry
 * draws nothing rather than a broken image.
 *
 * Two details are not decoration: the hairline, because half of Poland's flag
 * is white and would otherwise dissolve into the page; and `unoptimized`,
 * because the image pipeline refuses SVG unless `dangerouslyAllowSVG` is set,
 * and a 250-byte flag has nothing to optimise anyway.
 */
export function CurrencyFlag({
    code,
    className,
}: {
    code: string;
    className?: string;
}) {
    if (!currencyInfo(code)) return null;

    return (
        <Image
            src={`/images/currencies/${code.toLowerCase()}.svg`}
            alt=""
            width={16}
            height={12}
            unoptimized
            className={cn(
                "h-[12px] w-[16px] shrink-0 border border-rule2 object-cover",
                className,
            )}
        />
    );
}
