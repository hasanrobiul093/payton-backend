import { Injectable, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

@Injectable()
export class GoogleService {
  private oauthClient: OAuth2Client;

  constructor(private configService: ConfigService) {
    const clientId = this.configService.get('GOOGLE_CLIENT_ID');
    this.oauthClient = new OAuth2Client({
      client_id: clientId,
      client_secret: this.configService.get('GOOGLE_CLIENT_SECRET'),   
    });
  }

  async verify(idToken: string) {
    try {
      const ticket = await this.oauthClient.verifyIdToken({
        idToken,
        audience: this.configService.get('GOOGLE_CLIENT_ID'),
      });

      const payload = ticket.getPayload();

      if (!payload) {
        throw new UnauthorizedException('Invalid Google ID token');
      }

      return {
        email: payload.email,
        sub: payload.sub,
        name: payload.name,
        picture: payload.picture,
      };
    } catch (error) {
      throw new UnauthorizedException(
        'Failed to verify Google ID token',
      );
    }
  }
}