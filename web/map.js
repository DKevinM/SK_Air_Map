const map = L.map("map").setView([52.5,-106],6)

L.tileLayer(
"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
{ attribution: "OSM"}
).addTo(map)


// Load SK stations
fetch("../data/sk_current.geojson")
.then(r=>r.json())
.then(data=>{

L.geoJSON(data,{

pointToLayer:(f,latlng)=>
L.circleMarker(latlng,{
radius:8,
color:"#222",
fillColor:"#2c7fb8",
fillOpacity:0.9
}),

onEachFeature:(f,l)=>{

const p=f.properties

l.bindPopup(`
<b>${p.station}</b><br>
PM2.5: ${p.pm25}<br>
NO2: ${p.no2}<br>
O3: ${p.o3}<br>
Temp: ${p.temp} °C<br>
Wind: ${p.wind} km/h<br>
${p.datetime}
`)
}

}).addTo(map)

})
