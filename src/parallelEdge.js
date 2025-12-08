// src/parallelEdge.js
const fs = require("fs");
const path = require("path");
const os = require("os");
const { PNG } = require("pngjs");
const { performance } = require("perf_hooks");
const { Worker } = require("worker_threads");

const {
  calculateSpeedup,
  calculateEfficiency,
  calculateOverhead,
  report,
} = require("./functions/metrics");

// ================= CONFIGURAÇÕES =================

// Kernel de Detecção de Bordas (Filtro Laplaciano)
const EDGE_DETECTION_KERNEL = [
  [-1, -1, -1],
  [-1, 8, -1],
  [-1, -1, -1],
];
const KERNEL_DIVISOR = 1;

// --- IMPORTANTE: Coloque aqui o tempo (ms) que você anotou da versão Sequencial ---
const TEMPO_SEQUENCIAL_MEDIDO = 1000; // Exemplo: troque por 4500.50 ou o valor real

// Arquivos
const INPUT_FILE = "imgs/inputs/teste.png";
const OUTPUT_FILE = "imgs/outputs/saidaEdgeParalela.png";

// Número de Workers
const NUM_WORKERS = os.cpus().length;

function run() {
  fs.createReadStream(INPUT_FILE)
    .pipe(new PNG())
    .on("parsed", function () {
      const width = this.width;
      const height = this.height;

      console.log(`\nImagem carregada: ${INPUT_FILE}.`);
      console.log(`Dimensões: ${width}x${height} pixels.`);
      console.log(`Usando ${NUM_WORKERS} workers para Edge Detection.`);

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
          continue;
        }

        // Reutiliza o mesmo Worker de convolução (a lógica é a mesma)
        const worker = new Worker(
          path.resolve(__dirname, "workers", "ConvolutionWorker.js"),
          {
            workerData: {
              src: this.data,
              width,
              height,
              kernel: EDGE_DETECTION_KERNEL,
              kernelDivisor: KERNEL_DIVISOR,
              startY,
              endY,
            },
          }
        );

        worker.on("message", ({ startY, endY, chunk }) => {
          const lines = endY - startY;
          const bytesPerLine = width * 4;

          // Copia o pedaço processado para o buffer final
          const chunkBuf = Buffer.from(chunk);
          const dstOffset = startY * bytesPerLine;
          chunkBuf.copy(outputBuffer, dstOffset);

          finishedWorkers++;

          if (finishedWorkers === NUM_WORKERS) {
            const end = performance.now();
            const duration = end - start; // Tempo Paralelo

            console.log(`--------------------------------------------------`);
            console.log(`Processamento Concluído (Paralelo).`);
            console.log(`Tempo Paralelo: ${duration.toFixed(4)} ms`);

            // Cálculo das métricas para o relatório
            if (TEMPO_SEQUENCIAL_MEDIDO > 0) {
              report(TEMPO_SEQUENCIAL_MEDIDO, duration, NUM_WORKERS);
            }

            console.log(`--------------------------------------------------`);
            console.log(`Imagem salva em: ${OUTPUT_FILE}\n`);

            this.data = outputBuffer;
            this.pack().pipe(fs.createWriteStream(OUTPUT_FILE));
          }
        });
      }
    });
}

run();
