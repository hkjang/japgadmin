import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';
import {
  RegisterDto,
  LoginDto,
  ChangePasswordDto,
  UpdateProfileDto,
  JwtPayload,
  AuthResponse,
} from './dto/auth.dto';
import { UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly SALT_ROUNDS = 12;
  private readonly ACCESS_TOKEN_EXPIRY = '15m';
  private readonly REFRESH_TOKEN_EXPIRY = '7d';
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('이메일이 이미 사용 중입니다.');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, this.SALT_ROUNDS);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        status: UserStatus.ACTIVE,
      },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email);

    // Create session
    await this.createSession(user.id, tokens.accessToken, tokens.refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status,
        mfaEnabled: user.mfaEnabled,
      },
      ...tokens,
    };
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingTime = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new UnauthorizedException(
        `계정이 잠겨 있습니다. ${remainingTime}분 후에 다시 시도해주세요.`,
      );
    }

    // Check if account is active
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('계정이 비활성화되었습니다.');
    }

    // Verify password
    if (!user.passwordHash) {
      throw new UnauthorizedException('비밀번호가 설정되지 않았습니다. SSO로 로그인해주세요.');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      // Increment failed attempts
      const failedAttempts = user.failedLoginAttempts + 1;
      const updateData: any = { failedLoginAttempts: failedAttempts };

      if (failedAttempts >= this.MAX_FAILED_ATTEMPTS) {
        updateData.lockedUntil = new Date(Date.now() + this.LOCKOUT_DURATION);
        updateData.status = UserStatus.LOCKED;
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    // Reset failed attempts on successful login
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        status: UserStatus.ACTIVE,
        lastLoginAt: new Date(),
      },
    });

    // Generate tokens
    const expiresIn = dto.rememberMe ? 30 * 24 * 60 * 60 : 15 * 60; // 30 days or 15 minutes
    const tokens = await this.generateTokens(user.id, user.email, dto.rememberMe);

    // Create session
    await this.createSession(user.id, tokens.accessToken, tokens.refreshToken, ipAddress, userAgent);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status,
        mfaEnabled: user.mfaEnabled,
      },
      ...tokens,
    };
  }

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.getRefreshTokenSecret(),
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('유효하지 않은 토큰입니다.');
      }

      // Check if session exists
      const session = await this.prisma.session.findFirst({
        where: {
          refreshToken,
          userId: payload.sub,
          expiresAt: { gt: new Date() },
        },
        include: { user: true },
      });

      if (!session) {
        throw new UnauthorizedException('세션이 만료되었습니다.');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(session.user.id, session.user.email);

      // Update session with new tokens
      await this.prisma.session.update({
        where: { id: session.id },
        data: {
          token: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });

      return {
        user: {
          id: session.user.id,
          email: session.user.email,
          firstName: session.user.firstName,
          lastName: session.user.lastName,
          status: session.user.status,
          mfaEnabled: session.user.mfaEnabled,
        },
        ...tokens,
      };
    } catch (error) {
      throw new UnauthorizedException('유효하지 않은 토큰입니다.');
    }
  }

  async logout(userId: string, token: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: {
        userId,
        token,
      },
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { userId },
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.passwordHash) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    const isCurrentPasswordValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);

    if (!isCurrentPasswordValid) {
      throw new BadRequestException('현재 비밀번호가 올바르지 않습니다.');
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, this.SALT_ROUNDS);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    // Invalidate all sessions except current
    // This would require knowing the current session token
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<any> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
    });

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar,
      status: user.status,
      mfaEnabled: user.mfaEnabled,
    };
  }

  async getProfile(userId: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: { permissions: true },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar,
      status: user.status,
      mfaEnabled: user.mfaEnabled,
      provider: user.provider,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      roles: user.roles.map((ur) => ({
        id: ur.role.id,
        name: ur.role.name,
        description: ur.role.description,
        scopeType: ur.role.scopeType,
        expiresAt: ur.expiresAt,
        permissions: ur.role.permissions.map((p) => ({
          resource: p.resource,
          action: p.action,
        })),
      })),
    };
  }

  async validateUser(payload: JwtPayload): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        roles: {
          include: {
            role: {
              include: { permissions: true },
            },
          },
          where: {
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
        },
      },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      roles: user.roles.map((ur) => ur.role),
    };
  }

  async getSessions(userId: string): Promise<any[]> {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    return sessions.map((s) => ({
      id: s.id,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
    }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: {
        id: sessionId,
        userId,
      },
    });
  }

  private async generateTokens(
    userId: string,
    email: string,
    rememberMe?: boolean,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const accessTokenPayload: JwtPayload = {
      sub: userId,
      email,
      type: 'access',
    };

    const refreshTokenPayload: JwtPayload = {
      sub: userId,
      email,
      type: 'refresh',
    };

    const accessTokenExpiry = rememberMe ? '1d' : this.ACCESS_TOKEN_EXPIRY;
    const refreshTokenExpiry = rememberMe ? '30d' : this.REFRESH_TOKEN_EXPIRY;

    const accessToken = this.jwtService.sign(accessTokenPayload, {
      secret: this.getAccessTokenSecret(),
      expiresIn: accessTokenExpiry,
    });

    const refreshToken = this.jwtService.sign(refreshTokenPayload, {
      secret: this.getRefreshTokenSecret(),
      expiresIn: refreshTokenExpiry,
    });

    const expiresIn = rememberMe ? 24 * 60 * 60 : 15 * 60; // in seconds

    return { accessToken, refreshToken, expiresIn };
  }

  private async createSession(
    userId: string,
    accessToken: string,
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.prisma.session.create({
      data: {
        userId,
        token: accessToken,
        refreshToken,
        ipAddress,
        userAgent,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });
  }

  private getAccessTokenSecret(): string {
    return this.configService.get<string>('JWT_ACCESS_SECRET') || 'jwt-access-secret-change-in-production';
  }

  private getRefreshTokenSecret(): string {
    return this.configService.get<string>('JWT_REFRESH_SECRET') || 'jwt-refresh-secret-change-in-production';
  }

  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.prisma.session.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    return result.count;
  }
}
