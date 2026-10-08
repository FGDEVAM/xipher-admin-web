import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const config=window.XIPHER_CONFIG;
const $=id=>document.getElementById(id);
const sb=createClient(config.url,config.publishableKey);
const apiUrl=`${config.url}/functions/v1/xipher-api`;
let snapshot=null, selectedUser=null;
const notice=msg=>{$('notice').textContent=msg;};
const safeText=(tag,content,style='')=>{const el=document.createElement(tag);el.textContent=String(content??'');if(style)el.className=style;return el;};
const button=(label,fn,cls='secondary')=>{const el=document.createElement('button');el.textContent=label;el.className=cls;el.type='button';el.onclick=fn;return el;};
async function api(action,data={}){
 const {data:{session}}=await sb.auth.getSession();if(!session)throw Error('Please sign in.');
 const response=await fetch(apiUrl,{method:'POST',headers:{'Content-Type':'application/json','apikey':config.publishableKey,'Authorization':`Bearer ${session.access_token}`},body:JSON.stringify({action,...data})});
 const payload=await response.json();if(!response.ok)throw Error(payload.error||'Request failed');return payload;
}
async function act(action,data){try{notice('Saving…');await api(action,data);notice('Saved successfully.');await load();}catch(e){notice(e.message);}}
function showDashboard(yes){$('login').classList.toggle('hidden',yes);$('content').classList.toggle('hidden',!yes);$('logout').classList.toggle('hidden',!yes);}
function printSources(){const parent=$('sourcesList');parent.replaceChildren();for(const s of snapshot.sources??[]){const div=safeText('div','','item');const row=safeText('div','','row');row.append(safeText('strong',s.label));row.append(button('Remove',()=>{if(confirm(`Remove source ${s.label}?`))act('removeSource',{id:s.id});},'danger'));div.append(row,safeText('small',s.url));parent.append(div);} if(!parent.childNodes.length)parent.append(safeText('p','No sources added.','muted'));}
function printInventory(){const parent=$('inventoryList');parent.replaceChildren();for(const dev of snapshot.devices??[]){const div=safeText('div','','item');div.append(safeText('strong',`${dev.name} · ${dev.status?'Online':'Offline'}`));div.append(safeText('small',`${dev.id} · Android ${dev.android} · Battery ${dev.battery}`));parent.append(div);}if(!parent.childNodes.length)parent.append(safeText('p','No inventory available or authorized sources not connected.','muted'));}
function printUsers(){const parent=$('usersList');parent.replaceChildren();for(const u of snapshot.users??[]){const row=safeText('div','','item');row.append(button(`${u.username} — ${u.enabled?'Active':'Disabled'}`,()=>chooseUser(u.id)));parent.append(row);}if(!parent.childNodes.length)parent.append(safeText('p','No APK users yet.','muted'));}
function showSelection(){$('selectionPanel').classList.toggle('hidden',$('scope').value!=='selected');}
function chooseUser(id){selectedUser=id;const u=snapshot.users.find(x=>x.id===id);if(!u)return;
 $('noUser').classList.add('hidden');$('userForm').classList.remove('hidden');$('chosenUsername').textContent=u.username;
 $('maxDevices').value=u.max_devices;$('scope').value=u.scope;$('enabled').checked=u.enabled;
 $('selected').value=(u.selected_ids??[]).join('\n');showSelection();
 const parent=$('phonesList');parent.replaceChildren();const items=(snapshot.installs??[]).filter(x=>x.user_id===id);
 for(const i of items){const el=safeText('div','','item');el.append(safeText('strong',i.device_label + (i.revoked?' — revoked':'')));if(!i.revoked)el.append(button('Revoke',()=>act('revokeInstall',{uid:id,hash:i.installation_hash}),'danger'));parent.append(el);}
 if(!items.length)parent.append(safeText('p','No registered phones.','muted'));
}
async function load(){const next=await api('adminOverview');snapshot=next;
 $('total').textContent=next.devices.length;$('online').textContent=next.online;$('members').textContent=next.users.length;
 printSources();printUsers();printInventory();if(selectedUser)chooseUser(selectedUser);
 if(next.partial)notice('Some authorized source databases could not be read. Check source credentials / network.');
}
$('loginForm').onsubmit=async e=>{e.preventDefault();const {error}=await sb.auth.signInWithPassword({email:$('email').value,password:$('password').value});if(error){notice('Sign in failed.');return;}$('password').value='';showDashboard(true);try{await load();notice('');}catch(err){notice(err.message);showDashboard(false);await sb.auth.signOut();}};
$('logout').onclick=async()=>{await sb.auth.signOut();showDashboard(false);selectedUser=null;};
$('sourceForm').onsubmit=async e=>{e.preventDefault();await act('addSource',{label:$('sourceName').value,url:$('sourceUrl').value,secret:$('sourceSecret').value});$('sourceSecret').value='';};
$('createForm').onsubmit=async e=>{e.preventDefault();await act('createUser',{username:$('newUser').value,password:$('newPassword').value,maxDevices:Number($('newLimit').value)});$('newPassword').value='';};
$('scope').onchange=showSelection;
$('userForm').onsubmit=async e=>{e.preventDefault();if(!selectedUser)return;await act('updateUser',{uid:selectedUser,enabled:$('enabled').checked,mode:$('scope').value,maxDevices:Number($('maxDevices').value),selectedIds:$('selected').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean)});};
$('resetPass').onclick=async()=>{if(!selectedUser)return;const p=prompt('New password, minimum 12 characters');if(p!==null)await act('resetPassword',{uid:selectedUser,password:p});};
$('deleteUser').onclick=async()=>{if(selectedUser&&confirm('Delete this APK user?')){const uid=selectedUser;selectedUser=null;$('userForm').classList.add('hidden');$('noUser').classList.remove('hidden');await act('deleteUser',{uid});}};
$('refresh').onclick=async()=>{try{await load();notice('Updated');}catch(e){notice(e.message);}};
(async()=>{const {data:{session}}=await sb.auth.getSession();if(session){showDashboard(true);try{await load();}catch(e){notice(e.message);showDashboard(false);await sb.auth.signOut();}}else showDashboard(false);})();
