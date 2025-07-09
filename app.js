document.addEventListener('DOMContentLoaded', () => {
  const socket = new WebSocket('wss://snapline-server.onrender.com');

  const loading = document.getElementById('loading');
  const main = document.querySelector('main');
  const chat = document.getElementById('chat');
  const messageInput = document.getElementById('message');

  if (!loading || !main || !chat || !messageInput) {
    console.error("❌ One or more UI elements not found.");
    return;
  }

  let peerConnection;
  let dataChannel;
  let hasReceivedOffer = false;

  socket.addEventListener('open', () => {
    console.log("✅ WebSocket connected");
    loading.hidden = true;
    main.hidden = false;
    log("Connected to signaling server");

    setupPeer();

    // Wait to see if an offer arrives, if not, create one
    setTimeout(() => {
      if (!hasReceivedOffer) {
        createOffer();
      }
    }, 1000);
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
    let dataText;
    if (event.data instanceof Blob) {
      dataText = await event.data.text();
    } else {
      dataText = event.data;
    }

    const data = JSON.parse(dataText);

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
      } catch (e) {
        console.error("⚠️ Failed to add ICE candidate", e);
      }
    }
  });

  function setupPeer() {
    peerConnection = new RTCPeerConnection();

    peerConnection.onicecandidate = event => {
      if (event.candidate) {
        socket.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
      }
    };

    peerConnection.ondatachannel = event => {
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
      log(`📤 Sent file: ${file.name}`);
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

  // Make sendMessage and sendFile global for button access
  window.sendMessage = sendMessage;
  window.sendFile = sendFile;
});
