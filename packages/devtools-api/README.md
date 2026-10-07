# Public Plugin API

Plugin authors import registration helpers and structural types from
`@devtools/api`. Inspector options, nodes, tags, actions, payloads, state entries,
and serializable value types are exported alongside plugin, command, tab,
timeline, and router contracts. Internal context constructors and the
`DevToolsPluginAPI` implementation class remain outside this facade.

`setupDevToolsPlugin` and its compatibility spelling `setupDevtoolsPlugin`
infer the application type from `PluginDescriptor<AppContext>`. Explicit
`<AppContext, StateCategory, StateValue>` arguments preserve typed inspector
state in setup callbacks and responses. Registration remains buffered until a
delivery context and React root are available.

## Type Contract Tests

Run `npm run test:types` from the repository root. Turbo builds the API and its
dependencies before compiling the consumer fixtures in `type-tests`.
The suite also runs as part of the root `npm run typecheck` command and required CI.

The fixture compiler is independent of workspace source aliases: strict
NodeNext resolution imports only the package's public root and checks its emitted
declarations with `skipLibCheck: false`. Fixtures cover setup inference, both
registration spellings, sync/async inspector handlers, typed state responses,
custom tabs, nested commands, timeline layers/events, and internal-export boundaries.
`@ts-expect-error` cases must fail to compile; if a contract becomes permissive,
TypeScript rejects the now-unused directive. These files are compile-only and
are not run by Jest or included in the published `dist` output.
