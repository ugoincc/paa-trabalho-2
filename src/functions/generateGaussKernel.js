/**
 * Gera um Kernel Gaussiano dinâmico.
 * @param {number} size - Tamanho da matriz (deve ser ímpar, ex: 9, 15, 21).
 * @param {number} sigma - Desvio padrão (controla o espalhamento, tente size/3).
 */
function generateGaussianKernel(size, sigma) {
  const kernel = [];
  const center = Math.floor(size / 2);
  let sum = 0;

  for (let y = 0; y < size; y++) {
    const row = [];
    for (let x = 0; x < size; x++) {
      const dx = x - center;
      const dy = y - center;
      // Fórmula da Função Gaussiana
      const value =
        (1 / (2 * Math.PI * sigma * sigma)) *
        Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
      row.push(value);
      sum += value;
    }
    kernel.push(row);
  }

  // Normaliza o kernel para que a soma seja ~1 (evita imagem escura ou estourada)
  // No seu código anterior, o 'divisor' agora será 1, pois já vamos dividir aqui.
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      kernel[y][x] /= sum;
    }
  }

  return kernel;
}

module.exports = {
  generateGaussianKernel,
};
