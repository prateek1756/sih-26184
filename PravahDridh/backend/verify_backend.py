import sys
import os

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

modules_to_test = [
    "app.core.config",
    "app.core.security",
    "app.db.base_class",
    "app.models",
    "app.schemas",
    "app.core.deps",
    "app.services.audit_service",
    "app.services.risk_engine",
    "app.services.geospatial_service",
    "app.ml.feature_builder",
    "app.ml.trainer",
    "app.ml.model_store",
    "app.services.ml_inference_service",
    "app.api.v1.api",
    "app.main",
]

errors = []
for mod in modules_to_test:
    try:
        __import__(mod)
        print(f"[OK] {mod}")
    except Exception as e:
        print(f"[FAIL] {mod}: {e}")
        errors.append((mod, str(e)))

if errors:
    print(f"\nFAILED MODULES ({len(errors)}):")
    for mod, err in errors:
        print(f" - {mod}: {err}")
    sys.exit(1)
else:
    print("\nALL MODULES IMPORTED AND COMPILED CLEANLY!")
    sys.exit(0)
