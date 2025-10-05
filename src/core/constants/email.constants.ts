export enum EmailTemplate {
    VERIFY_ACCOUNT = 'verify-account',
    RESET_PASSWORD = 'reset-password'
}

export enum EmailSubject {
    VERIFY_ACCOUNT = 'Verify your email',
    RESET_PASSWORD = 'Reset password'
}

export interface EmailOptions {
    template: EmailTemplate;
    subject: string;
}
