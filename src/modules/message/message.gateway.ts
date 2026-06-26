import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { MessageService } from './message.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userName?: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/',
})
export class MessageGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger('MessageGateway');

  // Track online users: userId -> Set of socketIds
  private onlineUsers = new Map<string, Set<string>>();

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private messageService: MessageService,
  ) { }

  // ─── CONNECTION LIFECYCLE ──────────────────────────────

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        this.logger.warn(`Client ${client.id} disconnected: No token provided`);
        client.emit('error', { message: 'Authentication required', code: 'UNAUTHORIZED' });
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const user = await this.prisma.user.findUnique({
        where: { userId: payload.sub },
        select: { userId: true, name: true, isActive: true },
      });

      if (!user || !user.isActive) {
        client.emit('error', { message: 'User not found or inactive', code: 'UNAUTHORIZED' });
        client.disconnect();
        return;
      }

      // Attach user info to socket
      client.userId = user.userId;
      client.userName = user.name;

      // Track online status
      if (!this.onlineUsers.has(user.userId)) {
        this.onlineUsers.set(user.userId, new Set());
      }
      this.onlineUsers.get(user.userId)!.add(client.id);

      this.logger.log(`Client connected: ${client.id} (User: ${user.name})`);
      client.emit('connected', { message: 'Connected successfully', userId: user.userId });

      // Fetch the user's active groups
      const userGroups = await this.prisma.groupMember.findMany({
        where: { userId: user.userId, status: 'ACTIVE' },
        select: { groupId: true }
      });
      this.logger.log('userGroups', userGroups);

      // Join all rooms automatically
      for (const group of userGroups) {
        client.join(`group:${group.groupId}`);
        this.logger.log(`Client ${client.id} joined group room: ${group.groupId}`);
      }

    } catch (error: any) {
      this.logger.warn(`Client ${client.id} auth failed: ${error.message}`);
      client.emit('error', { message: 'Invalid token', code: 'UNAUTHORIZED' });
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      const userSockets = this.onlineUsers.get(client.userId);
      if (userSockets) {
        userSockets.delete(client.id);
        if (userSockets.size === 0) {
          this.onlineUsers.delete(client.userId);
        }
      }
    }
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // ─── ROOM MANAGEMENT ──────────────────────────────────

  @SubscribeMessage('joinGroup')
  async handleJoinGroup(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: any,
  ) {
    try {
      const parsedData = this.parsePayload<{ groupId: string }>(data);
      this.logger.log(`joinGroup - parsedData: ${JSON.stringify(parsedData)}, userId: ${client.userId}`);

      if (!client.userId) {
        return { success: false, error: 'Not authenticated' };
      }

      if (!parsedData || !parsedData.groupId) {
        return { success: false, error: 'Group ID is required' };
      }

      const isMember = await this.messageService.verifyMembership(parsedData.groupId, client.userId);
      if (!isMember) {
        return { success: false, error: 'You are not a member of this group' };
      }

      client.join(`group:${parsedData.groupId}`);
      this.logger.log(`User ${client.userName} joined group room: ${parsedData.groupId}`);

      // Notify others in the room
      client.to(`group:${parsedData.groupId}`).emit('userJoinedRoom', {
        userId: client.userId,
        name: client.userName,
        groupId: parsedData.groupId,
      });

      return { success: true, message: `Joined group ${parsedData.groupId}` };
    } catch (error: any) {
      this.logger.error(`Error in joinGroup: ${error.message}`, error.stack);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('leaveGroup')
  async handleLeaveGroup(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: any,
  ) {
    try {
      const parsedData = this.parsePayload<{ groupId: string }>(data);
      this.logger.log(`leaveGroup - parsedData: ${JSON.stringify(parsedData)}, userId: ${client.userId}`);

      if (!parsedData || !parsedData.groupId) {
        return { success: false, error: 'Group ID is required' };
      }

      client.leave(`group:${parsedData.groupId}`);
      this.logger.log(`User ${client.userName} left group room: ${parsedData.groupId}`);

      client.to(`group:${parsedData.groupId}`).emit('userLeftRoom', {
        userId: client.userId,
        name: client.userName,
        groupId: parsedData.groupId,
      });

      return { success: true, message: `Left group ${parsedData.groupId}` };
    } catch (error: any) {
      this.logger.error(`Error in leaveGroup: ${error.message}`, error.stack);
      return { success: false, error: error.message };
    }
  }

  // ─── MESSAGING ─────────────────────────────────────────

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: any,
  ) {
    if (!client.userId) {
      return { success: false, error: 'Not authenticated' };
    }

    const parsedData = this.parsePayload<{ groupId: string; content: string; type?: string; replyToId?: string }>(data);

    try {
      const message = await this.messageService.createMessage(
        parsedData.groupId,
        client.userId,
        {
          content: parsedData.content,
          type: (parsedData.type as any) || 'TEXT',
          replyToId: parsedData.replyToId,
        },
      );

      // Broadcast to everyone in the room (including sender)
      this.server.to(`group:${parsedData.groupId}`).emit('newMessage', message);

      return { success: true, data: message };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('editMessage')
  async handleEditMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: any,
  ) {
    if (!client.userId) {
      return { success: false, error: 'Not authenticated' };
    }

    const parsedData = this.parsePayload<{ messageId: string; groupId: string; content: string }>(data);

    try {
      const message = await this.messageService.editMessage(
        parsedData.messageId,
        client.userId,
        { content: parsedData.content },
      );

      this.server.to(`group:${parsedData.groupId}`).emit('messageEdited', message);

      return { success: true, data: message };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('deleteMessage')
  async handleDeleteMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: any,
  ) {
    if (!client.userId) {
      return { success: false, error: 'Not authenticated' };
    }

    const parsedData = this.parsePayload<{ messageId: string; groupId: string }>(data);

    try {
      await this.messageService.deleteMessage(parsedData.messageId, client.userId);

      this.server.to(`group:${parsedData.groupId}`).emit('messageDeleted', {
        messageId: parsedData.messageId,
        groupId: parsedData.groupId,
        deletedBy: client.userId,
      });

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ─── REACTIONS ─────────────────────────────────────────

  @SubscribeMessage('reactMessage')
  async handleReaction(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: any,
  ) {
    if (!client.userId) {
      return { success: false, error: 'Not authenticated' };
    }

    const parsedData = this.parsePayload<{ messageId: string; groupId: string; emoji: string }>(data);

    try {
      const result = await this.messageService.addReaction(
        parsedData.messageId,
        client.userId,
        { emoji: parsedData.emoji },
      );

      this.server.to(`group:${parsedData.groupId}`).emit('messageReaction', {
        ...result,
        groupId: parsedData.groupId,
        userName: client.userName,
      });

      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ─── TYPING INDICATOR ─────────────────────────────────

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: any,
  ) {
    if (!client.userId) return;

    const parsedData = this.parsePayload<{ groupId: string; isTyping: boolean }>(data);

    client.to(`group:${parsedData.groupId}`).emit('userTyping', {
      userId: client.userId,
      name: client.userName,
      groupId: parsedData.groupId,
      isTyping: parsedData.isTyping,
    });
  }

  // ─── GET MESSAGES (via socket for real-time pagination) ─

  @SubscribeMessage('getMessages')
  async handleGetMessages(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: any,
  ) {
    if (!client.userId) {
      return { success: false, error: 'Not authenticated' };
    }

    const parsedData = this.parsePayload<{ groupId: string; cursor?: string; take?: number }>(data);

    try {
      const result = await this.messageService.getMessages(
        parsedData.groupId,
        client.userId,
        parsedData.cursor,
        parsedData.take,
      );

      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ─── ONLINE STATUS ────────────────────────────────────

  @SubscribeMessage('getOnlineUsers')
  handleGetOnlineUsers(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: any,
  ) {
    const parsedData = this.parsePayload<{ groupId: string }>(data);
    const room = this.server.sockets.adapter.rooms.get(`group:${parsedData.groupId}`);
    if (!room) return { success: true, data: [] };

    const onlineUserIds: string[] = [];
    for (const socketId of room) {
      const socket = this.server.sockets.sockets.get(socketId) as AuthenticatedSocket;
      if (socket?.userId && !onlineUserIds.includes(socket.userId)) {
        onlineUserIds.push(socket.userId);
      }
    }

    return { success: true, data: onlineUserIds };
  }

  // ─── HELPERS ───────────────────────────────────────────

  private parsePayload<T>(data: any): T {
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch (error) {
        this.logger.error(`Failed to parse payload string: ${data}`);
        return data as unknown as T;
      }
    }
    return data;
  }

  private extractToken(client: Socket): string | null {
    // Try auth.token first (recommended)
    const authToken = client.handshake?.auth?.token;
    if (authToken) {
      return authToken.replace('Bearer ', '');
    }

    // Fallback to authorization header
    const authHeader = client.handshake?.headers?.authorization;
    if (authHeader) {
      return authHeader.replace('Bearer ', '');
    }

    // Fallback to query param
    const queryToken = client.handshake?.query?.token as string;
    if (queryToken) {
      return queryToken.replace('Bearer ', '');
    }

    return null;
  }
}
