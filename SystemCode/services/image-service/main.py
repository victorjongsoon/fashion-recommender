import os
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse

app = FastAPI(title="HNM Image Service", version="1.0.0")

# In docker-compose we mount:
# ./data/raw/hnm/images -> /data/images
IMAGES_DIR = Path(os.getenv("IMAGES_DIR", "/data/images")).resolve()


@app.get("/health")
def health():
    return {
        "status": "ok",
        "images_dir": str(IMAGES_DIR),
        "images_dir_exists": IMAGES_DIR.exists(),
    }


@app.get("/images/{article_id}")
def get_image(article_id: str):
    """
    H&M image path rule:
    folder = first 3 digits of article_id
    full path = /data/images/{folder}/{article_id}.jpg
    """

    # Validate numeric ID
    if not article_id.isdigit():
        raise HTTPException(status_code=400, detail="Invalid article_id")

    folder = article_id[:3]
    image_path = (IMAGES_DIR / folder / f"{article_id}.jpg").resolve()

    # Prevent path traversal
    if IMAGES_DIR not in image_path.parents:
        raise HTTPException(status_code=400, detail="Invalid path")

    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")

    return FileResponse(
        path=str(image_path),
        media_type="image/jpeg",
        filename=f"{article_id}.jpg",
    )