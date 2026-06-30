import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateGroupDto {
  @ApiProperty({ example: 'Weekend Fishing Club' })
  @Transform(({ value }) => value === '' ? undefined : value)
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'A group for fishing enthusiasts' })
  @Transform(({ value }) => value === '' ? undefined : value)
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @Transform(({ value }) => {
    if (value === '') return undefined;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean;

  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  @IsOptional()
  photo?: any;
}
