# 🥗 NutriAgent Bob — AI-Powered Nutrition Assistant

> Built with **IBM Watsonx.ai (Granite models)** · **Python Flask** · **Bootstrap 5**

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-3.x-000000?logo=flask)](https://flask.palletsprojects.com)
[![IBM Watsonx](https://img.shields.io/badge/IBM-Watsonx.ai-0043CE?logo=ibm)](https://www.ibm.com/watsonx)
[![Bootstrap](https://img.shields.io/badge/Bootstrap-5.3-7952B3?logo=bootstrap&logoColor=white)](https://getbootstrap.com)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🤖 **AI Chat** | Conversational nutrition assistant powered by IBM Granite models |
| 🍽️ **Meal Planner** | Personalised 7-day Indian & global meal plans |
| 📊 **BMI / BMR** | BMI, Basal Metabolic Rate & TDEE calculator |
| 👨‍👩‍👧 **Family Plans** | Multi-member family nutrition planning |
| 🔍 **Meal Analyzer** | Instant calorie & macro breakdown for any food list |
| 🌙 **Dark Mode** | Full light/dark theme with system preference detection |
| 📱 **Responsive** | Mobile-first design with Bootstrap 5 |
| ⚙️ **Agent Config** | Fully customisable `AGENT_INSTRUCTIONS` block in `app.py` |

---

## 🚀 Quick Start

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd NutritionalAgentBob
```

### 2. Create a virtual environment

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure environment variables

```bash
# Copy the template
cp .env.example .env
```

Open `.env` and fill in your credentials:

```env
IBM_API_KEY=your_ibm_cloud_api_key_here
WATSONX_PROJECT_ID=your_watsonx_project_id_here
WATSONX_URL=https://us-south.ml.cloud.ibm.com
WATSONX_MODEL_ID=ibm/granite-3-3-8b-instruct
FLASK_SECRET_KEY=change_this_to_something_random
```

### 5. Run the application

```bash
python app.py
```

Open your browser at **http://localhost:5000** 🎉

---

## 🔑 Getting IBM Watsonx.ai Credentials

### IBM Cloud API Key
1. Log in to [IBM Cloud Console](https://cloud.ibm.com)
2. Go to **Manage → Access (IAM) → API Keys**
3. Click **Create an IBM Cloud API key**
4. Copy the key into `.env` → `IBM_API_KEY`

### Watsonx.ai Project ID
1. Open [IBM Watsonx.ai](https://dataplatform.cloud.ibm.com/wx)
2. Create or open a **Project**
3. Go to **Project → Manage → General**
4. Copy the **Project ID** into `.env` → `WATSONX_PROJECT_ID`

> **Demo Mode**: If no credentials are provided, the app runs in demo mode with pre-built responses.

---

## ⚙️ Customising AGENT_INSTRUCTIONS

All agent behaviour is controlled by the `AGENT_INSTRUCTIONS` block at the top of `app.py`.
No other file needs to change.

```python
# ── Change the agent name & tagline
AGENT_NAME    = "Bob"
AGENT_TAGLINE = "Your AI-Powered Nutrition & Wellness Coach"

# ── Switch Granite model
MODEL_ID = "ibm/granite-13b-instruct-v2"

# ── Adjust tone
TONE = "formal, clinical, precise"

# ── Prefer non-vegetarian meals
VEGETARIAN_FIRST = False

# ── Add/remove safety rules
SAFETY_RULES.append("Never recommend alcohol-based remedies.")

# ── Change Indian food defaults
INDIAN_FOOD_PREFS["breakfast"].append("Besan Chilla")

# ── Adjust macro targets
MACRO_TARGETS = {"protein_pct": 35, "carb_pct": 40, "fat_pct": 25}
```

---

## 🏗️ Project Structure

```
NutritionalAgentBob/
├── app.py                  # Flask backend + AGENT_INSTRUCTIONS
├── requirements.txt        # Python dependencies
├── .env.example            # Environment variable template
├── .env                    # Your secrets (NOT committed)
├── .gitignore
├── README.md
├── templates/
│   └── index.html          # Jinja2 template — full single-page app
└── static/
    ├── css/
    │   └── style.css       # Custom CSS with dark mode
    └── js/
        └── app.js          # Frontend JavaScript
```

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/` | Serve the web application |
| `POST` | `/api/chat` | Send a chat message, get AI response |
| `POST` | `/api/bmi` | Calculate BMI, BMR & TDEE |
| `POST` | `/api/meal-plan` | Generate a 7-day personalised meal plan |
| `POST` | `/api/family-plan` | Generate a family meal plan |
| `POST` | `/api/analyze` | Analyse nutritional content of foods |
| `POST` | `/api/clear-chat` | Clear session chat history |
| `GET`  | `/api/health` | Health check & status |

### Example: Chat API

```bash
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Create a 1800 calorie Indian vegetarian meal plan"}'
```

### Example: BMI API

```bash
curl -X POST http://localhost:5000/api/bmi \
  -H "Content-Type: application/json" \
  -d '{"weight": 70, "height": 170, "age": 28, "gender": "male"}'
```

---

## 🐳 Docker Deployment

### Build and run

```bash
docker build -t nutriagent-bob .
docker run -p 5000:5000 --env-file .env nutriagent-bob
```

### Dockerfile (create if needed)

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "app:app"]
```

---

## ☁️ Cloud Deployment

### IBM Code Engine

```bash
ibmcloud ce app create \
  --name nutriagent-bob \
  --image <your-registry>/nutriagent-bob:latest \
  --env-from-secret nutriagent-secrets \
  --port 5000
```

### Heroku

```bash
heroku create nutriagent-bob
heroku config:set IBM_API_KEY=... WATSONX_PROJECT_ID=... WATSONX_URL=...
git push heroku main
```

### Railway / Render

1. Connect your GitHub repository.
2. Set environment variables in the dashboard.
3. Deploy — the `gunicorn` command starts automatically.

### Production with Gunicorn

```bash
gunicorn --bind 0.0.0.0:5000 --workers 4 --timeout 120 app:app
```

---

## 🔒 Security Notes

- Never commit `.env` to version control (it's in `.gitignore`).
- Rotate `FLASK_SECRET_KEY` in production.
- Use HTTPS in production (reverse proxy via Nginx/Caddy).
- IBM API keys can be scoped to specific services in IAM.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'Add my feature'`
4. Push: `git push origin feature/my-feature`
5. Open a Pull Request

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">
  <strong>Made with ❤️ using IBM Watsonx.ai &amp; Granite Models</strong><br/>
  <em>NutriAgent Bob — Eat Smart. Live Well. 🥗</em>
</div>
