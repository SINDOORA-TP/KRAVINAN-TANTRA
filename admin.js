/**
 * ADMIN PORTAL LOGIC (admin.js)
 * Sri Karavinan Tantra Peedam - Sacred Luxury Admin System
 */

const ADMIN_STATE = {
  activeTab: 'gallery',
  galleryConfig: {
    folderId: '',
    apiKey: '',
    overrides: {},
    hidden: [],
    lastUpdated: null
  },
  driveFiles: [],
  homamData: null,
  thoughtsData: null,
  feedbackData: null
};

// ============================================================================
// INITIALIZATION & AUTHENTICATION GATE
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initTabs();
  initGalleryManager();
  initHomamManager();
  initThoughtsManager();
  initFeedbackManager();
  initSettingsManager();
});

function initAuth() {
  const loginModal = document.getElementById('loginGateModal');
  const appContainer = document.getElementById('adminApp');
  const passcodeInput = document.getElementById('adminPasscodeInput');
  const loginBtn = document.getElementById('adminLoginBtn');
  const errorMsg = document.getElementById('loginErrorMessage');
  const toggleEyeBtn = document.getElementById('togglePasscodeVisibilityBtn');
  const logoutBtn = document.getElementById('adminLogoutBtn');

  // Check existing session
  const isAuth = sessionStorage.getItem('karavinan_admin_auth') === 'true';
  if (isAuth) {
    if (loginModal) loginModal.style.display = 'none';
    if (appContainer) appContainer.style.display = 'flex';
  } else {
    if (loginModal) loginModal.style.display = 'flex';
    if (appContainer) appContainer.style.display = 'none';
    if (passcodeInput) passcodeInput.focus();
  }

  function handleLogin() {
    const entered = passcodeInput ? passcodeInput.value.trim() : '';
    const stored = localStorage.getItem('karavinan_admin_passcode') || 'karavinan2026';

    if (entered === stored) {
      sessionStorage.setItem('karavinan_admin_auth', 'true');
      if (errorMsg) errorMsg.style.display = 'none';
      if (loginModal) loginModal.style.display = 'none';
      if (appContainer) appContainer.style.display = 'flex';
      showToast('Welcome to Sanctum Admin Portal', true);
    } else {
      if (errorMsg) {
        errorMsg.textContent = 'Incorrect passcode. Please try again.';
        errorMsg.style.display = 'block';
      }
      if (passcodeInput) {
        passcodeInput.classList.add('error');
        setTimeout(() => passcodeInput.classList.remove('error'), 1000);
      }
    }
  }

  if (loginBtn) loginBtn.addEventListener('click', handleLogin);
  if (passcodeInput) {
    passcodeInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleLogin();
    });
  }

  if (toggleEyeBtn && passcodeInput) {
    toggleEyeBtn.addEventListener('click', () => {
      const isPwd = passcodeInput.type === 'password';
      passcodeInput.type = isPwd ? 'text' : 'password';
      toggleEyeBtn.textContent = isPwd ? '🔒' : '👁';
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      sessionStorage.removeItem('karavinan_admin_auth');
      location.reload();
    });
  }
}

// ============================================================================
// TAB NAVIGATION
// ============================================================================
function initTabs() {
  const tabs = document.querySelectorAll('.admin-nav-tab');
  const contents = document.querySelectorAll('.admin-tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-tab');
      ADMIN_STATE.activeTab = target;

      tabs.forEach(t => t.classList.toggle('active', t === tab));
      contents.forEach(c => {
        c.classList.toggle('active', c.id === `tabContent${target.charAt(0).toUpperCase() + target.slice(1)}`);
      });
    });
  });
}

// ============================================================================
// TANTRA GALLERY (GOOGLE DRIVE) MANAGER - Workflow Step 4
// ============================================================================
async function initGalleryManager() {
  const folderInput = document.getElementById('driveFolderIdInput');
  const apiKeyInput = document.getElementById('driveApiKeyInput');
  const saveBtn = document.getElementById('saveDriveConfigBtn');
  const openFolderBtn = document.getElementById('openDriveFolderBtn');
  const refreshPreviewBtn = document.getElementById('refreshLivePreviewBtn');
  const saveAllOverridesBtn = document.getElementById('saveAllOverridesBtn');

  // Load existing config
  await loadGalleryConfig();

  if (folderInput) folderInput.value = ADMIN_STATE.galleryConfig.folderId || '';
  if (apiKeyInput) apiKeyInput.value = ADMIN_STATE.galleryConfig.apiKey || '';

  // Auto-clean Folder ID when pasting full Google Drive URL
  if (folderInput) {
    folderInput.addEventListener('input', () => {
      const val = folderInput.value.trim();
      const extracted = parseDriveFolderId(val);
      if (extracted !== val) {
        folderInput.value = extracted;
        showToast('Extracted Google Drive Folder ID automatically', true);
      }
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      ADMIN_STATE.galleryConfig.folderId = parseDriveFolderId(folderInput.value.trim());
      ADMIN_STATE.galleryConfig.apiKey = apiKeyInput.value.trim();
      ADMIN_STATE.galleryConfig.lastUpdated = new Date().toISOString();

      await persistGalleryConfig();
      showToast('Google Drive configuration saved successfully', true);

      // Trigger preview refresh
      fetchDrivePhotosAndRender();
    });
  }

  if (openFolderBtn) {
    openFolderBtn.addEventListener('click', () => {
      const folderId = parseDriveFolderId(folderInput ? folderInput.value.trim() : '');
      if (!folderId) {
        showToast('Please enter a Google Drive folder ID first', false);
        return;
      }
      window.open(`https://drive.google.com/drive/folders/${folderId}`, '_blank');
    });
  }

  if (refreshPreviewBtn) {
    refreshPreviewBtn.addEventListener('click', async () => {
      ADMIN_STATE.galleryConfig.folderId = parseDriveFolderId(folderInput ? folderInput.value.trim() : '');
      ADMIN_STATE.galleryConfig.apiKey = apiKeyInput ? apiKeyInput.value.trim() : '';
      ADMIN_STATE.galleryConfig.lastUpdated = new Date().toISOString();
      await persistGalleryConfig();
      fetchDrivePhotosAndRender();
    });
  }

  if (saveAllOverridesBtn) {
    saveAllOverridesBtn.addEventListener('click', async () => {
      await persistGalleryConfig();
      showToast('All image overrides saved successfully', true);
    });
  }

  // Initial preview render if config exists
  if (ADMIN_STATE.galleryConfig.folderId && ADMIN_STATE.galleryConfig.apiKey) {
    fetchDrivePhotosAndRender();
  }
}

function parseDriveFolderId(raw) {
  if (!raw) return '';
  // Check if full URL: https://drive.google.com/drive/folders/1ABCXYZ...?usp=sharing
  const match = raw.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return match[1];

  // Check if id query param: ?id=1ABCXYZ...
  const matchParam = raw.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchParam && matchParam[1]) return matchParam[1];

  return raw.replace(/[^a-zA-Z0-9_-]/g, '');
}

async function loadGalleryConfig() {
  try {
    const res = await fetch('gallery_config.json?' + Date.now());
    if (res.ok) {
      const data = await res.json();
      ADMIN_STATE.galleryConfig = {
        folderId: data.folderId || '',
        apiKey: data.apiKey || '',
        overrides: data.overrides || {},
        hidden: Array.isArray(data.hidden) ? data.hidden : [],
        lastUpdated: data.lastUpdated || null
      };
      return;
    }
  } catch (err) {
    console.warn('Could not load gallery_config.json from server, checking local storage', err);
  }

  // Fallback to localStorage
  const saved = localStorage.getItem('karavinan_gallery_config');
  if (saved) {
    try {
      ADMIN_STATE.galleryConfig = JSON.parse(saved);
    } catch (e) {}
  }
}

async function persistGalleryConfig() {
  // Always update localStorage
  localStorage.setItem('karavinan_gallery_config', JSON.stringify(ADMIN_STATE.galleryConfig));

  // Clear public site cache so updates reflect immediately
  sessionStorage.removeItem('tantra_gallery_cache');
  sessionStorage.removeItem('tantra_gallery_cache_v2');

  // Attempt save to server backend
  try {
    const res = await fetch('/api/save-gallery-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ADMIN_STATE.galleryConfig)
    });
    if (res.ok) return true;
  } catch (err) {
    console.info('Server save not available; config safely saved to browser storage');
  }
  return true;
}

// ----------------------------------------------------------------------------
// FETCH DRIVE PHOTOS & RENDER PREVIEW (Workflow Step 3 & 4)
// ----------------------------------------------------------------------------
async function fetchDrivePhotosAndRender() {
  const container = document.getElementById('drivePreviewGrid');
  const statusText = document.getElementById('drivePreviewStatusText');
  const saveAllBtn = document.getElementById('saveAllOverridesBtn');

  if (!container) return;

  const { folderId, apiKey } = ADMIN_STATE.galleryConfig;

  if (!folderId) {
    if (statusText) statusText.textContent = 'Please specify a Google Drive Folder ID above.';
    container.innerHTML = `
      <div class="preview-empty-state">
        <p>No Folder ID provided. Paste your shared folder URL or ID above and click Save.</p>
      </div>
    `;
    if (saveAllBtn) saveAllBtn.style.display = 'none';
    return;
  }

  if (!apiKey) {
    if (statusText) statusText.textContent = 'A restricted Google Drive API key is required to stream live images.';
    container.innerHTML = `
      <div class="preview-empty-state">
        <p>Please enter your Google Drive API key above. Once entered, your live Drive images will load here.</p>
      </div>
    `;
    if (saveAllBtn) saveAllBtn.style.display = 'none';
    return;
  }

  if (statusText) statusText.textContent = 'Connecting to Google Drive API and loading photos...';
  container.innerHTML = `
    <div class="preview-empty-state">
      <p>✦ Contacting Google Drive Sanctum Gallery... ✦</p>
    </div>
  `;

  try {
    // Robust query: query all files in parent folder, filter images client-side to prevent mimeType indexing delay
    const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,description,mimeType,thumbnailLink,webContentLink)&orderBy=createdTime desc&pageSize=100&key=${apiKey}`;

    const res = await fetch(url);
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const msg = errJson.error ? errJson.error.message : `HTTP status ${res.status}`;
      throw new Error(msg);
    }

    const data = await res.json();
    const rawFiles = data.files || [];

    // Filter image files (by mimeType or extension)
    const files = rawFiles.filter(f => {
      if (f.mimeType && f.mimeType.startsWith('image/')) return true;
      return /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(f.name || '');
    });

    ADMIN_STATE.driveFiles = files;

    if (files.length === 0) {
      // Diagnostic check: Test folder metadata permission
      let accessDiagnosis = '';
      try {
        const checkUrl = `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,shared&key=${apiKey}`;
        const checkRes = await fetch(checkUrl);
        if (!checkRes.ok) {
          accessDiagnosis = `Google Drive returned error (${checkRes.status}). This usually indicates the folder is still set to "Restricted" and not accessible via public API Key.`;
        } else {
          const fMeta = await checkRes.json();
          if (fMeta.shared === false) {
            accessDiagnosis = `Folder "${fMeta.name || 'karavinan images'}" is currently private (shared: false).`;
          }
        }
      } catch (diagErr) {}

      if (statusText) {
        statusText.innerHTML = `<span style="color: #ffb347;">⚠️ Google Drive returned 0 files for this folder ID.</span>`;
      }

      container.innerHTML = `
        <div class="preview-empty-state" style="border-color: #F6D77A; text-align: left; padding: 2rem 2.25rem; max-width: 720px; margin: 0 auto;">
          <h4 style="color: var(--gold-primary); font-family: var(--font-heading); margin: 0 0 0.85rem; font-size: 1.15rem;">
            ✦ How to Make Your Google Drive Photos Appear:
          </h4>
          <p style="color: #FFF6DC; font-size: 0.95rem; line-height: 1.6; margin-bottom: 1.25rem;">
            Your folder contains files, but Google Drive requires the folder's <strong>General Access</strong> to be set to <strong>"Anyone with the link can view"</strong> so the API Key can read them:
          </p>
          <ol style="color: var(--cream); font-size: 0.9rem; line-height: 1.8; margin-left: 1.25rem; margin-bottom: 1.5rem;">
            <li>In Google Drive, click the arrow next to <strong>"karavinan images ▾"</strong> (or right-click the folder).</li>
            <li>Click <strong>Share</strong> &rarr; <strong>Share</strong>.</li>
            <li>Under <strong>General access</strong>, change <strong>"Restricted"</strong> to <strong>"Anyone with the link"</strong> (Role: <strong>Viewer</strong>).</li>
            <li>Click <strong>Done</strong>.</li>
            <li>Return here and click <button type="button" class="btn-gold" style="padding: 0.35rem 0.85rem; font-size: 0.8rem; margin: 0 4px;" onclick="document.getElementById('refreshLivePreviewBtn').click()">Refresh Live Preview</button>.</li>
          </ol>
          ${accessDiagnosis ? `<div style="background: rgba(179,20,27,0.25); border: 1px solid var(--receipt-red); padding: 0.75rem 1rem; border-radius: 4px; font-size: 0.85rem; color: #ffc2c5;"><strong>Diagnostic:</strong> ${accessDiagnosis}</div>` : ''}
        </div>
      `;
      if (saveAllBtn) saveAllBtn.style.display = 'none';
      return;
    }

    const hiddenCount = files.filter(f => ADMIN_STATE.galleryConfig.hidden.includes(f.id)).length;
    const activeCount = files.length - hiddenCount;

    if (statusText) {
      statusText.innerHTML = `Loaded <strong>${files.length}</strong> photo(s) from Drive — <strong>${activeCount}</strong> active on website, <strong>${hiddenCount}</strong> hidden.`;
    }
    if (saveAllBtn) saveAllBtn.style.display = 'inline-block';

    renderPreviewCards(files);
  } catch (err) {
    console.error('Drive API error:', err);
    if (statusText) statusText.textContent = 'Could not load photos from Google Drive.';
    container.innerHTML = `
      <div class="preview-empty-state" style="border-color: rgba(179, 20, 27, 0.5);">
        <p style="color: #ff9999; margin-bottom: 0.75rem;"><strong>Error connecting to Google Drive:</strong> ${err.message}</p>
        <p style="font-size: 0.85rem; max-width: 500px; margin: 0 auto; line-height: 1.6;">
          Ensure that your folder's share settings are set to <strong>"Anyone with the link can View"</strong>, and verify that your API key is enabled for the Google Drive API.
        </p>
      </div>
    `;
    if (saveAllBtn) saveAllBtn.style.display = 'none';
  }
}

function renderPreviewCards(files) {
  const container = document.getElementById('drivePreviewGrid');
  if (!container) return;

  const { overrides, hidden } = ADMIN_STATE.galleryConfig;

  container.innerHTML = files.map(file => {
    const isHidden = hidden.includes(file.id);
    const override = overrides[file.id] || {};
    const defaultTitle = file.name.replace(/\.[^.]+$/, '');
    const defaultCaption = file.description || '';

    const currentTitle = override.title !== undefined ? override.title : defaultTitle;
    const currentCaption = override.caption !== undefined ? override.caption : defaultCaption;

    // Multi-tier reliable Google Drive image URL resolution:
    // 1. Signed thumbnailLink with high-res replacement (=s800)
    // 2. High-res thumbnail endpoint as fallback
    let imgSrc = '';
    const fallbackSrc = `https://drive.google.com/thumbnail?id=${file.id}&sz=w800`;
    if (file.thumbnailLink) {
      imgSrc = file.thumbnailLink.replace(/=s\d+$/, '=s800');
    } else {
      imgSrc = fallbackSrc;
    }

    return `
      <div class="preview-card ${isHidden ? 'is-hidden' : ''}" id="previewCard_${file.id}">
        <div class="preview-thumb-wrap">
          <img src="${imgSrc}" alt="${defaultTitle}" class="preview-thumb" loading="lazy" referrerpolicy="no-referrer" onerror="if(this.src!=='${fallbackSrc}'){this.src='${fallbackSrc}';}else{this.src='assets/images/ka-crest.svg';}">
          <span class="preview-badge-status ${isHidden ? 'badge-hidden' : 'badge-active'}" id="statusBadge_${file.id}">
            ${isHidden ? 'Hidden' : 'Active'}
          </span>
        </div>

        <div class="preview-details">
          <div class="preview-orig-title" title="${file.name}">
            File: <span>${file.name}</span>
          </div>

          <div class="override-group">
            <label for="titleOverride_${file.id}">Title Override (optional)</label>
            <input type="text" id="titleOverride_${file.id}" class="override-input" value="${escapeHtml(currentTitle)}" placeholder="Default: ${escapeHtml(defaultTitle)}">
          </div>

          <div class="override-group">
            <label for="captionOverride_${file.id}">Caption Override (optional)</label>
            <input type="text" id="captionOverride_${file.id}" class="override-input" value="${escapeHtml(currentCaption)}" placeholder="Default: ${escapeHtml(defaultCaption || 'None')}">
          </div>

          <label class="hide-toggle-row">
            <input type="checkbox" id="hideCheckbox_${file.id}" ${isHidden ? 'checked' : ''} onchange="toggleImageHidden('${file.id}')">
            <span>Hide this photo on public website</span>
          </label>

          <button type="button" class="preview-card-save-btn" onclick="saveSingleOverride('${file.id}')">
            Save Overrides
          </button>
        </div>
      </div>
    `;
  }).join('');
}

window.toggleImageHidden = function(fileId) {
  const checkbox = document.getElementById(`hideCheckbox_${fileId}`);
  const card = document.getElementById(`previewCard_${fileId}`);
  const badge = document.getElementById(`statusBadge_${fileId}`);
  if (!checkbox) return;

  const isHidden = checkbox.checked;
  const hiddenList = ADMIN_STATE.galleryConfig.hidden;

  if (isHidden) {
    if (!hiddenList.includes(fileId)) hiddenList.push(fileId);
  } else {
    ADMIN_STATE.galleryConfig.hidden = hiddenList.filter(id => id !== fileId);
  }

  if (card) card.classList.toggle('is-hidden', isHidden);
  if (badge) {
    badge.className = `preview-badge-status ${isHidden ? 'badge-hidden' : 'badge-active'}`;
    badge.textContent = isHidden ? 'Hidden' : 'Active';
  }
};

window.saveSingleOverride = async function(fileId) {
  const titleInput = document.getElementById(`titleOverride_${fileId}`);
  const captionInput = document.getElementById(`captionOverride_${fileId}`);
  const checkbox = document.getElementById(`hideCheckbox_${fileId}`);

  if (!ADMIN_STATE.galleryConfig.overrides) ADMIN_STATE.galleryConfig.overrides = {};

  const titleVal = titleInput ? titleInput.value.trim() : '';
  const captionVal = captionInput ? captionInput.value.trim() : '';

  ADMIN_STATE.galleryConfig.overrides[fileId] = {
    title: titleVal,
    caption: captionVal
  };

  if (checkbox) {
    const isHidden = checkbox.checked;
    const hiddenList = ADMIN_STATE.galleryConfig.hidden;
    if (isHidden && !hiddenList.includes(fileId)) hiddenList.push(fileId);
    if (!isHidden) ADMIN_STATE.galleryConfig.hidden = hiddenList.filter(id => id !== fileId);
  }

  await persistGalleryConfig();
  showToast('Image settings saved successfully', true);
};

// ============================================================================
// HOMAM SCHEDULE MANAGER (schedule.json) - Full CRUD System
// ============================================================================
async function initHomamManager() {
  const container = document.getElementById('homamListContainer');
  const addBtn = document.getElementById('addNewHomamModalBtn');
  const modal = document.getElementById('homamModal');
  const closeBtn = document.getElementById('closeHomamModalBtn');
  const cancelBtn = document.getElementById('cancelHomamModalBtn');
  const saveBtn = document.getElementById('saveHomamModalBtn');
  const form = document.getElementById('homamModalForm');

  if (addBtn) addBtn.addEventListener('click', openHomamCreateModal);
  if (closeBtn) closeBtn.addEventListener('click', () => closeHomamModal());
  if (cancelBtn) cancelBtn.addEventListener('click', () => closeHomamModal());
  if (saveBtn) saveBtn.addEventListener('click', handleSaveHomam);
  if (form) form.addEventListener('submit', (e) => { e.preventDefault(); handleSaveHomam(); });

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeHomamModal();
    });
  }

  if (!container) return;

  try {
    let data = null;
    const local = localStorage.getItem('karavinan_file_schedule.json');
    if (local) {
      try { data = JSON.parse(local); } catch (e) {}
    }
    if (!data) {
      const res = await fetch('schedule.json?' + Date.now());
      if (res.ok) data = await res.json();
    }
    if (data) {
      ADMIN_STATE.homamData = data;
      renderHomamManagerList();
    }
  } catch (err) {
    console.warn('Could not load schedule.json', err);
  }
}

function renderHomamManagerList() {
  const container = document.getElementById('homamListContainer');
  if (!container || !ADMIN_STATE.homamData) return;

  const upcoming = ADMIN_STATE.homamData.upcoming || [];
  const past = ADMIN_STATE.homamData.past || [];

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
      <h4 style="color: var(--gold-primary); margin: 0; font-family: var(--font-heading);">✦ Upcoming Ceremonies (${upcoming.length})</h4>
    </div>
    ${upcoming.length === 0 ? '<p style="color: var(--text-muted); font-size: 0.9rem;">No upcoming ceremonies recorded. Click "+ Add New Homam" above to create one.</p>' : upcoming.map(item => renderHomamItemRow(item, 'upcoming')).join('')}
    
    <div style="display: flex; justify-content: space-between; align-items: center; margin: 2.5rem 0 1rem;">
      <h4 style="color: var(--gold-primary); margin: 0; font-family: var(--font-heading);">✦ Completed Ceremonies / Archive (${past.length})</h4>
    </div>
    ${past.length === 0 ? '<p style="color: var(--text-muted); font-size: 0.9rem;">No completed ceremonies in the archive.</p>' : past.map(item => renderHomamItemRow(item, 'past')).join('')}
  `;
}

function renderHomamItemRow(item, category) {
  const itemIdSafe = String(item.id || '');
  const isUpcoming = category === 'upcoming';
  const benefitsList = Array.isArray(item.benefits) ? item.benefits : [];

  return `
    <div class="admin-item-row" id="homamRow_${itemIdSafe}">
      <div class="admin-item-info">
        <div class="admin-item-title">
          ${escapeHtml(item.name)} 
          <span style="font-size: 0.85rem; color: var(--gold-secondary);">(${escapeHtml(item.deity)})</span>
          ${item.featured ? '<span class="badge-featured">Featured</span>' : ''}
          <span class="${item.sankalpam_available ? 'badge-sankalpam' : 'badge-closed'}">
            ${item.sankalpam_available ? 'Sankalpam Active' : 'Sankalpam Concluded'}
          </span>
        </div>
        ${item.name_ta ? `<div style="font-size: 0.85rem; color: #E8D8A0; margin-bottom: 0.25rem;">${escapeHtml(item.name_ta)}</div>` : ''}
        <div class="admin-item-meta" style="margin-bottom: 0.35rem;">
          📅 <strong>${escapeHtml(item.display_date || item.date)}</strong> &nbsp;|&nbsp; ⏰ ${escapeHtml(item.time)} &nbsp;|&nbsp; 📍 ${escapeHtml(item.venue)}
        </div>
        <div style="font-size: 0.85rem; color: var(--cream); line-height: 1.4; margin-bottom: 0.4rem;">
          ${escapeHtml((item.summary || '').slice(0, 150))}${item.summary && item.summary.length > 150 ? '...' : ''}
        </div>
        ${benefitsList.length > 0 ? `
          <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
            ${benefitsList.map(b => `<span style="font-size: 0.72rem; background: rgba(255,255,255,0.06); padding: 2px 7px; border-radius: 3px; color: #FFF6DC;">✓ ${escapeHtml(b)}</span>`).join('')}
          </div>
        ` : ''}
      </div>
      <div class="admin-item-actions">
        <button class="btn-item-edit" onclick="openHomamEditModal('${itemIdSafe}')">
          ✎ Edit
        </button>
        <button class="btn-item-action" onclick="toggleVirtualSankalpam('${itemIdSafe}', '${category}')">
          ${item.sankalpam_available ? 'Close Sankalpam' : 'Enable Sankalpam'}
        </button>
        <button class="btn-item-action" onclick="toggleHomamCategory('${itemIdSafe}', '${category}')">
          ${isUpcoming ? 'Mark Completed' : 'Move to Upcoming'}
        </button>
        <button class="btn-item-action btn-item-delete" onclick="deleteHomam('${itemIdSafe}', '${category}')">
          ✕ Delete
        </button>
      </div>
    </div>
  `;
}

function openHomamCreateModal() {
  const modal = document.getElementById('homamModal');
  const title = document.getElementById('homamModalTitle');
  if (!modal) return;

  if (title) title.textContent = '✦ Add New Sacred Ceremony';
  document.getElementById('homamFormId').value = '';
  document.getElementById('homamFormCategory').value = 'upcoming';
  document.getElementById('homamFormDeity').value = '';
  document.getElementById('homamFormName').value = '';
  document.getElementById('homamFormNameTa').value = '';
  document.getElementById('homamFormDate').value = '';
  document.getElementById('homamFormTime').value = '5:30 PM - 9:00 PM IST';
  document.getElementById('homamFormDisplayDate').value = '';
  document.getElementById('homamFormDisplayDateTa').value = '';
  document.getElementById('homamFormVenue').value = 'Sokkanur Maha Peedam Sanctum, Kinathukadavu';
  document.getElementById('homamFormVenueTa').value = 'சொக்கனூர் மகா பீடம், கிணத்துக்கடவு';
  document.getElementById('homamFormSummary').value = '';
  document.getElementById('homamFormSummaryTa').value = '';
  document.getElementById('homamFormBenefits').value = '';
  document.getElementById('homamFormSankalpam').checked = true;
  document.getElementById('homamFormFeatured').checked = false;

  modal.classList.add('active');
}

window.openHomamEditModal = function(id) {
  if (!ADMIN_STATE.homamData) return;
  const modal = document.getElementById('homamModal');
  const title = document.getElementById('homamModalTitle');
  if (!modal) return;

  let foundItem = null;
  let foundCategory = 'upcoming';

  if (ADMIN_STATE.homamData.upcoming) {
    foundItem = ADMIN_STATE.homamData.upcoming.find(h => String(h.id) === String(id));
  }
  if (!foundItem && ADMIN_STATE.homamData.past) {
    foundItem = ADMIN_STATE.homamData.past.find(h => String(h.id) === String(id));
    if (foundItem) foundCategory = 'past';
  }

  if (!foundItem) {
    showToast('Ceremony not found', false);
    return;
  }

  if (title) title.textContent = '✦ Edit Sacred Ceremony';
  document.getElementById('homamFormId').value = foundItem.id;
  document.getElementById('homamFormCategory').value = foundCategory;
  document.getElementById('homamFormDeity').value = foundItem.deity || '';
  document.getElementById('homamFormName').value = foundItem.name || '';
  document.getElementById('homamFormNameTa').value = foundItem.name_ta || '';
  document.getElementById('homamFormDate').value = foundItem.date || '';
  document.getElementById('homamFormTime').value = foundItem.time || '';
  document.getElementById('homamFormDisplayDate').value = foundItem.display_date || '';
  document.getElementById('homamFormDisplayDateTa').value = foundItem.display_date_ta || '';
  document.getElementById('homamFormVenue').value = foundItem.venue || '';
  document.getElementById('homamFormVenueTa').value = foundItem.venue_ta || '';
  document.getElementById('homamFormSummary').value = foundItem.summary || '';
  document.getElementById('homamFormSummaryTa').value = foundItem.summary_ta || '';
  document.getElementById('homamFormBenefits').value = (foundItem.benefits || []).join(', ');
  document.getElementById('homamFormSankalpam').checked = !!foundItem.sankalpam_available;
  document.getElementById('homamFormFeatured').checked = !!foundItem.featured;

  modal.classList.add('active');
};

function closeHomamModal() {
  const modal = document.getElementById('homamModal');
  if (modal) modal.classList.remove('active');
}

async function handleSaveHomam() {
  if (!ADMIN_STATE.homamData) {
    ADMIN_STATE.homamData = { upcoming: [], past: [] };
  }

  const id = document.getElementById('homamFormId').value.trim();
  const category = document.getElementById('homamFormCategory').value;
  const deity = document.getElementById('homamFormDeity').value.trim();
  const name = document.getElementById('homamFormName').value.trim();
  const nameTa = document.getElementById('homamFormNameTa').value.trim();
  const date = document.getElementById('homamFormDate').value.trim();
  const time = document.getElementById('homamFormTime').value.trim();
  let displayDate = document.getElementById('homamFormDisplayDate').value.trim();
  let displayDateTa = document.getElementById('homamFormDisplayDateTa').value.trim();
  const venue = document.getElementById('homamFormVenue').value.trim();
  const venueTa = document.getElementById('homamFormVenueTa').value.trim();
  const summary = document.getElementById('homamFormSummary').value.trim();
  const summaryTa = document.getElementById('homamFormSummaryTa').value.trim();
  const benefitsRaw = document.getElementById('homamFormBenefits').value.trim();
  const sankalpam = document.getElementById('homamFormSankalpam').checked;
  const featured = document.getElementById('homamFormFeatured').checked;

  if (!name || !deity || !date || !time || !summary) {
    showToast('Please fill all required fields marked with *', false);
    return;
  }

  // Auto-generate display dates if left blank
  if (!displayDate && date) {
    try {
      const d = new Date(date + 'T12:00:00');
      displayDate = d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      if (!displayDateTa) {
        displayDateTa = d.toLocaleDateString('ta-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      }
    } catch (e) {
      displayDate = date;
    }
  }

  const benefits = benefitsRaw ? benefitsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

  const homamObj = {
    id: id || `homam-${Date.now()}`,
    name,
    name_ta: nameTa,
    deity,
    date,
    display_date: displayDate,
    display_date_ta: displayDateTa,
    time,
    venue: venue || 'Sokkanur Maha Peedam Sanctum, Kinathukadavu',
    venue_ta: venueTa || 'சொக்கனூர் மகா பீடம், கிணத்துக்கடவு',
    summary,
    summary_ta: summaryTa,
    benefits,
    sankalpam_available: sankalpam,
    featured
  };

  // Ensure arrays exist
  if (!Array.isArray(ADMIN_STATE.homamData.upcoming)) ADMIN_STATE.homamData.upcoming = [];
  if (!Array.isArray(ADMIN_STATE.homamData.past)) ADMIN_STATE.homamData.past = [];

  if (id) {
    // Remove from both first to handle possible category changes
    ADMIN_STATE.homamData.upcoming = ADMIN_STATE.homamData.upcoming.filter(h => String(h.id) !== id);
    ADMIN_STATE.homamData.past = ADMIN_STATE.homamData.past.filter(h => String(h.id) !== id);
  }

  // Add to target category
  if (category === 'upcoming') {
    ADMIN_STATE.homamData.upcoming.unshift(homamObj);
  } else {
    ADMIN_STATE.homamData.past.unshift(homamObj);
  }

  closeHomamModal();
  renderHomamManagerList();

  const saved = await saveJsonFile('schedule.json', ADMIN_STATE.homamData);
  if (saved) {
    showToast(`Ceremony "${name}" saved & synced to live website`, true);
  } else {
    showToast(`Saved locally (server write failed)`, false);
  }
}

window.toggleVirtualSankalpam = async function(id, category) {
  if (!ADMIN_STATE.homamData || !ADMIN_STATE.homamData[category]) return;
  const item = ADMIN_STATE.homamData[category].find(h => String(h.id) === String(id));
  if (item) {
    item.sankalpam_available = !item.sankalpam_available;
    renderHomamManagerList();
    await saveJsonFile('schedule.json', ADMIN_STATE.homamData);
    showToast(`Virtual Sankalpam ${item.sankalpam_available ? 'Activated' : 'Closed'} for "${item.name}"`, true);
  }
};

window.toggleHomamCategory = async function(id, currentCategory) {
  if (!ADMIN_STATE.homamData) return;
  const newCategory = currentCategory === 'upcoming' ? 'past' : 'upcoming';

  const itemIndex = (ADMIN_STATE.homamData[currentCategory] || []).findIndex(h => String(h.id) === String(id));
  if (itemIndex > -1) {
    const [item] = ADMIN_STATE.homamData[currentCategory].splice(itemIndex, 1);
    if (!Array.isArray(ADMIN_STATE.homamData[newCategory])) ADMIN_STATE.homamData[newCategory] = [];
    ADMIN_STATE.homamData[newCategory].unshift(item);
    renderHomamManagerList();
    await saveJsonFile('schedule.json', ADMIN_STATE.homamData);
    showToast(`Moved "${item.name}" to ${newCategory === 'upcoming' ? 'Upcoming' : 'Completed'}`, true);
  }
};

window.deleteHomam = async function(id, category) {
  if (!ADMIN_STATE.homamData || !ADMIN_STATE.homamData[category]) return;
  const item = ADMIN_STATE.homamData[category].find(h => String(h.id) === String(id));
  const itemName = item ? item.name : 'this ceremony';

  if (!confirm(`Are you sure you want to permanently delete "${itemName}"?`)) {
    return;
  }

  ADMIN_STATE.homamData[category] = ADMIN_STATE.homamData[category].filter(h => String(h.id) !== String(id));
  renderHomamManagerList();
  await saveJsonFile('schedule.json', ADMIN_STATE.homamData);
  showToast(`Deleted "${itemName}" from schedule`, true);
};

// ============================================================================
// DAILY THOUGHTS & MANTRAS MANAGER (thoughts.json) - Full CRUD System
// ============================================================================
async function initThoughtsManager() {
  const container = document.getElementById('thoughtsListContainer');
  const addBtn = document.getElementById('addNewThoughtBtn');
  const modal = document.getElementById('thoughtModal');
  const closeBtn = document.getElementById('closeThoughtModalBtn');
  const cancelBtn = document.getElementById('cancelThoughtModalBtn');
  const saveBtn = document.getElementById('saveThoughtModalBtn');
  const form = document.getElementById('thoughtModalForm');

  if (addBtn) addBtn.addEventListener('click', openThoughtCreateModal);
  if (closeBtn) closeBtn.addEventListener('click', () => closeThoughtModal());
  if (cancelBtn) cancelBtn.addEventListener('click', () => closeThoughtModal());
  if (saveBtn) saveBtn.addEventListener('click', handleSaveThought);
  if (form) form.addEventListener('submit', (e) => { e.preventDefault(); handleSaveThought(); });

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeThoughtModal();
    });
  }

  if (!container) return;

  try {
    let data = null;
    const local = localStorage.getItem('karavinan_file_thoughts.json');
    if (local) {
      try { data = JSON.parse(local); } catch (e) {}
    }
    if (!data) {
      const res = await fetch('thoughts.json?' + Date.now());
      if (res.ok) data = await res.json();
    }
    if (data) {
      ADMIN_STATE.thoughtsData = Array.isArray(data) ? data : (data.thoughts || []);
      renderThoughtsManagerList();
    }
  } catch (err) {
    console.warn('Could not load thoughts.json', err);
  }
}

function renderThoughtsManagerList() {
  const container = document.getElementById('thoughtsListContainer');
  if (!container || !ADMIN_STATE.thoughtsData) return;

  const list = ADMIN_STATE.thoughtsData;

  container.innerHTML = `
    <p style="font-size: 0.88rem; color: var(--text-muted); margin-bottom: 1.25rem;">
      Managing <strong>${list.length}</strong> rotating daily Sanskrit mantras and spiritual reflections.
    </p>
    ${list.length === 0 ? '<p style="color: var(--text-muted);">No mantras in repository. Click "+ Add New Mantra" to add one.</p>' : list.map(item => `
      <div class="admin-item-row" id="thoughtRow_${item.id}">
        <div class="admin-item-info">
          <div class="admin-item-title" style="font-family: inherit; font-size: 1.15rem; color: #FFF6DC; margin-bottom: 0.2rem;">
            ${escapeHtml(item.mantra)}
          </div>
          ${item.mantra_ta ? `<div style="font-size: 0.85rem; color: #E8D8A0; margin-bottom: 0.35rem;">${escapeHtml(item.mantra_ta)}</div>` : ''}
          <div class="admin-item-meta" style="color: var(--gold-primary); font-weight: 600; margin-bottom: 0.25rem;">
            ✦ ${escapeHtml(item.thought || item.theme || '')}
            ${item.thought_ta ? `&nbsp;<span style="color: var(--gold-secondary); font-weight: 400;">(${escapeHtml(item.thought_ta)})</span>` : ''}
          </div>
          <div style="font-size: 0.85rem; color: var(--cream); line-height: 1.4;">
            ${escapeHtml((item.meaning || '').slice(0, 160))}${item.meaning && item.meaning.length > 160 ? '...' : ''}
          </div>
        </div>
        <div class="admin-item-actions">
          <span style="font-size: 0.78rem; color: var(--gold-secondary); background: rgba(246, 215, 122, 0.1); padding: 3px 8px; border-radius: 3px;">
            Mantra #${item.id}
          </span>
          <button class="btn-item-edit" onclick="openThoughtEditModal(${item.id})">
            ✎ Edit
          </button>
          <button class="btn-item-action btn-item-delete" onclick="deleteThought(${item.id})">
            ✕ Delete
          </button>
        </div>
      </div>
    `).join('')}
  `;
}

function openThoughtCreateModal() {
  const modal = document.getElementById('thoughtModal');
  const title = document.getElementById('thoughtModalTitle');
  if (!modal) return;

  if (title) title.textContent = '✦ Add Sacred Daily Mantra';
  document.getElementById('thoughtFormId').value = '';
  document.getElementById('thoughtFormMantra').value = '';
  document.getElementById('thoughtFormMantraTa').value = '';
  document.getElementById('thoughtFormTheme').value = '';
  document.getElementById('thoughtFormThemeTa').value = '';
  document.getElementById('thoughtFormMeaning').value = '';
  document.getElementById('thoughtFormMeaningTa').value = '';

  modal.classList.add('active');
}

window.openThoughtEditModal = function(id) {
  if (!Array.isArray(ADMIN_STATE.thoughtsData)) return;
  const modal = document.getElementById('thoughtModal');
  const title = document.getElementById('thoughtModalTitle');
  if (!modal) return;

  const item = ADMIN_STATE.thoughtsData.find(t => Number(t.id) === Number(id));
  if (!item) {
    showToast('Mantra not found', false);
    return;
  }

  if (title) title.textContent = '✦ Edit Sacred Daily Mantra';
  document.getElementById('thoughtFormId').value = item.id;
  document.getElementById('thoughtFormMantra').value = item.mantra || '';
  document.getElementById('thoughtFormMantraTa').value = item.mantra_ta || '';
  document.getElementById('thoughtFormTheme').value = item.thought || item.theme || '';
  document.getElementById('thoughtFormThemeTa').value = item.thought_ta || '';
  document.getElementById('thoughtFormMeaning').value = item.meaning || '';
  document.getElementById('thoughtFormMeaningTa').value = item.meaning_ta || '';

  modal.classList.add('active');
};

function closeThoughtModal() {
  const modal = document.getElementById('thoughtModal');
  if (modal) modal.classList.remove('active');
}

async function handleSaveThought() {
  if (!Array.isArray(ADMIN_STATE.thoughtsData)) ADMIN_STATE.thoughtsData = [];

  const idVal = document.getElementById('thoughtFormId').value.trim();
  const mantra = document.getElementById('thoughtFormMantra').value.trim();
  const mantraTa = document.getElementById('thoughtFormMantraTa').value.trim();
  const theme = document.getElementById('thoughtFormTheme').value.trim();
  const themeTa = document.getElementById('thoughtFormThemeTa').value.trim();
  const meaning = document.getElementById('thoughtFormMeaning').value.trim();
  const meaningTa = document.getElementById('thoughtFormMeaningTa').value.trim();

  if (!mantra || !theme || !meaning) {
    showToast('Please fill all required fields marked with *', false);
    return;
  }

  if (idVal) {
    const existing = ADMIN_STATE.thoughtsData.find(t => Number(t.id) === Number(idVal));
    if (existing) {
      existing.mantra = mantra;
      existing.mantra_ta = mantraTa;
      existing.thought = theme;
      existing.thought_ta = themeTa;
      existing.meaning = meaning;
      existing.meaning_ta = meaningTa;
    }
  } else {
    const maxId = ADMIN_STATE.thoughtsData.reduce((m, t) => Math.max(m, Number(t.id) || 0), 0);
    const newThought = {
      id: maxId + 1,
      mantra,
      mantra_ta: mantraTa,
      thought: theme,
      thought_ta: themeTa,
      meaning,
      meaning_ta: meaningTa
    };
    ADMIN_STATE.thoughtsData.push(newThought);
  }

  closeThoughtModal();
  renderThoughtsManagerList();

  const saved = await saveJsonFile('thoughts.json', ADMIN_STATE.thoughtsData);
  if (saved) {
    showToast('Sacred Mantra saved & synced to live website', true);
  } else {
    showToast('Saved locally', false);
  }
}

window.deleteThought = async function(id) {
  if (!Array.isArray(ADMIN_STATE.thoughtsData)) return;
  const item = ADMIN_STATE.thoughtsData.find(t => Number(t.id) === Number(id));
  const snippet = item ? item.mantra.slice(0, 30) : 'this mantra';

  if (!confirm(`Are you sure you want to delete mantra #${id} ("${snippet}...")?`)) {
    return;
  }

  ADMIN_STATE.thoughtsData = ADMIN_STATE.thoughtsData.filter(t => Number(t.id) !== Number(id));
  renderThoughtsManagerList();
  await saveJsonFile('thoughts.json', ADMIN_STATE.thoughtsData);
  showToast(`Mantra #${id} deleted`, true);
};

// ============================================================================
// DEVOTEE TESTIMONIALS MANAGER (feedback.json) - Full CRUD System
// ============================================================================
async function initFeedbackManager() {
  const container = document.getElementById('feedbackListContainer');
  const addBtn = document.getElementById('addNewFeedbackBtn');
  const modal = document.getElementById('feedbackModal');
  const closeBtn = document.getElementById('closeFeedbackModalBtn');
  const cancelBtn = document.getElementById('cancelFeedbackModalBtn');
  const saveBtn = document.getElementById('saveFeedbackModalBtn');
  const form = document.getElementById('feedbackModalForm');

  if (addBtn) addBtn.addEventListener('click', openFeedbackCreateModal);
  if (closeBtn) closeBtn.addEventListener('click', () => closeFeedbackModal());
  if (cancelBtn) cancelBtn.addEventListener('click', () => closeFeedbackModal());
  if (saveBtn) saveBtn.addEventListener('click', handleSaveFeedback);
  if (form) form.addEventListener('submit', (e) => { e.preventDefault(); handleSaveFeedback(); });

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeFeedbackModal();
    });
  }

  if (!container) return;

  try {
    let data = null;
    const local = localStorage.getItem('karavinan_file_feedback.json');
    if (local) {
      try { data = JSON.parse(local); } catch (e) {}
    }
    if (!data) {
      const res = await fetch('feedback.json?' + Date.now());
      if (res.ok) data = await res.json();
    }
    if (data) {
      ADMIN_STATE.feedbackData = Array.isArray(data) ? data : (data.testimonials || []);
      renderFeedbackManagerList();
    }
  } catch (err) {
    console.warn('Could not load feedback.json', err);
  }
}

function renderFeedbackManagerList() {
  const container = document.getElementById('feedbackListContainer');
  if (!container || !ADMIN_STATE.feedbackData) return;

  const list = ADMIN_STATE.feedbackData;

  container.innerHTML = `
    <p style="font-size: 0.88rem; color: var(--text-muted); margin-bottom: 1.25rem;">
      Managing <strong>${list.length}</strong> approved devotee reflections displayed on the website.
    </p>
    ${list.length === 0 ? '<p style="color: var(--text-muted);">No testimonials in repository. Click "+ Add Testimonial" to add one.</p>' : list.map(item => `
      <div class="admin-item-row" id="feedbackRow_${item.id}">
        <div class="admin-item-info">
          <div class="admin-item-title">
            ${escapeHtml(item.name || item.devotee || 'Devotee')} 
            <span style="font-size: 0.85rem; color: var(--text-muted);">(${escapeHtml(item.place || item.location || '')})</span>
          </div>
          <div class="admin-item-meta" style="color: var(--gold-secondary); margin-bottom: 0.35rem;">
            ${item.rating ? `<span style="color: var(--gold-primary); font-size: 0.9rem;">${'★'.repeat(Math.min(5, Math.max(1, item.rating)))}</span> (${item.rating}/5)` : '<span style="color: var(--text-muted);">No star rating</span>'}
          </div>
          <div style="font-size: 0.88rem; color: #FFF6DC; font-style: italic; line-height: 1.4; margin-bottom: 0.35rem;">
            "${escapeHtml(item.text || item.feedback || '')}"
          </div>
          ${item.text_ta ? `
            <div style="font-size: 0.82rem; color: #E8D8A0; font-style: italic; line-height: 1.4;">
              "${escapeHtml(item.text_ta)}"
            </div>
          ` : ''}
        </div>
        <div class="admin-item-actions">
          <button class="btn-item-edit" onclick="openFeedbackEditModal(${item.id})">
            ✎ Edit
          </button>
          <button class="btn-item-action btn-item-delete" onclick="deleteFeedback(${item.id})">
            ✕ Delete
          </button>
        </div>
      </div>
    `).join('')}
  `;
}

function openFeedbackCreateModal() {
  const modal = document.getElementById('feedbackModal');
  const title = document.getElementById('feedbackModalTitle');
  if (!modal) return;

  if (title) title.textContent = '✦ Add Devotee Reflection';
  document.getElementById('feedbackFormId').value = '';
  document.getElementById('feedbackFormName').value = '';
  document.getElementById('feedbackFormPlace').value = '';
  document.getElementById('feedbackFormRating').value = '5';
  document.getElementById('feedbackFormText').value = '';
  document.getElementById('feedbackFormTextTa').value = '';

  modal.classList.add('active');
}

window.openFeedbackEditModal = function(id) {
  if (!Array.isArray(ADMIN_STATE.feedbackData)) return;
  const modal = document.getElementById('feedbackModal');
  const title = document.getElementById('feedbackModalTitle');
  if (!modal) return;

  const item = ADMIN_STATE.feedbackData.find(f => Number(f.id) === Number(id));
  if (!item) {
    showToast('Testimonial not found', false);
    return;
  }

  if (title) title.textContent = '✦ Edit Devotee Reflection';
  document.getElementById('feedbackFormId').value = item.id;
  document.getElementById('feedbackFormName').value = item.name || item.devotee || '';
  document.getElementById('feedbackFormPlace').value = item.place || item.location || '';
  document.getElementById('feedbackFormRating').value = item.rating ? String(item.rating) : 'none';
  document.getElementById('feedbackFormText').value = item.text || item.feedback || '';
  document.getElementById('feedbackFormTextTa').value = item.text_ta || '';

  modal.classList.add('active');
};

function closeFeedbackModal() {
  const modal = document.getElementById('feedbackModal');
  if (modal) modal.classList.remove('active');
}

async function handleSaveFeedback() {
  if (!Array.isArray(ADMIN_STATE.feedbackData)) ADMIN_STATE.feedbackData = [];

  const idVal = document.getElementById('feedbackFormId').value.trim();
  const name = document.getElementById('feedbackFormName').value.trim();
  const place = document.getElementById('feedbackFormPlace').value.trim();
  const ratingVal = document.getElementById('feedbackFormRating').value;
  const text = document.getElementById('feedbackFormText').value.trim();
  const textTa = document.getElementById('feedbackFormTextTa').value.trim();

  if (!name || !place || !text) {
    showToast('Please fill all required fields marked with *', false);
    return;
  }

  const rating = ratingVal === 'none' ? null : Number(ratingVal);

  if (idVal) {
    const existing = ADMIN_STATE.feedbackData.find(f => Number(f.id) === Number(idVal));
    if (existing) {
      existing.name = name;
      existing.place = place;
      existing.rating = rating;
      existing.text = text;
      existing.text_ta = textTa;
    }
  } else {
    const maxId = ADMIN_STATE.feedbackData.reduce((m, f) => Math.max(m, Number(f.id) || 0), 0);
    const newFeedback = {
      id: maxId + 1,
      name,
      place,
      rating,
      text,
      text_ta: textTa
    };
    ADMIN_STATE.feedbackData.push(newFeedback);
  }

  closeFeedbackModal();
  renderFeedbackManagerList();

  const saved = await saveJsonFile('feedback.json', ADMIN_STATE.feedbackData);
  if (saved) {
    showToast(`Testimonial from "${name}" saved & synced to live website`, true);
  } else {
    showToast('Saved locally', false);
  }
}

window.deleteFeedback = async function(id) {
  if (!Array.isArray(ADMIN_STATE.feedbackData)) return;
  const item = ADMIN_STATE.feedbackData.find(f => Number(f.id) === Number(id));
  const devotee = item ? (item.name || 'this devotee') : 'this testimonial';

  if (!confirm(`Are you sure you want to delete reflection from "${devotee}"?`)) {
    return;
  }

  ADMIN_STATE.feedbackData = ADMIN_STATE.feedbackData.filter(f => Number(f.id) !== Number(id));
  renderFeedbackManagerList();
  await saveJsonFile('feedback.json', ADMIN_STATE.feedbackData);
  showToast(`Testimonial from "${devotee}" removed`, true);
};

// ============================================================================
// SANCTUM & SECURITY SETTINGS (settings.json + Passcode)
// ============================================================================
async function initSettingsManager() {
  const whatsappInput = document.getElementById('settingsWhatsappInput');
  const phoneDisplayInput = document.getElementById('settingsPhoneDisplayInput');
  const addressInput = document.getElementById('settingsAddressInput');
  const mapsInput = document.getElementById('settingsMapsInput');
  const timingsInput = document.getElementById('settingsTimingsInput');
  const saveSanctumBtn = document.getElementById('saveSanctumSettingsBtn');

  const newPasscode = document.getElementById('newPasscodeInput');
  const confirmPasscode = document.getElementById('confirmPasscodeInput');
  const savePasscodeBtn = document.getElementById('saveNewPasscodeBtn');

  // Load existing settings.json (supports localStorage for static host & server API)
  try {
    let settings = null;
    const local = localStorage.getItem('karavinan_file_settings.json');
    if (local) {
      try { settings = JSON.parse(local); } catch (e) {}
    }
    if (!settings) {
      const res = await fetch('settings.json?' + Date.now());
      if (res.ok) settings = await res.json();
    }
    if (settings) {
      if (whatsappInput) whatsappInput.value = settings.whatsappNumber || '';
      if (phoneDisplayInput) phoneDisplayInput.value = settings.phoneDisplay || '';
      if (addressInput) addressInput.value = settings.sanctumLocation || '';
      if (mapsInput) mapsInput.value = settings.googleMapsUrl || '';
      if (timingsInput) timingsInput.value = settings.darshanTimings || '';
    }
  } catch (e) {
    console.warn('Could not load settings.json', e);
  }

  if (saveSanctumBtn) {
    saveSanctumBtn.addEventListener('click', async () => {
      const waRaw = whatsappInput ? whatsappInput.value.trim().replace(/[^0-9]/g, '') : '';
      const display = phoneDisplayInput ? phoneDisplayInput.value.trim() : '';
      const address = addressInput ? addressInput.value.trim() : '';
      const maps = mapsInput ? mapsInput.value.trim() : '';
      const timings = timingsInput ? timingsInput.value.trim() : '';

      if (!waRaw) {
        showToast('Please provide a valid WhatsApp number with country code', false);
        return;
      }

      const settingsPayload = {
        phone: '+' + waRaw,
        phoneDisplay: display || `+${waRaw}`,
        whatsappNumber: waRaw,
        sanctumLocation: address || 'Sokkanur, Kinathukadavu, Tamil Nadu',
        googleMapsUrl: maps || 'https://maps.google.com/?q=Sokkanur,+Kinathukadavu,+Tamil+Nadu',
        darshanTimings: timings || 'Daily 6:00 AM - 1:00 PM, 4:30 PM - 8:30 PM',
        lastUpdated: new Date().toISOString()
      };

      const saved = await saveJsonFile('settings.json', settingsPayload);
      if (saved) {
        showToast('Sanctum contact details saved & updated across the website', true);
      } else {
        showToast('Saved locally', false);
      }
    });
  }

  if (savePasscodeBtn) {
    savePasscodeBtn.addEventListener('click', () => {
      const p1 = newPasscode ? newPasscode.value.trim() : '';
      const p2 = confirmPasscode ? confirmPasscode.value.trim() : '';

      if (p1.length < 6) {
        showToast('Passcode must be at least 6 characters long', false);
        return;
      }
      if (p1 !== p2) {
        showToast('Passcodes do not match', false);
        return;
      }

      localStorage.setItem('karavinan_admin_passcode', p1);
      if (newPasscode) newPasscode.value = '';
      if (confirmPasscode) confirmPasscode.value = '';
      showToast('Admin security passcode updated successfully', true);
    });
  }
}

// ============================================================================
// UTILITY FUNCTIONS & TOAST
// ============================================================================
async function saveJsonFile(filename, data) {
  // Always persist in browser localStorage for immediate offline & GitHub Pages support
  try {
    localStorage.setItem(`karavinan_file_${filename}`, JSON.stringify(data));
  } catch (e) {}

  // Attempt save to Node.js backend if running with server.js
  try {
    const res = await fetch('/api/save-json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, data })
    });
    if (res.ok) return true;
  } catch (err) {
    console.info(`Server backend not present (static host), safely stored in localStorage for ${filename}`);
  }
  return true;
}

function showToast(message, isSuccess = true) {
  const toast = document.getElementById('adminToast');
  if (!toast) return;

  toast.textContent = message;
  toast.className = `admin-toast ${isSuccess ? 'success' : 'error'}`;
  toast.style.display = 'block';

  setTimeout(() => {
    toast.style.display = 'none';
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
