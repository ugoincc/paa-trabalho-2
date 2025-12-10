// src/distributed/benchmarkRunner.js
const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");
const axios = require("axios");
const { performance } = require("perf_hooks");
const { generateGaussianKernel } = require("../functions/generateGaussKernel");

// ================= CONFIGURAÇÃO DO EXPERIMENTO =================
const RUNS = 30;    // Quantidade de execuções valendo
const WARMUP = 2;   // Aquecimento
const DELAY_BETWEEN_RUNS = 2000; // 2 segundos de pausa para "esfriar" os workers

// ESCOLHA O MODO AQUI (IGUAL AO SEQUENCIAL):
const MODE = 'BLUR'; // 'BLUR' ou 'EDGE'
const INPUT_FILENAME = "italy.png"; // Mesma imagem do teste sequencial
// ===============================================================

// Configuração do Kernel e Arquivos
let KERNEL;
if (MODE === 'BLUR') {
    KERNEL = generateGaussianKernel(15, 5);
} else {
    KERNEL = [[-1, -1, -1], [-1,  8, -1], [-1, -1, -1]];
}

const INPUT_FILE = path.join(__dirname, `../imgs/inputs/${INPUT_FILENAME}`);
// Não precisamos salvar a imagem no disco 30 vezes, apenas processar
const WORKERS = [
  "http://worker1:3000/processar",
  "http://worker2:3000/processar",
  "http://worker3:3000/processar"
];

// Função auxiliar de estatística
function getStats(arr) {
  const n = arr.length;
  const mean = arr.reduce((a, b) => a + b, 0) / n;
  const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
  return { mean, stdDev: Math.sqrt(variance) };
}

// Função de envio com Retry (Crucial para testes longos)
async function sendTaskWithRetry(payload, preferredWorkerIndex) {
    let attempts = 0;
    let currentWorkerIndex = preferredWorkerIndex;
    while (attempts < 3) {
        try {
            const res = await axios.post(WORKERS[currentWorkerIndex], payload, { timeout: 120000 });
            if (!res.data.image) throw new Error("Vazio");
            return res.data;
        } catch (err) {
            attempts++;
            currentWorkerIndex = (currentWorkerIndex + 1) % WORKERS.length;
        }
    }
    throw new Error("Falha no worker");
}

// Uma única execução do sistema distribuído
async function runSingleIteration(iterationNum, pngBuffer, width, height) {
    const start = performance.now();
    
    // Preparação
    const outputBuffer = Buffer.alloc(pngBuffer.length);
    if (MODE === 'EDGE') outputBuffer.fill(0); // Opcional, só para consistência
    
    const linesPerWorker = Math.ceil(height / WORKERS.length);
    const promises = [];

    for (let i = 0; i < WORKERS.length; i++) {
        const startY = i * linesPerWorker;
        let endY = startY + linesPerWorker;
        if (endY > height) endY = height;
        if (startY >= height) continue;

        // Cortar e Serializar
        const sliceBuffer = Buffer.alloc((endY - startY) * width * 4);
        pngBuffer.copy(sliceBuffer, 0, (startY * width * 4), (endY * width * 4));
        
        const payload = {
            image: sliceBuffer.toString("base64"),
            width: width,
            height: endY - startY,
            kernel: KERNEL
        };

        // Enviar
        promises.push(sendTaskWithRetry(payload, i).then(data => {
            // Deserializar (simulando a montagem, mesmo que não salvemos em disco)
            const chunk = Buffer.from(data.image, "base64");
            chunk.copy(outputBuffer, (startY * width * 4));
        }));
    }

    await Promise.all(promises);
    const end = performance.now();
    return end - start;
}

// O Loop Principal do Benchmark
async function startBenchmark() {
    console.log(`\n=== INICIANDO BENCHMARK DISTRIBUÍDO (${MODE}) ===`);
    console.log(`Workers: ${WORKERS.length} | Imagem: ${INPUT_FILENAME}`);
    console.log(`Config: ${RUNS} execuções, ${WARMUP} warmups\n`);

    console.log("--> Aguardando workers (5s)...");
    await new Promise(r => setTimeout(r, 5000));

    // Carrega a imagem uma vez para a memória RAM
    const data = fs.readFileSync(INPUT_FILE);
    const png = PNG.sync.read(data);
    
    // 1. Warmup
    console.log("--- Warmup ---");
    for (let i = 0; i < WARMUP; i++) {
        process.stdout.write(`Warmup ${i+1}/${WARMUP}... `);
        await runSingleIteration(i, png.data, png.width, png.height);
        console.log("OK");
        await new Promise(r => setTimeout(r, 1000)); // Pausa leve
    }

    // 2. Execuções Valendo
    console.log("\n--- Execuções Medidas ---");
    const times = [];

    for (let i = 0; i < RUNS; i++) {
        process.stdout.write(`Run ${i+1}: `);
        
        try {
            const duration = await runSingleIteration(i, png.data, png.width, png.height);
            times.push(duration);
            console.log(`${duration.toFixed(4)} ms`);
        } catch (error) {
            console.log(`FALHA (${error.message})`);
        }

        // Pausa para Garbage Collection e liberar sockets do Docker
        await new Promise(r => setTimeout(r, DELAY_BETWEEN_RUNS));
    }

    // 3. Relatório
    const stats = getStats(times);
    const min = Math.min(...times);
    const max = Math.max(...times);

    console.log(`\n=== RELATÓRIO: ${MODE} Distribuído ===`);
    console.log(`Data: ${new Date().toISOString()}`);
    console.log(`-----------------------------------`);
    console.log(`Média:         ${stats.mean.toFixed(4)} ms`);
    console.log(`Desvio Padrão: ±${stats.stdDev.toFixed(4)} ms`);
    console.log(`Mínimo:        ${min.toFixed(4)} ms`);
    console.log(`Máximo:        ${max.toFixed(4)} ms`);
    console.log(`-----------------------------------`);
}

startBenchmark();