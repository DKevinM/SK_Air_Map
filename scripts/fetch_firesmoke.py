import requests
import xarray as xr
import numpy as np
import json
from pathlib import Path
import urllib3

urllib3.disable_warnings()

DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)

# region of interest (Prairies / Saskatchewan focus)
LAT_MIN = 48
LAT_MAX = 60
LON_MIN = -115
LON_MAX = -100

url = "https://services.firesmoke.ca/forecasts/current/dispersion.nc"
nc_file = DATA_DIR / "firesmoke.nc"

print("Downloading FireSmoke forecast...")

r = requests.get(url, verify=False, timeout=120)

with open(nc_file, "wb") as f:
    f.write(r.content)

print("Saved:", nc_file)

ds = xr.open_dataset(nc_file)

print(ds)

pm = ds["PM25"]

# Downsample step
STEP = 2

forecast_hours = {
    "now":0,
    "6h":6,
    "12h":12,
    "24h":24
}

# grid size
rows = pm.shape[2]
cols = pm.shape[3]

# approximate geographic bounds of the grid
lon_min, lon_max = -145, -85
lat_min, lat_max = 35, 75

lon_step = (lon_max - lon_min) / cols
lat_step = (lat_max - lat_min) / rows

for name,t in forecast_hours.items():

    print("Processing:", name)

    grid = pm.isel(TSTEP=t, LAY=0).values
    grid = np.flipud(grid)

    features = []

    for r in range(0, rows, STEP):
        for c in range(0, cols, STEP):

            value = float(grid[r,c])
            # skip negligible smoke
            if value < 0.5:
                continue            

            if np.isnan(value):
                continue
                
            # smooth smoke classes
            if value < 5: value = 2
            elif value < 10: value = 7
            elif value < 25: value = 17
            elif value < 50: value = 37
            else: value = 75
          



            lat = lat_min + r * lat_step
            lon = lon_min + c * lon_step
            
            # skip outside region
            if lat < LAT_MIN or lat > LAT_MAX:
                continue
            
            if lon < LON_MIN or lon > LON_MAX:
                continue

            
            poly = [
                [lon, lat],
                [lon + lon_step*STEP*1.02, lat],
                [lon + lon_step*STEP*1.02, lat + lat_step*STEP*1.02],
                [lon, lat + lat_step*STEP*1.02],
                [lon, lat]
            ]

            features.append({
                "type":"Feature",
                "properties":{
                    "pm25":float(value),
                    "forecast":name
                },
                "geometry":{
                    "type":"Polygon",
                    "coordinates":[poly]
                }
            })

    geojson = {
        "type":"FeatureCollection",
        "features":features
    }

    outfile = DATA_DIR / f"firesmoke_{name}.geojson"

    with open(outfile,"w") as f:
        json.dump(geojson,f)

    
    from datetime import datetime, timedelta
    date = int(tflag[0, 0, 0])
    time = int(tflag[0, 0, 1])
    year = date // 1000
    day = date % 1000
    hour = time // 10000
    minute = (time % 10000) // 100
    second = time % 100
    smoke_time = datetime(year, 1, 1) + timedelta(days=day-1)
    smoke_time = smoke_time.replace(hour=hour, minute=minute, second=second)

    
    print("Saved:", outfile, "features:", len(features))
    print("FireSmoke timestamp:", smoke_time)
