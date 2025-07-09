document.addEventListener('DOMContentLoaded', () => {
  const loading = document.getElementById('loading');
  const home = document.getElementById('home');
  const chatView = document.getElementById('chatView');
  const peerList = document.getElementById('peerList');
  const chatBox = document.getElementById('chatBox');
  const chatHeader = document.getElementById('chatHeader');
  const messageInput = document.getElementById('messageInput');
  const fileInput = document.getElementById('fileInput');
  const backButton = document.getElementById('backButton');

  let localId = crypto.randomUUID();
  let localName = generateRandomName();
  let localDevice = `${detectPlatform()} ${detectBrowser()}`;
  let peers = {};
  let currentChat = null;

  const socket = new WebSocket('wss://snapline-server.onrender.com');

  socket.addEventListener('open', () => {
    console.log("✅ WebSocket connected");
    broadcastPresence();
    loading.style.display = 'none';
    home.hidden = false;
  });

  socket.addEventListener('message', async (event) => {
    let data;
    try {
      const text = event.data instanceof Blob ? await event.data.text() : event.data;
      data = JSON.parse(text);
    } catch (err) {
      console.error("Invalid message:", err);
      return;
    }

    if (data.type === 'peerlist') updatePeerList(data.peers);
    if (data.type === 'message' && data.to === localId) {
      const peer = peers[data.from];
      if (!peer) return;

      if (!peer.messages) peer.messages = [];
      peer.messages.push({ from: peer.name, text: data.content, file: data.file });

      if (currentChat === data.from) renderChat(data.from);
    }
  });

  function broadcastPresence() {
    socket.send(JSON.stringify({
      type: 'join',
      id: localId,
      name: localName,
      device: localDevice
    }));
  }

  function updatePeerList(list) {
    peers = {};
    peerList.innerHTML = '';

    // Own contact card
    const me = document.createElement('li');
    me.innerHTML = `<strong contenteditable="true" onblur="updateName(this)">${localName}</strong><br/><small>${localDevice} (You)</small>`;
    me.className = 'peer-card';
    peerList.appendChild(me);

    for (const peer of list) {
      if (peer.id === localId) continue;
      peers[peer.id] = {
        ...peer,
        messages: peers[peer.id]?.messages || [],
      };

      const li = document.createElement('li');
      li.innerHTML = `
        <div>
          <strong>${peer.name}</strong><br />
          <small>${peer.device}</small>
        </div>
        <span>${getDeviceIcon(peer.device)}</span>
      `;
      li.className = 'peer-card';
      li.onclick = () => {
        currentChat = peer.id;
        openChat(peer.id);
      };
      peerList.appendChild(li);
    }
  }

  window.updateName = (el) => {
    localName = el.innerText.trim();
    broadcastPresence();
  };

  function openChat(peerId) {
    home.hidden = true;
    chatView.hidden = false;
    const peer = peers[peerId];
    chatHeader.innerText = `${peer.name} • ${peer.device}`;
    renderChat(peerId);
  }

  function renderChat(peerId) {
    const peer = peers[peerId];
    chatBox.innerHTML = '';
    for (const msg of peer.messages) {
      const div = document.createElement('div');
      const isSelf = msg.from === "You";
      div.className = isSelf ? 'from-you' : 'from-them';

      if (msg.file) {
        const preview = document.createElement('div');
        preview.className = 'preview';

        if (msg.file.type.startsWith('image/')) {
          const img = document.createElement('img');
          img.src = msg.file.data;
          preview.appendChild(img);
        } else if (msg.file.type.startsWith('video/')) {
          const vid = document.createElement('video');
          vid.src = msg.file.data;
          vid.controls = true;
          preview.appendChild(vid);
        } else if (msg.file.type.startsWith('text/')) {
          const pre = document.createElement('pre');
          pre.innerText = atob(msg.file.data.split(',')[1]).slice(0, 200);
          preview.appendChild(pre);
        }

        const fileName = document.createElement('span');
        fileName.className = 'file-name';
        fileName.innerText = msg.file.name;
        fileName.onclick = () => {
          if (confirm(`Download ${msg.file.name}?`)) {
            const a = document.createElement('a');
            a.href = msg.file.data;
            a.download = msg.file.name;
            a.click();
          }
        };

        div.appendChild(preview);
        div.appendChild(fileName);
      }

      if (msg.text) {
        const text = document.createElement('div');
        text.innerText = msg.text;
        div.appendChild(text);
      }

      chatBox.appendChild(div);
    }
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  window.sendMessage = function () {
    const msg = messageInput.value.trim();
    if (!msg || !currentChat) return;

    const peer = peers[currentChat];
    peer.messages.push({ from: "You", text: msg });
    renderChat(currentChat);

    socket.send(JSON.stringify({
      type: 'message',
      from: localId,
      to: currentChat,
      name: localName,
      content: msg
    }));

    messageInput.value = '';
  };

  fileInput.addEventListener('change', async () => {
    if (!fileInput.files[0] || !currentChat) return;
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const peer = peers[currentChat];
      peer.messages.push({ from: "You", file: { name: file.name, data: dataUrl, type: file.type } });
      renderChat(currentChat);

      socket.send(JSON.stringify({
        type: 'message',
        from: localId,
        to: currentChat,
        name: localName,
        file: { name: file.name, data: dataUrl, type: file.type }
      }));
    };
    reader.readAsDataURL(file);
  });

  backButton.onclick = () => {
    chatView.hidden = true;
    home.hidden = false;
    currentChat = null;
  };

  function detectPlatform() {
    const ua = navigator.userAgent;
    if (/Android/i.test(ua)) return "Android";
    if (/iPhone|iPad/i.test(ua)) return "iOS";
    if (/Win/i.test(ua)) return "Windows";
    if (/Mac/i.test(ua)) return "Mac";
    if (/Linux/i.test(ua)) return "Linux";
    return "Device";
  }

  function detectBrowser() {
    const ua = navigator.userAgent;
    if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return "Safari";
    if (/Firefox/i.test(ua)) return "Firefox";
    if (/Edg/i.test(ua)) return "Edge";
    if (/Chrome/i.test(ua)) return "Chrome";
    return "Browser";
  }

  function getDeviceIcon(device) {
    if (device.includes("Safari")) return "🧭";
    if (device.includes("Firefox")) return "🦊";
    if (device.includes("Edge")) return "🧊";
    if (device.includes("Android") || device.includes("iOS")) return "📱";
    return "💻";
  }

  function generateRandomName() {
    const adjectives = ["Fuzzy", "Bold", "Silent", "Brave", "Clever", "Happy", "Tiny", "Witty", "Curious", "Mighty"];
    const nouns = ["Tiger", "Skater", "Falcon", "Penguin", "Robot", "Artist", "Wizard", "Explorer", "Koala", "Pilot"];
    return `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${nouns[Math.floor(Math.random() * nouns.length)]}`;
  }
});
