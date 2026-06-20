import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateUserSettingsDto } from './dto/update-user-settings.dto';
import { UpsertPreferenceDto } from './dto/upsert-preference.dto';

@Injectable()
export class NotificationSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(userId: string) {
    const userSettings = await this.prisma.userSettings.findUnique({
      where: { userId },
    });
    
    const preferences = await this.prisma.notificationPreference.findMany({
      where: { userId },
    });

    return {
      userSettings,
      preferences,
    };
  }

  async updateUserSettings(userId: string, data: UpdateUserSettingsDto) {
    return this.prisma.userSettings.upsert({
      where: { userId },
      update: data,
      create: {
        userId,
        ...data,
      },
    });
  }

  async upsertPreference(userId: string, data: UpsertPreferenceDto) {
    const { type, ...rest } = data;
    
    return this.prisma.notificationPreference.upsert({
      where: {
        userId_type: {
          userId,
          type,
        },
      },
      update: {
        ...(rest.isEnabled !== undefined && { isEnabled: rest.isEnabled }),
        ...(rest.cooldownMinutes !== undefined && { cooldownMinutes: rest.cooldownMinutes }),
        ...(rest.thresholds !== undefined && { thresholds: rest.thresholds as any }),
        ...(rest.quietStart !== undefined && { quietStart: rest.quietStart }),
        ...(rest.quietEnd !== undefined && { quietEnd: rest.quietEnd }),
      },
      create: {
        userId,
        type,
        ...(rest.isEnabled !== undefined && { isEnabled: rest.isEnabled }),
        ...(rest.cooldownMinutes !== undefined && { cooldownMinutes: rest.cooldownMinutes }),
        ...(rest.thresholds !== undefined && { thresholds: rest.thresholds as any }),
        ...(rest.quietStart !== undefined && { quietStart: rest.quietStart }),
        ...(rest.quietEnd !== undefined && { quietEnd: rest.quietEnd }),
      },
    });
  }
}
