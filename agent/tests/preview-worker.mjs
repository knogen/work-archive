// LOCAL-ONLY entry point. Never referenced by the deployment configuration.
import {createWorker} from '../worker/index.mjs';
import {sseFrame} from '../shared/sse.mjs';
export {BudgetLedger} from '../worker/budget.mjs';

async function mockOpenAI(url,options) {
  if(!String(url).startsWith('https://api.openai.com/v1/'))throw Error('Preview forbids external requests');
  const body=JSON.parse(options.body);
  if(String(url).endsWith('/input_tokens'))return Response.json({object:'response.input_tokens',input_tokens:Math.ceil(JSON.stringify(body).length/2)});
  const supplied=JSON.parse(body.input.at(-1).content),records=supplied.records.slice(0,3);
  const answer=`【本地流程演示 · 模拟回答，未调用 OpenAI】\n\n真实检索已找到以下档案节点。部署并填入密钥后，将由模型结合这些资料生成回答。\n\n${records.map((n,i)=>`${i+1}. ${n.title}（${n.date}）\n${n.text.slice(0,260)} [${n.id}]`).join('\n\n')}\n\n这份演示仅摘录检索结果，不新增历史结论。`;
  const chunks=answer.match(/[\s\S]{1,24}/g)||[];
  return new Response(new ReadableStream({async start(controller){
    for(const delta of chunks){if(options.signal?.aborted){controller.error(new DOMException('Aborted','AbortError'));return;}controller.enqueue(sseFrame('message',{type:'response.output_text.delta',delta}));await new Promise(resolve=>setTimeout(resolve,30));}
    controller.enqueue(sseFrame('message',{type:'response.completed',response:{usage:{input_tokens:Math.ceil(JSON.stringify(body).length/2),output_tokens:Math.ceil(answer.length/2)}}}));controller.close();
  }}),{headers:{'Content-Type':'text/event-stream'}});
}

export default createWorker(mockOpenAI);
