// src/functions/metrics.js

/**
 * Calcula o Speedup (Aceleração).
 * Fórmula: T_sequencial / T_paralelo
 * O quanto a versão paralela é mais rápida que a sequencial.
 */
function calculateSpeedup(tSeq, tPar) {
  if (tPar <= 0) return 0;
  return tSeq / tPar;
}

/**
 * Calcula a Eficiência.
 * Fórmula: Speedup / N_processadores
 * Mede o quão bem os núcleos estão sendo utilizados (ideal = 1.0 ou 100%).
 */
function calculateEfficiency(speedup, numProcessors) {
  if (numProcessors <= 0) return 0;
  return speedup / numProcessors;
}

/**
 * Calcula o Overhead Total (Custo de Gestão).
 * Fórmula: (T_paralelo * N_processadores) - T_sequencial
 * Representa o tempo "desperdiçado" com criação de threads e comunicação.
 */
function calculateOverhead(tSeq, tPar, numProcessors) {
  return tPar * numProcessors - tSeq;
}

/**
 * Lei de Amdahl (Máximo Teórico).
 * S_max = 1 / ((1 - p) + (p / N))
 * p: Porcentagem paralelizável do código (0.0 a 1.0).
 */
function calculateAmdahl(p, numProcessors) {
  return 1 / (1 - p + p / numProcessors);
}

function report(TEMPO_SEQUENCIAL_MEDIDO, duration, NUM_WORKERS) {
  const speedup = calculateSpeedup(TEMPO_SEQUENCIAL_MEDIDO, duration);
  const efficiency = calculateEfficiency(speedup, NUM_WORKERS);
  const overhead = calculateOverhead(
    TEMPO_SEQUENCIAL_MEDIDO,
    duration,
    NUM_WORKERS
  );

  console.log(`\n--- RELATÓRIO DE PERFORMANCE ---`);
  console.log(
    `Tempo Sequencial Base: ${TEMPO_SEQUENCIAL_MEDIDO.toFixed(4)} ms`
  );
  console.log(`Speedup (Aceleração):  ${speedup.toFixed(2)}x`);
  console.log(`Eficiência:            ${(efficiency * 100).toFixed(2)}%`);
  console.log(
    `Overhead Estimado:     ${overhead.toFixed(2)} ms (Custo extra CPU)`
  );
}

module.exports = {
  calculateSpeedup,
  calculateEfficiency,
  calculateOverhead,
  calculateAmdahl,
  report,
};
