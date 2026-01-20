# Stage 1: Install dependencies
FROM node:18-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build the app
FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Environment variables must be present at build time for Next.js to bake them in (if using public vars)
# For server-side mostly, we can pass them at runtime.
ENV NEXT_TELEMETRY_DISABLED 1

# Build Next.js (creates .next folder)
RUN npm run build

# Stage 3: Production Server
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
ENV PORT 3000

# Create a non-root user (security best practice)
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files
# We need package.json to run the custom server script
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json

# Copy node_modules (production only)
COPY --from=builder /app/node_modules ./node_modules

# Copy the build output
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# Copy the custom server source (we will run it with ts-node or build it)
# For production, it's better to compile server.ts to server.js in the build step, 
# but for simplicity in this setup, we can use ts-node or a simple tsc output.
# Let's compile server.ts in the builder stage to avoid carrying ts-node/typescript into prod runner if possible,
# but our package.json 'start' script uses ts-node. 
# To follow the user's existing flow, we will copy the source and use ts-node, 
# ensuring ts-node is in 'dependencies' not 'devDependencies'.
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/socket ./socket
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/tsconfig.json ./tsconfig.json

USER nextjs

EXPOSE 3000

# We use the existing 'start' script: "ts-node server.ts"
CMD ["npm", "start"]
