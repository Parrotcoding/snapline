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
  const selfInfo = document.getElementById('selfInfo');

  let localId = crypto.randomUUID();
  let localName = generateRandomName();
  let localDevice = `${detectPlatform()} ${detectBrowser()}`;
  let peers = {};
  let currentChat = null;

  const socket = new WebSocket('wss://snapline-server.onrender.com');

  // Show self info
  function renderSelfInfo() {
    selfInfo.innerHTML = `<strong id="selfName">${localName}</strong> • ${localDevice} <span style="opacity:0.5;">(You)</span>`;
    selfInfo.style.cursor = "pointer";
    selfInfo.ondblclick = () => {
      const input = document.createElement("input");
      input.value = localName;
      input.style.borderRadius = "12px";
      input.onblur = finishRename;
      input.onkeydown = (e) => {
        if (e.key === "Enter") finishRename();
      };
      selfInfo.replaceChildren(input);
      input.focus();

      function finishRename() {
        localName = input.value.trim() || localName;
        renderSelfInfo();
        broadcastPresence();
      }
    };
  }

  renderSelfInfo();

  socket.addEventListener('open', () => {
    console.log("✅ WebSocket connected");
    broadcastPresence();

    // Immediately show UI
    if (loading) loading.style.display = 'none';
    if (home) {
      home.hidden = false;
      home.style.display = 'block';
    }
  });

  socket.addEventListener('message', async (event) => {
    let data;
    try {
      const text = event.data instanceof Blob ? await event.data.text() : event.data;
      data = JSON.parse(text);
    } catch (err) {
      console.error("Failed to parse WebSocket message:", err);
      return;
    }

    if (data.type === 'peerlist') {
      updatePeerList(data.peers);
    }

    if (data.type === 'message' && data.from && data.to === localId) {
      const peer = peers[data.from];
      if (!peer) return;

      if (!peer.messages) peer.messages = [];
      peer.messages.push({ from: data.name, text: data.content });

      if (currentChat === data.from) {
        renderChat(data.from);
      }
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
    for (const peer of list) {
      if (peer.id === localId) continue;
      peers[peer.id] = {
        ...peer,
        messages: peers[peer.id]?.messages || [],
      };
    }
    renderPeerList();
  }

  function renderPeerList() {
    peerList.innerHTML = '';

    // Show self first
    const selfLi = document.createElement('li');
    selfLi.innerHTML = `
      <div>
        <strong>${localName}</strong><br />
        <small>${localDevice} (You)</small>
      </div>
      <span>${getDeviceIcon(localDevice)}</span>
    `;
    selfLi.style.background = '#e0f7ff';
    peerList.appendChild(selfLi);

    for (const [id, peer] of Object.entries(peers)) {
      const li = document.createElement('li');
      li.innerHTML = `
        <div>
          <strong>${peer.name}</strong><br />
          <small>${peer.device}</small>
        </div>
        <span>${getDeviceIcon(peer.device)}</span>
      `;
      li.onclick = () => {
        currentChat = id;
        openChat(id);
      };
      peerList.appendChild(li);
    }
  }

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
      const line = document.createElement('div');
      line.innerText = `${msg.from}: ${msg.text}`;
      chatBox.appendChild(line);
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

  window.sendFile = function () {
    alert("File sending coming soon.");
  };

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
    const a = adjectives[Math.floor(Math.random() * adjectives.length)];
    const b = nouns[Math.floor(Math.random() * nouns.length)];
    return `${a} ${b}`;
  }
});
