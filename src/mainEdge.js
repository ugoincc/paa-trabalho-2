const fs = require("fs");
const { PNG } = require("pngjs");
const path = require("path");
const { performance } = require("perf_hooks");
const { applyConvolution } = require("./functions/applyConvolution");

const EDGE_DETECTION_KERNEL = [
  [-1, -1, -1],
  [-1, 8, -1],
  [-1, -1, -1],
];

const INPUT_FILE = path.join(__dirname, "imgs/inputs/italy.png");
const OUTPUT_FILE = path.join(
  __dirname,
  "imgs/outputs/saidaEdgeSequencial.png"
);

function runSequentialEdge(silent = false) {
  return new Promise((resolve, reject) => {
    try {
      const data = fs.readFileSync(INPUT_FILE);
      const png = PNG.sync.read(data);

      if (!silent) {
        console.log(`\n[Sequencial] Edge Detection iniciado.`);
      }

      const outputBuffer = Buffer.alloc(png.data.length);
      png.data.copy(outputBuffer);

      const start = performance.now();

      applyConvolution(
        png.data,
        outputBuffer,
        png.width,
        png.height,
        EDGE_DETECTION_KERNEL,
        1
      );

      const end = performance.now();
      const duration = end - start;

      if (!silent) {
        console.log(`Tempo Sequencial (Edge): ${duration.toFixed(4)} ms`);
      }

      png.data = outputBuffer;
      const buffer = PNG.sync.write(png);
      fs.writeFileSync(OUTPUT_FILE, buffer);

      resolve(duration);
    } catch (error) {
      reject(error);
    }
  });
}

if (require.main === module) {
  runSequentialEdge().catch(console.error);
}

module.exports = { runSequentialEdge };
