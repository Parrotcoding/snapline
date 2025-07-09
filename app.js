const socket = new WebSocket('wss://snapline-server.onrender.com');
const loading = document.getElementById('loading');
const main = document.querySelector('main');
const chat = document.getElementById('chat');

let peerConnection;
let dataChannel;

// Step 1: Show loading screen until WebSocket is ready
socket.addEventListener('open', () => {
  loading.hidden = true;
  main.hidden = false;
  log("Connected to signaling server.");
  initWebRTC();
});

socket.addEventListener('message', async ({ data }) => {
  const message = JSON.parse(data);

  if (message.type === 'offer') {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(message));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.send(JSON.stringify(peerConnection.localDescription));
  } else if (message.type === 'answer') {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(message));
  } else if (message.type === 'candidate') {
    try {
      await peerConnection.addIceCandidate(message.candidate);
    } catch (e) {
      console.error("Failed to add ICE candidate", e);
    }
  }
});

function initWebRTC() {
  peerConnection = new RTCPeerConnection();

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
    }
  };

  dataChannel = peerConnection.createDataChannel("chat");

  dataChannel.onopen = () => log("DataChannel open!");
  dataChannel.onmessage = (e) => log("Peer: " + e.data);

  peerConnection.ondatachannel = (event) => {
    event.channel.onmessage = (e) => log("Peer: " + e.data);
  };

  peerConnection.createOffer().then(offer => {
    peerConnection.setLocalDescription(offer);
    socket.send(JSON.stringify(offer));
  });
}

function sendMessage() {
  const msg = document.getElementById('message').value;
  if (msg && dataChannel && dataChannel.readyState === 'open') {
    dataChannel.send(msg);
    log("You: " + msg);
    document.getElementById('message').value = '';
  }
}

function sendFile() {
  const file = document.getElementById('fileInput').files[0];
  if (file && dataChannel && dataChannel.readyState === 'open') {
    const reader = new FileReader();
    reader.onload = () => {
      dataChannel.send(JSON.stringify({ filename: file.name, data: reader.result }));
      log("You sent: " + file.name);
    };
    reader.readAsDataURL(file);
  }
}

function log(msg) {
  chat.value += msg + "\n";
  chat.scrollTop = chat.scrollHeight;
}
