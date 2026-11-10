/**
 * Bastilla OS: authenticated stateless MCP endpoint (protocol 2025-06-18).
 * Never substitutes fake state for an unavailable Codespaces backend.
 */
const VERSION='2025-06-18';
const SERVER={name:'bastilla-os-live',version:'1.0.0'};
const ROUTES=Object.freeze({
  system_status:{path:'/system',description:'Read actual CPU/RAM metrics from Bastilla OS in Codespaces.'},
  ollama_status:{path:'/ollama',description:'Read actual Ollama connectivity, installed models and availability.'},
  agents_status:{path:'/agents',description:'Read actual agent background diagnostics; configured does not mean online.'},
  vm_status:{path:'/vm',description:'Read actual VM configuration and runtime without starting a VM.'}
});
const HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:HEADERS});
const rpcError=(id,code,message,status=200)=>respond({jsonrpc:'2.0',id,error:{code,message}},status);
const toolResult=(data,isError=false)=>({content:[{type:'text',text:JSON.stringify(data)}],isError});
async function callBackend(name,env){
  if(!env.BACKEND_URL||!env.BACKEND_TOKEN)
    return toolResult({error:'codespaces_backend_not_configured',detail:'BACKEND_URL and BACKEND_TOKEN must be set; no data is simulated.'},true);
  let origin;
  try{
    origin=new URL(env.BACKEND_URL);
    if(origin.protocol!=='https:'||origin.username||origin.password||origin.search||origin.hash)throw Error();
  }catch{return toolResult({error:'invalid_backend_url',detail:'BACKEND_URL must be a direct HTTPS origin.'},true);}
  try{
    const target=new URL(ROUTES[name].path,origin);
    const upstream=await fetch(target.toString(),{
      method:'GET',redirect:'error',
      headers:{authorization:'Bearer '+env.BACKEND_TOKEN,accept:'application/json'},
      signal:AbortSignal.timeout(12000)
    });
    const raw=await upstream.text();
    if(raw.length>100000)return toolResult({error:'backend_response_too_large',httpStatus:upstream.status},true);
    let data;
    try{data=JSON.parse(raw);}catch{return toolResult({error:'backend_non_json_response',httpStatus:upstream.status},true);}
    if(!upstream.ok)return toolResult({error:'backend_http_error',httpStatus:upstream.status,response:data},true);
    return toolResult(data);
  }catch(e){return toolResult({error:'backend_unreachable',detail:e?.name==='TimeoutError'?'timeout':'network_error'},true);}
}
export default {
  async fetch(request,env){
    const path=new URL(request.url).pathname;
    if(path==='/health'&&request.method==='GET')
      return respond({service:SERVER.name,transport:'streamable-http-stateless',
        mcpConfigured:Boolean(env.MCP_ACCESS_TOKEN),
        backendConfigured:Boolean(env.BACKEND_URL&&env.BACKEND_TOKEN),
        backendVerified:false,dataSource:'live-only'});
    if(path!=='/mcp')return respond({error:'not_found'},404);
    if(request.method!=='POST')return respond({error:'method_not_allowed',allowed:'POST'},405);
    if(!env.MCP_ACCESS_TOKEN)return respond({error:'mcp_access_not_configured'},503);
    if(request.headers.get('authorization')!=='Bearer '+env.MCP_ACCESS_TOKEN)
      return respond({error:'unauthorized'},401);
    if(!(request.headers.get('content-type')||'').includes('application/json'))
      return respond({error:'content_type_must_be_json'},415);
    let msg;
    try{
      const body=await request.text();
      if(body.length>64000)return respond({error:'request_too_large'},413);
      msg=JSON.parse(body);
    }catch{return rpcError(null,-32700,'Parse error',400);}
    if(!msg||Array.isArray(msg)||msg.jsonrpc!=='2.0'||typeof msg.method!=='string')
      return rpcError(msg?.id??null,-32600,'Invalid Request',400);
    if(msg.id===undefined)return new Response(null,{status:202,headers:{'cache-control':'no-store'}});
    let result;
    switch(msg.method){
      case 'initialize':
        result={protocolVersion:VERSION,capabilities:{tools:{listChanged:false}},serverInfo:SERVER};break;
      case 'ping':result={};break;
      case 'tools/list':
        result={tools:Object.entries(ROUTES).map(([name,item])=>({
          name,description:item.description,inputSchema:{type:'object',properties:{},additionalProperties:false},
          annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false}
        }))};break;
      case 'tools/call':{
        const name=msg.params?.name;
        if(typeof name!=='string'||!Object.hasOwn(ROUTES,name))return rpcError(msg.id,-32602,'Unknown tool');
        if(msg.params?.arguments&&Object.keys(msg.params.arguments).length)return rpcError(msg.id,-32602,'Tool takes no arguments');
        result=await callBackend(name,env);break;
      }
      default:return rpcError(msg.id,-32601,'Method not found');
    }
    return respond({jsonrpc:'2.0',id:msg.id,result});
  }
};
