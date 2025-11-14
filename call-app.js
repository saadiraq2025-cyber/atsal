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
// حالة التطبيق
//--------------------------------------
let myId = null;
let pc;
let otherUser = null;
let isWebRTCReady = false; 
let incomingOffer = null; // لتخزين العرض مؤقتاً
let incomingFrom = null; // لتخزين هوية المتصل مؤقتاً

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
// WebRTC Initializer
//--------------------------------------
function initWebRTC() {

    pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    // صوت محلي فقط 
    navigator.mediaDevices.getUserMedia({ video: false, audio: true })
    .then(stream => {
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
        document.getElementById("remoteVideo").srcObject = event.streams[0];
    };

    // إرسال ICE Candidates
    pc.onicecandidate = event => {
        if (event.candidate && otherUser) {
            console.log("إرسال ICE Candidate:", event.candidate);
            callDB.ref(`candidates/${otherUser}/${myId}`).push(event.candidate);
        }
    };
}

//--------------------------------------
// استقبال المكالمة (عرض الإشعار)
//--------------------------------------
function showIncomingCall(callerId, offer) {
    // تخزين البيانات مؤقتاً
    incomingFrom = callerId;
    incomingOffer = offer;
    
    // عرض الإشعار
    document.getElementById("incomingCallerId").innerText = callerId;
    document.getElementById("incomingCallNotification").style.display = "block";
    
    // إخفاء منطقة الاتصال الحالية
    document.getElementById("callArea").style.display = "none";
}

//--------------------------------------
// قبول المكالمة
//--------------------------------------
async function acceptCall() {
    // 1. إعادة واجهة المستخدم
    document.getElementById("incomingCallNotification").style.display = "none";
    document.getElementById("callArea").style.display = "block";
    
    otherUser = incomingFrom; // تعيين المستخدم الآخر لبدء تبادل ICE
    
    console.log("قبول مكالمة من:", otherUser);

    try {
        // 2. معالجة العرض وإنشاء الرد
        await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        // 3. إرسال الرد
        callDB.ref("answers/" + otherUser).set({ answer: answer });
        
        // 4. بدء الاستماع لمرشحات ICE
        listenICE(otherUser);

    } catch (error) {
        console.error("خطأ في قبول المكالمة:", error);
        alert("فشل في قبول المكالمة.");
    }

    // مسح البيانات المؤقتة
    incomingOffer = null;
    incomingFrom = null;
}

//--------------------------------------
// رفض المكالمة
//--------------------------------------
function rejectCall() {
    // 1. إعادة واجهة المستخدم
    document.getElementById("incomingCallNotification").style.display = "none";
    document.getElementById("callArea").style.display = "block";
    
    console.log("تم رفض المكالمة من:", incomingFrom);
    
    // 2. إرسال إشارة الرفض
    callDB.ref("rejections/" + incomingFrom).set({ rejectedBy: myId });

    // مسح البيانات المؤقتة
    incomingOffer = null;
    incomingFrom = null;
    otherUser = null; 
}


//--------------------------------------
// إعداد مستمعي Firebase
//--------------------------------------
function setupCallListeners() {
    // 1. استقبال عروض الاتصال (بدلاً من الرد التلقائي، يتم عرض الإشعار)
    callDB.ref("calls/" + myId).on("value", async snap => {
        let data = snap.val();
        if (!data) return;
        
        if (data.offer && data.from) {
             // ***** التعديل الذي يحل مشكلة InvalidAccessError *****
             callDB.ref("calls/" + myId).set(null); 
             
             console.log("تلقي عرض مكالمة جديد.");
             showIncomingCall(data.from, data.offer);
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
    
    // 3. استقبال الرفض (كطرف متصل)
    callDB.ref("rejections/" + myId).on("value", async snap => {
        let data = snap.val();
        if (!data) return;
        
        // مسح الرفض بمجرد استقباله
        callDB.ref("rejections/" + myId).set(null);

        alert(`تم رفض مكالمتك من قبل المستخدم ${data.rejectedBy}.`);
        console.log("تم رفض المكالمة.");
        
        // إعادة تهيئة حالة الاتصال
        otherUser = null;
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
        
        alert(`جاري الاتصال بالمستخدم ${otherUser}...`);

    } catch (error) {
        console.error("خطأ في بدء الاتصال:", error);
        alert("فشل في إنشاء عرض الاتصال.");
    }
}

//--------------------------------------
// ربط الأحداث (Event Listeners)
//--------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    // تسجيل الدخول
    const loginButton = document.getElementById('login-button');
    if (loginButton) {
        loginButton.addEventListener('click', login);
    }

    // بدء الاتصال
    const callButton = document.getElementById('call-button');
    if (callButton) {
        callButton.addEventListener('click', startCall);
    }
    
    // قبول المكالمة
    const acceptButton = document.getElementById('acceptCallButton');
    if (acceptButton) {
        acceptButton.addEventListener('click', acceptCall);
    }
    
    // رفض المكالمة
    const rejectButton = document.getElementById('rejectCallButton');
    if (rejectButton) {
        rejectButton.addEventListener('click', rejectCall);
    }
});
