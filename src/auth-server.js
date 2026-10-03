// App-owned identity. The RX brand is shared; inspection ownership is checked by the Worker.
const AUTH_COOKIE = '__Host-rx_session';
const SESSION_SECONDS = 14 * 24 * 60 * 60;
const PASSWORD_ITERATIONS = 100000; // Cloudflare WebCrypto's PBKDF2 iteration limit.
const encoder = new TextEncoder();
class AuthError extends Error { constructor(message,status=400){super(message);this.status=status;} }
const hex = bytes => Array.from(new Uint8Array(bytes), b=>b.toString(16).padStart(2,'0')).join('');
const randomHex = () => hex(crypto.getRandomValues(new Uint8Array(32)));
async function digest(value){return hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)));}
function equalSecret(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let difference=0;for(let i=0;i<a.length;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i);return difference===0;}
async function passwordHash(password,salt){
  const material=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',iterations:PASSWORD_ITERATIONS,salt:encoder.encode(salt)},material,256));
}
function cookieName(request){return new URL(request.url).protocol==='https:'?AUTH_COOKIE:'rx_session_dev';}
function sessionCookie(request,token,maxAge=SESSION_SECONDS){return `${cookieName(request)}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${new URL(request.url).protocol==='https:'?'; Secure':''}`;}
function sessionToken(request){const name=cookieName(request);const value=(request.headers.get('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1);return /^[a-f0-9]{64}$/.test(value||'')?value:null;}
function publicUser(user){return {id:user.id,email:user.email,name:user.name,crea:user.crea,rnp:user.rnp,phone:user.phone,role:user.role};}
async function authenticatedUser(request,env){
  const token=sessionToken(request);if(!token)return null;
  return database(env).prepare('SELECT u.* FROM users u JOIN sessions s ON s.user_id = u.id WHERE s.token_hash = ? AND s.expires_at > ?').bind(await digest(token),Date.now()).first();
}
async function authBody(request){
  if(Number(request.headers.get('Content-Length'))>8192)throw new AuthError('Dados do cadastro muito grandes.',413);
  const body=await request.text();if(body.length>8192)throw new AuthError('Dados do cadastro muito grandes.',413);
  let data;try{data=JSON.parse(body);}catch{throw new AuthError('Dados inválidos.');}
  if(!data||typeof data!=='object'||Array.isArray(data))throw new AuthError('Dados inválidos.');return data;
}
function cleanEmail(value){if(typeof value!=='string')throw new AuthError('Informe um e-mail válido.');const email=value.trim().toLowerCase();if(email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new AuthError('Informe um e-mail válido.');return email;}
function checkPassword(value){if(typeof value!=='string'||value.length<12||value.length>128)throw new AuthError('Use uma senha com 12 a 128 caracteres.');return value;}
function profileFields(data){
  const result={};for(const [key,max] of [['name',200],['crea',120],['rnp',120],['phone',40]]){const value=data[key]??'';if(typeof value!=='string'||value.length>max)throw new AuthError('Confira os dados do perfil.');result[key]=value.trim();}
  if(result.name.length<2)throw new AuthError('Informe seu nome profissional.');return result;
}
async function authLimit(env,request,scope,max=15,seconds=600,identifier=''){
  const now=Date.now(),cutoff=now-seconds*1000;
  const identity=identifier||request.headers.get('CF-Connecting-IP')||'local';
  const key=scope+':'+await digest(identity);
  const result=await database(env).prepare('INSERT INTO auth_limits (key, window_start, attempts) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET attempts = CASE WHEN auth_limits.window_start <= ? THEN 1 ELSE auth_limits.attempts + 1 END, window_start = CASE WHEN auth_limits.window_start <= ? THEN excluded.window_start ELSE auth_limits.window_start END RETURNING attempts').bind(key,now,cutoff,cutoff).first();
  if(result.attempts>max)throw new AuthError('Muitas tentativas. Aguarde alguns minutos e tente novamente.',429);
}
async function createSession(request,env,user,extra=[]){
  const token=randomHex(),now=Date.now();
  await database(env).batch([...extra,
    database(env).prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now),
    database(env).prepare('DELETE FROM auth_limits WHERE window_start < ?').bind(now-86400000),
    database(env).prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').bind(await digest(token),user.id,now+SESSION_SECONDS*1000,now)
  ]);
  return Response.json({user:publicUser(user)},{headers:{'Cache-Control':'no-store','Set-Cookie':sessionCookie(request,token)}});
}
async function validOwnerSetup(env,token){return typeof token==='string'&&/^[a-f0-9]{64}$/.test(token)&&env.RX_OWNER_SETUP_HASH&&equalSecret(await digest(token),env.RX_OWNER_SETUP_HASH);}
async function legacyProfile(env){
  const rows=await database(env).prepare('SELECT document FROM inspections WHERE owner_id IS NULL ORDER BY updated_at DESC').all();
  const fields={crea:'',rnp:''};for(const row of rows.results){let doc;try{doc=JSON.parse(row.document);}catch{continue;}for(const key of ['crea','rnp'])if(!fields[key]&&typeof doc[key]==='string'&&doc[key].trim())fields[key]=doc[key].trim().slice(0,120);}
  return fields;
}
async function handleAuth(request,env){
  const path=new URL(request.url).pathname;
  if(path==='/api/auth/session'&&request.method==='GET'){const user=await authenticatedUser(request,env);return json({user:user?publicUser(user):null});}
  if(path==='/api/auth/owner-setup'&&request.method==='POST'){
    await authLimit(env,request,'owner-setup');const body=await authBody(request);
    if(!await validOwnerSetup(env,body.ownerSetupToken)||!env.RX_OWNER_EMAIL)throw new AuthError('Link de ativação inválido.');
    const email=cleanEmail(env.RX_OWNER_EMAIL);
    if(await database(env).prepare('SELECT id FROM users WHERE email = ?').bind(email).first())throw new AuthError('Seu perfil já foi ativado. Entre com seu e-mail e senha.',409);
    return json({email,name:env.RX_OWNER_NAME||'',...await legacyProfile(env)});
  }
  if(path==='/api/auth/signup'&&request.method==='POST'){
    await authLimit(env,request,'signup',10,3600);
    const body=await authBody(request),email=cleanEmail(body.email),password=checkPassword(body.password),profile=profileFields(body);
    const isOwner=!!env.RX_OWNER_EMAIL&&email===cleanEmail(env.RX_OWNER_EMAIL);
    if(isOwner&&!await validOwnerSetup(env,body.ownerSetupToken))throw new AuthError('Este perfil precisa do link exclusivo de ativação do titular.',403);
    if(await database(env).prepare('SELECT id FROM users WHERE email = ?').bind(email).first())throw new AuthError('Não foi possível criar o cadastro com este e-mail. Se já tem uma conta, use Entrar.',409);
    if(isOwner){const previous=await legacyProfile(env);for(const key of ['crea','rnp'])if(!profile[key])profile[key]=previous[key];}
    const now=new Date().toISOString(),salt=randomHex();
    const user={id:crypto.randomUUID(),email,...profile,role:isOwner?'admin':'engineer'};
    const statements=[database(env).prepare('INSERT INTO users (id, email, name, crea, rnp, phone, password_salt, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(user.id,email,profile.name,profile.crea,profile.rnp,profile.phone,salt,await passwordHash(password,salt),user.role,now,now)];
    if(isOwner)statements.push(database(env).prepare('UPDATE inspections SET owner_id = ? WHERE owner_id IS NULL').bind(user.id));
    try{return await createSession(request,env,user,statements);}catch(error){if(/unique/i.test(error.message))throw new AuthError('Não foi possível criar o cadastro com este e-mail. Se já tem uma conta, use Entrar.',409);throw error;}
  }
  if(path==='/api/auth/login'&&request.method==='POST'){
    await authLimit(env,request,'login-ip',30);
    const body=await authBody(request),email=cleanEmail(body.email);
    await authLimit(env,request,'login-email',15,600,email);
    if(typeof body.password!=='string'||!body.password.length||body.password.length>128)throw new AuthError('E-mail ou senha incorretos.',401);
    const user=await database(env).prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
    const hash=await passwordHash(body.password,user?.password_salt||'0'.repeat(64));
    if(!user||!equalSecret(hash,user.password_hash))throw new AuthError('E-mail ou senha incorretos.',401);
    return createSession(request,env,user);
  }
  if(path==='/api/auth/logout'&&request.method==='POST'){
    const token=sessionToken(request);if(token)await database(env).prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await digest(token)).run();
    return Response.json({loggedOut:true},{headers:{'Cache-Control':'no-store','Set-Cookie':sessionCookie(request,'',0),'Clear-Site-Data':'"cache"'}});
  }
  if(path==='/api/profile'){
    const user=await authenticatedUser(request,env);if(!user)throw new AuthError('Entre na sua conta para continuar.',401);
    if(request.method==='GET')return json({user:publicUser(user)});
    if(request.method==='PUT'){
      const profile=profileFields(await authBody(request));
      await database(env).prepare('UPDATE users SET name = ?, crea = ?, rnp = ?, phone = ?, updated_at = ? WHERE id = ?').bind(profile.name,profile.crea,profile.rnp,profile.phone,new Date().toISOString(),user.id).run();
      return json({user:publicUser({...user,...profile})});
    }
  }
  if(path==='/api/auth/password'&&request.method==='POST'){
    const user=await authenticatedUser(request,env);if(!user)throw new AuthError('Entre na sua conta para continuar.',401);
    await authLimit(env,request,'password-change',10,600,user.id);
    const body=await authBody(request),password=checkPassword(body.password);
    if(typeof body.currentPassword!=='string'||body.currentPassword.length>128||!equalSecret(await passwordHash(body.currentPassword,user.password_salt),user.password_hash))throw new AuthError('A senha atual está incorreta.');
    const salt=randomHex();return createSession(request,env,user,[
      database(env).prepare('UPDATE users SET password_salt = ?, password_hash = ?, updated_at = ? WHERE id = ?').bind(salt,await passwordHash(password,salt),new Date().toISOString(),user.id),
      database(env).prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id)
    ]);
  }
  return null;
}
