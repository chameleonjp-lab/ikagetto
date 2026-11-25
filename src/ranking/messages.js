import { getLanguage } from '../i18n/runtime.js';
import { getLanguageLocale } from '../i18n/languages.js';

const keys = [
  'language', 'name', 'nameHint', 'nameInvalid',
  'start', 'share', 'ranking',
  'homeSearch', 'homeSearchDesc', 'homeFind', 'homeFindDesc', 'homeCatch', 'homeCatchDesc',
  'rankingPending', 'rankingUnavailable', 'rankingGuest', 'resultPosition', 'resultPlayCount',
  'fishing', 'butcher', 'cooking', 'fisherCount', 'fishingCount',
  'rank', 'player', 'score', 'returnGame', 'empty', 'loadError', 'retry',
  'scoreValue', 'homeShare', 'fishingMetrics', 'position', 'guestPosition', 'comment', 'modeScore',
  'rankingDetails', 'pagination', 'previousPage', 'nextPage', 'pageNumber', 'emptyPage', 'statsLoadError',
];

const translations = {
  ja: [
    '言語', 'ランキング名（任意）', '名前を入れるとランキングに参加できます。', '表示できる文字で、20文字以内の名前を入力してください。',
    'ゲーム開始', 'Xにシェアする', 'ランキング',
    '探す', 'ソナーを見ながら、イカの反応を探そう。', '見つける', '反応の近くで仕掛けを降ろし、食いつくのを待とう。', '釣る', '糸の張りに気をつけて巻き上げ、クレーンで引き揚げよう。',
    'ランキング集計中', '順位を取得できません', '名前なしのため順位なし', '順位 {position}', 'プレイ回数 {count}回',
    '釣り', '解体', '料理', '漁師登録', '釣りのプレイ回数',
    '順位', '名前', 'スコア', 'ゲームに戻る', 'まだ登録されたスコアはありません。', 'ランキングを読み込めませんでした。', '再読み込み',
    '{score}点', '大きいイカを釣って自慢しよう', '全長 {length} m ／ 重さ {weight} kg ／ 時間 {time}秒',
    '{rank}位 / {count}人', '順位なし / {count}人', '「{comment}」', '{mode}スコア {score}',
    'ランキング詳細', 'ページ切り替え', '前へ', '次へ', '{page}ページ目', 'このページにスコアはありません。', 'プレイ回数と漁師登録を読み込めませんでした。',
  ],
  en: [
    'Language', 'Leaderboard name (optional)', 'Enter a name to join the leaderboard.', 'Enter a displayable name of 20 characters or fewer.',
    'Start game', 'Share on X', 'Leaderboard',
    'Search', 'Watch the sonar for signs of a squid.', 'Find it', 'Lower the line near the signal and wait for a bite.', 'Catch it', 'Watch the line tension as you reel in, then hoist the squid aboard.',
    'Updating leaderboard', 'Rank unavailable', 'No rank for guest play', 'Rank {position}', 'Plays: {count}',
    'Fishing', 'Butchering', 'Cooking', 'Registered fishers', 'Fishing plays',
    'Rank', 'Name', 'Score', 'Back to game', 'No scores have been registered yet.', 'Could not load the leaderboard.', 'Reload',
    '{score} pts', 'Catch a big squid and show it off', 'Length {length} m / Weight {weight} kg / Time {time} s',
    '{rank} / {count} players', 'Unranked / {count} players', '“{comment}”', '{mode} score: {score}',
    'Leaderboard details', 'Leaderboard pages', 'Previous', 'Next', 'Page {page}', 'There are no scores on this page.', 'Could not load play and registration counts.',
  ],
  es: [
    'Idioma', 'Nombre para la clasificación (opcional)', 'Escribe un nombre para entrar en la clasificación.', 'Introduce un nombre visible de hasta 20 caracteres.',
    'Jugar', 'Compartir en X', 'Clasificación',
    'Busca', 'Mira el sonar para detectar calamares.', 'Encuéntralo', 'Baja el sedal cerca de la señal y espera a que pique.', 'Péscalo', 'Recoge el sedal sin tensarlo demasiado y sube el calamar con la grúa.',
    'Actualizando la clasificación', 'Puesto no disponible', 'Partida de invitado sin puesto', 'Puesto {position}', 'Partidas: {count}',
    'Pesca', 'Corte', 'Cocina', 'Pescadores registrados', 'Partidas de pesca',
    'Puesto', 'Nombre', 'Puntuación', 'Volver al juego', 'Todavía no hay puntuaciones registradas.', 'No se pudo cargar la clasificación.', 'Recargar',
    '{score} puntos', 'Pesca un calamar gigante y presume de tu captura', 'Longitud {length} m / Peso {weight} kg / Tiempo {time} s',
    '{rank} / {count} jugadores', 'Sin puesto / {count} jugadores', '«{comment}»', '{mode}: {score}',
    'Detalles de la clasificación', 'Páginas de la clasificación', 'Anterior', 'Siguiente', 'Página {page}', 'No hay puntuaciones en esta página.', 'No se pudieron cargar los totales de partidas y registros.',
  ],
  'pt-BR': [
    'Idioma', 'Nome no ranking (opcional)', 'Digite um nome para participar do ranking.', 'Digite um nome que possa ser exibido, com até 20 caracteres.',
    'Começar a jogar', 'Compartilhar no X', 'Ranking',
    'Busque', 'Observe o sonar para localizar uma lula.', 'Encontre', 'Baixe a linha perto do sinal e espere a fisgada.', 'Pesque', 'Controle a tensão da linha e use o guindaste para içar a lula.',
    'Atualizando o ranking', 'Posição indisponível', 'Partida de visitante sem posição', 'Posição {position}', 'Partidas: {count}',
    'Pesca', 'Corte', 'Cozinha', 'Pescadores cadastrados', 'Partidas de pesca',
    'Posição', 'Nome', 'Pontuação', 'Voltar ao jogo', 'Ainda não há pontuações registradas.', 'Não foi possível carregar o ranking.', 'Recarregar',
    '{score} pontos', 'Pesque uma lula gigante e mostre sua captura', 'Comprimento {length} m / Peso {weight} kg / Tempo {time} s',
    '{rank} / {count} jogadores', 'Sem posição / {count} jogadores', '“{comment}”', '{mode}: {score}',
    'Detalhes do ranking', 'Páginas do ranking', 'Anterior', 'Próxima', 'Página {page}', 'Não há pontuações nesta página.', 'Não foi possível carregar os totais de partidas e cadastros.',
  ],
  'zh-Hans': [
    '语言', '排行榜昵称（选填）', '填写昵称即可参加排行。', '请输入不超过20个字符、可以正常显示的昵称。',
    '开始游戏', '分享到 X', '排行榜',
    '搜索', '查看声呐，寻找大王乌贼的踪迹。', '发现', '在信号附近放下钓线，等待乌贼咬钩。', '钓起', '注意钓线张力，收线后用起重机把乌贼吊上船。',
    '正在更新排名', '无法获取排名', '游客不参与排名', '排名 {position}', '游玩次数：{count}',
    '钓鱼', '分切', '烹饪', '登记渔民', '钓鱼游玩次数',
    '名次', '昵称', '分数', '返回游戏', '还没有登记的分数。', '无法加载排行榜。', '重新加载',
    '{score} 分', '钓一条大乌贼，展示你的战利品', '全长 {length} 米／重量 {weight} 千克／用时 {time} 秒',
    '第 {rank} 名 / {count} 人', '未上榜 / {count} 人', '「{comment}」', '{mode}分数：{score}',
    '排行榜详情', '排行榜分页', '上一页', '下一页', '第 {page} 页', '此页没有分数。', '无法加载游玩次数和登记人数。',
  ],
  fr: [
    'Langue', 'Nom au classement (facultatif)', 'Saisissez un nom pour participer au classement.', 'Saisissez un nom affichable de 20 caractères maximum.',
    'Jouer', 'Partager sur X', 'Classement',
    'Chercher', 'Surveillez le sonar pour repérer un calmar.', 'Trouver', 'Descendez la ligne près du signal et attendez une touche.', 'Pêcher', 'Contrôlez la tension en remontant la ligne, puis hissez le calmar à bord.',
    'Mise à jour du classement', 'Rang indisponible', 'Partie en invité sans rang', 'Rang {position}', 'Parties : {count}',
    'Pêche', 'Découpe', 'Cuisine', 'Pêcheurs inscrits', 'Parties de pêche',
    'Rang', 'Nom', 'Score', 'Retour au jeu', 'Aucun score enregistré pour le moment.', 'Impossible de charger le classement.', 'Recharger',
    '{score} points', 'Pêchez un calmar géant et montrez votre prise', 'Longueur {length} m / Poids {weight} kg / Temps {time} s',
    '{rank} / {count} joueurs', 'Non classé / {count} joueurs', '« {comment} »', '{mode} : {score}',
    'Détails du classement', 'Pages du classement', 'Précédente', 'Suivante', 'Page {page}', 'Aucun score sur cette page.', 'Impossible de charger le nombre de parties et d’inscriptions.',
  ],
  de: [
    'Sprache', 'Ranglistenname (optional)', 'Gib einen Namen ein, um an der Rangliste teilzunehmen.', 'Gib einen lesbaren Namen mit höchstens 20 Zeichen ein.',
    'Spiel starten', 'Auf X teilen', 'Rangliste',
    'Suchen', 'Suche auf dem Sonar nach einem Kalmar.', 'Finden', 'Lass die Leine nahe am Signal hinab und warte auf einen Biss.', 'Fangen', 'Achte beim Einholen auf die Spannung und hebe den Kalmar mit dem Kran an Bord.',
    'Rangliste wird aktualisiert', 'Platz nicht verfügbar', 'Gastspiel ohne Platzierung', 'Platz {position}', 'Spiele: {count}',
    'Angeln', 'Zerlegen', 'Kochen', 'Registrierte Angler', 'Angelrunden',
    'Platz', 'Name', 'Punkte', 'Zurück zum Spiel', 'Es wurden noch keine Punkte eingetragen.', 'Die Rangliste konnte nicht geladen werden.', 'Neu laden',
    '{score} Pkt.', 'Fange einen großen Kalmar und zeig deinen Fang her', 'Länge {length} m / Gewicht {weight} kg / Zeit {time} s',
    '{rank} / {count} Spieler', 'Ohne Platz / {count} Spieler', '„{comment}“', '{mode}: {score}',
    'Ranglistendetails', 'Ranglistenseiten', 'Zurück', 'Weiter', 'Seite {page}', 'Auf dieser Seite gibt es keine Punkte.', 'Die Anzahl der Spiele und Anmeldungen konnte nicht geladen werden.',
  ],
  ko: [
    '언어', '순위표 이름(선택)', '이름을 입력하면 순위표에 참가할 수 있습니다.', '표시할 수 있는 문자로 20자 이내의 이름을 입력하세요.',
    '게임 시작', 'X에 공유', '순위표',
    '탐색', '소나를 보며 대왕오징어의 신호를 찾아보세요.', '발견', '신호 근처에서 낚싯줄을 내리고 입질을 기다리세요.', '낚기', '줄의 장력을 살피며 감아 올린 뒤 크레인으로 들어 올리세요.',
    '순위표 집계 중', '순위를 불러올 수 없음', '이름이 없어 순위에 기록되지 않음', '순위 {position}', '플레이 횟수 {count}회',
    '낚시', '손질', '요리', '등록 어부', '낚시 플레이 횟수',
    '순위', '이름', '점수', '게임으로 돌아가기', '아직 등록된 점수가 없습니다.', '순위표를 불러올 수 없습니다.', '새로고침',
    '{score}점', '커다란 오징어를 낚고 자랑해 보세요', '길이 {length} m / 무게 {weight} kg / 시간 {time}초',
    '{rank}위 / {count}명', '순위 없음 / {count}명', '“{comment}”', '{mode} 점수 {score}',
    '순위표 상세 보기', '순위표 페이지', '이전', '다음', '{page}페이지', '이 페이지에는 점수가 없습니다.', '플레이 횟수와 등록 어부 수를 불러올 수 없습니다.',
  ],
  ru: [
    'Язык', 'Имя для таблицы (необязательно)', 'Введите имя, чтобы попасть в таблицу лидеров.', 'Введите читаемое имя длиной не более 20 символов.',
    'Начать игру', 'Поделиться в X', 'Таблица лидеров',
    'Ищите', 'Следите за сонаром, чтобы найти кальмара.', 'Найдите', 'Опустите леску возле отметки и дождитесь поклёвки.', 'Поймайте', 'Следите за натяжением лески и поднимите кальмара на борт краном.',
    'Таблица обновляется', 'Место недоступно', 'Гостевая игра без места в таблице', 'Место {position}', 'Партий: {count}',
    'Рыбалка', 'Разделка', 'Готовка', 'Зарегистрированные рыбаки', 'Партий рыбалки',
    'Место', 'Имя', 'Очки', 'Вернуться в игру', 'Результатов пока нет.', 'Не удалось загрузить таблицу лидеров.', 'Обновить',
    '{score} очк.', 'Поймайте большого кальмара и покажите свой улов', 'Длина {length} м / Вес {weight} кг / Время {time} с',
    '{rank} / {count} игроков', 'Без места / {count} игроков', '«{comment}»', '{mode}: {score}',
    'Подробнее о рейтинге', 'Страницы рейтинга', 'Назад', 'Далее', 'Страница {page}', 'На этой странице нет результатов.', 'Не удалось загрузить число игр и регистраций.',
  ],
  it: [
    'Lingua', 'Nome in classifica (facoltativo)', 'Inserisci un nome per partecipare alla classifica.', 'Inserisci un nome visualizzabile di massimo 20 caratteri.',
    'Inizia a giocare', 'Condividi su X', 'Classifica',
    'Cerca', 'Controlla il sonar per trovare tracce del calamaro.', 'Trovalo', 'Cala la lenza vicino al segnale e aspetta che abbocchi.', 'Pescalo', 'Controlla la tensione mentre recuperi la lenza, poi issa il calamaro a bordo.',
    'Aggiornamento classifica', 'Posizione non disponibile', 'Partita da ospite senza posizione', 'Posizione {position}', 'Partite: {count}',
    'Pesca', 'Pulizia', 'Cucina', 'Pescatori registrati', 'Partite di pesca',
    'Posizione', 'Nome', 'Punteggio', 'Torna al gioco', 'Non ci sono ancora punteggi registrati.', 'Impossibile caricare la classifica.', 'Ricarica',
    '{score} punti', 'Pesca un calamaro gigante e mostra la tua cattura', 'Lunghezza {length} m / Peso {weight} kg / Tempo {time} s',
    '{rank} / {count} giocatori', 'Non classificato / {count} giocatori', '«{comment}»', '{mode}: {score}',
    'Dettagli della classifica', 'Pagine della classifica', 'Indietro', 'Avanti', 'Pagina {page}', 'In questa pagina non ci sono punteggi.', 'Impossibile caricare il numero di partite e iscrizioni.',
  ],
  'zh-Hant': [
    '語言', '排行榜暱稱（選填）', '輸入暱稱即可參加排名。', '請輸入不超過20字、可正常顯示的暱稱。',
    '開始遊戲', '分享到 X', '排行榜',
    '搜尋', '查看聲納，尋找大王魷魚的蹤跡。', '找到', '在訊號附近放下釣線，等魷魚咬鉤。', '釣起', '注意釣線張力，收線後用起重機把魷魚吊上船。',
    '正在更新排名', '無法取得名次', '訪客遊玩沒有名次', '名次 {position}', '遊玩次數：{count}',
    '釣魚', '分切', '料理', '登記漁夫', '釣魚遊玩次數',
    '名次', '暱稱', '分數', '返回遊戲', '目前沒有已登記的分數。', '無法讀取排行榜。', '重新載入',
    '{score} 分', '釣一條大魷魚，展示你的戰利品', '全長 {length} 公尺／重量 {weight} 公斤／時間 {time} 秒',
    '第 {rank} 名 / {count} 人', '未上榜 / {count} 人', '「{comment}」', '{mode}分數：{score}',
    '排行榜詳細資訊', '排行榜分頁', '上一頁', '下一頁', '第 {page} 頁', '此頁沒有分數。', '無法載入遊玩次數和登記人數。',
  ],
  id: [
    'Bahasa', 'Nama di papan peringkat (opsional)', 'Masukkan nama untuk ikut dalam papan peringkat.', 'Masukkan nama yang bisa ditampilkan, maksimal 20 karakter.',
    'Mulai bermain', 'Bagikan di X', 'Papan peringkat',
    'Cari', 'Amati sonar untuk mencari tanda cumi-cumi.', 'Temukan', 'Turunkan tali dekat sinyal dan tunggu cumi-cumi menyambar.', 'Tangkap', 'Jaga tegangan tali saat menggulung, lalu angkat cumi-cumi dengan derek.',
    'Memperbarui papan peringkat', 'Peringkat tidak tersedia', 'Tamu bermain tanpa peringkat', 'Peringkat {position}', 'Jumlah main: {count}',
    'Memancing', 'Memotong', 'Memasak', 'Nelayan terdaftar', 'Jumlah main memancing',
    'Peringkat', 'Nama', 'Skor', 'Kembali ke permainan', 'Belum ada skor yang terdaftar.', 'Papan peringkat tidak dapat dimuat.', 'Muat ulang',
    '{score} poin', 'Pancing cumi-cumi besar dan pamerkan hasil tangkapanmu', 'Panjang {length} m / Berat {weight} kg / Waktu {time} dtk',
    '{rank} / {count} pemain', 'Tanpa peringkat / {count} pemain', '“{comment}”', 'Skor {mode}: {score}',
    'Detail papan peringkat', 'Halaman papan peringkat', 'Sebelumnya', 'Berikutnya', 'Halaman {page}', 'Tidak ada skor di halaman ini.', 'Jumlah permainan dan pendaftaran tidak dapat dimuat.',
  ],
  tr: [
    'Dil', 'Sıralama adı (isteğe bağlı)', 'Sıralamaya katılmak için bir ad gir.', 'Görüntülenebilen, en fazla 20 karakterlik bir ad gir.',
    'Oyuna başla', 'X’te paylaş', 'Sıralama',
    'Ara', 'Kalamar izlerini görmek için sonarı izle.', 'Bul', 'Sinyalin yakınında misinayı indir ve oltaya gelmesini bekle.', 'Yakala', 'Misinayı sararken gerginliğine dikkat et, sonra kalamarı vinçle güverteye al.',
    'Sıralama güncelleniyor', 'Sıra alınamadı', 'Misafir oyunu sıralamaya girmez', 'Sıra {position}', 'Oyun sayısı: {count}',
    'Avcılık', 'Ayıklama', 'Pişirme', 'Kayıtlı balıkçılar', 'Kalamar avı sayısı',
    'Sıra', 'Ad', 'Puan', 'Oyuna dön', 'Henüz kaydedilmiş puan yok.', 'Sıralama yüklenemedi.', 'Yeniden yükle',
    '{score} puan', 'Büyük bir kalamar yakala ve avını göster', 'Uzunluk {length} m / Ağırlık {weight} kg / Süre {time} sn',
    '{rank} / {count} oyuncu', 'Sırasız / {count} oyuncu', '“{comment}”', '{mode} puanı: {score}',
    'Sıralama ayrıntıları', 'Sıralama sayfaları', 'Önceki', 'Sonraki', 'Sayfa {page}', 'Bu sayfada puan yok.', 'Oyun ve kayıt sayıları yüklenemedi.',
  ],
  vi: [
    'Ngôn ngữ', 'Tên trên bảng xếp hạng (không bắt buộc)', 'Nhập tên để tham gia bảng xếp hạng.', 'Nhập tên có thể hiển thị, tối đa 20 ký tự.',
    'Bắt đầu chơi', 'Chia sẻ trên X', 'Bảng xếp hạng',
    'Tìm kiếm', 'Quan sát sonar để dò dấu vết mực.', 'Phát hiện', 'Thả dây gần tín hiệu và đợi mực cắn câu.', 'Câu lên', 'Canh độ căng khi thu dây, rồi dùng cần cẩu đưa mực lên boong.',
    'Đang cập nhật bảng xếp hạng', 'Không lấy được thứ hạng', 'Chơi với tư cách khách không có hạng', 'Hạng {position}', 'Lượt chơi: {count}',
    'Câu mực', 'Sơ chế', 'Nấu ăn', 'Ngư dân đăng ký', 'Lượt chơi câu mực',
    'Hạng', 'Tên', 'Điểm', 'Về trò chơi', 'Chưa có điểm nào được ghi nhận.', 'Không thể tải bảng xếp hạng.', 'Tải lại',
    '{score} điểm', 'Câu một con mực lớn rồi khoe chiến tích', 'Chiều dài {length} m / Cân nặng {weight} kg / Thời gian {time} giây',
    '{rank} / {count} người chơi', 'Chưa xếp hạng / {count} người chơi', '“{comment}”', 'Điểm {mode}: {score}',
    'Chi tiết bảng xếp hạng', 'Các trang xếp hạng', 'Trang trước', 'Trang sau', 'Trang {page}', 'Trang này không có điểm số.', 'Không tải được số lượt chơi và số người đăng ký.',
  ],
  th: [
    'ภาษา', 'ชื่อในตารางอันดับ (ไม่บังคับ)', 'กรอกชื่อเพื่อเข้าร่วมตารางอันดับ', 'กรอกชื่อที่แสดงได้ ความยาวไม่เกิน 20 ตัวอักษร',
    'เริ่มเกม', 'แชร์บน X', 'ตารางอันดับ',
    'ค้นหา', 'ดูโซนาร์เพื่อหาสัญญาณของหมึกยักษ์', 'พบเป้าหมาย', 'ปล่อยสายเบ็ดใกล้สัญญาณแล้วรอหมึกกินเหยื่อ', 'ตกหมึก', 'ระวังความตึงขณะสาวสาย แล้วใช้เครนยกหมึกขึ้นเรือ',
    'กำลังอัปเดตอันดับ', 'ไม่สามารถรับอันดับได้', 'เล่นแบบไม่ระบุชื่อจึงไม่มีอันดับ', 'อันดับ {position}', 'เล่น {count} ครั้ง',
    'ตกหมึก', 'แล่หมึก', 'ทำอาหาร', 'ชาวประมงที่ลงทะเบียน', 'จำนวนรอบตกหมึก',
    'อันดับ', 'ชื่อ', 'คะแนน', 'กลับไปที่เกม', 'ยังไม่มีคะแนนที่บันทึกไว้', 'ไม่สามารถโหลดตารางอันดับได้', 'โหลดใหม่',
    '{score} คะแนน', 'ตกหมึกตัวใหญ่แล้วเอามาอวดกัน', 'ความยาว {length} ม. / น้ำหนัก {weight} กก. / เวลา {time} วิ.',
    '{rank} / {count} คน', 'ไม่มีอันดับ / {count} คน', '“{comment}”', 'คะแนน{mode} {score}',
    'รายละเอียดตารางอันดับ', 'หน้าตารางอันดับ', 'ก่อนหน้า', 'ถัดไป', 'หน้า {page}', 'หน้านี้ไม่มีคะแนน', 'ไม่สามารถโหลดจำนวนรอบเล่นและผู้ลงทะเบียนได้',
  ],
};

const aliases = {
  resultPending: 'rankingPending',
  resultUnavailable: 'rankingUnavailable',
  resultAnonymous: 'rankingGuest',
};
const catalog = Object.fromEntries(Object.entries(translations).map(([language, entries]) => {
  if (entries.length !== keys.length) throw new Error(`Incomplete ranking translations for ${language}`);
  return [language, Object.fromEntries(keys.map((key, index) => [key, entries[index]]))];
}));

const numberFormatters = new Map();

export function rankNumber(value) {
  const locale = getLanguageLocale(getLanguage());
  if (!numberFormatters.has(locale)) numberFormatters.set(locale, new Intl.NumberFormat(locale));
  return numberFormatters.get(locale).format(value);
}

export function rankText(key, values = {}) {
  const id = aliases[key] || key;
  const source = (catalog[getLanguage()] || catalog.ja)[id];
  if (!source) throw new Error(`Unknown ranking message: ${key}`);
  return source.replace(/\{(\w+)\}/g, (token, name) => {
    const value = values[name];
    if (value == null) return token;
    return typeof value === 'number' ? rankNumber(value) : String(value);
  });
}
