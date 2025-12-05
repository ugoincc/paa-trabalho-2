const fs = require("fs");
const { PNG } = require("pngjs");
const { performance } = require("perf_hooks");
const { generateGaussianKernel } = require("./functions/generateGaussKernel");
const { applyConvolution } = require("./functions/applyConvolution");

// ================= CONFIGURAÇÕES E KERNELS =================
// Gere um kernel maior. Tente tamanhos como 15, 21 ou 31 para ver um blur forte.
const kernelSize = 15;
const sigma = 5; // Sigma controla a suavidade da curva
const BIG_BLUR_KERNEL = generateGaussianKernel(kernelSize, sigma);

//Arquivos de entrada e destino
const INPUT_FILE = "../assets/imgs/italy.png"; // Coloque uma imagem PNG aqui
const OUTPUT_FILE = "../outputs/output_desfoque.png"; //Diretório de Saída

fs.createReadStream(INPUT_FILE)
  .pipe(new PNG())
  .on("parsed", function () {
    console.log(`\nImagem carregada: ${INPUT_FILE}.`);
    console.log(`Dimensões: ${this.width}x${this.height} pixels.`);

    // Criar buffer para a nova imagem (evita leitura suja)
    const outputBuffer = Buffer.alloc(this.data.length);
    this.data.copy(outputBuffer); // Copia dados iniciais (alpha, etc)

    console.log("Iniciando processamento...");

    // --- INÍCIO DA MEDIÇÃO ---
    const start = performance.now();

    // 1. Aplicar Desfoque
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
