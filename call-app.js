//--------------------------------------
// Firebase مخصص للاتصال فقط
//--------------------------------------
const firebaseConfigCall = {
  // المفتاح المحدث
  apiKey: "AIzaSyA_3TFx5dUR3JbcXj5jFIZ_mpjWeco7FVo", 
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
let isWebRTCReady = false; 

function initWebRTC() {

    pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    // صوت محلي فقط (التعديل هنا)
    navigator.mediaDevices.getUserMedia({ video: false, audio: true })
    .then(stream => {
        // يمكنك إبقاء LocalVideo إذا كنت تريد عرض مؤشر صوتي، ولكن لن يظهر فيديو
        document.getElementById("localVideo").srcObject = stream;
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
        
        isWebRTCReady = true; 
        
        setupCallListeners();
    })
    .catch(error => {
        console.error("خطأ في الوصول إلى الميكروفون:", error);
        alert("يرجى السماح بالوصول إلى الميكروفون لبدء الاتصال.");
    });

    // استقبال الصوت/الفيديو
    pc.ontrack = event => {
        // سيظهر الصوت المستلم، ويمكنك إخفاء عنصر الفيديو في style.css إذا أردت
        document.getElementById("remoteVideo").srcObject = event.streams[0];
    };

    // إرسال ICE Candidates بمجرد أن تصبح جاهزة
    pc.onicecandidate = event => {
        if (event.candidate && otherUser) {
            console.log("إرسال ICE Candidate:", event.candidate);
            callDB.ref(`candidates/${otherUser}/${myId}`).push(event.candidate);
        }
    };
}

//--------------------------------------
// إعداد مستمعي Firebase للعروض والردود و ICE Candidates
//--------------------------------------
function setupCallListeners() {
    // 1. استقبال عروض الاتصال (كطرف مستقبل)
    callDB.ref("calls/" + myId).on("value", async snap => {
        let data = snap.val();
        if (!data) return;

        // مسح العرض بمجرد استقباله لتجنب الردود المتكررة
        callDB.ref("calls/" + myId).set(null); 
        
        otherUser = data.from;
        
        console.log("تلقي عرض من:", otherUser);

        try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            callDB.ref("answers/" + otherUser).set({
                answer: answer
            });

            listenICE(otherUser);

        } catch (error) {
            console.error("خطأ في معالجة العرض:", error);
        }
    });

    // 2. استقبال الرد (كطرف متصل)
    callDB.ref("answers/" + myId).on("value", async snap => {
        let data = snap.val();
        if (!data) return;
        
        // مسح الرد بمجرد استقباله
        callDB.ref("answers/" + myId).set(null);

        console.log("تلقي الرد.");
        
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        } catch (error) {
            console.error("خطأ في معالجة الرد:", error);
        }
    });
}

//--------------------------------------
// ICE Listener
//--------------------------------------
function listenICE(id) {
    callDB.ref("candidates/" + myId + "/" + id).on("child_added", snap => {
        const candidate = snap.val();
        console.log("تلقي ICE Candidate:", candidate);
        if (candidate) {
             pc.addIceCandidate(new RTCIceCandidate(candidate))
                 .catch(e => console.error("خطأ في إضافة ICE Candidate:", e));
        }
    });
}

//--------------------------------------
// بدء الاتصال
//--------------------------------------
async function startCall() {
    // التحقق من جاهزية WebRTC قبل محاولة الاتصال
    if (!isWebRTCReady) {
        alert("الرجاء الانتظار، لم يتمكن التطبيق من الوصول إلى الميكروفون بعد.");
        return;
    }

    const targetId = document.getElementById("otherId").value.trim();

    if (targetId.length !== 4) {
        alert("رقم المستخدم يجب أن يكون 4 أرقام");
        return;
    }
    
    otherUser = targetId;
    console.log("محاولة الاتصال بـ:", otherUser);

    try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // إرسال العرض
        callDB.ref("calls/" + otherUser).set({
            from: myId,
            offer: offer
        });

        // بدء الاستماع لمرشحات ICE الخاصة بالطرف الآخر
        listenICE(otherUser);
        
    } catch (error) {
        console.error("خطأ في بدء الاتصال:", error);
        alert("فشل في إنشاء عرض الاتصال. يرجى التأكد من أنك سمحت بالوصول للميكروفون.");
    }
}

//--------------------------------------
// ربط الأحداث (Event Listeners) لمنع خطأ CSP
//--------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    // ربط زر "دخول" بوظيفة login()
    const loginButton = document.getElementById('login-button');
    if (loginButton) {
        loginButton.addEventListener('click', login);
    }

    // ربط زر "اتصال" بوظيفة startCall()
    const callButton = document.getElementById('call-button');
    if (callButton) {
        callButton.addEventListener('click', startCall);
    }
});
