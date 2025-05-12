import { MailerService } from '@nestjs-modules/mailer';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../core/services/prisma.service';
import { comparePassword, cryptPassword } from '../../core/utils/auth';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

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

        if (!user.isVerified) {
            // Generate and send new OTP for unverified users
            const otp = Math.floor(1000 + Math.random() * 9000).toString();
            await this.prisma.user.update({
                where: { email },
                data: {
                    otpCode: otp,
                    otpCodeExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
                }
            });

            await this.mailerService.sendMail({
                to: email,
                subject: 'Verify your account',
                template: 'verify-account',
                context: {
                    otp
                }
            });

            throw new UnauthorizedException('Please verify your account. A new verification code has been sent to your email.');
        }

        const token = this.jwtService.sign(
            {
                id: user.id,
                name: user.name,
                email: user.email,
                image: user.image
            },
            {
                expiresIn: '1d'
            }
        );

        const refreshToken = this.jwtService.sign(
            {
                id: user.id,
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

        const code = Math.floor(1000 + Math.random() * 9000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        await this.prisma.user.update({
            where: { email },
            data: {
                otpCode: code,
                otpCodeExpiresAt: expiresAt
            }
        });

        await this.mailerService.sendMail({
            to: user.email,
            subject: 'Reset password',
            template: 'reset-password',
            context: {
                code
            }
        });
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

        // Generate and return tokens after successful verification
        const token = this.jwtService.sign(
            {
                id: updatedUser.id,
                name: updatedUser.name,
                email: updatedUser.email,
                image: updatedUser.image
            },
            {
                expiresIn: '1d'
            }
        );

        const refreshToken = this.jwtService.sign(
            {
                id: updatedUser.id,
                name: updatedUser.name,
                email: updatedUser.email,
                image: updatedUser.image
            },
            {
                expiresIn: '7d'
            }
        );

        return { token, refreshToken };
    }

    async resendOtp(email: string) {
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user) throw new UnauthorizedException('User not found');

        const otp = Math.floor(1000 + Math.random() * 9000).toString();

        await this.mailerService.sendMail({
            to: email,
            subject: 'Verify your email',
            template: 'verify-account',
            context: {
                otp
            }
        });

        return this.prisma.user.update({
            where: { email },
            data: {
                otpCode: otp,
                otpCodeExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
                isVerified: false
            }
        });
    }
}
