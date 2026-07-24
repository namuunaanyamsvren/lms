import { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { PrismaClient, Role, VerificationType } from '@prisma/client-auth';
import { signAccessToken, signRefreshToken, verifyRefreshToken, AppError } from '@lms/shared';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  sendVerificationSchema,
  verifyTokenSchema,
} from '../validators/auth.validator';

const prisma = new PrismaClient();

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const isProd = () => process.env.NODE_ENV === 'production';
const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
const generateRawToken = () => crypto.randomBytes(32).toString('hex');

const normalizeRole = (role: string): Role => {
  switch (role.toLowerCase()) {
    case 'teacher':
    case 'instructor':
      return Role.INSTRUCTOR;

    case 'admin':
    case 'org_admin':
      return Role.ORG_ADMIN;

    case 'super_admin':
      return Role.SUPER_ADMIN;

    case 'parent':
      return Role.PARENT;

    case 'staff':
      return Role.STAFF;

    case 'principal':
      return Role.PRINCIPAL;

    case 'student':
      return Role.STUDENT;

    default:
      throw AppError.badRequest(`Тодорхойгүй эрх (role): ${role}`);
  }
};

type TokenSubject = { id: string; organizationId: string; role: Role; email: string };

// Issues a fresh access/refresh pair and persists the refresh token so it can be revoked later.
// jti makes each refresh token unique even when issued for the same user within the same
// second (otherwise the JWT is byte-identical and collides with the DB's unique constraint).
const issueTokenPair = async (user: TokenSubject) => {
  const payload = {
    userId: user.id,
    organizationId: user.organizationId,
    role: user.role,
    email: user.email,
    jti: crypto.randomUUID(),
  };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await prisma.refreshToken.create({
    data: {
      organizationId: user.organizationId,
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });

  return { accessToken, refreshToken };
};

// No notification-service/SMTP is wired up yet, so the raw token is logged server-side
// (simulating what an email/SMS would carry) and echoed in the response outside prod.
const issueVerificationToken = async (
  user: { id: string; organizationId: string; email: string },
  type: VerificationType
) => {
  const rawToken = generateRawToken();
  await prisma.verificationToken.create({
    data: {
      organizationId: user.organizationId,
      userId: user.id,
      type,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
    },
  });
  console.log(`[Auth] ${type} баталгаажуулах token (${user.email}): ${rawToken}`);
  return rawToken;
};

export const register = async (req: Request, res: Response) => {
  try {
    const { organizationId, email, username, phone, password, firstName, lastName, role } =
      registerSchema.parse(req.body);

    const existingUser = await prisma.userAccount.findFirst({
      where: {
        organizationId,
        OR: [
          { email },
          ...(username ? [{ username }] : []),
          ...(phone ? [{ phone }] : []),
        ],
      },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Энэ хэрэглэгч (имэйл, username эсвэл утас) бүртгэлтэй байна.',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.userAccount.create({
      data: {
        organizationId,
        email,
        username: username || null,
        phone: phone || null,
        firstName: firstName || null,
        lastName: lastName || null,
        passwordHash,
        role: normalizeRole(role),
      },
    });

    const { accessToken, refreshToken } = await issueTokenPair(user);
    const emailVerificationToken = await issueVerificationToken(user, VerificationType.EMAIL);

    return res.status(201).json({
      success: true,
      message: 'Бүртгэл амжилттай.',
      data: {
        token: accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          phone: user.phone,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          organizationId: user.organizationId,
          isEmailVerified: user.isEmailVerified,
          isPhoneVerified: user.isPhoneVerified,
        },
        ...(isProd() ? {} : { emailVerificationToken }),
      },
    });
  } catch (error: any) {
    console.error('[Register Error]', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: error.errors[0]?.message || 'Мэдээлэл буруу байна.',
      });
    }

    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }

    return res.status(500).json({
      success: false,
      message: 'Дотоод серверийн алдаа.',
    });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { organizationId, identifier, email, username, phone, password } =
      loginSchema.parse(req.body);

    const targetKey = identifier || email || username || phone;

    if (!targetKey) {
      return res.status(400).json({
        success: false,
        message: 'Имэйл, хэрэглэгчийн нэр эсвэл утасны дугаар оруулна уу.',
      });
    }

    // Find user by organizationId AND (email OR username OR phone)
    const user = await prisma.userAccount.findFirst({
      where: {
        organizationId,
        OR: [
          { email: targetKey },
          { username: targetKey },
          { phone: targetKey },
        ],
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Нэвтрэх нэр эсвэл нууц үг буруу байна.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Хэрэглэгч идэвхгүй байна.',
      });
    }

    // Hash comparison via bcrypt
    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Нэвтрэх нэр эсвэл нууц үг буруу байна.',
      });
    }

    const { accessToken, refreshToken } = await issueTokenPair(user);

    return res.status(200).json({
      success: true,
      message: 'Амжилттай нэвтэрлээ.',
      data: {
        token: accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          phone: user.phone,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          organizationId: user.organizationId,
          isEmailVerified: user.isEmailVerified,
          isPhoneVerified: user.isPhoneVerified,
        },
      },
    });
  } catch (error: any) {
    console.error('[Login Error]', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: error.errors[0]?.message || 'Мэдээлэл буруу байна.',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Дотоод серверийн алдаа.',
    });
  }
};

export const refresh = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);

    try {
      verifyRefreshToken(refreshToken);
    } catch {
      return res.status(401).json({
        success: false,
        message: 'Хүчингүй эсвэл хугацаа дууссан refresh token.',
      });
    }

    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });

    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      return res.status(401).json({
        success: false,
        message: 'Хүчингүй эсвэл хугацаа дууссан refresh token.',
      });
    }

    const user = await prisma.userAccount.findUnique({ where: { id: stored.userId } });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Хэрэглэгч олдсонгүй эсвэл идэвхгүй.',
      });
    }

    // Rotate: revoke the used refresh token and issue a brand new pair.
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });
    const { accessToken, refreshToken: newRefreshToken } = await issueTokenPair(user);

    return res.status(200).json({
      success: true,
      data: { token: accessToken, refreshToken: newRefreshToken },
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: error.errors[0]?.message || 'Мэдээлэл буруу байна.',
      });
    }

    console.error('[Refresh Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Дотоод серверийн алдаа.',
    });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = logoutSchema.parse(req.body);

    await prisma.refreshToken.updateMany({
      where: { token: refreshToken, revoked: false },
      data: { revoked: true },
    });

    return res.status(200).json({ success: true, message: 'Амжилттай гарлаа.' });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: error.errors[0]?.message || 'Мэдээлэл буруу байна.',
      });
    }

    console.error('[Logout Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Дотоод серверийн алдаа.',
    });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { organizationId, email } = forgotPasswordSchema.parse(req.body);

    const user = await prisma.userAccount.findFirst({ where: { organizationId, email } });

    // Always respond the same way whether or not the account exists, to avoid leaking
    // which emails are registered.
    const genericResponse = {
      success: true,
      message: 'Хэрэв энэ имэйл бүртгэлтэй бол нууц үг сэргээх зааврыг илгээлээ.',
    };

    if (!user) {
      return res.status(200).json(genericResponse);
    }

    const rawToken = generateRawToken();
    await prisma.passwordResetToken.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    console.log(`[Auth] Нууц үг сэргээх token (${user.email}): ${rawToken}`);

    return res.status(200).json({
      ...genericResponse,
      ...(isProd() ? {} : { data: { resetToken: rawToken } }),
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: error.errors[0]?.message || 'Мэдээлэл буруу байна.',
      });
    }

    console.error('[ForgotPassword Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Дотоод серверийн алдаа.',
    });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = resetPasswordSchema.parse(req.body);

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Хүчингүй эсвэл хугацаа дууссан токен.',
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction([
      prisma.userAccount.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
      // Force re-login everywhere once the password changes.
      prisma.refreshToken.updateMany({
        where: { userId: resetToken.userId, revoked: false },
        data: { revoked: true },
      }),
    ]);

    return res.status(200).json({ success: true, message: 'Нууц үг амжилттай шинэчлэгдлээ.' });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: error.errors[0]?.message || 'Мэдээлэл буруу байна.',
      });
    }

    console.error('[ResetPassword Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Дотоод серверийн алдаа.',
    });
  }
};

export const sendVerification = async (req: Request, res: Response) => {
  try {
    const { type } = sendVerificationSchema.parse(req.body);

    const user = await prisma.userAccount.findUnique({ where: { id: req.user!.userId } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Хэрэглэгч олдсонгүй.' });
    }

    if (type === 'EMAIL' && user.isEmailVerified) {
      return res.status(400).json({ success: false, message: 'Имэйл аль хэдийн баталгаажсан.' });
    }
    if (type === 'PHONE' && user.isPhoneVerified) {
      return res.status(400).json({ success: false, message: 'Утасны дугаар аль хэдийн баталгаажсан.' });
    }
    if (type === 'PHONE' && !user.phone) {
      return res.status(400).json({ success: false, message: 'Утасны дугаар бүртгэгдээгүй байна.' });
    }

    const verificationToken = await issueVerificationToken(
      user,
      type === 'EMAIL' ? VerificationType.EMAIL : VerificationType.PHONE
    );

    return res.status(200).json({
      success: true,
      message: 'Баталгаажуулах код илгээлээ.',
      ...(isProd() ? {} : { data: { verificationToken } }),
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: error.errors[0]?.message || 'Мэдээлэл буруу байна.',
      });
    }

    console.error('[SendVerification Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Дотоод серверийн алдаа.',
    });
  }
};

export const verifyAccount = async (req: Request, res: Response) => {
  try {
    const { token } = verifyTokenSchema.parse(req.body);

    const verificationToken = await prisma.verificationToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });

    if (!verificationToken || verificationToken.usedAt || verificationToken.expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Хүчингүй эсвэл хугацаа дууссан токен.',
      });
    }

    await prisma.$transaction([
      prisma.userAccount.update({
        where: { id: verificationToken.userId },
        data:
          verificationToken.type === VerificationType.EMAIL
            ? { isEmailVerified: true }
            : { isPhoneVerified: true },
      }),
      prisma.verificationToken.update({ where: { id: verificationToken.id }, data: { usedAt: new Date() } }),
    ]);

    return res.status(200).json({ success: true, message: 'Амжилттай баталгаажлаа.' });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: error.errors[0]?.message || 'Мэдээлэл буруу байна.',
      });
    }

    console.error('[VerifyAccount Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Дотоод серверийн алдаа.',
    });
  }
};

export const getMe = async (req: Request, res: Response) => {
  try {
    const user = await prisma.userAccount.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        username: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        organizationId: true,
        isActive: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Хэрэглэгч олдсонгүй.',
      });
    }

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('[GetMe Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Дотоод серверийн алдаа.',
    });
  }
};
