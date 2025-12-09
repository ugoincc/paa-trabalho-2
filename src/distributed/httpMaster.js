// src/distributed/httpMaster.js
const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");
const axios = require("axios");
const { performance } = require("perf_hooks");
const { generateGaussianKernel } = require("../functions/generateGaussKernel");

// =================================================================
// 🎛️ ÁREA DE CONFIGURAÇÃO (Mude aqui!)
// =================================================================

// Escolha o modo: 'BLUR' ou 'EDGE'
const MODE = 'EDGE'; 

// Arquivo de entrada (Pode ser o copo.png ou outro)
const INPUT_FILENAME = "copo.png"; 

// =================================================================

// Definição dos Kernels
let KERNEL;
let OUTPUT_SUFFIX;

if (MODE === 'BLUR') {
    console.log("--> Modo Selecionado: BLUR (Desfoque Gaussiano)");
    // Configuração do Blur (15x15, Sigma 5)
    KERNEL = generateGaussianKernel(15, 5);
    OUTPUT_SUFFIX = "Blur";
} 
else if (MODE === 'EDGE') {
    console.log("--> Modo Selecionado: EDGE (Detecção de Bordas)");
    // Configuração de Borda (Laplaciano)
    KERNEL = [
        [-1, -1, -1],
        [-1,  8, -1],
        [-1, -1, -1]
    ];
    OUTPUT_SUFFIX = "Edge";
} 
else {
    console.error("Modo inválido! Use 'BLUR' ou 'EDGE'.");
    process.exit(1);
}

// Caminhos Automáticos
const INPUT_FILE = path.join(__dirname, `../imgs/inputs/${INPUT_FILENAME}`);
const OUTPUT_FILE = path.join(__dirname, `../imgs/outputs/saidaDistribuida_${OUTPUT_SUFFIX}.png`);

// Lista de Workers (Docker)
const WORKERS = [
  "http://worker1:3000/processar",
  "http://worker2:3000/processar",
  "http://worker3:3000/processar"
];

/**
 * 🛡️ Função de Resiliência: Envia tarefa com tentativas (Retry) e Failover.
 * Se o worker preferencial falhar, tenta o próximo da lista.
 */
async function sendTaskWithRetry(payload, preferredWorkerIndex, totalRetries = 3) {
    let attempts = 0;
    let currentWorkerIndex = preferredWorkerIndex;

    while (attempts < totalRetries) {
        const workerUrl = WORKERS[currentWorkerIndex];
        
        try {
            // console.log(`Tentativa ${attempts + 1}: Enviando para ${workerUrl}...`);
            // Timeout de 5s para não ficar esperando eternamente um worker morto
            const response = await axios.post(workerUrl, payload, { timeout: 5000 }); 
            
            if (!response.data.image) throw new Error("Worker retornou dados vazios");
            
            return response.data.image; // SUCESSO!

        } catch (err) {
            console.error(`⚠️  Falha no ${workerUrl}: ${err.code || err.message}`);
            attempts++;
            
            // Lógica de Failover (Round Robin): Pega o próximo worker da lista
            currentWorkerIndex = (currentWorkerIndex + 1) % WORKERS.length;
            
            if (attempts < totalRetries) {
                console.log(`♻️  Redirecionando tarefa para o próximo: ${WORKERS[currentWorkerIndex]}...`);
            }
        }
    }
    
    throw new Error(`FALHA TOTAL: Não foi possível processar esta fatia após ${totalRetries} tentativas.`);
}

async function runDistributed() {
    console.log("--> Aguardando workers iniciarem (5s)...");
    await new Promise(r => setTimeout(r, 5000));

    if (!fs.existsSync(INPUT_FILE)) {
        console.error(`ERRO: Arquivo não encontrado: ${INPUT_FILE}`);
        return;
    }

    const data = fs.readFileSync(INPUT_FILE);
    const png = PNG.sync.read(data);
    const { width, height } = png;

    console.log(`\n[Mestre] Processando: ${INPUT_FILENAME} (${width}x${height})`);
    console.log(`[Config] Workers: ${WORKERS.length} | Modo: ${MODE}`);

    // Buffer de saída (Cópia do original para manter Alpha/Transparência)
    const outputBuffer = Buffer.alloc(png.data.length);
    png.data.copy(outputBuffer);

    // Se for EDGE, pinta o fundo de preto para destacar as bordas brancas
    if (MODE === 'EDGE') outputBuffer.fill(0);

    const start = performance.now();

    const linesPerWorker = Math.ceil(height / WORKERS.length);
    const promises = [];

    for (let i = 0; i < WORKERS.length; i++) {
        const startY = i * linesPerWorker;
        let endY = startY + linesPerWorker;
        if (endY > height) endY = height;
        if (startY >= height) continue;

        const sliceHeight = endY - startY;
        const startOffset = startY * width * 4;
        const endOffset = endY * width * 4;

        // Fatia
        const sliceBuffer = Buffer.alloc(endOffset - startOffset);
        // Copia dados da imagem original para a fatia
        png.data.copy(sliceBuffer, 0, startOffset, endOffset);

        const payload = {
            image: sliceBuffer.toString("base64"),
            width: width,
            height: sliceHeight,
            kernel: KERNEL,
            kernelDivisor: 1
        };

        console.log(`Enviando fatia ${i+1} (inicialmente para Worker ${i+1})...`);

        // AQUI USAMOS A NOVA FUNÇÃO COM RETRY
        const p = sendTaskWithRetry(payload, i)
            .then(base64Result => {
                const chunk = Buffer.from(base64Result, "base64");
                // Escreve o resultado no buffer final
                chunk.copy(outputBuffer, startOffset); 
                console.log(`✅ Fatia ${i+1} concluída!`);
            })
            .catch(err => {
                console.error(`❌ ERRO CRÍTICO NA FATIA ${i+1}: Imagem final ficará incompleta.`);
            });

        promises.push(p);
    }

    await Promise.all(promises);
    const end = performance.now();

    console.log(`\n>>> Tempo Total: ${(end - start).toFixed(4)} ms <<<`);
    
    const newPng = new PNG({ width, height });
    newPng.data = outputBuffer;
    fs.writeFileSync(OUTPUT_FILE, PNG.sync.write(newPng));
    console.log(`Salvo em: ${OUTPUT_FILE}`);
}

runDistributed();