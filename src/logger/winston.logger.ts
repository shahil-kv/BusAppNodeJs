import * as winston from "winston";
import "winston-daily-rotate-file"; // Still need this transport

// Define your severity levels.
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// This method set the current severity based on NODE_ENV
const level = () => {
  const env = process.env.NODE_ENV || "development";
  const isDevelopment = env === "development";
  return isDevelopment ? "debug" : "info"; // Log info level and up in production files
};

// Define different colors for each level.
const colors = {
  error: "red",
  warn: "yellow",
  info: "blue",
  http: "magenta",
  debug: "white",
};

winston.addColors(colors);

// Format for log files (no colors)
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "DD MMM, YYYY - HH:mm:ss:ms" }), // Corrected YYYY
  winston.format.printf(
    (info) => `[${info.timestamp}] ${info.level}: ${info.message}`
  )
);

// Format for the console (with colors)
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: "DD MMM, YYYY - HH:mm:ss:ms" }), // Corrected YYYY
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `[${info.timestamp}] ${info.level}: ${info.message}`
  )
);

// Define transports
const transports = [
  new winston.transports.Console({
    format: consoleFormat,
  }),

  new winston.transports.DailyRotateFile({
    level: "error",
    filename: "logs/error.log", // Fixed filename, no %DATE%
    zippedArchive: false, // Keep archives uncompressed
    maxSize: "10m", // Rotate when file exceeds 10MB
    maxFiles: 1, // Keep only the most recent 1 archive file (e.g., error.log.1)
    format: logFormat,
  }),
  new winston.transports.DailyRotateFile({
    level: "info", // Captures info, warn, error
    filename: "logs/info.log",
    zippedArchive: false,
    maxSize: "20m", // Rotate info log at 20MB
    maxFiles: 1, // Keep only info.log.1
    format: logFormat,
  }),
  new winston.transports.DailyRotateFile({
    level: "http",
    filename: "logs/http.log",
    zippedArchive: false,
    maxSize: "50m", // Rotate http log at 50MB
    maxFiles: 1, // Keep only http.log.1
    format: logFormat,
  }),
];

// Create the logger instance
const logger = winston.createLogger({
  level: level(),
  levels,
  transports,
  exitOnError: false,
});

export default logger;
