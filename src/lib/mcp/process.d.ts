// Ambient process typing so tool files that read Deno-runtime env vars type-check
// in the app's TS context. The MCP plugin bundles these files into a Deno Edge
// Function where `process.env` is provided by the Supabase runtime.
declare const process: { env: Record<string, string | undefined> };
