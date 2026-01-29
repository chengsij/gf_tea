# Stage 1: Build Frontend
FROM node:22-bookworm-slim AS frontend-builder
WORKDIR /app/frontend

# Copy frontend configuration files
COPY tea-app/package.json tea-app/package-lock.json ./

# Install frontend dependencies
RUN npm ci

# Copy frontend source code
COPY tea-app/ ./

# Build Frontend (Vite)
# Set API URL to relative path for same-origin requests
ENV VITE_API_URL=/api
RUN npm run build

# Stage 2: Build Backend
FROM node:22-bookworm-slim AS backend-builder
# Set WORKDIR to match the host structure relative to the project root (implied by ../..)
WORKDIR /app/tea-app/server

# Copy backend configuration files
COPY tea-app/server/package.json tea-app/server/package-lock.json ./

# Install backend dependencies
RUN npm ci

# Copy source code maintaining structure
# Copy server files to current WORKDIR (/app/tea-app/server)
COPY tea-app/server/ .
# Copy shared files to sibling directory (/app/tea-app/shared)
COPY tea-app/shared/ ../shared/

# Build Backend (TypeScript)
# tsconfig rootDir is "../../", so with WORKDIR /app/tea-app/server, root is /app
# Output will be in ./dist/tea-app/server and ./dist/tea-app/shared
RUN npm run build

# Stage 3: Production Runner
FROM node:22-bookworm-slim AS runner
LABEL maintainer="Serena"

WORKDIR /app

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV DATA_FILE_PATH=/app/data/teas.yaml
COPY tea-app/server/teas.yaml /app/data/teas.yaml

# Create data and log directories
RUN mkdir -p /app/data /app/logs

# Copy backend package files and install production dependencies
COPY tea-app/server/package.json tea-app/server/package-lock.json ./
RUN npm ci --only=production

# Copy compiled backend code
COPY --from=backend-builder /app/tea-app/server/dist/tea-app/server ./server
COPY --from=backend-builder /app/tea-app/server/dist/tea-app/shared ./shared

# Copy frontend build artifacts to 'dist' where server expects them
COPY --from=frontend-builder /app/frontend/dist ./dist

# Expose only the backend port
EXPOSE 3001

# Start the backend server (which also serves frontend)
CMD ["node", "server/index.js"]