/* ──────────────────────────────────────────────
   EcoSense – app.js
   Simulated sensor data + Canvas charts + UI
────────────────────────────────────────────── */

'use strict';

// ─── UTILITIES ──────────────────────────────────────────────────────────────

const $ = id => document.getElementById(id);
const rand = (min, max, dec = 1) => parseFloat((Math.random() * (max - min) + min).toFixed(dec));
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/** Smoothly walk a value by ±delta, clamped to [lo, hi] */
function walk(current, delta, lo, hi) {
  return clamp(current + rand(-delta, delta), lo, hi);
}

// ─── ECO TIPS DATA ───────────────────────────────────────────────────────────

const ECO_TIPS = [
  { emoji: '🚶', category: 'Transport', text: 'Walk or cycle for trips under 3 km. You\'ll cut emissions and improve cardiovascular health!', impact: '≈ 0.21 kg CO₂ saved per km replaced' },
  { emoji: '🌱', category: 'Diet', text: 'Try one plant-based meal per day. A vegan meal generates 70% fewer greenhouse gases than a beef meal.', impact: '≈ 1.5 kg CO₂e saved per day' },
  { emoji: '💡', category: 'Energy', text: 'Switch to LED bulbs throughout your home — they use 75% less energy and last 25× longer.', impact: '≈ 40 kg CO₂ saved per bulb per year' },
  { emoji: '🛁', category: 'Water', text: 'Cut shower time by 2 minutes. You\'ll save up to 10 litres of water per shower.', impact: '≈ 0.04 kg CO₂ per shorter shower' },
  { emoji: '♻️', category: 'Waste', text: 'Recycle paper, glass, and plastics consistently. Recycling aluminium saves 95% of the energy vs new production.', impact: '≈ 1 kg CO₂e per kg aluminium recycled' },
  { emoji: '🌳', category: 'Offset', text: 'Plant a tree or sponsor reforestation. A mature tree absorbs 21 kg of CO₂ annually.', impact: '≈ 21 kg CO₂ absorbed per tree per year' },
  { emoji: '📱', category: 'Energy', text: 'Unplug chargers and electronics when not in use. Standby power accounts for 5–10% of home energy use.', impact: '≈ 65 kg CO₂ saved per household per year' },
  { emoji: '🛍️', category: 'Shopping', text: 'Carry a reusable bag. Manufacturing a single plastic bag produces 1.6 g CO₂ — billions are used daily.', impact: 'Prevents microplastic pollution too' },
  { emoji: '🚿', category: 'Water', text: 'Fix a dripping tap: a slow drip wastes over 3,000 litres of water per year.', impact: 'Freshwater conservation · lower energy costs' },
  { emoji: '🏠', category: 'Home', text: 'Set your thermostat 1°C lower in winter. That small change reduces heating energy by around 8%.', impact: '≈ 130 kg CO₂ saved per year' },
  { emoji: '🍱', category: 'Waste', text: 'Plan your meals to avoid food waste. About 1/3 of all food produced globally is wasted.', impact: 'Food waste = 8% of global GHG emissions' },
  { emoji: '🚌', category: 'Transport', text: 'Use public transport once a week instead of driving. A full bus emits 6× less CO₂ per passenger km.', impact: '≈ 2.4 kg CO₂ saved per bus trip' },
];

// ─── STATE ───────────────────────────────────────────────────────────────────

const state = {
  // AQI
  aqi:      75,
  pm25:     22,
  pm10:     45,
  no2:      35,
  co:       1.8,
  o3:       42,
  temp:     28.4,
  humidity: 61,
  wind:     14,
  uv:       6,

  // GHG
  co2:      418,
  ch4:      1910,
  n2o:      336,

  // Water
  ph:       7.2,
  turbid:   2.1,
  dissolvedO2: 7.8,
  coliform: 4,

  // Chart history
  co2History:  [],
  ch4History:  [],
  n2oHistory:  [],

  // Carousel
  tipIndex: 0,
};

// ─── CHART CONTEXTS ──────────────────────────────────────────────────────────

let co2Ctx, ch4Ctx, n2oCtx, wqiCtx;

// ─── GAUGE ──────────────────────────────────────────────────────────────────

function updateGauge(aqi) {
  const arc     = $('gaugeArc');
  const needle  = $('gaugeNeedle');
  const valElem = $('aqiValue');
  const lblElem = $('aqiLabel');

  // Arc: full arc dasharray ≈ 283 (semi-circle path); aqi 0-500 → 0-283
  const maxAqi = 300;
  const ratio  = clamp(aqi / maxAqi, 0, 1);
  const offset = 283 - (283 * ratio);
  arc.style.strokeDashoffset = offset;

  // Color
  let color, label;
  if (aqi <= 50)       { color = '#22c55e'; label = 'Good'; }
  else if (aqi <= 100) { color = '#eab308'; label = 'Moderate'; }
  else if (aqi <= 150) { color = '#f97316'; label = 'Unhealthy for Sensitive'; }
  else if (aqi <= 200) { color = '#ef4444'; label = 'Unhealthy'; }
  else if (aqi <= 250) { color = '#9333ea'; label = 'Very Unhealthy'; }
  else                 { color = '#7f1d1d'; label = 'Hazardous'; }

  arc.setAttribute('stroke', color);
  valElem.textContent = Math.round(aqi);
  valElem.style.color = color;
  lblElem.textContent = label;

  // Rotate needle: -90° (left) to +90° (right) for 0 → max
  const angle = -90 + 180 * ratio;
  const r = 75; // radius
  const cx = 110, cy = 110;
  const rad = (angle * Math.PI) / 180;
  const x2 = cx + r * Math.sin(rad);
  const y2 = cy - r * Math.cos(rad);
  needle.setAttribute('x2', x2.toFixed(1));
  needle.setAttribute('y2', y2.toFixed(1));

  // Global alert
  updateGlobalAlert(aqi, color, label);
}

function updateGlobalAlert(aqi, color, label) {
  const dot  = $('alertDot');
  const text = $('alertText');
  dot.style.background = color;
  if (aqi <= 50)       text.textContent = `✅ Air quality is Good (AQI ${Math.round(aqi)}) — safe for all activities.`;
  else if (aqi <= 100) text.textContent = `⚠️ Moderate AQI (${Math.round(aqi)}) — sensitive groups should limit outdoor exertion.`;
  else if (aqi <= 150) text.textContent = `🟠 Unhealthy for Sensitive (AQI ${Math.round(aqi)}) — children & elderly advised to stay indoors.`;
  else                 text.textContent = `🔴 ALERT: AQI ${Math.round(aqi)} — ${label}. Avoid outdoor activities!`;
}

// ─── POLLUTANT BARS ──────────────────────────────────────────────────────────

function updatePollutant(id, barId, value, max) {
  const el  = $(id);
  const bar = $(barId);
  if (!el || !bar) return;
  el.textContent = typeof value === 'number' ? value.toFixed(1) : value;
  const pct = clamp((value / max) * 100, 0, 100);
  bar.style.width = pct + '%';

  // Color gradient by severity
  if (pct < 35)       bar.style.background = 'linear-gradient(90deg,#22c55e,#4ade80)';
  else if (pct < 65)  bar.style.background = 'linear-gradient(90deg,#eab308,#fbbf24)';
  else if (pct < 85)  bar.style.background = 'linear-gradient(90deg,#f97316,#fb923c)';
  else                bar.style.background = 'linear-gradient(90deg,#ef4444,#f87171)';
}

// ─── CO₂ LINE CHART ──────────────────────────────────────────────────────────

function drawCO2Chart() {
  const canvas = $('co2Chart');
  if (!canvas) return;
  if (!co2Ctx) { co2Ctx = canvas.getContext('2d'); canvas.width = canvas.offsetWidth || 600; canvas.height = 180; }

  const ctx = co2Ctx;
  const w = canvas.width;
  const h = canvas.height;
  const data = state.co2History;
  if (data.length < 2) return;

  ctx.clearRect(0, 0, w, h);

  const min = Math.min(...data) - 5;
  const max = Math.max(...data) + 5;
  const xStep = w / (data.length - 1);

  const pts = data.map((v, i) => ({
    x: i * xStep,
    y: h - ((v - min) / (max - min)) * (h - 20) - 10
  }));

  // Gradient fill
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'hsla(145,72%,45%,.35)');
  grad.addColorStop(1, 'hsla(145,72%,45%,0)');

  ctx.beginPath();
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.lineTo(pts[pts.length - 1].x, h);
  ctx.lineTo(0, h); ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();

  // Line
  ctx.beginPath();
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.strokeStyle = 'hsl(145,72%,45%)';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Last point dot
  const last = pts[pts.length - 1];
  ctx.beginPath();
  ctx.arc(last.x, last.y, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#22c55e'; ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();

  // X axis labels
  ctx.fillStyle = 'hsl(220,15%,55%)';
  ctx.font = '10px Inter, sans-serif';
  ctx.textAlign = 'center';
  const step = Math.floor(data.length / 5);
  for (let i = 0; i < data.length; i += step) {
    const ago = (data.length - 1 - i) * 3;
    ctx.fillText(ago === 0 ? 'now' : `-${ago}s`, pts[i].x, h - 2);
  }
}

// ─── SPARKLINES ──────────────────────────────────────────────────────────────

function drawSparkline(canvasId, history, color) {
  const canvas = $(canvasId);
  if (!canvas || history.length < 2) return;
  canvas.width  = canvas.offsetWidth  || 200;
  canvas.height = 50;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = max - min || 1;
  const xStep = w / (history.length - 1);
  const pts = history.map((v, i) => ({
    x: i * xStep,
    y: h - ((v - min) / range) * (h - 6) - 3
  }));

  ctx.beginPath();
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

// ─── WATER DONUT CHART ───────────────────────────────────────────────────────

function drawWqiDonut(score) {
  const canvas = $('wqiDonut');
  if (!canvas) return;
  if (!wqiCtx) { wqiCtx = canvas.getContext('2d'); canvas.width = 180; canvas.height = 180; }

  const ctx = wqiCtx;
  ctx.clearRect(0, 0, 180, 180);

  const cx = 90, cy = 90, r = 72, lw = 18;
  const full = Math.PI * 2;
  const start = -Math.PI / 2;

  // Background ring
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, full);
  ctx.strokeStyle = 'hsl(222,20%,17%)';
  ctx.lineWidth = lw; ctx.stroke();

  // Score segments
  const pct = clamp(score / 100, 0, 1);

  // Good portion
  let color;
  if (score >= 80)      color = '#22c55e';
  else if (score >= 60) color = '#eab308';
  else if (score >= 40) color = '#f97316';
  else                  color = '#ef4444';

  ctx.beginPath();
  ctx.arc(cx, cy, r, start, start + full * pct);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Center text
  const scoreEl  = $('wqiScore');
  const ratingEl = $('wqiRating');
  if (scoreEl) scoreEl.textContent = Math.round(score);
  if (scoreEl) scoreEl.style.color = color;

  let rating;
  if (score >= 80)      rating = 'Excellent';
  else if (score >= 60) rating = 'Good';
  else if (score >= 40) rating = 'Fair';
  else if (score >= 20) rating = 'Poor';
  else                  rating = 'Very Poor';

  if (ratingEl) ratingEl.textContent = rating;
}

// ─── GHG STATUS ──────────────────────────────────────────────────────────────

function ghgStatus(id, value, safe, unit) {
  const el = $(id);
  if (!el) return;
  if (value < safe) {
    el.textContent = '✅ Within safe range';
    el.style.background = 'hsl(145,72%,45%,.15)';
    el.style.color = '#22c55e';
  } else {
    const pct = Math.round(((value - safe) / safe) * 100);
    el.textContent = `⚠️ ${pct}% above safe (${safe} ${unit})`;
    el.style.background = 'hsl(30,90%,58%,.15)';
    el.style.color = '#f97316';
  }
}

// ─── SENSOR UPDATE (every 3s) ────────────────────────────────────────────────

function updateSensors() {
  // Walk AQI components
  state.aqi      = walk(state.aqi,      5,   20, 185);
  state.pm25     = walk(state.pm25,     2,    5,  75);
  state.pm10     = walk(state.pm10,     3,   10, 150);
  state.no2      = walk(state.no2,      3,   10,  90);
  state.co       = walk(state.co,      .2,    .5,  9);
  state.o3       = walk(state.o3,       3,   10,  80);
  state.temp     = walk(state.temp,    .5,   18,  42);
  state.humidity = walk(state.humidity, 2,   30,  95);
  state.wind     = walk(state.wind,     1,    3,  40);
  state.uv       = walk(state.uv,       .5,  1,   11);

  // GHG
  state.co2  = walk(state.co2,  1.5, 400, 450);
  state.ch4  = walk(state.ch4,  5,  1850, 1980);
  state.n2o  = walk(state.n2o,  1,   330,  350);

  // Water
  state.ph         = walk(state.ph,       .1, 5.5, 9.5);
  state.turbid     = walk(state.turbid,   .3,  0.3, 10);
  state.dissolvedO2= walk(state.dissolvedO2, .2, 3, 11);
  state.coliform   = walk(state.coliform,  1,   0, 35);

  // Push history (max 40 points)
  state.co2History.push(state.co2);
  state.ch4History.push(state.ch4);
  state.n2oHistory.push(state.n2o);
  if (state.co2History.length > 40) state.co2History.shift();
  if (state.ch4History.length > 40) state.ch4History.shift();
  if (state.n2oHistory.length > 40) state.n2oHistory.shift();

  renderAll();
}

function renderAll() {
  // AQI Gauge
  updateGauge(state.aqi);

  // Pollutants
  updatePollutant('pm25Val', 'pm25Bar', state.pm25, 75);
  updatePollutant('pm10Val', 'pm10Bar', state.pm10, 150);
  updatePollutant('no2Val',  'no2Bar',  state.no2,   90);
  updatePollutant('coVal',   'coBar',   state.co,     9);
  updatePollutant('o3Val',   'o3Bar',   state.o3,    80);

  // Stats
  setText('tempVal',   state.temp.toFixed(1));
  setText('humidVal',  Math.round(state.humidity));
  setText('windVal',   Math.round(state.wind));
  setText('uvVal',     state.uv.toFixed(1));

  const now = new Date();
  setText('lastUpdated', now.toLocaleTimeString());

  // GHG
  setText('co2Val', Math.round(state.co2));
  setText('ch4Val', Math.round(state.ch4));
  setText('n2oVal', Math.round(state.n2o));

  const co2Start = state.co2History[0];
  const co2Now   = state.co2;
  const co2Diff  = (co2Now - co2Start).toFixed(1);
  const trendEl  = $('co2Trend');
  if (trendEl) {
    trendEl.textContent = co2Diff >= 0
      ? `↗ Rising +${co2Diff} ppm since monitoring started`
      : `↘ Falling ${co2Diff} ppm since monitoring started`;
    trendEl.style.color = co2Diff >= 0 ? '#f97316' : '#22c55e';
  }

  ghgStatus('ch4Status', state.ch4, 1900, 'ppb');
  ghgStatus('n2oStatus', state.n2o, 336,  'ppb');

  drawCO2Chart();
  drawSparkline('ch4Spark', state.ch4History, '#a855f7');
  drawSparkline('n2oSpark', state.n2oHistory, '#f97316');

  // Water
  const wqi = calcWQI();
  drawWqiDonut(wqi);

  const phPct = clamp(((state.ph - 5.5) / 4) * 100, 0, 100);
  const turbidPct = clamp((state.turbid / 10) * 100, 0, 100);
  const doPct = clamp((state.dissolvedO2 / 11) * 100, 0, 100);
  const colPct = clamp((state.coliform / 35) * 100, 0, 100);

  setText('phVal',      state.ph.toFixed(2));
  setText('turbidVal',  state.turbid.toFixed(2) + ' NTU');
  setText('doVal',      state.dissolvedO2.toFixed(2) + ' mg/L');
  setText('coliformVal',Math.round(state.coliform) + ' CFU');

  setBarWidth('phBar',       phPct,     phPct > 70 ? '#22c55e' : '#eab308');
  setBarWidth('turbidBar',   100 - turbidPct, turbidPct < 40 ? '#22c55e' : '#ef4444');
  setBarWidth('doBar',       doPct,     doPct > 60 ? '#22c55e' : '#f97316');
  setBarWidth('coliformBar', 100 - colPct, colPct < 30 ? '#22c55e' : '#ef4444');
}

function setText(id, val) {
  const el = $(id);
  if (el) el.textContent = val;
}

function setBarWidth(id, pct, color) {
  const el = $(id);
  if (!el) return;
  el.style.width = clamp(pct, 0, 100) + '%';
  el.style.background = color;
}

// ─── WATER QUALITY INDEX ─────────────────────────────────────────────────────

function calcWQI() {
  // Simple weighted formula for demo
  const phScore  = state.ph >= 6.5 && state.ph <= 8.5 ? 100 : 50;
  const turbScore = Math.max(0, 100 - (state.turbid / 10) * 120);
  const doScore   = Math.min(100, (state.dissolvedO2 / 8) * 100);
  const colScore  = Math.max(0, 100 - (state.coliform / 10) * 80);
  return (phScore * 0.3 + turbScore * 0.25 + doScore * 0.25 + colScore * 0.2);
}

// ─── CARBON CALCULATOR ───────────────────────────────────────────────────────

const CALC_FACTORS = {
  car:      0.21,   // kg CO2 per km
  flight:   90,     // kg CO2 per flight-hour (avg short-haul)
  electric: 0.233,  // kg CO2 per kWh (India avg grid emission factor 2024)
  meatDay:  3.3,    // kg CO2e per day of meat (per-meal equiv × 4.3 weeks)
  shopping: 4.5,    // kg CO2e per package shipped
};

function calculateFootprint(e) {
  e.preventDefault();
  const car      = parseFloat($('carKm').value)        || 0;
  const flight   = parseFloat($('flightHours').value)  || 0;
  const elec     = parseFloat($('electricityKwh').value)|| 0;
  const meatW    = parseFloat($('meatMeals').value)    || 0;
  const shopping = parseFloat($('shoppingItems').value) || 0;

  const bTransport = car      * CALC_FACTORS.car;
  const bAviation  = flight   * CALC_FACTORS.flight;
  const bEnergy    = elec     * CALC_FACTORS.electric;
  const bDiet      = meatW    * 4.33 * CALC_FACTORS.meatDay / 7; // weekly → monthly meals → daily
  const bShopping  = shopping * CALC_FACTORS.shopping;

  const total = bTransport + bAviation + bEnergy + bDiet + bShopping;

  // Display
  animateNumber('resultValue', total);
  setText('breakTransport', bTransport.toFixed(1) + ' kg');
  setText('breakAviation',  bAviation.toFixed(1)  + ' kg');
  setText('breakEnergy',    bEnergy.toFixed(1)    + ' kg');
  setText('breakDiet',      bDiet.toFixed(1)      + ' kg');
  setText('breakShopping',  bShopping.toFixed(1)  + ' kg');

  const ratingEl = $('resultRating');
  const iconEl   = $('resultIcon');
  let rating, icon, color;

  if (total < 400)        { rating = '🌟 Excellent!'; icon = '🌱'; color = '#22c55e'; }
  else if (total < 700)   { rating = '👍 Good'; icon = '🌿'; color = '#4ade80'; }
  else if (total < 1000)  { rating = '⚠️ Average – room to improve'; icon = '🌤️'; color = '#eab308'; }
  else if (total < 1500)  { rating = '🔴 High – take action'; icon = '🔥'; color = '#f97316'; }
  else                    { rating = '🚨 Very High – urgent change needed'; icon = '💀'; color = '#ef4444'; }

  ratingEl.textContent = rating;
  ratingEl.style.background = color + '22';
  ratingEl.style.color = color;
  if (iconEl) iconEl.textContent = icon;

  // Tips
  const tips = getReductionTips(bTransport, bAviation, bEnergy, bDiet, bShopping);
  const tipEl = $('reductionTips');
  if (tipEl) {
    tipEl.innerHTML = `<h4>💡 Personalised Reduction Tips</h4>` +
      tips.map(t => `<div class="tip-item">${t}</div>`).join('');
  }
}

function getReductionTips(transport, aviation, energy, diet, shopping) {
  const tips = [];
  const max = Math.max(transport, aviation, energy, diet, shopping);
  if (transport === max || transport > 100) tips.push('Switch to an EV or carpool – could cut transport emissions by 50%.');
  if (aviation === max  || aviation > 200)  tips.push('Offset your flights or opt for train travel when possible.');
  if (energy === max    || energy > 50)     tips.push('Switch to a renewable energy tariff and insulate your home.');
  if (diet === max      || diet > 150)      tips.push('Reducing meat to 3 days/week cuts diet emissions by ~40%.');
  if (shopping === max  || shopping > 50)   tips.push('Buy locally and second-hand to reduce delivery & manufacturing emissions.');
  if (tips.length === 0) tips.push('Great job! Keep maintaining your eco-friendly lifestyle.', 'Consider sharing your habits with friends and family!');
  return tips.slice(0, 4);
}

function animateNumber(id, target) {
  const el = $(id);
  if (!el) return;
  let start = parseFloat(el.textContent) || 0;
  const dur = 600;
  const frames = 30;
  const step = (target - start) / frames;
  let f = 0;
  const iv = setInterval(() => {
    f++;
    start += step;
    el.textContent = start.toFixed(1);
    if (f >= frames) { el.textContent = target.toFixed(1); clearInterval(iv); }
  }, dur / frames);
}

// ─── ECO TIPS CAROUSEL ───────────────────────────────────────────────────────

function buildCarousel() {
  const track = $('tipsTrack');
  const dotsEl = $('carouselDots');
  if (!track || !dotsEl) return;

  track.innerHTML = ECO_TIPS.map((tip, i) => `
    <div class="tip-slide ${i === 0 ? 'active' : ''}" role="tabpanel" aria-label="Tip ${i+1}">
      <div class="tip-emoji">${tip.emoji}</div>
      <span class="tip-category">${tip.category}</span>
      <p class="tip-text">${tip.text}</p>
      <span class="tip-impact">🌍 Impact: ${tip.impact}</span>
    </div>
  `).join('');

  dotsEl.innerHTML = ECO_TIPS.map((_, i) => `
    <button class="dot ${i === 0 ? 'active' : ''}" aria-label="Tip ${i+1}" role="tab" data-idx="${i}"></button>
  `).join('');

  dotsEl.querySelectorAll('.dot').forEach(btn => {
    btn.addEventListener('click', () => showTip(parseInt(btn.dataset.idx)));
  });
}

function showTip(idx) {
  const slides = document.querySelectorAll('.tip-slide');
  const dots   = document.querySelectorAll('.dot');
  slides.forEach(s => s.classList.remove('active'));
  dots.forEach(d => d.classList.remove('active'));
  state.tipIndex = (idx + ECO_TIPS.length) % ECO_TIPS.length;
  if (slides[state.tipIndex]) slides[state.tipIndex].classList.add('active');
  if (dots[state.tipIndex])   dots[state.tipIndex].classList.add('active');
}

// ─── NAV HAMBURGER ───────────────────────────────────────────────────────────

function initNav() {
  const burger = $('navHamburger');
  const links  = document.querySelector('.nav-links');
  if (!burger || !links) return;
  burger.addEventListener('click', () => {
    const expanded = burger.getAttribute('aria-expanded') === 'true';
    burger.setAttribute('aria-expanded', String(!expanded));
    links.style.display = expanded ? '' : 'flex';
    links.style.flexDirection = 'column';
    links.style.position = 'absolute';
    links.style.top = '68px';
    links.style.right = '1.25rem';
    links.style.background = 'hsl(220,28%,10%)';
    links.style.padding = '1rem';
    links.style.borderRadius = '12px';
    links.style.border = '1px solid hsl(222,20%,20%)';
    links.style.zIndex = '999';
    if (expanded) links.removeAttribute('style');
  });
}

// ─── HERO PARTICLES ──────────────────────────────────────────────────────────

function spawnParticles() {
  const container = $('heroParticles');
  if (!container) return;
  for (let i = 0; i < 24; i++) {
    const p = document.createElement('div');
    const size = rand(3, 8, 0);
    const x = rand(0, 100, 1);
    const y = rand(0, 100, 1);
    const dur = rand(8, 20, 1);
    const delay = rand(0, 10, 1);
    p.style.cssText = `
      position:absolute;
      width:${size}px; height:${size}px;
      border-radius:50%;
      left:${x}%; top:${y}%;
      background:hsl(145,72%,45%,.${Math.floor(rand(1,4,0))});
      animation: particle-float ${dur}s ${delay}s ease-in-out infinite alternate;
      pointer-events:none;
    `;
    container.appendChild(p);
  }

  // Inject keyframe
  const style = document.createElement('style');
  style.textContent = `
    @keyframes particle-float {
      from { transform: translate(0,0) scale(1); opacity:.6; }
      to   { transform: translate(${rand(-40,40,0)}px, ${rand(-60,60,0)}px) scale(1.4); opacity:.15; }
    }`;
  document.head.appendChild(style);
}

// ─── INIT ────────────────────────────────────────────────────────────────────

function init() {
  // Prime history
  for (let i = 0; i < 20; i++) {
    state.co2History.push(rand(412, 428, 1));
    state.ch4History.push(rand(1895, 1925, 0));
    state.n2oHistory.push(rand(333, 340, 1));
  }

  spawnParticles();
  buildCarousel();
  initNav();
  initThemeToggle();
  initShareModal();
  initPdfBtn();

  // Initial render
  renderAll();

  // Sensor tick
  setInterval(updateSensors, 3000);

  // Tips auto-rotate
  setInterval(() => showTip(state.tipIndex + 1), 5000);

  // Arrow buttons
  const prev = $('prevTip');
  const next = $('nextTip');
  if (prev) prev.addEventListener('click', () => showTip(state.tipIndex - 1));
  if (next) next.addEventListener('click', () => showTip(state.tipIndex + 1));

  // Carbon calculator
  const form = $('carbonForm');
  if (form) {
    form.addEventListener('submit', calculateFootprint);
    // Also compute on input change
    form.addEventListener('input', () => form.dispatchEvent(new Event('submit')));
    // Run once on load
    calculateFootprint(new Event('submit'));
  }

  // Resize: redraw CO2 canvas
  window.addEventListener('resize', () => {
    const c = $('co2Chart');
    if (c) { c.width = c.offsetWidth; co2Ctx = null; }
    drawCO2Chart();
  });

  // City selector → fetch on change
  const citySelect = $('citySelect');
  if (citySelect) {
    citySelect.addEventListener('change', () => fetchLiveData());
    // First fetch on load
    fetchLiveData();
    // Auto-refresh live data every 60 seconds
    setInterval(fetchLiveData, 60_000);
  }
}

// ─── OPEN-METEO API LAYER ────────────────────────────────────────────────────

/** Parse city select value → { lat, lon, name } */
function getSelectedCity() {
  const sel = $('citySelect');
  if (!sel) return null;
  const [lat, lon, name] = sel.value.split(',');
  return { lat: parseFloat(lat), lon: parseFloat(lon), name };
}

/** Set API status badge */
function setApiStatus(status, text) {
  const dot  = $('apiDot');
  const span = $('apiStatusText');
  if (!dot || !span) return;
  dot.className = 'api-dot ' + status; // 'live' | 'error' | 'loading' | ''
  span.textContent = text;
}

/** Fetch real air-quality + weather from Open-Meteo (no API key required) */
async function fetchLiveData() {
  const city = getSelectedCity();
  if (!city) return;

  setApiStatus('loading', `Fetching ${city.name}…`);

  const AQ_URL = `https://air-quality-api.open-meteo.com/v1/air-quality` +
    `?latitude=${city.lat}&longitude=${city.lon}` +
    `&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,ozone,us_aqi` +
    `&timezone=auto`;

  const WX_URL = `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${city.lat}&longitude=${city.lon}` +
    `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,uv_index` +
    `&timezone=auto`;

  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 8000);

    const [aqRes, wxRes] = await Promise.all([
      fetch(AQ_URL, { signal: controller.signal }),
      fetch(WX_URL, { signal: controller.signal }),
    ]);
    clearTimeout(tid);

    if (!aqRes.ok || !wxRes.ok) throw new Error('API response not OK');

    const aq = await aqRes.json();
    const wx = await wxRes.json();

    const c  = aq.current;
    const wc = wx.current;

    // ── Map API values → state ──────────────────────────────────────────────
    // AQI (US AQI scale returned directly by Open-Meteo)
    if (c.us_aqi !== null)         state.aqi      = c.us_aqi;

    // PM2.5 μg/m³
    if (c.pm2_5 !== null)          state.pm25     = c.pm2_5;

    // PM10 μg/m³
    if (c.pm10  !== null)          state.pm10     = c.pm10;

    // NO₂: API returns μg/m³ → convert to ppb (÷ 1.88)
    if (c.nitrogen_dioxide !== null) state.no2    = c.nitrogen_dioxide / 1.88;

    // CO: API returns μg/m³ → convert to ppm (÷ 1145)
    if (c.carbon_monoxide !== null)  state.co     = c.carbon_monoxide / 1145;

    // O₃: API returns μg/m³ → convert to ppb (÷ 2.0)
    if (c.ozone !== null)            state.o3     = c.ozone / 2.0;

    // Weather
    if (wc.temperature_2m !== null)      state.temp     = wc.temperature_2m;
    if (wc.relative_humidity_2m !== null) state.humidity = wc.relative_humidity_2m;
    if (wc.wind_speed_10m !== null)      state.wind     = wc.wind_speed_10m;
    if (wc.uv_index !== null)            state.uv       = wc.uv_index;

    // Update last-updated subtitle
    const sub = document.querySelector('#monitor .section-sub');
    if (sub) sub.textContent =
      `Live data for ${city.name} · Open-Meteo API · Updated ${new Date().toLocaleTimeString()}`;

    setApiStatus('live', `Live · ${city.name}`);
    renderAll();

  } catch (err) {
    console.warn('[EcoSense] API fetch failed, using simulation:', err.message);
    setApiStatus('error', `Offline – using simulation`);

    // Update subtitle to indicate fallback
    const sub = document.querySelector('#monitor .section-sub');
    if (sub) sub.textContent =
      `Simulated data (API unavailable) · ${city.name} · ${new Date().toLocaleTimeString()}`;
  }
}



// ─── THEME TOGGLE (Dark / Light) ─────────────────────────────────────────────

function initThemeToggle() {
  const btn = $('themeToggle');
  if (!btn) return;

  // Restore saved preference
  const saved = localStorage.getItem('ecosense-theme');
  if (saved === 'light') {
    document.body.classList.add('light-mode');
    btn.textContent = '☀️';
    btn.title = 'Switch to Dark Mode';
  }

  btn.addEventListener('click', () => {
    const isLight = document.body.classList.toggle('light-mode');
    btn.textContent = isLight ? '☀️' : '🌙';
    btn.title = isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode';
    localStorage.setItem('ecosense-theme', isLight ? 'light' : 'dark');
  });
}

// ─── QR CODE / SHARE MODAL ───────────────────────────────────────────────────

function initShareModal() {
  const shareBtn   = $('shareBtn');
  const modal      = $('qrModal');
  const closeBtn   = $('qrModalClose');
  const qrImg      = $('qrImage');
  const urlInput   = $('shareUrl');
  const copyBtn    = $('copyUrlBtn');
  if (!shareBtn || !modal) return;

  function openModal() {
    // Use current page URL (works locally as file:// and on Vercel as https://)
    const url = window.location.href.split('#')[0]; // strip hash
    const encoded = encodeURIComponent(url);

    // Generate QR via free API (no key needed)
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encoded}&color=22c55e&bgcolor=ffffff&margin=6`;
    qrImg.alt = `QR Code for ${url}`;
    if (urlInput) urlInput.value = url;

    modal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    closeBtn?.focus();
  }

  function closeModal() {
    modal.setAttribute('hidden', '');
    document.body.style.overflow = '';
    shareBtn?.focus();
  }

  shareBtn.addEventListener('click', openModal);
  closeBtn?.addEventListener('click', closeModal);

  // Close on overlay click
  modal.addEventListener('click', e => {
    if (e.target === modal) closeModal();
  });

  // Close on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !modal.hasAttribute('hidden')) closeModal();
  });

  // Copy URL button
  copyBtn?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(urlInput.value);
      copyBtn.textContent = '✅ Copied!';
      copyBtn.style.background = '#22c55e';
      setTimeout(() => {
        copyBtn.textContent = 'Copy';
        copyBtn.style.background = '';
      }, 2000);
    } catch {
      // Fallback for file:// protocol
      urlInput.select();
      document.execCommand('copy');
      copyBtn.textContent = '✅ Done';
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
    }
  });
}

// ─── PDF DOWNLOAD ─────────────────────────────────────────────────────────────

function initPdfBtn() {
  const btn = $('pdfBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    // Inject print date
    const dateEl = $('printDate');
    if (dateEl) {
      const now = new Date();
      dateEl.textContent =
        `Generated: ${now.toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' })} at ${now.toLocaleTimeString()}`;
    }
    // Small delay ensures canvas frames are rendered
    setTimeout(() => window.print(), 150);
  });
}

// ─── BOOT ────────────────────────────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
