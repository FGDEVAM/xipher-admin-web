import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const config=window.XIPHER_CONFIG;
const $=id=>document.getElementById(id);
const sb=createClient(config.url,config.publishableKey);
const apiUrl=`${config.url}/functions/v1/xipher-api`;
let snapshot=null, selectedUser=null, focusedDeviceId=null;
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
function batteryNumber(dev){const n=parseInt(String(dev.battery||'').match(/\d+/)?.[0]??'-1',10);return Number.isFinite(n)?n:-1;}
function escapeDeviceName(dev){return String(dev.name||'Android device');}
function closeDetails(){$('deviceDrawer').classList.add('hidden');focusedDeviceId=null;}
function openDetails(dev){
 if(!dev){closeDetails();return;}
 focusedDeviceId=dev.id;
 $('drawerName').textContent='◈ '+escapeDeviceName(dev);
 $('drawerStatus').textContent=dev.status?'●  ONLINE  /  CONNECTED':'○  OFFLINE  /  DISCONNECTED';
 $('drawerStatus').style.color=dev.status?'var(--green)':'var(--muted)';
 $('drawerBattery').textContent=String(dev.battery??'—');
 $('drawerAndroid').textContent=String(dev.android??'—');
 $('drawerId').textContent=String(dev.id??'');
 $('deviceDrawer').classList.remove('hidden');
}
function printInventory(){
 const parent=$('inventoryList');parent.replaceChildren();
 const needle=$('inventorySearch').value.trim().toLowerCase(),filter=$('inventoryFilter').value,sort=$('inventorySort').value;
 const items=(snapshot?.devices??[]).filter(dev=>(filter==='all'||(filter==='online')===Boolean(dev.status))&&
    (!needle||escapeDeviceName(dev).toLowerCase().includes(needle)||String(dev.id).toLowerCase().includes(needle)))
    .sort((a,b)=>sort==='name'?escapeDeviceName(a).localeCompare(escapeDeviceName(b)):
        sort==='battery'?batteryNumber(b)-batteryNumber(a):
        Number(Boolean(b.status))-Number(Boolean(a.status))||escapeDeviceName(a).localeCompare(escapeDeviceName(b)));
 for(const dev of items){
    const card=safeText('button','', 'device-card');card.type='button';card.onclick=()=>openDetails(dev);
    const top=safeText('div','', 'device-top');
    const name=safeText('span','◈  '+escapeDeviceName(dev),'device-name');
    const state=safeText('span',dev.status?'● ONLINE':'○ OFFLINE','device-status'+(dev.status?' online':''));
    top.append(name,state);
    const stats=safeText('div','⚡ '+String(dev.battery??'—')+'   ·   ◇ Android '+String(dev.android??'—'),'device-stats');
    const id=safeText('div','ID  '+String(dev.id??'')+'   ↗','device-id');
    card.append(top,stats,id);parent.append(card);
 }
 if(!items.length)parent.append(safeText('p',snapshot?.devices?.length?'No matching devices.':'No authorized devices connected yet.','muted'));
 if(focusedDeviceId){
    const focused=(snapshot?.devices??[]).find(d=>d.id===focusedDeviceId);
    if(focused)openDetails(focused);else closeDetails();
 }
}
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
$('refresh').onclick=async()=>{try{await load();notice('Inventory synchronized.');}catch(e){notice(e.message);}};
for(const id of ['inventorySearch','inventoryFilter','inventorySort'])$(id).addEventListener(id==='inventorySearch'?'input':'change',printInventory);
$('closeDrawer').onclick=closeDetails;
$('deviceDrawer').addEventListener('click',e=>{if(e.target===$('deviceDrawer'))closeDetails();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('deviceDrawer').classList.contains('hidden'))closeDetails();});
$('drawerCopy').onclick=async()=>{
 const id=focusedDeviceId;if(!id)return;
 try{await navigator.clipboard.writeText(id);notice('Device ID copied.');}
 catch{notice('Copy unavailable. Select and copy the ID manually.');}
};

(async()=>{const {data:{session}}=await sb.auth.getSession();if(session){showDashboard(true);try{await load();}catch(e){notice(e.message);showDashboard(false);await sb.auth.signOut();}}else showDashboard(false);})();
