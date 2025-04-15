import { body } from "express-validator"; // Import both body and query

const manageBusValidation = () => {
  return [
    body("opsMode")
      .trim()
      .notEmpty()
      .withMessage("opsMode must be INSERT, UPDATE, or DELETE."),
  ];
};

const GetBusOwnerDashboardValidation = () => {
  return [
    body("ownerId") // Validate the body parameter 'ownerId'
      .trim()
      .notEmpty()
      .withMessage("Body parameter 'ownerId' is required.")
      .isInt({ min: 1 })
      .withMessage("Body parameter 'ownerId' must be a positive integer."),
  ];
};

export { manageBusValidation, GetBusOwnerDashboardValidation };
