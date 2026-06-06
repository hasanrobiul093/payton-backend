import {
  BadRequestException,
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
import { ChangePasswordDto } from './dto/change.password.dto';
import { VerifyOtpDto } from './dto/verify.otp.dto';
import { ResendOtpDto } from './dto/resend.otp';
import { ResetPasswordDto } from './dto/reset.password.dto';
import { ForgetPasswordDto } from './dto/forget.password.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

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


  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password' })
  @ApiOkResponse({ description: 'Password changed successfully' })
  async changePassword(@Body() data: ChangePasswordDto, @GetCurrentUser() user: any) {
    if (data.oldPassword === data.newPassword) {
      throw new BadRequestException("Old password and new password cannot be the same");
    }
    await this.authService.changePassword(data, user?.userId);
    return sendResponse(HttpStatus.OK, 'Password changed successfully');
  }


  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email' })
  @ApiOkResponse({ description: 'Email verified successfully' })
  async verifyEmail(@Body() data: VerifyOtpDto) {
    await this.authService.verifyEmail(data.email, data.otp);
    return sendResponse(HttpStatus.OK, 'Email verified successfully');
  }

  @Post('forget-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Forget password' })
  @ApiOkResponse({ description: 'OTP send to your email' })
  async forgetPassword(@Body() data: ForgetPasswordDto) {
    await this.authService.forgotPassword(data);
    return sendResponse(HttpStatus.OK, 'OTP sent to your email');
  }

  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend OTP' })
  @ApiOkResponse({ description: 'OTP resent successfully' })
  async resendOtp(@Body() data: ResendOtpDto) {
    await this.authService.resendOTP(data);
    return sendResponse(HttpStatus.OK, 'OTP resent successfully');
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with OTP' })
  @ApiOkResponse({ description: 'Password reset successfully' })
  async resetPasswordWithOTP(@Body() data: ResetPasswordDto) {
    await this.authService.resetPasswordWithOTP(data);
    return sendResponse(HttpStatus.OK, 'Password reset successfully');
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

}

