import { transform } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Archivos JS en orden de dependencia (mismo orden que <script defer> en index.html)
const sourceFiles = [
  'js/config.js',
  'js/auth.js',
  'js/api.js',
  'js/ui/components.js',
  'js/ui/sidebar.js',
  'js/ui/stats.js',
  'js/ui/feedback-list.js',
  'js/ui/feedback-detail.js',
  'js/ui/chat-panel.js',
  'js/router.js',
  'js/app.js',
];

const distDir = join(__dirname, 'dist');

// 1. Concatenar todos los archivos fuente
console.log('[build] Concatenando archivos fuente...');
const concatenated = sourceFiles.map((file) => {
  const fullPath = join(__dirname, file);
  if (!existsSync(fullPath)) {
    console.error(`[build] ERROR: archivo no encontrado: ${file}`);
    process.exit(1);
  }
  console.log(`  + ${file}`);
  return readFileSync(fullPath, 'utf-8');
}).join('\n');

console.log(`[build] Total concatenado: ${(concatenated.length / 1024).toFixed(1)} KB`);

// 2. Minificar con esbuild
console.log('[build] Minificando con esbuild...');
const result = await transform(concatenated, {
  minify: true,
  drop: ['console'],
  target: ['es2020'],
  legalComments: 'none',
});

console.log(`[build] Minificado: ${(result.code.length / 1024).toFixed(1)} KB`);

// 3. Crear directorio dist/
mkdirSync(distDir, { recursive: true });

// 4. Escribir JS minificado
writeFileSync(join(distDir, 'admin.min.js'), result.code, 'utf-8');
console.log('[build] dist/admin.min.js generado');

// 5. Generar index.html con un solo <script>
const originalHtml = readFileSync(join(__dirname, 'index.html'), 'utf-8');

// Reemplazar los 11 <script src="js/..."> tags por uno solo
const scriptTagPattern = /\s*<!-- JS files \(defer, loaded in dependency order\) -->\s*\n(\s*<script src="js\/[^"]+"\s*defer><\/script>\s*\n)*/;
const newScriptBlock = '\n  <!-- JS (minificado) -->\n  <script src="admin.min.js" defer></script>\n';

let distHtml = originalHtml.replace(scriptTagPattern, newScriptBlock);

// Ajustar rutas relativas CSS y assets (dist/ esta un nivel dentro de admin/)
distHtml = distHtml.replace(/href="css\//g, 'href="../css/');
distHtml = distHtml.replace(/href="\.\.\/assets\//g, 'href="../../assets/');
distHtml = distHtml.replace(/src="\.\.\/assets\//g, 'src="../../assets/');

writeFileSync(join(distDir, 'index.html'), distHtml, 'utf-8');
console.log('[build] dist/index.html generado');

// 6. Resumen
const originalSize = concatenated.length;
const minifiedSize = result.code.length;
const reduction = ((1 - minifiedSize / originalSize) * 100).toFixed(1);
console.log(`\n[build] Completado:`);
console.log(`  Original:   ${(originalSize / 1024).toFixed(1)} KB (${sourceFiles.length} archivos)`);
console.log(`  Minificado: ${(minifiedSize / 1024).toFixed(1)} KB (1 archivo)`);
console.log(`  Reduccion:  ${reduction}%`);
console.log(`  console.*:  eliminados`);
