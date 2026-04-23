// create map
document.addEventListener("DOMContentLoaded", function () {

if (window.map) {
    window.map.remove();
}

var map = L.map("map").setView([52.5,-106],6);
    
window.map = map;

var stationLayer = L.layerGroup().addTo(map);
    

var osm = L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  { attribution: "© OpenStreetMap" }
);

var satellite = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  { attribution: "Tiles © Esri" }
);

osm.addTo(map);



// FireSmoke layers (GeoJSON polygons)

function smokeStyle(feature){

  var v = feature.properties.pm25;

  if(v < 5)  return {fillColor:"#ffffcc", weight:0, color:"none", fillOpacity:0.5};
  if(v < 10) return {fillColor:"#ffeda0", weight:0, color:"none", fillOpacity:0.6};
  if(v < 25) return {fillColor:"#feb24c", weight:0, color:"none", fillOpacity:0.7};
  if(v < 50) return {fillColor:"#f03b20", weight:0, color:"none", fillOpacity:0.8};
  if(v < 100) return {fillColor:"#bd0026", weight:0, color:"none", fillOpacity:0.9};

  return {fillColor:"#800026", weight:0, color:"none", fillOpacity:0.95};
}

function loadSmokeLayer(url){

  var layer = L.layerGroup();

  fetch(url + "?v=" + Date.now())
  .then(r => r.json())
  .then(data => {

    L.geoJSON(data,{
      style: smokeStyle,
      onEachFeature:function(feature,layer){

        var v = feature.properties.pm25;

        layer.bindTooltip(
          "Smoke PM2.5: " + v + " µg/m³"
        );

      }
    }).addTo(layer);

  });

  return layer;
}



function aqhiGridStyle(feature) {
  var v = feature.properties.aqhi ?? feature.properties.AQHI ?? null;

  return {
    fillColor: aqhiColor(v),
    weight: 0.3,
    color: "#666",
    fillOpacity: 0.35,
    interactive: false
  };
}

function loadAqhiGridLayer(url) {
  var layer = L.layerGroup();

  fetch(url + "?v=" + Date.now())
    .then(r => r.json())
    .then(data => {
      L.geoJSON(data, {
        style: aqhiGridStyle,
        onEachFeature: function(feature, lyr) {
          var v = feature.properties.aqhi ?? feature.properties.AQHI ?? "N/A";
          lyr.bindTooltip("AQHI Grid: " + v);
        }
      }).addTo(layer);
    })
    .catch(err => console.error("AQHI grid load failed:", err));

  return layer;
}

    

    
const FIRESMOKE_BASE = "https://raw.githubusercontent.com/dkevinm/AB_datapull/main/data/output";

var smoke0  = loadSmokeLayer(`${FIRESMOKE_BASE}/firesmoke_now.geojson`);
var smoke6  = loadSmokeLayer(`${FIRESMOKE_BASE}/firesmoke_6h.geojson`);
var smoke12 = loadSmokeLayer(`${FIRESMOKE_BASE}/firesmoke_12h.geojson`);
var smoke24 = loadSmokeLayer(`${FIRESMOKE_BASE}/firesmoke_24h.geojson`);    



var pm25Layer = loadPM25Layer(
  "https://raw.githubusercontent.com/dkevinm/AB_datapull/main/dataSK/SK_PM25_map.json"
);

var aqhiGridLayer = loadAqhiGridLayer("data/sk_aqhi_grid.geojson");

    
var baseLayers = {
  "OpenStreetMap": osm,
  "Satellite": satellite
};

var overlays = {
  "AQHI Stations": stationLayer,
  "AQHI Grid": aqhiGridLayer,
  "Smoke Now": smoke0,
  "Smoke +6 hr": smoke6,
  "Smoke +12 hr": smoke12,
  "Smoke +24 hr": smoke24,
  "PM2.5 Sensors": pm25Layer
};

L.control.layers(baseLayers, overlays, {
  position: "topright",
  collapsed: false
}).addTo(map);




    

function getPMColor(pm){

  if(pm == null || isNaN(pm)) return "#808080";

  if (pm > 100) return "#640100";
  if (pm > 90)  return "#9a0100";
  if (pm > 80)  return "#cc0001";
  if (pm > 70)  return "#fe0002";
  if (pm > 60)  return "#fd6866";
  if (pm > 50)  return "#ff9835";
  if (pm > 40)  return "#ffcb00";
  if (pm > 30)  return "#fffe03";
  if (pm > 20)  return "#016797";
  if (pm > 10)  return "#0099cb";
  if (pm > 0)   return "#01cbff";

  return "#D3D3D3";
}

function pm25Style(feature){

  const v = feature.properties.pm25;

  return {
    fillColor: getPMColor(v),
    weight: 0.2,
    color: "#333",
    fillOpacity: 0.7
  };
}


function loadPM25Layer(url){

  var layer = L.layerGroup();

  fetch(url + "?v=" + Date.now())
  .then(r => r.json())
  .then(data => {

    console.log("PM25 features:", data.features?.length);

    L.geoJSON(data,{

      pointToLayer: function(feature, latlng){

        const p = feature.properties || {};
        const pm = p.pm25;

        return L.circleMarker(latlng, {
          radius: 6,
          fillColor: getPMColor(pm),
          color: "#333",
          weight: 1,
          fillOpacity: 0.8
        });

      },

      onEachFeature:function(feature,layer){

        const p = feature.properties || {};

        layer.bindPopup(`
          <b>${p.name ?? "Sensor"}</b><br>
          PM2.5: ${p.pm25 ?? "N/A"} µg/m³<br>
          Raw: ${p.pm_raw ?? "N/A"}<br>
          Humidity: ${p.humidity ?? "N/A"}%<br>
          Method: ${p.method ?? "N/A"}<br>
          Last Seen: ${p.last_seen ? new Date(p.last_seen).toLocaleString() : "N/A"}
        `);

      }

    }).addTo(layer);

  });

  return layer;
}


    

    
    
// Saskatchewan air monitoring API
var api =
"https://services3.arcgis.com/zcv98lgAl8xQ04cW/ArcGIS/rest/services/Hourly_Ambient_Air_Quality/FeatureServer/0/query?where=1=1&outFields=*&f=geojson";



    

// AQHI colors
function aqhiColor(v){

  if(v == null) return "#D3D3D3";

  if (v < 1)  return "#D3D3D3";
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
}
    

function round1(v){
  if (v == null) return "N/A";
  return Number(v).toFixed(1);
}    




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

   

    
    
var aqhiLookup = {};
var forecastLookup = {};
    Promise.all([
      fetch("data/sk_aqhi_current.geojson").then(r => r.json()),
      fetch("data/forecast.json").then(r => r.json())
    ]).then(([currentData, forecastData]) => {
    
      currentData.features.forEach(f => {
        var p = f.properties;
        aqhiLookup[p.station.toUpperCase()] = {
          aqhi: Number(p.AQHI),
          time: p.updated
        };
      });
    
      forecastData.features.forEach(f => {
        var p = f.properties;
        forecastLookup[p.station.toUpperCase()] = {
          aqhi_fc: p.aqhi_forecast ?? p.AQHI_forecast ?? p.forecast_aqhi ?? p.AQHI ?? null,
          pm25_fc: p.pm25_forecast ?? p.PM2_5 ?? null,
          time_fc: p.forecast_time ?? p.updated ?? null
        };
      });
    
      console.log("AQHI lookup table:", aqhiLookup);
      console.log("Forecast lookup table:", forecastLookup);
    
      loadStations();
    
    }).catch(err => {
      console.error("Failed loading AQHI/forecast files:", err);
      loadStations();
    });


    


    
// load stations
function loadStations(){
stationLayer.clearLayers();
fetch(api)
.then(r => r.json())
.then(data => {

  console.log("Stations returned:", data.features.length);

  var clean = data.features.filter(f => {

      if (!f.geometry) return false;
      if (!f.geometry.coordinates) return false;

      const lon = f.geometry.coordinates[0];
      const lat = f.geometry.coordinates[1];

      if (lon === null || lat === null) return false;
      if (isNaN(lon) || isNaN(lat)) return false;

      return true;

  });

  L.geoJSON(clean, {

    pointToLayer: function(feature, latlng) {
    
      var p = feature.properties;
      var aqhiData = aqhiLookup[p.COMMUNITY.toUpperCase()];
      var aqhi = aqhiData ? aqhiData.aqhi : null;
      var color = aqhiColor(aqhi);
    
      var icon = L.divIcon({
        className: "aqhi-marker",
        html:
          "<div style='background:" + color + "'>" +
          (aqhi ?? "") +
          "</div>",
        iconSize: [38, 38]
      });
    
      console.log(p.COMMUNITY, aqhiLookup[p.COMMUNITY.toUpperCase()]);
      return L.marker(latlng, { icon: icon });
    
    },

    onEachFeature:function(feature,layer){

    var p = feature.properties;
    
    var aqhiData = aqhiLookup[p.COMMUNITY.toUpperCase()];
    var fcData = forecastLookup[p.COMMUNITY.toUpperCase()];
    
    var aqhi = aqhiData ? aqhiData.aqhi : null;
    var aqhiTime = aqhiData && aqhiData.time ? new Date(aqhiData.time).toLocaleString() : "N/A";
    
    var aqhiFc = fcData ? fcData.aqhi_fc : null;
    var pm25Fc = fcData ? fcData.pm25_fc : null;
    var fcTime = fcData && fcData.time_fc ? new Date(fcData.time_fc).toLocaleString() : "N/A";
    
    var time = p.DATETIME ? new Date(p.DATETIME).toLocaleString() : "N/A";

      layer.bindPopup(
        "<b>"+p.COMMUNITY+"</b><br>"+
        "AQHI (current 3hr): "+(aqhi ?? "N/A")+"<br>"+
        "<hr>"+
        "PM2.5: "+round1(p.PM2_5)+" µg/m³<br>"+
        "NO₂: "+round1(p.NO2)+" ppb<br>"+
        "O₃: "+round1(p.O3)+" ppb<br>"+
        "Wind: "+round1(p.WS)+" km/h<br>"+
        "Temp: "+round1(p.TEMP)+" °C<br>"+
        "<hr>"+
        "<b>Forecast</b><br>"+
        "AQHI forecast: "+(aqhiFc ?? "N/A")+"<br>"+
        "PM2.5 forecast: "+round1(pm25Fc)+" µg/m³<br>"+
        "Forecast time: "+fcTime+"<br>"+
        "<hr>"+
        "Station time: "+time+"<br>"+
        "AQHI updated: "+aqhiTime
      );

    }

  }).addTo(stationLayer);


});
}



window.handleMapClick = async function(lat, lng, map) {
  try {
    if (window.clickMarker) {
      map.removeLayer(window.clickMarker);
    }

    window.clickMarker = L.marker([lat, lng]).addTo(map);

    const weatherData = await window.fetchWeather(lat, lng);

    if (weatherData) {
      const current = window.extractCurrentWeather(weatherData);

      const locEl = document.getElementById("panel-location");
      if (locEl) {
        locEl.innerHTML = `
          <div style="font-weight:600; margin-bottom:4px;">Selected Location</div>
          <div style="font-size:12px;">
            Lat: ${lat.toFixed(4)}<br>
            Lon: ${lng.toFixed(4)}
          </div>
        `;
      }

      window.renderPanelWeather(current, lat, lng, "Selected location");
      window.showCurrentWeather(lat, lng);
      window.showWeatherForPoint(lat, lng);
    }

  } catch (err) {
    console.error("handleMapClick failed:", err);
  }
};




map.on("click", function(e) {
  window.handleMapClick(e.latlng.lat, e.latlng.lng, map);
});



    
async function lookupAddress() {
  const address = document.getElementById("addressInput").value;
  if (!address) return;

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (!data || data.length === 0) {
      alert("Address not found");
      return;
    }

    const lat = parseFloat(data[0].lat);
    const lon = parseFloat(data[0].lon);

    console.log("[LiveMap] Address →", lat, lon);

    // move map
    if (window.map) {
      window.map.setView([lat, lon], 10);
    }

    // open panel
    const panel = document.getElementById("panel");
    if (panel) panel.classList.remove("collapsed");

    // call EXISTING pipeline
    if (typeof window.handleMapClick === "function") {
      await window.handleMapClick(lat, lon, window.map);
    } else {
      console.error("handleMapClick not found");
    }

  } catch (err) {
    console.error("Geocode error:", err);
  }
}


window.lookupAddress = lookupAddress;







    
});
