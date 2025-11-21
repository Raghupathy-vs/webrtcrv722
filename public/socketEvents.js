
//socketevent.js
import { handleOffer, renegotiate, getPeerConnection } from './webrtc.js';
import { addParticipant, getElement } from './ui.js';

export function setupSocketHandlers(socket) {
  
  socket.on('user-joined', username => {        // after 'user joined' in server.js - this displays name.
    addParticipant(username);
  });


      socket.on("call-connected", () => {
        console.log("Server confirmed call connected");
        showMeetingStarted();
    });


  socket.on('ready-to-call', (roomId) => {                            //8. 
    console.log("Peer is ready, sending offer...");
    const pc = getPeerConnection();
    pc.createOffer()                                            //9.
      .then(offer => pc.setLocalDescription(offer))       //28.
      .then(() => socket.emit('offer', { room: roomId, offer: pc.localDescription }));    //10. before share screen
  });

  socket.on('offer', offer => {             //13.     //13a.
    const room = getElement('roomId').value;
    console.log("Received offer");
    handleOffer(socket, room, offer);       //14.     //14a.
  });

  socket.on('answer', answer => {                       //19.         //19a.
    console.log("Received answer");
    getPeerConnection().setRemoteDescription(new RTCSessionDescription(answer));  //20.     //20a.
  });
  
  socket.on('ice-candidate', candidate => {       //33.
    console.log("Received ICE candidate");
    getPeerConnection().addIceCandidate(new RTCIceCandidate(candidate));    //34.
  });

  socket.on('negotiate', () => {              //7a.
    const room = getElement('roomId').value;
    console.log("Renegotiation requested");
    renegotiate(socket, room);                //8a.
  });


socket.on('join-request', ({ requestorId, username }) => {
  console.log("Join request received from", username, "with ID", requestorId);

  socket.emit('join-response', { requestorId, accepted: true });
});
 

  socket.on('peer-left', () => {
    alert("The other user has left the call.");
  });

  socket.on('room-full', () => {
    alert("Room is full. Cannot join.");
    window.location.href = "/index.html";
  });

socket.on('left-call', () => {
  closePeerConnection();
  socket.disconnect();
  alert("You left the call.");
  window.location.href = "/index.html";
});

  socket.on('cannot-leave', (message) => {
    alert(message); 
  });

  socket.on('call-ended', () => {
    alert("Call was ended by the host.");
    window.location.href = "/index.html";
  });

  socket.on('update-participants', (participants) => {
  const list = document.getElementById('participantList');
  list.innerHTML = '';
  participants.forEach(name => {
    const li = document.createElement('li');
    li.textContent = name;
    list.appendChild(li);
  });
});




}
