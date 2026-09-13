"use client";

import { useTranslations } from "next-intl";
import { cn } from "cn";

import { AccountGate } from "@/components/layout/account-gate";
import { PageHeader } from "@/components/layout/page-header";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { usePreferences } from "@/contexts/preferences-context";
import {
    LOCALE_LABELS,
    SUPPORTED_LOCALES,
    type SupportedLocale,
} from "@/lib/locales";
import { CURRENCIES } from "@/lib/money";

/**
 * Settings, in full — the two preferences that change how every other screen
 * reads. Both are written back to the user record, so they follow the account
 * rather than the browser.
 *
 * Theme is not here: it lives in the sidebar, next to the thing it changes.
 *
 * Each setting is a ruled row — a fixed-width mono label, the control, and a
 * note underneath in the muted body size explaining what the change reaches.
 */
export default function SettingsPage() {
    const t = useTranslations("settings");

    return (
        <>
            <PageHeader title={t("title")} />

            <AccountGate>
                <Settings />
            </AccountGate>
        </>
    );
}

/**
 * The rows themselves. They are the half of the screen that is genuinely the
 * account — both controls read their current value off the user record — so
 * they sit behind the gate while the title above them does not.
 */
function Settings() {
    const t = useTranslations("settings");
    const { locale, setLocale, currency, setCurrency } = usePreferences();

    return (
        <div className="mt-[34px] flex max-w-[540px] flex-col gap-[30px]">
            <SettingRow label={t("language")} note={t("languageNote")}>
                <div className="flex items-baseline gap-4">
                    {SUPPORTED_LOCALES.map((code) => (
                        <LocaleButton
                            key={code}
                            code={code}
                            active={code === locale}
                            onSelect={setLocale}
                        />
                    ))}
                </div>
            </SettingRow>

            <SettingRow label={t("currency")} note={t("currencyNote")}>
                <Select value={currency} onValueChange={setCurrency}>
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
            </SettingRow>
        </div>
    );
}

function SettingRow({
    label,
    note,
    children,
}: {
    label: string;
    note: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <div className="flex items-baseline border-t border-t-rule border-b border-b-rule2 py-[18px]">
                <span className="shrink-0 basis-[150px] font-mono text-[11px] tracking-[0.1em] text-mute uppercase">
                    {label}
                </span>
                <div className="min-w-0 flex-1">{children}</div>
            </div>
            <p className="mt-3 max-w-[440px] text-sm leading-[1.5] text-pretty text-mute">
                {note}
            </p>
        </div>
    );
}

function LocaleButton({
    code,
    active,
    onSelect,
}: {
    code: SupportedLocale;
    active: boolean;
    onSelect: (locale: SupportedLocale) => void;
}) {
    return (
        <button
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(code)}
            className={cn(
                "cursor-pointer border-b py-[2px] font-mono text-[17px] transition-colors",
                active
                    ? "border-ink text-ink"
                    : "border-transparent text-mute hover:text-blue",
            )}
        >
            {LOCALE_LABELS[code]}
        </button>
    );
}
