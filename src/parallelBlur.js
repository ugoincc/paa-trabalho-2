// src/parallelBlur.js
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

const { generateGaussianKernel } = require("./functions/generateGaussKernel");

// ================= CONFIGURAÇÕES =================

// Configurações do Blur
const kernelSize = 15;
const sigma = 5;
const GAUSS_KERNEL = generateGaussianKernel(kernelSize, sigma);
const KERNEL_DIVISOR = 1;

// Caminhos dos arquivos
const INPUT_FILE = path.join(__dirname, "imgs/inputs/italy.png");
const OUTPUT_FILE = path.join(__dirname, "imgs/outputs/saidaParalela.png");
const WORKER_PATH = path.join(__dirname, "workers", "ConvolutionWorker.js");

// Número de workers
const NUM_WORKERS = os.cpus().length;

// Valor fixo apenas para teste manual (o runner ignora isso)
const TEMPO_SEQUENCIAL_MANUAL = 1000;

/**
 * Função principal encapsulada para retornar uma Promise.
 * @param {number} sequentialTime - Tempo sequencial para comparação (opcional)
 * @param {boolean} silent - Se true, esconde logs (para o runner)
 */
function runParallelBlur(sequentialTime = 0, silent = false) {
  return new Promise((resolve, reject) => {
    // Verificação básica
    if (!fs.existsSync(INPUT_FILE)) {
      return reject(`Arquivo de entrada não encontrado: ${INPUT_FILE}`);
    }

    fs.createReadStream(INPUT_FILE)
      .pipe(new PNG())
      .on("parsed", function () {
        const width = this.width;
        const height = this.height;

        if (!silent) {
          console.log(`\n[Paralelo] Imagem carregada: ${width}x${height}`);
          console.log(`[Paralelo] Usando ${NUM_WORKERS} workers.`);
          console.log(
            `[Config] Blur Kernel: ${kernelSize}x${kernelSize}, Sigma: ${sigma}`
          );
        }

        const outputBuffer = Buffer.alloc(this.data.length);
        this.data.copy(outputBuffer);

        const start = performance.now();

        // Divisão de tarefas
        const linesPerWorker = Math.ceil(height / NUM_WORKERS);
        let finishedWorkers = 0;

        for (let i = 0; i < NUM_WORKERS; i++) {
          const startY = i * linesPerWorker;
          let endY = startY + linesPerWorker;
          if (endY > height) endY = height;

          if (startY >= height) {
            finishedWorkers++;
            if (finishedWorkers === NUM_WORKERS) resolve(0);
            continue;
          }

          const worker = new Worker(WORKER_PATH, {
            workerData: {
              src: this.data,
              width,
              height,
              kernel: GAUSS_KERNEL,
              kernelDivisor: KERNEL_DIVISOR,
              startY,
              endY,
            },
          });

          worker.on("message", ({ startY, endY, chunk }) => {
            // Copia o chunk recebido para o buffer final
            const lines = endY - startY;
            const bytesPerLine = width * 4;
            const chunkBuf = Buffer.from(chunk);
            const dstOffset = startY * bytesPerLine;

            chunkBuf.copy(outputBuffer, dstOffset);

            finishedWorkers++;

            if (finishedWorkers === NUM_WORKERS) {
              const end = performance.now();
              const duration = end - start;

              // Logs apenas se não for silencioso
              if (!silent) {
                console.log(
                  `--------------------------------------------------`
                );
                console.log(`Processamento Concluído (Blur Paralelo).`);
                console.log(`Tempo de Execução: ${duration.toFixed(4)} ms`);

                if (sequentialTime > 0) {
                  const speedup = calculateSpeedup(sequentialTime, duration);
                  const efficiency = calculateEfficiency(speedup, NUM_WORKERS);
                  const overhead = calculateOverhead(
                    sequentialTime,
                    duration,
                    NUM_WORKERS
                  );

                  console.log(`--- RELATÓRIO DE PERFORMANCE ---`);
                  console.log(`Speedup:    ${speedup.toFixed(2)}x`);
                  console.log(`Eficiência: ${(efficiency * 100).toFixed(2)}%`);
                  console.log(`Overhead:   ${overhead.toFixed(2)} ms`);
                }
                console.log(
                  `--------------------------------------------------`
                );
                console.log(`Imagem salva em: ${OUTPUT_FILE}\n`);
              }

              // Salvar imagem
              this.data = outputBuffer;
              this.pack().pipe(fs.createWriteStream(OUTPUT_FILE));

              // RESOLVE A PROMISE COM O TEMPO!
              resolve(duration);
            }
          });

          worker.on("error", (err) => reject(err));
          worker.on("exit", (code) => {
            if (code !== 0)
              reject(new Error(`Worker ${i} parou com código ${code}`));
          });
        }
      });
  });
}

// 1. Execução direta (node src/parallelBlur.js)
if (require.main === module) {
  runParallelBlur(TEMPO_SEQUENCIAL_MANUAL, false).catch((err) =>
    console.error(err)
  );
}

module.exports = { runParallelBlur };
