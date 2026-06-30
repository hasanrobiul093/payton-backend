import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { MuteGroupDto } from './dto/mute-group.dto';
import { GroupRole, MemberStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { uploadImageToCloudinary } from '../../common/helpers/cloudinary.helper';

@Injectable()
export class GroupService {
  constructor(private prisma: PrismaService) {}

  async createGroup(userId: string, data: CreateGroupDto, file?: Express.Multer.File) {
    let photoUrl: string | undefined = undefined;
    if (file) {
      try {
        photoUrl = await uploadImageToCloudinary(file.buffer);
      } catch (error) {
        throw new BadRequestException('Image upload failed');
      }
    }

    const inviteCode = randomBytes(3).toString('hex'); // Generate simple cuid alternative or leave it to DB default

    const group = await this.prisma.group.create({
      data: {
        name: data.name,
        description: data.description,
        photo: photoUrl,
        isPrivate: data.isPrivate ?? true,
        createdBy: userId,
        members: {
          create: {
            userId,
            role: GroupRole.OWNER,
            status: MemberStatus.ACTIVE,
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              }
            }
          }
        }
      }
    });

    return group;
  }

  async getMyGroups(userId: string) {
    return this.prisma.group.findMany({
      where: {
        members: {
          some: {
            userId,
            status: MemberStatus.ACTIVE,
          },
        },
        isActive: true,
      },
      include: {
        members: {
          where: {
            userId,
          },
          select: {
            role: true,
            isMuted: true,
            lastReadAt: true,
          }
        },
        _count: {
          select: {
            members: {
              where: {
                status: MemberStatus.ACTIVE,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getGroupDetails(groupId: string, userId: string) {
    const group = await this.prisma.group.findUnique({
      where: { groupId },
      include: {
        members: {
          where: { status: MemberStatus.ACTIVE },
          include: {
            user: {
              select: {
                userId: true,
                name: true,
                email: true,
                profileImage: true,
              }
            }
          }
        },
      },
    });

    if (!group || !group.isActive) {
      throw new NotFoundException('Group not found');
    }

    return group;
  }

  async updateGroup(groupId: string, data: UpdateGroupDto, file?: Express.Multer.File) {
    let photoUrl: string | undefined = undefined;
    if (file) {
      try {
        photoUrl = await uploadImageToCloudinary(file.buffer);
      } catch (error) {
        throw new BadRequestException('Image upload failed');
      }
    }

    const updateData: any = { ...data };
    if (photoUrl) {
      updateData.photo = photoUrl;
    }

    return this.prisma.group.update({
      where: { groupId },
      data: updateData,
    });
  }

  async deleteGroup(groupId: string) {
    return this.prisma.group.update({
      where: { groupId },
      data: { isActive: false },
    });
  }

  async rotateInviteCode(groupId: string) {
    const newCode = randomBytes(3).toString('hex');
    return this.prisma.group.update({
      where: { groupId },
      data: { inviteCode: newCode },
    });
  }

  // --- MEMBER MANAGEMENT ---

  async getMembers(groupId: string) {
    return this.prisma.groupMember.findMany({
      where: { groupId, status: MemberStatus.ACTIVE },
      include: {
        user: {
          select: {
            userId: true,
            name: true,
            profileImage: true,
            email: true,
          }
        }
      }
    });
  }

  async updateMemberRole(groupId: string, targetUserId: string, data: UpdateMemberRoleDto) {
    const member = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: targetUserId } },
    });

    if (!member || member.status !== MemberStatus.ACTIVE) {
      throw new NotFoundException('Active member not found');
    }

    if (member.role === GroupRole.OWNER) {
      throw new ForbiddenException('Cannot change role of the owner directly');
    }

    return this.prisma.groupMember.update({
      where: { groupId_userId: { groupId, userId: targetUserId } },
      data: { role: data.role },
    });
  }

  async removeMember(groupId: string, targetUserId: string) {
    const member = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: targetUserId } },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    if (member.role === GroupRole.OWNER) {
      throw new ForbiddenException('Owner cannot be removed');
    }

    return this.prisma.groupMember.update({
      where: { groupId_userId: { groupId, userId: targetUserId } },
      data: { status: MemberStatus.REMOVED },
    });
  }

  async leaveGroup(groupId: string, userId: string) {
    const member = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });

    if (!member || member.status !== MemberStatus.ACTIVE) {
      throw new NotFoundException('Active member not found');
    }

    if (member.role === GroupRole.OWNER) {
      throw new ForbiddenException('Owner must transfer ownership before leaving or delete the group');
    }

    return this.prisma.groupMember.update({
      where: { groupId_userId: { groupId, userId } },
      data: { status: MemberStatus.LEFT },
    });
  }

  async toggleMute(groupId: string, userId: string, data: MuteGroupDto) {
    return this.prisma.groupMember.update({
      where: { groupId_userId: { groupId, userId } },
      data: {
        isMuted: data.isMuted,
        mutedUntil: data.mutedUntil ? new Date(data.mutedUntil) : null,
      },
    });
  }

  async markAsRead(groupId: string, userId: string) {
    return this.prisma.groupMember.update({
      where: { groupId_userId: { groupId, userId } },
      data: {
        lastReadAt: new Date(),
      },
    });
  }
}
