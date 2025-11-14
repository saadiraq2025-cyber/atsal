// -------- Firebase --------
const firebaseConfig = {
    apiKey: "AIzaSyCZvBwSKDyA5fQH4gIiONxy7ZPINu2VlXA",
    authDomain: "tktkbaghdad.firebaseapp.com",
    projectId: "tktkbaghdad",
    storageBucket: "tktkbaghdad.firebasestorage.app",
    messagingSenderId: "939931176033",
    appId: "1:939931176033:web:1d44fa5fd01ee75b326e20"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// -------- عناصر HTML --------
const myId = Math.floor(1000 + Math.random() * 9000);
document.getElementById("myId").innerText = myId;

const callToId = document.getElementById("callToId");
const callBtn = document.getElementById("callBtn");

let pc;
const configuration = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

// -------- الحصول على الفيديو --------
async function initMedia() {
    return await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
}

// -------- إنشاء PeerConnection --------
function createPeer() {
    pc = new RTCPeerConnection(configuration);

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            callerRef.collection("candidates").add(event.candidate.toJSON());
        }
    };

    pc.ontrack = (event) => {
        document.getElementById("remoteVideo").srcObject = event.streams[0];
    };

    return pc;
}

// -------- عند الضغط على اتصال --------
callBtn.onclick = async () => {
    const targetId = callToId.value.trim();
    if (targetId === "") return;

    const stream = await initMedia();
    document.getElementById("localVideo").srcObject = stream;

    pc = createPeer();
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    const callerRef = db.collection("calls").doc(String(myId));
    const calleeRef = db.collection("calls").doc(String(targetId));

    await callerRef.set({ from: myId, to: targetId });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await callerRef.update({ offer: offer });

    // -------- الاستماع للـ Answer --------
    calleeRef.onSnapshot(async (snap) => {
        const data = snap.data();
        if (!pc.currentRemoteDescription && data?.answer) {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
    });

    // -------- استقبال ICE --------
    calleeRef.collection("candidates").onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const candidate = new RTCIceCandidate(change.doc.data());
                pc.addIceCandidate(candidate);
            }
        });
    });
};

// -------- استقبال المكالمات --------
const answerRef = db.collection("calls").doc(String(myId));

answerRef.onSnapshot(async (snap) => {
    const data = snap.data();
    if (!data?.offer) return;

    const stream = await initMedia();
    document.getElementById("localVideo").srcObject = stream;

    pc = createPeer();
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await answerRef.update({ answer: answer });

    answerRef.collection("candidates").onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
            }
        });
    });
});
