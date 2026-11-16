// Bundles src/ into a single self-contained dist/index.html (three.js, fonts, CSS, game code inlined).
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'src');
const nm = path.join(__dirname, 'node_modules');
const read = (p) => fs.readFileSync(p, 'utf8');

const font = (file, family, weight, stretch) => {
  const b64 = fs.readFileSync(path.join(nm, file)).toString('base64');
  return `@font-face{font-family:'${family}';font-style:normal;font-display:swap;font-weight:${weight};font-stretch:${stretch};src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
};
const fonts = [
  font('@fontsource-variable/roboto-flex/files/roboto-flex-latin-full-normal.woff2', 'Roboto Flex', '100 1000', '25% 151%'),
  font('@fontsource-variable/fredoka/files/fredoka-latin-wdth-normal.woff2', 'Fredoka', '300 700', '75% 125%'),
].join('\n');

const css = read(path.join(src, 'style.css'));
const three = read(path.join(nm, 'three/build/three.min.js'));
const jsDir = path.join(src, 'js');
const game = fs.readdirSync(jsDir).filter((f) => f.endsWith('.js')).sort().map((f) => `// ==== ${f} ====\n` + read(path.join(jsDir, f))).join('\n\n');

if (three.includes('</script')) throw new Error('three.js contains </script');
if (game.includes('</script')) throw new Error('game code contains </script');

let html = read(path.join(src, 'index.html'));
html = html.replace('/*FONTS*/', () => fonts).replace('/*CSS*/', () => css).replace('/*THREE*/', () => three).replace('/*GAME*/', () => game);

const out = path.join(root, 'dist');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'index.html'), html);
const android = path.join(root, 'android', 'app', 'src', 'main', 'assets');
if (fs.existsSync(path.join(root, 'android'))) { fs.mkdirSync(android, { recursive: true }); fs.writeFileSync(path.join(android, 'index.html'), html); }
console.log(`dist/index.html  ${(html.length / 1024).toFixed(0)} KB`);
