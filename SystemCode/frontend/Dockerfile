# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Build-time environment variables
ARG VITE_IMAGE_SERVICE_URL=http://localhost:8001
ARG VITE_VTON_SERVICE_URL=http://localhost:8002
ARG VITE_RECOMMENDER_SERVICE_URL=http://localhost:8003
ARG VITE_AGENT_SERVICE_URL=http://localhost:8004

ENV VITE_IMAGE_SERVICE_URL=$VITE_IMAGE_SERVICE_URL
ENV VITE_VTON_SERVICE_URL=$VITE_VTON_SERVICE_URL
ENV VITE_RECOMMENDER_SERVICE_URL=$VITE_RECOMMENDER_SERVICE_URL
ENV VITE_AGENT_SERVICE_URL=$VITE_AGENT_SERVICE_URL

# Install pnpm (colleague uses pnpm, not npm)
RUN npm install -g pnpm

# Copy only package.json first (layer caching)
COPY package.json ./

# Install — no package-lock.json needed
RUN pnpm install

# Copy source code
COPY . .

# Build
RUN pnpm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/dist ./dist
EXPOSE 5173
CMD ["serve", "-s", "dist", "-l", "5173"]
