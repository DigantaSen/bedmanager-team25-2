# Bed Manager — Team 25

> Real-time hospital bed management with predictive analytics and role-based dashboards.

![admin-dashboard](./demo/demo-1.png)
![ward-dashboard](./demo/demo-2.png)

---

## Youtube Demo

[![Bed Manager Demo](./demo/yt.png)](https://www.youtube.com/watch?v=mjSeZ1kM7pI)

[Full Video](https://www.youtube.com/watch?v=mjSeZ1kM7pI)

## Overview

**Bed Manager** is a full-stack hospital bed management platform built to streamline bed allocation across multiple wards. It provides **real-time occupancy tracking**, **predictive ML analytics**, and **tailored dashboards** for every role: from front-line ward staff to hospital administrators.

The system manages **multiple beds** across customizable wards:

example:

| Ward      | Beds | Profile                                     |
| --------- | ---- | ------------------------------------------- |
| ICU       | 24   | Critical care, highest turnover sensitivity |
| General   | 84   | Standard inpatient care                     |
| Emergency | 84   | High-throughput admissions and transfers    |

---

## Features

- **Real-Time Bed Tracking**: Live occupancy status via Socket.IO; instant updates across all connected clients.
- **Predictive Analytics**: ML-powered forecasts for discharge timing, cleaning duration, and bed availability to reduce idle time.
- **Multi-Role Dashboards**: Custom views for:
  - **Admin**: System-wide oversight, user management, reporting.
  - **Manager**: Ward-level KPIs, capacity planning, audit logs.
  - **Ward Staff**: Bed assignment, patient check-in/out, cleaning status.
  - **ER Staff**: Fast admission triage, emergency bed search.
- **Smart Allocation**: Suggests optimal beds based on patient priority, ward capacity, and predicted availability.
- **Responsive UI**: Modern React 19 interface built with Vite for fast development and production builds.

---

## Tech Stack

| Layer           | Technology                   | Purpose                                          |
| --------------- | ---------------------------- | ------------------------------------------------ |
| **Frontend**    | React 19 + Vite              | Interactive SPA, fast HMR, optimized builds      |
| **Backend API** | Node.js + Express            | REST API, business logic, authentication         |
| **ML Service**  | Python + FastAPI             | Model inference endpoints, analytics API         |
| **Database**    | MongoDB                      | Document store for beds, patients, users, logs   |
| **Real-Time**   | Socket.IO                    | Bidirectional event streaming for live updates   |
| **ML Models**   | Scikit-learn (Random Forest) | Discharge, cleaning, and availability prediction |

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite)](https://vitejs.dev)
[![Node.js](https://img.shields.io/badge/Node.js-20.19+-339933?logo=node.js)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express)](https://expressjs.com)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?logo=mongodb)](https://www.mongodb.com)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-real--time-010101?logo=socket.io)](https://socket.io)

---

## Project Structure

```
bedmanager-team25-2/
├── backend/          # Node.js/Express API (port 5001)
│   ├── server.js     # Application entry point
│   ├── routes/       # API route definitions
│   ├── models/       # Mongoose schemas
│   └── controllers/  # Request handlers
├── demo/             # Assets for docs
├── docs/             # Project documentation (incl. HOW_TO_RUN.md)
├── frontend/         # React 19 + Vite SPA (port 5173)
│   ├── src/
│   ├── index.html
│   └── vite.config.js
├── ml-service/       # Python/FastAPI ML microservice (port 8000)
│   ├── main.py       # Service entry point
│   └── models/       # Trained Random Forest models
└── README.md         # This file
```

---

## Prerequisites

- **Node.js** >= 20.19 (required by Vite 7)
- **npm** >= 10.x
- **Python** >= 3.11 (required by the pinned NumPy/SciPy versions)
- **MongoDB** >= 6.0 (local or Atlas)
- _(Optional)_ **pip** / **venv** for Python environment management

---

## Setup & Installation

For **step-by-step installation**, environment setup, and troubleshooting, see [`docs/HOW_TO_RUN.md`](./docs/HOW_TO_RUN.md).

### Quick Start

1. **Clone the repository**

   ```bash
   git clone https://github.com/DigantaSen/bedmanager-team25-2
   cd bedmanager-team25-2
   ```

2. **Backend**

   ```bash
   cd backend
   cp .env.example .env   # then set MONGO_URI and JWT_SECRET
   npm install
   npm start        # runs on http://localhost:5001
   ```

3. **Frontend**

   ```bash
   cd frontend
   npm install
   npm run dev      # runs on http://localhost:5173
   ```

4. **ML Service**
   ```bash
   cd ml-service
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   uvicorn main:app --reload --port 8000
   ```

> Ensure MongoDB is running and environment variables are configured before starting services.

---

## Usage & Entry Points

| Service     | Entry Point                | Port   | Command                                                        |
| ----------- | -------------------------- | ------ | -------------------------------------------------------------- |
| Backend API | `backend/server.js`        | `5001` | `npm start` (within `backend/`)                                |
| Frontend    | `frontend/vite dev server` | `5173` | `npm run dev` (within `frontend/`)                             |
| ML Service  | `ml-service/main.py`       | `8000` | `uvicorn main:app --reload --port 8000` (within `ml-service/`) |

1. Start **MongoDB**.
2. Start **Backend** (`backend/server.js`).
3. Start **ML Service** (`ml-service/main.py`).
4. Start **Frontend** (`frontend/vite dev server`).
5. Open `http://localhost:5173` and log in. New sign-ups must be approved by a hospital admin first (see `docs/HOW_TO_RUN.md`).

---

## Environment Variables

Each service has its own `.env.example`. Copy it to `.env` in `backend/`, `frontend/` and `ml-service/`.

| Variable                                                        | Service    | Required          | Description                                             |
| --------------------------------------------------------------- | ---------- | ----------------- | ------------------------------------------------------- |
| `MONGO_URI`                                                     | Backend    | Yes               | MongoDB connection string, e.g. `.../bedmanager`        |
| `JWT_SECRET`                                                    | Backend    | Yes               | Token signing secret (at least 32 characters)           |
| `PORT`                                                          | Backend    | No                | API server port (default: `5001`)                       |
| `NODE_ENV`                                                      | Backend    | No                | `development` includes error details in responses       |
| `JWT_EXPIRES_IN`                                                | Backend    | No                | Login token lifetime (default: `7d`)                    |
| `ML_SERVICE_URL`                                                | Backend    | No                | ML service URL (default: `http://localhost:8000`)       |
| `FRONTEND_URL`                                                  | Backend    | No                | Extra allowed CORS origin                               |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Backend    | For email reports | Mail server settings                                    |
| `VITE_API_BASE_URL`                                             | Frontend   | No                | Backend API URL (default: `http://localhost:5001/api`)  |
| `VITE_SOCKET_URL`                                               | Frontend   | No                | Socket.IO server URL (default: `http://localhost:5001`) |
| `ML_SERVICE_HOST`, `ML_SERVICE_PORT`                            | ML Service | No                | Bind address and port (default: `127.0.0.1:8000`)         |
| `MONGO_URI`                                                     | ML Service | Recommended       | Same database as the backend; used for training and for prediction history (defaults are used if unreachable) |
| `MONGO_TIMEOUT_MS`, `HISTORY_CACHE_TTL_SECONDS`, `HISTORY_RETRY_SECONDS` | ML Service | No       | MongoDB timeout and history cache timings (defaults: `20000` ms, `600` s, `60` s) |
| `LOG_LEVEL`                                                     | ML Service | No                | Logging level (default: `INFO`)                         |

> See `docs/HOW_TO_RUN.md` for a complete `.env` template.

---

## ML Models Summary

The ML microservice exposes three **Random Forest** regression / classification models:

| Model                           | Output                                                 | Business Impact                    |
| ------------------------------- | ------------------------------------------------------ | ---------------------------------- |
| **Discharge Time Predictor**    | Estimated time until a patient is discharged           | Improves bed turnover forecasting  |
| **Cleaning Duration Predictor** | Predicted minutes to clean and sanitize a bed          | Schedules housekeeping efficiently |
| **Bed Availability Predictor**  | Likelihood a specific bed will free up within a window | Enables proactive allocation       |

Models are trained on historical ward data and served via FastAPI endpoints for low-latency inference.

---

## Team

**Team 25** — Hospital Bed Manager

Developed as a collaborative full-stack engineering project featuring:

- Real-time systems design
- Machine learning operations (MLOps) integration
- Role-based access control (RBAC)
- Responsive, accessibility-aware frontend engineering

---
