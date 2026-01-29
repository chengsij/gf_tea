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
# ENV VITE_API_URL=http://localhost:3001/api
ENV VITE_API_URL=https://gftea-production.up.railway.app/api
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

# Install 'serve' globally to serve the frontend
RUN npm install -g serve

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
# The source path is now explicit based on the build structure
COPY --from=backend-builder /app/tea-app/server/dist/tea-app/server ./server
COPY --from=backend-builder /app/tea-app/server/dist/tea-app/shared ./shared

# Copy frontend build artifacts
COPY --from=frontend-builder /app/frontend/dist ./frontend-dist

# Create startup script to run both services
RUN echo '#!/bin/sh' > /start.sh && \
    echo '# Start backend in background' >> /start.sh && \
    echo 'node server/index.js &' >> /start.sh && \
    echo '# Start frontend in foreground' >> /start.sh && \
    echo 'serve -s frontend-dist -l 5173' >> /start.sh && \
    chmod +x /start.sh

# Expose ports
EXPOSE 3001
EXPOSE 5173

# Start the services
CMD ["/start.sh"]