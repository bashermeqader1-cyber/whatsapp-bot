const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const WebSocket = require('ws');

// إعدادات السيرفر
const WS_PORT = 8080; // المنفذ الذي سيتصل به تطبيق الأندرويد
const wss = new WebSocket.Server({ port: WS_PORT });

console.log(`🔥 WebSocket Server started on port ${WS_PORT}`);

// متغير لتخزين اتصال العميل (تطبيق الأندرويد)
let androidClient = null;

// التعامل مع اتصال تطبيق الأندرويد
wss.on('connection', (ws) => {
    console.log('📱 Android App Connected via WebSocket!');
    androidClient = ws;

    ws.on('close', () => {
        console.log('⚠️ Android App Disconnected');
        androidClient = null;
    });

    ws.on('message', (message) => {
        console.log('📩 Command received from App:', message.toString());
        // هنا يمكننا استقبال أوامر من التطبيق مثل "أوقف البوت" أو "رد على فلان"
    });
});

// دالة لإرسال البيانات إلى التطبيق
function sendToApp(type, data) {
    if (androidClient && androidClient.readyState === WebSocket.OPEN) {
        const payload = JSON.stringify({ type, data });
        androidClient.send(payload);
    }
}

// دالة تشغيل البوت الأساسية
async function startBot() {
    // إعداد المصادقة (حفظ الجلسة حتى لا يطلب QR كل مرة)
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true, // يطبع الـ QR في تيرمكس أيضاً للاختبار
        auth: state,
        browser: ["Termux Bot", "Chrome", "1.0.0"]
    });

    // 1️⃣ مراقبة حالة الاتصال
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('📷 QR Code generated');
            // إرسال الـ QR إلى التطبيق ليتم مسحه أو عرضه
            sendToApp('QR_CODE', qr);
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom) ?
                lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut : true;
            
            console.log('❌ Connection closed. Reconnecting:', shouldReconnect);
            
            if (shouldReconnect) {
                startBot(); // إعادة الاتصال التلقائي
            }
        } else if (connection === 'open') {
            console.log('✅ WhatsApp Connected Successfully!');
            sendToApp('STATUS', 'CONNECTED');
        }
    });

    // 2️⃣ حفظ بيانات الاعتماد عند التحديث
    sock.ev.on('creds.update', saveCreds);

    // 3️⃣ استقبال الرسائل الجديدة
    sock.ev.on('messages.upsert', async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message) return; // تجاهل التحديثات الفارغة

            const sender = msg.key.remoteJid;
            const messageContent = msg.message.conversation || msg.message.extendedTextMessage?.text;

            console.log(`📩 New Message from ${sender}: ${messageContent}`);

            // إرسال الرسالة إلى التطبيق فوراً
            sendToApp('NEW_MESSAGE', {
                sender: sender,
                content: messageContent,
                timestamp: new Date().getTime(),
                isGroup: sender.endsWith('@g.us')
            });

        } catch (err) {
            console.error('Error processing message:', err);
        }
    });
}

// بدء التشغيل
startBot();
