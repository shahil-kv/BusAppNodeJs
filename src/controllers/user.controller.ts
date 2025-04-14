import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient()

const generateAccessAndRefreshTokens = async (userId: string) => {
  try {
    // return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, 'Something went wrong while generating the access token');
  }
};

const registerUser = asyncHandler(async (req) => {
  console.log(req.body);

  const { email, username, password, role } = req.body;
  return { email, username, password, role };
});

const loginUser = asyncHandler(async (req: any, res: any) => {
  return null;
});

const logoutUser = asyncHandler(async (req: any, res: any) => {
  return null;
});

const verifyEmail = asyncHandler(async (req: any, res: any) => {
  return null;
});

// This controller is called when user is logged in and he has snackbar that your email is not verified
// In case he did not get the email or the email verification token is expired
// he will be able to resend the token while he is logged in
const resendEmailVerification = asyncHandler(async (req: any, res: any) => {
  return null;
});

const refreshAccessToken = asyncHandler(async (req: any, res: any) => {
  return null;
});

const forgotPasswordRequest = asyncHandler(async (req: any, res: any) => {
  return null;
});

const resetForgottenPassword = asyncHandler(async (req: any, res: any) => {
  return null;
});

const assignRole = asyncHandler(async (req: any, res: any) => {
  return null;
});

const updateUserAvatar = asyncHandler(async (req: any, res: any) => {
  return null;
});

const changeCurrentPassword = asyncHandler(async (req: any, res: any) => {
  return null;
});

const getCurrentUser = asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany()
  res.json(users);
});

const handleSocialLogin = asyncHandler(async (req: any, res: any) => {
  return null;
});

console.log('hahil');

export {
  assignRole,
  changeCurrentPassword,
  forgotPasswordRequest,
  getCurrentUser,
  handleSocialLogin,
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
  resendEmailVerification,
  resetForgottenPassword,
  updateUserAvatar,
  verifyEmail,
};
