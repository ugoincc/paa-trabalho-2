const fs = require("fs");
const { PNG } = require("pngjs");
const { performance } = require("perf_hooks");
const { applyConvolution } = require("./functions/applyConvolution");

// Kernel de Detecção de Bordas (Filtro simples tipo Laplaciano ou High-pass)
const EDGE_DETECTION_KERNEL = [
  [-1, -1, -1],
  [-1, 8, -1],
  [-1, -1, -1],
];

// Arquivos de entrada e destino
const INPUT_FILE = "teste.png";
const OUTPUT_FILE = "imgs/saida.png";

// Leitura síncrona da imagem
const data = fs.readFileSync(INPUT_FILE);
const png = PNG.sync.read(data);

console.log(`\nImagem carregada: ${INPUT_FILE}.`);
console.log(`Dimensões: ${png.width}x${png.height} pixels.`);

// Criar buffer para a nova imagem
const outputBuffer = Buffer.alloc(png.data.length);
png.data.copy(outputBuffer);

console.log("Iniciando processamento...");

// --- INÍCIO DA MEDIÇÃO ---
const start = performance.now();

// Aplicar Detecção de Bordas
applyConvolution(
  png.data,
  outputBuffer,
  png.width,
  png.height,
  EDGE_DETECTION_KERNEL,
  1
);

const end = performance.now();
// --- FIM DA MEDIÇÃO ---

const duration = (end - start).toFixed(4);

console.log(`--------------------------------------------------`);
console.log(`Processamento Concluído.`);
console.log(`Operação: Detecção de Bordas (Passa Alta)`);
console.log(`Modo: SEQUENCIAL`);
console.log(`Tempo de Execução: ${duration} ms`);
console.log(`--------------------------------------------------`);

console.log(`Imagem resultante em: ${OUTPUT_FILE}\n`);

// Salvar resultado
png.data = outputBuffer;
const buffer = PNG.sync.write(png);
fs.writeFileSync(OUTPUT_FILE, buffer);