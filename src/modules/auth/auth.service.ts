import { MailerService } from '@nestjs-modules/mailer';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../core/services/prisma.service';
import { comparePassword, cryptPassword } from '../../core/utils/auth';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
        private readonly mailerService: MailerService
    ) {}

    private async generateAndSendOtp(
        email: string,
        purpose: 'verification' | 'reset' = 'verification'
    ) {
        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        await this.prisma.user.update({
            where: { email },
            data: {
                otpCode: otp,
                otpCodeExpiresAt: expiresAt
            }
        });

        try {
            await this.mailerService.sendMail({
                to: email,
                subject:
                    purpose === 'verification'
                        ? '🎉 Welcome to Business Opportunity Match - Verify Your Account'
                        : '🔐 Reset Your Password - Business Opportunity Match',
                template: `./${purpose === 'verification' ? 'verify-account' : 'reset-password'}`,
                context: {
                    otp,
                    code: otp
                }
            });
        } catch (error) {
            console.error('Email sending error:', error);
            throw new Error('Failed to send email');
        }

        return otp;
    }

    private generateTokens(user: User) {
        const payload = {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image
        };

        const token = this.jwtService.sign(payload, { expiresIn: '1d' });
        const refreshToken = this.jwtService.sign(payload, {
            expiresIn: '7d'
        });

        return { token, refreshToken };
    }

    async signIn(credentials: LoginDto) {
        const { email, password } = credentials;

        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user) throw new UnauthorizedException('Invalid credentials');

        const isPasswordValid = await comparePassword(password, user.password);
        if (!isPasswordValid)
            throw new UnauthorizedException('Invalid credentials');

        if (!user.isVerified) {
            await this.generateAndSendOtp(email, 'verification');
            throw new UnauthorizedException(
                'Please verify your account. A new verification code has been sent to your email.'
            );
        }

        return this.generateTokens(user);
    }

    async refreshToken(refreshToken: string) {
        const { id } = this.jwtService.verify(refreshToken);
        const user = await this.prisma.user.findUnique({ where: { id } });
        if (!user) throw new UnauthorizedException('User not found');

        const token = this.jwtService.sign({
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image
        });
        return { token, refreshToken };
    }

    async forgetPassword(email: string): Promise<void> {
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user) throw new UnauthorizedException('User not found');

        await this.generateAndSendOtp(email, 'reset');
    }

    async resetPassword(email: string, newPassword: string): Promise<void> {
        const hashedPassword = await cryptPassword(newPassword);
        await this.prisma.user.update({
            where: { email },
            data: { password: hashedPassword }
        });
    }

    async verifyOtp(otpDto: VerifyOtpDto) {
        const user = await this.prisma.user.findFirst({
            where: {
                email: otpDto.email,
                otpCode: otpDto.otpCode,
                otpCodeExpiresAt: {
                    gt: new Date()
                }
            }
        });
        if (!user) throw new UnauthorizedException('Invalid or expired OTP');

        const updatedUser = await this.prisma.user.update({
            where: { email: otpDto.email },
            data: {
                otpCode: null,
                otpCodeExpiresAt: null,
                isVerified: true
            }
        });

        return this.generateTokens(updatedUser);
    }

    async resendOtp(email: string) {
        if (!email) {
            throw new UnauthorizedException('Email is required');
        }
        const user = await this.prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            throw new UnauthorizedException(
                'No account found with this email address'
            );
        }

        // Don't check for verification status since this is part of the verification flow
        await this.generateAndSendOtp(email, 'verification');

        return {
            success: true,
            message: 'A new verification code has been sent to your email'
        };
    }
}
