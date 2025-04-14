import { createServer } from 'http';
require('dotenv').config();
import path from 'path';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import morganMiddleware from './logger/morgan.logger';
import requestIp from 'request-ip';
import YAML from 'yaml';
import express from 'express';
import cors from 'cors';
import { avoidInProduction } from './middleware/auth.middleware';
import { ApiError } from './utils/ApiError';
import { dbInstance } from './db/index';
import { ApiResponse } from './utils/ApiResponse';
import * as swaggerUi from 'swagger-ui-express';

// * Importing swagger document and configuration
const rootDir = process.cwd();
const __firname = path.join(rootDir, 'src');
const file = fs.readFileSync(path.resolve(__firname, './swagger.yaml'), 'utf8');
const swaggerDocument = YAML.parse(file?.replace('- url: ${{server}}', `- url: ${process.env.HOST_URL || 'http://localhost:8080'}/api/v1`));

const app = express();
const httpServer = createServer(app);

// global middlewares
app.use(
  cors({
    origin:
      process.env.CORS_ORIGIN === '*'
        ? '*' // This might give CORS error for some origins due to credentials set to true
        : process.env.CORS_ORIGIN?.split(','), // For multiple cors origin for production.
    credentials: true,
  })
);

app.use(requestIp.mw());

// Apply the rate limiting middleware to all requests
app.use(limiter);

app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: true, limit: '16kb' }));
app.use(express.static('public')); // configure static file to save images locally
app.use(cookieParser());

app.use(morganMiddleware);

//imports routes
import userRouter from './routes/user.routes';
import logger from './logger/winston.logger';
import { errorHandler } from './middleware/error.middleware';
import limiter from './configs/limiter';

//user auth
app.use('/api/v1/users', userRouter);

// ! 🚫 Danger Zone
app.delete('/api/v1/reset-db', avoidInProduction, async (req, res) => {
  if (dbInstance) {
    // // Drop the whole DB
    // await dbInstance.connection.db.dropDatabase({
    //   dbName: DB_NAME,
    // });

    const directory = './public/images';

    // Remove all product images from the file system
    fs.readdir(directory, (err, files) => {
      if (err) {
        // fail silently
        logger.error('Error while removing the images: ', err);
      } else {
        for (const file of files) {
          if (file === '.gitkeep') continue;
          fs.unlink(path.join(directory, file), (err) => {
            if (err) throw err;
          });
        }
      }
    });
    // remove the seeded users if exist
    fs.unlink('./public/temp/seed-credentials.json', (err) => {
      // fail silently
      if (err) logger.error('Seed credentials are missing.');
    });
    return res.status(200).json(new ApiResponse(200, null, 'Database dropped successfully'));
  }
  throw new ApiError(500, 'Something went wrong while dropping the database');
});

// * API DOCS
// ? Keeping swagger code at the end so that we can load swagger on "/" route
app.use(
  '/',
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, {
    swaggerOptions: {
      docExpansion: 'none', // keep all the sections collapsed by default
    },
    customSiteTitle: 'FreeAPI docs',
  })
);

// common error handling middleware
app.use(errorHandler);

export { httpServer };
