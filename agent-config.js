// Public settings only. Set apiBase empty to disconnect the optional module.
// Worker and static site deploy independently (no trailing slash).
// Never put OPENAI_API_KEY or the access passphrase in this file.
window.WORK_ARCHIVE_AGENT = Object.freeze({
  apiBase: 'https://work-archive-agent.ider001.workers.dev/api/agent',
  authMode: 'public',
  turnstileSiteKey: '',
});
