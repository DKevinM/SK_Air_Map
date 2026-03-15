import requests
import xarray as xr
import numpy as np
import json
from pathlib import Path
import urllib3

urllib3.disable_warnings()

DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)

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
STEP = 15

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

            if np.isnan(value):
                continue

            lat = lat_min + r * lat_step
            lon = lon_min + c * lon_step

            poly = [
                [lon, lat],
                [lon + lon_step*STEP, lat],
                [lon + lon_step*STEP, lat + lat_step*STEP],
                [lon, lat + lat_step*STEP],
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

    print("Saved:", outfile, "features:", len(features))
