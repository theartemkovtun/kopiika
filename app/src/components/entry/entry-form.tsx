"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "cn";

import { ApiError } from "@/api/client";
import type { Transaction, TransactionType } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { usePreferences } from "@/contexts/preferences-context";
import {
    useCreateTransaction,
    useTransactionsConfiguration,
} from "@/hooks/use-transactions";
import { categoryLabel } from "@/lib/categories";
import { fromIsoDate, todayIso } from "@/lib/dates";
import { CURRENCIES, parseAmountInput } from "@/lib/money";

/**
 * The entry form.
 *
 * It is a stack of ruled rows rather than a card of boxed fields: a mono label
 * at a fixed 92px, the control filling the rest, and the row's own hairline as
 * the only line. The heavier rule under Account closes the stack.
 *
 * Two rules come from the API rather than from the design, and neither fails
 * loudly if ignored: an entry posted to an account has to be in that account's
 * currency, which is why the account list is filtered by the currency picked
 * above it; and the amount travels as a decimal string, so it is normalised as
 * text and never round-tripped through a float.
 *
 * The date is not a row here — the calendar beside the form is the date field —
 * so it is handed in, and Clear puts it back on today with the rest.
 */

/** Radix cannot hold an empty string as a value, so absence needs a name. */
const NONE = "none";

type Message = { tone: "ok" | "error"; text: string };

export function EntryForm({
    date,
    onDateChange,
    onCreated,
    className,
}: {
    /** The day the entry is filed under, YYYY-MM-DD. */
    date: string;
    onDateChange: (date: string) => void;
    onCreated?: (transaction: Transaction) => void;
    className?: string;
}) {
    const t = useTranslations("entry");
    const tCommon = useTranslations("common");
    const tCategories = useTranslations("categories");
    const { currency: displayCurrency } = usePreferences();

    const { data: configuration } = useTransactionsConfiguration();
    const { mutate: createTransaction, isPending } = useCreateTransaction();

    const [type, setType] = useState<TransactionType>("outcome");
    const [amount, setAmount] = useState("");
    const [currency, setCurrency] = useState(displayCurrency);
    const [title, setTitle] = useState("");
    const [categoryId, setCategoryId] = useState(NONE);
    const [accountId, setAccountId] = useState(NONE);
    const [message, setMessage] = useState<Message | null>(null);

    const categories = configuration?.categories ?? [];
    const accounts = configuration?.accounts ?? [];
    // The API rejects an entry whose currency is not the account's own.
    const payable = accounts.filter((account) => account.currency === currency);

    /** Any edit clears the last outcome: it described the previous attempt. */
    function edit<T>(set: (value: T) => void) {
        return (value: T) => {
            set(value);
            setMessage(null);
        };
    }

    function selectCurrency(next: string) {
        setCurrency(next);
        // An account that no longer matches would be refused on submit.
        const kept = accounts.find(
            (account) => account.id === accountId && account.currency === next,
        );
        if (!kept) setAccountId(NONE);
        setMessage(null);
    }

    function reset() {
        setType("outcome");
        setAmount("");
        setCurrency(displayCurrency);
        setTitle("");
        setCategoryId(NONE);
        setAccountId(NONE);
        setMessage(null);
        onDateChange(todayIso());
    }

    function submit(event: React.FormEvent) {
        event.preventDefault();
        // Enter in a field submits even while the button is disabled.
        if (isPending) return;

        const value = parseAmountInput(amount);
        if (!value) {
            setMessage({ tone: "error", text: t("errAmount") });
            return;
        }
        if (!title.trim()) {
            setMessage({ tone: "error", text: t("errName") });
            return;
        }
        // Income is not categorised — the design drops the row entirely — so
        // the requirement only lands on spending.
        if (type === "outcome" && categoryId === NONE) {
            setMessage({ tone: "error", text: t("errCategory") });
            return;
        }

        const { year, month, day } = fromIsoDate(date);

        createTransaction(
            {
                type,
                title: title.trim(),
                value,
                currency,
                categoryId:
                    type === "income" || categoryId === NONE
                        ? null
                        : Number(categoryId),
                accountId: accountId === NONE ? null : accountId,
                year,
                // The payload counts months from one, unlike everything else.
                month: month + 1,
                day,
            },
            {
                onSuccess: (created) => {
                    // Type, currency, category, account and date all stay: the
                    // next entry is usually the next line of the same receipt.
                    setAmount("");
                    setTitle("");
                    setMessage({ tone: "ok", text: t("ok") });
                    onCreated?.(created);
                },
                onError: (error) => {
                    setMessage({
                        tone: "error",
                        text:
                            error instanceof ApiError
                                ? error.message
                                : tCommon("error"),
                    });
                },
            },
        );
    }

    return (
        <form
            onSubmit={submit}
            noValidate
            className={cn("flex flex-col", className)}
        >
            <FormRow
                label={t("type")}
                className="items-start border-t border-t-rule"
                labelClassName="pt-[6px]"
            >
                <div className="flex gap-[10px]">
                    <Button
                        type="button"
                        size="chip"
                        variant={type === "outcome" ? "expense" : "outline"}
                        aria-pressed={type === "outcome"}
                        onClick={() => edit(setType)("outcome")}
                    >
                        {t("expense")}
                    </Button>
                    <Button
                        type="button"
                        size="chip"
                        variant={type === "income" ? "income" : "outline"}
                        aria-pressed={type === "income"}
                        onClick={() => edit(setType)("income")}
                    >
                        {t("income")}
                    </Button>
                </div>
            </FormRow>

            <FormRow asLabel label={t("amount")} required>
                <span className="flex min-w-0 flex-1 items-baseline gap-[10px]">
                    <Input
                        inputSize="amount"
                        inputMode="decimal"
                        autoComplete="off"
                        required
                        placeholder="0"
                        value={amount}
                        onChange={(event) =>
                            edit(setAmount)(event.target.value)
                        }
                    />
                    <Select value={currency} onValueChange={selectCurrency}>
                        <SelectTrigger
                            font="mono"
                            tone="mute"
                            triggerSize="sm"
                            underline="rule2"
                            aria-label={tCommon("currency")}
                            className="w-[66px] shrink-0 grow-0 justify-end"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="min-w-[104px]">
                            {CURRENCIES.map((option) => (
                                <SelectItem
                                    key={option.code}
                                    value={option.code}
                                    className="font-mono"
                                >
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </span>
            </FormRow>

            <FormRow asLabel label={t("description")} required>
                <Input
                    inputSize="lg"
                    autoComplete="off"
                    required
                    placeholder={t("descHint")}
                    value={title}
                    onChange={(event) => edit(setTitle)(event.target.value)}
                />
            </FormRow>

            {type === "outcome" ? (
                <FormRow label={t("category")} required>
                    <Select
                        value={categoryId}
                        onValueChange={edit(setCategoryId)}
                    >
                        <SelectTrigger
                            tone={categoryId === NONE ? "mute" : "ink"}
                            aria-label={t("category")}
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="min-w-[180px]">
                            <SelectItem value={NONE}>
                                {tCommon("noCategory")}
                            </SelectItem>
                            {categories.map((category) => (
                                <SelectItem
                                    key={category.id}
                                    value={String(category.id)}
                                >
                                    {categoryLabel(category, tCategories)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </FormRow>
            ) : null}

            <FormRow label={t("account")} className="border-b-rule">
                <Select value={accountId} onValueChange={edit(setAccountId)}>
                    <SelectTrigger
                        tone={accountId === NONE ? "mute" : "ink"}
                        aria-label={t("account")}
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="min-w-[180px]">
                        <SelectItem value={NONE}>
                            {tCommon("noAccount")}
                        </SelectItem>
                        {payable.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                                {account.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </FormRow>

            <div className="mt-[26px] flex flex-wrap items-center gap-5">
                <Button type="submit" disabled={isPending}>
                    {t("submit")}
                </Button>
                <Button type="button" variant="quiet" onClick={reset}>
                    {t("clear")}
                </Button>
                <span
                    role="status"
                    className={cn(
                        "text-[13px]",
                        message?.tone === "ok" ? "text-green" : "text-red",
                    )}
                >
                    {message?.text ?? ""}
                </span>
            </div>
        </form>
    );
}

/**
 * One ruled row: a fixed-width mono label on the left, the control filling the
 * rest, a hairline underneath. `asLabel` makes the whole row a `<label>`, which
 * is right for a plain input and wrong for a Radix trigger — a trigger is a
 * button, and wrapping it would swallow the click.
 */
function FormRow({
    label,
    required = false,
    asLabel = false,
    className,
    labelClassName,
    children,
}: {
    label: string;
    required?: boolean;
    asLabel?: boolean;
    className?: string;
    labelClassName?: string;
    children: React.ReactNode;
}) {
    const Row = asLabel ? "label" : "div";

    return (
        <Row
            className={cn(
                "flex items-baseline border-b border-b-rule2 py-[14px]",
                className,
            )}
        >
            <span
                className={cn(
                    "box-content shrink-0 basis-[92px] pr-6 font-mono text-[11px] tracking-[0.1em] text-mute uppercase",
                    labelClassName,
                )}
            >
                {label}
                {required ? (
                    <span aria-hidden className="text-red">
                        *
                    </span>
                ) : null}
            </span>
            <div className="flex min-w-0 flex-1">{children}</div>
        </Row>
    );
}
