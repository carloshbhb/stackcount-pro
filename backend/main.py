from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import os
import sqlite3
from datetime import datetime
import shutil
import google.generativeai as genai
from PIL import Image
import io

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuração Gemini
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")
genai.configure(api_key=GOOGLE_API_KEY)
model = genai.GenerativeModel('gemini-1.5-flash')

# Banco de Dados
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

@app.post("/predict")
async def predict_count(image: UploadFile = File(...)):
    # Lê a imagem para o formato que o Gemini entende
    img_content = await image.read()
    img = Image.open(io.BytesIO(img_content))
    
    # Prompt específico para contagem lateral
    prompt = "Analisa esta imagem lateral de uma pilha de publicações. Conta exatamente quantos itens (revistas/livros) existem na pilha. Responde APENAS com o número inteiro."
    
    try {
        response = model.generate_content([prompt, img])
        # Limpa a resposta para garantir que temos apenas um número
        count_str = response.text.strip().split()[0]
        ia_count = int(''.join(filter(str.isdigit, count_str)))
    } except Exception as e:
        print(f"Erro na IA: {e}")
        ia_count = 0

    return {"ia_count": ia_count}

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

    # Salva imagem para o dataset de treino contínuo
    path = f"dataset_treino/{item_name.replace(' ', '_')}"
    os.makedirs(path, exist_ok=True)
    with open(f"{path}/{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg", "wb") as buffer:
        image.file.seek(0)
        shutil.copyfileobj(image.file, buffer)

    return {"status": "success", "bias": bias}

@app.get("/report")
async def get_report():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT item_name, AVG(bias), COUNT(*) FROM inventory GROUP BY item_name")
    stats = cursor.fetchall()
    conn.close()
    return [{"item": s[0], "erro_medio": round(s[1], 2), "amostras": s[2]} for s in stats]

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
