// ui.js
export function getElement(id) {    
  return document.getElementById(id);
}

export function addParticipant(name) {
  const list = getElement('participantList'); // ✅ Correct ID
  if (!list) return console.warn('participantList element not found.');

  const item = document.createElement('li');
  item.textContent = `${name}`;
  list.appendChild(item);
}


export function toggleMute(localStream, button) {
  const track = localStream.getAudioTracks()[0];
  if (track) {
    track.enabled = !track.enabled;

    if (track.enabled) {
      button.textContent = "🎤";
      button.classList.remove('muted');
    } else {
      button.textContent = "🔇";
      button.classList.add('muted');
    }
  }
}


export function toggleCamera(localStream, button) {
  const track = localStream.getVideoTracks()[0];
  if (track) {
    track.enabled = !track.enabled;

    if (track.enabled) {
      button.textContent = "📷";   // camera ON
      button.classList.remove('off');
    } else {
      button.textContent = "🚫"; // camera OFF
      button.classList.add('off');
    }
  }
}



export function appendChatMessage(text, isMine) {
  const messages = getElement('messages');
  const msgDiv = document.createElement('div');
  msgDiv.className = isMine ? 'chat-message mine' : 'chat-message';

  // Split message to extract timestamp
  const [userAndMsg, timePart] = text.split(' - (');
  const timestamp = timePart ? timePart.replace(')', '') : '';

  const msgContent = document.createElement('span');
  msgContent.textContent = userAndMsg.trim();

  const timeSpan = document.createElement('span');
  timeSpan.className = 'timestamp';
  timeSpan.textContent = ` ${timestamp}`;

  msgDiv.appendChild(msgContent);
  msgDiv.appendChild(timeSpan);
  messages.appendChild(msgDiv);

  // Auto-scroll
  messages.scrollTop = messages.scrollHeight;
}