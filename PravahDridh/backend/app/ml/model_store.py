import os
import joblib
from typing import Any, Optional


class ModelStore:
    _loaded_models = {}

    @classmethod
    def get_model(cls, artifact_path: str) -> Optional[Any]:
        if artifact_path in cls._loaded_models:
            return cls._loaded_models[artifact_path]

        if not os.path.exists(artifact_path):
            return None

        model = joblib.load(artifact_path)
        cls._loaded_models[artifact_path] = model
        return model
