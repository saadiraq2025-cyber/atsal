//-------------------------------------------------------
// Firebase
//-------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyA_3TFx5dUR3JbcXj5fIZ_mpjWeco7FVo",
  authDomain: "tktkbaghdad.firebaseapp.com",
  databaseURL: "https://tktkbaghdad-default-rtdb.firebaseio.com",
  projectId: "tktkbaghdad",
  storageBucket: "tktkbaghdad.firebasestorage.app",
  messagingSenderId: "939931176033",
  appId: "1:939931176033:web:1d44fa5fd01ee75b326e20"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

//-------------------------------------------------------
// متغيرات
//-------------------------------------------------------
let myId, otherId;
let pc = null;
let localStream = null;
let isCaller = false;

//-------------------------------------------------------
// تسجيل دخول
//-------------------------------------------------------
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
    waitForIncomingCalls();
}

//-------------------------------------------------------
// تجهيز الكاميرا والمايك
//-------------------------------------------------------
async function setupMedia() {
    localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
    });

    document.getElementById("localVideo").srcObject = localStream;
}

//-------------------------------------------------------
// إنشاء PeerConnection
//-------------------------------------------------------
function createPC() {
    pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

    pc.ontrack = e => {
        document.getElementById("remoteVideo").srcObject = e.streams[0];
    };

    pc.onicecandidate = e => {
        if (e.candidate && otherId) {
            db.ref("ice/" + otherId + "/" + myId).push(e.candidate);
        }
    };
}

//-------------------------------------------------------
// الاستماع للمكالمات الواردة
//-------------------------------------------------------
function waitForIncomingCalls() {
    db.ref("calls/" + myId).on("value", async snap => {
        const data = snap.val();
        if (!data) return;

        otherId = data.from;
        isCaller = false;

        createPC();

        // منع خطأ stable
        if (pc.signalingState === "stable") {
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        db.ref("answers/" + otherId).set({ answer });

        listenICE(otherId);
    });
}

//-------------------------------------------------------
// زر طلب الاتصال
//-------------------------------------------------------
async function makeCall() {
    otherId = document.getElementById("otherId").value.trim();

    if (otherId.length !== 4 || isNaN(otherId)) {
        alert("رقم الشخص غير صحيح");
        return;
    }

    if (otherId === myId) {
        alert("لا يمكنك الاتصال بنفسك");
        return;
    }

    isCaller = true;
    createPC();

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    db.ref("calls/" + otherId).set({
        from: myId,
        offer
    });

    listenICE(otherId);
}

//-------------------------------------------------------
// استقبال ICE + الإجابة
//-------------------------------------------------------
function listenICE(id) {
    // ICE
    db.ref("ice/" + myId + "/" + id).on("child_added", async s => {
        try {
            await pc.addIceCandidate(new RTCIceCandidate(s.val()));
        } catch (e) {
            console.warn("ICE Error:", e);
        }
    });

    // ANSWER
    db.ref("answers/" + myId).on("value", async snap => {
        const data = snap.val();
        if (!data) return;

        if (pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
    });
}
