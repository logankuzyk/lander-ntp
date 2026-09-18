import { handle } from './handler'

// Only the default export: workerd treats every named export of the main module as an
// entrypoint, and refuses to start on one that isn't a handler.
export default { fetch: handle } satisfies ExportedHandler<Env>
