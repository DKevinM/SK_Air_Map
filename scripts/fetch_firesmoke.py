import requests
import xarray as xr
import numpy as np
from pathlib import Path
from PIL import Image
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

print("Opening NetCDF...")

ds = xr.open_dataset(nc_file)

# Inspect variables once if needed
print(ds)

pm = ds["PM25"]

forecast_hours = {
    "0h":0,
    "6h":6,
    "12h":12,
    "24h":24
}

for name,t in forecast_hours.items():

    print("Extracting", name)

    grid = pm.isel(time=t).values

    grid = np.nan_to_num(grid)

    grid = (grid - grid.min()) / (grid.max() - grid.min())
    grid = (grid * 255).astype(np.uint8)

    img = Image.fromarray(grid)

    outfile = DATA_DIR / f"firesmoke_{name}.png"

    img.save(outfile)

    print("Saved:", outfile)
