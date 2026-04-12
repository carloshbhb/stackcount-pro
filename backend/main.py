from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import os
import sqlite3
from datetime import datetime
import shutil
import google.generativeai as genai
from PIL import Image
import io

# 1. PRIMEIRO: Definir o app
app = FastAPI()

# 2. SEGUNDO: Configurar Middlewares
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. TERCEIRO: Configurações de IA e Banco
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")
if GOOGLE_API_KEY:
    genai.configure(api_key=GOOGLE_API_KEY)
    model = genai.GenerativeModel('gemini-1.5-flash')

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

# 4. QUARTO: As Rotas (Agora o 'app' já existe!)
@app.get("/")
async def root():
    return {"status": "Online", "service": "StackCount Pro"}

@app.post("/predict")
async def predict_count(image: UploadFile = File(...)):
    try:
        img_content = await image.read()
        img = Image.open(io.BytesIO(img_content))
        
        prompt = "Conte quantas revistas ou livros existem nesta pilha lateral. Responda apenas com o número inteiro."
        
        response = model.generate_content([prompt, img])
        count_str = "".join(filter(str.isdigit, response.text))
        ia_count = int(count_str) if count_str else 0
        return {"ia_count": ia_count}
    except Exception as e:
        return {"ia_count": 0, "error": str(e)}

@app.post("/train")
async def train_ia(
    image: UploadFile = File(...),
    item_name: str = Form(...),
    ia_count: int = Form(...),
    real_count: int = Form(...)
):
    bias = real_count - ia_count
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO inventory (item_name, ia_count, real_count, bias, date) VALUES (?, ?, ?, ?, ?)",
        (item_name, ia_count, real_count, bias, datetime.now())
    )
    conn.commit()
    conn.close()
    return {"status": "success"}

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
