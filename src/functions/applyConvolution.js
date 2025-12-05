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

module.exports = {
  applyConvolution,
};
