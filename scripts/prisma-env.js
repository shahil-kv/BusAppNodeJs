const { execSync } = require("child_process");
const path = require("path");
const dotenv = require("dotenv");

// Load the appropriate .env file based on NODE_ENV
const envFile =
  process.env.NODE_ENV === "production" ? ".env.cloud" : ".env.dev";
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

// Get the command from the arguments
const command = process.argv.slice(2).join(" ");

// Execute the command with the loaded environment variables
execSync(command, { stdio: "inherit" });
