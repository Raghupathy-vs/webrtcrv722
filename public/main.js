import { startLocalMedia, shareScreen, stopScreenShare, getLocalStream, startCamera } from './media.js';
import { createPeerConnection, closePeerConnection, getPeerConnection } from './webrtc.js';
import { getElement, toggleMute, appendChatMessage, toggleCamera  } from './ui.js';
import { setupSocketHandlers } from './socketEvents.js';

const socket = io();

let peerConnection;
let started = false;
let isCaller = false;
let isVerified = false;
let recorder, recordedChunks = [];

window.addEventListener('beforeunload', () => {
  if (!started) return; 

  sessionStorage.setItem('roomId', getElement('roomId').value);
  sessionStorage.setItem('userName', getElement('username').value);
  sessionStorage.setItem('isCaller', isCaller);
  sessionStorage.setItem('cameraStarted', !!getLocalStream());
  sessionStorage.setItem('screenShared', !!window.screenShared);
});

window.addEventListener('load', async () => {
  
  
  const params = new URLSearchParams(window.location.search);
  
    const roomId = params.get("roomId");
        const username = params.get("username");
  const type = params.get("type");   // "start" or "join"

    const redirected = sessionStorage.getItem("redirectedOnce") === "true";
  
      const savedRoomId = sessionStorage.getItem('roomId');
  const savedUserName = sessionStorage.getItem('userName');
      const savedIsCaller = sessionStorage.getItem('isCaller') === "true";

  if (roomId) getElement("roomId").value = roomId;
  if (username) getElement("username").value = username;


  if (!redirected && savedRoomId && savedUserName) {
    console.log("Rejoining saved session...", savedRoomId, savedUserName);

    if (peerConnection) closePeerConnection();
    peerConnection = createPeerConnection(socket, savedRoomId);

    if (!socket.hasHandlers) {
      setupSocketHandlers(socket);
      socket.hasHandlers = true;
    }

    socket.emit('rejoin-room', {
      roomId: savedRoomId,
      userName: savedUserName
    });

    const savedChats = JSON.parse(sessionStorage.getItem("chatMessages") || "[]");
    savedChats.forEach(({ message, isMine }) => {
      appendChatMessage(message, isMine);
    });

    started = true;
    isCaller = savedIsCaller;

    return; 
  }

  if (type === "start") {
    console.log("Auto starting meeting...");
    getElement("startBtn").click();
  }

  if (type === "join") {
    console.log("Auto joining meeting...");
    getElement("joinBtn").click();
  }

  sessionStorage.removeItem("redirectedOnce");
});


getElement('startBtn').onclick = async () => {
  if (started) return;
  started = true;
  isCaller = true;

  const username = getElement('username').value;
  const room = getElement('roomId').value;

  socket.emit('join', { roomId: room, username });

  peerConnection = createPeerConnection(socket, room);

  if (!socket.hasHandlers) {
    setupSocketHandlers(socket);
    socket.hasHandlers = true;
  }

  sessionStorage.setItem("redirectedOnce", "true");
};


getElement('joinBtn').onclick = async () => {
  if (started) return;
  started = true;
  isCaller = false;

  const username = getElement('username').value;
  const room = getElement('roomId').value;

  socket.emit('join', { roomId: room, username }); 
  peerConnection = createPeerConnection(socket, room);
  socket.emit('ready-for-offer', room); 

  if (!socket.hasHandlers) {
    setupSocketHandlers(socket);
    socket.hasHandlers = true;
  }

  sessionStorage.setItem("redirectedOnce", "true");
};


socket.on('room-joined', (data) => {
  isCaller = data.callerId === socket.id;
});

getElement('cameraToggleBtn').onclick = async () => {
  const btn = getElement('cameraToggleBtn');

  if (!peerConnection) {
    alert("Start or Connect first!");
    return;
  }

  const isCameraOn = sessionStorage.getItem("cameraStarted") === "true";

  if (!isCameraOn) {
    await startCamera(peerConnection, socket, getElement('roomId').value);
    getElement('localVideo').style.display = 'block';
    getElement('remoteVideo').style.display = 'block';
    sessionStorage.setItem("cameraStarted", true);

    btn.textContent = "🎥"; 
    btn.classList.remove('off');
  } else {
    const stream = getLocalStream();
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
        const sender = peerConnection.getSenders().find(s => s.track === track);
        if (sender) peerConnection.removeTrack(sender);
      });
      getElement('localVideo').srcObject = null;
      socket.emit('negotiate', getElement('roomId').value);
    }

    sessionStorage.setItem("cameraStarted", false);

    btn.textContent = "❌"; 
    btn.classList.add('off');
  }
};

getElement('screenToggleBtn').onclick = async () => {
  const btn = getElement('screenToggleBtn');
  const roomId = getElement('roomId').value;

  if (!peerConnection) {
    alert("Start or Connect first!");
    return;
  }

  const isScreenShared = sessionStorage.getItem("screenShared") === "true";

  if (!isScreenShared) {
    await shareScreen(peerConnection, getElement('sharedScreen'), roomId, socket);
    window.screenShared = true;
    sessionStorage.setItem("screenShared", true);

    btn.textContent = "🖥️"; 
    btn.classList.remove('off');
  } else {
    stopScreenShare(getElement('sharedScreen'), socket, roomId, peerConnection);
    window.screenShared = false;
    sessionStorage.setItem("screenShared", false);

    btn.textContent = "❌"; 
    btn.classList.add('off');
  }
};

getElement('muteButton').onclick = () => {
  toggleMute(getLocalStream(), getElement('muteButton'));
};

getElement('endCallBtn').onclick = () => {
  if (!isCaller) {
    alert("Only the caller can end the call. Please use Leave Call.");
    return;
  }

  const room = getElement('roomId').value;
  socket.emit('end-call');

  closePeerConnection();

  sessionStorage.removeItem("chatMessages");
  sessionStorage.removeItem("roomId");
  sessionStorage.removeItem("userName");
  sessionStorage.removeItem("isCaller");
  sessionStorage.removeItem("cameraStarted");
  sessionStorage.removeItem("screenShared");

  socket.disconnect();
  alert("Call ended by Caller");
  window.location.href = "/index.html";
};

getElement('leaveCallBtn').onclick = () => {
  socket.emit('leave-call'); 

  closePeerConnection();

  sessionStorage.removeItem("chatMessages");
  sessionStorage.removeItem("roomId");
  sessionStorage.removeItem("userName");
  sessionStorage.removeItem("isCaller");
  sessionStorage.removeItem("cameraStarted");
  sessionStorage.removeItem("screenShared");

  socket.disconnect();
  alert("You left the call");
  window.location.href = "/index.html";
};


const raiseHandBtn = getElement("raiseHandBtn");
const usernameInput = getElement("username");

raiseHandBtn.addEventListener("click", () => {
  const username = usernameInput.value.trim() || "Anonymous";
  const room = getElement("roomId").value;

  socket.emit("raise-hand", { username, room });
});

socket.on("raise-hand", ({ username }) => {
  showRaiseHandPopup(`${username} raised hand ✋`);
});

function showRaiseHandPopup(message) {
  const popup = document.createElement("div");
  popup.className = "raise-hand-popup";
  popup.textContent = message;
  document.body.appendChild(popup);

  setTimeout(() => popup.classList.add("visible"), 10);

  setTimeout(() => {
    popup.classList.remove("visible");
    setTimeout(() => popup.remove(), 500);
  }, 3000);
}




document.getElementById("sendBtn").onclick = () => {
  const message = document.getElementById("chatInput").value.trim();
  const username = document.getElementById("username").value;
  const room = document.getElementById("roomId").value;

  if (!message) return;

  const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  socket.emit("chat-message", { room, username, message, timestamp });

  appendChatMessage(`${username} : ${message} - (${timestamp})`, true);

  document.getElementById("chatInput").value = "";
};


socket.on("chat-message", ({ username, message, timestamp }) => {
  appendChatMessage(`${username} : ${message} - (${timestamp})`, false);
});



const chatContainer = getElement('chatContainer');
const chatBtn = getElement('openChatBtn');

chatBtn.addEventListener('click', () => {
  if (chatContainer.style.display === "none") {
    chatContainer.style.display = "block";  
  } else {
    chatContainer.style.display = "none";   
  }
});




const fileInput = document.getElementById('fileInput');
const sendFileBtn = document.getElementById('sendFileBtn');

sendFileBtn.onclick = () => {
  const file = fileInput.files[0];
  if (!file) return;

  console.log(file); 

  const reader = new FileReader();

  reader.onload = () => {
    const base64 = reader.result;                    
    const room = getElement('roomId').value;         
    const username = getElement('username').value;   

    socket.emit('file-share', {                      
      room,
      username,
      fileName: file.name,
      data: base64
    });

    fileInput.value = ''; 
  };

  reader.readAsDataURL(file); 
};






socket.on('file-share', ({ username, fileName, data }) => {
  const messages = getElement('messages');
  const el = document.createElement('div');

  if (data.startsWith('data:image')) {
    const img = document.createElement('img');
        img.src = data;
    img.style.maxWidth = '200px';

    el.appendChild(document.createTextNode(`${username} sent an image:`));
      
        el.appendChild(document.createElement('br')); 
    el.appendChild(img);

         const downloadLink = document.createElement('a');
      
         downloadLink.href = data;
    downloadLink.download = fileName;  
    
    
    downloadLink.textContent = 'Download';
    downloadLink.style.display = 'block';
    
    
    
    downloadLink.style.marginTop = '5px';
    el.appendChild(downloadLink);

  } else {
    const link = document.createElement('a');
    link.href = data;
          link.download = fileName;
      link.textContent = `${username} sent: ${fileName} (Click to Download)`;
    el.appendChild(link);
  }

  messages.appendChild(el);
  messages.scrollTop = messages.scrollHeight;
});





document.addEventListener("DOMContentLoaded", () => {
  const participantsDiv = getElement("participants");

  window.sendReaction = function(emoji) {
    const roomId = getElement('roomId').value;
    const username = getElement('username').value.trim() || socket.id || 'Anonymous';

    if (!roomId) {
      alert('Please enter a Meeting ID before sending reactions.');
      return;
    }

    socket.emit('reaction', { roomId, username, emoji });
  };

 document.querySelectorAll('#reactions button:not(#moreReactionsBtn)').forEach(btn => {
  btn.addEventListener('click', () => {
    window.sendReaction(btn.textContent);
  });
});

  document.querySelectorAll('#extraReactions button').forEach(btn => {
    btn.addEventListener('click', () => {
      window.sendReaction(btn.textContent);
      popup.classList.remove("show");
    });
  });

socket.on("reaction-display", ({ username, emoji }) => {
  const emojiEl = document.createElement("div");
  emojiEl.className = "floating-emoji";
          
  emojiEl.textContent = `${username}: ${emoji}`;

  document.body.appendChild(emojiEl);

  setTimeout(() => emojiEl.remove(), 2500);
});
});



const moreBtn = document.getElementById("moreReactionsBtn");
  
  const popup = document.getElementById("emojiPopup");
const closePopup = document.getElementById("closePopup");

moreBtn.addEventListener("click", () => {
  popup.classList.add("show");
});

closePopup.addEventListener("click", () => {
  popup.classList.remove("show");
});

window.addEventListener("click", (event) => {
  if (event.target === popup) {
    popup.classList.remove("show");
  }
});



document.getElementById("setReminderBtn").addEventListener("click", () => {
  const date = document.getElementById("reminderDate").value;
        const msg = document.getElementById("reminderMsg").value;
  const username = document.getElementById("username").value.trim() || "Anonymous";
    const room = document.getElementById("roomId").value;

  if (!date || !msg) {
    return alert("Pick a date and message!");
  }

  const selectedTime = new Date(date).getTime();
  const now = Date.now();

  if (selectedTime <= now) {
    return alert("You cannot select a past date!");
  }

  const reminder = { date, msg, username, room };
  socket.emit("newReminder", reminder);
});


socket.on("reminderAdded", (reminder) => {
    
  const participantsDiv = document.getElementById("participants");
      
    const item = document.createElement("div");

        const d = new Date(reminder.date);
    const formattedDate = d.toLocaleDateString("en-GB");
  const displayDate = formattedDate.replace(/\//g, "-");

  item.className = "room-activity";
  item.textContent = `${reminder.username}: ${displayDate} → ${reminder.msg}`;
  
  participantsDiv.appendChild(item);
  participantsDiv.scrollTop = participantsDiv.scrollHeight;

  scheduleReminder(reminder);
});


function scheduleReminder(reminder) {
  
  const reminderTime = new Date(reminder.date).getTime();
      const now = Date.now();
  
      const delay = reminderTime - now;

  if (delay <= 0) return; 

  setTimeout(() => {
    alert("📅 Reminder: " + reminder.msg);

    const chatBox = document.getElementById("messages");
    const msgEl = document.createElement("div");
    
    msgEl.textContent = "🔔 Reminder: " + reminder.msg;
    
      msgEl.className = "reminder-notification";
    chatBox.appendChild(msgEl);
    
      chatBox.scrollTop = chatBox.scrollHeight;

  }, delay);
}



document.getElementById('recordMainBtn').onclick = () => {
  document.getElementById('recordPopup').style.display = 'block';
};

document.getElementById('closeRecordPopup').onclick = () => {
  document.getElementById('recordPopup').style.display = 'none';
};

document.getElementById('startRecord').onclick = async () => {
  const local = getLocalStream();
  const remote = document.getElementById('remoteVideo').srcObject;
  if (!local && !remote) {
    alert("Start the camera or join a call before recording!");
    return;
  }

  const mixed = new MediaStream();
  if (local) local.getTracks().forEach(t => mixed.addTrack(t));
  if (remote) remote.getTracks().forEach(t => mixed.addTrack(t));

  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm;codecs=vp8';

  recorder = new MediaRecorder(mixed, { mimeType });

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };

  recorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'meeting_recording.webm';
    a.click();
    recordedChunks = [];
    window.lastRecordingBlob = blob;
    document.getElementById('uploadRecord').disabled = false;
  };

  recorder.start();
  console.log('Recording started');
};

document.getElementById('stopRecord').onclick = () => {
  if (recorder && recorder.state !== 'inactive') {
    recorder.stop();
    console.log('Recording stopped');
  }
};

document.getElementById('uploadRecord').onclick = async () => {
  const blob = window.lastRecordingBlob;
  if (!blob) {
    alert("No recording found to upload!");
    return;
  }

  const formData = new FormData();
  formData.append('video', blob, 'meeting_recording.webm');

  try {
    const res = await fetch('/upload-video', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    alert(data.message || "Upload successful!");
    document.getElementById('uploadRecord').disabled = true;
  } catch (err) {
    console.error(err);
    alert("Upload failed!");
  }
};