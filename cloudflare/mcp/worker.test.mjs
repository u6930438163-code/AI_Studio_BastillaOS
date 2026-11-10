import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.mjs';

const base='https://bastilla.example.test';
const env={MCP_ACCESS_TOKEN:'local-test-token'};
const headers={'content-type':'application/json','authorization':'Bearer local-test-token'};
const call=async(method,payload,authenticated=true)=>{
  const req=new Request(base+'/mcp',{method:'POST',headers:authenticated?headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,...(payload?{params:payload}:{})})});
  const r=await worker.fetch(req,env);
  return {status:r.status,body:r.status===202?null:await r.json()};
};

test('public health is explicit that backend is not connected',async()=>{
  const r=await worker.fetch(new Request(base+'/health'),env);
  assert.equal(r.status,200);
  const data=await r.json();
  assert.equal(data.mcpConfigured,true);
  assert.equal(data.backendConfigured,false);
  assert.equal(data.backendVerified,false);
});
test('MCP without bearer cannot access tools',async()=>{
  const r=await call('tools/list',null,false);
  assert.equal(r.status,401);
});
test('initialize negotiates supported version',async()=>{
  const r=await call('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'test',version:'1'}});
  assert.equal(r.status,200);
  assert.equal(r.body.result.protocolVersion,'2025-06-18');
  assert.equal(r.body.result.serverInfo.name,'bastilla-os-live');
});
test('tools/list contains only read-only diagnostics',async()=>{
  const r=await call('tools/list');
  assert.deepEqual(r.body.result.tools.map(t=>t.name).sort(),
    ['agents_status','ollama_status','system_status','vm_status']);
  assert.equal(r.body.result.tools.every(t=>t.annotations.readOnlyHint),true);
});
test('tools/call never fabricates data when Codespaces is missing',async()=>{
  const r=await call('tools/call',{name:'ollama_status',arguments:{}});
  assert.equal(r.body.result.isError,true);
  const v=JSON.parse(r.body.result.content[0].text);
  assert.equal(v.error,'codespaces_backend_not_configured');
});
test('unknown tools rejected',async()=>{
  const r=await call('tools/call',{name:'shell_exec',arguments:{command:'whoami'}});
  assert.equal(r.body.error.code,-32602);
});
test('GET /mcp does not claim a supported SSE stream',async()=>{
  const r=await worker.fetch(new Request(base+'/mcp'),env);
  assert.equal(r.status,405);
});
