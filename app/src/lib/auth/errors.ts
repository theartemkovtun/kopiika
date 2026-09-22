/**
 * Cognito's exception names, turned into keys in `messages/*.json`.
 *
 * Amplify throws plain `Error`s whose `name` is the Cognito exception, so the
 * name is the only thing worth matching on — `message` is English prose from
 * AWS and has no place on a translated screen.
 *
 * `UserNotFoundException` is folded into the credentials message on purpose:
 * a pool with "prevent user existence errors" on never sends it, and answering
 * differently when it does would tell a stranger which addresses are
 * registered. The password-reset screen is the one place it is worth saying,
 * and it asks for that key itself.
 */
const KEY_BY_EXCEPTION: Record<string, string> = {
    NotAuthorizedException: "errCredentials",
    UserNotFoundException: "errCredentials",
    UsernameExistsException: "errEmailTaken",
    InvalidPasswordException: "errPasswordRejected",
    InvalidParameterException: "errInvalidInput",
    CodeMismatchException: "errCodeWrong",
    ExpiredCodeException: "errCodeExpired",
    LimitExceededException: "errTooMany",
    TooManyRequestsException: "errTooMany",
    TooManyFailedAttemptsException: "errTooMany",
    AttemptLimitExceededException: "errTooMany",
    CodeDeliveryFailureException: "errCodeDelivery",
};

/** The `auth` message key to show for a thrown Amplify error. */
export function authErrorKey(error: unknown): string {
    if (error instanceof Error) {
        const key = KEY_BY_EXCEPTION[error.name];
        if (key) return key;
    }

    return "errGeneric";
}

/** True for the one error that is a redirect rather than a message. */
export function isErrorNamed(error: unknown, name: string): boolean {
    return error instanceof Error && error.name === name;
}
