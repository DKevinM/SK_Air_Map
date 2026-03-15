import requests
from datetime import datetime, timedelta
from pathlib import Path

# output directory
DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)

# forecast hours to download
hours = [0, 6, 12, 24]

# bounding box covering Canada
bbox = "-145,35,-85,75"

base_url = "https://services.firesmoke.ca/wms"

for h in hours:

    forecast_time = datetime.utcnow() + timedelta(hours=h)

    time_str = forecast_time.strftime("%Y-%m-%dT%H:00:00Z")

    params = {
        "service": "WMS",
        "request": "GetMap",
        "layers": "firesmoke:pm25",
        "styles": "",
        "format": "image/png",
        "transparent": "true",
        "version": "1.1.1",
        "width": 1200,
        "height": 800,
        "srs": "EPSG:4326",
        "bbox": bbox,
        "time": time_str
    }

    out_file = DATA_DIR / f"firesmoke_{h}h.png"

    print("Downloading", out_file)

    r = requests.get(base_url, params=params)

    if r.status_code == 200:
        with open(out_file, "wb") as f:
            f.write(r.content)
