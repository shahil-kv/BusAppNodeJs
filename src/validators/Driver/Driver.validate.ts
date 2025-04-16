import { body } from "express-validator";

const busDriverRegisteration = () => {
    return [
        // Add validation for opsMode (assuming it's required)
        body("opsMode")
            .trim()
            .notEmpty()
            .withMessage("Operation mode is required")
            .isIn(["INSERT"])
            .withMessage("Invalid operation mode"),
        // Add validation for full_name
        body("fullName")
            .trim()
            .notEmpty()
            .withMessage("Full name is required")
            .isLength({ min: 2 })
            .withMessage("Full name must be at least 2 characters long"),
        // Add validation for phone_number
        body("phoneNumber")
            .trim()
            .notEmpty()
            .withMessage("Phone number is required")
            .isLength({ min: 10, max: 15 })
            .withMessage("Phone number must be between 10 and 15 digits")
            .matches(/^\+?[0-9]+$/)
            .withMessage("Phone number must contain only digits and optional +"),
        // Add validation for password complexity
        body("password")
            .trim()
            .notEmpty()
            .withMessage("Password is required")
            .isLength({ min: 8 })
            .withMessage("Password must be at least 8 characters long"),
        // Add validation for license number
        body("licenseNumber")
            .trim()
            .notEmpty()
            .withMessage("License number is required")
            .isLength({ min: 5, max: 50 })
            .withMessage("License number must be between 5 and 50 characters"),
        // Add validation for license expiry date
        body("licenseExpiryDate")
            .trim()
            .notEmpty()
            .withMessage("License expiry date is required")
            .isDate()
            .withMessage("Invalid date format")
            .custom((value) => {
                const expiryDate = new Date(value);
                const today = new Date();
                if (expiryDate <= today) {
                    throw new Error("License has expired");
                }
                return true;
            }),
    ];
};

const busDriverLogin = () => {
    return [
        body("phoneNumber")
            .trim()
            .notEmpty()
            .withMessage("Phone number is required")
            .isLength({ min: 10, max: 15 })
            .withMessage("Phone number must be between 10 and 15 digits")
            .matches(/^\+?[0-9]+$/)
            .withMessage("Phone number must contain only digits and optional +"),
        body("password")
            .trim()
            .notEmpty()
            .withMessage("Password is required")
            .isLength({ min: 8 })
            .withMessage("Password must be at least 8 characters long"),
    ];
};

export { busDriverRegisteration, busDriverLogin };  