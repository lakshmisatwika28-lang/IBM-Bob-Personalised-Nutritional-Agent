/* ═══════════════════════════════════════════════════════════════════════
   NutriAgent Bob — Application JavaScript
   app.js
════════════════════════════════════════════════════════════════════════ */

'use strict';

// ── Constants ─────────────────────────────────────────────────────────
const AGENT = window.AGENT_NAME    || 'Bob';
const TAG   = window.AGENT_TAGLINE || 'Your AI-Powered Nutrition & Wellness Coach';

const MACRO_COLORS = {
  protein: '#3b82f6',
  carbs:   '#22c55e',
  fat:     '#f59e0b',
};

const NUTRITION_TIPS = [
  { icon: '💧', text: 'Drink 8–10 glasses of water daily. Start each morning with a glass of warm water.' },
  { icon: '🌅', text: 'Never skip breakfast! A protein-rich morning meal boosts metabolism for the day.' },
  { icon: '🥗', text: 'Fill half your plate with vegetables & fruits at every meal for optimal micronutrients.' },
  { icon: '⏰', text: 'Eat at regular intervals (every 3–4 h) to maintain steady blood sugar levels.' },
  { icon: '🧠', text: 'Mindful eating — chew slowly and avoid screens during meals for better digestion.' },
  { icon: '🌙', text: 'Avoid heavy meals 2–3 hours before bedtime to improve sleep quality.' },
  { icon: '🫘', text: 'Include a source of protein (dal, paneer, eggs, legumes) in every meal.' },
  { icon: '🚶', text: 'A 10-minute walk after meals helps manage blood sugar and aids digestion.' },
];

// ══════════════════════════════════════════════════════════════════════
//  THEME MANAGEMENT
// ══════════════════════════════════════════════════════════════════════

function initTheme() {
  const saved = localStorage.getItem('nutriTheme') || 'light';
  applyTheme(saved);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const icon = document.getElementById('themeIcon');
  if (icon) {
    icon.className = theme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
  }
  localStorage.setItem('nutriTheme', theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

// ══════════════════════════════════════════════════════════════════════
//  TAB NAVIGATION
// ══════════════════════════════════════════════════════════════════════

function showTab(tabId) {
  // Hide all panels
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  // Remove active from nav links
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

  // Show selected panel
  const panel = document.getElementById(`tab-${tabId}`);
  if (panel) panel.classList.add('active');

  // Highlight nav link
  document.querySelectorAll('.nav-link').forEach(l => {
    if (l.textContent.toLowerCase().includes(tabId.toLowerCase().split('-')[0])) {
      l.classList.add('active');
    }
  });

  // Collapse mobile navbar
  const navContent = document.getElementById('navContent');
  if (navContent && navContent.classList.contains('show')) {
    const bsCollapse = bootstrap.Collapse.getInstance(navContent);
    if (bsCollapse) bsCollapse.hide();
  }

  // Lazy-render dashboard tips
  if (tabId === 'dashboard') renderDashboard();
}

// ══════════════════════════════════════════════════════════════════════
//  CHAT
// ══════════════════════════════════════════════════════════════════════

let isWaiting = false;

function initChat() {
  addMessage(
    'assistant',
    `👋 **Hi! I'm ${AGENT}** — ${TAG}.\n\n` +
    `I can help you with:\n` +
    `- 🥗 **Personalised meal plans** (Indian & global cuisine)\n` +
    `- 🔥 **Calorie & macro analysis**\n` +
    `- 📊 **BMI, BMR & TDEE calculations**\n` +
    `- 👨‍👩‍👧 **Family nutrition planning**\n` +
    `- 🩺 **Diet for diabetes, heart health & more**\n\n` +
    `What would you like to explore today? 😊`
  );
}

function addMessage(role, content, time) {
  const container = document.getElementById('chatMessages');
  if (!container) return;

  const isUser = role === 'user';
  const avatar  = isUser ? '👤' : '🥗';
  const timestamp = time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const wrapper = document.createElement('div');
  wrapper.className = `message ${role}`;
  wrapper.innerHTML = `
    <div class="msg-avatar">${avatar}</div>
    <div>
      <div class="msg-bubble">${isUser ? escapeHTML(content) : renderMarkdown(content)}</div>
      <div class="msg-time">${timestamp}</div>
    </div>
  `;
  container.appendChild(wrapper);
  container.scrollTop = container.scrollHeight;
}

function showTypingIndicator() {
  const container = document.getElementById('chatMessages');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'message assistant';
  el.id = 'typingIndicator';
  el.innerHTML = `
    <div class="msg-avatar">🥗</div>
    <div class="msg-bubble">
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>
  `;
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
}

function removeTypingIndicator() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

async function sendMessage() {
  if (isWaiting) return;

  const input   = document.getElementById('chatInput');
  const message = input.value.trim();
  if (!message) return;

  // Clear input & hide suggestions after first message
  input.value = '';
  autoResizeTextarea(input);
  document.getElementById('suggestedPrompts').style.display = 'none';

  addMessage('user', message);
  showTypingIndicator();
  setLoading(true, `${AGENT} is thinking…`);
  isWaiting = true;
  document.getElementById('sendBtn').disabled = true;

  try {
    const res  = await fetch('/api/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message }),
    });
    const data = await res.json();
    removeTypingIndicator();

    if (data.error) {
      addMessage('assistant', `❌ ${data.error}`);
    } else {
      addMessage('assistant', data.response, data.timestamp);
    }
  } catch (err) {
    removeTypingIndicator();
    addMessage('assistant', '⚠️ Network error — please check your connection and try again.');
  } finally {
    setLoading(false);
    isWaiting = false;
    document.getElementById('sendBtn').disabled = false;
    input.focus();
  }
}

function quickPrompt(text) {
  const input = document.getElementById('chatInput');
  if (input) {
    input.value = text;
    autoResizeTextarea(input);
  }
  showTab('chat');
  sendMessage();
}

async function clearChat() {
  try {
    await fetch('/api/clear-chat', { method: 'POST' });
  } catch (_) {}
  const container = document.getElementById('chatMessages');
  if (container) container.innerHTML = '';
  document.getElementById('suggestedPrompts').style.display = 'flex';
  initChat();
  showToast('Chat cleared ✓', 'success');
}

// ══════════════════════════════════════════════════════════════════════
//  BMI / BMR CALCULATOR
// ══════════════════════════════════════════════════════════════════════

async function calculateBMI() {
  const weight = parseFloat(document.getElementById('bmiWeight').value);
  const height = parseInt(document.getElementById('bmiHeightRange').value);
  const age    = parseInt(document.getElementById('bmiAge').value);
  const gender = document.getElementById('bmiGender').value;

  // Sync hidden field
  document.getElementById('bmiHeight').value = height;

  if (!weight || weight < 20 || weight > 300) {
    showToast('Please enter a valid weight (20–300 kg)', 'danger'); return;
  }
  if (!age || age < 5 || age > 100) {
    showToast('Please enter a valid age (5–100)', 'danger'); return;
  }

  setLoading(true, 'Calculating…');
  try {
    const res  = await fetch('/api/bmi', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ weight, height, age, gender }),
    });
    const data = await res.json();
    if (data.error) { showToast(data.error, 'danger'); return; }

    renderBMIResult(data, weight, height);
    updateDashboard(data, weight, height);
  } catch (err) {
    showToast('Error calculating BMI. Please try again.', 'danger');
  } finally {
    setLoading(false);
  }
}

function renderBMIResult(data, weight, height) {
  const colorMap = { success: '#16a34a', warning: '#d97706', danger: '#dc2626' };
  const hexColor = colorMap[data.color] || '#2563eb';

  const tdeeRows = Object.entries(data.tdee_table).map(([key, val]) => {
    const label = data.activity_labels[key];
    const isModerate = key === 'moderate';
    return `<tr class="${isModerate ? 'highlight' : ''}">
      <td>${label}</td>
      <td><strong>${val}</strong> kcal/day</td>
    </tr>`;
  }).join('');

  const html = `
    <div class="text-center mb-3">
      <div class="bmi-value-display" style="color:${hexColor}">${data.bmi}</div>
      <span class="bmi-category" style="background:${hexColor}20;color:${hexColor}">${data.category}</span>
      <p class="text-muted mt-2 mb-0 small">Ideal weight range: <strong>${data.ideal_low}–${data.ideal_high} kg</strong></p>
    </div>

    <div class="bmi-range-bar mb-1">
      <div class="bmi-range-seg" style="background:#3b82f6" title="Underweight < 18.5"></div>
      <div class="bmi-range-seg" style="background:#22c55e" title="Normal 18.5–24.9"></div>
      <div class="bmi-range-seg" style="background:#f59e0b" title="Overweight 25–29.9"></div>
      <div class="bmi-range-seg" style="background:#ef4444" title="Obese ≥ 30"></div>
    </div>
    <div class="d-flex justify-content-between mb-3" style="font-size:.72rem;color:var(--text-muted)">
      <span>Underweight</span><span>Normal</span><span>Overweight</span><span>Obese</span>
    </div>

    <hr style="border-color:var(--border)" />
    <h6 class="fw-semibold mb-2">BMR: <strong>${data.bmr} kcal/day</strong></h6>
    <p class="text-muted small mb-2">Basal Metabolic Rate (Mifflin-St Jeor) — calories burned at rest.</p>

    <h6 class="fw-semibold mb-2">TDEE by Activity Level</h6>
    <table class="tdee-table">
      <thead><tr><th>Activity</th><th>Daily Calories</th></tr></thead>
      <tbody>${tdeeRows}</tbody>
    </table>
    <p class="text-muted small mt-2">★ Highlighted row = moderate activity (recommended baseline)</p>

    <div class="mt-3 p-3 rounded" style="background:color-mix(in srgb, ${hexColor} 10%, transparent);border:1px solid ${hexColor}30">
      <strong>Calorie Split (Moderate Activity)</strong>
      <div class="meal-bars mt-2" id="bmiMealBars"></div>
    </div>
  `;

  document.getElementById('bmiResult').innerHTML = html;

  // Render meal bars inside result
  renderMealBars('bmiMealBars', data.calorie_split);
  showToast('BMI calculated successfully ✓', 'success');
}

// ══════════════════════════════════════════════════════════════════════
//  MEAL PLAN
// ══════════════════════════════════════════════════════════════════════

async function generateMealPlan() {
  const allergiesRaw = document.getElementById('mpAllergies').value;
  const allergies    = allergiesRaw ? allergiesRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

  const payload = {
    name:        document.getElementById('mpName').value     || 'User',
    age:         parseInt(document.getElementById('mpAge').value)    || 25,
    gender:      document.getElementById('mpGender').value,
    weight:      parseFloat(document.getElementById('mpWeight').value) || 70,
    height:      parseFloat(document.getElementById('mpHeight').value) || 170,
    goal:        document.getElementById('mpGoal').value,
    activity:    document.getElementById('mpActivity').value,
    diet_type:   document.getElementById('mpDiet').value,
    preferences: document.getElementById('mpCuisine').value,
    allergies,
  };

  setLoading(true, 'Generating your personalised 7-day meal plan…');
  try {
    const res  = await fetch('/api/meal-plan', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    const data = await res.json();
    const container = document.getElementById('mealPlanResult');
    if (data.error) {
      container.innerHTML = `<div class="alert alert-danger">${data.error}</div>`;
    } else {
      container.innerHTML = `
        <div class="result-panel">
          <div class="d-flex align-items-center justify-content-between mb-2">
            <h5 class="mb-0 fw-bold">🗓️ 7-Day Meal Plan for ${escapeHTML(payload.name)}</h5>
            <button class="btn btn-sm btn-outline-secondary" onclick="copyResult('mealPlanResult')">
              <i class="bi bi-clipboard me-1"></i>Copy
            </button>
          </div>
          <hr style="border-color:var(--border)" />
          ${renderMarkdown(data.plan)}
        </div>`;
    }
  } catch (err) {
    document.getElementById('mealPlanResult').innerHTML =
      '<div class="alert alert-danger">Network error. Please try again.</div>';
  } finally {
    setLoading(false);
  }
}

// ══════════════════════════════════════════════════════════════════════
//  FAMILY PLANNER
// ══════════════════════════════════════════════════════════════════════

let memberCount = 0;

function addFamilyMember() {
  memberCount++;
  const container = document.getElementById('familyMembers');
  const id = `member-${memberCount}`;

  const card = document.createElement('div');
  card.className = 'family-member-card';
  card.id = id;
  card.innerHTML = `
    <button class="member-remove" onclick="removeMember('${id}')" title="Remove member">
      <i class="bi bi-x-lg"></i>
    </button>
    <div class="row g-2">
      <div class="col-md-3">
        <label class="form-label">Name</label>
        <input type="text" class="form-control fm-name" placeholder="e.g. Dad" value="Member ${memberCount}" />
      </div>
      <div class="col-md-2">
        <label class="form-label">Age</label>
        <input type="number" class="form-control fm-age" placeholder="Age" min="1" max="100" value="30" />
      </div>
      <div class="col-md-2">
        <label class="form-label">Gender</label>
        <select class="form-select fm-gender">
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
      </div>
      <div class="col-md-3">
        <label class="form-label">Goal</label>
        <select class="form-select fm-goal">
          <option value="balanced">Balanced</option>
          <option value="weight-loss">Weight Loss</option>
          <option value="muscle-gain">Muscle Gain</option>
          <option value="diabetic-friendly">Diabetic Friendly</option>
        </select>
      </div>
      <div class="col-md-2">
        <label class="form-label">Restrictions</label>
        <input type="text" class="form-control fm-restrictions" placeholder="e.g. gluten" />
      </div>
    </div>
  `;
  container.appendChild(card);
}

function removeMember(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

async function generateFamilyPlan() {
  const cards   = document.querySelectorAll('.family-member-card');
  if (cards.length === 0) {
    showToast('Please add at least one family member.', 'danger'); return;
  }

  const members = Array.from(cards).map(card => ({
    name:         card.querySelector('.fm-name')?.value         || 'Member',
    age:          parseInt(card.querySelector('.fm-age')?.value)  || 30,
    gender:       card.querySelector('.fm-gender')?.value        || 'male',
    goal:         card.querySelector('.fm-goal')?.value          || 'balanced',
    restrictions: card.querySelector('.fm-restrictions')?.value  || 'none',
  }));

  setLoading(true, 'Crafting your family nutrition plan…');
  try {
    const res  = await fetch('/api/family-plan', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ members }),
    });
    const data = await res.json();
    const container = document.getElementById('familyPlanResult');
    if (data.error) {
      container.innerHTML = `<div class="alert alert-danger">${data.error}</div>`;
    } else {
      container.innerHTML = `
        <div class="result-panel">
          <div class="d-flex align-items-center justify-content-between mb-2">
            <h5 class="mb-0 fw-bold">👨‍👩‍👧 Family Meal Plan (${members.length} member${members.length > 1 ? 's' : ''})</h5>
            <button class="btn btn-sm btn-outline-secondary" onclick="copyResult('familyPlanResult')">
              <i class="bi bi-clipboard me-1"></i>Copy
            </button>
          </div>
          <hr style="border-color:var(--border)" />
          ${renderMarkdown(data.plan)}
        </div>`;
    }
  } catch (err) {
    document.getElementById('familyPlanResult').innerHTML =
      '<div class="alert alert-danger">Network error. Please try again.</div>';
  } finally {
    setLoading(false);
  }
}

// ══════════════════════════════════════════════════════════════════════
//  MEAL ANALYZER
// ══════════════════════════════════════════════════════════════════════

async function analyzeMeal() {
  const foods = document.getElementById('analyzeInput').value.trim();
  if (!foods) { showToast('Please enter some foods to analyse.', 'danger'); return; }

  setLoading(true, 'Analysing nutritional content…');
  try {
    const res  = await fetch('/api/analyze', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ foods }),
    });
    const data = await res.json();
    const container = document.getElementById('analyzeResult');
    if (data.error) {
      container.innerHTML = `<div class="alert alert-danger">${data.error}</div>`;
    } else {
      container.innerHTML = `
        <div class="result-panel">
          <div class="d-flex align-items-center justify-content-between mb-2">
            <h5 class="mb-0 fw-bold">📊 Nutritional Analysis</h5>
            <button class="btn btn-sm btn-outline-secondary" onclick="copyResult('analyzeResult')">
              <i class="bi bi-clipboard me-1"></i>Copy
            </button>
          </div>
          <hr style="border-color:var(--border)" />
          ${renderMarkdown(data.analysis)}
        </div>`;
    }
  } catch (err) {
    document.getElementById('analyzeResult').innerHTML =
      '<div class="alert alert-danger">Network error. Please try again.</div>';
  } finally {
    setLoading(false);
  }
}

// ══════════════════════════════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════════════════════════════

function renderDashboard() {
  renderMacroChart();
  renderTips();
}

function renderMacroChart() {
  const svg    = document.getElementById('macroSvg');
  const legend = document.getElementById('macroLegend');
  if (!svg || !legend) return;

  const data = [
    { label: 'Protein', pct: 30, color: MACRO_COLORS.protein },
    { label: 'Carbs',   pct: 45, color: MACRO_COLORS.carbs   },
    { label: 'Fat',     pct: 25, color: MACRO_COLORS.fat      },
  ];

  const cx = 100, cy = 100, r = 75, strokeW = 28;
  const circ = 2 * Math.PI * r;
  let offset = -circ * 0.25; // start at top

  let paths = '';
  data.forEach(d => {
    const dash = (d.pct / 100) * circ;
    paths += `<circle cx="${cx}" cy="${cy}" r="${r}"
      fill="none" stroke="${d.color}" stroke-width="${strokeW}"
      stroke-dasharray="${dash} ${circ - dash}"
      stroke-dashoffset="${offset}"
      stroke-linecap="round" />`;
    offset -= dash;
  });

  svg.innerHTML = `
    ${paths}
    <text x="${cx}" y="${cy - 6}"  text-anchor="middle" font-size="13" font-weight="800" fill="var(--text)">Macros</text>
    <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="10" fill="var(--text-muted)">Distribution</text>
  `;

  legend.innerHTML = data.map(d => `
    <div class="legend-item">
      <div class="legend-dot" style="background:${d.color}"></div>
      <span>${d.label} ${d.pct}%</span>
    </div>`).join('');
}

function renderTips() {
  const grid = document.getElementById('tipsGrid');
  if (!grid) return;
  grid.innerHTML = NUTRITION_TIPS.map(t => `
    <div class="tip-card">
      <div class="tip-icon">${t.icon}</div>
      ${t.text}
    </div>`).join('');
}

function renderMealBars(containerId, split) {
  const container = document.getElementById(containerId);
  if (!container || !split) return;

  const barColors = {
    breakfast: '#f59e0b',
    lunch:     '#22c55e',
    dinner:    '#3b82f6',
    snacks:    '#a855f7',
  };

  const maxVal = Math.max(...Object.values(split));
  container.innerHTML = Object.entries(split).map(([meal, kcal]) => `
    <div class="meal-bar-row">
      <span class="meal-bar-label">${capitalize(meal)}</span>
      <div class="meal-bar-track">
        <div class="meal-bar-fill" style="width:${(kcal/maxVal*100).toFixed(0)}%;background:${barColors[meal] || '#888'}"></div>
      </div>
      <span class="meal-bar-val">${kcal} kcal</span>
    </div>`).join('');

  // Also update dashboard meal bars
  const dashBars = document.getElementById('mealBars');
  if (dashBars) dashBars.innerHTML = container.innerHTML;
}

function updateDashboard(data, weight, height) {
  const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };

  el('dashBMI', data.bmi);
  el('dashCalories', `${data.tdee_table?.moderate || '—'} kcal`);

  // Update meal bars on dashboard
  if (data.calorie_split) {
    renderMealBars('mealBars', data.calorie_split);
  }
}

// ══════════════════════════════════════════════════════════════════════
//  UTILITIES
// ══════════════════════════════════════════════════════════════════════

function renderMarkdown(text) {
  if (typeof marked === 'undefined') return escapeHTML(text);
  try {
    marked.setOptions({ breaks: true, gfm: true });
    return marked.parse(text || '');
  } catch (e) {
    return escapeHTML(text);
  }
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function setLoading(show, text) {
  const overlay = document.getElementById('loadingOverlay');
  const label   = document.getElementById('loadingText');
  if (!overlay) return;
  if (show) {
    if (label) label.textContent = text || `${AGENT} is thinking…`;
    overlay.classList.add('show');
  } else {
    overlay.classList.remove('show');
  }
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('appToast');
  const body  = document.getElementById('toastBody');
  if (!toast || !body) return;

  body.textContent = message;
  toast.className = `toast align-items-center text-white border-0 bg-${type}`;
  const bsToast = new bootstrap.Toast(toast, { delay: 3000 });
  bsToast.show();
}

function copyResult(containerId) {
  const el   = document.getElementById(containerId);
  const text = el ? el.innerText : '';
  navigator.clipboard.writeText(text)
    .then(() => showToast('Copied to clipboard ✓', 'success'))
    .catch(() => showToast('Could not copy — try selecting manually.', 'danger'));
}

function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 140) + 'px';
}

// ══════════════════════════════════════════════════════════════════════
//  HEIGHT SLIDER SYNC
// ══════════════════════════════════════════════════════════════════════

function initHeightSlider() {
  const slider = document.getElementById('bmiHeightRange');
  const hidden = document.getElementById('bmiHeight');
  if (!slider || !hidden) return;
  slider.addEventListener('input', () => {
    hidden.value = slider.value;
  });
}

// ══════════════════════════════════════════════════════════════════════
//  KEYBOARD SHORTCUTS
// ══════════════════════════════════════════════════════════════════════

function initKeyboard() {
  const textarea = document.getElementById('chatInput');
  if (!textarea) return;

  textarea.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
  });

  textarea.addEventListener('input', () => autoResizeTextarea(textarea));
}

// ══════════════════════════════════════════════════════════════════════
//  NAVBAR SCROLL EFFECT
// ══════════════════════════════════════════════════════════════════════

function initScrollEffect() {
  const nav = document.getElementById('mainNav');
  if (!nav) return;
  window.addEventListener('scroll', () => {
    nav.style.boxShadow = window.scrollY > 10
      ? '0 4px 12px rgba(0,0,0,.12)'
      : 'none';
  }, { passive: true });
}

// ══════════════════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initChat();
  initKeyboard();
  initHeightSlider();
  initScrollEffect();
  renderDashboard();

  // Theme toggle button
  const btn = document.getElementById('themeToggle');
  if (btn) btn.addEventListener('click', toggleTheme);

  // Pre-add 2 family members for convenience
  addFamilyMember();
  addFamilyMember();

  // Default to chat tab
  showTab('chat');
});
