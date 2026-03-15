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

    df["datetime"] = pd.to_datetime(df["date"])

    df.replace(-9999, np.nan, inplace=True)

    dfs.append(df)


# combine stations
data = pd.concat(dfs)


# ----------------------------
# STEP 3 — station as category
# ----------------------------
data["station"] = data["station"].astype("category")


# ----------------------------
# sort data before lagging
# ----------------------------
data = data.sort_values(["station", "datetime"])


# ----------------------------
# STEP 4 — lag variables
# ----------------------------
for lag in [1,2,3]:
    data[f"PM25_lag{lag}"] = data.groupby("station")["PM25"].shift(lag)


# remove rows with missing lag data
data = data.dropna()


data.to_csv("training_dataset.csv", index=False)

print("Training dataset created")
