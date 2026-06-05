import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UserSignUpDto } from './dto/user.singup.dto';
import { SUCCESS_MESSAGES } from 'src/common/constants';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh.token.dto';
import { GetCurrentUser } from 'src/common/decorator/get-current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { sendResponse } from 'src/common/helpers/api-response.helper';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'User Sign Up' })
  @ApiCreatedResponse({ description: 'User registered successfully' })
  async userSignUp(@Body() data: UserSignUpDto) {
    const result = await this.authService.userSignUp(data);
    return sendResponse(
      HttpStatus.CREATED,
      SUCCESS_MESSAGES.AUTH.REGISTRATION_SUCCESS,
      result,
    );
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User / Admin Login' })
  @ApiOkResponse({ description: 'Login successful' })
  async signIn(@Body() data: LoginDto) {
    const result = await this.authService.signIn(data);
    return sendResponse(HttpStatus.OK, SUCCESS_MESSAGES.AUTH.LOGIN_SUCCESS, result);
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiOkResponse({ description: 'Token refreshed successfully' })
  async refreshToken(@Body() body: RefreshTokenDto) {
    const { userId, refreshToken } = body;
    const result = await this.authService.refreshToken(userId, refreshToken);
    return sendResponse(HttpStatus.OK, 'Token refreshed successfully', result);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiOkResponse({ description: 'User profile fetched successfully' })
  async getMe(@GetCurrentUser() user: any) {
    const result = await this.authService.findUser(user?.userId);
    return sendResponse(HttpStatus.OK, 'User profile fetched successfully', result);
  }
}

