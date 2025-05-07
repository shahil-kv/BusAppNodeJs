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

const authRouter = Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register news user
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *               phone: { type: string }
 */
authRouter
    .route("/register")
    .post((req, res, next) => {
        next();
    }, validateRegisterUser, validate, registerUser);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login user
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 */
authRouter
    .route("/login")
    .post(validateLoginUser, validate, loginUser);

/**
 * @swagger
 * /auth/verify-phone:
 *   post:
 *     tags: [Auth]
 *     summary: Verify phone number
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phone: { type: string }
 *               code: { type: string }
 */
authRouter.post('/verify-phone', validateVerifyPhoneNumber, validate, verifyPhoneNumber);

/**
 * @swagger
 * /auth/refresh-token:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken: { type: string }
 */
authRouter.post('/refresh-token', refreshAccessToken);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout user
 *     security:
 *       - bearerAuth: []
 */
authRouter.post('/logout', verifyJWT, logoutUser);

/**
 * @swagger
 * /auth/upgrade-premium:
 *   post:
 *     tags: [Auth]
 *     summary: Upgrade to premium
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               paymentMethod: { type: string }
 */
authRouter.post('/upgrade-premium', verifyJWT, validateUpgradeToPremium, upgradeToPremium);

/**
 * @swagger
 * /auth/premium-status:
 *   get:
 *     tags: [Auth]
 *     summary: Check premium status
 *     security:
 *       - bearerAuth: []
 */
authRouter.get('/premium-status', verifyJWT, checkPremiumStatus);

/**
 * @swagger
 * /auth/admin/users:
 *   get:
 *     tags: [Auth]
 *     summary: Get admin users list
 *     security:
 *       - bearerAuth: []
 */
authRouter.get('/admin/users', verifyJWT, verifyRole(['ADMIN']), (req, res) => {
    res.json({ message: 'Admin user list endpoint' });
});

export default authRouter; 