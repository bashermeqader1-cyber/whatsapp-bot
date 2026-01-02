const { Low } = require('lowdb')
const { JSONFile } = require('lowdb/node')
const path = require('path')

const dbPath = path.join(__dirname, 'messages.json')
const adapter = new JSONFile(dbPath)
const db = new Low(adapter, {
    messages: [],
    chats: {}
})

// ================== تهيئة قاعدة البيانات ==================
async function initDB() {
    await db.read()
    db.data ||= { messages: [], chats: {} }
    db.data.chats ||= {}
    await db.write()
}

// ================== الرسائل ==================
async function saveMessage(msg) {
    await db.read()

    const exists = db.data.messages.find(
        (m) => m.message_id === msg.message_id
    )
    if (exists) return

    db.data.messages.push({
        message_id: msg.message_id,
        group_jid: msg.group_jid,
        sender_jid: msg.sender_jid,
        sender_name: msg.sender_name,
        content: msg.content || '',
        media_path: msg.media_path || null,
        media_type: msg.media_type || 'text',
        mimetype: msg.mimetype || null,
        fileName: msg.fileName || null,
        sent_at: msg.sent_at,
        raw_message: msg.raw_message,
        checked_offline: false,  // ⭐ لتفعيل Offline Guard
        report_sent: false,       // ⭐ لتجنب إعادة إرسال التقرير
        edited: msg.edited || false, 
        old_content: msg.old_content || null,
        new_content: msg.new_content || null,
        actor_name: msg.actor_name || null,
        actor_jid: msg.actor_jid || null
    })

    if (db.data.messages.length > 2000) db.data.messages.shift()

    await db.write()
}

async function findMessage(id) {
    await db.read()
    return db.data.messages.find((m) => m.message_id === id)
}

async function getUncheckedMessages(chatJid) {
    await db.read()
    return db.data.messages.filter(
        (m) =>
            m.group_jid === chatJid &&
            m.checked_offline === false
    )
}

async function markChecked(id) {
    await db.read()
    const msg = db.data.messages.find((m) => m.message_id === id)
    if (msg) msg.checked_offline = true
    await db.write()
}

// ================== تحديث حالة إرسال التقرير ==================
async function markReportSent(id) {
    await db.read()
    const msg = db.data.messages.find((m) => m.message_id === id)
    if (msg) {
        msg.report_sent = true
        await db.write()
    }
}

// ================== المحادثات ==================
async function ensureChat(chatJid) {
    await db.read()
    if (!db.data.chats[chatJid]) {
        db.data.chats[chatJid] = {
            enabled: false,        // بوت مفعل/معطل
            offlineGuard: false    // مراقبة أثناء الانقطاع
        }
        await db.write()
    }
}

async function setChatStatus(chatJid, status) {
    await ensureChat(chatJid)
    db.data.chats[chatJid].enabled = status
    await db.write()
}

async function isChatEnabled(chatJid) {
    await ensureChat(chatJid)
    return db.data.chats[chatJid].enabled === true
}

async function setOfflineGuard(chatJid, status) {
    await ensureChat(chatJid)
    db.data.chats[chatJid].offlineGuard = status
    await db.write()
}

async function isOfflineGuardEnabled(chatJid) {
    await ensureChat(chatJid)
    return db.data.chats[chatJid].offlineGuard === true
}

// ================== الحصول على كل المحادثات ==================
async function getChats() {
    await db.read()
    return db.data.chats
}

module.exports = {
    initDB,
    saveMessage,
    findMessage,
    getUncheckedMessages,
    markChecked,
    setChatStatus,
    isChatEnabled,
    setOfflineGuard,
    isOfflineGuardEnabled,
    getChats,
    markReportSent
}