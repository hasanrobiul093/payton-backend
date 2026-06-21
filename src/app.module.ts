import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { PrismaModule } from './prisma/prisma.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { GroupModule } from './modules/group/group.module';
import { InviteModule } from './modules/invite/invite.module';
import { MessageModule } from './modules/message/message.module';
import { NotificationSettingsModule } from './modules/notification-settings/notification-settings.module';
import envConfig from './config/env.config';

@Module({
  imports: [
    PrismaModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [envConfig],
      cache: true,
    }),
    AuthModule,
    UserModule,
    GroupModule,
    InviteModule,
    MessageModule,
    CloudinaryModule,
    NotificationSettingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
