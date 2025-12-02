# How to Run Bed Manager - Team 25

This guide provides step-by-step instructions to run the complete Bed Manager application stack locally.

## 📋 Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Detailed Setup](#detailed-setup)
  - [1. Backend Setup](#1-backend-setup)
  - [2. Frontend Setup](#2-frontend-setup)
  - [3. ML Service Setup](#3-ml-service-setup)
- [Environment Variables](#environment-variables)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)
- [Additional Scripts](#additional-scripts)

---

## 📌 Overview

The Bed Manager application consists of three main components:

1. **Backend** (Node.js/Express) - REST API + WebSocket server
2. **Frontend** (React/Vite) - User interface
3. **ML Service** (FastAPI/Python) - Machine learning predictions

---

## ✅ Prerequisites

Before running the application, ensure you have:

- **Node.js** (v14+ recommended, check `.nvmrc` in backend/)
- **Python** (v3.8+)
- **MongoDB** (local or Atlas cloud instance)
- **npm** or **yarn**
- **Git**

---

## 🚀 Quick Start

Open **three separate terminals** and run the following commands:

### Terminal 1: Backend
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

### Terminal 2: Frontend
```bash
cd frontend
npm install
npm run dev
```

### Terminal 3: ML Service
```bash
cd ml-service
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

**Access the application:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:5001/api/health
- ML Service: http://localhost:8000/health

---

## 📖 Detailed Setup

### 1. Backend Setup

**Location:** `backend/`

**Purpose:** Provides REST API endpoints, WebSocket real-time communication, and integrates with MongoDB and ML service.

#### Step-by-Step:

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Create environment file:**
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env` file** (required variables):
   ```bash
   PORT=5001
   MONGO_URI=mongodb://localhost:27017/bedmanager
   NODE_ENV=development
   ML_SERVICE_URL=http://localhost:8000
   FRONTEND_URL=http://localhost:5173
   ```

4. **Install dependencies:**
   ```bash
   npm install
   ```

5. **Start the server:**
   
   **Development mode** (with auto-restart):
   ```bash
   npm run dev
   ```
   
   **Production mode:**
   ```bash
   npm start
   ```

6. **Verify backend is running:**
   ```bash
   curl http://localhost:5001/api/health
   ```
   
   Expected response:
   ```json
   {
     "status": "ok",
     "environment": "development",
     "time": "2025-12-02T..."
   }
   ```

#### MongoDB Connection:

**Option A: Local MongoDB**
```bash
# Ensure MongoDB is running
mongod --dbpath=/path/to/data/db

# Update .env
MONGO_URI=mongodb://localhost:27017/bedmanager
```

**Option B: MongoDB Atlas (Cloud)**
```bash
# Update .env with your Atlas connection string
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/bedmanager
```

---

### 2. Frontend Setup

**Location:** `frontend/`

**Purpose:** React-based user interface built with Vite, connects to backend API and WebSocket server.

#### Step-by-Step:

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```
   
   Vite will start the dev server (usually on http://localhost:5173)

4. **Build for production:**
   ```bash
   npm run build
   ```

5. **Preview production build:**
   ```bash
   npm run preview
   ```

6. **Access the application:**
   
   Open your browser to the URL shown in the terminal (typically http://localhost:5173)

#### Frontend Environment Variables:

Check `frontend/.env` or `frontend/.env.example` for any required configuration. The frontend typically needs to know the backend API URL.

---

### 3. ML Service Setup

**Location:** `ml-service/`

**Purpose:** FastAPI-based microservice providing machine learning predictions for discharge times, bed availability, and cleaning duration.

#### Step-by-Step:

1. **Navigate to ml-service directory:**
   ```bash
   cd ml-service
   ```

2. **Create virtual environment:**
   ```bash
   python -m venv venv
   ```

3. **Activate virtual environment:**
   
   **Linux/Mac:**
   ```bash
   source venv/bin/activate
   ```
   
   **Windows:**
   ```bash
   venv\Scripts\activate
   ```

4. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

5. **Configure environment (optional):**
   ```bash
   cp .env.example .env
   # Edit .env if needed
   ```

6. **Train models (first time only):**
   ```bash
   # Train discharge prediction model
   python train/train_discharge.py

   # Train bed availability model
   python train/train_bed_availability.py

   # Train cleaning duration model
   python train/train_cleaning_duration.py
   ```

7. **Start the ML service:**
   
   **Development mode:**
   ```bash
   python main.py
   ```
   
   **Production mode (recommended):**
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```
   
   **With auto-reload (development):**
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

8. **Verify ML service is running:**
   ```bash
   curl http://localhost:8000/health
   ```
   
   Or visit the interactive API docs at:
   - Swagger UI: http://localhost:8000/docs
   - ReDoc: http://localhost:8000/redoc

---

## 🔧 Environment Variables

### Backend (`.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 5001 | Backend server port |
| `MONGO_URI` | mongodb://localhost:27017/bedmanager | MongoDB connection string |
| `NODE_ENV` | development | Environment (development/production) |
| `ML_SERVICE_URL` | http://localhost:8000 | ML service endpoint |
| `FRONTEND_URL` | http://localhost:5173 | Frontend URL (for CORS) |

### Frontend (`.env`)

Check `frontend/.env.example` for required variables. Typically includes:
- Backend API base URL
- Socket.IO connection URL

### ML Service (`.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `ML_SERVICE_PORT` | 8000 | ML service port |
| `MONGO_URI` | (same as backend) | MongoDB URI for training |
| Model paths and configuration settings |

---

## ✅ Verification

After starting all three services, verify they're working:

### 1. Backend Health Check
```bash
curl http://localhost:5001/api/health
```

### 2. Frontend
Open browser: http://localhost:5173

### 3. ML Service Health Check
```bash
curl http://localhost:8000/health
curl http://localhost:8000/models/status
```

### 4. End-to-End Test
- Register/login through the frontend
- Check that real-time updates work (WebSocket)
- Test ML predictions (if implemented)

---

## 🔍 Troubleshooting

### Port Already in Use

**Problem:** Port 5001, 5173, or 8000 is already in use

**Solution:**
```bash
# Backend: Change PORT in .env
PORT=5002

# Frontend: Vite will auto-increment (5174, 5175, etc.)

# ML Service: Use different port
uvicorn main:app --host 0.0.0.0 --port 8001

# Find and kill process using a port (Linux/Mac)
lsof -ti:5001 | xargs kill -9
```

### MongoDB Connection Failed

**Problem:** Backend can't connect to MongoDB

**Solutions:**
1. **Check MongoDB is running:**
   ```bash
   # Linux/Mac
   sudo systemctl status mongod
   
   # Or start it
   sudo systemctl start mongod
   ```

2. **Verify connection string:**
   - For local: `mongodb://localhost:27017/bedmanager`
   - For Atlas: Get connection string from MongoDB Atlas dashboard

3. **Check MongoDB is listening:**
   ```bash
   # Should see port 27017
   netstat -an | grep 27017
   ```

### CORS Errors

**Problem:** Frontend can't access backend APIs

**Solution:**
1. Ensure `FRONTEND_URL` in backend `.env` matches your frontend URL
2. Backend `server.js` has allowedOrigins array - verify your frontend URL is included
3. Check browser console for specific CORS error messages

### ML Service Models Not Found

**Problem:** ML service can't find trained models

**Solution:**
```bash
cd ml-service
source venv/bin/activate

# Train all models
python train/train_discharge.py
python train/train_bed_availability.py
python train/train_cleaning_duration.py

# Check models exist
ls -la models/
```

### Node Version Issues

**Problem:** npm install fails or unexpected behavior

**Solution:**
```bash
# Check Node version
node --version

# If using nvm, use project's version
cd backend
nvm use
```

### Python Virtual Environment Issues

**Problem:** Can't activate virtual environment or packages not found

**Solution:**
```bash
# Recreate virtual environment
cd ml-service
rm -rf venv
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### WebSocket Connection Failed

**Problem:** Real-time updates not working

**Solution:**
1. Check backend is running and accessible
2. Verify Socket.IO configuration in backend `server.js`
3. Check browser console for WebSocket errors
4. Ensure firewall allows WebSocket connections

---

## 📝 Additional Scripts

### Backend Scripts

```bash
# Database cleanup
npm run cleanup:db

# Check logs
npm run check:logs

# Check cleaning status
npm run check:cleaning

# Fix cleaning beds
npm run fix:cleaning
```

### Data Generation

```bash
# Generate synthetic data for testing
cd backend
node generateSyntheticData.js
```

### Seeding Database

```bash
# Seed initial bed data
cd backend
node seedBeds.js
```

---

## 🐳 Docker Support (Optional)

If you prefer using Docker, you can create a `docker-compose.yml` to run all services:

```yaml
version: '3.8'
services:
  mongodb:
    image: mongo:latest
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db

  backend:
    build: ./backend
    ports:
      - "5001:5001"
    environment:
      - MONGO_URI=mongodb://mongodb:27017/bedmanager
      - ML_SERVICE_URL=http://ml-service:8000
    depends_on:
      - mongodb
      - ml-service

  ml-service:
    build: ./ml-service
    ports:
      - "8000:8000"
    environment:
      - MONGO_URI=mongodb://mongodb:27017/bedmanager

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    depends_on:
      - backend

volumes:
  mongodb_data:
```

Then run:
```bash
docker-compose up
```

---

## 📚 Additional Resources

- **Backend README:** `backend/README.md`
- **ML Service README:** `ml-service/README.md`
- **Frontend README:** `frontend/README.md`
- **API Documentation:** http://localhost:8000/docs (ML Service Swagger)
- **Redux Implementation:** `frontend/REDUX_IMPLEMENTATION.md`

---

## 🤝 Support

If you encounter issues not covered in this guide:

1. Check the individual README files in each directory
2. Review the error logs in the terminal
3. Check MongoDB logs if database-related
4. Verify all environment variables are set correctly
5. Ensure all dependencies are installed

---

**Last Updated:** December 2, 2025  
**Version:** 1.0.0
