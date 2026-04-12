FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Instala dependências do sistema
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Usamos o caractere curinga (*) para garantir que ele encontre o arquivo 
# mesmo se houver erro de caminho ou contexto
COPY requirements* /app/

RUN pip install --no-cache-dir -r requirements.txt

# Copia todo o conteúdo da pasta onde o Dockerfile está para dentro de /app
COPY . /app

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
