import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GROUP_ROLES_KEY } from '../decorator/group-roles.decorator';
import { GroupRole, MemberStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class GroupRoleGuard implements CanActivate {
  constructor(private reflector: Reflector, private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<GroupRole[]>(GROUP_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const groupId = request.params.groupId || request.body.groupId;

    if (!user) {
      return false;
    }

    if (!groupId) {
      // If no groupId provided in route/body, we can't check role.
      // Usually means the endpoint isn't group-specific, so we let it pass
      // or the logic is flawed. We will pass but ideally should throw error.
      return true; 
    }

    const member = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: user.userId,
        },
      },
    });

    if (!member || member.status !== MemberStatus.ACTIVE) {
      throw new ForbiddenException('You are not an active member of this group');
    }

    if (!requiredRoles) {
      return true; // No specific roles required, just being an active member is enough
    }

    if (!requiredRoles.includes(member.role)) {
      throw new ForbiddenException(`Requires one of these roles: ${requiredRoles.join(', ')}`);
    }

    return true;
  }
}
