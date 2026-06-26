import { IsEnum, IsNotEmpty, IsOptional, IsString, IsEmail, IsDateString, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InviteType } from '@prisma/client';

export class CreateInviteDto {
  @ApiProperty({ enum: InviteType, example: InviteType.USER, description: 'Type of invite: USER (direct), EMAIL (by email), CODE (shareable link)' })
  @IsEnum(InviteType)
  @IsNotEmpty()
  type: InviteType;

  @ApiPropertyOptional({ type: [String], example: ['uuid-of-target-user'], description: 'Required when type = USER' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  inviteeUserIds?: string[];

  @ApiPropertyOptional({ example: 'john@example.com', description: 'Required when type = EMAIL' })
  @IsEmail()
  @IsOptional()
  inviteeEmail?: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59Z', description: 'Optional expiry date for the invite' })
  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}
