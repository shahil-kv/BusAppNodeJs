# Use a Debian-based Node.js image
FROM node:18

# Set working directory
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy Prisma and scripts
COPY prisma ./prisma
COPY scripts ./scripts

# Generate Prisma Client using your custom script
RUN npm run prisma:generate

# Copy the rest of the application code
COPY . .

# Build the application
RUN npm run build:prod

# Expose the port
EXPOSE 3000

# Start the application
CMD ["node", "dist/Node_NX/main.js"]