require('dotenv').config();
const fs = require('fs');
const {
    Client,
    GatewayIntentBits,
    PermissionsBitField,
    ActivityType,
    ChannelType,
    Collection,
    SlashCommandBuilder,
    EmbedBuilder,
    AttachmentBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    UserSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');
const { buatGambarWelcome } = require('./welcome-image');
const { buatGambarMines } = require('./mines-image');
const {
    AudioPlayerStatus,
    NoSubscriberBehavior,
    StreamType,
    VoiceConnectionStatus,
    createAudioPlayer,
    createAudioResource,
    entersState,
    joinVoiceChannel,
    getVoiceConnection
} = require('@discordjs/voice');
const playDl = require('play-dl');

// ==========================================
// PENGATURAN BOT DISCORD
// ==========================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers
    ]
});

const PREFIX = 'ltn ';
const THEME_COLOR = '#fd4ddf';
const SUCCESS_COLOR = '#2ecc71';
const ERROR_COLOR = '#e74c3c';
const BOT_OWNER_ID = '781779621682610178';
const MINES_MAX_PAYOUT_MULTIPLIER = 120;
const ALIAS_GAME = Object.freeze({ s: 'slot', sl: 'slot', mn: 'mines', gb: 'gamble' });
const SLOT_SYMBOLS = Object.freeze(['🐺', '🐰', '🦊', '🐼', '🐉']);
const COOLDOWN_MINI_GAME = 5000;
const MAX_MUSIC_QUEUE = 50;
const MAX_PLAYLIST_TRACKS = 20;
const TICKET_TYPE_LABELS = Object.freeze({ report: 'Laporan', update: 'Ide Update', other: 'Lainnya' });
const PATH_FILTER = './bad_words.json';
const PATH_UANG = './uang.json';
const PATH_OWO_STATE = './owo_state.json';
const PATH_MOD_LOG = './mod_log.json';
const PATH_ADMIN_LOGS = './admin_logs.json';
const PATH_ADMIN_SCHEDULES = './admin_schedules.json';
const PATH_ADMIN_BACKUPS = './admin_backups.json';
const COOLDOWN_HARIAN = 24 * 60 * 60 * 1000;
const formatUang = jumlah => new Intl.NumberFormat('id-ID').format(jumlah);
const saldoTidakTerbatas = userId => userId === BOT_OWNER_ID;
const tampilkanSaldo = (userId, saldo) => saldoTidakTerbatas(userId) ? '♾️ Unlimited' : `${formatUang(saldo)} koin`;
function kurangiSaldo(uangData, userId, jumlah) {
    if (!saldoTidakTerbatas(userId)) uangData[userId] -= jumlah;
}
function tambahSaldo(uangData, userId, jumlah) {
    if (!saldoTidakTerbatas(userId)) uangData[userId] += jumlah;
}
function cukupSaldo(uangData, userId, jumlah) {
    return saldoTidakTerbatas(userId) || uangData[userId] >= jumlah;
}
const jeda = durasi => new Promise(resolve => setTimeout(resolve, durasi));
const musicQueues = new Map();
const monitoredVoiceConnections = new WeakSet();
const MUSIC_COMMANDS = new Set(['play', 'pause', 'resume', 'skip', 'stop', 'queue', 'volume', 'loop', 'autoplay', 'panel']);
let youtubeClientPromise;

async function ambilClientYouTube() {
    if (!youtubeClientPromise) {
        youtubeClientPromise = import('@distube/ytdl-core')
            .then(({ Ytdl }) => new Ytdl({ country: 'ID' }))
            .catch(error => {
                youtubeClientPromise = null;
                if (error.code === 'ERR_MODULE_NOT_FOUND') {
                    throw new Error(
                        'Modul @distube/ytdl-core tidak ditemukan di server. Unggah package.json dan package-lock.json terbaru, lalu jalankan `npm install` di folder bot sebelum restart.',
                        { cause: error }
                    );
                }
                throw error;
            });
    }
    return youtubeClientPromise;
}

if (!fs.existsSync(PATH_UANG)) fs.writeFileSync(PATH_UANG, JSON.stringify({}));
const economyData = JSON.parse(fs.readFileSync(PATH_UANG, 'utf8'));
if (!economyData || typeof economyData !== 'object' || Array.isArray(economyData)) {
    throw new Error('Isi uang.json harus berupa objek saldo pengguna.');
}
if (!economyData.servers || typeof economyData.servers !== 'object' || Array.isArray(economyData.servers)) {
    const saldoLama = Object.fromEntries(
        Object.entries(economyData).filter(([id, saldo]) => /^\d{17,20}$/.test(id) && Number.isSafeInteger(saldo) && saldo >= 0)
    );
    for (const key of Object.keys(economyData)) delete economyData[key];
    economyData.servers = {};
    economyData.legacyBalances = saldoLama;
}

if (!fs.existsSync(PATH_OWO_STATE)) fs.writeFileSync(PATH_OWO_STATE, JSON.stringify({}));
const owoState = JSON.parse(fs.readFileSync(PATH_OWO_STATE, 'utf8'));
if (!owoState || typeof owoState !== 'object' || Array.isArray(owoState)) {
    throw new Error('Isi owo_state.json harus berupa objek data pengguna.');
}
if (!owoState.servers || typeof owoState.servers !== 'object' || Array.isArray(owoState.servers)) {
    const dataLama = Object.fromEntries(
        Object.entries(owoState).filter(([id, data]) => /^\d{17,20}$/.test(id) && data && typeof data === 'object')
    );
    for (const key of Object.keys(owoState)) delete owoState[key];
    owoState.servers = {};
    owoState.legacyUsers = dataLama;
}

if (!fs.existsSync(PATH_MOD_LOG)) fs.writeFileSync(PATH_MOD_LOG, JSON.stringify({}));
const modLogConfig = JSON.parse(fs.readFileSync(PATH_MOD_LOG, 'utf8'));
if (!modLogConfig || typeof modLogConfig !== 'object' || Array.isArray(modLogConfig)) {
    throw new Error('Isi mod_log.json harus berupa objek pengaturan log moderasi.');
}

function muatObjekJson(path, deskripsi) {
    if (!fs.existsSync(path)) fs.writeFileSync(path, JSON.stringify({}, null, 2));
    const data = JSON.parse(fs.readFileSync(path, 'utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error(`Isi ${path} harus berupa objek ${deskripsi}.`);
    }
    return data;
}

const adminLogs = muatObjekJson(PATH_ADMIN_LOGS, 'log moderasi');
const adminSchedules = muatObjekJson(PATH_ADMIN_SCHEDULES, 'jadwal pengumuman');
const adminBackups = muatObjekJson(PATH_ADMIN_BACKUPS, 'backup konfigurasi');
const scheduleTimers = new Map();

function simpanUang() {
    fs.writeFileSync(PATH_UANG, JSON.stringify(economyData, null, 2));
}

function simpanOwoState() {
    fs.writeFileSync(PATH_OWO_STATE, JSON.stringify(owoState, null, 2));
}

function simpanAdminLogs() {
    fs.writeFileSync(PATH_ADMIN_LOGS, JSON.stringify(adminLogs, null, 2));
}

function simpanAdminSchedules() {
    fs.writeFileSync(PATH_ADMIN_SCHEDULES, JSON.stringify(adminSchedules, null, 2));
}

function simpanAdminBackups() {
    fs.writeFileSync(PATH_ADMIN_BACKUPS, JSON.stringify(adminBackups, null, 2));
}

function ambilDataServer(guildId) {
    if (!economyData.servers[guildId]) economyData.servers[guildId] = {};
    if (!owoState.servers[guildId]) owoState.servers[guildId] = { users: {}, settings: {}, filter: { words: [], ignoredChannels: [], ignoredRoles: [] } };
    const server = owoState.servers[guildId];
    if (!server.users || typeof server.users !== 'object' || Array.isArray(server.users)) server.users = {};
    if (!server.settings || typeof server.settings !== 'object' || Array.isArray(server.settings)) server.settings = {};
    if (!server.filter || typeof server.filter !== 'object' || Array.isArray(server.filter)) server.filter = {};
    if (!Array.isArray(server.filter.words)) server.filter.words = [];
    if (!Array.isArray(server.filter.ignoredChannels)) server.filter.ignoredChannels = [];
    if (!Array.isArray(server.filter.ignoredRoles)) server.filter.ignoredRoles = [];
    if (!server.voice || typeof server.voice !== 'object' || Array.isArray(server.voice)) server.voice = {};
    if (!server.voice.rooms || typeof server.voice.rooms !== 'object' || Array.isArray(server.voice.rooms)) server.voice.rooms = {};
    if (Object.prototype.hasOwnProperty.call(server.voice, 'connection')) {
        delete server.voice.connection;
        simpanOwoState();
    }
    if (!server.settings || typeof server.settings !== 'object' || Array.isArray(server.settings)) server.settings = {};
    if (!Number.isSafeInteger(server.settings.dailyReward) || server.settings.dailyReward < 0) server.settings.dailyReward = 1000;
    if (!Number.isSafeInteger(server.settings.startingBalance) || server.settings.startingBalance < 0) server.settings.startingBalance = 500;
    const saldoLegacy = economyData.legacyBalances;
    if (saldoLegacy && typeof saldoLegacy === 'object') {
        Object.assign(economyData.servers[guildId], saldoLegacy);
        delete economyData.legacyBalances;
        simpanUang();
    }
    const userLegacy = owoState.legacyUsers;
    if (userLegacy && typeof userLegacy === 'object') {
        Object.assign(server.users, userLegacy);
        delete owoState.legacyUsers;
        simpanOwoState();
    }
    return server;
}

const voiceCreationLocks = new Set();

const voicePanelActions = [
    ['name', 'NAME', '🏷️'],
    ['limit', 'LIMIT', '👥'],
    ['privacy', 'PRIVACY', '🛡️'],
    ['trust', 'TRUST', '🟢'],
    ['untrust', 'UNTRUST', '🎙️'],
    ['invite', 'INVITE', '📞'],
    ['kick', 'KICK', '📵'],
    ['block', 'BLOCK', '🚫'],
    ['unblock', 'UNBLOCK', '🔓'],
    ['info', 'INFO', 'ℹ️'],
    ['log', 'LOG', '🗒️'],
    ['claim', 'CLAIM', '👑'],
    ['transfer', 'TRANSFER', '🔁'],
    ['reset', 'RESET', '⚙️'],
    ['delete', 'DELETE', '🗑️']
];

function buatBarisTombolPanelVoice(customId) {
    const rows = [];
    for (let index = 0; index < voicePanelActions.length; index += 5) {
        rows.push(new ActionRowBuilder().addComponents(
            ...voicePanelActions.slice(index, index + 5).map(([action, label, emoji]) =>
                new ButtonBuilder()
                    .setCustomId(customId(action))
                    .setLabel(label)
                    .setEmoji(emoji)
                    .setStyle(action === 'delete' ? ButtonStyle.Danger : ButtonStyle.Secondary)
            )
        ));
    }
    return rows;
}

function buatPanelVoice(room, ownerId) {
    const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle('Voice Control Interface')
        .setDescription('Kelola voice sementara Anda menggunakan tombol di bawah ini.\n' +
            `Channel: **${room.name}** • Pemilik: <@${ownerId}>\n` +
            'Untuk aksi anggota, cari nama lalu pilih dari menu Discord.');
    return {
        embeds: [embed],
        components: buatBarisTombolPanelVoice(action => `tempvoice:${action}:${room.id}`)
    };
}

function buatPanelVoiceBersama(guildId) {
    const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle('Voice Control Interface')
        .setDescription('Kelola voice sementara Anda menggunakan tombol di bawah ini.');
    return {
        embeds: [embed],
        components: buatBarisTombolPanelVoice(action => `tempvoice-shared:${action}:${guildId}`)
    };
}

function buatMenuPilihAnggotaVoice(action, roomId, ownerId) {
    const labels = {
        trust: 'Pilih anggota untuk diberi akses',
        untrust: 'Pilih anggota untuk mencabut akses',
        invite: 'Pilih anggota untuk diundang',
        kick: 'Pilih anggota yang akan dikeluarkan',
        block: 'Pilih anggota yang akan diblokir',
        unblock: 'Pilih anggota untuk membuka blokir',
        transfer: 'Pilih pemilik voice yang baru'
    };
    const menu = new UserSelectMenuBuilder()
        .setCustomId(`tempvoice-user:${action}:${roomId}:${ownerId}`)
        .setPlaceholder(labels[action] || 'Cari anggota berdasarkan nama')
        .setMinValues(1)
        .setMaxValues(1);
    if (action === 'kick' || action === 'transfer') {
        menu.setPlaceholder(`${labels[action]} • harus sedang di voice`);
    }
    return new ActionRowBuilder().addComponents(menu);
}

function catatAksiPanelVoice(guildId, room, user, aksi) {
    catatLogMod(guildId, `🔊 [VOICE PANEL] ${user.tag} ${aksi} di ${room.name} (${room.id}).`, 'voice-panel');
}

function buatEmbedLogVoice(member, event) {
    const bergabung = event === 'join';
    return new EmbedBuilder()
        .setColor(bergabung ? SUCCESS_COLOR : ERROR_COLOR)
        .setDescription(`${member} ${bergabung ? 'joined the voice channels.' : 'left the voice channel.'}`);
}

async function jalankanAksiAnggotaVoice(interaction, room, action, targetId, server, ownerId) {
    const reply = options => interaction.isUserSelectMenu()
        ? interaction.followUp({ ...options, ephemeral: true })
        : interaction.reply({ ...options, ephemeral: true });
    const target = await interaction.guild.members.fetch(targetId).catch(error => {
        console.error('Gagal mencari anggota untuk pengaturan voice:', error);
        return null;
    });
    if (!target || target.user.bot || target.id === ownerId) {
        await reply({ content: 'Anggota tidak valid atau merupakan pemilik channel.' });
        return;
    }
    if ((action === 'transfer' || action === 'kick') && target.voice.channelId !== room.id) {
        await reply({ content: 'Untuk aksi ini, anggota harus sedang berada di room voice yang sama.' });
        return;
    }
    if (action === 'kick') {
        await target.voice.disconnect('Dikeluarkan oleh pemilik voice sementara');
        catatAksiPanelVoice(interaction.guild.id, room, interaction.user, `mengeluarkan ${target.user.tag}`);
        await reply({ content: `👢 ${target.user.tag} dikeluarkan dari room.` });
        return;
    }
    if (action === 'trust' || action === 'invite' || action === 'untrust' || action === 'block' || action === 'unblock') {
        if (action === 'untrust' || action === 'unblock') {
            await room.permissionOverwrites.delete(target.id);
            catatAksiPanelVoice(interaction.guild.id, room, interaction.user, `mencabut akses ${target.user.tag}`);
            await reply({ content: `✅ Izin khusus ${target.user.tag} dihapus.` });
            return;
        }
        await room.permissionOverwrites.edit(target.id, action === 'block'
            ? { ViewChannel: false, Connect: false }
            : { ViewChannel: true, Connect: true, Speak: true });
        catatAksiPanelVoice(
            interaction.guild.id,
            room,
            interaction.user,
            `${action === 'block' ? 'memblokir' : action === 'trust' ? 'memberi trust kepada' : 'mengundang'} ${target.user.tag}`
        );
        await reply({
            content: action === 'block'
                ? `⛔ ${target.user.tag} diblokir dari room.`
                : `✅ ${target.user.tag} sekarang dapat melihat dan masuk ke room.`
        });
        return;
    }
    if (action === 'transfer') {
        await room.permissionOverwrites.edit(target.id, { ViewChannel: true, Connect: true, Speak: true });
        await room.permissionOverwrites.edit(ownerId, { ViewChannel: null, Connect: null, Speak: null });
        server.voice.rooms[room.id] = target.id;
        simpanOwoState();
        catatAksiPanelVoice(interaction.guild.id, room, interaction.user, `mentransfer kepemilikan kepada ${target.user.tag}`);
        await reply({ content: `👑 Kepemilikan room dipindahkan ke ${target}.` });
        return;
    }
    await interaction.reply({ content: 'Aksi anggota voice tidak dikenal.', ephemeral: true });
}

const HELP_CATEGORY_META = Object.freeze({
    public: {
        ringkasan: { judul: '📘 Panduan Singkat', info:
            '**Cara pakai**\n' +
            '• Awali command dengan `ltn `.\n' +
            '• Command juga tersedia lewat slash `/`; pilih nama command, lalu isi opsi `input` dengan argumen yang sama.\n' +
            '• Ganti `<...>` dengan nilai yang diminta; `[...]` berarti opsional.\n' +
            '• Gunakan mention Discord untuk anggota, role, atau channel.\n\n' +
            '**Bantuan admin**\n' +
            '• Admin dengan izin **Manage Server** dapat menjalankan `ltn help admin`; panduan dikirim melalui DM.\n\n' +
            '**Ticket**\n' +
            '• Gunakan panel Ticket untuk mengirim laporan, ide update, atau pesan lainnya.'
        },
        voice: { judul: '🔊 Voice Sementara', info:
            'Masuk ke lobby yang disiapkan server untuk membuat voice sementara. Pengaturan room berlaku saat kamu berada di room sementara milikmu.\n' +
            'Panel voice juga menyediakan privasi, trust/invite, block, claim, reset, dan hapus; aksi anggota dapat dicari berdasarkan nama.'
        },
        ekonomi: { judul: '💰 Ekonomi & Koleksi', info: '' },
        game: { judul: '🎮 Mini-Game', info:
            '• Slot: 2 simbol sama mendapat 1,5× taruhan; 3 simbol sama mendapat 5×.\n' +
            '• Semua game tersedia di **Dashboard → Main Game**.\n' +
            '• Jeda antarpanggilan: 5 detik per game.\n' +
            '• Taruhan dapat memakai titik ribuan (`1.000.000`) atau `all`.'
        },
        musik: { judul: '🎵 Pemutar Musik', info:
            'Spotify dipakai untuk membaca metadata lagu; audio diputar dari hasil padanan YouTube karena Spotify tidak menyediakan streaming audio melalui play-dl.\n' +
            'Kontrol pemutaran hanya dapat digunakan oleh anggota yang berada di voice channel bot.'
        }
    },
    admin: {
        moderasi: { judul: '🛡️ Moderasi', info:
            'Command yang mengubah moderasi memerlukan izin yang disebutkan pada tiap command.'
        },
        pengaturan: { judul: '⚙️ Admin & Komunitas', info:
            'Command pada kategori ini memerlukan izin **Manage Server**. Auto-respon mencocokkan pemicu di seluruh isi pesan. Welcome, goodbye, dan auto-role juga memerlukan Server Members Intent serta izin bot yang sesuai.'
        },
        voice: { judul: '🔊 Konfigurasi Voice', info:
            'Pemilik room sementara tetap mengelola room miliknya melalui command publik/panel; command moderator memerlukan izin voice yang sesuai.'
        }
    }
});

const HELP_COMMANDS = Object.freeze([
    { audience: 'public', category: 'ringkasan', usage: '`ltn help` / `ltn bantuan`', description: 'buka panduan command publik.' },
    { audience: 'public', category: 'voice', usage: '`ltn vc panel`', description: 'kirim ulang panel ke chat voice milikmu.' },
    { audience: 'public', category: 'voice', usage: '`ltn vc owner` / `ltn vc pemilik`', description: 'lihat pemilik room sementara.' },
    { audience: 'public', category: 'voice', usage: '`ltn vc lock` / `ltn vc unlock`', description: 'kunci atau buka room milikmu.' },
    { audience: 'public', category: 'voice', usage: '`ltn vc limit <0-99>`', description: 'atur batas anggota; `0` berarti tanpa batas.' },
    { audience: 'public', category: 'voice', usage: '`ltn vc name <nama>`', description: 'ganti nama room.' },
    { audience: 'public', category: 'voice', usage: '`ltn vc transfer @anggota` / `ltn vc kick @anggota`', description: 'alihkan kepemilikan atau keluarkan anggota dari room milikmu.' },
    { audience: 'public', category: 'voice', usage: '`ltn mutevc` / `ltn unmutevc`', description: 'mute/unmute anggota di room milikmu; moderator juga dapat menggunakan izin Mute Members.' },
    { audience: 'public', category: 'voice', usage: '`ltn dc @anggota`', description: 'putuskan anggota dari room milikmu; moderator memerlukan Move Members.' },

    { audience: 'public', category: 'ekonomi', usage: '`ltn cash` / `ltn bal` / `ltn saldo`', description: 'cek saldo koin.' },
    { audience: 'public', category: 'ekonomi', usage: '`ltn daily`', description: 'klaim hadiah harian.' },
    { audience: 'public', category: 'ekonomi', usage: '`ltn top` / `ltn leaderboard`', description: 'lihat papan saldo server.' },
    { audience: 'public', category: 'ekonomi', usage: '`ltn profil`', description: 'buka dashboard privat; `ltn profile @anggota` melihat profil publik.' },
    { audience: 'public', category: 'ekonomi', usage: '`ltn history [@anggota]` / `ltn riwayat [@anggota]`', description: 'lihat riwayat transaksi dan permainan.' },
    { audience: 'public', category: 'ekonomi', usage: '`ltn send @anggota <jumlah/all>`', description: 'transfer koin; alias `pay` dan `transfer`.' },
    { audience: 'public', category: 'ekonomi', usage: '`ltn pray @anggota` / `ltn curse @anggota`', description: 'aksi dengan cooldown.' },
    { audience: 'public', category: 'ekonomi', usage: '`ltn shop` / `ltn toko`', description: 'lihat toko.' },
    { audience: 'public', category: 'ekonomi', usage: '`ltn buy <barang> [jumlah]` / `ltn beli <barang> [jumlah]`', description: 'beli item.' },
    { audience: 'public', category: 'ekonomi', usage: '`ltn inventory` / `ltn inv` / `ltn tas`', description: 'lihat inventory.' },
    { audience: 'public', category: 'ekonomi', usage: '`ltn use umpan` / `ltn pakai umpan`', description: 'pasang umpan untuk perburuan berikutnya.' },
    { audience: 'public', category: 'ekonomi', usage: '`ltn hunt`', description: 'berburu hewan.' },
    { audience: 'public', category: 'ekonomi', usage: '`ltn zoo`', description: 'lihat koleksi hewan.' },
    { audience: 'public', category: 'ekonomi', usage: '`ltn sell all`', description: 'jual semua hewan.' },

    { audience: 'public', category: 'game', usage: '`ltn cf <jumlah/all>` / `ltn coinflip <jumlah/all>`', description: 'main coinflip otomatis; menang mendapat 2× taruhan.' },
    { audience: 'public', category: 'game', usage: '`ltn s <jumlah/all>` / `ltn sl <jumlah/all>` / `ltn slot <jumlah/all>`', description: 'Animal Slot dengan simbol L/T/N, uang, dan hewan.' },
    { audience: 'public', category: 'game', usage: '`ltn mn <jumlah/all> [bom 1-8]` / `ltn mines <jumlah/all> [bom 1-8]`', description: 'main Mines.' },
    { audience: 'public', category: 'game', usage: '`ltn gb <jumlah/all>` / `ltn gamble <jumlah/all>`', description: 'main adu angka.' },

    { audience: 'public', category: 'musik', usage: '`ltn play <URL/judul>`', description: 'putar YouTube, cari lagu, atau masukkan tautan track/album/playlist Spotify.' },
    { audience: 'public', category: 'musik', usage: '`ltn pause` / `ltn resume`', description: 'jeda atau lanjutkan pemutaran.' },
    { audience: 'public', category: 'musik', usage: '`ltn skip` / `ltn stop`', description: 'lewati lagu atau hentikan pemutaran dan keluar dari voice.' },
    { audience: 'public', category: 'musik', usage: '`ltn queue`', description: 'lihat lagu yang sedang diputar dan antrean.' },
    { audience: 'public', category: 'musik', usage: '`ltn volume <1-100>`', description: 'atur volume pemutar; tombol Set Volume pada panel membuka pengaturan volume.' },
    { audience: 'public', category: 'musik', usage: '`ltn loop [on/off]` / `ltn autoplay [on/off]`', description: 'aktifkan ulang lagu atau putar rekomendasi YouTube setelah antrean habis.' },
    { audience: 'public', category: 'musik', usage: '`ltn panel`', description: 'tampilkan ulang panel pemutar musik di channel ini.' },

    { audience: 'admin', category: 'moderasi', usage: '`ltn kick @anggota`', description: 'keluarkan anggota (Kick Members).' },
    { audience: 'admin', category: 'moderasi', usage: '`ltn clear <1-100>`', description: 'hapus pesan (Manage Messages).' },
    { audience: 'admin', category: 'moderasi', usage: '`ltn timeout @anggota <durasi> [alasan]`', description: 'timeout anggota, misalnya `30m` atau `2h` (Moderate Members).' },
    { audience: 'admin', category: 'moderasi', usage: '`ltn slowmode [#channel] <0-21600>`', description: 'atur slowmode (Manage Channels).' },
    { audience: 'admin', category: 'moderasi', usage: '`ltn lock [#channel]` / `ltn unlock [#channel]`', description: 'kunci/buka channel teks (Manage Channels).' },
    { audience: 'admin', category: 'moderasi', usage: '`ltn filter tambah <kata/frasa>` / `hapus <kata/frasa>` / `daftar`', description: 'kelola filter (Manage Messages).' },
    { audience: 'admin', category: 'moderasi', usage: '`ltn filter ignore-channel #channel` / `unignore-channel #channel`', description: 'kelola pengecualian filter channel.' },
    { audience: 'admin', category: 'moderasi', usage: '`ltn filter ignore-role @role` / `unignore-role @role`', description: 'kelola pengecualian filter role.' },
    { audience: 'admin', category: 'moderasi', usage: '`ltn modlog set #channel` / `ltn modlog off`', description: 'atur log moderasi (Manage Server).' },
    { audience: 'admin', category: 'moderasi', usage: '`ltn modsummary [24h/7d] [kategori]`', description: 'lihat ringkasan moderasi (Manage Server).' },
    { audience: 'admin', category: 'moderasi', usage: '`ltn mutevc` / `ltn unmutevc`', description: 'mute/unmute voice; moderator perlu Mute Members.' },
    { audience: 'admin', category: 'moderasi', usage: '`ltn dc @anggota`', description: 'putuskan anggota dari voice (Move Members).' },

    { audience: 'admin', category: 'pengaturan', usage: '`ltn welcome set #channel [pesan]` / `ltn welcome pesan <pesan>` / `ltn welcome off`', description: 'atur pesan anggota masuk.' },
    { audience: 'admin', category: 'pengaturan', usage: '`ltn goodbye set #channel [pesan]` / `ltn goodbye pesan <pesan>` / `ltn goodbye off`', description: 'atur pesan anggota keluar.' },
    { audience: 'admin', category: 'pengaturan', usage: '`ltn autorole set @role` / `ltn autorole off`', description: 'atur role otomatis anggota baru.' },
    { audience: 'admin', category: 'pengaturan', usage: '`ltn verify setup #channel @role`', description: 'kirim panel verifikasi.' },
    { audience: 'admin', category: 'pengaturan', usage: '`ltn reportpanel [#channel]`', description: 'kirim panel laporan.' },
    { audience: 'admin', category: 'pengaturan', usage: '`ltn adminpanel [#channel]`', description: 'kirim panel konfigurasi admin.' },
    { audience: 'admin', category: 'pengaturan', usage: '`ltn sendall <jumlah-per-orang>` / `ltn rain <jumlah-per-orang>`', description: 'bagikan koin ke semua anggota manusia termasuk yang offline; total biaya dipotong dari saldo admin (Manage Server).' },
    { audience: 'admin', category: 'pengaturan', usage: '`ltn ticketpanel #panel [#list-ticket]` / `ltn ticketpanel off`', description: 'atur panel publik dan channel antrean privat; satu channel juga didukung. Alias lama: `ltn requestpanel`.' },
    { audience: 'admin', category: 'pengaturan', usage: '`ltn announce #channel <pesan>` / `ltn announce jadwal #channel <durasi> <pesan>`', description: 'kirim pengumuman atau jadwalkan hingga 7 hari (alias `pengumuman`).' },
    { audience: 'admin', category: 'pengaturan', usage: '`ltn backup buat` / `daftar` / `pulihkan <id>`', description: 'kelola backup konfigurasi server.' },
    { audience: 'admin', category: 'pengaturan', usage: '`ltn economy set daily <jumlah>` / `ltn economy set start <jumlah>`', description: 'atur hadiah daily atau saldo awal (alias `ekonomi`).' },
    { audience: 'admin', category: 'pengaturan', usage: '`ltn autorespon tambah <kata> | <balasan>` / `hapus <kata>` / `daftar` / `aktif` / `nonaktif`', description: 'kelola auto-respon (alias `auto-respon` / `autoresponse`).' },

    { audience: 'admin', category: 'voice', usage: '`ltn vc setup [#lobby]`', description: 'atur lobby voice sementara (Manage Channels).' },
    { audience: 'admin', category: 'voice', usage: '`ltn vc panel #channel` / `ltn vc panel setup #channel`', description: 'kirim/perbarui panel voice bersama (Manage Server).' },
    { audience: 'admin', category: 'voice', usage: '`ltn vc panel off`', description: 'nonaktifkan panel voice bersama (Manage Server).' },
    { audience: 'admin', category: 'voice', usage: '`ltn join vc`', description: 'masukkan bot ke voice tempat admin berada (Manage Server); bot tetap di voice sampai dikeluarkan dari channel.' }
]);

const SLASH_COMMAND_ROUTES = new Map();
for (const item of HELP_COMMANDS) {
    for (const [, usage] of item.usage.matchAll(/`ltn\s+([^`]+)`/g)) {
        const [first, second] = usage.trim().toLowerCase().split(/\s+/);
        const route = ['join', 'leave'].includes(first) && second === 'vc' ? `${first} vc` : first;
        const name = route.replace(/\s+/g, '-');
        if (!SLASH_COMMAND_ROUTES.has(name)) {
            SLASH_COMMAND_ROUTES.set(name, item.description.replace(/[`*_]/g, '').slice(0, 100));
        }
    }
}

const SLASH_COMMANDS = [...SLASH_COMMAND_ROUTES].map(([name, description]) =>
    new SlashCommandBuilder()
        .setName(name)
        .setDescription(description || `Jalankan command ${name}.`)
        .addStringOption(option => option
            .setName('input')
            .setDescription('Argumen tambahan sesuai format command.')
            .setMaxLength(2000)
            .setRequired(['play', 'volume'].includes(name)))
        .toJSON()
);

function formatDurasiMusik(durasi) {
    if (!Number.isFinite(durasi) || durasi <= 0) return 'Live';
    const totalDetik = Math.floor(durasi);
    const jam = Math.floor(totalDetik / 3600);
    const menit = Math.floor((totalDetik % 3600) / 60);
    const detik = totalDetik % 60;
    return jam
        ? `${jam}:${String(menit).padStart(2, '0')}:${String(detik).padStart(2, '0')}`
        : `${menit}:${String(detik).padStart(2, '0')}`;
}

function buatTrackYouTube(video, requestedBy, sourceUrl = video.url, platform = 'YouTube', artistOverride = null, thumbnailOverride = null, durationOverride = null) {
    if (!video || video.live || video.isLive) return null;
    const thumbnail = thumbnailOverride ||
        (Array.isArray(video.thumbnails) && video.thumbnails.length
            ? video.thumbnails[video.thumbnails.length - 1].url
            : null);
    return {
        title: video.title || 'Lagu tanpa judul',
        artist: artistOverride || video.channel?.name || video.author?.name || 'YouTube',
        duration: Number.isFinite(durationOverride) ? durationOverride : video.durationInSec ?? video.lengthSeconds,
        thumbnail,
        sourceUrl,
        playUrl: video.url || `https://www.youtube.com/watch?v=${video.id}`,
        platform,
        requestedBy
    };
}

async function cariTrackSpotify(track, requestedBy) {
    const artis = Array.isArray(track.artists) ? track.artists.map(artist => artist.name).join(' ') : '';
    const client = await ambilClientYouTube();
    const [video] = await client.search(`${track.name} ${artis}`, { limit: 1 });
    if (!video) return null;
    const thumbnail = track.thumbnail?.url || track.album?.thumbnail?.url || null;
    return buatTrackYouTube(
        video,
        requestedBy,
        track.url,
        'Spotify',
        artis || 'Spotify',
        thumbnail,
        track.durationInSec
    );
}

async function cariTrackMusik(input, requestedBy) {
    const jenis = await playDl.validate(input);
    if (jenis === 'yt_video') {
        const client = await ambilClientYouTube();
        const info = await client.getInfo(input);
        const track = buatTrackYouTube(info.videoDetails, requestedBy);
        if (!track) throw new Error('Video live tidak dapat dimasukkan ke antrean.');
        return [track];
    }
    if (jenis === 'yt_playlist') {
        const client = await ambilClientYouTube();
        const playlist = await client.getPlaylist(input, { limit: MAX_PLAYLIST_TRACKS });
        const tracks = playlist.videos
            .map(video => buatTrackYouTube(video, requestedBy))
            .filter(Boolean);
        if (!tracks.length) throw new Error('Playlist tidak berisi video yang dapat diputar.');
        return tracks;
    }
    if (['sp_track', 'sp_playlist', 'sp_album'].includes(jenis)) {
        const spotifyData = await playDl.spotify(input);
        let spotifyTracks;
        if (spotifyData.type === 'track') {
            spotifyTracks = [spotifyData];
        } else {
            try {
                spotifyTracks = spotifyData.page(1) || [];
            } catch {
                spotifyTracks = [];
            }
            if (!spotifyTracks.length) {
                await spotifyData.fetch();
                spotifyTracks = spotifyData.page(1) || [];
            }
            spotifyTracks = spotifyTracks.slice(0, MAX_PLAYLIST_TRACKS);
        }
        const tracks = [];
        for (const track of spotifyTracks) {
            const resolved = await cariTrackSpotify(track, requestedBy);
            if (resolved) tracks.push(resolved);
        }
        if (!tracks.length) throw new Error('Lagu Spotify tidak memiliki hasil audio yang cocok di YouTube.');
        return tracks;
    }
    if (jenis !== 'search') {
        throw new Error('Tautan ini tidak didukung. Gunakan tautan YouTube/Spotify atau judul lagu.');
    }

    const client = await ambilClientYouTube();
    const [video] = await client.search(input, { limit: 1 });
    const track = video ? buatTrackYouTube(video, requestedBy) : null;
    if (!track) throw new Error('Lagu tidak ditemukan. Coba judul atau tautan lain.');
    return [track];
}

function buatStateMusik(guildId) {
    const player = createAudioPlayer({
        behaviors: { noSubscriber: NoSubscriberBehavior.Pause }
    });
    const state = {
        guildId,
        player,
        connection: null,
        queue: [],
        current: null,
        currentStream: null,
        playerMessage: null,
        textChannel: null,
        volume: 0.7,
        loop: false,
        autoplay: false,
        starting: false,
        skipping: false,
        stopping: false
    };
    player.on(AudioPlayerStatus.Idle, () => {
        if (!state.stopping) void mulaiTrackBerikutnya(state);
    });
    player.on('error', error => {
        console.error(`Audio player error di server ${guildId}:`, error);
    });
    musicQueues.set(guildId, state);
    return state;
}

function ambilStateMusik(guildId) {
    return musicQueues.get(guildId) || buatStateMusik(guildId);
}

function buatPanelMusik(state) {
    const track = state.current;
    const queuePreview = state.queue.slice(0, 5)
        .map((item, index) => `**${index + 1}.** [${item.title}](${item.sourceUrl}) — ${formatDurasiMusik(item.duration)}`);
    const description = track
        ? `[${track.title}](${track.sourceUrl})\n${track.artist} • ${formatDurasiMusik(track.duration)}`
        : 'Belum ada lagu yang diputar. Gunakan `/play` atau `ltn play` untuk memulai.';
    const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle(track ? '▶️ Now Playing' : '🎵 Music Player')
        .setDescription(description)
        .addFields(
            { name: 'Requested by', value: track ? `<@${track.requestedBy}>` : '—', inline: true },
            { name: 'Queue', value: `${state.queue.length} song${state.queue.length === 1 ? '' : 's'}`, inline: true },
            {
                name: '🔊 Volume · Autoplay · Loop',
                value: `${Math.round(state.volume * 100)}% · ${state.autoplay ? 'On' : 'Off'} · ${state.loop ? 'On' : 'Off'}`,
                inline: false
            }
        )
        .setFooter({ text: track ? `Source: ${track.platform}` : 'YouTube & Spotify links supported' })
        .setTimestamp();
    if (track?.thumbnail && /^https?:\/\//i.test(track.thumbnail)) embed.setThumbnail(track.thumbnail);
    if (queuePreview.length) {
        embed.addFields({ name: 'Up next', value: queuePreview.join('\n') });
    }

    const controls = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('music:pause')
            .setLabel(state.player.state.status === AudioPlayerStatus.Paused ? 'Resume' : 'Pause')
            .setEmoji(state.player.state.status === AudioPlayerStatus.Paused ? '▶️' : '⏸️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!track),
        new ButtonBuilder()
            .setCustomId('music:skip')
            .setLabel('Skip')
            .setEmoji('⏭️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!track),
        new ButtonBuilder()
            .setCustomId('music:stop')
            .setLabel('Stop')
            .setEmoji('⏹️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!track && !state.queue.length)
    );
    const playbackOptions = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('music:volume')
            .setLabel('Set Volume')
            .setEmoji('🔊')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!track),
        new ButtonBuilder()
            .setCustomId('music:loop')
            .setLabel(state.loop ? 'Loop On' : 'Loop Off')
            .setEmoji('🔁')
            .setStyle(state.loop ? ButtonStyle.Primary : ButtonStyle.Secondary)
            .setDisabled(!track)
    );
    const extraControls = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('music:autoplay')
            .setLabel(state.autoplay ? 'Autoplay On' : 'Autoplay Off')
            .setEmoji('🔀')
            .setStyle(state.autoplay ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('music:like')
            .setLabel('Like')
            .setEmoji('💜')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!track)
    );
    return { embeds: [embed], components: [controls, playbackOptions, extraControls] };
}

async function perbaruiPanelMusik(state) {
    if (!state.playerMessage && !state.textChannel) return;
    const payload = buatPanelMusik(state);
    if (state.playerMessage) {
        try {
            await state.playerMessage.edit(payload);
            return;
        } catch (error) {
            console.error(`Gagal memperbarui panel musik di server ${state.guildId}:`, error);
            state.playerMessage = null;
        }
    }
    if (!state.textChannel) return;
    try {
        state.playerMessage = await state.textChannel.send(payload);
    } catch (error) {
        console.error(`Gagal mengirim panel musik di server ${state.guildId}:`, error);
    }
}

async function cariTrackAutoplay(state, previousTrack) {
    if (!previousTrack?.playUrl) return null;
    try {
        const client = await ambilClientYouTube();
        const relatedVideos = await client.getRelated(previousTrack.playUrl);
        for (const related of relatedVideos.slice(0, 5)) {
            const track = buatTrackYouTube(related, previousTrack.requestedBy);
            if (track && track.playUrl !== previousTrack.playUrl) return track;
        }
    } catch (error) {
        console.error(`Gagal mencari rekomendasi autoplay di server ${state.guildId}:`, error);
    }
    return null;
}

async function mulaiTrackBerikutnya(state) {
    if (state.starting || state.stopping || state.player.state.status !== AudioPlayerStatus.Idle) return;
    state.starting = true;
    let gagalMemulai = false;
    try {
        const trackSebelumnya = state.current;
        const skipCurrent = state.skipping;
        state.skipping = false;
        let track = !skipCurrent && state.loop ? trackSebelumnya : state.queue.shift();
        if (!track && !skipCurrent && state.autoplay) {
            track = await cariTrackAutoplay(state, trackSebelumnya);
        }
        if (!track) {
            state.current = null;
            state.currentStream = null;
            await perbaruiPanelMusik(state);
            return;
        }

        state.current = track;
        const client = await ambilClientYouTube();
        const info = await client.getInfo(track.playUrl);
        const audioFormat = info.formats
            .filter(format => format.hasAudio && !format.hasVideo && !format.isDrm && !format.isOtf)
            .sort((a, b) => {
                const opusPreference = Number(Boolean(b.audioCodec?.startsWith('opus'))) -
                    Number(Boolean(a.audioCodec?.startsWith('opus')));
                return opusPreference || (b.audioBitrate || 0) - (a.audioBitrate || 0);
            })[0];
        if (!audioFormat) throw new Error('YouTube tidak menyediakan format audio yang dapat diputar.');
        const audioStream = client.download(info, { format: audioFormat });
        const inputType = audioFormat.container === 'webm' && audioFormat.audioCodec?.startsWith('opus')
            ? StreamType.WebmOpus
            : StreamType.Arbitrary;
        const resource = createAudioResource(audioStream, {
            inputType,
            inlineVolume: true,
            metadata: track
        });
        resource.volume?.setVolume(state.volume);
        state.currentStream = { stream: audioStream };
        state.player.play(resource);
        await perbaruiPanelMusik(state);
    } catch (error) {
        gagalMemulai = true;
        state.current = null;
        state.currentStream = null;
        console.error(`Gagal memulai lagu di server ${state.guildId}:`, error);
        if (state.textChannel) {
            try {
                await state.textChannel.send('⚠️ Lagu gagal diputar. Saya akan mencoba lagu berikutnya jika ada.');
            } catch (sendError) {
                console.error(`Gagal mengirim notifikasi pemutar musik di server ${state.guildId}:`, sendError);
            }
        }
        await perbaruiPanelMusik(state);
    } finally {
        state.starting = false;
    }
    if (gagalMemulai && state.queue.length) setImmediate(() => void mulaiTrackBerikutnya(state));
}

async function hubungkanPemutarMusik(state, message, voiceChannel) {
    const botMember = message.guild.members.me;
    if (!botMember) throw new Error('Data anggota bot belum tersedia. Coba lagi sebentar.');
    const permissions = voiceChannel.permissionsFor(botMember);
    if (!permissions?.has(PermissionsBitField.Flags.ViewChannel) ||
        !permissions?.has(PermissionsBitField.Flags.Connect) ||
        !permissions?.has(PermissionsBitField.Flags.Speak)) {
        throw new Error('Bot memerlukan izin View Channel, Connect, dan Speak pada voice channel tersebut.');
    }

    let connection = getVoiceConnection(message.guild.id);
    if (connection && connection.joinConfig.channelId !== voiceChannel.id) {
        throw new Error(`Bot sedang terhubung ke <#${connection.joinConfig.channelId}>.`);
    }
    if (!connection) {
        if (!message.guild.voiceAdapterCreator) {
            throw new Error('Gateway voice Discord belum siap. Tunggu beberapa saat lalu coba kembali.');
        }
        connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator,
            selfDeaf: true
        });
    }
    if (!monitoredVoiceConnections.has(connection)) {
        connection.on('error', error => {
            console.error(`Voice connection error di server ${message.guild.id}:`, error);
        });
        monitoredVoiceConnections.add(connection);
    }
    state.connection = connection;
    connection.subscribe(state.player);
    try {
        await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
    } catch (error) {
        const failedState = connection.state;
        if (failedState.status !== VoiceConnectionStatus.Ready) {
            const reason = failedState.status === VoiceConnectionStatus.Disconnected
                ? `, reason ${failedState.reason}${'closeCode' in failedState ? `, close code ${failedState.closeCode}` : ''}`
                : '';
            console.error(
                `Voice connection timeout di server ${message.guild.id}: status ${failedState.status}${reason}`,
                error
            );
            if (getVoiceConnection(message.guild.id) === connection) connection.destroy();
            state.connection = null;
            const nextStep = failedState.status === VoiceConnectionStatus.Connecting
                ? 'Pastikan host/container mengizinkan koneksi UDP keluar ke Discord.'
                : 'Pastikan dependency terbaru sudah dipasang di server dan koneksi Gateway Discord stabil.';
            throw new Error(
                `Bot gagal terhubung ke voice channel (status ${failedState.status}${reason}). ${nextStep}`
            );
        }
    }
}

async function jalankanAksiMusik(state, action, input = '') {
    if (action === 'pause') {
        if (state.player.state.status !== AudioPlayerStatus.Playing) return 'Tidak ada lagu yang sedang berjalan.';
        state.player.pause(true);
        return '⏸️ Pemutaran dijeda.';
    }
    if (action === 'resume') {
        if (state.player.state.status !== AudioPlayerStatus.Paused) return 'Pemutaran tidak sedang dijeda.';
        state.player.unpause();
        return '▶️ Pemutaran dilanjutkan.';
    }
    if (action === 'skip') {
        if (!state.current) return 'Tidak ada lagu yang sedang diputar.';
        state.skipping = true;
        const stream = state.currentStream;
        state.currentStream = null;
        state.player.stop(true);
        stream?.stream?.destroy();
        return '⏭️ Lagu dilewati.';
    }
    if (action === 'stop') {
        state.stopping = true;
        const stream = state.currentStream;
        state.currentStream = null;
        state.player.stop(true);
        stream?.stream?.destroy();
        state.queue.length = 0;
        state.current = null;
        state.currentStream = null;
        state.loop = false;
        state.autoplay = false;
        if (state.connection && getVoiceConnection(state.guildId) === state.connection) state.connection.destroy();
        state.connection = null;
        state.stopping = false;
        return '⏹️ Pemutaran dihentikan dan bot keluar dari voice channel.';
    }
    if (action === 'volume') {
        const volume = Number(input);
        if (!Number.isInteger(volume) || volume < 1 || volume > 100) return 'Gunakan volume antara 1 sampai 100.';
        state.volume = volume / 100;
        const resource = state.player.state.resource;
        resource?.volume?.setVolume(state.volume);
        return `🔊 Volume diatur ke **${volume}%**.`;
    }
    if (action === 'loop' || action === 'autoplay') {
        const normalized = input.toLowerCase();
        if (normalized && !['on', 'off'].includes(normalized)) return `Gunakan \`on\` atau \`off\` untuk ${action}.`;
        const key = action === 'loop' ? 'loop' : 'autoplay';
        state[key] = normalized ? normalized === 'on' : !state[key];
        return `${action === 'loop' ? '🔁 Loop' : '🔀 Autoplay'} ${state[key] ? 'diaktifkan' : 'dinonaktifkan'}.`;
    }
    return null;
}

async function prosesCommandMusik(message, command, args) {
    if (!message.guild || !message.member) {
        return message.reply('⚠️ Pemutar musik hanya dapat digunakan di dalam server Discord.');
    }
    const input = args.join(' ').trim();
    if (command === 'panel') {
        const state = ambilStateMusik(message.guild.id);
        const previousMessage = state.playerMessage;
        state.textChannel = message.channel;
        try {
            state.playerMessage = await message.channel.send(buatPanelMusik(state));
        } catch (error) {
            console.error(`Gagal mengirim panel musik di server ${message.guild.id}:`, error);
            return message.reply('⚠️ Panel musik gagal dikirim. Periksa izin bot untuk mengirim pesan dan embed di channel ini.');
        }
        if (previousMessage && previousMessage.id !== state.playerMessage.id) {
            try {
                await previousMessage.delete();
            } catch (error) {
                console.error(`Gagal menghapus panel musik lama di server ${message.guild.id}:`, error);
            }
        }
        return message.reply('🎵 Panel pemutar musik ditampilkan di channel ini.');
    }
    if (command === 'play') {
        if (!input) return message.reply('Gunakan `/play input:<URL atau judul>` atau `ltn play <URL atau judul>`.');
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) {
            return message.reply('🔊 Masuk ke voice channel terlebih dahulu untuk memutar musik.');
        }

        let tracks;
        try {
            tracks = await cariTrackMusik(input, message.author.id);
        } catch (error) {
            console.error(`Gagal mencari lagu "${input}" di server ${message.guild.id}:`, error);
            return message.reply(`❌ ${error.message || 'Pencarian lagu gagal.'}`);
        }
        const state = ambilStateMusik(message.guild.id);
        if (state.queue.length + tracks.length > MAX_MUSIC_QUEUE) {
            return message.reply(`⚠️ Antrean dibatasi ${MAX_MUSIC_QUEUE} lagu. Hapus atau putar sebagian antrean terlebih dahulu.`);
        }
        try {
            await hubungkanPemutarMusik(state, message, voiceChannel);
        } catch (error) {
            return message.reply(`❌ ${error.message}`);
        }
        state.textChannel = message.channel;
        const posisiPertama = state.queue.length + (state.current || state.starting ? 2 : 1);
        state.queue.push(...tracks);
        void mulaiTrackBerikutnya(state);
        const ringkasan = tracks.length > 1
            ? `✅ **${amanUntukTeksDiscord(tracks[0].title)}** dan ${tracks.length - 1} lagu lainnya ditambahkan ke antrean.`
            : `✅ **${amanUntukTeksDiscord(tracks[0].title)}** ditambahkan ke antrean.`;
        return message.reply(`${ringkasan} Posisi: **${posisiPertama}**.`);
    }

    const state = musicQueues.get(message.guild.id);
    if (!state) return message.reply('ℹ️ Belum ada pemutar musik aktif di server ini.');
    if (command === 'queue') {
        const description = [
            state.current ? `▶️ **Sedang diputar:** [${state.current.title}](${state.current.sourceUrl})` : 'Tidak ada lagu yang sedang diputar.',
            ...state.queue.slice(0, 10).map((track, index) =>
                `**${index + 1}.** [${track.title}](${track.sourceUrl}) — ${formatDurasiMusik(track.duration)}`
            ),
            state.queue.length > 10 ? `…dan ${state.queue.length - 10} lagu lainnya.` : ''
        ].filter(Boolean).join('\n');
        return message.reply({
            embeds: [new EmbedBuilder().setColor(THEME_COLOR).setTitle('🎵 Antrean Musik').setDescription(description)]
        });
    }

    const voiceChannelId = state.connection?.joinConfig.channelId;
    if (!voiceChannelId || message.member.voice.channelId !== voiceChannelId) {
        return message.reply('🔊 Kamu harus berada di voice channel yang sama dengan bot untuk mengontrol pemutar musik.');
    }
    if (command === 'pause' || command === 'resume' || command === 'skip' || command === 'stop' ||
        command === 'volume' || command === 'loop' || command === 'autoplay') {
        const result = await jalankanAksiMusik(state, command, input);
        await perbaruiPanelMusik(state);
        return message.reply(result || 'Command musik tidak dikenal.');
    }
    return null;
}

async function prosesTombolMusik(interaction) {
    const state = interaction.guild ? musicQueues.get(interaction.guild.id) : null;
    if (!state) {
        await interaction.reply({ content: 'ℹ️ Belum ada pemutar musik aktif di server ini.', ephemeral: true });
        return;
    }

    const action = interaction.customId.slice('music:'.length);
    if (action === 'like') {
        try {
            await interaction.deferReply({ ephemeral: true });
            await interaction.message.react('💜');
            await interaction.editReply('💜 Lagu ditandai suka.');
        } catch (error) {
            console.error('Gagal menambahkan reaksi suka pada lagu:', error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply('⚠️ Saya tidak dapat menambahkan reaksi. Periksa izin Add Reactions.');
            } else {
                await interaction.reply({ content: '⚠️ Saya tidak dapat menambahkan reaksi. Periksa izin Add Reactions.', ephemeral: true });
            }
        }
        return;
    }

    try {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        const voiceChannelId = state.connection?.joinConfig.channelId;
        if (!voiceChannelId || member.voice.channelId !== voiceChannelId) {
            await interaction.reply({
                content: '🔊 Kamu harus berada di voice channel yang sama dengan bot untuk mengontrol pemutar musik.',
                ephemeral: true
            });
            return;
        }

        if (action === 'volume') {
            const modal = new ModalBuilder()
                .setCustomId(`music-volume:${interaction.guild.id}`)
                .setTitle('Atur Volume')
                .addComponents(new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('volume')
                        .setLabel('Volume baru (1-100)')
                        .setStyle(TextInputStyle.Short)
                        .setMinLength(1)
                        .setMaxLength(3)
                        .setPlaceholder('70')
                        .setValue(String(Math.round(state.volume * 100)))
                        .setRequired(true)
                ));
            await interaction.showModal(modal);
            return;
        }

        await interaction.deferReply({ ephemeral: true });
        const command = action === 'pause' && state.player.state.status === AudioPlayerStatus.Paused
            ? 'resume'
            : action;
        const result = await jalankanAksiMusik(state, command);
        await perbaruiPanelMusik(state);
        await interaction.editReply(result || 'Command musik tidak dikenal.');
    } catch (error) {
        console.error(`Gagal menjalankan tombol musik ${action}:`, error);
        const response = { content: '⚠️ Kontrol musik gagal diproses. Silakan coba lagi.' };
        if (interaction.deferred || interaction.replied) await interaction.editReply(response);
        else await interaction.reply({ ...response, ephemeral: true });
    }
}

async function prosesModalVolumeMusik(interaction) {
    const state = interaction.guild ? musicQueues.get(interaction.guild.id) : null;
    if (!state || interaction.customId !== `music-volume:${interaction.guildId}`) {
        await interaction.reply({ content: 'ℹ️ Belum ada pemutar musik aktif di server ini.', ephemeral: true });
        return;
    }
    try {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        const voiceChannelId = state.connection?.joinConfig.channelId;
        if (!voiceChannelId || member.voice.channelId !== voiceChannelId) {
            await interaction.reply({
                content: '🔊 Kamu harus berada di voice channel yang sama dengan bot untuk mengatur volume.',
                ephemeral: true
            });
            return;
        }
        await interaction.deferReply({ ephemeral: true });
        const volume = interaction.fields.getTextInputValue('volume');
        const result = await jalankanAksiMusik(state, 'volume', volume);
        await perbaruiPanelMusik(state);
        await interaction.editReply(result || 'Pengaturan volume tidak dikenal.');
    } catch (error) {
        console.error('Gagal mengatur volume melalui panel musik:', error);
        const response = { content: '⚠️ Pengaturan volume gagal diproses. Silakan coba lagi.' };
        if (interaction.deferred || interaction.replied) await interaction.editReply(response);
        else await interaction.reply({ ...response, ephemeral: true });
    }
}

function buatKategoriHelp(audience) {
    const categoryMeta = HELP_CATEGORY_META[audience];
    const categories = {};
    for (const [category, metadata] of Object.entries(categoryMeta)) {
        const commandLines = HELP_COMMANDS
            .filter(item => item.audience === audience && item.category === category)
            .map(item => `• ${item.usage} — ${item.description}`);
        const sections = [];
        if (commandLines.length) sections.push('**Command**\n' + commandLines.join('\n'));
        if (metadata.info) sections.push(metadata.info);
        categories[category] = {
            judul: metadata.judul,
            isi: sections.join('\n\n')
        };
    }
    return categories;
}

const kategoriHelpPublik = buatKategoriHelp('public');
const kategoriHelpAdmin = buatKategoriHelp('admin');

function buatHelpEmbed(kategori, adminMode = false) {
    const categories = adminMode ? kategoriHelpAdmin : kategoriHelpPublik;
    const halaman = categories[kategori] || categories.ringkasan || categories.moderasi;
    const posisi = Object.keys(categories).indexOf(kategori) + 1;
    const isi = halaman.isi.split('\n').map(baris => {
        const teks = baris.trim();
        return teks.startsWith('`ltn ') ? `• ${teks}` : baris;
    }).join('\n');
    return new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setAuthor({ name: adminMode ? 'LTN BOT • PANDUAN ADMIN' : 'LTN BOT • PUSAT BANTUAN' })
        .setTitle(halaman.judul)
        .setDescription(isi)
        .setFooter({
            text: `${adminMode ? 'Khusus admin • ' : ''}Kategori ${posisi}/${Object.keys(categories).length} • Pilih kategori dari menu`
        })
        .setTimestamp();
}

function buatMenuHelp(userId, kategoriAktif = 'ringkasan', adminMode = false, guildId = null) {
    const labels = adminMode
        ? {
            moderasi: ['Moderasi', '🛡️ Moderasi dan izin'],
            pengaturan: ['Admin & Komunitas', '⚙️ Pengaturan server dan auto-respon'],
            voice: ['Konfigurasi Voice', '🔊 Lobby dan moderasi voice']
        }
        : {
            ringkasan: ['Panduan singkat', '📘 Cara menggunakan bot'],
            voice: ['Voice sementara', '🔊 Kelola room milikmu'],
            ekonomi: ['Ekonomi & Koleksi', '💰 Koin, profil, zoo, dan toko'],
            game: ['Mini-Game', '🎲 Permainan koin dan taruhan'],
            musik: ['Pemutar Musik', '🎵 YouTube dan Spotify']
        };
    const customId = adminMode
        ? `help-select:admin:${guildId}:${userId}`
        : `help-select:public:${userId}`;
    return [new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(customId)
            .setPlaceholder(adminMode ? 'Pilih kategori bantuan admin' : 'Pilih kategori bantuan publik')
            .addOptions(Object.entries(labels).map(([value, [label, description]]) => ({
                label,
                value,
                description,
                emoji: description.split(' ')[0],
                default: value === kategoriAktif
            })))
    )];
}

function buatModalVoice(action, roomId) {
    const formConfig = {
        name: { title: 'Ganti nama voice', label: 'Nama channel baru', placeholder: 'Contoh: Ruang Santai', required: true, maxLength: 100 },
        limit: { title: 'Atur batas anggota', label: 'Jumlah anggota (0 = tanpa batas)', placeholder: '0 sampai 99', required: true, maxLength: 2 },
        trust: { title: 'Trust anggota', label: 'ID atau mention anggota', placeholder: '@anggota atau ID Discord', required: true, maxLength: 32 },
        untrust: { title: 'Untrust anggota', label: 'ID atau mention anggota', placeholder: '@anggota atau ID Discord', required: true, maxLength: 32 },
        invite: { title: 'Undang anggota', label: 'ID atau mention anggota', placeholder: '@anggota atau ID Discord', required: true, maxLength: 32 },
        kick: { title: 'Keluarkan anggota', label: 'ID atau mention anggota', placeholder: '@anggota atau ID Discord', required: true, maxLength: 32 },
        block: { title: 'Blokir anggota', label: 'ID atau mention anggota', placeholder: '@anggota atau ID Discord', required: true, maxLength: 32 },
        unblock: { title: 'Buka blokir anggota', label: 'ID atau mention anggota', placeholder: '@anggota atau ID Discord', required: true, maxLength: 32 },
        transfer: { title: 'Transfer kepemilikan', label: 'ID atau mention anggota di room', placeholder: '@anggota atau ID Discord', required: true, maxLength: 32 },
        delete: { title: 'Hapus voice sementara', label: 'Ketik DELETE untuk konfirmasi', placeholder: 'DELETE', required: true, maxLength: 6 },
        reset: { title: 'Reset pengaturan voice', label: 'Ketik RESET untuk menghapus izin khusus', placeholder: 'RESET', required: true, maxLength: 5 }
    };
    const config = formConfig[action];
    if (!config) return null;
    const input = new TextInputBuilder()
        .setCustomId('value')
        .setLabel(config.label)
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(config.placeholder)
        .setRequired(config.required)
        .setMaxLength(config.maxLength);
    return new ModalBuilder()
        .setCustomId(`tempvoice-modal:${action}:${roomId}`)
        .setTitle(config.title)
        .addComponents(new ActionRowBuilder().addComponents(input));
}

function ambilDataPemain(server, userId, guildId) {
    const uangData = economyData.servers[guildId];
    if (!Object.prototype.hasOwnProperty.call(uangData, userId)) {
        uangData[userId] = server.settings.startingBalance;
        simpanUang();
    } else if (!Number.isSafeInteger(uangData[userId]) || uangData[userId] < 0) {
        console.error(`Saldo tidak valid untuk pengguna ${userId} di server ${guildId}; saldo diatur ke 0, bukan saldo awal.`);
        uangData[userId] = 0;
        simpanUang();
    }
    if (!server.users[userId] || typeof server.users[userId] !== 'object') server.users[userId] = {};
    const pemain = server.users[userId];
    if (!pemain.zoo || typeof pemain.zoo !== 'object' || Array.isArray(pemain.zoo)) pemain.zoo = {};
    if (!pemain.inventory || typeof pemain.inventory !== 'object' || Array.isArray(pemain.inventory)) pemain.inventory = {};
    if (!Array.isArray(pemain.history)) pemain.history = [];
    if (!pemain.stats || typeof pemain.stats !== 'object' || Array.isArray(pemain.stats)) pemain.stats = {};
    if (!Number.isSafeInteger(pemain.stats.messages) || pemain.stats.messages < 0) pemain.stats.messages = 0;
    if (!Number.isSafeInteger(pemain.stats.games) || pemain.stats.games < 0) pemain.stats.games = 0;
    if (!Number.isSafeInteger(pemain.stats.hunts) || pemain.stats.hunts < 0) pemain.stats.hunts = 0;
    if (!Number.isSafeInteger(pemain.level) || pemain.level < 0) pemain.level = 0;
    if (!Number.isSafeInteger(pemain.xp) || pemain.xp < 0) pemain.xp = 0;
    return pemain;
}

function simpanRiwayat(pemain, jenis, jumlah, detail = '') {
    pemain.history.push({ at: Date.now(), type: jenis, amount: jumlah, detail });
    if (pemain.history.length > 50) pemain.history.shift();
}

function catatLogMod(guildId, teks, type = null) {
    if (!Array.isArray(adminLogs[guildId])) adminLogs[guildId] = [];
    const match = teks.match(/(kick|timeout|clear|filter|laporan)/i);
    adminLogs[guildId].push({ at: Date.now(), type: type || match?.[1]?.toLowerCase() || 'moderasi', text: teks });
    if (adminLogs[guildId].length > 500) adminLogs[guildId].splice(0, adminLogs[guildId].length - 500);
    simpanAdminLogs();

    const channelId = modLogConfig[guildId];
    if (!channelId) return;
    const channel = client.channels.cache.get(channelId);
    if (!channel || !channel.isTextBased()) return;
    channel.send(teks).catch(error => console.error('Gagal mengirim log moderasi:', error));
}

function parseDurasi(teks) {
    const cocok = /^(\d+)(s|m|h|d)$/i.exec(teks || '');
    if (!cocok) return null;
    const faktor = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[cocok[2].toLowerCase()];
    const milidetik = Number(cocok[1]) * faktor;
    return Number.isSafeInteger(milidetik) && milidetik > 0 ? milidetik : null;
}

function formatTemplate(teks, member) {
    return teks
        .replace(/\{user\}/g, `${member}`)
        .replace(/\{username\}/g, member.user.username)
        .replace(/\{server\}/g, member.guild.name)
        .replace(/\{memberCount\}/g, `${member.guild.memberCount}`);
}

async function buatPesanMember(member, settings, event) {
    const isWelcome = event === 'welcome';
    const template = settings[`${event}Message`] || (isWelcome
        ? 'Selamat datang {user} di **{server}**! Kamu adalah anggota ke-{memberCount}.'
        : '{username} telah meninggalkan **{server}**. Saat ini ada {memberCount} anggota.');
    const image = await buatGambarWelcome(member, event);
    const attachment = new AttachmentBuilder(image, { name: 'member-card.png' });
    const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setDescription(formatTemplate(template, member))
        .setImage('attachment://member-card.png');

    return {
        embeds: [embed],
        files: [attachment],
        allowedMentions: isWelcome
            ? { parse: [], users: [member.id] }
            : { parse: [] }
    };
}

function embedPengumuman(guildName, authorName, isi) {
    return new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle(`📢 Pengumuman — ${guildName}`.slice(0, 256))
        .setDescription(isi.slice(0, 4000))
        .setAuthor({ name: authorName.slice(0, 256) })
        .setTimestamp();
}

function jadwalkanPengumuman(job) {
    const sisa = job.runAt - Date.now();
    if (sisa <= 0) {
        void kirimJadwalPengumuman(job);
        return;
    }
    const timer = setTimeout(() => {
        scheduleTimers.delete(job.id);
        if (job.runAt - Date.now() > 0) jadwalkanPengumuman(job);
        else void kirimJadwalPengumuman(job);
    }, Math.min(sisa, 2147480000));
    scheduleTimers.set(job.id, timer);
}

async function kirimJadwalPengumuman(job) {
    const channel = await client.channels.fetch(job.channelId).catch(error => {
        console.error('Gagal mencari channel jadwal pengumuman:', error);
        return null;
    });
    if (!channel || !channel.isTextBased()) {
        console.error(`Channel jadwal pengumuman ${job.channelId} tidak tersedia.`);
        adminSchedules.jobs = adminSchedules.jobs.filter(item => item.id !== job.id);
        simpanAdminSchedules();
        return;
    }
    try {
        await channel.send({
            embeds: [embedPengumuman(job.guildName, `Dijadwalkan oleh ${job.authorTag}`, job.content)],
            allowedMentions: { parse: [] }
        });
        adminSchedules.jobs = adminSchedules.jobs.filter(item => item.id !== job.id);
        simpanAdminSchedules();
    } catch (error) {
        console.error('Gagal mengirim pengumuman terjadwal:', error);
        job.attempts = (job.attempts || 0) + 1;
        if (job.attempts >= 3) {
            adminSchedules.jobs = adminSchedules.jobs.filter(item => item.id !== job.id);
            simpanAdminSchedules();
            console.error(`Jadwal pengumuman ${job.id} dibatalkan setelah 3 kegagalan.`);
            return;
        }
        job.runAt = Date.now() + 60000;
        simpanAdminSchedules();
        jadwalkanPengumuman(job);
    }
}

function pulihkanJadwalPengumuman() {
    if (!Array.isArray(adminSchedules.jobs)) adminSchedules.jobs = [];
    for (const job of adminSchedules.jobs) jadwalkanPengumuman(job);
}

function parseJumlah(input, saldo) {
    if (typeof input !== 'string') return null;
    if (input.toLowerCase() === 'all') return saldo > 0 ? saldo : null;
    if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)$/.test(input)) return null;
    const jumlah = Number(input.replace(/\./g, ''));
    return Number.isSafeInteger(jumlah) && jumlah > 0 ? jumlah : null;
}

const HEWAN = [
    { nama: 'Kelinci', kelangkaan: 'Common', nilai: 100, bobot: 40 },
    { nama: 'Rubah', kelangkaan: 'Common', nilai: 150, bobot: 30 },
    { nama: 'Rusa', kelangkaan: 'Uncommon', nilai: 300, bobot: 15 },
    { nama: 'Serigala', kelangkaan: 'Rare', nilai: 600, bobot: 8 },
    { nama: 'Panda', kelangkaan: 'Epic', nilai: 1200, bobot: 4 },
    { nama: 'Naga', kelangkaan: 'Legendary', nilai: 3000, bobot: 2 },
    { nama: 'Phoenix', kelangkaan: 'Mythical', nilai: 10000, bobot: 1 }
];

const ITEM_TOKO = {
    umpan: { nama: 'Umpan Hoki', harga: 500, deskripsi: 'Meningkatkan peluang menemukan hewan langka pada perburuan berikutnya.' }
};

function hewanAcak(pakaiUmpan = false) {
    const hewanDenganBobot = HEWAN.map(hewan => ({
        ...hewan,
        bobot: pakaiUmpan && !['Common'].includes(hewan.kelangkaan) ? hewan.bobot * 2 : hewan.bobot
    }));
    let undian = Math.random() * hewanDenganBobot.reduce((total, hewan) => total + hewan.bobot, 0);
    for (const hewan of hewanDenganBobot) {
        undian -= hewan.bobot;
        if (undian < 0) return hewan;
    }
    return HEWAN[0];
}

const transferDashboardPending = new Map();

function buatDashboardEmbed(guildId, member, pemberitahuan = null) {
    const server = ambilDataServer(guildId);
    const pemain = ambilDataPemain(server, member.id, guildId);
    const saldo = economyData.servers[guildId][member.id] || 0;
    const jumlahHewan = Object.values(pemain.zoo).reduce(
        (total, jumlah) => total + (Number.isSafeInteger(jumlah) && jumlah > 0 ? jumlah : 0),
        0
    );
    const xpMaks = xpUntukLevel(pemain.level);
    const progres = Math.min(12, Math.floor((pemain.xp / xpMaks) * 12));
    const persentaseXp = Math.min(100, Math.floor((pemain.xp / xpMaks) * 100));
    const dailySiap = Math.max(0, (pemain.lastDaily || 0) + COOLDOWN_HARIAN - Date.now());
    const dailyStatus = dailySiap === 0
        ? `🟢 Siap diklaim • hadiah **${formatUang(server.settings.dailyReward)} koin**`
        : `Tersedia <t:${Math.ceil((Date.now() + dailySiap) / 1000)}:R>`;
    return new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setAuthor({ name: `LITTLE NOOK  •  ${member.displayName}` })
        .setThumbnail(member.user.displayAvatarURL({ size: 512 }))
        .setDescription(`${pemberitahuan ? `${pemberitahuan}\n\n` : ''}Selamat datang di pusat akunmu. Pilih aksi cepat atau jelajahi halaman melalui menu.`)
        .addFields(
            { name: '💰  DOMPET', value: `**${tampilkanSaldo(member.id, saldo)}**`, inline: true },
            { name: '🎁  HADIAH HARIAN', value: dailyStatus, inline: true },
            { name: '🦒  KOLEKSI ZOO', value: `**${jumlahHewan}** hewan`, inline: true },
            { name: `⭐  LEVEL ${pemain.level}`, value: `${'🟦'.repeat(progres)}${'⬛'.repeat(12 - progres)}  **${persentaseXp}%**\n${formatUang(pemain.xp)} / ${formatUang(xpMaks)} EXP ke level berikutnya` },
            { name: '📈  AKTIVITAS', value: `🔥 Streak **${pemain.dailyStreak || 0} hari**　•　🏹 Hunt **${pemain.stats.hunts || 0}**　•　🎮 Game **${pemain.stats.games || 0}**` }
        )
        .setFooter({ text: 'PANEL PERSONAL  •  Kontrol hanya dapat digunakan olehmu' })
        .setTimestamp();
}

function buatKontrolDashboard(userId, halaman = 'dashboard') {
    const aksi = [
        ['daily', 'Klaim Daily', ButtonStyle.Success],
        ['hunt', 'Berburu', ButtonStyle.Primary],
        ['zoo', 'Lihat Zoo', ButtonStyle.Secondary]
    ];
    const barisAksi = new ActionRowBuilder().addComponents(
        ...aksi.map(([id, label, style]) =>
            new ButtonBuilder()
                .setCustomId(`dashboard:${userId}:${id}`)
                .setLabel(label)
                .setEmoji(id === 'daily' ? '🎁' : id === 'hunt' ? '🏹' : '🦒')
                .setStyle(style)
        )
    );
    const menuAksi = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`dashboard-action:${userId}`)
            .setPlaceholder('Aksi lainnya • transfer, jual hewan, toko...')
            .addOptions(
                { label: 'Transfer koin', value: 'transfer', description: 'Kirim koin ke anggota lain', emoji: '💸' },
                { label: 'Jual semua hewan', value: 'sell', description: 'Tukar seluruh koleksi menjadi koin', emoji: '🪙' },
                { label: 'Buka toko', value: 'shop', description: 'Lihat item yang tersedia', emoji: '🛒' },
                { label: 'Gunakan umpan', value: 'bait', description: 'Siapkan umpan untuk perburuan', emoji: '🪤' },
                { label: 'Segarkan ringkasan', value: 'refresh', description: 'Perbarui saldo dan progres akun', emoji: '🔄' }
            )
    );
    const menuHalaman = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`dashboard-page:${userId}`)
            .setPlaceholder('Buka halaman dashboard')
            .addOptions(
                { label: 'Ringkasan', value: 'dashboard', emoji: '🏠', default: halaman === 'dashboard' },
                { label: 'Koleksi Zoo', value: 'zoo', emoji: '🦒', default: halaman === 'zoo' },
                { label: 'Inventory', value: 'inventory', emoji: '🎒', default: halaman === 'inventory' },
                { label: 'Riwayat', value: 'history', emoji: '📜', default: halaman === 'history' },
                { label: 'Main Game', value: 'games', emoji: '🎮', default: halaman === 'games' }
            )
    );
    return [menuHalaman, barisAksi, menuAksi];
}

function buatModalJumlahTransfer(guildId, ownerId, targetId) {
    const nominal = new TextInputBuilder()
        .setCustomId('amount')
        .setLabel('Jumlah koin (contoh 1.000 atau all)')
        .setPlaceholder('1.000')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(20);
    return new ModalBuilder()
        .setCustomId(`dashboard-transfer-modal:${guildId}:${ownerId}:${targetId}`)
        .setTitle('Transfer Koin')
        .addComponents(new ActionRowBuilder().addComponents(nominal));
}

function klaimDaily(server, pemain, uangData, userId) {
    const sekarang = Date.now();
    const sisaCooldown = COOLDOWN_HARIAN - (sekarang - (pemain.lastDaily || 0));
    if (sisaCooldown > 0) return { ok: false, sisaCooldown };

    const jedaDaily = sekarang - (pemain.lastDaily || 0);
    pemain.dailyStreak = jedaDaily > 0 && jedaDaily <= COOLDOWN_HARIAN * 2
        ? Math.min((pemain.dailyStreak || 0) + 1, 7)
        : 1;
    const hadiah = server.settings.dailyReward + (pemain.dailyStreak - 1) * 100;
    tambahSaldo(uangData, userId, hadiah);
    pemain.lastDaily = sekarang;
    simpanRiwayat(pemain, 'daily', hadiah, `streak ${pemain.dailyStreak}`);
    simpanUang();
    simpanOwoState();
    return { ok: true, hadiah, streak: pemain.dailyStreak, saldo: uangData[userId] };
}

function berburu(server, pemain, guildId, userId) {
    const cooldown = 60 * 1000;
    const sisaCooldown = cooldown - (Date.now() - (pemain.lastHunt || 0));
    if (sisaCooldown > 0) return { ok: false, sisaCooldown };
    const pakaiUmpan = Boolean(pemain.huntBoost);
    const hewan = hewanAcak(pakaiUmpan);
    pemain.huntBoost = false;
    pemain.lastHunt = Date.now();
    pemain.zoo[hewan.nama] = (pemain.zoo[hewan.nama] || 0) + 1;
    pemain.stats.hunts = (pemain.stats.hunts || 0) + 1;
    simpanRiwayat(pemain, 'hunt', null, `${hewan.kelangkaan}: ${hewan.nama}`);
    simpanOwoState();
    return { ok: true, hewan, pakaiUmpan, cooldown };
}

function ringkasanZoo(pemain) {
    let totalKoin = 0;
    let totalHewan = 0;
    const hewanValid = [];
    for (const [nama, jumlah] of Object.entries(pemain.zoo)) {
        const hewan = HEWAN.find(item => item.nama === nama);
        if (!hewan || !Number.isSafeInteger(jumlah) || jumlah <= 0) continue;
        const nilai = hewan.nilai * jumlah;
        if (!Number.isSafeInteger(nilai) || !Number.isSafeInteger(totalKoin + nilai) ||
            !Number.isSafeInteger(totalHewan + jumlah)) {
            return { ok: false, reason: 'overflow' };
        }
        totalKoin += nilai;
        totalHewan += jumlah;
        hewanValid.push(nama);
    }
    if (!totalHewan) return { ok: false, reason: 'empty' };
    return { ok: true, totalKoin, totalHewan, hewanValid };
}

function jualZoo(pemain, uangData, userId) {
    const ringkasan = ringkasanZoo(pemain);
    if (!ringkasan.ok) return ringkasan;
    if (!saldoTidakTerbatas(userId) && !Number.isSafeInteger(uangData[userId] + ringkasan.totalKoin)) {
        return { ok: false, reason: 'saldo_limit' };
    }
    for (const nama of ringkasan.hewanValid) delete pemain.zoo[nama];
    tambahSaldo(uangData, userId, ringkasan.totalKoin);
    simpanRiwayat(pemain, 'jual hewan', ringkasan.totalKoin, `${ringkasan.totalHewan} hewan`);
    simpanUang();
    simpanOwoState();
    return { ok: true, hasilJual: ringkasan.totalKoin, hewanTerjual: ringkasan.totalHewan };
}

function mulaiCooldownGame(pemain, game, cooldownMs) {
    if (!pemain.gameCooldowns || typeof pemain.gameCooldowns !== 'object' || Array.isArray(pemain.gameCooldowns)) {
        pemain.gameCooldowns = {};
    }
    const now = Date.now();
    const sisa = cooldownMs - (now - (pemain.gameCooldowns[game] || 0));
    if (sisa > 0) return sisa;
    pemain.gameCooldowns[game] = now;
    simpanOwoState();
    return 0;
}

function teksCooldownMiniGame(userId, sisaCooldown) {
    const bisaMainLagi = Math.ceil((Date.now() + sisaCooldown) / 1000);
    return `| <@${userId}> Slow down and try the command again <t:${bisaMainLagi}:R>.`;
}

function tombolMainLagi(userId, game, taruhan, pilihan = 'none') {
    return [new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`replay:${game}:${userId}:${taruhan}:${pilihan}`)
            .setLabel(game === 'hunt' ? 'Berburu Lagi' : game === 'slot' ? 'Putar Lagi' : game === 'cf' ? 'Lempar Lagi' : 'Main Lagi')
            .setEmoji(game === 'hunt' ? '🏹' : game === 'slot' ? '🎰' : game === 'cf' ? '🪙' : '🎲')
            .setStyle(ButtonStyle.Primary)
    )];
}

function teksHasilCoinflip(userId, taruhan, menang) {
    const hadiah = menang ? taruhan * 2 : 0;
    const hasil = menang
        ? `and you won 💵 **${formatUang(hadiah)}!!**`
        : `and you lost 💵 **${formatUang(taruhan)}!!**`;
    return `**<@${userId}>** spent 💵 **${formatUang(taruhan)}** on coinflip.\nThe coin spins... 🪙 ${hasil}`;
}

function acakSimbolSlot() {
    return Array.from({ length: 3 }, () => SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)]);
}

function hitungHadiahSlot(simbol, taruhan) {
    const jumlahCocok = simbol.filter(item => item === simbol[0]).length;
    if (jumlahCocok === 3) return taruhan * 5;
    if (jumlahCocok === 2 || new Set(simbol).size === 2) return Math.floor(taruhan * 1.5);
    return 0;
}

function teksSlot(simbol, taruhan, status) {
    const mesin = `┌─────┬─────┬─────┐\n│  L  │  T  │  N  │\n├─────┼─────┼─────┤\n│ ${simbol.join(' │ ')} │\n└─────┴─────┴─────┘`;
    return `💰 **L T N SLOTS** 💰\nTaruhan: **${formatUang(taruhan)} koin**\n\`\`\`\n${mesin}\n\`\`\`${status ? `\n${status}` : ''}`;
}

async function animasikanSlot(perbaruiPesan, taruhan, hasil) {
    const gulungan = acakSimbolSlot();
    const berhentiPada = [0, 1, 2];
    for (let bingkai = 0; bingkai <= berhentiPada[2]; bingkai++) {
        await jeda(180);
        for (let kolom = 0; kolom < gulungan.length; kolom++) {
            if (bingkai === berhentiPada[kolom]) gulungan[kolom] = hasil[kolom];
            else if (bingkai < berhentiPada[kolom]) gulungan[kolom] = acakSimbolSlot()[0];
        }
        await perbaruiPesan(teksSlot(gulungan, taruhan, '⬇️ Gulungan berputar...'));
    }
}

function buatTampilanMines({ taruhan, jumlahBom, jumlahBerlian, status, aman, bom, pilihan }) {
    const pengali = pengaliMines(jumlahBom, jumlahBerlian);
    const cashOut = Math.floor(taruhan * pengali);
    const formatPengali = (nilai, multiplier) => `${formatUang(nilai)} (${multiplier.toFixed(2)}x)`;
    const nextPengali = jumlahBerlian < 9 - jumlahBom ? pengaliMines(jumlahBom, jumlahBerlian + 1) : null;
    const nextCashOut = nextPengali === null
        ? '—'
        : formatPengali(Math.floor(taruhan * nextPengali), nextPengali);
    const kalah = status === 'loss';
    const cashOutText = kalah ? '~~0 (0.00x)~~' : formatPengali(cashOut, pengali);
    const nextText = kalah ? `~~${nextCashOut}~~` : nextCashOut;
    const image = buatGambarMines({
        betText: formatUang(taruhan),
        minesText: String(jumlahBom),
        cashOutText: cashOutText.replaceAll('~~', ''),
        nextCashOutText: nextText.replaceAll('~~', ''),
        status
    });
    const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setImage('attachment://mines-card.png');
    return {
        embeds: [embed],
        files: [new AttachmentBuilder(image, { name: 'mines-card.png' })],
        attachments: []
    };
}

function buatKomponenMines({ taruhan, jumlahBom, aman, bom, pilihan, selesai, processing }) {
    const rows = [];
    for (let awal = 0; awal < 9; awal += 3) {
        rows.push(new ActionRowBuilder().addComponents(
            ...Array.from({ length: 3 }, (_, offset) => {
                const nomor = awal + offset;
                const status = pilihan.get(nomor);
                const terungkap = selesai;
                const kenaBom = status === 'mine';
                const amanTerpilih = aman.has(nomor);
                const emoji = status === 'rolling'
                    ? '🔄'
                    : kenaBom
                        ? '💥'
                        : (terungkap && bom.has(nomor))
                            ? '💣'
                            : (amanTerpilih || (terungkap && !bom.has(nomor)))
                                ? '💎'
                                : '🔹';
                const button = new ButtonBuilder()
                    .setCustomId(`mines-cell-${nomor}`)
                    .setEmoji(emoji)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(selesai || processing || status === 'rolling' || amanTerpilih);
                return button;
            })
        ));
    }
    rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('mines-cashout')
            .setLabel('Cash Out')
            .setEmoji('💵')
            .setStyle(ButtonStyle.Success)
            .setDisabled(selesai || processing)
    ));
    return rows;
}

function buatZooEmbed(member, pemain) {
    const koleksi = Object.entries(pemain.zoo).filter(([, jumlah]) => Number.isSafeInteger(jumlah) && jumlah > 0);
    const totalHewan = koleksi.reduce((sum, [, jumlah]) => sum + jumlah, 0);
    const nilaiZoo = koleksi.reduce((sum, [nama, jumlah]) => {
        const hewan = HEWAN.find(item => item.nama === nama);
        return sum + (hewan ? hewan.nilai * jumlah : 0);
    }, 0);
    const deskripsi = koleksi.length
        ? koleksi.map(([nama, jumlah]) => {
            const hewan = HEWAN.find(item => item.nama === nama);
            return `• **${nama}** ×${formatUang(jumlah)}${hewan ? ` — ${hewan.kelangkaan} • ${formatUang(hewan.nilai)} koin/ekor` : ''}`;
        }).join('\n')
        : 'Zoo kamu masih kosong.\n\nGunakan **Berburu** untuk mulai mengumpulkan hewan.';
    return new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setAuthor({ name: `KOLEKSI PEMAIN  •  ${member.displayName}` })
        .setTitle('🦒 Zoo')
        .addFields(
            { name: 'Jumlah hewan', value: `**${formatUang(totalHewan)}**`, inline: true },
            { name: 'Estimasi nilai jual', value: `**${formatUang(nilaiZoo)} koin**`, inline: true }
        )
        .setDescription(deskripsi)
        .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
        .setFooter({ text: 'Hewan dapat dijual seluruhnya melalui Aksi lainnya → Jual semua hewan' })
        .setTimestamp();
}

function pengaliMines(jumlahBom, jumlahBerlian) {
    if (jumlahBerlian === 0) return 1;
    let peluangBertahan = 1;
    for (let pilihan = 0; pilihan < jumlahBerlian; pilihan++) {
        peluangBertahan *= (9 - jumlahBom - pilihan) / (9 - pilihan);
    }
    return 0.95 / peluangBertahan;
}

function buatMenuGame(userId) {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`dashboard-game:${userId}`)
            .setPlaceholder('Pilih permainan')
            .addOptions(
                { label: 'Coinflip', value: 'cf', description: 'Lempar koin otomatis dengan taruhan', emoji: '🪙' },
                { label: 'Slot', value: 'slot', description: 'Cocokkan simbol hewan, LTN, dan uang', emoji: '🎰' },
                { label: 'Adu Angka', value: 'gamble', description: 'Adu angka dadu 0–100', emoji: '🎲' },
                { label: 'Mines', value: 'mines', description: 'Cari berlian dan amankan cash out', emoji: '💎' }
            )
    );
}

function buatModalTaruhan(userId, guildId, game) {
    const judul = { cf: 'Coinflip', slot: 'Slot', gamble: 'Adu Angka', mines: 'Mines' }[game];
    if (!judul) return null;
    const modal = new ModalBuilder()
        .setCustomId(`dashboard-game-modal:${guildId}:${userId}:${game}`)
        .setTitle(`Mulai ${judul}`);
    const taruhan = new TextInputBuilder()
        .setCustomId('bet')
        .setLabel('Taruhan (angka, titik ribuan, atau all)')
        .setPlaceholder('1.000')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(20);
    modal.addComponents(new ActionRowBuilder().addComponents(taruhan));
    if (game === 'mines') {
        modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('bombs').setLabel('Jumlah bom (1 sampai 8)').setPlaceholder('3').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(1)
        ));
    }
    return modal;
}

async function jalankanGameUI(interaction, { game, userId, taruhan, jumlahBom = 3 }) {
    const guild = interaction.guild;
    if (!guild || interaction.user.id !== userId) {
        await interaction.reply({ content: 'Permainan ini hanya dapat dijalankan oleh pemilik dashboard.', ephemeral: true });
        return;
    }
    const server = ambilDataServer(guild.id);
    const pemain = ambilDataPemain(server, userId, guild.id);
    const uangData = economyData.servers[guild.id];
    if (!Number.isSafeInteger(taruhan) || taruhan < 1 || !cukupSaldo(uangData, userId, taruhan)) {
        await interaction.reply({ content: 'Taruhan tidak valid atau saldo koin kamu tidak cukup.', ephemeral: true });
        return;
    }
    if (game === 'mines' && (!Number.isInteger(jumlahBom) || jumlahBom < 1 || jumlahBom > 8)) {
        await interaction.reply({ content: 'Jumlah bom harus 1 sampai 8.', ephemeral: true });
        return;
    }
    if (!['cf', 'slot', 'gamble', 'mines'].includes(game)) {
        await interaction.reply({ content: 'Jenis permainan tidak dikenal.', ephemeral: true });
        return;
    }
    if ((game === 'slot' && (!Number.isSafeInteger(taruhan * 5) || (!saldoTidakTerbatas(userId) && !Number.isSafeInteger(uangData[userId] - taruhan + taruhan * 5)))) ||
        (game === 'mines' && !Number.isSafeInteger(taruhan * MINES_MAX_PAYOUT_MULTIPLIER)) ||
        (game !== 'slot' && game !== 'mines' && !saldoTidakTerbatas(userId) && !Number.isSafeInteger(uangData[userId] + taruhan))) {
        await interaction.reply({ content: 'Taruhan terlalu besar untuk diproses dengan aman.', ephemeral: true });
        return;
    }
    const sisaCooldown = mulaiCooldownGame(pemain, game, COOLDOWN_MINI_GAME);
    if (sisaCooldown > 0) {
        await interaction.reply({ content: teksCooldownMiniGame(userId, sisaCooldown), ephemeral: true });
        return;
    }

    kurangiSaldo(uangData, userId, taruhan);
    if (game === 'mines') {
        pemain.stats.games = (pemain.stats.games || 0) + 1;
        simpanRiwayat(pemain, 'mines mulai', -taruhan, `${jumlahBom} bom`);
    }
    simpanUang();
    simpanOwoState();
    let settled = false;
    try {
        if (interaction.isButton()) await interaction.deferUpdate();
        else await interaction.deferReply({ ephemeral: true });

        if (game === 'mines') {
            const aman = new Set();
            const pilihanKotak = new Map();
            const bom = new Set();
            while (bom.size < jumlahBom) bom.add(Math.floor(Math.random() * 9));
            let selesai = false;
            let processing = false;
            const hitungCashOut = () => Math.floor(taruhan * pengaliMines(jumlahBom, aman.size));
            const buatGrid = () => buatKomponenMines({
                taruhan, jumlahBom, aman, bom, pilihan: pilihanKotak, selesai, processing
            });
            const buatKartu = status => buatTampilanMines({
                taruhan, jumlahBom, jumlahBerlian: aman.size, status, aman, bom, pilihan: pilihanKotak
            });
            const gameMessage = await interaction.editReply({
                content: '',
                ...buatKartu('playing'),
                components: buatGrid()
            });
            const collector = gameMessage.createMessageComponentCollector({
                time: 120000,
                filter: component => component.customId.startsWith('mines-')
            });
            collector.on('collect', async component => {
                try {
                    if (component.user.id !== userId) {
                        await component.reply({ content: 'Permainan ini bukan milikmu.', ephemeral: true });
                        return;
                    }
                    if (selesai || processing) {
                        await component.reply({ content: selesai ? 'Permainan ini sudah selesai.' : 'Tunggu sampai pilihan sebelumnya selesai.', ephemeral: true });
                        return;
                    }
                    if (component.customId === 'mines-cashout') {
                        const hadiah = hitungCashOut();
                        tambahSaldo(uangData, userId, hadiah);
                        simpanRiwayat(pemain, 'mines cash out', hadiah - taruhan, `${aman.size} berlian, ${jumlahBom} bom`);
                        simpanUang();
                        simpanOwoState();
                        settled = true;
                        selesai = true;
                        collector.stop('selesai');
                        await component.update({
                            content: '',
                            ...buatKartu('cashout'),
                            components: [...buatGrid(), ...tombolMainLagi(userId, 'mines', taruhan, String(jumlahBom))]
                        });
                        return;
                    }
                    const nomor = Number(component.customId.slice('mines-cell-'.length));
                    if (!Number.isInteger(nomor) || nomor < 0 || nomor > 8 || aman.has(nomor)) {
                        await component.reply({ content: 'Kotak tidak valid atau sudah dipilih.', ephemeral: true });
                        return;
                    }
                    processing = true;
                    collector.resetTimer();
                    pilihanKotak.set(nomor, 'rolling');
                    await component.update({
                        content: '',
                        ...buatKartu('rolling'),
                        components: buatGrid()
                    });
                    await jeda(700);
                    if (bom.has(nomor)) {
                        pilihanKotak.set(nomor, 'mine');
                        selesai = true;
                        simpanRiwayat(pemain, 'mines kalah', -taruhan, `${aman.size} berlian, ${jumlahBom} bom`);
                        simpanUang();
                        simpanOwoState();
                        settled = true;
                        collector.stop('selesai');
                        await component.editReply({
                            content: '',
                            ...buatKartu('loss'),
                            components: [...buatGrid(), ...tombolMainLagi(userId, 'mines', taruhan, String(jumlahBom))]
                        });
                        return;
                    }
                    aman.add(nomor);
                    pilihanKotak.set(nomor, 'diamond');
                    if (aman.size === 9 - jumlahBom) {
                        const hadiah = hitungCashOut();
                        tambahSaldo(uangData, userId, hadiah);
                        simpanRiwayat(pemain, 'mines jackpot', hadiah - taruhan, `${aman.size} berlian, ${jumlahBom} bom`);
                        simpanUang();
                        simpanOwoState();
                        settled = true;
                        selesai = true;
                        collector.stop('selesai');
                        await component.editReply({
                            content: '',
                            ...buatKartu('win'),
                            components: [...buatGrid(), ...tombolMainLagi(userId, 'mines', taruhan, String(jumlahBom))]
                        });
                        return;
                    }
                    processing = false;
                    await component.editReply({
                        content: '',
                        ...buatKartu('playing'),
                        components: buatGrid()
                    });
                } catch (error) {
                    console.error('Gagal memproses interaksi Mines dashboard:', error);
                    processing = false;
                    if (!component.replied && !component.deferred) {
                        await component.reply({ content: 'Aksi Mines gagal diproses. Coba kembali.', ephemeral: true }).catch(replyError => console.error('Gagal membalas interaksi Mines:', replyError));
                    }
                }
            });
            collector.on('end', async (_, reason) => {
                if (reason !== 'time' || selesai) return;
                const hadiah = hitungCashOut();
                tambahSaldo(uangData, userId, hadiah);
                simpanRiwayat(pemain, 'mines cash out otomatis', hadiah - taruhan, `${aman.size} berlian, ${jumlahBom} bom`);
                simpanUang();
                simpanOwoState();
                settled = true;
                selesai = true;
                try {
                    await gameMessage.edit({
                        content: '',
                        ...buatKartu('timeout'),
                        components: [...buatGrid(), ...tombolMainLagi(userId, 'mines', taruhan, String(jumlahBom))]
                    });
                } catch (error) {
                    console.error('Gagal menyelesaikan Mines setelah timeout:', error);
                }
            });
            return;
        }

        let perubahanSaldo = 0;
        let hasilDetail = '';
        let narasi = '';
        if (game === 'cf') {
            await interaction.editReply({ content: 'The coin spins... 🪙' });
            for (const bingkai of ['⚪', '🟡', '⚪']) {
                await jeda(400);
                await interaction.editReply({ content: `The coin spins... ${bingkai}` });
            }
            hasilDetail = Math.random() < 0.5 ? 'light' : 'dark';
            const menang = hasilDetail === 'light';
            const hadiah = menang ? taruhan * 2 : 0;
            perubahanSaldo = hadiah - taruhan;
            tambahSaldo(uangData, userId, hadiah);
            hasilDetail = menang ? 'menang' : 'kalah';
            narasi = menang ? `Menang ${formatUang(hadiah)} koin` : `Kalah ${formatUang(taruhan)} koin`;
        } else if (game === 'slot') {
            const hasil = acakSimbolSlot();
            await interaction.editReply({
                content: teksSlot(acakSimbolSlot(), taruhan, '⬇️ Gulungan berputar...')
            });
            await animasikanSlot(content => interaction.editReply({ content }), taruhan, hasil);
            const hadiah = hitungHadiahSlot(hasil, taruhan);
            perubahanSaldo = hadiah - taruhan;
            tambahSaldo(uangData, userId, hadiah);
            hasilDetail = hasil.join(' ');
            narasi = hadiah > taruhan ? `🎉 Jackpot! Hadiah **${formatUang(hadiah)} koin**.` : hadiah > 0 ? `✨ Menang **${formatUang(hadiah)} koin**.` : `💀 Zonk! Taruhan **${formatUang(taruhan)} koin** hilang.`;
        } else {
            let angkaPemain = 0;
            let angkaBot = 0;
            for (let putaran = 0; putaran < 5; putaran++) {
                angkaPemain = Math.floor(Math.random() * 101);
                angkaBot = Math.floor(Math.random() * 101);
                await jeda(350);
                await interaction.editReply({ content: `🎲 **ADU ANGKA** — taruhan **${formatUang(taruhan)} koin**\nKamu: **${angkaPemain}** | Lawan: **${angkaBot}**` });
            }
            const menang = angkaPemain > angkaBot;
            const seri = angkaPemain === angkaBot;
            perubahanSaldo = seri ? 0 : menang ? taruhan : -taruhan;
            if (menang || seri) tambahSaldo(uangData, userId, taruhan);
            hasilDetail = `${angkaPemain} vs ${angkaBot}`;
            narasi = seri ? '🤝 Seri! Taruhan dikembalikan.' : menang ? `🎉 Kamu menang **${formatUang(taruhan)} koin**!` : `💀 Kamu kalah **${formatUang(taruhan)} koin**.`;
        }
        pemain.stats.games = (pemain.stats.games || 0) + 1;
        simpanRiwayat(pemain, game === 'cf' ? 'coinflip' : game, perubahanSaldo, hasilDetail);
        simpanUang();
        simpanOwoState();
        settled = true;
        const hasil = game === 'slot'
            ? teksSlot(hasilDetail.split(' '), taruhan, narasi)
            : `🎲 **${hasilDetail}**\n${narasi}`;
        await interaction.editReply({
            content: game === 'cf'
                ? teksHasilCoinflip(userId, taruhan, perubahanSaldo > 0)
                : `${hasil}\n💰 Saldo: **${tampilkanSaldo(userId, uangData[userId])}**.`,
            embeds: [],
            components: game === 'cf' ? [] : tombolMainLagi(userId, game, taruhan)
        });
    } catch (error) {
        if (!settled) {
            tambahSaldo(uangData, userId, taruhan);
            pemain.gameCooldowns[game] = 0;
            simpanUang();
            simpanOwoState();
        }
        console.error(`Gagal menjalankan game UI ${game}:`, error);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({
                content: settled ? 'Hasil sudah disimpan, tetapi pesan gagal diperbarui.' : 'Permainan gagal diproses; taruhan telah dikembalikan.',
                components: []
            }).catch(replyError => console.error('Gagal memberi status game UI:', replyError));
        } else {
            await interaction.reply({ content: 'Permainan gagal diproses.', ephemeral: true }).catch(replyError => console.error('Gagal membalas game UI:', replyError));
        }
    }
}

if (!fs.existsSync(PATH_FILTER)) fs.writeFileSync(PATH_FILTER, JSON.stringify({ globalWords: [] }));
let filterData = JSON.parse(fs.readFileSync(PATH_FILTER, 'utf8'));
if (Array.isArray(filterData)) {
    if (filterData.some(kata => typeof kata !== 'string')) throw new Error('Isi bad_words.json harus berupa array teks.');
    filterData = { globalWords: filterData };
    fs.writeFileSync(PATH_FILTER, JSON.stringify(filterData, null, 2));
}
if (!filterData || typeof filterData !== 'object' || Array.isArray(filterData)) {
    throw new Error('Isi bad_words.json harus berupa array kata lama atau objek globalWords.');
}
if (!Array.isArray(filterData.globalWords) || filterData.globalWords.some(kata => typeof kata !== 'string')) {
    throw new Error('Properti globalWords di bad_words.json harus berupa array teks.');
}

function normalisasiTeks(teks) {
    return teks
        .normalize('NFKC')
        .toLocaleLowerCase('id-ID')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
}

function pesanMengandungPemicu(pesan, pemicu) {
    const pesanNormal = normalisasiTeks(pesan);
    const pemicuNormal = normalisasiTeks(pemicu);
    return Boolean(pemicuNormal) && ` ${pesanNormal} `.includes(` ${pemicuNormal} `);
}

function ambilPengaturanAutoRespons(server) {
    if (!Array.isArray(server.settings.autoResponses)) server.settings.autoResponses = [];
    server.settings.autoResponsesEnabled = server.settings.autoResponsesEnabled !== false;
    return server.settings.autoResponses;
}

function amanUntukTeksDiscord(teks) {
    return teks.replace(/`/g, 'ˋ').replace(/@/g, '@\u200b');
}

function simpanKataFilter() {
    simpanOwoState();
}

function xpUntukLevel(level) {
    return 100 + level * 50;
}

async function daftarkanSlashCommandServer(guild) {
    try {
        await guild.commands.set(SLASH_COMMANDS);
        console.log(`✅ Slash command disinkronkan di server ${guild.id}.`);
        return true;
    } catch (error) {
        console.error(`Gagal mendaftarkan slash command di server ${guild.id}:`, error);
        return false;
    }
}

async function berikanXP(message, pemain) {
    if (message.content.trim().length < 4) return;
    const sekarang = Date.now();
    if (sekarang - (pemain.lastXpAt || 0) < 60000) return;
    pemain.lastXpAt = sekarang;
    pemain.stats.messages = (pemain.stats.messages || 0) + 1;
    pemain.xp = (pemain.xp || 0) + 10 + Math.floor(Math.random() * 11);

    let naikLevel = false;
    while (pemain.xp >= xpUntukLevel(pemain.level)) {
        pemain.xp -= xpUntukLevel(pemain.level);
        pemain.level++;
        naikLevel = true;
    }
    simpanOwoState();

    if (!naikLevel) return;
    const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle('🎉 Level naik!')
        .setDescription(`${message.author} mencapai **Level ${pemain.level}**!`)
        .setThumbnail(message.author.displayAvatarURL({ size: 256 }))
        .setFooter({ text: `XP menuju level berikutnya: ${pemain.xp}/${xpUntukLevel(pemain.level)}` })
        .setTimestamp();
    try {
        await message.channel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Gagal mengirim pengumuman level:', error);
    }
}

client.on('clientReady', async () => {
    console.log(`✅ Bot ${client.user.tag} berhasil online!`);
    client.user.setActivity('Anggota Server', { type: ActivityType.Watching });
    pulihkanJadwalPengumuman();
    try {
        await client.application.commands.set([]);
    } catch (error) {
        console.error('Gagal menghapus slash command global lama:', error);
    }

    const hasilSinkronisasi = await Promise.all(
        [...client.guilds.cache.values()].map(daftarkanSlashCommandServer)
    );
    console.log(`✅ ${SLASH_COMMANDS.length} slash command disinkronkan di ${hasilSinkronisasi.filter(Boolean).length}/${hasilSinkronisasi.length} server.`);
});

client.on('guildCreate', daftarkanSlashCommandServer);

async function prosesPesan(message) {
    if (message.author.bot) return;

    const prefixMatch = message.content.match(/^ltn\s+/i);
    const isCommand = Boolean(prefixMatch);
    const args = isCommand ? message.content.slice(prefixMatch[0].length).trim().split(/ +/) : [];
    const commandInput = isCommand ? args.shift().toLowerCase() : '';
    let command = ALIAS_GAME[commandInput] || commandInput;
    if (['join', 'leave'].includes(command) && args[0]?.toLowerCase() === 'vc') {
        command = `${command} ${args.shift().toLowerCase()}`;
    }
    const guildId = message.guild?.id;
    const serverData = guildId ? ambilDataServer(guildId) : null;

    if (command === 'modlog') {
        if (!serverData || !message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return message.reply('❌ Perintah ini hanya untuk admin server dengan izin **Manage Server**.');
        }
        if (args[0]?.toLowerCase() === 'off') {
            delete modLogConfig[guildId];
            fs.writeFileSync(PATH_MOD_LOG, JSON.stringify(modLogConfig, null, 2));
            return message.reply('✅ Log moderasi dinonaktifkan.');
        }
        const channel = message.mentions.channels.first();
        if (!channel || !channel.isTextBased()) return message.reply('⚠️ Gunakan `ltn modlog set #channel` atau `ltn modlog off`.');
        modLogConfig[guildId] = channel.id;
        fs.writeFileSync(PATH_MOD_LOG, JSON.stringify(modLogConfig, null, 2));
        return message.reply(`✅ Log moderasi akan dikirim ke ${channel}.`);
    }

    if (command === 'announce' || command === 'pengumuman') {
        if (!serverData || !message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return message.reply('❌ Perintah ini hanya untuk admin server dengan izin **Manage Server**.');
        }

        const channel = message.mentions.channels.first();
        if (!channel || !channel.isTextBased() || !channel.send) {
            return message.reply('⚠️ Tentukan channel teks. Contoh: `ltn announce #pengumuman Pesan` atau `ltn announce jadwal #pengumuman 2h Pesan`.');
        }

        const jadwal = args[0]?.toLowerCase() === 'jadwal';
        const rawText = message.content.slice(PREFIX.length + command.length).trim();
        const channelMatch = rawText.match(/^jadwal\s+<#[0-9]{17,20}>\s+/i);
        const jedaJadwal = jadwal ? parseDurasi(args[2]) : null;
        if (jadwal && (!channelMatch || !jedaJadwal || jedaJadwal > 7 * 86400000)) {
            return message.reply('⚠️ Format jadwal: `ltn announce jadwal #channel <durasi> <pesan>`; durasi contoh `30m`, `2h`, maksimal 7 hari.');
        }
        const isiPengumuman = jadwal
            ? rawText.replace(/^jadwal\s+<#[0-9]{17,20}>\s+\S+\s*/i, '').trim()
            : rawText.replace(/^<#[0-9]{17,20}>\s*/, '').trim();
        if (!isiPengumuman) return message.reply('⚠️ Tulis isi pengumuman setelah mention channel.');
        if (isiPengumuman.length > 4000) return message.reply('⚠️ Isi pengumuman maksimal 4.000 karakter.');

        if (jadwal) {
            if (!Array.isArray(adminSchedules.jobs)) adminSchedules.jobs = [];
            const job = {
                id: `${Date.now()}-${message.id}`,
                guildId,
                guildName: message.guild.name,
                channelId: channel.id,
                authorTag: message.author.tag,
                content: isiPengumuman,
                runAt: Date.now() + jedaJadwal
            };
            adminSchedules.jobs.push(job);
            simpanAdminSchedules();
            jadwalkanPengumuman(job);
            return message.reply(`✅ Pengumuman dijadwalkan untuk <t:${Math.floor(job.runAt / 1000)}:F> di ${channel}.`);
        }

        try {
            await channel.send({
                embeds: [embedPengumuman(message.guild.name, `Diumumkan oleh ${message.author.tag}`, isiPengumuman)],
                allowedMentions: { parse: [] }
            });
            return message.reply(`✅ Pengumuman berhasil dikirim ke ${channel}. Ping massal dinonaktifkan.`);
        } catch (error) {
            console.error('Gagal mengirim pengumuman admin:', error);
            return message.reply('❌ Pengumuman gagal dikirim. Pastikan bot memiliki izin **View Channel** dan **Send Messages** di channel tujuan.');
        }
    }

    if (['welcome', 'goodbye', 'autorole'].includes(command)) {
        if (!serverData || !message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return message.reply('❌ Perintah ini hanya untuk admin server dengan izin **Manage Server**.');
        }
        const aksi = args.shift()?.toLowerCase();
        const targetSetting = command === 'welcome' ? 'welcome' : command === 'goodbye' ? 'goodbye' : 'autorole';
        const mentionChannel = message.mentions.channels.first();
        const mentionRole = message.mentions.roles.first();
        if (aksi === 'off') {
            delete serverData.settings[`${targetSetting}ChannelId`];
            if (targetSetting === 'autorole') delete serverData.settings.autoroleId;
            simpanOwoState();
            return message.reply(`✅ Fitur ${command} dinonaktifkan.`);
        }
        if (aksi === 'pesan' && targetSetting !== 'autorole') {
            const text = message.content.slice(PREFIX.length).trim().replace(/^\S+\s+\S+\s+/, '').trim();
            if (!text) return message.reply(`⚠️ Masukkan pesan setelah \`ltn ${command} pesan\`.`);
            serverData.settings[`${targetSetting}Message`] = text.slice(0, 1000);
            simpanOwoState();
            return message.reply(`✅ Pesan ${command} berhasil diperbarui. Placeholder: \`{user}\`, \`{username}\`, \`{server}\`, \`{memberCount}\`.`);
        }
        if (aksi !== 'set') {
            const usage = targetSetting === 'autorole'
                ? `\`ltn autorole set @role\` atau \`ltn autorole off\``
                : `\`ltn ${command} set #channel [pesan]\`, \`ltn ${command} pesan <pesan>\`, atau \`ltn ${command} off\``;
            return message.reply(`⚠️ Gunakan ${usage}.`);
        }
        if (targetSetting === 'autorole') {
            if (!mentionRole) return message.reply('⚠️ Sebutkan role yang akan diberikan, contoh `ltn autorole set @Anggota`.');
            serverData.settings.autoroleId = mentionRole.id;
            simpanOwoState();
            return message.reply(`✅ Role otomatis anggota baru diatur ke ${mentionRole}. Bot memerlukan izin **Manage Roles** dan role bot harus di atas role tersebut.`);
        }
        if (!mentionChannel || !mentionChannel.isTextBased()) return message.reply('⚠️ Sebutkan channel teks tujuan.');
        const key = `${targetSetting}ChannelId`;
        serverData.settings[key] = mentionChannel.id;
        const text = message.content.replace(/^.*?<#[0-9]{17,20}>\s*/i, '').trim();
        if (text) serverData.settings[`${targetSetting}Message`] = text.slice(0, 1000);
        simpanOwoState();
        return message.reply(`✅ ${command === 'welcome' ? 'Welcome' : 'Goodbye'} diatur ke ${mentionChannel}.${text ? ' Template tersimpan.' : ''} Placeholder: \`{user}\`, \`{username}\`, \`{server}\`, \`{memberCount}\`.`);
    }

    if (command === 'verify') {
        if (!serverData || !message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return message.reply('❌ Perintah ini hanya untuk admin server dengan izin **Manage Server**.');
        }
        const channel = message.mentions.channels.first();
        const role = message.mentions.roles.first();
        if (args[0]?.toLowerCase() !== 'setup' || !channel?.isTextBased() || !role) {
            return message.reply('⚠️ Gunakan `ltn verify setup #channel @role` untuk membuat tombol verifikasi.');
        }
        serverData.settings.verifyRoleId = role.id;
        simpanOwoState();
        try {
            await channel.send({
                embeds: [new EmbedBuilder().setColor(SUCCESS_COLOR).setTitle('✅ Verifikasi Anggota').setDescription('Tekan tombol di bawah untuk mendapatkan akses ke server.')],
                components: [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`verify:${guildId}`).setLabel('Verifikasi').setStyle(ButtonStyle.Success)
                )]
            });
            return message.reply(`✅ Panel verifikasi dikirim ke ${channel}.`);
        } catch (error) {
            console.error('Gagal mengirim panel verifikasi:', error);
            return message.reply('❌ Panel verifikasi gagal dikirim. Pastikan bot dapat melihat dan mengirim pesan di channel tersebut.');
        }
    }

    if (command === 'reportpanel' || command === 'adminpanel') {
        if (!serverData || !message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return message.reply('❌ Perintah ini hanya untuk admin server dengan izin **Manage Server**.');
        }
        const channel = message.mentions.channels.first() || message.channel;
        if (!channel.isTextBased()) return message.reply('⚠️ Pilih channel teks.');
        try {
            const isReport = command === 'reportpanel';
            if (isReport) {
                serverData.settings.reportChannelId = channel.id;
                simpanOwoState();
            }
            await channel.send(isReport ? {
                embeds: [new EmbedBuilder().setColor(THEME_COLOR).setTitle('🚩 Laporkan Anggota').setDescription('Gunakan tombol untuk mengirim laporan rahasia kepada tim moderasi.')],
                components: [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`report:${guildId}`).setLabel('Buat Laporan').setStyle(ButtonStyle.Danger)
                )]
            } : {
                embeds: [new EmbedBuilder().setColor(THEME_COLOR).setTitle('⚙️ Panel Konfigurasi Admin').setDescription('Pilih pengaturan untuk dikonfigurasi. Hanya admin dengan izin Manage Server yang dapat mengubahnya.')],
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`admincfg:welcome:${guildId}`).setLabel('Welcome').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId(`admincfg:goodbye:${guildId}`).setLabel('Goodbye').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId(`admincfg:autorole:${guildId}`).setLabel('Auto-role').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId(`admincfg:report:${guildId}`).setLabel('Channel Laporan').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId(`admincfg:verify:${guildId}`).setLabel('Role Verifikasi').setStyle(ButtonStyle.Secondary)
                    ),
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`admincfg:modlog:${guildId}`).setLabel('Log Moderasi').setStyle(ButtonStyle.Secondary)
                    )
                ]
            });
            return message.reply(`✅ ${command === 'reportpanel' ? 'Panel laporan' : 'Panel konfigurasi admin'} dikirim ke ${channel}.`);
        } catch (error) {
            console.error(`Gagal mengirim ${command}:`, error);
            return message.reply('❌ Panel gagal dikirim. Periksa izin bot di channel tujuan.');
        }
    }

    if (command === 'ticketpanel' || command === 'requestpanel') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return message.reply('❌ Pengaturan panel Ticket memerlukan izin **Manage Server**.');
        }
        const matikanPanelLama = async () => {
            const channelId = serverData.settings.requestPanelChannelId || serverData.settings.requestChannelId;
            const panelMessageId = serverData.settings.requestPanelMessageId;
            if (!channelId || !panelMessageId) return;
            const oldChannel = await message.guild.channels.fetch(channelId).catch(error => {
                console.error('Gagal mencari panel request sebelumnya:', error);
                return null;
            });
            if (!oldChannel?.isTextBased() || !oldChannel.messages) return;
            const oldMessage = await oldChannel.messages.fetch(panelMessageId).catch(error => {
                console.error('Gagal mencari pesan panel request sebelumnya:', error);
                return null;
            });
            if (!oldMessage) return;
            try {
                const disabledRows = oldMessage.components.map(row => ActionRowBuilder.from(row).setComponents(
                    ...row.components.map(component => ButtonBuilder.from(component).setDisabled(true))
                ));
                await oldMessage.edit({ components: disabledRows });
            } catch (error) {
                console.error('Gagal menonaktifkan panel request sebelumnya:', error);
            }
        };
        if (args[0]?.toLowerCase() === 'off') {
            await matikanPanelLama();
            delete serverData.settings.requestChannelId;
            delete serverData.settings.requestPanelChannelId;
            delete serverData.settings.requestPanelMessageId;
            simpanOwoState();
            return message.reply('✅ Panel Ticket dinonaktifkan.');
        }
        const mentionedChannels = [...message.mentions.channels.values()];
        const panelChannel = mentionedChannels[0];
        const ticketChannel = mentionedChannels[1] || panelChannel;
        const allowedChannelTypes = [ChannelType.GuildText, ChannelType.GuildAnnouncement];
        if (mentionedChannels.length > 2 || !panelChannel || !ticketChannel ||
            !allowedChannelTypes.includes(panelChannel.type) ||
            !allowedChannelTypes.includes(ticketChannel.type)) {
            return message.reply('⚠️ Tentukan channel panel dan opsional channel daftar ticket. Contoh: `ltn ticketpanel #panel #list-ticket` atau `ltn ticketpanel off`.');
        }
        let panelMessage;
        try {
            panelMessage = await panelChannel.send({
                embeds: [new EmbedBuilder()
                    .setColor(THEME_COLOR)
                    .setTitle('🎫 Ticket Little Nook')
                    .setDescription(`Pilih jenis ticket untuk mengirim laporan, ide update, atau pesan lainnya. ${ticketChannel.id === panelChannel.id ? 'Ticket masuk ke channel ini' : 'Ticket diteruskan ke tim admin'} dan dapat dibalas admin.`)],
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`ticket-panel:${guildId}:report`)
                            .setLabel('Laporan')
                            .setEmoji('🚩')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId(`ticket-panel:${guildId}:update`)
                            .setLabel('Ide Update')
                            .setEmoji('💡')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(`ticket-panel:${guildId}:other`)
                            .setLabel('Lainnya')
                            .setEmoji('💬')
                            .setStyle(ButtonStyle.Secondary)
                    )
                ],
                allowedMentions: { parse: [] }
            });
        } catch (error) {
            console.error('Gagal mengirim panel ticket:', error);
            return message.reply('❌ Panel Ticket gagal dikirim. Pastikan bot memiliki izin **View Channel**, **Send Messages**, dan **Embed Links** di channel tujuan.');
        }
        await matikanPanelLama();
        serverData.settings.requestChannelId = ticketChannel.id;
        serverData.settings.requestPanelChannelId = panelChannel.id;
        serverData.settings.requestPanelMessageId = panelMessage.id;
        simpanOwoState();
        return message.reply(`✅ Panel Ticket dipasang di ${panelChannel}; ticket akan masuk ke ${ticketChannel}.`);
    }

    if (['slowmode', 'lock', 'unlock'].includes(command)) {
        if (!serverData || !message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            return message.reply('❌ Perintah ini memerlukan izin **Manage Channels**.');
        }
        const channel = message.mentions.channels.first() || message.channel;
        if (!channel.isTextBased() || !channel.setRateLimitPerUser || !channel.permissionOverwrites) {
            return message.reply('⚠️ Perintah ini hanya berlaku untuk channel teks.');
        }
        try {
            if (command === 'slowmode') {
                const seconds = Number(args.find(arg => /^\d+$/.test(arg)));
                if (!Number.isInteger(seconds) || seconds < 0 || seconds > 21600) return message.reply('⚠️ Gunakan `ltn slowmode [#channel] <0-21600 detik>`.');
                await channel.setRateLimitPerUser(seconds, `Diatur oleh ${message.author.tag}`);
                return message.reply(`✅ Slowmode ${channel} diatur menjadi **${seconds} detik**.`);
            }
            await channel.permissionOverwrites.edit(message.guild.roles.everyone, {
                SendMessages: command === 'unlock' ? null : false
            });
            return message.reply(command === 'lock' ? `🔒 ${channel} dikunci untuk @everyone.` : `🔓 ${channel} dibuka kembali.`);
        } catch (error) {
            console.error(`Gagal menjalankan ${command}:`, error);
            return message.reply('❌ Pengaturan channel gagal. Pastikan bot memiliki izin **Manage Channels**.');
        }
    }

    if (command === 'timeout') {
        if (!serverData || !message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return message.reply('❌ Perintah ini memerlukan izin **Moderate Members**.');
        }
        const target = message.mentions.members.first();
        const durasi = parseDurasi(args[1]);
        const reason = args.slice(2).join(' ').slice(0, 500) || 'Tidak ada alasan';
        if (!target || !durasi || durasi > 28 * 86400000 || target.id === message.author.id || target.user.bot) {
            return message.reply('⚠️ Gunakan `ltn timeout @anggota <durasi> [alasan]` (contoh `30m`, `2h`, maksimal 28 hari).');
        }
        try {
            await target.timeout(durasi, reason);
            catatLogMod(guildId, `⏳ ${target.user.tag} di-timeout ${args[1]} oleh ${message.author.tag}. Alasan: ${reason}`, 'timeout');
            return message.reply(`✅ ${target} di-timeout selama **${args[1]}**. Alasan: ${reason}`);
        } catch (error) {
            console.error('Gagal menerapkan timeout:', error);
            return message.reply('❌ Timeout gagal. Periksa izin **Moderate Members** dan hierarki role bot.');
        }
    }

    if (command === 'modsummary') {
        if (!serverData || !message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return message.reply('❌ Perintah ini hanya untuk admin dengan izin **Manage Server**.');
        }
        const rentangLabel = args.find(arg => ['24h', '7d'].includes(arg.toLowerCase()))?.toLowerCase() || '24h';
        const kategori = args.find(arg => !['24h', '7d'].includes(arg.toLowerCase()))?.toLowerCase();
        const rentang = rentangLabel === '7d' ? 7 * 86400000 : 86400000;
        const sejak = Date.now() - rentang;
        const events = (adminLogs[guildId] || []).filter(item =>
            item.at >= sejak && (!kategori || item.type.toLowerCase() === kategori)
        );
        const counts = events.reduce((hasil, item) => {
            hasil[item.type] = (hasil[item.type] || 0) + 1;
            return hasil;
        }, {});
        const ringkasan = Object.entries(counts).map(([type, count]) => `• ${type}: **${count}**`).join('\n') || 'Belum ada aktivitas tercatat.';
        return message.reply({ embeds: [new EmbedBuilder().setColor(THEME_COLOR).setTitle(`📊 Ringkasan Moderasi (${rentangLabel === '7d' ? '7 hari' : '24 jam'})`).setDescription(`${kategori ? `Filter kategori: **${kategori}**\n` : ''}${ringkasan}\n\nTotal: **${events.length}** event.`)] });
    }

    if (command === 'backup') {
        if (!serverData || !message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return message.reply('❌ Perintah ini hanya untuk admin dengan izin **Manage Server**.');
        }
        const aksi = args[0]?.toLowerCase();
        if (!Array.isArray(adminBackups[guildId])) adminBackups[guildId] = [];
        if (aksi === 'buat') {
            const snapshot = {
                id: `${Date.now()}`,
                createdAt: Date.now(),
                settings: JSON.parse(JSON.stringify(serverData.settings)),
                filter: JSON.parse(JSON.stringify(serverData.filter)),
                voice: {
                    lobbyId: serverData.voice.lobbyId || null,
                    categoryId: serverData.voice.categoryId || null
                },
                modLogChannelId: modLogConfig[guildId] || null
            };
            adminBackups[guildId].push(snapshot);
            if (adminBackups[guildId].length > 10) adminBackups[guildId].shift();
            simpanAdminBackups();
            return message.reply(`✅ Backup konfigurasi dibuat dengan ID \`${snapshot.id}\`. Backup hanya mencakup pengaturan bot, bukan saldo/anggota.`);
        }
        if (aksi === 'daftar') {
            const list = adminBackups[guildId].map(item => `• \`${item.id}\` — <t:${Math.floor(item.createdAt / 1000)}:R>`).join('\n');
            return message.reply(list ? `📦 **Backup konfigurasi:**\n${list}` : '📦 Belum ada backup. Gunakan `ltn backup buat`.');
        }
        if (aksi === 'pulihkan') {
            const snapshot = adminBackups[guildId].find(item => item.id === args[1]);
            if (!snapshot) return message.reply('⚠️ Backup tidak ditemukan. Gunakan `ltn backup daftar`.');
            Object.assign(serverData, {
                settings: JSON.parse(JSON.stringify(snapshot.settings)),
                filter: JSON.parse(JSON.stringify(snapshot.filter)),
                voice: {
                    ...serverData.voice,
                    lobbyId: snapshot.voice.lobbyId,
                    categoryId: snapshot.voice.categoryId
                }
            });
            if (snapshot.modLogChannelId) modLogConfig[guildId] = snapshot.modLogChannelId;
            else delete modLogConfig[guildId];
            fs.writeFileSync(PATH_MOD_LOG, JSON.stringify(modLogConfig, null, 2));
            simpanOwoState();
            return message.reply(`✅ Konfigurasi dipulihkan dari backup \`${snapshot.id}\`.`);
        }
        return message.reply('⚠️ Gunakan `ltn backup buat`, `ltn backup daftar`, atau `ltn backup pulihkan <id>`.');
    }

    if (command === 'filter') {
        if (!message.guild || !message.member) {
            return message.reply('⚠️ Perintah filter hanya dapat digunakan di server Discord.');
        }
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return message.reply('❌ Hanya pengguna dengan izin **Manage Messages** yang dapat mengelola filter.');
        }

        const aksi = args.shift()?.toLowerCase();
        const kata = args.join(' ').trim();
        const kataServer = serverData.filter.words;

        if (aksi === 'tambah') {
            const kataNormal = normalisasiTeks(kata);
            if (!kataNormal || kataNormal.length > 100) {
                return message.reply('⚠️ Masukkan kata atau frasa dengan panjang 1–100 karakter. Contoh: `ltn filter tambah kata kasar`');
            }
            if ([...filterData.globalWords, ...kataServer].some(item => normalisasiTeks(item) === kataNormal)) {
                return message.reply('ℹ️ Kata atau frasa tersebut sudah ada di filter.');
            }

            kataServer.push(kataNormal);
            simpanKataFilter();
            return message.reply(`✅ Kata/frasa **${kataNormal}** berhasil ditambahkan ke filter.`);
        }

        if (aksi === 'hapus') {
            const kataNormal = normalisasiTeks(kata);
            const index = kataServer.findIndex(item => normalisasiTeks(item) === kataNormal);
            if (!kataNormal || index === -1) {
                return message.reply('⚠️ Kata atau frasa server tidak ditemukan. Kata bawaan global tidak dapat dihapus lewat command ini.');
            }

            const [kataDihapus] = kataServer.splice(index, 1);
            simpanKataFilter();
            return message.reply(`✅ Kata/frasa **${kataDihapus}** berhasil dihapus dari filter.`);
        }

        if (aksi === 'daftar') {
            const semuaKata = [...new Set([...filterData.globalWords, ...kataServer])];
            if (semuaKata.length === 0) return message.reply('📋 Belum ada kata atau frasa di filter.');

            const daftar = semuaKata.slice(0, 50).map((item, index) => `${index + 1}. ${item}`).join('\n');
            const tambahan = semuaKata.length > 50 ? `\n...dan ${semuaKata.length - 50} lainnya.` : '';
            return message.reply(`📋 **Daftar kata/frasa filter:**\n${daftar}${tambahan}`.slice(0, 2000));
        }

        if (aksi === 'ignore-channel' || aksi === 'unignore-channel') {
            const channel = message.mentions.channels.first();
            if (!channel) return message.reply('⚠️ Sebutkan channel, contoh: `ltn filter ignore-channel #umum`.');
            const list = serverData.filter.ignoredChannels;
            const index = list.indexOf(channel.id);
            if (aksi === 'ignore-channel') {
                if (index !== -1) return message.reply('ℹ️ Channel tersebut sudah dikecualikan.');
                list.push(channel.id);
                simpanKataFilter();
                return message.reply(`✅ Filter kata dikecualikan di ${channel}.`);
            }
            if (index === -1) return message.reply('ℹ️ Channel tersebut tidak ada dalam daftar pengecualian.');
            list.splice(index, 1);
            simpanKataFilter();
            return message.reply(`✅ Pengecualian filter di ${channel} dihapus.`);
        }

        if (aksi === 'ignore-role' || aksi === 'unignore-role') {
            const role = message.mentions.roles.first();
            if (!role) return message.reply('⚠️ Sebutkan role, contoh: `ltn filter ignore-role @Moderator`.');
            const list = serverData.filter.ignoredRoles;
            const index = list.indexOf(role.id);
            if (aksi === 'ignore-role') {
                if (index !== -1) return message.reply('ℹ️ Role tersebut sudah dikecualikan.');
                list.push(role.id);
                simpanKataFilter();
                return message.reply(`✅ Anggota dengan role ${role} dikecualikan dari filter kata.`);
            }
            if (index === -1) return message.reply('ℹ️ Role tersebut tidak ada dalam daftar pengecualian.');
            list.splice(index, 1);
            simpanKataFilter();
            return message.reply(`✅ Pengecualian filter untuk role ${role} dihapus.`);
        }

        return message.reply('⚠️ Gunakan `ltn filter tambah/hapus/daftar`, `ignore-channel #channel`, atau `ignore-role @role` (gunakan `unignore-...` untuk membatalkan).');
    }

    if (!message.isSlashCommand && serverData && message.member &&
        !serverData.filter.ignoredChannels.includes(message.channel.id) &&
        !message.member.roles.cache.some(role => serverData.filter.ignoredRoles.includes(role.id))) {
        const kataFilter = [...filterData.globalWords, ...serverData.filter.words];
        const teksPesan = ` ${normalisasiTeks(message.content)} `;
        const terdeteksi = kataFilter.some(kata => {
            const kataNormal = normalisasiTeks(kata);
            return kataNormal && teksPesan.includes(` ${kataNormal} `);
        });

        if (terdeteksi) {
            try {
                await message.delete();
                catatLogMod(guildId, `🧹 Pesan dari ${message.author.tag} dihapus oleh filter di ${message.channel}.`, 'filter');
            } catch (error) {
                console.error('Gagal menghapus pesan yang melanggar filter:', error);
                return message.reply('⚠️ Pesan terdeteksi oleh filter, tetapi bot gagal menghapusnya. Periksa izin **Manage Messages** bot.')
                    .catch(replyError => console.error('Gagal mengirim peringatan filter:', replyError));
            }

            try {
                const peringatan = await message.channel.send(`${message.author}, pesanmu dihapus karena mengandung kata atau frasa yang difilter.`);
                setTimeout(() => peringatan.delete().catch(error => {
                    console.error('Gagal menghapus pesan peringatan filter:', error);
                }), 5000);
            } catch (error) {
                console.error('Gagal mengirim peringatan filter:', error);
            }
            return;
        }
    }

    if (!isCommand && serverData) {
        const autoResponses = ambilPengaturanAutoRespons(serverData);
        const aturan = serverData.settings.autoResponsesEnabled
            ? autoResponses.find(item => item && typeof item.trigger === 'string' && pesanMengandungPemicu(message.content, item.trigger))
            : null;
        if (aturan && typeof aturan.response === 'string' && aturan.response.trim()) {
            try {
                await message.channel.send({
                    content: aturan.response.slice(0, 1800),
                    allowedMentions: { parse: [] }
                });
            } catch (error) {
                console.error('Gagal mengirim balasan otomatis:', error);
            }
        }
    }

    if (serverData && !message.isSlashCommand) {
        const xpPemain = ambilDataPemain(serverData, message.author.id, guildId);
        await berikanXP(message, xpPemain);
    }
    if (isCommand && MUSIC_COMMANDS.has(command)) {
        return prosesCommandMusik(message, command, args);
    }
    if (!isCommand) return;
    if (!serverData) return message.reply('⚠️ Perintah bot hanya dapat digunakan di server Discord.');

    const uangData = economyData.servers[guildId];
    const userId = message.author.id;
    const statePemain = ambilDataPemain(serverData, userId, guildId);

    if (['autorespon', 'auto-respon', 'autoresponse'].includes(command)) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return message.reply('❌ Pengaturan auto-respon hanya dapat digunakan admin dengan izin **Manage Server**.');
        }
        const aturan = ambilPengaturanAutoRespons(serverData);
        const aksi = args[0]?.toLowerCase();
        const isiAksi = message.content.slice(PREFIX.length + command.length).trim().replace(/^\S+\s*/, '');

        if (aksi === 'tambah' || aksi === 'add') {
            const pemisah = isiAksi.indexOf('|');
            if (pemisah < 0) {
                return message.reply('⚠️ Format: `ltn autorespon tambah <kata> | <balasan>`\nContoh: `ltn autorespon tambah hi | hallo!`');
            }
            const triggerAsli = isiAksi.slice(0, pemisah).trim();
            const response = isiAksi.slice(pemisah + 1).trim();
            const trigger = normalisasiTeks(triggerAsli);
            if (!trigger || triggerAsli.length > 80 || triggerAsli.toLowerCase().startsWith(PREFIX)) {
                return message.reply('⚠️ Kata pemicu harus 1–80 karakter dan bukan command bot.');
            }
            if (!response || response.length > 1800) {
                return message.reply('⚠️ Balasan harus berisi 1–1.800 karakter.');
            }
            if (aturan.some(item => item && normalisasiTeks(item.trigger || '') === trigger)) {
                return message.reply('ℹ️ Kata atau frasa pemicu tersebut sudah terdaftar.');
            }
            if (aturan.length >= 50) {
                return message.reply('⚠️ Batas auto-respon adalah 50 aturan per server. Hapus aturan lama terlebih dahulu.');
            }
            aturan.push({ trigger: triggerAsli, response });
            serverData.settings.autoResponsesEnabled = true;
            simpanOwoState();
            return message.reply(`✅ Auto-respon ditambahkan: **${amanUntukTeksDiscord(triggerAsli)}** → balasan siap digunakan.`);
        }

        if (aksi === 'hapus' || aksi === 'remove') {
            const pemicu = normalisasiTeks(isiAksi);
            const index = aturan.findIndex(item => item && normalisasiTeks(item.trigger || '') === pemicu);
            if (!pemicu || index < 0) return message.reply('⚠️ Pemicu tidak ditemukan. Gunakan `ltn autorespon daftar` untuk melihat aturan.');
            const [dihapus] = aturan.splice(index, 1);
            simpanOwoState();
            return message.reply(`✅ Auto-respon **${amanUntukTeksDiscord(dihapus.trigger)}** dihapus.`);
        }

        if (aksi === 'daftar' || aksi === 'list') {
            if (!aturan.length) return message.reply('📋 Belum ada auto-respon. Tambahkan dengan `ltn autorespon tambah <kata> | <balasan>`.');
            const daftar = aturan.slice(0, 25).map((item, index) =>
                `${index + 1}. **${amanUntukTeksDiscord(item.trigger)}** → ${amanUntukTeksDiscord(item.response)}`
            ).join('\n');
            const status = serverData.settings.autoResponsesEnabled ? 'Aktif' : 'Nonaktif';
            return message.reply(`🤖 **Auto-respon • ${status}**\n${daftar}${aturan.length > 25 ? `\n...dan ${aturan.length - 25} aturan lainnya.` : ''}`.slice(0, 1900));
        }

        if (aksi === 'aktif' || aksi === 'on') {
            serverData.settings.autoResponsesEnabled = true;
            simpanOwoState();
            return message.reply('✅ Auto-respon diaktifkan.');
        }

        if (aksi === 'nonaktif' || aksi === 'off') {
            serverData.settings.autoResponsesEnabled = false;
            simpanOwoState();
            return message.reply('⏸️ Auto-respon dinonaktifkan. Aturan yang tersimpan tidak dihapus.');
        }

        return message.reply('⚠️ Perintah: `ltn autorespon tambah <kata> | <balasan>`, `hapus <kata>`, `daftar`, `aktif`, atau `nonaktif`.');
    }

    if (command === 'economy' || command === 'ekonomi') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return message.reply('❌ Hanya admin dengan izin **Manage Server** yang dapat mengatur ekonomi.');
        }
        const aksi = args[0]?.toLowerCase();
        if (aksi === 'set' && args[1]?.toLowerCase() === 'daily') {
            const hadiah = Number(args[2]);
            if (!Number.isSafeInteger(hadiah) || hadiah < 0 || hadiah > 1000000000) {
                return message.reply('⚠️ Hadiah daily harus angka 0–1.000.000.000.');
            }
            serverData.settings.dailyReward = hadiah;
            simpanOwoState();
            return message.reply(`✅ Hadiah daily server diatur menjadi **${formatUang(hadiah)} koin**.`);
        }
        if (aksi === 'set' && args[1]?.toLowerCase() === 'start') {
            const saldoAwal = Number(args[2]);
            if (!Number.isSafeInteger(saldoAwal) || saldoAwal < 0 || saldoAwal > 1000000000) {
                return message.reply('⚠️ Saldo awal harus angka 0–1.000.000.000.');
            }
            serverData.settings.startingBalance = saldoAwal;
            simpanOwoState();
            return message.reply(`✅ Saldo awal pemain baru diatur menjadi **${formatUang(saldoAwal)} koin**.`);
        }
        return message.reply(`⚙️ Pengaturan ekonomi:\nDaily: **${formatUang(serverData.settings.dailyReward)} koin**\nSaldo awal: **${formatUang(serverData.settings.startingBalance)} koin**\nGunakan \`ltn economy set daily <jumlah>\` atau \`ltn economy set start <jumlah>\`.`);
    }

    // Perintah !kick @user
    if (command === 'kick') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) return message.reply('❌ Izin ditolak.');
        const target = message.mentions.members.first();
        if (!target) return message.reply('⚠️ Sebutkan (mention) orang yang ingin di-kick!');
        try {
            await target.kick();
            message.reply(`✅ Berhasil mengeluarkan ${target.user.tag}.`);
            catatLogMod(guildId, `👢 ${message.author.tag} mengeluarkan ${target.user.tag} dari server.`, 'kick');
        } catch (error) {
            message.reply('❌ Gagal. Pastikan role bot lebih tinggi dari target.');
        }
    }

    // Perintah !clear 10
    if (command === 'clear') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return message.reply('❌ Izin ditolak.');
        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount < 1 || amount > 100) return message.reply('⚠️ Masukkan angka 1 - 100.');
        await message.channel.bulkDelete(amount, true);
        message.channel.send(`✅ Menghapus ${amount} pesan.`).then(msg => setTimeout(() => msg.delete(), 3000));
        catatLogMod(guildId, `🧹 ${message.author.tag} menghapus ${amount} pesan di ${message.channel}.`, 'clear');
    }

    if (command === 'vc') {
        const aksi = args.shift()?.toLowerCase();
        const mentionChannels = [...message.mentions.channels.values()];
        if (!serverData || !message.member) {
            return message.reply('❌ Command voice hanya dapat digunakan di dalam server Discord.');
        }

        if (aksi === 'setup') {
            if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
                return message.reply('❌ Pengaturan lobby voice memerlukan izin **Manage Channels**.');
            }
            const lobby = mentionChannels[0] || message.member.voice.channel;
            if (!lobby || ![ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(lobby.type)) {
                return message.reply('⚠️ Sebutkan lobby voice atau masuk ke channel voice lalu gunakan `ltn vc setup`.');
            }
            serverData.voice.lobbyId = lobby.id;
            serverData.voice.categoryId = lobby.parentId || null;
            simpanOwoState();
            return message.reply(`✅ Lobby voice sementara diatur ke **${lobby.name}**. Anggota yang masuk akan dibuatkan channel voice otomatis.`);
        }

        if (aksi === 'panel' && (args[0]?.toLowerCase() === 'off' || args[0]?.toLowerCase() === 'setup' || mentionChannels.length > 0)) {
            if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                return message.reply('❌ Mengatur panel voice bersama memerlukan izin **Manage Server**.');
            }
            if (args[0]?.toLowerCase() === 'off') {
                delete serverData.voice.panelChannelId;
                delete serverData.voice.panelMessageId;
                simpanOwoState();
                return message.reply('✅ Panel voice bersama dinonaktifkan. Panel lama tidak lagi dapat menjalankan aksi.');
            }
            const channel = mentionChannels.find(item => item.type === ChannelType.GuildText || item.type === ChannelType.GuildAnnouncement);
            if (!channel || !channel.isTextBased() || typeof channel.send !== 'function') {
                return message.reply('⚠️ Sebutkan channel teks. Contoh: `ltn vc panel #voice-panel` atau `ltn vc panel setup #voice-panel`.');
            }
            try {
                let panelMessage = null;
                if (serverData.voice.panelChannelId === channel.id && serverData.voice.panelMessageId) {
                    try {
                        panelMessage = await channel.messages.fetch(serverData.voice.panelMessageId);
                    } catch (error) {
                        console.error('Panel voice bersama sebelumnya tidak dapat ditemukan; membuat panel baru:', error);
                    }
                }
                const panelPayload = {
                    content: '',
                    ...buatPanelVoiceBersama(guildId)
                };
                if (panelMessage) await panelMessage.edit(panelPayload);
                else panelMessage = await channel.send(panelPayload);
                serverData.voice.panelChannelId = channel.id;
                serverData.voice.panelMessageId = panelMessage.id;
                simpanOwoState();
                return message.reply(`✅ Panel voice bersama berhasil dikirim atau diperbarui di ${channel}.`);
            } catch (error) {
                console.error('Gagal mengirim atau memperbarui panel voice bersama:', error);
                return message.reply('❌ Panel gagal dikirim. Pastikan bot memiliki izin **View Channel**, **Send Messages**, dan **Embed Links** di channel tujuan.');
            }
        }

        if (aksi === 'owner' || aksi === 'pemilik') {
            const voice = message.member.voice.channel;
            if (!voice) return message.reply('⚠️ Masuk ke voice channel untuk melihat pemiliknya.');
            const ownerId = serverData.voice.rooms[voice.id];
            if (!ownerId) return message.reply('ℹ️ Voice channel ini bukan channel sementara yang dikelola bot.');
            return message.reply(`👑 Pemilik **${voice.name}** adalah <@${ownerId}>.`);
        }

        const voice = message.member.voice.channel;
        if (!voice) return message.reply('⚠️ Masuk ke voice channel milikmu untuk memakai pengaturan voice.');
        const pemilikId = serverData.voice.rooms[voice.id];
        if (!pemilikId) return message.reply('ℹ️ Command ini hanya berlaku di voice sementara yang dibuat bot.');
        if (aksi === 'panel') {
            if (pemilikId !== message.author.id) {
                return message.reply(`❌ Hanya pemilik channel (<@${pemilikId}>) yang dapat menampilkan panel.`);
            }
            try {
                await voice.send({
                    content: `${message.author}, berikut panel pengaturan untuk voice sementara milikmu:`,
                    ...buatPanelVoice(voice, pemilikId)
                });
                return message.reply(`✅ Panel pengaturan berhasil dikirim ke chat **${voice.name}**.`);
            } catch (error) {
                console.error('Gagal mengirim panel voice melalui command:', error);
                return message.reply('❌ Panel gagal dikirim ke chat voice. Pastikan bot memiliki izin **View Channel** dan **Send Messages** di voice channel tersebut.');
            }
        }
        if (pemilikId !== message.author.id) return message.reply(`❌ Hanya pemilik channel (<@${pemilikId}>) yang dapat mengubah pengaturannya.`);

        try {
            if (aksi === 'lock') {
                await voice.permissionOverwrites.edit(message.guild.roles.everyone, { Connect: false });
                return message.reply(`🔒 **${voice.name}** dikunci. Anggota lain tidak dapat bergabung.`);
            }
            if (aksi === 'unlock') {
                await voice.permissionOverwrites.edit(message.guild.roles.everyone, { Connect: null });
                await voice.permissionOverwrites.edit(message.author.id, { ViewChannel: true, Connect: true, Speak: true });
                return message.reply(`🔓 **${voice.name}** dibuka kembali.`);
            }
            if (aksi === 'limit') {
                const limit = Number(args[0]);
                if (!Number.isInteger(limit) || limit < 0 || limit > 99) {
                    return message.reply('⚠️ Batas anggota harus 0–99. Gunakan `0` untuk tanpa batas.');
                }
                await voice.setUserLimit(limit);
                return message.reply(`✅ Batas anggota **${voice.name}** diatur ke **${limit === 0 ? 'tanpa batas' : limit}**.`);
            }
            if (aksi === 'name') {
                const nama = args.join(' ').trim();
                if (!nama || nama.length > 100) return message.reply('⚠️ Masukkan nama channel dengan panjang 1–100 karakter.');
                await voice.setName(nama);
                return message.reply(`✅ Nama voice channel diubah menjadi **${nama}**.`);
            }
            if (aksi === 'transfer') {
                const target = message.mentions.members.first();
                if (!target || target.user.bot || target.id === message.author.id || target.voice.channelId !== voice.id) {
                    return message.reply('⚠️ Sebutkan anggota lain yang sedang berada di voice channel ini.');
                }
                await voice.permissionOverwrites.edit(target.id, { ViewChannel: true, Connect: true, Speak: true });
                await voice.permissionOverwrites.edit(pemilikId, { ViewChannel: null, Connect: null, Speak: null });
                serverData.voice.rooms[voice.id] = target.id;
                simpanOwoState();
                return message.reply(`👑 Kepemilikan **${voice.name}** dipindahkan ke ${target}.`);
            }
            if (aksi === 'kick') {
                const target = message.mentions.members.first();
                if (!target || target.user.bot || target.id === message.author.id || target.voice.channelId !== voice.id) {
                    return message.reply('⚠️ Sebutkan anggota lain yang sedang berada di voice channel ini.');
                }
                await target.voice.disconnect('Dikeluarkan oleh pemilik voice sementara');
                return message.reply(`🔌 ${target.user.tag} dikeluarkan dari **${voice.name}**.`);
            }
        } catch (error) {
            console.error(`Gagal menjalankan command vc ${aksi}:`, error);
            return message.reply('❌ Command voice gagal. Pastikan bot memiliki izin **Manage Channels** dan **Move Members**.');
        }

        return message.reply('⚠️ Command: `ltn vc setup`, `owner`, `panel [#channel|off]`, `lock`, `unlock`, `limit <0-99>`, `name <nama>`, `transfer @user`, atau `kick @user`.');
    }

    // Perintah !mutevc
    if (command === 'mutevc') {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.reply('⚠️ Anda harus berada di Voice Channel!');
        const pemilikVoice = serverData.voice.rooms[voiceChannel.id] === message.author.id;
        if (!pemilikVoice && !message.member.permissions.has(PermissionsBitField.Flags.MuteMembers)) {
            return message.reply('❌ Perintah ini memerlukan izin **Mute Members** atau kepemilikan voice sementara.');
        }
        for (const [memberID, member] of voiceChannel.members) {
            if (!member.user.bot) await member.voice.setMute(true);
        }
        message.reply(`🔇 Semua anggota di **${voiceChannel.name}** di-mute.`);
        catatLogMod(guildId, `🔇 ${message.author.tag} mute semua anggota di ${voiceChannel.name}.`, 'mutevc');
    }

    // Perintah !unmutevc
    if (command === 'unmutevc') {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.reply('⚠️ Anda harus berada di Voice Channel!');
        const pemilikVoice = serverData.voice.rooms[voiceChannel.id] === message.author.id;
        if (!pemilikVoice && !message.member.permissions.has(PermissionsBitField.Flags.MuteMembers)) {
            return message.reply('❌ Perintah ini memerlukan izin **Mute Members** atau kepemilikan voice sementara.');
        }
        for (const [memberID, member] of voiceChannel.members) {
            await member.voice.setMute(false);
        }
        message.reply(`🔊 Mute dibuka untuk **${voiceChannel.name}**.`);
        catatLogMod(guildId, `🔊 ${message.author.tag} unmute anggota di ${voiceChannel.name}.`, 'unmutevc');
    }

    // Perintah !dc @user
    if (command === 'dc') {
        const target = message.mentions.members.first();
        if (!target || !target.voice.channel) return message.reply('⚠️ Target tidak ada di Voice Channel.');
        const voicePemilik = message.member.voice.channel;
        const pemilikBolehDisconnect = voicePemilik &&
            voicePemilik.id === target.voice.channelId &&
            serverData.voice.rooms[voicePemilik.id] === message.author.id;
        if (!pemilikBolehDisconnect && !message.member.permissions.has(PermissionsBitField.Flags.MoveMembers)) {
            return message.reply('❌ Perintah ini memerlukan izin **Move Members** atau kepemilikan voice sementara.');
        }
        await target.voice.disconnect();
        message.reply(`🔌 ${target.user.tag} diputus dari obrolan suara.`);
        catatLogMod(guildId, `🔌 ${message.author.tag} disconnect ${target.user.tag} dari voice channel.`, 'dc');
    }
    
    // ==========================================
    // EKONOMI COWONCY & MINI-GAMES
    // ==========================================
    if (command === 'top' || command === 'leaderboard') {
        const pemainTeratas = Object.entries(uangData)
            .filter(([id, saldo]) => id !== BOT_OWNER_ID && /^\d{17,20}$/.test(id) && Number.isSafeInteger(saldo) && saldo >= 0)
            .sort((a, b) => b[1] - a[1]);

        if (pemainTeratas.length === 0) return message.reply('📊 Belum ada data saldo untuk ditampilkan.');

        const pemilik = message.author.id;
        const halaman = (indeks) => {
            const potongan = pemainTeratas.slice(indeks * 10, indeks * 10 + 10);
            const daftarTop = potongan.map(([id, saldo], posisi) => {
                const rank = indeks * 10 + posisi;
                const medali = ['🥇', '🥈', '🥉'];
                return `${medali[rank] || `**${rank + 1}.**`} <@${id}> — **${formatUang(saldo)} koin**`;
            }).join('\n');
            return new EmbedBuilder()
                .setColor(THEME_COLOR)
                .setTitle('🏆 Pemain Terkaya di Server')
                .setDescription(daftarTop)
                .setFooter({ text: `Halaman ${indeks + 1}/${Math.ceil(pemainTeratas.length / 10)}` })
                .setTimestamp();
        };
        const jumlahHalaman = Math.ceil(pemainTeratas.length / 10);
        const buatNavigasi = indeks => new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('top-prev').setLabel('Sebelumnya').setStyle(ButtonStyle.Secondary).setDisabled(indeks === 0),
            new ButtonBuilder().setCustomId('top-next').setLabel('Berikutnya').setStyle(ButtonStyle.Primary).setDisabled(indeks >= jumlahHalaman - 1)
        );
        const balasanTop = await message.reply({
            embeds: [halaman(0)],
            components: [buatNavigasi(0)],
            allowedMentions: { parse: [] }
        });
        const collector = balasanTop.createMessageComponentCollector({ time: 120000 });
        let halamanAktif = 0;
        collector.on('collect', async interaction => {
            if (interaction.user.id !== pemilik) {
                await interaction.reply({ content: 'Leaderboard ini dibuka oleh pemain lain.', ephemeral: true });
                return;
            }
            halamanAktif += interaction.customId === 'top-next' ? 1 : -1;
            await interaction.update({
                embeds: [halaman(halamanAktif)],
                components: [buatNavigasi(halamanAktif)]
            });
        });
        collector.on('end', () => balasanTop.edit({ components: [] }).catch(error => {
            console.error('Gagal menonaktifkan tombol leaderboard:', error);
        }));
        return;
    }

    if (command === 'profile' || command === 'profil') {
        const target = message.mentions.members.first() || message.member;
        if (target.id === message.author.id) {
            return message.reply({
                content: '📊 Buka profil privatmu untuk melihat saldo, daily, level, zoo, dan inventory dalam satu dashboard.',
                components: [new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`dashboard-open:${message.author.id}:${guildId}`)
                        .setLabel('Buka Dashboard Privat')
                        .setEmoji('📊')
                        .setStyle(ButtonStyle.Primary)
                )]
            });
        }
        const pemain = ambilDataPemain(serverData, target.id, guildId);
        const saldo = uangData[target.id] || 0;
        const progres = Math.min(20, Math.floor((pemain.xp / xpUntukLevel(pemain.level)) * 20));
        const barXp = `${'🟩'.repeat(progres)}${'⬛'.repeat(20 - progres)}`;
        const embed = new EmbedBuilder()
            .setColor(THEME_COLOR)
            .setTitle(`👤 Profil ${target.displayName}`)
            .setThumbnail(target.user.displayAvatarURL({ size: 512 }))
            .addFields(
                { name: 'Level', value: `**${pemain.level}**`, inline: true },
                { name: 'Koin', value: `**${tampilkanSaldo(target.id, saldo)}**`, inline: true },
                { name: 'Hewan', value: `**${Object.values(pemain.zoo).reduce((total, jumlah) => total + (Number.isSafeInteger(jumlah) && jumlah > 0 ? jumlah : 0), 0)}**`, inline: true },
                { name: 'EXP', value: `${barXp}\n**${formatUang(pemain.xp)} / ${formatUang(xpUntukLevel(pemain.level))} EXP**` },
                { name: 'Statistik aktivitas', value: `Pesan aktif: **${pemain.stats.messages || 0}** | Permainan: **${pemain.stats.games || 0}** | Berburu: **${pemain.stats.hunts || 0}** | Streak daily: **${pemain.dailyStreak || 0} hari**` }
            )
            .setTimestamp();
        return message.reply({ embeds: [embed] });
    }

    if (command === 'history' || command === 'riwayat') {
        const target = message.mentions.members.first() || message.member;
        const pemain = ambilDataPemain(serverData, target.id, guildId);
        const riwayat = pemain.history.slice(-10).reverse();
        if (riwayat.length === 0) return message.reply('📜 Belum ada riwayat transaksi atau permainan.');
        const barisRiwayat = riwayat.map(item => {
            const tanggal = new Date(item.at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
            const nominal = item.amount === null ? '' : ` — ${formatUang(Math.abs(item.amount))} koin`;
            return `• \`${tanggal}\` **${item.type}**${nominal}${item.detail ? ` (${item.detail})` : ''}`;
        }).join('\n');
        return message.reply(`📜 **10 riwayat terbaru ${target.displayName}**\n${barisRiwayat}`.slice(0, 2000));
    }
    if (command === 'cash' || command === 'bal' || command === 'saldo') {
        return message.reply(`💰 Saldo koin kamu: **${tampilkanSaldo(userId, uangData[userId])}**.`);
    }

    if (command === 'daily') {
        const hasilDaily = klaimDaily(serverData, statePemain, uangData, userId);
        if (!hasilDaily.ok) {
            const jam = Math.floor(hasilDaily.sisaCooldown / (60 * 60 * 1000));
            const menit = Math.ceil((hasilDaily.sisaCooldown % (60 * 60 * 1000)) / (60 * 1000));
            return message.reply(`⏳ Kamu sudah mengambil daily. Coba lagi dalam **${jam} jam ${menit} menit**.`);
        }
        return message.reply(`🎁 Daily streak **${hasilDaily.streak} hari**! Kamu mendapatkan **${formatUang(hasilDaily.hadiah)} koin**. Saldo sekarang: **${tampilkanSaldo(userId, hasilDaily.saldo)}**.`);
    }

    if (command === 'send' || command === 'pay' || command === 'transfer') {
        const target = message.mentions.members.first();
        const jumlah = parseJumlah(args[1], uangData[userId]);

        if (!target) return message.reply('⚠️ Sebutkan pemain yang ingin kamu beri koin. Contoh: `ltn send @user 1.000`');
        if (target.id === userId) return message.reply('❌ Kamu tidak bisa mengirim koin ke diri sendiri.');
        if (target.user.bot) return message.reply('❌ Kamu tidak bisa mengirim koin ke bot.');
        if (!jumlah) return message.reply('⚠️ Masukkan jumlah positif, format titik ribuan, atau `all`.');
        if (!cukupSaldo(uangData, userId, jumlah)) return message.reply('❌ Saldo koin kamu tidak cukup untuk transfer ini.');

        const statePenerima = ambilDataPemain(serverData, target.id, guildId);
        const saldoPenerima = uangData[target.id] ?? serverData.settings.startingBalance;
        if (!saldoTidakTerbatas(target.id) && !Number.isSafeInteger(saldoPenerima + jumlah)) {
            return message.reply('⚠️ Saldo penerima mencapai batas aman. Transfer dibatalkan.');
        }
        kurangiSaldo(uangData, userId, jumlah);
        tambahSaldo(uangData, target.id, jumlah);
        simpanRiwayat(statePemain, 'transfer keluar', -jumlah, `ke ${target.user.tag}`);
        simpanRiwayat(statePenerima, 'transfer masuk', jumlah, `dari ${message.author.tag}`);
        simpanUang();
        simpanOwoState();
        return message.reply(`💸 Berhasil mengirim **${formatUang(jumlah)} koin** kepada **${target.user.tag}**.`);
    }

    if (command === 'sendall' || command === 'rain') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return message.reply('❌ Pembagian koin ke seluruh anggota hanya dapat dilakukan admin dengan izin **Manage Server**.');
        }
        const jumlahPerOrang = args.length === 1 ? parseJumlah(args[0], 0) : null;
        if (!jumlahPerOrang) {
            return message.reply('⚠️ Masukkan jumlah koin positif untuk setiap anggota. Contoh: `ltn sendall 1.000`.');
        }

        let anggotaServer;
        try {
            anggotaServer = await message.guild.members.fetch();
        } catch (error) {
            console.error('Gagal mengambil seluruh anggota untuk pembagian koin:', error);
            return message.reply('❌ Daftar anggota server gagal dimuat. Pastikan **Server Members Intent** aktif di Developer Portal bot, lalu coba lagi.');
        }
        const penerima = [...anggotaServer.values()].filter(anggota => !anggota.user.bot);
        if (!penerima.length) return message.reply('⚠️ Tidak ada anggota manusia yang dapat menerima koin.');

        const totalBiaya = jumlahPerOrang * penerima.length;
        if (!Number.isSafeInteger(totalBiaya)) {
            return message.reply('⚠️ Total biaya pembagian terlalu besar untuk diproses dengan aman.');
        }
        if (!cukupSaldo(uangData, userId, totalBiaya)) {
            return message.reply(`❌ Saldo admin tidak cukup. Membagikan **${formatUang(jumlahPerOrang)} koin** ke **${formatUang(penerima.length)} anggota** membutuhkan **${formatUang(totalBiaya)} koin**.`);
        }

        const saldoBaruPenerima = new Map();
        for (const anggota of penerima) {
            if (saldoTidakTerbatas(anggota.id)) continue;
            const saldoLama = Object.prototype.hasOwnProperty.call(uangData, anggota.id)
                ? uangData[anggota.id]
                : serverData.settings.startingBalance;
            const saldoBaru = saldoLama + jumlahPerOrang;
            if (!Number.isSafeInteger(saldoLama) || saldoLama < 0 || !Number.isSafeInteger(saldoBaru)) {
                console.error(`Saldo tidak valid atau melewati batas aman saat pembagian koin ke anggota ${anggota.id}.`);
                return message.reply('⚠️ Pembagian dibatalkan karena ada saldo anggota yang tidak valid atau melewati batas aman. Tidak ada koin yang dibagikan.');
            }
            saldoBaruPenerima.set(anggota.id, saldoBaru);
        }

        for (const [anggotaId, saldoBaru] of saldoBaruPenerima) uangData[anggotaId] = saldoBaru;
        kurangiSaldo(uangData, userId, totalBiaya);
        if (penerima.some(anggota => anggota.id === userId)) tambahSaldo(uangData, userId, jumlahPerOrang);
        simpanRiwayat(statePemain, 'pembagian koin keluar', -totalBiaya, `${formatUang(jumlahPerOrang)} koin × ${penerima.length} anggota`);
        for (const anggota of penerima) {
            const statePenerima = ambilDataPemain(serverData, anggota.id, guildId);
            simpanRiwayat(statePenerima, 'pembagian koin masuk', jumlahPerOrang, 'pembagian koin server');
        }
        simpanUang();
        simpanOwoState();
        return message.reply(`🎁 Berhasil membagikan **${formatUang(jumlahPerOrang)} koin** ke setiap **${formatUang(penerima.length)} anggota manusia**. Total dipotong dari saldo admin: **${formatUang(totalBiaya)} koin**.`);
    }

    if (command === 'pray' || command === 'curse') {
        const target = message.mentions.members.first();
        if (!target) return message.reply(`⚠️ Sebutkan pemain yang ingin kamu ${command === 'pray' ? 'doakan' : 'kutuk'}.`);
        if (target.id === userId) return message.reply('😅 Kamu tidak bisa memilih dirimu sendiri.');
        if (target.user.bot) return message.reply('🤖 Pilih pemain sungguhan, bukan bot.');
        const sisaCooldown = 30000 - (Date.now() - (statePemain.lastPrayCurse || 0));
        if (sisaCooldown > 0) return message.reply(`⏳ Tunggu **${Math.ceil(sisaCooldown / 1000)} detik** sebelum menggunakan pray/curse lagi.`);
        statePemain.lastPrayCurse = Date.now();
        simpanOwoState();
        const pesan = command === 'pray'
            ? [`🙏 ${message.author} mendoakan ${target}. Semoga harimu penuh keberuntungan!`, `✨ Doa ${message.author} terkirim untuk ${target}. Semoga semua urusanmu lancar!`, `🌟 ${target} mendapat doa baik dari ${message.author}!`]
            : [`🌩️ ${message.author} mengirim kutukan bercanda kepada ${target}. Semoga sandalmu selalu hilang sebelah!`, `🌀 ${message.author} mengirim kutukan ringan kepada ${target}. Hati-hati dengan dadu hari ini!`, `🌧️ Awan sial sebentar menaungi ${target}, atas ulah ${message.author}!`];
        return message.channel.send(pesan[Math.floor(Math.random() * pesan.length)]);
    }

    if (command === 'shop' || command === 'toko') {
        const daftarBarang = Object.entries(ITEM_TOKO)
            .map(([id, item]) => `• **${id}** — ${formatUang(item.harga)} koin\n  ${item.deskripsi}`)
            .join('\n');
        return message.reply(`🛒 **TOKO SERVER**\n${daftarBarang}\nBeli dengan \`ltn buy <barang> [jumlah]\`.`);
    }

    if (command === 'buy' || command === 'beli') {
        const idItem = args[0]?.toLowerCase();
        const item = ITEM_TOKO[idItem];
        const jumlah = args[1] === undefined ? 1 : Number(args[1]);
        if (!item) return message.reply('⚠️ Barang tidak ditemukan. Gunakan `ltn shop` untuk melihat toko.');
        if (!Number.isSafeInteger(jumlah) || jumlah < 1 || jumlah > 100) {
            return message.reply('⚠️ Jumlah pembelian harus 1–100.');
        }
        const totalHarga = item.harga * jumlah;
        if (!cukupSaldo(uangData, userId, totalHarga)) return message.reply(`❌ Koin tidak cukup. Harga total: **${formatUang(totalHarga)} koin**.`);
        kurangiSaldo(uangData, userId, totalHarga);
        statePemain.inventory[idItem] = (statePemain.inventory[idItem] || 0) + jumlah;
        simpanRiwayat(statePemain, 'pembelian', -totalHarga, `${item.nama} ×${jumlah}`);
        simpanUang();
        simpanOwoState();
        return message.reply(`✅ Membeli **${item.nama} ×${jumlah}** seharga **${formatUang(totalHarga)} koin**.`);
    }

    if (command === 'inventory' || command === 'inv' || command === 'tas') {
        const items = Object.entries(statePemain.inventory).filter(([, jumlah]) => jumlah > 0);
        if (items.length === 0) return message.reply('🎒 Inventory kamu kosong. Cek `ltn shop` untuk membeli item.');
        return message.reply(`🎒 **INVENTORY ${message.author.username}**\n${items.map(([id, jumlah]) => `• **${ITEM_TOKO[id]?.nama || id}** ×${formatUang(jumlah)}`).join('\n')}`);
    }

    if (command === 'use' || command === 'pakai') {
        const idItem = args[0]?.toLowerCase();
        if (idItem !== 'umpan') return message.reply('⚠️ Item itu tidak bisa digunakan. Item yang tersedia: `umpan`.');
        if ((statePemain.inventory.umpan || 0) < 1) return message.reply('❌ Kamu tidak punya umpan. Beli di `ltn shop`.');
        if (statePemain.huntBoost) return message.reply('ℹ️ Umpanmu sudah aktif untuk perburuan berikutnya.');
        statePemain.inventory.umpan--;
        statePemain.huntBoost = true;
        simpanOwoState();
        return message.reply('🪤 Umpan hoki dipasang. Peluang hewan langka meningkat pada perburuan berikutnya.');
    }

    if (command === 'hunt') {
        const hasilHunt = berburu(serverData, statePemain, guildId, userId);
        if (!hasilHunt.ok) return message.reply(`⏳ Kamu perlu istirahat **${Math.ceil(hasilHunt.sisaCooldown / 1000)} detik** sebelum berburu lagi.`);
        return message.reply({
            content: `🏹 Kamu berburu dan mendapatkan **${hasilHunt.hewan.nama}**! Kelangkaan: **${hasilHunt.hewan.kelangkaan}**.${hasilHunt.pakaiUmpan ? ' 🪤 Umpan hoki digunakan.' : ''} Nilai jual: **${formatUang(hasilHunt.hewan.nilai)} koin**.`,
            components: tombolMainLagi(userId, 'hunt', 0)
        });
    }

    if (command === 'zoo') {
        const koleksi = Object.entries(statePemain.zoo).filter(([, jumlah]) => Number.isSafeInteger(jumlah) && jumlah > 0);
        if (koleksi.length === 0) return message.reply('🦒 Zoo kamu masih kosong. Ketik `ltn hunt` untuk berburu!');
        const isiZoo = koleksi.map(([nama, jumlah]) => {
            const hewan = HEWAN.find(item => item.nama === nama);
            return `• **${nama}** ×${formatUang(jumlah)}${hewan ? ` — ${hewan.kelangkaan}` : ''}`;
        }).join('\n');
        return message.reply(`🦒 **Zoo milik ${message.author.username}**\n${isiZoo}`);
    }

    if (command === 'sell') {
        if (args[0]?.toLowerCase() !== 'all') return message.reply('⚠️ Gunakan `ltn sell all` untuk menjual seluruh hewan di zoo.');
        const hasilJual = jualZoo(statePemain, uangData, userId);
        if (!hasilJual.ok) {
            if (hasilJual.reason === 'saldo_limit') return message.reply('⚠️ Saldo setelah penjualan melewati batas aman; tidak ada hewan yang dijual.');
            if (hasilJual.reason === 'overflow') return message.reply('⚠️ Nilai zoo melewati batas aman; tidak ada hewan yang dijual.');
            return message.reply('🦒 Tidak ada hewan yang bisa dijual.');
        }
        return message.reply(`💰 Berhasil menjual **${formatUang(hasilJual.hewanTerjual)} hewan** seharga **${formatUang(hasilJual.hasilJual)} koin**.`);
    }

    if (command === 'cf' || command === 'coinflip') {
        const taruhan = parseJumlah(args[0], uangData[userId]);
        if (!taruhan) return message.reply('⚠️ Masukkan taruhan positif atau `all`.');
        if (!cukupSaldo(uangData, userId, taruhan)) return message.reply('❌ Koin kamu tidak cukup.');
        if (!Number.isSafeInteger(taruhan * 2)) return message.reply('⚠️ Taruhan terlalu besar untuk diproses dengan aman.');
        if (!saldoTidakTerbatas(userId) && !Number.isSafeInteger(uangData[userId] + taruhan)) {
            return message.reply('⚠️ Saldo terlalu besar untuk memproses taruhan dengan aman.');
        }
        const cooldown = mulaiCooldownGame(statePemain, 'cf', COOLDOWN_MINI_GAME);
        if (cooldown > 0) return message.reply(teksCooldownMiniGame(userId, cooldown));

        kurangiSaldo(uangData, userId, taruhan);
        simpanUang();
        let taruhanDiselesaikan = false;
        try {
            const pesanKoin = await message.reply('The coin spins... 🪙');
            const bingkaiKoin = ['⚪', '🟡', '⚪', '🟡', '⚪'];
            for (const bingkai of bingkaiKoin) {
                await jeda(400);
                await pesanKoin.edit(`The coin spins... ${bingkai}`);
            }

            const menang = Math.random() < 0.5;
            const hadiah = menang ? taruhan * 2 : 0;
            const perubahanSaldo = hadiah - taruhan;
            tambahSaldo(uangData, userId, hadiah);
            statePemain.stats.games = (statePemain.stats.games || 0) + 1;
            simpanRiwayat(statePemain, 'coinflip', perubahanSaldo, menang ? 'menang' : 'kalah');
            simpanUang();
            simpanOwoState();
            taruhanDiselesaikan = true;
            return await pesanKoin.edit(teksHasilCoinflip(userId, taruhan, menang));
        } catch (error) {
            if (!taruhanDiselesaikan) {
                tambahSaldo(uangData, userId, taruhan);
                simpanUang();
            }
            console.error('Gagal memproses coinflip:', error);
            return message.reply(taruhanDiselesaikan
                ? '⚠️ Hasil coinflip sudah diproses dan saldo tersimpan, tetapi pesan hasil gagal diperbarui.'
                : '⚠️ Coinflip gagal diproses; taruhan sudah dikembalikan.')
                .catch(replyError => console.error('Gagal memberi tahu pemain tentang coinflip:', replyError));
        }
    }

    if (command === 'slot') {
        const taruhan = parseJumlah(args[0], uangData[userId]);
        if (!taruhan) return message.reply('⚠️ Masukkan taruhan positif atau `all`. Contoh: `ltn s 1.000`');
        if (!cukupSaldo(uangData, userId, taruhan)) return message.reply('❌ Koin kamu tidak cukup.');
        if (!Number.isSafeInteger(taruhan * 5) || (!saldoTidakTerbatas(userId) && !Number.isSafeInteger(uangData[userId] - taruhan + taruhan * 5))) {
            return message.reply('⚠️ Taruhan terlalu besar untuk diproses dengan aman.');
        }
        const cooldown = mulaiCooldownGame(statePemain, 'slot', COOLDOWN_MINI_GAME);
        if (cooldown > 0) return message.reply(teksCooldownMiniGame(userId, cooldown));

        kurangiSaldo(uangData, userId, taruhan);
        const hasilSlot = acakSimbolSlot();
        const pesanSlot = await message.reply(teksSlot(acakSimbolSlot(), taruhan, '⬇️ Gulungan berputar...'));
        await animasikanSlot(content => pesanSlot.edit(content), taruhan, hasilSlot);

        const hadiah = hitungHadiahSlot(hasilSlot, taruhan);
        tambahSaldo(uangData, userId, hadiah);
        statePemain.stats.games = (statePemain.stats.games || 0) + 1;
        simpanRiwayat(statePemain, 'slot', hadiah - taruhan, hasilSlot.join(' '));
        simpanUang();
        simpanOwoState();
        const hasil = hadiah
            ? `🎉 Menang **${formatUang(hadiah)} koin**!`
            : `💀 Zonk! Taruhan **${formatUang(taruhan)} koin** hilang.`;
        return pesanSlot.edit({
            content: `${teksSlot(hasilSlot, taruhan, hasil)}\n💰 Saldo: **${tampilkanSaldo(userId, uangData[userId])}**.`,
            components: tombolMainLagi(userId, 'slot', taruhan)
        });
    }

    if (command === 'mines') {
        const taruhan = parseJumlah(args[0], uangData[userId]);
        const jumlahBom = args[1] === undefined ? 3 : Number(args[1]);
        if (!taruhan) return message.reply('⚠️ Masukkan taruhan positif atau `all`. Contoh: `ltn mines 1.000 3`');
        if (!Number.isInteger(jumlahBom) || jumlahBom < 1 || jumlahBom > 8) {
            return message.reply('⚠️ Jumlah bom harus angka 1–8. Contoh: `ltn mines 1.000 3`.');
        }
        if (!cukupSaldo(uangData, userId, taruhan)) return message.reply('❌ Koin kamu tidak cukup.');
        if (!Number.isSafeInteger(taruhan * MINES_MAX_PAYOUT_MULTIPLIER)) return message.reply('⚠️ Taruhan terlalu besar untuk diproses dengan aman.');
        const cooldown = mulaiCooldownGame(statePemain, 'mines', COOLDOWN_MINI_GAME);
        if (cooldown > 0) return message.reply(teksCooldownMiniGame(userId, cooldown));

        kurangiSaldo(uangData, userId, taruhan);
        statePemain.stats.games = (statePemain.stats.games || 0) + 1;
        simpanRiwayat(statePemain, 'mines mulai', -taruhan, `${jumlahBom} bom`);
        simpanUang();
        simpanOwoState();
        const aman = new Set();
        const pilihan = new Map();
        const nomorRanjau = new Set();
        while (nomorRanjau.size < jumlahBom) {
            nomorRanjau.add(Math.floor(Math.random() * 9));
        }
        let selesai = false;
        let processing = false;
        const hitungCashOut = () => Math.floor(taruhan * pengaliMines(jumlahBom, aman.size));
        const buatTombol = () => buatKomponenMines({
            taruhan, jumlahBom, aman, bom: nomorRanjau, pilihan, selesai, processing
        });
        const buatKartu = status => buatTampilanMines({
            taruhan, jumlahBom, jumlahBerlian: aman.size, status, aman, bom: nomorRanjau, pilihan
        });
        const pesanGame = await message.reply({
            ...buatKartu('playing'),
            components: buatTombol()
        });
        const collector = pesanGame.createMessageComponentCollector({
            time: 120000,
            filter: interaction => interaction.customId.startsWith('mines-')
        });

        collector.on('collect', async interaction => {
            if (interaction.user.id !== userId) {
                await interaction.reply({ content: 'Permainan ini bukan milikmu.', ephemeral: true });
                return;
            }
            if (selesai || processing) {
                await interaction.reply({ content: selesai ? 'Permainan ini sudah selesai.' : 'Tunggu animasi pilihan sebelumnya selesai.', ephemeral: true });
                return;
            }
            if (interaction.customId === 'mines-cashout') {
                const hadiah = hitungCashOut();
                tambahSaldo(uangData, userId, hadiah);
                simpanRiwayat(statePemain, 'mines cash out', hadiah - taruhan, `${aman.size} berlian, ${jumlahBom} bom`);
                simpanUang();
                simpanOwoState();
                selesai = true;
                collector.stop('selesai');
                await interaction.update({
                    content: '',
                    ...buatKartu('cashout'),
                    components: [...buatTombol(), ...tombolMainLagi(userId, 'mines', taruhan, String(jumlahBom))]
                });
                return;
            }

            const nomor = Number(interaction.customId.slice('mines-cell-'.length));
            if (!Number.isInteger(nomor) || nomor < 0 || nomor > 8 || aman.has(nomor)) {
                await interaction.reply({ content: 'Kotak itu tidak valid atau sudah dipilih.', ephemeral: true });
                return;
            }

            processing = true;
            collector.resetTimer();
            pilihan.set(nomor, 'rolling');
            await interaction.update({
                ...buatKartu('rolling'),
                components: buatTombol()
            });
            await jeda(700);

            if (nomorRanjau.has(nomor)) {
                pilihan.set(nomor, 'mine');
                selesai = true;
                simpanUang();
                simpanRiwayat(statePemain, 'mines kalah', -taruhan, `${aman.size} berlian, ${jumlahBom} bom`);
                simpanOwoState();
                collector.stop('selesai');
                await interaction.editReply({
                    content: '',
                    ...buatKartu('loss'),
                    components: [...buatTombol(), ...tombolMainLagi(userId, 'mines', taruhan, String(jumlahBom))]
                });
                return;
            }

            aman.add(nomor);
            pilihan.set(nomor, 'diamond');
            if (aman.size === 9 - jumlahBom) {
                const hadiah = hitungCashOut();
                tambahSaldo(uangData, userId, hadiah);
                simpanRiwayat(statePemain, 'mines jackpot', hadiah - taruhan, `${aman.size} berlian, ${jumlahBom} bom`);
                simpanUang();
                simpanOwoState();
                selesai = true;
                collector.stop('selesai');
                await interaction.editReply({
                    content: '',
                    ...buatKartu('win'),
                    components: [...buatTombol(), ...tombolMainLagi(userId, 'mines', taruhan, String(jumlahBom))]
                });
                return;
            }

            processing = false;
            await interaction.editReply({
                ...buatKartu('playing'),
                components: buatTombol()
            });
        });

        collector.on('end', async (_, alasan) => {
            if (alasan !== 'time' || selesai) return;
            const hadiah = hitungCashOut();
            tambahSaldo(uangData, userId, hadiah);
            simpanRiwayat(statePemain, 'mines cash out otomatis', hadiah - taruhan, `${aman.size} berlian, ${jumlahBom} bom`);
            simpanUang();
            simpanOwoState();
            selesai = true;
            try {
                await pesanGame.edit({
                    content: '',
                    ...buatKartu('timeout'),
                    components: [...buatTombol(), ...tombolMainLagi(userId, 'mines', taruhan, String(jumlahBom))]
                });
            } catch (error) {
                console.error('Gagal memperbarui pesan mines setelah timeout:', error);
            }
        });
        return;
    }

    if (command === 'gamble') {
        const taruhan = parseJumlah(args[0], uangData[userId]);
        if (!taruhan) return message.reply('⚠️ Masukkan taruhan positif atau `all`. Contoh: `ltn gamble 1.000`');
        if (!cukupSaldo(uangData, userId, taruhan)) return message.reply('❌ Koin kamu tidak cukup.');
        if (!saldoTidakTerbatas(userId) && !Number.isSafeInteger(uangData[userId] + taruhan)) {
            return message.reply('⚠️ Saldo terlalu besar untuk memproses taruhan dengan aman.');
        }
        const cooldown = mulaiCooldownGame(statePemain, 'gamble', COOLDOWN_MINI_GAME);
        if (cooldown > 0) return message.reply(teksCooldownMiniGame(userId, cooldown));
        kurangiSaldo(uangData, userId, taruhan);
        simpanUang();
        let taruhanDiselesaikan = false;
        try {
            const pesanDadu = await message.reply(`🎲 **ADU ANGKA**\nTaruhan dicadangkan: **${formatUang(taruhan)} koin**\nMengocok dadu...`);
            let angkaPemain = 0;
            let angkaBot = 0;
            for (let putaran = 0; putaran < 5; putaran++) {
                angkaPemain = Math.floor(Math.random() * 101);
                angkaBot = Math.floor(Math.random() * 101);
                await jeda(350);
                await pesanDadu.edit(`🎲 **ADU ANGKA**\nTaruhan: **${formatUang(taruhan)} koin**\nKamu: **${angkaPemain}** | Lawan: **${angkaBot}**`);
            }
            const menang = angkaPemain > angkaBot;
            const seri = angkaPemain === angkaBot;
            if (menang) tambahSaldo(uangData, userId, taruhan);
            else if (seri) tambahSaldo(uangData, userId, taruhan);
            const perubahanSaldo = seri ? 0 : menang ? taruhan : -taruhan;
            statePemain.stats.games = (statePemain.stats.games || 0) + 1;
            simpanRiwayat(statePemain, 'gamble', perubahanSaldo, `${angkaPemain} vs ${angkaBot}`);
            simpanUang();
            simpanOwoState();
            taruhanDiselesaikan = true;
            const hasil = seri
                ? '🤝 Seri! Taruhan dikembalikan.'
                : menang
                    ? `🎉 Kamu menang **${formatUang(taruhan)} koin**!`
                    : `💀 Kamu kalah **${formatUang(taruhan)} koin**.`;
            return await pesanDadu.edit({
                content: `🎲 **HASIL ADU ANGKA**\nKamu: **${angkaPemain}** | Lawan: **${angkaBot}**\n${hasil}\nSaldo: **${tampilkanSaldo(userId, uangData[userId])}**.`,
                components: tombolMainLagi(userId, 'gamble', taruhan)
            });
        } catch (error) {
            if (!taruhanDiselesaikan) {
                tambahSaldo(uangData, userId, taruhan);
                simpanUang();
            }
            console.error('Gagal memproses gamble:', error);
            return message.reply(taruhanDiselesaikan
                ? '⚠️ Hasil gamble sudah diproses dan saldo tersimpan, tetapi pesan hasil gagal diperbarui.'
                : '⚠️ Gamble gagal diproses; taruhan sudah dikembalikan.')
                .catch(replyError => console.error('Gagal memberi tahu pemain tentang gamble:', replyError));
        }
    }

    // ==========================================
    // FITUR MENU HELP (BANTUAN)
    // ==========================================
    if (command === 'help' || command === 'bantuan') {
        if (args[0]?.toLowerCase() === 'admin') {
            if (!message.guild || !message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                return message.reply('❌ Bantuan admin hanya tersedia bagi admin server dengan izin **Manage Server**.');
            }
            try {
                await message.author.send({
                    embeds: [buatHelpEmbed('moderasi', true)],
                    components: buatMenuHelp(message.author.id, 'moderasi', true, guildId)
                });
            } catch (error) {
                console.error('Gagal mengirim bantuan admin melalui DM:', error);
                return message.reply('❌ Saya tidak dapat mengirim DM. Aktifkan DM dari anggota server lalu coba `ltn help admin` lagi.');
            }
            return message.reply('🔐 Panduan khusus admin sudah dikirim ke DM agar daftar command tidak terlihat publik.');
        }
        return message.reply({
            embeds: [buatHelpEmbed('ringkasan', false)],
            components: buatMenuHelp(message.author.id, 'ringkasan', false)
        });
    }

    // ==========================================
    // FITUR VOICE
    // ==========================================
    if (command === 'join vc') {
        if (!message.guild || !message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return message.reply('❌ Hanya Admin (Manage Server) yang bisa menyuruh saya masuk.');
        }

        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.reply('❌ Anda harus masuk ke Voice Channel terlebih dahulu agar saya tahu harus bergabung ke mana!');
        }

        joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator,
        });

        return message.reply(`✅ Berhasil bergabung ke **${voiceChannel.name}**. Saya akan tetap di sini sampai dikeluarkan dari channel.`);
    }

    if (command === 'leave vc') {
        return message.reply('⚠️ Saya tidak bisa keluar lewat command. Untuk mengeluarkan saya, gunakan Kick pada Little Nook dari daftar anggota Voice Channel.');
    }
}

client.on('messageCreate', prosesPesan);

function buatMentionsSlash(guild, content) {
    const collect = (pattern, cache) => {
        const result = new Collection();
        for (const [, id] of content.matchAll(pattern)) {
            const mention = cache.get(id);
            if (mention) result.set(id, mention);
        }
        return result;
    };

    return {
        members: collect(/<@!?(\d{17,20})>/g, guild.members.cache),
        channels: collect(/<#(\d{17,20})>/g, guild.channels.cache),
        roles: collect(/<@&(\d{17,20})>/g, guild.roles.cache)
    };
}

async function jalankanSlashCommand(interaction) {
    if (!interaction.guild || !interaction.channel) {
        await interaction.reply({ content: '⚠️ Command ini hanya dapat digunakan di dalam server Discord.', ephemeral: true });
        return;
    }

    try {
        await interaction.deferReply();
        const route = interaction.commandName === 'join-vc'
            ? 'join vc'
            : interaction.commandName === 'leave-vc'
                ? 'leave vc'
                : interaction.commandName;
        const input = interaction.options.getString('input') || '';
        const content = `ltn ${route}${input ? ` ${input}` : ''}`;
        const member = await interaction.guild.members.fetch(interaction.user.id);
        const message = {
            id: interaction.id,
            author: interaction.user,
            channel: interaction.channel,
            guild: interaction.guild,
            member,
            content,
            mentions: buatMentionsSlash(interaction.guild, content),
            isSlashCommand: true,
            reply: options => interaction.editReply(options)
        };
        await prosesPesan(message);
    } catch (error) {
        console.error(`Gagal menjalankan slash command /${interaction.commandName}:`, error);
        const response = { content: '⚠️ Terjadi kesalahan saat menjalankan command. Silakan coba lagi atau hubungi admin bot.' };
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply(response);
        } else {
            await interaction.reply({ ...response, ephemeral: true });
        }
    }
}

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        await jalankanSlashCommand(interaction);
        return;
    }
    if (interaction.isButton() && interaction.customId.startsWith('music:')) {
        await prosesTombolMusik(interaction);
        return;
    }
    if (interaction.isModalSubmit() && interaction.customId.startsWith('music-volume:')) {
        await prosesModalVolumeMusik(interaction);
        return;
    }
    if (!interaction.isButton() && !interaction.isModalSubmit() && !interaction.isStringSelectMenu() && !interaction.isUserSelectMenu()) return;
    const guild = interaction.guild;
    const customId = interaction.customId;
    if (interaction.isButton() && customId.startsWith('replay:')) {
        const [, game, ownerId, rawBet, pilihan = 'none'] = customId.split(':');
        if (!guild || interaction.user.id !== ownerId) {
            await interaction.reply({ content: 'Tombol permainan ini hanya dapat digunakan oleh pemain yang memulai permainan.', ephemeral: true });
            return;
        }
        if (game === 'mines') {
            const taruhan = Number(rawBet);
            await jalankanGameUI(interaction, { game, userId: ownerId, taruhan, jumlahBom: Number(pilihan) });
            return;
        }
        const server = ambilDataServer(guild.id);
        const pemain = ambilDataPemain(server, ownerId, guild.id);
        if (game === 'hunt') {
            const hasil = berburu(server, pemain, guild.id, ownerId);
            if (!hasil.ok) {
                await interaction.reply({ content: `⏳ Kamu bisa berburu lagi <t:${Math.ceil((Date.now() + hasil.sisaCooldown) / 1000)}:R>.`, ephemeral: true });
                return;
            }
            await interaction.update({
                content: `🏹 Kamu berburu dan mendapatkan **${hasil.hewan.nama}**! Kelangkaan: **${hasil.hewan.kelangkaan}**.${hasil.pakaiUmpan ? ' 🪤 Umpan hoki digunakan.' : ''} Nilai jual: **${formatUang(hasil.hewan.nilai)} koin**.`,
                components: tombolMainLagi(ownerId, 'hunt', 0)
            });
            return;
        }
        if (!['cf', 'slot', 'gamble'].includes(game)) {
            await interaction.reply({ content: 'Jenis permainan tidak dikenal.', ephemeral: true });
            return;
        }
        const taruhan = Number(rawBet);
        const cooldownMs = COOLDOWN_MINI_GAME;
        const uangData = economyData.servers[guild.id];
        if (!Number.isSafeInteger(taruhan) || taruhan < 1) {
            await interaction.reply({ content: 'Data taruhan tidak valid. Mulai permainan kembali dari command.', ephemeral: true });
            return;
        }
        if (!cukupSaldo(uangData, ownerId, taruhan)) {
            await interaction.reply({ content: '❌ Saldo koin kamu tidak cukup untuk mengulang taruhan ini.', ephemeral: true });
            return;
        }
        if (!Number.isSafeInteger(taruhan * (game === 'slot' ? 5 : game === 'mines' ? MINES_MAX_PAYOUT_MULTIPLIER : 2)) ||
            (game === 'slot' && (!saldoTidakTerbatas(ownerId) && !Number.isSafeInteger(uangData[ownerId] - taruhan + taruhan * 5))) ||
            (game !== 'slot' && !saldoTidakTerbatas(ownerId) && !Number.isSafeInteger(uangData[ownerId] + taruhan))) {
            await interaction.reply({ content: '⚠️ Taruhan terlalu besar untuk diproses dengan aman.', ephemeral: true });
            return;
        }
        const sisaCooldown = mulaiCooldownGame(pemain, game, cooldownMs);
        if (sisaCooldown > 0) {
            await interaction.reply({ content: teksCooldownMiniGame(ownerId, sisaCooldown), ephemeral: true });
            return;
        }

        kurangiSaldo(uangData, ownerId, taruhan);
        simpanUang();
        let sudahSettlement = false;
        try {
            await interaction.update({
                content: game === 'cf'
                    ? 'The coin spins... 🪙'
                    : game === 'slot'
                        ? teksSlot(acakSimbolSlot(), taruhan, '⬇️ Gulungan berputar...')
                        : `🎲 **ADU ANGKA** — taruhan **${formatUang(taruhan)} koin**\nMengocok dadu...`,
                embeds: [],
                components: []
            });

            let perubahanSaldo = 0;
            let hasilDetail = '';
            let narasi = '';
            if (game === 'cf') {
                for (const bingkai of ['⚪', '🟡', '⚪']) {
                    await jeda(400);
                    await interaction.editReply({ content: `The coin spins... ${bingkai}` });
                }
                const menang = Math.random() < 0.5;
                const hadiah = menang ? taruhan * 2 : 0;
                perubahanSaldo = hadiah - taruhan;
                tambahSaldo(uangData, ownerId, hadiah);
                hasilDetail = menang ? 'menang' : 'kalah';
                narasi = menang ? `🎉 Kamu menang **${formatUang(hadiah)} koin**!` : `💀 Kamu kalah **${formatUang(taruhan)} koin**.`;
            } else if (game === 'slot') {
                const hasil = acakSimbolSlot();
                await animasikanSlot(content => interaction.editReply({ content }), taruhan, hasil);
                const hadiah = hitungHadiahSlot(hasil, taruhan);
                perubahanSaldo = hadiah - taruhan;
                tambahSaldo(uangData, ownerId, hadiah);
                hasilDetail = hasil.join(' ');
                narasi = hadiah > taruhan
                    ? `🎉 Jackpot! Hadiah **${formatUang(hadiah)} koin**.`
                    : hadiah > 0
                        ? `✨ Menang **${formatUang(hadiah)} koin**.`
                        : `💀 Zonk! Taruhan **${formatUang(taruhan)} koin** hilang.`;
            } else {
                let angkaPemain = 0;
                let angkaBot = 0;
                for (let putaran = 0; putaran < 5; putaran++) {
                    angkaPemain = Math.floor(Math.random() * 101);
                    angkaBot = Math.floor(Math.random() * 101);
                    await jeda(350);
                    await interaction.editReply({ content: `🎲 **ADU ANGKA** — taruhan **${formatUang(taruhan)} koin**\nKamu: **${angkaPemain}** | Lawan: **${angkaBot}**` });
                }
                const menang = angkaPemain > angkaBot;
                const seri = angkaPemain === angkaBot;
                perubahanSaldo = seri ? 0 : menang ? taruhan : -taruhan;
                if (menang) tambahSaldo(uangData, ownerId, taruhan);
                else if (seri) tambahSaldo(uangData, ownerId, taruhan);
                hasilDetail = `${angkaPemain} vs ${angkaBot}`;
                narasi = seri ? '🤝 Seri! Taruhan dikembalikan.' : menang ? `🎉 Kamu menang **${formatUang(taruhan)} koin**!` : `💀 Kamu kalah **${formatUang(taruhan)} koin**.`;
            }

            pemain.stats.games = (pemain.stats.games || 0) + 1;
            simpanRiwayat(pemain, game === 'cf' ? 'coinflip' : game, perubahanSaldo, hasilDetail);
            simpanUang();
            simpanOwoState();
            sudahSettlement = true;
            const hasilPesan = game === 'slot'
                ? teksSlot(hasilDetail.split(' '), taruhan, narasi)
                : `🎲 **HASIL ADU ANGKA**\n${hasilDetail}\n${narasi}`;
            await interaction.editReply({
                content: game === 'cf'
                    ? teksHasilCoinflip(ownerId, taruhan, perubahanSaldo > 0)
                    : `${hasilPesan}\n💰 Saldo: **${tampilkanSaldo(ownerId, uangData[ownerId])}**.`,
                embeds: [],
                components: game === 'cf' ? [] : tombolMainLagi(ownerId, game, taruhan)
            });
        } catch (error) {
            if (!sudahSettlement) {
                tambahSaldo(uangData, ownerId, taruhan);
                pemain.gameCooldowns[game] = 0;
                simpanUang();
                simpanOwoState();
            }
            console.error(`Gagal menjalankan replay ${game}:`, error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content: sudahSettlement
                        ? 'Hasil sudah disimpan, tetapi pesan gagal diperbarui.'
                        : 'Permainan gagal diproses; taruhan telah dikembalikan.',
                    components: []
                }).catch(replyError => console.error('Gagal mengirim status replay:', replyError));
            } else {
                await interaction.reply({ content: 'Permainan gagal diproses.', ephemeral: true }).catch(replyError => console.error('Gagal memberi tahu pemain:', replyError));
            }
        }
        return;
    }

    if (interaction.isButton() && customId.startsWith('dashboard-open:')) {
        const [, ownerId, guildId] = customId.split(':');
        if (!guild || guildId !== guild.id || interaction.user.id !== ownerId) {
            await interaction.reply({ content: 'Dashboard ini hanya dapat dibuka oleh pemiliknya di server asal.', ephemeral: true });
            return;
        }
        try {
            const member = await guild.members.fetch(ownerId);
            await interaction.reply({
                embeds: [buatDashboardEmbed(guild.id, member)],
                components: buatKontrolDashboard(ownerId),
                ephemeral: true
            });
        } catch (error) {
            console.error('Gagal membuka dashboard pengguna:', error);
            await interaction.reply({ content: '❌ Dashboard gagal dibuka. Coba lagi sebentar.', ephemeral: true });
        }
        return;
    }

    if (interaction.isStringSelectMenu() && customId.startsWith('dashboard-page:')) {
        const [, ownerId] = customId.split(':');
        if (!guild || interaction.user.id !== ownerId) {
            await interaction.reply({ content: 'Dashboard ini hanya dapat digunakan oleh pemiliknya.', ephemeral: true });
            return;
        }
        const member = await guild.members.fetch(ownerId).catch(error => {
            console.error('Gagal mengambil anggota untuk dashboard:', error);
            return null;
        });
        if (!member) {
            await interaction.reply({ content: 'Anggota tidak ditemukan di server ini.', ephemeral: true });
            return;
        }
        const server = ambilDataServer(guild.id);
        const pemain = ambilDataPemain(server, ownerId, guild.id);
        const page = interaction.values[0];
        let embed;
        if (page === 'zoo') embed = buatZooEmbed(member, pemain);
        else if (page === 'inventory') {
            const daftar = Object.entries(pemain.inventory).filter(([, jumlah]) => Number.isSafeInteger(jumlah) && jumlah > 0);
            embed = new EmbedBuilder()
                .setColor(THEME_COLOR)
                .setAuthor({ name: `INVENTORY  •  ${member.displayName}`, iconURL: member.user.displayAvatarURL({ size: 128 }) })
                .setTitle('🎒 Perlengkapan')
                .setDescription(daftar.length
                    ? daftar.map(([id, jumlah]) => `• **${ITEM_TOKO[id]?.nama || id}** ×${formatUang(jumlah)}`).join('\n')
                    : 'Tasmu masih kosong.\n\nBuka menu **Aksi lainnya → Buka toko** untuk melihat perlengkapan yang tersedia.')
                .setFooter({ text: `${daftar.length} jenis item • gunakan menu Aksi lainnya untuk membuka toko` })
                .setTimestamp();
        } else if (page === 'history') {
            const riwayat = pemain.history.slice(-10).reverse();
            embed = new EmbedBuilder()
                .setColor(THEME_COLOR)
                .setAuthor({ name: `AKTIVITAS  •  ${member.displayName}`, iconURL: member.user.displayAvatarURL({ size: 128 }) })
                .setTitle('📜 Riwayat Terbaru')
                .setDescription(riwayat.length
                    ? riwayat.map(item => {
                        const nominal = item.amount === null
                            ? ''
                            : ` — ${item.amount > 0 ? '+' : item.amount < 0 ? '−' : ''}${formatUang(Math.abs(item.amount))} koin`;
                        return `• <t:${Math.floor(item.at / 1000)}:R> **${item.type}**${nominal}${item.detail ? ` (${item.detail})` : ''}`;
                    }).join('\n')
                    : 'Belum ada aktivitas yang tercatat.\n\nMulai klaim daily, berburu, atau bermain untuk mengisi riwayatmu.')
                .setFooter({ text: 'Menampilkan hingga 10 aktivitas terbaru' })
                .setTimestamp();
        } else if (page === 'games') {
            embed = new EmbedBuilder()
                .setColor(THEME_COLOR)
                .setAuthor({ name: `ARCADE  •  ${member.displayName}`, iconURL: member.user.displayAvatarURL({ size: 128 }) })
                .setTitle('🎮 Ruang Permainan')
                .setDescription(`Saldo tersedia: **${tampilkanSaldo(ownerId, economyData.servers[guild.id][ownerId])}**\nPilih game di menu **Pilih permainan** di bawah. Setiap ronde dimainkan privat dan taruhan dikunci sebelum dimulai.`)
                .addFields(
                    { name: '🪙 Coinflip', value: 'Lempar koin otomatis; menang mendapat 2× taruhan.', inline: true },
                    { name: '🎰 Slot', value: 'Cocokkan simbol untuk memenangkan hadiah.', inline: true },
                    { name: '🎲 Adu Angka', value: 'Dapatkan angka lebih tinggi dari lawan.', inline: true },
                    { name: '💎 Mines', value: 'Atur jumlah bom, cari berlian, lalu cash out sebelum terkena bom.', inline: true }
                )
                .setFooter({ text: 'Cooldown tiap game: 10 detik • Main dengan bijak' })
                .setTimestamp();
        } else embed = buatDashboardEmbed(guild.id, member);
        await interaction.update({
            embeds: [embed],
            components: page === 'games'
                ? [...buatKontrolDashboard(ownerId, page), buatMenuGame(ownerId)]
                : buatKontrolDashboard(ownerId, page)
        });
        return;
    }

    if (interaction.isStringSelectMenu() && customId.startsWith('dashboard-game:')) {
        const [, ownerId] = customId.split(':');
        if (interaction.user.id !== ownerId || !guild) {
            await interaction.reply({ content: 'Menu game ini hanya dapat digunakan oleh pemilik dashboard.', ephemeral: true });
            return;
        }
        const modal = buatModalTaruhan(ownerId, guild.id, interaction.values[0]);
        if (!modal) {
            await interaction.reply({ content: 'Permainan tidak dikenal.', ephemeral: true });
            return;
        }
        await interaction.showModal(modal);
        return;
    }

    if (interaction.isModalSubmit() && customId.startsWith('dashboard-game-modal:')) {
        const [, guildId, ownerId, game] = customId.split(':');
        if (!guild || guild.id !== guildId || interaction.user.id !== ownerId) {
            await interaction.reply({ content: 'Form game ini tidak berlaku untuk pengguna/server ini.', ephemeral: true });
            return;
        }
        if (!['cf', 'slot', 'gamble', 'mines'].includes(game)) {
            await interaction.reply({ content: 'Jenis permainan tidak dikenal.', ephemeral: true });
            return;
        }
        ambilDataPemain(ambilDataServer(guildId), ownerId, guildId);
        const saldo = economyData.servers[guild.id][ownerId];
        const taruhan = parseJumlah(interaction.fields.getTextInputValue('bet').trim(), saldo);
        if (!taruhan) {
            await interaction.reply({ content: 'Masukkan taruhan positif yang valid atau `all`.', ephemeral: true });
            return;
        }
        const jumlahBom = game === 'mines' ? Number(interaction.fields.getTextInputValue('bombs').trim()) : 3;
        await jalankanGameUI(interaction, { game, userId: ownerId, taruhan, jumlahBom });
        return;
    }

    if (interaction.isUserSelectMenu() && customId.startsWith('dashboard-transfer-target:')) {
        const [, guildId, ownerId] = customId.split(':');
        if (!guild || guild.id !== guildId || interaction.user.id !== ownerId || interaction.values.length !== 1) {
            await interaction.reply({ content: 'Pemilih penerima ini tidak berlaku untuk pengguna/server ini.', ephemeral: true });
            return;
        }
        const targetId = interaction.values[0];
        const target = await guild.members.fetch(targetId).catch(error => {
            console.error('Gagal mencari penerima transfer dari pemilih anggota:', error);
            return null;
        });
        if (!target || target.user.bot || target.id === ownerId) {
            await interaction.reply({ content: 'Pilih anggota lain yang bukan bot sebagai penerima transfer.', ephemeral: true });
            return;
        }
        await interaction.showModal(buatModalJumlahTransfer(guildId, ownerId, targetId));
        return;
    }

    if ((interaction.isButton() && customId.startsWith('dashboard:')) ||
        (interaction.isStringSelectMenu() && customId.startsWith('dashboard-action:'))) {
        const isQuickAction = customId.startsWith('dashboard-action:');
        const [, ownerId, buttonAction] = customId.split(':');
        const action = isQuickAction ? interaction.values[0] : buttonAction;
        if (isQuickAction && !['transfer', 'sell', 'shop', 'bait', 'refresh'].includes(action)) {
            await interaction.reply({ content: 'Aksi dashboard tidak dikenal.', ephemeral: true });
            return;
        }
        if (!guild || interaction.user.id !== ownerId) {
            await interaction.reply({ content: 'Kontrol dashboard ini hanya dapat digunakan pemiliknya.', ephemeral: true });
            return;
        }
        if (action === 'transfer') {
            await interaction.reply({
                content: 'Cari nama penerima pada kotak pemilih Discord, lalu pilih anggotanya. Setelah itu masukkan jumlah koin.',
                components: [new ActionRowBuilder().addComponents(
                    new UserSelectMenuBuilder()
                        .setCustomId(`dashboard-transfer-target:${guild.id}:${ownerId}`)
                        .setPlaceholder('Cari anggota yang menerima koin')
                        .setMinValues(1)
                        .setMaxValues(1)
                )],
                ephemeral: true
            });
            return;
        }
        if (action === 'sell') {
            const dataServer = ambilDataServer(guild.id);
            const dataPemain = ambilDataPemain(dataServer, ownerId, guild.id);
            const ringkasanJual = ringkasanZoo(dataPemain);
            if (!ringkasanJual.ok) {
                const status = ringkasanJual.reason === 'overflow'
                    ? 'Nilai zoo melewati batas aman; tidak ada hewan yang dijual.'
                    : 'Zoo kamu tidak memiliki hewan yang bisa dijual.';
                await interaction.update({
                    embeds: [new EmbedBuilder().setColor(ERROR_COLOR).setTitle('Penjualan tidak dapat dilanjutkan').setDescription(status)],
                    components: buatKontrolDashboard(ownerId)
                });
                return;
            }
            if (!saldoTidakTerbatas(ownerId) && !Number.isSafeInteger(economyData.servers[guild.id][ownerId] + ringkasanJual.totalKoin)) {
                await interaction.update({
                    embeds: [new EmbedBuilder()
                        .setColor(ERROR_COLOR)
                        .setTitle('Penjualan tidak dapat dilanjutkan')
                        .setDescription('Saldo setelah penjualan melewati batas aman; tidak ada hewan yang dijual.')],
                    components: buatKontrolDashboard(ownerId)
                });
                return;
            }
            await interaction.update({
                embeds: [new EmbedBuilder()
                    .setColor(THEME_COLOR)
                    .setTitle('🪙 Konfirmasi Penjualan Zoo')
                    .setDescription('Tinjau hasil penjualan sebelum mengonfirmasi. Hewan yang dijual tidak dapat dikembalikan.')
                    .addFields(
                        { name: 'Hewan yang dijual', value: `**${formatUang(ringkasanJual.totalHewan)}**`, inline: true },
                        { name: 'Koin yang diterima', value: `**${formatUang(ringkasanJual.totalKoin)}**`, inline: true }
                    )
                    .setFooter({ text: 'Penjualan hanya diproses setelah kamu mengonfirmasi.' })],
                components: [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`dashboard-sell:${ownerId}:confirm`).setLabel('Konfirmasi penjualan').setEmoji('🪙').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId(`dashboard:${ownerId}:refresh`).setLabel('Kembali ke dashboard').setStyle(ButtonStyle.Secondary)
                )]
            });
            return;
        }
        const server = ambilDataServer(guild.id);
        const pemain = ambilDataPemain(server, ownerId, guild.id);
        const uangData = economyData.servers[guild.id];
        const member = await guild.members.fetch(ownerId).catch(error => {
            console.error('Gagal mengambil anggota untuk aksi dashboard:', error);
            return null;
        });
        if (!member) {
            await interaction.reply({ content: 'Anggota tidak ditemukan di server ini.', ephemeral: true });
            return;
        }
        if (action === 'shop') {
            const item = ITEM_TOKO.umpan;
            await interaction.update({
                embeds: [new EmbedBuilder()
                    .setColor(THEME_COLOR)
                    .setTitle('🛒 Toko Koin')
                    .setDescription(`**${item.nama}** — ${formatUang(item.harga)} koin\n${item.deskripsi}\n\nSaldo kamu: **${tampilkanSaldo(ownerId, uangData[ownerId])}**.`)],
                components: [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`dashboard:${ownerId}:buy`).setLabel(`Beli Umpan • ${formatUang(item.harga)} koin`).setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`dashboard:${ownerId}:refresh`).setLabel('Kembali').setStyle(ButtonStyle.Secondary)
                ), ...buatKontrolDashboard(ownerId).slice(0, 1)]
            });
            return;
        }
        if (action === 'buy') {
            const item = ITEM_TOKO.umpan;
            if (!cukupSaldo(uangData, ownerId, item.harga)) {
                await interaction.update({
                    embeds: [buatDashboardEmbed(guild.id, member, `❌ Koin tidak cukup. Harga umpan ${formatUang(item.harga)} koin.`)],
                    components: buatKontrolDashboard(ownerId)
                });
                return;
            }
            kurangiSaldo(uangData, ownerId, item.harga);
            pemain.inventory.umpan = (pemain.inventory.umpan || 0) + 1;
            simpanRiwayat(pemain, 'pembelian', -item.harga, item.nama);
            simpanUang();
            simpanOwoState();
            await interaction.update({
                embeds: [buatDashboardEmbed(guild.id, member, `✅ Membeli **${item.nama}** seharga **${formatUang(item.harga)} koin**.`)],
                components: buatKontrolDashboard(ownerId)
            });
            return;
        }
        if (action === 'bait') {
            if ((pemain.inventory.umpan || 0) < 1) {
                await interaction.update({
                    embeds: [buatDashboardEmbed(guild.id, member, 'Kamu belum memiliki umpan. Buka toko dari dashboard untuk membelinya.')],
                    components: buatKontrolDashboard(ownerId)
                });
                return;
            }
            if (pemain.huntBoost) {
                await interaction.update({
                    embeds: [buatDashboardEmbed(guild.id, member, '🪤 Umpan sudah dipasang untuk perburuan berikutnya.')],
                    components: buatKontrolDashboard(ownerId)
                });
                return;
            }
            pemain.inventory.umpan--;
            pemain.huntBoost = true;
            simpanOwoState();
            await interaction.update({
                embeds: [buatDashboardEmbed(guild.id, member, '🪤 Umpan hoki dipasang. Peluang hewan langka meningkat pada hunt berikutnya.')],
                components: buatKontrolDashboard(ownerId)
            });
            return;
        }
        if (action === 'daily') {
            const hasil = klaimDaily(server, pemain, uangData, ownerId);
            const status = hasil.ok
                ? `🎁 Daily berhasil diklaim! **${formatUang(hasil.hadiah)} koin** • streak **${hasil.streak} hari**.`
                : `⏳ Daily belum tersedia. Coba lagi <t:${Math.ceil((Date.now() + hasil.sisaCooldown) / 1000)}:R>.`;
            await interaction.update({
                embeds: [buatDashboardEmbed(guild.id, member, status)],
                components: buatKontrolDashboard(ownerId)
            });
            return;
        }
        if (action === 'hunt') {
            const hasil = berburu(server, pemain, guild.id, ownerId);
            const status = hasil.ok
                ? `🏹 Mendapat **${hasil.hewan.nama}** (${hasil.hewan.kelangkaan}), nilai jual ${formatUang(hasil.hewan.nilai)} koin.${hasil.pakaiUmpan ? ' Umpan digunakan.' : ''}`
                : `⏳ Berburu lagi <t:${Math.ceil((Date.now() + hasil.sisaCooldown) / 1000)}:R>.`;
            await interaction.update({
                embeds: [buatDashboardEmbed(guild.id, member, status)],
                components: buatKontrolDashboard(ownerId)
            });
            return;
        }
        if (action === 'zoo') {
            await interaction.update({ embeds: [buatZooEmbed(member, pemain)], components: buatKontrolDashboard(ownerId, 'zoo') });
            return;
        }
        if (action === 'refresh') {
            await interaction.update({ embeds: [buatDashboardEmbed(guild.id, member)], components: buatKontrolDashboard(ownerId) });
            return;
        }
    }

    if (interaction.isButton() && customId.startsWith('dashboard-sell:')) {
        const [, ownerId, aksi] = customId.split(':');
        if (!guild || interaction.user.id !== ownerId || aksi !== 'confirm') {
            await interaction.reply({ content: 'Aksi ini hanya dapat digunakan pemilik dashboard.', ephemeral: true });
            return;
        }
        const server = ambilDataServer(guild.id);
        const pemain = ambilDataPemain(server, ownerId, guild.id);
        const member = await guild.members.fetch(ownerId).catch(error => {
            console.error('Gagal mengambil anggota untuk penjualan zoo:', error);
            return null;
        });
        if (!member) {
            await interaction.reply({ content: 'Anggota tidak ditemukan di server ini.', ephemeral: true });
            return;
        }
        const hasil = jualZoo(pemain, economyData.servers[guild.id], ownerId);
        const status = hasil.ok
            ? `💰 Terjual **${formatUang(hasil.hewanTerjual)} hewan** seharga **${formatUang(hasil.hasilJual)} koin**.`
            : hasil.reason === 'saldo_limit'
                ? '⚠️ Saldo setelah penjualan melewati batas aman; tidak ada hewan yang dijual.'
                : hasil.reason === 'overflow'
                    ? '⚠️ Nilai zoo melewati batas aman; tidak ada hewan yang dijual.'
                    : 'Zoo kamu tidak memiliki hewan yang bisa dijual.';
        await interaction.update({
            embeds: [buatDashboardEmbed(guild.id, member, status)],
            components: buatKontrolDashboard(ownerId)
        });
        return;
    }

    if (interaction.isModalSubmit() && (customId.startsWith('dashboard-transfer:') || customId.startsWith('dashboard-transfer-modal:'))) {
        const isPickerFlow = customId.startsWith('dashboard-transfer-modal:');
        const [, guildId, ownerId, selectedTargetId] = customId.split(':');
        if (!guild || guild.id !== guildId || interaction.user.id !== ownerId) {
            await interaction.reply({ content: 'Form transfer ini tidak berlaku untuk pengguna/server ini.', ephemeral: true });
            return;
        }
        const targetId = isPickerFlow
            ? selectedTargetId
            : (() => {
                const targetText = interaction.fields.getTextInputValue('target').trim();
                return targetText.match(/^<@!?(\d{17,20})>$/)?.[1] || (/^\d{17,20}$/.test(targetText) ? targetText : null);
            })();
        const server = ambilDataServer(guild.id);
        const saldo = economyData.servers[guild.id][ownerId];
        const jumlah = parseJumlah(interaction.fields.getTextInputValue('amount').trim(), saldo);
        if (!targetId || targetId === ownerId || !jumlah) {
            await interaction.reply({ content: 'Penerima atau jumlah tidak valid. Jumlah harus positif, memakai format titik ribuan, atau `all`.', ephemeral: true });
            return;
        }
        const target = await guild.members.fetch(targetId).catch(() => null);
        if (!target || target.user.bot || !cukupSaldo(economyData.servers[guild.id], ownerId, jumlah)) {
            await interaction.reply({ content: 'Penerima tidak valid, merupakan bot, atau saldo koin tidak cukup.', ephemeral: true });
            return;
        }
        const saldoPenerima = economyData.servers[guild.id][targetId] ?? server.settings.startingBalance;
        if (!saldoTidakTerbatas(targetId) && !Number.isSafeInteger(saldoPenerima + jumlah)) {
            await interaction.reply({ content: 'Saldo penerima mencapai batas aman. Transfer dibatalkan.', ephemeral: true });
            return;
        }
        const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
        transferDashboardPending.set(token, { guildId: guild.id, fromId: ownerId, toId: targetId, amount: jumlah });
        setTimeout(() => transferDashboardPending.delete(token), 120000);
        await interaction.reply({
            embeds: [new EmbedBuilder().setColor(THEME_COLOR).setTitle('Konfirmasi Transfer')
                .setDescription(`Kirim **${formatUang(jumlah)} koin** kepada ${target}?\nSaldo setelah transfer: **${saldoTidakTerbatas(ownerId) ? '♾️ Unlimited' : `${formatUang(saldo - jumlah)} koin`}**.`)],
            components: [new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`dashboard-transfer-confirm:${ownerId}:${token}`).setLabel('Konfirmasi Transfer').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`dashboard-transfer-cancel:${ownerId}:${token}`).setLabel('Batalkan').setStyle(ButtonStyle.Secondary)
            )],
            ephemeral: true
        });
        return;
    }

    if (interaction.isButton() && (customId.startsWith('dashboard-transfer-confirm:') || customId.startsWith('dashboard-transfer-cancel:'))) {
        const [prefix, ownerId, token] = customId.split(':');
        const pending = transferDashboardPending.get(token);
        if (interaction.user.id !== ownerId || !pending || pending.guildId !== guild?.id) {
            await interaction.reply({ content: 'Konfirmasi transfer tidak berlaku atau sudah kedaluwarsa.', ephemeral: true });
            return;
        }
        transferDashboardPending.delete(token);
        if (prefix === 'dashboard-transfer-cancel') {
            await interaction.update({ content: 'Transfer dibatalkan.', embeds: [], components: [] });
            return;
        }
        const uangData = economyData.servers[pending.guildId];
        if (!cukupSaldo(uangData, pending.fromId, pending.amount)) {
            await interaction.update({ content: 'Saldo berubah dan tidak lagi cukup. Transfer tidak dilakukan.', embeds: [], components: [] });
            return;
        }
        const server = ambilDataServer(pending.guildId);
        const pemainPengirim = ambilDataPemain(server, pending.fromId, pending.guildId);
        const pemainPenerima = ambilDataPemain(server, pending.toId, pending.guildId);
        const target = await guild.members.fetch(pending.toId).catch(() => null);
        if (!target || target.user.bot) {
            await interaction.update({ content: 'Penerima tidak lagi tersedia di server. Transfer dibatalkan.', embeds: [], components: [] });
            return;
        }
        const saldoPenerima = uangData[pending.toId] ?? server.settings.startingBalance;
        if (!saldoTidakTerbatas(pending.toId) && !Number.isSafeInteger(saldoPenerima + pending.amount)) {
            await interaction.update({ content: 'Saldo penerima telah mencapai batas aman. Transfer dibatalkan.', embeds: [], components: [] });
            return;
        }
        kurangiSaldo(uangData, pending.fromId, pending.amount);
        tambahSaldo(uangData, pending.toId, pending.amount);
        simpanRiwayat(pemainPengirim, 'transfer keluar', -pending.amount, `ke ${target.user.tag}`);
        simpanRiwayat(pemainPenerima, 'transfer masuk', pending.amount, `dari ${interaction.user.tag}`);
        simpanUang();
        simpanOwoState();
        await interaction.update({ content: `✅ Berhasil mengirim **${formatUang(pending.amount)} koin** kepada **${target.user.tag}**.`, embeds: [], components: [] });
        return;
    }

    if (interaction.isStringSelectMenu() && customId.startsWith('help-select:')) {
        const [, mode, guildIdHelp, userIdHelp] = customId.split(':');
        const adminMode = mode === 'admin';
        const pemilikId = adminMode ? userIdHelp : mode === 'public' ? guildIdHelp : mode;
        const targetGuildId = adminMode ? guildIdHelp : null;
        if (interaction.user.id !== pemilikId) {
            await interaction.reply({
                content: 'Menu bantuan ini dibuka oleh orang lain. Jalankan `ltn help` untuk membuka menu milikmu.',
                ephemeral: true
            });
            return;
        }
        let guildHelp = interaction.guild;
        if (adminMode) {
            if (!targetGuildId) {
                await interaction.reply({ content: 'Menu admin tidak valid. Jalankan `ltn help admin` dari server.', ephemeral: true });
                return;
            }
            try {
                guildHelp = await client.guilds.fetch(targetGuildId);
                const member = await guildHelp.members.fetch(pemilikId);
                if (!member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                    await interaction.reply({ content: 'Akses bantuan admin dicabut karena kamu tidak lagi memiliki izin Manage Server.', ephemeral: true });
                    return;
                }
            } catch (error) {
                console.error('Gagal memverifikasi akses menu bantuan admin:', error);
                await interaction.reply({ content: 'Akses bantuan admin tidak dapat diverifikasi. Jalankan kembali `ltn help admin` di server.', ephemeral: true });
                return;
            }
        }
        const kategori = interaction.values[0];
        const kategoriYangDiizinkan = adminMode ? kategoriHelpAdmin : kategoriHelpPublik;
        if (!kategoriYangDiizinkan[kategori]) {
            await interaction.reply({ content: 'Kategori bantuan tidak dikenal. Buka kembali dengan `ltn help`.', ephemeral: true });
            return;
        }
        await interaction.update({
            embeds: [buatHelpEmbed(kategori, adminMode)],
            components: buatMenuHelp(pemilikId, kategori, adminMode, targetGuildId)
        });
        return;
    }

    if (customId.startsWith('verify:') && interaction.isButton()) {
        if (!guild || customId !== `verify:${guild.id}`) {
            await interaction.reply({ content: 'Panel verifikasi ini tidak berlaku di server ini.', ephemeral: true });
            return;
        }
        const roleId = ambilDataServer(guild.id).settings.verifyRoleId;
        const role = roleId && guild.roles.cache.get(roleId);
        const member = await guild.members.fetch(interaction.user.id).catch(error => {
            console.error('Gagal mencari anggota untuk verifikasi:', error);
            return null;
        });
        if (!member || !role) {
            await interaction.reply({ content: 'Role verifikasi tidak tersedia. Hubungi admin server.', ephemeral: true });
            return;
        }
        if (member.roles.cache.has(role.id)) {
            await interaction.reply({ content: '✅ Kamu sudah terverifikasi.', ephemeral: true });
            return;
        }
        try {
            await member.roles.add(role, 'Verifikasi anggota melalui panel');
            await interaction.reply({ content: `✅ Berhasil diverifikasi dan mendapatkan role ${role}.`, ephemeral: true });
        } catch (error) {
            console.error('Gagal memberikan role verifikasi:', error);
            await interaction.reply({ content: '❌ Verifikasi gagal. Admin perlu memeriksa izin Manage Roles dan hierarki role bot.', ephemeral: true });
        }
        return;
    }

    if ((customId.startsWith('ticket-panel:') || customId.startsWith('request-panel:')) && interaction.isButton()) {
        const isLegacyPanel = customId.startsWith('request-panel:');
        const [, targetGuildId, selectedType] = isLegacyPanel
            ? ['request-panel', customId.slice('request-panel:'.length), 'update']
            : customId.split(':');
        const server = guild && ambilDataServer(guild.id);
        if (!guild || targetGuildId !== guild.id ||
            (server.settings.requestPanelChannelId || server.settings.requestChannelId) !== interaction.channelId ||
            server.settings.requestPanelMessageId !== interaction.message.id) {
            await interaction.reply({ content: 'Panel Ticket ini sudah tidak aktif. Hubungi admin server untuk memasang panel baru.', ephemeral: true });
            return;
        }
        if (!TICKET_TYPE_LABELS[selectedType]) {
            await interaction.reply({ content: 'Jenis Ticket tidak dikenal. Gunakan panel Ticket terbaru.', ephemeral: true });
            return;
        }
        const modal = new ModalBuilder()
            .setCustomId(`ticket-modal:${guild.id}:${interaction.user.id}:${interaction.channelId}:${interaction.message.id}:${selectedType}`)
            .setTitle(`Ticket: ${TICKET_TYPE_LABELS[selectedType]}`)
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('title')
                        .setLabel('Judul ticket')
                        .setPlaceholder('Ringkas inti laporan atau pesanmu')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setMaxLength(100)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('detail')
                        .setLabel('Detail ticket')
                        .setPlaceholder('Jelaskan laporan, ide update, atau hal yang ingin disampaikan')
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true)
                        .setMaxLength(1500)
                )
            );
        await interaction.showModal(modal);
        return;
    }

    if (interaction.isModalSubmit() && customId.startsWith('ticket-modal:')) {
        const [, targetGuildId, requesterId, panelChannelId, panelMessageId, ticketType] = customId.split(':');
        if (!guild || targetGuildId !== guild.id || requesterId !== interaction.user.id) {
            await interaction.reply({ content: 'Form Ticket ini tidak berlaku untuk pengguna/server ini.', ephemeral: true });
            return;
        }
        if (!TICKET_TYPE_LABELS[ticketType]) {
            await interaction.reply({ content: 'Jenis Ticket tidak dikenal. Gunakan panel Ticket terbaru.', ephemeral: true });
            return;
        }
        const server = ambilDataServer(guild.id);
        const channelId = server.settings.requestChannelId;
        const configuredPanelChannelId = server.settings.requestPanelChannelId || channelId;
        if (configuredPanelChannelId !== panelChannelId ||
            interaction.channelId !== panelChannelId ||
            server.settings.requestPanelMessageId !== panelMessageId) {
            await interaction.reply({ content: 'Panel Ticket sudah dinonaktifkan atau diperbarui. Gunakan panel terbaru untuk mengirim ticket.', ephemeral: true });
            return;
        }
        const channel = channelId && await guild.channels.fetch(channelId).catch(error => {
            console.error('Gagal mencari channel daftar ticket:', error);
            return null;
        });
        if (!channel || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) {
            await interaction.reply({ content: 'Channel daftar Ticket belum diatur atau tidak tersedia. Hubungi admin server.', ephemeral: true });
            return;
        }
        const title = interaction.fields.getTextInputValue('title').trim();
        const detail = interaction.fields.getTextInputValue('detail').trim();
        if (!title || !detail) {
            await interaction.reply({ content: 'Judul dan detail Ticket tidak boleh kosong.', ephemeral: true });
            return;
        }
        const ticketId = `LTN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
        const ticketEmbed = new EmbedBuilder()
            .setColor(THEME_COLOR)
            .setTitle(`🎫 [${TICKET_TYPE_LABELS[ticketType]}] ${title}`.slice(0, 256))
            .setAuthor({ name: 'Ticket Anonim' })
            .setDescription(detail)
            .addFields(
                { name: 'Ticket ID', value: `\`${ticketId}\``, inline: true },
                { name: 'Status', value: 'Baru', inline: true },
                { name: 'Jenis', value: TICKET_TYPE_LABELS[ticketType], inline: true },
                { name: 'Pengirim', value: 'Anonim (identitas hanya untuk admin)', inline: true }
            )
            .setTimestamp();
        try {
            await channel.send({
                embeds: [ticketEmbed],
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`ticket-sender:${guild.id}:${interaction.user.id}:${ticketId}`)
                            .setLabel('Lihat Pengirim')
                            .setEmoji('🔒')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId(`ticket-reply:${guild.id}:${interaction.user.id}:${ticketId}`)
                            .setLabel('Balas Ticket')
                            .setEmoji('↩️')
                            .setStyle(ButtonStyle.Primary)
                    )
                ],
                allowedMentions: { parse: [] }
            });
        } catch (error) {
            console.error(`Gagal mengirim Ticket ${ticketId}:`, error);
            await interaction.reply({ content: 'Ticket gagal dikirim. Admin perlu memeriksa izin bot di channel daftar Ticket.', ephemeral: true });
            return;
        }
        await interaction.reply({ content: `✅ Ticket \`${ticketId}\` (${TICKET_TYPE_LABELS[ticketType]}) berhasil dikirim ke tim admin. Admin dapat membalas melalui tombol pada ticket.`, ephemeral: true });
        return;
    }

    if (interaction.isButton() && customId.startsWith('ticket-sender:')) {
        const [, targetGuildId, requesterId, ticketId] = customId.split(':');
        if (!guild || targetGuildId !== guild.id ||
            !interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
            await interaction.reply({ content: 'Identitas pengirim ticket hanya dapat dilihat oleh admin server.', ephemeral: true });
            return;
        }
        const server = ambilDataServer(guild.id);
        const channelId = server.settings.requestChannelId;
        if (channelId !== interaction.channelId) {
            await interaction.reply({ content: 'Identitas hanya dapat dibuka dari channel daftar Ticket yang dikonfigurasi.', ephemeral: true });
            return;
        }
        const ticketEmbed = interaction.message.embeds[0];
        const ticketIdField = ticketEmbed?.fields.find(field => field.name === 'Ticket ID')?.value;
        const requesterField = ticketEmbed?.fields.find(field => field.name === 'Pengirim')?.value;
        if (ticketIdField !== `\`${ticketId}\`` ||
            requesterField !== 'Anonim (identitas hanya untuk admin)') {
            await interaction.reply({ content: 'Ticket tidak ditemukan atau detailnya tidak cocok.', ephemeral: true });
            return;
        }
        try {
            const requester = await client.users.fetch(requesterId);
            await interaction.reply({
                content: `🔒 Pengirim ticket \`${ticketId}\`: **${requester.tag}** (<@${requester.id}>)`,
                allowedMentions: { parse: [] },
                ephemeral: true
            });
        } catch (error) {
            console.error(`Gagal mencari pengirim Ticket ${ticketId}:`, error);
            await interaction.reply({ content: 'Identitas pengirim tidak dapat diambil saat ini.', ephemeral: true });
        }
        return;
    }

    if (interaction.isButton() && customId.startsWith('ticket-reply:')) {
        const [, targetGuildId, requesterId, ticketId] = customId.split(':');
        const hasManageGuild = interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild);
        const server = guild && ambilDataServer(guild.id);
        const ticketEmbed = interaction.message.embeds[0];
        const ticketIdField = ticketEmbed?.fields.find(field => field.name === 'Ticket ID')?.value;
        const requesterField = ticketEmbed?.fields.find(field => field.name === 'Pengirim')?.value;
        if (!guild || targetGuildId !== guild.id ||
            !hasManageGuild ||
            server.settings.requestChannelId !== interaction.channelId ||
            ticketIdField !== `\`${ticketId}\`` ||
            requesterField !== 'Anonim (identitas hanya untuk admin)') {
            await interaction.reply({ content: 'Tombol balas Ticket hanya berlaku untuk admin di channel daftar Ticket yang benar.', ephemeral: true });
            return;
        }
        const modal = new ModalBuilder()
            .setCustomId(`ticket-reply-modal:${guild.id}:${requesterId}:${ticketId}:${interaction.message.id}`)
            .setTitle(`Balas Ticket ${ticketId}`.slice(0, 45))
            .addComponents(new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('response')
                    .setLabel('Pesan balasan')
                    .setPlaceholder('Tulis balasan untuk pengirim ticket')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
                    .setMaxLength(1500)
            ));
        await interaction.showModal(modal);
        return;
    }

    if (interaction.isModalSubmit() && customId.startsWith('ticket-reply-modal:')) {
        const [, targetGuildId, requesterId, ticketId, ticketMessageId] = customId.split(':');
        if (!guild || targetGuildId !== guild.id ||
            !interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
            await interaction.reply({ content: 'Balasan Ticket hanya dapat dikirim oleh admin dengan izin Manage Server.', ephemeral: true });
            return;
        }
        const server = ambilDataServer(guild.id);
        const channelId = server.settings.requestChannelId;
        const channel = channelId && await guild.channels.fetch(channelId).catch(error => {
            console.error(`Gagal mencari channel untuk membalas Ticket ${ticketId}:`, error);
            return null;
        });
        if (!channel || channel.id !== interaction.channelId || !channel.messages) {
            await interaction.reply({ content: 'Channel daftar Ticket tidak tersedia. Hubungi admin server.', ephemeral: true });
            return;
        }
        const ticketMessage = await channel.messages.fetch(ticketMessageId).catch(error => {
            console.error(`Gagal mencari Ticket ${ticketId} untuk dibalas:`, error);
            return null;
        });
        const ticketEmbed = ticketMessage?.embeds[0];
        const ticketIdField = ticketEmbed?.fields.find(field => field.name === 'Ticket ID')?.value;
        const requesterField = ticketEmbed?.fields.find(field => field.name === 'Pengirim')?.value;
        if (!ticketMessage || ticketIdField !== `\`${ticketId}\`` ||
            requesterField !== 'Anonim (identitas hanya untuk admin)') {
            await interaction.reply({ content: 'Ticket tidak ditemukan atau detailnya tidak cocok. Balasan tidak dikirim.', ephemeral: true });
            return;
        }
        const response = interaction.fields.getTextInputValue('response').trim();
        if (!response) {
            await interaction.reply({ content: 'Pesan balasan tidak boleh kosong.', ephemeral: true });
            return;
        }
        const replyEmbed = new EmbedBuilder()
            .setColor(THEME_COLOR)
            .setTitle(`↩️ Balasan Ticket ${ticketId}`)
            .setAuthor({ name: `Dibalas oleh ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
            .setDescription(response)
            .setTimestamp();
        try {
            await channel.send({
                embeds: [replyEmbed],
                allowedMentions: { parse: [] }
            });
        } catch (error) {
            console.error(`Gagal mencatat balasan Ticket ${ticketId}:`, error);
            await interaction.reply({ content: 'Balasan gagal dicatat di channel Ticket. Coba lagi setelah izin bot diperiksa.', ephemeral: true });
            return;
        }
        const fields = ticketEmbed.fields.map(field => field.name === 'Status' ? { ...field, value: 'Direspon' } : field);
        try {
            await ticketMessage.edit({ embeds: [EmbedBuilder.from(ticketEmbed).setFields(fields)] });
        } catch (error) {
            console.error(`Balasan Ticket ${ticketId} tercatat, tetapi status ticket gagal diperbarui:`, error);
        }
        try {
            const requester = await client.users.fetch(requesterId);
            await requester.send({
                embeds: [new EmbedBuilder()
                    .setColor(THEME_COLOR)
                    .setTitle(`Balasan Ticket ${ticketId}`)
                    .setDescription(response)
                    .setFooter({ text: `Server: ${guild.name} • Dibalas oleh ${interaction.user.tag}` })
                    .setTimestamp()],
                allowedMentions: { parse: [] }
            });
        } catch (error) {
            console.error(`Balasan Ticket ${ticketId} tercatat, tetapi DM pengirim gagal dikirim:`, error);
            await interaction.reply({ content: `✅ Balasan Ticket \`${ticketId}\` sudah tercatat di channel, tetapi DM pengirim gagal dikirim.`, ephemeral: true });
            return;
        }
        await interaction.reply({ content: `✅ Balasan Ticket \`${ticketId}\` dicatat di channel dan dikirim melalui DM ke pengirim.`, ephemeral: true });
        return;
    }

    if (customId.startsWith('report:') && interaction.isButton()) {
        if (!guild || customId !== `report:${guild.id}`) {
            await interaction.reply({ content: 'Panel laporan ini tidak berlaku di server ini.', ephemeral: true });
            return;
        }
        const modal = new ModalBuilder().setCustomId(`report-modal:${guild.id}`).setTitle('Kirim Laporan');
        const target = new TextInputBuilder().setCustomId('target').setLabel('Anggota yang dilaporkan (mention/ID)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(30);
        const detail = new TextInputBuilder().setCustomId('detail').setLabel('Jelaskan laporan dan bukti').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000);
        modal.addComponents(
            new ActionRowBuilder().addComponents(target),
            new ActionRowBuilder().addComponents(detail)
        );
        await interaction.showModal(modal);
        return;
    }

    if (customId.startsWith('admincfg:') && interaction.isButton()) {
        const [, action, targetGuildId] = customId.split(':');
        if (!guild || targetGuildId !== guild.id || !interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
            await interaction.reply({ content: '❌ Panel ini hanya dapat digunakan admin server yang memiliki izin Manage Server.', ephemeral: true });
            return;
        }
        const labels = {
            welcome: ['Atur Welcome', 'Mention channel teks atau off'],
            goodbye: ['Atur Goodbye', 'Mention channel teks atau off'],
            autorole: ['Atur Auto-role', 'Mention role atau off'],
            report: ['Atur Channel Laporan', 'Mention channel teks tujuan'],
            verify: ['Atur Role Verifikasi', 'Mention role untuk verifikasi'],
            modlog: ['Atur Log Moderasi', 'Mention channel teks atau off']
        }[action];
        if (!labels) {
            await interaction.reply({ content: 'Aksi panel admin tidak dikenali.', ephemeral: true });
            return;
        }
        const modal = new ModalBuilder().setCustomId(`admincfg-modal:${action}:${guild.id}`).setTitle(labels[0]);
        const input = new TextInputBuilder().setCustomId('value').setLabel(labels[1]).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
        return;
    }

    if (interaction.isModalSubmit() && customId.startsWith('report-modal:')) {
        if (!guild || customId !== `report-modal:${guild.id}`) {
            await interaction.reply({ content: 'Form laporan ini tidak berlaku di server ini.', ephemeral: true });
            return;
        }
        const server = ambilDataServer(guild.id);
        const channelId = server.settings.reportChannelId || modLogConfig[guild.id];
        const channel = channelId && await guild.channels.fetch(channelId).catch(error => {
            console.error('Gagal mencari channel laporan:', error);
            return null;
        });
        if (!channel?.isTextBased()) {
            await interaction.reply({ content: 'Channel laporan belum diatur. Hubungi admin server.', ephemeral: true });
            return;
        }
        const targetText = interaction.fields.getTextInputValue('target').trim();
        const targetId = targetText.match(/^<@!?(\d{17,20})>$/)?.[1] || (/^\d{17,20}$/.test(targetText) ? targetText : null);
        const detail = interaction.fields.getTextInputValue('detail').trim();
        try {
            await channel.send({
                embeds: [new EmbedBuilder().setColor(THEME_COLOR).setTitle('🚩 Laporan Anggota')
                    .addFields(
                        { name: 'Pelapor', value: `${interaction.user} (\`${interaction.user.tag}\`)` },
                        { name: 'Target', value: targetId ? `<@${targetId}> (\`${targetId}\`)` : (targetText || 'Tidak disebutkan') },
                        { name: 'Detail', value: detail.slice(0, 1000) }
                    ).setTimestamp()],
                allowedMentions: { parse: [] }
            });
            catatLogMod(guild.id, `🚩 Laporan baru dikirim oleh ${interaction.user.tag}. Target: ${targetId || 'tidak disebutkan'}.`);
            await interaction.reply({ content: '✅ Laporan berhasil dikirim secara rahasia kepada tim moderasi.', ephemeral: true });
        } catch (error) {
            console.error('Gagal meneruskan laporan anggota:', error);
            await interaction.reply({ content: '❌ Laporan gagal dikirim. Coba lagi atau hubungi admin.', ephemeral: true });
        }
        return;
    }

    if (interaction.isModalSubmit() && customId.startsWith('admincfg-modal:')) {
        const [, action, targetGuildId] = customId.split(':');
        if (!guild || targetGuildId !== guild.id || !interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
            await interaction.reply({ content: '❌ Hanya admin dengan izin Manage Server yang dapat mengubah pengaturan ini.', ephemeral: true });
            return;
        }
        const server = ambilDataServer(guild.id);
        const value = interaction.fields.getTextInputValue('value').trim();
        const channelId = value.match(/^<#(\d{17,20})>$/)?.[1];
        const roleId = value.match(/^<@&(\d{17,20})>$/)?.[1];
        if (action === 'welcome' || action === 'goodbye') {
            const key = `${action}ChannelId`;
            if (value.toLowerCase() === 'off') delete server.settings[key];
            else if (!channelId || !guild.channels.cache.get(channelId)?.isTextBased()) {
                await interaction.reply({ content: 'Masukkan mention channel teks yang valid atau `off`.', ephemeral: true });
                return;
            } else server.settings[key] = channelId;
            simpanOwoState();
            await interaction.reply({ content: `✅ Pengaturan ${action} berhasil diperbarui.`, ephemeral: true });
            return;
        }
        if (action === 'autorole' || action === 'verify') {
            const key = action === 'autorole' ? 'autoroleId' : 'verifyRoleId';
            if (value.toLowerCase() === 'off' && action === 'autorole') delete server.settings[key];
            else if (!roleId || !guild.roles.cache.has(roleId)) {
                await interaction.reply({ content: 'Masukkan mention role yang valid.', ephemeral: true });
                return;
            } else server.settings[key] = roleId;
            simpanOwoState();
            await interaction.reply({ content: `✅ Pengaturan role ${action} berhasil diperbarui.`, ephemeral: true });
            return;
        }
        if (action === 'report' || action === 'modlog') {
            if (action === 'modlog' && value.toLowerCase() === 'off') {
                delete modLogConfig[guild.id];
                fs.writeFileSync(PATH_MOD_LOG, JSON.stringify(modLogConfig, null, 2));
            } else if (!channelId || !guild.channels.cache.get(channelId)?.isTextBased()) {
                await interaction.reply({ content: 'Masukkan mention channel teks yang valid' + (action === 'modlog' ? ' atau `off`.' : '.'), ephemeral: true });
                return;
            } else if (action === 'report') server.settings.reportChannelId = channelId;
            else modLogConfig[guild.id] = channelId;
            simpanOwoState();
            if (action === 'modlog') fs.writeFileSync(PATH_MOD_LOG, JSON.stringify(modLogConfig, null, 2));
            await interaction.reply({ content: `✅ Pengaturan ${action} berhasil diperbarui.`, ephemeral: true });
            return;
        }
        await interaction.reply({ content: 'Aksi konfigurasi tidak dikenal.', ephemeral: true });
        return;
    }

    const sharedPanel = interaction.isButton() && interaction.customId.startsWith('tempvoice-shared:');
    const prefix = sharedPanel
        ? 'tempvoice-shared:'
        : interaction.isButton()
            ? 'tempvoice:'
            : interaction.isUserSelectMenu()
                ? 'tempvoice-user:'
                : 'tempvoice-modal:';
    if (!interaction.customId.startsWith(prefix)) return;

    let action;
    let roomId;
    let panelOwnerId;
    if (!guild) {
        await interaction.reply({ content: 'Panel hanya dapat digunakan di server.', ephemeral: true });
        return;
    }

    const server = ambilDataServer(guild.id);
    if (sharedPanel) {
        const [, sharedAction, targetGuildId] = interaction.customId.split(':');
        if (
            targetGuildId !== guild.id ||
            server.voice.panelChannelId !== interaction.channelId ||
            server.voice.panelMessageId !== interaction.message.id
        ) {
            await interaction.reply({ content: 'Panel voice bersama ini sudah tidak aktif. Minta admin mengirim panel terbaru.', ephemeral: true });
            return;
        }
        action = sharedAction;
        roomId = interaction.member?.voice?.channelId;
        if (!roomId) {
            await interaction.reply({ content: 'Masuk ke voice sementara milikmu terlebih dahulu untuk menggunakan panel bersama.', ephemeral: true });
            return;
        }
    } else {
        const parts = interaction.customId.split(':');
        [, action, roomId, panelOwnerId] = parts;
    }
    const ownerId = server.voice.rooms[roomId];
    const room = guild.channels.cache.get(roomId);
    if (!ownerId || !room || room.type !== ChannelType.GuildVoice) {
        await interaction.reply({ content: 'Voice sementara ini sudah tidak tersedia.', ephemeral: true });
        return;
    }

    const isOwner = interaction.user.id === ownerId;
    if (sharedPanel && !isOwner && action !== 'claim') {
        await interaction.reply({ content: `Panel ini hanya dapat digunakan pemilik voice (<@${ownerId}>).`, ephemeral: true });
        return;
    }
    if (action === 'claim') {
        const pemilikLama = room.members.get(ownerId);
        if (pemilikLama) {
            await interaction.reply({ content: 'Pemilik voice masih berada di channel. Minta pemilik memakai tombol Transfer.', ephemeral: true });
            return;
        }
        if (!room.members.has(interaction.user.id)) {
            await interaction.reply({ content: 'Untuk mengambil alih voice, kamu harus berada di dalam channel tersebut.', ephemeral: true });
            return;
        }
        try {
            await room.permissionOverwrites.edit(interaction.user.id, {
                ViewChannel: true,
                Connect: true,
                Speak: true
            });
            server.voice.rooms[roomId] = interaction.user.id;
            simpanOwoState();
            catatAksiPanelVoice(guild.id, room, interaction.user, 'mengklaim kepemilikan voice');
            await interaction.reply({ content: `👑 Kamu sekarang pemilik **${room.name}**.`, ephemeral: true });
        } catch (error) {
            console.error('Gagal mengklaim voice sementara:', error);
            await interaction.reply({ content: '❌ Gagal mengambil alih voice. Periksa izin bot.', ephemeral: true });
        }
        return;
    }

    if (!isOwner) {
        await interaction.reply({ content: `Panel ini hanya dapat digunakan pemilik voice (<@${ownerId}>).`, ephemeral: true });
        return;
    }

    if (interaction.isButton() && action === 'info') {
        const everyoneOverwrite = room.permissionOverwrites.cache.get(guild.roles.everyone.id);
        const embed = new EmbedBuilder()
            .setColor(THEME_COLOR)
            .setTitle('Voice Room Information')
            .setDescription(`Informasi untuk **${room.name}**.`)
            .addFields(
                { name: 'Owner', value: `<@${ownerId}>`, inline: true },
                { name: 'Members', value: `${room.members.size}`, inline: true },
                { name: 'User limit', value: room.userLimit ? `${room.userLimit}` : 'Unlimited', inline: true },
                {
                    name: 'Privacy',
                    value: everyoneOverwrite?.deny.has(PermissionsBitField.Flags.ViewChannel) ? 'Private' : 'Public',
                    inline: true
                }
            );
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
    }

    if (interaction.isButton() && action === 'log') {
        const events = (adminLogs[guild.id] || [])
            .filter(item => item?.type === 'voice-panel' && typeof item.text === 'string' && item.text.includes(`(${room.id})`))
            .slice(-8)
            .reverse();
        const embed = new EmbedBuilder()
            .setColor(THEME_COLOR)
            .setTitle(`Voice Room Log • ${room.name}`)
            .setDescription(events.length
                ? events.map(item => `• <t:${Math.floor(item.at / 1000)}:t> ${amanUntukTeksDiscord(item.text.replace(/^🔊 \[VOICE PANEL\] /, '').replace(` (${room.id}).`, ''))}`).join('\n').slice(0, 4000)
                : 'Belum ada aktivitas panel yang tercatat untuk room ini.');
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
    }

    if (interaction.isUserSelectMenu()) {
        const actionsAnggota = ['trust', 'untrust', 'invite', 'kick', 'block', 'unblock', 'transfer'];
        if (panelOwnerId !== ownerId || !actionsAnggota.includes(action) || interaction.values.length !== 1) {
            await interaction.reply({ content: 'Pilihan anggota tidak valid. Buka kembali panel voice dan coba lagi.', ephemeral: true });
            return;
        }
        try {
            await interaction.deferUpdate();
            await jalankanAksiAnggotaVoice(interaction, room, action, interaction.values[0], server, ownerId);
            await interaction.editReply({ content: 'Pilihan anggota sudah diproses.', components: [] });
        } catch (error) {
            console.error(`Gagal menjalankan aksi voice ${action} dari menu anggota:`, error);
            await interaction.followUp({ content: '❌ Aksi gagal diterapkan. Pastikan bot memiliki izin yang dibutuhkan.', ephemeral: true }).catch(replyError => {
                console.error('Gagal mengirim respons error menu anggota voice:', replyError);
            });
            await interaction.editReply({ content: 'Aksi gagal. Pilih anggota melalui panel untuk mencoba lagi.', components: [] }).catch(replyError => {
                console.error('Gagal menonaktifkan menu anggota voice:', replyError);
            });
        }
        return;
    }

    if (interaction.isButton() && ['name', 'limit', 'trust', 'untrust', 'invite', 'kick', 'block', 'unblock', 'transfer', 'delete', 'reset'].includes(action)) {
        if (['trust', 'untrust', 'invite', 'kick', 'block', 'unblock', 'transfer'].includes(action)) {
            const instruksi = action === 'transfer' || action === 'kick'
                ? 'Cari nama anggota, lalu pilih. Anggota harus sedang berada di voice channel ini.'
                : 'Cari nama anggota di kotak pencarian Discord, lalu pilih dari daftar.';
            await interaction.reply({
                content: `${instruksi}\nPilihan anggota hanya dapat digunakan oleh pemilik voice dan berlaku untuk **${room.name}**.`,
                components: [buatMenuPilihAnggotaVoice(action, roomId, ownerId)],
                ephemeral: true
            });
            return;
        }
        const modal = buatModalVoice(action, roomId);
        await interaction.showModal(modal);
        return;
    }

    if (interaction.isButton()) {
        try {
            const everyoneId = guild.roles.everyone.id;
            const everyoneOverwrite = room.permissionOverwrites.cache.get(everyoneId);

            if (action === 'privacy') {
                const isPrivate = everyoneOverwrite?.deny.has(PermissionsBitField.Flags.ViewChannel) || false;
                await room.permissionOverwrites.edit(everyoneId, {
                    ViewChannel: isPrivate ? null : false,
                    Connect: isPrivate ? null : false
                });
                await room.permissionOverwrites.edit(ownerId, {
                    ViewChannel: true,
                    Connect: true,
                    Speak: true
                });
                catatAksiPanelVoice(guild.id, room, interaction.user, isPrivate ? 'membuka privasi room' : 'mengaktifkan privasi room');
                await interaction.reply({ content: isPrivate ? '🔓 Room sekarang terlihat oleh semua anggota.' : '🔒 Room sekarang privat; hanya anggota yang diundang/trusted dapat melihatnya.', ephemeral: true });
                return;
            }

            if (action === 'delete') {
                await interaction.reply({ content: 'Gunakan form konfirmasi yang dibuka untuk menghapus voice.', ephemeral: true });
                return;
            }

            await interaction.reply({ content: 'Tombol tidak dikenali.', ephemeral: true });
        } catch (error) {
            console.error(`Gagal menjalankan tombol voice ${action}:`, error);
            await interaction.reply({ content: '❌ Pengaturan voice gagal diterapkan. Periksa izin **Manage Channels** bot.', ephemeral: true }).catch(replyError => {
                console.error('Gagal mengirim respons error panel voice:', replyError);
            });
        }
        return;
    }

    const nilai = interaction.fields.getTextInputValue('value').trim();
    try {
        if (action === 'delete') {
            if (nilai !== 'DELETE') {
                await interaction.reply({ content: 'Konfirmasi tidak cocok. Voice tidak dihapus.', ephemeral: true });
                return;
            }
            catatAksiPanelVoice(guild.id, room, interaction.user, 'menghapus voice sementara');
            await interaction.reply({ content: '🗑️ Menghapus voice sementara...', ephemeral: true });
            await room.delete(`Dihapus pemilik ${interaction.user.tag}`);
            return;
        }

        if (action === 'reset') {
            if (nilai !== 'RESET') {
                await interaction.reply({ content: 'Konfirmasi tidak cocok. Pengaturan voice tidak diubah.', ephemeral: true });
                return;
            }
            const pemilik = await guild.members.fetch(ownerId);
            await room.edit({
                name: `🔊 ${pemilik.displayName}`.slice(0, 100),
                userLimit: 0,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect]
                    },
                    {
                        id: ownerId,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak]
                    }
                ]
            }, `Reset pengaturan oleh ${interaction.user.tag}`);
            catatAksiPanelVoice(guild.id, room, interaction.user, 'mereset pengaturan voice');
            await interaction.reply({ content: '✅ Pengaturan direset. Izin khusus anggota dan batas pengguna dikembalikan ke default.', ephemeral: true });
            return;
        }

        if (action === 'name') {
            if (!nilai || nilai.length > 100) {
                await interaction.reply({ content: 'Nama channel harus berisi 1–100 karakter.', ephemeral: true });
                return;
            }
            await room.setName(nilai);
            catatAksiPanelVoice(guild.id, room, interaction.user, `mengubah nama channel menjadi ${nilai}`);
            await interaction.reply({ content: `✅ Nama channel diubah menjadi **${nilai}**.`, ephemeral: true });
            return;
        }

        if (action === 'limit') {
            const jumlah = Number(nilai);
            if (!Number.isInteger(jumlah) || jumlah < 0 || jumlah > 99) {
                await interaction.reply({ content: 'Batas anggota harus 0–99 (0 berarti tanpa batas).', ephemeral: true });
                return;
            }
            await room.setUserLimit(jumlah);
            catatAksiPanelVoice(guild.id, room, interaction.user, `mengatur batas anggota menjadi ${jumlah || 'tanpa batas'}`);
            await interaction.reply({ content: `✅ Batas anggota diatur ke **${jumlah || 'tanpa batas'}**.`, ephemeral: true });
            return;
        }

        const targetId = nilai.match(/^<@!?(\d{17,20})>$/)?.[1] || ( /^\d{17,20}$/.test(nilai) ? nilai : null );
        if (!targetId) {
            await interaction.reply({ content: 'Masukkan mention atau ID anggota Discord yang valid.', ephemeral: true });
            return;
        }
        const target = await guild.members.fetch(targetId).catch(() => null);
        if (!target || target.user.bot || target.id === ownerId) {
            await interaction.reply({ content: 'Anggota tidak valid atau merupakan pemilik channel.', ephemeral: true });
            return;
        }

        if (action === 'transfer' && target.voice.channelId !== roomId) {
            await interaction.reply({ content: 'Anggota yang menerima kepemilikan harus sedang berada di room ini.', ephemeral: true });
            return;
        }

        if (action === 'kick') {
            if (target.voice.channelId !== roomId) {
                await interaction.reply({ content: 'Anggota tersebut tidak berada di room ini.', ephemeral: true });
                return;
            }
            await target.voice.disconnect('Dikeluarkan oleh pemilik voice sementara');
            await interaction.reply({ content: `👢 ${target.user.tag} dikeluarkan dari room.`, ephemeral: true });
            return;
        }

        if (action === 'trust' || action === 'invite' || action === 'untrust' || action === 'block' || action === 'unblock') {
            if (action === 'untrust' || action === 'unblock') {
                await room.permissionOverwrites.delete(target.id);
                await interaction.reply({ content: `✅ Izin khusus ${target.user.tag} dihapus.`, ephemeral: true });
                return;
            }
            await room.permissionOverwrites.edit(target.id, action === 'block'
                ? { ViewChannel: false, Connect: false }
                : { ViewChannel: true, Connect: true, Speak: true });
            await interaction.reply({
                content: action === 'block'
                    ? `⛔ ${target.user.tag} diblokir dari room.`
                    : `✅ ${target.user.tag} sekarang dapat melihat dan masuk ke room.`,
                ephemeral: true
            });
            return;
        }

        if (action === 'transfer') {
            await room.permissionOverwrites.edit(target.id, { ViewChannel: true, Connect: true, Speak: true });
            await room.permissionOverwrites.edit(ownerId, { ViewChannel: null, Connect: null, Speak: null });
            server.voice.rooms[roomId] = target.id;
            simpanOwoState();
            await interaction.reply({ content: `👑 Kepemilikan room dipindahkan ke ${target}.`, ephemeral: true });
            return;
        }

        await interaction.reply({ content: 'Aksi panel tidak dikenali.', ephemeral: true });
    } catch (error) {
        console.error(`Gagal menjalankan aksi panel voice ${action}:`, error);
        await interaction.reply({ content: '❌ Pengaturan gagal diterapkan. Pastikan bot memiliki izin yang dibutuhkan.', ephemeral: true }).catch(replyError => {
            console.error('Gagal mengirim respons error modal voice:', replyError);
        });
    }
});

client.on('guildMemberAdd', async member => {
    if (member.user.bot) return;
    const settings = ambilDataServer(member.guild.id).settings;
    if (settings.autoroleId) {
        const role = member.guild.roles.cache.get(settings.autoroleId);
        if (role) {
            try {
                await member.roles.add(role, 'Auto-role anggota baru');
            } catch (error) {
                console.error(`Gagal memberikan auto-role kepada ${member.user.tag}:`, error);
            }
        } else {
            console.error(`Role auto-role ${settings.autoroleId} tidak ditemukan di server ${member.guild.id}.`);
        }
    }
    if (settings.welcomeChannelId) {
        const channel = member.guild.channels.cache.get(settings.welcomeChannelId);
        if (channel?.isTextBased()) {
            try {
                await channel.send(await buatPesanMember(member, settings, 'welcome'));
            } catch (error) {
                console.error('Gagal mengirim pesan welcome:', error);
            }
        } else {
            console.error(`Channel welcome ${settings.welcomeChannelId} tidak tersedia di server ${member.guild.id}.`);
        }
    }
});

client.on('guildMemberRemove', async member => {
    if (member.user.bot) return;
    const settings = ambilDataServer(member.guild.id).settings;
    if (!settings.goodbyeChannelId) return;
    let channel;
    try {
        channel = await member.guild.channels.fetch(settings.goodbyeChannelId);
    } catch (error) {
        console.error(`Gagal mengambil channel goodbye ${settings.goodbyeChannelId} di server ${member.guild.id}:`, error);
        return;
    }
    if (!channel?.isTextBased() || typeof channel.send !== 'function') {
        console.error(`Channel goodbye ${settings.goodbyeChannelId} tidak tersedia di server ${member.guild.id}.`);
        return;
    }
    try {
        await channel.send(await buatPesanMember(member, settings, 'goodbye'));
    } catch (error) {
        console.error('Gagal mengirim pesan goodbye:', error);
    }
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    let acquiredLockKey;
    try {
        const memberVoice = newState.member || oldState.member;
        const guild = newState.guild || oldState.guild;
        if (!guild) return;
        const serverVoice = ambilDataServer(guild.id);
        if (
            memberVoice &&
            !memberVoice.user.bot &&
            newState.channelId &&
            newState.channelId === serverVoice.voice.lobbyId &&
            oldState.channelId !== newState.channelId
        ) {
            const lockKey = `${guild.id}:${memberVoice.id}`;
            if (!voiceCreationLocks.has(lockKey)) {
                voiceCreationLocks.add(lockKey);
                acquiredLockKey = lockKey;
                let room;
                try {
                    const lobby = guild.channels.cache.get(serverVoice.voice.lobbyId);
                    if (!lobby || ![ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(lobby.type)) {
                        throw new Error(`Lobby voice ${serverVoice.voice.lobbyId} tidak ditemukan atau bukan voice channel.`);
                    }

                    room = await guild.channels.create({
                        name: `🔊 ${memberVoice.displayName}`.slice(0, 100),
                        type: ChannelType.GuildVoice,
                        parent: serverVoice.voice.categoryId || lobby.parentId || undefined,
                        permissionOverwrites: [
                            { id: guild.roles.everyone.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect] },
                            { id: memberVoice.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak] }
                        ],
                        reason: `Voice sementara untuk ${memberVoice.user.tag}`
                    });
                    serverVoice.voice.rooms[room.id] = memberVoice.id;
                    simpanOwoState();
                    await memberVoice.voice.setChannel(room, 'Masuk ke voice sementara yang baru dibuat');
                } catch (error) {
                    console.error('Gagal membuat voice sementara:', error);
                    if (room) {
                        delete serverVoice.voice.rooms[room.id];
                        simpanOwoState();
                        await room.delete('Pembuatan voice sementara gagal').catch(deleteError => {
                            console.error('Gagal membersihkan voice yang tidak terpakai:', deleteError);
                        });
                    }
                    memberVoice.send('⚠️ Bot tidak bisa membuat atau memindahkanmu ke voice sementara. Periksa izin **Manage Channels** dan **Move Members** bot.').catch(dmError => {
                        console.error('Gagal memberi tahu anggota tentang kegagalan voice sementara:', dmError);
                    });
                }
                if (room) {
                    try {
                        await room.send({
                            content: `${memberVoice}, voice sementara milikmu sudah siap. Tombol panel hanya dapat digunakan oleh pemilik channel.`,
                            ...buatPanelVoice(room, memberVoice.id)
                        });
                    } catch (error) {
                        console.error('Gagal mengirim pesan sambutan voice sementara:', error);
                    }
                }
                voiceCreationLocks.delete(lockKey);
                acquiredLockKey = null;
            }
        }

        if (oldState.channelId && oldState.channelId !== newState.channelId && serverVoice.voice.rooms[oldState.channelId]) {
            const oldRoom = guild.channels.cache.get(oldState.channelId);
            const connection = getVoiceConnection(guild.id);
            const botInRoom =
                oldRoom?.members.has(client.user.id) ||
                guild.members.me?.voice.channelId === oldState.channelId;
            const botJoiningRoom =
                connection?.joinConfig.channelId === oldState.channelId &&
                connection.state.status !== 'destroyed';
            if (oldRoom?.type === ChannelType.GuildVoice && oldRoom.members.size === 0 && !botInRoom && !botJoiningRoom) {
                try {
                    await oldRoom.delete('Voice sementara kosong');
                    delete serverVoice.voice.rooms[oldState.channelId];
                    simpanOwoState();
                } catch (error) {
                    console.error('Gagal menghapus voice sementara yang kosong:', error);
                }
            }
        }

        const member = newState.member || oldState.member;
        if (member?.user && !member.user.bot) {
            const voiceEvents = [];
            if (!oldState.channelId && newState.channelId) {
                voiceEvents.push({ channel: newState.channel, type: 'join' });
            } else if (oldState.channelId && !newState.channelId) {
                voiceEvents.push({ channel: oldState.channel, type: 'leave' });
            } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
                voiceEvents.push(
                    { channel: oldState.channel, type: 'leave' },
                    { channel: newState.channel, type: 'join' }
                );
            }

            for (const { channel, type } of voiceEvents) {
                if (!channel || typeof channel.send !== 'function') continue;
                try {
                    await channel.send({
                        embeds: [buatEmbedLogVoice(member, type)],
                        allowedMentions: { users: [member.id] }
                    });
                } catch (error) {
                    console.error(`Gagal mengirim log ${type} voice ke chat channel ${channel.id}:`, error);
                }
            }
        }

    } catch (error) {
        if (acquiredLockKey) voiceCreationLocks.delete(acquiredLockKey);
        console.error('Gagal memproses perubahan status voice:', error);
    }
});

client.on('channelDelete', channel => {
    if (!channel.guild) return;
    const serverVoice = ambilDataServer(channel.guild.id);
    let berubah = false;
    if (serverVoice.voice.rooms[channel.id]) {
        delete serverVoice.voice.rooms[channel.id];
        berubah = true;
    }
    if (serverVoice.voice.lobbyId === channel.id) {
        delete serverVoice.voice.lobbyId;
        delete serverVoice.voice.categoryId;
        berubah = true;
    }
    if (berubah) simpanOwoState();
});

client.login(process.env.TOKEN);