import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ERROR_MESSAGES } from 'src/common/constants';
import { uploadImageToCloudinary } from 'src/common/helpers/cloudinary.helper';
import { PrismaService } from 'src/prisma/prisma.service';

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
}
