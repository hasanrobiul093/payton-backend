import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserSignUpDto } from './dto/user.singup.dto';
import { ERROR_MESSAGES } from 'src/common/constants';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { IEnv } from 'src/config/env.config';
import { ChangePasswordDto } from './dto/change.password.dto';
import { sendOtpEmail } from 'src/common/helpers/mail.helper';
import { AuthProvider, UserStatus } from '@prisma/client';
import { ResendOtpDto } from './dto/resend.otp';
import { ForgetPasswordDto } from './dto/forget.password.dto';
import { ResetPasswordDto } from './dto/reset.password.dto';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { SocialLoginDto } from './dto/social.login.dto';
import { GoogleService } from './google.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private readonly googleService: GoogleService
  ) {
    const env = this.configService.get<IEnv>('env');
    if (env?.FIREBASE_CONFIG?.FIREBASE_PROJECT_ID && !getApps().length) {
      try {
        initializeApp({
          credential: cert({
            projectId: env.FIREBASE_CONFIG.FIREBASE_PROJECT_ID,
            clientEmail: env.FIREBASE_CONFIG.FIREBASE_CLIENT_EMAIL,
            privateKey: env.FIREBASE_CONFIG.FIREBASE_PRIVATE_KEY,
          }),
        });
      } catch (error) {
        console.error('Firebase Admin initialization error', error);
      }
    }
  }

  async hast(text: string) {
    const hash = await bcrypt.hash(text, 10);

    return hash;
  }

  async userSignUp(data: UserSignUpDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: data.email,
      },
    });

    if (user)
      throw new BadRequestException(ERROR_MESSAGES.USER.USER_ALREADY_EXISTS);

    const hastPassword = await this.hast(data.password);

    // Generate 6‑digit OTP for email verification
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);
    const verificationOtpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    const createdUser = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hastPassword,
        lastOTP: hashedOtp,
        otpExpiredAt: verificationOtpExpiry,
        settings: {
          create: {}
        }
      },
      select: {
        userId: true,
        name: true,
        email: true,
        profileImage: true,
        role: true,
      },
    });

    // Send verification OTP email
    await sendOtpEmail(createdUser.email, otp, 'verify');

    return;
  }

  async socialLogin(data: SocialLoginDto) {
    try {
      let email: string | undefined;
      let name: string | undefined;
      let uid: string;
      let picture: string | undefined;
      const provider: AuthProvider = data.provider;

      if (provider === AuthProvider.GOOGLE) {
        const profile = await this.googleService.verify(data.idToken);
        email = profile.email;
        name = profile.name;
        uid = profile.sub;
        picture = profile.picture;
      } else if (provider === AuthProvider.APPLE) {
        const decodedToken = await getAuth().verifyIdToken(data.idToken);
        email = decodedToken.email;
        name = decodedToken.name;
        uid = decodedToken.uid;
        picture = decodedToken.picture;
      } else {
        throw new BadRequestException('Unsupported sign-in provider');
      }

      if (!email) {
        throw new BadRequestException('Email is required from social provider');
      }

      let user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (user) {
        if (user.isDeleted) {
          throw new ForbiddenException('Account has been deleted');
        }
        if (user.status === UserStatus.SUSPEND) {
          throw new ForbiddenException('Account suspended');
        }
        if (!user.isActive) {
          throw new ForbiddenException('Account is inactive');
        }

        if (user.provider !== provider || user.providerId !== uid || (picture && !user.profileImage)) {
          user = await this.prisma.user.update({
            where: { userId: user.userId },
            data: {
              provider,
              providerId: uid,
              isVerified: true,
              ...(picture && !user.profileImage && { profileImage: picture }),
            },
          });
        }
      } else {
        user = await this.prisma.user.create({
          data: {
            name: name || email.split('@')[0],
            email,
            provider,
            providerId: uid,
            isVerified: true,
            profileImage: picture || null,
            settings: {
              create: {},
            },
          },
        });
      }

      const tokens = await this.generateTokens(user.userId, user.email);
      await this.updateRefreshToken(user.userId, tokens.refreshToken);

      return tokens;
    } catch (error) {
      if (
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      console.log("error :", error)
      throw new UnauthorizedException('Invalid or expired Firebase ID token');
    }
  }

  async signIn(data: LoginDto) {
    const { email } = data;

    const user = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isVerified) {
      throw new UnauthorizedException('Account not verified, Please verify your email address');
    }

    if (user.status == UserStatus.SUSPEND) {
      throw new ForbiddenException('Account suspended');
    }

    if (!user.password) {
      throw new Error("Password not found");
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.password);

    if (!isPasswordValid)
      throw new NotFoundException("Wrong password");

    const tokens = await this.generateTokens(user.userId, user.email);

    await this.updateRefreshToken(user.userId, tokens.refreshToken);

    // const { password, lastOTP, refreshToken, ...rest } = user;

    return tokens
  }


  async changePassword(data: ChangePasswordDto, userId: string) {

    const user = await this.prisma.user.findUnique({
      where: { userId: userId },
    });

    if (!user) {
      throw new NotFoundException(ERROR_MESSAGES.USER.USER_NOT_FOUND);
    }

    if (!user.isVerified) {
      throw new UnauthorizedException('Account not verified, Please verify your email address');
    }

    if (user.provider !== AuthProvider.CUSTOM) {
      throw new ForbiddenException('You are not authorized to change password');
    }

    if (!user.password) {
      throw new NotFoundException("Password not found");
    }

    const isPasswordValid = await bcrypt.compare(data.oldPassword, user.password);

    if (!isPasswordValid)
      throw new NotFoundException("Wrong password");

    const hastPassword = await this.hast(data.newPassword);

    await this.prisma.user.update({
      where: { userId: userId },
      data: {
        password: hastPassword,
      },
    });

    return;
  }

  async verifyEmail(email: string, otp: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException(ERROR_MESSAGES.USER.USER_NOT_FOUND);
    }

    if (user.status === UserStatus.SUSPEND) {
      throw new ForbiddenException('Account suspended');
    }

    if (user.isVerified) {
      throw new ConflictException('Account already verified, Please login');
    }

    if (!user.lastOTP || !user.otpExpiredAt) {
      throw new UnauthorizedException('OTP not found');
    }

    if (new Date() > user.otpExpiredAt) {
      throw new UnauthorizedException('OTP expired, Please resend OTP');
    }

    const isOtpValid = await bcrypt.compare(otp, user.lastOTP);

    if (!isOtpValid)
      throw new NotFoundException(ERROR_MESSAGES.AUTH.INVALID_OTP);

    await this.prisma.user.update({
      where: { userId: user.userId },
      data: {
        isVerified: true,
        lastOTP: null,
        otpExpiredAt: null,
      },
    });
  }


  //forget pass
  async forgotPassword(data: ForgetPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: data.email, isDeleted: false },
    });

    if (!user) {
      throw new NotFoundException(ERROR_MESSAGES.USER.USER_NOT_FOUND);
    }

    if (!user.isVerified) {
      throw new UnauthorizedException('Account not verified, Please verify your email address');
    }

    if (user.status === UserStatus.SUSPEND) {
      throw new ForbiddenException('Account suspended');
    }

    if (user.provider !== AuthProvider.CUSTOM) {
      throw new ForbiddenException('You are not authorized to change password');
    }

    if (!user.password) {
      throw new NotFoundException("Password not found");
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);
    const verificationOtpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await this.prisma.user.update({
      where: { userId: user.userId },
      data: {
        lastOTP: hashedOtp,
        otpExpiredAt: verificationOtpExpiry,
      },
    });

    await sendOtpEmail(user.email, otp, 'reset');

    return {
      message: 'OTP sent successfully',
    };
  }

  //resend OTP
  async resendOTP(data: ResendOtpDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw new NotFoundException(ERROR_MESSAGES.USER.USER_NOT_FOUND);
    }

    if (!user.lastOTP || !user.otpExpiredAt) {
      throw new UnauthorizedException('OTP not found');
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);
    const verificationOtpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await this.prisma.user.update({
      where: { userId: user.userId },
      data: {
        lastOTP: hashedOtp,
        otpExpiredAt: verificationOtpExpiry,
      },
    });

    await sendOtpEmail(user.email, otp, 'verify');

    return {
      message: 'OTP resent successfully',
    };
  }


  //reset password with OTP
  async resetPasswordWithOTP(data: ResetPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: data.email, isDeleted: false, isActive: true },
    });

    if (!user) {
      throw new NotFoundException(ERROR_MESSAGES.USER.USER_NOT_FOUND);
    }

    if (user.status === UserStatus.SUSPEND) {
      throw new ForbiddenException('Account suspended');
    }

    if (user.provider !== AuthProvider.CUSTOM) {
      throw new ForbiddenException('You are not authorized to change password');
    }


    if (!user.lastOTP || !user.otpExpiredAt) {
      throw new UnauthorizedException('OTP not found');
    }

    if (new Date() > user.otpExpiredAt) {
      throw new UnauthorizedException('OTP expired, Please try again');
    }

    const isOtpValid = await bcrypt.compare(data.otp, user.lastOTP);

    if (!isOtpValid) throw new NotFoundException(ERROR_MESSAGES.AUTH.INVALID_OTP);

    const hastPassword = await this.hast(data.newPassword);

    await this.prisma.user.update({
      where: { userId: user.userId },
      data: {
        password: hastPassword,
        lastOTP: null,
        otpExpiredAt: null,
      },
    });

    return {
      message: 'Password reset successfully',
    };
  }


  //get me
  async findUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        userId: userId,
      },
    });
    if (!user) throw new NotFoundException(ERROR_MESSAGES.USER.USER_NOT_FOUND);

    const { password, lastOTP, refreshToken, ...rest } = user;

    return rest;
  }

  async generateTokens(userId: string, email: string) {
    const env = this.configService.get<IEnv>('env');
    const payload = { sub: userId, email };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: env?.JWT_CONFIG.JWT_SECRET,
      expiresIn: '7d',
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: env?.JWT_CONFIG.JWT_REFRESH_SECRET,
      expiresIn: '30d',
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  async updateRefreshToken(userId: string, refreshToken: string) {
    const hashed = await bcrypt.hash(refreshToken, 10);

    await this.prisma.user.update({
      where: { userId: userId },
      data: {
        refreshToken: hashed,
      },
    });
  }

  async refreshToken(userId: string, refreshToken: string) {
    const user = await this.prisma.user.findUnique({
      where: { userId: userId },
    });

    if (!user || !user.refreshToken) {
      throw new ForbiddenException('Access denied');
    }

    const isMatch = await bcrypt.compare(refreshToken, user.refreshToken);

    if (!isMatch) {
      throw new ForbiddenException('Access denied');
    }

    const tokens = await this.generateTokens(user.userId, user.email);

    await this.updateRefreshToken(user.userId, tokens.refreshToken);

    return tokens;
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { userId: userId },
      data: {
        refreshToken: null,
      },
    });

    return {
      message: 'Logout successful',
    };
  }
}
