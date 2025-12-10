const fs = require("fs");
const { PNG } = require("pngjs");
const path = require("path");
const { performance } = require("perf_hooks");
const { generateGaussianKernel } = require("./functions/generateGaussKernel");
const { applyConvolution } = require("./functions/applyConvolution");

const kernelSize = 15;
const sigma = 5;
const BIG_BLUR_KERNEL = generateGaussianKernel(kernelSize, sigma);

const INPUT_FILE = path.join(__dirname, "imgs/inputs/italy.png");
const OUTPUT_FILE = path.join(
  __dirname,
  "imgs/outputs/saidaBlurSequencial.png"
);

function runSequentialBlur(silent = false) {
  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(INPUT_FILE);

    readStream.on("error", (err) => reject(err));

    readStream
      .pipe(new PNG())
      .on("parsed", function () {
        if (!silent) {
          console.log(`\n[Sequencial] Imagem carregada: ${INPUT_FILE}`);
          console.log(`Dimensões: ${this.width}x${this.height}`);
        }

        const outputBuffer = Buffer.alloc(this.data.length);
        this.data.copy(outputBuffer);

        const start = performance.now();

        applyConvolution(
          this.data,
          outputBuffer,
          this.width,
          this.height,
          BIG_BLUR_KERNEL,
          1
        );

        const end = performance.now();
        const duration = end - start;

        if (!silent) {
          console.log(`Tempo Sequencial (Blur): ${duration.toFixed(4)} ms`);
        }

        this.data = outputBuffer;
        this.pack()
          .pipe(fs.createWriteStream(OUTPUT_FILE))
          .on("finish", () => resolve(duration));
      })
      .on("error", (err) => reject(err));
  });
}

if (require.main === module) {
  runSequentialBlur().catch(console.error);
}

module.exports = { runSequentialBlur };
