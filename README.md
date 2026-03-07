# CryptoSentinel — Blockchain Fraud Detection

Graph-based money laundering and fraud detection platform built with **Next.js**, **Fastify**, **Neo4j**, and **Cytoscape.js**.

## Project Structure

```
crypto-sentinel/
├── backend/          # Fastify API server (port 4000)
│   ├── neo4j/        # Neo4j driver & schema
│   ├── ingestion/    # CSV/JSON parsers
│   ├── services/     # Detection, ingestion, graph transforms
│   ├── routes/       # REST endpoints
│   └── server.js     # Entry point
├── frontend/         # Next.js app (port 3000)
│   ├── app/          # App Router pages & components
│   ├── lib/          # API client
│   └── public/       # Static assets & sample data
└── README.md
```

## Prerequisites

- **Node.js** 18+
- **Neo4j Desktop** running on `bolt://localhost:7687`

## Getting Started

### 1. Backend

```bash
cd backend
cp .env.example .env   # then edit with your Neo4j credentials
npm install
npm run dev            # starts on http://localhost:4000
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev            # starts on http://localhost:3000
```

### 3. Load Sample Data

Navigate to **http://localhost:3000/upload** and upload `frontend/public/sample-data.csv`.

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `NEO4J_URI` | `bolt://localhost:7687` | Neo4j connection URI |
| `NEO4J_USER` | `neo4j` | Neo4j username |
| `NEO4J_PASSWORD` | — | Neo4j password |
| `PORT` | `4000` | Server port |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed CORS origin |

### Frontend (`frontend/.env.local`)

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | Backend API URL |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/stats` | Dashboard statistics |
| `POST` | `/upload-transactions` | Upload CSV/JSON transaction data |
| `GET` | `/graph` | Fetch graph data for visualization |
| `GET` | `/wallet/:address` | Wallet details with risk score |
| `GET` | `/transactions/path` | Shortest path between two wallets |
| `GET` | `/suspicious` | Detect suspicious patterns |
