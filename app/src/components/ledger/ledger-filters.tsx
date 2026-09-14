"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "cn";

import { Checkbox } from "@/components/ui/checkbox";
import { useTransactionsConfiguration } from "@/hooks/use-transactions";
import type { LedgerFilters } from "@/hooks/use-transactions";
import { categoryLabel } from "@/lib/categories";
import { toIsoDate, todayParts } from "@/lib/dates";

/**
 * The ledger's filter rail.
 *
 * It sticks as the ledger scrolls, which is the whole reason it is a rail and
 * not a bar: the list under it is unbounded, so the controls that narrow it
 * have to stay reachable. Every section is a hairline and a micro-label,
 * and nothing here has a box of its own.
 *
 * The type row and the date presets are single-choice and mark the active one
 * with a rule; categories and accounts are multiple-choice and mark them with a
 * filled square. Nothing changes colour.
 */
export function LedgerFilterRail({
    filters,
    onChange,
    className,
}: {
    filters: LedgerFilters;
    onChange: (filters: LedgerFilters) => void;
    className?: string;
}) {
    const t = useTranslations("ledger");
    const tCommon = useTranslations("common");
    const tPeriod = useTranslations("period");
    const tCategories = useTranslations("categories");

    const { data: configuration } = useTransactionsConfiguration();
    const [today] = useState(todayParts);

    const categoryIds = filters.categoryIds ?? [];
    const accountIds = filters.accountIds ?? [];

    const hasFilters =
        filters.type !== undefined ||
        categoryIds.length > 0 ||
        accountIds.length > 0 ||
        Boolean(filters.fromDate) ||
        Boolean(filters.toDate);

    const todayIso = toIsoDate(today.year, today.month, today.day);
    const shift = (days: number) => {
        const date = new Date(today.year, today.month, today.day + days);
        return toIsoDate(date.getFullYear(), date.getMonth(), date.getDate());
    };

    const presets = [
        {
            label: tPeriod("thisMonth"),
            fromDate: toIsoDate(today.year, today.month, 1),
            toDate: todayIso,
        },
        { label: tPeriod("last90"), fromDate: shift(-89), toDate: todayIso },
        {
            label: tPeriod("thisYear"),
            fromDate: toIsoDate(today.year, 0, 1),
            toDate: todayIso,
        },
    ];

    /** A cleared id list is dropped rather than sent empty. */
    function toggle<T>(list: T[], value: T): T[] | undefined {
        const next = list.includes(value)
            ? list.filter((item) => item !== value)
            : [...list, value];
        return next.length > 0 ? next : undefined;
    }

    return (
        <aside
            className={cn(
                // The rail leads on one column: the ledger under it is
                // unbounded, so filters placed after it are never reached.
                "order-first flex flex-col gap-5 border-rule py-[14px]",
                "lg:sticky lg:top-11 lg:order-none lg:self-start lg:border-l lg:pl-[22px]",
                className,
            )}
        >
            <div>
                <div className="mb-[10px] flex items-baseline gap-[10px]">
                    <span className="flex-1 text-[11px] tracking-[0.14em] text-mute uppercase">
                        {t("type")}
                    </span>
                    {hasFilters ? (
                        <button
                            type="button"
                            onClick={() => onChange({})}
                            className="cursor-pointer border-b border-rule text-[11px] text-mute transition-colors hover:text-ink"
                        >
                            {tCommon("clearAll")}
                        </button>
                    ) : null}
                </div>

                <div className="flex gap-4">
                    {(
                        [
                            [undefined, tCommon("all")],
                            ["income", tCommon("income")],
                            ["outcome", tCommon("expenses")],
                        ] as const
                    ).map(([value, label]) => {
                        const active = filters.type === value;

                        return (
                            <button
                                key={label}
                                type="button"
                                aria-pressed={active}
                                onClick={() =>
                                    onChange({ ...filters, type: value })
                                }
                                className={cn(
                                    "cursor-pointer border-b pb-[3px] text-xs transition-colors",
                                    active
                                        ? "border-blue text-ink"
                                        : "border-transparent text-mute hover:text-blue",
                                )}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>
            </div>

            <Section label={t("date")}>
                <DateField
                    label={tCommon("from")}
                    value={filters.fromDate ?? ""}
                    onChange={(fromDate) => onChange({ ...filters, fromDate })}
                />
                <DateField
                    label={tCommon("to")}
                    value={filters.toDate ?? ""}
                    onChange={(toDate) => onChange({ ...filters, toDate })}
                />

                <div className="mt-[11px] flex flex-wrap gap-[6px]">
                    {presets.map((preset) => {
                        const active =
                            filters.fromDate === preset.fromDate &&
                            filters.toDate === preset.toDate;

                        return (
                            <button
                                key={preset.label}
                                type="button"
                                aria-pressed={active}
                                onClick={() =>
                                    onChange({
                                        ...filters,
                                        fromDate: preset.fromDate,
                                        toDate: preset.toDate,
                                    })
                                }
                                className={cn(
                                    "cursor-pointer border px-2 py-1 text-[11px] transition-colors",
                                    active
                                        ? "border-blue bg-blue-soft text-ink"
                                        : "border-rule text-mute hover:text-ink",
                                )}
                            >
                                {preset.label}
                            </button>
                        );
                    })}
                </div>
            </Section>

            <Section label={t("categories")}>
                <div className="grid grid-cols-2 gap-x-3">
                    {configuration?.categories.map((category) => (
                        <BoxRow
                            key={category.id}
                            label={categoryLabel(category, tCategories)}
                            checked={categoryIds.includes(category.id)}
                            onToggle={() =>
                                onChange({
                                    ...filters,
                                    categoryIds: toggle(
                                        categoryIds,
                                        category.id,
                                    ),
                                })
                            }
                        />
                    ))}
                </div>
            </Section>

            <Section label={t("accounts")}>
                <div className="grid grid-cols-2 gap-x-3">
                    {configuration?.accounts.map((account) => (
                        <BoxRow
                            key={account.id}
                            label={account.name}
                            checked={accountIds.includes(account.id)}
                            onToggle={() =>
                                onChange({
                                    ...filters,
                                    accountIds: toggle(accountIds, account.id),
                                })
                            }
                        />
                    ))}
                </div>
            </Section>
        </aside>
    );
}

function Section({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <section className="border-t border-rule pt-[13px]">
            <h2 className="mb-[6px] text-[11px] font-normal tracking-[0.14em] text-mute uppercase">
                {label}
            </h2>
            {children}
        </section>
    );
}

function DateField({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string;
    onChange: (value: string | undefined) => void;
}) {
    return (
        <label className="flex items-baseline gap-[10px] border-b border-rule2 py-[6px]">
            <span className="shrink-0 basis-[34px] text-[11px] text-mute">
                {label}
            </span>
            <input
                type="date"
                value={value}
                onChange={(event) => onChange(event.target.value || undefined)}
                className="min-w-0 flex-1 border-none bg-transparent py-[2px] text-xs text-ink outline-none"
            />
        </label>
    );
}

function BoxRow({
    label,
    checked,
    onToggle,
}: {
    label: string;
    checked: boolean;
    onToggle: () => void;
}) {
    return (
        <label
            className={cn(
                "flex w-full cursor-pointer items-center gap-[10px] py-[6px] text-[13px] transition-colors",
                checked ? "text-ink" : "text-mute hover:text-ink",
            )}
        >
            <Checkbox checked={checked} onCheckedChange={onToggle} />
            <span className="min-w-0 truncate">{label}</span>
        </label>
    );
}
