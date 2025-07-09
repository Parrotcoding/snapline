document.addEventListener('DOMContentLoaded', () => {
  console.log("📦 DOM ready");

  // UI references
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

  let localName = prompt("Enter your name (nickname):") || "Anonymous";
  let localId = crypto.randomUUID();
  let peers = {};
  let currentChat = null;

  const socket = new WebSocket('wss://snapline-server.onrender.com');

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

  const deviceLabel = `${detectPlatform()} ${detectBrowser()}`;
  const avatar = /iOS|Android/.test(detectPlatform()) ? '📱' : '💻';

  // Show local user info
  selfInfo.innerText = `You: ${localName} • ${deviceLabel}`;

  // WebSocket communication
  socket.addEventListener('open', () => {
    console.log("✅ WebSocket connected");

    socket.send(JSON.stringify({
      type: 'join',
      id: localId,
      name: localName,
      device: deviceLabel
    }));

    loading.hidden = true;
    home.hidden = false;
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
    for (const [id, peer] of Object.entries(peers)) {
      const li = document.createElement('li');
      li.innerHTML = `
        <div>
          <strong>${peer.name}</strong><br />
          <small>${peer.device}</small>
        </div>
        <span>${avatar}</span>
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
    alert("File sending will be added in the next update.");
  };

  backButton.onclick = () => {
    chatView.hidden = true;
    home.hidden = false;
    currentChat = null;
  };
});
