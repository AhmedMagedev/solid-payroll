# Start with the official Node.js image
FROM node:18-slim AS builder

# Install OpenSSL and other essentials
RUN apt-get update -y && apt-get install -y openssl curl && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy Prisma schema
COPY prisma ./prisma

# Copy .env file for build
COPY .env ./

# Generate Prisma client
RUN npx prisma generate

# Copy the rest of the application code
COPY . .

# Set environment variables for build
# Use DOCKER_DATABASE_URL if available, otherwise fall back to DATABASE_URL
ENV DATABASE_URL=${DOCKER_DATABASE_URL:-${DATABASE_URL}}
ENV NODE_ENV="production"
ENV NEXT_TELEMETRY_DISABLED=1

# Build application
RUN npm run build

# Production stage
FROM node:18-slim

# Install OpenSSL
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built application from builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/app/generated ./app/generated
COPY --from=builder /app/.env ./.env

# Set environment variables for runtime
ENV NODE_ENV="production"
ENV NEXT_TELEMETRY_DISABLED=1

# Expose port
EXPOSE 3000

# Apply database migrations, run seed script, and start the application
CMD /bin/bash -c "export DATABASE_URL=\${DOCKER_DATABASE_URL:-\${DATABASE_URL}} && npx prisma db push && npx prisma db seed && npm run start"