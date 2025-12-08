// workers/convolutionWorker.js
const { parentPort, workerData } = require("worker_threads");

/**
 * Função de convolução apenas em um intervalo de linhas [startY, endY)
 * Usa a imagem completa como entrada (src), mas só escreve as linhas do intervalo.
 */
function applyConvolutionRange(src, width, height, kernel, kernelDivisor, startY, endY) {
  const kSize = kernel.length;
  const kOffset = Math.floor(kSize / 2);

  // Número de linhas que esse worker vai processar
  const lines = endY - startY;

  // Buffer de saída só para o pedaço (chunk) deste worker
  const dstChunk = Buffer.alloc(lines * width * 4);

  for (let y = startY; y < endY; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0,
        g = 0,
        b = 0;

      // Percorre a vizinhança (kernel)
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

      // Índice dentro do chunk (repare no (y - startY))
      const localY = y - startY;
      const dstIdx = (localY * width + x) * 4;

      dstChunk[dstIdx] = r / kernelDivisor;
      dstChunk[dstIdx + 1] = g / kernelDivisor;
      dstChunk[dstIdx + 2] = b / kernelDivisor;

      // Alpha: copia direto da imagem original
      const srcAlphaIdx = (y * width + x) * 4 + 3;
      dstChunk[dstIdx + 3] = src[srcAlphaIdx];
    }
  }

  return dstChunk;
}

// --- Execução do worker ---
const {
  src,
  width,
  height,
  kernel,
  kernelDivisor,
  startY,
  endY,
} = workerData;

// src chega como Buffer
const resultChunk = applyConvolutionRange(
  src,
  width,
  height,
  kernel,
  kernelDivisor,
  startY,
  endY
);

// Envia de volta o pedaço processado + info de onde encaixar
parentPort.postMessage({
  startY,
  endY,
  chunk: resultChunk,
});
