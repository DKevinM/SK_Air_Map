import requests
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
import math

API = "https://services3.arcgis.com/zcv98lgAl8xQ04cW/ArcGIS/rest/services/Hourly_Ambient_Air_Quality/FeatureServer/0/query"
OUTPUT = Path("data/current_map.geojson")

# ---- TIME WINDOW (last 3 hours) ----
now_utc = datetime.now(timezone.utc)
cutoff = now_utc - timedelta(hours=3)

start_ms = int(cutoff.timestamp() * 1000)
end_ms = int(now_utc.timestamp() * 1000)

# ---- API REQUEST ----
r = requests.get(
    API,
    params={
        "time": f"{start_ms},{end_ms}",
        "outFields": "COMMUNITY,PM2_5,NO2,O3,WS,WD,TEMP,RH,DATETIME",
        "orderByFields": "COMMUNITY ASC, DATETIME DESC",
        "f": "geojson",
        "resultRecordCount": 5000
    }
)

print("Status:", r.status_code)

data = r.json()

if "features" not in data:
    print("API RESPONSE ERROR:")
    print(data)
    raise SystemExit("No features returned")

# ---- CLEANER ----
def clean_val(x):
    try:
        x = float(x)
        if x <= -999:
            return None
        return round(x, 1)
    except:
        return None

# ---- AQHI FUNCTION ----
def calc_aqhi(pm25, no2, o3):
    try:
        if None in [pm25, no2, o3]:
            return None

        aqhi = (10/10.4) * (100*(
            math.exp(0.000871 * no2) +
            math.exp(0.000537 * o3) +
            math.exp(0.000487 * pm25) - 3
        ))

        aqhi = round(aqhi)
        return max(1, min(10, aqhi))
    except:
        return None

# ---- KEEP LATEST PER STATION ----
stations = {}

for f in data["features"]:
    p = f["properties"]
    station = p["COMMUNITY"]

    if station not in stations:
        stations[station] = f  # first = latest due to DESC

# ---- BUILD FEATURES ----
features = []

for station, f in stations.items():
    p = f["properties"]

    pm25 = clean_val(p.get("PM2_5"))
    no2  = clean_val(p.get("NO2"))
    o3   = clean_val(p.get("O3"))

    feature = {
        "type": "Feature",
        "geometry": f["geometry"],
        "properties": {
            "station": station,

            # Air
            "PM25": pm25,
            "NO2": no2,
            "O3": o3,

            # Weather
            "WS": clean_val(p.get("WS")),
            "WD": int(clean_val(p.get("WD"))) if clean_val(p.get("WD")) is not None else None,
            "TEMP": clean_val(p.get("TEMP")),
            "RH": clean_val(p.get("RH")),

            # AQHI
            "AQHI": calc_aqhi(pm25, no2, o3),

            # Timestamp
            "updated": datetime.fromtimestamp(
                p["DATETIME"]/1000, timezone.utc
            ).isoformat()
        }
    }

    features.append(feature)

# ---- OUTPUT ----
geojson = {
    "type": "FeatureCollection",
    "features": features
}

OUTPUT.parent.mkdir(parents=True, exist_ok=True)

with open(OUTPUT, "w") as f:
    json.dump(geojson, f)

print("Map features:", len(features))
