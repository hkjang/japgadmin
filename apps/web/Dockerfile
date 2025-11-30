FROM node:18-alpine

WORKDIR /app

# Copy root package files
COPY package.json .

# Copy workspace package files
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/agent/package.json apps/agent/
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build Web
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build --workspace=apps/web

# Expose port
EXPOSE 3000

# Start command
CMD ["npm", "run", "start", "--workspace=apps/web"]
