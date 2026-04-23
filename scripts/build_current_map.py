import requests
import pandas as pd
from datetime import datetime, timedelta, timezone
from pathlib import Path

API = "https://services3.arcgis.com/zcv98lgAl8xQ04cW/ArcGIS/rest/services/Hourly_Ambient_Air_Quality/FeatureServer/0/query"
OUTPUT = Path("data/current_map.geojson")

now_utc = datetime.now(timezone.utc)
cutoff = now_utc - timedelta(hours=3)
cutoff_ms = int(cutoff.timestamp() * 1000)

r = requests.get(
    API,
    params={
        "where": f"DATETIME >= {cutoff_ms}",
        "outFields": "COMMUNITY,PM2_5,NO2,O3,DATETIME",
        "orderByFields": "COMMUNITY ASC, DATETIME DESC",
        "f": "geojson",
        "resultRecordCount": 5000
    }
)

data = r.json()

stations = {}

for f in data["features"]:
    p = f["properties"]
    station = p["COMMUNITY"]

    if station not in stations:
        stations[station] = f  # take first (latest due to DESC)

features = []

for station, f in stations.items():
    p = f["properties"]

    if not all([
        p.get("PM2_5") not in [None, -999],
        p.get("NO2") not in [None, -999],
        p.get("O3") not in [None, -999]
    ]):
        continue

    features.append({
        "type": "Feature",
        "geometry": f["geometry"],
        "properties": {
            "station": station,
            "PM25": p["PM2_5"],
            "NO2": p["NO2"],
            "O3": p["O3"],
            "updated": datetime.fromtimestamp(p["DATETIME"]/1000, timezone.utc).isoformat()
        }
    })

geojson = {
    "type": "FeatureCollection",
    "features": features
}

OUTPUT.parent.mkdir(parents=True, exist_ok=True)

with open(OUTPUT, "w") as f:
    import json
    json.dump(geojson, f)

print("Map features:", len(features))
