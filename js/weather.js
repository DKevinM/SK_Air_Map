function degToCardinal(deg) {
  const dirs = ["N","NE","E","SE","S","SW","W","NW"];
  const idx = Math.round(((deg % 360) / 45)) % 8;
  return dirs[idx];
}



window.showCurrentWeather = async function(lat, lng) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&current_weather=true` +
    `&hourly=uv_index` +
    `&timezone=America%2FEdmonton`;

  try {
    const r = await fetch(url);
    const data = await r.json();

    const cw = data.current_weather;
    if (!cw) return;

    const html = `
      <table class="popup-weather">
        <tr><td><strong>Time</strong></td>
            <td>${new Date(cw.time).toLocaleString("en-CA", {timeZone: "America/Edmonton"})}</td></tr>
        <tr><td><strong>Temperature</strong></td>
            <td>${Math.round(cw.temperature)} °C</td></tr>
        <tr><td><strong>Wind</strong></td>
            <td>${Math.round(cw.windspeed)} km/h
                ${isFinite(cw.winddirection) ? degToCardinal(cw.winddirection) : ""}</td></tr>
      </table>
    `;

    const el = document.getElementById("mini-weather");
    if (el) el.innerHTML = html;

  } catch (e) {
    console.warn("Current weather failed:", e);
  }
};




window.showWeatherForPoint = async function(lat, lng) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&hourly=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m,uv_index` +
    `&timezone=America%2FEdmonton`;

  try {
    const r = await fetch(url);
    const data = await r.json();
    updateMiniWeather(data);   // <- call the mini renderer directly
  } catch (e) {
    console.warn("Weather fetch failed:", e);
  }
};





function updateMiniWeather(data) {

  const now = new Date();
  let i = 0;

  while (i < data.hourly.time.length) {
    const t = new Date(data.hourly.time[i]);
    if (t >= now) break;
    i++;
  }
  if (i >= data.hourly.time.length) i = data.hourly.time.length - 1;


  let forecastRows = "";
  for (let j = 0; j < 6 && (i + j) < data.hourly.time.length; j++) {
    const t = new Date(data.hourly.time[i + j]);
    const hhmm = t.toLocaleTimeString("en-CA", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Edmonton"
    });

    
    const precip = data.hourly.precipitation[i+j];
    const temp = data.hourly.temperature_2m[i+j];

    
    forecastRows += `
      <tr>
        <td>${hhmm}</td>
        <td>${isFinite(temp) ? Math.round(temp) : "--"}°C</td>
        <td>${Math.round(data.hourly.wind_speed_10m[i+j])} km/h
            ${degToCardinal(data.hourly.wind_direction_10m[i+j])}</td>
        <td>${precip != null ? precip.toFixed(1) : "0.0"} mm</td>
        <td>${Math.round(data.hourly.uv_index[i+j])}</td>
      </tr>
    `;
  }

  const html = `
    <table style="width:100%; font-size:12px;">
      <thead>
        <tr>
          <th>Time</th>
          <th>Temp</th>
          <th>Wind</th>
          <th>Precip</th>
          <th>UV</th>
        </tr>
      </thead>
      <tbody>
        ${forecastRows}
      </tbody>
    </table>
  `;


  const el = document.getElementById("mini-weather-forecast");
  if (el) el.innerHTML = html;


}


window.extractCurrentWeather = function (data) {
  const now = new Date();
  let i = 0;

  while (i < data.hourly.time.length) {
    if (new Date(data.hourly.time[i]) >= now) break;
    i++;
  }
  if (i >= data.hourly.time.length) i = data.hourly.time.length - 1;
  
  return {
    time: now.toLocaleString("en-CA", { timeZone: "America/Edmonton" }),
    temp: data.hourly.temperature_2m[i],
    rh: data.hourly.relative_humidity_2m[i],
    precip: data.hourly.precipitation[i],
    cloud: data.hourly.cloudcover?.[i],
    uv: data.hourly.uv_index[i],
    wind: data.hourly.wind_speed_10m[i],
    gust: data.hourly.wind_gusts_10m?.[i],
    dir: data.hourly.wind_direction_10m[i]
  };
};

window.fetchWeather = async function(lat, lng) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&hourly=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m,uv_index` +
    `&timezone=America%2FEdmonton`;

  try {
    const r = await fetch(url);
    return await r.json();
  } catch (e) {
    console.warn("Weather fetch failed:", e);
    return null;
  }
};


window.renderPanelWeather = function(current, lat, lng, addressText) {
  const el = document.getElementById("panel-weather");
  if (!el || !current) return;

  el.innerHTML = `
    <div style="font-weight:600; margin-bottom:4px;">Current Weather</div>
    <div style="font-size:12px; line-height:1.35;">
      <div><strong>${addressText || "Selected location"}</strong></div>
      <div>${current.time || ""}</div>
      <div>Temp: ${current.temp != null ? Math.round(current.temp) : "--"} °C</div>
      <div>RH: ${current.rh != null ? Math.round(current.rh) : "--"} %</div>
      <div>Wind: ${current.wind != null ? Math.round(current.wind) : "--"} km/h ${current.dir != null ? degToCardinal(current.dir) : ""}</div>
      <div>Precip: ${current.precip != null ? Number(current.precip).toFixed(1) : "0.0"} mm</div>
      <div>UV: ${current.uv != null ? Math.round(current.uv) : "--"}</div>
    </div>
  `;
};

// ==============================
// POPUP WEATHER TABLE (FOR MAP CLICK)
// ==============================
window.buildPopupWeatherTable = function(data) {
  if (!data || !data.hourly || !data.hourly.time) return "";

  const now = new Date();
  let i = 0;

  while (i < data.hourly.time.length) {
    const t = new Date(data.hourly.time[i]);
    if (t >= now) break;
    i++;
  }

  if (i >= data.hourly.time.length) {
    i = data.hourly.time.length - 1;
  }

  let forecastRows = "";
  for (let j = 0; j < 6 && (i + j) < data.hourly.time.length; j++) {
    const t = new Date(data.hourly.time[i + j]);

    const hhmm = t.toLocaleTimeString("en-CA", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Edmonton"
    });

    const temp = data.hourly.temperature_2m?.[i + j];
    const wind = data.hourly.wind_speed_10m?.[i + j];
    const dir  = data.hourly.wind_direction_10m?.[i + j];
    const precip = data.hourly.precipitation?.[i + j];

    forecastRows += `
      <tr>
        <td>${hhmm}</td>
        <td>${isFinite(temp) ? Math.round(temp) : "--"}°C</td>
        <td>${isFinite(wind) ? Math.round(wind) : "--"} km/h ${isFinite(dir) ? degToCardinal(dir) : ""}</td>
        <td>${precip != null ? Number(precip).toFixed(1) : "0.0"} mm</td>
      </tr>
    `;
  }

  return `
    <div style="font-weight:600; margin:8px 0 3px;">Weather forecast (next 6h)</div>
    <table style="width:100%; font-size:11px;">
      <thead>
        <tr>
          <th align="left">Time</th>
          <th align="left">Temp</th>
          <th align="left">Wind</th>
          <th align="left">Precip</th>
        </tr>
      </thead>
      <tbody>
        ${forecastRows}
      </tbody>
    </table>
  `;
};

