FROM mcr.microsoft.com/playwright:v1.45.0-jammy

# Upgrade Node.js to 20.19.0 to be compatible with mongodb@7.1.0
RUN npm install -g n && n 20.19.0 && hash -r

# Set working directory
WORKDIR /app

# Enable corepack so we can use modern yarn if needed
RUN corepack enable

# Copy dependency files
COPY package.json yarn.lock* package-lock.json* ./

# Install all dependencies (development and production)
# We need dev dependencies to build Next.js and to have TypeScript, concurrently, tsx available
RUN if [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci; \
    else npm install; \
    fi

# Install Playwright browsers (Chromium)
RUN npx playwright install chromium

# Copy the rest of the application
COPY . .

# Build the Next.js application
RUN npm run build

# Set Node environment to production
ENV NODE_ENV=production
ENV PORT=3000

# Expose the port Next.js will run on
EXPOSE 3000

# Run both Next.js and the worker using the concurrently script
CMD ["npm", "run", "start:all"]
