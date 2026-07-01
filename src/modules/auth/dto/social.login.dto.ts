import { ApiProperty } from '@nestjs/swagger';
import { AuthProvider } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class SocialLoginDto {
  @ApiProperty({
    description: 'Firebase ID Token obtained from the client SDK',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6...',
  })
  @IsString()
  @IsNotEmpty()
  idToken: string;

  @ApiProperty({
    description: 'Provider (google/apple)',
    example: AuthProvider.GOOGLE,
  })
  @IsEnum(AuthProvider)
  @IsNotEmpty()
  provider: AuthProvider;

}
