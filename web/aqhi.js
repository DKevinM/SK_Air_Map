// ===============================
//   aqhi.js
// ===============================

window.aqhiData = { current: null, forecast: null };

function getAQHICategory(v) {
  // ---- INVALID / MISSING ----
  if (
    v === null ||
    v === undefined ||
    v === "" ||
    v === "NaN" ||
    !isFinite(Number(v))
  ) {
    return null; 
  }
  v = Number(v);
  if (v <= 3) return "low";
  if (v <= 6) return "moderate";
  if (v <= 10) return "high";
  return "veryhigh";
}


function safeAQHI(v) {
  if (v == null || isNaN(v)) return "—";
  if (v > 10) return "10+";
  return Math.round(v);
}


function safeRound(val) {
  if (val === null || val === undefined || val === "") return null;
  const n = Number(val);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function pickPeriodIndexByCategory(p, category) {
  const labels = [];
  for (let i = 1; i <= 5; i++)
    labels.push(((p[`p${i}_label`] || "") + "").toLowerCase());

  const has = (i, s) => labels[i - 1].includes(s);

  const isToday = i =>
    has(i, "today") ||
    has(i, "this afternoon") ||
    (has(i, "this evening") && !has(i, "tonight"));

  const isTonight = i => has(i, "tonight") || has(i, "overnight");
  const isTomorrow = i => has(i, "tomorrow") && !has(i, "night");

  let test;
  if (category === "today") test = isToday;
  else if (category === "tonight") test = isTonight;
  else if (category === "tomorrow") test = isTomorrow;

  if (test) for (let i = 1; i <= 5; i++) if (test(i)) return i;

  return ({ today: 1, tonight: 2, tomorrow: 3 })[category] || 1;
}

// ---------- KEY FIX: handle BOTH flat + nested data ----------
function getAQHI(p, idx) {
  if (!p) return null;

  // Case A — your GitHub (FLAT) format
  if (p[`p${idx}_aqhi`] !== undefined) {
    return safeRound(p[`p${idx}_aqhi`]);
  }

  // Case B — true nested CAN_AQHI
  if (p.forecast_period) {
    const per = p.forecast_period[`period_${idx}`];
    if (per && per.aqhi != null) return Math.round(Number(per.aqhi));
  }

  return null;
}

function getLabel(p, idx) {
  if (!p) return null;

  if (p[`p${idx}_label`]) return p[`p${idx}_label`];

  if (p.forecast_period) {
    const per = p.forecast_period[`period_${idx}`];
    if (per && per.forecast_period_en) return per.forecast_period_en;
  }

  return null;
}

// ================= LOAD DATA =================
async function loadAQHI() {

  const [obs, fc] = await Promise.all([
    fetch("https://raw.githubusercontent.com/DKevinM/CAN_AQHI/main/data/aqhi_observations.geojson").then(r => r.json()),
    fetch("https://raw.githubusercontent.com/DKevinM/CAN_AQHI/main/data/aqhi_forecasts.geojson").then(r => r.json())
  ]);

  const obsCal = (obs.features || [])
    .map(f => f.properties)
    .filter(p => /community/i.test(p.name));

  const fcCal = (fc.features || [])
    .map(f => f.properties)
    .filter(p => /community/i.test(p.name));

  obsCal.sort((a,b) =>
    new Date(b.observed || b.observation_datetime) -
    new Date(a.observed || a.observation_datetime)
  );

  fcCal.sort((a,b) =>
    new Date(b.forecast_datetime) -
    new Date(a.forecast_datetime)
  );

  window.aqhiData.current = obsCal.length ? {
    station: obsCal[0].name,
    value: safeRound(obsCal[0].aqhi),
    time: obsCal[0].observed || obsCal[0].observation_datetime
  } : null;

  window.aqhiData.forecast = fcCal.length ? fcCal[0] : null;

  console.log("community AQHI LOADED:", window.aqhiData);
}



async function findClosestCommunityName(lat, lng) {

  const obs = await fetch(
    "https://raw.githubusercontent.com/DKevinM/CAN_AQHI/main/data/aqhi_observations.geojson"
  ).then(r => r.json());

  let closestName = null;
  let minDist = Infinity;

  obs.features.forEach(f => {
    const [lon, lat2] = f.geometry.coordinates;
    const d = getDistance(lat, lng, lat2, lon);

    if (d < minDist) {
      minDist = d;
      closestName = f.properties.name;
    }
  });

  console.log("Closest ECCC community:", closestName);
  return closestName;
}





async function loadAQHIFromAB(clickLat, clickLng) {

    const name = await findClosestCommunityName(clickLat, clickLng);
  
    const url =
    "https://data.environment.alberta.ca/EdwServices/aqhi/odata/CommunityAqhis?$format=json";
  
    const r = await fetch(url);
    const data = await r.json();
  
    const match = data.value.find(c =>
      c.CommunityName.toLowerCase() === name.toLowerCase()
    );
  
    if (!match) {
      console.error("No Alberta match for:", name);
      return;
    }
  
    Object.assign(window.aqhiData, {      
      current: {
        station: match.CommunityName,
        value: Number(match.Aqhi),
        time: match.ReadingDate
      },
      forecast: {
        today: Number(match.ForecastToday),
        tonight: Number(match.ForecastTonight),
        tomorrow: Number(match.ForecastTomorrow)
      }
    });
  }






// ================= DRAW PANEL =================
function drawAQHIPanel() {

  const C = window.aqhiData;
  if (!C || !C.current) return;

  const v0 = safeRound(C.current.value);
  const fToday = safeRound(C.forecast?.today);
  const fTonight = safeRound(C.forecast?.tonight);
  const fTomorrow = safeRound(C.forecast?.tomorrow);

  const values = [v0, fToday, fTonight, fTomorrow].filter(v => v != null);
  
  const categories = [...new Set(
    values
      .map(getAQHICategory)
      .filter(c => c !== null)
  )];



  
  function buildLegendRow(cat) {
    if (!cat) return "";
  
    const styles = {
      low:      { color: "#016797", label: "1–3 Low: Ideal air quality for outdoor activities" },
      moderate: { color: "#ffcb00", label: "4–6 Moderate: No need to modify your usual outdoor activities unless you experience symptoms such as coughing and throat irritation" },
      high:     { color: "#fe0002", label: "7–10 High: Consider reducing or rescheduling strenuous activities outdoors if you experience symptoms such as coughing and throat irritation" },
      veryhigh: { color: "#640100", label: "10+ Very High: Reduce or reschedule strenuous activities outdoors, especially if you experience symptoms such as coughing and throat irritation" }
    };
  
    const s = styles[cat];
    if (!s) return "";
  
    return `
      <div style="margin-left:14px; position:relative;">
        <span style="
          position:absolute;
          left:-14px;
          top:5px;
          width:8px;
          height:8px;
          border-radius:50%;
          background:${s.color};
        "></span>
        <b>${s.label}</b>
      </div>
    `;
  }

  
  const legendHTML = `
    <div style="margin-top:8px; font-size:11px; line-height:1.3;">
      ${categories.map(buildLegendRow).join("")}
    </div>
  `;

  
  const html = `

  <div style="font-size:16px; font-weight:700;">
    ${C.current.station} Air Quality (AQHI)
  </div>

  <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:6px; margin-top:10px;">

    <div style="text-align:center;">
      <div style="background:${window.getColor ? getColor(v0) : "#ccc"}; width:70px; height:40px;
           margin:auto; display:flex; align-items:center; justify-content:center;
           font-weight:bold; border:1px solid #333;">
        ${safeAQHI(v0)}
      </div>
      <div style="font-size:12px;">Current</div>
    </div>

    <div style="text-align:center;">
      <div style="background:${isFinite(fToday) ? getColor(fToday) : "#ccc"}; width:70px; height:40px;
           margin:auto; display:flex; align-items:center; justify-content:center;
           font-weight:bold; border:1px solid #333;">
        ${safeAQHI(fToday)}
      </div>
      <div style="font-size:11px;">Today</div>
    </div>

    <div style="text-align:center;">
      <div style="background:${isFinite(fTonight) ? getColor(fTonight) : "#ccc"}; width:70px; height:40px;
           margin:auto; display:flex; align-items:center; justify-content:center;
           font-weight:bold; border:1px solid #333;">
        ${safeAQHI(fTonight)}
      </div>
      <div style="font-size:11px;">Tonight</div>
    </div>

    <div style="text-align:center;">
      <div style="background:${isFinite(fTomorrow) ? getColor(fTomorrow) : "#ccc"}; width:70px; height:40px;
           margin:auto; display:flex; align-items:center; justify-content:center;
           font-weight:bold; border:1px solid #333;">
        ${safeAQHI(fTomorrow)}
      </div>
      <div style="font-size:11px;">Tomorrow</div>
    </div>
  </div>

  ${legendHTML}

  <div style="margin-top:10px;">
    <strong>Last updated:</strong> ${new Date(C.current.time).toLocaleString()}
  </div>


  <div id="panel-weather"
       style="
         margin-top:10px;
         padding-top:8px;
         border-top:1px solid #ccc;
         font-size:13px;
       ">
    <div style="color:#666; font-style:italic;">
      Click map for current weather
    </div>
  </div>


  <div style="margin-top:10px;">
    <div style="font-weight:600;">Environment Canada Weather Alerts</div>
    <a href="https://weather.gc.ca/?layers=alert&province=AB&zoom=5&center=47.04505510,-129.95671573&alertTableFilterProv=AB" target="_blank">
        Weather Alerts
    </a><br>
  </div>

  <div style="margin-top:10px;">
    <div style="font-weight:600;">What is AQHI</div>
    <a href="https://capitalairshed.ca/air-quality-health-index/" target="_blank">
        What is AQHI
    </a><br>
  </div>
  
  <div style="margin-top:10px;">
    <div style="font-weight:600;">Wildfire external resources</div>
  
    <a href="https://firesmoke.ca/forecasts/current/" target="_blank">
      FireSmoke Canada – Current Forecast
    </a><br>
  
    <a href="https://eer.cmc.ec.gc.ca/mandats/AutoSim/ops/Fire_CA_HRDPS_CWFIS/latest/Canada/latest/img/Canada/anim.html" target="_blank">
      ECCC Wildfire Dashboard
    </a>
  </div>
  <hr style="margin:10px 0;">

  `;
  document.getElementById("aqhi-content").innerHTML = html;
}




function renderPanelWeather(w, lat, lng, address) {

  let attempts = 0;
  function tryRender() {
    const el = document.getElementById("panel-weather");  
    if (!el) {
      if (attempts++ < 10) {
        setTimeout(tryRender, 50);
      }
      return;
    }

    el.innerHTML = `
      <div style="font-weight:600; margin-bottom:4px;">Current Weather</div>
      <table style="width:100%; font-size:12px; border-collapse:collapse;">
        <tr>
          <td>Temperature</td>
          <td style="text-align:center;">${w.temp} °C</td>
        </tr>
        <tr>
          <td>Humidity</td>
          <td style="text-align:center;">${w.rh} %</td>
        </tr>
        <tr>
          <td>Precipitation</td>
          <td style="text-align:center;">${w.precip} mm</td>
        </tr>
        <tr>
          <td>Cloud cover</td>
          <td style="text-align:center;">${w.cloud ?? "–"} %</td>
        </tr>
        <tr>
          <td>UV index</td>
          <td style="text-align:center;">${w.uv}</td>
        </tr>
        <tr>
          <td>Wind</td>
          <td style="text-align:center;">
            ${w.wind} km/h ${degToCardinal(w.dir)}
          </td>
        </tr>
        ${w.gust ? `
        <tr>
          <td>Gusts</td>
          <td style="text-align:center;">${w.gust} km/h</td>
        </tr>` : ""}
      </table>
    `;
  }

  tryRender();
}

window.renderPanelWeather = renderPanelWeather;



window.updatePanelLocation = function(address, lat, lng) {
  const panel = document.getElementById("aqhi-panel");
  if (!panel) return;

  let loc = panel.querySelector(".loc-line");

  if (!loc) {
    loc = document.createElement("div");
    loc.className = "loc-line";
    panel.appendChild(loc);
  }

  loc.innerHTML = `
    <b>Location Picked:</b><br>
    ${address}<br>
    <span style="font-size:0.8em;">
      (${lat.toFixed(4)}, ${lng.toFixed(4)})
    </span>
  `;
};



// ================= BOOTSTRAP =================
window.refreshAQHIPanel = async function () {
  drawAQHIPanel();
};

window.updateAQHIFromClick = async function(lat, lng) {
  await loadAQHIFromAB(lat, lng);

  // Save existing weather block BEFORE panel redraw
  const existingWeather = document.getElementById("panel-weather")?.innerHTML;

  drawAQHIPanel();

  // Put the weather BACK after redraw
  if (existingWeather) {
    const el = document.getElementById("panel-weather");
    if (el) el.innerHTML = existingWeather;
  }
};
