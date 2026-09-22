"use client";

import { useTranslations } from "next-intl";
import { cn } from "cn";

import { Input } from "@/components/ui/input";

/**
 * One field on a signed-out screen.
 *
 * The signed-in forms are ruled *rows* — a label column on the left, the
 * control beside it, a hairline under both. These are the same idea stood on
 * end: the micro-label sits above the field and the hairline is the only mark,
 * because the column is 400px wide and a label column inside it would leave
 * the field too narrow to type an email into.
 *
 * The label is a real `<label>` and the trailing control is its sibling rather
 * than its child, so clicking "Show" toggles the password instead of focusing
 * the field. Placeholders are set in `--rule` here, a step lighter than the
 * muted type everywhere else, which is what keeps a hint from reading as a
 * value already entered.
 */
export function AuthField({
    id,
    label,
    note,
    action,
    meter,
    className,
    ...props
}: Omit<React.ComponentProps<typeof Input>, "className" | "children"> & {
    id: string;
    label: string;
    /** Sits beside the label — the sign-up form's password strength. */
    note?: React.ReactNode;
    /** Pushed to the right of the label row — the Show / Hide toggle. */
    action?: React.ReactNode;
    /** Drawn over the field's own hairline — the strength bar. */
    meter?: React.ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "relative flex flex-col gap-[7px] border-b border-rule pb-2",
                className,
            )}
        >
            <div className="flex items-baseline gap-3">
                <label
                    htmlFor={id}
                    className="text-[10px] tracking-[0.12em] text-mute uppercase"
                >
                    {label}
                </label>
                {note}
                {action ? <div className="ml-auto">{action}</div> : null}
            </div>

            <Input id={id} className="py-px placeholder:text-rule" {...props} />

            {meter}
        </div>
    );
}

/** The word that swaps a password field between dots and plain text. */
export function ShowPasswordButton({
    shown,
    onToggle,
}: {
    shown: boolean;
    onToggle: () => void;
}) {
    const t = useTranslations("auth");

    return (
        <button
            type="button"
            onClick={onToggle}
            className="cursor-pointer text-[11px] text-mute transition-colors hover:text-blue"
        >
            {shown ? t("hide") : t("show")}
        </button>
    );
}
