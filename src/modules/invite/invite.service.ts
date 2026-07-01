import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { InviteType, InviteStatus, MemberStatus, GroupRole } from '@prisma/client';
import { randomBytes } from 'crypto';
import { sendGroupInviteEmail } from '../../common/helpers/mail.helper';

@Injectable()
export class InviteService {
  constructor(private prisma: PrismaService) {}

  // ─── CREATE INVITE ───────────────────────────────────────

  async createInvite(groupId: string, invitedBy: string, dto: CreateInviteDto) {
    // Verify the group exists and is active
    const group = await this.prisma.group.findUnique({
      where: { groupId },
    });

    if (!group || !group.isActive) {
      throw new NotFoundException('Group not found');
    }

    switch (dto.type) {
      case InviteType.USER:
        return this.createUserInvite(groupId, invitedBy, dto);
      case InviteType.EMAIL:
        return this.createEmailInvite(groupId, invitedBy, dto);
      case InviteType.CODE:
        return this.createCodeInvite(groupId, invitedBy, dto);
      default:
        throw new BadRequestException('Invalid invite type');
    }
  }

  // ─── TYPE: USER (Direct invite to a registered user) ────

  private async createUserInvite(groupId: string, invitedBy: string, dto: CreateInviteDto) {
    if (!dto.inviteeUserIds || dto.inviteeUserIds.length === 0) {
      throw new BadRequestException('inviteeUserIds is required for USER invite type');
    }

    // Check if all target users exist
    const targetUsers = await this.prisma.user.findMany({
      where: {
        userId: { in: dto.inviteeUserIds },
        isDeleted: false,
      },
    });

    if (targetUsers.length !== dto.inviteeUserIds.length) {
      throw new NotFoundException('One or more target users not found');
    }

    // Check if any user is already a member
    const existingMembers = await this.prisma.groupMember.findMany({
      where: {
        groupId,
        userId: { in: dto.inviteeUserIds },
        status: MemberStatus.ACTIVE,
      },
    });

    if (existingMembers.length > 0) {
      const existingUserIds = existingMembers.map(m => m.userId);
      throw new ConflictException(`Users already active in the group: ${existingUserIds.join(', ')}`);
    }

    // Check if there's already a pending invite for these users
    const existingInvites = await this.prisma.groupInvite.findMany({
      where: {
        groupId,
        inviteeUserId: { in: dto.inviteeUserIds },
        status: InviteStatus.PENDING,
      },
    });

    if (existingInvites.length > 0) {
      const existingUserIds = existingInvites.map(i => i.inviteeUserId);
      throw new ConflictException(`Pending invites already exist for users: ${existingUserIds.join(', ')}`);
    }

    const invites = await Promise.all(
      dto.inviteeUserIds.map((userId) =>
        this.prisma.groupInvite.create({
          data: {
            groupId,
            invitedBy,
            type: InviteType.USER,
            inviteeUserId: userId,
            expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
          },
          include: {
            group: { select: { name: true } },
            sender: { select: { name: true, email: true } },
            invitee: { select: { name: true, email: true } },
          },
        }),
      ),
    );

    return invites;
  }

  // ─── TYPE: EMAIL (Invite sent to an email address) ──────

  private async createEmailInvite(groupId: string, invitedBy: string, dto: CreateInviteDto) {
    if (!dto.inviteeEmail) {
      throw new BadRequestException('inviteeEmail is required for EMAIL invite type');
    }

    // Check if there's already a pending invite for this email
    const existingInvite = await this.prisma.groupInvite.findFirst({
      where: {
        groupId,
        inviteeEmail: dto.inviteeEmail,
        status: InviteStatus.PENDING,
      },
    });

    if (existingInvite) {
      throw new ConflictException('A pending invite already exists for this email');
    }

    // Check if a user with this email already exists and is a member
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.inviteeEmail },
    });

    if (existingUser) {
      const existingMember = await this.prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: existingUser.userId } },
      });

      if (existingMember && existingMember.status === MemberStatus.ACTIVE) {
        throw new ConflictException('A user with this email is already an active member');
      }
    }

    const inviteCode = randomBytes(3).toString('hex');

    const invite = await this.prisma.groupInvite.create({
      data: {
        groupId,
        invitedBy,
        type: InviteType.EMAIL,
        inviteeEmail: dto.inviteeEmail,
        inviteCode,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
      include: {
        group: { select: { name: true } },
        sender: { select: { name: true, email: true } },
      },
    });

    await sendGroupInviteEmail(
      dto.inviteeEmail,
      invite.group.name,
      invite.sender.name || invite.sender.email,
      inviteCode,
    );

    return invite;
  }

  // ─── TYPE: CODE (Shareable invite code/link) ────────────

  private async createCodeInvite(groupId: string, invitedBy: string, dto: CreateInviteDto) {
    const inviteCode = randomBytes(3).toString('hex'); // 12-char unique code

    return this.prisma.groupInvite.create({
      data: {
        groupId,
        invitedBy,
        type: InviteType.CODE,
        inviteCode,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
      include: {
        group: { select: { name: true } },
        sender: { select: { name: true, email: true } },
      },
    });
  }

  // ─── ACCEPT INVITE (for USER and EMAIL types) ──────────

  async acceptInvite(inviteId: string, userId: string) {
    const invite = await this.prisma.groupInvite.findUnique({
      where: { id: inviteId },
      include: { group: true },
    });

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    if (invite.status !== InviteStatus.PENDING) {
      throw new BadRequestException(`Invite is already ${invite.status.toLowerCase()}`);
    }

    // Check expiry
    if (invite.expiresAt && new Date() > invite.expiresAt) {
      await this.prisma.groupInvite.update({
        where: { id: inviteId },
        data: { status: InviteStatus.EXPIRED },
      });
      throw new BadRequestException('This invite has expired');
    }

    // For USER type, verify the accepting user is the intended invitee
    if (invite.type === InviteType.USER && invite.inviteeUserId !== userId) {
      throw new ForbiddenException('This invite is not for you');
    }

    // For EMAIL type, verify the accepting user's email matches
    if (invite.type === InviteType.EMAIL) {
      const user = await this.prisma.user.findUnique({ where: { userId } });
      if (!user || user.email !== invite.inviteeEmail) {
        throw new ForbiddenException('This invite is not for your email address');
      }
    }

    // Check if already a member
    const existingMember = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: invite.groupId, userId } },
    });

    if (existingMember && existingMember.status === MemberStatus.ACTIVE) {
      throw new ConflictException('You are already an active member of this group');
    }

    // Use transaction to accept invite and add member atomically
    return this.prisma.$transaction(async (tx) => {
      // Update the invite status
      const updatedInvite = await tx.groupInvite.update({
        where: { id: inviteId },
        data: {
          status: InviteStatus.ACCEPTED,
          acceptedAt: new Date(),
        },
      });

      // Add user as member (or reactivate if they were removed/left)
      if (existingMember) {
        await tx.groupMember.update({
          where: { groupId_userId: { groupId: invite.groupId, userId } },
          data: {
            status: MemberStatus.ACTIVE,
            role: GroupRole.MEMBER,
          },
        });
      } else {
        await tx.groupMember.create({
          data: {
            groupId: invite.groupId,
            userId,
            role: GroupRole.MEMBER,
            status: MemberStatus.ACTIVE,
          },
        });
      }

      return updatedInvite;
    });
  }

  // ─── DECLINE INVITE ────────────────────────────────────

  async declineInvite(inviteId: string, userId: string) {
    const invite = await this.prisma.groupInvite.findUnique({
      where: { id: inviteId },
    });

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    if (invite.status !== InviteStatus.PENDING) {
      throw new BadRequestException(`Invite is already ${invite.status.toLowerCase()}`);
    }

    // For USER type, verify the declining user is the intended invitee
    if (invite.type === InviteType.USER && invite.inviteeUserId !== userId) {
      throw new ForbiddenException('This invite is not for you');
    }

    return this.prisma.groupInvite.update({
      where: { id: inviteId },
      data: { status: InviteStatus.DECLINED },
    });
  }

  // ─── JOIN BY CODE ──────────────────────────────────────

  async joinByCode(code: string, userId: string) {
    // First try invite-level code
    let invite = await this.prisma.groupInvite.findUnique({
      where: { inviteCode: code },
      include: { group: true },
    });

    let groupId: string;

    if (invite) {
      // Validate invite code
      if (invite.status !== InviteStatus.PENDING) {
        throw new BadRequestException('This invite code is no longer valid');
      }

      if (invite.expiresAt && new Date() > invite.expiresAt) {
        await this.prisma.groupInvite.update({
          where: { id: invite.id },
          data: { status: InviteStatus.EXPIRED },
        });
        throw new BadRequestException('This invite code has expired');
      }

      groupId = invite.groupId;
    } else {
      // Try group-level invite code (from Group model)
      const group = await this.prisma.group.findUnique({
        where: { inviteCode: code },
      });

      if (!group || !group.isActive) {
        throw new NotFoundException('Invalid invite code');
      }

      groupId = group.groupId;
    }

    // Check if already a member
    const existingMember = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });

    if (existingMember && existingMember.status === MemberStatus.ACTIVE) {
      throw new ConflictException('You are already an active member of this group');
    }

    if (existingMember && existingMember.status === MemberStatus.BANNED) {
      throw new ForbiddenException('You are banned from this group');
    }

    // Use transaction
    return this.prisma.$transaction(async (tx) => {
      // If it was an invite-level code, mark the invite as accepted
      if (invite) {
        await tx.groupInvite.update({
          where: { id: invite.id },
          data: {
            status: InviteStatus.ACCEPTED,
            acceptedAt: new Date(),
            inviteeUserId: userId,
          },
        });
      }

      // Add or reactivate member
      if (existingMember) {
        return tx.groupMember.update({
          where: { groupId_userId: { groupId, userId } },
          data: {
            status: MemberStatus.ACTIVE,
            role: GroupRole.MEMBER,
          },
          include: {
            group: {
              select: {
                name: true,
              },
            },
          },
        });
      } else {
        return tx.groupMember.create({
          data: {
            groupId,
            userId,
            role: GroupRole.MEMBER,
            status: MemberStatus.ACTIVE,
          },
          include: {
            group: {
              select: {
                name: true,
              },
            },
          },
        });
      }
    });
  }

  // ─── REVOKE INVITE (by sender or admin/owner) ─────────

  async revokeInvite(inviteId: string) {
    const invite = await this.prisma.groupInvite.findUnique({
      where: { id: inviteId },
    });

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    if (invite.status !== InviteStatus.PENDING) {
      throw new BadRequestException(`Invite is already ${invite.status.toLowerCase()}`);
    }

    return this.prisma.groupInvite.update({
      where: { id: inviteId },
      data: { status: InviteStatus.REVOKED },
    });
  }

  // ─── LIST INVITES ──────────────────────────────────────

  async getGroupInvites(groupId: string) {
    return this.prisma.groupInvite.findMany({
      where: { groupId },
      include: {
        sender: { select: { name: true, email: true } },
        invitee: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMyPendingInvites(userId: string) {
    return this.prisma.groupInvite.findMany({
      where: {
        inviteeUserId: userId,
        status: InviteStatus.PENDING,
      },
      include: {
        group: { select: { groupId: true, name: true, description: true } },
        sender: { select: { name: true, email: true, profileImage: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
