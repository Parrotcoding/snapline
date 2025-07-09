const socket = new WebSocket('wss://snapline-server.onrender.com');

const loading = document.getElementById('loading');
const main = document.querySelector('main');
const chat = document.getElementById('chat');
const messageInput = document.getElementById('message');

let peerConnection;
let dataChannel;

socket.addEventListener('open', () => {
  console.log("✅ WebSocket connected");
  loading.hidden = true;
  main.hidden = false;
  log("Connected to signaling server");
  startWebRTC();
});

socket.addEventListener('error', (e) => {
  console.error("❌ WebSocket error", e);
  log("Error connecting to signaling server");
});

socket.addEventListener('close', () => {
  console.warn("🔌 WebSocket connection closed");
  log("WebSocket connection closed");
});

socket.addEventListener('message', async (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'offer') {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.send(JSON.stringify(peerConnection.localDescription));
  } else if (data.type === 'answer') {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data));
  } else if (data.type === 'candidate') {
    try {
      await peerConnection.addIceCandidate(data.candidate);
    } catch (e) {
      console.error("⚠️ Failed to add ICE candidate", e);
    }
  }
});

function startWebRTC() {
  peerConnection = new RTCPeerConnection();

  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      socket.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
    }
  };

  dataChannel = peerConnection.createDataChannel("chat");
  setupDataChannel(dataChannel);

  peerConnection.ondatachannel = (event) => {
    setupDataChannel(event.channel);
  };

  peerConnection.createOffer().then(offer => {
    peerConnection.setLocalDescription(offer);
    socket.send(JSON.stringify(offer));
  });
}

function sendMessage() {
  const msg = messageInput.value.trim();
  if (msg && dataChannel?.readyState === 'open') {
    dataChannel.send(JSON.stringify({ type: 'text', content: msg }));
    log("You: " + msg);
    messageInput.value = '';
  }
}

function sendFile() {
  const file = document.getElementById('fileInput').files[0];
  if (!file || dataChannel?.readyState !== 'open') return;

  const reader = new FileReader();
  reader.onload = () => {
    const payload = {
      type: 'file',
      filename: file.name,
      data: reader.result
    };
    dataChannel.send(JSON.stringify(payload));
    log(`You sent file: ${file.name}`);
  };
  reader.readAsDataURL(file);
}

function setupDataChannel(channel) {
  dataChannel = channel;

  dataChannel.onopen = () => log("✅ DataChannel open");
  dataChannel.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'text') {
        log("Peer: " + msg.content);
      } else if (msg.type === 'file') {
        log(`📥 Received file: ${msg.filename}`);
        const link = document.createElement('a');
        link.href = msg.data;
        link.download = msg.filename;
        link.textContent = "⬇ Download " + msg.filename;
        link.style.display = 'block';
        chat.value += "\n";
        chat.insertAdjacentElement('beforeend', link);
      }
    } catch {
      log("Peer (raw): " + e.data);
    }
  };
}

function log(msg) {
  chat.value += msg + "\n";
  chat.scrollTop = chat.scrollHeight;
}
