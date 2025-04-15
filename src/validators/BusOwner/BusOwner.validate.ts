import { body } from "express-validator";

const busOwnerRegisteration = () => {
  return [
    // Add validation for opsMode (assuming it's required)
    body("opsMode").trim().notEmpty().withMessage("Operation mode is required"),
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
      // More robust phone validation (adjust locale 'any' if needed)
      .isMobilePhone("any", { strictMode: false })
      .withMessage("Please provide a valid phone number"),
    // Add validation for password complexity
    body("password").trim().notEmpty().withMessage("Password is required"),
    // Add optional validation for companyName
    body("companyName")
      .optional({ checkFalsy: true }) // Allows empty string or null/undefined
      .trim()
      .isLength({ max: 100 }) // Example max length
      .withMessage("Company name cannot exceed 100 characters"),
  ];
};

const busOwnerLoginValidator = () => {
  return [
    body("phoneNumber")
      .trim()
      .notEmpty()
      .withMessage("Phone number is required")
      // Also validate format on login for consistency
      .isMobilePhone("any", { strictMode: false })
      .withMessage("Please provide a valid phone number"),
    body("password").notEmpty().withMessage("Password is required"), // No need to trim password on login
  ];
};

export { busOwnerRegisteration, busOwnerLoginValidator };
