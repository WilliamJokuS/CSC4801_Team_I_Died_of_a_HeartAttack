FROM node:24-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend ./backend
COPY frontend ./frontend
COPY testing ./testing
COPY README.md INSTALL.md SPEC.md AGENTS.md .env.example ./
COPY Contract ./Contract
COPY .github ./.github

RUN DATABASE_URL=postgres://app:app@localhost:5432/recruiting npm --prefix backend ci \
    && DATABASE_URL=postgres://app:app@localhost:5432/recruiting npm --prefix backend run build
RUN npm --prefix frontend ci && npm --prefix frontend run build
RUN npm --prefix testing ci

COPY Dockerfile .dockerignore ./

ENV PORT=8080
EXPOSE 8080

WORKDIR /app/backend
CMD ["sh", "-ec", "if [ -z \"$JWT_SECRET\" ]; then export JWT_SECRET=\"$(openssl rand -hex 48)\"; fi; npm run migrate; exec node dist/server.js"]
