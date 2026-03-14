import pandas as pd
import json
from pathlib import Path

# load historical dataset
df = pd.read_csv("../data/sk_history.csv")

# convert datetime
df["datetime"] = pd.to_datetime(df["DATETIME"], unit="ms")

# latest record per station
latest = df.sort_values("datetime").groupby("STATIONID").tail(1)

features = []

for _, r in latest.iterrows():

    features.append({
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [r["lon"], r["lat"]]
        },
        "properties": {
            "station": r["COMMUNITY"],
            "pm25": r["PM2_5"],
            "no2": r["NO2"],
            "o3": r["O3"],
            "temp": r["TEMP"],
            "wind": r["WS"],
            "datetime": str(r["datetime"])
        }
    })

geojson = {
    "type": "FeatureCollection",
    "features": features
}

Path("../data/sk_current.geojson").write_text(
    json.dumps(geojson, indent=2)
)

print("GeoJSON updated")
