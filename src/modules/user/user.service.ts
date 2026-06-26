import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ERROR_MESSAGES } from 'src/common/constants';
import { uploadImageToCloudinary } from 'src/common/helpers/cloudinary.helper';
import { PrismaService } from 'src/prisma/prisma.service';
import { GetAllUsersQueryDto } from './dto/get-all-users-query.dto';
import { MemberStatus } from '@prisma/client';

@Injectable()
export class UserService {
    constructor(private readonly prisma: PrismaService) { }

    async getMe(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { userId: userId },
        });
        if (!user) throw new NotFoundException(ERROR_MESSAGES.USER.USER_NOT_FOUND);

        const { password, lastOTP, refreshToken, ...rest } = user;

        return rest;
    }

    // Profile update
    async updateProfile(
        data: {
            userName?: string;
            profilePhotoUrl?: string;
        },
        currentUser: { userId: string },
        file?: Express.Multer.File,
    ) {
        const user = await this.prisma.user.findUnique({
            where: { userId: currentUser.userId },
        });
        if (!user) throw new NotFoundException(ERROR_MESSAGES.USER.USER_NOT_FOUND);

        let profilePhotoUrl = data.profilePhotoUrl;
        if (file) {
            try {
                profilePhotoUrl = await uploadImageToCloudinary(file.buffer);
            } catch (error) {
                throw new BadRequestException('Image upload failed');
            }
        }

        // Update fields
        await this.prisma.user.update({
            where: { userId: currentUser.userId },
            data: {
                name: data.userName,
                profileImage: profilePhotoUrl,
            },
        });
        return { message: 'Profile updated successfully' };
    }

    async getAllUser(query: GetAllUsersQueryDto) {
        const { search, page = 1, limit = 10, groupId } = query;
        const skip = (page - 1) * limit;

        const where: any = {
            isDeleted: false,
        };

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }

        if (groupId) {
            where.memberships = {
                none: {
                    groupId,
                    status: MemberStatus.ACTIVE,
                },
            };
        }

        const [users, total] = await Promise.all([
            this.prisma.user.findMany({
                where,
                select: {
                    userId: true,
                    name: true,
                    email: true,
                    profileImage: true,
                    role: true,
                },
                skip,
                take: limit,
                orderBy: { name: 'asc' },
            }),
            this.prisma.user.count({ where }),
        ]);

        return {
            users,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
}
