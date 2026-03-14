const map = L.map("map").setView([52.5,-106],6)

L.tileLayer(
"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
{
attribution:"OpenStreetMap"
}).addTo(map)



// SK station API

const api =
"https://services3.arcgis.com/zcv98lgAl8xQ04cW/ArcGIS/rest/services/Hourly_Ambient_Air_Quality/FeatureServer/0/query?where=1=1&outFields=*&f=geojson"



fetch(api)
.then(r=>r.json())
.then(data=>{

L.geoJSON(data,{

pointToLayer:(feature,latlng)=>{

const p = feature.properties

const aqhi = calcAQHI(p.PM2_5,p.NO2,p.O3)

return L.circleMarker(latlng,{
radius:9,
color:"#222",
weight:1,
fillColor:aqhiColor(aqhi),
fillOpacity:0.9
})

},

onEachFeature:(feature,layer)=>{

const p = feature.properties

const aqhi = calcAQHI(p.PM2_5,p.NO2,p.O3)

const time = new Date(p.DATETIME).toLocaleString()

layer.bindPopup(
`<b>${p.COMMUNITY}</b><br>
AQHI: ${aqhi}<br>
PM2.5: ${p.PM2_5}<br>
NO₂: ${p.NO2}<br>
O₃: ${p.O3}<br>
Wind: ${p.WS} km/h<br>
Temp: ${p.TEMP} °C<br>
${time}`
)

}

}).addTo(map)

})



// FireSmoke forecast plume

const firesmoke = L.tileLayer.wms(
"https://firesmoke.ca/geoserver/wms",
{
layers:"firesmoke:pm25_surface",
format:"image/png",
transparent:true,
opacity:0.5,
attribution:"FireSmoke Canada"
}
)

firesmoke.addTo(map)



// AQHI calculation

function calcAQHI(pm25,no2,o3){

let aqhi =
(10/10.4) *
(
Math.exp(0.000537*no2) +
Math.exp(0.000871*o3) +
Math.exp(0.000487*pm25) - 3
)

return Math.round(aqhi)

}



// AQHI colors

function aqhiColor(v){

if(v<=3) return "#009966"
if(v<=6) return "#ffde33"
if(v<=10) return "#ff9933"

return "#cc0033"

}
