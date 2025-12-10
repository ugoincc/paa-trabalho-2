const fs = require("fs");
const path = require("path");
const { runParallelBlur } = require("../parallelBlur");
const { runParallelEdge } = require("../parallelEdge");

const RUNS = 30;
const WARMUP = 2;
const REPORT_FILE = path.join(__dirname, "relatorio_paralelo.txt");

function getStats(arr) {
  const n = arr.length;
  const mean = arr.reduce((a, b) => a + b, 0) / n;
  const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
  return {
    mean: mean.toFixed(4),
    stdDev: Math.sqrt(variance).toFixed(4),
    min: Math.min(...arr).toFixed(4),
    max: Math.max(...arr).toFixed(4),
  };
}

async function runTest(testName, testFunction) {
  console.log(`\n>>> Iniciando Teste: ${testName} <<<`);
  let logContent = `=== RELATÓRIO: ${testName} ===\n`;
  logContent += `Data: ${new Date().toISOString()}\n`;
  logContent += `Config: ${RUNS} execuções, ${WARMUP} warmups\n\n`;

  // 1. Warmup (Aquecimento)
  process.stdout.write("Aquecendo (Warmup)... ");
  for (let i = 0; i < WARMUP; i++) {
    // Passamos 0 no tempo sequencial (1º arg) e true no silent (2º arg)
    await testFunction(0, true);
  }
  console.log("OK.");

  // 2. Medições Valendo
  const times = [];
  console.log("Executando medições...");

  for (let i = 0; i < RUNS; i++) {
    process.stdout.write(`Execução ${i + 1}/${RUNS}... `);

    // O tempo retornado pela Promise é o que conta
    const duration = await testFunction(0, true);

    times.push(duration);
    console.log(`${duration.toFixed(2)} ms`);
    logContent += `Run ${i + 1}: ${duration.toFixed(4)} ms\n`;
  }

  // 3. Estatísticas
  const stats = getStats(times);
  const resultSummary =
    `\n--- RESULTADOS FINAIS (${testName}) ---\n` +
    `Média:         ${stats.mean} ms\n` +
    `Desvio Padrão: ±${stats.stdDev} ms\n` +
    `Mínimo:        ${stats.min} ms\n` +
    `Máximo:        ${stats.max} ms\n` +
    `-----------------------------------\n\n`;

  console.log(resultSummary);
  logContent += resultSummary;

  return logContent;
}

async function main() {
  // Cria/Limpa o arquivo de relatório
  fs.writeFileSync(
    REPORT_FILE,
    "RELATÓRIO DE PERFORMANCE PARALELO (WORKER THREADS)\n===================================================\n"
  );

  try {
    // Teste 1: Blur Paralelo
    const blurResults = await runTest("Blur Paralelo", runParallelBlur);
    fs.appendFileSync(REPORT_FILE, blurResults);

    // Teste 2: Edge Detection Paralelo
    const edgeResults = await runTest(
      "Edge Detection Paralelo",
      runParallelEdge
    );
    fs.appendFileSync(REPORT_FILE, edgeResults);

    console.log(`\n[SUCESSO] Relatório completo salvo em: ${REPORT_FILE}`);
  } catch (error) {
    console.error("Erro crítico durante os testes paralelos:", error);
  }
}

main();
