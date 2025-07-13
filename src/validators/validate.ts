import { validationResult } from "express-validator";
import { ApiError } from "../utils/ApiError";
/**
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 *
 * @description This is the validate middleware responsible to centralize the error checking done by the `express-validator` `ValidationChains`.
 * This checks if the request validation has errors.
 * If yes then it structures them and throws an {@link ApiError} which forwards the error to the {@link errorHandler} middleware which throws a uniform response at a single place
 *
 */
export const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (errors.isEmpty()) {
    return next();
  }

  // Robustly extract field name for all error types, silence linter with any
  const extractedErrors = errors.array().map((err: any) => ({
    field: err?.path ?? err?.param ?? undefined,
    message: err?.msg,
  }));

  throw new ApiError(422, "Received data is not valid", extractedErrors);
};
