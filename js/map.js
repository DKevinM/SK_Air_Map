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
  
    stations: L.layerGroup().addTo(map),
    click: L.layerGroup().addTo(map),
    purpleair: L.layerGroup().addTo(map),
    forecast: L.layerGroup(),

    sk_current: L.layerGroup().addTo(map),
    sk_forecast: L.layerGroup(),
    
    regina_current: L.layerGroup(),
    regina_forecast: L.layerGroup(),
  
    weather_radar: L.layerGroup(),
    weather_wind_u: L.layerGroup(),
    weather_lightning: L.layerGroup(),
    weather_thunderstorm: L.layerGroup(),
  
    firesmoke_now: L.layerGroup(),
    firesmoke_6h: L.layerGroup(),
    firesmoke_12h: L.layerGroup(),
    firesmoke_24h: L.layerGroup()
  
  };
  window.layers.weather_radar.addLayer(L.tileLayer.wms("https://geo.weather.gc.ca/geomet/?lang=en", {layers:"RADAR_1KM_RRAI",format:"image/png",transparent:true,opacity:0.85}));
  window.layers.weather_wind_u.addLayer(L.tileLayer.wms("https://geo.weather.gc.ca/geomet/?lang=en", {layers:"HRDPS.CONTINENTAL_UU",format:"image/png",transparent:true,opacity:0.7}));
  window.layers.weather_lightning.addLayer(L.tileLayer.wms("https://geo.weather.gc.ca/geomet/?lang=en", {layers:"Lightning_2.5km_Density",format:"image/png",transparent:true,opacity:0.85}));
  window.layers.weather_thunderstorm.addLayer(L.tileLayer.wms("https://geo.weather.gc.ca/geomet/?lang=en", {layers:"GDPS-WEonG_15km_Thunderstorm-Prob.3h",format:"image/png",transparent:true,opacity:0.75}));

  const smokeBounds = [
    [42, -130],
    [65, -90]
  ];
  
  window.layers.firesmoke_now.addLayer(
    L.imageOverlay(
      "https://dkevinm.github.io/AB_datapull/data/output/firesmoke_now.png",
      smokeBounds,
      { opacity: 0.55 }
    )
  );
  
  window.layers.firesmoke_6h.addLayer(
    L.imageOverlay(
      "https://dkevinm.github.io/AB_datapull/data/output/firesmoke_6h.png",
      smokeBounds,
      { opacity: 0.55 }
    )
  );
  
  window.layers.firesmoke_12h.addLayer(
    L.imageOverlay(
      "https://dkevinm.github.io/AB_datapull/data/output/firesmoke_12h.png",
      smokeBounds,
      { opacity: 0.55 }
    )
  );
  
  window.layers.firesmoke_24h.addLayer(
    L.imageOverlay(
      "https://dkevinm.github.io/AB_datapull/data/output/firesmoke_24h.png",
      smokeBounds,
      { opacity: 0.55 }
    )
  );

  // =====================================================
  // LOAD AQHI GRID OVERLAYS
  // =====================================================
  
  loadAQHIGrid(
    "https://dkevinm.github.io/SK_datapull/data/sk_current_blend.geojson",
    window.layers.sk_current
  );
  loadAQHIGrid(
    "https://dkevinm.github.io/SK_datapull/data/sk_forecast_3h_blend.geojson",
    window.layers.sk_forecast
  );
  loadAQHIGrid(
    "https://dkevinm.github.io/SK_datapull/data/regina_current_blend.geojson",
    window.layers.regina_current
  );
  loadAQHIGrid(
    "https://dkevinm.github.io/SK_datapull/data/regina_forecast_3h_blend.geojson",
    window.layers.regina_forecast
  );



  
  // =====================================================
  // AQHI GRID LOADER
  // =====================================================
  
  function aqhiGridStyle(feature){
  
    return {
      fillColor: feature.properties.color || "#999999",
      fillOpacity: 0.75,
      weight: 0.3,
      color: "#333"
    };
  
  }
  
  function loadAQHIGrid(url, targetLayer){
  
    fetch(url + "?v=" + Date.now())
  
      .then(r => r.json())
  
      .then(data => {
  
        console.log("Loaded AQHI grid:", url);
  
        L.geoJSON(data, {
  
          style: aqhiGridStyle,
  
          onEachFeature: function(feature, layer){
  
            const p = feature.properties || {};
  
            layer.bindTooltip(
              `
              AQHI: ${p.AQHI ?? "N/A"}<br>
              ${p.category ?? ""}
              `
            );
  
          }
  
        }).addTo(targetLayer);
  
      })
  
      .catch(err => {
        console.error("AQHI grid failed:", url, err);
      });
  
  }


  
  
  const labels = {
  
    stations:"Stations",
    forecast:"SK AQHI Forecast",

    sk_current:"SK AQHI Current Grid",
    sk_forecast:"SK AQHI Forecast Grid",
    
    regina_current:"Regina AQHI Current",
    regina_forecast:"Regina AQHI Forecast",
    
    purpleair:"Sensors (PurpleAir)",
  
    firesmoke_now:"FireSmoke Current",
    firesmoke_6h:"FireSmoke +6h",
    firesmoke_12h:"FireSmoke +12h",
    firesmoke_24h:"FireSmoke +24h",
  
    weather_radar:"Radar",
    weather_wind_u:"Winds",
    weather_lightning:"Lightning",
    weather_thunderstorm:"Thunderstorm (3h)"
  
  };

  
  const overlays = {};
  (cfg.overlays || Object.keys(labels)).forEach(k => { if(window.layers[k]) overlays[labels[k] || k] = window.layers[k]; });
  window._layerControl = L.control.layers({OpenStreetMap:osm, Satellite:satellite}, overlays, {collapsed:false}).addTo(map);
  map.on("click", async e => { if(window.handleMapClick) await window.handleMapClick(e.latlng.lat, e.latlng.lng, map); });
};
