// import { AvailableUserRoles } from '../constant';
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
// import jwt from 'jsonwebtoken';

export const avoidInProduction = asyncHandler(async (req, res, next) => {
  if (process.env.NODE_ENV === "development") {
    next();
  } else {
    throw new ApiError(
      403,
      "This service is only available in the local environment. "
    );
  }
});
