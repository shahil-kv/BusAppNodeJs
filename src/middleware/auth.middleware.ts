// import { AvailableUserRoles } from '../constant';
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

if (!process.env.JWT_ACCESS_SECRET) {
  throw new Error('JWT access secret is not configured');
}

declare module 'express' {
  interface Request {
    user?: {
      id: number;
      phone_number: string;
      role: string;
    };
  }
}

export const avoidInProduction = asyncHandler(async (req, res, next) => {
  if (process.env.NODE_ENV === "development") {
    next();
  } else {
    throw new ApiError(
      403,
      "This service is only available in the local environment. "
    );
  }
});

export const verifyJWT = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies.accessToken || req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      throw new ApiError(401, 'Unauthorized request');
    }

    const decodedToken = jwt.verify(token, process.env.JWT_ACCESS_SECRET) as {
      id: number;
      phone_number: string;
      role: string;
    };

    const user = await prisma.users.findUnique({
      where: { id: decodedToken.id }
    });

    if (!user) {
      throw new ApiError(401, 'Invalid access token');
    }

    req.user = decodedToken;
    next();
  } catch (error) {
    throw new ApiError(401, error instanceof Error ? error.message : 'Invalid access token');
  }
};

export const verifyPremium = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.users.findUnique({
      where: { id: req.user?.id }
    });

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    if (!user.is_premium) {
      throw new ApiError(403, 'Premium subscription required');
    }

    if (user.premium_expiry && user.premium_expiry < new Date()) {
      await prisma.users.update({
        where: { id: user.id },
        data: {
          is_premium: false,
          premium_expiry: null
        }
      });
      throw new ApiError(403, 'Premium subscription expired');
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const verifyRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new ApiError(401, 'Unauthorized request');
      }

      if (!roles.includes(req.user.role)) {
        throw new ApiError(403, 'Access denied');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
