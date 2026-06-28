import os
import uuid
import aiofiles
from pathlib import Path

async def save_upload(data: bytes, filename: str, storage_dir: str) -> tuple[str, str]:
    Path(storage_dir).mkdir(parents=True, exist_ok=True)
    ext = os.path.splitext(filename)[1] or ".bin"
    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(storage_dir, unique_name)
    async with aiofiles.open(file_path, "wb") as f:
        await f.write(data)
    return file_path, unique_name

async def extract_text(file_path: str, mime_type: str) -> str | None:
    import fitz
    try:
        if "pdf" in mime_type:
            doc = fitz.open(file_path)
            text = "\n".join(page.get_text() for page in doc)
            doc.close()
            if text.strip():
                return text
    except Exception:
        pass
    try:
        from PIL import Image
        import pytesseract
        img = Image.open(file_path)
        text = pytesseract.image_to_string(img, lang="por")
        if text.strip():
            return text
    except Exception:
        pass
    return None
