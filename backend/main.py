from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import os
import sqlite3
from datetime import datetime
import shutil
from google import genai  # Nova SDK
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

# --- CONFIGURAÇÃO CLIENTE GEMINI (NOVA SDK) ---
# Certifique-se que a variável na Railway se chama GEMINI_API_KEY ou altere aqui
api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
client = genai.Client(api_key=api_key)

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
    return {"status": "Online", "model": "Gemini 3 Flash Ready"}

@app.post("/predict")
async def predict_count(image: UploadFile = File(...)):
    try:
        # Lê os bytes da imagem
        img_bytes = await image.read()
        
        # Converte para objeto PIL para garantir que é uma imagem válida
        img = Image.open(io.BytesIO(img_bytes))
        
        prompt = "Analise a lateral desta pilha. Quantas unidades existem? Responda APENAS o número puro."
        
        # Chamada usando a nova SDK
        response = client.models.generate_content(
            model="gemini-2.0-flash", # Use 2.0 ou 1.5 caso o 3 ainda esteja instável na sua região
            contents=[prompt, img]
        )
        
        raw_text = response.text.strip()
        print(f"DEBUG: Resposta da IA: {raw_text}")

        # Extração de segurança para não retornar 0 por causa de texto extra
        numeros = re.findall(r'\d+', raw_text)
        ia_count = int(numeros[0]) if numeros else 0
            
        return {"ia_count": ia_count}

    except Exception as e:
        print(f"ERRO NO PREDICT: {str(e)}")
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
