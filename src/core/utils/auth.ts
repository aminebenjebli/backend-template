import { MailerService } from '@nestjs-modules/mailer';
import * as bcrypt from 'bcryptjs';
import { EmailOptions } from '../constants/email.constants';

export const comparePassword = async (
    password: string,
    hashedPassword: string
) => {
    return bcrypt.compare(password, hashedPassword);
};

export const cryptPassword = async (password: string): Promise<string> => {
    return bcrypt.hash(password, 10);
};
/**
 * Generates a random OTP code of specified length
 * @param length - The length of the OTP code (default: 4)
 * @returns {string} The generated OTP code
 * @example
 * generateOTP() // returns "1234"
 * generateOTP(6) // returns "123456"
 */
export const generateOTP = (length: number = 4): string => {
    return Math.floor(Math.random() * Math.pow(10, length))
        .toString()
        .padStart(length, '0');
};

/**
 * Sends a verification email with the given OTP code
 * @param mailerService - A MailerService instance
 * @param email - The recipient's email address
 * @param otp - The OTP code to be sent
 * @param subject - The subject of the email (optional, default: 'Verify your email')
 * @param template - The name of the email template (optional, default: 'verify-account')
 * @returns {Promise<void>}
 * @example
 * sendOtpToEmail(mailerService, 'user@example.com', '1234')
 */
export const sendOtpToEmail = async (
    mailerService: MailerService,
    email: string,
    otp: string,
    emailOptions: EmailOptions
): Promise<void> => {
    await mailerService.sendMail({
        to: email,
        subject: emailOptions.subject,
        template: emailOptions.template,
        context: {
            otp
        }
    });
};
/**
 * Generates OTP, sends it via email, and updates user record
 * @param prisma - PrismaService instance
 * @param mailerService - MailerService instance
 * @param email - User's email
 * @param emailOptions - Email template and subject options
 * @param resetEmailVerified - Whether to reset email verification status
 * @returns Updated user record
 */
export const handleOtpOperation = async (
    prisma: any,
    mailerService: MailerService,
    email: string,
    emailOptions: EmailOptions,
    resetEmailVerified: boolean = false
) => {
    const otp = generateOTP();
    // Add 1 hour to align local time with PostgreSQL UTC interpretation
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    await sendOtpToEmail(mailerService, email, otp, emailOptions);

    return prisma.user.update({
        where: { email },
        data: {
            otpCode: otp,
            otpCodeExpiresAt: expiresAt,
            ...(resetEmailVerified && { isEmailVerified: false })
        }
    });
};
