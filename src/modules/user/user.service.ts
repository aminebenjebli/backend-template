import { ConflictException, Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { BaseService } from '../../core/services/base.service';
import { PrismaService } from '../../core/services/prisma.service';
import { cryptPassword, handleOtpOperation } from '../../core/utils/auth';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import {
    EmailSubject,
    EmailTemplate
} from 'src/core/constants/email.constants';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class UserService extends BaseService<
    User,
    CreateUserDto,
    UpdateUserDto
> {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly mailerService: MailerService
    ) {
        super(prismaService.user, 'User');
    }

    async create(createDto: CreateUserDto): Promise<User> {
        // Check if user already exists
        const existingUser = await this.prismaService.user.findUnique({
            where: { email: createDto.email }
        });

        if (existingUser) {
            throw new ConflictException('User with this email already exists');
        }

        // Préparer les données à insérer
        const userData: any = {
            ...createDto,
            password: await cryptPassword(createDto.password),
            isVerified: false
        };

        const user = await this.prismaService.user.create({
            data: userData
        });

        // Generate and send OTP for verification
        await handleOtpOperation(
            this.prismaService,
            this.mailerService,
            createDto.email,
            {
                template: EmailTemplate.VERIFY_ACCOUNT,
                subject: EmailSubject.VERIFY_ACCOUNT
            }
        );

        return user;
    }
}
