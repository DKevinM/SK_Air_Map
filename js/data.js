// SK data adapter for LiveMap-style frontend
window.dataByStation = Object.create(null);
window.AppData = { stations: [], purpleair: [], forecast: [], ready: null };
window.getColor = window.getAQHIColor = function (val) {
  if (val === null || val === undefined) return "#D3D3D3";
  const s = String(val).trim();
  if (["", "NA", "NaN", "null", "undefined"].includes(s)) return "#D3D3D3";
  if (s === "10+") return "#640100";
  const v = Math.round(Number(s));
  if (!isFinite(v) || v < 1) return "#D3D3D3";
  if (v === 1) return "#01cbff";
  if (v === 2) return "#0099cb";
  if (v === 3) return "#016797";
  if (v === 4) return "#fffe03";
  if (v === 5) return "#ffcb00";
  if (v === 6) return "#ff9835";
  if (v === 7) return "#fd6866";
  if (v === 8) return "#fe0002";
  if (v === 9) return "#cc0001";
  if (v === 10) return "#9a0100";
  return "#640100";
};



const TZ = window.APP_CONFIG?.timezone || "America/Regina";
const currentAQHIUrl = window.APP_CONFIG?.currentAQHIUrl;
const purpleAirUrl = window.APP_CONFIG?.purpleAirUrl;
const forecastUrl = window.APP_CONFIG?.forecastUrl;

const skParams = [
  ["AQHI", "AQHI", ""],
  ["Fine Particulate Matter", "PM2.5", " µg/m³", "PM25"],
  ["Nitrogen Dioxide", "NO2", " ppb", "NO2"],
  ["Ozone", "O3", " ppb", "O3"],
  ["Wind Speed", "Wind Speed", " km/hr", "WS"],
  ["Wind Direction", "Wind Dir", " degrees", "WD"],
  ["Outdoor Temperature", "Temp", " °C", "TEMP"],
  ["Relative Humidity", "Humidity", " %", "RH"]
];

function val(p, keys) {
  for (const k of keys) if (p[k] !== undefined && p[k] !== null && p[k] !== "") return p[k];
  return null;
}
function num(x) { const n = Number(x); return Number.isFinite(n) ? n : null; }
function displayDate(t) {
  const d = new Date(t);
  return isNaN(d) ? "" : d.toLocaleString("en-CA", { timeZone: TZ, hour12: true });
}
function normalStationFeature(f) {
  const p = f.properties || {};
  const [lon, lat] = f.geometry?.coordinates || [];
  const station = p.station || p.COMMUNITY || p.name || p.StationName;
  const time = p.updated || p.datetime || p.DATETIME || p.time;
  if (!station || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) return null;

  const rows = skParams.map(([ParameterName, Shortform, Units, key]) => {
    const raw = key ? val(p, [key, key.replace("PM25", "PM2_5")]) : val(p, ["AQHI", "aqhi"]);
    return {
      StationName: station,
      ParameterName,
      Shortform,
      Units,
      Value: num(raw),
      ReadingDate: time,
      DisplayDate: displayDate(time),
      Latitude: Number(lat),
      Longitude: Number(lon)
    };
  }).filter(r => r.Value !== null);

  dataByStation[station] = rows;
  const aqhi = rows.find(r => r.ParameterName === "AQHI")?.Value ?? null;
  return { stationName: station, lat: Number(lat), lon: Number(lon), aqhi, rows };
}

window.buildStationPopup = function(rows) {
  const station = rows?.[0]?.StationName || "Station";
  const lines = (rows || []).map(r => {
    let v = r.Value;
    if (r.ParameterName === "AQHI") v = v > 10 ? "10+" : Math.round(v);
    else if (Number.isFinite(Number(v))) v = Number(v).toFixed(r.ParameterName.includes("Wind Direction") ? 0 : 1);
    return `<div style="display:flex;justify-content:space-between;gap:18px;padding:2px 4px;"><b>${r.Shortform}</b><span>${v}${r.Units || ""}</span></div>`;
  }).join("");
  return `<div style="width:280px;"><strong>${station}</strong><br>${lines}</div>`;
};

async function fetchJsonMaybe(url) {
  if (!url) return null;

  try {
    const r = await fetch(url + (url.includes("?") ? "&" : "?") + "v=" + Date.now());

    if (!r.ok) {
      console.warn("Load failed:", url, r.status, r.statusText);
      return null;
    }

    return await r.json();

  } catch (e) {
    console.warn("Load failed:", url, e);
    return null;
  }
}

async function loadStations() {
  const geo = await fetchJsonMaybe(currentAQHIUrl);
  const features = geo?.features || [];
  return features.map(normalStationFeature).filter(Boolean);
}

async function loadForecast() {
  const f = await fetchJsonMaybe(forecastUrl);
  const items = Array.isArray(f) ? f : (f?.features || []);
  return items.map(x => {
    const p = x.properties || x;
    const station = p.station || p.name || p.StationName;
    if (!station) return null;
    const aqhi = num(p.AQHI_forecast ?? p.aqhi_forecast ?? p.forecast_aqhi ?? p.AQHI_3h ?? p.AQHI ?? p.aqhi);
    const lat = num(p.lat ?? p.Latitude ?? x.geometry?.coordinates?.[1]);
    const lon = num(p.lon ?? p.Longitude ?? x.geometry?.coordinates?.[0]);
    return { stationName: station, lat, lon, aqhi, raw: p };
  }).filter(Boolean);
}

async function loadPurpleAir() {
  const json = await fetchJsonMaybe(purpleAirUrl);
  const features = json?.features || [];
  return features.map(f => {
    const p = f.properties || {};
    const [lon, lat] = f.geometry?.coordinates || [];
    const pm = num(p.pm25 ?? p.pm_corr ?? p.pm_corrected_clean ?? p.pm_corrected_original);
    return {
      sensor_index: p.sensor_index,
      name: p.name || `Sensor ${p.sensor_index ?? ""}`,
      lat: Number(lat), lon: Number(lon), pm,
      last_seen: p.last_seen,
      quality_flag: p.quality_flag,
      use_for_map: p.use_for_map
    };
  }).filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lon));
}

window.fetchAllStationData = async function() { await window.dataReady; return window.AppData.stations; };
window.getStationValue = function(station, param) { return dataByStation[station]?.find(r => r.ParameterName === param)?.Value ?? null; };
window.getStationTime = function(station, param) { return dataByStation[station]?.find(r => r.ParameterName === param)?.DisplayDate ?? null; };

window.dataReady = (async () => {
  const [stations, purple, forecast] = await Promise.all([loadStations(), loadPurpleAir(), loadForecast()]);
  window.AppData.stations = stations;
  window.AppData.purpleair = purple;
  window.AppData.forecast = forecast;
  return window.AppData;
})();
window.AppData.ready = window.dataReady;
