import requests
import pandas as pd
import numpy as np
from datetime import datetime, timedelta, timezone
from pathlib import Path
import math

API = "https://services3.arcgis.com/zcv98lgAl8xQ04cW/ArcGIS/rest/services/Hourly_Ambient_Air_Quality/FeatureServer/0/query"
OUTPUT = Path("data/forecast_input.csv")

now_utc = datetime.now(timezone.utc)
cutoff = now_utc - timedelta(hours=24)

start_ms = int(cutoff.timestamp() * 1000)
end_ms = int(now_utc.timestamp() * 1000)

# ----------------------------
# Safe cleaner
# ----------------------------
def safe_float(x):
    try:
        x = float(x)
        if x <= -999:
            return np.nan
        return round(x, 2)
    except:
        return np.nan

# ----------------------------
# AQHI calculation
# ----------------------------
def calc_aqhi(pm25, no2, o3):
    try:
        if pd.isna(pm25) or pd.isna(no2) or pd.isna(o3):
            return np.nan

        aqhi = (10/10.4) * (100*(
            math.exp(0.000871 * no2) +
            math.exp(0.000537 * o3) +
            math.exp(0.000487 * pm25) - 3
        ))

        return max(1, min(10, round(aqhi)))
    except:
        return np.nan

# ----------------------------
# API CALL
# ----------------------------
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

# ----------------------------
# ORGANIZE STATIONS
# ----------------------------
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

# ----------------------------
# BUILD FORECAST INPUT
# ----------------------------
rows_out = []

for station, s in stations.items():

    df = pd.DataFrame(s["rows"])
    df = df.sort_values("datetime").reset_index(drop=True)

    if df.empty:
        continue

    # Keep only rows with core pollutants
    df_valid = df.dropna(subset=["PM25","NO2","O3"])

    if len(df_valid) < 3:
        # fallback: use whatever is available
        last = df.iloc[-1]

        aqhi = calc_aqhi(last["PM25"], last["NO2"], last["O3"])

        row = {
            "station": station,
            "datetime": last["datetime"],
            "AQHI_0": aqhi,
            "AQHI_1": aqhi,
            "AQHI_2": aqhi,
            "AQHI_trend": 0,
            "PM25_0": last["PM25"],
            "PM25_1": last["PM25"],
            "PM25_2": last["PM25"],
            "NO2_0": last["NO2"],
            "NO2_1": last["NO2"],
            "NO2_2": last["NO2"],
            "O3_0": last["O3"],
            "O3_1": last["O3"],
            "O3_2": last["O3"],
            "WS": last["WS"],
            "WD": last["WD"],
            "TEMP": last["TEMP"],
            "RH": last["RH"],
            "lat": s["lat"],
            "lon": s["lon"]
        }

        rows_out.append(row)
        continue

    last3 = df_valid.tail(3).reset_index(drop=True)

    aqhi_vals = [
        calc_aqhi(last3.loc[i,"PM25"], last3.loc[i,"NO2"], last3.loc[i,"O3"])
        for i in range(3)
    ]

    row = {
        "station": station,
        "datetime": last3.loc[2,"datetime"],

        "AQHI_0": aqhi_vals[2],
        "AQHI_1": aqhi_vals[1],
        "AQHI_2": aqhi_vals[0],
        "AQHI_trend": aqhi_vals[2] - aqhi_vals[1],

        "PM25_0": last3.loc[2,"PM25"],
        "PM25_1": last3.loc[1,"PM25"],
        "PM25_2": last3.loc[0,"PM25"],

        "NO2_0": last3.loc[2,"NO2"],
        "NO2_1": last3.loc[1,"NO2"],
        "NO2_2": last3.loc[0,"NO2"],

        "O3_0": last3.loc[2,"O3"],
        "O3_1": last3.loc[1,"O3"],
        "O3_2": last3.loc[0,"O3"],

        "WS": last3.loc[2,"WS"],
        "WD": last3.loc[2,"WD"],
        "TEMP": last3.loc[2,"TEMP"],
        "RH": last3.loc[2,"RH"],

        "lat": s["lat"],
        "lon": s["lon"]
    }

    rows_out.append(row)

# ----------------------------
# OUTPUT
# ----------------------------
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

if rows_out:
    pd.DataFrame(rows_out).to_csv(OUTPUT, index=False)
    print("Forecast input rows:", len(rows_out))
else:
    print("No valid forecast input rows")
