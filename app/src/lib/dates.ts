/**
 * Calendar arithmetic, in the one shape the rest of the app speaks: a local ISO
 * day, `2026-09-12`.
 *
 * Everything here reads the browser's own clock rather than UTC — an entry is
 * filed under the day the person was living in — so an ISO string is always
 * assembled from parts and never taken from `toISOString()`, which would move
 * the day for anyone east or west of Greenwich.
 *
 * `month` is 0-indexed throughout, like a JS Date. The API's create payload is
 * the one place that wants it 1-indexed, and it converts at the edge.
 */

/** The earliest year any date control here will walk back to. */
export const FIRST_YEAR = 2020;

export type DateParts = {
    year: number;
    /** 0-indexed, like a JS Date. */
    month: number;
    day: number;
};

const pad = (value: number) => String(value).padStart(2, "0");

export function toIsoDate(year: number, month: number, day: number): string {
    return `${year}-${pad(month + 1)}-${pad(day)}`;
}

export function fromIsoDate(iso: string): DateParts {
    const [year, month, day] = iso.split("-").map(Number);
    return { year, month: month - 1, day };
}

export function todayParts(): DateParts {
    const now = new Date();
    return {
        year: now.getFullYear(),
        month: now.getMonth(),
        day: now.getDate(),
    };
}

export function todayIso(): string {
    const { year, month, day } = todayParts();
    return toIsoDate(year, month, day);
}

/** Day 0 of the next month is the last day of this one. */
export function daysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
}

/** The inclusive day range covering a whole month, as every API read wants it. */
export function monthRange(year: number, month: number) {
    return {
        fromDate: toIsoDate(year, month, 1),
        toDate: toIsoDate(year, month, daysInMonth(year, month)),
    };
}

/**
 * A month flattened to a single number, so that two of them can be compared or
 * stepped without carrying the year over by hand.
 */
export function monthOrdinal(year: number, month: number): number {
    return year * 12 + month;
}

export function fromMonthOrdinal(ordinal: number) {
    return { year: Math.floor(ordinal / 12), month: ordinal % 12 };
}

/**
 * The cells of a month grid, Monday first: a leading run of nulls standing in
 * for the tail of the previous month, then 1..n.
 */
export function calendarCells(year: number, month: number): (number | null)[] {
    // getDay() is Sunday-first; the design's grid starts on Monday.
    const lead = (new Date(year, month, 1).getDay() + 6) % 7;
    const cells: (number | null)[] = Array(lead).fill(null);

    for (let day = 1; day <= daysInMonth(year, month); day++) cells.push(day);

    return cells;
}

/**
 * Indices into a Sunday-first weekday list, in the order the grid shows them.
 * The dictionary stores weekdays the way `Date` numbers them; the calendar
 * reads them Monday first.
 */
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/**
 * The month before the given one, as a day range.
 *
 * `throughDay` truncates it. Measuring a month that is still running against
 * the whole of the one before it would read as a collapse on the 3rd and a
 * recovery on the 30th, so the comparison is against the same span — and a
 * previous month too short for the day asked for is clamped to its own last.
 */
export function previousMonthRange(
    year: number,
    month: number,
    throughDay?: number,
) {
    const previous = fromMonthOrdinal(monthOrdinal(year, month) - 1);
    const last = daysInMonth(previous.year, previous.month);
    const through =
        throughDay === undefined ? last : Math.min(throughDay, last);

    return {
        ...previous,
        fromDate: toIsoDate(previous.year, previous.month, 1),
        toDate: toIsoDate(previous.year, previous.month, through),
    };
}
