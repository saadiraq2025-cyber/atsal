//--------------------------------------
// Firebase مخصص للاتصال فقط
//--------------------------------------
const firebaseConfigCall = {
  apiKey: "AIzaSyA_3TFx5dUR3JbcXj5fIZ_mpjWeco7FVo",
  authDomain: "tktkbaghdad.firebaseapp.com",
  databaseURL: "https://tktkbaghdad-default-rtdb.firebaseio.com",
  projectId: "tktkbaghdad",
  storageBucket: "tktkbaghdad.firebasestorage.app",
  messagingSenderId: "939931176033",
  appId: "1:939931176033:web:1d44fa5fd01ee75b326e20"
};

// تهيئة تطبيق مستقل
const callApp = firebase.initializeApp(firebaseConfigCall, "call-app");
const callDB = firebase.database(callApp);

//--------------------------------------
// تسجيل دخول
//--------------------------------------
let myId = null;

function login() {
    let pin = document.getElementById("pin").value.trim();

    if (pin.length !== 4) {
        alert("يجب إدخال 4 أرقام فقط");
        return;
    }

    myId = pin;

    document.getElementById("myId").innerText = myId;
    document.getElementById("login").style.display = "none";
    document.getElementById("callArea").style.display = "block";

    initWebRTC();
}

//--------------------------------------
// WebRTC
//--------------------------------------
let pc;
let otherUser = null;

function initWebRTC() {

    pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    // فيديو محلي
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
        document.getElementById("localVideo").srcObject = stream;
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
    });

    // ظهور فيديو الطرف الآخر
    pc.ontrack = event => {
        document.getElementById("remoteVideo").srcObject = event.streams[0];
    };

    // إرسال ICE
    pc.onicecandidate = event => {
        if (event.candidate) {
            callDB.ref("candidates/" + otherUser + "/" + myId).push(event.candidate);
        }
    };

    // استقبال عروض الاتصال
    callDB.ref("calls/" + myId).on("value", async snap => {
        let data = snap.val();
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
        let data = snap.val();
        if (!data) return;
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    });

}

//--------------------------------------
// ICE Listener
//--------------------------------------
function listenICE(id) {
    callDB.ref("candidates/" + myId + "/" + id).on("child_added", snap => {
        pc.addIceCandidate(new RTCIceCandidate(snap.val()));
    });
}

//--------------------------------------
// بدء الاتصال
//--------------------------------------
async function startCall() {
    otherUser = document.getElementById("otherId").value.trim();

    if (otherUser.length !== 4) {
        alert("رقم المستخدم يجب أن يكون 4 أرقام");
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
