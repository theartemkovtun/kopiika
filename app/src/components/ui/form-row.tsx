import { cn } from "cn";

/**
 * One ruled form row: a fixed-width micro-label on the left, the control filling
 * the rest, a hairline underneath. It is what both forms in the app are built
 * out of — the design has no boxed fields anywhere, only rows.
 *
 * `asLabel` makes the whole row a `<label>`, which is right for a plain input
 * and wrong for a Radix trigger — a trigger is a button, and wrapping it would
 * swallow the click.
 *
 * The label column is 92px of text plus a 24px gutter, which is what the entry
 * form measures. The new-account form's labels are longer and its rows are
 * drawn to 108px *including* the gutter, so it overrides both halves through
 * `labelClassName`.
 */
export function FormRow({
    label,
    required = false,
    asLabel = false,
    className,
    labelClassName,
    children,
}: {
    label: string;
    required?: boolean;
    asLabel?: boolean;
    className?: string;
    labelClassName?: string;
    children: React.ReactNode;
}) {
    const Row = asLabel ? "label" : "div";

    return (
        <Row
            className={cn(
                "flex items-baseline border-b border-b-rule2 py-[14px]",
                className,
            )}
        >
            <span
                className={cn(
                    "box-content shrink-0 basis-[92px] pr-6 text-[11px] tracking-[0.1em] text-mute uppercase",
                    labelClassName,
                )}
            >
                {label}
                {required ? (
                    <span aria-hidden className="text-red">
                        *
                    </span>
                ) : null}
            </span>
            <div className="flex min-w-0 flex-1">{children}</div>
        </Row>
    );
}
