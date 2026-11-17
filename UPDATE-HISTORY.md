# Riwayat Update

Perubahan dirangkum per hari dan diurutkan dari yang paling lama ke yang terbaru.

## 28 Oktober 2026

Catatan audit UX/UI proyek mencatat fitur dan perbaikan berikut:

- Dashboard profil privat merangkum saldo, level, daily, zoo, inventory, dan aktivitas.
- Help publik dipisahkan dari help admin; panduan admin memerlukan izin **Manage Server**.
- Perbaikan transaksi ekonomi mencakup reservasi taruhan coinflip/gamble, validasi saldo, batas integer taruhan, dan penyesuaian payout slot.
- Halaman dashboard, zoo, inventory, riwayat, game, dan help dirapikan; beberapa aksi memakai tombol, dropdown, modal, dan pemilih anggota.
- Cooldown mini-game dan tombol untuk mengulang permainan diterapkan.
- Auto-respon server dikelola admin melalui command, dengan batas 50 aturan dan panjang pemicu maksimal 80 karakter.

## 29 Oktober 2026

- **Aturan pencatatan update:** setiap perubahan proyek dicatat segera di bagian tanggal yang sesuai pada file ini; instruksi proyek disimpan di `AGENTS.md`.
- **Rollback koneksi voice:** command join/leave dan sesi menetap 24 jam dihapus karena hosting tidak mendukung UDP outbound. Dependensi koneksi voice serta diagnostik timeout terkait juga dihapus; fitur voice sementara yang sudah ada tetap tersedia.
- **Panel voice bersama:** admin dapat mengirim atau memperbarui panel pengaturan di channel teks dengan `ltn vc panel #channel`, lalu menonaktifkannya dengan `ltn vc panel off`. Aksi panel berlaku pada voice sementara tempat pengguna berada dan dibatasi untuk pemilik room.
- **Tampilan panel voice:** panel room dan panel bersama memakai judul, deskripsi, warna aksen, emoji, label kapital, dan urutan tombol yang meniru referensi. Ditambahkan kontrol bitrate, info room, log aktivitas panel, dan reset pengaturan dengan konfirmasi.
- **Panel voice diringkas:** teks pembuka panel bersama dihapus. Fitur dan tombol bitrate, waiting, chat, serta region dihapus; pembaruan panel bersama juga mengosongkan teks lama.
- **Tema warna bot:** aksen embed/panel menggunakan pink `#e83e67`, sementara warna hijau/merah dipertahankan untuk status yang perlu dibedakan secara semantik.
- **Log voice di chat channel:** saat anggota manusia bergabung, keluar, atau pindah voice, bot mengirim embed hijau untuk join dan merah untuk leave dengan mention ke chat voice terkait. Log voice lama yang menetap di satu channel server dihapus.
- **Warna status:** verifikasi memakai hijau dan kegagalan memakai merah agar status mudah dikenali; panel dan informasi netral tetap pink.
- **Penyesuaian tema pink:** warna aksen utama diperbarui ke `#fd4ddf`, mengambil pink neon dari gambar referensi. Warna hijau/merah untuk status tetap dipertahankan.
- **Kartu welcome/goodbye:** event anggota baru/keluar kini mengirim banner LTN dengan avatar, username, dan jumlah anggota, ditambah pesan embed beraksen pink. Admin dapat mengatur channel dan teks lewat command welcome/goodbye; placeholder `{user}`, `{username}`, `{server}`, dan `{memberCount}` tersedia.
- **Aset dan renderer kartu anggota:** banner referensi disimpan di `assets/welcome-banner.png`; rendering PNG menggunakan `@napi-rs/canvas`.
- **Ukuran kartu welcome/goodbye:** panel pink diperbesar dan avatar, label welcome/goodbye, username, serta nomor anggota dibuat lebih besar agar lebih menonjol di atas banner.
- **Perbaikan pengiriman goodbye:** handler kini mengambil channel tujuan melalui Discord API, bukan hanya dari cache lokal, dan mencatat kegagalan fetch secara eksplisit.
- **Auto-respon:** kata atau frasa pemicu kini dicocokkan di bagian mana pun dari pesan. Pencocokan mengabaikan kapitalisasi, tanda baca, dan spasi berlebih, serta menggunakan batas kata agar pemicu tidak cocok sebagai bagian dari kata lain.
- Validasi sintaks JavaScript, pemeriksaan dependensi, dan uji pencocokan auto-respon dijalankan.

## 7 November 2026

- **Help dan alias mini-game:** tampilan `ltn help` kini memiliki header dan indikator kategori yang lebih jelas, daftar command diberi bullet, dan kategori game menampilkan shortcut `ltn sl`, `ltn mn`, dan `ltn gb`. Command lama tetap bisa digunakan; aturan game dan hadiah tidak berubah. Validasi sintaks `node --check index.js` lulus.
- **Bantuan admin voice:** kategori Voice pada `ltn help admin` mencantumkan `ltn join vc` dan `ltn leave vc`. Parser command juga mengenali format dua kata tersebut agar sesuai dengan dokumentasi.
- **Coinflip:** command menerima `ltn cf <jumlah/all>` tanpa tebakan sisi; peluang menang 50% dengan hadiah 2× taruhan. UI hasil kini mengikuti format pesan OWO pada referensi (taruhan, animasi koin, dan hasil dalam dua baris teks), konsisten pada command, dashboard, dan replay. Mekanik otomatis tanpa pilihan sisi dan payout tidak berubah.
- **Alias dan tampilan slot:** `ltn s` kini menjadi shortcut Animal Slot dan dicantumkan di help. Slot memakai simbol hewan, 💰, serta L/T/N; tampilan gulungan dan perhitungan hadiah dibagikan oleh command, dashboard, dan replay. Help menjelaskan payout 1,5× untuk sepasang dan 5× untuk tiga simbol sama.
- **Animasi slot vertikal:** gulungan kini ditampilkan sebagai tiga reel bertingkat yang bergeser ke bawah dan berhenti berurutan; animasi yang sama dipakai oleh command, dashboard, dan replay. `node --check index.js` serta tes alias, payout, layout reel, dan hasil akhir animasi lulus.
- **Penyederhanaan UI slot dan Mines:** slot tampil dalam satu baris hewan dengan L/T/N tetap di atas gulungan kiri, tengah, dan kanan. UI Mines diperbarui agar mengikuti referensi: ringkasan bet/mines/cash out/next yang ringkas, pemisah, grid gelap, dan semua petak terungkap setelah ronde selesai. Perubahan ini hanya pada tampilan; aturan taruhan, pilihan, peluang, payout, dan alur ronde Mines tidak diubah. Command dan dashboard memakai renderer yang sama.
- **Perbaikan pemanggilan Mines:** tombol petak tertutup kembali memakai ikon placeholder agar memenuhi validasi komponen Discord; sebelumnya tombol tanpa label/emoji membuat pesan game gagal dibuat.
- **Warna aksen Mines:** garis aksen embed Mines disamakan dengan pink tema/logo LTN (`THEME_COLOR`); aturan game tidak berubah.
- **Kartu Mines berbingkai:** panel Mines kini dirender sebagai gambar dengan bingkai pink yang mencakup ringkasan dan grid visual; tombol interaktif tetap berada tepat di bawah kartu karena Discord menampilkan komponen secara terpisah. Renderer dan pembaruan gambar dipakai pada command maupun dashboard; mekanik game tidak diubah.
- **Penyederhanaan grid kartu Mines:** isi grid pada kartu gambar kini hanya berupa garis-garis grid pink, tanpa kotak berisi ikon berlian atau bom. Petak yang benar-benar bisa dimainkan tetap berupa tombol Discord di bawah kartu.
- **Kartu informasi Mines:** seluruh grid dan garis pembaginya dihapus dari gambar kartu. Kartu kini hanya menampilkan informasi Mines dalam bingkai pink; tombol interaktif tetap di bawahnya.
- **Klasifikasi dan kelengkapan help:** daftar bantuan publik/admin ditinjau terhadap handler dan izin command. Pengaturan panel voice bersama dipindah dari help publik ke kategori admin; alias ekonomi dan akses pemilik room diperjelas; kategori admin kini mencantumkan penggunaan serta izin yang sesuai.
- **Cooldown mini-game dan tiket request update:** semua mini-game taruhan (coinflip, slot, mines, dan gamble), termasuk dashboard/replay, memakai cooldown 5 detik per game dengan pesan retry bergaya OWO. Admin dapat memasang/menonaktifkan panel request di channel khusus melalui `ltn requestpanel #channel` / `ltn requestpanel off`; pengguna mengirim request melalui modal dan tiket diposting ke channel tersebut.
- **Katalog bantuan terstruktur:** halaman `ltn help` dan `ltn help admin` kini dibuat dari katalog command berlabel publik/admin dan kategori, sehingga entri katalog langsung ditampilkan pada halaman yang sesuai. Command `ltn help` dan alias `ltn bantuan` juga tercantum. Saat menambahkan command baru, daftarkan penggunaan, deskripsi, kategori, dan audiensnya di `HELP_COMMANDS`.
- **Ticket umum dan balasan admin:** panel tiket mendukung kategori Laporan, Ide Update, dan Lainnya. `ltn ticketpanel #panel [#list-ticket]` memisahkan panel publik dari channel antrean yang dapat dibuat privat; satu channel dan alias lama `ltn requestpanel` tetap didukung. Setiap tiket memiliki tombol balas khusus admin; balasan dicatat di antrean, status tiket diperbarui, dan isi balasan dikirim ke DM pembuat tiket.
- **Animasi slot dipercepat:** durasi putaran dipersingkat dengan mengurangi frame dan jeda; ketiga gulungan tetap berhenti berurutan. Hasil dan mekanik taruhan tidak berubah; animasi yang sama berlaku untuk command, dashboard, dan main lagi.
- **Command tidak peka huruf besar-kecil:** prefix `ltn` kini dikenali dalam kombinasi kapital apa pun (misalnya `LTN HELP` atau `LtN Slot`); nama command tetap dinormalisasi ke huruf kecil sebelum dirutekan.
- **Privasi pengirim Ticket:** kartu tiket tidak menampilkan nama, avatar, atau mention pengirim. Tombol **Lihat Pengirim** hanya mengungkap username dan mention secara ephemeral kepada admin dengan izin Manage Server; tombol balas tetap mengirim jawaban ke pengirim yang benar.
- **Pembagian koin server:** admin dengan izin Manage Server dapat memakai `ltn sendall <jumlah-per-orang>` (alias `ltn rain`) untuk membagikan koin kepada semua anggota manusia termasuk yang offline, tanpa menyertakan bot. Total biaya dihitung sebelum perubahan dan dipotong dari saldo admin; transaksi dibatalkan jika saldo tidak cukup atau hasil berisiko melampaui batas aman.
- **Saldo unlimited pemilik bot:** pemilik bot (`781779621682610178`) dapat memakai fitur ekonomi tanpa saldo berkurang dan ditampilkan sebagai `♾️ Unlimited`; akunnya dikecualikan dari leaderboard. Validasi batas aman payout mini-game tetap berlaku, begitu pula pemeriksaan saldo dan overflow untuk pemain lain.
- **Perilaku menetap di voice:** bot tetap berada di voice channel saat anggota manusia terakhir pergi. Command `ltn leave vc` tidak lagi memutuskan koneksi; untuk mengeluarkan bot, admin harus menggunakan Kick pada daftar anggota voice. Bantuan admin dan balasan `ltn join vc` menjelaskan perilaku tersebut.
- **Perlindungan voice sementara:** pembersihan room sementara tidak menghapus channel jika koneksi bot masih aktif di sana, sehingga bot tidak terputus saat manusia terakhir pergi.
- **Retensi room saat bot menetap:** room sementara Little Nook tidak dihapus saat koneksi bot sedang bergabung atau bot masih ada di room.

## 9 November 2026

- **Slash command Discord:** command dari katalog bantuan didaftarkan per server agar cepat muncul saat pengguna mengetik `/`, lalu diteruskan ke handler yang sama dengan prefix `ltn`, termasuk pemeriksaan izin dan argumen; command `ltn ...` tetap berfungsi seperti sebelumnya. Command otomatis disinkronkan saat bot online atau bergabung ke server baru. Help menjelaskan penggunaan opsi `input`. Validasi `node --check index.js` dan pemeriksaan 62 definisi slash command lulus.
- **Pemutar musik YouTube/Spotify:** ditambahkan command `/play`, `/pause`, `/resume`, `/skip`, `/stop`, `/queue`, `/volume`, `/loop`, dan `/autoplay` beserta padanan `ltn`. Player menyediakan antrean per server, pencarian/playlist YouTube, metadata track/album/playlist Spotify dengan audio padanan YouTube, serta kartu Now Playing dan tombol kontrol. Help publik memiliki kategori musik; `package-lock.json` diselaraskan dengan dependensi yang sudah ada di manifest. Validasi sintaks, 71 definisi slash command, UI player, urutan antrean, pause/resume, dan API modul musik lulus.
- **Perbaikan pemutar musik:** pencarian, playlist, metadata video, rekomendasi autoplay, dan streaming YouTube kini memakai `@distube/ytdl-core`; `play-dl` tetap menangani metadata Spotify. Audio Opus diteruskan langsung dan format audio lain memakai transkoder yang disediakan `ffmpeg-static`; `opusscript` melengkapi encoder Opus agar kontrol volume Discord berfungsi. Ini mengatasi error `Header overflow`, parser `browseId`, dan URL streaming invalid; dependensi `youtubei.js` yang tidak digunakan dihapus. Validasi sintaks, dependency tree, pencarian YouTube, streaming audio melalui resource Discord dengan volume, dan audit dependensi produksi lulus.
- **Diagnostik deployment musik:** bila `@distube/ytdl-core` belum dipasang di server, command musik kini menampilkan instruksi untuk memperbarui manifest dan menjalankan `npm install`; kegagalan import tidak disimpan sehingga dapat dicoba lagi setelah dependency dipasang.
- **Koneksi voice Discord:** `@discordjs/voice` diperbarui ke versi dengan dukungan protokol voice/DAVE terbaru. Kegagalan koneksi kini mencatat status, alasan, dan close code yang sebenarnya; respons juga mengarahkan pemeriksaan UDP keluar bila handshake jaringan gagal. Izin View Channel kini ikut divalidasi sebelum bot mencoba bergabung. Versi Node yang didukung juga dicantumkan di manifest, dan `package-lock.json` disinkronkan.
- **Panel pemutar musik:** panel aktif terus diperbarui saat lagu berganti, command `ltn panel` dan `/panel` mengirim ulang panel ke channel, tombol Set Volume membuka pengaturan volume, dan tombol kontrol ditata menjadi tiga baris.
