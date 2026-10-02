let cameraSession=null,cameraSerial=0;
function stopCameraStream(){if(cameraSession?.stream){cameraSession.stream.getTracks().forEach(track=>track.stop());cameraSession.stream=null;}document.querySelector('#camera-video').srcObject=null;}
function resetCameraPreview(){const preview=document.querySelector('#camera-preview');if(cameraSession?.previewUrl)URL.revokeObjectURL(cameraSession.previewUrl);if(cameraSession){cameraSession.file=null;cameraSession.previewUrl=null;}preview.removeAttribute('src');preview.hidden=true;document.querySelector('#camera-video').hidden=false;document.querySelector('#camera-retake').hidden=true;document.querySelector('#camera-use').hidden=true;document.querySelector('#camera-capture').hidden=false;}
function closeCamera(){if(cameraSession?.uploading){toast('Aguarde o envio da foto terminar.',true);return;}cameraSerial++;stopCameraStream();resetCameraPreview();cameraSession=null;document.querySelector('#camera-dialog').close();}
async function startCamera(){
  const serial=++cameraSerial;stopCameraStream();resetCameraPreview();const error=document.querySelector('#camera-error'),loading=document.querySelector('#camera-loading');error.textContent='';loading.hidden=false;document.querySelector('#camera-capture').disabled=true;document.querySelector('#camera-retry').hidden=true;
  try{
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('Este navegador não disponibilizou a câmera. Abra o app em uma versão atualizada do Chrome e permita o acesso à câmera.');
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}},audio:false});
    if(serial!==cameraSerial||!cameraSession){stream.getTracks().forEach(track=>track.stop());return;}
    cameraSession.stream=stream;const video=document.querySelector('#camera-video');video.srcObject=stream;
    await new Promise(resolve=>{if(video.readyState>=1)resolve();else video.addEventListener('loadedmetadata',resolve,{once:true});});
    if(serial!==cameraSerial)return;await video.play();if(serial!==cameraSerial)return;
    loading.hidden=true;document.querySelector('#camera-capture').disabled=false;
  }catch(err){
    if(serial!==cameraSerial)return;stopCameraStream();loading.hidden=true;document.querySelector('#camera-retry').hidden=false;
    const message=err.name==='NotAllowedError'?'O acesso à câmera foi bloqueado. Libere a permissão de câmera para este app nas configurações do navegador e tente novamente.':err.name==='NotFoundError'?'Nenhuma câmera foi encontrada neste aparelho.':err.name==='NotReadableError'?'A câmera está sendo usada por outro aplicativo. Feche esse aplicativo e tente novamente.':err.message||'Não foi possível abrir a câmera. Tente novamente.';
    error.textContent=message;
  }
}
async function openCamera(itemId){
  if(!S.active||S.active.completed)return;await flush();
  const room=S.active.rooms.find(r=>r.items.some(i=>i.id===itemId)),item=findItem(itemId);
  if(photosFor(S.active,itemId).length>=8){toast('Você pode adicionar até 8 fotos por item.',true);return;}
  cameraSession={inspection:S.active,itemId,stream:null,file:null,previewUrl:null,uploading:false};
  document.querySelector('#camera-location').textContent=room.name+' · '+item.title;
  document.querySelector('#camera-dialog').showModal();await startCamera();
}
async function capturePhoto(){
  if(!cameraSession?.stream)return;
  const session=cameraSession,video=document.querySelector('#camera-video');if(!video.videoWidth||!video.videoHeight)return;
  const button=document.querySelector('#camera-capture');button.disabled=true;
  try{
    const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;canvas.getContext('2d').drawImage(video,0,0);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.92));if(!blob)throw new Error('Não foi possível capturar a foto. Tente novamente.');
    if(cameraSession!==session)return;
    session.file=new File([blob],'Vistoria-'+new Date().toISOString().replace(/[:.]/g,'-')+'.jpg',{type:'image/jpeg'});session.previewUrl=URL.createObjectURL(blob);
    const preview=document.querySelector('#camera-preview');preview.src=session.previewUrl;preview.hidden=false;video.hidden=true;document.querySelector('#camera-loading').hidden=true;button.hidden=true;document.querySelector('#camera-retake').hidden=false;document.querySelector('#camera-use').hidden=false;stopCameraStream();
  }catch(error){document.querySelector('#camera-error').textContent=error.message;}finally{button.disabled=false;}
}
async function useCameraPhoto(){
  const session=cameraSession;if(!session?.file||session.uploading)return;session.uploading=true;S.busyPhotos++;
  const buttons=[...document.querySelectorAll('#camera-dialog button')];buttons.forEach(button=>{button.disabled=true;});const use=document.querySelector('#camera-use');const original=use.innerHTML;use.textContent='Enviando foto…';
  try{
    const form=new FormData();form.append('file',session.file);form.append('itemId',session.itemId);
    const photo=await api('/api/inspections/'+session.inspection.id+'/photos',{method:'POST',body:form});session.inspection.photos.push(photo);S.expanded.add(session.itemId);session.uploading=false;closeCamera();if(S.active?.id===session.inspection.id)renderActive();toast('Foto capturada e adicionada à vistoria.');
  }catch(error){document.querySelector('#camera-error').textContent=error.message;}finally{session.uploading=false;S.busyPhotos=Math.max(0,S.busyPhotos-1);buttons.forEach(button=>{button.disabled=false;});use.innerHTML=original;}
}
document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-action]');if(!button)return;const action=button.dataset.action;
  if(!['camera','close-camera','retry-camera','retake-photo','capture-photo','use-photo'].includes(action))return;
  event.preventDefault();
  try{
    if(action==='camera')await openCamera(button.dataset.item);
    if(action==='close-camera')closeCamera();
    if(action==='retry-camera'||action==='retake-photo')await startCamera();
    if(action==='capture-photo')await capturePhoto();
    if(action==='use-photo')await useCameraPhoto();
  }catch(error){toast(error.message,true);}
});
document.querySelector('#camera-dialog').addEventListener('cancel',event=>{event.preventDefault();closeCamera();});
window.addEventListener('pagehide',()=>{cameraSerial++;stopCameraStream();});
