# Phase 7 Nekuta Guide Verification

Date: 2026-10-06

Issue: P7-05 / #121

Builds: Vite playground 0.0.9, Nekuta plugin 0.0.3, client 0.0.27,
kit 0.0.19, Vite plugin 0.0.11, docs 0.0.11.

The running Vite playground was checked with Playwright Chromium at
`http://127.0.0.1:9021/`, using the embedded same-origin overlay. The in-app
browser connection was unavailable, so standalone Playwright was used.

| Check                  | Result                                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Store tree and filter  | Both store IDs appeared; filtering by `todos` hid the counter. Clearing restored it.                             |
| Counter snapshot       | Count started at 0, with getter/action/metadata groups.                                                          |
| Todo snapshot          | Items and nextId appeared; getter fields had no edit controls.                                                   |
| Numeric edit           | Saving count 7 changed the application to Count 7 / Doubled 14.                                                  |
| Refresh by selection   | Selecting todos and returning to the counter showed count 7 / doubled 14.                                        |
| Application actions    | Increment produced 8 / 16; Reset restored 0. Add todo and Toggle first todo updated the open count.              |
| Rename                 | A disposable nextId key was renamed to nextIdReview; reselecting confirmed the library snapshot retained it.     |
| Remove                 | Removing nextIdReview persisted after reselecting. The fixture was not used for further mutations after removal. |
| Page errors            | No Playwright pageerror events occurred during the successful flow.                                              |
| Screenshots            | Four actual UI captures were saved under apps/docs/static/img/nekuta and visually inspected.                     |
| Documentation snippets | Both TypeScript examples passed strict typechecking against installed workspace types.                           |
| Production output      | The playground's development-only overlay stylesheet link was absent from built production HTML.                 |

Known limits documented in the guide: app-side context bootstrap, private Nekuta
registry access, snapshot refresh on selection, filter-index editing hazards,
formatted complex values, fixed inspector IDs, and unverified extension delivery.

The playground now links the served overlay CSS using a serve-only Vite HTML
transform. The library bundle emits that CSS separately, and the Vite plugin
currently injects only its JavaScript. Without the link, the overlay was unstyled
and pointer tab navigation overlapped; the guide documents this prerequisite.
