import { body } from "express-validator";

// Validation middleware
const validateRegisterUser = [
    body('phoneNumber')
        .trim()
        .notEmpty()
        .withMessage('Phone number is required'),
    body('password')
        .trim()
        .notEmpty()
        .withMessage('Password is required'),
    body('fullName')
        .trim()
        .notEmpty()
        .withMessage('Full name is required'),
    body('companyName')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Company name cannot be empty'),
    body('opsMode')
        .isIn(['INSERT', 'UPDATE', "DELETE"])
        .withMessage('Invalid operation mode')
];

const validateVerifyPhoneNumber = [
    body('phoneNumber')
        .trim()
        .notEmpty()
        .withMessage('Phone number is required'),
    body('otp')
        .trim()
        .notEmpty()
        .withMessage('OTP is required')
];

const validateLoginUser = [
    body('phoneNumber')
        .trim()
        .notEmpty()
        .withMessage('Phone number is required'),
    body('password')
        .trim()
        .notEmpty()
        .withMessage('Password is required')
];

const validateUpgradeToPremium = [
    body('durationMonths')
        .isInt({ min: 1, max: 12 })
        .withMessage('Duration must be between 1 and 12 months')
];

export { validateRegisterUser, validateVerifyPhoneNumber, validateLoginUser, validateUpgradeToPremium };