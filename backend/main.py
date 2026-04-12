from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI()

# Permite que o Frontend converse com o Backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {"status": "StackCount API Online"}

@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    # Aqui a lógica de IA que configuramos na Etapa 2 entra em ação
    return {"count": 42, "confidence": 0.95}
