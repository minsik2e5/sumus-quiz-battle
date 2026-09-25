await import('./build-assets.mjs');

if (process.env.RUN_RELEASE_CHECK_ON_BOOT === 'true') {
  const { runReleaseCheck } = await import('./release-check.mjs');
  await runReleaseCheck();
}
await import('./index.mjs');
