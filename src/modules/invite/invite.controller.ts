import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InviteService } from './invite.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GetCurrentUser } from '../../common/decorator/get-current-user.decorator';
import { GroupRoles } from '../../common/decorator/group-roles.decorator';
import { GroupRoleGuard } from '../../common/guards/group-role.guard';
import { GroupRole } from '@prisma/client';
import { CreateInviteDto, JoinByCodeDto } from './dto';
import { sendResponse } from 'src/common/helpers';

@ApiTags('Group Invites')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('invites')
export class InviteController {
  constructor(private readonly inviteService: InviteService) {}

  // ─── SENDER ACTIONS ──────────────────────────────────────

  @Post('groups/:groupId')
  @UseGuards(GroupRoleGuard)
  @GroupRoles(GroupRole.OWNER, GroupRole.ADMIN)
  @ApiOperation({ summary: 'Create a new invite (USER, EMAIL, or CODE type)' })
  async createInvite(
    @Param('groupId') groupId: string,
    @GetCurrentUser('userId') userId: string,
    @Body() dto: CreateInviteDto,
  ) {
    const result = await this.inviteService.createInvite(groupId, userId, dto);
    return sendResponse(HttpStatus.CREATED, 'Invite created successfully', result);
  }

  @Get('groups/:groupId')
  @UseGuards(GroupRoleGuard)
  @GroupRoles(GroupRole.OWNER, GroupRole.ADMIN)
  @ApiOperation({ summary: 'List all invites for a group' })
  async getGroupInvites(@Param('groupId') groupId: string) {
    const result = await this.inviteService.getGroupInvites(groupId);
    return sendResponse(HttpStatus.OK, 'Group invites fetched successfully', result);
  }

  @Delete(':inviteId/revoke')
  @ApiOperation({ summary: 'Revoke a pending invite (admin/owner)' })
  async revokeInvite(@Param('inviteId') inviteId: string) {
    const result = await this.inviteService.revokeInvite(inviteId);
    return sendResponse(HttpStatus.OK, 'Invite revoked successfully', result);
  }

  // ─── RECEIVER ACTIONS ────────────────────────────────────

  @Get('my-pending')
  @ApiOperation({ summary: 'List my pending invites (received)' })
  async getMyPendingInvites(@GetCurrentUser('userId') userId: string) {
    const result = await this.inviteService.getMyPendingInvites(userId);
    return sendResponse(HttpStatus.OK, 'Pending invites fetched successfully', result);
  }

  @Post(':inviteId/accept')
  @ApiOperation({ summary: 'Accept an invite (USER or EMAIL type)' })
  async acceptInvite(
    @Param('inviteId') inviteId: string,
    @GetCurrentUser('userId') userId: string,
  ) {
    const result = await this.inviteService.acceptInvite(inviteId, userId);
    return sendResponse(HttpStatus.OK, 'Invite accepted successfully', result);
  }

  @Post(':inviteId/decline')
  @ApiOperation({ summary: 'Decline an invite' })
  async declineInvite(
    @Param('inviteId') inviteId: string,
    @GetCurrentUser('userId') userId: string,
  ) {
    const result = await this.inviteService.declineInvite(inviteId, userId);
    return sendResponse(HttpStatus.OK, 'Invite declined successfully', result);
  }

  // ─── JOIN BY CODE ────────────────────────────────────────

  @Post('join')
  @ApiOperation({ summary: 'Join a group using an invite code or group code' })
  async joinByCode(
    @GetCurrentUser('userId') userId: string,
    @Body() dto: JoinByCodeDto,
  ) {
    const result = await this.inviteService.joinByCode(dto.inviteCode, userId);
    return sendResponse(HttpStatus.OK, 'Joined group successfully', result);
  }
}
