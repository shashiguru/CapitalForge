import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, AuthResponseDto, UserProfileDto, UpdateProfileDto } from './dto/auth.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(dto);
  }

  @Get('profile')
  async getProfile(@CurrentUser('id') userId: string): Promise<UserProfileDto> {
    return this.authService.getProfile(userId);
  }

  @Patch('profile')
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserProfileDto> {
    return this.authService.updateProfile(userId, dto);
  }
}
