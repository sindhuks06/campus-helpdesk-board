# Campus Help Desk Board

Campus Help Desk Board is a small full-stack campus support board for posting and viewing student help requests. Students can submit a name and question, while the board displays the ten newest requests, their creation times, the current board view count, and whether the request list came from Redis or PostgreSQL.

## Features

- Submit student help requests with client- and server-side validation.
- Require non-empty student names and messages.
- Limit student names to 50 characters and messages to 200 characters.
- Store requests permanently in PostgreSQL.
- Display the latest 10 requests in newest-first order.
- Cache request lists in Redis for 60 seconds.
- Invalidate the request-list cache after a successful post.
- Increment board views with Redis `INCR`.
- Show loading, success, error, and empty states.
- Responsive interface built with regular CSS and CSS Modules.

## Technology Stack

- **Next.js** with the App Router and Route Handlers
- **JavaScript** (no TypeScript)
- **React**
- **Node.js**
- **PostgreSQL** with the `pg` package
- **Redis** with the `redis` package
- **CSS Modules** for component styling

## Architecture and Data Flow

The browser communicates with Next.js Route Handlers:

1. The browser loads the board and requests `/api/requests` and `/api/views`.
2. `GET /api/requests` checks Redis key `help:latest`.
3. If cached data exists, it is returned with `source: "Redis"`.
4. On a cache miss, the route queries PostgreSQL for the latest ten rows, stores the result in Redis for 60 seconds, and returns `source: "PostgreSQL"`.
5. PostgreSQL remains the permanent source of truth; Redis is only used for caching and the view counter.
6. When a request is posted, PostgreSQL is updated first. The `help:latest` Redis key is then deleted so the next read gets fresh data.
7. `GET /api/views` increments the Redis key `help` and returns the new count.

Redis read, write, and invalidation failures are logged and do not prevent request reads from falling back to PostgreSQL. If Redis is unavailable for views, the views endpoint returns `success: false` with a `null` count.

## Project Structure

```text
helpdesk-app-pes1ug24am433/
├── app/
│   ├── api/
│   │   ├── requests/
│   │   │   └── route.js
│   │   └── views/
│   │       └── route.js
│   ├── globals.css
│   ├── layout.js
│   ├── page.js
│   └── page.module.css
├── lib/
│   ├── db.js
│   └── redis.js
├── .env.local
├── package.json
└── package-lock.json
```

## PostgreSQL Setup

Create a PostgreSQL database named `campus_helpdesk`, then create the table used by the request API:

```sql
CREATE DATABASE campus_helpdesk;
```

Connect to that database and run:

```sql
CREATE TABLE IF NOT EXISTS help_requests (
  id SERIAL PRIMARY KEY,
  student_name VARCHAR(50) NOT NULL,
  message VARCHAR(200) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

The application uses parameterized SQL for inserts and selects:

- `student_name` stores the student's name.
- `message` stores the help request.
- `created_at` records when the request was created.
- `id` uniquely identifies each request.

## Redis Setup with Docker

Install and start Docker Desktop, then run:

```bash
docker run --name campus-helpdesk-redis -p 6379:6379 -d redis:latest
```

Verify that the container is running:

```bash
docker ps
```

If the container already exists, start it with:

```bash
docker start campus-helpdesk-redis
```

## Environment Variables

Create `.env.local` in the project root. Use your own local PostgreSQL password; do not commit this file.

```env
DATABASE_URL=postgresql://postgres:YOUR_ENCODED_PASSWORD@localhost:5432/campus_helpdesk
REDIS_URL=redis://localhost:6379
```

`YOUR_ENCODED_PASSWORD` is a placeholder. Replace it locally with the URL-encoded password for your PostgreSQL user.

## Installation and Execution

From the project directory:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in a browser.

To create and run a production build:

```bash
npm run build
npm start
```

On Windows PowerShell systems where `npm.ps1` is blocked by execution policy, use:

```powershell
npm.cmd install
npm.cmd run dev
```

## API Documentation

### `POST /api/requests`

Creates a help request in PostgreSQL.

Request body:

```json
{
  "student_name": "Asha Kumar",
  "message": "Where can I find the lost-and-found office?"
}
```

Successful response:

```json
{
  "success": true,
  "id": 1
}
```

Validation errors return HTTP `400`:

```json
{
  "success": false,
  "error": "student_name and message are required"
}
```

The route trims both fields, rejects blank values, enforces the 50/200 character limits, uses a parameterized `INSERT`, and invalidates `help:latest` after insertion.

### `GET /api/requests`

Returns the latest ten requests:

```json
{
  "source": "Redis",
  "requests": [
    {
      "id": 1,
      "student_name": "Asha Kumar",
      "message": "Where can I find the lost-and-found office?",
      "created_at": "2026-01-01T10:00:00.000Z"
    }
  ]
}
```

The `source` value is either `Redis` for a cache hit or `PostgreSQL` for a cache miss. PostgreSQL failures return HTTP `500`.

### `GET /api/views`

Increments and returns the Redis view counter:

```json
{
  "success": true,
  "views": 12
}
```

The counter uses Redis key `help` and the `INCR` command. If Redis is unavailable, the route returns a successful HTTP response with:

```json
{
  "success": false,
  "views": null,
  "error": "Board views are temporarily unavailable"
}
```

## Redis Caching Details

- **Request cache key:** `help:latest`
- **View counter key:** `help`
- **TTL:** 60 seconds for `help:latest`
- **Cache miss:** Query PostgreSQL, return `source: "PostgreSQL"`, and cache the ten results.
- **Cache hit:** Return the cached JSON with `source: "Redis"`.
- **Invalidation:** A successful `POST /api/requests` deletes `help:latest`.
- **View counting:** `GET /api/views` increments `help` atomically with Redis `INCR`.

## Testing and Verification

Run the configured static checks:

```bash
npm run lint
npm run build
```

With PostgreSQL, Redis, and the development server running, test the APIs with `curl`:

```bash
curl http://localhost:3000/api/requests
curl http://localhost:3000/api/views
```

Create a request:

```bash
curl -X POST http://localhost:3000/api/requests \
  -H "Content-Type: application/json" \
  -d "{\"student_name\":\"Asha Kumar\",\"message\":\"Where is the help desk?\"}"
```

For a complete manual check:

1. Load `/api/requests` once and confirm `source` is `PostgreSQL` on a cold cache.
2. Load it again within 60 seconds and confirm `source` is `Redis`.
3. Check the TTL with Redis:

   ```bash
   redis-cli TTL help:latest
   ```

4. Post a new request and confirm the next request read returns `source: "PostgreSQL"` after cache invalidation.
5. Call `/api/views` repeatedly and confirm the returned count increases.
6. Test blank fields, a name longer than 50 characters, and a message longer than 200 characters; each should return HTTP `400`.
7. Query PostgreSQL directly to confirm requests remain persisted in `help_requests`.
