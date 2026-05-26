window.initMap = function(){
  const mapDiv = document.getElementById("map");
  if(!mapDiv) return console.error("No #map div found");
  if(window.map instanceof L.Map) return;
  const cfg = window.APP_CONFIG || {};
  const map = L.map(mapDiv, { minZoom: cfg.minZoom || 5, maxZoom: cfg.maxZoom || 18 });
  if(cfg.center && cfg.zoom) map.setView(cfg.center, cfg.zoom); else map.fitBounds(cfg.bounds || [[48.9,-110.1],[60.1,-101.3]]);
  window.map = map;
  const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom:18}).addTo(map);
  const satellite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {attribution:"Tiles © Esri", maxZoom:19});
  const legend = L.control({position:"bottomright"});
  legend.onAdd = function(){ const img=L.DomUtil.create("img"); img.src="images/aqhi_legend.png"; img.style.width="275px"; return img; };
  legend.addTo(map);
  window.layers = {
    stations:L.layerGroup().addTo(map), click:L.layerGroup().addTo(map), purpleair:L.layerGroup().addTo(map), forecast:L.layerGroup(),
    weather_radar:L.layerGroup(), weather_wind_u:L.layerGroup(), weather_lightning:L.layerGroup(), weather_thunderstorm:L.layerGroup()
  };
  window.layers.weather_radar.addLayer(L.tileLayer.wms("https://geo.weather.gc.ca/geomet/?lang=en", {layers:"RADAR_1KM_RRAI",format:"image/png",transparent:true,opacity:0.85}));
  window.layers.weather_wind_u.addLayer(L.tileLayer.wms("https://geo.weather.gc.ca/geomet/?lang=en", {layers:"HRDPS.CONTINENTAL_UU",format:"image/png",transparent:true,opacity:0.7}));
  window.layers.weather_lightning.addLayer(L.tileLayer.wms("https://geo.weather.gc.ca/geomet/?lang=en", {layers:"Lightning_2.5km_Density",format:"image/png",transparent:true,opacity:0.85}));
  window.layers.weather_thunderstorm.addLayer(L.tileLayer.wms("https://geo.weather.gc.ca/geomet/?lang=en", {layers:"GDPS-WEonG_15km_Thunderstorm-Prob.3h",format:"image/png",transparent:true,opacity:0.75}));
  const labels = {stations:"Stations", forecast:"SK AQHI Forecast", purpleair:"Sensors (PurpleAir)", weather_radar:"Radar", weather_wind_u:"Winds", weather_lightning:"Lightning", weather_thunderstorm:"Thunderstorm (3h)"};
  const overlays = {};
  (cfg.overlays || Object.keys(labels)).forEach(k => { if(window.layers[k]) overlays[labels[k] || k] = window.layers[k]; });
  window._layerControl = L.control.layers({OpenStreetMap:osm, Satellite:satellite}, overlays, {collapsed:false}).addTo(map);
  map.on("click", async e => { if(window.handleMapClick) await window.handleMapClick(e.latlng.lat, e.latlng.lng, map); });
};
