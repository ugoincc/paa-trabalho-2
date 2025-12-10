const fs = require("fs");
const path = require("path");
const { runSequentialBlur } = require("../mainBlur");
const { runSequentialEdge } = require("../mainEdge");

const RUNS = 30;
const WARMUP = 2;
const REPORT_FILE = path.join(__dirname, "relatorio_sequencial.txt");

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

  // Warmup
  process.stdout.write("Aquecendo (Warmup)... ");
  for (let i = 0; i < WARMUP; i++) {
    await testFunction(true);
  }
  console.log("OK.");

  // Medições
  const times = [];
  console.log("Executando medições...");

  for (let i = 0; i < RUNS; i++) {
    process.stdout.write(`Execução ${i + 1}/${RUNS}... `);
    const duration = await testFunction(true); // true para silent mode
    times.push(duration);
    console.log(`${duration.toFixed(2)} ms`);
    logContent += `Run ${i + 1}: ${duration.toFixed(4)} ms\n`;
  }

  // Estatísticas
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
  // Limpa o arquivo de relatório anterior
  fs.writeFileSync(
    REPORT_FILE,
    "RELATÓRIO DE PERFORMANCE SEQUENCIAL\n===================================\n"
  );

  try {
    // 1. Teste Blur
    const blurResults = await runTest("Blur Sequencial", runSequentialBlur);
    fs.appendFileSync(REPORT_FILE, blurResults);

    // 2. Teste Edge
    const edgeResults = await runTest(
      "Edge Detection Sequencial",
      runSequentialEdge
    );
    fs.appendFileSync(REPORT_FILE, edgeResults);

    console.log(`\n[SUCESSO] Relatório salvo em: ${REPORT_FILE}`);
  } catch (error) {
    console.error("Erro durante os testes:", error);
  }
}

main();
