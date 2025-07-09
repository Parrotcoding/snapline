const socket = new WebSocket('wss://snapline-server.onrender.com');
const loading = document.getElementById('loading');
const home = document.getElementById('home');
const chatView = document.getElementById('chatView');
const peerList = document.getElementById('peerList');
const chatBox = document.getElementById('chatBox');
const messageInput = document.getElementById('messageInput');
const fileInput = document.getElementById('fileInput');
const sendButton = document.getElementById('sendButton');
const typingIndicator = document.getElementById('typingIndicator');
const chatHeader = document.getElementById('chatHeader');
const notifications = document.getElementById('notifications');
const popup = document.getElementById('downloadPopup');
const popupText = document.getElementById('popupText');
const popupConfirm = document.getElementById('popupConfirm');
const popupCancel = document.getElementById('popupCancel');

let selfId = '';
let peers = {};
let chats = {};
let currentChat = null;
let typingTimeout = null;
let fileBlob = null;
let fileName = '';

function randomName() {
  const adj = ['Swift', 'Clever', 'Happy', 'Quiet', 'Brave'];
  const noun = ['Falcon', 'Otter', 'Fox', 'Hawk', 'Panda'];
  return adj[Math.floor(Math.random() * adj.length)] + ' ' + noun[Math.floor(Math.random() * noun.length)];
}

let selfName = randomName();
let selfDevice = navigator.userAgent.includes('Mac') ? 'Mac Safari' : 'Other';

function showUI() {
  loading.hidden = true;
  home.hidden = false;
}

function renderPeers() {
  peerList.innerHTML = '';
  const selfLi = document.createElement('li');
  selfLi.className = 'peer-card';
  selfLi.innerHTML = `<div><strong contenteditable id="editName">${selfName}</strong><br /><small>${selfDevice} (you)</small></div>`;
  selfLi.ondblclick = () => document.getElementById('editName').focus();
  document.getElementById('editName').oninput = e => {
    selfName = e.target.innerText.trim();
    sendPresence();
  };
  peerList.appendChild(selfLi);

  for (const [id, peer] of Object.entries(peers)) {
    const li = document.createElement('li');
    li.className = 'peer-card';
    li.innerHTML = `<div><strong>${peer.name}</strong><br /><small>${peer.device}</small></div>`;
    li.onclick = () => openChat(id);
    peerList.appendChild(li);
  }
}

function openChat(id) {
  currentChat = id;
  home.hidden = true;
  chatView.hidden = false;
  chatHeader.textContent = peers[id]?.name || 'Group Chat';
  renderChat(id);
}

function renderChat(id) {
  chatBox.innerHTML = '';
  const chat = chats[id] || [];
  for (const msg of chat) {
    const div = document.createElement('div');
    div.className = msg.from === selfId ? 'from-you' : 'from-them';

    if (msg.file) {
      const preview = document.createElement('div');
      preview.className = 'preview';

      if (msg.file.type.startsWith('image')) {
        const img = document.createElement('img');
        img.src = msg.file.url;
        preview.appendChild(img);
      } else if (msg.file.type.startsWith('video')) {
        const vid = document.createElement('video');
        vid.src = msg.file.url;
        vid.controls = true;
        preview.appendChild(vid);
      } else if (msg.file.type.startsWith('text')) {
        fetch(msg.file.url).then(res => res.text()).then(txt => {
          const pre = document.createElement('pre');
          pre.textContent = txt.slice(0, 200);
          preview.appendChild(pre);
        });
      }

      const name = document.createElement('span');
      name.className = 'file-name';
      name.textContent = msg.file.name;
      name.onclick = () => {
        popup.hidden = false;
        popupText.textContent = `Download ${msg.file.name}?`;
        popupConfirm.onclick = () => {
          const a = document.createElement('a');
          a.href = msg.file.url;
          a.download = msg.file.name;
          a.click();
          popup.hidden = true;
        };
        popupCancel.onclick = () => popup.hidden = true;
      };

      div.appendChild(preview);
      div.appendChild(name);
    } else {
      div.textContent = msg.text;
    }

    chatBox.appendChild(div);
  }
  chatBox.scrollTop = chatBox.scrollHeight;
}

function addMessage(id, msg) {
  if (!chats[id]) chats[id] = [];
  chats[id].push(msg);

  if (currentChat === id) {
    renderChat(id);
  } else {
    showNotification(peers[id]?.name || 'Unknown', msg.file?.name || msg.text);
  }
}

function showNotification(from, content) {
  const note = document.createElement('div');
  note.className = 'notice';
  note.innerHTML = `<div class="sender">${from}</div><div class="preview">${content.length > 40 ? content.slice(0, 40) + '…' : content}</div>`;
  notifications.appendChild(note);
  setTimeout(() => note.remove(), 5000);
}

function sendPresence() {
  socket.send(JSON.stringify({ type: 'presence', name: selfName, device: selfDevice }));
}

sendButton.onclick = () => {
  const text = messageInput.value.trim();
  if (text === '' && !fileBlob) return;

  const msg = { type: 'message', to: currentChat, from: selfId, text };

  if (fileBlob) {
    const url = URL.createObjectURL(fileBlob);
    msg.file = { name: fileName, type: fileBlob.type, url };
    fileBlob = null;
    fileName = '';
  }

  addMessage(currentChat, { ...msg });
  socket.send(JSON.stringify(msg));
  messageInput.value = '';
};

fileInput.onchange = e => {
  const file = e.target.files[0];
  if (!file) return;
  fileBlob = file;
  fileName = file.name;
  messageInput.value = fileName;
};

messageInput.oninput = () => {
  socket.send(JSON.stringify({ type: 'typing', to: currentChat }));
};

socket.onopen = () => {
  showUI();
  sendPresence();
};

socket.onmessage = e => {
  const data = JSON.parse(e.data);
  if (data.type === 'id') {
    selfId = data.id;
  } else if (data.type === 'presence') {
    peers[data.id] = { name: data.name, device: data.device };
    renderPeers();
  } else if (data.type === 'message') {
    addMessage(data.from, data);
  } else if (data.type === 'typing' && data.from === currentChat) {
    typingIndicator.hidden = false;
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => typingIndicator.hidden = true, 2000);
  }
};

document.getElementById('backButton').onclick = () => {
  chatView.hidden = true;
  home.hidden = false;
};

popup.onclick = e => {
  if (e.target === popup) popup.hidden = true;
};
