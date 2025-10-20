# Backend - Task 1 (Node.js + Express)

## Overview

This folder contains the backend for Task 1: a minimal Node.js + Express server with a health endpoint and a safe, optional DB helper (no MongoDB required for Task 1).

## Quickstart

1. Copy `.env.example` to `.env` and (optionally) set values. Example:

```bash
cp .env.example .env
# then edit .env if you need to change defaults
```

2. Install dependencies:

```bash
npm install
```

3. Run in development (nodemon):

```bash
npm run dev
```

4. Run in production mode:

```bash
npm start
```

5. Verify the health endpoint (example):

```bash
curl http://localhost:5000/api/health
```

You should receive a JSON response like:

```json
{
  "status": "ok",
  "environment": "development",
  "time": "2025-10-20T...Z"
}
```

## What is included

- `server.js` — application entry, loads dotenv, wires routes and starts server
- `config/db.js` — helper to optionally connect to MongoDB. If `MONGO_URI` is empty the helper resolves immediately (useful for Task 1)
- `routes/health.js` + `controllers/healthController.js` — GET `/api/health` endpoint
- `.env.example` — example environment variables
- `.gitignore` — ignores `node_modules/` and `.env`

## Task 2: MongoDB Integration ✅

**Completed:**
- ✅ Installed `mongoose` (v8.19.1)
- ✅ Updated `/config/db.js` with detailed connection logging
- ✅ Added connection success/failure logs
- ✅ Added graceful shutdown handling
- ✅ Updated `.env.example` with MongoDB URI examples

**MongoDB Connection Logs:**
- 🔄 Connection attempt
- ✅ Success with database name, host, and port
- ❌ Failure with detailed error messages and troubleshooting tips
- ⚠️ Disconnection warnings
- 🛑 Graceful shutdown on app termination

**Setup MongoDB:**

1. **Local MongoDB:**
   ```bash
   # Make sure MongoDB is running
   mongod --dbpath=/path/to/data/db
   ```

2. **Update .env:**
   ```bash
   # For local MongoDB:
   MONGO_URI=mongodb://localhost:27017/bedmanager
   
   # For MongoDB Atlas:
   MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/bedmanager
   ```

3. **Run server:**
   ```bash
   npm run dev
   ```

4. **Verify connection:**
   Check terminal for MongoDB connection logs with ✅ status.

## Git / Collaboration

Before pushing to the shared repository, make sure your local `.env` is not committed (it's in `.gitignore`). Commit the code and push your branch to the remote so teammates can pull and continue.

Example git commands (replace `<remote-url>` / branch as needed):

```bash
git add .
git commit -m "feat(backend): Task 1 - express server, health route, dotenv"
git push origin main
```

If you'd like, we can add a short automated test for the health endpoint in Task 1 to make integration smoother.
