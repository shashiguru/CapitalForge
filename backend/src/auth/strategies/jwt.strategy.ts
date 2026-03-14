import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

// Supabase JWT payload structure
export interface SupabaseJwtPayload {
  aud: string;
  exp: number;
  iat: number;
  iss: string;
  sub: string; // User ID
  email: string;
  phone?: string;
  app_metadata?: {
    provider?: string;
    providers?: string[];
  };
  user_metadata?: {
    name?: string;
    [key: string]: any;
  };
  role?: string;
  aal?: string;
  amr?: Array<{ method: string; timestamp: number }>;
  session_id?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'default-secret',
    });
  }

  async validate(payload: SupabaseJwtPayload) {
    // Supabase user ID is in the 'sub' field
    const supabaseUserId = payload.sub;
    const email = payload.email;
    const name = payload.user_metadata?.name || email?.split('@')[0] || 'User';

    if (!supabaseUserId || !email) {
      throw new UnauthorizedException('Invalid token');
    }

    // Find or create user in local database
    let user = await this.prisma.user.findUnique({
      where: { id: supabaseUserId },
    });

    if (!user) {
      // Check if user exists with same email (migration case)
      const existingUserByEmail = await this.prisma.user.findUnique({
        where: { email },
      });

      if (existingUserByEmail) {
        // Update existing user with Supabase ID
        user = await this.prisma.user.update({
          where: { email },
          data: { id: supabaseUserId },
        });
      } else {
        // Create new user synced from Supabase
        user = await this.prisma.user.create({
          data: {
            id: supabaseUserId,
            email,
            name,
            password: '', // Supabase handles passwords
          },
        });
      }
    }

    // Return user without password
    const { password, ...result } = user;
    return result;
  }
}
