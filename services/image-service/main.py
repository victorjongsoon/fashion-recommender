import os
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse

app = FastAPI(title="Image Service", version="0.1.0")

# In docker-compose we will mount dataset to /data
DATASET_IMAGES_DIR = Path(os.getenv("IMAGES_DIR", "/data/images")).resolve()

@app.get("/health")
def health():
    return {
        "status": "ok",
        "preventive_check": {
            "images_dir_exists": DATASET_IMAGES_DIR.exists(),
            "images_dir": str(DATASET_IMAGES_DIR),
        },
    }

@app.get("/images/{item_id}")
def get_image(item_id: str):
    # Fashion200k files look like: 51727804_0.jpg
    img_path = (DATASET_IMAGES_DIR / f"{item_id}.jpg").resolve()

    # prevent path traversal
    if DATASET_IMAGES_DIR not in img_path.parents:
        raise HTTPException(status_code=400, detail="Invalid item_id")

    if not img_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")

    return FileResponse(
        path=str(img_path),
        media_type="image/jpeg",
        filename=f"{item_id}.jpg",
    )
