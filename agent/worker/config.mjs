export class ApiError extends Error {
  constructor(status, code, message) { super(message);this.status=status;this.code=code; }
}
export const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function number(value,fallback,min,max,label) {
  const n=value===undefined||value===''?fallback:Number(value);
  if(!Number.isFinite(n)||n<min||n>max)throw new ApiError(503,'configuration',`服务配置尚未完成（${label}）。`);
  return n;
}
export function config(env) {
  const dailyMicros=Math.floor(number(env.DAILY_BUDGET_USD,1,0.01,100,'日预算')*1e6);
  const authMode=env.AUTH_MODE||'token';
  if(!['public','token','turnstile'].includes(authMode))throw new ApiError(503,'configuration','访问方式尚未配置。');
  // Public mode uses this server-only material exclusively as an IP HMAC salt.
  // Reusing the existing salt preserves per-IP counters when removing the access gate.
  const secret=authMode==='public'?(env.USER_HASH_SECRET||env.AGENT_ACCESS_TOKEN):authMode==='token'?env.AGENT_ACCESS_TOKEN:env.TURNSTILE_SECRET_KEY;
  if(!secret||secret.length<24)throw new ApiError(503,'configuration',authMode==='public'?'匿名限流标识尚未配置。':'问答访问凭证尚未配置。');
  const origins=String(env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
  if(!origins.length||origins.includes('*')||origins.some(x=>{try{return new URL(x).origin!==x;}catch{return true;}}))throw new ApiError(503,'configuration','站点来源尚未配置。');
  return {dailyMicros,authMode,secret,origins,perUserDaily:20,perMinute:5,maxConcurrent:3,maxDailyRequests:300,leaseMs:120000};
}
export function modelConfig(env) {
  const model=String(env.OPENAI_MODEL||'').trim();
  if(!env.OPENAI_API_KEY||!model||!/^[a-zA-Z0-9._-]+$/.test(model))throw new ApiError(503,'configuration','OpenAI 模型与密钥尚未配置。');
  // Required current USD prices per million tokens. No guessed/fallback prices.
  const inputPrice=number(env.INPUT_USD_PER_MILLION,NaN,0.000001,1000,'输入单价');
  const outputPrice=number(env.OUTPUT_USD_PER_MILLION,NaN,0.000001,1000,'输出单价');
  return {model,inputPrice,outputPrice,maxInput:12000,maxOutput:2000};
}
// 1 USD per million tokens = 1 micro-USD per token. Round upward.
export const costMicros=(input,output,prices)=>Math.ceil(input*prices.inputPrice+output*prices.outputPrice);
export const beijingDay=(now=Date.now())=>new Date(now+8*3600000).toISOString().slice(0,10);
export async function readJson(request,maxBytes=24576) {
  if(!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json'))throw new ApiError(415,'content_type','请使用 JSON 请求。');
  if(Number(request.headers.get('Content-Length'))>maxBytes)throw new ApiError(413,'body_size','问题或对话过长，请缩短后重试。');
  const reader=request.body?.getReader();if(!reader)throw new ApiError(400,'json','请求为空。');
  const chunks=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new ApiError(413,'body_size','问题或对话过长，请缩短后重试。');}chunks.push(value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.byteLength;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new ApiError(400,'json','请求格式无效。');}
}
