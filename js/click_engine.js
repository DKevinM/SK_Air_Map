// =====================================================
// ECCC AQHI FORECAST LOOKUP
// =====================================================

window.aqhiForecastLookup = {};
fetch(
  "https://raw.githubusercontent.com/DKevinM/SK_AQHI_Forecast/main/data/aqhi_forecasts.geojson"
)
.then(r => r.json())
.then(data => {
  data.features.forEach(f => {
    const p = f.properties || {};
    if(!p.name) return;
    window.aqhiForecastLookup[
      p.name.toUpperCase()
    ] = p;
  });
  console.log(
    "Loaded ECCC AQHI forecasts:",
    Object.keys(window.aqhiForecastLookup).length
  );
})
.catch(err => {
  console.error(
    "AQHI forecast lookup failed:",
    err
  );
});


window.handleMapClick = async function(lat, lng, map) {

  // ---- CLEAR PREVIOUS SELECTION ----
  if (typeof window.clearSelection === "function") {
    window.clearSelection();
  }
  
  // ---- OPEN PANEL  ----
  const panel = document.getElementById("panel");
  if (panel) panel.classList.remove("collapsed");
  if (window.layers?.click) {
    window.layers.click.clearLayers();
  }

  // ---- AQHI UPDATE ----
  if (typeof window.updateAQHIFromClick === "function") {
    await window.updateAQHIFromClick(lat, lng);
  } else {
    console.error("updateAQHIFromClick not found");
  }  
  
  let weatherData = null;
  let weatherHtml = "";


  // ---- 1) Marker at clicked point ----


  // ---- 2) TWO CLOSEST AQHI STATIONS ----
  const closestStations = (window.AppData?.stations || [])
    .map(s => ({
      station: s.stationName,
      lat: Number(s.lat),
      lng: Number(s.lon),
      aqhi: (s.aqhi !== null && isFinite(s.aqhi))
        ? Number(s.aqhi)
        : null,
      dist_km: getDistance(lat, lng, s.lat, s.lon) / 1000
    }))
    .filter(s => isFinite(s.lat) && isFinite(s.lng))
    .sort((a,b) => a.dist_km - b.dist_km)
    .slice(0,2);


  const marker = L.marker([lat, lng]);
  if (window.layers?.click) {
    window.layers.click.addLayer(marker);
  }
  
  marker.bindPopup(`
    <div style="font-size:12px; line-height:1.25;">
      Loading station data ...
    </div>
  `, {
    maxWidth: 420,
    minWidth: 380,
    autoPanPadding: [20, 20]
  }).openPopup();
  
  closestStations.forEach(st => {
    const circle = L.circleMarker([st.lat, st.lng], {
      radius: 15,
      color: "#000",
      fillColor:
        st.aqhi === "10+"
          ? window.getAQHIColor(11)
          : (isFinite(st.aqhi) ? window.getAQHIColor(st.aqhi) : "#999"),
      weight: 3,
      fillOpacity: 0.8
    });
  
    if (window.layers?.click) {
      window.layers.click.addLayer(circle);
    }
  });


  
  // =====================================================
  // CLOSEST ECCC FORECAST
  // =====================================================
  
  let closestForecast = null;  
  if(
    closestStations &&
    closestStations.length > 0
  ){
    const key =
      closestStations[0].station.toUpperCase();
    closestForecast =
      window.aqhiForecastLookup[key] || null;  
  }


  

  // ==============================
  // UPDATE LEFT AQHI PANEL
  // ==============================
  if (closestStations && closestStations.length > 0) {
    const s = closestStations[0];
    const aqhiVal = (s.aqhi !== null && isFinite(s.aqhi))
      ? (Number(s.aqhi) > 10 ? "10+" : Math.round(Number(s.aqhi)))
      : null;
    const aqhiEl = document.getElementById("aqhi-current");
    if (aqhiEl) aqhiEl.textContent = aqhiVal !== null ? aqhiVal : "—";
    const titleEl = document.getElementById("panel-title");
    if (titleEl) {
      titleEl.textContent = `${s.station || "Unknown"} Air Quality (AQHI)`;
    }
    const timeEl = document.getElementById("aqhi-updated");
    if (timeEl) {
      timeEl.textContent = "Latest available";
    }
  }




  
  // ---- 3) REVERSE GEOCODE ----
  let addressText = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
    );
    const geo = await r.json();

    if (geo && geo.display_name) {
      addressText = geo.display_name;
    }
  } catch (e) {
    console.warn("Reverse geocoding failed", e);
  }

  // ---- 4) WEATHER ----
  weatherData = await window.fetchWeather(lat, lng);
  
  if (weatherData) {
    const current = window.extractCurrentWeather(weatherData);
  
    if (current && window.renderPanelWeather) {
      window.renderPanelWeather(current, lat, lng, addressText);
    }
  
    if (typeof window.buildPopupWeatherTable === "function") {
      weatherHtml = window.buildPopupWeatherTable(weatherData);
    } else {
      console.warn("buildPopupWeatherTable not found");
      weatherHtml = "";
    }
  }


  
  // ---- 5) PURPLEAIR ----
  let closestPA = [];

  try {
    const paList = window.AppData?.purpleair || [];
    
    closestPA = paList
      .map(s => ({
        name: s.name || "PurpleAir",
        pm: s.pm ?? null,
        lat: Number(s.lat),
        lng: Number(s.lon),
        dist_km: getDistance(lat, lng, Number(s.lat), Number(s.lon)) / 1000
      }))
      .filter(s => isFinite(s.lat) && isFinite(s.lng))
      .sort((a,b) => a.dist_km - b.dist_km)
      .slice(0,3);

  } catch (e) {
    console.warn("PurpleAir nearest lookup failed:", e);
  }

  // ---- 6) POPUP ----
  const stRows = closestStations.map(s => `
    <tr>
      <td>${s.station}</td>
      <td style="text-align:center;">
        ${s.aqhi !== null && isFinite(s.aqhi)
          ? (Number(s.aqhi) > 10 ? "10+" : Math.round(Number(s.aqhi)))
          : "—"}   
      </td>
      <td style="text-align:right;">${s.dist_km.toFixed(1)} km</td>
    </tr>
  `).join("");
  
  const stTable = `
    <table style="width:100%; font-size:18px;">
      <thead>
        <tr>
          <th align="left">Station</th>
          <th align="center">AQHI</th>
          <th align="right">Dist</th>
        </tr>
      </thead>
      <tbody>
        ${stRows}
      </tbody>
    </table>
  `;
  
  const paRows = closestPA.map(p => {
  
    const eAQHI = (p.pm != null && !isNaN(p.pm))
      ? computeEAQHI(Number(p.pm))
      : null;
  
    return `
      <tr>
        <td>${p.name}</td>
        <td style="text-align:center;">
          ${eAQHI != null ? `<b>${eAQHI}</b>` : "—"}
        </td>
        <td style="text-align:right;">${p.dist_km.toFixed(1)} km</td>
      </tr>
    `;
  }).join("");

  const paTable = `
    <table style="width:100%; font-size:11px;">
      <thead>
        <tr>
          <th align="left">Sensor</th>
          <th align="center">AQHI (est.)</th>
          <th align="right">Dist</th>
        </tr>
      </thead>
      <tbody>
        ${paRows}
      </tbody>
    </table>
  `;

  
  // =====================================================
  // ECCC AQHI FORECAST HTML
  // =====================================================
  
  let forecastHtml = "";
  
  if(closestForecast){
  
    forecastHtml = `
  
      <div style="
        margin-top:12px;
        padding-top:8px;
        border-top:1px solid #ccc;
      ">
  
        <div style="
          font-weight:700;
          font-size:13px;
          margin-bottom:6px;
        ">
          ECCC AQHI Forecast
        </div>
  
        <table style="
          width:100%;
          font-size:12px;
        ">
  
          <tr>
            <td>${closestForecast.p1_label ?? "Period 1"}</td>
            <td style="text-align:right;">
              ${closestForecast.p1_aqhi ?? "—"}
            </td>
          </tr>
  
          <tr>
            <td>${closestForecast.p2_label ?? "Period 2"}</td>
            <td style="text-align:right;">
              ${closestForecast.p2_aqhi ?? "—"}
            </td>
          </tr>
  
          <tr>
            <td>${closestForecast.p3_label ?? "Period 3"}</td>
            <td style="text-align:right;">
              ${closestForecast.p3_aqhi ?? "—"}
            </td>
          </tr>
  
          <tr>
            <td>${closestForecast.p4_label ?? "Period 4"}</td>
            <td style="text-align:right;">
              ${closestForecast.p4_aqhi ?? "—"}
            </td>
          </tr>
  
        </table>
  
      </div>
  
    `;
  }









  
  const popupHtml = `
    <div style="font-size:13px; line-height:1.3;">
  
      <div style="font-weight:800; font-size:18px; margin-bottom:8px;">
        Nearest stations & sensors
      </div>
  
      <!-- AQHI STATIONS (PRIMARY) -->
      <div style="font-weight:800; font-size:18px; margin:6px 0 4px;">
        AQHI stations (2)
      </div>
  
      <div style="font-size:18px; font-weight:800;">
        ${stTable}
      </div>
  
      <!-- PURPLEAIR (SECONDARY) -->
      <div style="font-weight:600; font-size:12px; margin:10px 0 4px;">
        PurpleAir (3)
      </div>
  
      <div style="font-size:12px; opacity:0.9;">
        ${paTable}
      </div>
  
      ${weatherHtml}
      ${forecastHtml}
  
    </div>
  `;


  

  if (typeof window.updatePanelLocation === "function") {
    window.updatePanelLocation(addressText, lat, lng);
  }

  marker.setPopupContent(popupHtml);
}
