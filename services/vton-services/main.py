import tempfile
import uuid
import os
from pathlib import Path
import requests
from urllib.parse import urlparse

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from gradio_client import Client, file as gr_file

app = FastAPI(title="VTON Service (IDM-VTON)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ NO hf_token argument
client = Client("yisol/IDM-VTON")

OUTPUT_DIR = Path("/tmp/vton_outputs")
OUTPUT_DIR.mkdir(exist_ok=True)

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/results/{filename}")
def get_result(filename: str):
    path = OUTPUT_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(path, media_type="image/png")

@app.post("/tryon")
async def try_on(
    photo: UploadFile = File(...),
    cloth_image: UploadFile | None = File(None),
    garment_url: str | None = Form(None),
    garment_des: str = Form("casual clothing"),
):
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as p:
            p.write(await photo.read())
            person_path = p.name

        # Prefer uploaded cloth_image; if not provided, try to download via garment_url
        garment_path = None
        if cloth_image is not None:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as g:
                g.write(await cloth_image.read())
                garment_path = g.name
        elif garment_url:
            # If the frontend passed a localhost URL while running frontends on the host,
            # the container should reach the image-service by the compose service name.
            # Replace localhost/127.0.0.1 with image-service:8000 so container can access it.
            parsed = urlparse(garment_url)
            if parsed.hostname in ("localhost", "127.0.0.1"):
                # Construct path-only URL to use service hostname
                new_url = f"http://image-service:8000{parsed.path}"
            else:
                new_url = garment_url

            resp = requests.get(new_url, timeout=30)
            if resp.status_code != 200:
                raise HTTPException(status_code=502, detail=f"Failed to download garment: {resp.status_code}")
            with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as g:
                g.write(resp.content)
                garment_path = g.name

        if garment_path is None:
            raise HTTPException(status_code=400, detail="No garment image provided")

        result = client.predict(
            {
                "background": gr_file(person_path),
                "layers": [],
                "composite": None,
            },
            garm_img=gr_file(garment_path),
            garment_des=garment_des,
            is_checked=True,
            is_checked_crop=False,
            denoise_steps=30,
            seed=42,
            api_name="/tryon",
        )

        src_path = Path(result[0])
        out_name = f"{uuid.uuid4()}.png"
        dst_path = OUTPUT_DIR / out_name
        dst_path.write_bytes(src_path.read_bytes())

        return {
            "image_url": f"http://localhost:8002/results/{out_name}"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))