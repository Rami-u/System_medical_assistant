# src/train.py

from xgboost import XGBClassifier
from sklearn.model_selection import train_test_split, RandomizedSearchCV
import joblib

from preprocess import load_data, preprocess_data

# Load data
df = load_data("../data/diabetes_prediction_dataset.csv")

# Preprocessing
X, y, scaler = preprocess_data(df)

# Split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Model
model = XGBClassifier()

# Tuning
params = {
    'n_estimators': [100, 200],
    'max_depth': [3,5],
    'learning_rate': [0.01, 0.1],
}

search = RandomizedSearchCV(model, params, scoring='recall', cv=3)
search.fit(X_train, y_train)

best_model = search.best_estimator_

# Save model
joblib.dump({
    "model": best_model,
    "scaler": scaler
}, "../models/diabetes_model.pkl")

print("Model saved successfully")
