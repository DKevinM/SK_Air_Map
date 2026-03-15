import pandas as pd
import numpy as np
import glob
from pathlib import Path

DATA_DIR = Path("dataSK")

files = glob.glob(str(DATA_DIR / "*.csv"))

dfs = []

for f in files:
    df = pd.read_csv(f)

    station = Path(f).stem
    df["station"] = station

    # convert datetime
    df["datetime"] = pd.to_datetime(df["date"])

    # replace missing codes
    df.replace(-9999, np.nan, inplace=True)

    # wind conversion
    rad = np.deg2rad(df["WD"])
    df["U"] = -df["WS"] * np.sin(rad)
    df["V"] = -df["WS"] * np.cos(rad)

    dfs.append(df)

data = pd.concat(dfs)

data = data.sort_values(["station", "datetime"])

# create lag features
for lag in [1,2,3]:
    data[f"PM25_lag{lag}"] = data.groupby("station")["PM25"].shift(lag)

# remove rows with missing lags
data = data.dropna()

data.to_csv("training_dataset.csv", index=False)

print("Training dataset created")
