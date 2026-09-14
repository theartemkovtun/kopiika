import { cn } from "cn";

/**
 * The page title block.
 *
 * The heading is set very large, very light and *italic* — 400 weight at up to
 * 66px — and leads at 0.95, so it reads as a plate rather than as a shout. The
 * italic is the design's whole heading treatment now that there is one family:
 * it is what a heading is, not emphasis laid over one. The subtitle is the
 * same, smaller and muted: an aside to the title, not a second label.
 *
 * Two screens deliberately have no header at all. The ledger opens straight
 * into its rows, and Accounts opens on the total balance, because on both the
 * first number *is* the title.
 */
export function PageHeader({
    title,
    subtitle,
    actions,
    className,
}: {
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    actions?: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn("flex flex-wrap items-end gap-6", className)}>
            <div>
                <h1 className="text-[clamp(44px,5.4vw,66px)] leading-[0.95] font-normal tracking-[-0.02em] italic">
                    {title}
                </h1>
                {subtitle ? (
                    <div className="mt-2 text-base text-mute italic">
                        {subtitle}
                    </div>
                ) : null}
            </div>
            {actions ? <div className="ml-auto">{actions}</div> : null}
        </div>
    );
}
