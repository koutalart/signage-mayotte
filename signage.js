/* Mayotte la 1ère — Digital Signage Scripts - VERSION FINALE CORRIGÉE (20 mars 2026) */

function stripHtml(html) {
  var tmp = document.createElement('div'); tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}
function firstSentence(text, max = 140) {
  text = text.replace(/\s+/g, ' ').trim();
  var cut = text.indexOf('. ');
  if (cut > 20 && cut < max) return text.substring(0, cut + 1);
  return text.substring(0, max) + (text.length > max ? '…' : '');
}

function fetchSafe(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; reject(new Error('timeout')); } }, timeoutMs);
    fetch(url).then(r => {
      if (!done) { done = true; clearTimeout(timer); resolve(r); }
    }).catch(e => {
      if (!done) { done = true; clearTimeout(timer); reject(e); }
    });
  });
}

// ==================== SCALING RESPONSIVE ====================
function initScale() {
  const app = document.getElementById('app');
  if (!app) return;
  const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
  const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
  const scale = Math.min(vw / 1080, vh / 1920) || 1;
  app.style.transform = `scale(${scale})`;
  app.style.marginLeft = `${(vw - 1080 * scale) / 2}px`;
  app.style.marginTop  = `${(vh - 1920 * scale) / 2}px`;
}
window.addEventListener('load', initScale);
window.addEventListener('resize', initScale);
setTimeout(initScale, 300);

// ==================== HORLOGE ====================
function updateClock() {
  const n = new Date();
  document.getElementById('clock').textContent = n.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
  document.getElementById('date').textContent = n.toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long'});
}
updateClock();
setInterval(updateClock, 1000);

// ==================== MÉTÉO ====================
function wmoToCondition(code) {
  if (code === 0) return {icon:'☀️', label:'Ensoleillé', color:'#FFD740'};
  if (code <= 2)  return {icon:'⛅', label:'Partiellement nuageux', color:'#81D4FA'};
  if (code <= 48) return {icon:'☁️', label:'Nuageux', color:'#90A4AE'};
  if (code <= 82) return {icon:'🌧️', label:'Pluie', color:'#64B5F6'};
  return {icon:'⛈️', label:'Orageux', color:'#CE93D8'};
}

async function initWeather() {
  try {
    const r = await fetchSafe('./data.json');
    if (!r.ok) return;
    const m = (await r.json()).meteo || {};

    const cur = {
      temp: m.temp || 28,
      feels: m.feels || 31,
      wind: m.wind || 18,
      humidity: m.humidity || 78,
      precipitation: typeof m.precipitation === 'number' ? m.precipitation : 0,
      weathercode: (m.hourly_codes && m.hourly_codes[0]) ? m.hourly_codes[0] : 1
    };

    const cond = wmoToCondition(cur.weathercode);

    document.getElementById('meteo-big-icon').textContent = cond.icon;
    const tempEl = document.getElementById('meteo-big-temp');
    if (tempEl) {
      tempEl.textContent = Math.round(cur.temp) + '°';
      tempEl.style.color = cond.color;
    }
    document.getElementById('meteo-cond-txt').textContent = cond.label;
    document.getElementById('meteo-feels').textContent = `Ressenti ${Math.round(cur.feels)}°C`;
    document.getElementById('meteo-wind').textContent = Math.round(cur.wind);
    document.getElementById('meteo-hum').textContent = Math.round(cur.humidity) + '%';
    document.getElementById('meteo-rain').textContent = cur.precipitation.toFixed(1);

    // Prévisions horaires
    const strip = document.getElementById('meteo-forecast-strip');
    if (strip && m.hourly_temps) {
      strip.innerHTML = '';
      const nowH = new Date().getHours();
      for (let i = 1; i <= 5; i++) {
        const idx = nowH + i;
        if (idx >= m.hourly_temps.length
