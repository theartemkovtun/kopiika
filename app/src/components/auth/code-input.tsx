"use client";

import { useTranslations } from "next-intl";
import { useId, useRef } from "react";

const CELL_COUNT = 6;
const CELLS = [0, 1, 2, 3, 4, 5];

/** Just the digits, with the gaps of a half-typed code taken out. */
export function codeDigits(value: string): string {
    return value.replace(/\D/g, "");
}

export function isCompleteCode(value: string): boolean {
    return codeDigits(value).length === CELL_COUNT;
}

/**
 * The six-digit code, as six boxes.
 *
 * Boxes are the one place in this design where a field has a border of its own:
 * the code is read back digit by digit off an email, and six ruled cells are
 * what make that possible. They are the only boxed control on a signed-out
 * screen, and — like everything else here — square.
 *
 * The value is held as one string so that the page can hand it straight to
 * Cognito. It is padded with spaces rather than compacted, so a digit typed
 * into the fourth cell stays in the fourth cell instead of sliding to the
 * front; `codeDigits` is what strips the padding back out.
 *
 * Everything a code field is expected to do is here: typing walks forward,
 * backspace on an empty cell walks back and clears, the arrows move without
 * editing, and a pasted or autofilled code fills every cell at once rather
 * than dropping five digits into the first.
 */
export function CodeInput({
    label,
    value,
    onChange,
    disabled = false,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}) {
    const t = useTranslations("auth");
    const firstId = useId();
    const cells = useRef<Array<HTMLInputElement | null>>([]);

    function focusCell(index: number) {
        const cell = cells.current[index];
        if (!cell) return;
        cell.focus();
        cell.select();
    }

    function setDigit(index: number, digit: string) {
        const chars = value.padEnd(CELL_COUNT, " ").split("");
        chars[index] = digit || " ";

        onChange(chars.join("").trimEnd());
        if (digit && index < CELL_COUNT - 1) focusCell(index + 1);
    }

    /** A whole code arriving at one cell: a paste, or the OTP autofill. */
    function fillFrom(index: number, digits: string) {
        const head = value.slice(0, index).padEnd(index, " ");
        const next = (head + digits).slice(0, CELL_COUNT);

        onChange(next.trimEnd());
        focusCell(Math.min(CELL_COUNT - 1, next.length));
    }

    return (
        <div className="flex flex-col gap-[9px]">
            <label
                htmlFor={firstId}
                className="text-[10px] tracking-[0.12em] text-mute uppercase"
            >
                {label}
            </label>

            <div className="flex gap-2">
                {CELLS.map((index) => {
                    const char = value[index];
                    const current = !char || char === " " ? "" : char;

                    return (
                        <input
                            key={index}
                            id={index === 0 ? firstId : undefined}
                            ref={(element) => {
                                cells.current[index] = element;
                            }}
                            type="text"
                            inputMode="numeric"
                            spellCheck={false}
                            // Only the first cell offers to autofill: the
                            // browser puts the whole code in one field, and
                            // `fillFrom` spreads it across the six.
                            autoComplete={index === 0 ? "one-time-code" : "off"}
                            disabled={disabled}
                            aria-label={t("codeCell", { index: index + 1 })}
                            value={current}
                            onFocus={(event) => event.target.select()}
                            onChange={(event) => {
                                const digits = codeDigits(event.target.value);

                                if (!digits) {
                                    setDigit(index, "");
                                    return;
                                }

                                // More than one digit in an empty cell is a
                                // code arriving whole; in a full one it is the
                                // old digit being typed over.
                                if (digits.length > 1 && !current) {
                                    fillFrom(index, digits);
                                    return;
                                }

                                setDigit(index, digits.slice(-1));
                            }}
                            onKeyDown={(event) => {
                                if (
                                    event.key === "Backspace" &&
                                    !current &&
                                    index > 0
                                ) {
                                    event.preventDefault();
                                    setDigit(index - 1, "");
                                    focusCell(index - 1);
                                }
                                if (event.key === "ArrowLeft" && index > 0) {
                                    focusCell(index - 1);
                                }
                                if (
                                    event.key === "ArrowRight" &&
                                    index < CELL_COUNT - 1
                                ) {
                                    focusCell(index + 1);
                                }
                            }}
                            onPaste={(event) => {
                                const digits = codeDigits(
                                    event.clipboardData.getData("text"),
                                ).slice(0, CELL_COUNT);
                                if (!digits) return;

                                event.preventDefault();
                                // A whole code goes to the front wherever it
                                // was dropped; a fragment starts where it fell.
                                fillFrom(
                                    digits.length === CELL_COUNT ? 0 : index,
                                    digits,
                                );
                            }}
                            className="min-w-0 flex-1 border border-rule bg-transparent py-3 text-center text-[20px] text-ink outline-none focus:border-ink disabled:opacity-50"
                        />
                    );
                })}
            </div>
        </div>
    );
}
