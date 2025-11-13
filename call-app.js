//-------------------------------------------------------
// Firebase الصحيح
//-------------------------------------------------------
const firebaseConfigCall = {
  apiKey: "AIzaSyA_3TFx5dUR3JbcXj5fIZ_mpjWeco7FVo",
  authDomain: "tktkbaghdad.firebaseapp.com",
  databaseURL: "https://tktkbaghdad-default-rtdb.firebaseio.com",
  projectId: "tktkbaghdad",
  storageBucket: "tktkbaghdad.firebasestorage.app",
  messagingSenderId: "939931176033",
  appId: "1:939931176033:web:1d44fa5fd01ee75b326e20"
};

// Firebase منفصل
const callApp = firebase.initializeApp(firebaseConfigCall, "call-app");
const callDB = firebase.database(callApp);

//-------------------------------------------------------
// متغيرات عامة
//-------------------------------------------------------
let myId = null;
let otherUser = null;
let pc = null; 
let localStream = null;

//-------------------------------------------------------
// تسجيل الدخول
//-------------------------------------------------------
function login() {
    const pin = document.getElementById("pin").value.trim();

    if (pin.length !== 4 || isNaN(pin)) {
        alert("يجب إدخال رقم رباعي صحيح");
        return;
    }

    myId = pin;
    document.getElementById("myId").innerText = myId;

    document.getElementById("login").style.display = "none";
    document.getElementById("callArea").style.display = "block";

    initWebRTC(); // 🔥 أهم خطوة
}

//-------------------------------------------------------
// WebRTC
//-------------------------------------------------------
async function initWebRTC() {

    pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    // الحصول على الفيديو
    localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
    });

    document.getElementById("localVideo").srcObject = localStream;

    localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
    });

    // فيديو الطرف الآخر
    pc.ontrack = event => {
        document.getElementById("remoteVideo").srcObject = event.streams[0];
    };

    // إرسال ICE
    pc.onicecandidate = event => {
        if (event.candidate && otherUser) {
            callDB.ref("candidates/" + otherUser + "/" + myId).push(event.candidate);
        }
    };

    // استقبال عرض اتصال
    callDB.ref("calls/" + myId).on("value", async snap => {
        const data = snap.val();
        if (!data) return;

        otherUser = data.from;

        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        callDB.ref("answers/" + otherUser).set({
            answer: answer
        });

        listenICE(otherUser);
    });

    // استقبال الرد
    callDB.ref("answers/" + myId).on("value", async snap => {
        const data = snap.val();
        if (!data) return;

        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    });
}

//-------------------------------------------------------
// استقبال ICE
//-------------------------------------------------------
function listenICE(id) {
    callDB.ref("candidates/" + myId + "/" + id).on("child_added", snap => {
        pc.addIceCandidate(new RTCIceCandidate(snap.val()));
    });
}

//-------------------------------------------------------
// زر الاتصال (بعد التصحيح)
//-------------------------------------------------------
async function startCall() {

    otherUser = document.getElementById("otherId").value.trim();

    if (otherUser.length !== 4 || isNaN(otherUser)) {
        alert("الرقم غير صحيح");
        return;
    }

    if (!pc) {
        alert("المكالمات غير مهيئة… أعد تسجيل الدخول");
        return;
    }

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    callDB.ref("calls/" + otherUser).set({
        from: myId,
        offer: offer
    });

    listenICE(otherUser);
}
