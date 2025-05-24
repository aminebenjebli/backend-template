import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { BaseService } from '../../core/services/base.service';
import { PrismaService } from '../../core/services/prisma.service';
import { cryptPassword } from '../../core/utils/auth';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

@Injectable()
export class UserService extends BaseService<
    User,
    CreateUserDto,
    UpdateUserDto
> {
    constructor(private readonly prismaService: PrismaService) {
        super(prismaService.user, 'User');
    }

    async create(createDto: CreateUserDto): Promise<User> {
        const data = {
            ...createDto,
            password: await cryptPassword(createDto.password),
            isVerified: false
        };
        return super.create(data);
    }
    async update(id: string, updateDto: UpdateUserDto): Promise<User> {
        if (updateDto.password) {
            // Hash the password before updating
            updateDto.password = await cryptPassword(updateDto.password);
        }
        return super.update(id, updateDto);
    }
    async findAll(): Promise<User[]> {
        return super.findAll();
    }
    async findOne(id: string): Promise<User> {
        return super.findOne(id);
    }
}
