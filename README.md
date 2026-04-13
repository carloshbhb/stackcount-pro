# ⚡ StackCount PRO v2.0

**Inventário inteligente de publicações com Gemini 2.0 Flash Vision**

Conta automaticamente pilhas de revistas (A Sentinela, Despertai!), folhetos e livros usando IA + aprendizado contínuo por calibração.

---

## 🏗️ Arquitetura

```
Frontend (Vercel)          Backend (Railway)
  Next.js 14          →      FastAPI + Gemini 2.0 Flash
  React / Tailwind           SQLite WAL (volume persistente)
  PWA (offline-ready)        Aprendizado por calibração
```

---

## 🚀 Deploy em produção

### Railway (Backend)

1. No painel Railway, clique **New Project → Deploy from GitHub Repo**
2. Selecione este repositório
3. Railway vai detectar o `railway.toml` e usar o `backend/Dockerfile`
4. Adicione as **Variables** (Settings → Variables):

```
GEMINI_API_KEY=AIzaSyASk2PzOkwSSHnZWcqaFntFlr8OIZtRIK8
GOOGLE_API_KEY=AIzaSyASk2PzOkwSSHnZWcqaFntFlr8OIZtRIK8
ALLOWED_ORIGINS=https://SEU-PROJETO.vercel.app
DB_PATH=/data/stackcount.db
```

5. Adicione um **Volume**: Mount Path = `/data`
6. Copie a URL gerada: `https://xxx.up.railway.app`

### Vercel (Frontend)

1. Importe o repositório no Vercel
2. Configure:
   - **Root Directory**: `frontend`
   - **Framework**: Next.js
3. Adicione **Environment Variable**:
   ```
   NEXT_PUBLIC_API_URL=https://SUA-URL.up.railway.app
   ```
4. Deploy!

---

## 💻 Desenvolvimento local

```bash
# Backend
cd backend
pip install -r requirements.txt
GEMINI_API_KEY=sua-chave uvicorn main:app --reload

# Frontend
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```

---

## 📱 Funcionalidades

| Feature | Status |
|---------|--------|
| Câmera (traseira, alta res) | ✅ |
| Análise Gemini 2.0 Flash | ✅ |
| Fallback edge-only (offline) | ✅ |
| Calibração manual | ✅ |
| Aprendizado contínuo por publicação | ✅ |
| Inventário mensal | ✅ |
| Relatório com gráficos | ✅ |
| Exportar CSV | ✅ |
| PWA instalável | ✅ |
| Indicador de status da IA | ✅ |
| Publicações pré-cadastradas | ✅ |

---

## 🤖 Como a IA aprende

1. Você fotografa uma pilha → Gemini retorna uma estimativa
2. Você confirma ou corrige a quantidade real
3. O sistema salva: `(linhas_borda, quantidade_real, fator)` no banco
4. Na próxima análise, o prompt inclui calibrações anteriores como contexto
5. A precisão melhora continuamente por publicação

---

## 📦 Estrutura

```
stackcount-pro/
├── backend/
│   ├── main.py           # FastAPI + Gemini + SQLite
│   ├── requirements.txt  # google-generativeai 0.8.3
│   └── Dockerfile        # Python 3.11 slim
├── frontend/
│   ├── app/
│   │   ├── page.tsx      # App principal (scanner, relatório, config)
│   │   ├── layout.tsx    # PWA metadata
│   │   └── globals.css   # Animações CSS
│   ├── public/
│   │   └── manifest.json # PWA manifest
│   ├── package.json
│   └── tsconfig.json
├── docker-compose.yml    # Dev local
├── railway.toml          # Config Railway
├── vercel.json           # Config Vercel
└── README.md
```

---

## 🔑 Publicações pré-configuradas

| Código | Nome | Tipo |
|--------|------|------|
| `g20.3-T` | A Sentinela | Revista |
| `wlp26.01-T` | Despertai! | Revista |
| `Ifb-T` | Informativo | Folheto |
| `lr-T` | Leia-me | Folheto |

---

## ⚠️ Segurança

- API key nunca exposta no frontend (só no Railway)
- CORS configurado para domínios específicos
- Headers de segurança no Vercel (X-Frame-Options, nosniff)
- SQLite com WAL mode para consistência
- Validação de tipo de arquivo no upload
