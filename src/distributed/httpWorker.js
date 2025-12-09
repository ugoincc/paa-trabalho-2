// src/distributed/httpWorker.js
const express = require("express");
const bodyParser = require("body-parser");
const { applyConvolution } = require("../functions/applyConvolution");

const app = express();
const PORT = 3000;

// Aumenta limite do JSON para aceitar imagens grandes (50MB)
app.use(bodyParser.json({ limit: "50mb" }));

app.post("/processar", (req, res) => {
  try {
    const { image, width, height, kernel, kernelDivisor } = req.body;

    // 1. Converter Base64 de volta para Buffer
    const srcBuffer = Buffer.from(image, "base64");
    
    // 2. Preparar buffer de saída
    const outputBuffer = Buffer.alloc(srcBuffer.length);

    // 3. REAPROVEITA SUA FUNÇÃO DE CONVOLUÇÃO EXISTENTE!
    // Nota: Como o worker recebe apenas um pedaço (slice) ou a imagem toda,
    // a lógica é a mesma. Aqui assumimos que ele recebe o pedaço exato para processar.
    applyConvolution(
        srcBuffer, 
        outputBuffer, 
        width, 
        height, 
        kernel, 
        kernelDivisor || 1
    );

    // 4. Devolve o resultado em Base64
    const resultBase64 = outputBuffer.toString("base64");

    res.json({ image: resultBase64 });

  } catch (error) {
    console.error("Erro no Worker:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Worker HTTP rodando na porta ${PORT}`);
});