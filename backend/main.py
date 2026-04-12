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

DB_PATH = "stackcount.db"
TRAINING_DIR = "training_data"
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
    # Salva no Banco para Relatórios Mensais
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO inventory (item_name, ia_count, real_count, date) VALUES (?, ?, ?, ?)",
        (item_name, ia_count, real_count, datetime.now())
    )
    conn.commit()
    conn.close()

    # Organiza fotos para Treinamento Contínuo
    # Fotos onde a IA errou são as mais valiosas
    error_margin = abs(real_count - ia_count)
    folder = "errors" if error_margin > 0 else "correct"
    path = os.path.join(TRAINING_DIR, folder, str(real_count))
    os.makedirs(path, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    file_path = os.path.join(path, f"ia{ia_count}_real{real_count}_{timestamp}.jpg")
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(image.file, buffer)

    return {"status": "success", "improvement_logged": error_margin > 0}

@app.get("/report")
async def get_report():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT item_name, SUM(real_count), COUNT(*) FROM inventory GROUP BY item_name")
    data = cursor.fetchall()
    conn.close()
    return [{"item": d[0], "total": d[1], "contagens": d[2]} for d in data]

if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
