await import('./build-assets.mjs');

const { runReleaseCheck } = await import('./release-check.mjs');
await runReleaseCheck();
await import('./index.mjs');
