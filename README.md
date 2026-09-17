# react-devtools

Our version of React DevTools is modeled after Vue's official DevTools, which is super clearn and easy to use.

## Phase 1 verification

Run the Phase 1 end-to-end smoke script with:

```sh
npm run prototype:phase1 --workspace=@devtools/kit
```

The script builds the real `@devtools/kit` and `@devtools/api` packages, registers a fake inspector via `setupDevToolsPlugin`, and verifies inspector tree/state data over the iframe transport preset.
