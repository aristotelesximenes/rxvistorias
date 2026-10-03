const HTML = __HTML__;
const json = (data, status=200) => Response.json(data, {status, headers:{'Cache-Control':'no-store'}});
const statuses = new Set(['pending','ok','issue','na']);
function validate(doc) {
  if(!doc || typeof doc !== 'object' || !Array.isArray(doc.rooms) || doc.rooms.length < 1 || doc.rooms.length > 30) throw new Error('Dados da vistoria inválidos.');
  const result = {};
  for(const field of ['property','propertyType','area','address','unit','owner','inspector','builder','date','type','notes','crea','rnp','art','company','limitations','methodology','considerations','recommendations','finalNote']) {
    const value=doc[field]??'';
    if(typeof value !== 'string' || value.length > (['notes','limitations','methodology','considerations','recommendations','finalNote'].includes(field)?8000:500)) throw new Error('Preencha os dados do imóvel corretamente.');
    result[field]=value;
  }
  if(!result.property.trim()) throw new Error('Informe o nome do imóvel.');
  if(result.area && (!Number.isFinite(Number(result.area)) || Number(result.area)<=0)) throw new Error('Informe uma área construída válida.');
  if(result.propertyType && !['Apartamento','Casa','Imóvel comercial','Condomínio'].includes(result.propertyType)) throw new Error('Tipo de imóvel inválido.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(result.date)) throw new Error('Informe a data da vistoria.');
  const ids=new Set();
  result.rooms=doc.rooms.map(room=>{
    if(typeof room.id!=='string' || typeof room.name!=='string' || !room.name.trim() || room.name.length>100 || !Array.isArray(room.items) || !room.items.length || room.items.length>80) throw new Error('Ambiente inválido.');
    return {id:room.id.slice(0,100),name:room.name,items:room.items.map(item=>{
      if(typeof item.id!=='string' || ids.has(item.id) || typeof item.title!=='string' || typeof item.hint!=='string' || typeof item.notes!=='string' || item.notes.length>8000 || item.title.length>200 || item.hint.length>1000 || !statuses.has(item.status) || !['low','medium','high'].includes(item.severity)) throw new Error('Item do checklist inválido.');
      ids.add(item.id);
      for(const field of ['nonconformity','location','recommendation'])if(typeof (item[field]??'')!=='string'||(item[field]??'').length>8000)throw new Error('Descrição inválida.');
      const references=item.normativeReferences??[];
      if(!Array.isArray(references)||references.length>10)throw new Error('Informe até 10 referências normativas por item.');
      const normativeReferences=references.map(ref=>{
        if(!ref||typeof ref!=='object'||Array.isArray(ref))throw new Error('Referência normativa inválida.');
        const clean={};
        for(const [field,max] of [['standard',300],['edition',100],['clause',300],['justification',4000]]){const value=ref[field]??'';if(typeof value!=='string'||value.length>max)throw new Error('Referência normativa inválida.');clean[field]=value;}
        for(const [field,max] of [['catalogId',100],['summary',1500],['source',500]])if(ref[field]!==undefined){if(typeof ref[field]!=='string'||ref[field].length>max)throw new Error('Referência normativa inválida.');clean[field]=ref[field];}
        if(clean.source){const url=new URL(clean.source);if(url.protocol!=='https:'||!['www.abntcatalogo.com.br','www.target.com.br','www.normas.com.br','buscanormas.com.br','www.iso.org'].includes(url.hostname))throw new Error('Fonte da referência inválida.');}
        return clean;
      });
      return {id:item.id.slice(0,100),title:item.title,hint:item.hint,status:item.status,notes:item.notes,severity:item.severity,nonconformity:item.nonconformity??'',location:item.location??'',recommendation:item.recommendation??'',normativeReferences};
    })};
  });
  result.completed=doc.completed===true;
  if(result.completed && result.rooms.some(r=>r.items.some(i=>i.status==='pending' || (i.status==='issue' && (!i.notes.trim() || !i.nonconformity.trim()))))) throw new Error('Confira todos os itens e descreva as não conformidades antes de concluir.');
  if(result.completed && result.rooms.some(r=>r.items.some(i=>i.status==='issue'&&i.normativeReferences.some(ref=>Object.values(ref).some(v=>v.trim())&&!ref.standard.trim()))))throw new Error('Informe a identificação da norma nas referências preenchidas.');
  return result;
}
const database = env => {if(!env.DB) throw new Error('Armazenamento indisponível.');return env.DB;};
async function record(env,id,user){return database(env).prepare('SELECT * FROM inspections WHERE id = ? AND owner_id = ?').bind(id,user.id).first();}
async function hydrate(env,row){
  const photos=await database(env).prepare('SELECT id, item_id, filename FROM photos WHERE inspection_id = ?').bind(row.id).all();
  return {id:row.id,revision:row.revision,createdAt:row.created_at,updatedAt:row.updated_at,...JSON.parse(row.document),photos:photos.results};
}
function sameOrigin(request){
  const origin=request.headers.get('Origin');
  if(origin && origin!==new URL(request.url).origin) return false;
  return request.headers.get('Sec-Fetch-Site')!=='cross-site';
}
export default {
  async fetch(request,env) {
    const url=new URL(request.url), path=url.pathname;
    try {
      if(path==='/manifest.webmanifest')return Response.json({name:'RX Engenharia e Projetos - Vistorias',short_name:'RX Vistorias',start_url:'/',scope:'/',display:'standalone',background_color:'#f6f6f6',theme_color:'#111111',lang:'pt-BR',icons:[{src:'/app-icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any'}]},{headers:{'Content-Type':'application/manifest+json'}});
      if(path==='/app-icon.svg')return new Response('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#151515"/><path d="m112 240 144-128 144 128v160H112Z" fill="none" stroke="#fa8b18" stroke-width="40" stroke-linejoin="round"/><path d="m176 288 48 48 112-112" fill="none" stroke="#fa8b18" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/></svg>',{headers:{'Content-Type':'image/svg+xml','Cache-Control':'public, max-age=86400'}});
      if(path==='/' && request.method==='GET') return new Response(HTML,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'}});
      if(!path.startsWith('/api/')) return new Response('Página não encontrada.',{status:404});
      if(!['GET','HEAD'].includes(request.method) && !sameOrigin(request)) return json({error:'Origem não permitida.'},403);
      const authResponse=await handleAuth(request,env);if(authResponse)return authResponse;
      const user=await authenticatedUser(request,env);
      if(!user)return json({error:'Entre na sua conta para continuar.'},401);
      if(path==='/api/branding' && request.method==='GET'){
        const rows=await database(env).prepare('SELECT slot, filename, updated_at FROM brand_assets').all();
        return json({assets:rows.results});
      }
      const brandAsset=path.match(/^\/api\/branding\/assets\/(white|dark|footer)$/);
      if(brandAsset){
        const slot=brandAsset[1];
        const previous=await database(env).prepare('SELECT * FROM brand_assets WHERE slot = ?').bind(slot).first();
        if(request.method==='GET'){
          if(!previous)return json({error:'Imagem da empresa não cadastrada.'},404);
          const object=await env.BUCKET.get(previous.object_key);
          if(!object)return json({error:'Imagem indisponível.'},404);
          return new Response(object.body,{headers:{'Content-Type':previous.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
        }
        if(request.method==='POST'){
          if(user.role!=='admin')return json({error:'A identidade visual é gerenciada pela RX.'},403);
          if(Number(request.headers.get('Content-Length'))>6*1024*1024)return json({error:'Use uma imagem com até 5 MB.'},413);
          const form=await request.formData(),file=form.get('file');
          if(!file||typeof file==='string'||!['image/png','image/jpeg','image/webp'].includes(file.type)||!file.size||file.size>5*1024*1024)return json({error:'Use um PNG, JPG ou WebP com até 5 MB.'},400);
          const bytes=await file.arrayBuffer(),sig=new Uint8Array(bytes);
          const valid=file.type==='image/jpeg'?sig[0]===255&&sig[1]===216&&sig[2]===255:file.type==='image/png'?sig[0]===137&&sig[1]===80&&sig[2]===78&&sig[3]===71:String.fromCharCode(...sig.slice(0,4))==='RIFF'&&String.fromCharCode(...sig.slice(8,12))==='WEBP';
          if(!valid)return json({error:'Imagem inválida.'},400);
          if(!env.BUCKET)throw new Error('Armazenamento de imagens indisponível.');
          const key=`branding/${slot}/${crypto.randomUUID()}`,now=new Date().toISOString();
          await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:file.type}});
          try{await database(env).prepare('INSERT INTO brand_assets (slot, object_key, mime, filename, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(slot) DO UPDATE SET object_key = excluded.object_key, mime = excluded.mime, filename = excluded.filename, updated_at = excluded.updated_at').bind(slot,key,file.type,file.name.slice(0,200),now).run();}
          catch(error){await env.BUCKET.delete(key);throw error;}
          if(previous)try{await env.BUCKET.delete(previous.object_key);}catch(error){console.error('Old brand image cleanup failed:',error.message);}
          return json({slot,filename:file.name,updated_at:now},201);
        }
      }
      if(path==='/api/inspections') {
        if(request.method==='GET') {
          const rows=await database(env).prepare('SELECT * FROM inspections WHERE owner_id = ? ORDER BY updated_at DESC LIMIT 150').bind(user.id).all();
          return json(await Promise.all(rows.results.map(row=>hydrate(env,row))));
        }
        if(request.method==='POST') {
          if(Number(request.headers.get('Content-Length'))>1000000) return json({error:'Vistoria muito grande.'},413);
          const doc=validate(await request.json()); const id=crypto.randomUUID(),now=new Date().toISOString();
          await database(env).prepare('INSERT INTO inspections (id, owner_id, document, revision, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)').bind(id,user.id,JSON.stringify(doc),now,now).run();
          return json({id,revision:1,createdAt:now,updatedAt:now,...doc,photos:[]},201);
        }
      }
      const match=path.match(/^\/api\/inspections\/([\w-]+)$/);
      if(match && request.method==='PUT') {
        if(Number(request.headers.get('Content-Length'))>1000000) return json({error:'Vistoria muito grande.'},413);
        const input=await request.json();const doc=validate(input); const row=await record(env,match[1],user);
        if(!row) return json({error:'Vistoria não encontrada.'},404);
        if(!Number.isInteger(input.revision)) return json({error:'Versão da vistoria inválida.'},400);
        const now=new Date().toISOString();
        const result=await database(env).prepare('UPDATE inspections SET document = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND owner_id = ? AND revision = ?').bind(JSON.stringify(doc),now,match[1],user.id,input.revision).run();
        if(result.meta.changes!==1) return json({error:'Esta vistoria foi alterada em outra janela. Seus dados continuam nesta tela. Reabra a vistoria antes de continuar.'},409);
        return json({revision:input.revision+1,updatedAt:now});
      }
      const upload=path.match(/^\/api\/inspections\/([\w-]+)\/photos$/);
      if(upload && request.method==='POST') {
        const row=await record(env,upload[1],user);if(!row) return json({error:'Vistoria não encontrada.'},404);
        if(JSON.parse(row.document).completed) return json({error:'Reabra a vistoria para adicionar fotos.'},400);
        if(Number(request.headers.get('Content-Length'))>9*1024*1024) return json({error:'A foto deve ter até 8 MB.'},413);
        const form=await request.formData(),file=form.get('file'),itemId=form.get('itemId');
        if(!file || typeof file==='string' || !['image/jpeg','image/png','image/webp'].includes(file.type) || file.size>8*1024*1024 || file.size===0) return json({error:'Use uma foto JPG, PNG ou WebP com até 8 MB.'},400);
        if(!JSON.parse(row.document).rooms.some(r=>r.items.some(i=>i.id===itemId))) return json({error:'Item não encontrado.'},400);
        const count=await database(env).prepare('SELECT COUNT(*) AS count FROM photos WHERE inspection_id = ? AND item_id = ?').bind(upload[1],itemId).first();
        if(count.count>=8) return json({error:'Você pode adicionar até 8 fotos por item.'},400);
        if(!env.BUCKET) throw new Error('Armazenamento de fotos indisponível.');
        const bytes=await file.arrayBuffer();const sig=new Uint8Array(bytes);
        const valid=file.type==='image/jpeg'?sig[0]===255&&sig[1]===216&&sig[2]===255:file.type==='image/png'?sig[0]===137&&sig[1]===80&&sig[2]===78&&sig[3]===71:String.fromCharCode(...sig.slice(0,4))==='RIFF'&&String.fromCharCode(...sig.slice(8,12))==='WEBP';
        if(!valid) return json({error:'O arquivo não é uma foto válida.'},400);
        const id=crypto.randomUUID(),key=`inspections/${upload[1]}/${id}`;
        await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:file.type}});
        try{await database(env).prepare('INSERT INTO photos (id, inspection_id, item_id, object_key, mime, filename, bytes) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id,upload[1],itemId,key,file.type,file.name.slice(0,200),file.size).run();}
        catch(error){await env.BUCKET.delete(key);throw error;}
        return json({id,item_id:itemId,filename:file.name},201);
      }
      const photo=path.match(/^\/api\/photos\/([\w-]+)$/);
      if(photo) {
        const row=await database(env).prepare('SELECT p.* FROM photos p JOIN inspections i ON i.id = p.inspection_id WHERE p.id = ? AND i.owner_id = ?').bind(photo[1],user.id).first();
        if(!row) return json({error:'Foto não encontrada.'},404);
        if(request.method==='GET') {
          const object=await env.BUCKET.get(row.object_key);if(!object) return json({error:'Foto indisponível.'},404);
          return new Response(object.body,{headers:{'Content-Type':row.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
        }
        if(request.method==='DELETE') {
          const parent=await record(env,row.inspection_id,user);
          if(parent && JSON.parse(parent.document).completed) return json({error:'Reabra a vistoria para remover fotos.'},400);
          await env.BUCKET.delete(row.object_key);
          await database(env).prepare('DELETE FROM photos WHERE id = ?').bind(row.id).run();
          return json({removed:true});
        }
      }
      return json({error:'Recurso não encontrado.'},404);
    }catch(error){
      if(error instanceof AuthError)return json({error:error.message},error.status);
      console.error('Inspection request failed:',error.message);
      const known=/inválid|Informe|Preencha|Confira|Ambiente|checklist/.test(error.message);
      return json({error:known?error.message:'Não foi possível acessar suas vistorias. Tente novamente; suas alterações nesta tela foram mantidas.'},known?400:503);
    }
  }
};
