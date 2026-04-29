# Anonymous Chat API

Real-time group chat service built with NestJS · PostgreSQL · Drizzle ORM · Redis · Socket.io · TypeScript.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 18 |
| PostgreSQL | ≥ 14 |
| Redis | ≥ 6 |

---

## Quick Start (Local)

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd anon-chat
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your Postgres and Redis credentials
```

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/anon_chat
REDIS_URL=redis://localhost:6379
SESSION_TTL_SECONDS=86400
```

### 3. Create the database

```bash
# Using psql
createdb anon_chat

# Or with Docker
docker run -d \
  --name postgres \
  -e POSTGRES_USER=user \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=anon_chat \
  -p 5432:5432 \
  postgres:16-alpine
```

### 4. Run Redis

```bash
# With Docker
docker run -d --name redis -p 6379:6379 redis:7-alpine
```

### 5. Run migrations

```bash
npm run db:generate   # Generate SQL from schema
npm run db:migrate    # Apply migrations to the database
```

> **Alternative:** `npm run db:push` pushes the schema directly without migration files (good for dev).

### 6. Start the server

```bash
# Development (ts-node, hot-ish reload)
npm run start:dev

# Production
npm run build
npm run start
```

The server starts on `http://localhost:3000`.

---

## Docker Compose (All-in-one)

```yaml
# docker-compose.yml
version: '3.9'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: anon_chat
    ports: ["5432:5432"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  app:
    build: .
    ports: ["3000:3000"]
    environment:
      DATABASE_URL: postgresql://user:password@postgres:5432/anon_chat
      REDIS_URL: redis://redis:6379
    depends_on: [postgres, redis]
```

```bash
docker-compose up --build
```

---

## API Overview

**Base path:** `/api/v1`  
**Auth:** `Authorization: Bearer <sessionToken>` on all routes except `/login`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/login` | Get or create user + session token |
| GET | `/api/v1/rooms` | List all rooms |
| POST | `/api/v1/rooms` | Create a room |
| GET | `/api/v1/rooms/:id` | Get room details |
| DELETE | `/api/v1/rooms/:id` | Delete room (creator only) |
| GET | `/api/v1/rooms/:id/messages` | Paginated message history |
| POST | `/api/v1/rooms/:id/messages` | Send a message |

**WebSocket:** `ws://host/chat?token=<sessionToken>&roomId=<roomId>`

---

## Running Multiple Instances

All state is externalised to Redis and PostgreSQL. Start as many instances as needed behind a load balancer:

```bash
PORT=3001 npm run start &
PORT=3002 npm run start &
# nginx / any L7 LB in front, sticky sessions optional
```

Redis pub/sub + the `@socket.io/redis-adapter` ensure messages reach clients regardless of which instance they're connected to.
