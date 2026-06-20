import { IsBoolean, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MuteGroupDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  isMuted: boolean;

  @ApiPropertyOptional({ description: 'Optional date until muted. If empty and isMuted is true, muted forever.' })
  @IsDateString()
  @IsOptional()
  mutedUntil?: string;
}
