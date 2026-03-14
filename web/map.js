// create map
var map = L.map("map").setView([52.5, -106], 6);

// base map
L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    attribution: "© OpenStreetMap"
  }
).addTo(map);


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

  if(v <= 3) return "#009966";
  if(v <= 6) return "#ffde33";
  if(v <= 10) return "#ff9933";

  return "#cc0033";
}


// load stations
fetch(api)
.then(r => r.json())
.then(data => {

  console.log("Stations returned:", data.features.length);

  // remove features with bad geometry
  var clean = data.features.filter(f =>
    f.geometry &&
    f.geometry.coordinates &&
    f.geometry.coordinates.length === 2
  );

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
        "PM2.5: "+p.PM2_5+"<br>"+
        "NO₂: "+p.NO2+"<br>"+
        "O₃: "+p.O3+"<br>"+
        "Wind: "+p.WS+" km/h<br>"+
        "Temp: "+p.TEMP+" °C<br>"+
        time
      );

    }

  }).addTo(map);

});
