import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { GroupRole } from '@prisma/client';

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: GroupRole, example: GroupRole.ADMIN })
  @IsEnum(GroupRole)
  @IsNotEmpty()
  role: GroupRole;
}
