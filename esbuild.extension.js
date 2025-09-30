// esbuild.extension.js
// Bundle your VS Code extension entry point for Node.js 20+

const esbuild = require('esbuild')
const path = require('path')

esbuild.build({
  entryPoints: [path.resolve(__dirname, 'src/extension.js')],
  bundle: true,
  minify: true,
  platform: 'node',
  target: ['node24'],
  outfile: path.resolve(__dirname, 'dist/extension.js'),
  sourcemap: true,
  logLevel: 'info',
  external: ['vscode']
}).catch(() => process.exit(1))
