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

# 1. Inicialização do App
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Configuração da IA (Gemini)
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")
if GOOGLE_API_KEY:
    genai.configure(api_key=GOOGLE_API_KEY)
    # Usamos o modelo Flash por ser mais rápido para contagem
    model = genai.GenerativeModel('gemini-1.5-flash')

# 3. Banco de Dados
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

# 4. Rotas do Servidor
@app.get("/")
async def root():
    return {"status": "Online", "model": "Gemini 1.5 Flash Active"}

@app.post("/predict")
async def predict_count(image: UploadFile = File(...)):
    try:
        # Verifica se a chave de API existe
        if not GOOGLE_API_KEY:
            return {"ia_count": 0, "error": "GOOGLE_API_KEY não configurada no servidor."}

        # Lê a imagem e converte para PIL
        img_content = await image.read()
        img = Image.open(io.BytesIO(img_content))
        
        # Prompt otimizado: Instruímos a IA a ser curta e grossa
        prompt = """
        Analise esta imagem lateral de uma pilha. 
        Conte quantos itens (revistas/livros) estão empilhados. 
        Responda APENAS o número. 
        Se não tiver certeza, forneça sua melhor estimativa numérica.
        """
        
        # Gera o conteúdo
        response = model.generate_content([prompt, img])
        raw_text = response.text.strip()
        
        # LOG PARA DEPURAÇÃO: Isso aparecerá nos logs da Railway para você ver o que a IA disse
        print(f"DEBUG - Resposta Bruta do Gemini: {raw_text}")

        # Limpeza via Regex: Extrai apenas o primeiro número que encontrar na frase
        match = re.search(r'\d+', raw_text)
        if match:
            ia_count = int(match.group())
        else:
            # Se não encontrar nenhum número, tentamos uma limpeza radical
            clean_str = "".join(filter(str.isdigit, raw_text))
            ia_count = int(clean_str) if clean_str else 0
            
        return {"ia_count": ia_count}

    except Exception as e:
        print(f"ERRO CRÍTICO NO PREDICT: {str(e)}")
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

        # Salvando imagem para dataset (Opcional - Útil para retreino futuro)
        folder = "dataset_feedback"
        os.makedirs(folder, exist_ok=True)
        filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{real_count}.jpg"
        with open(os.path.join(folder, filename), "wb") as buffer:
            image.file.seek(0)
            shutil.copyfileobj(image.file, buffer)

        return {"status": "success", "message": "Feedback registrado"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/report")
async def get_report():
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT item_name, AVG(bias), COUNT(*) 
            FROM inventory GROUP BY item_name
        """)
        stats = cursor.fetchall()
        conn.close()
        return [{"item": s[0], "erro_medio": round(s[1], 2), "total_scans": s[2]} for s in stats]
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
