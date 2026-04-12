# 1. Imagem base oficial do Python
FROM python:3.11-slim

# 2. Configurações para o Python não travar logs e não criar lixo (.pyc)
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# 3. Define a pasta de trabalho dentro do container
WORKDIR /app

# 4. Instala dependências do sistema para processamento de imagem (OpenCV/IA)
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# 5. Copia o arquivo de dependências e instala
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 6. Copia todo o resto do código do backend
COPY . .

# 7. Expõe a porta que o Railway vai usar
EXPOSE 8000

# 8. Comando para ligar o servidor
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
