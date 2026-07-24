import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const source = path.resolve("assets/app-icon-source.png");
const buildDir = path.resolve("build");
const sizes = [16, 24, 32, 48, 64, 128, 256];

await fs.mkdir(buildDir, { recursive: true });

const pngPaths = [];
for (const size of sizes) {
  const output = path.join(buildDir, `icon-${size}.png`);
  await sharp(source)
    .resize(size, size, { fit: "cover" })
    .png()
    .toFile(output);
  pngPaths.push(output);
}

const ico = await pngToIco(pngPaths);
await fs.writeFile(path.join(buildDir, "icon.ico"), ico);
await sharp(source).resize(512, 512).png().toFile(path.join(buildDir, "icon.png"));

console.log("Windows and PNG icons created.");
