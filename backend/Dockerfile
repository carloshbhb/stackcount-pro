FROM python:3.11-slim

# Evita que o Python gere arquivos .pyc e permite logs em tempo real
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Instala dependências do sistema para visão computacional
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# 1. Copia primeiro o requirements para aproveitar o cache do Docker
COPY requirements.txt /app/requirements.txt

# 2. Instala as bibliotecas Python
RUN pip install --no-cache-dir -r requirements.txt

# 3. Copia o restante dos arquivos do backend
COPY . /app

# Expõe a porta que a Railway vai usar
EXPOSE 8000

# Comando para iniciar a API
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
