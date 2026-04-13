"""
StackCount PRO — Backend API
FastAPI + Gemini 2.0 Flash + SQLite (WAL mode)
Railway deployment ready
"""

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
import os
import sqlite3
import json
import re
import io
import logging
from datetime import datetime, date
from contextlib import contextmanager
from typing import Optional
from PIL import Image

# ── Google Gemini SDK (novo: google-genai) ──
import google.generativeai as genai

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("stackcount")

# ─────────────────────────────────────────────
#  CONFIG
# ─────────────────────────────────────────────
API_KEY = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY", "")
ALLOWED_ORIGINS = os.environ.get(
    "ALLOWED_ORIGINS",
    "https://stackcount.vercel.app,https://stackcount-pro.vercel.app,http://localhost:3000,http://localhost:3001"
).split(",")

DB_PATH = os.environ.get("DB_PATH", "/data/stackcount.db")  # Railway persistent volume
if not os.path.exists(os.path.dirname(DB_PATH)):
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    DB_PATH = "stackcount.db"  # fallback for local

MODEL_NAME = "gemini-2.0-flash"

# Configure Gemini
ai_ready = False
ai_model = None
if API_KEY:
    try:
        genai.configure(api_key=API_KEY)
        ai_model = genai.GenerativeModel(MODEL_NAME)
        ai_ready = True
        log.info(f"✅ Gemini {MODEL_NAME} configurado com sucesso")
    except Exception as e:
        log.error(f"❌ Erro ao configurar Gemini: {e}")
else:
    log.warning("⚠️  GEMINI_API_KEY não encontrada — modo edge only")

# ─────────────────────────────────────────────
#  APP
# ─────────────────────────────────────────────
app = FastAPI(
    title="StackCount PRO API",
    version="2.0.0",
    description="AI-powered publication inventory engine"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "X-Request-ID"],
)

# ─────────────────────────────────────────────
#  DATABASE
# ─────────────────────────────────────────────
def init_db():
    with get_db() as conn:
        conn.executescript("""
            PRAGMA journal_mode=WAL;
            PRAGMA foreign_keys=ON;

            CREATE TABLE IF NOT EXISTS publications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                type TEXT DEFAULT 'revista',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS inventory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pub_code TEXT NOT NULL,
                pub_name TEXT NOT NULL,
                ai_count INTEGER NOT NULL,
                real_count INTEGER NOT NULL,
                bias INTEGER GENERATED ALWAYS AS (real_count - ai_count) STORED,
                confidence INTEGER DEFAULT 0,
                month INTEGER NOT NULL,
                year INTEGER NOT NULL,
                mode TEXT DEFAULT 'gemini',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (pub_code) REFERENCES publications(code)
            );

            CREATE TABLE IF NOT EXISTS calibrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pub_code TEXT NOT NULL,
                edge_lines INTEGER NOT NULL,
                real_count INTEGER NOT NULL,
                factor REAL NOT NULL,
                confidence INTEGER DEFAULT 0,
                note TEXT DEFAULT '',
                source TEXT DEFAULT 'manual',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_inv_pubcode ON inventory(pub_code);
            CREATE INDEX IF NOT EXISTS idx_inv_month ON inventory(year, month);
            CREATE INDEX IF NOT EXISTS idx_cal_pubcode ON calibrations(pub_code);

            INSERT OR IGNORE INTO publications (code, name, type) VALUES
                ('g20.3-T', 'A Sentinela', 'revista'),
                ('wlp26.01-T', 'Despertai!', 'revista'),
                ('Ifb-T', 'Informativo', 'folheto'),
                ('lr-T', 'Leia-me', 'folheto');
        """)

@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

init_db()

# ─────────────────────────────────────────────
#  GEMINI PROMPT — especializado em publicações
# ─────────────────────────────────────────────
def build_prompt(pub_name: str, cal_context: str) -> str:
    return f"""Você é um sistema de visão computacional especializado em contagem de publicações físicas em estoque.

PUBLICAÇÃO: {pub_name}

INSTRUÇÃO: Analise esta imagem de uma pilha de publicações (revistas, livros ou folhetos) e conte EXATAMENTE quantas unidades há na pilha, contando as lombadas/espinhas visíveis na lateral.

REGRAS:
1. Conte cada lombada visível separadamente
2. Se a pilha estiver de frente, estime pela espessura total ÷ espessura média de 1 unidade
3. Não confunda objetos de fundo com a pilha principal
4. Se houver múltiplas pilhas, some todas

{cal_context}

RESPOSTA: Responda APENAS com um número inteiro. Nenhum texto adicional. Apenas o número."""


def get_calibration_context(pub_code: str) -> str:
    with get_db() as conn:
        rows = conn.execute(
            """SELECT real_count, edge_lines, factor, created_at
               FROM calibrations WHERE pub_code = ?
               ORDER BY created_at DESC LIMIT 5""",
            (pub_code,)
        ).fetchall()
    if not rows:
        return ""
    samples = ", ".join([f"{r['real_count']} unidades (fator={r['factor']:.3f})" for r in rows])
    avg_factor = sum(r["factor"] for r in rows) / len(rows)
    return f"\nCALIBRAÇÕES ANTERIORES para {pub_code}: {samples}\nFator médio aprendido: {avg_factor:.3f}"


# ─────────────────────────────────────────────
#  ROUTES
# ─────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "status": "online",
        "version": "2.0.0",
        "ai_ready": ai_ready,
        "model": MODEL_NAME if ai_ready else "edge_only",
        "api_key_set": bool(API_KEY),
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/health")
async def health():
    """Health check para Railway e Vercel"""
    db_ok = False
    try:
        with get_db() as conn:
            conn.execute("SELECT 1").fetchone()
        db_ok = True
    except Exception as e:
        log.error(f"DB health check failed: {e}")

    return {
        "status": "healthy" if db_ok else "degraded",
        "ai": "online" if ai_ready else "offline",
        "db": "online" if db_ok else "offline",
        "model": MODEL_NAME
    }


@app.post("/predict")
async def predict(
    image: UploadFile = File(...),
    pub_code: str = Form(default=""),
    pub_name: str = Form(default="publicação"),
    edge_count: int = Form(default=0),
    edge_conf: int = Form(default=0),
):
    """
    Analisa imagem com Gemini 2.0 Flash.
    Recebe edge_count/edge_conf do frontend para contexto de fusão.
    """
    if not ai_ready:
        return {"ai_count": edge_count or 0, "confidence": 40, "ai_ready": False,
                "error": "API Key não configurada no Railway", "model": "edge_only"}

    # Validar arquivo
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(400, "Arquivo deve ser uma imagem")

    try:
        img_bytes = await image.read()
        if len(img_bytes) > 10 * 1024 * 1024:
            raise HTTPException(413, "Imagem muito grande (máx 10MB)")

        # Abrir e redimensionar para economizar tokens
        img = Image.open(io.BytesIO(img_bytes))
        img = img.convert("RGB")
        max_dim = 1024
        if max(img.size) > max_dim:
            ratio = max_dim / max(img.size)
            img = img.resize((int(img.width * ratio), int(img.height * ratio)), Image.LANCZOS)

        cal_context = get_calibration_context(pub_code) if pub_code else ""
        prompt = build_prompt(pub_name, cal_context)

        log.info(f"🔍 Predição: pub={pub_code}, edge={edge_count}, conf={edge_conf}%")

        response = ai_model.generate_content(
            [prompt, img],
            generation_config={"temperature": 0.05, "max_output_tokens": 20}
        )

        raw = response.text.strip()
        log.info(f"🤖 Gemini respondeu: '{raw}'")

        numbers = re.findall(r"\d+", raw)
        ai_count = int(numbers[0]) if numbers else 0

        # Confiança: se alinha com edge ±20%, confiança alta
        confidence = 85
        if edge_count > 0 and ai_count > 0:
            ratio = min(ai_count, edge_count) / max(ai_count, edge_count)
            confidence = min(98, int(85 + ratio * 13))

        log.info(f"✅ Resultado: {ai_count} unidades (conf={confidence}%)")
        return {
            "ai_count": ai_count,
            "confidence": confidence,
            "ai_ready": True,
            "model": MODEL_NAME,
            "raw_response": raw
        }

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"❌ Erro na predição: {e}")
        return {"ai_count": edge_count or 0, "confidence": 40, "ai_ready": ai_ready,
                "error": str(e), "model": MODEL_NAME}


@app.post("/calibrate")
async def calibrate(
    pub_code: str = Form(...),
    pub_name: str = Form(...),
    ai_count: int = Form(...),
    real_count: int = Form(...),
    edge_lines: int = Form(default=0),
    confidence: int = Form(default=0),
    note: str = Form(default=""),
    source: str = Form(default="manual"),
    month: int = Form(default=0),
    year: int = Form(default=0),
):
    """Salva contagem real para aprendizado contínuo"""
    if real_count < 0:
        raise HTTPException(400, "Contagem real não pode ser negativa")

    now = datetime.now()
    m = month or now.month
    y = year or now.year

    factor = edge_lines / real_count if (edge_lines > 0 and real_count > 0) else 0.0

    with get_db() as conn:
        # Garante publicação existe
        conn.execute(
            "INSERT OR IGNORE INTO publications (code, name, type) VALUES (?, ?, 'revista')",
            (pub_code, pub_name)
        )

        # Salva inventário
        conn.execute(
            """INSERT INTO inventory (pub_code, pub_name, ai_count, real_count, confidence, month, year, mode)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (pub_code, pub_name, ai_count, real_count, confidence, m, y, source)
        )

        # Salva calibração (só se temos dados de edge)
        if edge_lines > 0 and real_count > 0:
            conn.execute(
                """INSERT INTO calibrations (pub_code, edge_lines, real_count, factor, confidence, note, source)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (pub_code, edge_lines, real_count, factor, confidence, note, source)
            )

    log.info(f"✅ Calibração: {pub_code} → {real_count} unidades, fator={factor:.3f}")

    # Retorna fator atualizado (média ponderada de todas as amostras)
    with get_db() as conn:
        rows = conn.execute(
            "SELECT factor FROM calibrations WHERE pub_code = ? ORDER BY created_at DESC LIMIT 10",
            (pub_code,)
        ).fetchall()

    samples = [r["factor"] for r in rows if r["factor"] > 0]
    avg_factor = sum(samples) / len(samples) if samples else 0

    return {
        "status": "ok",
        "pub_code": pub_code,
        "real_count": real_count,
        "bias": real_count - ai_count,
        "factor_updated": round(avg_factor, 4),
        "total_samples": len(samples)
    }


@app.get("/report")
async def report(year: Optional[int] = None, month: Optional[int] = None):
    """Relatório de inventário agrupado por publicação"""
    now = datetime.now()
    y = year or now.year
    m = month or now.month

    with get_db() as conn:
        # Totais do mês
        monthly = conn.execute(
            """SELECT pub_code, pub_name,
                      SUM(real_count) as total,
                      COUNT(*) as entries,
                      AVG(ABS(bias)) as avg_error,
                      AVG(confidence) as avg_conf
               FROM inventory
               WHERE year = ? AND month = ?
               GROUP BY pub_code
               ORDER BY total DESC""",
            (y, m)
        ).fetchall()

        # Histórico (últimos 6 meses)
        history = conn.execute(
            """SELECT year, month, pub_code,
                      SUM(real_count) as total
               FROM inventory
               GROUP BY year, month, pub_code
               ORDER BY year DESC, month DESC
               LIMIT 50""",
        ).fetchall()

        # Precisão por publicação
        accuracy = conn.execute(
            """SELECT pub_code,
                      AVG(CASE WHEN ai_count > 0 THEN
                          (1.0 - ABS(bias) * 1.0 / NULLIF(real_count, 0)) * 100
                          ELSE 0 END) as accuracy,
                      COUNT(*) as samples
               FROM calibrations
               GROUP BY pub_code"""
        ).fetchall()

    acc_map = {r["pub_code"]: {"accuracy": round(r["accuracy"] or 0, 1), "samples": r["samples"]} for r in accuracy}

    return {
        "year": y,
        "month": m,
        "monthly": [
            {
                "pub_code": r["pub_code"],
                "pub_name": r["pub_name"],
                "total": r["total"],
                "entries": r["entries"],
                "avg_error": round(r["avg_error"] or 0, 2),
                "avg_conf": round(r["avg_conf"] or 0),
                "accuracy": acc_map.get(r["pub_code"], {}).get("accuracy", None),
                "samples": acc_map.get(r["pub_code"], {}).get("samples", 0)
            }
            for r in monthly
        ],
        "history": [dict(r) for r in history],
        "total_month": sum(r["total"] for r in monthly)
    }


@app.get("/publications")
async def list_publications():
    with get_db() as conn:
        pubs = conn.execute(
            "SELECT code, name, type, created_at FROM publications ORDER BY name"
        ).fetchall()
        # Adiciona contagem de calibrações
        cal_counts = conn.execute(
            "SELECT pub_code, COUNT(*) as n FROM calibrations GROUP BY pub_code"
        ).fetchall()
    cal_map = {r["pub_code"]: r["n"] for r in cal_counts}
    return [{"code": r["code"], "name": r["name"], "type": r["type"],
             "calibrations": cal_map.get(r["code"], 0)} for r in pubs]


@app.post("/publications")
async def create_publication(code: str = Form(...), name: str = Form(...), type: str = Form(default="revista")):
    code = code.strip()
    if not code or not name.strip():
        raise HTTPException(400, "Código e nome são obrigatórios")
    with get_db() as conn:
        existing = conn.execute("SELECT code FROM publications WHERE code = ?", (code,)).fetchone()
        if existing:
            raise HTTPException(409, f"Publicação '{code}' já existe")
        conn.execute("INSERT INTO publications (code, name, type) VALUES (?, ?, ?)", (code, name.strip(), type))
    return {"status": "ok", "code": code, "name": name}


@app.delete("/publications/{code}")
async def delete_publication(code: str):
    with get_db() as conn:
        conn.execute("DELETE FROM calibrations WHERE pub_code = ?", (code,))
        conn.execute("DELETE FROM inventory WHERE pub_code = ?", (code,))
        conn.execute("DELETE FROM publications WHERE code = ?", (code,))
    return {"status": "ok"}


@app.get("/calibrations/{pub_code}")
async def get_calibrations(pub_code: str):
    with get_db() as conn:
        rows = conn.execute(
            """SELECT edge_lines, real_count, factor, confidence, note, source, created_at
               FROM calibrations WHERE pub_code = ?
               ORDER BY created_at DESC LIMIT 20""",
            (pub_code,)
        ).fetchall()
    return [dict(r) for r in rows]


@app.get("/stats")
async def stats():
    """Estatísticas gerais para dashboard"""
    with get_db() as conn:
        total_records = conn.execute("SELECT COUNT(*) FROM inventory").fetchone()[0]
        total_pubs = conn.execute("SELECT COUNT(DISTINCT pub_code) FROM inventory").fetchone()[0]
        total_cal = conn.execute("SELECT COUNT(*) FROM calibrations").fetchone()[0]
        current_month = datetime.now()
        month_total = conn.execute(
            "SELECT COALESCE(SUM(real_count), 0) FROM inventory WHERE year=? AND month=?",
            (current_month.year, current_month.month)
        ).fetchone()[0]

        avg_accuracy = conn.execute(
            """SELECT AVG((1.0 - ABS(bias)*1.0/NULLIF(real_count,0))*100)
               FROM inventory WHERE real_count > 0"""
        ).fetchone()[0]

    return {
        "total_records": total_records,
        "total_publications": total_pubs,
        "total_calibrations": total_cal,
        "month_total": month_total,
        "avg_accuracy": round(avg_accuracy or 0, 1),
        "ai_ready": ai_ready,
        "model": MODEL_NAME if ai_ready else "edge_only"
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
