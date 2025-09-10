ARG PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# ------------------------------
# Base
# ------------------------------
FROM node:22-bookworm-slim AS base

ARG PLAYWRIGHT_BROWSERS_PATH
ENV PLAYWRIGHT_BROWSERS_PATH=${PLAYWRIGHT_BROWSERS_PATH}

# Set the working directory
WORKDIR /app

# ⚡ Install essential system dependencies including Xvfb
RUN apt-get update && apt-get install -y \
    # Essential for Playwright
    curl \
    wget \
    # ⚡ CRITICAL: Xvfb and display dependencies
    xvfb \
    x11-utils \
    xauth \
    # Cleanup
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

RUN --mount=type=cache,target=/root/.npm,sharing=locked,id=npm-cache \
    --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
  npm ci --omit=dev && \
  # Install system dependencies for playwright
  npx -y playwright-core install-deps chromium

# ------------------------------
# Builder
# ------------------------------
FROM base AS builder

RUN --mount=type=cache,target=/root/.npm,sharing=locked,id=npm-cache \
    --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
  npm ci

# Copy the rest of the app
COPY *.json *.js *.ts .
COPY src src/

# Build the app
RUN npm run build

# ------------------------------
# Browser
# ------------------------------
FROM base AS browser

RUN npx -y playwright-core install --no-shell chromium

# ------------------------------
# Runtime
# ------------------------------
FROM base

ARG PLAYWRIGHT_BROWSERS_PATH
ARG USERNAME=node
ENV NODE_ENV=production

# Set the correct ownership for the runtime user on production `node_modules`
RUN chown -R ${USERNAME}:${USERNAME} node_modules

# ⚡ IMPORTANT: Keep as node user but ensure script permissions
USER ${USERNAME}

COPY --from=browser --chown=${USERNAME}:${USERNAME} ${PLAYWRIGHT_BROWSERS_PATH} ${PLAYWRIGHT_BROWSERS_PATH}
COPY --chown=${USERNAME}:${USERNAME} cli.js package.json ./
COPY --from=builder --chown=${USERNAME}:${USERNAME} /app/lib /app/lib

# ⚡ Copy startup scripts with execute permissions
COPY --chown=${USERNAME}:${USERNAME} --chmod=755 start-integrated-mcp.sh ./start-integrated-mcp.sh
COPY --chown=${USERNAME}:${USERNAME} --chmod=755 cleanup-browser-conflicts.sh ./cleanup-browser-conflicts.sh

# 🔧 Default entrypoint (can be overridden by docker-compose)
ENTRYPOINT ["./start-integrated-mcp.sh"]