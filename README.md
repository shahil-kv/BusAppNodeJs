# Bus Tracking App Backend

Welcome to the Bus Tracking App Backend! This document explains what the project does, how it's structured, and how to get it running.

## What is this?

This is the backend server for a Bus Tracking application. It handles:

- Managing bus owners (registration, login).
- Managing buses (adding, updating, deleting buses linked to owners).
- Managing bus routes (defining stops, sequence, and timings).
- Providing an API (Application Programming Interface) for a frontend application (like a web or mobile app) to interact with.

Think of it as the "brain" behind the scenes that stores and processes all the data related to buses and owners.

## How it Works: The Request Lifecycle

When a request comes into the server (e.g., someone trying to register a new bus owner), it goes through several steps. This diagram shows the typical
flow:

![Request Flow Diagram](src/assets/images/diagram.png)

### Detailed Startup & Request Flow Explanation

#### 🟢 App Startup Process (`npm start`)

1.  **Execution:** Runs `node your-main-file.js` (e.g., `src/main.ts` via Nx).
2.  **Module Loading:** All `require`/`import` statements are processed.
3.  **Environment Variables:** `dotenv.config()` loads variables from the `.env` file.
4.  **App Initialization:**
    - `express()` creates the main Express application object.
    - Middleware Registration: All `app.use(...)` calls register middleware functions (they don't execute yet). This includes global middleware and
      router registration (e.g., `app.use('/api/v1/bus-owner', busOwnerRouter)`).
    - Swagger UI Setup (Optional): Configures the API documentation endpoint.
    - Error Handler Registration: `app.use(errorHandler)` registers the global error handler (must be last).
5.  **Server Starts:** `httpServer.listen(port, ...)` makes the application start listening for incoming HTTP requests on the configured port.

#### 📥 Request Flow (Example: `POST /api/v1/bus-owner/login`)

1.  **Raw Request Arrival:** Node.js's built-in HTTP server receives the raw request and passes it to the Express application instance.
2.  **Global Middleware Pipeline (Execution Order Matters):** The request flows through the globally registered middleware in `src/app.ts`:
    - `cors`: Checks if the request origin is allowed.
    - `request-ip`: Adds the client's IP address to `req.clientIp`.
    - `limiter`: Applies rate limiting rules.
    - `express.json()`: Parses `application/json` request bodies into `req.body`.
    - `express.urlencoded()`: Parses `application/x-www-form-urlencoded` bodies into `req.body`.
    - `express.static`: If the request path matches a file in the static directory, serves the file and ends the request.
    - `cookieParser`: Parses `Cookie` headers into `req.cookies`.
    - `morganMiddleware`: Logs details about the incoming request using Morgan (e.g., `POST /api/v1/bus-owner/login ...`).
3.  **Routing:** Express matches the request path (`/api/v1/bus-owner/login`) to the registered router (`busOwnerRouter`).
4.  **Router Execution (`busOwner.routes.ts`):**
    - The router matches the specific sub-path (`/login`) and HTTP method (`POST`).
    - Any middleware specific to this route (e.g., authentication checks, validation middleware like `busOwnerLoginValidator()`, `validate`) is
      executed in order.
5.  **Controller Logic (`loginBusOwner` in `busOwner.controller.ts`):** If all preceding middleware passes control (by calling `next()`), the final
    controller function runs. This contains the core business logic:
    - Input validation (can also be done in middleware).
    - Database interactions (e.g., querying user via Prisma).
    - Password comparison (`bcrypt`), etc.

#### ✅ Scenario A: Successful Request (e.g., Login Success)

1.  **Controller Sends Response:** The controller function successfully completes its logic and calls
    `res.status(200).json(new ApiResponse(200, data, "Login successful"))`.
2.  **Response Sent:** Express sends the formatted JSON response back to the client.
3.  **Logging:** The `morganMiddleware` logs the successful response details (e.g., `... 200 55ms`).

#### ❌ Scenario B: Request Error (e.g., Invalid Credentials)

1.  **Error Occurs:** An error is thrown within the controller (e.g., `throw new ApiError(401, "Invalid credentials.")`) or passed via `next(error)`
    from middleware (e.g., validation failure).
2.  **Error Propagation:** The `asyncHandler` utility (or manual `try...catch` with `next(error)`) catches the error and passes it to Express's error
    handling mechanism.
3.  **Skipping Middleware:** Express skips any remaining regular route handlers and middleware.
4.  **Error Handler Found:** Express finds the registered global error handling middleware (`errorHandler` because it has 4 arguments:
    `err, req, res, next`).
5.  **Error Handler Execution (`error.middleware.ts`):**
    - The `errorHandler` function receives the `error` object.
    - It logs the detailed error using **Winston** (e.g., `logger.error("Invalid credentials.")` which goes to console and `logs/error.log`).
    - It sends a standardized JSON error response back to the client (e.g., `res.status(401).json(...)`).

### 🧾 Logging Overview

#### 📋 Morgan: HTTP Request Logger

- **Purpose:** Automatically logs details of every incoming HTTP request and its corresponding response.
- **Example Log:** `POST /api/v1/users/login 200 55ms`
- **Configuration:** Configured in `src/logger/morgan.logger.ts` to use Winston's `http` level.
- **Registration:** Applied as global middleware in `src/app.ts` via `app.use(morganMiddleware)`.

#### 🛠 Winston: General-Purpose Logger

- **Purpose:** Used for manual logging within the application code (controllers, services, utils) to record specific events, debug information, or
  errors.
- **Usage:** Import the `logger` instance (from `src/logger/winston.logger.ts`) and call methods like `logger.info(...)`, `logger.debug(...)`,
  `logger.error(...)`.
- **Transports (Outputs):** Configured in `src/logger/winston.logger.ts` to write logs to:
  - Console (for development visibility).
  - `logs/error.log`: For errors (`logger.error`).
  - `logs/info.log`: For general information (`logger.info`).
  - `logs/http.log`: Used by Morgan via the stream configuration (`logger.http`).
- **Integration:** Winston effectively captures logs generated both manually by the application and automatically by Morgan.

#### 🧼 Log Rotation

- **Purpose:** Prevents log files from growing indefinitely and consuming excessive disk space.
- **Mechanism:** Typically handled by Winston transports. The example uses `winston-daily-rotate-file` (check `winston.logger.ts`) or Winston's
  built-in `maxsize` and `maxFiles` options on file transports.
  - `maxsize`: Maximum size of a single log file before rotation (e.g., 10MB).
  - `maxFiles`: Maximum number of rotated log files to keep (e.g., keep the last 3).

### 💡 Logging Summary

| Tool    | Role                       | Where Used                   | Output Example/Level |
| :------ | :------------------------- | :--------------------------- | :------------------- |
| Morgan  | HTTP Request/Response Logs | Global Middleware (`app.ts`) | `logger.http`        |
| Winston | Manual App Logs & Errors   | App Logic & `errorHandler`   | `logger.info/error`  |
| Express | Routing & Middleware       | `app.ts`, `*.routes.ts`      | N/A                  |

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Language:** TypeScript
- **Database ORM:** Prisma (Manages database interactions)
- **Database:** (You'll need to specify this based on your `prisma/schema.prisma` or `.env` file - e.g., PostgreSQL, MySQL)
- **API Documentation:** Swagger UI (`swagger-jsdoc`, `swagger-ui-express`)
- **Validation:** `express-validator`
- **Logging:** Winston (Detailed logs), Morgan (HTTP request logs)
- **Development Tools:** Nx Workspace, ESLint, Prettier, Husky

## Project Structure Guide

```
.
├── prisma/             # Database schema definition
├── src/
│   ├── app.ts          # Core Express setup, global middleware
│   ├── main.ts         # Starts the HTTP server
│   ├── configs/        # Specific configurations (like rate limits)
│   ├── constants.ts    # Reusable constant values
│   ├── controllers/    # Handles incoming requests, contains business logic
│   ├── logger/         # Logging setup (Winston, Morgan)
│   ├── middleware/     # Reusable request handlers (auth, error handling)
│   ├── routes/         # Defines API endpoints and links them to controllers
│   ├── utils/          # Helper classes/functions (ApiError, ApiResponse)
│   ├── validators/     # Input validation rules
│   └── assets/         # Static files (if any)
├── logs/               # Where log files are stored
├── generated/          # Auto-generated Prisma client code (don't edit)
├── .env.sample         # Example environment variables file
├── package.json        # Lists project dependencies and scripts
├── tsconfig.json       # TypeScript compiler options
└── README.md           # You are here!
```

## Getting Started: Setup

1.  **Get the code:**

    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```

2.  **Install necessary tools:**

    ```bash
    npm install
    ```

3.  **Configure your environment:**

    - Make a copy of the example environment file:
      ```bash
      cp .env.sample .env
      ```
    - Open the `.env` file in a text editor.
    - **Crucially, set the `DATABASE_URL`**. This tells Prisma how to connect to your database (e.g.,
      `postgresql://user:password@host:port/database`).
    - Set the `PORT` (e.g., `8080`).
    - Fill in any other required values (like `JWT_SECRET` if you're using authentication).

4.  **Prepare the database:**
    - Make sure your database server (like PostgreSQL) is running.
    - Apply the database schema defined in `prisma/schema.prisma`:
      ```bash
      npx prisma migrate dev --name init
      ```
      _(This creates the tables in your database)_
    - Generate the Prisma client code (needed to interact with the DB from TypeScript):
      ```bash
      npx prisma generate
      ```

## Running the App

- **For development (auto-restarts on changes):**

  ```bash
  npm start
  ```

  The server will usually be accessible at `http://localhost:PORT` (replace `PORT` with the value in your `.env`).

- **To build for production:**
  ```bash
  npm run build
  ```
  _(This creates optimized JavaScript files, usually in a `dist/` folder)_
  ```bash
  node dist/src/main.js # Or the correct path to the built main file
  ```

## API Documentation (Swagger)

While the server is running, you can usually view interactive API documentation in your browser. Look in `src/app.ts` for a line like
`app.use('/api-docs', ...)` to find the correct path (e.g., `http://localhost:PORT/api-docs`).

## Code Quality Tools

- **Linting (Check code style):** `npm run lint`
- **Formatting (Auto-fix style):** `npm run format` _(These often run automatically before you commit code, thanks to Husky and lint-staged)_

# Step 1: Real-Time Twilio Media Streams Integration

## Required Environment Variables

```
# Twilio
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token

# Deepgram (for real-time STT)
DEEPGRAM_API_KEY=your_deepgram_api_key

# Gemini (Google Generative AI)
GEMINI_API_KEY=your_gemini_api_key

# Google TTS (recommended for Malayalam)
TTS_PROVIDER=google  # Set to 'google' to use Google Cloud Text-to-Speech
GOOGLE_APPLICATION_CREDENTIALS=path/to/your/google-credentials.json  # Service account key for Google TTS

# ElevenLabs (optional, if you want to use ElevenLabs TTS)
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_VOICE_ID=your_elevenlabs_voice_id
ELEVENLABS_MODEL_ID=eleven_multilingual_v2

# Media Streams WebSocket URL (for Twilio <Connect><Stream>)
MEDIA_STREAM_WSS_URL=wss://your-backend-domain/ws/twilio-audio
```

- All Gemini/AI agent logic is now in `src/services/ai-agent.service.ts`. Do not use `gemini.service.ts` (deprecated).
- Set `TTS_PROVIDER=google` for best Malayalam TTS support.
- Make sure your Google service account has the Cloud Text-to-Speech API enabled.

## 🎵 Audio Processing & Twilio Media Streams

### Perfect Audio Pipeline

The system now includes a comprehensive audio processing pipeline that converts Gemini's 16kHz audio to Twilio's required 8kHz format with multiple
strategies:

#### Audio Processing Strategies

1. **Simple Downsampling** (`simple`)

   - Takes every 2nd sample from 16kHz to 8kHz
   - Fastest but may introduce aliasing
   - Use: `AUDIO_PROCESSING_STRATEGY=simple`

2. **Interpolated Downsampling** (`interpolated`) - **Default**

   - Averages adjacent samples for smoother conversion
   - Better quality than simple downsampling
   - Use: `AUDIO_PROCESSING_STRATEGY=interpolated`

3. **Filtered Downsampling** (`filtered`)
   - Applies low-pass filter before downsampling
   - Highest quality but more CPU intensive
   - Use: `AUDIO_PROCESSING_STRATEGY=filtered`

#### Audio Processing Options

```bash
# Audio processing strategy (simple, interpolated, filtered)
AUDIO_PROCESSING_STRATEGY=interpolated

# Audio amplification factor (1.0 = no change, 2.0 = double volume)
AUDIO_AMPLIFICATION=1.0

# Test mode: send Gemini audio directly without downsampling
TEST_DIRECT_AUDIO=false
```

### Debugging Audio Issues

#### 1. Test Audio Pipeline

Visit these endpoints to test different audio configurations:

```bash
# Test with interpolated strategy and 2x amplification
curl "http://localhost:8080/test-audio-pipeline?strategy=interpolated&amplification=2.0"

# Test sending Gemini audio directly (16kHz)
curl "http://localhost:8080/test-audio-pipeline?direct=true"

# Test different strategies
curl "http://localhost:8080/test-audio-strategies"
```

#### 2. Audio Analysis

The system automatically analyzes audio quality:

```javascript
// Example audio analysis output
{
  "samples": 800,
  "duration": 0.1,
  "maxAmplitude": 16384,
  "minAmplitude": -16384,
  "averageAmplitude": 11585,
  "zeroCrossings": 44,
  "zeroCrossingRate": 440,
  "isSilence": false
}
```

#### 3. Common Audio Issues & Solutions

| Issue            | Symptoms                | Solution                                     |
| ---------------- | ----------------------- | -------------------------------------------- |
| **Silence**      | No audio heard on phone | Check `AUDIO_AMPLIFICATION` (try 2.0-4.0)    |
| **Distortion**   | Audio sounds garbled    | Reduce `AUDIO_AMPLIFICATION` (try 0.5-1.0)   |
| **Low Volume**   | Audio too quiet         | Increase `AUDIO_AMPLIFICATION` (try 2.0-4.0) |
| **High Latency** | Delayed responses       | Use `AUDIO_PROCESSING_STRATEGY=simple`       |
| **Poor Quality** | Audio sounds robotic    | Use `AUDIO_PROCESSING_STRATEGY=filtered`     |

#### 4. Audio Format Requirements

**Twilio Media Streams expects:**

- Sample Rate: 8kHz
- Bit Depth: 16-bit
- Channels: Mono
- Format: Linear PCM (little-endian)
- Encoding: Raw (not WAV, MP3, etc.)

**Gemini Live provides:**

- Sample Rate: 16kHz
- Bit Depth: 16-bit
- Channels: Mono
- Format: Linear PCM

#### 5. Testing Audio Quality

```bash
# 1. Test basic audio (should hear beep)
curl "http://localhost:8080/test-audio-pipeline"

# 2. Test with high amplification
curl "http://localhost:8080/test-audio-pipeline?amplification=4.0"

# 3. Test direct mode (16kHz)
curl "http://localhost:8080/test-audio-pipeline?direct=true"

# 4. Compare strategies
curl "http://localhost:8080/test-audio-strategies"
```

#### 6. Environment Variables for Audio

Add these to your `.env` file:

```bash
# Audio Processing
AUDIO_PROCESSING_STRATEGY=interpolated
AUDIO_AMPLIFICATION=2.0
TEST_DIRECT_AUDIO=false

# Twilio Media Streams
MEDIA_STREAM_WSS_URL=wss://your-domain/ws/twilio-audio
```

#### 7. Monitoring Audio Quality

Check logs for audio analysis:

```bash
# Look for these log messages:
[AudioProcessor] Quality check - Max amplitude: 16384, RMS: 11585
[AudioProcessor] Audio levels look good
[GeminiLiveBridge] Audio analysis: { maxAmplitude: 16384, ... }
```

#### 8. Troubleshooting Steps

1. **Verify Test Tone Works**

   ```bash
   curl "http://localhost:8080/test-audio"
   # Should hear: "Testing audio playback. You should hear this message clearly."
   ```

2. **Test WebSocket Audio**

   ```bash
   curl "http://localhost:8080/test-audio-pipeline"
   # Should hear beep tone after initial message
   ```

3. **Check Audio Levels**

   ```bash
   curl "http://localhost:8080/test-audio-strategies"
   # Compare maxAmplitude values (should be > 1000)
   ```

4. **Test Different Strategies**

   ```bash
   # Try each strategy
   curl "http://localhost:8080/test-audio-pipeline?strategy=simple"
   curl "http://localhost:8080/test-audio-pipeline?strategy=interpolated"
   curl "http://localhost:8080/test-audio-pipeline?strategy=filtered"
   ```

5. **Adjust Amplification**

   ```bash
   # If audio is too quiet
   curl "http://localhost:8080/test-audio-pipeline?amplification=4.0"

   # If audio is distorted
   curl "http://localhost:8080/test-audio-pipeline?amplification=0.5"
   ```

### Audio Processing Architecture

```
Gemini Live (16kHz) → AudioProcessor → Twilio (8kHz)
     ↓                      ↓              ↓
  16-bit PCM         Multiple Strategies  8-bit PCM
   Mono              Normalization        Little-endian
   Linear PCM        Amplification        Base64 encoded
```

The `AudioProcessor` class provides:

- Multiple downsampling strategies
- Automatic normalization
- Configurable amplification
- Quality analysis and validation
- Test tone generation
- Comprehensive logging

---
