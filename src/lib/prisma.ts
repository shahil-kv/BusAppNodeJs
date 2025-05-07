import { PrismaClient } from '@prisma/client';

// Check if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development';

const prisma = new PrismaClient({
    transactionOptions: {
        // In development, use very long timeouts for debugging
        // In production, use reasonable timeouts
        maxWait: isDevelopment ? 300000 : 10000, // 5 minutes in dev, 10 seconds in prod
        timeout: isDevelopment ? 600000 : 15000, // 10 minutes in dev, 15 seconds in prod
        isolationLevel: 'ReadCommitted'
    }
});

export default prisma; 