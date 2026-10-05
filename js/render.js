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
    const dnaContainerId = "dna-" + String(st.stationName || "").replace(/[^a-zA-Z0-9]/g, "");
    const html = `<strong>${st.stationName}</strong><br><small>${displayTime}</small><br><br>${window.buildStationPopup(rows)}<div id="${dnaContainerId}"></div><hr><span style="font-size:11px;">Saskatchewan AQHI station</span>`;
    const marker = L.circleMarker([st.lat, st.lon], {radius:18, fillColor:color, color:"#222", weight:2, fillOpacity:0.85}).bindPopup(html);
    // AQHI "DNA" driver chart - same computeAQHIDrivers/renderDNAChartInto
    // as the AB LiveMap pages (see WCAS.html) - this repo's rows already
    // use the identical ParameterName/Value shape, so the chart code is
    // reused verbatim, just wired to popupopen here instead of render.js's
    // generic placeholder hook (this repo's render.js predates that
    // shared-file pattern and builds popups its own way).
    marker.on("popupopen", function () {
      if (window.renderDNAChartInto) window.renderDNAChartInto(dnaContainerId, rows, aqhiVal);
    });
    window.layers.stations.addLayer(marker);
    if(Number.isFinite(aqhiVal)) window.layers.stations.addLayer(L.marker([st.lat, st.lon], {icon:L.divIcon({className:"aqhi-label", html: aqhiVal>10?"10+":Math.round(aqhiVal), iconSize:[30,30], iconAnchor:[15,15]}), interactive:false}));
  });





 

  
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


// FireSmoke - same as AB LiveMap (LiveMap/js/render.js): one PNG overlay
// from AB_datapull (its PNGs already cover -130..-90 / 42..65, so all of
// SK), click-to-pick-a-time instead of four toggle layers. Replaced the
// four ~16 MB GeoJSON layers that were fetched on every page load - the
// same vector approach that OOM-crashed browsers on AB (2026-08-21).
// Smoke season: ON Mar 1 - Oct 31, OFF Nov 1 - end of Feb, back on by
// itself every Mar 1 (SK date, UTC-6 all year).
window.inSmokeSeason = function () {
  const m = new Date(Date.now() - 6 * 3600 * 1000).getUTCMonth();   // 0 = Jan
  return m >= 2 && m <= 9;                                           // Mar..Oct
};

const SMOKE_BASE_URL = "https://raw.githubusercontent.com/DKevinM/AB_datapull/main/data/output";
const FIRESMOKE_HOURS = [
  { key: "00h", label: "Now",  file: "firesmoke_00h.png" },
  { key: "06h", label: "+6h",  file: "firesmoke_06h.png" },
  { key: "12h", label: "+12h", file: "firesmoke_12h.png" },
  { key: "24h", label: "+24h", file: "firesmoke_24h.png" }
];
window._firesmokeHour = window._firesmokeHour || "00h";

window.loadFireSmokeCombined = function () {
  if (!window.inSmokeSeason()) return;   // off-season: no layer, no PNG fetch
  const layer = window.layers?.firesmoke;
  if (!layer) return;
  layer.clearLayers();

  const smokeBounds = [[42.0, -130.0], [65.0, -90.0]];
  const current = FIRESMOKE_HOURS.find(h => h.key === window._firesmokeHour) || FIRESMOKE_HOURS[0];

  // Own pane above the vector overlays: Leaflet stacks the SVG renderer
  // (z 200) over image overlays (z 10) in overlayPane, and SK's AQHI grid
  // is on by default and covers the whole province - so in the shared pane
  // the grid swallowed every click and the time picker never opened.
  // 450 = above overlayPane (400), below markers (600) and popups.
  if (!window.map.getPane("smokePane")) window.map.createPane("smokePane").style.zIndex = 450;

  const smoke = L.imageOverlay(
    `${SMOKE_BASE_URL}/${current.file}?t=${Date.now()}`,   // cache-bust raw.githubusercontent
    smokeBounds,
    { opacity: 0.55, interactive: true, pane: "smokePane" }
  );

  // Plain DOM listener on the <img> (created lazily when the layer is
  // first switched on) - see LiveMap/js/render.js for why.
  smoke.on("add", function () {
    const imgEl = smoke.getElement();
    if (!imgEl || imgEl._firesmokeClickBound) return;
    imgEl._firesmokeClickBound = true;

    imgEl.addEventListener("click", function (domEvt) {
      // Stop the map's own click handler (handleMapClick) from firing too.
      domEvt.stopPropagation();

      const mapRect = window.map.getContainer().getBoundingClientRect();
      const point = L.point(domEvt.clientX - mapRect.left, domEvt.clientY - mapRect.top);
      const latlng = window.map.containerPointToLatLng(point);

      const popupDiv = document.createElement("div");
      popupDiv.className = "firesmoke-time-popup";

      const title = document.createElement("div");
      title.style.fontWeight = "600";
      title.style.marginBottom = "6px";
      title.textContent = "FireSmoke forecast time";
      popupDiv.appendChild(title);

      FIRESMOKE_HOURS.forEach(h => {
        const btn = document.createElement("button");
        btn.textContent = h.label;
        btn.style.margin = "2px";
        btn.style.padding = "4px 10px";
        btn.style.cursor = "pointer";
        if (h.key === window._firesmokeHour) {
          btn.style.fontWeight = "700";
          btn.style.background = "#444";
          btn.style.color = "#fff";
        }
        btn.onclick = function () {
          window._firesmokeHour = h.key;
          window.loadFireSmokeCombined();
          window.map.closePopup();
        };
        popupDiv.appendChild(btn);
      });

      L.popup({ closeButton: true })
        .setLatLng(latlng)
        .setContent(popupDiv)
        .openOn(window.map);
    });
  });

  layer.addLayer(smoke);

  const hourLabelEl = document.getElementById("smoke-legend-hour");
  if (hourLabelEl) hourLabelEl.textContent = `Showing: ${current.label} — click on map to change`;

  console.log("Loaded FireSmoke PNG:", current.file);
};
