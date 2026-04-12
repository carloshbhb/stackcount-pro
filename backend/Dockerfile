FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Instala as dependências de sistema atualizadas para processamento de imagem
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copia o requirements usando o curinga para garantir que ele encontre
COPY requirements* /app/

# Instala as bibliotecas Python
RUN pip install --no-cache-dir -r requirements.txt

# Copia o restante dos arquivos do backend
COPY . /app

EXPOSE 8000

# Comando para iniciar a API
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
