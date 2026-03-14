#!/usr/bin/env python3

import requests
import json
import math
from pathlib import Path

# API endpoint
API = "https://services3.arcgis.com/zcv98lgAl8xQ04cW/ArcGIS/rest/services/Hourly_Ambient_Air_Quality/FeatureServer/0/query"

PARAMS = {
    "where": "1=1",
    "outFields": "*",
    "f": "geojson"
}

OUTPUT = Path("../data/sk_current.geojson")


# AQHI calculation
def calc_aqhi(pm25, no2, o3):

    try:

        aqhi = (10 / 10.4) * (
            math.exp(0.000537 * no2) +
            math.exp(0.000871 * o3) +
            math.exp(0.000487 * pm25) - 3
        )

        return round(aqhi)

    except:
        return None


print("Pulling SK station data...")

r = requests.get(API, params=PARAMS)
data = r.json()

features = []

for f in data["features"]:

    geom = f["geometry"]
    p = f["properties"]

    pm25 = p.get("PM2_5")
    no2 = p.get("NO2")
    o3 = p.get("O3")

    aqhi = calc_aqhi(pm25, no2, o3)

    feature = {
        "type": "Feature",
        "geometry": geom,
        "properties": {

            "station": p.get("COMMUNITY"),
            "pm25": pm25,
            "no2": no2,
            "o3": o3,
            "temp": p.get("TEMP"),
            "wind": p.get("WS"),
            "datetime": p.get("DATETIME"),
            "aqhi": aqhi

        }
    }

    features.append(feature)


geojson = {
    "type": "FeatureCollection",
    "features": features
}

OUTPUT.write_text(json.dumps(geojson, indent=2))

print("GeoJSON written:", OUTPUT)
print("Stations:", len(features))

