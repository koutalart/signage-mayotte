/* Mayotte la 1ère — Digital Signage Scripts */
// ══ UTILITAIRES GLOBAUX (accessibles à toutes les sections) ══
function stripHtml(html) {
  var tmp=document.createElement('div'); tmp.innerHTML=html;
  return tmp.textContent||tmp.innerText||'';
}
function firstSentence(text,max) {
  text=text.replace(/\s+/g,' ').trim();
  var cut=text.indexOf('. ');
  if(cut>20&&cut<max) return text.substring(0,cut+1);
  return text.substring(0,max)+(text.length>max?'…':'');
}

// ── Fetch avec timeout (évite le blocage réseau) ──
function fetchSafe(url, options, timeoutMs) {
  timeoutMs = timeoutMs || 6000;
  return new Promise(function(resolve, reject) {
    var done = false;
    var timer = setTimeout(function() {
      if (!done) { done = true; reject(new Error('timeout')); }
    }, timeoutMs);
    fetch(url, options || {}).then(function(r) {
      if (!done) { done = true; clearTimeout(timer); resolve(r); }
    }).catch(function(e) {
      if (!done) { done = true; clearTimeout(timer); reject(e); }
    });
  });
}


try {
  // ══ RESPONSIVE SCALING ══
  function initScale() {
    var app = document.getElementById('app');
    if (!app) return;
    var vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
    var vw = Math.max(document.documentElement.clientWidth  || 0, window.innerWidth  || 0);
    // Guard : si le viewport n'est pas encore disponible, on attend
    if (!vw || !vh || vw < 10 || vh < 10) return;
    var scale = Math.min(vw / 1080, vh / 1920);
    // Guard : ne jamais scaler à 0 ou une valeur invalide → contenu invisible
    if (!scale || scale <= 0 || !isFinite(scale)) scale = 1;
    app.style.transform = 'scale(' + scale + ')';
    app.style.marginLeft = ((vw - 1080 * scale) / 2) + 'px';
    app.style.marginTop  = ((vh - 1920 * scale) / 2) + 'px';
  }
  window.addEventListener('load', initScale);
  window.addEventListener('resize', initScale);
  // Tentative immédiate + retry si viewport pas encore disponible
  initScale();
  setTimeout(initScale, 200);
  setTimeout(initScale, 800);
} catch(e) { console.error('Scale:', e); }

try {
  // ══ HORLOGE ══
  function updateClock() {
    var n = new Date();
    document.getElementById('clock').textContent =
      n.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
    document.getElementById('date').textContent =
      n.toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long'});
  }
  updateClock(); setInterval(updateClock, 1000);
} catch(e) {}


try {
  // ══ MÉTÉO — Les Hauts Vallons, Kawéni, Mamoudzou ══
  function wmoToCondition(code) {
    if (code===0)  return {cond:'sunny',        icon:'☀️',  label:'Ensoleillé',            color:'#FFD740'};
    if (code<=2)   return {cond:'partly-cloudy',icon:'⛅',  label:'Partiellement nuageux', color:'#81D4FA'};
    if (code<=48)  return {cond:'cloudy',       icon:'☁️',  label:'Nuageux',               color:'#90A4AE'};
    if (code<=82)  return {cond:'rainy',        icon:'🌧️', label:'Pluie',                 color:'#64B5F6'};
    return                {cond:'stormy',       icon:'⛈️', label:'Orageux',               color:'#CE93D8'};
  }

  async function initWeather() {
    try {
      // Lit data.json généré par GitHub Actions (météo pré-fetchée côté serveur)
      var r = await fetchSafe('./data.json');
      if(!r.ok) return;
      var payload = await r.json();
      if(!payload.meteo || !payload.meteo.temp) return;
      var m = payload.meteo;
      var data = { current: { temperature_2m: m.temp, weathercode: (m.condition==='Ensoleillé'?0:m.condition==='Partiellement nuageux'?1:m.condition==='Nuageux'?3:m.condition==='Pluie'?61:95), windspeed_10m: m.wind, relativehumidity_2m: m.humidity, apparent_temperature: m.feels }, hourly: { temperature_2m: m.hourly_temps||[], weathercode: m.hourly_codes||[] } };
      var cur  = data.current;
      var cond = wmoToCondition(cur.weathercode);

      // Mise à jour
      var elIcon  = document.getElementById('meteo-big-icon');
      var elTemp  = document.getElementById('meteo-big-temp');
      var elCond  = document.getElementById('meteo-cond-txt');
      var elFeels = document.getElementById('meteo-feels');
      var elWind  = document.getElementById('meteo-wind');
      var elHum   = document.getElementById('meteo-hum');
      var elRain  = document.getElementById('meteo-rain');

      if(elIcon)  elIcon.textContent  = cond.icon;
      if(elTemp)  { elTemp.textContent = Math.round(cur.temperature_2m)+'°'; elTemp.style.color=cond.color; }
      // Ajouter UV si disponible
      var uvTxt = (cur.uv_index!==undefined) ? ' · UV '+Math.round(cur.uv_index) : '';
      if(elCond)  elCond.textContent  = cond.label + uvTxt;
      if(elFeels) elFeels.textContent = 'Ressenti '+Math.round(cur.apparent_temperature)+'°C';
      if(elWind)  elWind.textContent  = Math.round(cur.windspeed_10m);
      if(elHum)   elHum.textContent   = Math.round(cur.relativehumidity_2m)+'%';
      if(elRain)  elRain.textContent  = cur.precipitation.toFixed(1);

      // ── Prévisions horaires (prochaines 5h) ──
      var strip=document.getElementById('meteo-forecast-strip');
      if(strip&&data.hourly){
        strip.innerHTML='';
        var nowH=new Date().getHours();
        for(var hi=1;hi<=5;hi++){
          var idx=nowH+hi;
          if(idx>=data.hourly.time.length) break;
          var fc=wmoToCondition(data.hourly.weathercode[idx]);
          var div=document.createElement('div');
          div.className='mf-item'+(hi===1?' mf-next':'');
          var hStr=String(idx%24).padStart(2,'0')+'h';
          div.innerHTML='<div class="mf-hour">'+hStr+'</div>'
            +'<div class="mf-icon">'+fc.icon+'</div>'
            +'<div class="mf-temp" style="color:'+fc.color+';">'+Math.round(data.hourly.temperature_2m[idx])+'°</div>';
          strip.appendChild(div);
        }
      }
    } catch(e){ console.error('Weather fetch:',e); }
  }


  initWeather();
  setInterval(initWeather, 3600000); // Actualisation toutes les heures
} catch(e){ console.error('Weather:',e); }

try {
  // ══ ARS RSS — résumé + codes couleur de gravité ══
  var arsIconMap={drogue:'💊',vaccin:'💉',paludisme:'🦟',dengue:'🦟',moustique:'🦟',
    urgence:'🚑',samu:'🚑','épidémie':'🌡️',epidemie:'🌡️',cholera:'🌡️','choléra':'🌡️',
    alerte:'⚠️',intoxication:'☣️',cancer:'🎗️',cancer:'🎗️'};

  // Niveaux de gravité : critique (rouge) → alerte (orange) → normal (vert)
  var ARS_SEV = {
    critique: {
      keys:['epidemie','épidémie','cholera','choléra','urgence','alerte','contamination',
            'intoxication','danger','mortel','mortelle','critique','épidémique','epidémique'],
      border:'#B71C1C', bg:'rgba(183,28,28,0.13)'
    },
    alerte: {
      keys:['paludisme','dengue','moustique','surveillance','risque','cas suspect',
            'vaccination','prévention','prevention','recrudescence'],
      border:'#E65100', bg:'rgba(230,81,0,0.10)'
    },
    normal: { border:'#2E7D32', bg:'rgba(46,125,50,0.08)' }
  };
  function getArsSev(text){
    var t=text.toLowerCase();
    var i;
    for(i=0;i<ARS_SEV.critique.keys.length;i++) if(t.includes(ARS_SEV.critique.keys[i])) return 'critique';
    for(i=0;i<ARS_SEV.alerte.keys.length;i++) if(t.includes(ARS_SEV.alerte.keys[i])) return 'alerte';
    return 'normal';
  }

  async function initARSSlide() {
    try {
      var r=await fetchSafe('./data.json');
      if(!r.ok) return;
      var xml=await r.text();
      var doc=(new DOMParser()).parseFromString(xml,'text/xml');
      var items=Array.from(doc.querySelectorAll('item')).slice(0,3);
      var list=document.getElementById('ars-news-list');
      var updEl=document.getElementById('ars-update');
      if(!list) return;
      list.innerHTML='';
      var hasAlert=false;
      items.forEach(function(item){
        var rawT=(item.querySelector('title')||{}).textContent||'';
        var rawD=(item.querySelector('description')||{}).textContent||'';
        var t=stripHtml(rawT).trim(); var d=stripHtml(rawD).trim();
        var summary=firstSentence(d,140);
        if(!summary||summary.length<20) summary=d.substring(0,140)+'…';
        var combo=(t+' '+d).toLowerCase();
        var sev=getArsSev(combo);
        if(sev==='critique') hasAlert=true;
        var icon='🏥';
        for(var k in arsIconMap){if(combo.includes(k)){icon=arsIconMap[k];break;}}
        var s=ARS_SEV[sev];
        var div=document.createElement('div'); div.className='ars-item';
        div.style.borderLeftColor=s.border; div.style.background=s.bg;
        div.innerHTML='<span class="ars-icon">'+icon+'</span>'
          +'<div class="ars-text">'
            +'<div class="ars-title">'+t+'</div>'
            +'<div class="ars-desc">'+summary+'</div>'
          +'</div>';
        list.appendChild(div);
      });
      if(updEl){ var td=new Date(); updEl.textContent='🔄 MÀJ '+td.toLocaleDateString('fr-FR',{day:'numeric',month:'long'}); }
      if(hasAlert){ var inst=document.querySelector('#s1 .inst-slide'); if(inst) inst.classList.add('ars-alert'); }
    } catch(e){ console.error('ARS fetch:',e); }
  }
  initARSSlide();
} catch(e){ console.error('ARS init:',e); }

try {
  // ══ ACTUS RSS — injectées avant s3 ══
  async function initActusSlides() {
    try {
      var r=await fetchSafe('./data.json');
      if(!r.ok) return;
      var xml=await r.text();
      var doc=(new DOMParser()).parseFromString(xml,'text/xml');
      var items=Array.from(doc.querySelectorAll('item')).slice(0,5);
      var wrap=document.getElementById('slides-wrap');
      var s3El=document.getElementById('s3');
      var iMap={politique:'🏛️',president:'🏛️',sante:'🏥',hopital:'🏥',
                environnement:'🌊',eau:'🌊',sport:'⚽',football:'⚽',culture:'🎭',international:'🌍'};
      items.forEach(function(item){
        var title=(item.querySelector('title')||{}).textContent||'';
        var rawDesc=(item.querySelector('description')||{}).textContent||'';
        if(!title.trim()) return;
        // Extraire l'image AVANT de stripper le HTML
        var tmpImg=document.createElement('div'); tmpImg.innerHTML=rawDesc;
        var firstImg=tmpImg.querySelector('img');
        var imgSrc=firstImg?firstImg.getAttribute('src'):'';
        if(!imgSrc){
          var enc=item.querySelector('enclosure');
          if(enc&&(enc.getAttribute('type')||'').startsWith('image')) imgSrc=enc.getAttribute('url')||'';
        }
        var cleanTitle=stripHtml(title).trim();
        var cleanDesc=stripHtml(rawDesc).trim();
        var combo=(cleanTitle+' '+cleanDesc).toLowerCase(); var icon='📰';
        for(var k in iMap){if(combo.includes(k)){icon=iMap[k];break;}}
        var slide=document.createElement('div');
        slide.className='slide actu-slide';
        slide.dataset.duration='15000';
        var mediaHtml=imgSrc
          ? '<div class="actu-img-wrap"><img class="actu-img" src="'+imgSrc+'" alt="" onerror="this.parentNode.remove()"></div>'
          : '<div class="actu-icon">'+icon+'</div>';
        slide.innerHTML=
          '<div class="actu-progress"><div class="actu-progress-fill"></div></div>'
          +'<span class="actu-badge">📰 Actualité Mayotte</span>'
          +mediaHtml
          +'<h3 class="actu-title">'+cleanTitle+'</h3>'
          +'<div class="actu-line"></div>'
          +'<div class="actu-body">'+cleanDesc+'</div>'
          +'<div class="actu-source">France Info · Mayotte la 1ère · la1ere.franceinfo.fr</div>';
        wrap.insertBefore(slide, s3El);
      });
    } catch(e){ console.error('Actus fetch:',e); }
  }
  initActusSlides();
} catch(e){ console.error('Actus init:',e); }

try {
  // ══ OUTRE-MER — proxy local (./news.php) ══
  async function initOutremerSlide() {
    try {
      // Proxy local — kamili.yt fetche francetvinfo côté serveur
      var r=await fetchSafe('./data.json');
      var parsed=await r.json();
      var items=null;
      if(parsed&&parsed.items&&parsed.items.length>0){
        // Convertir au format attendu
        items=parsed.items.slice(0,4).map(function(it){
          return {title:it.title,description:it.desc,enclosure:{link:it.img||''}};
        });
      }
      if(!items||items.length===0) return;
      var omList=document.getElementById('om-items');
      if(!omList) return;
      omList.innerHTML='';
      var territories=['Mayotte','Martinique','Guadeloupe','Réunion','Guyane','Polynésie','Nouvelle-Calédonie','Saint-Martin','Wallis'];
      var omIcons={'Mayotte':'🏝️','Martinique':'🌺','Guadeloupe':'🌿','Réunion':'🌋','Guyane':'🌿','Polynésie':'🌊','Nouvelle-Calédonie':'⚓','default':'🏝️'};
      items.forEach(function(it){
        var title=stripHtml(it.title||'').trim();
        var desc=stripHtml(it.description||'').trim();
        if(!title) return;
        var cleanDesc=desc.substring(0,130)+(desc.length>130?'…':'');
        var territory=''; var combo=title+' '+desc;
        territories.forEach(function(t){if(combo.includes(t)&&!territory)territory=t;});
        var icon=omIcons[territory]||omIcons.default;
        var div=document.createElement('div'); div.className='om-item';
        div.innerHTML='<span class="om-icon">'+icon+'</span>'
          +'<div class="om-text">'
            +'<div class="om-title">'+title+'</div>'
            +(cleanDesc?'<div class="om-desc">'+cleanDesc+'</div>':'')
            +(territory?'<div class="om-territory">📍 '+territory+'</div>':'')
          +'</div>';
        omList.appendChild(div);
      });
      var srcEl=document.getElementById('om-source');
      if(srcEl) srcEl.textContent='France Info · La 1ère · francetvinfo.fr';
    } catch(e){ console.error('Outremer fetch:',e); }
  }
  initOutremerSlide();
} catch(e){ console.error('Outremer init:',e); }

try {
  // ══ INTERNATIONAL IRAN — Mise à jour quotidienne RSS ══
  async function initIranSlide() {
    try {
      // Proxy local — kamili.yt fetche francetvinfo côté serveur
      var r2=await fetchSafe('./data.json');
      var natData=await r2.json();
      if(!natData||!natData.items||natData.items.length===0) return;
      // Simuler un doc XML avec les items JSON
      var doc=null; // skip XML parsing — on utilise natData.items directement
      var iranItems=Array.from(doc.querySelectorAll('item')).filter(function(item){
        var t=(item.querySelector('title')||{}).textContent||'';
        var d=(item.querySelector('description')||{}).textContent||'';
        return (t+' '+d).toLowerCase().includes('iran');
      }).slice(0,3);
      if(iranItems.length===0) return; // Pas de news Iran : on garde le statique
      var flashList=document.querySelector('#s7 .flash-list');
      if(!flashList) return;
      flashList.innerHTML='';
      iranItems.forEach(function(item){
        var title=stripHtml((item.querySelector('title')||{}).textContent||'').trim();
        var desc=stripHtml((item.querySelector('description')||{}).textContent||'').trim();
        var summary=firstSentence(desc,130);
        if(!summary||summary.length<10) summary=desc.substring(0,130)+'…';
        var div=document.createElement('div'); div.className='flash-item ir';
        div.innerHTML='<span class="fi-icon">🌍</span>'
          +'<div><div class="fi-title">'+title+'</div>'
          +'<div class="fi-desc">'+summary+'</div></div>';
        flashList.appendChild(div);
      });
      var srcEl=document.querySelector('#s7 .source-pill');
      if(srcEl){ var today=new Date(); srcEl.textContent='France Info · France Télévisions — '+today.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}); }
    } catch(e){ console.error('Iran fetch:',e); }
  }
  initIranSlide();
} catch(e){ console.error('Iran init:',e); }

try {
  // ══ RADIO GRILLE — 2ème slide dynamique ══
  var RADIO_GRID_DATA = [
    { id:'rg-0', start:5,  end:6,  name:'Réveil Mayotte',   desc:'Démarrage en douceur · Ambiance et musique',     icon:'🌅', color:'#FFECB3', days:'Lun–Ven' },
    { id:'rg-1', start:6,  end:9,  name:'Mayotte Matin',    desc:'La matinale · Actu, météo, sport',               icon:'☀️', color:'#FFD740', days:'Lun–Ven' },
    { id:'rg-2', start:9,  end:12, name:'La Matinée',       desc:'Magazines, culture, interviews et reportages',   icon:'🎙️', color:'#81D4FA', days:'Quotidien' },
    { id:'rg-3', start:12, end:14, name:'Journal de Midi',  desc:"L'actualité complète de la mi-journée",          icon:'📰', color:'#0082E6', days:'Quotidien' },
    { id:'rg-4', start:14, end:18, name:"L'Après-Midi",     desc:'Musique, invités, événements et culture locale',  icon:'🎵', color:'#CE93D8', days:'Quotidien' },
    { id:'rg-5', start:18, end:21, name:'Journal du Soir',  desc:'Résumé de la journée · Lun–Ven à 18h00',         icon:'🌙', color:'#FFAB40', days:'Lun–Ven' },
    { id:'rg-6', start:21, end:5,  name:'Nuit sur la 1ère', desc:'Musique, rediffusions et archives',               icon:'🌟', color:'#7986CB', days:'Quotidien' }
  ];

  function buildRadioGrid() {
    var grid=document.getElementById('rg-grid');
    if(!grid) return;
    grid.innerHTML='';
    RADIO_GRID_DATA.forEach(function(prog){
      var div=document.createElement('div');
      div.className='rg-item'; div.id=prog.id;
      var sh=String(prog.start).padStart(2,'0')+'h00';
      var eh=String(prog.end).padStart(2,'0')+'h00';
      div.innerHTML=
        '<div class="rg-color-strip" style="background:'+prog.color+';"></div>'
        +'<div class="rg-inner">'
          +'<span class="rg-icon">'+prog.icon+'</span>'
          +'<div class="rg-time-col">'
            +'<div class="rg-time" style="color:'+prog.color+';">'+sh+'</div>'
            +'<div class="rg-time-end">→ '+eh+'</div>'
          +'</div>'
          +'<div class="rg-info">'
            +'<div class="rg-name">'+prog.name+'</div>'
            +'<div class="rg-desc">'+prog.desc+'</div>'
          +'</div>'
          +'<span class="rg-days">'+prog.days+'</span>'
        +'</div>'
        +'<div class="rg-live-badge">⚡ EN DIRECT</div>'
        +'<div class="rg-progress"></div>';
      grid.appendChild(div);
    });
  }

  function updateRadioGrid() {
    var now=new Date(); var h=now.getHours(); var m=now.getMinutes();
    // Mise à jour du label du jour
    var lbl=document.getElementById('rg-day-label');
    if(lbl){
      var JOURS_G=['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
      lbl.textContent=JOURS_G[now.getDay()]+' — Mayotte la 1ère Radio';
    }
    RADIO_GRID_DATA.forEach(function(prog){
      var el=document.getElementById(prog.id);
      if(!el) return;
      var inSlot=prog.start<prog.end?(h>=prog.start&&h<prog.end):(h>=prog.start||h<prog.end);
      if(inSlot){
        el.classList.add('rg-current');
        var slotDur=prog.start<prog.end?(prog.end-prog.start):(24-prog.start+prog.end);
        var elapsed=h>=prog.start?(h-prog.start+m/60):(24-prog.start+h+m/60);
        var pct=Math.min(99,Math.round((elapsed/slotDur)*100));
        var bar=el.querySelector('.rg-progress');
        if(bar) bar.style.width=pct+'%';
      } else {
        el.classList.remove('rg-current');
      }
    });
  }

  buildRadioGrid();
  updateRadioGrid();
  setInterval(updateRadioGrid, 60000); // Mise à jour chaque minute
} catch(e){ console.error('Radio grid:',e); }

try {
/* ══════════════════════════════════════════════
   S0 — INTRO : HORLOGE LARGE + FÊTE + RÉSUMÉ
   Auto-refresh à chaque heure pile
══════════════════════════════════════════════ */

  // ── Fête du jour (calendrier français des saints) ──
  var FETES = {
    "01-01":"Jour de l'An","01-02":"Basile","01-03":"Geneviève","01-04":"Odilon","01-05":"Édouard",
    "01-06":"Melchior","01-07":"Raymond","01-08":"Lucien","01-09":"Alix","01-10":"Guillaume",
    "01-11":"Paulin","01-12":"Tatiana","01-13":"Yvette","01-14":"Nina","01-15":"Rémi",
    "01-16":"Marcel","01-17":"Roseline","01-18":"Prisca","01-19":"Marius","01-20":"Sébastien",
    "01-21":"Agnès","01-22":"Vincent","01-23":"Barnard","01-24":"François de Sales","01-25":"Conversion de Paul",
    "01-26":"Timothée","01-27":"Angèle","01-28":"Thomas d'Aquin","01-29":"Gildas","01-30":"Martine",
    "01-31":"Marcelle",
    "02-01":"Ella","02-02":"Présentation","02-03":"Blaise","02-04":"Véronique","02-05":"Agathe",
    "02-06":"Gaston","02-07":"Eugénie","02-08":"Jacqueline","02-09":"Apolline","02-10":"Arnaud",
    "02-11":"N.-D. de Lourdes","02-12":"Félix","02-13":"Béatrice","02-14":"Valentin","02-15":"Claude",
    "02-16":"Julienne","02-17":"Alexis","02-18":"Bernadette","02-19":"Gabin","02-20":"Aimée",
    "02-21":"Damien","02-22":"Isabelle","02-23":"Lazare","02-24":"Modeste","02-25":"Roméo",
    "02-26":"Nestor","02-27":"Honorine","02-28":"Romain","02-29":"Auguste",
    "03-01":"Aubin","03-02":"Charles le Bon","03-03":"Guénolé","03-04":"Casimir","03-05":"Olive",
    "03-06":"Colette","03-07":"Félicité","03-08":"Jean de Dieu","03-09":"Françoise","03-10":"Vivien",
    "03-11":"Rosine","03-12":"Justine","03-13":"Rodrigue","03-14":"Mathilde","03-15":"Louise",
    "03-16":"Bénédicte","03-17":"Patrick","03-18":"Cyrille","03-19":"Joseph","03-20":"Herbert",
    "03-21":"Clémence","03-22":"Léa","03-23":"Victorien","03-24":"Cath. de Suède","03-25":"Annonciation",
    "03-26":"Larissa","03-27":"Habib","03-28":"Gontran","03-29":"Gwladys","03-30":"Amédée",
    "03-31":"Benjamin",
    "04-01":"Hugues","04-02":"Sandrine","04-03":"Richard","04-04":"Isidore","04-05":"Irène",
    "04-06":"Marcellin","04-07":"Jean-Baptiste de la Salle","04-08":"Julie","04-09":"Gautier","04-10":"Fulbert",
    "04-11":"Stanislas","04-12":"Jules","04-13":"Ida","04-14":"Maxime","04-15":"Paterne",
    "04-16":"Benoît-Joseph","04-17":"Anicet","04-18":"Parfait","04-19":"Emma","04-20":"Odette",
    "04-21":"Anselme","04-22":"Alexandre","04-23":"Georges","04-24":"Fidèle","04-25":"Marc",
    "04-26":"Alida","04-27":"Zita","04-28":"Valérie","04-29":"Catherine de Sienne","04-30":"Robert",
    "05-01":"Fête du Travail","05-02":"Boris","05-03":"Philippe","05-04":"Sylvain","05-05":"Judith",
    "05-06":"Prudence","05-07":"Gisèle","05-08":"Victoire 1945","05-09":"Pacôme","05-10":"Isidore",
    "05-11":"Estelle","05-12":"Achille","05-13":"Rolande","05-14":"Matthias","05-15":"Denise",
    "05-16":"Honoré","05-17":"Pascal","05-18":"Éric","05-19":"Yves","05-20":"Bernardin",
    "05-21":"Constantin","05-22":"Rita","05-23":"Didier","05-24":"Donatien","05-25":"Sophie",
    "05-26":"Bérenger","05-27":"Augustin de Canterbury","05-28":"Germain","05-29":"Aymar","05-30":"Ferdinand",
    "05-31":"Visitation",
    "06-01":"Justin","06-02":"Blandine","06-03":"Kévin","06-04":"Clotilde","06-05":"Igor",
    "06-06":"Norbert","06-07":"Gilbert","06-08":"Médard","06-09":"Diane","06-10":"Landry",
    "06-11":"Barnabé","06-12":"Guy","06-13":"Antoine de Padoue","06-14":"Élisée","06-15":"Germaine",
    "06-16":"François Régis","06-17":"Hervé","06-18":"Léonce","06-19":"Romuald","06-20":"Silvère",
    "06-21":"Rodolphe","06-22":"Alban","06-23":"Audrey","06-24":"Jean-Baptiste","06-25":"Prosper",
    "06-26":"Anthelme","06-27":"Fernand","06-28":"Irénée","06-29":"Pierre & Paul","06-30":"Martial",
    "07-01":"Thierry","07-02":"Martinien","07-03":"Thomas","07-04":"Florent","07-05":"Antoine",
    "07-06":"Mariette","07-07":"Raoul","07-08":"Thibaut","07-09":"Amandine","07-10":"Ulrich",
    "07-11":"Benoît","07-12":"Olivier","07-13":"Henri","07-14":"Fête Nationale","07-15":"Donald",
    "07-16":"N.-D. du Carmel","07-17":"Charlotte","07-18":"Frédéric","07-19":"Arsène","07-20":"Marina",
    "07-21":"Victor","07-22":"Marie-Madeleine","07-23":"Brigitte","07-24":"Christine","07-25":"Jacques",
    "07-26":"Anne & Joachim","07-27":"Nathalie","07-28":"Samson","07-29":"Marthe","07-30":"Juliette",
    "07-31":"Ignace de Loyola",
    "08-01":"Alphonse","08-02":"Julien Eymard","08-03":"Lydie","08-04":"Jean-Marie Vianney","08-05":"Abel",
    "08-06":"Transfiguration","08-07":"Gaétan","08-08":"Dominique","08-09":"Amour","08-10":"Laurent",
    "08-11":"Claire","08-12":"Clarisse","08-13":"Hippolyte","08-14":"Evrard","08-15":"Assomption",
    "08-16":"Armel","08-17":"Hyacinthe","08-18":"Hélène","08-19":"Jean-Eudes","08-20":"Bernard",
    "08-21":"Christophe","08-22":"Fabrice","08-23":"Rose de Lima","08-24":"Barthélémy","08-25":"Louis",
    "08-26":"Natacha","08-27":"Monique","08-28":"Augustin","08-29":"Sabine","08-30":"Fiacre",
    "08-31":"Aristide",
    "09-01":"Gilles","09-02":"Ingrid","09-03":"Grégoire le Grand","09-04":"Rosalie","09-05":"Raïssa",
    "09-06":"Bertrand","09-07":"Reine","09-08":"Nativité de Marie","09-09":"Alain","09-10":"Inès",
    "09-11":"Adelphe","09-12":"Apollinaire","09-13":"Aimé","09-14":"La Sainte Croix","09-15":"Roland",
    "09-16":"Edith","09-17":"Renaud","09-18":"Nadège","09-19":"Émilie","09-20":"Davy",
    "09-21":"Matthieu","09-22":"Maurice","09-23":"Constance","09-24":"Thècle","09-25":"Hermann",
    "09-26":"Côme & Damien","09-27":"Vinvent de Paul","09-28":"Venceslas","09-29":"Michel","09-30":"Jérôme",
    "10-01":"Thérèse de l'Enfant-Jésus","10-02":"Léger","10-03":"Gérard","10-04":"François d'Assise","10-05":"Fleur",
    "10-06":"Bruno","10-07":"Serge","10-08":"Pélagie","10-09":"Denis","10-10":"Ghislain",
    "10-11":"Firmin","10-12":"Wilfrid","10-13":"Géraud","10-14":"Juste","10-15":"Thérèse d'Avila",
    "10-16":"Edwige","10-17":"Ignace d'Antioche","10-18":"Luc","10-19":"René","10-20":"Adeline",
    "10-21":"Céline","10-22":"Élodie","10-23":"Jean de Capistran","10-24":"Florentin","10-25":"Crépin",
    "10-26":"Dimitri","10-27":"Émeline","10-28":"Simon & Jude","10-29":"Narcisse","10-30":"Bienvenu",
    "10-31":"Quentin",
    "11-01":"Toussaint","11-02":"Défunts","11-03":"Hubert","11-04":"Charles Borromée","11-05":"Sylvie",
    "11-06":"Bertille","11-07":"Carine","11-08":"Geoffrey","11-09":"Théodore","11-10":"Léon",
    "11-11":"Armistice","11-12":"Christian","11-13":"Brice","11-14":"Sidoine","11-15":"Albert",
    "11-16":"Marguerite d'Écosse","11-17":"Élisabeth de Hongrie","11-18":"Aude","11-19":"Tanguy","11-20":"Edmond",
    "11-21":"Présentation de Marie","11-22":"Cécile","11-23":"Clément","11-24":"Flora","11-25":"Catherine",
    "11-26":"Delphine","11-27":"Séverin","11-28":"Jacques de la Marche","11-29":"Saturnin","11-30":"André",
    "12-01":"Florence","12-02":"Viviane","12-03":"François-Xavier","12-04":"Barbara","12-05":"Gérald",
    "12-06":"Nicolas","12-07":"Ambroise","12-08":"Immaculée Conception","12-09":"Pierre Fourier","12-10":"Romaric",
    "12-11":"Daniel","12-12":"Jeanne de Chantal","12-13":"Lucie","12-14":"Odile","12-15":"Ninon",
    "12-16":"Alice","12-17":"Gaël","12-18":"Gatien","12-19":"Urbain","12-20":"Abraham",
    "12-21":"Pierre Canisius","12-22":"Françoise-Xavière","12-23":"Armand","12-24":"Adèle","12-25":"Noël",
    "12-26":"Étienne","12-27":"Jean","12-28":"Innocents","12-29":"David","12-30":"Roger",
    "12-31":"Sylvestre"
  };

  function getFete() {
    var n = new Date();
    var mm = String(n.getMonth()+1).padStart(2,'0');
    var dd = String(n.getDate()).padStart(2,'0');
    return FETES[mm+'-'+dd] || '';
  }

  // ── Résumé des slides actives ──
  var TOPICS = [
    { id:'s1',      icon:'🏥', label:'Santé' },
    { id:'s2',      icon:'🌤️', label:'Météo' },
    { id:'s3',      icon:'🗳️', label:'Élections' },
    { id:'s4',      icon:'🗳️', label:'Communes' },
    { id:'s5',      icon:'🗳️', label:'Sud Mayotte' },
    { id:'s6',      icon:'📋', label:'Après le vote' },
    { id:'s7',      icon:'🌍', label:'International' },
    { id:'s7b',     icon:'🌍', label:'Soudan' },
    { id:'s7c',     icon:'🏝️', label:'Outre-mer' },
    { id:'s-radio', icon:'📻', label:'Radio' },
    { id:'s-radio2',icon:'📻', label:'Grille Radio' },
    { id:'s-rdv',   icon:'📺', label:'Rendez-vous TV' },
    { id:'s-colocs', icon:'🎬', label:'Colocs S3' },
    { id:'s9',      icon:'👋', label:'Bonne semaine' }
  ];

  function buildIntroTopics() {
    var container = document.getElementById('intro-topics');
    if (!container) return;
    var now = new Date();
    container.innerHTML = '';
    TOPICS.forEach(function(t){
      var el = document.getElementById(t.id);
      if (!el) return;
      // Masquer si expirée
      if (el.dataset.expires) {
        var exp = new Date(el.dataset.expires + 'T23:59:59');
        if (now > exp) return;
      }
      var chip = document.createElement('div');
      chip.className = 'intro-chip';
      chip.innerHTML = '<span>'+t.icon+'</span> '+t.label;
      container.appendChild(chip);
    });
  }

  // ── Mise à jour de l'horloge intro ──
  function updateIntro() {
    var n = new Date();
    var timeEl = document.getElementById('intro-time');
    var dateEl = document.getElementById('intro-date');
    var feteEl = document.getElementById('intro-fete-txt');
    if (timeEl) timeEl.textContent = n.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
    if (dateEl) dateEl.textContent = n.toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
    if (feteEl) {
      var f = getFete();
      feteEl.textContent = f ? f : '—';
    }
  }
  updateIntro();
  setInterval(updateIntro, 10000); // toutes les 10s suffit (pas de secondes affichées)
  buildIntroTopics();

  // ── Auto-refresh toutes les heures pile ──
  (function scheduleHourlyRefresh() {
    var now = new Date();
    var msToNextHour = (3600 - now.getMinutes()*60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    setTimeout(function() {
      try { location.reload(); } catch(e) { /* iframe bloqué */ }
    }, msToNextHour);
  })();

} catch(e){ console.error('Intro slide:', e); }

try {
  // ══ ROTATION + AUTO-EXPIRATION ══
  var SLIDE_MS  = 9000;
  var rotSlides = [];
  var rotIdx    = 0;
  var slideTimer= null;

  function buildRotation() {
    var allSlides = Array.from(document.querySelectorAll('#slides-wrap .slide'));
    var now = new Date();
    allSlides.forEach(function(s){
      if(s.dataset.expires){
        var exp=new Date(s.dataset.expires+'T23:59:59');
        if(now>exp){ s.style.display='none'; s.dataset.expired='true'; }
      }
    });
    rotSlides = allSlides.filter(function(s){ return !s.dataset.expired; });
    if(rotSlides.length===0) rotSlides=allSlides;
  }

  function getDuration(slide){
    if(!slide) return SLIDE_MS;
    if(slide.dataset.duration) return parseInt(slide.dataset.duration);
    return SLIDE_MS;
  }

  function showSlide(n){
    // Marquer toutes les slides comme inactives
    rotSlides.forEach(function(s){
      s.classList.add('inactive');
      s.classList.remove('active');
      s.querySelectorAll('.stat-bar-fill').forEach(function(b){ b.classList.remove('animated'); });
    });
    // Activer la slide courante (retire .inactive, ajoute .active)
    if(rotSlides[n]){
      rotSlides[n].classList.remove('inactive');
      rotSlides[n].classList.add('active');
      var fill=rotSlides[n].querySelector('.actu-progress-fill');
      if(fill){ fill.classList.remove('active'); void fill.offsetWidth; fill.classList.add('active'); }
      setTimeout(function(){
        rotSlides[n] && rotSlides[n].querySelectorAll('.stat-bar-fill').forEach(function(b){ b.classList.add('animated'); });
      }, 300);
    }
  }

  function scheduleNext(){
    clearTimeout(slideTimer);
    var dur=getDuration(rotSlides[rotIdx]);
    slideTimer=setTimeout(function(){
      rotIdx=(rotIdx+1)%rotSlides.length;
      showSlide(rotIdx);
      scheduleNext();
    }, dur);
  }

  // Démarrage initial
  // Nettoyer le style inline de s0 (mis pour le fallback CSS-only)
  // maintenant que JS tourne, les classes .active/.inactive prennent le relais
  var _s0 = document.getElementById('s0');
  if(_s0){ _s0.removeAttribute('style'); }
  buildRotation();
  showSlide(0);
  scheduleNext();

  // Reconstruction après chargement async des actus et outre-mer (5s)
  setTimeout(function(){
    var current = rotSlides[rotIdx];
    buildRotation();
    var newIdx = rotSlides.indexOf(current);
    if(newIdx>=0) rotIdx=newIdx;
    // Pas besoin de relancer le timer — il tourne déjà
  }, 5000);

} catch(e){ console.error('Rotation:',e); }

try {
  // ══ TICKER RAF ══
  var rafId=null; var tickerX=1080;
  function runTicker(){
    var track=document.querySelector('.t-track');
    if(!track) return;
    track.style.animation='none';
    function loop(){
      tickerX-=1.4; var tw=track.scrollWidth||1;
      if(tickerX<-tw) tickerX=1080;
      track.style.transform='translateX('+Math.round(tickerX)+'px)';
      rafId=requestAnimationFrame(loop);
    }
    if(rafId) cancelAnimationFrame(rafId);
    rafId=requestAnimationFrame(loop);
  }
  runTicker();
} catch(e){}


try {
/* ══════════════════════════════════════════════
   RDV DE LA SEMAINE — données dynamiques
══════════════════════════════════════════════ */
  var RDV_DATA = [
    {
      title:"Le 19h à Mayotte",
      time:"19h00", days:"Lun – Sam",
      desc:"Le journal télévisé local de Mayotte la 1ère",
      img:"https://medias.france.tv/0hcGhdDJr7rCpvVdfMuQziNkvGk/400x533/filters:quality(85)/n/v/t/phpheztvn.jpg",
      imgHero:"https://medias.france.tv/0hcGhdDJr7rCpvVdfMuQziNkvGk/1080x870/filters:quality(85)/n/v/t/phpheztvn.jpg",
      hourStart:19
    },
    {
      title:"Le 13h",
      time:"13h00", days:"Lun – Ven",
      desc:"L'actualité de Mayotte à l'heure du déjeuner",
      img:"https://medias.france.tv/EW717SGTeH5lYZOlAtLAIdcytiU/400x533/filters:quality(85)/j/c/z/phpagwzcj.jpg",
      imgHero:"https://medias.france.tv/EW717SGTeH5lYZOlAtLAIdcytiU/1080x870/filters:quality(85)/j/c/z/phpagwzcj.jpg",
      hourStart:13
    },
    {
      title:"Mahabari",
      time:"19h30", days:"Lun – Ven",
      desc:"Le journal en shimaorais — la langue de Mayotte",
      img:"https://medias.france.tv/D-4TzTe21MofNffNx-ITlkly3OE/400x533/filters:quality(85)/2/t/6/php2k76t2.jpg",
      imgHero:"https://medias.france.tv/D-4TzTe21MofNffNx-ITlkly3OE/1080x870/filters:quality(85)/2/t/6/php2k76t2.jpg",
      hourStart:19.5
    },
    {
      title:"C'est pas si loin",
      time:"Hebdo", days:"Chaque semaine",
      desc:"Le magazine qui explore Mayotte et ses îles voisines",
      img:"https://medias.france.tv/yhhEYziAcYuFEUVv08XWIKrc_sQ/400x533/filters:quality(85)/9/v/l/phpqbjlv9.jpg",
      imgHero:"https://medias.france.tv/yhhEYziAcYuFEUVv08XWIKrc_sQ/1080x870/filters:quality(85)/9/v/l/phpqbjlv9.jpg",
      hourStart:20
    }
  ];

  function getRdvFeaturedIndex(){
    var h = new Date().getHours() + new Date().getMinutes()/60;
    if(h >= 12 && h < 13.5) return 1; // Le 13h en cours
    if(h >= 13.5 && h < 19) return 0; // Le 19h arrive
    if(h >= 19 && h < 19.5) return 0; // Le 19h en cours
    if(h >= 19.5 && h < 20.5) return 2; // Mahabari en cours
    return 0; // défaut : Le 19h
  }

  async function fetchRdvLiveData(){
    try {
      // Proxy local rdv.php — kamili.yt fetche la1ere côté serveur
      var r = await fetchSafe('./data.json', { cache:'no-store' });
      if(!r.ok) return null;
      var d = await r.json();
      if(!d.title) return null;
      var titleText = d.title;
      var descText  = d.desc || '';
      var imgUrl    = d.img || null;
      return {
        title: titleEl.textContent.trim(),
        desc:  descEl ? firstSentence(descEl.textContent, 160) : '',
        imgUrl: imgUrl
      };
    } catch(e){ return null; }
  }

  function buildRdvSlide(featIdx, liveData){
    var heroImg   = document.getElementById('rdv-hero-img');
    var heroTitle = document.getElementById('rdv-hero-title');
    var heroDesc  = document.getElementById('rdv-hero-desc');
    var heroTime  = document.getElementById('rdv-hero-time');
    var strip     = document.getElementById('rdv-prog-strip');
    if(!strip) return;

    var feat = RDV_DATA[featIdx];

    // ── Hero image ──
    if(heroImg){
      var src = (liveData && liveData.imgUrl) ? liveData.imgUrl : feat.imgHero;
      heroImg.src = src;
      heroImg.onerror = function(){ this.src = feat.img; this.onerror=null; };
    }
    if(heroTitle) heroTitle.textContent = (liveData && liveData.title) ? liveData.title : feat.title;
    if(heroDesc)  heroDesc.textContent  = (liveData && liveData.desc && liveData.desc.length > 10) ? liveData.desc : feat.desc;
    if(heroTime)  heroTime.textContent  = feat.time;

    // ── Autres émissions ──
    strip.innerHTML = '';
    RDV_DATA.forEach(function(p, i){
      if(i === featIdx) return;
      var row = document.createElement('div');
      row.className = 'rdv-prog-row';
      row.innerHTML =
        '<div class="rdv-prog-thumb"><img src="'+p.img+'" alt="" onerror="this.parentNode.style.background=\'rgba(0,130,230,0.1)\'"></div>'
       +'<div class="rdv-prog-body">'
         +'<div class="rdv-prog-time">'+p.time+'</div>'
         +'<div class="rdv-prog-name">'+p.title+'</div>'
         +'<div class="rdv-prog-desc">'+p.desc+'</div>'
       +'</div>'
       +'<div class="rdv-prog-days">'+p.days+'</div>';
      strip.appendChild(row);
    });
  }

  // Rendu immédiat avec données statiques, enrichi si l'API répond
  (async function(){
    var fi = getRdvFeaturedIndex();
    buildRdvSlide(fi, null);
    var live = await fetchRdvLiveData();
    if(live && live.title) buildRdvSlide(fi, live);
  })();

} catch(e){ console.error('RDV slide:', e); }

try {
  // ══ NEWS.JSON optionnel ══
  (async function(){
    try{
      var r=await fetchSafe('./news.json'); if(!r.ok) return;
      var data=await r.json();
      if(data.ticker&&data.ticker.length>0){
        var track=document.querySelector('.t-track');
        if(track){ track.innerHTML=data.ticker.map(function(t){return'<span class="ti">'+t+'</span><span class="ts">◆</span>';}).join(''); tickerX=1080; }
      }
    }catch(e){}
  })();
}catch(e){}

// ══ EMERGENCY FALLBACK ══
// Si la rotation n'a pas démarré (erreur JS), on force #s0 visible
// Note : #s0 a déjà class="slide active" + style inline dans le HTML
// Ce fallback est une 3ème couche de sécurité
try {
  setTimeout(function(){
    try {
      var activeSlide = document.querySelector('#slides-wrap .slide.active');
      if(!activeSlide){
        // Aucune slide active → forcer #s0
        var s0 = document.getElementById('s0');
        if(s0){
          s0.style.opacity = '1';
          s0.style.transform = 'translateY(0)';
          s0.style.pointerEvents = 'auto';
          s0.classList.add('active');
        }
      }
    } catch(e2){}
  }, 2000);
} catch(e){}