# Divine Iris Healing — Backend

FastAPI + MongoDB backend for the Divine Iris Healing platform.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | FastAPI (Python) |
| Database | MongoDB (Motor async driver) |
| Auth | Session-based (cookies) |
| Email | SMTP / Resend |
| Payments | Stripe |

---

## Local Development Setup

### 1. Prerequisites

- Python 3.11+ recommended (3.10 minimum)
- A MongoDB connection — either:
  - **MongoDB Atlas** (recommended): [Create a free cluster](https://www.mongodb.com/atlas)
  - **Local MongoDB**: `sudo apt install mongodb` or use Docker

### 2. Create your `.env` file

Copy the template and fill in your values:

```bash
cp env.example .env
```

Open `.env` and set at minimum:

```
MONGO_URL=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/?retryWrites=true&w=majority
DB_NAME=divineIris
HOST_URL=http://localhost:8001
```

### 3. Install dependencies

```bash
pip install -r requirements-local.txt
```

> **Note:** `requirements-local.txt` adjusts a few package versions for WSL2/Ubuntu compatibility.
> Render uses `requirements-render.txt` which has the exact production versions.

### 4. Run the server

```bash
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

The API will be available at: **http://localhost:8001**

Interactive API docs (Swagger UI): **http://localhost:8001/docs**

---

## Testing the API

### Quick health check

```bash
curl http://localhost:8001/api/
```

Expected response:
```json
{"message": "Divine Iris Healing API - Welcome!"}
```

### Check all routes are loading

```bash
curl http://localhost:8001/docs
```

Open in browser — all routes should be visible in the Swagger UI.

### Test key endpoints manually

```bash
# Programs list
curl http://localhost:8001/api/programs

# Sessions list
curl http://localhost:8001/api/sessions

# Site settings
curl http://localhost:8001/api/settings

# Currency rates
curl http://localhost:8001/api/currency/rates
```

### Run the test suite (requires running server)

```bash
# Set the backend URL first
export REACT_APP_BACKEND_URL=http://localhost:8001

# Run all tests
python -m pytest tests/ -v

# Run a specific test file
python -m pytest tests/test_divine_iris_api.py -v
```

---

## Production Deployment (Render)

The `render.yaml` at the repo root configures everything automatically.

### Steps

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New → Blueprint
3. Connect your GitHub repo — Render reads `render.yaml` automatically
4. Set the two secret environment variables in the Render dashboard:
   - `MONGO_URL` → your MongoDB Atlas connection string
   - `HOST_URL` → your Render service URL (e.g. `https://divine-iris-backend.onrender.com`)
5. Click **Deploy**

### Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGO_URL` | ✅ Yes | MongoDB Atlas connection string |
| `DB_NAME` | ✅ Yes (default: `divineIris`) | MongoDB database name |
| `HOST_URL` | ✅ Yes | Public URL of this backend service |
| `STRIPE_API_KEY` | Optional | Can be set via Admin Panel instead |
| `STRIPE_WEBHOOK_SECRET` | Optional | From Stripe Dashboard > Webhooks |
| `SMTP_HOST` | Optional | Can be set via Admin Panel instead |
| `SMTP_PORT` | Optional | Default: 587 |
| `SMTP_USER` | Optional | Can be set via Admin Panel instead |
| `SMTP_PASS` | Optional | Can be set via Admin Panel instead |
| `RESEND_API_KEY` | Optional | Backup email service |

> **Note:** Stripe keys, SMTP credentials, and email sender addresses can all be
> configured through the **Admin Panel** inside the app after first deploy.
> You only need `MONGO_URL`, `DB_NAME`, and `HOST_URL` to get started.

---

## Project Structure

```
backend/
├── server.py                  # App entry point, middleware, route registration
├── key_manager.py             # API key management (reads MongoDB first, .env fallback)
├── models.py                  # Pydantic data models
├── routes/
│   ├── auth.py                # Session-based authentication
│   ├── payments.py            # Stripe checkout
│   ├── enrollment.py          # Program/session enrollment flow
│   ├── india_payments.py      # Manual UPI/bank transfer payments
│   ├── programs.py            # Programs CRUD
│   ├── sessions.py            # Sessions CRUD
│   ├── site_settings.py       # Admin site configuration
│   ├── emails.py              # Email sending (SMTP + Resend)
│   └── ...                    # Other route modules
├── emergentintegrations/      # Local Stripe wrapper (replaces Emergent package)
├── requirements-render.txt    # Production dependencies (use this for Render)
├── requirements.txt           # Full dependency list (includes dev tools)
└── env.example                # Environment variable template
```
