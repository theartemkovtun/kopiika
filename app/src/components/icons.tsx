import type { SVGProps } from "react";

/**
 * The icons the design draws itself, at the two weights it uses:
 *
 *   24px box, 1.6 stroke — chrome (theme toggle, settings)
 *   16px box, 1.2 stroke — controls inside a panel (edit, delete, close)
 *
 * They are kept here rather than pulled from an icon set because the hairline
 * weights are what let them sit on the same optical line as the rules; a
 * heavier stock icon reads as a button in a layout that has none.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function LineIcon({
    size = 17,
    strokeWidth = 1.6,
    viewBox = "0 0 24 24",
    children,
    ...props
}: IconProps & { children: React.ReactNode }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox={viewBox}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            {...props}
        >
            {children}
        </svg>
    );
}

export function MoonIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z" />
        </LineIcon>
    );
}

export function SunIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <path d="M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" />
            <path d="M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7" />
        </LineIcon>
    );
}

export function GearIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z" />
            <path d="M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
        </LineIcon>
    );
}

export function EditIcon(props: IconProps) {
    return (
        <LineIcon size={15} strokeWidth={1.2} viewBox="0 0 16 16" {...props}>
            <path d="M3 13h3l7-7-3-3-7 7z" />
            <path d="M2.5 14.5h5" />
        </LineIcon>
    );
}

export function TrashIcon(props: IconProps) {
    return (
        <LineIcon size={15} strokeWidth={1.2} viewBox="0 0 16 16" {...props}>
            <path d="M4 5h8v9H4z" />
            <path d="M2 5h12" />
            <path d="M6.5 3h3" />
        </LineIcon>
    );
}

export function CloseIcon(props: IconProps) {
    return (
        <LineIcon size={15} strokeWidth={1.2} viewBox="0 0 16 16" {...props}>
            <path d="M3.5 3.5l9 9" />
            <path d="M12.5 3.5l-9 9" />
        </LineIcon>
    );
}

export function MenuIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <path d="M4 7h16" />
            <path d="M4 12h16" />
            <path d="M4 17h16" />
        </LineIcon>
    );
}

/**
 * The Google mark, and the only thing in the app that is neither a hairline nor
 * the ink colour: it is a brand asset, so it is reproduced as Google publishes
 * it rather than restyled to the rules around it. The four-colour mark is the
 * one Google's guidelines allow on both a light and a dark button surface,
 * which is what the theme toggle demands of it.
 */
export function GoogleIcon({ size = 16, ...props }: IconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 48 48"
            aria-hidden
            {...props}
        >
            <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
            />
            <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
            />
            <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
            />
            <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
            />
        </svg>
    );
}
