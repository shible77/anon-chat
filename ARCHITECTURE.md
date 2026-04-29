# Architecture

## Overview

Anonymous Chat API is a horizontally-scalable real-time chat service. All persistent state lives in **PostgreSQL**; all ephemeral/real-time state lives in **Redis**. No in-process state is used for anything that must survive a process restart or be shared across instances.

```
┌─────────────────────────────────────────────────────────────┐
│                        Load Balancer                        │
└─────────────┬───────────────────────────┬───────────────────┘
              │                           │
   ┌──────────▼──────────┐   ┌───────────▼─────────┐
   │   NestJS Instance 1 │   │  NestJS Instance 2  │  ...
   │                     │   │                     │
   │  REST Controllers   │   │  REST Controllers   │
   │  WebSocket Gateway  │   │  WebSocket Gateway  │
   └──────────┬──────────┘   └───────────┬─────────┘
              │                          │
      ┌───────┴──────────────────────────┘
      │         Shared infrastructure
      ▼                        ▼
┌─────────────┐        ┌──────────────┐
│  PostgreSQL │        │    Redis     │
│             │        │              │
│  users      │        │  Sessions    │
│  rooms      │        │  Active users│
│  messages   │        │  Socket maps │
└─────────────┘        │  Pub/Sub     │
                       └──────────────┘
```

---

## Module Structure

```
src/
├── main.ts                        # Bootstrap + global middleware
├── app.module.ts                  # Root module
├── common/
│   ├── decorators/                # @CurrentUser()
│   ├── filters/                   # HttpExceptionFilter (error envelope)
│   ├── guards/                    # AuthGuard (Bearer token → Redis → DB)
│   ├── interceptors/              # ResponseInterceptor (success envelope)
│   └── utils/                     # ID generation (nanoid prefixes)
└── modules/
    ├── database/                  # Drizzle ORM + schema + migrations
    ├── redis/                     # ioredis clients + RedisService
    ├── auth/                      # Login, user upsert, session tokens
    ├── rooms/                     # CRUD for rooms
    ├── messages/                  # Paginated history, send message
    └── chat/                      # Socket.io gateway + Redis pub/sub fan-out
```

---

## Session Strategy

### Token generation
A session token is a 40-character random string produced by `nanoid` with a `sess_` prefix. It is opaque — it carries no payload.

### Storage
Tokens are stored as Redis keys:
```
session:<token>  →  <userId>   (EX 86400 seconds = 24 h)
```
On every authenticated HTTP request, `AuthGuard` calls `Redis.get(session:<token>)`, then fetches the user from PostgreSQL. The DB hit is lightweight (PK lookup) and can be further optimised with a Redis user-cache layer if needed.

### Expiry
Redis handles TTL automatically. After 24 hours the key disappears; the next request with that token returns `null` from Redis → `401 UNAUTHORIZED`.

### Multiple sessions
Each login issues a fresh token but does **not** invalidate previous ones. Multiple concurrent sessions (e.g. mobile + desktop) are supported. This is intentional to keep the login endpoint idempotent.

---

## Redis Usage

| Purpose | Key pattern | Type |
|---------|------------|------|
| Session storage | `session:<token>` | String (userId) |
| Active users per room | `room:<roomId>:users` | Set (usernames) |
| Socket → username | `socket:<socketId>:user` | String |
| Socket → roomId | `socket:<socketId>:room` | String |
| WebSocket fan-out | `chat:events` pub/sub channel | — |

### Why no in-memory maps for socket state?
If a socket map lives in process memory, instance 2 cannot look up a socket that connected to instance 1. By storing `socket:<id>:user` and `socket:<id>:room` in Redis, any instance can handle the disconnect cleanup regardless of where the connection was established.

---

## WebSocket Scaling — Redis Pub/Sub Fan-out

```
Client A (on Instance 1)                Client B (on Instance 2)
       │                                        │
       │ POST /rooms/:id/messages               │
       ▼                                        │
Instance 1                                      │
  MessagesService.sendMessage()                 │
       │                                        │
       ├─ INSERT message → PostgreSQL           │
       │                                        │
       └─ redis.publish("chat:events", {        │
              type: "message:new", ...          │
          })                                    │
              │                                 │
              ├──────── Redis Pub/Sub ──────────►│
              │                                 ▼
              │                         Instance 2
              │                           subClient.on("message")
              │                           ChatGateway.handlePubSubMessage()
              │                           server.to(roomId).emit("message:new")
              │                                 │
              │         (also on Instance 1)    ▼
              └──────────────────────────► Client B receives it
```

The REST controller **never** calls `socket.emit()` directly. It publishes to Redis; the gateway's subscriber handles delivery. This means the architecture is correct even when the HTTP request and the WebSocket connection land on different instances.

---

## Concurrent User Capacity (Single Instance)

Estimated for a mid-range cloud VM (2 vCPU, 4 GB RAM):

| Resource | Estimate | Reasoning |
|----------|----------|-----------|
| WebSocket connections | ~10,000 | Socket.io + Node.js event loop; each idle socket ~10 KB RAM |
| Concurrent message throughput | ~500 msg/s | Redis round-trip ~1 ms; DB insert ~2–5 ms; async fan-out |
| HTTP requests | ~1,000 req/s | NestJS + pg pool of 20; mostly fast PK lookups |

**Bottlenecks at single-instance scale:**
1. PostgreSQL write throughput (message inserts)
2. Redis `SMEMBERS` on rooms with thousands of active users
3. Node.js single-threaded CPU for JSON serialisation at very high concurrency

---

## Scaling to 10× Load

| Change | Impact |
|--------|--------|
| **Horizontal scaling** — run 3–5 app instances behind an L7 LB | Immediately multiplies connection and request capacity; Redis adapter already handles fan-out |
| **PostgreSQL read replica** | Offload `GET /rooms`, `GET /rooms/:id/messages` to replica |
| **Connection pooling with PgBouncer** | Reduce DB connection overhead at high instance count |
| **Redis Cluster** | Partition key space across nodes; needed when single Redis > ~50 k ops/s |
| **Message write batching** | Buffer inserts and flush every 50 ms to increase write throughput |
| **Active-user count caching** | Cache `SCARD room:<id>:users` with a short TTL (1 s) to avoid Redis fan on every `GET /rooms` |

---

## Known Limitations and Trade-offs

| Limitation | Trade-off made | Mitigation path |
|-----------|---------------|-----------------|
| No message read receipts | Kept out of scope per spec | Add a `reads` table with `(userId, messageId)` |
| Active-user count is eventually consistent on multi-instance crash | Crash leaves stale Redis set entries | Periodic TTL on set entries or a heartbeat |
| Session tokens are not rotated on use | Simpler implementation | Add sliding-window refresh for long-lived sessions |
| No rate limiting on message send | Could be abused | Add `ioredis` sliding-window rate limiter in `MessagesService` |
| Cursor pagination uses `createdAt` for comparison | Ties at the same millisecond could skip messages | Use `(createdAt, id)` composite for strict ordering — schema index already supports this |
| Single Redis instance is a SPOF | Acceptable for MVP | Redis Sentinel or Cluster for HA |
