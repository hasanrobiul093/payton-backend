import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GroupService } from './group.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GetCurrentUser } from '../../common/decorator/get-current-user.decorator';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { GroupRoles } from '../../common/decorator/group-roles.decorator';
import { GroupRoleGuard } from '../../common/guards/group-role.guard';
import { GroupRole } from '@prisma/client';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { MuteGroupDto } from './dto/mute-group.dto';

@ApiTags('Group')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('groups')
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new group' })
  createGroup(@GetCurrentUser('userId') userId: string, @Body() data: CreateGroupDto) {
    return this.groupService.createGroup(userId, data);
  }

  @Get()
  @ApiOperation({ summary: 'List my groups' })
  getMyGroups(@GetCurrentUser('userId') userId: string) {
    return this.groupService.getMyGroups(userId);
  }

  @Get(':groupId')
  @UseGuards(GroupRoleGuard)
  @ApiOperation({ summary: 'Get group details' })
  getGroupDetails(@Param('groupId') groupId: string, @GetCurrentUser('userId') userId: string) {
    return this.groupService.getGroupDetails(groupId, userId);
  }

  @Patch(':groupId')
  @UseGuards(GroupRoleGuard)
  @GroupRoles(GroupRole.OWNER, GroupRole.ADMIN)
  @ApiOperation({ summary: 'Update group details' })
  updateGroup(@Param('groupId') groupId: string, @Body() data: UpdateGroupDto) {
    return this.groupService.updateGroup(groupId, data);
  }

  @Delete(':groupId')
  @UseGuards(GroupRoleGuard)
  @GroupRoles(GroupRole.OWNER)
  @ApiOperation({ summary: 'Delete group (Soft delete)' })
  deleteGroup(@Param('groupId') groupId: string) {
    return this.groupService.deleteGroup(groupId);
  }

  @Post(':groupId/rotate-invite-code')
  @UseGuards(GroupRoleGuard)
  @GroupRoles(GroupRole.OWNER, GroupRole.ADMIN)
  @ApiOperation({ summary: 'Rotate group invite code' })
  rotateInviteCode(@Param('groupId') groupId: string) {
    return this.groupService.rotateInviteCode(groupId);
  }

  // --- MEMBER MANAGEMENT ---

  @Get(':groupId/members')
  @UseGuards(GroupRoleGuard)
  @ApiOperation({ summary: 'List group members' })
  getMembers(@Param('groupId') groupId: string) {
    return this.groupService.getMembers(groupId);
  }

  @Patch(':groupId/members/:userId/role')
  @UseGuards(GroupRoleGuard)
  @GroupRoles(GroupRole.OWNER)
  @ApiOperation({ summary: 'Update member role (Owner only)' })
  updateMemberRole(
    @Param('groupId') groupId: string,
    @Param('userId') targetUserId: string,
    @Body() data: UpdateMemberRoleDto,
  ) {
    return this.groupService.updateMemberRole(groupId, targetUserId, data);
  }

  @Delete(':groupId/members/:userId')
  @UseGuards(GroupRoleGuard)
  @GroupRoles(GroupRole.OWNER, GroupRole.ADMIN)
  @ApiOperation({ summary: 'Remove member from group' })
  removeMember(@Param('groupId') groupId: string, @Param('userId') targetUserId: string) {
    return this.groupService.removeMember(groupId, targetUserId);
  }

  @Post(':groupId/leave')
  @UseGuards(GroupRoleGuard)
  @ApiOperation({ summary: 'Leave group' })
  leaveGroup(@Param('groupId') groupId: string, @GetCurrentUser('userId') userId: string) {
    return this.groupService.leaveGroup(groupId, userId);
  }

  @Patch(':groupId/mute')
  @UseGuards(GroupRoleGuard)
  @ApiOperation({ summary: 'Mute/Unmute group' })
  toggleMute(
    @Param('groupId') groupId: string,
    @GetCurrentUser('userId') userId: string,
    @Body() data: MuteGroupDto,
  ) {
    return this.groupService.toggleMute(groupId, userId, data);
  }

  @Patch(':groupId/read')
  @UseGuards(GroupRoleGuard)
  @ApiOperation({ summary: 'Mark messages as read' })
  markAsRead(@Param('groupId') groupId: string, @GetCurrentUser('userId') userId: string) {
    return this.groupService.markAsRead(groupId, userId);
  }
}
