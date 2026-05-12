(async function () {
  'use strict';

  const el = (id) => document.getElementById(id);
  const status = el('status');

  function setStatus(msg, cls) {
    status.textContent = msg;
    status.className = cls || '';
  }

  async function loadProfiles() {
    const { profiles } = await chrome.storage.local.get('profiles');
    return profiles || { defaultProfile: '', profiles: {} };
  }

  async function saveProfiles(p) {
    await chrome.storage.local.set({ profiles: p });
  }

  async function populate() {
    const store = await loadProfiles();
    const sel = el('profile');
    sel.innerHTML = '';
    for (const key of Object.keys(store.profiles)) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = store.profiles[key].label || key;
      if (key === store.defaultProfile) opt.selected = true;
      sel.appendChild(opt);
    }
  }

  async function run(submit) {
    const store = await loadProfiles();
    const key = el('profile').value;
    const profile = store.profiles[key];
    if (!profile) { setStatus('No profile selected', 'err'); return; }
    setStatus('Filling…');
    try {
      const resp = await chrome.runtime.sendMessage({ type: 'autofill:dispatch', profile, submit });
      const results = resp?.results || [];
      if (!results.length) {
        setStatus('No frames responded. Open a payment form and try again.', 'err');
        return;
      }
      const filled = results.reduce((n, r) => n + (r.filled?.length || 0), 0);
      const missed = [...new Set(results.flatMap(r => r.missed || []))];
      setStatus(`Filled ${filled} field(s) across ${results.length} frame(s).` +
                (missed.length ? `\nMissed: ${missed.join(', ')}` : ''), 'ok');
    } catch (e) {
      setStatus('Error: ' + e.message, 'err');
    }
  }

  el('fill').addEventListener('click', () => run(false));
  el('fillSubmit').addEventListener('click', () => run(true));

  el('toggleEdit').addEventListener('click', async () => {
    const ed = el('editor');
    const row = el('editRow');
    if (ed.classList.contains('show')) {
      ed.classList.remove('show');
      row.style.display = 'none';
    } else {
      const store = await loadProfiles();
      ed.value = JSON.stringify(store, null, 2);
      ed.classList.add('show');
      row.style.display = 'flex';
    }
  });

  el('save').addEventListener('click', async () => {
    try {
      const parsed = JSON.parse(el('editor').value);
      if (!parsed.profiles) throw new Error('missing "profiles" key');
      await saveProfiles(parsed);
      await populate();
      setStatus('Saved.', 'ok');
      el('editor').classList.remove('show');
      el('editRow').style.display = 'none';
    } catch (e) {
      setStatus('Invalid JSON: ' + e.message, 'err');
    }
  });

  el('cancel').addEventListener('click', () => {
    el('editor').classList.remove('show');
    el('editRow').style.display = 'none';
  });

  await populate();
})();
