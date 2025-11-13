//--------------------------------------------------------
// Firebase الصحيح
//--------------------------------------------------------
const firebaseConfigCall = {
  apiKey: "AIzaSyA_3TFx5dUR3JbcXj5fIZ_mpjWeco7FVo",
  authDomain: "tktkbaghdad.firebaseapp.com",
  databaseURL: "https://tktkbaghdad-default-rtdb.firebaseio.com",
  projectId: "tktkbaghdad",
  storageBucket: "tktkbaghdad.firebasestorage.app",
  messagingSenderId: "939931176033",
  appId: "1:939931176033:web:1d44fa5fd01ee75b326e20"
};

const callApp = firebase.initializeApp(firebaseConfigCall, "call-app");
const callDB = firebase.database(callApp);

//--------------------------------------------------------
// متغيرات
//--------------------------------------------------------
let myId = null;
let otherId = null;
let pc;
let localStream;

//--------------------------------------------------------
// تسجيل دخول
//--------------------------------------------------------
function login() {
    const pin = document.getElementById("pin").value.trim();

    if (pin.length !== 4 || isNaN(pin)) {
        alert("الرقم يجب أن يكون 4 أرقام");
        return;
    }

    myId = pin;
    document.getElementById("myId").innerText = myId;

    document.getElementById("login").style.display = "none";
    document.getElementById("callArea").style.display = "block";

    waitForCalls();
    initMedia();
}

//--------------------------------------------------------
// قراءة المكالمات الواردة
//--------------------------------------------------------
function waitForCalls() {
    callDB.ref("calls/" + myId).on("value", async snap => {
        const data = snap.val();
        if (!data) return;

        console.log("📞 مكالمة واردة من:", data.from);

        otherId = data.from;

        await ensurePC();

        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        callDB.ref("answers/" + otherId).set({ answer });

        listenICE(otherId);
    });
}

//--------------------------------------------------------
// تشغيل الكاميرا والمايك
//--------------------------------------------------------
async function initMedia() {
    localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
    });

    document.getElementById("localVideo").srcObject = localStream;
}

//--------------------------------------------------------
// إنشاء PeerConnection
//--------------------------------------------------------
async function ensurePC() {
    if (pc) return;

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
            callDB.ref("candidates/" + otherId + "/" + myId).push(e.candidate);
        }
    };
}

//--------------------------------------------------------
// زر اتصال
//--------------------------------------------------------
async function makeCall() {
    otherId = document.getElementById("otherId").value.trim();

    if (otherId.length !== 4) {
        alert("أدخل رقم الشخص بشكل صحيح");
        return;
    }

    await ensurePC();

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    callDB.ref("calls/" + otherId).set({
        from: myId,
        offer
    });

    listenICE(otherId);
}

//--------------------------------------------------------
// استقبال ICE
//--------------------------------------------------------
function listenICE(id) {
    callDB.ref("candidates/" + myId + "/" + id).on("child_added", s => {
        pc.addIceCandidate(new RTCIceCandidate(s.val()));
    });
}

//--------------------------------------------------------
