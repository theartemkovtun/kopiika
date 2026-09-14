import { cn } from "cn";

/**
 * A named gap in the skeleton.
 *
 * It is built out of the design's own parts — a hairline, a micro-label,
 * a muted note — so an unfinished screen still reads as the same document,
 * and so the rules that will hold the real content are already on the page.
 */
export function Placeholder({
    label,
    children,
    className,
}: {
    label: string;
    children?: React.ReactNode;
    className?: string;
}) {
    return (
        <section
            className={cn("border-t border-rule py-11", className)}
            aria-label={label}
        >
            <div className="text-[11px] tracking-[0.14em] text-mute uppercase">
                {label}
            </div>
            {children ? (
                <p className="mt-3 max-w-[56ch] text-[15px] text-pretty text-mute">
                    {children}
                </p>
            ) : null}
        </section>
    );
}
