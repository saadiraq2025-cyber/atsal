//-----------------------------------
// Firebase خاص بالاتصال فقط
//-----------------------------------
const firebaseConfigCall = {
  apiKey: "AIzaSyA_3TFx5dUR3JbcXj5fIZ_mpjWeco7FVo",
  authDomain: "tktkbaghdad.firebaseapp.com",
  databaseURL: "https://tktkbaghdad-default-rtdb.firebaseio.com",
  projectId: "tktkbaghdad",
  storageBucket: "tktkbaghdad.firebasestorage.app",
  messagingSenderId: "939931176033",
  appId: "1:939931176033:web:1d44fa5fd01ee75b326e20"
};

// تهيئة Firebase منفصل (حتى لا يتعارض مع تكسي بغداد)
const callApp = firebase.initializeApp(firebaseConfigCall, "call-app");
const callDB = firebase.database(callApp);

//-----------------------------------
// WebRTC
//-----------------------------------
let pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
});

let myId = Math.floor(Math.random() * 10000000);
document.getElementById("myId").value = myId;

let otherUser = null;

// إرسال بيانات
function sendSignal(path, data) {
    callDB.ref(path).set(data);
}

// استقبال بيانات
function readSignal(path, callback) {
    callDB.ref(path).on("value", snap => {
        if (snap.val()) callback(snap.val());
    });
}

//-----------------------------------
// الفيديو المحلي
//-----------------------------------
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
.then(stream => {
    document.getElementById("localVideo").srcObject = stream;
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
});

//-----------------------------------
// ICE
//-----------------------------------
pc.onicecandidate = event => {
    if (event.candidate) {
        callDB.ref("candidates/" + otherUser + "/" + myId).push(event.candidate);
    }
};

function listenICE(id) {
    callDB.ref("candidates/" + myId + "/" + id).on("child_added", snap => {
        pc.addIceCandidate(new RTCIceCandidate(snap.val()));
    });
}

//-----------------------------------
// استقبال الفيديو من الشخص الآخر
//-----------------------------------
pc.ontrack = event => {
    document.getElementById("remoteVideo").srcObject = event.streams[0];
};

//-----------------------------------
// بدء الاتصال
//-----------------------------------
async function startCall() {
    otherUser = document.getElementById("otherId").value;

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    sendSignal("calls/" + otherUser, {
        from: myId,
        offer: offer
    });

    listenICE(otherUser);
}

//-----------------------------------
// استقبال عرض اتصال
//-----------------------------------
readSignal("calls/" + myId, async data => {
    otherUser = data.from;

    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    sendSignal("answers/" + otherUser, {
        answer: answer
    });

    listenICE(otherUser);
});

//-----------------------------------
// استقبال الرد
//-----------------------------------
readSignal("answers/" + myId, async data => {
    await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
});

//-----------------------------------
// نسخ الهوية
//-----------------------------------
function copyId() {
    navigator.clipboard.writeText(document.getElementById("myId").value);
    alert("تم نسخ ID");
}
