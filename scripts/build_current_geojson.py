import requests
import json
import math
from pathlib import Path
from datetime import datetime, timedelta, timezone

API = "https://services3.arcgis.com/zcv98lgAl8xQ04cW/ArcGIS/rest/services/Hourly_Ambient_Air_Quality/FeatureServer/0/query"
OUTPUT = Path("data/sk_aqhi_current.geojson")

# determine 3-hour cutoff
cutoff = datetime.now(timezone.utc) - timedelta(hours=3)
cutoff_ms = cutoff.timestamp() * 1000


# pull station data
r = requests.get(API, params={
    "where": "1=1",
    "outFields": "COMMUNITY,PM2_5,NO2,O3,DATETIME",
    "f": "geojson",
    "resultRecordCount": 1000
})

data = r.json()

if "features" not in data:
    print("ArcGIS error:")
    print(data)
    raise SystemExit


def calc_aqhi(pm25, no2, o3):

    try:

        pm25 = float(pm25)
        no2 = float(no2)
        o3 = float(o3)

        if pm25 <= -999 or no2 <= -999 or o3 <= -999:
            return None

        aqhi = (10/10.4) * (
            math.exp(0.000537 * no2) +
            math.exp(0.000871 * o3) +
            math.exp(0.000487 * pm25) - 3
        )

        aqhi = round(aqhi)

        if aqhi < 1:
            aqhi = 1
        if aqhi > 10:
            aqhi = 10

        return aqhi

    except:
        return None


stations = {}

# collect station data within last 3 hours
for f in data["features"]:

    p = f["properties"]

    if p["DATETIME"] < cutoff_ms:
        continue

    station = p["COMMUNITY"]

    stations.setdefault(station, {
        "geometry": f["geometry"],
        "pm25": [],
        "no2": [],
        "o3": [],
        "times": []
    })

    stations[station]["pm25"].append(p.get("PM2_5"))
    stations[station]["no2"].append(p.get("NO2"))
    stations[station]["o3"].append(p.get("O3"))
    stations[station]["times"].append(p.get("DATETIME"))


features = []

for station, s in stations.items():

    pm25 = [v for v in s["pm25"] if v and v > -999]
    no2 = [v for v in s["no2"] if v and v > -999]
    o3 = [v for v in s["o3"] if v and v > -999]

    if not pm25 or not no2 or not o3:
        continue

    pm25_avg = sum(pm25) / len(pm25)
    no2_avg = sum(no2) / len(no2)
    o3_avg = sum(o3) / len(o3)

    aqhi = calc_aqhi(pm25_avg, no2_avg, o3_avg)

    latest_time = max(s["times"])
    latest_dt = datetime.fromtimestamp(latest_time/1000, timezone.utc).isoformat()

    features.append({
        "type": "Feature",
        "geometry": s["geometry"],
        "properties": {
            "station": station,
            "aqhi": aqhi,
            "pm25_3hr": round(pm25_avg,1),
            "no2_3hr": round(no2_avg,1),
            "o3_3hr": round(o3_avg,1),
            "updated": latest_dt
        }
    })


geojson = {
    "type": "FeatureCollection",
    "features": features
}

OUTPUT.write_text(json.dumps(geojson, indent=2))

print("Stations processed:", len(features))
