/* ==========================================================================
   Météo Splash – Script
   Version INTERMEDIAIRE (stabilité maximale)
   ========================================================================== */

/* --------------------------------------------------------------------------
   1. SELECTEURS + ÉTATS GLOBAUX
--------------------------------------------------------------------------- */
let dynamicBgTimer = null;
let hasValidLocation = false;
let cityLocalHour = null;
let citySunriseHour = null;
let citySunsetHour = null;
const btn24h = document.getElementById("btn-24h");
const timeline24h = document.getElementById("timeline-24h");
const btnForecast7 = document.getElementById("btn-forecast-7");
const btnForecast14 = document.getElementById("btn-forecast-14");


const cityInput = document.getElementById("city-input");
const autocompleteList = document.getElementById("autocomplete-list");

const btnGeolocate = document.getElementById("btn-geolocate");
const btnSpeak = document.getElementById("btn-speak");
const btnThemeToggle = document.getElementById("btn-theme-toggle");
const btnRadar = document.getElementById("btn-radar");
const toast = document.getElementById("toast");

const radarOverlay = document.getElementById("radar-overlay");
const btnCloseRadar = document.getElementById("btn-close-radar");
const radarTabRain = document.getElementById("radar-tab-rain");
const radarTabWind = document.getElementById("radar-tab-wind");
const radarTabTemp = document.getElementById("radar-tab-temp");
const radarWindowText = document.getElementById("radar-window-text");
const radarPlay = document.getElementById("radar-play");
const radarGrid = document.getElementById("radar-grid");
const radarTimelineSlider = document.getElementById("radar-timeline-slider");
const radarModeToggle = document.getElementById("radar-mode-toggle");

const cityList = document.getElementById("city-list");
const btnReset = document.getElementById("btn-reset");
const sortSelect = document.getElementById("sort-select");

const detailsTitle = document.getElementById("details-title");
const detailsSubtitle = document.getElementById("details-subtitle");
const detailsCurrent = document.getElementById("details-current");
const detailsHistory = document.getElementById("details-history");
const btnHistory = document.getElementById("btn-history");

const windCompass = document.getElementById("wind-compass");
const windArrow = windCompass ? windCompass.querySelector(".compass-arrow") : null;
const windLineMain = document.getElementById("wind-line-main");
const windLineSub = document.getElementById("wind-line-sub");

const detailsTip = document.getElementById("details-tip");

const forecastList = document.getElementById("forecast-list");
const dayOverlay = document.getElementById("day-overlay");
const btnCloseDay = document.getElementById("btn-close-day");
const dayOverlayTitle = document.getElementById("day-overlay-title");
const dayOverlaySubtitle = document.getElementById("day-overlay-subtitle");
const chartTemp = document.getElementById("chart-temp");
const chartRain = document.getElementById("chart-rain");
const chartWind = document.getElementById("chart-wind");
const chartHumidity = document.getElementById("chart-humidity");

const dayTabTemp = document.getElementById("day-tab-temp");
const dayTabRain = document.getElementById("day-tab-rain");
const dayTabWind = document.getElementById("day-tab-wind");
const dayTabHumidity = document.getElementById("day-tab-humidity");
const dayGraphTemp = document.getElementById("chart-temp");
const dayGraphRain = document.getElementById("chart-rain");
const dayGraphWind = document.getElementById("chart-wind");
const dayGraphHumidity = document.getElementById("chart-humidity");

let selectedCity = null;
let weatherCache = {};
let cities = [];
let lastForecastData = null;
let currentDaySeries = null;

/* --------------------------------------------------------------------------
   2. UTILITAIRES
-------------------------------------------------------------------------- */

function getHourFromLocalISO(iso) {
  if (!iso) return null;

  // Open-Meteo renvoie sunrise/sunset en heure locale de la ville (ISO sans timezone).
  // On ne doit PAS appliquer d'offset ici : on extrait l'heure directement de la chaîne.
  const hh = Number(String(iso).substring(11, 13));
  const mm = Number(String(iso).substring(14, 16));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh + mm / 60;
}


function degreeToCardinal(angle) {
  const directions = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  const index = Math.round((angle % 360) / 45) % 8;
  return directions[index];
}

function formatDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function updateRadarClockFromISO(iso, utcOffsetSeconds) {
  const el = document.getElementById("radar-clock");
  if (!el || !iso || typeof utcOffsetSeconds !== "number") return;

  // convertir l'heure ISO en heure locale ville
  const utcMs = Date.parse(iso + "Z");
  const local = new Date(utcMs + utcOffsetSeconds * 1000);

  const h = String(local.getHours()).padStart(2, "0");
  const m = String(local.getMinutes()).padStart(2, "0");

  el.textContent = `${h}:${m}`;
}

function formatDay(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "numeric"
  });
}

function renderTimeline24h(j) {
  if (!timeline24h || !j?.hourly) return;

  timeline24h.innerHTML = "";

  const now = new Date();
  const times = j.hourly.time;
  const temps = j.hourly.temperature_2m;
  const codes = j.hourly.weather_code;

  let shown = 0;

  for (let i = 0; i < times.length && shown < 24; i++) {
    const t = new Date(times[i]);
    if (t < now) continue;

    const item = document.createElement("div");
    item.className = "hour-item";

    item.innerHTML = `
      <div class="hour-time">${t.getHours()}h</div>
      <div class="hour-icon">${getWeatherIcon(codes[i])}</div>
      <div class="hour-temp">${Math.round(temps[i])}°</div>
    `;

    timeline24h.appendChild(item);
    shown++;
  }
}
function getWeatherIcon(code) {
  if (code == null) return "";
  // Clair
  if (code === 0) return "☀️";
  // Peu nuageux
  if ([1, 2].includes(code)) return "🌤";
  // Couvert
  if (code === 3) return "☁️";
  // Brouillard
  if ([45, 48].includes(code)) return "🌫";
  // Pluie / averses
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return "🌧";
  // Pluie verglaçante
  if ([56, 57, 66, 67].includes(code)) return "🌧❄️";
  // Neige
  if ([71, 73, 75, 77].includes(code)) return "❄️";
  // Orages
  if ([95, 96, 99].includes(code)) return "⛈";
  return "";
}


function getWeatherLabel(code) {
  if (code == null) return "";

  if (code === 0) return "Ensoleillé";
  if ([1, 2].includes(code)) return "Peu nuageux";
  if (code === 3) return "Nuageux";
  if ([45, 48].includes(code)) return "Brouillard";

  if ([51, 53, 55].includes(code)) return "Bruine";
  if ([61, 63, 65].includes(code)) return "Pluie";
  if ([80, 81, 82].includes(code)) return "Averses";

  if ([71, 73, 75, 77].includes(code)) return "Neige";

  if ([95].includes(code)) return "Orage";
  if ([96, 99].includes(code)) return "Orage violent";

  return "Conditions météo";
}

// v6.7 — util ville (comparaison robuste)
function isSameCity(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const sameName = (a.name || "").toLowerCase() === (b.name || "").toLowerCase();
  const sameLat = typeof a.lat === "number" && typeof b.lat === "number" && Math.abs(a.lat - b.lat) < 0.01;
  const sameLon = typeof a.lon === "number" && typeof b.lon === "number" && Math.abs(a.lon - b.lon) < 0.01;
  return sameName && sameLat && sameLon;
}


function selectCityByIndex(idx) {
  if (idx >= 0 && idx < cities.length) {
    loadCityWeather(cities[idx]);
  }
}

function updateTip(j) {
  if (!detailsTip) return;

  if (!selectedCity || !j) {
    detailsTip.textContent = "Ajoute une ville ou active la géolocalisation.";
    return;
  }

  const c = j.current;
  let tip = "";

  if (c.temperature_2m <= 0) {
    tip = "Pense à bien te couvrir, il gèle aujourd’hui.";
  } else if (c.rain > 0 || c.precipitation > 0) {
    tip = "Prends un parapluie avant de sortir.";
  } else if (c.wind_speed_10m >= 40) {
    tip = "Le vent souffle fort, garde un œil sur ton parapluie.";
  } else if (c.temperature_2m >= 28) {
    tip = "Bois beaucoup d’eau, il fait très chaud aujourd’hui.";
  } else {
    tip = "Journée plutôt calme côté météo.";
  }

  detailsTip.textContent = tip;
}

/* --------------------------------------------------------------------------
   3. FOND ANIMÉ SELON MÉTÉO
-------------------------------------------------------------------------- */

let themeMode = "auto"; // "auto" | "day" | "night"

function applyWeatherBackground(code) {
  const body = document.body;

  // Nettoyage météo
  body.classList.remove(
    "weather-clear",
    "weather-cloudy",
    "weather-rain",
    "weather-snow",
    "weather-storm"
  );

  if (code === null) return;

  let cls = "";

  if (code === 0) cls = "weather-clear";
  else if ([1, 2, 3].includes(code)) cls = "weather-cloudy";
  else if ([45, 48].includes(code)) cls = "weather-cloudy";
  else if ([51, 53, 55, 56, 57].includes(code)) cls = "weather-rain";
  else if ([61, 63, 65, 66, 67].includes(code)) cls = "weather-rain";
  else if ([71, 73, 75, 77].includes(code)) cls = "weather-snow";
  else if ([80, 81, 82].includes(code)) cls = "weather-rain";
  else if ([95, 96, 99].includes(code)) cls = "weather-storm";

  if (cls) body.classList.add(cls);

  // ✅ le thème jour/nuit est géré EXCLUSIVEMENT par applyTheme()
}


/* --------------------------------------------------------------------------
   4. THÈME JOUR / NUIT / AUTO
-------------------------------------------------------------------------- */

if (btnThemeToggle) {
  btnThemeToggle.addEventListener("click", () => {
    if (themeMode === "auto") {
      themeMode = "day";
      btnThemeToggle.textContent = "☀ Jour";
    } else if (themeMode === "day") {
      themeMode = "night";
      btnThemeToggle.textContent = "🌙 Nuit";
    } else {
      themeMode = "auto";
      btnThemeToggle.textContent = "🌓 Auto";
    }

    // 💾 Sauvegarde du choix utilisateur
    localStorage.setItem("themeMode", themeMode);

    applyThemeMode();
  });
}

function applyThemeMode() {
  const body = document.body;

  if (themeMode === "day") {
    body.classList.add("theme-day");
    body.classList.remove("theme-night");
    return;
  }

  if (themeMode === "night") {
    body.classList.add("theme-night");
    body.classList.remove("theme-day");
    return;
  }

  // 🌗 MODE AUTO — UNE SEULE SOURCE DE VÉRITÉ
  applyThemeAuto();
}

function applyThemeAuto() {
  if (
    typeof cityLocalHour !== "number" ||
    typeof citySunriseHour !== "number" ||
    typeof citySunsetHour !== "number"
  ) return;

  const body = document.body;
  const isNight =
    cityLocalHour < citySunriseHour ||
    cityLocalHour >= citySunsetHour;

  body.classList.toggle("theme-night", isNight);
  body.classList.toggle("theme-day", !isNight);
}

/* --------------------------------------------------------------------------
   v6.7 (I) — Arc solaire (lever/coucher + position)
-------------------------------------------------------------------------- */

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function updateSunArc(ci) {
  // SVG structure in index.html:
  // - <svg id="sun-arc" class="sun-arc" viewBox="0 0 200 80">
  // - <path id="sun-arc-path" ...>
  // - <path id="sun-arc-progress" ...>
  // - <circle id="sun-dot" ...>
  const arc = document.getElementById("sun-arc") || document.querySelector(".sun-arc");
  if (!arc) return;

  const sun = document.getElementById("sun-dot") || arc.querySelector("#sun-dot") || arc.querySelector("circle");
  const progress = document.getElementById("sun-arc-progress") || arc.querySelector("#sun-arc-progress");
  const path = document.getElementById("sun-arc-path") || arc.querySelector("#sun-arc-path") || progress;

  if (!sun) return;

  // Pré-requis: lever/coucher + offset + heure locale calculée
  if (
    !ci ||
    !ci.sunrise ||
    !ci.sunset ||
    typeof ci.utcOffset !== "number" ||
    typeof cityLocalHour !== "number"
  ) {
    sun.style.opacity = "0";
    if (progress && path && typeof path.getTotalLength === "function") {
      const len0 = path.getTotalLength();
      progress.setAttribute("stroke-dasharray", `0 ${len0}`);
    }
    return;
  }

  const sunrise = getHourFromLocalISO(ci.sunrise);
  const sunset  = getHourFromLocalISO(ci.sunset);

  const now     = cityLocalHour;

  if (sunrise === null || sunset === null || sunset <= sunrise) {
    sun.style.opacity = "0";
    if (progress && path && typeof path.getTotalLength === "function") {
      const len0 = path.getTotalLength();
      progress.setAttribute("stroke-dasharray", `0 ${len0}`);
    }
    return;
  }

  // Nuit : on masque le soleil
  if (now < sunrise || now > sunset) {
    sun.style.opacity = "0";
    if (progress && path && typeof path.getTotalLength === "function") {
      const len0 = path.getTotalLength();
      progress.setAttribute("stroke-dasharray", `0 ${len0}`);
    }
    return;
  }

  sun.style.opacity = "1";

  // t = 0 au lever, 1 au coucher (heure locale de la ville)
  const t = (now - sunrise) / (sunset - sunrise);
  const clampedT = Math.max(0, Math.min(1, t));

  // Progression sur l'arc (optionnel mais joli)
  if (progress && path && typeof path.getTotalLength === "function") {
    const len = path.getTotalLength();
    progress.setAttribute("stroke-dasharray", `${clampedT * len} ${len}`);
  }

  // Demi-cercle gauche -> sommet -> droite
  // Paramétrage cohérent avec l'arc SVG: M20 60 A80 80 0 0 1 180 60
  const angle = Math.PI - clampedT * Math.PI; // π (gauche) -> 0 (droite)

  const r  = 70;
  const cx = 100;
  const cy = 70;

  const x = cx + r * Math.cos(angle);
  const y = cy - r * Math.sin(angle);

  sun.setAttribute("cx", String(x));
  sun.setAttribute("cy", String(y));
}

/* --------------------------------------------------------------------------
   5. AUTO-COMPLÉTION VILLES (API geocoding)
-------------------------------------------------------------------------- */

let autocompleteItems = [];
let autocompleteSelectedIndex = -1;

const stateCodeMap = {
  Californie: "CA",
  Floride: "FL",
  "New York": "NY",
  Nevada: "NV",
  Texas: "TX",
  Washington: "WA",
};

function refreshAutocompleteSelection() {
  const items = autocompleteList.querySelectorAll(".autocomplete-item");
  items.forEach((li, idx) => {
    if (idx === autocompleteSelectedIndex) li.classList.add("selected");
    else li.classList.remove("selected");
  });
}

if (cityInput) {
  cityInput.addEventListener("keydown", (e) => {
    if (!autocompleteList || !autocompleteList.childElementCount) return;

    const maxIndex = autocompleteList.childElementCount - 1;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      autocompleteSelectedIndex =
        autocompleteSelectedIndex < maxIndex ? autocompleteSelectedIndex + 1 : maxIndex;
      refreshAutocompleteSelection();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      autocompleteSelectedIndex =
        autocompleteSelectedIndex > 0 ? autocompleteSelectedIndex - 1 : 0;
      refreshAutocompleteSelection();
    } else if (e.key === "Enter") {
      if (autocompleteSelectedIndex >= 0) {
        e.preventDefault();
        const items = autocompleteList.querySelectorAll(".autocomplete-item");
        const target = items[autocompleteSelectedIndex];
        if (target) {
          target.click();
        }
      }
    } else if (e.key === "Escape") {
      autocompleteList.innerHTML = "";
      autocompleteSelectedIndex = -1;
    }
  });

  cityInput.addEventListener("input", async () => {
    const query = cityInput.value.trim();
    autocompleteList.innerHTML = "";

    if (!query) return;

    try {
      autocompleteSelectedIndex = -1;

      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        query
      )}&count=10&language=fr&format=json`;

      const r = await fetch(url);
      const j = await r.json();

      if (!j.results) return;

      autocompleteItems = [];
      j.results.forEach((item) => {
        const li = document.createElement("li");
        li.className = "autocomplete-item";

        const main = document.createElement("span");
        main.className = "autocomplete-main";
        let regionLabel = "";
        if (item.admin1) {
          const code = stateCodeMap[item.admin1] ? ` ${stateCodeMap[item.admin1]}` : "";
          regionLabel = `, ${item.admin1}${code}`;
        }
        main.textContent = `${item.name}${regionLabel} — ${item.country}`;

        const meta = document.createElement("span");
        meta.className = "autocomplete-meta";
        meta.textContent = `Lat ${item.latitude.toFixed(2)} • Lon ${item.longitude.toFixed(
          2
        )}`;

        li.appendChild(main);
        li.appendChild(meta);
        autocompleteItems.push(li);

        li.addEventListener("click", () => {
          addCity({
            name: item.name,
            country: item.country,
            lat: item.latitude,
            lon: item.longitude,
          });
          autocompleteList.innerHTML = "";
          autocompleteSelectedIndex = -1;
          cityInput.value = "";
        });

        autocompleteList.appendChild(li);
      });
    } catch (err) {
      console.error("Erreur geocoding", err);
    }
  });
}

/* --------------------------------------------------------------------------
   6. GÉOLOCALISATION
-------------------------------------------------------------------------- */

function showToast(message, type = "info") {
  if (!toast) return;
  toast.textContent = message;
  toast.className = "toast toast-visible";
  if (type === "error") toast.classList.add("toast-error");
  if (type === "success") toast.classList.add("toast-success");
  setTimeout(() => {
    toast.classList.remove("toast-visible");
  }, 1800);
}

function setGeolocateIdle() {
  if (!btnGeolocate) return;
  btnGeolocate.disabled = false;
  btnGeolocate.classList.remove("location-loading", "location-success");
  btnGeolocate.textContent = "📍 Ma position";
}

function setGeolocateLoading() {
  if (!btnGeolocate) return;
  btnGeolocate.disabled = true;
  btnGeolocate.classList.remove("location-success");
  btnGeolocate.classList.add("location-loading");
  btnGeolocate.textContent = "📍 Recherche…";
}

function setGeolocateSuccess(cityName) {
  hasValidLocation = true;

  if (!btnGeolocate) return;

  btnGeolocate.disabled = false;
  btnGeolocate.classList.remove("location-loading");
  btnGeolocate.classList.add("location-success");
  btnGeolocate.textContent = "✅ Position trouvée";

  // ✅ afficher le toast APRÈS l'état bouton
  if (cityName) {
    showToast(`📍 Position détectée : ${cityName}`, "success");
  }

  setTimeout(() => {
    setGeolocateIdle();
  }, 1500);
}


function setGeolocateError(message) {
  // ❌ INTERDIT au démarrage
  if (!btnGeolocate || !btnGeolocate.classList.contains("location-loading")) {
    return;
  }

  showToast(message || "Impossible de déterminer votre position.", "error");
  setGeolocateIdle();
}

async function geolocateByIp() {
  if (hasValidLocation) return;

  try {
    const r = await fetch("https://ipapi.co/json/");
    const j = await r.json();

    if (!j || !j.city || !j.latitude || !j.longitude) {
      return; // ⛔ PAS de toast rouge ici
    }

    const lat = j.latitude;
    const lon = j.longitude;

    addCity({
      name: j.city,
      country: j.country_name || "—",
      lat,
      lon,
      isCurrentLocation: true,
    });

    setGeolocateSuccess(j.city); // 🟢 SEUL toast visible

  } catch (err) {
    console.error("Erreur géoloc IP", err);

    // 🔴 erreur finale UNIQUEMENT ici
    setGeolocateError("Impossible de déterminer votre position.");
  }
}


if (btnGeolocate) {
  btnGeolocate.addEventListener("click", () => {
    setGeolocateLoading();

    if (!navigator.geolocation) {
      geolocateByIp();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      onGeoSuccess,
      onGeoError,
      { enableHighAccuracy: true, timeout: 7000 }
    );
  });
}

/* --------------------------------------------------------------------------
   6-bis. CALLBACKS GÉOLOCALISATION NAVIGATEUR
-------------------------------------------------------------------------- */
async function onGeoSuccess(position) {
  if (hasValidLocation) return; // 🔒 sécurité double appel

  hasValidLocation = true; // 🔒 VERROU IMMÉDIAT (clé du bug)

  const lat = position.coords.latitude;
  const lon = position.coords.longitude;

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=fr`;
    const r = await fetch(url);
    const j = await r.json();
    const info = j?.results?.[0];

    const cityName =
      info?.name || `Position (${lat.toFixed(2)}, ${lon.toFixed(2)})`;
    const countryName = info?.country || "—";

    addCity({
      name: cityName,
      country: countryName,
      lat,
      lon,
      isCurrentLocation: true,
    });

    setGeolocateSuccess(cityName); // 🟢 toast + bouton vert

  } catch (err) {
    console.error("Erreur géocodage inverse", err);

    // ⚠️ fallback IP UNIQUEMENT si rien n'a encore validé
    if (!hasValidLocation) {
      geolocateByIp();
    }
  }
}

function onGeoError(err) {
  console.warn("Géolocalisation navigateur refusée:", err);

  if (hasValidLocation) return;

  // ⛔ AUCUN toast rouge ici
  // ✅ on bascule silencieusement vers l’IP
  geolocateByIp();
}

/* --------------------------------------------------------------------------
   7. AJOUT / SUPPRESSION DE VILLES
-------------------------------------------------------------------------- */

function addCity(ci) {
  const existingIndex = cities.findIndex(
    (x) =>
      x.name === ci.name &&
      Math.abs(x.lat - ci.lat) < 0.01 &&
      Math.abs(x.lon - ci.lon) < 0.01
  );

  if (existingIndex !== -1) {
    if (ci.isCurrentLocation) {
      cities.forEach((c) => {
        c.isCurrentLocation = false;
      });
      cities[existingIndex].isCurrentLocation = true;
      saveCities();
      renderCityList();
      highlightCity(existingIndex);
    }
    loadCityWeather(cities[existingIndex]);
    return;
  }

  if (ci.isCurrentLocation) {
    cities.forEach((c) => {
      c.isCurrentLocation = false;
    });
  }

  cities.push(ci);
  saveCities();
  renderCityList();
  loadCityWeather(ci);

  if (ci.isCurrentLocation) {
    const idx = cities.length - 1;
    highlightCity(idx);
  }
}

function removeCity(idx) {
  cities.splice(idx, 1);
  renderCityList();
  saveCities();

  if (cities.length > 0) {
    loadCityWeather(cities[0]);
  } else {
    detailsTitle.textContent = "Aucune ville sélectionnée";
    detailsSubtitle.textContent = "Ajoute une ville ou utilise “Ma position”.";
    detailsCurrent.innerHTML = "";
    if (windLineMain) windLineMain.textContent = "Vent : —";
    if (windLineSub) windLineSub.textContent = "Rafales : —";
    forecastList.innerHTML = "";
    applyWeatherBackground(null);
    updateTip(null);
  }
}

function saveCities() {
  localStorage.setItem("meteosplash-cities", JSON.stringify(cities));
}

function loadSavedCities() {
  const raw = localStorage.getItem("meteosplash-cities");
  if (raw) {
    cities = JSON.parse(raw);
    renderCityList();
  }
  updateAddCityButtonVisibility();
}

if (btnReset) {
  btnReset.addEventListener("click", () => {
  cities = [];
  saveCities();
  renderCityList();
  updateAddCityButtonVisibility();
});
}

/* --------------------------------------------------------------------------
   8. AFFICHAGE LISTE DES VILLES
-------------------------------------------------------------------------- */

function renderCityList() {
  if (!cityList) return;

  // 🔒 mémoriser la ville sélectionnée AVANT tri
  const currentSelected = selectedCity;

  cityList.innerHTML = "";

  if (sortSelect && sortSelect.value === "alpha") {
    cities.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortSelect && sortSelect.value === "temp") {
    cities.sort((a, b) => {
      const Ta = weatherCache[a.name]?.current?.temperature_2m ?? -9999;
      const Tb = weatherCache[b.name]?.current?.temperature_2m ?? -9999;
      return Tb - Ta;
    });
  }

  // 🔒 restaurer la sélection APRÈS tri
  selectedCity = currentSelected;

  cities.forEach((ci, idx) => {
    const el = document.createElement("div");
    el.className = "city-item";
    el.dataset.index = idx;

    // ✅ ville active UNIQUE
    if (selectedCity && isSameCity(ci, selectedCity)) {
      el.classList.add("city-item-active");
    }

    const tempVal = weatherCache[ci.name]?.current?.temperature_2m ?? "—";
    const badge = ci.isCurrentLocation
      ? '<span class="city-badge-location">Ma position</span>'
      : "";

    el.innerHTML = `
      <div class="city-main">
        <span class="city-name">${ci.name}</span>
        <span class="city-meta">${ci.country} • ${ci.lat.toFixed(
          2
        )}, ${ci.lon.toFixed(2)}</span>
      </div>
      <span class="city-temp">${tempVal}°</span>
      ${badge}
      <button class="city-remove">✕</button>
    `;

    el.addEventListener("click", (e) => {
      if (e.target.classList.contains("city-remove")) {
        removeCity(idx);
        e.stopPropagation();
        return;
      }
      loadCityWeather(ci);
    });

    cityList.appendChild(el);
  });

  updateAddCityButtonVisibility();
}

function highlightCity(index) {
  if (!cityList) return;
  const item = cityList.querySelector(`.city-item[data-index="${index}"]`);
  if (!item) return;
  item.classList.add("city-item-highlight");
  setTimeout(() => {
    item.classList.remove("city-item-highlight");
  }, 1200);
}

/* --------------------------------------------------------------------------
   9. CHARGER LES DONNÉES MÉTÉO (VERSION STABLE)
--------------------------------------------------------------------------- */

/* ⏰ Heure locale ville (SOURCE UNIQUE, fiable) */
function updateCityClockFromOffset(offsetSeconds) {
  const clock = document.getElementById("radar-clock");
  if (!clock || typeof offsetSeconds !== "number") return;

  const nowUtc = Date.now() + new Date().getTimezoneOffset() * 60000;
  const local = new Date(nowUtc + offsetSeconds * 1000);

  const hh = String(local.getHours()).padStart(2, "0");
  const mm = String(local.getMinutes()).padStart(2, "0");
  clock.textContent = `${hh}:${mm}`;

  cityLocalHour = local.getHours() + local.getMinutes() / 60;

  // ❌ PLUS JAMAIS de thème ici
}

/* 🌍 Chargement météo — VERSION PRO STABLE */
async function loadCityWeather(ci) {
  // 🔒 définir la ville sélectionnée (source unique)
  selectedCity = cities.find(c => isSameCity(c, ci)) || ci;

  detailsTitle.textContent = ci.name;
  detailsSubtitle.textContent = `Lat ${ci.lat.toFixed(2)}, Lon ${ci.lon.toFixed(2)}`;

  try {
    const url =
      "https://api.open-meteo.com/v1/forecast" +
      `?latitude=${ci.lat}&longitude=${ci.lon}` +
      "&current=temperature_2m,relative_humidity_2m,precipitation,rain,showers,snowfall,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code" +
      "&hourly=temperature_2m,precipitation,rain,relative_humidity_2m,cloud_cover,wind_speed_10m,wind_gusts_10m,weather_code" +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset" +
      "&forecast_days=14" +
      "&timezone=auto";

    const r = await fetch(url);
    if (!r.ok) throw new Error("Open-Meteo KO");
    const j = await r.json();

    /* =========================
       ☀️ LEVER / COUCHER
    ========================= */
    if (j.daily?.sunrise && j.daily?.sunset) {
      ci.sunrise = j.daily.sunrise[0];
      ci.sunset  = j.daily.sunset[0];

      citySunriseHour = getHourFromLocalISO(ci.sunrise);
      citySunsetHour  = getHourFromLocalISO(ci.sunset);
    } else {
      ci.sunrise = null;
      ci.sunset  = null;
      citySunriseHour = null;
      citySunsetHour  = null;
    }

    /* =========================
       📦 CACHE MÉTÉO
    ========================= */
    weatherCache[ci.name] = j;

    /* =========================
       🌦️ RENDUS PRINCIPAUX
    ========================= */
    renderTimeline24h(j);
    renderCurrent(j);
    renderWind(j);
    applyRainFX(j);
    applyWeatherAnimations(j);
    applyWeatherBackground(j.current.weather_code);
    renderCityList();
    updateTip(j);

    /* =========================
       ⏰ HEURE LOCALE + THÈME
    ========================= */
    ci.utcOffset = j.utc_offset_seconds;
    updateCityClockFromOffset(j.utc_offset_seconds);

    // 🌗 Thème AUTO / JOUR / NUIT (source unique)
    applyThemeMode();

    /* =========================
       ☀️ SOLEIL
    ========================= */
    updateSunArc(ci);
    startSunArcLoop();

    /* =========================
       🌗 BACKGROUND ÉVOLUTIF
    ========================= */
    applyDynamicBackground(ci, j.current.weather_code);

    if (dynamicBgTimer) clearInterval(dynamicBgTimer);
    dynamicBgTimer = setInterval(() => {
      if (selectedCity && weatherCache[selectedCity.name]) {
        applyDynamicBackground(
          selectedCity,
          weatherCache[selectedCity.name].current.weather_code
        );
      }
    }, 60000);

    /* =========================
       📆 PRÉVISIONS 7 / 14 JOURS
    ========================= */
    updateForecastButtonsActiveState(7);
    lastForecastData = j;
    renderForecast(j, 7);

  } catch (err) {
    console.error("Erreur météo", err);
  }
}

/* --------------------------------------------------------------------------
   10. AFFICHAGE METEO ACTUELLE
-------------------------------------------------------------------------- */


function renderCurrent(j) {
  if (!detailsCurrent) return;
  const c = j.current;

  const pluieTotal = (c.rain ?? 0) + (c.showers ?? 0);
  const pluieDisplay = pluieTotal > 0 ? pluieTotal.toFixed(1) : (c.precipitation ?? 0);

  detailsCurrent.innerHTML = `
    <div class="detail-block">
      <div class="detail-label">Température</div>
      <div class="detail-value">${c.temperature_2m}°C</div>
      <div class="detail-sub">Ressenti : ${c.temperature_2m}°C</div>
    </div>

    <div class="detail-block">
      <div class="detail-label">Humidité</div>
      <div class="detail-value">${Math.min(100, c.relative_humidity_2m)}%</div>
      <div class="detail-sub">Nuages : ${c.cloud_cover}%</div>
    </div>

    <div class="detail-block">
      <div class="detail-label">Précipitations</div>
      <div class="detail-value">${c.precipitation} mm</div>
      <div class="detail-sub">Pluie : ${pluieDisplay} mm</div>
    </div>

    <div class="detail-block">
      <div class="detail-label">Neige</div>
      <div class="detail-value">${c.snowfall} mm</div>
      <div class="detail-sub">Averse : ${c.showers} mm</div>
    </div>
  `;

  const sr = j.daily.sunrise ? j.daily.sunrise[0].substring(11,16) : "";
  const ss = j.daily.sunset ? j.daily.sunset[0].substring(11,16) : "";
  const el_sr = document.getElementById("sunrise-time");
  const el_ss = document.getElementById("sunset-time");
  if (el_sr) el_sr.textContent = sr;
  if (el_ss) el_ss.textContent = ss;

  // v6.7 (H) — micro animation des valeurs
  try {
    const values = detailsCurrent.querySelectorAll(".detail-value");
    values.forEach((v) => {
      v.classList.remove("value-animate");
      // relance propre de l'animation
      void v.offsetWidth;
      v.classList.add("value-animate");
      v.addEventListener(
        "animationend",
        () => v.classList.remove("value-animate"),
        { once: true }
      );
    });
  } catch (e) {}
}


/* --------------------------------------------------------------------------
   11. Boussole du vent
-------------------------------------------------------------------------- */

function renderWind(j) {
  if (!windArrow) return;
  const c = j.current;
  const dir = c.wind_direction_10m;
  const speed = c.wind_speed_10m;
  const gust = c.wind_gusts_10m;

  windArrow.style.transform = `translate(-50%, -50%) rotate(${dir}deg)`;

  if (windLineMain) {
    windLineMain.textContent = `Vent : ${degreeToCardinal(dir)} (${speed} km/h)`;
  }
  if (windLineSub) {
    windLineSub.textContent = `Rafales : ${gust} km/h`;
  }
}

/* --------------------------------------------------------------------------
   13. PRÉVISIONS 7 & 14 jours
-------------------------------------------------------------------------- */

if (btnForecast7) {
  btnForecast7.addEventListener("click", () => {
    updateForecastButtonsActiveState(7);
    if (selectedCity) {
        renderForecast(weatherCache[selectedCity.name], 7);
        activateForecastClicks();
    }
});
}

if (btnForecast14) {
  btnForecast14.addEventListener("click", () => {
    updateForecastButtonsActiveState(14);
    if (selectedCity) {
        renderForecast(weatherCache[selectedCity.name], 14);
        activateForecastClicks();
    }
});
}


if (btn24h) {
  btn24h.addEventListener("click", (e) => {
    if (!lastForecastData || !selectedCity) return;

    // ✅ Clic normal : ouvre le popup "Prochaines 24 h" (graphiques)
    // 💡 Shift+clic : garde l'ancien comportement (afficher/masquer la timeline 24h sous le titre)
    if (e && e.shiftKey && timeline24h) {
      timeline24h.classList.toggle("hidden");
      if (!timeline24h.classList.contains("hidden")) {
        renderTimeline24h(lastForecastData);
      }
      return;
    }

    open24hOverlay();
  });
}

/* --------------------------------------------------------------------------
   14-bis. POPUP "PROCHAINES 24H" (réutilise l'overlay détail jour)
--------------------------------------------------------------------------- */

function isoToCityMs(iso, offsetSeconds) {
  // Open-Meteo renvoie des ISO sans timezone. On les traite comme UTC puis on applique l'offset ville.
  // Exemple: "2025-12-13T21:00" -> Date.parse("2025-12-13T21:00Z") + offset
  const utcMs = Date.parse(iso + "Z");
  return utcMs + (offsetSeconds || 0) * 1000;
}

function formatCityHMFromMs(cityMs) {
  const d = new Date(cityMs);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function findBaseIndexForNow(timesIso, offsetSeconds) {
  if (!Array.isArray(timesIso) || !timesIso.length) return 0;

  const nowUtcMs = Date.now() + new Date().getTimezoneOffset() * 60000;
  const nowCityMs = nowUtcMs + (offsetSeconds || 0) * 1000;

  // On prend la première heure >= maintenant (tolérance -30 min)
  const tolMs = 30 * 60 * 1000;
  for (let i = 0; i < timesIso.length; i++) {
    const tCityMs = isoToCityMs(timesIso[i], offsetSeconds);
    if (tCityMs >= nowCityMs - tolMs) return i;
  }
  return Math.max(0, timesIso.length - 24);
}

function open24hOverlay() {
  if (!lastForecastData || !selectedCity || !dayOverlay) return;

  const h = lastForecastData.hourly;
  if (!h || !Array.isArray(h.time) || !h.time.length) return;

  const offsetSeconds =
    typeof selectedCity.utcOffset === "number"
      ? selectedCity.utcOffset
      : (typeof lastForecastData.utc_offset_seconds === "number" ? lastForecastData.utc_offset_seconds : 0);

  const baseIndex = findBaseIndexForNow(h.time, offsetSeconds);

  const hours = [];
  const temps = [];
  const rains = [];
  const winds = [];
  const humidities = [];

  const max = Math.min(baseIndex + 24, h.time.length);
  for (let i = baseIndex; i < max; i++) {
    const cityMs = isoToCityMs(h.time[i], offsetSeconds);
    hours.push(new Date(cityMs).getUTCHours()); // ✅ heure locale ville
    if (Array.isArray(h.temperature_2m)) temps.push(h.temperature_2m[i]);
    if (Array.isArray(h.precipitation)) rains.push(h.precipitation[i]);
    else if (Array.isArray(h.rain)) rains.push(h.rain[i]);
    else rains.push(0);
    if (Array.isArray(h.wind_speed_10m)) winds.push(h.wind_speed_10m[i]);
    if (Array.isArray(h.relative_humidity_2m)) humidities.push(Math.min(100, h.relative_humidity_2m[i]));
  }

  // Titre / sous-titre comme sur ta capture
  if (dayOverlayTitle) {
    dayOverlayTitle.textContent = `Prochaines 24 h • ${selectedCity.name}`;
  }
  if (dayOverlaySubtitle) {
    const fromMs = isoToCityMs(h.time[baseIndex], offsetSeconds);
    const toMs = isoToCityMs(h.time[Math.max(baseIndex, max - 1)], offsetSeconds);
    dayOverlaySubtitle.textContent = `De ${formatCityHMFromMs(fromMs)} à ${formatCityHMFromMs(toMs)}`;
  }

  // On réutilise les mêmes onglets/canvas de l'overlay jour
  currentDaySeries = { hours, temps, rains, winds, humidities };
  setActiveDayTab("temp");

  dayOverlay.classList.add("active");
  document.body.classList.add("no-scroll");
}

function formatForecastDate(dateStr) {
  const d = new Date(dateStr);

  return d.toLocaleDateString("fr-FR", {
    weekday: "short",   // lun., mar., mer.
    day: "numeric",     // 13
    month: "short"      // déc.
  });
}

function renderForecast(_, days) {
  if (!forecastList || !lastForecastData?.daily) return;

  const d = lastForecastData.daily;
  forecastList.innerHTML = "";

  const count = Math.min(days, d.time.length);

  for (let i = 0; i < count; i++) {
    const dateISO = d.time[i];

    const div = document.createElement("div");
    div.className = "forecast-item";
    div.dataset.dayIndex = i;

    div.innerHTML = `
      <div class="forecast-day">${formatForecastDate(dateISO)}</div>

      <div class="forecast-icon" data-label="${getWeatherLabel(d.weather_code[i])}">
        ${getWeatherIcon(d.weather_code[i])}
      </div>

      <div class="forecast-temps">
        <span class="max">${Math.round(d.temperature_2m_max[i])}°</span>
        <span class="min">${Math.round(d.temperature_2m_min[i])}°</span>
      </div>

      <div class="forecast-rain">
        ${d.precipitation_sum[i] ?? 0} mm
      </div>

      <div class="forecast-wind">
        ${Math.round(d.wind_speed_10m_max[i])} km/h
      </div>
    `;

    forecastList.appendChild(div);
  }

  activateForecastClicks(); // 🔥 indispensable
}

function activateForecastClicks() {
  const items = document.querySelectorAll(".forecast-item");

  items.forEach(item => {
    item.addEventListener("click", () => {
      const dayIndex = Number(item.dataset.dayIndex);
      if (isNaN(dayIndex)) return;

      openDayOverlay(dayIndex);
    });
  });
}

function labelForWeatherCode(code) {
  if (code === 0) return "Ciel clair";
  if ([1, 2, 3].includes(code)) return "Partiellement nuageux";
  if ([45, 48].includes(code)) return "Brouillard";
  if ([51, 53, 55].includes(code)) return "Bruine ou pluie légère";
  if ([61, 63, 65].includes(code)) return "Pluie";
  if ([71, 73, 75].includes(code)) return "Neige";
  if ([80, 81, 82].includes(code)) return "Averses";
  if ([95, 96, 99].includes(code)) return "Orage";
  return "Conditions variables";
}

function iconForWeatherCode(code) {
  // Open-Meteo weather codes
  if (code === 0) return "☀️";                       // ciel clair
  if (code === 1) return "🌤️";                       // peu nuageux
  if (code === 2) return "⛅";                        // partiellement nuageux
  if (code === 3) return "☁️";                       // couvert

  if (code === 45 || code === 48) return "🌫️";       // brouillard

  if ([51, 53, 55].includes(code)) return "🌦️";      // bruine
  if ([61, 63, 65].includes(code)) return "🌧️";      // pluie
  if ([80, 81, 82].includes(code)) return "🌧️";      // averses

  if ([71, 73, 75].includes(code)) return "🌨️";      // neige
  if ([85, 86].includes(code)) return "❄️";          // fortes chutes de neige

  if ([95].includes(code)) return "⛈️";               // orage
  if ([96, 99].includes(code)) return "🌩️";          // orage + grêle

  return "";
}

function updateForecastButtonsActiveState(active) {
    if (active === 7) {
        btnForecast7.classList.add("pill-button-active");
        btnForecast14.classList.remove("pill-button-active");
    } else if (active === 14) {
        btnForecast14.classList.add("pill-button-active");
        btnForecast7.classList.remove("pill-button-active");
    }
}


/* --------------------------------------------------------------------------
   14. DÉTAIL JOUR (graphiques température / pluie / vent)
-------------------------------------------------------------------------- */

function openDayOverlay(dayIndex) {
  if (!lastForecastData || !selectedCity) return;
  const d = lastForecastData.daily;
  const h = lastForecastData.hourly;

  const dayStr = d.time[dayIndex];
  const baseDate = new Date(dayStr + "T00:00:00");
  const nextDate = new Date(baseDate.getTime() + 24 * 60 * 60 * 1000);

  const times = h.time.map((t) => new Date(t));
  const hours = [];
  const temps = [];
  const rains = [];
  const winds = [];
  const humidities = [];

  for (let i = 0; i < times.length; i++) {
    const t = times[i];
    if (t >= baseDate && t < nextDate) {
      hours.push(t.getHours());
      temps.push(h.temperature_2m[i]);
      rains.push(h.precipitation[i]);
      winds.push(h.wind_speed_10m[i]);
      if (h.relative_humidity_2m) {
        humidities.push(Math.min(100, h.relative_humidity_2m[i]));
      }
    }
  }

  if (dayOverlayTitle) {
    dayOverlayTitle.textContent = `Détail pour ${selectedCity.name}`;
  }
  if (dayOverlaySubtitle) {
    dayOverlaySubtitle.textContent = new Date(dayStr).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    });
  }

  // Sauvegarde des séries pour chaque onglet (Temp / Pluie / Vent / Humidité)
  currentDaySeries = {
    hours,
    temps,
    rains,
    winds,
    humidities,
  };

  // Onglet par défaut : Température (traçage + animation luxe)
  setActiveDayTab("temp");

  if (dayOverlay) {
    dayOverlay.classList.add("active");
    document.body.classList.add("no-scroll");
  }
}

function closeDayOverlay() {
  if (!dayOverlay) return;
  dayOverlay.classList.remove("active");
  document.body.classList.remove("no-scroll");
}

if (btnCloseDay) {
  btnCloseDay.addEventListener("click", closeDayOverlay);
}

if (dayOverlay) {
  dayOverlay.addEventListener("click", (e) => {
    if (e.target.classList.contains("overlay-backdrop")) {
      closeDayOverlay();
    }
  });
}

function setActiveDayTab(kind) {
  if (!dayTabTemp || !dayTabRain || !dayTabWind || !dayTabHumidity) return;
  if (!dayGraphTemp || !dayGraphRain || !dayGraphWind || !dayGraphHumidity) return;

  dayTabTemp.classList.remove("pill-button-active");
  dayTabRain.classList.remove("pill-button-active");
  dayTabWind.classList.remove("pill-button-active");
  dayTabHumidity.classList.remove("pill-button-active");

  dayGraphTemp.classList.remove("active-day-graph");
  dayGraphRain.classList.remove("active-day-graph");
  dayGraphWind.classList.remove("active-day-graph");
  dayGraphHumidity.classList.remove("active-day-graph");

  if (kind === "temp") {
    dayTabTemp.classList.add("pill-button-active");
    dayGraphTemp.classList.add("active-day-graph");
  } else if (kind === "rain") {
    dayTabRain.classList.add("pill-button-active");
    dayGraphRain.classList.add("active-day-graph");
  } else if (kind === "wind") {
    dayTabWind.classList.add("pill-button-active");
    dayGraphWind.classList.add("active-day-graph");
  } else if (kind === "humidity") {
    dayTabHumidity.classList.add("pill-button-active");
    dayGraphHumidity.classList.add("active-day-graph");
  }

  // Re-dessine le graphe actif avec animation Luxe si les données du jour sont présentes
  if (!currentDaySeries) return;
  const { hours, temps, rains, winds, humidities } = currentDaySeries;

  if (kind === "temp" && chartTemp && temps.length) {
    drawSimpleLineChart(chartTemp, hours, temps, "°C");
  } else if (kind === "rain" && chartRain && rains.length) {
    drawSimpleLineChart(chartRain, hours, rains, "mm");
  } else if (kind === "wind" && chartWind && winds.length) {
    drawSimpleLineChart(chartWind, hours, winds, "km/h");
  } else if (kind === "humidity" && chartHumidity && humidities.length) {
    drawSimpleLineChart(chartHumidity, hours, humidities, "%");
  }
}

if (dayTabTemp && dayTabRain && dayTabWind && dayTabHumidity) {
  dayTabTemp.addEventListener("click", () => setActiveDayTab("temp"));
  dayTabRain.addEventListener("click", () => setActiveDayTab("rain"));
  dayTabWind.addEventListener("click", () => setActiveDayTab("wind"));
  dayTabHumidity.addEventListener("click", () => setActiveDayTab("humidity"));
}

if (forecastList) {
  forecastList.addEventListener("click", (e) => {
    const item = e.target.closest(".forecast-item");
    if (!item) return;
    const idx = Number(item.dataset.dayIndex ?? -1);
    if (idx >= 0) {
      openDayOverlay(idx);
    }
  });
}

/* petit moteur de graphique maison */


function drawSimpleLineChart(canvas, labels, values, unit) {
  if (!canvas || !canvas.getContext || !labels.length || !values.length) {
    const ctx = canvas && canvas.getContext && canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    return;
  }

  // ========== Préparation HiDPI (net sur tous les écrans) ==========
  const dpr = window.devicePixelRatio || 1;
  let rect = canvas.getBoundingClientRect();
  let cssWidth = rect.width;
  let cssHeight = rect.height;

  // Si le canvas est caché (display:none), sa taille vaut 0 : on prend alors la taille du parent
  if (!cssWidth || !cssHeight) {
    const parent = canvas.parentElement || canvas.closest(".day-popup") || canvas.closest(".day-overlay");
    if (parent) {
      const parentRect = parent.getBoundingClientRect();
      cssWidth = parentRect.width || 800;
      cssHeight = parentRect.height ? Math.min(parentRect.height * 0.45, 260) : 220;
    } else {
      cssWidth = 800;
      cssHeight = 220;
    }
  }

  // Taille CSS par défaut si encore indéfinie
  if (!cssWidth) cssWidth = 800;
  if (!cssHeight) cssHeight = 220;

  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const width = cssWidth;
  const height = cssHeight;

  const isNight = document.body.classList.contains("theme-night");
  const axisColor = isNight ? "rgba(240,240,255,0.9)" : "rgba(40,40,60,0.8)";
  const gridColor = isNight ? "rgba(240,240,255,0.25)" : "rgba(0,0,0,0.08)";
  const textColor = isNight ? "rgba(240,240,255,0.95)" : "rgba(30,30,50,0.9)";

  const paddingLeft = 44;
  const paddingRight = 18;
  const paddingTop = 18;
  const paddingBottom = 30;

  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  // 1) Nettoyage et clamp des valeurs selon l'unité
  let cleanValues = values.map((v) => {
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  });

  if (unit === "%") {
    cleanValues = cleanValues.map((v) => Math.min(100, Math.max(0, v)));
  }
  if (unit === "mm" || unit === "km/h") {
    cleanValues = cleanValues.map((v) => Math.max(0, v));
  }

  let minVal = Math.min(...cleanValues);
  let maxVal = Math.max(...cleanValues);

  if (unit === "%") {
    minVal = 0;
    maxVal = 100;
  } else {
    if (minVal === maxVal) {
      minVal -= 1;
      maxVal += 1;
    }
    const paddingValue = (maxVal - minVal) * 0.15;
    minVal -= paddingValue;
    maxVal += paddingValue;

    if (unit === "mm" || unit === "km/h") {
      minVal = Math.max(0, minVal);
    }
  }

  const range = maxVal - minVal || 1;

  function xForIndex(i) {
    if (labels.length === 1) return paddingLeft + plotWidth / 2;
    return paddingLeft + (plotWidth * i) / (labels.length - 1);
  }

  function yForValue(v) {
    const ratio = (v - minVal) / range;
    return paddingTop + plotHeight * (1 - ratio);
  }

  // Pré-calcul des points
  const points = cleanValues.map((v, i) => ({
    x: xForIndex(i),
    y: yForValue(v),
  }));

  // Couleur de courbe par type
  let color = "#ff6f61"; // Température
  if (unit === "mm") color = "#4a90e2";    // Pluie
  if (unit === "km/h") color = "#34c759";  // Vent
  if (unit === "%") color = "#af52de";     // Humidité

  // ======= FONCTION DE DESSIN STATIQUE (axes + grille + labels) =======
  function drawStaticFrame() {
    // Grille horizontale (lignes sur demi‑pixel)
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    const gridLines = 3;
    for (let i = 0; i <= gridLines; i++) {
      const y = Math.round(paddingTop + (plotHeight * i) / gridLines) + 0.5;
      ctx.beginPath();
      ctx.moveTo(Math.round(paddingLeft) + 0.5, y);
      ctx.lineTo(Math.round(paddingLeft + plotWidth) + 0.5, y);
      ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 1.2;
    const xAxisY = Math.round(paddingTop + plotHeight) + 0.5;
    const yAxisX = Math.round(paddingLeft) + 0.5;

    ctx.beginPath();
    ctx.moveTo(yAxisX, Math.round(paddingTop) + 0.5);
    ctx.lineTo(yAxisX, xAxisY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(yAxisX, xAxisY);
    ctx.lineTo(Math.round(paddingLeft + plotWidth) + 0.5, xAxisY);
    ctx.stroke();

    // Labels Y
    ctx.fillStyle = textColor;
    ctx.font =
      "11px system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    const stepsY = 3;
    let previousLabel = null;
    for (let i = 0; i <= stepsY; i++) {
      const ratio = i / stepsY;
      const val = maxVal - range * ratio;
      let labelVal = val;

      if (unit === "%") {
        if (labelVal < 0) labelVal = 0;
        if (labelVal > 100) labelVal = 100;
        labelVal = Math.round(labelVal);
      } else if (unit === "km/h" || unit === "°C") {
        labelVal = Math.round(labelVal);
        if (unit === "km/h" && labelVal < 0) labelVal = 0;
      } else if (unit === "mm") {
        labelVal = Math.round(labelVal * 10) / 10;
        if (Math.abs(labelVal) < 0.05) labelVal = 0;
      } else {
        labelVal = Math.round(labelVal);
      }

      let label = "";
      if (unit === "°C") label = `${labelVal}°C`;
      else if (unit === "mm") {
        const str =
          labelVal % 1 === 0 ? labelVal.toFixed(0) : labelVal.toFixed(1);
        label = `${str}mm`;
      } else if (unit === "km/h") label = `${labelVal}km/h`;
      else if (unit === "%") label = `${labelVal}%`;
      else label = String(labelVal);

      if (label === previousLabel) {
        continue;
      }
      previousLabel = label;

      const y = yForValue(val);
      ctx.fillText(label, paddingLeft - 6, y);
    }

    // Labels X
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    let stepX = 1;
    if (labels.length > 8) {
      stepX = Math.ceil(labels.length / 8);
    }

    for (let i = 0; i < labels.length; i += stepX) {
      const x = xForIndex(i);
      const y = paddingTop + plotHeight + 4;
      ctx.fillText(labels[i], x, y);
    }
  }

  // ========== ANIMATION LUXE (courbe + points + léger glow) ==========
  const duration = 480; // ms
  const start = performance.now();
  const animId = (canvas._msAnimId || 0) + 1;
  canvas._msAnimId = animId;

  function easeInOutCubic(t) {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function renderFrame(now) {
    if (canvas._msAnimId !== animId) return; // une nouvelle anim a commencé

    const elapsed = now - start;
    const t = Math.max(0, Math.min(1, elapsed / duration));
    const eased = easeInOutCubic(t);

    // On redessine tout à chaque frame pour rester net
    ctx.clearRect(0, 0, width, height);
    drawStaticFrame();

    // Déterminer jusqu'où dessiner la courbe
    const lastIndexFloat = (points.length - 1) * eased;
    const lastIndex = Math.floor(lastIndexFloat);
    const frac = lastIndexFloat - lastIndex;

    // Glow léger
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.shadowColor = color + "66";
    ctx.shadowBlur = 10;

    ctx.beginPath();
    points.forEach((pt, i) => {
      if (i === 0) {
        ctx.moveTo(pt.x, pt.y);
      } else if (i <= lastIndex) {
        ctx.lineTo(pt.x, pt.y);
      } else if (i === lastIndex + 1 && frac > 0) {
        const prev = points[lastIndex];
        const nx = prev.x + (pt.x - prev.x) * frac;
        const ny = prev.y + (pt.y - prev.y) * frac;
        ctx.lineTo(nx, ny);
      }
    });
    ctx.stroke();

    // Points
    ctx.shadowBlur = 8;
    points.forEach((pt, i) => {
      if (i > lastIndex + 1) return;
      let factor = 0.7;
      if (i === lastIndex || i === lastIndex + 1) {
        factor = 0.7 + 0.3 * eased;
      }
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2.4 * factor, 0, Math.PI * 2);
      ctx.fill();
    });

    // Réinitialiser les ombres pour éviter de polluer le reste
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";

    if (t < 1) {
      requestAnimationFrame(renderFrame);
    }
  }

  requestAnimationFrame(renderFrame);
}
/* --------------------------------------------------------------------------
   15. MÉTÉO PARLÉE
-------------------------------------------------------------------------- */

if (btnSpeak) {
  btnSpeak.addEventListener("click", () => {
    if (!selectedCity) {
      speech("Aucune ville n'est sélectionnée pour la météo parlée.");
      return;
    }

    const j = weatherCache[selectedCity.name];
    if (!j || !j.current) {
      speech("Les données ne sont pas encore disponibles.");
      return;
    }

    const c = j.current;

    const text = `
    Voici la météo pour ${selectedCity.name} :
    Température actuelle ${c.temperature_2m} degrés.
    Humidité ${Math.min(100, c.relative_humidity_2m)} pour cent.
    Vent ${c.wind_speed_10m} kilomètres par heure,
    direction ${degreeToCardinal(c.wind_direction_10m)}.
  `;

    speech(text);
  });
}

function speech(txt) {
  const synth = window.speechSynthesis;
  if (!synth) return;
  const utter = new SpeechSynthesisUtterance(txt);
  utter.lang = "fr-FR";
  synth.speak(utter);
}

/* --------------------------------------------------------------------------
   16. RADAR POPUP (RainViewer + Open-Meteo + Temp + Vent)
-------------------------------------------------------------------------- */

/**
 * - RainViewer : radar réel pour les 2 dernières heures (pluie).
 * - Open-Meteo : timeline animée pour les prochaines heures (pluie / vent / température).
 * - OpenWeather : tuiles vent / température.
 * - Bouton "Radar réel / Radar futur".
 * - Bouton "Résumé pluie -2 h".
 */

const OPENWEATHER_API_KEY = "c63f9893f5d21327a9c390818db9f240";
const RAINVIEWER_API_URL = "https://api.rainviewer.com/public/weather-maps.json";

let radarTemporalMode = "real"; // "real" | "future"
let radarVariable = "rain";     // "rain" | "wind" | "temp"

let radarMapInstance = null;
let radarBaseLayer = null;
let radarTileLayer = null;
let radarFutureOverlay = null;

// RainViewer (radar réel -2 h)
let rainviewerMeta = null;
let rainviewerPastFrames = [];
let rainviewerHost = "";
let rainviewerTileLayer = null;
let rainviewerAnimTimer = null;

// Timeline animation (Open-Meteo)
let radarTimelinePlaying = false;
let radarTimelineTimer = null;

// Bouton résumé pluie -2 h
let radarSummaryButton = null;
const radarLegend = document.querySelector(".radar-legend");

if (radarLegend) {
  radarSummaryButton = document.createElement("button");
  radarSummaryButton.id = "radar-summary-button";
  radarSummaryButton.className = "pill-button radar-summary-button";
  radarSummaryButton.textContent = "Résumé pluie -2 h";
  radarLegend.appendChild(radarSummaryButton);
}

/* 16.1 – Utilitaires RainViewer & Open-Meteo */

async function loadRainviewerMeta() {
  if (rainviewerMeta) return;
  try {
    const res = await fetch(RAINVIEWER_API_URL);
    const data = await res.json();
    rainviewerMeta = data;
    rainviewerHost = data.host || "https://tilecache.rainviewer.com";
    if (data.radar && Array.isArray(data.radar.past)) {
      const arr = data.radar.past;
      rainviewerPastFrames = arr.slice(Math.max(0, arr.length - 12));
    }
  } catch (err) {
    console.error("Erreur RainViewer:", err);
  }
}

function applyRainviewerFrame(index) {
  if (!radarMapInstance || !rainviewerPastFrames.length) return;

  if (rainviewerTileLayer) {
    radarMapInstance.removeLayer(rainviewerTileLayer);
    rainviewerTileLayer = null;
  }

  const frame = rainviewerPastFrames[index];
  if (!frame || !frame.path) return;

  const url = `${rainviewerHost}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`;

  rainviewerTileLayer = L.tileLayer(url, {
    opacity: 0.8,
  });
  rainviewerTileLayer.addTo(radarMapInstance);
}

function startRainviewerAnimation() {
  stopRainviewerAnimation();
  if (!radarMapInstance || !rainviewerPastFrames.length) return;

  let idx = 0;
  applyRainviewerFrame(idx);

  rainviewerAnimTimer = setInterval(() => {
    idx = (idx + 1) % rainviewerPastFrames.length;
    applyRainviewerFrame(idx);
  }, 650);
}

function stopRainviewerAnimation() {
  if (rainviewerAnimTimer) {
    clearInterval(rainviewerAnimTimer);
    rainviewerAnimTimer = null;
  }
  if (radarMapInstance && rainviewerTileLayer) {
    radarMapInstance.removeLayer(rainviewerTileLayer);
    rainviewerTileLayer = null;
  }
}

function getRadarBaseIndex(hourlyTimes) {
  const now = new Date();
  for (let i = 0; i < hourlyTimes.length; i++) {
    const t = new Date(hourlyTimes[i]);
    if (t >= now) return i;
  }
  return 0;
}

function updateRadarWindowLabel(baseIndex, startIndex, horizonHours) {
  if (!radarWindowText) return;
  const diffHours = Math.max(0, startIndex - baseIndex);
  const startH = diffHours;
  const endH = diffHours + horizonHours;
  if (diffHours === 0) {
    radarWindowText.textContent = `Maintenant → +${horizonHours} h`;
  } else {
    radarWindowText.textContent = `+${startH} h → +${endH} h`;
  }
}

/* 16.1 bis – Carte Leaflet (vue monde + zoom ville) */

function ensureRadarMap() {
  // 1. Création de la carte si besoin
  if (!radarMapInstance) {
    radarMapInstance = L.map("radar-map", {
      zoomControl: false,
      attributionControl: false,
    });
  }

  // 2. Fond de carte OSM : zoom proche ET vue monde
  if (!radarBaseLayer) {
    radarBaseLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 15, // zoom ville
      minZoom: 2,  // vue monde
    });
    radarBaseLayer.addTo(radarMapInstance);
  }

  // 3. Si aucune ville → vue monde
  if (!selectedCity || !selectedCity.lat || !selectedCity.lon) {
    radarMapInstance.setView([20, 0], 3);
    return;
  }

  // 4. Ville sélectionnée → zoom proche
  radarMapInstance.setView([selectedCity.lat, selectedCity.lon], 13);
}

/* 16.2 – Timeline radar (pluie / vent / température) */

function getOpenWeatherLayerName() {
  if (radarVariable === "wind") return "wind_new";
  if (radarVariable === "temp") return "temp_new";
  return "precipitation_new";
}

function refreshOpenWeatherLayer() {
  if (!radarMapInstance) return;

  if (radarTemporalMode === "real" && radarVariable === "rain") {
    if (radarTileLayer) {
      radarMapInstance.removeLayer(radarTileLayer);
      radarTileLayer = null;
    }
    return;
  }

  if (radarTileLayer) {
    radarMapInstance.removeLayer(radarTileLayer);
    radarTileLayer = null;
  }

  if (!OPENWEATHER_API_KEY || OPENWEATHER_API_KEY === "A_METTRE_ICI") {
    return;
  }

  const layerName = getOpenWeatherLayerName();
  const url = `https://tile.openweathermap.org/map/${layerName}/{z}/{x}/{y}.png?appid=${OPENWEATHER_API_KEY}`;

  radarTileLayer = L.tileLayer(url, {
    opacity: 0.7,
  });
  radarTileLayer.addTo(radarMapInstance);
}

function updateFutureOverlay(variable, intensity) {
  if (!radarMapInstance || !selectedCity) return;

  if (radarFutureOverlay) {
    radarMapInstance.removeLayer(radarFutureOverlay);
    radarFutureOverlay = null;
  }

  if (!intensity || intensity === 0) {
    return;
  }

  let fillColor = "rgba(79,141,255,0.25)";
  let fillOpacity = 0.25;

  if (variable === "rain") {
    if (intensity === 1) {
      fillColor = "rgba(74,157,255,0.25)";
      fillOpacity = 0.25;
    } else if (intensity === 2) {
      fillColor = "rgba(245,208,52,0.32)";
      fillOpacity = 0.32;
    } else if (intensity === 3) {
      fillColor = "rgba(255,74,74,0.40)";
      fillOpacity = 0.40;
    }
  } else if (variable === "wind") {
    if (intensity === 1) {
      fillColor = "rgba(53,214,156,0.25)";
      fillOpacity = 0.25;
    } else if (intensity === 2) {
      fillColor = "rgba(255,154,60,0.32)";
      fillOpacity = 0.32;
    } else if (intensity === 3) {
      fillColor = "rgba(255,74,74,0.40)";
      fillOpacity = 0.40;
    }
  } else if (variable === "temp") {
    if (intensity === 1) {
      fillColor = "rgba(15,23,42,0.35)";
      fillOpacity = 0.35;
    } else if (intensity === 2) {
      fillColor = "rgba(251,191,36,0.32)";
      fillOpacity = 0.32;
    } else if (intensity === 3) {
      fillColor = "rgba(185,28,28,0.40)";
      fillOpacity = 0.40;
    }
  }

  radarFutureOverlay = L.circle([selectedCity.lat, selectedCity.lon], {
    radius: 25000,
    color: "transparent",
    fillColor,
    fillOpacity,
    stroke: false,
  });

  radarFutureOverlay.addTo(radarMapInstance);
}

function applyRadarGridModeClass() {
  if (!radarGrid) return;
  radarGrid.classList.remove("radar-grid-rain", "radar-grid-wind", "radar-grid-temp");
  if (radarVariable === "rain") radarGrid.classList.add("radar-grid-rain");
  else if (radarVariable === "wind") radarGrid.classList.add("radar-grid-wind");
  else if (radarVariable === "temp") radarGrid.classList.add("radar-grid-temp");
}

function renderRadarTimeline() {
  if (!radarGrid || !selectedCity) return;
  const data = weatherCache[selectedCity.name];
  if (!data || !data.hourly || !data.hourly.time || !data.hourly.time.length) return;

  const h = data.hourly;
  const baseIndex = getRadarBaseIndex(h.time);

  let horizonHours = 12;
  let maxOffset = 0;

  if (radarVariable === "rain") {
    if (radarTemporalMode === "future") {
      horizonHours = 3;
      maxOffset = 12;
    } else {
      horizonHours = 12;
      maxOffset = Math.min(12, Math.max(0, h.time.length - baseIndex - horizonHours));
    }
  } else {
    const maxPossible = Math.max(0, h.time.length - baseIndex - horizonHours);
    maxOffset = Math.min(36, maxPossible);
  }

  let offset = 0;
  if (radarTimelineSlider) {
    radarTimelineSlider.min = "0";
    radarTimelineSlider.max = String(maxOffset);
    offset = Math.min(maxOffset, Number(radarTimelineSlider.value || "0"));
  }

  let startIndex = baseIndex + offset;
  const maxStart = Math.max(0, h.time.length - horizonHours);
  if (startIndex < 0) startIndex = 0;
  if (startIndex > maxStart) startIndex = maxStart;

  radarGrid.innerHTML = "";
  updateRadarWindowLabel(baseIndex, startIndex, horizonHours);

  let overlayIntensity = 0;
  const midIndexInWindow = Math.floor(horizonHours / 2);

  for (let i = 0; i < horizonHours; i++) {
    const idx = startIndex + i;
    if (idx >= h.time.length) break;
    const time = new Date(h.time[idx]);

    let value = 0;
    let intensity = 0;

    if (radarVariable === "rain") {
      value =
        h.rain && h.rain[idx] != null
          ? h.rain[idx]
          : h.precipitation && h.precipitation[idx] != null
          ? h.precipitation[idx]
          : 0;
      if (value === 0) intensity = 0;
      else if (value < 0.2) intensity = 1;
      else if (value < 1) intensity = 2;
      else intensity = 3;
    } else if (radarVariable === "wind") {
      value =
        h.wind_speed_10m && h.wind_speed_10m[idx] != null ? h.wind_speed_10m[idx] : 0;
      if (value < 15) intensity = 1;
      else if (value < 35) intensity = 2;
      else intensity = 3;
    } else if (radarVariable === "temp") {
      value =
        h.temperature_2m && h.temperature_2m[idx] != null ? h.temperature_2m[idx] : 0;
      if (value < 0) intensity = 1;
      else if (value < 20) intensity = 2;
      else intensity = 3;
    }

    const hourLabel = time.getHours().toString().padStart(2, "0") + "h";

    const cell = document.createElement("div");
    cell.className = "radar-cell";
    cell.dataset.intensity = intensity.toString();
    cell.innerHTML = `
      <div class="radar-bar"></div>
      <div class="radar-hour">${hourLabel}</div>
    `;
    radarGrid.appendChild(cell);

    if (i === midIndexInWindow) {
      overlayIntensity = intensity;
    }
  }

  if (radarTemporalMode === "future") {
    updateFutureOverlay(radarVariable, overlayIntensity);
  } else if (radarFutureOverlay && radarMapInstance) {
    radarMapInstance.removeLayer(radarFutureOverlay);
    radarFutureOverlay = null;
  }
}
function updateRadarLegend() {
  const lr = document.querySelector(".legend-rain");
  const lw = document.querySelector(".legend-wind");
  const lt = document.querySelector(".legend-temp");

  if (!lr || !lw || !lt) return;

  lr.classList.add("hidden");
  lw.classList.add("hidden");
  lt.classList.add("hidden");

  if (radarVariable === "rain") lr.classList.remove("hidden");
  if (radarVariable === "wind") lw.classList.remove("hidden");
  if (radarVariable === "temp") lt.classList.remove("hidden");
}
function updateLegend() {
  const container = document.getElementById("legend-container");
  if (!container) return;

  container.classList.remove("hidden");

  const groups = container.querySelectorAll(".legend-group");
  groups.forEach(g => g.classList.add("hidden"));

  const active = container.querySelector(`[data-type="${radarVariable}"]`);
  if (active) active.classList.remove("hidden");
}

function resetRadarTimelineToNow() {
  if (!selectedCity) return;
  const data = weatherCache[selectedCity.name];
  if (!data || !data.hourly || !data.hourly.time || !data.hourly.time.length) return;

  const h = data.hourly;
  const baseIndex = getRadarBaseIndex(h.time);

  let horizonHours = 12;
  let maxOffset = 0;

  if (radarVariable === "rain" && radarTemporalMode === "future") {
    horizonHours = 3;
    maxOffset = 12;
  } else if (radarVariable === "rain") {
    horizonHours = 12;
    maxOffset = Math.min(12, Math.max(0, h.time.length - baseIndex - horizonHours));
  } else {
    horizonHours = 12;
    const maxPossible = Math.max(0, h.time.length - baseIndex - horizonHours);
    maxOffset = Math.min(36, maxPossible);
  }

  if (radarTimelineSlider) {
    radarTimelineSlider.min = "0";
    radarTimelineSlider.max = String(maxOffset);
    radarTimelineSlider.value = "0";
  }

  updateRadarWindowLabel(baseIndex, baseIndex, horizonHours);
  renderRadarTimeline();
}

/* 16.3 – Pluie / Vent / Temp : changement d'onglet & ouverture radar */

function setRadarMode(kind) {
  radarVariable = kind;
  applyRadarGridModeClass();
   updateRadarLegend();

  if (radarTabRain && radarTabWind && radarTabTemp) {
    radarTabRain.classList.remove("radar-tab-active");
    radarTabWind.classList.remove("radar-tab-active");
    radarTabTemp.classList.remove("radar-tab-active");

    if (kind === "rain") radarTabRain.classList.add("radar-tab-active");
    else if (kind === "wind") radarTabWind.classList.add("radar-tab-active");
    else if (kind === "temp") radarTabTemp.classList.add("radar-tab-active");
  }

  if (radarTemporalMode === "real" && radarVariable === "rain") {
    loadRainviewerMeta().then(() => {
      startRainviewerAnimation();
    });
  } else {
    stopRainviewerAnimation();
    refreshOpenWeatherLayer();
  }

  resetRadarTimelineToNow();
   updateLegend();
}

function openRadarOverlay() {
  if (!selectedCity) {
    showToast("Ajoute d'abord une ville pour afficher le radar.");
    return;
  }

  radarOverlay.classList.remove("hidden");
  radarOverlay.classList.add("active");
  document.body.classList.add("no-scroll");

  setTimeout(() => {
    ensureRadarMap();
    if (radarMapInstance) {
      radarMapInstance.invalidateSize();
    }

    applyRadarGridModeClass();
     updateLegend();


    if (radarTemporalMode === "real" && radarVariable === "rain") {
      loadRainviewerMeta().then(() => {
        startRainviewerAnimation();
      });
    } else {
      stopRainviewerAnimation();
      refreshOpenWeatherLayer();
    }

    resetRadarTimelineToNow();
  }, 60);
}

/* 16.4 – Résumé pluie des 2 dernières heures */

function summarizePastRain() {
  if (!selectedCity) {
    showToast("Aucune ville sélectionnée.", "error");
    return;
  }

  const data = weatherCache[selectedCity.name];
  if (!data || !data.hourly || !data.hourly.time || !data.hourly.time.length) {
    showToast("Données météo indisponibles.", "error");
    return;
  }

  const h = data.hourly;
  const times = h.time.map((t) => new Date(t));
  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  let totalRain = 0;
  let maxRain = 0;
  let firstRainTime = null;
  let lastRainTime = null;

  for (let i = 0; i < times.length; i++) {
    const t = times[i];
    if (t >= twoHoursAgo && t <= now) {
      const val =
        h.rain && h.rain[i] != null
          ? h.rain[i]
          : h.precipitation && h.precipitation[i] != null
          ? h.precipitation[i]
          : 0;
      if (val > 0) {
        totalRain += val;
        maxRain = Math.max(maxRain, val);
        if (!firstRainTime) firstRainTime = t;
        lastRainTime = t;
      }
    }
  }

  if (!firstRainTime) {
    showToast("Aucune pluie détectée sur les 2 dernières heures.", "info");
    return;
  }

  const formatHour = (d) =>
    d.getHours().toString().padStart(2, "0") +
    "h" +
    d.getMinutes().toString().padStart(2, "0");

  let maxLabel = "";
  if (maxRain < 0.2) maxLabel = "faible";
  else if (maxRain < 1) maxLabel = "modérée";
  else maxLabel = "forte / très forte";

  const msg = `Pluie entre ${formatHour(firstRainTime)} et ${formatHour(
    lastRainTime
  )} · cumul ~${totalRain.toFixed(1)} mm · intensité max ${maxLabel}.`;

  showToast(msg, "success");
}

/* 16.5 – Animation timeline & écouteurs */

function startRadarTimelineAnimation() {
  if (!radarTimelineSlider) return;
  radarTimelinePlaying = true;
  radarPlay.textContent = "⏸";
  if (radarTimelineTimer) {
    clearInterval(radarTimelineTimer);
  }

  radarTimelineTimer = setInterval(() => {
    if (!radarTimelineSlider) return;
    const max = Number(radarTimelineSlider.max || "0");
    let val = Number(radarTimelineSlider.value || "0");
    if (val >= max) {
      val = 0;
    } else {
      val += 1;
    }
    radarTimelineSlider.value = String(val);
    renderRadarTimeline();
  }, 900);
}

function stopRadarTimelineAnimation() {
  radarTimelinePlaying = false;
  radarPlay.textContent = "▶︎";
  if (radarTimelineTimer) {
    clearInterval(radarTimelineTimer);
    radarTimelineTimer = null;
  }
}

/* --- Écouteurs RADAR --- */

if (btnRadar && radarOverlay) {
  btnRadar.addEventListener("click", openRadarOverlay);
}

if (btnCloseRadar) {
  const closeRadar = () => {
    radarOverlay.classList.remove("active");
    radarOverlay.classList.add("hidden");
    document.body.classList.remove("no-scroll");
    stopRainviewerAnimation();
    stopRadarTimelineAnimation();
    if (radarFutureOverlay && radarMapInstance) {
      radarMapInstance.removeLayer(radarFutureOverlay);
      radarFutureOverlay = null;
    }
  };

  // 🖱️ Desktop
  btnCloseRadar.addEventListener("click", closeRadar);

  // 📱 iOS (Safari + Chrome)
  btnCloseRadar.addEventListener("touchstart", (e) => {
    e.preventDefault();
    closeRadar();
  });
}

if (radarTabRain && radarTabWind && radarTabTemp) {
  radarTabRain.addEventListener("click", () => setRadarMode("rain"));
  radarTabWind.addEventListener("click", () => setRadarMode("wind"));
  radarTabTemp.addEventListener("click", () => setRadarMode("temp"));
}

if (radarTimelineSlider) {
  radarTimelineSlider.addEventListener("input", () => {
    renderRadarTimeline();
  });
}

if (radarModeToggle) {
  radarModeToggle.addEventListener("click", () => {
    radarTemporalMode = radarTemporalMode === "real" ? "future" : "real";
    radarModeToggle.textContent =
      radarTemporalMode === "real" ? "Radar réel" : "Radar futur";

    if (radarTemporalMode === "real" && radarVariable === "rain") {
      stopRadarTimelineAnimation();
      loadRainviewerMeta().then(() => {
        startRainviewerAnimation();
      });
    } else {
      stopRainviewerAnimation();
      refreshOpenWeatherLayer();
      resetRadarTimelineToNow();
    }
  });
}

if (radarPlay) {
  radarPlay.addEventListener("click", () => {
    if (radarTemporalMode === "real" && radarVariable === "rain") {
      radarTemporalMode = "future";
      radarModeToggle.textContent = "Radar futur";
      stopRainviewerAnimation();
      refreshOpenWeatherLayer();
      resetRadarTimelineToNow();
    }

    if (radarTimelinePlaying) {
      stopRadarTimelineAnimation();
    } else {
      startRadarTimelineAnimation();
    }
  });
}

if (radarSummaryButton) {
  radarSummaryButton.addEventListener("click", summarizePastRain);
}

/* --------------------------------------------------------------------------
   17. INITIALISATION
-------------------------------------------------------------------------- */
async function onGeoSuccess(position) {
  const lat = position.coords.latitude;
  const lon = position.coords.longitude;

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=fr`;
    const r = await fetch(url);
    const j = await r.json();
    const info = j?.results?.[0];

    const cityName =
      info?.name || `Position (${lat.toFixed(2)}, ${lon.toFixed(2)})`;
    const countryName = info?.country || "—";

    addCity({
      name: cityName,
      country: countryName,
      lat,
      lon,
      isCurrentLocation: true,
    });

    hideToast(); // nettoie tout message précédent
    setGeolocateSuccess(cityName);

  } catch (err) {
    console.error("Erreur géocodage inverse", err);
    geolocateByIp(); // fallback IP propre
  }
}

function onGeoError(err) {
  console.warn("Erreur géolocalisation navigateur", err);
  geolocateByIp(); // fallback IP
}

function init() {
  loadSavedCities();

  // 🔁 Charger la météo de toutes les villes sauvegardées
  if (Array.isArray(cities) && cities.length > 0) {
    cities.forEach(ci => {
      loadCityWeather(ci);
    });
  }

  // 🎨 Thème sauvegardé
  const savedTheme = localStorage.getItem("themeMode");
  if (savedTheme === "day" || savedTheme === "night" || savedTheme === "auto") {
    themeMode = savedTheme;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  init();

  if (dayOverlay) {
    dayOverlay.classList.remove("active", "active-day-overlay");
  }
});


/* --------------------------------------------------------------------------
   15. HISTORIQUE METEO (ONGLET DISCRET)
-------------------------------------------------------------------------- */

async function fetchHistoricalWeather(ci, dateStr) {
  if (!ci || !dateStr) return null;

  try {
    const url =
      "https://archive-api.open-meteo.com/v1/archive" +
      `?latitude=${ci.lat}&longitude=${ci.lon}` +
      `&start_date=${dateStr}&end_date=${dateStr}` +
      "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max" +
      "&timezone=auto";

    const r = await fetch(url);
    const j = await r.json();

    // Lever / coucher du soleil (jour courant) – heures locales
    if (j.daily && j.daily.sunrise && j.daily.sunset) {
      const sr = new Date(j.daily.sunrise[0]);
      const ss = new Date(j.daily.sunset[0]);
      citySunriseHour = sr.getHours() + sr.getMinutes() / 60;
      citySunsetHour  = ss.getHours() + ss.getMinutes() / 60;
    } else {
      citySunriseHour = null;
      citySunsetHour = null;
    }

    if (!j || !j.daily || !j.daily.time || !j.daily.time.length) {
      return null;
    }
    return {
      date: j.daily.time[0],
      tmax: j.daily.temperature_2m_max[0],
      tmin: j.daily.temperature_2m_min[0],
      rain: j.daily.precipitation_sum[0],
      wind: j.daily.wind_speed_10m_max[0],
    };
  } catch (err) {
    console.error("Erreur historique", err);
    return null;
  }
}

function enterHistoryMode() {
  if (!selectedCity || !detailsHistory || !detailsCurrent) {
    showToast("Sélectionne d'abord une ville.", "info");
    return;
  }

  // masque l'affichage actuel + boussole
  detailsCurrent.classList.add("hidden");
  const windBlock = document.querySelector(".wind-block");
  if (windBlock) windBlock.classList.add("hidden");

  // prépare la carte historique (un seul bloc)
  const today = new Date();
  const defaultYear = Math.max(today.getFullYear() - 1, 1925);
  const def = new Date(today);
  def.setFullYear(defaultYear);
  const defStr = formatDateISO(def);

  detailsHistory.classList.remove("hidden");
  detailsHistory.innerHTML = `
    <div class="detail-label">Historique météo</div>
    <div class="history-controls">
      <label class="history-label" for="history-date">Date :</label>
      <input id="history-date" class="history-date-input" type="date" min="1925-01-01" max="${formatDateISO(today)}" value="${defStr}" />
      <button id="btn-history-load" class="pill-button history-load-button">Afficher</button>
    </div>
    <div id="history-result" class="history-result">
      <p class="history-hint">Choisis une date pour voir la météo passée.</p>
    </div>
    <div class="history-footer">
      <button id="btn-history-back" class="ghost-button history-back-button">⬅ Retour aux données actuelles</button>
    </div>
  `;

  const btnLoad = document.getElementById("btn-history-load");
  const inputDate = document.getElementById("history-date");
  const btnBack = document.getElementById("btn-history-back");

  if (btnLoad && inputDate) {
    btnLoad.addEventListener("click", async () => {
      const d = inputDate.value;
      if (!d) return;
      const res = await fetchHistoricalWeather(selectedCity, d);
      const resultEl = document.getElementById("history-result");
      if (!resultEl) return;

      if (!res) {
        resultEl.innerHTML =
          '<p class="history-error">Données indisponibles pour cette date. Essaie une autre date.</p>';
        return;
      }

      resultEl.innerHTML = `
        <div class="history-values">
          <div class="history-line"><span>Date :</span><span>${new Date(
            res.date
          ).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</span></div>
          <div class="history-line"><span>Température max :</span><span>${res.tmax}°C</span></div>
          <div class="history-line"><span>Température min :</span><span>${res.tmin}°C</span></div>
          <div class="history-line"><span>Pluie :</span><span>${res.rain} mm</span></div>
          <div class="history-line"><span>Vent max :</span><span>${res.wind} km/h</span></div>
        </div>
      `;
    });
  }

  if (btnBack) {
    btnBack.addEventListener("click", exitHistoryMode);
  }
}

function exitHistoryMode() {
  if (!detailsHistory || !detailsCurrent) return;
  detailsHistory.classList.add("hidden");
  detailsHistory.innerHTML = "";
  detailsCurrent.classList.remove("hidden");
  const windBlock = document.querySelector(".wind-block");
  if (windBlock) windBlock.classList.remove("hidden");
}

// bouton dans le header des détails
if (btnHistory) {
  btnHistory.addEventListener("click", enterHistoryMode);
}

/* ===========================================================
   PLUIE REALISTE – INITIALISATION & CONTROLE
   =========================================================== */

let rainInitialized = false;
let rainCanvas = null;
let rainCtx = null;

/* ==== RAIN VISUAL TUNING (SAFE OVERRIDE) ==== */
const RAIN_MIN_LENGTH = 6;
const RAIN_MAX_LENGTH = 12;
const RAIN_MIN_SPEED  = 7;
const RAIN_MAX_SPEED  = 12;
const RAIN_WIDTH      = 0.8;
/* =========================================== */

let rainDrops = [];
let rainRunning = false;
let rainVX = 0;

function initRainScene() {
  if (rainInitialized) return;
  const scene = document.getElementById("rain-scene");
  if (!scene) return;
  rainInitialized = true;

  rainCanvas = document.createElement("canvas");
  rainCanvas.id = "rain-canvas";
  rainCanvas.style.position = "absolute";
  rainCanvas.style.inset = "0";
  rainCanvas.style.width = "100%";
  rainCanvas.style.height = "100%";
  rainCanvas.style.pointerEvents = "none";
  scene.appendChild(rainCanvas);

  rainCtx = rainCanvas.getContext("2d");
  resizeRainCanvas();
  window.addEventListener("resize", resizeRainCanvas);
}

function resizeRainCanvas() {
  if (!rainCanvas || !rainCtx) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = rainCanvas.getBoundingClientRect();
  rainCanvas.width = rect.width * dpr;
  rainCanvas.height = rect.height * dpr;
  rainCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function createRainDrops(intensity) {
  if (!rainCanvas) return;
  rainDrops = [];

  const rect = rainCanvas.getBoundingClientRect();
  const width = rect.width || window.innerWidth;
  const height = rect.height || window.innerHeight;

  const count = Math.min(220, Math.floor(100 + intensity * 160));

  for (let i = 0; i < count; i++) {
    rainDrops.push({
      x: Math.random() * width,
      y: Math.random() * height,
      len: Math.random(),
      speed: 55 + Math.random() * 55,   // ✅ très rapide
      thickness: 0.6 + Math.random() * 0.5,
      alpha: 0.25 + Math.random() * 0.25
    });
  }
}


function startRain(intensity) {
  if (!rainCanvas || !rainCtx) initRainScene();
  if (!rainCanvas || !rainCtx) return;
  createRainDrops(intensity);
  if (!rainRunning) {
    rainRunning = true;
    requestAnimationFrame(animateRain);
  }
}

function stopRain() {
  rainRunning = false;
  if (rainCtx && rainCanvas) {
    rainCtx.clearRect(0, 0, rainCanvas.width, rainCanvas.height);
  }
}

function animateRain() {
  if (!rainRunning || !rainCtx || !rainCanvas) return;

  const dpr = window.devicePixelRatio || 1;
  const w = rainCanvas.width;
  const h = rainCanvas.height;
  const viewW = w / dpr;
  const viewH = h / dpr;

  rainCtx.clearRect(0, 0, w, h);

  // angle constant, PAS de trig par goutte
  const dx = rainVX * 0.015;

  for (const d of rainDrops) {
    const len = 18 + d.len * 28;

    rainCtx.beginPath();
    rainCtx.strokeStyle = `rgba(255,255,255,${d.alpha})`;
    rainCtx.lineWidth = d.thickness;
    rainCtx.moveTo(d.x, d.y);
    rainCtx.lineTo(d.x + dx, d.y + len);
    rainCtx.stroke();

    // ✅ gravité PURE : on descend toujours
    d.x += dx;
    d.y += d.speed;

    if (d.y > viewH + 40) {
      d.y = -40 - Math.random() * 60;
      d.x = Math.random() * viewW;
    }
  }

  if (rainRunning) requestAnimationFrame(animateRain);
}


function applyRainFX(j) {
  if (!j || !j.current) {
    document.body.classList.remove("weather-rain");
    stopRain();
    return;
  }

  const c = j.current;
  const baseRain = (c.rain ?? 0) + (c.showers ?? 0);
  const rainAmt = baseRain > 0 ? baseRain : (c.precipitation ?? 0);
  const windSpeed = c.wind_speed_10m ?? 0;

  if (rainAmt <= 0) {
    document.body.classList.remove("weather-rain");
    stopRain();
    return;
  }

  document.body.classList.add("weather-rain");
  initRainScene();

  // ✅ vent = dérive horizontale légère
  rainVX = windSpeed * 2;

  const intensity = Math.min(1.5, 0.5 + rainAmt / 2.5);
  startRain(intensity);
}



function applyWeatherAnimations(j) {
  if (!j || !j.current) return;

  const code = j.current.weather_code;
  const storm = document.getElementById("storm-layer");
  const snow  = document.getElementById("snow-layer");
  const sun   = document.getElementById("sun-layer");

  if (!storm || !snow || !sun) return;

  // Reset visibilités
  storm.style.opacity = 0;
  snow.style.opacity  = 0;
  sun.style.opacity   = 0;

  // Groupes de codes Open-Meteo
  const isSnow  = [71,73,75,77,85,86].includes(code);
  const isStorm = [95,96,99].includes(code);
  const isSun   = (code === 0);

  if (isSnow)  snow.style.opacity  = 1;
  if (isStorm) storm.style.opacity = 1;
  if (isSun)   sun.style.opacity   = 1;
}

/* -------------------------------------------------
   HORLOGE LOCALE AUTO (mise à jour continue)
------------------------------------------------- */
let radarClockTimer = null;


/* ================= HORLOGE LOCALE (SAFE PATCH) ================= */
let __radarClockTimerSafe = null;



// Update every minute
function suggestNearbyCity(currentLat, currentLon) {
  if (!cities || cities.length === 0) return;

  function distanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  let closest = null;
  let minDist = Infinity;

  cities.forEach(c => {
    const d = distanceKm(currentLat, currentLon, c.lat, c.lon);
    if (d < minDist) {
      minDist = d;
      closest = c;
    }
  });

  if (closest && minDist < 30) {
    showToast(
      `Position approximative. Utiliser ${closest.name} ?`,
      "action",
      {
        label: "Oui",
        onClick: () => loadCityWeather(closest)
      }
    );
  }
}


/* @PATCH AddCityPopup – popup réutilisant le panneau existant */
(function(){
  const btnAddCityHeader = document.getElementById("btn-add-city");
  const overlay = document.getElementById("add-city-overlay");
  const closeBtn = document.getElementById("btn-close-add-city");
  const popupSlot = document.getElementById("add-city-popup-slot");
  const panel = document.getElementById("add-city-panel");
  const input = document.getElementById("city-input");

  if(!btnAddCityHeader || !overlay || !panel) return;

  const originalParent = panel.parentElement;
  const originalNext = panel.nextSibling;

  function openPopup(){
    popupSlot.appendChild(panel);
    panel.classList.remove("hidden-merged");
    overlay.classList.add("active");
    document.body.classList.add("no-scroll");
    setTimeout(()=>input && input.focus(),150);
  }

  function closePopup(){
    if(originalNext){
      originalParent.insertBefore(panel, originalNext);
    } else {
      originalParent.appendChild(panel);
    }
    panel.classList.add("hidden-merged");
    overlay.classList.remove("active");
    document.body.classList.remove("no-scroll");
  }

  btnAddCityHeader.addEventListener("click", openPopup);
  closeBtn && closeBtn.addEventListener("click", closePopup);
  overlay.querySelector(".overlay-backdrop")
    .addEventListener("click", closePopup);
})();


/* @PATCH AddCityPopup AutoClose */
(function(){
  const overlay = document.getElementById("add-city-overlay");
  const panel = document.getElementById("add-city-panel");
  if(!overlay || !panel) return;

  // observe clicks inside autocomplete or city list
  panel.addEventListener("click", (e)=>{
    const li = e.target.closest("li");
    if(!li) return;

    // delay to let existing logic finish (fetch / render)
    setTimeout(()=>{
      overlay.classList.remove("active");
      document.body.classList.remove("no-scroll");
    },150);
  });
})();

function updateAddCityButtonVisibility() {
  const panel = document.getElementById("add-city-panel");
  const btnAdd = document.getElementById("btn-add-city");
  if (!panel || !btnAdd) return;

  // Le bouton "+" doit toujours être visible
  btnAdd.style.display = "inline-flex";

  if (cities.length === 0) {
    // On replie le panneau d'ajout dans Mes villes
    panel.classList.add("hidden-merged");
} else {
    panel.classList.add("hidden-merged");
}
}

// ====================================

// === Flèches de scroll pour la timeline 24h ===
document.addEventListener("DOMContentLoaded", () => {
  const timeline = document.getElementById("timeline-24h");
  if (!timeline) return;

  // évite double-wrapper si jamais le script est chargé 2 fois
  if (timeline.parentElement && timeline.parentElement.classList.contains("timeline-24h-wrapper")) {
    return;
  }

  const parent = timeline.parentElement;
  if (!parent) return;

  const wrapper = document.createElement("div");
  wrapper.className = "timeline-24h-wrapper";
  parent.insertBefore(wrapper, timeline);

  const arrowLeft = document.createElement("button");
  arrowLeft.className = "timeline-arrow timeline-arrow-left";
  arrowLeft.type = "button";
  arrowLeft.textContent = "‹";

  const arrowRight = document.createElement("button");
  arrowRight.className = "timeline-arrow timeline-arrow-right";
  arrowRight.type = "button";
  arrowRight.textContent = "›";

  wrapper.appendChild(arrowLeft);
  wrapper.appendChild(timeline);
  wrapper.appendChild(arrowRight);

  const scrollAmount = 3 * 56; // ~ 3 cartes

  arrowLeft.addEventListener("click", (e) => {
    e.stopPropagation();
    timeline.scrollBy({ left: -scrollAmount, behavior: "smooth" });
  });

  arrowRight.addEventListener("click", (e) => {
    e.stopPropagation();
    timeline.scrollBy({ left: scrollAmount, behavior: "smooth" });
  });
});
/* ===============================
   ☀️ SUN ARC — RAFRAÎCHISSEMENT CONTINU
================================ */
let sunArcTimer = null;

function startSunArcLoop() {
  if (sunArcTimer) return;

  // affichage immédiat SI prêt
  if (
    selectedCity &&
    selectedCity.sunrise &&
    selectedCity.sunset &&
    typeof selectedCity.utcOffset === "number"
  ) {
    updateSunArc(selectedCity);
  }

  sunArcTimer = setInterval(() => {
    if (
      selectedCity &&
      selectedCity.sunrise &&
      selectedCity.sunset &&
      typeof selectedCity.utcOffset === "number"
    ) {
      updateSunArc(selectedCity);
    }
  }, 60 * 1000);
}
if (btn24h && timeline24h) {
  btn24h.addEventListener("click", () => {
    timeline24h.classList.toggle("hidden");
  });
}
/* === PATCH Background évolutif — logique jour/nuit === */
function clamp01(x){return Math.max(0,Math.min(1,x));}

function getDayPhase(now,sunrise,sunset){
  if(now>=sunrise-0.75 && now<sunrise+0.75) return "dawn";
  if(now>=sunrise+0.75 && now<sunset-1) return "day";
  if(now>=sunset-1 && now<sunset+0.75) return "dusk";
  return "night";
}

function getPhaseRatio(now,phase,sunrise,sunset){
  let start,end;
  if(phase==="dawn"){start=sunrise-0.75;end=sunrise+0.75;}
  else if(phase==="day"){start=sunrise+0.75;end=sunset-1;}
  else if(phase==="dusk"){start=sunset-1;end=sunset+0.75;}
  else return 0;
  return clamp01((now-start)/(end-start));
}

function computeSkyParams(phase,ratio){
  if(phase==="dawn") return {light:0.6+0.4*ratio,warmth:0.4+0.3*ratio,sat:0.9};
  if(phase==="day") return {light:1,warmth:0.2,sat:1};
  if(phase==="dusk") return {light:1-0.4*ratio,warmth:0.5,sat:0.85};
  return {light:0.45,warmth:0,sat:0.8};
}

function applyDynamicBackground(ci,weatherCode){
  if(!ci||typeof cityLocalHour!=="number") return;
  const phase=getDayPhase(cityLocalHour,citySunriseHour,citySunsetHour);
  const ratio=getPhaseRatio(cityLocalHour,phase,citySunriseHour,citySunsetHour);
  const p=computeSkyParams(phase,ratio);
  let dim=1;
  if([61,63,65,80,81,82].includes(weatherCode)) dim=0.92;
  if([71,73,75].includes(weatherCode)) dim=1.05;
  if([95,96,99].includes(weatherCode)) dim=0.85;
  const r=document.documentElement;
  r.style.setProperty("--sky-light",(p.light*dim).toFixed(2));
  r.style.setProperty("--sky-sat",p.sat.toFixed(2));
  r.style.setProperty("--sky-warmth",p.warmth.toFixed(2));
}


/* ======================================================
   TOOLTIP MÉTÉO — proche du pointeur, curseur intact
====================================================== */
(function initWeatherTooltip(){
  if (document.querySelector(".weather-tooltip")) return;

  const weatherTooltip = document.createElement("div");
  weatherTooltip.className = "weather-tooltip";
  document.body.appendChild(weatherTooltip);

  function show(text, x, y) {
    weatherTooltip.textContent = text;
    // ✅ à droite et légèrement en dessous (jamais coupé)
    weatherTooltip.style.left = (x + 12) + "px";
    weatherTooltip.style.top  = (y + 12) + "px";
    weatherTooltip.classList.add("visible");
  }

  function hide() {
    weatherTooltip.classList.remove("visible");
  }

  document.addEventListener("mouseover", (e) => {
    const t = e.target.closest("[data-label]");
    if (!t) return;
    show(t.dataset.label || "", e.clientX, e.clientY);
  });

  document.addEventListener("mousemove", (e) => {
    if (!weatherTooltip.classList.contains("visible")) return;
    weatherTooltip.style.left = (e.clientX + 12) + "px";
    weatherTooltip.style.top  = (e.clientY + 12) + "px";
  });

  document.addEventListener("mouseout", (e) => {
    if (e.target.closest("[data-label]")) hide();
  });
})();

