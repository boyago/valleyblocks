// Converte uma arte (PNG do ChatGPT) para JPG 1600px e copia para o site e o portal.
// Uso: node scripts/landing-art.mjs <origem.png> <nome.jpg>
import sharp from "sharp";

const [src, name] = process.argv.slice(2);
const dirs = ["public/jogos/vale-dos-blocos", "../../imersao/site/public/jogos/vale-dos-blocos"];
for (const dir of dirs) {
  const info = await sharp(src).resize(1600).jpeg({ quality: 82, mozjpeg: true }).toFile(`${dir}/${name}`);
  console.log(dir, info.size);
}
