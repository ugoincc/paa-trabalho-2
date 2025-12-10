// src/parallelEdge.js
const fs = require("fs");
const path = require("path");
const os = require("os");
const { PNG } = require("pngjs");
const { performance } = require("perf_hooks");
const { Worker } = require("worker_threads");

// Importa as métricas
const {
  calculateSpeedup,
  calculateEfficiency,
  calculateOverhead,
} = require("./functions/metrics");

// ================= CONFIGURAÇÕES =================

const EDGE_DETECTION_KERNEL = [
  [-1, -1, -1],
  [-1, 8, -1],
  [-1, -1, -1],
];
const KERNEL_DIVISOR = 1;

// Ajuste os caminhos conforme sua estrutura de pastas
const INPUT_FILE = path.join(__dirname, "imgs/inputs/italy.png");
const OUTPUT_FILE = path.join(__dirname, "imgs/outputs/saidaEdgeParalela.png");
const WORKER_PATH = path.join(__dirname, "workers", "ConvolutionWorker.js");

const NUM_WORKERS = os.cpus().length;

// Valor fixo apenas para quando rodar manualmente. O Runner ignora isso.
const TEMPO_SEQUENCIAL_MANUAL = 1000;

/**
 * Função principal encapsulada para retornar uma Promise.
 * @param {number} sequentialTime - Tempo sequencial para comparação (opcional)
 * @param {boolean} silent - Se true, esconde logs para não poluir o terminal durante experimentos
 */
function runParallelEdge(sequentialTime = 0, silent = false) {
  return new Promise((resolve, reject) => {
    // Se não existir o arquivo, rejeita (evita travar)
    if (!fs.existsSync(INPUT_FILE)) {
      return reject(`Arquivo não encontrado: ${INPUT_FILE}`);
    }

    fs.createReadStream(INPUT_FILE)
      .pipe(new PNG())
      .on("parsed", function () {
        const width = this.width;
        const height = this.height;

        if (!silent) {
          console.log(`\n[Paralelo] Imagem carregada: ${width}x${height}`);
          console.log(`[Paralelo] Usando ${NUM_WORKERS} workers.`);
        }

        const outputBuffer = Buffer.alloc(this.data.length);
        this.data.copy(outputBuffer);

        const start = performance.now();

        const linesPerWorker = Math.ceil(height / NUM_WORKERS);
        let finishedWorkers = 0;

        for (let i = 0; i < NUM_WORKERS; i++) {
          const startY = i * linesPerWorker;
          let endY = startY + linesPerWorker;
          if (endY > height) endY = height;

          if (startY >= height) {
            finishedWorkers++;
            if (finishedWorkers === NUM_WORKERS) resolve(0); // Caso borda
            continue;
          }

          const worker = new Worker(WORKER_PATH, {
            workerData: {
              src: this.data,
              width,
              height,
              kernel: EDGE_DETECTION_KERNEL,
              kernelDivisor: KERNEL_DIVISOR,
              startY,
              endY,
            },
          });

          worker.on("message", ({ startY, endY, chunk }) => {
            const lines = endY - startY;
            const bytesPerLine = width * 4;
            const chunkBuf = Buffer.from(chunk);
            const dstOffset = startY * bytesPerLine;
            chunkBuf.copy(outputBuffer, dstOffset);

            finishedWorkers++;

            if (finishedWorkers === NUM_WORKERS) {
              const end = performance.now();
              const duration = end - start;

              // Só mostra logs detalhados se NÃO for silencioso
              if (!silent) {
                console.log(`Tempo Paralelo: ${duration.toFixed(4)} ms`);

                if (sequentialTime > 0) {
                  const speedup = calculateSpeedup(sequentialTime, duration);
                  const efficiency = calculateEfficiency(speedup, NUM_WORKERS);
                  const overhead = calculateOverhead(
                    sequentialTime,
                    duration,
                    NUM_WORKERS
                  );

                  console.log(`--- REPORT ---`);
                  console.log(`Speedup:    ${speedup.toFixed(2)}x`);
                  console.log(`Eficiência: ${(efficiency * 100).toFixed(2)}%`);
                  console.log(`Overhead:   ${overhead.toFixed(2)} ms`);
                }
                console.log(`Imagem salva em: ${OUTPUT_FILE}`);
              }

              // Salva a imagem
              this.data = outputBuffer;
              this.pack().pipe(fs.createWriteStream(OUTPUT_FILE));

              // AQUI ESTÁ A CORREÇÃO: Resolve a promise com o tempo!
              resolve(duration);
            }
          });

          worker.on("error", (err) => reject(err));
        }
      });
  });
}

// 1. Execução direta (node src/parallelBlur.js)
if (require.main === module) {
  runParallelEdge(TEMPO_SEQUENCIAL_MANUAL, false).catch((err) =>
    console.error(err)
  );
}

module.exports = { runParallelEdge };
