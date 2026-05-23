import { IsEmail, IsString, MinLength, MaxLength, IsOptional } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

export class AuthResponseDto {
  user: {
    id: string;
    email: string;
    name: string | null;
  };
  accessToken: string;
}

export class UserProfileDto {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  currentPassword?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  newPassword?: string;
}
