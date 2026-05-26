window.computeEAQHI = function(pm) {
  if (pm == null || isNaN(pm)) return null;
  pm = Number(pm);
  if (pm <= 0) return null;
  if (pm <= 10) return 1;
  if (pm <= 20) return 2;
  if (pm <= 30) return 3;
  if (pm <= 40) return 4;
  if (pm <= 50) return 5;
  if (pm <= 60) return 6;
  if (pm <= 70) return 7;
  if (pm <= 80) return 8;
  if (pm <= 90) return 9;
  return 10;
};
window.renderPurpleAir = async function(){
  if(!window.layers?.purpleair) return;
  await window.AppData.ready;
  window.layers.purpleair.clearLayers();
  (window.AppData.purpleair || []).forEach(rec => {
    const lat=Number(rec.lat), lon=Number(rec.lon), pm=Number(rec.pm);
    if(!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(pm)) return;
    const eAQHI = window.computeEAQHI(pm);
    if(eAQHI == null) return;
    const color = window.getAQHIColor(eAQHI);
    const popup = `<strong>PurpleAir</strong><br>${rec.name || "Sensor"}<br>${rec.sensor_index ? `Sensor index: ${rec.sensor_index}<br>` : ""}eAQHI: <b>${eAQHI}</b><br>PM₂.₅: ${pm.toFixed(1)} µg/m³<br>${rec.last_seen ? `<small>Last seen: ${rec.last_seen}</small><br>` : ""}${rec.quality_flag ? `<small>Flag: ${rec.quality_flag}</small>` : ""}`;
    window.layers.purpleair.addLayer(L.circleMarker([lat,lon], {radius:9, fillColor:color, color:"#111", weight:1, fillOpacity:0.88}).bindPopup(popup));
    window.layers.purpleair.addLayer(L.marker([lat,lon], {icon:L.divIcon({className:"purpleair-label", html:`<div class="pa-inner">${eAQHI}</div>`, iconSize:[18,18], iconAnchor:[9,9]}), interactive:false}));
  });
};
