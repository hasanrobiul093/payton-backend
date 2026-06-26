import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationSettingsService } from './notification-settings.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { GetCurrentUser } from 'src/common/decorator/get-current-user.decorator';
import { UpdateUserSettingsDto } from './dto/update-user-settings.dto';
import { UpsertPreferenceDto } from './dto/upsert-preference.dto';
import { sendResponse } from 'src/common/helpers';

@ApiTags('Notification Settings')
@Controller('notification-settings')  
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
export class NotificationSettingsController {
  constructor(private readonly notificationSettingsService: NotificationSettingsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all notification settings and preferences' })
  @ApiOkResponse({ description: 'Settings fetched successfully' })
  async getSettings(@GetCurrentUser() user: any) {
    const result = await this.notificationSettingsService.getSettings(user.userId);
    return sendResponse(HttpStatus.OK, 'Settings fetched successfully', result);
  }

  @Patch('general')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update general user settings' })
  @ApiOkResponse({ description: 'Settings updated successfully' })
  async updateGeneralSettings(
    @GetCurrentUser() user: any,
    @Body() dto: UpdateUserSettingsDto,
  ) {
    const result = await this.notificationSettingsService.updateUserSettings(user.userId, dto);
    return sendResponse(HttpStatus.OK, 'General settings updated successfully', result);
  }

  @Put('preferences')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upsert a notification preference by type' })
  @ApiOkResponse({ description: 'Preference upserted successfully' })
  async upsertPreference(
    @GetCurrentUser() user: any,
    @Body() dto: UpsertPreferenceDto,
  ) {
    const result = await this.notificationSettingsService.upsertPreference(user.userId, dto);
    return sendResponse(HttpStatus.OK, 'Preference upserted successfully', result);
  }
}
