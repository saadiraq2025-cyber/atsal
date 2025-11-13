// Firebase config
const firebaseConfig = {
    apiKey: "YOUR_KEY",
    authDomain: "YOUR_APP.firebaseapp.com",
    databaseURL: "https://YOUR_APP-default-rtdb.firebaseio.com",
    projectId: "YOUR_APP",
    storageBucket: "YOUR_APP.appspot.com",
    messagingSenderId: "ID",
    appId: "APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let pc = new RTCPeerConnection();
let myId = Math.floor(Math.random() * 1000000000);

// إنشاء الهوية
function generateId() {
    document.getElementById("myId").value = myId;
}

// فيديو محلي
navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
    document.getElementById("localVideo").srcObject = stream;
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
});

// استقبال الفيديو
pc.ontrack = event => {
    document.getElementById("remoteVideo").srcObject = event.streams[0];
};

// إرسال اتصال
function call() {
    let other = document.getElementById("otherId").value;

    pc.createOffer().then(offer => {
        pc.setLocalDescription(offer);
        db.ref("calls/" + other).set({ offer: offer, from: myId });
    });
}

// استقبال العروض والردود
db.ref("calls/" + myId).on("value", snap => {
    let data = snap.val();
    if (!data) return;

    if (data.offer && data.from) {
        pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        pc.createAnswer().then(answer => {
            pc.setLocalDescription(answer);
            db.ref("answers/" + data.from).set({ answer: answer });
        });
    }
});

// استقبال الرد
db.ref("answers/" + myId).on("value", snap => {
    let data = snap.val();
    if (!data) return;
    pc.setRemoteDescription(new RTCSessionDescription(data.answer));
});
