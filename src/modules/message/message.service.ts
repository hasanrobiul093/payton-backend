import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMessageDto, UpdateMessageDto, ReactionDto } from './dto';
import { MemberStatus, MessageType } from '@prisma/client';

@Injectable()
export class MessageService {
  constructor(private prisma: PrismaService) {}

  // ─── SEND MESSAGE ──────────────────────────────────────

  async createMessage(groupId: string, senderId: string, dto: CreateMessageDto) {
    // Verify sender is an active member
    const member = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: senderId } },
    });

    if (!member || member.status !== MemberStatus.ACTIVE) {
      throw new ForbiddenException('You are not an active member of this group');
    }

    const message = await this.prisma.groupMessage.create({
      data: {
        groupId,
        senderId,
        content: dto.content,
        type: dto.type || MessageType.TEXT,
        replyToId: dto.replyToId || null,
      },
      include: {
        sender: {
          select: {
            userId: true,
            name: true,
            profileImage: true,
          },
        },
        replyTo: {
          select: {
            messageId: true,
            content: true,
            sender: {
              select: { name: true },
            },
          },
        },
      },
    });

    // Update group's updatedAt for sorting
    await this.prisma.group.update({
      where: { groupId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  // ─── GET MESSAGES (Paginated) ──────────────────────────

  async getMessages(groupId: string, userId: string, cursor?: string, take: number = 50) {
    // Verify user is a member
    const member = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });

    if (!member || member.status !== MemberStatus.ACTIVE) {
      throw new ForbiddenException('You are not an active member of this group');
    }

    const messages = await this.prisma.groupMessage.findMany({
      where: {
        groupId,
        isDeleted: false,
      },
      take: take + 1, // Fetch one extra to determine if there are more
      ...(cursor && {
        cursor: { messageId: cursor },
        skip: 1, // Skip the cursor itself
      }),
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: {
            userId: true,
            name: true,
            profileImage: true,
          },
        },
        replyTo: {
          select: {
            messageId: true,
            content: true,
            sender: {
              select: { name: true },
            },
          },
        },
        reactions: {
          select: {
            id: true,
            emoji: true,
            userId: true,
            user: {
              select: { name: true },
            },
          },
        },
      },
    });

    const hasMore = messages.length > take;
    const data = hasMore ? messages.slice(0, take) : messages;

    return {
      messages: data,
      nextCursor: hasMore ? data[data.length - 1].messageId : null,
      hasMore,
    };
  }

  // ─── EDIT MESSAGE ──────────────────────────────────────

  async editMessage(messageId: string, userId: string, dto: UpdateMessageDto) {
    const message = await this.prisma.groupMessage.findUnique({
      where: { messageId },
    });

    if (!message || message.isDeleted) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    return this.prisma.groupMessage.update({
      where: { messageId },
      data: {
        content: dto.content,
        isEdited: true,
      },
      include: {
        sender: {
          select: {
            userId: true,
            name: true,
            profileImage: true,
          },
        },
      },
    });
  }

  // ─── DELETE MESSAGE (Soft) ─────────────────────────────

  async deleteMessage(messageId: string, userId: string) {
    const message = await this.prisma.groupMessage.findUnique({
      where: { messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    return this.prisma.groupMessage.update({
      where: { messageId },
      data: { isDeleted: true },
    });
  }

  // ─── ADD REACTION ──────────────────────────────────────

  async addReaction(messageId: string, userId: string, dto: ReactionDto) {
    const message = await this.prisma.groupMessage.findUnique({
      where: { messageId },
    });

    if (!message || message.isDeleted) {
      throw new NotFoundException('Message not found');
    }

    // Upsert — toggle behavior: if reaction exists, remove it; if not, add it
    const existing = await this.prisma.messageReaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId,
          emoji: dto.emoji,
        },
      },
    });

    if (existing) {
      await this.prisma.messageReaction.delete({
        where: { id: existing.id },
      });
      return { action: 'removed', messageId, userId, emoji: dto.emoji };
    }

    const reaction = await this.prisma.messageReaction.create({
      data: {
        messageId,
        userId,
        emoji: dto.emoji,
      },
      include: {
        user: { select: { name: true } },
      },
    });

    return { action: 'added', ...reaction };
  }

  // ─── VERIFY MEMBERSHIP (for gateway use) ──────────────

  async verifyMembership(groupId: string, userId: string): Promise<boolean> {
    const member = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });

    return !!member && member.status === MemberStatus.ACTIVE;
  }
}
