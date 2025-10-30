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
		resolveExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
		// No empaquetar módulos nativos para que se resuelvan desde node_modules en runtime (linux)
		external: [
			'bcrypt',
			'@ffmpeg-installer/ffmpeg',
			'puppeteer',
			'langdetect',
			'undici/register'
		],
	});
}

build().catch((err) => {
	console.error(err);
	process.exit(1);
});


