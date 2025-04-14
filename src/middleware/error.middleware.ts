import { ApiError } from "../utils/ApiError";
import logger from "../logger/winston.logger"; // Ensure Winston logger is imported

/**
 * Error handling middleware. MUST have 4 arguments.
 * @param {Error | ApiError} err The error object passed from previous middleware/handlers.
 * @param {import("express").Request} req The Express request object.
 * @param {import("express").Response} res The Express response object.
 * @param {import("express").NextFunction} next The next middleware function in the stack (rarely used in final error handlers).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const errorHandler = (err, req, res, next) => {
  let error = err;

  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500; // Default to 500 if status code not present
    const message = error.message || "Something went wrong";
    error = new ApiError(statusCode, message, error?.errors || [], err.stack);
  }

  const response = {
    success: false, // Indicate failure in the response body
    message: error.message,
    ...(error.errors && Array.isArray(error.errors) && error.errors.length > 0
      ? { errors: error.errors }
      : {}),
    ...(process.env.NODE_ENV === "development" ? { stack: error.stack } : {}),
  };

  logger.error(
    `${error.statusCode || 500} - ${error.message} - ${req.originalUrl} - ${
      req.method
    } - ${req.ip}`
  );

  const finalStatusCode =
    typeof error.statusCode === "number" ? error.statusCode : 500;
  return res.status(finalStatusCode).json(response);
};

export { errorHandler };
