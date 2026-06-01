window.renderMap = async function(){
  if(!window.map) return;
  await window.AppData.ready;
  const map = window.map;
  window.layers.stations.clearLayers();
  if(window.renderPurpleAir) await window.renderPurpleAir();

  (window.AppData.stations || []).forEach(st => {
    const rows = st.rows || [];
    const aqhiVal = Number(st.aqhi);
    const color = Number.isFinite(aqhiVal) ? window.getAQHIColor(aqhiVal) : "#888";
    const latest = rows.map(r=>new Date(r.ReadingDate)).filter(d=>!isNaN(d)).sort((a,b)=>b-a)[0];
    const displayTime = latest ? latest.toLocaleString("en-CA", {timeZone: window.APP_CONFIG?.timezone || "America/Regina", hour12:true}) : "";
    const html = `<strong>${st.stationName}</strong><br><small>${displayTime}</small><br><br>${window.buildStationPopup(rows)}<hr><span style="font-size:11px;">Saskatchewan AQHI station</span>`;
    const marker = L.circleMarker([st.lat, st.lon], {radius:18, fillColor:color, color:"#222", weight:2, fillOpacity:0.85}).bindPopup(html);
    window.layers.stations.addLayer(marker);
    if(Number.isFinite(aqhiVal)) window.layers.stations.addLayer(L.marker([st.lat, st.lon], {icon:L.divIcon({className:"aqhi-label", html: aqhiVal>10?"10+":Math.round(aqhiVal), iconSize:[30,30], iconAnchor:[15,15]}), interactive:false}));
  });




function loadFireSmokeLayer(url, layer) {
  fetch(url)
    .then(r => r.json())
    .then(geo => {
      layer.clearLayers();

      L.geoJSON(geo, {
        style: f => ({
          fillColor: getSmokeColor(f.properties.pm25),
          fillOpacity: 0.4,
          color: "none",
          weight: 0
        }),

        onEachFeature: function (feature, lyr) {
          const pm = Number(feature.properties?.pm25);
          const ts = feature.properties?.timestamp || "";

          lyr.bindTooltip(
            `PM2.5: ${isFinite(pm) ? pm.toFixed(1) : "—"} µg/m³` +
            (ts ? `<br>${ts}` : ""),
            {
              sticky: true
            }
          );
        }
      }).addTo(layer);

      console.log("Loaded FireSmoke:", url);
    })
    .catch(e => console.error("FireSmoke load failed:", e));
}


function getSmokeColor(pm) {
  if (pm < 1)   return "#f2e8b3";
  if (pm < 10)  return "#e8c95c";
  if (pm < 28)  return "#f5a623";
  if (pm < 60)  return "#f57c00";
  if (pm < 120) return "#cc5500";
  return "#662200";
}

 

  
  (window.AppData.forecast || []).forEach(fc => {  
      if(
        !fc.geometry ||
        !fc.properties ||
        !Number.isFinite(Number(fc.properties.AQHI))
      ) return;
      const aq = Number(fc.properties.AQHI);  
      const layer = L.geoJSON(fc, {  
        style: {
          fillColor: window.getAQHIColor(aq),
          fillOpacity: 0.45,
          color: "#333",
          weight: 0.5
        },  
        onEachFeature: function(feature, lyr){  
          lyr.bindPopup(`
            <strong>SK Forecast AQHI</strong><br>
            AQHI: <b>${aq > 10 ? "10+" : Math.round(aq)}</b><br>
            <small>${feature.properties.category || ""}</small>
          `);  
        }  
      });  
      window.layers.forecast.addLayer(layer);  
  });
  console.log("SK LiveMap rendered", window.AppData.stations.length, "stations", window.AppData.purpleair.length, "PurpleAir", window.AppData.forecast.length, "forecasts");
};
