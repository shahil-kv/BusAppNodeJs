import * as dotenv from 'dotenv';
import * as path from 'path';

// Load the appropriate .env file based on NODE_ENV
const envFile = process.env.NODE_ENV === 'production' ? '.env.cloud' : '.env.dev';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

// Export the loaded environment variables
export const env = {
    NODE_ENV: process.env.NODE_ENV,
    PORT: parseInt(process.env.PORT || '3000', 10),
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1d',
    API_URL: process.env.API_URL,
    CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
    BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10),
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
    APP_NAME: process.env.APP_NAME,
    API_PREFIX: process.env.API_PREFIX || '/api/v1',
    HOST: process.env.HOST || 'localhost',
    LOG_LEVEL: process.env.LOG_LEVEL || 'debug'
}; 