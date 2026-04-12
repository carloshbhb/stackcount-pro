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

# --- INICIALIZAÇÃO DO APP ---
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CONFIGURAÇÃO DA IA (GEMINI) ---
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")
if GOOGLE_API_KEY:
    genai.configure(api_key=GOOGLE_API_KEY)
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
    return {"status": "Online", "model": "Gemini 1.5 Flash Active"}

@app.post("/predict")
async def predict_count(image: UploadFile = File(...)):
    try:
        if not GOOGLE_API_KEY:
            return {"ia_count": 0, "error": "API Key ausente nas variáveis de ambiente."}

        # Processamento da imagem
        img_content = await image.read()
        img = Image.open(io.BytesIO(img_content))
        
        # Prompt focado em extrair apenas o número
        prompt = "Analise a pilha lateral na imagem. Quantas unidades existem? Responda APENAS o número puro. Se não souber, estime."
        
        response = model.generate_content([prompt, img])
        raw_text = response.text.strip()
        
        # Log de segurança para você ver na Railway o que a IA está respondendo
        print(f"DEBUG: Resposta da IA: {raw_text}")

        # REGEX: Busca qualquer número na resposta (evita o erro '0' se a IA falar texto)
        numeros = re.findall(r'\d+', raw_text)
        
        if numeros:
            ia_count = int(numeros[0])
        else:
            print("AVISO: Nenhum número encontrado na resposta da IA.")
            ia_count = 0
            
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

        # Opcional: Salvar a imagem para dataset
        folder = "dataset_feedback"
        os.makedirs(folder, exist_ok=True)
        filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{real_count}.jpg"
        with open(os.path.join(folder, filename), "wb") as buffer:
            image.file.seek(0)
            shutil.copyfileobj(image.file, buffer)

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
