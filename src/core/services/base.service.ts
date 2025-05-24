import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateUserDto } from '../../modules/user/dto/user.dto';

export class BaseService<
    T,
    CreateDTO,
    UpdateDTO,
    M extends Prisma.ModelName = any
> {
    constructor(
        private readonly prismaModel: any,
        private readonly modelName: M
    ) {}

    /**
     * Creates a new entity
     * @example
     * -- Create a new user
     * const newUser = await userService.create({
     *   email: 'john@example.com',
     *   name: 'John Doe',
     *   role: 'USER'
     * });
     *
     * -- Create a new user and include related data
     * const newUserWithProfile = await userService.create(
     *   { email: 'jane@example.com', name: 'Jane Doe' },
     *   { include: { profile: true } }
     * );
     * @param createDto - The data to create the entity
     * @param options - Query options like include, select, etc.
     * @throws {BadRequestException} When unique constraint is violated
     * @returns Promise with the created entity
     */
    async create(
        createDto: CreateDTO,
        options?: Prisma.Args<M, 'create'>
    ): Promise<T> {
        try {
            return await this.prismaModel.create({
                data: createDto,
                ...options
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2002') {
                    throw new BadRequestException(
                        'Unique constraint violation'
                    );
                }
            }
            throw error;
        }
    }

    /**
     * Retrieves all entities
     * @example
     * -- Get all users
     * const allUsers = await userService.findAll();
     *
     * -- Get all users with their posts
     * const usersWithPosts = await userService.findAll({
     *   include: { posts: true },
     *   orderBy: { createdAt: 'desc' }
     * });
     * @param options - Query options like include, select, where, etc.
     * @returns Promise with array of all entities
     */
    async findAll(options?: Prisma.Args<M, 'findMany'>): Promise<T[]> {
        return this.prismaModel.findMany(options);
    }

    async findOne(
        id: string | number,
        options?: Prisma.Args<M, 'findUnique'>
    ): Promise<T> {
        const entity = await this.prismaModel.findUnique({
            where: { id },
            ...options
        });
        if (!entity) {
            throw new NotFoundException(`${this.modelName}  not found`);
        }
        return entity;
    }

    async update(id: string | number, updateDto: UpdateDTO): Promise<T> {
        try {
            return await this.prismaModel.update({
                where: { id },
                data: updateDto
            });
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2025'
            ) {
                throw new NotFoundException(`${this.modelName}  not found`);
            }
            throw error;
        }
    }

    async remove(id: string | number): Promise<T> {
        try {
            return await this.prismaModel.delete({
                where: { id }
            });
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2025'
            ) {
                throw new NotFoundException(`${this.modelName}  not found`);
            }
            throw error;
        }
    }
}
