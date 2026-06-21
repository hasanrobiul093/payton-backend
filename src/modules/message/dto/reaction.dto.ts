import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReactionDto {
  @ApiProperty({ example: '👍', description: 'Emoji unicode character' })
  @IsString()
  @IsNotEmpty()
  emoji: string;
}
