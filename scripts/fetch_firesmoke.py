import requests
from pathlib import Path

URL = "https://firesmoke.ca/forecast/latest.png"

out = Path("data/firesmoke_latest.png")

print("Downloading FireSmoke forecast...")

r = requests.get(URL, timeout=60)

if r.status_code == 200:
    out.write_bytes(r.content)
    print("Saved:", out)
else:
    print("Download failed:", r.status_code)
