"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ApiError } from "@/api/client";
import { ColorField } from "@/components/accounts/color-field";
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
import { newAccountColor } from "@/lib/accounts";
import { CURRENCIES, parseDecimalInput } from "@/lib/money";

/** The design's own label column on this form: 160px, no gutter. */
const LABEL = "basis-[160px] pr-0";

/**
 * Opening an account: a name, a currency, a colour and what is already in it.
 *
 * The **colour** is the row that does not look like one. `colorHex` is
 * required by the API and is what the account is drawn in everywhere after
 * this, so v9 gives it a picker rather than assigning one quietly; see
 * `ColorField`. Until someone touches it the field shows the next colour in
 * the series, which is why the suggestion is derived rather than held in
 * state — the account count arrives with the balance read, after this mounts,
 * and a suggestion that ignored it would hand the first two accounts the same
 * colour.
 *
 * The currency opens on the display currency, as the design does, which is
 * also why the form sits behind the gate: it is the one thing here that has to
 * come off the user record. The opening balance may be left empty — an account
 * with nothing in it is a real answer, so it is `parseDecimalInput` rather than
 * `parseAmountInput` that reads it, and an empty field is sent as no value at
 * all rather than as a zero.
 *
 * Nothing is written to the API's `description` any more: the account type the
 * earlier design collected was dropped in v8 and has no field here in v9.
 */
export function NewAccountForm() {
    const t = useTranslations("newAccount");
    const tAccounts = useTranslations("accounts");
    const tCommon = useTranslations("common");

    const router = useRouter();
    const { currency: displayCurrency } = usePreferences();

    // Already in the cache on the way here from the Accounts screen; it is
    // read for the count alone, to cycle the suggested colour.
    const { data: balance } = useAccountsBalance();
    const { mutate: createAccount, isPending } = useCreateAccount();

    const [name, setName] = useState("");
    const [currency, setCurrency] = useState(displayCurrency);
    const [picked, setPicked] = useState<string | null>(null);
    const [opening, setOpening] = useState("");
    const [error, setError] = useState<string | null>(null);

    const color = picked ?? newAccountColor(balance?.accounts.length ?? 0);

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
                colorHex: color,
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

            <FormRow label={t("currency")} labelClassName={LABEL}>
                <Select value={currency} onValueChange={edit(setCurrency)}>
                    <SelectTrigger
                        aria-label={t("currency")}
                        className="w-full min-w-0"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="min-w-[140px]">
                        {CURRENCIES.map((option) => (
                            <SelectItem key={option.code} value={option.code}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </FormRow>

            {/* Swatches are a row of buttons, so this row cannot be a label and
                sits on the centre line rather than on a baseline there is no
                text to share. */}
            <FormRow
                label={tAccounts("color")}
                labelClassName={LABEL}
                className="items-center"
            >
                <ColorField value={color} onChange={edit(setPicked)} />
            </FormRow>

            <FormRow
                asLabel
                label={t("opening")}
                labelClassName={LABEL}
                className="border-b-rule"
            >
                <Input
                    inputSize="amount"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0"
                    value={opening}
                    onChange={(event) => edit(setOpening)(event.target.value)}
                />
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
