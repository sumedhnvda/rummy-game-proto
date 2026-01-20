# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build/Run
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV PORT 3000

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Ensure we have access to ts-node in production or just run it via npx/script
# We need to make sure 'ts-node' and 'typescript' are available if we run raw ts file.
# They are in devDependencies usually.
# A better approach for prod is to compile.
# Let's compile server.ts to dist/server.js

RUN npm run build-server || npx tsc server.ts --outDir dist --esModuleInterop

USER nextjs

EXPOSE 3000

# Check if dist/server.js exists, else fallback or just assume compilation
CMD ["node", "dist/server.js"]
