from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import os
import sqlite3
from datetime import datetime
import shutil

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Banco de Dados e Pastas de Treino
DB_PATH = "stackcount.db"
TRAINING_DIR = "dataset_inteligente"
os.makedirs(TRAINING_DIR, exist_ok=True)

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_name TEXT,
            ia_count INTEGER,
            real_count INTEGER,
            date TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

init_db()

@app.post("/train")
async def train_ia(
    image: UploadFile = File(...),
    item_name: str = Form(...),
    ia_count: int = Form(...),
    real_count: int = Form(...)
):
    # 1. Registro para Inventário
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("INSERT INTO inventory (item_name, ia_count, real_count, date) VALUES (?, ?, ?, ?)",
                   (item_name, ia_count, real_count, datetime.now()))
    conn.commit()
    conn.close()

    # 2. Organização para Few-Shot Learning (Ouro para a IA)
    # Criamos pastas baseadas na quantidade real para a IA comparar padrões
    category_dir = os.path.join(TRAINING_DIR, item_name.replace(" ", "_").lower(), str(real_count))
    os.makedirs(category_dir, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"ref_{real_count}_ia_{ia_count}_{timestamp}.jpg"
    
    with open(os.path.join(category_dir, filename), "wb") as buffer:
        shutil.copyfileobj(image.file, buffer)

    return {"status": "success", "data_stored": True}

@app.get("/report")
async def get_report():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT item_name, SUM(real_count), COUNT(*) FROM inventory GROUP BY item_name")
    data = cursor.fetchall()
    conn.close()
    return [{"item": d[0], "total": d[1], "sessoes": d[2]} for d in data]

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
