//webrtc.js
import { getLocalStream } from './media.js';
import { getElement } from './ui.js';

let peerConnection = null;
let transceiversAdded = false;

const servers = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

export function createPeerConnection(socket, roomId) {
  peerConnection = new RTCPeerConnection(servers);
  
  
  if (!transceiversAdded) {
    peerConnection.addTransceiver('audio', { direction: 'recvonly' });
    peerConnection.addTransceiver('video', { direction: 'recvonly' });
    peerConnection.addTransceiver('video', { direction: 'recvonly' });
    transceiversAdded = true;
  }

  peerConnection.onicecandidate = (event) => {        //29.
    if (event.candidate) {
      socket.emit('ice-candidate', { room: roomId, candidate: event.candidate });   //30.
    }
  };

  peerConnection.ontrack = (event) => {
    const stream = event.streams[0];
    
    if (event.track.kind === 'video') {
      const video = getElement('remoteVideo');  
      const screen = getElement('remoteScreen');

      if (!video.srcObject) video.srcObject = stream;
      else if (!screen.srcObject) screen.srcObject = stream;
    }

    if (event.track.kind === 'audio') {
      const audio = document.createElement('audio');
      audio.srcObject = stream;
      audio.autoplay = true;
      document.body.appendChild(audio);
    }
  };

  peerConnection.onconnectionstatechange = () => {
  console.log("Connection State:", peerConnection.connectionState);

  if (peerConnection.connectionState === "connected") {
    console.log("User 1 and User 2 both connected!");
     showMeetingStarted();
  }
};
  return peerConnection;
}

export async function handleOffer(socket, roomId, offer) {        //15.     //15a.
  if (!peerConnection) createPeerConnection(socket, roomId);
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  
    const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit('answer', { room: roomId, answer });             //16.         //16a.
}

export async function renegotiate(socket, roomId) {               //9a.
  const offer = await peerConnection.createOffer({ iceRestart: true });
  await peerConnection.setLocalDescription(offer);
  socket.emit('offer', { room: roomId, offer });                //10a.after share screen
}

export function getPeerConnection() {
  return peerConnection;
}

export function closePeerConnection() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
    transceiversAdded = false;
  }
}