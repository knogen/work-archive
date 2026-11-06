import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generate} from '../worker/openai.mjs';
import {sseFrame} from '../shared/sse.mjs';

for(const model of ['gpt-6-luna','offline-other-model'])test(`generation pins Standard tier and compatible cache policy (${model})`,async()=>{
  let request;
  const fetcher=async(url,options)=>{
    request=JSON.parse(options.body);
    return new Response(new ReadableStream({start(c){c.enqueue(sseFrame('message',{type:'response.completed',response:{usage:{input_tokens:10,output_tokens:2}}}));c.close();}}));
  };
  await generate(model,{instructions:'Offline test',input:'Hello'},{maxOutput:2000,inputPrice:.125,outputPrice:.5},{OPENAI_API_KEY:'offline-test-not-real'},new AbortController().signal,()=>{},fetcher);
  assert.equal(request.service_tier,'default');
  assert.equal(request.store,false);assert.equal(request.max_output_tokens,2000);
  if(model==='gpt-6-luna')assert.deepEqual(request.prompt_cache_options,{ttl:'30m'});
  else assert.equal(request.prompt_cache_options,undefined);
});
