// parallelBlur.js
const fs = require("fs");
const path = require("path");
const os = require("os");
const { PNG } = require("pngjs");
const { performance } = require("perf_hooks");
const { Worker } = require("worker_threads");

const { generateGaussianKernel } = require("./functions/generateGaussKernel");

// ================= CONFIGURAÇÕES =================

// Tamanho do kernel e sigma do Gaussiano (igual ao seu sequencial ou maior)
const kernelSize = 15;
const sigma = 5;
const GAUSS_KERNEL = generateGaussianKernel(kernelSize, sigma);
const KERNEL_DIVISOR = 1; // já está normalizado dentro da função

// Defina a imagem de entrada e saída
const INPUT_FILE = "teste.png";
const OUTPUT_FILE = "imgs/saidaParalela.png";

// Número de workers (pode usar todos os núcleos ou fixar, ex: 4)
const NUM_WORKERS = os.cpus().length; // ou um valor fixo, tipo 4

function run() {
  fs.createReadStream(INPUT_FILE)
    .pipe(new PNG())
    .on("parsed", function () {
      const width = this.width;
      const height = this.height;

      console.log(`\nImagem carregada: ${INPUT_FILE}.`);
      console.log(`Dimensões: ${width}x${height} pixels.`);
      console.log(`Usando ${NUM_WORKERS} workers para processamento paralelo.`);

      // Buffer de saída final (para a imagem inteira)
      const outputBuffer = Buffer.alloc(this.data.length);

      // Guardamos o alpha inicialmente (opcional, mas ajuda)
      this.data.copy(outputBuffer);

      // Medição de tempo
      const start = performance.now();

      // Quebrar a imagem em faixas de linhas
      const linesPerWorker = Math.ceil(height / NUM_WORKERS);

      let finishedWorkers = 0;

      for (let i = 0; i < NUM_WORKERS; i++) {
        const startY = i * linesPerWorker;
        let endY = startY + linesPerWorker;
        if (endY > height) endY = height;

        if (startY >= height) {
          // Não cria worker se a imagem for menor que o número de workers
          finishedWorkers++;
          continue;
        }

        const worker = new Worker(
          path.resolve(__dirname, "workers", "convolutionWorker.js"),
          {
            workerData: {
              src: this.data, // Buffer com a imagem original
              width,
              height,
              kernel: GAUSS_KERNEL,
              kernelDivisor: KERNEL_DIVISOR,
              startY,
              endY,
            },
          }
        );

        worker.on("message", ({ startY, endY, chunk }) => {
          // Copiar o chunk (faixa de linhas) para o outputBuffer final
          const lines = endY - startY;
          const bytesPerLine = width * 4;

          for (let y = 0; y < lines; y++) {
            const srcOffset = y * bytesPerLine;
            const dstOffset = ( (startY + y) * width ) * 4;
            const chunkBuf = Buffer.from(chunk);
            chunkBuf.copy(outputBuffer, dstOffset, srcOffset, srcOffset + bytesPerLine);
          }

          finishedWorkers++;

          if (finishedWorkers === NUM_WORKERS) {
            const end = performance.now();
            const duration = (end - start).toFixed(4);

            console.log(`--------------------------------------------------`);
            console.log(`Processamento Concluído.`);
            console.log(`Operação: Blur (Desfoque)`);
            console.log(`Modo: PARALELO (Worker Threads)`);
            console.log(`Workers: ${NUM_WORKERS}`);
            console.log(`Tempo de Execução: ${duration} ms`);
            console.log(`--------------------------------------------------`);
            console.log(`Imagem resultante em: ${OUTPUT_FILE}\n`);

            // Salvar imagem
            this.data = outputBuffer;
            this.pack().pipe(fs.createWriteStream(OUTPUT_FILE));
          }
        });

        worker.on("error", (err) => {
          console.error(`Erro no worker ${i}:`, err);
        });

        worker.on("exit", (code) => {
          if (code !== 0) {
            console.error(`Worker ${i} saiu com código ${code}`);
          }
        });
      }
    });
}

run();
