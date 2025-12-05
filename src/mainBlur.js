const fs = require("fs");
const { PNG } = require("pngjs");
const { performance } = require("perf_hooks");
const { generateGaussianKernel } = require("./functions/generateGaussKernel");

// ================= CONFIGURAÇÕES E KERNELS =================
// Gere um kernel maior. Tente tamanhos como 15, 21 ou 31 para ver um blur forte.
const kernelSize = 15;
const sigma = 5; // Sigma controla a suavidade da curva
const BIG_BLUR_KERNEL = generateGaussianKernel(kernelSize, sigma);

// ================= FUNÇÕES DE PROCESSAMENTO =================

/**
 * Aplica uma convolução sequencialmente em uma imagem.
 * @param {Uint8Array} src - Buffer da imagem original
 * @param {Uint8Array} dst - Buffer da imagem de destino
 * @param {number} width - Largura da imagem
 * @param {number} height - Altura da imagem
 * @param {Array} kernel - Matriz do filtro
 * @param {number} kernelDivisor - Divisor para normalização (1 se não houver)
 */
function applyConvolution(src, dst, width, height, kernel, kernelDivisor = 1) {
  const kSize = kernel.length;
  const kOffset = Math.floor(kSize / 2);

  // Percorre cada pixel da imagem (LINHAS)
  for (let y = 0; y < height; y++) {
    // Percorre cada pixel da imagem (COLUNAS)
    for (let x = 0; x < width; x++) {
      let r = 0,
        g = 0,
        b = 0;

      // Percorre a vizinhança do pixel (O KERNEL)
      for (let ky = 0; ky < kSize; ky++) {
        for (let kx = 0; kx < kSize; kx++) {
          const scy = y + ky - kOffset;
          const scx = x + kx - kOffset;

          if (scy >= 0 && scy < height && scx >= 0 && scx < width) {
            const srcIdx = (scy * width + scx) * 4;
            const weight = kernel[ky][kx];

            r += src[srcIdx] * weight;
            g += src[srcIdx + 1] * weight;
            b += src[srcIdx + 2] * weight;
          }
        }
      }

      const dstIdx = (y * width + x) * 4;
      // Escreve o novo pixel processado
      dst[dstIdx] = r / kernelDivisor;
      dst[dstIdx + 1] = g / kernelDivisor;
      dst[dstIdx + 2] = b / kernelDivisor;
      dst[dstIdx + 3] = src[dstIdx + 3]; // Mantém o Alpha original
    }
  }
}

// ================= EXECUÇÃO PRINCIPAL =================

const INPUT_FILE = "../assets/imgs/italy.png"; // Coloque uma imagem PNG aqui
const OUTPUT_FILE = "../outputs/output_desfoque.png";

fs.createReadStream(INPUT_FILE)
  .pipe(new PNG())
  .on("parsed", function () {
    console.log(`\nImagem carregada: ${INPUT_FILE}.`);
    console.log(`Dimensões: ${this.width}x${this.height} pixels.`);

    // Criar buffer para a nova imagem (evita leitura suja)
    const outputBuffer = Buffer.alloc(this.data.length);
    this.data.copy(outputBuffer); // Copia dados iniciais (alpha, etc)

    console.log("Iniciando processamento...");

    // --- INÍCIO DA MEDIÇÃO [cite: 8, 10] ---
    const start = performance.now();

    // 1. Aplicar Desfoque (Pode comentar/descomentar para testar)
    applyConvolution(
      this.data,
      outputBuffer,
      this.width,
      this.height,
      BIG_BLUR_KERNEL,
      1
    );

    const end = performance.now();
    // --- FIM DA MEDIÇÃO ---

    const duration = (end - start).toFixed(4);

    console.log(`--------------------------------------------------`);
    console.log(`Processamento Concluído.`);
    console.log(`Operação: Blur (Desfoque)`);
    console.log(`Modo: SEQUENCIAL`);
    console.log(`Tempo de Execução: ${duration} ms`);
    console.log(`--------------------------------------------------`);

    console.log(`Imagem resultante em: ${OUTPUT_FILE}\n`);

    // Salvar resultado
    this.data = outputBuffer;
    this.pack().pipe(fs.createWriteStream(OUTPUT_FILE));
  });
