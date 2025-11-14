//------------------------------------------------------
// Firebase
//------------------------------------------------------
const firebaseConfigCall = {
  apiKey: "AIzaSyA_3TFx5dUR3JbcXj5fIZ_mpjWeco7FVo",
  authDomain: "tktkbaghdad.firebaseapp.com",
  databaseURL: "https://tktkbaghdad-default-rtdb.firebaseio.com",
  projectId: "tktkbaghdad",
  storageBucket: "tktkbaghdad.firebasestorage.app",
  messagingSenderId: "939931176033",
  appId: "1:939931176033:web:1d44fa5fd01ee75b326e20"
};

firebase.initializeApp(firebaseConfigCall);
const db = firebase.database();

//------------------------------------------------------
// المتغيرات
//------------------------------------------------------
let myId, otherId;
let pc;
let localStream;

//------------------------------------------------------
// تسجيل دخول
//------------------------------------------------------
async function login() {
    myId = document.getElementById("pin").value.trim();

    if (myId.length !== 4 || isNaN(myId)) {
        alert("الرقم يجب أن يكون 4 أرقام");
        return;
    }

    document.getElementById("myId").innerText = myId;
    document.getElementById("login").style.display = "none";
    document.getElementById("callArea").style.display = "block";

    await setupMedia();
    waitForCall();
}

//------------------------------------------------------
// تحضير الفيديو والمايك - مهم جداً
//------------------------------------------------------
async function setupMedia() {
    localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
    });

    document.getElementById("localVideo").srcObject = localStream;
}

//------------------------------------------------------
// إنشاء PeerConnection
//------------------------------------------------------
function createPC() {
    pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    localStream.getTracks().forEach(t =>
        pc.addTrack(t, localStream)
    );

    pc.ontrack = e => {
        document.getElementById("remoteVideo").srcObject = e.streams[0];
    };

    pc.onicecandidate = e => {
        if (e.candidate && otherId) {
            db.ref("ice/" + otherId + "/" + myId).push(e.candidate);
        }
    };
}

//------------------------------------------------------
// انتظار المكالمة للطرف المستلم
//------------------------------------------------------
function waitForCall() {
    db.ref("calls/" + myId).on("value", async snap => {
        const data = snap.val();
        if (!data) return;

        otherId = data.from;

        createPC();

        await pc.setRemoteDescription(data.offer);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        db.ref("answers/" + otherId).set({ answer });

        receiveICE(otherId);
    });
}

//------------------------------------------------------
// زر الاتصال
//------------------------------------------------------
async function makeCall() {
    otherId = document.getElementById("otherId").value.trim();

    if (otherId.length !== 4 || isNaN(otherId)) {
        alert("الرقم خطأ");
        return;
    }

    if (otherId === myId) {
        alert("لا يمكنك الاتصال بنفسك");
        return;
    }

    createPC();

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    db.ref("calls/" + otherId).set({
        from: myId,
        offer
    });

    receiveICE(otherId);
}

//------------------------------------------------------
// استقبال ICE
//------------------------------------------------------
function receiveICE(id) {
    db.ref("ice/" + myId + "/" + id).on("child_added", s => {
        pc.addIceCandidate(new RTCIceCandidate(s.val()));
    });

    db.ref("answers/" + myId).on("value", async snap => {
        const data = snap.val();
        if (!data) return;

        await pc.setRemoteDescription(data.answer);
    });
}
