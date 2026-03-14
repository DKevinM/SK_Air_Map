// create map
document.addEventListener("DOMContentLoaded", function () {

if (window.map) {
    window.map.remove();
}

var map = L.map("map").setView([52.5, -106], 6);
window.map = map;

L.tileLayer(
"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
{
attribution: "© OpenStreetMap"
}).addTo(map);


// Saskatchewan air monitoring API
var api =
"https://services3.arcgis.com/zcv98lgAl8xQ04cW/ArcGIS/rest/services/Hourly_Ambient_Air_Quality/FeatureServer/0/query?where=1=1&outFields=*&f=geojson";


// AQHI calculation
function calcAQHI(pm25,no2,o3){

  var aqhi =
  (10/10.4) *
  (
    Math.exp(0.000537 * no2) +
    Math.exp(0.000871 * o3) +
    Math.exp(0.000487 * pm25) - 3
  );

  return Math.round(aqhi);
}


// AQHI colors
function aqhiColor(v){

  if(v == null) return "#808080";

  if(v <= 1) return "#009966";
  if(v <= 2) return "#33cc33";
  if(v <= 3) return "#99cc33";
  if(v <= 4) return "#ffde33";
  if(v <= 5) return "#ffcc33";
  if(v <= 6) return "#ff9933";
  if(v <= 7) return "#ff6600";
  if(v <= 8) return "#ff3300";
  if(v <= 9) return "#cc0033";
  if(v <= 10) return "#990033";

  return "#660033";
}


function round1(v){
  if (v == null) return "N/A";
  return Number(v).toFixed(1);
}    

    
// load stations
fetch(api)
.then(r => r.json())
.then(data => {

  console.log("Stations returned:", data.features.length);

  // remove features with bad geometry
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

      var aqhi = calcAQHI(p.PM2_5,p.NO2,p.O3);

      return L.circleMarker(latlng,{
        radius:8,
        color:"#333",
        weight:1,
        fillColor:aqhiColor(aqhi),
        fillOpacity:0.9
      });

    },

    onEachFeature:function(feature,layer){

      var p = feature.properties;

      var aqhi = calcAQHI(p.PM2_5,p.NO2,p.O3);

      var time = new Date(p.DATETIME).toLocaleString();

      layer.bindPopup(
        "<b>"+p.COMMUNITY+"</b><br>"+
        "AQHI: "+aqhi+"<br>"+
        "PM2.5: "+round1(p.PM2_5)+"<br>"+
        "NO₂: "+round1(p.NO2)+"<br>"+
        "O₃: "+round1(p.O3)+"<br>"+
        "Wind: "+round1(p.WS)+" km/h<br>"+
        "Temp: "+round1(p.TEMP)+" °C<br>"+
        time
      );

    }

  }).addTo(map);

});

});    
