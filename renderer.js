// renderer.js - Cloud version with Firebase Auth + Firestore (real-time)

let currentBottomTab = 'chat';
let currentChatId = null;
let currentFilter = 'all';
let customLists = [];
let isOffline = false;
let isDesktopLayout = false;

let currentUser = null;           // Firebase user
let db = null;
let auth = null;

let chats = [];
let communities = [];
let messages = {};                // in-memory cache per chat
let recentCalls = [];
let unsubscribers = [];           // for cleaning listeners

let callInterval = null;
let callStartTime = null;
let isMuted = false;
let isVideoOn = true;

let currentTheme = { bubbleColor: '#4A4A4C', wallpaper: 'default' };

const STORAGE_KEY = 'social_app_theme_v1'; // only for theme now

// === FIREBASE INIT ===
function initFirebase() {
  return new Promise((resolve) => {
    const tryInit = () => {
      if (typeof firebase === 'undefined' || !window.FIREBASE_CONFIG) {
        setTimeout(tryInit, 120);
        return;
      }

      try {
        if (!firebase.apps.length) {
          firebase.initializeApp(window.FIREBASE_CONFIG);
        }
        auth = firebase.auth();
        db = firebase.firestore();

        // Enable offline persistence
        db.enablePersistence({ synchronizeTabs: true }).catch(err => {
          if (err.code !== 'failed-precondition') console.warn('Firestore persistence:', err);
        });

        // Auth state listener
        auth.onAuthStateChanged(user => {
          currentUser = user;
          const overlay = document.getElementById('auth-overlay');
          if (user) {
            if (overlay) overlay.style.display = 'none';
            updateUserUI(user);
            loadCloudData();
          } else {
            if (overlay) overlay.style.display = 'flex';
          }
        });

        resolve({ auth, db });
      } catch (e) {
        console.error('Firebase init error', e);
        // Allow app to continue in demo mode
        resolve(null);
      }
    };
    tryInit();
  });
}

function updateUserUI(user) {
  const nameEl = document.getElementById('settings-user-name');
  const emailEl = document.getElementById('settings-user-email');
  if (nameEl) nameEl.textContent = user.displayName || 'Guest User';
  if (emailEl) emailEl.textContent = user.email || (user.isAnonymous ? 'Anonymous (demo)' : '');
}

// === AUTH ===
window.signInWithGoogle = async function () {
  if (!auth) return alert('Firebase not configured yet');
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    await auth.signInWithPopup(provider);
  } catch (err) {
    console.error(err);
    alert('Google sign-in failed: ' + err.message);
  }
};

window.signInAnonymously = async function () {
  if (!auth) return alert('Firebase not configured yet');
  try {
    await auth.signInAnonymously();
  } catch (err) {
    console.error(err);
    alert('Anonymous sign-in failed');
  }
};

window.logout = async function () {
  if (!auth) return;
  try {
    await auth.signOut();
    // Clear local state
    chats = []; communities = []; messages = {}; currentChatId = null;
    document.getElementById('auth-overlay').style.display = 'flex';
    // Re-render empty state
    switchBottomTab('chat');
  } catch (e) { console.error(e); }
};

// === DATA LAYER (Firestore) ===
async function loadCloudData() {
  if (!db || !currentUser) return;

  // Clean previous listeners
  unsubscribers.forEach(u => u && u());
  unsubscribers = [];

  // Load communities (global for demo)
  const comUnsub = db.collection('communities').orderBy('name').onSnapshot(snap => {
    communities = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (currentBottomTab === 'communities') renderCommunitiesScreen();
  });
  unsubscribers.push(comUnsub);

  // Load user's chats (simple model: chats where user is member or global demo chats)
  // For a good first experience we also load a public demo chat
  const chatsUnsub = db.collection('chats')
    .where('members', 'array-contains', currentUser.uid)
    .orderBy('updatedAt', 'desc')
    .onSnapshot(snap => {
      chats = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Seed a public demo chat if none exists for this user
      if (chats.length === 0) {
        createDemoChatIfNeeded();
      }

      if (currentBottomTab === 'chat') renderChatList();
    });
  unsubscribers.push(chatsUnsub);

  // Load recent calls (user specific)
  const callsUnsub = db.collection('users').doc(currentUser.uid).collection('recentCalls')
    .orderBy('timestamp', 'desc').limit(8)
    .onSnapshot(snap => {
      recentCalls = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (currentBottomTab === 'calls') renderCallsScreen();
    });
  unsubscribers.push(callsUnsub);

  // Load theme from Firestore (or local)
  try {
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    if (userDoc.exists && userDoc.data().theme) {
      currentTheme = userDoc.data().theme;
      applyTheme();
    }
  } catch (e) {}
}

async function createDemoChatIfNeeded() {
  if (!db || !currentUser) return;
  const demoChat = {
    name: 'Public Demo Chat',
    type: 'group',
    members: [currentUser.uid, 'demo-user-1', 'demo-user-2'],
    lastMessage: 'Welcome to the cloud version!',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  const ref = await db.collection('chats').add(demoChat);
  // Add welcome message
  await ref.collection('messages').add({
    text: 'This chat is synced in real-time across devices via Firebase!',
    from: 'system',
    fromMe: false,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });
}

// === CHAT & MESSAGES ===
function renderChatList(searchTerm = '') {
  const container = document.getElementById('chat-list');
  if (!container) return;
  container.innerHTML = '';

  let list = [...chats];
  if (currentFilter === 'unread') list = list.filter(c => (c.unread || 0) > 0);
  if (currentFilter === 'favorites') list = list.filter(c => c.favorite);
  if (currentFilter === 'groups') list = list.filter(c => c.type === 'group');

  if (searchTerm) {
    const q = searchTerm.toLowerCase();
    list = list.filter(c => c.name.toLowerCase().includes(q));
  }

  if (list.length === 0) {
    let emptyHTML = `<div class="px-4 py-6 text-center text-xs text-[#8E8E93]">No chats yet. Create one!</div>`;
    if (currentFilter === 'unread') {
      emptyHTML = `
        <div class="flex flex-col items-center justify-center h-64 text-center px-4">
          <div class="w-16 h-16 bg-[#1C1C1E] rounded-full flex items-center justify-center mb-4">
            <i class="fa-solid fa-check text-4xl text-[#00C853]"></i>
          </div>
          <div class="text-2xl font-semibold mb-2">No unread chats</div>
          <div class="text-[#8E8E93] mb-4">You're all caught up.</div>
          <div onclick="setFilter(document.querySelector('[data-filter=all]'), 'all'); renderChatList();" class="text-[#00C853] cursor-pointer">View all chats</div>
        </div>
      `;
    } else if (currentFilter === 'favorites') {
      emptyHTML = `
        <div class="flex flex-col items-center justify-center h-64 text-center px-4">
          <div class="mb-4">
            <div class="w-20 h-20 mx-auto bg-[#1C1C1E] rounded-xl flex items-center justify-center relative">
              <i class="fa-solid fa-list text-3xl text-[#00C853]"></i>
              <i class="fa-solid fa-heart text-xl text-[#00C853] absolute -top-1 -right-1"></i>
            </div>
          </div>
          <div class="text-2xl font-semibold mb-2">Add to your Favorites list</div>
          <div class="text-[#8E8E93] mb-4">See your favorites in both Chats and Calls. Add as many people or groups as you want.</div>
          <div onclick="addToFavorites()" class="text-[#00C853] cursor-pointer">Add people or groups</div>
        </div>
      `;
    } else if (currentFilter === 'groups') {
      emptyHTML = `
        <div class="flex flex-col items-center justify-center h-64 text-center px-4">
          <div class="mb-4">
            <div class="w-20 h-20 mx-auto bg-[#1C1C1E] rounded-xl flex items-center justify-center">
              <i class="fa-solid fa-users text-3xl text-[#00C853]"></i>
            </div>
          </div>
          <div class="text-2xl font-semibold mb-2">Create a group</div>
          <div class="text-[#8E8E93] mb-4">Connect with friends and family anywhere, anytime.</div>
          <div onclick="createNewChat()" class="text-[#00C853] cursor-pointer">Create a group</div>
        </div>
      `;
    } else if (currentFilter !== 'all') {
      emptyHTML = `<div class="px-4 py-6 text-center text-xs text-[#8E8E93]">No chats in this list yet.</div>`;
    }
    container.innerHTML = emptyHTML;
    return;
  }

  list.forEach(chat => {
    const div = document.createElement('div');
    div.className = `chat-item flex items-center px-3 py-2.5 cursor-pointer ${currentChatId === chat.id ? 'active' : ''}`;

    const unreadHTML = (chat.unread || 0) > 0
      ? `<div class="ml-auto bg-white text-black text-[9.5px] font-semibold min-w-[17px] h-[17px] px-1 flex items-center justify-center rounded-full">${chat.unread}</div>`
      : `<div class="ml-auto text-[#8E8E93] text-xs self-start pt-[3px]">${chat.time || ''}</div>`;

    div.innerHTML = `
      <div class="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-[#2C2C2E] mr-3">
        <img src="${chat.avatar || 'https://i.pravatar.cc/52?img=47'}" class="w-full h-full object-cover">
      </div>
      <div class="flex-1 min-w-0 pr-1">
        <div class="flex justify-between"><span class="font-medium text-[14.5px] truncate">${chat.name}</span></div>
        <div class="text-[#8E8E93] text-xs truncate">${chat.lastMessage || 'No messages yet'}</div>
      </div>
      ${unreadHTML}
    `;
    div.onclick = () => openConversation(chat);
    container.appendChild(div);
  });
}

function filterChatList() {
  const val = document.getElementById('chat-search')?.value || '';
  renderChatList(val);
}

function setFilter(el, filter) {
  document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  currentFilter = filter;
  const searchInput = document.getElementById('chat-search');
  if (searchInput) {
    if (filter === 'unread') searchInput.placeholder = 'Search unread chats';
    else if (filter === 'favorites') searchInput.placeholder = 'Search favorite chats';
    else if (filter === 'groups') searchInput.placeholder = 'Search group chats';
    else if (filter !== 'all' && !['unread','favorites','groups'].includes(filter)) searchInput.placeholder = `Search ${filter} chats`;
    else searchInput.placeholder = 'Ask Meta AI or Search';
  }
  renderChatList(document.getElementById('chat-search')?.value || '');
}

async function openConversation(chat) {
  currentChatId = chat.id;

  const listPane = document.getElementById('list-pane');
  const detailPane = document.getElementById('detail-pane');
  const empty = document.getElementById('detail-empty');

  if (isDesktopLayout) {
    listPane.style.display = 'flex';
    detailPane.style.display = 'flex';
    empty.style.display = 'none';
  } else {
    listPane.style.display = 'none';
    detailPane.style.display = 'flex';
  }

  renderConversationHeader(chat);
  listenToMessages(chat.id);
}

function renderConversationHeader(chat) {
  document.getElementById('conv-avatar').innerHTML = `<img src="${chat.avatar || 'https://i.pravatar.cc/52?img=47'}" class="w-full h-full object-cover">`;
  document.getElementById('conv-name').textContent = chat.name;
}

function listenToMessages(chatId) {
  const container = document.getElementById('messages-container');
  if (!container) return;

  // Unsubscribe previous (only real listeners)
  unsubscribers = unsubscribers.filter(u => {
    if (u && u.chatId === chatId) { u(); return false; }
    return true;
  });

  container.innerHTML = '';
  container.className = `flex-1 overflow-y-auto p-3 space-y-[3px] messages-area ${getWallpaperClass()}`;

  if (!db) {
    // Demo / offline mode: just render any pre-seeded messages for this chat
    renderMessages(chatId);
    return;
  }

  const unsub = db.collection('chats').doc(chatId).collection('messages')
    .orderBy('timestamp', 'asc')
    .onSnapshot(snapshot => {
      messages[chatId] = [];
      snapshot.forEach(doc => {
        const m = doc.data();
        messages[chatId].push({
          id: doc.id,
          text: m.text,
          fromMe: m.from === currentUser?.uid || m.fromMe === true,
          time: m.time || (m.timestamp?.toDate ? m.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''),
          status: m.status || 'sent'
        });
      });
      renderMessages(chatId);
    }, err => console.error('Message listener error', err));

  unsub.chatId = chatId;
  unsubscribers.push(unsub);
}

function renderMessages(chatId) {
  const container = document.getElementById('messages-container');
  if (!container) return;
  container.innerHTML = '';

  const msgs = messages[chatId] || [];
  if (msgs.length === 0) {
    const d = document.createElement('div');
    d.className = 'h-full flex items-center justify-center text-[#8E8E93] text-xs';
    d.textContent = 'Say hi!';
    container.appendChild(d);
    return;
  }

  msgs.forEach(m => {
    const row = document.createElement('div');
    row.className = `flex ${m.fromMe ? 'justify-end' : ''}`;
    const b = document.createElement('div');
    b.className = `message-bubble ${m.fromMe ? 'message-sent' : 'message-received'}`;
    b.innerHTML = `
      <div>${m.text}</div>
      <div class="text-right text-[9.5px] opacity-60 mt-px flex items-center justify-end gap-1">
        ${m.time}
        ${m.fromMe ? `<i class="fa-solid ${m.status === 'read' ? 'fa-check-double' : 'fa-check'} text-[8.5px]"></i>` : ''}
      </div>
    `;
    row.appendChild(b);
    container.appendChild(row);
  });
  container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
  const input = document.getElementById('message-input');
  if (!input || !currentChatId) return;
  const text = input.value.trim();
  if (!text) return;

  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Demo / local mode (no db or no signed-in user)
  if (!db || !currentUser) {
    if (!messages[currentChatId]) messages[currentChatId] = [];
    messages[currentChatId].push({ id: 'local-' + Date.now(), text, fromMe: true, time, status: 'sent' });

    // Update the chat list preview
    const chat = chats.find(c => c.id === currentChatId);
    if (chat) {
      chat.lastMessage = text.length > 40 ? text.slice(0, 37) + '...' : text;
      chat.time = time;
    }

    input.value = '';
    renderMessages(currentChatId);
    renderChatList(document.getElementById('chat-search')?.value || '');
    return;
  }

  // Real cloud path
  const chatRef = db.collection('chats').doc(currentChatId);
  const msg = {
    text,
    from: currentUser.uid,
    fromMe: true,
    time,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    status: 'sent'
  };

  try {
    await chatRef.collection('messages').add(msg);

    // Update last message on chat
    await chatRef.update({
      lastMessage: text.length > 40 ? text.slice(0, 37) + '...' : text,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    input.value = '';
  } catch (e) {
    console.error('Send failed', e);
    alert('Failed to send message. Check your internet / Firebase rules.');
  }
}

// === REST OF UI (kept from previous version) ===
function updateLayoutMode() {
  isDesktopLayout = window.innerWidth >= 620;
  const listPane = document.getElementById('list-pane');
  const detailPane = document.getElementById('detail-pane');
  const empty = document.getElementById('detail-empty');
  const backBtn = document.getElementById('conv-back-btn');
  const closeDesktop = document.getElementById('conv-close-desktop');

  if (!listPane || !detailPane) return;

  if (isDesktopLayout) {
    listPane.style.display = 'flex';
    if (currentChatId) {
      detailPane.style.display = 'flex';
      empty.style.display = 'none';
    } else {
      detailPane.style.display = 'none';
      empty.style.display = 'flex';
    }
    if (backBtn) backBtn.style.display = 'none';
    if (closeDesktop) closeDesktop.style.display = 'block';
  } else {
    if (currentChatId) {
      listPane.style.display = 'none';
      detailPane.style.display = 'flex';
      empty.style.display = 'none';
      if (backBtn) backBtn.style.display = 'flex';
    } else {
      listPane.style.display = 'flex';
      detailPane.style.display = 'none';
      empty.style.display = 'none';
      if (backBtn) backBtn.style.display = 'flex';
    }
    if (closeDesktop) closeDesktop.style.display = 'none';
  }
}

function switchBottomTab(tab) {
  currentBottomTab = tab;

  ['screen-chat', 'screen-calls', 'screen-communities', 'screen-settings'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  ['chat', 'calls', 'communities', 'settings'].forEach(t => {
    const el = document.getElementById('bottom-tab-' + t);
    if (el) el.classList.remove('active');
  });

  const active = document.getElementById('bottom-tab-' + tab);
  if (active) active.classList.add('active');

  if (tab === 'chat') {
    document.getElementById('screen-chat').classList.remove('hidden');
    updateLayoutMode();
    renderChatList();
  } else if (tab === 'calls') {
    document.getElementById('screen-calls').classList.remove('hidden');
    renderCallsScreen();
  } else if (tab === 'communities') {
    document.getElementById('screen-communities').classList.remove('hidden');
    renderCommunitiesScreen();
  } else if (tab === 'settings') {
    document.getElementById('screen-settings').classList.remove('hidden');
    renderSettingsScreen();
  }
}

function applyTheme() {
  const root = document.documentElement;
  root.style.setProperty('--bubble-sent', currentTheme.bubbleColor || '#00A884');

  const swatch = document.getElementById('current-bubble-swatch');
  if (swatch) swatch.style.background = currentTheme.bubbleColor || '#00A884';

  const msgs = document.getElementById('messages-container');
  if (msgs) {
    msgs.className = `flex-1 overflow-y-auto p-3 space-y-[3px] messages-area ${getWallpaperClass()}`;
  }
}

function renderThemeGrid() {
  const container = document.getElementById('theme-grid');
  if (!container) return;
  container.innerHTML = '';

  // Reuse THEMES from earlier scope if available, fallback simple
  const themes = window.THEMES || [
    { id: 'default', name: 'Default', bubble: '#4A4A4C', preview: 'bg-[#4A4A4C]' },
    { id: 'blue', name: 'Ocean', bubble: '#3B82F6', preview: 'bg-blue-500' },
    { id: 'purple', name: 'Purple', bubble: '#8B5CF6', preview: 'bg-violet-500' },
    { id: 'ai', name: 'Create with AI', bubble: '#00A884', preview: 'bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500', isAI: true },
  ];

  themes.forEach(theme => {
    const div = document.createElement('div');
    div.className = `theme-card aspect-[4/3.05] flex flex-col ${theme.preview} text-white text-[9.5px] p-1.5 relative`;
    const isSel = currentTheme.bubbleColor === theme.bubble;
    if (isSel) div.classList.add('selected');

    let html = `<div class="flex-1 rounded bg-black/30 flex items-end p-1"><div class="w-5 h-2.5 rounded-sm ml-auto" style="background:${theme.bubble}"></div></div><div class="text-center text-[8.5px] mt-0.5 font-medium truncate">${theme.name}</div>`;
    if (theme.isAI) html = `<div class="flex-1 flex items-center justify-center"><i class="fa-solid fa-magic text-base"></i></div><div class="text-center text-[8.5px] mt-0.5 font-medium">${theme.name}</div>`;

    div.innerHTML = html;
    div.onclick = () => {
      currentTheme.bubbleColor = theme.isAI ? '#8B5CF6' : theme.bubble; // simple AI pick
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentTheme));
      saveThemeToCloud();
      applyTheme();
      renderThemeGrid();
    };
    container.appendChild(div);
  });
}

async function saveThemeToCloud() {
  if (!db || !currentUser) return;
  try {
    await db.collection('users').doc(currentUser.uid).set({ theme: currentTheme }, { merge: true });
  } catch (e) {}
}

// The rest of the functions (createNewChat, calls, communities, settings, call modal, etc.)
// are carried over from the previous responsive implementation with minor cloud adjustments.

// For this response we keep them functional (they use local state where cloud sync is not yet wired).

function openCamera() {
  // Demo: open device camera (in real PWA would use navigator.mediaDevices.getUserMedia)
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        // In real app, show video preview or capture
        const video = document.createElement('video');
        video.srcObject = stream;
        video.play();
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/90 z-[300] flex items-center justify-center';
        modal.innerHTML = `
          <div class="w-full max-w-sm p-4">
            <video class="w-full rounded-2xl" autoplay></video>
            <div class="flex justify-center gap-4 mt-4">
              <button class="px-6 py-2 bg-white text-black rounded-full" onclick="this.closest('.fixed').remove(); stream.getTracks().forEach(t=>t.stop());">Capture</button>
              <button class="px-6 py-2 bg-[#2C2C2E] text-white rounded-full" onclick="this.closest('.fixed').remove(); stream.getTracks().forEach(t=>t.stop());">Cancel</button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
        modal.querySelector('video').srcObject = stream;
      })
      .catch(() => alert('Camera access denied or not available (demo mode)'));
  } else {
    alert('Camera opened (demo - no real access in this environment)');
  }
}

function createNewChat() {
  // For cloud version: create a Firestore chat
  const name = prompt('Chat name (1:1 or group):');
  if (!name || !db || !currentUser) return;

  db.collection('chats').add({
    name: name.trim(),
    type: 'dm',
    members: [currentUser.uid],
    lastMessage: '',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    avatar: `https://i.pravatar.cc/52?img=${Math.floor(Math.random()*70)}`
  }).then(ref => {
    // open it
    switchBottomTab('chat');
    setTimeout(() => {
      openConversation({ id: ref.id, name: name.trim() });
    }, 300);
  });
}

function showChatMenu() {
  const existing = document.getElementById('chat-menu-popup');
  if (existing) existing.remove();

  const topActions = document.getElementById('chat-top-actions');
  if (!topActions) return;

  const menu = document.createElement('div');
  menu.id = 'chat-menu-popup';
  menu.className = 'absolute bg-[#2C2C2E] text-white text-[15px] rounded-2xl shadow-2xl py-1 z-[200] min-w-[160px] border border-[#3A3A3C]';
  menu.style.top = '48px';
  menu.style.left = '8px';
  menu.innerHTML = `
    <div class="px-4 py-3 flex items-center justify-between hover:bg-[#3A3A3C] cursor-pointer rounded-t-2xl" onclick="selectAllChats(); document.getElementById('chat-menu-popup')?.remove()">
      <span>Select chats</span>
      <i class="fa-regular fa-check-circle text-lg"></i>
    </div>
    <div class="px-4 py-3 flex items-center justify-between hover:bg-[#3A3A3C] cursor-pointer" onclick="markAllRead(); document.getElementById('chat-menu-popup')?.remove()">
      <span>Read all</span>
      <i class="fa-regular fa-comment-dots text-lg"></i>
    </div>
    <div class="px-4 py-3 flex items-center justify-between hover:bg-[#3A3A3C] cursor-pointer" onclick="showLists(); document.getElementById('chat-menu-popup')?.remove()">
      <span>Lists</span>
      <i class="fa-solid fa-user text-lg"></i>
    </div>
  `;
  topActions.style.position = 'relative';
  topActions.appendChild(menu);

  setTimeout(() => {
    document.addEventListener('click', function closeMenu(e) {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    }, { once: true });
  }, 10);
}

function selectAllChats() {
  // Demo: highlight all chat items
  document.querySelectorAll('.chat-item').forEach(item => {
    item.style.background = '#3A3A3C';
    setTimeout(() => item.style.background = '', 1200);
  });
}

function markAllRead() {
  chats.forEach(c => c.unread = 0);
  renderChatList(document.getElementById('chat-search')?.value || '');
}

function showArchived() {
  // Demo: show archived count and filter (in real would load archived chats)
  const archivedCount = 7;
  alert(`Showing ${archivedCount} archived chats (demo)`);
  // Could filter list or open a separate view
}

function addToFavorites() {
  alert('Add to favorites demo - select chats to favorite');
  // In full version, open a picker to add chats to favorites
}

function showNewListModal() {
  const modal = document.getElementById('new-list-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  const suggestionsDiv = document.getElementById('list-suggestions');
  suggestionsDiv.innerHTML = '';
  const suggestions = [
    {name: 'New customer', color: '#4CAF50'},
    {name: 'New order', color: '#FF9800'},
    {name: 'Pending payment', color: '#E91E63'},
    {name: 'Paid', color: '#9C27B0'},
    {name: 'Order complete', color: '#FFEB3B'},
    {name: 'Important', color: '#F44336'},
    {name: 'Follow up', color: '#2196F3'},
    {name: 'Lead', color: '#4CAF50'},
  ];
  suggestions.forEach(s => {
    const div = document.createElement('div');
    div.className = 'flex items-center justify-between px-4 py-2 bg-[#2C2C2E] rounded-xl cursor-pointer';
    div.innerHTML = `
      <div class="flex items-center gap-x-2">
        <div class="w-4 h-4 rounded-full" style="background: ${s.color}"></div>
        <span>${s.name}</span>
      </div>
      <i class="fa-solid fa-chevron-right text-[#8E8E93]"></i>
    `;
    div.onclick = () => {
      document.getElementById('list-name-input').value = s.name;
      document.getElementById('list-color-dot').style.background = s.color;
    };
    suggestionsDiv.appendChild(div);
  });
}

function hideNewListModal() {
  const modal = document.getElementById('new-list-modal');
  if (modal) modal.classList.add('hidden');
}

function createNewList() {
  const name = document.getElementById('list-name-input').value.trim() || 'New list';
  const color = document.getElementById('list-color-dot').style.background || '#00C853';
  customLists.push({name, color});
  hideNewListModal();
  // Add pill to filter row
  const filterRow = document.getElementById('filter-row');
  if (filterRow) {
    const plusPill = filterRow.querySelector('.filter-pill:last-child');
    const newPill = document.createElement('div');
    newPill.className = 'filter-pill cursor-pointer';
    newPill.style.background = color;
    newPill.style.color = '#D1D1D6';
    newPill.textContent = name;
    newPill.onclick = () => setFilter(newPill, name);
    filterRow.insertBefore(newPill, plusPill);
  }
}

function addPeopleToList() {
  alert('Add people or groups to list (demo)');
}

// Many helper functions (renderCallsScreen, startCall, etc.) are kept identical to the previous responsive build
// to avoid breaking the excellent UI you already have.

function renderCallsScreen() {
  // Render the start a call list matching the reference image
  const container = document.getElementById('start-call-list');
  if (!container) return;
  container.innerHTML = '';

  const demoContacts = [
    { name: 'Abhi', avatar: 'https://i.pravatar.cc/36?img=32' },
    { name: 'Abhinav', avatar: 'https://i.pravatar.cc/36?img=15' },
    { name: 'Greeshma', avatar: 'https://i.pravatar.cc/36?img=28' },
    { name: 'Naveen', avatar: 'https://i.pravatar.cc/36?img=47' },
    { name: 'Sai Teja', avatar: 'https://i.pravatar.cc/36?img=64' },
    { name: 'Venkat', avatar: 'https://i.pravatar.cc/36?img=40' }
  ];

  demoContacts.forEach(contact => {
    const div = document.createElement('div');
    div.className = 'flex items-center justify-between px-1 py-3 border-b border-[#2C2C2E] last:border-b-0';
    div.innerHTML = `
      <div class="flex items-center gap-x-3">
        <div class="w-9 h-9 rounded-full overflow-hidden ring-1 ring-[#3A3A3C] relative">
          <img src="${contact.avatar}" class="w-full h-full object-cover">
          <div class="absolute bottom-0 right-0 w-2.5 h-2.5 ${contact.name.includes('Abhi') || contact.name.includes('Greeshma') ? 'bg-[#00C853]' : 'bg-[#8E8E93]'} border border-black rounded-full"></div>
        </div>
        <div class="font-medium text-[15px]">${contact.name}</div>
      </div>
      <div class="flex items-center gap-x-2 text-[#8E8E93]">
        <button onclick="startCallWithUser({name: '${contact.name}', avatar: '${contact.avatar}'}); event.stopImmediatePropagation();" class="w-9 h-9 flex items-center justify-center hover:text-white">
          <i class="fa-solid fa-phone text-lg"></i>
        </button>
        <button onclick="startVideoCallWithUser({name: '${contact.name}', avatar: '${contact.avatar}'}); event.stopImmediatePropagation();" class="w-9 h-9 flex items-center justify-center hover:text-white">
          <i class="fa-solid fa-video text-lg"></i>
        </button>
      </div>
    `;
    container.appendChild(div);
  });
}
function renderCommunitiesScreen() { /* cloud synced */ }
function renderSettingsScreen() { renderThemeGrid(); /* ... */ }

// Call modal functions (startCall, endCall, etc.) remain the same.

function init() {
  // Theme only from local for now (cloud loaded after auth)
  const savedTheme = localStorage.getItem(STORAGE_KEY);
  if (savedTheme) currentTheme = JSON.parse(savedTheme);

  applyTheme();

  // Attach bottom nav tab clicks (more reliable than inline onclick)
  const bottomNav = document.getElementById('bottom-nav');
  if (bottomNav) {
    bottomNav.addEventListener('click', (e) => {
      const tabEl = e.target.closest('[id^="bottom-tab-"]');
      if (tabEl) {
        const tab = tabEl.id.replace('bottom-tab-', '');
        switchBottomTab(tab);
      }
    });
  }

  // Initialize Firebase (async)
  initFirebase().then(() => {
    console.log('%c[Social] Firebase ready (cloud mode)', 'color:#0a0');
  });

  // Start UI on Chat tab
  switchBottomTab('chat');

  window.addEventListener('resize', updateLayoutMode);
  setTimeout(updateLayoutMode, 100);

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === '/' && document.activeElement.tagName === 'BODY') {
      e.preventDefault();
      const s = document.getElementById('chat-search');
      if (s) { switchBottomTab('chat'); setTimeout(() => s.focus(), 20); }
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
      e.preventDefault(); createNewChat();
    }
  });

  console.log('%c[Social] Cloud version initialized. Sign in to sync across devices.', 'color:#555');
}

function loadDemoData() {
  // Seed sample data so the beautiful reference UI is visible immediately in demo mode
  chats = [
    {
      id: 'd1',
      name: 'Sarah Chen',
      lastMessage: 'Hey, are we still on for lunch?',
      time: '09:41',
      unread: 2,
      avatar: 'https://i.pravatar.cc/52?img=28',
      type: 'dm'
    },
    {
      id: 'd2',
      name: 'Team Sync',
      lastMessage: 'Alex: The deck looks great 👍',
      time: '08:12',
      unread: 0,
      avatar: 'https://i.pravatar.cc/52?img=15',
      type: 'group'
    },
    {
      id: 'd3',
      name: 'Mom',
      lastMessage: 'Call me when you land',
      time: 'Yesterday',
      unread: 0,
      avatar: 'https://i.pravatar.cc/52?img=40',
      type: 'dm',
      favorite: true
    },
    {
      id: 'd4',
      name: 'Vikram Patel',
      lastMessage: 'Sent the files over',
      time: 'Yesterday',
      unread: 1,
      avatar: 'https://i.pravatar.cc/52?img=47',
      type: 'dm'
    }
  ];

  // Pre-seed messages for the first chat so the conversation pane isn't empty on auto-open
  messages['d1'] = [
    { id: 'm1', text: 'Good morning! How did the presentation go?', fromMe: false, time: '09:12' },
    { id: 'm2', text: 'It went really well, thanks for asking!', fromMe: true, time: '09:18', status: 'read' },
    { id: 'm3', text: 'Hey, are we still on for lunch?', fromMe: false, time: '09:41' }
  ];
}

function enterDemoMode() {
  const overlay = document.getElementById('auth-overlay');
  if (overlay) overlay.style.display = 'none';
  loadDemoData();
  switchBottomTab('chat');
  renderChatList();
  // Auto open first chat to show the main UI (list + conversation) matching your reference screenshots
  if (chats.length > 0) {
    setTimeout(() => {
      openConversation(chats[0]);
    }, 120);
  }
  console.log('%c[Social] Demo mode - main UI visible matching your reference screenshots', 'color:#0a0');
}

window.SocialApp = { logout: window.logout, resetTheme: () => { localStorage.removeItem(STORAGE_KEY); location.reload(); } };

// === SAFE STUBS for missing functions (prevents runtime crashes, keeps demo / UI preview working) ===

function getWallpaperClass() {
  if (!currentTheme || !currentTheme.wallpaper || currentTheme.wallpaper === 'default') return '';
  return `wallpaper-${currentTheme.wallpaper}`;
}

window.pickBubbleColor = function () {
  const palette = ['#4A4A4C', '#00C853', '#3B82F6', '#8B5CF6', '#EF4444', '#F59E0B'];
  let idx = palette.indexOf(currentTheme.bubbleColor);
  if (idx === -1) idx = 0;
  currentTheme.bubbleColor = palette[(idx + 1) % palette.length];
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(currentTheme)); } catch (e) {}
  saveThemeToCloud();
  applyTheme();
  const swatch = document.getElementById('current-bubble-swatch');
  if (swatch) swatch.style.background = currentTheme.bubbleColor;
  renderThemeGrid();
};

window.pickWallpaper = function () {
  const options = ['default', 'subtle', 'dots'];
  let idx = options.indexOf(currentTheme.wallpaper || 'default');
  if (idx === -1) idx = 0;
  currentTheme.wallpaper = options[(idx + 1) % options.length];
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(currentTheme)); } catch (e) {}
  saveThemeToCloud();
  applyTheme();
  const msgs = document.getElementById('messages-container');
  if (msgs) {
    msgs.className = `flex-1 overflow-y-auto p-3 space-y-[3px] messages-area ${getWallpaperClass()}`;
  }
};

function renderCommunitiesScreen() {
  const container = document.getElementById('communities-list');
  if (!container) return;
  container.innerHTML = '';
  if (!communities || communities.length === 0) {
    container.innerHTML = `
      <div class="text-[#8E8E93] text-sm px-1">No communities yet. Create one to get started.</div>
    `;
    return;
  }
  communities.forEach(c => {
    const el = document.createElement('div');
    el.className = 'bg-[#1C1C1E] rounded-2xl px-4 py-3 flex items-center gap-x-3 cursor-pointer';
    el.innerHTML = `
      <div class="w-9 h-9 rounded-xl bg-[#2C2C2E] flex items-center justify-center flex-shrink-0">
        <i class="fa-solid fa-users text-[#8E8E93]"></i>
      </div>
      <div class="min-w-0">
        <div class="font-medium">${c.name || 'Community'}</div>
        <div class="text-xs text-[#8E8E93]">${c.memberCount || 0} members</div>
      </div>
    `;
    el.onclick = () => alert(`Opened community: ${c.name || 'Community'} (demo)`);
    container.appendChild(el);
  });
}

window.createNewCommunity = function () {
  if (!db || !currentUser) {
    const name = prompt('Community name:');
    if (name) {
      communities.push({ id: 'c' + Date.now(), name: name.trim(), memberCount: 1 });
      if (currentBottomTab === 'communities') renderCommunitiesScreen();
    }
    return;
  }
  const name = prompt('Community name:');
  if (!name) return;
  db.collection('communities').add({
    name: name.trim(),
    createdBy: currentUser.uid,
    memberCount: 1,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
};

window.showMoreCallOptions = function () {
  alert('More call options (demo): Schedule, Share link, etc.');
};

window.startCall = function (isVideo = false) {
  // Use the existing call modal in the HTML
  const modal = document.getElementById('call-modal');
  if (!modal) return alert('Call UI not available');
  modal.style.display = 'flex';
  document.getElementById('call-name').textContent = 'Voice Call';
  document.getElementById('call-status').textContent = 'Connecting...';
  document.getElementById('call-timer').textContent = '00:00';
  // minimal simulated timer
  if (window._callTimer) clearInterval(window._callTimer);
  let secs = 0;
  window._callTimer = setInterval(() => {
    secs++;
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    const t = document.getElementById('call-timer');
    if (t) t.textContent = `${m}:${s}`;
  }, 1000);
};

window.startCallWithUser = function (user) {
  const modal = document.getElementById('call-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  document.getElementById('call-avatar').innerHTML = `<img src="${user.avatar}" class="w-full h-full object-cover">`;
  document.getElementById('call-name').textContent = user.name || 'Contact';
  document.getElementById('call-status').textContent = 'Ringing...';
  document.getElementById('call-timer').textContent = '00:00';
};

window.startVideoCallWithUser = function (user) {
  window.startCallWithUser(user);
  const status = document.getElementById('call-status');
  if (status) status.textContent = 'Video call connecting...';
};

window.toggleMute = function () {
  isMuted = !isMuted;
  const btn = document.getElementById('mute-btn');
  if (btn) btn.style.color = isMuted ? '#ef4444' : '';
};

window.toggleVideo = function () {
  isVideoOn = !isVideoOn;
  const btn = document.getElementById('video-btn');
  if (btn) btn.style.color = isVideoOn ? '' : '#ef4444';
};

window.endCall = function () {
  const modal = document.getElementById('call-modal');
  if (modal) modal.style.display = 'none';
  if (window._callTimer) { clearInterval(window._callTimer); window._callTimer = null; }
  // also stop any camera streams if present (from openCamera)
};

window.closeConversation = function () {
  currentChatId = null;
  const listPane = document.getElementById('list-pane');
  const detailPane = document.getElementById('detail-pane');
  const empty = document.getElementById('detail-empty');
  if (listPane) listPane.style.display = 'flex';
  if (detailPane) detailPane.style.display = 'none';
  if (empty) empty.style.display = 'flex';
};

window.closeConversationDesktop = function () {
  currentChatId = null;
  const detailPane = document.getElementById('detail-pane');
  const empty = document.getElementById('detail-empty');
  if (detailPane) detailPane.style.display = 'none';
  if (empty) empty.style.display = 'flex';
  renderChatList();
};

window.toggleOfflineModeFromSettings = function () {
  isOffline = !isOffline;
  const el = document.getElementById('settings-offline-status');
  if (el) el.textContent = isOffline ? 'On' : 'Off';
  // In real app this would toggle Firestore network etc.
  console.log('[Demo] Offline mode toggled:', isOffline);
};

// === End stubs ===

// Auto start demo mode so you see the main app UI immediately (click auth buttons if you want cloud sync)
enterDemoMode();

init();
