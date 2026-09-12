"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "cn";

import { ApiError } from "@/api/client";
import type { Transaction, TransactionType } from "@/api/types";
import { EditIcon, TrashIcon, CloseIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { usePreferences } from "@/contexts/preferences-context";
import { useDateFormat } from "@/hooks/use-date-format";
import {
    useDeleteTransaction,
    useTransactionsConfiguration,
    useUpdateTransaction,
} from "@/hooks/use-transactions";
import { categoryLabel } from "@/lib/categories";
import { currencyLabel, parseAmountInput, signedValue } from "@/lib/money";

/**
 * One entry, opened from the ledger: read it, edit it, or delete it.
 *
 * Three things the API decides rather than the design. **The date cannot be
 * changed** — `PUT /v1/transactions` has no date field, deliberately, so an
 * entry cannot be moved to another day; the row is shown but not editable, and
 * moving an entry means deleting it and writing it again. **The currency
 * cannot be changed** either, because an entry posted to an account has to
 * match that account, so it is shown beside the amount as a label and the
 * account list is filtered by it. And **every field is replaced** on save, so
 * the payload carries the whole record — including the description, which this
 * dialog does not edit but must not drop.
 */

/** Radix cannot hold an empty string as a value, so absence needs a name. */
const NONE = "none";

type Mode = "view" | "edit" | "confirmDelete";

export function TransactionDialog({
    transaction,
    onClose,
    onSaved,
}: {
    /** The open entry, or null when the dialog is closed. */
    transaction: Transaction | null;
    onClose: () => void;
    onSaved: (transaction: Transaction) => void;
}) {
    return (
        <Dialog
            open={transaction !== null}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <DialogContent aria-describedby={undefined}>
                {/* Keyed so that opening a different entry starts the dialog
                    over in view mode rather than inside the last one's edit. */}
                {transaction ? (
                    <DialogBody
                        key={transaction.id}
                        transaction={transaction}
                        onClose={onClose}
                        onSaved={onSaved}
                    />
                ) : null}
            </DialogContent>
        </Dialog>
    );
}

function DialogBody({
    transaction,
    onClose,
    onSaved,
}: {
    transaction: Transaction;
    onClose: () => void;
    onSaved: (transaction: Transaction) => void;
}) {
    const t = useTranslations("entry");
    const tDetail = useTranslations("detail");
    const tCommon = useTranslations("common");
    const tCategories = useTranslations("categories");
    const { formatValue } = usePreferences();
    const { dayLabel } = useDateFormat();

    const { data: configuration } = useTransactionsConfiguration();
    const { mutate: updateTransaction, isPending: isSaving } =
        useUpdateTransaction();
    const { mutate: deleteTransaction, isPending: isDeleting } =
        useDeleteTransaction();

    const [mode, setMode] = useState<Mode>("view");
    const [error, setError] = useState<string | null>(null);

    const [type, setType] = useState<TransactionType>(transaction.type);
    const [amount, setAmount] = useState(() =>
        String(Math.abs(Number(transaction.amount.value)) || ""),
    );
    const [title, setTitle] = useState(transaction.title);
    const [categoryId, setCategoryId] = useState(
        transaction.category ? String(transaction.category.id) : NONE,
    );
    const [accountId, setAccountId] = useState(
        transaction.account ? transaction.account.id : NONE,
    );

    const currency = transaction.amount.currency;
    // The API refuses an entry whose currency is not its account's own.
    const payable = (configuration?.accounts ?? []).filter(
        (account) => account.currency === currency,
    );

    function startEdit() {
        setType(transaction.type);
        setAmount(String(Math.abs(Number(transaction.amount.value)) || ""));
        setTitle(transaction.title);
        setCategoryId(
            transaction.category ? String(transaction.category.id) : NONE,
        );
        setAccountId(transaction.account ? transaction.account.id : NONE);
        setError(null);
        setMode("edit");
    }

    function save() {
        if (isSaving) return;

        const value = parseAmountInput(amount);
        if (!value) {
            setError(t("errAmount"));
            return;
        }
        if (!title.trim()) {
            setError(t("errName"));
            return;
        }

        updateTransaction(
            {
                id: transaction.id,
                type,
                title: title.trim(),
                value,
                currency,
                // Not edited here, and an omitted one would be cleared.
                description: transaction.description,
                categoryId:
                    type === "income" || categoryId === NONE
                        ? null
                        : Number(categoryId),
                accountId: accountId === NONE ? null : accountId,
            },
            {
                onSuccess: (updated) => {
                    onSaved(updated);
                    setMode("view");
                    setError(null);
                },
                onError: (failure) => setError(messageOf(failure, tCommon)),
            },
        );
    }

    function remove() {
        if (isDeleting) return;

        deleteTransaction(transaction.id, {
            onSuccess: onClose,
            onError: (failure) => setError(messageOf(failure, tCommon)),
        });
    }

    const isIncome = transaction.type === "income";

    return (
        <>
            <DialogHeader>
                <DialogTitle>
                    {isIncome ? t("income") : t("expense")}
                </DialogTitle>

                {mode === "view" ? (
                    <>
                        <IconButton label={tDetail("edit")} onClick={startEdit}>
                            <EditIcon />
                        </IconButton>
                        <IconButton
                            label={tDetail("delete")}
                            tone="danger"
                            onClick={() => {
                                setError(null);
                                setMode("confirmDelete");
                            }}
                        >
                            <TrashIcon />
                        </IconButton>
                    </>
                ) : null}

                <IconButton label={tDetail("cancel")} onClick={onClose}>
                    <CloseIcon />
                </IconButton>
            </DialogHeader>

            {mode === "edit" ? (
                <>
                    <div className="mt-[14px] flex gap-[10px]">
                        <Button
                            type="button"
                            size="chip"
                            variant={type === "outcome" ? "expense" : "outline"}
                            aria-pressed={type === "outcome"}
                            onClick={() => {
                                setType("outcome");
                                setError(null);
                            }}
                        >
                            {t("expense")}
                        </Button>
                        <Button
                            type="button"
                            size="chip"
                            variant={type === "income" ? "income" : "outline"}
                            aria-pressed={type === "income"}
                            onClick={() => {
                                setType("income");
                                setError(null);
                            }}
                        >
                            {t("income")}
                        </Button>
                    </div>

                    <div className="mt-[14px] flex flex-col">
                        <DetailRow asLabel label={t("amount")} required>
                            <span className="flex min-w-0 flex-1 items-baseline gap-2">
                                <span className="font-mono text-[13px] text-mute">
                                    {currencyLabel(currency)}
                                </span>
                                <Input
                                    inputSize="amount"
                                    inputMode="decimal"
                                    autoComplete="off"
                                    required
                                    className="text-xl"
                                    value={amount}
                                    onChange={(event) => {
                                        setAmount(event.target.value);
                                        setError(null);
                                    }}
                                />
                            </span>
                        </DetailRow>

                        <DetailRow asLabel label={t("description")} required>
                            <Input
                                inputSize="lg"
                                autoComplete="off"
                                required
                                className="text-base"
                                value={title}
                                onChange={(event) => {
                                    setTitle(event.target.value);
                                    setError(null);
                                }}
                            />
                        </DetailRow>

                        {type === "outcome" ? (
                            <DetailRow label={t("category")}>
                                <Select
                                    value={categoryId}
                                    onValueChange={setCategoryId}
                                >
                                    <SelectTrigger
                                        triggerSize="sm"
                                        aria-label={t("category")}
                                        className="text-base"
                                        tone={
                                            categoryId === NONE ? "mute" : "ink"
                                        }
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="min-w-[180px]">
                                        <SelectItem value={NONE}>
                                            {tCommon("noCategory")}
                                        </SelectItem>
                                        {configuration?.categories.map(
                                            (category) => (
                                                <SelectItem
                                                    key={category.id}
                                                    value={String(category.id)}
                                                >
                                                    {categoryLabel(
                                                        category,
                                                        tCategories,
                                                    )}
                                                </SelectItem>
                                            ),
                                        )}
                                    </SelectContent>
                                </Select>
                            </DetailRow>
                        ) : null}

                        <DetailRow label={t("account")}>
                            <Select
                                value={accountId}
                                onValueChange={setAccountId}
                            >
                                <SelectTrigger
                                    triggerSize="sm"
                                    aria-label={t("account")}
                                    className="text-base"
                                    tone={accountId === NONE ? "mute" : "ink"}
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="min-w-[180px]">
                                    <SelectItem value={NONE}>
                                        {tCommon("noAccount")}
                                    </SelectItem>
                                    {payable.map((account) => (
                                        <SelectItem
                                            key={account.id}
                                            value={account.id}
                                        >
                                            {account.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </DetailRow>

                        {/* Shown, not editable: the API has no date field on an
                            update, so an entry cannot be moved to another day. */}
                        <DetailRow label={t("date")} className="border-b">
                            <span className="font-mono text-sm text-mute">
                                {dayLabel(transaction.date)}
                            </span>
                        </DetailRow>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            size="sm"
                            disabled={isSaving}
                            onClick={save}
                        >
                            {tDetail("save")}
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                setMode("view");
                                setError(null);
                            }}
                        >
                            {tDetail("cancel")}
                        </Button>
                        <ErrorNote>{error}</ErrorNote>
                    </DialogFooter>
                </>
            ) : (
                <>
                    <div className="mt-[14px] flex items-baseline gap-4">
                        <span className="min-w-0 flex-1 text-lg leading-[1.3] text-pretty">
                            {transaction.title}
                        </span>
                        <span
                            className={cn(
                                "font-mono text-xl tracking-[-0.01em] whitespace-nowrap",
                                isIncome ? "text-green" : "text-red",
                            )}
                        >
                            {formatValue(
                                signedValue(
                                    transaction.amount,
                                    transaction.type,
                                ),
                                transaction.amount.currency,
                                { signed: true },
                            )}
                        </span>
                    </div>

                    <div className="mt-[18px] flex flex-col">
                        <DetailRow label={t("category")} compact>
                            <span className="text-[15px]">
                                {transaction.category
                                    ? categoryLabel(
                                          transaction.category,
                                          tCategories,
                                      )
                                    : tCommon("noCategory")}
                            </span>
                        </DetailRow>
                        <DetailRow label={t("account")} compact>
                            <span className="text-[15px]">
                                {transaction.account?.name ??
                                    tCommon("noAccount")}
                            </span>
                        </DetailRow>
                        <DetailRow
                            label={t("date")}
                            compact
                            className="border-b"
                        >
                            <span className="font-mono text-sm">
                                {dayLabel(transaction.date)}
                            </span>
                        </DetailRow>
                    </div>

                    {transaction.description ? (
                        <p className="mt-[14px] text-sm text-pretty text-mute">
                            {transaction.description}
                        </p>
                    ) : null}

                    {mode === "confirmDelete" ? (
                        <DialogFooter>
                            <span className="mr-1 text-[13px]">
                                {tDetail("confirm")}
                            </span>
                            <Button
                                type="button"
                                size="sm"
                                variant="danger"
                                disabled={isDeleting}
                                onClick={remove}
                            >
                                {tDetail("delete")}
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setMode("view")}
                            >
                                {tDetail("cancel")}
                            </Button>
                            <ErrorNote>{error}</ErrorNote>
                        </DialogFooter>
                    ) : error ? (
                        <DialogFooter>
                            <ErrorNote>{error}</ErrorNote>
                        </DialogFooter>
                    ) : null}
                </>
            )}
        </>
    );
}

function messageOf(error: unknown, t: (key: string) => string): string {
    return error instanceof ApiError ? error.message : t("error");
}

function ErrorNote({ children }: { children: React.ReactNode }) {
    return (
        <span role="status" className="text-xs text-red">
            {children ?? ""}
        </span>
    );
}

function IconButton({
    label,
    tone = "default",
    onClick,
    children,
}: {
    label: string;
    tone?: "default" | "danger";
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            title={label}
            aria-label={label}
            onClick={onClick}
            className={cn(
                "flex size-6 cursor-pointer items-center justify-center text-mute transition-colors",
                tone === "danger" ? "hover:text-red" : "hover:text-ink",
            )}
        >
            {children}
        </button>
    );
}

/**
 * A row inside the dialog: a 92px mono label, the value, a hairline above.
 * `compact` is the reading density, the looser one is for editing.
 */
function DetailRow({
    label,
    required = false,
    compact = false,
    asLabel = false,
    className,
    children,
}: {
    label: string;
    required?: boolean;
    compact?: boolean;
    asLabel?: boolean;
    className?: string;
    children: React.ReactNode;
}) {
    const Row = asLabel ? "label" : "div";

    return (
        <Row
            className={cn(
                "flex items-baseline gap-[14px] border-t border-rule2",
                compact ? "py-[9px]" : "py-3",
                className,
            )}
        >
            <span className="shrink-0 basis-[92px] font-mono text-[11px] tracking-[0.1em] text-mute uppercase">
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
