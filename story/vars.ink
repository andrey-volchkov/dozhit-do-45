// Все переменные игры на 12 глав. Объявлены заранее, чтобы сохранения
// и последующие части не ломали формат. Новые переменные — только сюда.

// Жребий
VAR father = "rail"          // rail | police | priest

// Гл. 1. «Не шевелись» (1905)
VAR senka_in_photo = false   // Сенька на карточке
VAR moved_1905 = false       // Митя смазан на карточке
VAR saved_first = ""         // levka | varya | none — кого вытащил на площади
VAR darkroom = ""            // eyes | stepout | floor
VAR crooked_finger = false   // палец, сломанный в 1905
VAR senka_says = ""          // pusto | dolzhen | knock
VAR senka_grudge = 0         // сколько Сенька помнит зла
VAR levka_trust = 0          // сколько Лёвка верит Мите

// Гл. 2. «Подкладка» (1915)
VAR asya_night = ""          // wait | nowait | stay (stay — будет Серёжа)
VAR coins = 3                // червонцы в подкладке

// Гл. 3. «Хлеб» (1916)
VAR boots = false            // снял сапоги с мёртвого
VAR bread = ""               // pact | refused
VAR senka_front = ""         // pact | dragged | left

// Гл. 4. «Междувластие» (1919)
VAR list_choice = ""         // father | doctor | silent
VAR levka_pick = ""          // кого Лёвка вычеркнул сам (father | doctor)
VAR father_alive = true
VAR doctor_alive = true
VAR door_1919 = ""           // open | closed

// Гл. 5. «Трап» (1920)
VAR sailed = false
VAR coin_1920 = ""           // self | mother | none
VAR asya_gone = false        // Ася уплыла — её фигура бледнеет на карточке

// Гл. 6–12 (заготовки на части вторую и третью)
VAR in_frame_1924 = false
VAR card_1924 = ""           // kept | burned | nina
VAR gpu_job = false
VAR negative_1933 = false
VAR petrik = false
VAR named_1937 = ""          // senka | colleague | none | silent
VAR confirm_1938 = ""        // yes | no | silent
VAR lelya_home = false
VAR lelya_forged = false
VAR andryusha_list = ""      // bought | taken
VAR senka_negatives = ""     // given | kept | broken
VAR said_i_1943 = false
VAR asya_help_1945 = ""      // coin | warned | none
VAR final_moved = false

// Судьба
VAR dead = false
VAR death_year = 0
VAR ending = ""              // part1 | sailed | dead1919 | ...
