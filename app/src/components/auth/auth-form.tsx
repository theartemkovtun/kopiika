import { cn } from "cn";

/**
 * The parts every signed-out screen is assembled from, so that four screens
 * that are one column of fields stay one column of fields.
 */

/**
 * A secondary action set as text: "Forgot password?", "← Back", "Resend code".
 * A class rather than a component because half of them are links and half are
 * buttons, and the design draws both the same — muted until hovered, never a
 * chrome of their own. Disabled means the resend countdown is still running.
 */
export const authTextClass =
    "cursor-pointer text-[13px] text-mute transition-colors hover:text-blue disabled:cursor-default disabled:text-rule";

/** The one heading on the screen: the sans in italic, set large. */
export function AuthTitle({ children }: { children: React.ReactNode }) {
    return (
        <h1 className="text-[clamp(34px,4vw,46px)] leading-none font-normal tracking-[-0.02em] italic">
            {children}
        </h1>
    );
}

/** A line of muted prose under the heading, where a screen needs one. */
export function AuthNote({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-[13.5px] leading-[1.55] text-pretty text-mute">
            {children}
        </p>
    );
}

/** The column itself. Every gap on these screens is the same 22px. */
export function AuthForm({
    onSubmit,
    children,
}: {
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
    children: React.ReactNode;
}) {
    return (
        <form
            onSubmit={onSubmit}
            noValidate
            className="mt-[30px] flex flex-col gap-[22px]"
        >
            {children}
        </form>
    );
}

export type AuthOutcome = { kind: "ok" | "error"; text: string } | null;

/**
 * What the last attempt came to, in the one place the design puts it: just
 * above the submit button, green for done and red for not. Announced rather
 * than silently swapped, since it is often the only thing that changed.
 */
export function AuthMessage({ outcome }: { outcome: AuthOutcome }) {
    if (!outcome) return null;

    return (
        <p
            role="status"
            aria-live="polite"
            className={cn(
                "text-[13px] leading-[1.5]",
                outcome.kind === "ok" ? "text-green" : "text-red",
            )}
        >
            {outcome.text}
        </p>
    );
}

/** The hairline-and-word divider above the Google button. */
export function AuthDivider({ label }: { label: string }) {
    return (
        <div className="flex items-center gap-[14px]">
            <span className="h-px flex-1 bg-rule" />
            <span className="text-[10px] tracking-[0.14em] text-mute uppercase">
                {label}
            </span>
            <span className="h-px flex-1 bg-rule" />
        </div>
    );
}
