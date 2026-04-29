# Anonymous Chat API

Real-time group chat service built with NestJS · PostgreSQL (Supabase) · Drizzle ORM · Redis (Upstash) · Socket.io · TypeScript.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | NestJS + TypeScript |
| Database | PostgreSQL via **Supabase** (cloud) |
| ORM | Drizzle ORM |
| Cache / Realtime state | Redis via **Upstash** (cloud) |
| WebSocket | Socket.io with Redis pub/sub adapter |

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 18 |
| npm | ≥ 9 |

> No local PostgreSQL or Redis installation needed — both are hosted on Supabase and Upstash.

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
```

Open `.env` and fill in your credentials:

```env
PORT=5000
NODE_ENV=development

# Supabase — Settings → Database → Connection string → Session pooler
DATABASE_URL=postgresql://postgres.YOUR_PROJECT_REF:YOUR_PASSWORD@aws-0-YOUR_REGION.pooler.supabase.com:5432/postgres

# Upstash — Database page → Connect → TCP
REDIS_URL=rediss://default:YOUR_UPSTASH_PASSWORD@YOUR_HOST.upstash.io:6379

SESSION_TTL_SECONDS=86400
```

### 3. Getting your Supabase connection string

1. Go to [supabase.com](https://supabase.com) → your project
2. Click **Settings** → **Database**
3. Scroll to **"Connection string"**
4. Select the **"Session pooler"** tab
5. Copy the URI — it looks like:
   ```
   postgresql://postgres.xxxxxxxxxxxx:YOUR-PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
   ```

> ⚠️ Use the **Transaction pooler** URL, not the Direct connection URL.
> The Direct connection URL (`db.xxxx.supabase.co`) may not be reachable from all networks.

### 4. Getting your Upstash Redis URL

1. Go to [upstash.com](https://upstash.com) → your database
2. Click **Connect** → **TCP** section
3. Copy the Redis URL — it looks like:
   ```
   rediss://default:YOUR_PASSWORD@xxxx.upstash.io:6379
   ```

> ⚠️ The URL starts with `rediss://` (double `s`) — this means TLS is enabled, which is required by Upstash. The app handles this automatically.

### 5. Run the database migration

```bash
npm run db:migrate
```

You should see:
```
Running migrations...
Migrations completed.
```

This creates the `users`, `rooms`, and `messages` tables in your Supabase database.

### 6. Start the server

```bash
npm run start:dev
```

You should see:
```
[ChatGateway] WebSocket Gateway initialized
[Redis] Connected
[Redis] Connected
[ChatGateway] Subscribed to Redis channel: chat:events
[App] Listening on http://0.0.0.0:5000
```

---

## Production Build

```bash
npm run build
npm run start
```

---

## Docker (Cloud DBs — No local Postgres/Redis needed)

Since Supabase and Upstash are cloud services, the Docker setup only runs the app container.

Make sure your `.env` file is filled in, then:

```bash
docker-compose up --build
```

The app will be available at `http://localhost:5000`.

To stop:
```bash
docker-compose down
```

> Docker Compose reads credentials from your `.env` file automatically — no credentials are hardcoded in `docker-compose.yml`.

---

## API Overview

**Base path:** `/api/v1`
**Auth:** `Authorization: Bearer <sessionToken>` on all routes except `/login`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/login` | ❌ | Get or create user + session token |
| GET | `/api/v1/rooms` | ✅ | List all rooms with active user counts |
| POST | `/api/v1/rooms` | ✅ | Create a room |
| GET | `/api/v1/rooms/:id` | ✅ | Get room details |
| DELETE | `/api/v1/rooms/:id` | ✅ | Delete room (creator only) |
| GET | `/api/v1/rooms/:id/messages` | ✅ | Paginated message history |
| POST | `/api/v1/rooms/:id/messages` | ✅ | Send a message |

**WebSocket:** `ws://localhost:5000/chat?token=<sessionToken>&roomId=<roomId>`

---

## Quick API Test

### Login
```bash
curl -X POST http://localhost:5000/api/v1/login \
  -H "Content-Type: application/json" \
  -d '{"username": "ali_123"}'
```

### Create a room
```bash
curl -X POST http://localhost:5000/api/v1/rooms \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -d '{"name": "general"}'
```

### Send a message
```bash
curl -X POST http://localhost:5000/api/v1/rooms/YOUR_ROOM_ID/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -d '{"content": "hello everyone"}'
```

### Get message history
```bash
curl http://localhost:5000/api/v1/rooms/YOUR_ROOM_ID/messages \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

---

## WebSocket Events

### Connection
```
ws://localhost:3000/chat?token=<sessionToken>&roomId=<roomId>
```

### Server → Client

| Event | Sent to | Payload |
|-------|---------|---------|
| `room:joined` | Connecting client only | `{ activeUsers: ["ali_123", "sara_x"] }` |
| `room:user_joined` | All other clients | `{ username, activeUsers }` |
| `message:new` | All clients in room | `{ id, username, content, createdAt }` |
| `room:user_left` | All clients in room | `{ username, activeUsers }` |
| `room:deleted` | All clients in room | `{ roomId }` |

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `room:leave` | none | Graceful disconnect |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No (default: 3000) | HTTP port |
| `NODE_ENV` | No | `development` or `production` |
| `DATABASE_URL` | ✅ | Supabase PostgreSQL connection string |
| `REDIS_URL` | ✅ | Upstash Redis connection string (`rediss://`) |
| `SESSION_TTL_SECONDS` | No (default: 86400) | Session expiry in seconds (24h) |

---

## Project Structure

```
src/
├── main.ts                          # Bootstrap
├── app.module.ts                    # Root module
├── common/
│   ├── decorators/                  # @CurrentUser()
│   ├── filters/                     # Global error envelope filter
│   ├── guards/                      # Bearer token auth guard
│   ├── interceptors/                # Global success envelope interceptor
│   └── utils/                       # ID generation (usr_ / room_ / msg_)
└── modules/
    ├── database/                    # Drizzle ORM schema + migrations
    ├── redis/                       # ioredis clients + RedisService
    ├── auth/                        # Login, user upsert, session tokens
    ├── rooms/                       # Room CRUD
    ├── messages/                    # Message history + send
    └── chat/                        # Socket.io gateway + Redis pub/sub
```

## Author
**Md. Salauddin** — Full-stack engineer (backend-focused).