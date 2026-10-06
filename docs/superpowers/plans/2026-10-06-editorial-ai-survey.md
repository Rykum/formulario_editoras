# Implementation Plan: landing page for the university-publisher AI survey

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Portuguese, responsive ten-question survey landing page that stores each submission as a row in a Google Sheet, grouped by publisher.

**Architecture:** A Google Apps Script Web App serves the HTML page and calls server-side Apps Script functions through `google.script.run`. The server creates the response spreadsheet during an owner-authorized setup step, validates submissions, appends one row per response, and sorts rows by publisher and submission time.

**Tech Stack:** Google Apps Script V8, HTML, CSS, browser JavaScript, Node.js built-in test runner for local validation. No runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-10-05-landing-page-editoras-ia-design.md`

## Global Constraints

- Keep exactly ten numbered question groups from the approved spec; conditional fields are details within their parent question.
- Keep all respondent-facing copy in Brazilian Portuguese.
- Use native HTML form controls with visible labels, `fieldset` and `legend` for related selections, keyboard focus styles, and a mobile-first single-column layout.
- Serve the page from Apps Script HTML Service and use `google.script.run`; do not place Google credentials or spreadsheet IDs in browser code.
- Validate every submission on the server against the allowed option values in `Survey.gs`.
- Preserve every valid submission as a new spreadsheet row; never overwrite an earlier response.
- Sort the response range by publisher name ascending and submission timestamp descending while holding a script lock.
- Escape spreadsheet text that could be interpreted as a formula, and do not render respondent text as HTML.
- Keep all implementation files under `apps-script/`, `tests/`, and `README.md`; leave existing untracked research files untouched.
- Use only Node.js built-in modules for local tests; `node --test` is available as Node v22.13.1.

## Review Focus

- Unknown or malformed option values must be rejected before any spreadsheet write; cover in Task 1 tests.
- Hidden conditional answers must not leak into a submission after their parent answer changes; cover in Task 3 tests.
- Text beginning with formula characters must remain literal cell text; cover in Task 1 tests.
- Two submissions from the same publisher, including concurrent submissions, must both remain and sort together; cover in Task 2 tests.
- An Apps Script call failure must display an error and must never show the success confirmation; cover in Task 3 tests.

---

### Task 1: Define the survey schema and server validation

**Files:**
- Create: `apps-script/Survey.gs`
- Create: `tests/apps-script-harness.js`
- Create: `tests/survey-validation.test.js`

**Interfaces:**
- Produces `SURVEY_HEADERS`, the ordered sheet header list.
- Produces `SURVEY_OPTIONS`, the allowed values for single- and multi-select answers.
- Produces `validateSubmission(payload) -> { ok: boolean, errors: string[] }`.
- Produces `buildResponseRow(payload, submittedAt, responseId) -> Array` in `SURVEY_HEADERS` order.
- Produces `sanitizeCellText(value) -> string` for user-provided cell values.

- [ ] **Step 1: Write failing tests for valid and invalid answer sets**

Create `validSubmission(overrides = {})` in `tests/apps-script-harness.js` with these exact default fields, then apply `overrides` last. Export it with `loadAppsScript(files)` so validation and storage tests share the fixture:

```js
function validSubmission(overrides = {}) {
  return {
    publisher: 'Editora Aurora', institution: 'Universidade Aurora',
    usesAI: 'yes', activities: ['translation'], otherActivity: '',
    policyStatus: 'public', policyUrl: 'https://example.org/policy',
    reviewerGuidance: 'restricted', reviewerRestrictions: ['confidentiality'], otherRestriction: '',
    benefits: ['efficiency'], otherBenefit: '', concerns: ['errors'], otherConcern: '',
    futurePriority: 'Capacitação editorial', allowIdentification: 'no', website: '',
    ...overrides
  };
}
```

`loadAppsScript(files)` reads the named `.gs` files from `apps-script/`, evaluates them in one `vm` context, and returns that context. In `tests/survey-validation.test.js`, import `node:test`, `node:assert/strict`, and `{ loadAppsScript, validSubmission }` from the harness, then destructure the server functions and `SURVEY_HEADERS` from `loadAppsScript(['Survey.gs'])`.

Use these machine values so the form, validator, and sheet agree:

```js
const usesAI = ['yes', 'testing', 'no', 'unknown'];
const activities = ['writing', 'revision', 'translation', 'summaries-metadata', 'images-layout', 'accessibility', 'originality', 'editorial-support', 'communication', 'other'];
const policyStatus = ['public', 'private', 'developing', 'none', 'unknown'];
const reviewerGuidance = ['prohibited', 'restricted', 'unrestricted', 'none', 'unknown'];
const reviewerRestrictions = ['declaration', 'confidentiality', 'other'];
const benefits = ['efficiency', 'revision', 'translation', 'accessibility', 'dissemination', 'cost-reduction', 'other', 'none', 'unknown'];
const concerns = ['copyright-plagiarism', 'errors', 'confidentiality-data', 'authorship-quality', 'technology-dependence', 'undisclosed-use', 'other', 'none', 'unknown'];
const allowIdentification = ['yes', 'no'];
const SURVEY_OPTIONS = { usesAI, activities, policyStatus, reviewerGuidance, reviewerRestrictions, benefits, concerns, allowIdentification };
```

Set the fixture to `usesAI: 'yes'`, `activities: ['translation']`, `policyStatus: 'public'`, `policyUrl: 'https://example.org/policy'`, `reviewerGuidance: 'restricted'`, `reviewerRestrictions: ['confidentiality']`, `benefits: ['efficiency']`, `concerns: ['errors']`, and `allowIdentification: 'no'`. Use realistic non-empty publisher and institution strings, empty strings for unused “other” details, and `website: ''`.

In `tests/survey-validation.test.js`, load `Survey.gs` with Node's `vm` module using `tests/apps-script-harness.js`, then add these assertions:

```js
test('accepts a complete response using the approved options', () => {
  const result = validateSubmission(validSubmission());
  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
});

test('rejects an unknown policy status and a missing publisher', () => {
  const result = validateSubmission({ ...validSubmission(), publisher: ' ', policyStatus: 'invented' });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('publisher'));
  assert.ok(result.errors.includes('policyStatus'));
});

test('does not store activity answers when the publisher reports no AI use', () => {
  const payload = { ...validSubmission(), usesAI: 'no', activities: ['translation'] };
  assert.equal(validateSubmission(payload).ok, true);
  const row = buildResponseRow(payload, new Date('2026-10-06T12:00:00Z'), 'id-2');
  assert.equal(row[SURVEY_HEADERS.indexOf('Atividades')], '');
});

test('stores formula-like respondent text as literal text', () => {
  const row = buildResponseRow({ ...validSubmission(), publisher: '=2+2' }, new Date('2026-10-06T12:00:00Z'), 'id-1');
  assert.equal(row[2], "'=2+2");
});
```

- [ ] **Step 2: Run the tests and confirm the missing functions fail**

Run: `node --test tests/survey-validation.test.js`
Expected: FAIL because `Survey.gs` does not yet define the schema, validator, row builder, or sanitizer.

- [ ] **Step 3: Implement schema, conditional validation, and row serialization**

Define `SURVEY_OPTIONS` from the machine values above, separately from Portuguese labels, and set `SURVEY_HEADERS` to this exact order: `ID`, `Enviado em`, `Editora`, `Instituição`, `Uso de IA`, `Atividades`, `Outra atividade`, `Política formal`, `Link da política`, `Orientação para pareceristas`, `Restrições para pareceristas`, `Outra restrição`, `Benefícios`, `Outro benefício`, `Preocupações`, `Outra preocupação`, `Prioridade futura`, `Autoriza identificação`. Validate required publisher, institution, adoption status, policy status, reviewer guidance, and identification permission. Validate every selected value against the allowlists. When AI usage is “no” or “unknown”, serialize activities as empty; when a policy is not public, serialize its URL as empty; when reviewer guidance is not restricted, serialize restriction details as empty. Require text for selected “other” options. Treat “none” and “unknown” as exclusive selections in benefits and concerns. Accept only `http:` or `https:` public-policy links. Make all open text plain strings and enforce a 2,000-character maximum for the future-priority response.

Build a stable response row with response ID, timestamp, publisher, institution, each question's answer, and conditional details in the same order as `SURVEY_HEADERS`. Join selected values with `; `. Prefix strings beginning (after optional whitespace) with `=`, `+`, `-`, or `@` with an apostrophe before writing them to Sheets.

Implement the literal-cell conversion exactly as follows, then call it for every respondent-provided string in `buildResponseRow`:

```js
function sanitizeCellText(value) {
  const text = String(value == null ? '' : value).trim();
  return /^[-=+@]/.test(text) ? "'" + text : text;
}
```

- [ ] **Step 4: Run validation tests and confirm they pass**

Run: `node --test tests/survey-validation.test.js`
Expected: all four tests pass, with no test failures.

- [ ] **Step 5: Commit the schema and validation unit**

Run: `git add apps-script/Survey.gs tests/apps-script-harness.js tests/survey-validation.test.js`
Run: `git commit -m "feat: define publisher survey schema and validation"`

### Task 2: Create the spreadsheet and persist submissions

**Files:**
- Create: `apps-script/Code.gs`
- Modify: `tests/apps-script-harness.js`
- Create: `tests/spreadsheet-storage.test.js`

**Interfaces:**
- Produces `setupSurveySpreadsheet() -> { spreadsheetId: string, url: string }`.
- Produces `doGet() -> HtmlOutput` and `include(filename) -> string` for HTML Service.
- Produces `submitResponse(payload) -> { ok: boolean, message: string }`.
- Consumes `SURVEY_HEADERS`, `validateSubmission`, and `buildResponseRow` from Task 1.

- [ ] **Step 1: Write failing tests for setup, append, sorting, and rejected writes**

Extend the harness with in-memory Script Properties, Spreadsheet, Sheet, Range, and Script Lock doubles. `setValues()` writes the header row without incrementing `appendCount`; only submission `appendRow()` calls increment it. `loadAppsScript(files)` returns the VM context with `sheet`, `lock`, and the Apps Script functions available as properties. Add tests asserting that setup creates a “Pesquisa sobre IA nas editoras universitárias” spreadsheet with a “Respostas” tab, frozen header row and filter; a valid submission appends one row; two submissions from the same publisher remain in the sheet; the data range is sorted by publisher column 3 ascending and timestamp column 2 descending; and invalid input does not call `appendRow`.

The storage test should use the server functions exposed in the VM context and assert real mutations on the in-memory sheet. Call `setupSurveySpreadsheet()` before the first submission:

```js
test('appends a valid response once, then sorts by publisher and time', () => {
  const app = loadAppsScript(['Survey.gs', 'Code.gs']);
  app.setupSurveySpreadsheet();
  app.submitResponse(validSubmission({ publisher: 'Editora Aurora' }));
  app.submitResponse(validSubmission({ publisher: 'Editora Aurora' }));
  assert.equal(app.sheet.rows.length, 3); // header plus two responses
  assert.equal(app.sheet.appendCount, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(app.sheet.lastSortSpec)), [
    { column: 3, ascending: true },
    { column: 2, ascending: false }
  ]);
  assert.equal(app.lock.waitCount, 2);
});
```

Example assertion for sort order configuration:

```js
assert.deepEqual(sheet.lastSortSpec, [
  { column: 3, ascending: true },
  { column: 2, ascending: false }
]);
```

- [ ] **Step 2: Run storage tests and confirm Apps Script handlers are missing**

Run: `node --test tests/spreadsheet-storage.test.js`
Expected: FAIL because setup and submission handlers are not implemented.

- [ ] **Step 3: Implement owner-authorized spreadsheet setup and locked writes**

`setupSurveySpreadsheet()` creates a spreadsheet only when Script Properties has no `SPREADSHEET_ID`; otherwise it returns the existing spreadsheet without clearing data. Name the first tab “Respostas”, write the headers, freeze row 1, and enable a filter. `submitResponse()` rejects a non-empty `website` honeypot, calls `validateSubmission`, obtains a script lock, appends one row with a generated ID and current timestamp, sorts all response rows by publisher then timestamp, releases the lock in `finally`, and returns a success object only after the write and sort finish. Return a field-safe error to the client if the sheet is not initialized or validation/storage fails.

Keep the mutation sequence in this order so validation failures never touch the sheet and concurrent calls serialize:

```js
function submitResponse(payload) {
  if (payload && payload.website) return { ok: false, message: 'Não foi possível validar o envio.' };
  const validation = validateSubmission(payload || {});
  if (!validation.ok) return { ok: false, message: 'Revise os campos destacados.' };
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = getResponseSheet();
    sheet.appendRow(buildResponseRow(payload, new Date(), Utilities.getUuid()));
    const count = sheet.getLastRow() - 1;
    if (count > 1) sheet.getRange(2, 1, count, SURVEY_HEADERS.length).sort([
      { column: 3, ascending: true },
      { column: 2, ascending: false }
    ]);
    return { ok: true, message: 'Resposta registrada.' };
  } finally {
    lock.releaseLock();
  }
}
```

- [ ] **Step 4: Run storage tests and confirm they pass**

Run: `node --test tests/spreadsheet-storage.test.js`
Expected: setup creates the expected sheet, valid rows append and sort, and invalid submissions do not write.

- [ ] **Step 5: Commit the storage unit**

Run: `git add apps-script/Code.gs tests/apps-script-harness.js tests/spreadsheet-storage.test.js`
Run: `git commit -m "feat: store survey responses in Google Sheets"`

### Task 3: Build the responsive ten-question landing page

**Files:**
- Create: `apps-script/Index.html`
- Create: `apps-script/Styles.html`
- Create: `apps-script/Client.html`
- Create: `tests/form-contract.test.js`
- Modify: `apps-script/Code.gs`

**Interfaces:**
- `doGet()` serves `Index.html` using `HtmlService.createTemplateFromFile('Index').evaluate()`.
- `include('Styles')` and `include('Client')` insert the corresponding Apps Script HTML partials.
- The client submits the payload to `submitResponse(payload)` by `google.script.run`.
- Client helper `getConditionalVisibility(answers)` returns visibility for activity choices, policy URL, and reviewer restrictions; it is used by both UI updates and local tests.

- [ ] **Step 1: Write failing form-contract tests**

Create tests that read the three HTML files and assert: the page has the four agreed section headings; each of the ten question group IDs appears exactly once; each choice group has a visible `<legend>` and associated `<label>` elements; the condition helper shows activities only for `yes`/`testing`, policy URL only for `public`, and reviewer restrictions only for `restricted`; the conditional normalizer clears hidden answers; and the notice helper reports success only for `{ ok: true }`. Extract the pure helpers from the `<script>` in `Client.html` and execute them in `vm` with Node's built-in test runner.

Example conditional assertion:

```js
assert.equal(getConditionalVisibility({ usesAI: 'testing' }).activities, true);
assert.equal(getConditionalVisibility({ usesAI: 'no' }).activities, false);
assert.equal(getConditionalVisibility({ policyStatus: 'public' }).policyUrl, true);
```

The helper used by both the UI and tests must return this shape:

```js
function getConditionalVisibility(answers) {
  return {
    activities: answers.usesAI === 'yes' || answers.usesAI === 'testing',
    policyUrl: answers.policyStatus === 'public',
    reviewerRestrictions: answers.reviewerGuidance === 'restricted'
  };
}
```

Add `normalizeConditionalAnswers(answers)` beside that helper. It returns a shallow copy, empties `activities` and `otherActivity` unless activities are visible, clears `policyUrl` unless the policy is public, and clears reviewer restriction fields unless guidance is restricted. Add assertions that hidden values are empty in the returned object while the original object is unchanged.

Add `getSubmissionNotice(result)` beside the normalizer. It returns `{ kind: 'success', message: 'Resposta registrada.' }` only when `result && result.ok === true`; otherwise it returns `{ kind: 'error', message: 'Não foi possível enviar sua resposta. Tente novamente.' }`. Test that true, false, and missing results map to the expected kind.

The helper tests should include these exact stale-answer and notice checks:

```js
const original = { usesAI: 'no', activities: ['translation'], otherActivity: 'tradução', policyStatus: 'private', policyUrl: 'https://example.org/policy', reviewerGuidance: 'unrestricted', reviewerRestrictions: ['declaration'] };
const normalized = normalizeConditionalAnswers(original);
assert.deepEqual(JSON.parse(JSON.stringify(normalized.activities)), []);
assert.equal(normalized.policyUrl, '');
assert.deepEqual(JSON.parse(JSON.stringify(normalized.reviewerRestrictions)), []);
assert.equal(original.activities[0], 'translation');
assert.equal(getSubmissionNotice({ ok: true }).kind, 'success');
assert.equal(getSubmissionNotice({ ok: false }).kind, 'error');
assert.equal(getSubmissionNotice(null).kind, 'error');
```

- [ ] **Step 2: Run form-contract tests and confirm the page files are missing**

Run: `node --test tests/form-contract.test.js`
Expected: FAIL because the form, style, client files, and helper do not exist.

- [ ] **Step 3: Implement semantic form markup and responsive editorial styling**

Create a quiet, editorial visual system with an off-white background, dark text, a restrained deep-green accent, comfortable content width, clear section headings, visible keyboard focus, and a single-column mobile layout. Build the form as one page with sections for publisher identity, AI use and policy, perceptions and priority, and publication identification. Use exactly the ten groups in the spec. Include the conditional fields for “other” answers, public policy URL, and reviewer restrictions as parts of their parent question; clear hidden fields when their controlling choice changes. Use native radio buttons and checkboxes, `fieldset`/`legend`, visible labels, and a real `<button type="submit">`.

In `Client.html`, serialize the form once, disable submit while a request is active, then pass the normalized object to the server:

```js
google.script.run
  .withSuccessHandler(handleServerResult)
  .withFailureHandler(handleRequestFailure)
  .submitResponse(normalizeConditionalAnswers(payload));
```

Announce success or failure in an `aria-live` region, restore the button on failure, and show success only on an `{ ok: true }` server response. Do not insert respondent strings via `innerHTML`.

On a success callback, branch on `result.ok`; only the true branch clears the form and displays the success message. On a false result or failure callback, retain the respondent's entered values, show an error in the live region, and re-enable the submit button. Factor the notice mapping into `getSubmissionNotice(result)`, returning `kind: 'success'` only for `result.ok === true`, and returning `kind: 'error'` for false or missing results; use the same helper for the server error and failure callbacks.

- [ ] **Step 4: Run form-contract and server tests**

Run: `node --test tests/*.test.js`
Expected: all validation, storage, and form-contract tests pass.

- [ ] **Step 5: Commit the landing page**

Run: `git add apps-script/Index.html apps-script/Styles.html apps-script/Client.html apps-script/Code.gs tests/form-contract.test.js`
Run: `git commit -m "feat: add responsive AI publisher survey page"`

### Task 4: Document setup and verify deployment readiness

**Files:**
- Create: `apps-script/appsscript.json`
- Create: `README.md`
- Create: `tests/deployment-docs.test.js`

**Interfaces:**
- README setup steps use the filenames created under `apps-script/` and the `setupSurveySpreadsheet()` function.
- The Apps Script manifest declares V8 runtime and the São Paulo time zone; Apps Script detects the spreadsheet authorization scopes from the code.

- [ ] **Step 1: Write a failing deployment-documentation check**

Add a test in `tests/deployment-docs.test.js` that reads `README.md` and verifies it names `Code.gs`, `Survey.gs`, `Index.html`, `Styles.html`, and `Client.html`; tells the owner to run `setupSurveySpreadsheet()` once; describes an “execute as me” web-app deployment; states that anonymous access depends on Workspace policy; and explains how to locate the generated spreadsheet URL.

- [ ] **Step 2: Run the documentation check and confirm the README is missing**

Run: `node --test tests/deployment-docs.test.js`
Expected: the deployment-documentation assertion fails because `README.md` does not yet exist.

- [ ] **Step 3: Add the Apps Script manifest and owner deployment guide**

Set the manifest runtime to `V8` and time zone to `America/Sao_Paulo`. Document how to create a standalone Apps Script project, add each `.gs` and `.html` file by the exact filename, run and authorize `setupSurveySpreadsheet()`, deploy as a web app executing as the owner with the broadest public access allowed by the account, open the returned web-app URL for a smoke check, and retrieve the generated spreadsheet URL from the Apps Script execution log. Explain how to test a valid submission and confirm its row is next to the same publisher's entries.

- [ ] **Step 4: Run the full local suite and inspect the final diff**

Run: `node --test tests/*.test.js`
Expected: all tests pass. Inspect `git diff --check` and `git status --short` to confirm whitespace is clean and no pre-existing untracked research files were staged.

- [ ] **Step 5: Commit the setup guide**

Run: `git add apps-script/appsscript.json README.md tests/deployment-docs.test.js`
Run: `git commit -m "docs: explain survey web app setup and deployment"`

## Deployment smoke check

After the owner authorizes and deploys the Apps Script Web App, open the deployed URL, submit a test response clearly marked “TESTE”, confirm the page reports success only after the server returns, verify one new row appears under “Respostas” beside any row with the same publisher, then remove that clearly marked test row. If the account blocks anonymous access or disallows an anyone-access deployment, record the exact deployment restriction and stop before publishing a public URL.
