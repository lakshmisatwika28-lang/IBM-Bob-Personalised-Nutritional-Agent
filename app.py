"""
╔══════════════════════════════════════════════════════════════════════════════╗
║            NutriAgent Bob — IBM Watsonx.ai Nutrition Assistant              ║
║                        Flask Backend  •  app.py                             ║
╚══════════════════════════════════════════════════════════════════════════════╝

AGENT_INSTRUCTIONS
==================
Customize every aspect of Bob's behaviour here — no other file needs to change.

PERSONA
-------
AGENT_NAME        = "Bob"
AGENT_TAGLINE     = "Your AI-Powered Nutrition & Wellness Coach"
AGENT_LANGUAGE    = "English"          # primary response language

TONE & STYLE
------------
TONE              = "friendly, warm, encouraging, professional"
RESPONSE_STYLE    = "concise yet thorough; use bullet points and tables where helpful"
USE_EMOJI         = True               # sprinkle tasteful emojis in responses
MAX_RESPONSE_LEN  = 900               # approximate word limit per response

DIET SPECIALIZATION
-------------------
PRIMARY_DIET_FOCUS  = ["balanced", "weight-loss", "muscle-gain",
                        "diabetic-friendly", "heart-healthy"]
REGIONAL_CUISINE    = "Indian"         # default cuisine preference for meal plans
INDIAN_FOOD_PREFS   = {
    "breakfast": ["Poha", "Upma", "Idli-Sambar", "Paratha", "Oats Chilla"],
    "lunch":     ["Dal-Chawal", "Sabzi-Roti", "Rajma", "Chole", "Khichdi"],
    "dinner":    ["Moong Dal", "Palak Paneer", "Vegetable Curry", "Dosa"],
    "snacks":    ["Sprouts", "Roasted Chana", "Fruit Chaat", "Makhana"],
}
VEGETARIAN_FIRST    = True             # prefer veg options; include non-veg on request

SAFETY RULES
------------
SAFETY_RULES = [
    "Never diagnose medical conditions — always recommend consulting a doctor.",
    "Flag any calorie target below 1200 kcal/day as potentially unsafe.",
    "Do not recommend supplements without professional guidance.",
    "For users under 18 or over 65 always add a note to consult a paediatrician/geriatrician.",
    "Avoid recommending extreme fasting protocols (< 16 h fasting only with caveats).",
]

NUTRITIONAL DEFAULTS
--------------------
DEFAULT_CALORIE_SPLIT = {"breakfast": 0.25, "lunch": 0.35,
                          "dinner": 0.30, "snacks": 0.10}
MACRO_TARGETS         = {"protein_pct": 30, "carb_pct": 45, "fat_pct": 25}

FAMILY PROFILE RULES
--------------------
FAMILY_RULES = [
    "Generate age-appropriate portions for children (< 12 y) and seniors (> 60 y).",
    "Highlight common allergens in every family meal plan.",
    "Prefer one-pot meals that satisfy multiple dietary needs simultaneously.",
]

MODEL SETTINGS (IBM Watsonx.ai)
--------------------------------
MODEL_ID              = "meta-llama/llama-3-3-70b-instruct"   # change to any supported model
DECODING_METHOD       = "greedy"
MAX_NEW_TOKENS        = 1024
MIN_NEW_TOKENS        = 50
TEMPERATURE           = 0.7
TOP_P                 = 0.9
TOP_K                 = 50
REPETITION_PENALTY    = 1.1
"""

# ─── Standard library ──────────────────────────────────────────────────────────
import os
import json
import re
import logging
from datetime import datetime

# ─── Third-party ───────────────────────────────────────────────────────────────
from flask import Flask, render_template, request, jsonify, session
from flask_cors import CORS
from dotenv import load_dotenv
from ibm_watsonx_ai import APIClient, Credentials
from ibm_watsonx_ai.foundation_models import ModelInference
from ibm_watsonx_ai.metanames import GenTextParamsMetaNames as GenParams

# ─── Load environment variables ────────────────────────────────────────────────
load_dotenv()

# ─── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
)
logger = logging.getLogger(__name__)

# ══════════════════════════════════════════════════════════════════════════════
#  AGENT CONFIGURATION  (mirrors the docstring AGENT_INSTRUCTIONS above)
# ══════════════════════════════════════════════════════════════════════════════

AGENT_NAME       = "Bob"
AGENT_TAGLINE    = "Your AI-Powered Nutrition & Wellness Coach"
TONE             = "friendly, warm, encouraging, professional"
USE_EMOJI        = True
MAX_RESPONSE_LEN = 900
REGIONAL_CUISINE = "Indian"
VEGETARIAN_FIRST = True

INDIAN_FOOD_PREFS = {
    "breakfast": ["Poha", "Upma", "Idli-Sambar", "Paratha", "Oats Chilla"],
    "lunch":     ["Dal-Chawal", "Sabzi-Roti", "Rajma", "Chole", "Khichdi"],
    "dinner":    ["Moong Dal", "Palak Paneer", "Vegetable Curry", "Dosa"],
    "snacks":    ["Sprouts", "Roasted Chana", "Fruit Chaat", "Makhana"],
}

SAFETY_RULES = [
    "Never diagnose medical conditions — always recommend consulting a doctor.",
    "Flag any calorie target below 1200 kcal/day as potentially unsafe.",
    "Do not recommend supplements without professional guidance.",
    "For users under 18 or over 65 always add a note to consult a specialist.",
    "Avoid recommending extreme fasting protocols.",
]

DEFAULT_CALORIE_SPLIT = {
    "breakfast": 0.25, "lunch": 0.35, "dinner": 0.30, "snacks": 0.10,
}
MACRO_TARGETS = {"protein_pct": 30, "carb_pct": 45, "fat_pct": 25}

FAMILY_RULES = [
    "Generate age-appropriate portions for children (< 12 y) and seniors (> 60 y).",
    "Highlight common allergens in every family meal plan.",
    "Prefer one-pot meals that satisfy multiple dietary needs simultaneously.",
]

# Model settings
MODEL_ID           = os.getenv("WATSONX_MODEL_ID", "meta-llama/llama-3-3-70b-instruct")
DECODING_METHOD    = "greedy"
MAX_NEW_TOKENS     = 1024
MIN_NEW_TOKENS     = 50
TEMPERATURE        = 0.7
TOP_P              = 0.9
TOP_K              = 50
REPETITION_PENALTY = 1.1

# ──────────────────────────────────────────────────────────────────────────────
#  SYSTEM PROMPT  (assembled from AGENT_INSTRUCTIONS)
# ──────────────────────────────────────────────────────────────────────────────

def build_system_prompt() -> str:
    emoji_note = "Use tasteful emojis to make responses engaging." if USE_EMOJI else ""
    veg_note   = "Prefer vegetarian options; include non-veg only when explicitly requested." \
                 if VEGETARIAN_FIRST else ""
    safety_block = "\n".join(f"  • {r}" for r in SAFETY_RULES)
    family_block = "\n".join(f"  • {r}" for r in FAMILY_RULES)
    indian_meals = json.dumps(INDIAN_FOOD_PREFS, indent=4)

    return f"""You are {AGENT_NAME}, {AGENT_TAGLINE}.

TONE & STYLE
============
- Tone: {TONE}.
- {emoji_note}
- Keep responses under {MAX_RESPONSE_LEN} words unless a detailed plan is requested.
- Use markdown tables and bullet lists to organise nutritional data clearly.

EXPERTISE
=========
You are a certified AI nutrition coach specialising in:
  • Personalised calorie & macro calculation (BMR × activity factor).
  • Indian regional cuisine and global diet patterns.
  • Weight management, muscle gain, diabetes, heart health, and family nutrition.
  • {REGIONAL_CUISINE} food preferences: {indian_meals}
  • {veg_note}

CALORIE DISTRIBUTION (default)
===============================
  Breakfast : {int(DEFAULT_CALORIE_SPLIT['breakfast']*100)}%
  Lunch     : {int(DEFAULT_CALORIE_SPLIT['lunch']*100)}%
  Dinner    : {int(DEFAULT_CALORIE_SPLIT['dinner']*100)}%
  Snacks    : {int(DEFAULT_CALORIE_SPLIT['snacks']*100)}%

MACRO TARGETS (default)
========================
  Protein : {MACRO_TARGETS['protein_pct']}%
  Carbs   : {MACRO_TARGETS['carb_pct']}%
  Fat     : {MACRO_TARGETS['fat_pct']}%

SAFETY RULES (NON-NEGOTIABLE)
==============================
{safety_block}

FAMILY NUTRITION RULES
=======================
{family_block}

CAPABILITIES
============
1. Generate 7-day personalised meal plans with Indian & global options.
2. Analyse meals for calories, macros, vitamins, and minerals.
3. Provide shopping lists, recipe ideas, and portion guidance.
4. Answer nutrition questions with evidence-based information.
5. Support family profiles with per-member dietary recommendations.
6. Calculate BMI, BMR, TDEE, and ideal weight ranges.

RESPONSE FORMAT
===============
- For meal plans: use a structured table (Day | Breakfast | Lunch | Dinner | Snack | kcal).
- For calorie analysis: list each food item with macros.
- For BMI/BMR: show the formula, calculation, and interpretation.
- Always end with an encouraging note.
"""

SYSTEM_PROMPT = build_system_prompt()

# ══════════════════════════════════════════════════════════════════════════════
#  IBM WATSONX.AI  CLIENT
# ══════════════════════════════════════════════════════════════════════════════

def init_watsonx_client():
    """Initialise the IBM Watsonx.ai model inference client."""
    api_key    = os.getenv("IBM_API_KEY")
    project_id = os.getenv("WATSONX_PROJECT_ID")
    url        = os.getenv("WATSONX_URL", "https://au-syd.ml.cloud.ibm.com")

    if not api_key or not project_id:
        logger.warning("IBM_API_KEY or WATSONX_PROJECT_ID not set — running in demo mode.")
        return None

    try:
        credentials = Credentials(url=url, api_key=api_key)

        params = {
            GenParams.DECODING_METHOD:    DECODING_METHOD,
            GenParams.MAX_NEW_TOKENS:     MAX_NEW_TOKENS,
            GenParams.MIN_NEW_TOKENS:     MIN_NEW_TOKENS,
            GenParams.TEMPERATURE:        TEMPERATURE,
            GenParams.TOP_P:              TOP_P,
            GenParams.TOP_K:              TOP_K,
            GenParams.REPETITION_PENALTY: REPETITION_PENALTY,
        }

        model = ModelInference(
            model_id=MODEL_ID,
            params=params,
            credentials=credentials,
            project_id=project_id,
        )
        logger.info("✅  Watsonx.ai client initialised — model: %s", MODEL_ID)
        return model
    except Exception as exc:
        err = str(exc)
        logger.error("❌  Watsonx.ai init failed: %s", err)
        if "disabled" in err or "BXNIM0462E" in err:
            logger.error(
                "🔑  API key is DISABLED. Generate a new one at "
                "https://cloud.ibm.com/iam/apikeys and update your .env file."
            )
        return None


watsonx_model = init_watsonx_client()

# ══════════════════════════════════════════════════════════════════════════════
#  FLASK APPLICATION
# ══════════════════════════════════════════════════════════════════════════════

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", os.urandom(32).hex())
CORS(app)

# ──────────────────────────────────────────────────────────────────────────────
#  HELPERS
# ──────────────────────────────────────────────────────────────────────────────

def format_conversation_history(history: list[dict]) -> str:
    """Convert session history list into a flat text block for the prompt."""
    lines = []
    for msg in history[-10:]:          # last 10 turns for context window economy
        role  = "User" if msg["role"] == "user" else AGENT_NAME
        lines.append(f"{role}: {msg['content']}")
    return "\n".join(lines)


def call_watsonx(user_message: str, history: list[dict]) -> str:
    """Send a message to Watsonx.ai and return the text response."""
    if watsonx_model is None:
        # Check if it failed due to a disabled/invalid key so user sees a real error
        api_key = os.getenv("IBM_API_KEY", "")
        if not api_key or api_key == "your_ibm_cloud_api_key_here":
            return (
                "⚠️ **IBM API key not configured.**\n\n"
                "Add your key to `.env`:\n"
                "```\nIBM_API_KEY=your_key_here\n```\n"
                "Generate one at [cloud.ibm.com/iam/apikeys](https://cloud.ibm.com/iam/apikeys)"
            )
        return demo_response(user_message)

    # Build messages for the chat API — system prompt + prior history + current user message
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for msg in history[:-1][-9:]:   # up to 9 prior turns (excluding the current user msg)
        messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": user_message})

    try:
        result = watsonx_model.chat(messages=messages)
        # SDK returns a dict: result["choices"][0]["message"]["content"]
        if isinstance(result, dict):
            choices = result.get("choices", [])
            if choices:
                return choices[0].get("message", {}).get("content", "").strip()
        return str(result).strip()
    except Exception as exc:
        err_str = str(exc)
        logger.error("Watsonx generate error: %s", err_str)
        if "not supported" in err_str or "not_supported" in err_str:
            return (
                "⚠️ **Model not available in your region.**\n\n"
                f"The model `{MODEL_ID}` is not available in your IBM account plan.\n"
                "Please update `WATSONX_MODEL_ID` in your `.env` file to one of the supported models."
            )
        return (
            f"⚠️ **AI backend error:** {err_str[:300]}\n\n"
            "Please restart the app and try again."
        )


def demo_response(message: str) -> str:
    """Fallback demo response when no Watsonx credentials are configured."""
    msg = message.lower()
    if any(k in msg for k in ["meal plan", "diet plan", "weekly plan"]):
        return (
            "🌟 **Demo 7-Day Indian Meal Plan (1800 kcal/day)**\n\n"
            "| Day | Breakfast | Lunch | Dinner | Snack | kcal |\n"
            "|-----|-----------|-------|--------|-------|------|\n"
            "| Mon | Poha + Tea | Dal-Chawal | Palak Paneer + Roti | Fruit Chaat | 1820 |\n"
            "| Tue | Idli-Sambar | Rajma + Rice | Moong Dal + Roti | Roasted Chana | 1790 |\n"
            "| Wed | Upma | Chole + Roti | Veg Curry + Rice | Makhana | 1810 |\n"
            "| Thu | Oats Chilla | Khichdi | Dosa + Chutney | Sprouts | 1780 |\n"
            "| Fri | Paratha + Curd | Dal Tadka + Rice | Aloo Sabzi + Roti | Banana | 1800 |\n"
            "| Sat | Poha | Mixed Veg + Rice | Paneer Bhurji + Roti | Nuts | 1820 |\n"
            "| Sun | Dosa | Rajma + Rice | Dal Makhani + Rice | Fruit | 1800 |\n\n"
            "> ⚠️ *This is a demo response. Connect IBM Watsonx.ai for personalised plans.*"
        )
    if any(k in msg for k in ["bmi", "weight", "height"]):
        return (
            "📊 **BMI Calculator**\n\n"
            "BMI = Weight(kg) ÷ Height(m)²\n\n"
            "| Category | BMI Range |\n"
            "|----------|-----------|\n"
            "| Underweight | < 18.5 |\n"
            "| Normal | 18.5 – 24.9 |\n"
            "| Overweight | 25 – 29.9 |\n"
            "| Obese | ≥ 30 |\n\n"
            "Use the BMI Calculator tab for an instant result! 💪"
        )
    if any(k in msg for k in ["calorie", "calories", "kcal"]):
        return (
            "🔥 **Calorie Guide**\n\n"
            "Your daily calorie needs depend on age, weight, height, and activity:\n\n"
            "- 🧘 Sedentary: BMR × 1.2\n"
            "- 🚶 Light activity: BMR × 1.375\n"
            "- 🏃 Moderate: BMR × 1.55\n"
            "- 💪 Very active: BMR × 1.725\n\n"
            "Share your details and I'll calculate your personalised target! 🎯"
        )
    return (
        f"👋 Hi! I'm **{AGENT_NAME}**, {AGENT_TAGLINE}.\n\n"
        "I can help you with:\n"
        "- 🥗 Personalised meal plans\n"
        "- 🔥 Calorie & macro analysis\n"
        "- 📊 BMI & BMR calculation\n"
        "- 👨‍👩‍👧 Family nutrition planning\n"
        "- 🍛 Indian & global recipe suggestions\n\n"
        "What would you like to explore today? 😊\n\n"
        "> ⚠️ *Demo mode — add IBM Watsonx.ai credentials for full AI responses.*"
    )

# ──────────────────────────────────────────────────────────────────────────────
#  NUTRITION UTILITIES
# ──────────────────────────────────────────────────────────────────────────────

def calculate_bmi(weight_kg: float, height_cm: float) -> dict:
    height_m = height_cm / 100
    bmi = round(weight_kg / (height_m ** 2), 1)
    if bmi < 18.5:
        category, color = "Underweight", "warning"
    elif bmi < 25:
        category, color = "Normal Weight", "success"
    elif bmi < 30:
        category, color = "Overweight", "warning"
    else:
        category, color = "Obese", "danger"
    ideal_low  = round(18.5 * (height_m ** 2), 1)
    ideal_high = round(24.9 * (height_m ** 2), 1)
    return {
        "bmi": bmi, "category": category, "color": color,
        "ideal_low": ideal_low, "ideal_high": ideal_high,
    }


def calculate_bmr(weight_kg: float, height_cm: float,
                  age: int, gender: str) -> dict:
    """Mifflin-St Jeor equation."""
    if gender.lower() == "male":
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
    else:
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age - 161

    activity_factors = {
        "sedentary":    ("Sedentary (desk job)",           1.2),
        "light":        ("Light (1–3 days/week)",          1.375),
        "moderate":     ("Moderate (3–5 days/week)",       1.55),
        "active":       ("Active (6–7 days/week)",         1.725),
        "very_active":  ("Very Active (athlete/physical)", 1.9),
    }
    tdee_table = {
        level: round(bmr * factor)
        for level, (_, factor) in activity_factors.items()
    }
    return {
        "bmr": round(bmr),
        "tdee_table": tdee_table,
        "activity_labels": {k: v[0] for k, v in activity_factors.items()},
    }


def get_meal_calorie_split(daily_kcal: int) -> dict:
    return {
        meal: round(daily_kcal * pct)
        for meal, pct in DEFAULT_CALORIE_SPLIT.items()
    }

# ──────────────────────────────────────────────────────────────────────────────
#  ROUTES
# ──────────────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html",
                           agent_name=AGENT_NAME,
                           agent_tagline=AGENT_TAGLINE)


@app.route("/api/chat", methods=["POST"])
def chat():
    data    = request.get_json(silent=True) or {}
    message = (data.get("message") or "").strip()
    if not message:
        return jsonify({"error": "Message is required."}), 400

    if "chat_history" not in session:
        session["chat_history"] = []

    history = session["chat_history"]
    history.append({"role": "user", "content": message,
                    "timestamp": datetime.now().isoformat()})

    response = call_watsonx(message, history)

    history.append({"role": "assistant", "content": response,
                    "timestamp": datetime.now().isoformat()})
    session["chat_history"] = history[-40:]   # keep last 40 messages

    return jsonify({
        "response":  response,
        "timestamp": datetime.now().strftime("%I:%M %p"),
        "agent":     AGENT_NAME,
    })


@app.route("/api/bmi", methods=["POST"])
def bmi_route():
    data = request.get_json(silent=True) or {}
    try:
        weight = float(data["weight"])
        height = float(data["height"])
        age    = int(data.get("age", 25))
        gender = data.get("gender", "male")
    except (KeyError, ValueError, TypeError):
        return jsonify({"error": "Provide weight (kg), height (cm), age, gender."}), 400

    bmi_data = calculate_bmi(weight, height)
    bmr_data = calculate_bmr(weight, height, age, gender)
    split    = get_meal_calorie_split(bmr_data["tdee_table"]["moderate"])

    return jsonify({**bmi_data, **bmr_data, "calorie_split": split})


@app.route("/api/meal-plan", methods=["POST"])
def meal_plan_route():
    data = request.get_json(silent=True) or {}
    profile = {
        "name":        data.get("name", "User"),
        "age":         data.get("age", 25),
        "gender":      data.get("gender", "male"),
        "weight":      data.get("weight", 70),
        "height":      data.get("height", 170),
        "goal":        data.get("goal", "balanced"),
        "activity":    data.get("activity", "moderate"),
        "diet_type":   data.get("diet_type", "vegetarian"),
        "allergies":   data.get("allergies", []),
        "preferences": data.get("preferences", "Indian"),
    }

    prompt = (
        f"Create a detailed 7-day meal plan for:\n"
        f"Name: {profile['name']}, Age: {profile['age']}, "
        f"Gender: {profile['gender']}\n"
        f"Weight: {profile['weight']} kg, Height: {profile['height']} cm\n"
        f"Goal: {profile['goal']}, Activity: {profile['activity']}\n"
        f"Diet: {profile['diet_type']}, Preferences: {profile['preferences']}\n"
        f"Allergies: {', '.join(profile['allergies']) if profile['allergies'] else 'None'}\n\n"
        "Include breakfast, lunch, dinner, snacks, and total daily calories. "
        "Format as a markdown table."
    )

    plan = call_watsonx(prompt, [])
    return jsonify({"plan": plan, "profile": profile})


@app.route("/api/family-plan", methods=["POST"])
def family_plan_route():
    data    = request.get_json(silent=True) or {}
    members = data.get("members", [])
    if not members:
        return jsonify({"error": "Provide at least one family member."}), 400

    member_summary = "\n".join(
        f"- {m.get('name','?')} | Age: {m.get('age','?')} | "
        f"Gender: {m.get('gender','?')} | Goal: {m.get('goal','balanced')} | "
        f"Restrictions: {m.get('restrictions','none')}"
        for m in members
    )
    prompt = (
        f"Create a family-friendly 7-day meal plan for these members:\n"
        f"{member_summary}\n\n"
        "Focus on Indian cuisine. Show separate calorie targets per member. "
        "Use a single unified meal wherever possible and note modifications. "
        "Format as a detailed markdown table with per-member columns."
    )

    plan = call_watsonx(prompt, [])
    return jsonify({"plan": plan, "members": members})


@app.route("/api/analyze", methods=["POST"])
def analyze_route():
    data  = request.get_json(silent=True) or {}
    foods = data.get("foods", "")
    if not foods:
        return jsonify({"error": "Provide a list of foods to analyse."}), 400

    prompt = (
        f"Analyse the nutritional content of the following foods/meal:\n{foods}\n\n"
        "For each item provide: Calories, Protein (g), Carbs (g), Fat (g), "
        "Fibre (g), and key vitamins/minerals. "
        "Then give a total row and a health assessment. "
        "Format as a markdown table."
    )

    analysis = call_watsonx(prompt, [])
    return jsonify({"analysis": analysis})


@app.route("/api/clear-chat", methods=["POST"])
def clear_chat():
    session.pop("chat_history", None)
    return jsonify({"message": "Chat history cleared."})


@app.route("/api/health")
def health():
    return jsonify({
        "status":  "ok",
        "agent":   AGENT_NAME,
        "model":   MODEL_ID,
        "backend": "connected" if watsonx_model else "demo-mode",
        "time":    datetime.now().isoformat(),
    })


# ══════════════════════════════════════════════════════════════════════════════
#  ENTRY POINT
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    port  = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    logger.info("🚀  Starting %s on http://0.0.0.0:%s  (debug=%s)", AGENT_NAME, port, debug)
    app.run(host="0.0.0.0", port=port, debug=debug)
