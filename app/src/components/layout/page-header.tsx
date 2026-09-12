import { cn } from "cn";

/**
 * The page title block.
 *
 * The heading is set very large and very light — 400 weight at up to 72px — and
 * leads at 0.95, so it reads as a plate rather than as a shout. The subtitle is
 * the same serif in italic: it is an aside to the title, not a second label.
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
                <h1 className="font-serif text-[clamp(40px,6vw,72px)] leading-[0.95] font-normal tracking-[-0.02em]">
                    {title}
                </h1>
                {subtitle ? (
                    <div className="mt-[10px] font-serif text-xl text-mute italic">
                        {subtitle}
                    </div>
                ) : null}
            </div>
            {actions ? <div className="ml-auto">{actions}</div> : null}
        </div>
    );
}
