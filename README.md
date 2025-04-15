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

When a request comes into the server (e.g., someone trying to register a new bus owner), it goes through several steps. This diagram shows the typical flow:

```mermaid
graph LR
    A["Client Sends Request\n(e.g., POST /api/v1/bus-owner/register)"] --> B("Node.js HTTP Server\nListens on Port");
    B --> C{"Express App\n(app.ts)"};
    C --> D(Global Middleware Pipeline);
    D --> E{Route Matching};

    subgraph D [Global Middleware]
        direction TB
        D1(CORS Check) --> D2(Rate Limiter) --> D3("Body Parsers\nJSON/URL Encoded") --> D4(Cookie Parser) --> D5(Morgan Request Logging);
    end

    E -- "Path Matches\n/api/v1/bus-owner" --> F{"BusOwner Router\n(busOwner.routes.ts)"};
    E -- "Path Doesn't Match" --> C; # Or potentially 404 handler

    F -- "Route Matches\n/register-busowner" --> G("Route Middleware\nValidation");
    G -- Validation OK --> H("Controller Function\ne.g., BusOwnerRegistration");
    G -- "Validation Fails" --> I(Error Passed to `next()`);

    H -- Success --> J("Format Success Response\nApiResponse");
    H -- "Error Thrown" --> I;

    J --> K("Express Sends Response\ne.g., res.json()");
    K --> L["Client Receives\nSuccess Response"];
    K --> M(Morgan Logs Response);

    I --> N{"Error Handling Middleware\n(errorHandler in error.middleware.ts)"};
    N --> O(Log Error with Winston);
    O --> P("Format Error Response\nApiError");
    P --> K; # Express Sends Error Response

    style F fill:#f9f,stroke:#333,stroke-width:2px
    style H fill:#ccf,stroke:#333,stroke-width:2px
    style N fill:#fcc,stroke:#333,stroke-width:2px
```

**Explanation of the Flow:**

1.  **Request In:** A client (like a web browser or mobile app) sends a request to the server's address and port.
2.  **Server Receives:** The basic Node.js server listens for requests and passes them to the Express framework.
3.  **Global Middleware:** The request goes through a series of checks and transformations defined in `src/app.ts`:
    - **CORS:** Checks if the request is allowed from the client's origin.
    - **Rate Limiter:** Prevents too many requests from the same IP address.
    - **Body Parsers:** Reads incoming data (like JSON) and makes it available in `req.body`.
    - **Cookie Parser:** Reads cookies sent by the client.
    - **Morgan Logging:** Logs basic information about the incoming request (like `POST /api/v1/bus-owner/register`).
4.  **Routing:** Express looks at the request path (e.g., `/api/v1/bus-owner/register-busowner`) and finds the matching router (here, `busOwner.routes.ts`).
5.  **Route Middleware:** The specific route might have its own middleware, especially for **validation** (`express-validator` rules defined in `src/validators/`).
6.  **Controller:** If validation passes, the corresponding controller function (e.g., `BusOwnerRegistration` in `src/controllers/BusOwner/busOwner.controller.ts`) is executed. This is where the main logic happens (interacting with the database via Prisma, etc.).
7.  **Response:**
    - **Success:** The controller prepares a successful response (often using `ApiResponse` from `src/utils/`) and sends it back via `res.json()`. Morgan logs the successful response.
    - **Error:** If anything goes wrong (validation fails, database error, etc.), an error is generated (often using `ApiError` from `src/utils/`). This error skips the normal flow and goes directly to the **Global Error Handler** (`errorHandler` in `src/middleware/error.middleware.ts`).
8.  **Error Handling:** The `errorHandler` logs the detailed error using **Winston** (`logs/error.log`) and sends a standardized error response back to the client.

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
    - **Crucially, set the `DATABASE_URL`**. This tells Prisma how to connect to your database (e.g., `postgresql://user:password@host:port/database`).
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

While the server is running, you can usually view interactive API documentation in your browser. Look in `src/app.ts` for a line like `app.use('/api-docs', ...)` to find the correct path (e.g., `http://localhost:PORT/api-docs`).

## Code Quality Tools

- **Linting (Check code style):** `npm run lint`
- **Formatting (Auto-fix style):** `npm run format`
  _(These often run automatically before you commit code, thanks to Husky and lint-staged)_
