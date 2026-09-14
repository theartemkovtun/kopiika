"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "cn";

import { CloseIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ACCOUNT_SWATCHES } from "@/lib/accounts";
import { normalizeHexColor } from "@/lib/charts";

/**
 * The colour row on an account form: the six presets, then a chip that opens
 * the whole range.
 *
 * The chip is the current colour when that colour is a custom one and a `+`
 * outline when it is one of the presets — so the row always shows the chosen
 * colour somewhere, and never twice.
 *
 * **The grid is stored, not just shown.** The design paints its picker in
 * `oklch()`, which the `colorHex` column cannot hold; these are the same
 * swatches gamut-mapped into sRGB hex, so what someone taps is exactly what is
 * written and exactly what `storedColor` reads back. A typed value goes
 * through the same test rather than being trusted — see `normalizeHexColor`.
 */
export function ColorField({
    value,
    onChange,
}: {
    value: string;
    onChange: (color: string) => void;
}) {
    const t = useTranslations("accounts");
    const tCommon = useTranslations("common");

    const [open, setOpen] = useState(false);
    // The dialog's own colour, applied to the form only on Save — so backing
    // out of the picker leaves the row as it was.
    const [draft, setDraft] = useState(value);

    const isCustom = !isPreset(value);
    const drafted = normalizeHexColor(draft);

    return (
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-[14px]">
            {ACCOUNT_SWATCHES.map((swatch) => (
                <Swatch
                    key={swatch}
                    color={swatch}
                    selected={swatch === value}
                    onClick={() => onChange(swatch)}
                />
            ))}

            <button
                type="button"
                title={t("colorPick")}
                aria-label={t("colorPick")}
                onClick={() => {
                    setDraft(value);
                    setOpen(true);
                }}
                className={cn(
                    "flex size-6 flex-none cursor-pointer items-center justify-center rounded-full border",
                    isCustom
                        ? "border-transparent shadow-[0_0_0_2px_var(--bg),0_0_0_3px_var(--ink)]"
                        : "border-rule",
                )}
                style={isCustom ? { background: value } : undefined}
            >
                {isCustom ? null : (
                    <span className="font-mono text-[13px] leading-none text-mute">
                        +
                    </span>
                )}
            </button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle>{t("colorPick")}</DialogTitle>
                        <button
                            type="button"
                            title={tCommon("cancel")}
                            aria-label={tCommon("cancel")}
                            onClick={() => setOpen(false)}
                            className="flex size-6 cursor-pointer items-center justify-center text-mute transition-colors hover:text-ink"
                        >
                            <CloseIcon />
                        </button>
                    </DialogHeader>

                    <div className="mt-4 grid grid-cols-11 gap-[3px]">
                        {COLOR_GRID.map((color) => (
                            <Cell
                                key={color}
                                color={color}
                                height={24}
                                selected={color === drafted}
                                onClick={() => setDraft(color)}
                            />
                        ))}
                    </div>
                    <div className="mt-[3px] grid grid-cols-11 gap-[3px]">
                        {NEUTRAL_GRID.map((color) => (
                            <Cell
                                key={color}
                                color={color}
                                height={18}
                                selected={color === drafted}
                                onClick={() => setDraft(color)}
                            />
                        ))}
                    </div>

                    <div className="mt-5 flex items-center gap-4 border-t border-rule2 pt-4">
                        {/* Nothing to preview until the typed value is a
                            colour; the ring keeps the row from reflowing while
                            someone is part-way through typing one. */}
                        <span
                            aria-hidden
                            className={cn(
                                "size-11 flex-none rounded-full",
                                drafted ? "" : "border border-rule",
                            )}
                            style={
                                drafted ? { background: drafted } : undefined
                            }
                        />
                        <label className="flex min-w-0 flex-1 flex-col gap-[5px]">
                            <span className="font-mono text-[10px] tracking-[0.12em] text-mute uppercase">
                                {t("colorValue")}
                            </span>
                            <Input
                                variant="underlined"
                                autoComplete="off"
                                spellCheck={false}
                                maxLength={9}
                                placeholder="#000000"
                                value={draft}
                                onChange={(event) =>
                                    setDraft(event.target.value)
                                }
                                className="font-mono text-sm"
                            />
                        </label>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            size="sm"
                            disabled={drafted === null}
                            onClick={() => {
                                if (!drafted) return;
                                onChange(drafted);
                                setOpen(false);
                            }}
                        >
                            {tCommon("save")}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setOpen(false)}
                        >
                            {tCommon("cancel")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </span>
    );
}

function isPreset(color: string): boolean {
    return (ACCOUNT_SWATCHES as readonly string[]).includes(
        normalizeHexColor(color) ?? color,
    );
}

/**
 * A preset. The selection mark is a ring held off the swatch by the page
 * ground, so it reads on a colour of any lightness — a border would be lost
 * inside a dark one and a fill would change the colour being chosen.
 */
function Swatch({
    color,
    selected,
    onClick,
}: {
    color: string;
    selected: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            aria-label={color}
            aria-pressed={selected}
            onClick={onClick}
            style={{ background: color }}
            className={cn(
                "size-6 flex-none cursor-pointer rounded-full",
                selected && "shadow-[0_0_0_2px_var(--bg),0_0_0_3px_var(--ink)]",
            )}
        />
    );
}

/**
 * One cell of the full range. Square and flush to its neighbours — the grid is
 * a sheet of colour, so the mark sits inside the cell rather than around it.
 */
function Cell({
    color,
    height,
    selected,
    onClick,
}: {
    color: string;
    height: number;
    selected: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            aria-label={color}
            aria-pressed={selected}
            onClick={onClick}
            style={{
                background: color,
                height,
                boxShadow: selected
                    ? "inset 0 0 0 2px var(--bg), inset 0 0 0 3px var(--ink)"
                    : "inset 0 0 0 1px var(--rule2)",
            }}
            className="cursor-pointer p-0"
        />
    );
}

/**
 * Eleven hues at five lightnesses, the design's own picker.
 *
 * Written out as hex rather than built from `oklch()` at runtime because the
 * value is stored: these are the design's coordinates gamut-mapped into sRGB
 * by holding lightness and hue and shrinking chroma until it fits, which is
 * what a browser does with an out-of-gamut `oklch()` anyway.
 */
// prettier-ignore
const COLOR_GRID = [
    // oklch(0.45 0.13 h)
    "#90302E", "#834100", "#6D5000", "#4E5D00", "#006641", "#006262",
    "#005F79", "#17559B", "#504799", "#703A86", "#853166",
    // oklch(0.58 0.15 h)
    "#C34F4B", "#B95E00", "#9A7300", "#708500", "#00915F", "#008C8C",
    "#0087AB", "#337BD0", "#736ACE", "#9B5BB6", "#B6508E",
    // oklch(0.70 0.14 h)
    "#E97871", "#E0843E", "#C69612", "#94AB39", "#37B880", "#00B5B5",
    "#00AFDC", "#5FA1F3", "#9690F1", "#BF82DA", "#DB78B2",
    // oklch(0.81 0.11 h)
    "#FFA59E", "#F8AE7B", "#E2BB6A", "#B8CC79", "#7DD7A8", "#5AD7D7",
    "#68D0F6", "#96C4FF", "#BAB8FF", "#DCABF2", "#F4A4D1",
    // oklch(0.90 0.06 h)
    "#FFD1CD", "#FED4B9", "#F0DCB1", "#D8E5B8", "#BCEBD1", "#B0EBEA",
    "#B4E7FC", "#C9E0FF", "#DADAFF", "#EDD3FA", "#FCCFE7",
] as const;

/** The same, at 0.012 chroma: a colour for an account that wants none. */
// prettier-ignore
const NEUTRAL_GRID = [
    "#12171B", "#3E4349", "#6A6F76", "#999FA6", "#CBD2D9", "#ECF3FA",
] as const;
