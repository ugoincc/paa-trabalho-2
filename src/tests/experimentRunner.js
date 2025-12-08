const { performance } = require("perf_hooks");
const { runParallelEdge } = require("../parallelEdge");
const { runParallelBlur } = require("../parallelBlur");

const RUNS = 30; // Número de repetições válidas
const WARMUP = 2; // Repetições para aquecer o JIT

// Função auxiliar para média e desvio padrão
function getStats(arr) {
  const n = arr.length;
  const mean = arr.reduce((a, b) => a + b, 0) / n;
  const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
  return {
    mean: mean.toFixed(4),
    stdDev: Math.sqrt(variance).toFixed(4),
  };
}

async function runExperiment() {
  console.log(
    `=== INICIANDO EXPERIMENTO (Warmup: ${WARMUP}, Runs: ${RUNS}) ===`
  );

  // 1. Fase de Warm-up
  console.log("Aquecendo motor V8...");
  for (let i = 0; i < WARMUP; i++) {
    process.stdout.write(`Warmup ${i + 1}/${WARMUP}...\r`);
    await runParallelEdge(0); // Passa 0 pois não queremos logs de métricas agora
  }
  console.log("\nAquecimento concluído. Iniciando medições...");

  // 2. Fase de Medição
  const times = [];
  for (let i = 0; i < RUNS; i++) {
    process.stdout.write(`Execução ${i + 1}/${RUNS}... `);

    // Captura o tempo retornado pela sua função (precisa ajustar parallelEdge para retornar o tempo)
    // Nota: Ajustei o parallelEdge.js na resposta anterior para retornar 'duration' no resolve()
    const duration = await runParallelEdge(0);

    times.push(duration);
    console.log(`${duration.toFixed(2)} ms`);
  }

  // 3. Resultados
  const stats = getStats(times);
  console.log("\n=== RESULTADOS FINAIS ===");
  console.log(`Amostras:      ${RUNS}`);
  console.log(`Média:         ${stats.mean} ms`);
  console.log(`Desvio Padrão: ±${stats.stdDev} ms`);
  console.log(`Mínimo:        ${Math.min(...times).toFixed(2)} ms`);
  console.log(`Máximo:        ${Math.max(...times).toFixed(2)} ms`);
}

runExperiment();
