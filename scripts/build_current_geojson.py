import requests
import json
import math
from pathlib import Path
from datetime import datetime, timedelta, timezone

API = "https://services3.arcgis.com/zcv98lgAl8xQ04cW/ArcGIS/rest/services/Hourly_Ambient_Air_Quality/FeatureServer/0/query"
OUTPUT = Path("data/sk_aqhi_current.geojson")


# determine 3-hour cutoff
now_utc = datetime.now(timezone.utc)

aqhi_cutoff = now_utc - timedelta(hours=3)
aqhi_cutoff_ms = aqhi_cutoff.timestamp() * 1000

history_cutoff = now_utc - timedelta(hours=13)
history_cutoff_ms = history_cutoff.timestamp() * 1000


print("WHERE CLAUSE:", "DATETIME >= DATE '{}'".format(
    datetime.utcfromtimestamp(history_cutoff_ms / 1000).strftime("%Y-%m-%d %H:%M:%S")
))
# pull station data
r = requests.get(
    API,
    params={
        "where": "DATETIME >= DATE '{}'".format(
            datetime.utcfromtimestamp(history_cutoff_ms / 1000).strftime("%Y-%m-%d %H:%M:%S")
        ),
        "outFields": "COMMUNITY,PM2_5,NO2,O3,WS,WD,TEMP,RH,DATETIME",
        "orderByFields": "COMMUNITY ASC, DATETIME ASC",
        "f": "geojson",
        "resultRecordCount": 5000
    }
)

data = r.json()

if "features" not in data:
    print("ArcGIS error:")
    print(data)
    raise SystemExit


def calc_aqhi(PM25, NO2, O3):

    try:

        PM25 = float(PM25)
        NO2 = float(NO2)
        O3 = float(O3)

        if PM25 <= -999 or NO2 <= -999 or O3 <= -999:
            return None

        aqhi = (10/10.4) * (100*(
            math.exp(0.000871 * NO2) +
            math.exp(0.000537 * O3) +
            math.exp(0.000487 * PM25) - 3
        ))

        aqhi = round(aqhi)

        if aqhi < 1:
            aqhi = 1
        if aqhi > 10:
            aqhi = 10

        return aqhi

    except:
        return None


stations = {}

# collect station data within last 13 hours
for f in data["features"]:

    p = f["properties"]

    if p["DATETIME"] < history_cutoff_ms:
        continue

    station = p["COMMUNITY"]

    
    lon, lat = f["geometry"]["coordinates"]
    
    stations.setdefault(station, {
        "geometry": f["geometry"],
        "lon": lon,
        "lat": lat,
        "PM25": [],
        "NO2": [],
        "O3": [],
        "WS": [],
        "WD": [],
        "TEMP": [],
        "RH": [],
        "times": []
    })

    stations[station]["PM25"].append(p.get("PM2_5"))
    stations[station]["NO2"].append(p.get("NO2"))
    stations[station]["O3"].append(p.get("O3"))
    stations[station]["WS"].append(p.get("WS"))    
    stations[station]["WD"].append(p.get("WD"))
    stations[station]["TEMP"].append(p.get("TEMP"))
    stations[station]["RH"].append(p.get("RH"))
    stations[station]["times"].append(p.get("DATETIME"))


features = []

for station, s in stations.items():

    recent_idx = [i for i, t in enumerate(s["times"]) if t is not None and t >= aqhi_cutoff_ms]
    
    PM25 = [s["PM25"][i] for i in recent_idx if s["PM25"][i] is not None and s["PM25"][i] > -999]
    NO2  = [s["NO2"][i]  for i in recent_idx if s["NO2"][i]  is not None and s["NO2"][i]  > -999]
    O3   = [s["O3"][i]   for i in recent_idx if s["O3"][i]   is not None and s["O3"][i]   > -999]
    
    if not PM25 or not NO2 or not O3:
        continue

    PM25_avg = sum(PM25) / len(PM25)
    NO2_avg = sum(NO2) / len(NO2)
    O3_avg = sum(O3) / len(O3)

    aqhi = calc_aqhi(PM25_avg, NO2_avg, O3_avg)
    
    latest_idx = None
    
    for i in sorted(range(len(s["times"])), key=lambda x: s["times"][x], reverse=True):
        if (
            s["PM25"][i] is not None and s["PM25"][i] > -999 and
            s["NO2"][i] is not None and s["NO2"][i] > -999 and
            s["O3"][i] is not None and s["O3"][i] > -999 and
            s["WS"][i] is not None and s["WS"][i] > -999 and
            s["WD"][i] is not None and s["WD"][i] > -999 and
            s["TEMP"][i] is not None and s["TEMP"][i] > -999 and
            s["RH"][i] is not None and s["RH"][i] > -999
        ):
            latest_idx = i
            break
    
    if latest_idx is None:
        continue
    
    latest_time = s["times"][latest_idx]
    latest_dt = datetime.fromtimestamp(latest_time/1000, timezone.utc).isoformat()
      
    latest_PM25 = s["PM25"][latest_idx]
    latest_NO2 = s["NO2"][latest_idx]
    latest_O3 = s["O3"][latest_idx]
    
    latest_WS = s["WS"][latest_idx]
    latest_WD = s["WD"][latest_idx]
    latest_TEMP = s["TEMP"][latest_idx]
    latest_RH = s["RH"][latest_idx]    

    
    features.append({
        "type": "Feature",
        "geometry": s["geometry"],
        "properties": {
            "station": station,
            # latest hour (used by forecast model)
            "PM25": round(latest_PM25,1) if latest_PM25 is not None else None,
            "NO2": round(latest_NO2,1) if latest_NO2 is not None else None,
            "O3": round(latest_O3,1) if latest_O3 is not None else None,
            "WS": round(latest_WS,1) if latest_WS is not None else None,
            "WD": round(latest_WD,1) if latest_WD is not None else None,
            "TEMP": round(latest_TEMP,1) if latest_TEMP is not None else None,
            "RH": round(latest_RH,1) if latest_RH is not None else None,
            # 3-hour averages (used for AQHI)
            "PM25_3hr": round(PM25_avg,1),
            "NO2_3hr": round(NO2_avg,1),
            "O3_3hr": round(O3_avg,1),
        
            "AQHI": aqhi,
            "updated": latest_dt
        }
    })


geojson = {
    "type": "FeatureCollection",
    "features": features
}

OUTPUT.parent.mkdir(parents=True, exist_ok=True)

print("Stations processed:", len(features))


import pandas as pd
import numpy as np

latest_rows = []

for station, s in stations.items():
    rows = []

    for i in range(len(s["times"])):
        t = s["times"][i]
        pm25 = s["PM25"][i]
        no2  = s["NO2"][i]
        o3   = s["O3"][i]
        ws   = s["WS"][i]
        wd   = s["WD"][i]
        temp = s["TEMP"][i]
        rh   = s["RH"][i]

        if t is None:
            continue
        if pm25 is None or pm25 <= -999:
            continue
        if no2 is None or no2 <= -999:
            continue
        if o3 is None or o3 <= -999:
            continue
        if ws is None or ws <= -999:
            continue
        if wd is None or wd <= -999:
            continue
        if temp is None or temp <= -999:
            continue
        if rh is None or rh <= -999:
            continue

        rows.append({
            "station": station,
            "datetime": datetime.fromtimestamp(t / 1000, timezone.utc).isoformat(),
            "PM25": float(pm25),
            "NO2": float(no2),
            "O3": float(o3),
            "WS": float(ws),
            "WD": float(wd),
            "TEMP": float(temp),
            "RH": float(rh),
            "lat": float(s["lat"]),
            "lon": float(s["lon"])
        })

    if len(rows) < 13:
        continue
    
    df_station = pd.DataFrame(rows)
    df_station["datetime"] = pd.to_datetime(df_station["datetime"], errors="coerce")
    df_station = df_station.sort_values("datetime").reset_index(drop=True) 

    for lag in [1, 2, 3, 6, 12]:
        df_station[f"PM25_lag{lag}"] = df_station["PM25"].shift(lag)
        df_station[f"O3_lag{lag}"]   = df_station["O3"].shift(lag)
        df_station[f"NO2_lag{lag}"]  = df_station["NO2"].shift(lag)

    latest = df_station.iloc[-1].copy()

    needed = [
        "PM25_lag1","PM25_lag2","PM25_lag3","PM25_lag6","PM25_lag12",
        "O3_lag1","O3_lag2","O3_lag3","O3_lag6","O3_lag12",
        "NO2_lag1","NO2_lag2","NO2_lag3","NO2_lag6","NO2_lag12"
    ]

    if latest[needed].isna().any():
        continue

    latest_rows.append(latest)


if latest_rows:
    latest_df = pd.DataFrame(latest_rows).copy()

    lat_min, lat_max = latest_df["lat"].min(), latest_df["lat"].max()
    lon_min, lon_max = latest_df["lon"].min(), latest_df["lon"].max()

    latest_df["lat_norm"] = (latest_df["lat"] - lat_min) / (lat_max - lat_min) if lat_max != lat_min else 0.5
    latest_df["lon_norm"] = (latest_df["lon"] - lon_min) / (lon_max - lon_min) if lon_max != lon_min else 0.5

    regina_lat = 50.4452
    regina_lon = -104.6189

    def haversine_km(lon1, lat1, lon2, lat2):
        r = 6371.0
        lon1, lat1, lon2, lat2 = map(np.radians, [lon1, lat1, lon2, lat2])
        dlon = lon2 - lon1
        dlat = lat2 - lat1
        a = np.sin(dlat / 2)**2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon / 2)**2
        return 2 * r * np.arcsin(np.sqrt(a))

    latest_df["dist_center"] = haversine_km(
        latest_df["lon"].values,
        latest_df["lat"].values,
        regina_lon,
        regina_lat
    )

    latest_df.to_csv("data/latest_observations.csv", index=False)
    print("Saved forecast-ready table: data/latest_observations.csv")
else:
    print("No forecast-ready rows available for latest_observations.csv")
