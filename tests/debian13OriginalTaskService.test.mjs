import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { OriginalAgentJobService, JobError, ORIGINAL_AGENTS,
  TASK_CAPABILITY, MESSAGE_CAPABILITY, SOURCE_REPOSITORY, TARGET_REPOSITORY
} from '../src/kernel/debian13OriginalTaskService.mjs';

function fixture(opts = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'original-agents-'));
  let current = Date.now();
  const file = path.join(tmp, 'jobs.json');
  const service = new OriginalAgentJobService({
    file, now: () => current, intervalMs: 1000, enabled: true, providerConfigured: true,
    execute: async (agent, task) => ({
      text: 'Original provider response: ' + agent + ' :: ' + task.title,
      provider: 'gemini', model: 'genuine-provider-test',
    }),
    ...opts,
  });
  return {
    file, service, now: (ms) => { current += ms; },
    dispose: () => { service.stop(); fs.rmSync(tmp, { recursive: true, force: true }); },
  };
}

function body(agent = 'Alex') {
  return {
    agent, capability: TASK_CAPABILITY,
    task: { title: 'Review API', description: 'Review the Debian 13 worker integration',
      kind: 'audit', targetRepository: TARGET_REPOSITORY },
    mode: 'pull_request_proposal', autoMerge: false, purchaseAuthorized: false,
  };
}

async function eventually(predicate) {
  for (let i = 0; i < 70; i++) {
    const result = predicate();
    if (result) return result;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw Error('Task never reached expected state');
}

test('Only original four agents appear, and no idle runner is claimed as working', () => {
  const f = fixture();
  try {
    const state = f.service.getWorkers();
    assert.equal(state.sourceRepository, SOURCE_REPOSITORY);
    assert.deepEqual(state.agents.map(x => x.name), ORIGINAL_AGENTS);
    assert.ok(state.agents.every(x => x.state === 'idle' && !x.workerVerified));
    assert.deepEqual(f.service.capabilities().capabilities,
      [TASK_CAPABILITY, MESSAGE_CAPABILITY]);
  } finally { f.dispose(); }
});

test('Disabled worker and missing provider fail closed', () => {
  const f = fixture({enabled: false});
  try {
    assert.throws(() => f.service.submitTask(body()), /original_workers_not_configured/);
    assert.deepEqual(f.service.capabilities().capabilities, []);
    assert.ok(f.service.getWorkers().agents.every(x => x.state === 'disabled'));
  } finally { f.dispose(); }
});

test('Review tasks are queued, invoke real adapter and never claim a PR was opened', async () => {
  const seen = [];
  const f = fixture({ execute: async (agent, task) => {
    seen.push({agent, task});
    return { text: 'Verified LLM result', provider: 'gemini', model: 'test' };
  }});
  try {
    const receipt = f.service.submitTask(body('Astyria'), 'stable-key');
    assert.equal(receipt.agent, 'Astyria');
    assert.equal(receipt.status, 'queued');
    assert.equal(f.service.submitTask(body('Astyria'), 'stable-key').taskId, receipt.taskId);
    assert.throws(() => f.service.submitTask(body('Alex'), 'stable-key'), /idempotency_key_conflict/);
    await f.service.tick();
    const done = await eventually(() => {
      const job = f.service.getJob(receipt.taskId);
      return job.status === 'completed' ? job : null;
    });
    assert.equal(done.result, 'Verified LLM result');
    assert.equal(done.provider, 'gemini');
    assert.equal(done.pullRequestVerified, false);
    assert.equal(done.workerExecutionVerified, true);
    assert.deepEqual(seen.map(x => x.agent), ['Astyria']);
    assert.equal(fs.statSync(f.file).mode & 0o777, 0o600);
  } finally { f.dispose(); }
});

test('Rejected action contract cannot bypass purchase/merge/target checks', () => {
  const f = fixture();
  try {
    for (const forbidden of [
      {...body(), autoMerge: true},
      {...body(), purchaseAuthorized: true},
      {...body(), task: {...body().task, targetRepository: 'untrusted/repo'}},
      {...body(), agent: 'FakeAlex'},
    ]) assert.throws(() => f.service.submitTask(forbidden), JobError);
    assert.throws(() => f.service.sendMessage({agent: 'Alex', message: '/exec rm -rf /',
      targetRepository: TARGET_REPOSITORY, mode: 'run_shell', autoMerge: false,
      purchaseAuthorized: false}), /invalid_message_contract/);
  } finally { f.dispose(); }
});

test('Failures are not reported as success and recover with bounded retries', async () => {
  const f = fixture({execute: async () => {throw Error('provider SECRET failure');}});
  try {
    const id = f.service.submitTask(body()).taskId;
    for (let attempt = 1; attempt <= 3; attempt++) {
      await f.service.tick();
      await eventually(() => f.service.getJob(id).attempts === attempt
        && f.service.getJob(id).status !== 'running');
      if (attempt < 3) {
        assert.equal(f.service.getJob(id).status, 'queued');
        f.now(31000 * attempt);
      }
    }
    const result = f.service.getJob(id);
    assert.equal(result.status, 'failed');
    assert.equal(result.errorCode, 'model_request_failed');
    assert.equal(result.result, null);
    assert.ok(!JSON.stringify(result).includes('SECRET'));
  } finally { f.dispose(); }
});

test('Crash recovery never claims stale running task is executing', async () => {
  let unblock;
  const wait = new Promise(resolve => { unblock = resolve; });
  const f = fixture({execute: async () => wait});
  try {
    const id = f.service.submitTask(body()).taskId;
    await f.service.tick();
    assert.equal(f.service.getJob(id).status, 'running');
    assert.equal(f.service.getWorkers().agents.find(x => x.name === 'Alex').state, 'running');
    const restarted = new OriginalAgentJobService({
      file: f.file, enabled: true, providerConfigured: true,
      execute: async () => ({text:'after restart',provider:'gemini',model:'test'}),
    });
    const pending = restarted.getJob(id);
    assert.equal(pending.status, 'queued');
    assert.equal(pending.workerExecutionVerified, false);
    unblock({text:'first process reply',provider:'gemini',model:'test'});
    await eventually(() => f.service.getJob(id).status === 'completed');
  } finally { f.dispose(); }
});

test('Messages go through real provider queue; no synthetic receipt of model reply', async () => {
  const f = fixture();
  try {
    const receipt = f.service.sendMessage({agent:'Aria',message:'Review the patch',
      mode:'review_only',targetRepository:TARGET_REPOSITORY,
      autoMerge:false,purchaseAuthorized:false}, 'message-key');
    assert.equal(receipt.agentReplyVerified, false);
    await f.service.tick();
    const reply = await eventually(() => f.service.getJob(receipt.messageId).status === 'completed'
      ? f.service.getJob(receipt.messageId) : null);
    assert.equal(reply.agent, 'Aria');
    assert.equal(reply.workerExecutionVerified, true);
  } finally { f.dispose(); }
});


test('Original workers target the active Debian 13 repo without preset roles or instructions', () => {
  const f = fixture();
  try {
    assert.equal(TARGET_REPOSITORY, 'mmitek515-netizen/Debian_13');
    const info = f.service.capabilities();
    assert.equal(info.targetRepository, TARGET_REPOSITORY);
    assert.deepEqual(info.agents, ['Alex', 'Aria', 'Astyria', 'Aurelius']);
    assert.equal(info.assignedRoles, false);
    assert.equal(info.customInstructions, false);
    const workers = f.service.getWorkers();
    assert.equal(workers.targetRepository, TARGET_REPOSITORY);
    assert.equal(workers.assignedRoles, false);
    assert.equal(workers.customInstructions, false);
    assert.throws(() => f.service.submitTask({
      ...body(), task: {...body().task, targetRepository: 'u6930438163-code/Debian_13_Trixie'},
    }), /invalid_review_task_contract/);
  } finally { f.dispose(); }
});

test('Shared Ollama serializes all four agents in arrival order across repeated ticks', async () => {
  const calls = [];
  const releases = [];
  const f = fixture({execute: (agent) => {
    calls.push(agent);
    return new Promise(resolve => releases.push(() => resolve({
      text: 'Ollama response', provider: 'ollama', model: 'local-test',
    })));
  }});
  try {
    const order = ['Aurelius', 'Aria', 'Astyria', 'Alex'];
    const ids = order.map(agent => f.service.submitTask(body(agent)).taskId);
    for (let i = 0; i < order.length; i++) {
      await f.service.tick();
      await f.service.tick();
      assert.deepEqual(calls, order.slice(0, i + 1));
      assert.equal(f.service.getWorkers().agents.filter(x => x.state === 'running').length, 1);
      assert.equal(f.service.getJob(ids[i]).status, 'running');
      releases[i]();
      await eventually(() => f.service.getJob(ids[i]).status === 'completed');
    }
    assert.ok(ids.every(id => f.service.getJob(id).provider === 'ollama'));
  } finally {
    releases.forEach(release => release());
    await new Promise(resolve => setImmediate(resolve));
    f.dispose();
  }
});

test('A failed agent releases Ollama for other agents and clears its error on recovery', async () => {
  let alexCalls = 0;
  const f = fixture({execute: async agent => {
    if (agent === 'Alex' && ++alexCalls === 1) throw Error('Ollama unavailable');
    return {text: 'Recovered response', provider: 'ollama', model: 'local-test'};
  }});
  try {
    const alex = f.service.submitTask(body('Alex')).taskId;
    const aria = f.service.submitTask(body('Aria')).taskId;
    await f.service.tick();
    await eventually(() => f.service.getJob(alex).errorCode === 'retry_scheduled');
    await f.service.tick();
    await eventually(() => f.service.getJob(aria).status === 'completed');
    assert.equal(f.service.getJob(alex).attempts, 1);
    f.now(31000);
    await f.service.tick();
    await eventually(() => f.service.getJob(alex).status === 'completed');
    assert.equal(f.service.getWorkers().agents.find(x => x.name === 'Alex').lastErrorCode, null);
  } finally { f.dispose(); }
});
