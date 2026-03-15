// create map
document.addEventListener("DOMContentLoaded", function () {

if (window.map) {
    window.map.remove();
}

    
var map = L.map("map").setView([52.5,-106],6);
    
window.map = map;

var stationLayer = L.layerGroup().addTo(map);
    


L.tileLayer(
"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
{
attribution: "© OpenStreetMap"
}).addTo(map);





// FireSmoke overlay
var smoke0 = L.imageOverlay(
  "https://dkevinm.github.io/SK_Air_Map/data/firesmoke_0h.png?v=" + Date.now(),
  [[35,-145],[75,-85]],
  {opacity:0.6}
);

var smoke6 = L.imageOverlay(
  "https://dkevinm.github.io/SK_Air_Map/data/firesmoke_6h.png?v=" + Date.now(),
  [[35,-145],[75,-85]],
  {opacity:0.6}
);

var smoke12 = L.imageOverlay(
  "https://dkevinm.github.io/SK_Air_Map/data/firesmoke_12h.png?v=" + Date.now(),
  [[35,-145],[75,-85]],
  {opacity:0.6}
);

var smoke24 = L.imageOverlay(
  "https://dkevinm.github.io/SK_Air_Map/data/firesmoke_24h.png?v=" + Date.now(),
  [[35,-145],[75,-85]],
  {opacity:0.6}
);

var overlays = {
  "Smoke Now": smoke0,
  "Smoke +6 hr": smoke6,
  "Smoke +12 hr": smoke12,
  "Smoke +24 hr": smoke24
};

L.control.layers(null, overlays).addTo(map);


    

    
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


var aqhiLookup = {};
fetch("data/sk_aqhi_current.geojson")
.then(r => r.json())
.then(data => {
  data.features.forEach(f => {
    var p = f.properties;
    aqhiLookup[p.station] = {
      aqhi: p.aqhi,
      time: p.updated
    };
  });
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

    pointToLayer: function(feature,latlng){

      var p = feature.properties;

      var aqhiData = aqhiLookup[p.COMMUNITY];

      var aqhi = aqhiData ? aqhiData.aqhi : null;

      var color = aqhiColor(aqhi);
        
      var icon = L.divIcon({
        className: "aqhi-marker",
        html:
          "<div style='background:"+color+"'>"+
          (aqhi ?? "")+
          "</div>",
        iconSize: [38,38]
      });
        
      return L.marker(latlng,{icon:icon});

    },

    onEachFeature:function(feature,layer){

      var p = feature.properties;

      var aqhiData = aqhiLookup[p.COMMUNITY];

      var aqhi = aqhiData ? Number(aqhiData.aqhi) : null;
      var aqhiTime = aqhiData ? new Date(aqhiData.time).toLocaleString() : "N/A";

      var time = new Date(p.DATETIME).toLocaleString();

      layer.bindPopup(
        "<b>"+p.COMMUNITY+"</b><br>"+
        "AQHI (3hr): "+(aqhi ?? "N/A")+"<br>"+
        "<hr>"+
        "PM2.5: "+round1(p.PM2_5)+" µg/m³<br>"+
        "NO₂: "+round1(p.NO2)+" ppb<br>"+
        "O₃: "+round1(p.O3)+" ppb<br>"+
        "Wind: "+round1(p.WS)+" km/h<br>"+
        "Temp: "+round1(p.TEMP)+" °C<br>"+
        "<hr>"+
        "Station time: "+time+"<br>"+
        "AQHI time: "+aqhiTime
      );

    }

  }).addTo(stationLayer);

});
}
});
