FROM node:18-alpine

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

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

# Generate Prisma Client
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma

# Build API
RUN npm run build --workspace=apps/api

# Expose port
EXPOSE 3001

# Start command
CMD ["sh", "-c", "npx prisma db push --schema=apps/api/prisma/schema.prisma && npm run start:prod --workspace=apps/api"]
