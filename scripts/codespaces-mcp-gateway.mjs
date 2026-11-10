/**
 * Dedicated read-only Codespaces gateway for Cloudflare MCP.
 * Do not publish ports 3000 or 8000. Only port 8788 may be forwarded.
 * Missing BASTILLA_GATEWAY_TOKEN prevents startup. No shell or write routes.
 */
import http from 'node:http';
import {timingSafeEqual} from 'node:crypto';
const PORT=Number(process.env.BASTILLA_GATEWAY_PORT||8788);
const TOKEN=process.env.BASTILLA_GATEWAY_TOKEN||'';
const APP=process.env.BASTILLA_LOCAL_API||'http://127.0.0.1:3000';
if(TOKEN.length<32){console.error('Set BASTILLA_GATEWAY_TOKEN (at least 32 characters).');process.exit(1);}
const PATHS=Object.freeze({
  '/system':['/api/system/metrics'],
  '/ollama':['/api/ollama/models'],
  '/agents':['/api/agents/background/status'],
  '/vm':['/api/vm-gemini-4/status','/api/vm-gemini-4/runtime']
});
function send(res,status,obj){
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
  res.end(JSON.stringify(obj));
}
function authorized(value){
  const provided=typeof value==='string'&&value.startsWith('Bearer ')?value.slice(7):'';
  const a=Buffer.from(provided),b=Buffer.from(TOKEN);
  return a.length===b.length&&timingSafeEqual(a,b);
}
async function retrieve(path){
  const target=new URL(path,APP);
  const response=await fetch(target,{method:'GET',redirect:'error',signal:AbortSignal.timeout(9000)});
  const raw=await response.text();
  if(raw.length>100000)return {ok:false,httpStatus:502,error:'response_too_large'};
  try{return {ok:response.ok,httpStatus:response.status,data:JSON.parse(raw)};}
  catch{return {ok:false,httpStatus:502,error:'non_json_app_response',upstreamStatus:response.status};}
}
http.createServer(async(req,res)=>{
  if(req.method!=='GET'||!Object.hasOwn(PATHS,req.url||''))return send(res,404,{error:'not_found'});
  if(!authorized(req.headers.authorization))return send(res,401,{error:'unauthorized'});
  const paths=PATHS[req.url],result={};
  let failed=false;
  try{
    for(const path of paths){
      result[path]=await retrieve(path);
      if(!result[path].ok)failed=true;
    }
    return send(res,failed?502:200,paths.length===1?result[paths[0]]:result);
  }catch(e){return send(res,503,{error:'local_bastilla_unreachable',detail:e?.name==='TimeoutError'?'timeout':'network_error'});}
}).listen(PORT,'0.0.0.0',()=>console.log('Read-only Bastilla gateway listening on port '+PORT));
