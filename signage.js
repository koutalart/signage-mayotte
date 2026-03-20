/* Mayotte la 1ère — Digital Signage Scripts - VERSION FINALE (20 mars 2026) */

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

// Scaling responsive
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

// Horloge
function updateClock() {
  const n = new Date();
  document.getElementById('clock').textContent = n.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
  document.getElementById('date').textContent = n.toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long'});
}
updateClock();
setInterval(updateClock, 1000);

// Météo
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

    const strip = document.getElementById('meteo-forecast-strip');
    if (strip && m.hourly_temps) {
      strip.innerHTML = '';
      const nowH = new Date().getHours();
      for (let i = 1; i <= 5; i++) {
        const idx = nowH + i;
        if (idx >= m.hourly_temps.length) break;
        const fc = wmoToCondition(m.hourly_codes[idx] || 1);
        const div = document.createElement('div');
        div.className = `mf-item${i === 1 ? ' mf-next' : ''}`;
        div.innerHTML = `<div class="mf-hour">${String(idx % 24).padStart(2,'0')}h</div><div class="mf-icon">${fc.icon}</div><div class="mf-temp" style="color:${fc.color}">${Math.round(m.hourly_temps[idx])}°</div>`;
        strip.appendChild(div);
      }
    }
  } catch(e) { console.error('Météo:', e); }
}

// ARS Santé
async function initARSSlide() {
  try {
    const r = await fetchSafe('./data.json');
    if (!r.ok) return;
    const payload = await r.json();
    const items = (payload.actus_mayotte || []).slice(0, 4);

    const list = document.getElementById('ars-news-list');
    const updEl = document.getElementById('ars-update');
    if (!list) return;
    list.innerHTML = '';

    if (items.length === 0) {
      const fallbacks = [
        {icon:'🦟', titre:'Dengue & Paludisme', desc:'Éliminez les eaux stagnantes. Utilisez moustiquaires et répulsifs.'},
        {icon:'💧', titre:'Eau potable', desc:'Privilégiez l’eau en bouteille pour les nourrissons.'},
        {icon:'🏥', titre:'Urgences', desc:'SAMU 15 • Police 17 • Pompiers 18 • Suicide 3114'}
      ];
      fallbacks.forEach(f => {
        const div = document.createElement('div'); div.className = 'ars-item';
        div.innerHTML = `<span class="ars-icon">${f.icon}</span><div class="ars-text"><div class="ars-title">${f.titre}</div><div class="ars-desc">${f.desc}</div></div>`;
        list.appendChild(div);
      });
      if (updEl) updEl.textContent = '🔄 Informations permanentes ARS Mayotte';
      return;
    }

    items.forEach(it => {
      const div = document.createElement('div'); div.className = 'ars-item';
      div.innerHTML = `<span class="ars-icon">🏥</span><div class="ars-text"><div class="ars-title">${it.title||''}</div><div class="ars-desc">${it.desc ? firstSentence(it.desc) : ''}</div></div>`;
      list.appendChild(div);
    });
    if (updEl) updEl.textContent = `🔄 Mis à jour le ${new Date().toLocaleDateString('fr-FR')}`;
  } catch(e) { console.error('ARS:', e); }
}

// Outre-mer
async function initOutremerSlide() {
  try {
    const r = await fetchSafe('./data.json');
    if (!r.ok) return;
    const payload = await r.json();
    const items = (payload.actus_outremer || []).slice(0, 4);

    const container = document.getElementById('om-items');
    if (!container) return;
    container.innerHTML = '';

    if (items.length === 0) {
      container.innerHTML = `<div class="om-item"><span class="om-icon">🏝️</span><div class="om-text"><div class="om-title">Toute l'actualité des Outre-mer</div><div class="om-desc">Retrouvez tout sur la1ere.franceinfo.fr</div></div></div>`;
      return;
    }

    items.forEach(it => {
      const div = document.createElement('div'); div.className = 'om-item';
      div.innerHTML = `<span class="om-icon">🏝️</span><div class="om-text"><div class="om-title">${it.title}</div><div class="om-desc">${(it.desc||'').substring(0,130)}…</div></div>`;
      container.appendChild(div);
    });
  } catch(e) { console.error('Outre-mer:', e); }
}

// Programme.json
function getJourX(dateDebut) {
  if (!dateDebut) return null;
  try {
    const debut = new Date(dateDebut + 'T00:00:00');
    const today = new Date(); today.setHours(0,0,0,0);
    const j = Math.floor((today - debut) / 86400000) + 1;
    return j > 0 ? j : null;
  } catch(e) { return null; }
}

function renderStory(slideId, story) {
  const slide = document.getElementById(slideId);
  if (!slide) return;
  if (story.data_expires) slide.dataset.expires = story.data_expires;
  if (story.actif === false) { slide.style.display = 'none'; return; }

  const titleEl = slide.querySelector('.slide-title');
  if (titleEl && story.titre) {
    let html = story.titre;
    const j = getJourX(story.compteur_debut);
    if (j) html += `<br>Jour ${j}`;
    titleEl.innerHTML = html;
  }

  if (story.flash && story.flash.length) {
    const fl = slide.querySelector('.flash-list');
    if (fl) {
      fl.innerHTML = '';
      story.flash.forEach(item => {
        const d = document.createElement('div');
        d.className = `flash-item ${slideId === 's7' ? 'ir' : 'i2'}`;
        d.innerHTML = `<span class="fi-icon">${item.icon||'📌'}</span><div><div class="fi-title">${item.titre||''}</div><div class="fi-desc">${item.desc||''}</div></div>`;
        fl.appendChild(d);
      });
    }
  }

  if (story.card_label) {
    const cl = slide.querySelector('.card-label'); if (cl) cl.innerHTML = story.card_label;
  }
  if (story.card_body) {
    const cb = slide.querySelector('.card-body'); if (cb) cb.textContent = story.card_body;
  }
  if (story.source) {
    const src = slide.querySelector('.source-pill'); if (src) src.textContent = story.source;
  }
}

function buildTickerFromProgramme(p) {
  let items = [];
  if (p.stories) {
    Object.values(p.stories).forEach(s => {
      if (s.actif !== false && s.ticker) {
        let t = s.ticker;
        if (s.compteur_debut) {
          const j = getJourX(s.compteur_debut);
          if (j) t = t.replace('{X}', j);
        }
        items.push(t);
      }
    });
  }
  if (p.ticker_extra) items = items.concat(p.ticker_extra);

  const track = document.querySelector('.t-track');
  if (track && items.length) {
    track.innerHTML = items.map(t => `<span class="ti">${t}</span><span class="ts">◆</span>`).join('');
  }
}

async function loadProgramme() {
  try {
    const r = await fetchSafe('./programme.json');
    if (!r.ok) return;
    const p = await r.json();

    document.querySelector('.tb-day').textContent = p.jour || 'VENDREDI';
    document.querySelector('.tb-theme').textContent = p.theme || 'INFO & SOCIÉTÉ';

    const tl = document.querySelector('.ticker-label');
    if (tl && p.jour) tl.innerHTML = `<span class="ticker-dot"></span>${p.jour}`;

    if (p.stories) {
      if (p.stories.iran) renderStory('s7', p.stories.iran);
      if (p.stories.soudan) renderStory('s7b', p.stories.soudan);
      if (p.stories.elections && p.stories.elections.data_expires) {
        ['s3','s4','s5','s6'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.dataset.expires = p.stories.elections.data_expires;
        });
      }
    }
    buildTickerFromProgramme(p);
  } catch(e) { console.error('Programme:', e); }
}

// ==================== INIT GLOBAL ====================
async function initAll() {
  initWeather();
  initARSSlide();
  initOutremerSlide();
  await loadProgramme();

  // Rotation des slides (fonctions de ton ancien code)
  buildRotation();
  showSlide(0);
  scheduleNext();

  console.log('✅ Signage Mayotte La 1ère chargé avec succès');
}

window.onload = initAll;
