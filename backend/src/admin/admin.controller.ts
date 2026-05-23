import { Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Controller('admin')
export class AdminController {
  constructor(private prisma: PrismaService) {}

  @Post('seed')
  @HttpCode(HttpStatus.OK)
  async seed() {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: 'demo@capitalforge.com' },
    });

    if (existingUser) {
      return { message: 'Demo user already exists', user: existingUser };
    }

    // Create demo user
    const hashedPassword = await bcrypt.hash('password123', 10);
    const user = await this.prisma.user.create({
      data: {
        email: 'demo@capitalforge.com',
        password: hashedPassword,
        name: 'Demo User',
      },
    });

    return {
      message: 'Demo user created successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      credentials: {
        email: 'demo@capitalforge.com',
        password: 'password123',
      },
    };
  }
}
