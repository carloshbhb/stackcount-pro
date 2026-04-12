from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import os
import sqlite3
from datetime import datetime
import shutil
import google.generativeai as genai
from PIL import Image
import io
import re

# --- INICIALIZAÇÃO ---
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CONFIGURAÇÃO GEMINI (SDK ESTÁVEL) ---
# Ele tentará pegar qualquer uma das duas variáveis que você definiu
API_KEY = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
if API_KEY:
    genai.configure(api_key=API_KEY)
    model = genai.GenerativeModel('gemini-1.5-flash')

# --- BANCO DE DADOS ---
DB_PATH = "stackcount.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
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

# --- ROTAS ---

@app.get("/")
async def root():
    return {"status": "Online", "model": "Gemini 1.5 Flash Stable"}

@app.post("/predict")
async def predict_count(image: UploadFile = File(...)):
    try:
        if not API_KEY:
            return {"ia_count": 0, "error": "API Key ausente na Railway."}

        # Lê a imagem
        img_content = await image.read()
        img = Image.open(io.BytesIO(img_content))
        
        # Prompt direto
        prompt = "Conte as camadas/objetos nesta pilha lateral. Responda apenas o número."
        
        # Chamada estável
        response = model.generate_content([prompt, img])
        raw_text = response.text.strip()
        
        print(f"DEBUG: IA respondeu: {raw_text}")

        # REGEX: Extrai apenas números (evita o erro do '0')
        numeros = re.findall(r'\d+', raw_text)
        ia_count = int(numeros[0]) if numeros else 0
            
        return {"ia_count": ia_count}

    except Exception as e:
        print(f"ERRO: {str(e)}")
        return {"ia_count": 0, "error": str(e)}

@app.post("/train")
async def train_ia(
    image: UploadFile = File(...),
    item_name: str = Form(...),
    ia_count: int = Form(...),
    real_count: int = Form(...)
):
    try:
        bias = int(real_count) - int(ia_count)
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO inventory (item_name, ia_count, real_count, bias, date) VALUES (?, ?, ?, ?, ?)",
            (item_name, ia_count, real_count, bias, datetime.now())
        )
        conn.commit()
        conn.close()
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/report")
async def get_report():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT item_name, AVG(bias), COUNT(*) FROM inventory GROUP BY item_name")
    stats = cursor.fetchall()
    conn.close()
    return [{"item": s[0], "erro_medio": round(s[1], 2), "total": s[2]} for s in stats]

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
