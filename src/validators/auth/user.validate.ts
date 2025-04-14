import { body } from "express-validator";
const busOwnerRegisteration = () => {
  return [
    // Existing username validation
    body("password")
      .trim()
      .notEmpty()
      .withMessage("Password is required")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long"),
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
      .withMessage("Phone number must be between 10 and 15 digits"),
  ];
};

const busOwnerLoginValidator = () => {
  return [
    body("phoneNumber")
      .trim()
      .notEmpty()
      .withMessage("Phone number is required"),
    // You could add more specific format checks here if needed later

    body("password").trim().notEmpty().withMessage("Password is required"),
  ];
};

export { busOwnerRegisteration, busOwnerLoginValidator };
