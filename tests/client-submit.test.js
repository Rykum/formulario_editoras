const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const clientSource = fs.readFileSync(path.join(__dirname, '..', 'client.js'), 'utf8');

function loadClient() {
  class FakeFormData {
    constructor(form) { this.values = form.values; }
    get(name) {
      const value = this.values[name];
      return Array.isArray(value) ? (value[0] || null) : (value || null);
    }
    getAll(name) {
      const value = this.values[name];
      return Array.isArray(value) ? value : (value ? [value] : []);
    }
  }
  return vm.createContext({ FormData: FakeFormData });
}

function fakeForm(values) {
  return {
    values,
    resetCount: 0,
    busy: false,
    reportValidity() { return true; },
    setAttribute(name) { if (name === 'aria-busy') this.busy = true; },
    removeAttribute(name) { if (name === 'aria-busy') this.busy = false; },
    reset() { this.resetCount += 1; },
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
}

function fakeButton() {
  const label = { textContent: 'Enviar respostas' };
  return { disabled: false, label, querySelector() { return label; } };
}

function fakeNotice() {
  return { textContent: '', dataset: {}, removeAttribute(name) { delete this.dataset[name.replace('data-', '')]; } };
}

function fakeEvent() {
  return { prevented: false, preventDefault() { this.prevented = true; } };
}

function response({ ok = true, json = async () => ({ ok: true }) } = {}) {
  return { ok, json };
}

test('maps only an explicit successful API result to a safe success message', () => {
  const context = loadClient();
  vm.runInContext(clientSource, context);

  assert.deepEqual(JSON.parse(JSON.stringify(context.getSubmissionNotice({ ok: true }))), {
    kind: 'success', message: 'Resposta registrada.'
  });
  const unsafe = context.getSubmissionNotice({ ok: false, message: 'private_key=secret' });
  assert.equal(unsafe.kind, 'error');
  assert.notEqual(unsafe.message, 'private_key=secret');
});

test('posts the serialized survey to the same-origin endpoint and rejects HTTP or JSON failures', async () => {
  const context = loadClient();
  vm.runInContext(clientSource, context);
  const payload = { publisher: 'Editora Exemplo', website: '' };
  let request;

  const success = await context.sendSurveySubmission(payload, async (url, options) => {
    request = { url, options };
    return response();
  });
  assert.deepEqual(JSON.parse(JSON.stringify(success)), { kind: 'success', message: 'Resposta registrada.' });
  assert.equal(request.url, '/api/submit');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(request.options.body), payload);

  const httpError = await context.sendSurveySubmission(payload, async () => response({
    ok: false,
    json: async () => ({ ok: true })
  }));
  assert.equal(httpError.kind, 'error');

  const malformedJson = await context.sendSurveySubmission(payload, async () => response({
    json: async () => { throw new SyntaxError('private_key=secret'); }
  }));
  assert.equal(malformedJson.kind, 'error');
  assert.doesNotMatch(malformedJson.message, /private_key|secret/);
});

test('retains open answers for benefits and concerns without requiring an other selection', () => {
  const context = loadClient();
  vm.runInContext(clientSource, context);
  const normalized = context.normalizeConditionalAnswers({
    benefits: ['efficiency'],
    otherBenefit: 'Comentário aberto de benefício',
    concerns: ['errors'],
    otherConcern: 'Comentário aberto de preocupação'
  });

  assert.equal(normalized.otherBenefit, 'Comentário aberto de benefício');
  assert.equal(normalized.otherConcern, 'Comentário aberto de preocupação');
});

test('preserves entered values on API failure and resets only after confirmed success', async () => {
  const context = loadClient();
  vm.runInContext(clientSource, context);
  const values = { publisher: 'Editora Exemplo', institution: 'Universidade Exemplo' };
  const form = fakeForm(values);
  const button = fakeButton();
  const notice = fakeNotice();
  const event = fakeEvent();

  await context.handleSurveySubmission(event, form, button, notice, async () => response({
    json: async () => ({ ok: false, message: 'private_key=server-secret' })
  }));

  assert.equal(event.prevented, true);
  assert.equal(form.resetCount, 0);
  assert.equal(form.values.publisher, 'Editora Exemplo');
  assert.equal(form.values.institution, 'Universidade Exemplo');
  assert.equal(notice.dataset.kind, 'error');
  assert.doesNotMatch(notice.textContent, /private_key|server-secret/);
  assert.equal(form.busy, false);
  assert.equal(button.disabled, false);
  assert.equal(button.label.textContent, 'Enviar respostas');

  await context.handleSurveySubmission(fakeEvent(), form, button, notice, async () => response());
  assert.equal(form.resetCount, 1);
  assert.equal(notice.dataset.kind, 'success');
  assert.equal(notice.textContent, 'Resposta registrada.');
});

test('writes status with textContent and never inserts response text as HTML', () => {
  assert.match(clientSource, /\.textContent\s*=/);
  assert.doesNotMatch(clientSource, /\.innerHTML\s*=/);
});
