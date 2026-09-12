import {
    Bad_Script,
    Gentium_Book_Plus,
    Instrument_Sans,
    JetBrains_Mono,
} from "next/font/google";

/**
 * The four roles the design uses, and nothing else:
 *
 *   script  the wordmark in the sidebar, once per page
 *   serif   every heading
 *   sans    body copy, labels, form controls
 *   mono    every number, and every all-caps micro-label
 *
 * Each is exposed as a CSS variable and wired into Tailwind's font scale in
 * `globals.css`, so swapping a family is a one-line change there.
 *
 * Caveat: Instrument Sans ships latin and latin-ext only — it has no Cyrillic.
 * Ukrainian body copy therefore renders in the fallback stack below. The serif,
 * mono and script faces all carry Cyrillic, so headings and figures are
 * unaffected.
 */

export const fontSans = Instrument_Sans({
    variable: "--font-instrument-sans",
    subsets: ["latin", "latin-ext"],
    display: "swap",
    fallback: ["Helvetica Neue", "Helvetica", "Arial", "sans-serif"],
});

export const fontSerif = Gentium_Book_Plus({
    variable: "--font-gentium",
    subsets: ["latin", "latin-ext", "cyrillic"],
    weight: ["400", "700"],
    style: ["normal", "italic"],
    display: "swap",
    fallback: ["Georgia", "Times New Roman", "serif"],
});

export const fontMono = JetBrains_Mono({
    variable: "--font-jetbrains-mono",
    subsets: ["latin", "latin-ext", "cyrillic"],
    display: "swap",
    fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
});

export const fontScript = Bad_Script({
    variable: "--font-bad-script",
    subsets: ["latin", "latin-ext", "cyrillic"],
    weight: "400",
    display: "swap",
    fallback: ["Brush Script MT", "cursive"],
});

export const fontVariables = [
    fontSans.variable,
    fontSerif.variable,
    fontMono.variable,
    fontScript.variable,
].join(" ");
