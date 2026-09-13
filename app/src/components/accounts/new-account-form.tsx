"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ApiError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { usePreferences } from "@/contexts/preferences-context";
import { useAccountsBalance, useCreateAccount } from "@/hooks/use-accounts";
import { Link, useRouter } from "@/i18n/navigation";
import {
    ACCOUNT_TYPES,
    type AccountType,
    DEFAULT_ACCOUNT_TYPE,
    newAccountColor,
} from "@/lib/accounts";
import { CURRENCIES, currencyLabel, parseDecimalInput } from "@/lib/money";

/**
 * Opening an account: a name, a type, a currency and what is already in it.
 *
 * Two of those four rows do not map onto the API one for one, and both are
 * explained in `@/lib/accounts` — the type is stored in `description` as a
 * slug, and the colour the API insists on is picked from the design's series
 * rather than by the person filling this in.
 *
 * The currency opens on the display currency, as the design does, which is
 * also why the form sits behind the gate: it is the one thing here that has to
 * come off the user record. The opening balance may be left empty — an account
 * with nothing in it is a real answer, so it is `parseDecimalInput` rather than
 * `parseAmountInput` that reads it, and an empty field is sent as no value at
 * all rather than as a zero.
 */
export function NewAccountForm() {
    const t = useTranslations("newAccount");
    const tTypes = useTranslations("accountTypes");
    const tCommon = useTranslations("common");

    const router = useRouter();
    const { currency: displayCurrency } = usePreferences();

    // Already in the cache on the way here from the Accounts screen; it is
    // read for the count alone, to cycle the stored colour.
    const { data: balance } = useAccountsBalance();
    const { mutate: createAccount, isPending } = useCreateAccount();

    const [name, setName] = useState("");
    const [type, setType] = useState<AccountType>(DEFAULT_ACCOUNT_TYPE);
    const [currency, setCurrency] = useState(displayCurrency);
    const [opening, setOpening] = useState("");
    const [error, setError] = useState<string | null>(null);

    /** Any edit clears the last outcome: it described the previous attempt. */
    function edit<T>(set: (value: T) => void) {
        return (value: T) => {
            set(value);
            setError(null);
        };
    }

    function submit(event: React.FormEvent) {
        event.preventDefault();
        // Enter in a field submits even while the button is disabled.
        if (isPending) return;

        if (!name.trim()) {
            setError(t("errName"));
            return;
        }

        const typed = opening.trim();
        const defaultValue = typed ? parseDecimalInput(typed) : null;
        if (typed && defaultValue === null) {
            setError(t("errOpening"));
            return;
        }

        createAccount(
            {
                name: name.trim(),
                description: type,
                colorHex: newAccountColor(balance?.accounts.length ?? 0),
                currency,
                defaultValue,
            },
            {
                onSuccess: () => router.push("/accounts"),
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
        <form onSubmit={submit} noValidate className="mt-[18px] flex flex-col">
            <FormRow
                asLabel
                label={t("name")}
                required
                labelClassName="basis-[108px] pr-0"
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
                label={t("type")}
                labelClassName="basis-[108px] pr-0 pt-[6px]"
                className="items-start"
            >
                <div className="flex flex-wrap gap-2">
                    {ACCOUNT_TYPES.map((option) => (
                        <Button
                            key={option}
                            type="button"
                            size="chip"
                            variant={type === option ? "solid" : "outline"}
                            aria-pressed={type === option}
                            onClick={() => edit(setType)(option)}
                        >
                            {tTypes(option)}
                        </Button>
                    ))}
                </div>
            </FormRow>

            <FormRow label={t("currency")} labelClassName="basis-[108px] pr-0">
                <Select value={currency} onValueChange={edit(setCurrency)}>
                    <SelectTrigger
                        font="mono"
                        aria-label={t("currency")}
                        className="w-full min-w-0"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="min-w-[140px]">
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
            </FormRow>

            <FormRow
                asLabel
                label={t("opening")}
                labelClassName="basis-[108px] pr-0"
                className="border-b-rule"
            >
                <span className="flex min-w-0 flex-1 items-baseline gap-[10px]">
                    <span className="font-mono text-[13px] text-mute">
                        {currencyLabel(currency)}
                    </span>
                    <Input
                        inputSize="amount"
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="0"
                        value={opening}
                        onChange={(event) =>
                            edit(setOpening)(event.target.value)
                        }
                    />
                </span>
            </FormRow>

            <div className="mt-[26px] flex flex-wrap items-center gap-5">
                <Button type="submit" disabled={isPending}>
                    {t("submit")}
                </Button>
                <Button asChild variant="quiet">
                    <Link href="/accounts">{t("cancel")}</Link>
                </Button>
                <span role="status" className="text-[13px] text-red">
                    {error ?? ""}
                </span>
            </div>
        </form>
    );
}
