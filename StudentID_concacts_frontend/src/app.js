const BASE = (window.API_BASE || '');
const API  = BASE + '/api/contacts';
const API_GROUPS = API + '/groups';

const $  = (q) => document.querySelector(q);

const tbody = $('#tbody');
const empty = $('#empty');
const form  = $('#form');

const inputId    = $('#id');
const inputName  = $('#name');
const inputPhone = $('#phone');
const inputEmail = $('#email');
const inputGroup = $('#group');
const inputNote  = $('#note');
const inputBlack = $('#blacklisted');

const formError  = $('#form-error');
const btnSave    = $('#btn-save');
const btnReset   = $('#btn-reset');

const searchBox  = $('#search');
const btnRefresh = $('#btn-refresh');
const toastEl    = $('#toast');

const groupFilter = $('#group-filter');
const blacklistFilter = $('#blacklist-filter');

let listCache = [];
let pollingTimer = null;
let groupsCache = [];

function toast(msg, ok=true){
    toastEl.textContent = msg;
    toastEl.style.background = ok ? '#111' : '#ef4444';
    toastEl.classList.remove('hidden');
    setTimeout(()=> toastEl.classList.add('hidden'), 1600);
}

function escapeHtml(s){ return (s??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function normalizePhone(s){ return (s || '').trim().replace(/[\s\-().]/g, ''); }

function renderGroups(){
    const cur = groupFilter.value;
    groupFilter.innerHTML = `<option value="">All Groups</option>` +
        groupsCache.map(g => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join('');
    groupFilter.value = cur || '';
}

function filterLocalBySearch(list, keyword){
    if(!keyword) return list;
    const q = keyword.toLowerCase();
    return list.filter(x =>
        (x.name||'').toLowerCase().includes(q) ||
        (x.phone||'').toLowerCase().includes(q) ||
        (x.email||'').toLowerCase().includes(q) ||
        (x.group_name||'').toLowerCase().includes(q) ||
        (x.note||'').toLowerCase().includes(q)
    );
}

function render(list){
    if(!list || list.length===0){
        tbody.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');
    tbody.innerHTML = list.map(r => `
    <tr>
      <td>${r.id}</td>
      <td>${escapeHtml(r.name)}</td>
      <td>${escapeHtml(r.phone||'')}</td>
      <td>${escapeHtml(r.email||'')}</td>
      <td>${r.group_name ? `<span class="tag">${escapeHtml(r.group_name)}</span>` : ''}</td>
      <td>${r.is_blacklisted ? `<span class="tag black">BLACK</span>` : ''}</td>
      <td>
        <button class="btn" data-act="edit" data-id="${r.id}">Edit</button>
        <button class="btn warn" data-act="${r.is_blacklisted?'unblack':'black'}" data-id="${r.id}">
          ${r.is_blacklisted ? 'Unblacklist' : 'Blacklist'}
        </button>
        <button class="btn danger" data-act="del" data-id="${r.id}">Delete</button>
      </td>
    </tr>
  `).join('');
}

async function fetchJSON(url, opts={}){
    const res = await fetch(url, { cache:'no-store', ...opts });
    const text = await res.text().catch(()=> '');
    let data = null; try { data = text ? JSON.parse(text) : null; } catch {}
    return { res, data, text };
}

/** 远端列表（支持服务端分组/黑名单筛选） */
async function refresh(){
    const params = new URLSearchParams();
    if (groupFilter.value) params.set('group', groupFilter.value);
    if (blacklistFilter.value !== '') params.set('blacklisted', blacklistFilter.value);

    const url = params.toString() ? `${API}?${params.toString()}` : API;
    const { res, data, text } = await fetchJSON(url);
    if(!res.ok){ toast(text || `Load failed: ${res.status}`, false); return; }
    listCache = Array.isArray(data) ? data : [];

    const filtered = filterLocalBySearch(listCache, searchBox.value.trim());
    render(filtered);
}

/** 分组列表 */
async function refreshGroups(){
    const { res, data } = await fetchJSON(API_GROUPS);
    if (res.ok && Array.isArray(data)) {
        groupsCache = data;
        renderGroups();
    }
}

async function createOrUpdate(payload){
    const { res, data, text } = await fetchJSON(API, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify(payload)
    });
    if(res.ok) return data;
    throw new Error((data && data.message) || text || `HTTP ${res.status}`);
}

async function updateById(id, payload){
    const { res, data, text } = await fetchJSON(`${API}/${id}`, {
        method:'PUT',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify(payload)
    });
    if(res.ok) return data;
    throw new Error((data && data.message) || text || `HTTP ${res.status}`);
}

async function removeById(id){
    const res = await fetch(`${API}/${id}`, { method:'DELETE', cache:'no-store' });
    if(res.status === 204) return true;
    const t = await res.text().catch(()=> ''); throw new Error(t || `HTTP ${res.status}`);
}

async function patchBlacklist(id, value /* true/false|null */){
    const body = (typeof value === 'boolean') ? { is_blacklisted: value } : undefined;
    const { res, data, text } = await fetchJSON(`${API}/${id}/blacklist`, {
        method:'PATCH',
        headers: body ? {'Content-Type':'application/json'} : undefined,
        body: body ? JSON.stringify(body) : undefined
    });
    if(res.ok) return data;
    throw new Error((data && data.message) || text || `HTTP ${res.status}`);
}

/* —— 表单交互 —— */
function fillForm(item){
    inputId.value    = item?.id ?? '';
    inputName.value  = item?.name ?? '';
    inputPhone.value = item?.phone ?? '';
    inputEmail.value = item?.email ?? '';
    inputGroup.value = item?.group_name ?? '';
    inputNote.value  = item?.note ?? '';
    inputBlack.checked = !!item?.is_blacklisted;
}

form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    formError.textContent = '';
    btnSave.disabled = true;

    const payload = {
        name:  inputName.value.trim(),
        phone: normalizePhone(inputPhone.value),
        email: inputEmail.value.trim(),
        group_name: inputGroup.value.trim(),
        is_blacklisted: !!inputBlack.checked,
        note:  inputNote.value.trim()
    };
    if(!payload.name){ formError.textContent='Name required'; btnSave.disabled=false; return; }
    if(!/^[0-9+]{5,32}$/.test(payload.phone)){ formError.textContent='Invalid phone'; btnSave.disabled=false; return; }
    if(payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)){ formError.textContent='Invalid email'; btnSave.disabled=false; return; }
    if(payload.group_name.length > 50){ formError.textContent='Group max length 50'; btnSave.disabled=false; return; }

    try{
        const id = inputId.value;
        if(id){
            await updateById(id, payload);
            toast('Updated');
        }else{
            await createOrUpdate(payload);     // upsert
            toast('Saved');
        }
        fillForm(null);
        await Promise.all([refresh(), refreshGroups()]);
    }catch(err){
        formError.textContent = err.message || 'Save failed';
    }finally{
        btnSave.disabled = false;
    }
});

btnReset.addEventListener('click', ()=>{
    formError.textContent = '';
    fillForm(null);
});

/* —— 表格交互 —— */
$('#tbody').addEventListener('click', async (e)=>{
    const btn = e.target.closest('button');
    if(!btn) return;
    const act = btn.getAttribute('data-act');
    const id  = btn.getAttribute('data-id');
    if(!act || !id) return;

    if(act === 'edit'){
        const item = listCache.find(x => String(x.id) === String(id));
        if(item){
            fillForm(item);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }else if(act === 'del'){
        if(!confirm(`Delete #${id}?`)) return;
        try{
            await removeById(id);
            toast('Deleted');
            await Promise.all([refresh(), refreshGroups()]);
        }catch(err){
            toast(err.message || 'Delete failed', false);
        }
    }else if(act === 'black'){
        try{
            await patchBlacklist(id, true);
            toast('Blacklisted');
            await refresh();
        }catch(err){
            toast(err.message || 'Operation failed', false);
        }
    }else if(act === 'unblack'){
        try{
            await patchBlacklist(id, false);
            toast('Unblacklisted');
            await refresh();
        }catch(err){
            toast(err.message || 'Operation failed', false);
        }
    }
});

/* —— 筛选/搜索 —— */
groupFilter.addEventListener('change', refresh);
blacklistFilter.addEventListener('change', refresh);
searchBox.addEventListener('input', ()=>{
    const filtered = filterLocalBySearch(listCache, searchBox.value.trim());
    render(filtered);
});
btnRefresh.addEventListener('click', async ()=>{
    await Promise.all([refresh(), refreshGroups()]);
});

/* —— 启动：加载分组 + 列表 + 轮询 —— */
(async function bootstrap(){
    await Promise.all([refreshGroups(), refresh()]);
    if(pollingTimer) clearInterval(pollingTimer);
    pollingTimer = setInterval(refresh, 5000);
})();
