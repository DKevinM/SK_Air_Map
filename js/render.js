window.renderMap = async function(){
  if(!window.map) return;
  await window.AppData.ready;
  const map = window.map;
  window.layers.stations.clearLayers();
  window.layers.forecast.clearLayers();
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

  (window.AppData.forecast || []).forEach(fc => {
    if(!Number.isFinite(fc.lat) || !Number.isFinite(fc.lon) || !Number.isFinite(Number(fc.aqhi))) return;
    const aq = Number(fc.aqhi);
    const marker = L.circleMarker([fc.lat, fc.lon], {radius:14, fillColor:window.getAQHIColor(aq), color:"#000", weight:2, dashArray:"4,3", fillOpacity:0.65})
      .bindPopup(`<strong>${fc.stationName}</strong><br>Forecast AQHI: <b>${aq>10?"10+":Math.round(aq)}</b><br><small>SK forecast layer</small>`);
    window.layers.forecast.addLayer(marker);
    window.layers.forecast.addLayer(L.marker([fc.lat, fc.lon], {icon:L.divIcon({className:"aqhi-label", html: aq>10?"10+":Math.round(aq), iconSize:[30,30], iconAnchor:[15,15]}), interactive:false}));
  });
  console.log("SK LiveMap rendered", window.AppData.stations.length, "stations", window.AppData.purpleair.length, "PurpleAir", window.AppData.forecast.length, "forecasts");
};
