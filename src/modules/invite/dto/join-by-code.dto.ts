import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class JoinByCodeDto {
  @ApiProperty({ example: 'abc123', description: 'The invite code from the group or invite link' })
  @IsString()
  @IsNotEmpty()
  inviteCode: string;
}
