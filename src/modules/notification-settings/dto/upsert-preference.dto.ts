import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { NotificationType } from '@prisma/client';

export class UpsertPreferenceDto {
  @ApiProperty({ enum: NotificationType })
  @IsEnum(NotificationType)
  @IsNotEmpty()
  type: NotificationType;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;

  @ApiPropertyOptional({ default: 60 })
  @IsInt()
  @IsOptional()
  cooldownMinutes?: number;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  thresholds?: Record<string, any>;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  quietStart?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  quietEnd?: string;
}
