# src/predict.py

import joblib
import numpy as np

# Load model
data = joblib.load("../models/diabetes_model.pkl")

model = data["model"]
scaler = data["scaler"]

def predict(patient_data):
    patient_data = np.array(patient_data).reshape(1, -1)
    
    # Scaling
    patient_scaled = scaler.transform(patient_data)
    
    # Probability
    prob = model.predict_proba(patient_scaled)[0][1]
    
    # Threshold decision
    if prob > 0.3:
        return "High Risk", prob
    else:
        return "Low Risk", prob

# Test example
if __name__ == "__main__":
    sample = [1, 45, 1, 0, 25.3, 5.8, 140]
    result = predict(sample)
    print(result)
