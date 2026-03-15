import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
import joblib

df = pd.read_csv("training_dataset.csv")

features = [
    "PM25_lag1","PM25_lag2","PM25_lag3",
    "NO2","O3",
    "TEMP","RH",
    "U","V"
]

X = df[features]
y = df["PM25"]

X_train, X_test, y_train, y_test = train_test_split(
    X,y,test_size=0.2,random_state=42
)

model = RandomForestRegressor(
    n_estimators=500,
    max_depth=20,
    n_jobs=-1
)

model.fit(X_train,y_train)

score = model.score(X_test,y_test)

print("Model R²:",score)

joblib.dump(model,"rf_pm25_model.pkl")
