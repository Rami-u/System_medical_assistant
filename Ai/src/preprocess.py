# src/preprocess.py

import pandas as pd
from sklearn.preprocessing import StandardScaler, LabelEncoder

def load_data(path):
    return pd.read_csv(path)

def preprocess_data(df):
    df = df.copy()

    # Encoding
    le_gender = LabelEncoder()
    le_smoking = LabelEncoder()

    df['gender'] = le_gender.fit_transform(df['gender'])
    df['smoking_history'] = le_smoking.fit_transform(df['smoking_history'])

    # Split features/target
    X = df.drop('diabetes', axis=1)
    y = df['diabetes']

    # Scaling
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    return X_scaled, y, scaler
