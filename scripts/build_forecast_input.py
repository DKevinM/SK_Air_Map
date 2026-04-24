import requests
import pandas as pd
import numpy as np
from datetime import datetime, timedelta, timezone
from pathlib import Path

API = "https://services3.arcgis.com/zcv98lgAl8xQ04cW/ArcGIS/rest/services/Hourly_Ambient_Air_Quality/FeatureServer/0/query"

now_utc = datetime.now(timezone.utc)
cutoff = now_utc - timedelta(hours=24)

start_ms = int(cutoff.timestamp() * 1000)
end_ms = int(now_utc.timestamp() * 1000)

def safe_float(x):
    try:
        x = float(x)
        if x <= -999:
            return np.nan
        return x
    except:
        return np.nan

# ---- API CALL ----
r = requests.get(
    API,
    params={
        "time": f"{start_ms},{end_ms}",
        "outFields": "COMMUNITY,PM2_5,NO2,O3,WS,WD,TEMP,RH,DATETIME",
        "orderByFields": "COMMUNITY ASC, DATETIME ASC",
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

# ---- BUILD STATION STRUCTURE ----
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

# ---- BUILD FORECAST INPUT ----
latest_rows = []

for station, s in stations.items():

    df = pd.DataFrame(s["rows"])

    if len(df) < 2:
        continue

    df = df.sort_values("datetime").reset_index(drop=True)

    # ---- MINIMAL LAG ONLY ----
    df["PM25_lag1"] = df["PM25"].shift(1)
    df["NO2_lag1"]  = df["NO2"].shift(1)
    df["O3_lag1"]   = df["O3"].shift(1)

    # ---- KEEP VALID CORE DATA ----
    df = df.dropna(subset=["PM25","NO2","O3"])

    if df.empty:
        continue

    latest = df.iloc[-1].copy()

    # ---- FILL LAG GAPS ----
    lag_cols = ["PM25_lag1","NO2_lag1","O3_lag1"]
    latest[lag_cols] = latest[lag_cols].fillna(method="ffill").fillna(method="bfill")

    latest["station"] = station
    latest["lat"] = s["lat"]
    latest["lon"] = s["lon"]

    latest_rows.append(latest)

# ---- OUTPUT ----
OUTPUT = Path("data/latest_observations.csv")
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

if latest_rows:
    out = pd.DataFrame(latest_rows)
    out.to_csv(OUTPUT, index=False)
    print("Forecast rows:", len(out))

else:
    print("Fallback: using latest raw values")

    fallback = []

    for station, s in stations.items():
        if not s["rows"]:
            continue

        last = s["rows"][-1]

        fallback.append({
            "station": station,
            "PM25": last["PM25"],
            "NO2": last["NO2"],
            "O3": last["O3"],
            "WS": last["WS"],
            "WD": last["WD"],
            "TEMP": last["TEMP"],
            "RH": last["RH"],
            "lat": s["lat"],
            "lon": s["lon"]
        })

    pd.DataFrame(fallback).to_csv(OUTPUT, index=False)
