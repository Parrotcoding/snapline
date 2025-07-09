document.addEventListener('DOMContentLoaded', () => {
  console.log("📦 DOM ready");

  const socket = new WebSocket('wss://snapline-server.onrender.com');

  const loading = document.getElementById('loading');
  const main = document.querySelector('main');
  const chat = document.getElementById('chat');
  const messageInput = document.getElementById('message');
  const fileInput = document.getElementById('fileInput');

  if (!loading || !main || !chat || !messageInput || !fileInput) {
    console.error("❌ Required UI element missing");
    return;
  }

  let peerConnection;
  let dataChannel;
  let hasReceivedOffer = false;

  socket.addEventListener('open', () => {
    console.log("✅ WebSocket connected");
    log("Connected to signaling server");

    // ✅ Show the UI, hide loading
    try {
      loading.hidden = true;
      loading.style.display = 'none';

      main.hidden = false;
      main.style.display = 'block';
      console.log("🟢 UI revealed");
    } catch (e) {
      console.error("❌ UI toggle failed", e);
    }

    setupPeer();

    // Wait briefly — if no offer, send one
    setTimeout(() => {
      if (!hasReceivedOffer) {
        createOffer();
      }
    }, 1000);
  });

  socket.addEventListener('error', (e) => {
    console.error("❌ WebSocket error", e);
    log("WebSocket error: " + e.message);
  });

  socket.addEventListener('close', () => {
    console.warn("🔌 WebSocket closed");
    log("WebSocket connection closed");
  });

  socket.addEventListener('message', async (event) => {
    let text;
    try {
      text = event.data instanceof Blob ? await event.data.text() : event.data;
    } catch (e) {
      console.error("❌ Failed to decode WebSocket message");
      return;
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("❌ Invalid JSON in message:", text);
      return;
    }

    if (data.type === 'offer') {
      hasReceivedOffer = true;
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.send(JSON.stringify(peerConnection.localDescription));
    } else if (data.type === 'answer') {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data));
    } else if (data.type === 'candidate') {
      try {
        await peerConnection.addIceCandidate(data.candidate);
      } catch (err) {
        console.error("⚠️ ICE candidate error:", err);
      }
    }
  });

  function setupPeer() {
    peerConnection = new RTCPeerConnection();

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
      }
    };

    peerConnection.ondatachannel = (event) => {
      setupDataChannel(event.channel);
    };
  }

  async function createOffer() {
    dataChannel = peerConnection.createDataChannel("chat");
    setupDataChannel(dataChannel);

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.send(JSON.stringify(offer));
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
    const file = fileInput.files[0];
    if (!file || dataChannel?.readyState !== 'open') return;

    const reader = new FileReader();
    reader.onload = () => {
      const payload = {
        type: 'file',
        filename: file.name,
        data: reader.result
      };
      dataChannel.send(JSON.stringify(payload));
      log(`📤 Sent file: ${file.name}`);
    };
    reader.readAsDataURL(file);
  }

  function setupDataChannel(channel) {
    dataChannel = channel;

    dataChannel.onopen = () => {
      log("✅ DataChannel open");
    };

    dataChannel.onmessage = (e) => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        log("Peer (raw): " + e.data);
        return;
      }

      if (msg.type === 'text') {
        log("Peer: " + msg.content);
      } else if (msg.type === 'file') {
        log(`📥 Received file: ${msg.filename}`);
        const link = document.createElement('a');
        link.href = msg.data;
        link.download = msg.filename;
        link.textContent = "⬇ Download " + msg.filename;
        link.style.display = 'block';
        chat.insertAdjacentElement('beforeend', link);
        chat.scrollTop = chat.scrollHeight;
      }
    };
  }

  function log(msg) {
    chat.value += msg + "\n";
    chat.scrollTop = chat.scrollHeight;
  }

  // 👇 Expose to HTML buttons
  window.sendMessage = sendMessage;
  window.sendFile = sendFile;
});
