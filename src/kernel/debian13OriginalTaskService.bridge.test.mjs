import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  OriginalAgentJobService, TASK_CAPABILITY, ALLOWED_TARGET_REPOSITORIES,
} from './debian13OriginalTaskService.mjs';

const DEPLOYED_REPO = 'mmitek515-netizen/Debian_13';
const LEGACY_REPO = 'u6930438163-code/Debian_13_Trixie';

function fixture(t) {
  const directory = mkdtempSync(path.join(tmpdir(), 'original-agent-bridge-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'review-queue.json');
  const service = new OriginalAgentJobService({
    file, enabled: true, providerConfigured: true,
    execute: async () => ({ text: 'test-only-review', provider: 'fixture', model: 'test' }),
  });
  return { service, file };
}

function submit(agent, targetRepository) {
  return {
    agent,
    capability: TASK_CAPABILITY,
    task: {
      id: 'operator-task-1', title: 'Sprawdź moduł GUI',
      description: 'Test zadania bez narzuconych ról.',
      targetRepository, kind: 'development',
    },
    mode: 'pull_request_proposal', purchaseAuthorized: false, autoMerge: false,
  };
}

test('supports both exact target repositories; rejects unrelated repositories', t => {
  const { service } = fixture(t);
  assert.deepEqual(ALLOWED_TARGET_REPOSITORIES, [LEGACY_REPO, DEPLOYED_REPO]);
  assert.deepEqual(service.capabilities().targetRepositories, [LEGACY_REPO, DEPLOYED_REPO]);
  for (const [i, agent] of ['Alex', 'Aria', 'Astyria', 'Aurelius'].entries()) {
    const received = service.submitTask(submit(agent, DEPLOYED_REPO), 'requested-' + i);
    assert.equal(received.accepted, true);
    assert.equal(service.getJob(received.taskId).targetRepository, DEPLOYED_REPO);
    assert.equal(service.getJob(received.taskId).status, 'queued');
  }
  assert.throws(() => service.submitTask(submit('Alex', 'untrusted-user/other-repo')),
                { code: 'invalid_review_task_contract' });
});

test('idempotency remains scoped to target and exact job details', t => {
  const { service } = fixture(t);
  const first = service.submitTask(submit('Alex', DEPLOYED_REPO), 'same-key');
  assert.equal(service.submitTask(submit('Alex', DEPLOYED_REPO), 'same-key').taskId, first.taskId);
  assert.throws(() => service.submitTask(submit('Alex', LEGACY_REPO), 'same-key'),
                { code: 'idempotency_key_conflict' });
});

test('reload preserves queued tasks from both repositories, no tasks created by default', t => {
  const { service, file } = fixture(t);
  assert.deepEqual(service.jobs, []);
  service.submitTask(submit('Aria', LEGACY_REPO), 'legacy-review');
  service.submitTask(submit('Aurelius', DEPLOYED_REPO), 'new-review');
  const restarted = new OriginalAgentJobService({
    file, enabled: true, providerConfigured: true,
    execute: async () => ({ text: 'fixture', provider: 'fixture', model: 'fixture' }),
  });
  assert.equal(restarted.jobs.length, 2);
  assert.deepEqual(new Set(restarted.jobs.map(j => j.targetRepository)),
                   new Set([LEGACY_REPO, DEPLOYED_REPO]));
  assert.equal(restarted.getWorkers().agents.length, 4);
  assert.ok(restarted.getWorkers().agents.every(a => a.state === 'idle'));
});
