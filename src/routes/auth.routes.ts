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
 * /bus-owner/register-busowner:
 *   post:
 *     summary: Register a new bus owner
 *     tags: [BusOwner]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               # Define properties based on busOwnerRegisteration validator
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *               # Add other required fields...
 *     responses:
 *       201:
 *         description: Bus owner created successfully.
 *       400:
 *         description: Invalid input data.
 *       500:
 *         description: Internal server error
 */
authRouter
    .route("/register")
    .post((req, res, next) => {
        next();
    }, validateRegisterUser, validate, registerUser);

/**
 * @swagger
 * /bus-owner/login-busowner:
 *   post:
 *     summary: Login a bus owner
 *     tags: [BusOwner]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               # Define properties based on busOwnerLoginValidator
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Login successful, returns user info and tokens.
 *       400:
 *         description: Invalid credentials or input data.
 *       401:
 *         description: Unauthorized (wrong password).
 *       404:
 *         description: User not found.
 *       500:
 *         description: Internal server error
 */
authRouter
    .route("/login")
    .post(validateLoginUser, validate, loginUser);
// Public routes
authRouter.post('/verify-phone', validateVerifyPhoneNumber, validate, verifyPhoneNumber);

// Protected routes
authRouter.post('/refresh-token', refreshAccessToken);
authRouter.post('/logout', verifyJWT, logoutUser);
authRouter.post('/upgrade-premium', verifyJWT, validateUpgradeToPremium, upgradeToPremium);
authRouter.get('/premium-status', verifyJWT, checkPremiumStatus);

// Admin routes
authRouter.get('/admin/users', verifyJWT, verifyRole(['ADMIN']), (req, res) => {
    // TODO: Implement admin user list endpoint
    res.json({ message: 'Admin user list endpoint' });
});

export default authRouter; 