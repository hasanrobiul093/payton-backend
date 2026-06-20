import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateUserSettingsDto {
  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  enableOfflineMap?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  enableNotification?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  hotZoneAlert?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  groupActivity?: boolean;
}
