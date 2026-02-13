# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Build-time environment variables
ARG VITE_IMAGE_SERVICE_URL=http://localhost:8001
ARG VITE_VTON_SERVICE_URL=http://localhost:8002

ENV VITE_IMAGE_SERVICE_URL=$VITE_IMAGE_SERVICE_URL
ENV VITE_VTON_SERVICE_URL=$VITE_VTON_SERVICE_URL

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install a simple HTTP server to serve the built files
RUN npm install -g serve

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 5173

# Serve the app
CMD ["serve", "-s", "dist", "-l", "5173"]
