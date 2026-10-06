/* 進階應用題（適合國中生的生活情境）。難度：1 入門、2 基礎、3 應用、4 挑戰 */
(function (G) {
'use strict';
const AJ = G.AJ = G.AJ || {};
const LV = { 'b04-toggle': 3, 'b08-nightlight': 3 };
AJ.BUILTIN_PROBLEMS.forEach(p => { if (LV[p.id]) p.level = LV[p.id]; });

AJ.BUILTIN_PROBLEMS.push(
  {
    id: 'b13-breath', title: '呼吸燈', level: 2, tags: ['PWM', 'for 迴圈'],
    desc: `手機的通知燈會慢慢變亮、再慢慢變暗，就像在呼吸。請讓 D9 的 LED 做出呼吸燈：

- 亮度從 0 開始，每 10 毫秒加 5，一直加到 255
- 接著每 10 毫秒減 5，一直減到 0
- 不斷重複

提示：用兩個 \`for\` 迴圈，一個從 0 數到 255，一個從 255 數回 0，迴圈裡用 \`analogWrite\` 和 \`delay(10)\`。`,
    circuit: [{ id: 'led1', type: 'led', pin: 9, color: 'blue', label: '呼吸燈' }],
    compare: [{ kind: 'pin', pin: 9 }],
    cases: [{ name: '呼吸兩次', duration: 2500, events: '', sample: true }],
    solution: `void setup() {
  pinMode(9, OUTPUT);
}

void loop() {
  for (int i = 0; i <= 255; i += 5) {
    analogWrite(9, i);
    delay(10);
  }
  for (int i = 255; i >= 0; i -= 5) {
    analogWrite(9, i);
    delay(10);
  }
}
`,
  },
  {
    id: 'b14-scanner', title: '四燈跑馬燈', level: 2, tags: ['陣列', 'for 迴圈'],
    desc: `D2、D3、D4、D5 各接一顆 LED。讓燈光像跑馬燈一樣移動：

- D2 亮 0.2 秒 → D3 亮 0.2 秒 → D4 亮 0.2 秒 → D5 亮 0.2 秒 → 再回到 D2
- 同一時間只有一顆燈亮

提示：把腳位放進陣列 \`int leds[] = {2, 3, 4, 5};\`，再用 \`for\` 迴圈一顆一顆點亮。`,
    circuit: [
      { id: 'l1', type: 'led', pin: 2, color: 'red', label: 'LED 1' },
      { id: 'l2', type: 'led', pin: 3, color: 'yellow', label: 'LED 2' },
      { id: 'l3', type: 'led', pin: 4, color: 'green', label: 'LED 3' },
      { id: 'l4', type: 'led', pin: 5, color: 'blue', label: 'LED 4' },
    ],
    compare: [2, 3, 4, 5].map(pin => ({ kind: 'pin', pin })),
    cases: [{ name: '跑三圈', duration: 2600, events: '', sample: true }],
    solution: `int leds[] = {2, 3, 4, 5};

void setup() {
  for (int i = 0; i < 4; i++) {
    pinMode(leds[i], OUTPUT);
  }
}

void loop() {
  for (int i = 0; i < 4; i++) {
    digitalWrite(leds[i], HIGH);
    delay(200);
    digitalWrite(leds[i], LOW);
  }
}
`,
  },
  {
    id: 'b15-melody', title: '小小音樂家', level: 2, tags: ['蜂鳴器', '陣列'],
    desc: `用蜂鳴器（D8）在開機時彈奏「Do Re Mi Fa Sol」，只彈一次。

- Do 262 Hz、Re 294 Hz、Mi 330 Hz、Fa 349 Hz、Sol 392 Hz

- 每個音發聲 0.3 秒，然後安靜 0.1 秒，再彈下一個音
- 彈完之後保持安靜

提示：把頻率放進陣列，在 \`setup()\` 裡用 \`for\` 迴圈配合 \`tone\`、\`noTone\`、\`delay\`。`,
    circuit: [{ id: 'bz', type: 'buzzer', pin: 8, label: '蜂鳴器' }],
    compare: [{ kind: 'tone', pin: 8 }],
    cases: [{ name: '彈奏一次', duration: 3000, events: '', sample: true }],
    solution: `int notes[] = {262, 294, 330, 349, 392};

void setup() {
  for (int i = 0; i < 5; i++) {
    tone(8, notes[i]);
    delay(300);
    noTone(8);
    delay(100);
  }
}

void loop() {
}
`,
  },
  {
    id: 'b16-sweep', title: '雨刷（伺服馬達來回擺動）', level: 2, tags: ['伺服馬達', 'for 迴圈'],
    desc: `用伺服馬達（D9）做一支會自動擺動的雨刷：

- 從 0 度開始，每 15 毫秒增加 1 度，轉到 180 度
- 再每 15 毫秒減少 1 度，轉回 0 度
- 不斷重複

提示：需要 \`#include <Servo.h>\`，用兩個 \`for\` 迴圈控制角度。`,
    circuit: [{ id: 'sv', type: 'servo', pin: 9, label: '雨刷' }],
    compare: [{ kind: 'servo', pin: 9 }],
    cases: [{ name: '來回一次', duration: 6000, events: '', sample: true }],
    solution: `#include <Servo.h>

Servo wiper;

void setup() {
  wiper.attach(9);
}

void loop() {
  for (int pos = 0; pos <= 180; pos++) {
    wiper.write(pos);
    delay(15);
  }
  for (int pos = 180; pos >= 0; pos--) {
    wiper.write(pos);
    delay(15);
  }
}
`,
  },
  {
    id: 'b17-temp', title: '攝氏轉華氏', level: 2, tags: ['序列埠', '小數'],
    desc: `從序列埠讀入一個攝氏溫度（整數，每行一個），輸出換算後的華氏溫度，顯示到小數點後 1 位。

公式：華氏 = 攝氏 × 9 ÷ 5 + 32

範例輸入：
\`37\`

範例輸出：
\`98.6\`

提示：整數相除會把小數去掉（\`37 * 9 / 5\` 會得到 66），要寫成 \`9.0 / 5\` 或用 \`float\`。印出時用 \`Serial.println(f, 1);\` 指定 1 位小數。`,
    circuit: [],
    compare: [{ kind: 'serial', mode: 'lines' }],
    cases: [
      { name: '範例', duration: 3500, events: '100 serial 37\\n', sample: true },
      { name: '各種溫度', duration: 5500, events: '100 serial 25\\n\n600 serial 0\\n\n1100 serial 100\\n\n1600 serial -40\\n\n2100 serial 36\\n' },
    ],
    solution: `void setup() {
  Serial.begin(9600);
}

void loop() {
  if (Serial.available() > 0) {
    int c = Serial.parseInt();
    Serial.read();
    float f = c * 9.0 / 5 + 32;
    Serial.println(f, 1);
  }
}
`,
  },
  {
    id: 'b18-table', title: '九九乘法表', level: 2, tags: ['序列埠', 'for 迴圈'],
    desc: `從序列埠讀入一個 1~9 的整數 n，輸出 n 的乘法表，共 9 行，格式如下（注意空格）：

範例輸入：
\`3\`

範例輸出：
\`3 x 1 = 3\`
\`3 x 2 = 6\`
\`…（中間省略）\`
\`3 x 9 = 27\`

提示：用 \`Serial.print\` 一段一段印，最後一段用 \`Serial.println\` 換行。`,
    circuit: [],
    compare: [{ kind: 'serial', mode: 'lines' }],
    cases: [
      { name: '範例', duration: 3500, events: '100 serial 3\\n', sample: true },
      { name: '連續查詢', duration: 5000, events: '100 serial 9\\n\n1000 serial 1\\n\n2000 serial 7\\n' },
    ],
    solution: `void setup() {
  Serial.begin(9600);
}

void loop() {
  if (Serial.available() > 0) {
    int n = Serial.parseInt();
    Serial.read();
    for (int i = 1; i <= 9; i++) {
      Serial.print(n);
      Serial.print(" x ");
      Serial.print(i);
      Serial.print(" = ");
      Serial.println(n * i);
    }
  }
}
`,
  },
  {
    id: 'b19-parking', title: '倒車雷達', level: 2, tags: ['類比輸入', '條件判斷'],
    desc: `汽車的倒車雷達會依照距離亮不同的燈。這裡用可變電阻（A0）模擬距離感測器：讀值越大，代表離障礙物越遠。

- 讀值 ≥ 700：只亮綠燈（D4），安全
- 300 ≤ 讀值 < 700：只亮黃燈（D3），小心
- 讀值 < 300：只亮紅燈（D2），而且蜂鳴器（D8）發出 1000 Hz 警告聲

不在警告範圍時，蜂鳴器要安靜。`,
    circuit: [
      { id: 'dist', type: 'pot', pin: 14, label: '距離感測器', value: 900 },
      { id: 'red', type: 'led', pin: 2, color: 'red', label: '紅燈' },
      { id: 'yellow', type: 'led', pin: 3, color: 'yellow', label: '黃燈' },
      { id: 'green', type: 'led', pin: 4, color: 'green', label: '綠燈' },
      { id: 'bz', type: 'buzzer', pin: 8, label: '蜂鳴器' },
    ],
    compare: [{ kind: 'pin', pin: 2 }, { kind: 'pin', pin: 3 }, { kind: 'pin', pin: 4 }, { kind: 'tone', pin: 8 }],
    cases: [
      { name: '慢慢倒車', duration: 3000, events: '0 set dist 900\n600 set dist 650\n1200 set dist 400\n1800 set dist 200\n2400 set dist 950', sample: true },
      { name: '邊界值', duration: 3500, events: '0 set dist 700\n500 set dist 699\n1000 set dist 300\n1500 set dist 299\n2000 set dist 0\n2500 set dist 1023' },
    ],
    solution: `void setup() {
  pinMode(2, OUTPUT);
  pinMode(3, OUTPUT);
  pinMode(4, OUTPUT);
}

void loop() {
  int d = analogRead(A0);
  digitalWrite(2, LOW);
  digitalWrite(3, LOW);
  digitalWrite(4, LOW);
  if (d >= 700) {
    digitalWrite(4, HIGH);
    noTone(8);
  } else if (d >= 300) {
    digitalWrite(3, HIGH);
    noTone(8);
  } else {
    digitalWrite(2, HIGH);
    tone(8, 1000);
  }
  delay(20);
}
`,
  },
  {
    id: 'b20-counter', title: '人數計數器', level: 3, tags: ['數位輸入', '狀態', '序列埠'],
    desc: `博物館門口有一個計數按鈕（D2，接 GND，請用 \`INPUT_PULLUP\`），每進來一個人，工作人員就按一下。

每按「一下」，就從序列埠輸出目前的總人數（從 1 開始），每個數字一行。按住不放只算一次。

範例：按三下，輸出
\`1\`
\`2\`
\`3\`

提示：要偵測「從放開變成按下」的那一刻（上一次是 HIGH、這一次是 LOW）。`,
    circuit: [{ id: 'btn', type: 'button', pin: 2, wiring: 'pullup', label: '計數按鈕' }],
    compare: [{ kind: 'serial', mode: 'lines' }],
    cases: [
      { name: '按三下', duration: 2500, events: '300 press btn\n500 release btn\n900 press btn\n1100 release btn\n1500 press btn\n1700 release btn', sample: true },
      { name: '長按與連按', duration: 4000, events: '200 press btn\n1500 release btn\n1700 press btn\n1800 release btn\n1950 press btn\n2050 release btn\n2300 press btn\n2400 release btn\n2600 press btn\n3500 release btn' },
    ],
    solution: `int count = 0;
int lastState = HIGH;

void setup() {
  pinMode(2, INPUT_PULLUP);
  Serial.begin(9600);
}

void loop() {
  int state = digitalRead(2);
  if (lastState == HIGH && state == LOW) {
    count++;
    Serial.println(count);
  }
  lastState = state;
  delay(10);
}
`,
  },
  {
    id: 'b21-dice', title: '電子骰子', level: 3, tags: ['亂數', '數位輸入', '序列埠'],
    desc: `做一顆電子骰子：每按一下按鈕（D2，接 GND，請用 \`INPUT_PULLUP\`），就擲一次骰子，從序列埠輸出 1~6 的點數，每次一行。

規定：
- 請用 \`random(1, 7)\` 產生點數（會得到 1~6）
- 不要呼叫 \`randomSeed\`，除了擲骰子之外也不要呼叫 \`random\`
- 按住不放只算擲一次

小知識：Arduino 沒有設定種子時，每次開機的亂數順序都一樣，所以這題才能判斷對錯。`,
    circuit: [{ id: 'btn', type: 'button', pin: 2, wiring: 'pullup', label: '擲骰按鈕' }],
    compare: [{ kind: 'serial', mode: 'lines' }],
    cases: [
      { name: '擲三次', duration: 2500, events: '300 press btn\n500 release btn\n900 press btn\n1100 release btn\n1500 press btn\n1700 release btn', sample: true },
      { name: '擲六次', duration: 4000, events: '200 press btn\n300 release btn\n600 press btn\n1400 release btn\n1600 press btn\n1700 release btn\n2000 press btn\n2100 release btn\n2400 press btn\n2500 release btn\n2900 press btn\n3000 release btn' },
    ],
    solution: `int lastState = HIGH;

void setup() {
  pinMode(2, INPUT_PULLUP);
  Serial.begin(9600);
}

void loop() {
  int state = digitalRead(2);
  if (lastState == HIGH && state == LOW) {
    Serial.println(random(1, 7));
  }
  lastState = state;
  delay(10);
}
`,
  },
  {
    id: 'b22-crossing', title: '行人觸動號誌', level: 3, tags: ['數位輸入', '流程控制'],
    desc: `路口有一個行人按鈕（D2，接 GND，請用 \`INPUT_PULLUP\`）。車道號誌有紅燈 D5、黃燈 D4、綠燈 D3。

- 平常車道一直是綠燈
- 行人按下按鈕後：綠燈熄滅 → 黃燈亮 1 秒 → 紅燈亮 3 秒（讓行人過馬路）→ 回到綠燈
- 換燈過程中再按按鈕不會有作用
- 同一時間只能亮一顆燈`,
    circuit: [
      { id: 'btn', type: 'button', pin: 2, wiring: 'pullup', label: '行人按鈕' },
      { id: 'green', type: 'led', pin: 3, color: 'green', label: '綠燈' },
      { id: 'yellow', type: 'led', pin: 4, color: 'yellow', label: '黃燈' },
      { id: 'red', type: 'led', pin: 5, color: 'red', label: '紅燈' },
    ],
    compare: [{ kind: 'pin', pin: 3 }, { kind: 'pin', pin: 4 }, { kind: 'pin', pin: 5 }],
    cases: [
      { name: '按一次', duration: 6500, events: '1000 press btn\n1200 release btn', sample: true },
      { name: '過程中亂按', duration: 12000, events: '500 press btn\n700 release btn\n2000 press btn\n2200 release btn\n3500 press btn\n3600 release btn\n7000 press btn\n7100 release btn' },
      { name: '沒人按', duration: 3000, events: '' },
    ],
    solution: `const int GREEN = 3, YELLOW = 4, RED = 5;

void setup() {
  pinMode(2, INPUT_PULLUP);
  pinMode(GREEN, OUTPUT);
  pinMode(YELLOW, OUTPUT);
  pinMode(RED, OUTPUT);
  digitalWrite(GREEN, HIGH);
}

void loop() {
  if (digitalRead(2) == LOW) {
    digitalWrite(GREEN, LOW);
    digitalWrite(YELLOW, HIGH);
    delay(1000);
    digitalWrite(YELLOW, LOW);
    digitalWrite(RED, HIGH);
    delay(3000);
    digitalWrite(RED, LOW);
    digitalWrite(GREEN, HIGH);
  }
}
`,
  },
  {
    id: 'b23-bar', title: '音量指示燈條', level: 3, tags: ['WS2812', '類比輸入', 'map'],
    desc: `音響上常有一排燈表示音量大小。可變電阻（A0）代表音量旋鈕，WS2812 燈條（D6）有 8 顆燈。

- 用 \`map(讀值, 0, 1023, 0, 8)\` 算出要亮幾顆燈 n
- 從第 0 顆開始，前 n 顆亮綠色 \`Color(0, 150, 0)\`，其餘不亮
- 旋鈕轉動時，燈條要跟著變化

提示：每次先 \`clear()\`，再用 \`for\` 迴圈設定前 n 顆，最後 \`show()\`。`,
    circuit: [
      { id: 'vol', type: 'pot', pin: 14, label: '音量旋鈕', value: 512 },
      { id: 'strip', type: 'ws2812', pin: 6, count: 8, label: '音量燈條' },
    ],
    compare: [{ kind: 'pixels', pin: 6 }],
    cases: [
      { name: '轉大聲', duration: 3000, events: '0 set vol 0\n500 set vol 300\n1000 set vol 512\n1500 set vol 900\n2000 set vol 1023', sample: true },
      { name: '忽大忽小', duration: 3000, events: '0 set vol 1023\n600 set vol 128\n1200 set vol 700\n1800 set vol 5\n2400 set vol 640' },
    ],
    solution: `#include <Adafruit_NeoPixel.h>

Adafruit_NeoPixel strip(8, 6, NEO_GRB + NEO_KHZ800);

void setup() {
  strip.begin();
}

void loop() {
  int n = map(analogRead(A0), 0, 1023, 0, 8);
  strip.clear();
  for (int i = 0; i < n; i++) {
    strip.setPixelColor(i, strip.Color(0, 150, 0));
  }
  strip.show();
  delay(20);
}
`,
  },
  {
    id: 'b24-twoblink', title: '同時閃兩顆燈（不用 delay）', level: 4, tags: ['millis', '多工'],
    desc: `紅燈（D12）每 0.5 秒切換一次亮暗，綠燈（D11）每 0.3 秒切換一次亮暗，兩顆燈要「同時」各自閃爍。

- 開機時兩顆燈都是亮的
- 0.3 秒時綠燈變暗，0.5 秒時紅燈變暗，0.6 秒時綠燈變亮……依此類推

這題不能用 \`delay\` 來等待（一 delay 另一顆燈就停了）。請改用 \`millis()\` 記錄「上次切換的時間」，時間到了才切換。`,
    circuit: [
      { id: 'red', type: 'led', pin: 12, color: 'red', label: '紅燈' },
      { id: 'green', type: 'led', pin: 11, color: 'green', label: '綠燈' },
    ],
    compare: [{ kind: 'pin', pin: 12 }, { kind: 'pin', pin: 11 }],
    cases: [{ name: '閃 4 秒', duration: 4000, events: '', sample: true }],
    solution: `unsigned long lastRed = 0, lastGreen = 0;
bool redOn = true, greenOn = true;

void setup() {
  pinMode(12, OUTPUT);
  pinMode(11, OUTPUT);
  digitalWrite(12, HIGH);
  digitalWrite(11, HIGH);
}

void loop() {
  unsigned long now = millis();
  if (now - lastRed >= 500) {
    lastRed += 500;
    redOn = !redOn;
    digitalWrite(12, redOn);
  }
  if (now - lastGreen >= 300) {
    lastGreen += 300;
    greenOn = !greenOn;
    digitalWrite(11, greenOn);
  }
}
`,
  },
  {
    id: 'b25-lock', title: '密碼門鎖', level: 4, tags: ['序列埠', 'String', '應用'],
    desc: `做一個密碼門鎖。從序列埠輸入一行密碼（以換行結尾）：

- 密碼是 \`1234\`：輸出 \`OPEN\`，綠燈（D3）亮 2 秒後熄滅
- 其他密碼：輸出 \`WRONG\`，紅燈（D4）亮 1 秒後熄滅

提示：用 \`String pw = Serial.readStringUntil('\\n');\` 讀一整行，再用 \`pw.trim();\` 去掉多餘的空白，最後用 \`pw == "1234"\` 比較。`,
    circuit: [
      { id: 'green', type: 'led', pin: 3, color: 'green', label: '開門燈' },
      { id: 'red', type: 'led', pin: 4, color: 'red', label: '錯誤燈' },
    ],
    compare: [{ kind: 'serial', mode: 'lines' }, { kind: 'pin', pin: 3 }, { kind: 'pin', pin: 4 }],
    cases: [
      { name: '輸入正確密碼', duration: 3000, events: '200 serial 1234\\n', sample: true },
      { name: '錯了再試', duration: 6000, events: '200 serial 0000\\n\n1800 serial 12345\\n\n3300 serial 1234\\n' },
      { name: '各種錯誤', duration: 5000, events: '100 serial abcd\\n\n1500 serial 123\\n\n3000 serial 4321\\n' },
    ],
    solution: `void setup() {
  pinMode(3, OUTPUT);
  pinMode(4, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  if (Serial.available() > 0) {
    String pw = Serial.readStringUntil('\\n');
    pw.trim();
    if (pw == "1234") {
      Serial.println("OPEN");
      digitalWrite(3, HIGH);
      delay(2000);
      digitalWrite(3, LOW);
    } else {
      Serial.println("WRONG");
      digitalWrite(4, HIGH);
      delay(1000);
      digitalWrite(4, LOW);
    }
  }
}
`,
  },
  {
    id: 'b26-stats', title: '成績統計', level: 4, tags: ['序列埠', '陣列', '小數'],
    desc: `老師輸入 5 位同學的分數（同一行，用空白隔開，行尾是換行）。請輸出最高分、最低分和平均（平均到小數點後 2 位），格式如下：

範例輸入：
\`80 95 62 70 88\`

範例輸出：
\`MAX 95\`
\`MIN 62\`
\`AVG 79.00\`

每收到一行就輸出一組答案。提示：用 \`Serial.parseInt()\` 讀 5 次；平均要用 \`float\` 計算。`,
    circuit: [],
    compare: [{ kind: 'serial', mode: 'lines' }],
    cases: [
      { name: '範例', duration: 3500, events: '100 serial 80 95 62 70 88\\n', sample: true },
      { name: '多組資料', duration: 4500, events: '100 serial 100 100 100 100 99\\n\n1000 serial 0 59 60 61 1\\n\n2000 serial 33 67 50 50 51\\n' },
    ],
    solution: `void setup() {
  Serial.begin(9600);
}

void loop() {
  if (Serial.available() > 0) {
    int score[5];
    for (int i = 0; i < 5; i++) {
      score[i] = Serial.parseInt();
    }
    Serial.read();
    int mx = score[0], mn = score[0], sum = 0;
    for (int i = 0; i < 5; i++) {
      if (score[i] > mx) mx = score[i];
      if (score[i] < mn) mn = score[i];
      sum += score[i];
    }
    Serial.print("MAX ");
    Serial.println(mx);
    Serial.print("MIN ");
    Serial.println(mn);
    Serial.print("AVG ");
    Serial.println(sum / 5.0, 2);
  }
}
`,
  },
);

// 依難度排序（同難度維持原順序）
const order = new Map(AJ.BUILTIN_PROBLEMS.map((p, i) => [p.id, i]));
AJ.BUILTIN_PROBLEMS.sort((a, b) => (a.level - b.level) || (order.get(a.id) - order.get(b.id)));
AJ.LEVEL_NAMES = { 1: '入門', 2: '基礎', 3: '應用', 4: '挑戰' };
})(typeof window !== 'undefined' ? window : globalThis);
