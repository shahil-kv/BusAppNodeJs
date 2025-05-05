import { Request, Response } from 'express';
import AuthService from '../services/auth.service';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

export const registerUser = asyncHandler(async (req: Request, res: Response) => {

    const { phoneNumber, password, fullName, gmail } = req.body;

    const user = await AuthService.registerUser(
        phoneNumber,
        password,
        fullName,
        gmail,
    );

    return res
        .status(201)
        .json(
            new ApiResponse(
                201,
                { user },
                'User registered successfully. Please verify your phone number.'
            )
        );
});

export const verifyPhoneNumber = asyncHandler(async (req: Request, res: Response) => {
    const { phoneNumber, otp } = req.body;

    await AuthService.verifyPhoneNumber(phoneNumber, otp);

    return res
        .status(200)
        .json(new ApiResponse(200, {}, 'Phone number verified successfully'));
});

export const loginUser = asyncHandler(async (req: Request, res: Response) => {
    const { phoneNumber, password } = req.body;

    const { user, tokens } = await AuthService.loginUser(phoneNumber, password);

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict' as const
    };

    return res
        .status(200)
        .cookie('accessToken', tokens.accessToken, options)
        .cookie('refreshToken', tokens.refreshToken, options)
        .json(
            new ApiResponse(
                200,
                { user, tokens },
                'User logged in successfully'
            )
        );
});

export const refreshAccessToken = asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
        throw new ApiError(401, 'Refresh token is required');
    }

    const tokens = await AuthService.refreshAccessToken(refreshToken);

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict' as const
    };

    return res
        .status(200)
        .cookie('accessToken', tokens.accessToken, options)
        .cookie('refreshToken', tokens.refreshToken, options)
        .json(
            new ApiResponse(
                200,
                { tokens },
                'Access token refreshed successfully'
            )
        );
});

export const logoutUser = asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
        throw new ApiError(401, 'Refresh token is required');
    }

    await AuthService.logoutUser(req.user.id, refreshToken);

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict' as const
    };

    return res
        .status(200)
        .clearCookie('accessToken', options)
        .clearCookie('refreshToken', options)
        .json(new ApiResponse(200, {}, 'User logged out successfully'));
});

export const upgradeToPremium = asyncHandler(async (req: Request, res: Response) => {
    const { duration_months } = req.body;

    const user = await AuthService.upgradeToPremium(req.user.id, duration_months);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { user },
                'User upgraded to premium successfully'
            )
        );
});

export const checkPremiumStatus = asyncHandler(async (req: Request, res: Response) => {
    const isPremium = await AuthService.checkPremiumStatus(req.user.id);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { isPremium },
                'Premium status checked successfully'
            )
        );
});
