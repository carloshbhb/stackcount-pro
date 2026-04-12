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

# Configuração do Banco de Dados
DB_PATH = "stackcount.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    # Armazena o item, o que a IA achou, o que o humano corrigiu e a diferença (bias)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_name TEXT,
            ia_count INTEGER,
            real_count INTEGER,
            bias INTEGER,
            date TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

init_db()

@app.get("/")
async def root():
    return {"status": "IA Ready", "learning_mode": "Active"}

@app.post("/train")
async def train_ia(
    image: UploadFile = File(...),
    item_name: str = Form(...),
    ia_count: int = Form(...),
    real_count: int = Form(...)
):
    # O "Aprendizado": calculamos o erro sistemático
    bias = real_count - ia_count
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO inventory (item_name, ia_count, real_count, bias, date) VALUES (?, ?, ?, ?, ?)",
        (item_name, ia_count, real_count, bias, datetime.now())
    )
    conn.commit()
    conn.close()

    # Salvando a imagem para retreino visual futuro (manual)
    # Nota: Se não houver 'Volume' na Railway, isso sumirá no próximo deploy
    save_path = f"dataset_treino/{item_name.replace(' ', '_')}"
    os.makedirs(save_path, exist_ok=True)
    with open(f"{save_path}/{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg", "wb") as buffer:
        shutil.copyfileobj(image.file, buffer)

    return {"status": "learned", "bias_detected": bias}

@app.get("/report")
async def get_report():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    # Busca a média de erro por item para ajustar a IA no futuro
    cursor.execute("""
        SELECT item_name, AVG(bias) as avg_error, COUNT(*) as samples 
        FROM inventory GROUP BY item_name
    """)
    stats = cursor.fetchall()
    conn.close()
    return [{"item": s[0], "erro_medio": round(s[1], 2), "confianca": s[2]} for s in stats]

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
