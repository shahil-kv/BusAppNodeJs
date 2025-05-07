import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import twilio from 'twilio';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { v4 as uuidv4 } from 'uuid';
import { ApiError } from '../utils/ApiError';

const prisma = new PrismaClient();

// Initialize Twilio client with proper error handling
if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
    throw new Error('Twilio credentials are not properly configured');
}

const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT secrets are not configured');
}

interface TokenPayload {
    id: number;
    phone_number: string;
    role: string;
}

interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}

class AuthService {
    private static readonly ACCESS_TOKEN_EXPIRY = '15m';
    private static readonly REFRESH_TOKEN_EXPIRY = '7d';
    private static readonly OTP_EXPIRY_MINUTES = 5;

    // Generate JWT tokens
    private static generateTokens(payload: TokenPayload): AuthTokens {
        const accessToken = jwt.sign(
            payload,
            process.env.JWT_ACCESS_SECRET,
            { expiresIn: this.ACCESS_TOKEN_EXPIRY }
        );

        const refreshToken = jwt.sign(
            payload,
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: this.REFRESH_TOKEN_EXPIRY }
        );

        return { accessToken, refreshToken };
    }

    // Hash password
    private static async hashPassword(password: string): Promise<string> {
        const salt = await bcrypt.genSalt(10);
        return bcrypt.hash(password, salt);
    }

    // Compare password
    private static async comparePassword(password: string, hash: string): Promise<boolean> {
        return bcrypt.compare(password, hash);
    }

    // Generate OTP
    private static generateOTP(): string {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    // Send OTP via SMS
    private static async sendOTP(phoneNumber: string, otp: string): Promise<void> {
        try {

            await twilioClient.messages.create({
                body: `Your OTP for Verification Code For ${process.env.APP_NAME} is: ${otp}. Valid for 5 minutes.`,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: phoneNumber
            });

        } catch (error) {
            console.error('Failed to send OTP:', error);
            throw new ApiError(500, 'Failed to send OTP. Please try again later.');
        }
    }

    // Register new user
    static async registerUser(
        phoneNumber: string,
        password: string,
        fullName: string,
        email?: string,
        role = 'USER'
    ) {
        // Clean phone number by removing whitespace
        const cleanedPhoneNumber = phoneNumber.replace(/\s+/g, '');

        // Check if user or pending registration already exists
        const existingUser = await prisma.users.findFirst({
            where: {
                OR: [
                    { phone_number: cleanedPhoneNumber },
                    { email: email }
                ]
            }
        });
        const pending = await prisma.pending_registrations.findFirst({
            where: {
                OR: [
                    { phone_number: cleanedPhoneNumber },
                    { email: email }
                ]
            }
        });

        if (existingUser) {
            throw new ApiError(409, 'User with this phone number or email already exists');
        }

        // If a pending registration exists, delete it so user can retry registration
        if (pending) {
            await prisma.pending_registrations.delete({
                where: { phone_number: cleanedPhoneNumber }
            });
        }

        // Hash password
        const hashedPassword = await this.hashPassword(password);

        // Generate OTP
        const otp = this.generateOTP();
        const otpExpiry = new Date();
        otpExpiry.setMinutes(otpExpiry.getMinutes() + this.OTP_EXPIRY_MINUTES);

        // Store in pending_registrations
        await prisma.pending_registrations.create({
            data: {
                phone_number: cleanedPhoneNumber,
                password_hash: hashedPassword,
                full_name: fullName,
                email,
                role,
                phone_verification_otp: otp,
                phone_verification_expiry: otpExpiry
            }
        });

        // Send OTP
        await this.sendOTP(cleanedPhoneNumber, otp);

        return { message: 'OTP sent to your phone number' };
    }

    // Verify phone number with OTP
    static async verifyPhoneNumber(phoneNumber: string, otp: string): Promise<boolean> {
        const pending = await prisma.pending_registrations.findUnique({
            where: { phone_number: phoneNumber }
        });

        if (!pending) {
            throw new ApiError(404, 'No pending registration found');
        }

        if (pending.phone_verification_otp !== otp) {
            throw new ApiError(400, 'Invalid OTP');
        }

        if (pending.phone_verification_expiry < new Date()) {
            throw new ApiError(400, 'OTP expired');
        }

        // Create user in users table
        await prisma.users.create({
            data: {
                phone_number: pending.phone_number,
                password_hash: pending.password_hash,
                full_name: pending.full_name,
                email: pending.email,
                role: pending.role,
                is_phone_verified: true
            }
        });

        // Delete from pending_registrations
        await prisma.pending_registrations.delete({
            where: { phone_number: phoneNumber }
        });

        return true;
    }

    // Login user
    static async loginUser(phoneNumber: string, password: string) {
        const user = await prisma.users.findUnique({
            where: { phone_number: phoneNumber }
        });

        if (!user) {
            throw new ApiError(404, 'User not found ?');
        }

        if (!user.is_phone_verified) {
            throw new ApiError(403, 'Phone number not verified');
        }

        const isPasswordValid = await this.comparePassword(password, user.password_hash);
        if (!isPasswordValid) {
            throw new ApiError(401, 'Invalid credentials');
        }

        const tokens = this.generateTokens({
            id: user.id,
            phone_number: user.phone_number,
            role: user.role || 'USER'
        });

        // Store refresh token
        await prisma.refresh_tokens.create({
            data: {
                user_id: user.id,
                token: tokens.refreshToken,
                expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
            }
        });

        return { user, tokens };
    }

    // Refresh access token
    static async refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
        try {
            const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET) as TokenPayload;

            const tokenExists = await prisma.refresh_tokens.findFirst({
                where: {
                    token: refreshToken,
                    user_id: decoded.id,
                    expires_at: { gt: new Date() }
                }
            });

            if (!tokenExists) {
                throw new ApiError(401, 'Invalid refresh token');
            }

            const tokens = this.generateTokens({
                id: decoded.id,
                phone_number: decoded.phone_number,
                role: decoded.role
            });

            // Update refresh token
            await prisma.refresh_tokens.update({
                where: { id: tokenExists.id },
                data: {
                    token: tokens.refreshToken,
                    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                }
            });

            return tokens;
        } catch (error) {
            throw new ApiError(401, 'Invalid refresh token ' + error);
        }
    }

    // Logout user
    static async logoutUser(userId: number, refreshToken: string): Promise<void> {
        await prisma.refresh_tokens.deleteMany({
            where: {
                user_id: userId,
                token: refreshToken
            }
        });
    }

    // Upgrade to premium
    static async upgradeToPremium(userId: number, durationMonths: number) {
        const user = await prisma.users.findUnique({
            where: { id: userId }
        });

        if (!user) {
            throw new ApiError(404, 'User not found');
        }

        const expiryDate = new Date();
        expiryDate.setMonth(expiryDate.getMonth() + durationMonths);

        return prisma.users.update({
            where: { id: userId },
            data: {
                is_premium: true,
                premium_expiry: expiryDate
            }
        });
    }

    // Check premium status
    static async checkPremiumStatus(userId: number): Promise<boolean> {
        const user = await prisma.users.findUnique({
            where: { id: userId }
        });

        if (!user) {
            throw new ApiError(404, 'User not found');
        }

        if (!user.is_premium) {
            return false;
        }

        if (user.premium_expiry && user.premium_expiry < new Date()) {
            await prisma.users.update({
                where: { id: userId },
                data: {
                    is_premium: false,
                    premium_expiry: null
                }
            });
            return false;
        }

        return true;
    }
}

export default AuthService; 