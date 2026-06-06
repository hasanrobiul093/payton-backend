import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  userName?: string;


  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Profile image file',
  })
  @IsOptional()
  file?: any;
}
