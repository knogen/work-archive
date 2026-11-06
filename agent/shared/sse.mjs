// Handles split UTF-8 code points, CRLF, multiline data, and multiple frames per chunk.
export async function* sseEvents(stream) {
  const reader=stream.getReader(),decoder=new TextDecoder();let buffer='';
  const parse=frame=>{
    let event='message';const data=[];
    for(const line of frame.split('\n')){
      if(line.startsWith('event:'))event=line.slice(6).trim();
      if(line.startsWith('data:'))data.push(line.slice(5).replace(/^ /,''));
    }
    return data.length?{event,data:data.join('\n')}:null;
  };
  try{
    while(true){
      const {done,value}=await reader.read();buffer+=decoder.decode(value,{stream:!done});
      buffer=buffer.replace(/\r\n/g,'\n');
      let at;while((at=buffer.indexOf('\n\n'))!==-1){const frame=parse(buffer.slice(0,at));buffer=buffer.slice(at+2);if(frame)yield frame;}
      if(buffer.length>1024*1024)throw Error('SSE frame exceeds limit');
      if(done){if(buffer.trim()){const frame=parse(buffer);if(frame)yield frame;}break;}
    }
  }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
export const sseFrame=(event,data)=>new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
