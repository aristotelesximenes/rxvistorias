const AUTH={channel:typeof BroadcastChannel==='function'?new BroadcastChannel('rx-vistorias-account'):null,mode:'login',setupToken:'',setupProfile:null,expired:false,busy:false};
function authScreen(mode='login',message=''){
  AUTH.mode=mode;$('#auth-screen').hidden=false;$('.app-shell').hidden=true;
  const signup=mode==='signup'||mode==='owner',profile=AUTH.setupProfile;
  const email=AUTH.expired&&S.user?S.user.email:mode==='owner'?profile?.email||'':'';
  $('#auth-content').innerHTML=`<span class="eyebrow">${mode==='owner'?'PRIMEIRO ACESSO DO TITULAR':'BEM-VINDO AO RX VISTORIAS'}</span><h2>${signup?'Criar meu cadastro':AUTH.expired?'Entre novamente':'Entrar na sua conta'}</h2><p class="auth-subtitle">${mode==='owner'?'Ative seu perfil para continuar com as vistorias que você já criou.':signup?'Cadastre seu perfil profissional e comece sua primeira vistoria.':AUTH.expired?'Sua sessão terminou. Entre na mesma conta para continuar.':'Acesse suas vistorias, fotos e relatórios.'}</p><form id="auth-form">
    ${signup?`<label>Nome profissional <span class="required">*</span><input name="name" required minlength="2" maxlength="200" autocomplete="name" value="${esc(mode==='owner'?profile?.name||'':'')}" placeholder="Seu nome nos relatórios"></label>`:''}
    <label>E-mail <span class="required">*</span><input name="email" type="email" required maxlength="254" autocomplete="username" inputmode="email" autocapitalize="none" spellcheck="false" value="${esc(email)}" ${email?'readonly':''} placeholder="voce@exemplo.com"></label>
    <label>${signup?'Crie sua senha':'Senha'} <span class="required">*</span><input name="password" type="password" required ${signup?'minlength="6"':''} maxlength="128" autocomplete="${signup?'new-password':'current-password'}" placeholder="${signup?'Pelo menos 6 caracteres':'Sua senha'}"></label>
    ${signup?`<label>Confirmar senha <span class="required">*</span><input name="confirmation" type="password" required minlength="6" maxlength="128" autocomplete="new-password" placeholder="Repita sua senha"></label><div class="form-grid auth-professional"><label>CREA / UF<input name="crea" maxlength="120" value="${esc(mode==='owner'?profile?.crea||'':'')}" placeholder="Número e UF"></label><label>RNP<input name="rnp" maxlength="120" value="${esc(mode==='owner'?profile?.rnp||'':'')}" placeholder="Registro nacional"></label></div>`:''}
    <p class="password-rule">Use pelo menos 6 caracteres. Pode usar apenas letras ou números, sem exigir maiúsculas ou símbolos.</p><label class="show-password"><input type="checkbox" id="show-auth-password">Mostrar senha</label>
    <p class="auth-error form-error" id="auth-error" role="alert">${esc(message)}</p><button class="button primary auth-submit" type="submit" id="auth-submit">${signup?'Criar cadastro e entrar':'Entrar'}</button>
    </form>${!AUTH.expired?`<p class="auth-switch">${signup?'Já tem cadastro?':'Primeiro acesso?'} <button class="text-button" type="button" data-action="${signup?'auth-login':'auth-signup'}">${signup?'Entrar':'Criar cadastro'}</button></p>`:''}<p class="auth-private">${icon('shield')}Cada profissional acessa apenas suas próprias vistorias.</p>`;
  if(!signup)$('#auth-form [name="password"]')?.focus({preventScroll:true});
}
function accountUI(){
  $('#account-name').textContent=S.user?.name||'Meu perfil';
  document.querySelectorAll('[data-action="brand-settings"]').forEach(el=>{el.hidden=S.user?.role!=='admin';});
}
function closeAccountDialogs(){document.querySelectorAll('dialog[open]').forEach(d=>d.close());if(typeof closeCamera==='function')closeCamera();$('#full-photo').removeAttribute('src');$('#print-report').innerHTML='';}
function clearAccount(){clearTimeout(S.saveTimer);S.generation++;Object.assign(S,{user:null,inspections:[],active:null,roomId:null,dirty:false,saving:false,saveError:'',savePromise:null,busyPhotos:0,deletePhoto:null});S.expanded.clear();$('#main').innerHTML='';$('#recent-list').innerHTML='';closeAccountDialogs();accountUI();}
function authExpired(){if(AUTH.expired)return;AUTH.expired=true;clearTimeout(S.saveTimer);closeAccountDialogs();authScreen('login','Sua sessão expirou. Suas alterações nesta tela serão mantidas ao entrar novamente.');}
async function enterAccount(user){
  const resume=AUTH.expired&&S.user?.id===user.id;
  if(!resume)clearAccount();S.user=user;AUTH.expired=false;AUTH.setupToken='';AUTH.setupProfile=null;
  $('#auth-screen').hidden=true;$('.app-shell').hidden=false;accountUI();AUTH.channel?.postMessage({type:'session-changed'});
  await loadCompanyBrand().catch(()=>{});
  if(resume&&S.active){render();if(S.dirty)await save().catch(error=>toast(error.message,true));}else await load();
}
async function startAuth(){
  try{
    const fragment=new URLSearchParams(location.hash.slice(1)),token=fragment.get('ativar');
    if(token){history.replaceState(null,'',location.pathname+location.search);AUTH.setupToken=token;
      try{AUTH.setupProfile=await api('/api/auth/owner-setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ownerSetupToken:token})});authScreen('owner');return;}catch(error){AUTH.setupToken='';authScreen('login',error.message);return;}
    }
    const result=await api('/api/auth/session');if(result.user)await enterAccount(result.user);else authScreen();
  }catch(error){authScreen('login',error.message);}
}
document.addEventListener('submit',async event=>{
  if(event.target.id!=='auth-form')return;event.preventDefault();
  if(AUTH.busy)return;const form=event.target,data=Object.fromEntries(new FormData(form)),signup=AUTH.mode!=='login';
  const error=$('#auth-error'),button=$('#auth-submit');error.textContent='';
  if(signup&&data.password!==data.confirmation){error.textContent='As senhas precisam ser iguais.';return;}
  if(AUTH.setupToken&&signup)data.ownerSetupToken=AUTH.setupToken;delete data.confirmation;
  AUTH.busy=true;button.disabled=true;button.textContent=signup?'Criando seu perfil…':'Entrando…';
  try{const result=await api('/api/auth/'+(signup?'signup':'login'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});form.reset();await enterAccount(result.user);toast(signup?'Seu perfil foi criado. Bem-vindo ao RX Vistorias.':'Você entrou na sua conta.');}
  catch(e){error.textContent=e.message;}finally{AUTH.busy=false;if(button.isConnected){button.disabled=false;button.textContent=signup?'Criar cadastro e entrar':'Entrar';}}
});
document.addEventListener('change',event=>{if(event.target.id==='show-auth-password')document.querySelectorAll('#auth-form input[name="password"],#auth-form input[name="confirmation"]').forEach(el=>{el.type=event.target.checked?'text':'password';});});
document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-action]');if(!button)return;const action=button.dataset.action;
  if(action==='auth-login'||action==='auth-signup'){event.preventDefault();if(AUTH.busy)return;authScreen(action==='auth-signup'?(AUTH.setupToken?'owner':'signup'):'login');return;}
  if(action==='close-profile'){event.preventDefault();if(AUTH.busy)return;$('#profile-dialog').close();$('#password-form').reset();return;}
  if(action==='profile'&&S.user&&!AUTH.expired){
    event.preventDefault();const form=$('#profile-form');for(const key of ['email','name','crea','rnp','phone'])form.elements[key].value=S.user[key]||'';
    $('#profile-error').textContent='';$('#password-error').textContent='';$('#password-form').reset();$('.password-details').open=false;$('#profile-dialog').showModal();return;
  }
  if(action==='logout'&&S.user){
    event.preventDefault();if(AUTH.busy)return;AUTH.busy=true;button.disabled=true;
    try{await flush();if(BRAND.saving)throw new Error('Aguarde o carregamento da imagem terminar.');await api('/api/auth/logout',{method:'POST'});clearAccount();AUTH.expired=false;AUTH.channel?.postMessage({type:'session-changed'});authScreen();toast('Você saiu da sua conta.');}
    catch(error){toast(error.message,true);}finally{AUTH.busy=false;button.disabled=false;}
  }
});
$('#profile-form').addEventListener('submit',async event=>{
  event.preventDefault();if(AUTH.busy)return;const form=event.target,data=Object.fromEntries(new FormData(form)),button=$('#profile-save');delete data.email;
  AUTH.busy=true;button.disabled=true;$('#profile-error').textContent='';
  try{const result=await api('/api/profile',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});S.user=result.user;accountUI();toast('Perfil salvo. As novas vistorias usarão esses dados.');}
  catch(error){$('#profile-error').textContent=error.message;}
  finally{AUTH.busy=false;button.disabled=false;}
});
$('#password-form').addEventListener('submit',async event=>{
  event.preventDefault();if(AUTH.busy)return;const data=Object.fromEntries(new FormData(event.target)),button=$('#password-save');$('#password-error').textContent='';
  if(data.password!==data.confirmation){$('#password-error').textContent='As senhas precisam ser iguais.';return;}delete data.confirmation;
  AUTH.busy=true;button.disabled=true;
  try{await api('/api/auth/password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});event.target.reset();$('.password-details').open=false;toast('Senha alterada. Os outros aparelhos precisarão entrar novamente.');}
  catch(error){$('#password-error').textContent=error.message;}
  finally{AUTH.busy=false;button.disabled=false;}
});
async function syncAccount(){if(!S.user||AUTH.busy||AUTH.expired)return;try{const result=await api('/api/auth/session');if(!result.user||result.user.id!==S.user?.id)authExpired();}catch{}}
if(AUTH.channel)AUTH.channel.onmessage=()=>syncAccount();
window.addEventListener('pageshow',event=>{if(event.persisted)syncAccount();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')syncAccount();});
startAuth();
