// src/distributed/httpMaster.js
const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");
const axios = require("axios");
const { performance } = require("perf_hooks");
const { generateGaussianKernel } = require("../functions/generateGaussKernel");

// =================================================================
// 🎛️ ÁREA DE CONFIGURAÇÃO
// =================================================================
const MODE = 'EDGE'; 
const INPUT_FILENAME = "copo.png"; 
// =================================================================

// Configuração dos Kernels e Sufixos
let KERNEL, OUTPUT_SUFFIX;
if (MODE === 'BLUR') {
    KERNEL = generateGaussianKernel(15, 5);
    OUTPUT_SUFFIX = "Blur";
} else if (MODE === 'EDGE') {
    KERNEL = [[-1, -1, -1], [-1,  8, -1], [-1, -1, -1]];
    OUTPUT_SUFFIX = "Edge";
} else { process.exit(1); }

const INPUT_FILE = path.join(__dirname, `../imgs/inputs/${INPUT_FILENAME}`);
const OUTPUT_FILE = path.join(__dirname, `../imgs/outputs/saidaDistribuida_${OUTPUT_SUFFIX}.png`);

const WORKERS = [
  "http://worker1:3000/processar",
  "http://worker2:3000/processar",
  "http://worker3:3000/processar"
];

/**
 * Envia tarefa com Retry e retorna DADOS COMPLETOS (imagem + métricas)
 */
async function sendTaskWithRetry(payload, preferredWorkerIndex, totalRetries = 3) {
    let attempts = 0;
    let currentWorkerIndex = preferredWorkerIndex;

    while (attempts < totalRetries) {
        const workerUrl = WORKERS[currentWorkerIndex];
        try {
            // Medimos apenas a viagem HTTP (Ida + Processamento Remoto + Volta)
            const reqStart = performance.now();
            const response = await axios.post(workerUrl, payload, { timeout: 10000 }); 
            const reqEnd = performance.now();
            
            if (!response.data.image) throw new Error("Dados vazios");
            
            return {
                data: response.data,
                roundTripTime: reqEnd - reqStart, 
                workerUrl: workerUrl
            };

        } catch (err) {
            console.error(`⚠️  Falha no ${workerUrl}: ${err.code || err.message}`);
            attempts++;
            currentWorkerIndex = (currentWorkerIndex + 1) % WORKERS.length;
            if (attempts < totalRetries) console.log(`♻️  Redirecionando...`);
        }
    }
    throw new Error(`FALHA TOTAL após ${totalRetries} tentativas.`);
}

async function runDistributed() {
    console.log("--> Aguardando workers (5s)...");
    await new Promise(r => setTimeout(r, 5000));

    if (!fs.existsSync(INPUT_FILE)) return console.error("Arquivo não encontrado");

    const data = fs.readFileSync(INPUT_FILE);
    const png = PNG.sync.read(data);
    const { width, height } = png;
    const outputBuffer = Buffer.alloc(png.data.length);
    png.data.copy(outputBuffer);
    if (MODE === 'EDGE') outputBuffer.fill(0);

    console.log(`\n[Mestre] Processando ${INPUT_FILENAME} (${width}x${height})`);
    
    const startTotal = performance.now();

    const linesPerWorker = Math.ceil(height / WORKERS.length);
    const promises = [];

    for (let i = 0; i < WORKERS.length; i++) {
        const startY = i * linesPerWorker;
        let endY = startY + linesPerWorker;
        if (endY > height) endY = height;
        if (startY >= height) continue;

        // --- MEDIÇÃO: PREPARAÇÃO DO MESTRE ---
        // Quanto tempo o Mestre gasta cortando e serializando para Base64?
        const tPrepStart = performance.now();

        const sliceBuffer = Buffer.alloc((endY - startY) * width * 4);
        png.data.copy(sliceBuffer, 0, (startY * width * 4), (endY * width * 4));
        const base64Slice = sliceBuffer.toString("base64"); // Operação pesada!

        const tPrepEnd = performance.now();
        const masterPrepTime = tPrepEnd - tPrepStart;
        // -------------------------------------

        const payload = {
            image: base64Slice,
            width: width,
            height: endY - startY,
            kernel: KERNEL
        };

        const p = sendTaskWithRetry(payload, i)
            .then(({ data, roundTripTime, workerUrl }) => {
                
                // --- MEDIÇÃO: FINALIZAÇÃO DO MESTRE ---
                // Quanto tempo o Mestre gasta decodificando e colando na imagem?
                const tPostStart = performance.now();
                
                const chunk = Buffer.from(data.image, "base64"); // Operação pesada!
                chunk.copy(outputBuffer, (startY * width * 4));
                
                const tPostEnd = performance.now();
                const masterPostTime = tPostEnd - tPostStart;
                // --------------------------------------

                // Cálculos Finais
                const workerCpuTime = data.metrics.processTime; 
                const masterCpuTime = masterPrepTime + masterPostTime;
                
                // Overhead de Rede Pura = Tempo da Viagem - Tempo que o Worker trabalhou
                // Nota: Isso inclui latência de rede + tempo do JSON.stringify interno do axios
                const networkOverhead = roundTripTime - workerCpuTime;

                console.log(`\n✅ Fatia ${i+1} (${workerUrl}):`);
                console.log(`   - [Mestre] CPU (Prep+Montagem): ${masterCpuTime.toFixed(2)} ms`);
                console.log(`   - [Rede] Latência/Transferência: ${networkOverhead.toFixed(2)} ms`);
                console.log(`   - [Worker] CPU (Processamento):  ${workerCpuTime.toFixed(2)} ms`);
                console.log(`   -------------------------------------------`);
                console.log(`   > Tempo Total da Fatia: ${(masterCpuTime + roundTripTime).toFixed(2)} ms`);
            })
            .catch(console.error);

        promises.push(p);
    }

    await Promise.all(promises);
    const endTotal = performance.now();

    console.log(`\n==================================================`);
    console.log(`>>> Tempo Total do Sistema: ${(endTotal - startTotal).toFixed(4)} ms <<<`);
    console.log(`==================================================`);
    
    fs.writeFileSync(OUTPUT_FILE, PNG.sync.write({ width, height, data: outputBuffer }));
    console.log(`Salvo em: ${OUTPUT_FILE}`);
}

runDistributed();