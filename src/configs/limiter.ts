import rateLimit from "express-rate-limit";
import { Request, Response } from "express";
import "express";

// src/types/express.d.ts (or any other global types file)

declare module "express" {
  interface Request {
    clientIp?: string;
  }
}

// Create the limiter with proper types
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // Limit each IP to 5000 requests per window
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers

  keyGenerator: (request: Request): string => {
    return request.clientIp || request.ip || "";
  },

  handler: (req: Request, res: Response) => {
    return res.status(429).json({
      status: "error",
      message: `Too many requests. You are only allowed 5000 requests per 15 minutes.`,
    });
  },
});

export default limiter;
