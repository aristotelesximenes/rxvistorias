const BRAND={name:'RX Engenharia e Projetos',legalName:'A X Campelo Engenharia',cnpj:'66.476.617/0001-96',assets:{},saving:false};
function companyCopyright(){return `© ${new Date().getFullYear()} ${BRAND.name} · ${BRAND.legalName} · CNPJ ${BRAND.cnpj}. Todos os direitos reservados.`;}
function brandImageUrl(slot){const asset=BRAND.assets[slot];return asset?`/api/branding/assets/${slot}?v=${encodeURIComponent(asset.updated_at)}`:'';}
function updateCompanyBrand(){
  const el=document.querySelector('.brand'),dark=brandImageUrl('dark'),white=brandImageUrl('white');
  if(el)el.innerHTML=dark||white?`<img class="rx-logo ${dark?'dark':'white'}" src="${dark||white}" alt="RX Engenharia e Projetos">`:'<span class="rx-brand-name">RX<span>ENGENHARIA E PROJETOS</span></span>';
  document.querySelectorAll('.sidebar-copyright').forEach(el=>{el.textContent=`© ${new Date().getFullYear()} RX Engenharia e Projetos`;});
  document.querySelectorAll('.brand-copyright').forEach(el=>{el.textContent=companyCopyright();});
  const foot=document.querySelector('.app-copyright');if(foot)foot.textContent=companyCopyright();
}
async function loadCompanyBrand(){
  const result=await api('/api/branding');
  BRAND.assets=Object.fromEntries(result.assets.map(asset=>[asset.slot,asset]));updateCompanyBrand();return BRAND;
}
function renderBrandSettings(){
  document.querySelector('#brand-assets').innerHTML=[['white','Logo para o relatório','LOGO NOVA.png','Usada no cabeçalho do PDF.'],['dark','Logo com fundo preto','LOGO FUNDO PRETO COMPLETA.png','Usada na identificação do app.'],['footer','Rodapé completo','rodape completo.png','Usado no rodapé de todas as páginas do PDF.']].map(([slot,title,filename,description])=>{
    const asset=BRAND.assets[slot],src=brandImageUrl(slot);
    return `<section class="brand-asset-card"><div class="brand-asset-heading"><div><h3>${title}</h3><p>${description}</p></div><span class="badge ${asset?'done':'pending'}">${asset?'Carregado':'Sem imagem'}</span></div>${src?`<div class="brand-asset-preview ${slot==='dark'||slot==='footer'?'on-black':''}"><img src="${src}" alt="${title}"></div>`:''}<div class="brand-asset-actions"><span class="brand-file-name">${esc(asset?.filename||filename)}</span><label class="button secondary small brand-file-button" tabindex="0">${asset?'Substituir imagem':'Carregar imagem'}<input class="brand-file-input" type="file" accept="image/png,image/jpeg,image/webp" data-brand-slot="${slot}" ${BRAND.saving?'disabled':''}></label></div></section>`;
  }).join('');
}
document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-action]');if(!button)return;
  if(button.dataset.action==='brand-settings'){
    event.preventDefault();if(!S.user||S.user.role!=='admin')return;document.querySelector('#brand-upload-error').textContent='';
    try{await loadCompanyBrand();renderBrandSettings();document.querySelector('#brand-dialog').showModal();}catch(error){toast('Não foi possível carregar a identidade visual. Tente novamente.',true);}
  }
  if(button.dataset.action==='close-brand'){
    event.preventDefault();if(BRAND.saving){toast('Aguarde o carregamento da imagem terminar.',true);return;}document.querySelector('#brand-dialog').close();
  }
});
document.addEventListener('keydown',event=>{const label=event.target.closest('.brand-file-button');if(label&&(event.key==='Enter'||event.key===' ')){event.preventDefault();label.querySelector('input').click();}});
document.addEventListener('change',async event=>{
  const input=event.target;if(!input.matches('.brand-file-input'))return;
  const file=input.files[0];if(!file)return;
  if(BRAND.saving){toast('Aguarde o carregamento da imagem terminar.',true);return;}
  const errorEl=document.querySelector('#brand-upload-error');errorEl.textContent='';
  try{
    if(file.size>5*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Use um PNG, JPG ou WebP com até 5 MB.');
    const bitmap=await createImageBitmap(file);const valid=bitmap.width<=12000&&bitmap.height<=12000;bitmap.close();if(!valid)throw new Error('A imagem deve ter até 12.000 pixels em cada lado.');
    BRAND.saving=true;document.querySelectorAll('.brand-file-input').forEach(el=>{el.disabled=true;});
    const form=new FormData();form.append('file',file);
    const asset=await api('/api/branding/assets/'+input.dataset.brandSlot,{method:'POST',body:form});BRAND.assets[asset.slot]=asset;updateCompanyBrand();toast('Imagem da empresa salva. Os próximos PDFs usarão essa imagem.');
    if(S.active&&S.tab==='report')renderActive();
  }catch(error){errorEl.textContent=error.message||'Não foi possível carregar a imagem. Tente novamente.';}
  finally{BRAND.saving=false;renderBrandSettings();}
});
async function brandImageForPDF(slot){
  const url=brandImageUrl(slot);if(!url)return null;
  const response=await fetch(url);if(!response.ok)throw new Error('A imagem da empresa não carregou. Tente gerar o relatório novamente.');
  const blob=await response.blob(),bitmap=await createImageBitmap(blob);const result={data:new Uint8Array(await blob.arrayBuffer()),width:bitmap.width,height:bitmap.height,format:blob.type==='image/jpeg'?'JPEG':blob.type==='image/webp'?'WEBP':'PNG'};bitmap.close();return result;
}
