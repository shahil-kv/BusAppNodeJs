import * as dotenv from "dotenv";
import * as path from "path";

// Load the appropriate .env file based on NODE_ENV
const envFile =
  process.env.NODE_ENV === "production" ? ".env.cloud" : ".env.dev";
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

console.log(process.env.NODE_ENV);

// Export the loaded environment variables
export const env = {
  NODE_ENV: process.env.NODE_ENV,
  PORT: parseInt(process.env.PORT || "3000", 10),
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "1d",
  API_URL: process.env.API_URL,
  CORS_ORIGIN: process.env.CORS_ORIGIN || "*",
  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS || "10", 10),
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
  APP_NAME: process.env.APP_NAME,
  API_PREFIX: process.env.API_PREFIX || "/api/v1",
  HOST: process.env.HOST || "localhost",
  LOG_LEVEL: process.env.LOG_LEVEL || "debug",
  // REDIS_HOST: process.env.REDIS_HOST || '127.0.0.1',
  // REDIS_PORT: process.env.REDIS_PORT || '6379',
  // REDIS_PASSWORD: process.env.REDIS_PASSWORD || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  NGROK_BASE_URL: process.env.NGROK_BASE_URL,
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
  ELEVENLABS_VOICE_ID: process.env.ELEVENLABS_VOICE_ID,
  // Google Cloud Speech-to-Text for Malayalam support
  GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  GOOGLE_CLOUD_PROJECT_ID: process.env.GOOGLE_CLOUD_PROJECT_ID,
};
