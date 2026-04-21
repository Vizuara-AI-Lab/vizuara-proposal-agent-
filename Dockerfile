# Vizuara Proposal Agent — production container.
# Deployable to Fly.io, Railway, Render, DigitalOcean App Platform,
# Google Cloud Run, or any Docker host. Bundles pdflatex so the
# compile step works without an external service.

# ---- Deps layer ----
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ---- Build layer ----
FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- Runtime layer ----
# Debian slim + TeX Live (just enough packages to compile the Vizuara style)
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3210
ENV PDFLATEX_BIN=pdflatex

# Install pdflatex + required LaTeX packages used by the bundled templates.
# texlive-latex-recommended and texlive-latex-extra pull in:
#   booktabs, colortbl, xcolor, graphicx, hyperref, fancyhdr, titlesec,
#   tcolorbox, longtable, enumitem, geometry.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      texlive-latex-base \
      texlive-latex-recommended \
      texlive-latex-extra \
      texlive-fonts-recommended \
      lmodern \
      ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Copy built app
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/style.md ./style.md

EXPOSE 3210
CMD ["npx", "next", "start", "-p", "3210"]
