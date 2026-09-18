"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "cn";

import { ApiError } from "@/api/client";
import type { Transaction, TransactionType } from "@/api/types";
import { Button } from "@/components/ui/button";
import { FormRow } from "@/components/ui/form-row";
import { CurrencyFlag } from "@/components/ui/currency-flag";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { TypeSwitch } from "@/components/ui/type-switch";
import { usePreferences } from "@/contexts/preferences-context";
import {
    useCreateTransaction,
    useTransactionsConfiguration,
} from "@/hooks/use-transactions";
import { categoryLabel } from "@/lib/categories";
import { fromIsoDate, todayIso } from "@/lib/dates";
import { CURRENCIES, filterDecimalInput, parseAmountInput } from "@/lib/money";

/**
 * The entry form.
 *
 * It is a stack of ruled rows rather than a card of boxed fields: a label
 * at a fixed 92px, the control filling the rest, and the row's own hairline as
 * the only line. The heavier rule under Account closes the stack.
 *
 * Two rules come from the API rather than from the design, and neither fails
 * loudly if ignored: an entry posted to an account has to be in that account's
 * currency, which is why the account list is filtered by the currency picked
 * above it; and the amount travels as a decimal string, so it is normalised as
 * text and never round-tripped through a float. The amount field also refuses
 * anything but a figure as it is typed, so what is in it is always an amount —
 * `errAmount` is left for the one case filtering cannot cover, an empty or
 * zero field.
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
            {/* The switch is a box, not a line of text, so the label sits on
                the row's centre line — there is no baseline to share, and the
                nudge the two chips needed was measured against type that is
                no longer there. */}
            <FormRow
                label={t("type")}
                className="items-center border-t border-t-rule"
            >
                <TypeSwitch value={type} onChange={edit(setType)} />
            </FormRow>

            <FormRow asLabel label={t("title")} required>
                <Input
                    inputSize="lg"
                    autoComplete="off"
                    required
                    placeholder={t("titleHint")}
                    value={title}
                    onChange={(event) => edit(setTitle)(event.target.value)}
                />
            </FormRow>

            {/* The currency stays in the amount's own row, at the
                figure's right, under the row's own rule and no other line.
                It is set small against the amount: a flag and a code are a
                unit, not a second figure. */}
            <FormRow asLabel label={t("amount")} required>
                <span className="flex min-w-0 flex-1 items-baseline justify-between gap-6">
                    <Input
                        inputSize="amount"
                        inputMode="decimal"
                        autoComplete="off"
                        required
                        placeholder="0"
                        value={amount}
                        onChange={(event) =>
                            edit(setAmount)(
                                filterDecimalInput(event.target.value),
                            )
                        }
                    />
                    <Select value={currency} onValueChange={selectCurrency}>
                        <SelectTrigger
                            tone="mute"
                            aria-label={tCommon("currency")}
                            className="w-auto shrink-0 grow-0 justify-end"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="min-w-[104px]">
                            {CURRENCIES.map((option) => (
                                <SelectItem
                                    key={option.code}
                                    value={option.code}
                                >
                                    {/* Radix carries an item's own children
                                        into the trigger, so the flag rides
                                        along with the code it belongs to. */}
                                    <span className="flex items-center gap-[8px]">
                                        <CurrencyFlag code={option.code} />
                                        {option.label}
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </span>
            </FormRow>

            {type === "outcome" ? (
                <FormRow label={t("category")} required>
                    <Select
                        value={categoryId}
                        onValueChange={edit(setCategoryId)}
                    >
                        <SelectTrigger
                            tone={categoryId === NONE ? "faint" : "ink"}
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
                        tone={accountId === NONE ? "faint" : "ink"}
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
