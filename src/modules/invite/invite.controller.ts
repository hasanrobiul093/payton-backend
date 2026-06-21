import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InviteService } from './invite.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GetCurrentUser } from '../../common/decorator/get-current-user.decorator';
import { GroupRoles } from '../../common/decorator/group-roles.decorator';
import { GroupRoleGuard } from '../../common/guards/group-role.guard';
import { GroupRole } from '@prisma/client';
import { CreateInviteDto, JoinByCodeDto } from './dto';

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
  createInvite(
    @Param('groupId') groupId: string,
    @GetCurrentUser('userId') userId: string,
    @Body() dto: CreateInviteDto,
  ) {
    return this.inviteService.createInvite(groupId, userId, dto);
  }

  @Get('groups/:groupId')
  @UseGuards(GroupRoleGuard)
  @GroupRoles(GroupRole.OWNER, GroupRole.ADMIN)
  @ApiOperation({ summary: 'List all invites for a group' })
  getGroupInvites(@Param('groupId') groupId: string) {
    return this.inviteService.getGroupInvites(groupId);
  }

  @Delete(':inviteId/revoke')
  @ApiOperation({ summary: 'Revoke a pending invite (admin/owner)' })
  revokeInvite(@Param('inviteId') inviteId: string) {
    return this.inviteService.revokeInvite(inviteId);
  }

  // ─── RECEIVER ACTIONS ────────────────────────────────────

  @Get('my-pending')
  @ApiOperation({ summary: 'List my pending invites (received)' })
  getMyPendingInvites(@GetCurrentUser('userId') userId: string) {
    return this.inviteService.getMyPendingInvites(userId);
  }

  @Post(':inviteId/accept')
  @ApiOperation({ summary: 'Accept an invite (USER or EMAIL type)' })
  acceptInvite(
    @Param('inviteId') inviteId: string,
    @GetCurrentUser('userId') userId: string,
  ) {
    return this.inviteService.acceptInvite(inviteId, userId);
  }

  @Post(':inviteId/decline')
  @ApiOperation({ summary: 'Decline an invite' })
  declineInvite(
    @Param('inviteId') inviteId: string,
    @GetCurrentUser('userId') userId: string,
  ) {
    return this.inviteService.declineInvite(inviteId, userId);
  }

  // ─── JOIN BY CODE ────────────────────────────────────────

  @Post('join')
  @ApiOperation({ summary: 'Join a group using an invite code or group code' })
  joinByCode(
    @GetCurrentUser('userId') userId: string,
    @Body() dto: JoinByCodeDto,
  ) {
    return this.inviteService.joinByCode(dto.inviteCode, userId);
  }
}
