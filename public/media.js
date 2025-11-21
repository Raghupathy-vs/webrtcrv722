//media.js
let localStream = null;
let screenStream = null;

export async function startLocalMedia(videoElement) {
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
  videoElement.srcObject = localStream;
  return localStream;
}

export async function startCamera(peerConnection, socket, roomId) {
  const stream = await startLocalMedia(document.getElementById('localVideo'));
  stream.getTracks().forEach(track => {
    peerConnection.addTrack(track, stream); // Use stream not localStream
  });

  socket.emit('negotiate', roomId);
}

export async function shareScreen(peerConnection, sharedVideoElement, roomId, socket) {
  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true
    });

    const screenTrack = screenStream.getVideoTracks()[0];
    const screenAudioTrack = screenStream.getAudioTracks()[0];

    sharedVideoElement.srcObject = screenStream;

    const alreadyAdded = peerConnection.getSenders().some(s => s.track === screenTrack);
    if (!alreadyAdded) {
      peerConnection.addTrack(screenTrack, screenStream);
    }
    if (screenAudioTrack) {
      const alreadyAudio = peerConnection.getSenders().some(
        sender => sender.track === screenAudioTrack
      );
      if (!alreadyAudio) {
        peerConnection.addTrack(screenAudioTrack, screenStream);
      }
    }
    screenTrack.onended = () => {
      sharedVideoElement.srcObject = null;
      console.log("Screen sharing stopped");
    };
    socket.emit('negotiate', roomId);

  } catch (err) {
    console.error('Screen sharing failed:', err);
  }
}
export function stopScreenShare(sharedVideoElement, socket, roomId, peerConnection) {
  if (screenStream) {
    screenStream.getTracks().forEach(track => {
      track.stop();
      const sender = peerConnection.getSenders().find(s => s.track === track);
      if (sender) peerConnection.removeTrack(sender);
    });
    sharedVideoElement.srcObject = null;
    screenStream = null;
    socket.emit('negotiate', roomId);
  }
}

export function getLocalStream() {
  return localStream;
}