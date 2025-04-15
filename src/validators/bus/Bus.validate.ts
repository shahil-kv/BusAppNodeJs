import { body } from "express-validator";

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
    body("ownerId") // Check the route parameter named 'ownerId'
      .notEmpty()
      .withMessage("Owner ID route parameter is required.")
      .isInt({ min: 1 })
      .withMessage("Owner ID must be a positive integer.")
      .toInt(), // Convert valid parameter to an integer
  ];
};

export { manageBusValidation, GetBusOwnerDashboardValidation };
