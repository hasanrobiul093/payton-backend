import { Body, Controller, Get, HttpCode, HttpStatus, Patch, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserService } from './user.service';
import { ApiBearerAuth, ApiConsumes, ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { GetCurrentUser } from 'src/common/decorator/get-current-user.decorator';
import { sendResponse } from 'src/common/helpers';
import { UpdateProfileDto } from './dto/update.profile.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) { }


  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiOkResponse({ description: 'User profile fetched successfully' })
  async getMe(@GetCurrentUser() user: any) {
    const result = await this.userService.getMe(user?.userId);
    return sendResponse(HttpStatus.OK, 'User profile fetched successfully', result);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Patch('profile-update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update user profile' })
  @ApiOkResponse({ description: 'Profile updated successfully' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async updateProfile(
    @Body() dto: UpdateProfileDto,
    @GetCurrentUser() user: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const result = await this.userService.updateProfile(
      dto,
      { userId: user.userId },
      file,
    );
    return sendResponse(HttpStatus.OK, 'Profile updated', result);
  }
}
