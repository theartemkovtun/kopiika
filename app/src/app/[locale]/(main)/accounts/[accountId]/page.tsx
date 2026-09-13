import {
    AccountDetail,
    AccountDetailFallback,
} from "@/components/accounts/account-detail";
import { AccountGate } from "@/components/layout/account-gate";

/**
 * One account.
 *
 * A server component only so that it can unwrap `params`, which is a promise;
 * everything on the screen needs the balance read and the display currency, so
 * the whole of it sits behind the gate rather than a part.
 */
export default async function AccountPage({
    params,
}: {
    params: Promise<{ accountId: string }>;
}) {
    const { accountId } = await params;

    return (
        <AccountGate fallback={<AccountDetailFallback />}>
            <AccountDetail accountId={accountId} />
        </AccountGate>
    );
}
