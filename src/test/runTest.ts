import { run } from './suite/index';

async function main() {
	try {
		run();
	} catch (err) {
		console.error('Failed to run tests', err);
		process.exit(1);
	}
}

main();
