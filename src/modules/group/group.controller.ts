import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, HttpStatus } from '@nestjs/common';
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
import { sendResponse } from 'src/common/helpers';

@ApiTags('Group')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('groups')
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new group' })
  async createGroup(@GetCurrentUser('userId') userId: string, @Body() data: CreateGroupDto) {
    const result = await this.groupService.createGroup(userId, data);
    return sendResponse(HttpStatus.CREATED, 'Group created successfully', result);
  }

  @Get()
  @ApiOperation({ summary: 'List my groups' })
  async getMyGroups(@GetCurrentUser('userId') userId: string) {
    const result = await this.groupService.getMyGroups(userId);
    return sendResponse(HttpStatus.OK, 'Groups fetched successfully', result);
  }

  @Get(':groupId')
  @UseGuards(GroupRoleGuard)
  @ApiOperation({ summary: 'Get group details' })
  async getGroupDetails(@Param('groupId') groupId: string, @GetCurrentUser('userId') userId: string) {
    const result = await this.groupService.getGroupDetails(groupId, userId);
    return sendResponse(HttpStatus.OK, 'Group details fetched successfully', result);
  }

  @Patch(':groupId')
  @UseGuards(GroupRoleGuard)
  @GroupRoles(GroupRole.OWNER, GroupRole.ADMIN)
  @ApiOperation({ summary: 'Update group details' })
  async updateGroup(@Param('groupId') groupId: string, @Body() data: UpdateGroupDto) {
    const result = await this.groupService.updateGroup(groupId, data);
    return sendResponse(HttpStatus.OK, 'Group updated successfully', result);
  }

  @Delete(':groupId')
  @UseGuards(GroupRoleGuard)
  @GroupRoles(GroupRole.OWNER)
  @ApiOperation({ summary: 'Delete group (Soft delete)' })
  async deleteGroup(@Param('groupId') groupId: string) {
    const result = await this.groupService.deleteGroup(groupId);
    return sendResponse(HttpStatus.OK, 'Group deleted successfully', result);
  }

  @Post(':groupId/rotate-invite-code')
  @UseGuards(GroupRoleGuard)
  @GroupRoles(GroupRole.OWNER, GroupRole.ADMIN)
  @ApiOperation({ summary: 'Rotate group invite code' })
  async rotateInviteCode(@Param('groupId') groupId: string) {
    const result = await this.groupService.rotateInviteCode(groupId);
    return sendResponse(HttpStatus.OK, 'Invite code rotated successfully', result);
  }

  // --- MEMBER MANAGEMENT ---

  @Get(':groupId/members')
  @UseGuards(GroupRoleGuard)
  @ApiOperation({ summary: 'List group members' })
  async getMembers(@Param('groupId') groupId: string) {
    const result = await this.groupService.getMembers(groupId);
    return sendResponse(HttpStatus.OK, 'Group members fetched successfully', result);
  }

  @Patch(':groupId/members/:userId/role')
  @UseGuards(GroupRoleGuard)
  @GroupRoles(GroupRole.OWNER)
  @ApiOperation({ summary: 'Update member role, enum(OWNER,ADMIN,MEMBER), (Owner only)' })
  async updateMemberRole(
    @Param('groupId') groupId: string,
    @Param('userId') targetUserId: string,
    @Body() data: UpdateMemberRoleDto,
  ) {
    const result = await this.groupService.updateMemberRole(groupId, targetUserId, data);
    return sendResponse(HttpStatus.OK, 'Member role updated successfully', result);
  }

  @Delete(':groupId/members/:userId')
  @UseGuards(GroupRoleGuard)
  @GroupRoles(GroupRole.OWNER, GroupRole.ADMIN)
  @ApiOperation({ summary: 'Remove member from group' })
  async removeMember(@Param('groupId') groupId: string, @Param('userId') targetUserId: string) {
    const result = await this.groupService.removeMember(groupId, targetUserId);
    return sendResponse(HttpStatus.OK, 'Member removed successfully', result);
  }

  @Post(':groupId/leave')
  @UseGuards(GroupRoleGuard)
  @ApiOperation({ summary: 'Leave group' })
  async leaveGroup(@Param('groupId') groupId: string, @GetCurrentUser('userId') userId: string) {
    const result = await this.groupService.leaveGroup(groupId, userId);
    return sendResponse(HttpStatus.OK, 'Left group successfully', result);
  }

  @Patch(':groupId/mute')
  @UseGuards(GroupRoleGuard)
  @ApiOperation({ summary: 'Mute/Unmute group' })
  async toggleMute(
    @Param('groupId') groupId: string,
    @GetCurrentUser('userId') userId: string,
    @Body() data: MuteGroupDto,
  ) {
    const result = await this.groupService.toggleMute(groupId, userId, data);
    return sendResponse(HttpStatus.OK, 'Group mute status updated successfully', result);
  }

  @Patch(':groupId/read')
  @UseGuards(GroupRoleGuard)
  @ApiOperation({ summary: 'Mark messages as read' })
  async markAsRead(@Param('groupId') groupId: string, @GetCurrentUser('userId') userId: string) {
    const result = await this.groupService.markAsRead(groupId, userId);
    return sendResponse(HttpStatus.OK, 'Messages marked as read successfully', result);
  }
}
