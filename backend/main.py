@app.post("/predict")
async def predict_count(image: UploadFile = File(...)):
    try:
        # 1. Lê os bytes da imagem
        img_content = await image.read()
        
        # 2. Converte para objeto de imagem PIL
        img = Image.open(io.BytesIO(img_content))
        
        # 3. Prompt super direto para evitar conversas da IA
        prompt = "Analise a imagem lateral desta pilha. Quantas unidades existem? Responda APENAS o número. Se não tiver certeza, chute o valor mais provável baseado nas linhas de separação."
        
        # 4. Chamada oficial para o Gemini
        response = model.generate_content([prompt, img])
        
        # 5. LIMPEZA DE SEGURANÇA: Extrai apenas números do texto
        # Se a IA responder "Existem 12", isso pega apenas "12"
        raw_text = response.text.strip()
        count_digits = "".join(filter(str.isdigit, raw_text))
        
        if not count_digits:
            print(f"IA não retornou números. Resposta bruta: {raw_text}")
            ia_count = 0
        else:
            ia_count = int(count_digits)
            
        return {"ia_count": ia_count}

    except Exception as e:
        print(f"ERRO CRÍTICO NO BACKEND: {str(e)}")
        # Retorna um erro 500 para o Frontend saber o que houve
        return {"ia_count": 0, "error": str(e)}
