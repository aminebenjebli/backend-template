import { MailerService } from '@nestjs-modules/mailer';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../core/services/prisma.service';
import {
    comparePassword,
    cryptPassword,
    handleOtpOperation
} from '../../core/utils/auth';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import {
    EmailSubject,
    EmailTemplate
} from 'src/core/constants/email.constants';

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
        private readonly mailerService: MailerService
    ) {}

    async signIn(credentials: LoginDto) {
        const { email, password } = credentials;

        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user) throw new UnauthorizedException('Invalid credentials');

        const isPasswordValid = await comparePassword(password, user.password);
        if (!isPasswordValid)
            throw new UnauthorizedException('Invalid credentials');

        if (!user.isVerified)
            throw new UnauthorizedException(
                'User Not Verified check your email for verification'
            );

        const token = this.jwtService.sign(
            {
                sub: user.id, // Standard JWT subject
                name: user.name,
                email: user.email,
                image: user.image
            },
            {
                expiresIn: '15m'
            }
        );

        const refreshToken = this.jwtService.sign(
            {
                sub: user.id, // Standard JWT subject
                name: user.name,
                email: user.email,
                image: user.image
            },
            {
                expiresIn: '7d'
            }
        );

        return { token, refreshToken };
    }
    async refreshToken(refreshToken: string) {
        try {
            const { sub } = this.jwtService.verify(refreshToken); // Changed from id to sub
            const user = await this.prisma.user.findUnique({
                where: { id: sub }
            }); // Use sub as user ID
            if (!user) throw new UnauthorizedException('User not found');

            const token = this.jwtService.sign(
                {
                    sub: user.id, // Standard JWT subject
                    name: user.name,
                    email: user.email,
                    image: user.image
                },
                {
                    expiresIn: '15m'
                }
            );

            return { token, refreshToken };
        } catch (error) {
            console.error('Refresh token error:', error);
            throw new UnauthorizedException('Invalid refresh token');
        }
    }
    async verifyOtp(otpDto: VerifyOtpDto) {
        const { email, otpCode, type = 'verify' } = otpDto;

        // First find user by email and OTP without additional conditions
        const user = await this.prisma.user.findFirst({
            where: {
                email,
                otpCode
            }
        });

        if (!user) {
            throw new UnauthorizedException('Invalid OTP');
        }

        // Check if OTP has expired
        if (
            user.otpCodeExpiresAt &&
            user.otpCodeExpiresAt < new Date(Date.now())
        ) {
            throw new UnauthorizedException(
                'OTP has expired. Please request a new one.'
            );
        }

        // Handle email verification case
        if (type === 'verify') {
            if (user.isVerified) {
                throw new UnauthorizedException('Email is already verified');
            }

            await this.prisma.user.update({
                where: { email },
                data: {
                    otpCode: null,
                    otpCodeExpiresAt: null,
                    isVerified: true
                }
            });

            return {
                message: 'Email verified successfully'
            };
        }

        // Handle password reset case (type === 'reset')
        // Only clear the OTP, don't change verification status
        await this.prisma.user.update({
            where: { email },
            data: {
                otpCode: null,
                otpCodeExpiresAt: null
            }
        });

        return {
            message: 'OTP verified successfully, proceed with password reset'
        };
    }

    async resendOtp(email: string, type: 'verify' | 'reset' = 'verify') {
        if (!email) {
            throw new UnauthorizedException('Email is required');
        }

        // Check if user exists
        const user = await this.prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        // For verification type, check if already verified
        if (type === 'verify' && user.isVerified) {
            throw new UnauthorizedException('Email already verified');
        }

        // Choose template and subject based on type
        const emailOptions =
            type === 'verify'
                ? {
                      template: EmailTemplate.VERIFY_ACCOUNT,
                      subject: EmailSubject.VERIFY_ACCOUNT
                  }
                : {
                      template: EmailTemplate.RESET_PASSWORD,
                      subject: EmailSubject.RESET_PASSWORD
                  };

        await handleOtpOperation(
            this.prisma,
            this.mailerService,
            email,
            emailOptions
        );
    }
    async forgetPassword(email: string): Promise<void> {
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user) throw new UnauthorizedException('User not found');

        await handleOtpOperation(this.prisma, this.mailerService, email, {
            template: EmailTemplate.RESET_PASSWORD,
            subject: EmailSubject.RESET_PASSWORD
        });
    }

    async resetPassword(email: string, newPassword: string): Promise<void> {
        const hashedPassword = await cryptPassword(newPassword);
        await this.prisma.user.update({
            where: { email },
            data: { password: hashedPassword }
        });
    }
}
