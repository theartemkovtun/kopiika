import { Bad_Script, Google_Sans } from "next/font/google";

/**
 * Two faces, which is all the design uses:
 *
 *   script  the wordmark in the sidebar, once per page
 *   sans    everything else
 *
 * The design used to spread four families across four roles — a serif for
 * headings, a monospace for every figure, a third face for body copy. It now
 * carries one: a heading is the sans in *italic*, and a figure is the sans with
 * tabular figures, which `globals.css` asks for on <html> so that a column of
 * amounts lines up without any element naming a family of its own.
 *
 * Google Sans is loaded in both styles because the italic is a heading weight
 * here, not an emphasis — synthesising it would slant the figures too.
 *
 * It also carries Cyrillic, which closes the gap the four-family set had:
 * Instrument Sans shipped latin only, so Ukrainian body copy fell through to
 * the fallback stack while the headings and figures did not.
 */

export const fontSans = Google_Sans({
    variable: "--font-google-sans",
    subsets: ["latin", "latin-ext", "cyrillic"],
    style: ["normal", "italic"],
    display: "swap",
    fallback: ["Helvetica Neue", "Helvetica", "Arial", "sans-serif"],
});

export const fontScript = Bad_Script({
    variable: "--font-bad-script",
    subsets: ["latin", "latin-ext", "cyrillic"],
    weight: "400",
    display: "swap",
    fallback: ["Brush Script MT", "cursive"],
});

export const fontVariables = [fontSans.variable, fontScript.variable].join(" ");
