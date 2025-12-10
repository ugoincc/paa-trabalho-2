// src/distributed/httpWorker.js
const express = require("express");
const bodyParser = require("body-parser");
const { performance } = require("perf_hooks"); // Importante para medir tempo
const { applyConvolution } = require("../functions/applyConvolution");

const app = express();
const PORT = 3000;

app.use(bodyParser.json({ limit: "200mb" }));

app.post("/processar", (req, res) => {
  try {
    const { image, width, height, kernel, kernelDivisor } = req.body;

    const srcBuffer = Buffer.from(image, "base64");
    const outputBuffer = Buffer.alloc(srcBuffer.length);

    // --- INÍCIO DA MEDIÇÃO DO WORKER ---
    const startProc = performance.now();

    // O processamento pesado acontece aqui
    applyConvolution(
        srcBuffer, 
        outputBuffer, 
        width, 
        height, 
        kernel, 
        kernelDivisor || 1
    );

    // --- FIM DA MEDIÇÃO DO WORKER ---
    const endProc = performance.now();
    const duration = endProc - startProc;

    const resultBase64 = outputBuffer.toString("base64");

    // Retorna a imagem E as métricas de tempo
    res.json({ 
        image: resultBase64,
        metrics: {
            processTime: duration, // Tempo puro de CPU
            workerStart: startProc,
            workerEnd: endProc
        }
    });

  } catch (error) {
    console.error("Erro no Worker:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Worker HTTP rodando na porta ${PORT}`);
});