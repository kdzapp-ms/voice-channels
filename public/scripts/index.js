navigator.getUserMedia(
    { video: true, audio: true },
    stream => {
        const localVideo = document.getElementById("local-video");
        if (localVideo) {
            localVideo.srcObject = stream;
        }
    },
    error => {
        console.warn(error.message);
    }
);

this.io("connection", socket => { // cant use this.io.on bc it is not callable
    const existingSocket = this.activeSockets.find(
        existingSocket => existingSocket === socket.id
    );

    if (!existingSocket) {
        this.activeSockets.push(socket.id);

        socket.emit("update-user-list", {
            users: this.activeSockets.filter(
                existingSocket => existingSocket !== socket.id
            )
        });

        socket.broadcast.emit("update-user-list", {
            users: [socket.id]
        });
    }
})

socket.on("disconnect", () => { // error here bc socket falls out of scope
    this.activeSockets = this.activeSockets.filter(
        existingSocket => existingSocket !== socket.id
    );

    socket.broadcast.emit("remove-user", {
        socketId: socket.id
    });
});

socket.on("update-user-list", ({ users }) => {
    updateUserList(users);
   }),
    
    socket.on("remove-user", ({ socketId }) => {
        const elToRemove = document.getElementById(socketId);
    
    if (elToRemove) {
        elToRemove.remove();
    }
});

function updateUserList(socketIds) {
    const activeUserContainer = document.getElementById("active-user-container");
    
    socketIds.forEach(socketId => {
        const alreadyExistingUser = document.getElementById(socketId);
        if (!alreadyExistingUser) {
            const userContainerEl = createUserItemContainer(socketId);
            activeUserContainer.appendChild(userContainerEl);
        }
    });
}

function createUserItemContainer(socketId) {
    const userContainerEl = document.createElement("div");
    
    const usernameEl = document.createElement("p");
    
    userContainerEl.setAttribute("class", "active-user");
    userContainerEl.setAttribute("id", socketId);
    usernameEl.setAttribute("class", "username");
    usernameEl.innerHTML = `Socket: ${socketId}`;
    
    userContainerEl.appendChild(usernameEl);
    
    userContainerEl.addEventListener("click", () => {
        unselectUsersFromList();
        userContainerEl.setAttribute("class", "active-user active-user--selected");
        const talkingWithInfo = document.getElementById("talking-with-info");
        talkingWithInfo.innerHTML = `Talking with: "Socket: ${socketId}"`;
        callUser(socketId);
    });

    return userContainerEl;
}

async function callUser(socketId) {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(new RTCSessionDescription(offer));
    
    socket.emit("call-user", {
        offer,
        to: socketId
    });
}

socket.on("call-user", data => {
    socket.to(data.to).emit("call-made", {
        offer: data.offer,
        socket: socket.id
    });
});

socket.on("call-made", async data => {
    await peerConnection.setRemoteDescription(
        new RTCSessionDescription(data.offer)
    );
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(new RTCSessionDescription(answer));
    
    socket.emit("make-answer", {
        answer,
        to: data.socket
    });
});

socket.on("make-answer", data => {
    socket.to(data.to).emit("answer-made", {
        socket: socket.id,
        answer: data.answer
    });
});

socket.on("answer-made", async data => {
    await peerConnection.setRemoteDescription(
        new RTCSessionDescription(data.answer)
    );
    
    if (!isAlreadyCalling) {
        callUser(data.socket);
        isAlreadyCalling = true;
    }
});

navigator.getUserMedia(
    { video: true, audio: true },
    stream => {
        const localVideo = document.getElementById("local-video");
        if (localVideo) {
            localVideo.srcObject = stream;
        }
    
        stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
    },
    error => {
        console.warn(error.message);
    }
);

peerConnection.ontrack = function({ streams: [stream] }) {
    const remoteVideo = document.getElementById("remote-video");
    if (remoteVideo) {
        remoteVideo.srcObject = stream;
    }
};