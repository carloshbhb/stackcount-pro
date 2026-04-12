from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import os
import sqlite3
from datetime import datetime
import shutil

app = FastAPI()

# Configuração de CORS para permitir acesso do Frontend (Vercel)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Caminhos de arquivos
DB_PATH = "stackcount.db"
TRAINING_DIR = "training_data"
os.makedirs(TRAINING_DIR, exist_ok=True)

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    # Tabela unificada para Inventário e Treinamento
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

@app.get("/")
async def root():
    return {"status": "StackCount API Online", "database": "Ready"}

@app.post("/train")
async def train_ia(
    image: UploadFile = File(...),
    item_name: str = Form("Publicação Padrão"),
    ia_count: int = Form(...),
    real_count: int = Form(...)
):
    # 1. Salva os dados no banco para o Relatório Mensal
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO inventory (item_name, ia_count, real_count, date) VALUES (?, ?, ?, ?)",
        (item_name, ia_count, real_count, datetime.now())
    )
    conn.commit()
    conn.close()

    # 2. Salva a imagem fisicamente para retreino da IA
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    # Organiza por pasta de quantidade real para facilitar o aprendizado
    label_dir = os.path.join(TRAINING_DIR, str(real_count))
    os.makedirs(label_dir, exist_ok=True)
    
    file_path = os.path.join(label_dir, f"ia_{ia_count}_ref_{timestamp}.jpg")
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(image.file, buffer)

    return {"status": "success", "message": "Feedback registrado para aprendizado contínuo"}

@app.get("/report")
async def get_report():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT item_name, SUM(real_count), COUNT(*) FROM inventory GROUP BY item_name")
    data = cursor.fetchall()
    conn.close()
    return [{"item": d[0], "total_unidades": d[1], "contagens_realizadas": d[2]} for d in data]

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
