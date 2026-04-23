import requests
import pandas as pd
import numpy as np
from datetime import datetime, timedelta, timezone
from pathlib import Path

API = "https://services3.arcgis.com/zcv98lgAl8xQ04cW/ArcGIS/rest/services/Hourly_Ambient_Air_Quality/FeatureServer/0/query"

now_utc = datetime.now(timezone.utc)
cutoff = now_utc - timedelta(hours=24)
cutoff_ms = int(cutoff.timestamp() * 1000)
cutoff_str = cutoff.strftime("%Y-%m-%d %H:%M:%S")

def safe_float(x):
    try:
        return float(x)
    except:
        return np.nan

r = requests.get(
    API,
    params={
        "where": f"DATETIME >= {cutoff_str}",
        "outFields": "COMMUNITY,PM2_5,NO2,O3,WS,WD,TEMP,RH,DATETIME",
        "orderByFields": "COMMUNITY ASC, DATETIME ASC",
        "f": "geojson",
        "resultRecordCount": 5000
    }
)

data = r.json()

stations = {}

for f in data["features"]:
    p = f["properties"]
    station = p["COMMUNITY"]
    lon, lat = f["geometry"]["coordinates"]

    stations.setdefault(station, {
        "rows": [],
        "lat": lat,
        "lon": lon
    })

    stations[station]["rows"].append({
        "datetime": datetime.fromtimestamp(p["DATETIME"]/1000, timezone.utc),
        "PM25": safe_float(p["PM2_5"]),
        "NO2": safe_float(p["NO2"]),
        "O3": safe_float(p["O3"]),
        "WS": safe_float(p["WS"]),
        "WD": safe_float(p["WD"]),
        "TEMP": safe_float(p["TEMP"]),
        "RH": safe_float(p["RH"]),
    })

latest_rows = []

for station, s in stations.items():

    df = pd.DataFrame(s["rows"])
    if len(df) < 4:
        continue

    df = df.sort_values("datetime")
    df = df.set_index("datetime").resample("1H").mean()
    df = df.interpolate(limit_direction="both", limit=6)

    for lag in [1,2,3]:
        df[f"PM25_lag{lag}"] = df["PM25"].shift(lag)
        df[f"NO2_lag{lag}"]  = df["NO2"].shift(lag)
        df[f"O3_lag{lag}"]   = df["O3"].shift(lag)

    df = df.dropna(subset=["PM25","NO2","O3"])

    if df.empty:
        continue

    latest = df.iloc[-1].copy()

    needed = [c for c in df.columns if "lag" in c]
    latest[needed] = latest[needed].fillna(method="ffill").fillna(method="bfill")

    if latest[needed].isna().sum() > 7:
        continue

    latest["station"] = station
    latest["lat"] = s["lat"]
    latest["lon"] = s["lon"]

    latest_rows.append(latest)

if latest_rows:
    out = pd.DataFrame(latest_rows)
    out.to_csv("data/latest_observations.csv", index=False)
    print("Forecast rows:", len(out))
else:
    print("No forecast-ready rows")
