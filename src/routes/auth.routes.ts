import { Router } from 'express';
import {
    checkPremiumStatus,
    loginUser,
    logoutUser,
    refreshAccessToken,
    registerUser,
    upgradeToPremium,
    verifyPhoneNumber,
} from '../controllers/auth.controller';
import { validateRegisterUser, validateVerifyPhoneNumber, validateLoginUser, validateUpgradeToPremium } from '../validators/user.validators';
import { verifyJWT, verifyRole } from '../middleware/auth.middleware';
import { validate } from '../validators/validate';

const router = Router();

/**
 * @swagger
 * /bus-owner/register:
 *   post:
 *     summary: Register new bus owner
 *     tags: [BusOwner]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phoneNumber, password, fullName]
 *             properties:
 *               phoneNumber: { type: string, description: "User's phone number" }
 *               password: { type: string, description: "Account password" }
 *               fullName: { type: string, description: "User's full name" }
 *               companyName: { type: string, description: "Optional company name" }
 *               opsMode: { type: string, enum: [INSERT, UPDATE, DELETE] }
 */
router
    .route("/register")
    .post((req, res, next) => {
        console.log('Register route hit:', req.body);
        next();
    }, validateRegisterUser, validate, registerUser);

/**
 * @swagger
 * /bus-owner/login:
 *   post:
 *     summary: Login bus owner
 *     tags: [BusOwner]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phoneNumber, password]
 *             properties:
 *               phoneNumber: { type: string, description: "Registered phone number" }
 *               password: { type: string, description: "Account password" }
 */
router
    .route("/login")
    .post(validateLoginUser, validate, loginUser);
    
// Public routes
/**
 * @swagger
 * /bus-owner/verify-phone:
 *   post:
 *     summary: Verify phone with OTP
 *     tags: [BusOwner]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phoneNumber, otp]
 *             properties:
 *               phoneNumber: { type: string, description: "Phone to verify" }
 *               otp: { type: string, description: "OTP from SMS" }
 */
router.post('/verify-phone', validateVerifyPhoneNumber, validate, verifyPhoneNumber);

// Protected routes
/**
 * @swagger
 * /bus-owner/refresh-token:
 *   post:
 *     summary: Get new access token
 *     tags: [BusOwner]
 *     security: [{ bearerAuth: [] }]
 */
router.post('/refresh-token', refreshAccessToken);

/**
 * @swagger
 * /bus-owner/logout:
 *   post:
 *     summary: Logout user
 *     tags: [BusOwner]
 *     security: [{ bearerAuth: [] }]
 */
router.post('/logout', verifyJWT, logoutUser);

/**
 * @swagger
 * /bus-owner/upgrade-premium:
 *   post:
 *     summary: Upgrade to premium
 *     tags: [BusOwner]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [durationMonths]
 *             properties:
 *               durationMonths: { type: integer, minimum: 1, maximum: 12 }
 */
router.post('/upgrade-premium', verifyJWT, validateUpgradeToPremium, upgradeToPremium);

/**
 * @swagger
 * /bus-owner/premium-status:
 *   get:
 *     summary: Check premium status
 *     tags: [BusOwner]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/premium-status', verifyJWT, checkPremiumStatus);

// Admin routes
/**
 * @swagger
 * /bus-owner/admin/users:
 *   get:
 *     summary: List all users (Admin)
 *     tags: [BusOwner]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/admin/users', verifyJWT, verifyRole(['ADMIN']), (req, res) => {
    // TODO: Implement admin user list endpoint
    res.json({ message: 'Admin user list endpoint' });
});

export default router; 