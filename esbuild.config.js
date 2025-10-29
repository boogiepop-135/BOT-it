// esbuild.config.js
const esbuild = require('esbuild');

async function build() {
	await esbuild.build({
		entryPoints: ['src/index.ts'],
		outdir: 'build',
		platform: 'node',
		target: 'node18',
		bundle: true,
		sourcemap: false,
		format: 'cjs',
		logLevel: 'info',
		external: [],
	});
}

build().catch((err) => {
	console.error(err);
	process.exit(1);
});


