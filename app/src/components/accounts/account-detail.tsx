"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "cn";

import { ApiError } from "@/api/client";
import type { Transaction } from "@/api/types";
import { ColorField } from "@/components/accounts/color-field";
import { TransactionDialog } from "@/components/ledger/transaction-dialog";
import { Button } from "@/components/ui/button";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { usePreferences } from "@/contexts/preferences-context";
import {
    useAccount,
    useDeleteAccount,
    useUpdateAccount,
} from "@/hooks/use-accounts";
import { useDateFormat } from "@/hooks/use-date-format";
import { useAccountTransactions } from "@/hooks/use-transactions";
import { Link, useRouter } from "@/i18n/navigation";
import { creditedTotal, shareOfTotal } from "@/lib/accounts";
import { categoryLabel } from "@/lib/categories";
import { storedColor } from "@/lib/charts";
import { currencyLabel, signedValue, toNumber } from "@/lib/money";

/** What the design's heading over the entry list promises. */
const RECENT = 10;

/** The design's own label column on the edit form: 160px, no gutter. */
const LABEL = "basis-[160px] pr-0";

/**
 * One account: what it holds, what share of everything that is, and the last
 * entries written on it.
 *
 * Two things read differently here than on the list, both deliberate in the
 * design. The account's **own** currency leads the balance and the converted
 * figure follows it — on a screen about one account that account's currency is
 * the subject, where in a list that has to add up it is the common currency
 * that leads. And the share is measured against the same credited pool the
 * list's bar is drawn from, so the two screens never disagree about a
 * percentage.
 *
 * Editing and deleting are the two writes here. Editing is narrower than the
 * design draws it: `kopiika-api-go`'s `PUT /:id` only ever changes `name` and
 * `colorHex` — currency and balance are invariants a posted transaction relies
 * on, so the edit form has no fields for either, unlike the design's mock.
 */
export function AccountDetail({ accountId }: { accountId: string }) {
    const t = useTranslations("accounts");
    const tCommon = useTranslations("common");
    const tOverview = useTranslations("overview");

    const router = useRouter();
    const { format } = usePreferences();

    const { data, account, missing } = useAccount(accountId);
    const entries = useAccountTransactions(accountId);
    const remove = useDeleteAccount();

    const [confirming, setConfirming] = useState(false);
    const [editing, setEditing] = useState(false);
    const [selected, setSelected] = useState<Transaction | null>(null);

    if (missing) {
        return (
            <div className="mt-6">
                <BackLink label={t("backAccounts")} />
                <p className="mt-5 border-t border-rule pt-[22px] text-[15px] text-mute">
                    {t("notFound")}
                </p>
            </div>
        );
    }

    if (!account || !data) return <AccountDetailFallback />;

    // The colour falls back to the account's position in the response, which is
    // the position the list colours it by too — so an account with no usable
    // `colorHex` is the same colour on both screens.
    const index = data.accounts.findIndex(({ id }) => id === account.id);
    const color = storedColor(account.colorHex, index);

    const pool = creditedTotal(
        data.accounts.map((one) => toNumber(one.localizedAmount.value)),
    );
    const share = shareOfTotal(toNumber(account.localizedAmount.value), pool);

    const isForeign =
        account.amount.currency !== account.localizedAmount.currency;

    return (
        <div className="mt-6">
            <div className="flex flex-wrap items-center gap-5">
                <BackLink label={t("backAccounts")} />

                <span className="ml-auto flex items-center gap-5">
                    <Button
                        variant="quiet"
                        size="text"
                        onClick={() => {
                            setEditing(true);
                            setConfirming(false);
                        }}
                    >
                        {tCommon("edit")}
                    </Button>
                    <Button
                        variant="quiet"
                        size="text"
                        onClick={() => {
                            setConfirming(true);
                            setEditing(false);
                        }}
                        className="hover:border-red hover:text-red"
                    >
                        {tCommon("delete")}
                    </Button>
                </span>
            </div>

            {confirming ? (
                <div className="mt-5 flex flex-wrap items-center gap-5 border border-red px-[18px] py-4">
                    <span className="min-w-[220px] flex-1 text-[13.5px] leading-[1.45] text-pretty">
                        {t("deleteAsk")}
                    </span>
                    <Button
                        variant="danger"
                        size="sm"
                        disabled={remove.isPending}
                        onClick={() =>
                            remove.mutate(account.id, {
                                onSuccess: () => router.push("/accounts"),
                            })
                        }
                    >
                        {tCommon("delete")}
                    </Button>
                    <Button
                        variant="quiet"
                        size="text"
                        disabled={remove.isPending}
                        onClick={() => setConfirming(false)}
                    >
                        {tCommon("cancel")}
                    </Button>
                    {remove.isError ? (
                        <span className="text-[13px] text-red">
                            {t("deleteFailed")}
                        </span>
                    ) : null}
                </div>
            ) : null}

            {/* The rule over the heading is what the confirmation or the edit
                form stands in for while either is open — two rules stacked
                would read as a boxed-in heading rather than as one screen. */}
            <div
                className={cn(
                    confirming || editing
                        ? "mt-[22px]"
                        : "mt-5 border-t border-rule pt-[22px]",
                )}
            >
                {editing ? (
                    <AccountEditForm
                        accountId={account.id}
                        name={account.name}
                        color={color}
                        onDone={() => setEditing(false)}
                    />
                ) : (
                    <>
                        <div className="flex min-w-0 items-center gap-3">
                            <span
                                aria-hidden
                                className="size-[11px] flex-none rounded-full"
                                style={{ background: color }}
                            />
                            <h1 className="min-w-0 text-[clamp(26px,3vw,34px)] leading-[1.05] font-medium tracking-[-0.02em] italic">
                                {account.name}
                            </h1>
                        </div>

                        <div className="mt-5 flex flex-wrap items-baseline gap-4">
                            <div className="text-[clamp(28px,3.6vw,42px)] leading-none tracking-[-0.03em]">
                                {format(account.amount)}
                            </div>
                            {isForeign ? (
                                <div className="text-[clamp(17px,2vw,22px)] leading-none tracking-[-0.02em] text-mute">
                                    {format(account.localizedAmount)}
                                </div>
                            ) : null}
                        </div>

                        <div className="mt-[22px] flex flex-wrap items-baseline gap-x-11 gap-y-3 bg-blue-soft px-[18px] py-[13px]">
                            <Meta
                                label={tCommon("currency")}
                                value={currencyLabel(account.amount.currency)}
                            />
                            <Meta
                                label={t("shareOfTotal")}
                                value={`${Math.round(share * 100)}%`}
                            />
                            {/* Days, not entries: the list endpoint pages by
                                day, so its `total` counts days and an exact
                                entry count would mean walking the account's
                                whole history. See `useAccountTransactions`. */}
                            <Meta
                                label={t("activeDays")}
                                value={
                                    entries.data
                                        ? String(entries.data.activeDays)
                                        : "—"
                                }
                            />
                        </div>
                    </>
                )}
            </div>

            {editing ? null : (
                <section className="mt-10">
                    <div className="mb-3 flex flex-wrap items-baseline gap-[14px]">
                        <h2 className="text-[23px] font-normal tracking-[-0.01em] italic">
                            {t("recentEntries")}
                        </h2>
                        <span className="text-[11px] tracking-[0.12em] text-mute uppercase">
                            {t("latest10")}
                        </span>
                        <Link
                            href={`/transactions?account=${account.id}`}
                            className="ml-auto border-b border-blue text-[13px] text-blue transition-colors hover:border-ink hover:text-ink"
                        >
                            {tOverview("allEntries")}
                        </Link>
                    </div>

                    {!entries.data ? (
                        <EntriesSkeleton />
                    ) : entries.data.entries.length === 0 ? (
                        <div className="border-t border-rule py-[34px] text-sm text-mute">
                            {t("noEntriesOnAccount")}
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            {entries.data.entries
                                .slice(0, RECENT)
                                .map((entry) => (
                                    <EntryRow
                                        key={entry.id}
                                        entry={entry}
                                        onOpen={() => setSelected(entry)}
                                    />
                                ))}
                        </div>
                    )}
                </section>
            )}

            <TransactionDialog
                transaction={selected}
                onClose={() => setSelected(null)}
                onSaved={setSelected}
            />
        </div>
    );
}

/**
 * Name and colour, the only two fields `PUT /accounts/:id` accepts. Laid out
 * like `NewAccountForm`'s rows, minus the currency and opening-balance rows
 * that form has and this one cannot: both are invariants once an account
 * exists.
 */
function AccountEditForm({
    accountId,
    name: initialName,
    color: initialColor,
    onDone,
}: {
    accountId: string;
    name: string;
    color: string;
    onDone: () => void;
}) {
    const t = useTranslations("accounts");
    const tCommon = useTranslations("common");

    const update = useUpdateAccount();

    const [name, setName] = useState(initialName);
    const [color, setColor] = useState(initialColor);
    const [error, setError] = useState<string | null>(null);

    function edit<T>(set: (value: T) => void) {
        return (value: T) => {
            set(value);
            setError(null);
        };
    }

    function submit(event: React.FormEvent) {
        event.preventDefault();
        // Enter in the field submits even while the button is disabled.
        if (update.isPending) return;

        const trimmed = name.trim();
        if (!trimmed) {
            setError(t("errName"));
            return;
        }

        update.mutate(
            { accountId, payload: { name: trimmed, colorHex: color } },
            {
                onSuccess: onDone,
                onError: (cause) =>
                    setError(
                        cause instanceof ApiError
                            ? cause.message
                            : tCommon("error"),
                    ),
            },
        );
    }

    return (
        <form
            onSubmit={submit}
            noValidate
            className="flex max-w-[520px] flex-col"
        >
            <FormRow
                asLabel
                label={t("name")}
                required
                labelClassName={LABEL}
                className="border-t border-t-rule"
            >
                <Input
                    autoComplete="off"
                    required
                    maxLength={64}
                    placeholder={t("nameHint")}
                    value={name}
                    onChange={(event) => edit(setName)(event.target.value)}
                    className="text-[19px]"
                />
            </FormRow>

            <FormRow
                label={t("color")}
                labelClassName={LABEL}
                className="items-center border-b-rule"
            >
                <ColorField value={color} onChange={edit(setColor)} />
            </FormRow>

            <div className="mt-[26px] flex flex-wrap items-center gap-5">
                <Button type="submit" disabled={update.isPending}>
                    {tCommon("save")}
                </Button>
                <Button type="button" variant="quiet" onClick={onDone}>
                    {tCommon("cancel")}
                </Button>
                <span role="status" className="text-[13px] text-red">
                    {error ?? ""}
                </span>
            </div>
        </form>
    );
}

function Meta({ label, value }: { label: string; value: string }) {
    return (
        <span className="flex items-baseline gap-[10px]">
            <span className="text-[10px] tracking-[0.14em] text-mute uppercase">
                {label}
            </span>
            <span className="text-sm text-ink">{value}</span>
        </span>
    );
}

function BackLink({ label }: { label: string }) {
    return (
        <Link
            href="/accounts"
            className="text-xs text-mute transition-colors hover:text-blue"
        >
            {label}
        </Link>
    );
}

/**
 * One entry on the account, opening the same dialog the ledger opens — an
 * entry is one record wherever it is read from, so it is edited in one place.
 */
function EntryRow({
    entry,
    onOpen,
}: {
    entry: Transaction;
    onOpen: () => void;
}) {
    const tCommon = useTranslations("common");
    const tCategories = useTranslations("categories");

    const { formatValue } = usePreferences();
    const { rowLabel } = useDateFormat();

    const isIncome = entry.type === "income";

    return (
        <button
            type="button"
            onClick={onOpen}
            className="grid w-full cursor-pointer grid-cols-[64px_minmax(0,1fr)_auto] items-baseline gap-[14px] border-t border-rule2 py-[11px] text-left text-[13.5px] text-ink transition-colors hover:text-blue"
        >
            <span className="text-xs text-mute">{rowLabel(entry.date)}</span>

            <span className="flex min-w-0 items-baseline gap-[10px]">
                <span className="truncate">{entry.title}</span>
                {/* Income has no category worth naming — it came in, and the
                    green already says so. */}
                {!isIncome ? (
                    <span className="flex-none text-[11px] whitespace-nowrap text-mute">
                        {entry.category
                            ? categoryLabel(entry.category, tCategories)
                            : tCommon("noCategory")}
                    </span>
                ) : null}
            </span>

            <span
                className={cn(
                    "text-sm whitespace-nowrap",
                    isIncome ? "text-green" : "text-red",
                )}
            >
                {formatValue(
                    signedValue(entry.amount, entry.type),
                    entry.amount.currency,
                    { signed: true },
                )}
            </span>
        </button>
    );
}

/** The screen before the balance read has landed. */
export function AccountDetailFallback() {
    const t = useTranslations("accounts");

    return (
        <div className="mt-6" aria-hidden>
            <BackLink label={t("backAccounts")} />

            <div className="mt-5 border-t border-rule pt-[22px]">
                <div className="flex items-center gap-3">
                    <Skeleton className="size-[11px] flex-none rounded-full bg-rule2" />
                    <Skeleton className="h-[30px] w-[210px] bg-rule2" />
                </div>
                <div className="mt-5 flex h-[1em] items-center text-[clamp(28px,3.6vw,42px)] leading-none">
                    <Skeleton className="h-[0.7em] w-[7ch] bg-rule2" />
                </div>
                <div className="mt-[22px] h-[46px] bg-blue-soft" />
            </div>

            <section className="mt-10">
                <div className="mb-3 flex items-baseline gap-[14px]">
                    <h2 className="text-[23px] font-normal tracking-[-0.01em] italic">
                        {t("recentEntries")}
                    </h2>
                </div>
                <EntriesSkeleton />
            </section>
        </div>
    );
}

// Widths, not a count off real data — this is the loading state, so there is
// nothing to size it against yet. One pair per row, so the row count is just
// how many pairs are listed here (ten, matching `RECENT`).
const ENTRY_SKELETON_WIDTHS: [title: number, amount: number][] = [
    [140, 58],
    [96, 72],
    [168, 64],
    [110, 80],
    [84, 54],
    [152, 68],
    [100, 76],
    [128, 60],
    [92, 70],
    [144, 66],
];

function EntriesSkeleton() {
    return (
        <div className="flex flex-col" aria-hidden>
            {ENTRY_SKELETON_WIDTHS.map(([titleWidth, amountWidth], index) => (
                <div
                    key={index}
                    className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-[14px] border-t border-rule2 py-[11px]"
                >
                    <Skeleton className="h-[12px] w-[34px] bg-rule2" />
                    {/* A line box at the row's real height — the 13.5px text
                        at the global 1.5 leading — so the list does not grow
                        when the entries land. */}
                    <span className="flex h-[20.25px] min-w-0 items-center gap-[10px]">
                        <Skeleton
                            className="h-[14px] bg-rule2"
                            style={{ width: titleWidth }}
                        />
                        <Skeleton className="h-[11px] w-[50px] flex-none bg-rule2" />
                    </span>
                    <Skeleton
                        className="h-[14px] justify-self-end bg-rule2"
                        style={{ width: amountWidth }}
                    />
                </div>
            ))}
        </div>
    );
}
