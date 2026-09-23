"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "cn";

import { useMonthEntryDays } from "@/hooks/use-transactions";
import {
    FIRST_YEAR,
    WEEKDAY_ORDER,
    calendarCells,
    fromIsoDate,
    fromMonthOrdinal,
    monthOrdinal,
    toIsoDate,
    todayIso,
} from "@/lib/dates";

/**
 * The month calendar on the entry screen.
 *
 * It is the date field — there is no date row in the form — so it carries every
 * state a day can be in at once: selected, today, has entries, still to come.
 * Each is drawn the design's way, with a fill, a hairline ring or a dot rather
 * than with a colour, and a day in the future is inert rather than hidden so
 * the grid never reflows.
 *
 * The dots come from the list endpoint, which pages by day: one page of 31 is
 * the whole month, and the days it returns are the days with something on them.
 */
export function EntryCalendar({
    selected,
    onSelect,
    className,
}: {
    /** The selected day, YYYY-MM-DD. */
    selected: string;
    onSelect: (date: string) => void;
    className?: string;
}) {
    const t = useTranslations("calendar");
    const tEntry = useTranslations("entry");

    const months = t.raw("months") as string[];
    const weekdays = t.raw("weekdaysShort") as string[];

    // Fixed per mount, so every cell in one render is measured against the same
    // "today" even if the tab is left open across midnight.
    const [today] = useState(todayIso);
    const todayAt = fromIsoDate(today);
    const selectedAt = fromIsoDate(selected);

    const [view, setView] = useState(() => ({
        year: selectedAt.year,
        month: selectedAt.month,
    }));

    // Clicking a cell can only select inside the month on screen, so this only
    // fires when the selection is moved from outside — Clear putting it back on
    // today. Adjusting during render rather than in an effect keeps the grid
    // from painting the old month first.
    const [lastSelected, setLastSelected] = useState(selected);
    if (selected !== lastSelected) {
        setLastSelected(selected);
        if (selectedAt.year !== view.year || selectedAt.month !== view.month) {
            setView({ year: selectedAt.year, month: selectedAt.month });
        }
    }

    const { data: entryDays } = useMonthEntryDays(view.year, view.month);

    const viewAt = monthOrdinal(view.year, view.month);
    const firstAt = monthOrdinal(FIRST_YEAR, 0);
    const todayMonthAt = monthOrdinal(todayAt.year, todayAt.month);

    const step = (delta: number) => {
        const next = viewAt + delta;
        if (next < firstAt || next > todayMonthAt) return;
        setView(fromMonthOrdinal(next));
    };

    return (
        <section
            className={cn("border-t border-rule pt-[14px]", className)}
            aria-label={tEntry("date")}
        >
            {/* The arrows sit at the grid's own edges rather than huddled at
                its right: the strip is the head of the seven columns under it,
                so it is as wide as they are. */}
            <div className="flex items-center gap-1">
                <MonthArrow
                    disabled={viewAt <= firstAt}
                    label={months[fromMonthOrdinal(viewAt - 1).month]}
                    onClick={() => step(-1)}
                >
                    &lsaquo;
                </MonthArrow>
                <span
                    aria-live="polite"
                    className="flex-1 text-center text-xs tracking-[0.06em]"
                >
                    {months[view.month]} {view.year}
                </span>
                <MonthArrow
                    disabled={viewAt >= todayMonthAt}
                    label={months[fromMonthOrdinal(viewAt + 1).month]}
                    onClick={() => step(1)}
                >
                    &rsaquo;
                </MonthArrow>
            </div>

            <div className="mt-[22px] grid grid-cols-7 gap-[2px]">
                {WEEKDAY_ORDER.map((index) => (
                    <div
                        key={index}
                        className="pb-[6px] text-center text-[10px] tracking-[0.06em] text-mute uppercase"
                    >
                        {weekdays[index]}
                    </div>
                ))}

                {calendarCells(view.year, view.month).map((day, index) => {
                    if (day === null) return <div key={`lead-${index}`} />;

                    const date = toIsoDate(view.year, view.month, day);
                    const isSelected = date === selected;
                    const isToday = date === today;
                    const isFuture = date > today;
                    const hasEntries = entryDays?.has(date) ?? false;

                    return (
                        <button
                            key={date}
                            type="button"
                            disabled={isFuture}
                            aria-pressed={isSelected}
                            onClick={() => onSelect(date)}
                            className={cn(
                                "flex cursor-pointer flex-col items-center justify-center gap-1 py-[7px] text-[13px] tabular-nums transition-colors",
                                isFuture &&
                                    "pointer-events-none cursor-default text-mute opacity-[0.38]",
                                !isFuture &&
                                    !isSelected &&
                                    "text-ink hover:bg-rule2",
                                // A ring rather than a fill: today is marked,
                                // the selection is filled.
                                isToday &&
                                    !isSelected &&
                                    "shadow-[inset_0_0_0_1px_var(--rule)]",
                                isSelected && "bg-ink text-bg",
                            )}
                        >
                            <span>{day}</span>
                            {/* The one circle in the design, and small enough
                                to read as a mark rather than as a shape. */}
                            <span
                                aria-hidden
                                className={cn(
                                    "size-1 rounded-full",
                                    hasEntries
                                        ? isSelected
                                            ? "bg-bg"
                                            : "bg-blue"
                                        : "bg-transparent",
                                )}
                            />
                        </button>
                    );
                })}
            </div>
        </section>
    );
}

function MonthArrow({
    disabled,
    label,
    onClick,
    children,
}: {
    disabled: boolean;
    label: string;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            aria-label={label}
            onClick={onClick}
            className={cn(
                "px-[6px] py-[2px] text-[15px] leading-none text-mute transition-colors",
                disabled
                    ? "pointer-events-none opacity-35"
                    : "cursor-pointer hover:text-ink",
            )}
        >
            {children}
        </button>
    );
}
