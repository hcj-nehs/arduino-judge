/* 單元分類 ＋ 第三批題目（國中生的生活應用）。難度：1 入門、2 基礎、3 應用、4 挑戰 */
(function (G) {
'use strict';
const AJ = G.AJ = G.AJ || {};

AJ.UNITS = [
  { id: 'u1', name: '1. LED 與數位輸出' },
  { id: 'u2', name: '2. 按鈕與數位輸入' },
  { id: 'u3', name: '3. 序列埠與計算' },
  { id: 'u4', name: '4. 類比輸入與 PWM' },
  { id: 'u5', name: '5. 蜂鳴器與聲音' },
  { id: 'u6', name: '6. 伺服馬達' },
  { id: 'u7', name: '7. WS2812 全彩燈' },
  { id: 'u8', name: '8. 綜合應用' },
];
const UNIT_OF = {
  'b01-blink': 'u1', 'b02-traffic': 'u1', 'b09-rgb': 'u1', 'b14-scanner': 'u1',
  'b03-button': 'u2', 'b04-toggle': 'u2', 'b20-counter': 'u2', 'b22-crossing': 'u2',
  'b05-sum': 'u3', 'b06-grade': 'u3', 'b17-temp': 'u3', 'b18-table': 'u3', 'b26-stats': 'u3', 'b25-lock': 'u3',
  'b07-dimmer': 'u4', 'b08-nightlight': 'u4', 'b13-breath': 'u4', 'b19-parking': 'u4',
  'b10-doorbell': 'u5', 'b15-melody': 'u5',
  'b11-servo': 'u6', 'b16-sweep': 'u6',
  'b12-chaser': 'u7', 'b23-bar': 'u7',
  'b21-dice': 'u8', 'b24-twoblink': 'u8',
};
AJ.BUILTIN_PROBLEMS.forEach(p => { p.unit = UNIT_OF[p.id] || 'u8'; });

const LED = (id, pin, color, label) => ({ id, type: 'led', pin, color, label });
const BTN = (id, pin, label) => ({ id, type: 'button', pin, wiring: 'pullup', label });
const PIN = pin => ({ kind: 'pin', pin });
const SERIAL = { kind: 'serial', mode: 'lines' };

AJ.BUILTIN_PROBLEMS.push(
  /* ------------------------------------------------------------ 1. LED */
  {
    id: 'c101-police', unit: 'u1', title: '警車燈', level: 1, tags: ['數位輸出'],
    desc: `警車的紅藍燈會輪流閃。紅燈接 D2、藍燈接 D3：

- 紅燈亮、藍燈暗 0.25 秒
- 紅燈暗、藍燈亮 0.25 秒
- 不斷重複（開機時紅燈先亮）`,
    circuit: [LED('red', 2, 'red', '紅燈'), LED('blue', 3, 'blue', '藍燈')],
    compare: [PIN(2), PIN(3)],
    cases: [{ name: '閃 2 秒', duration: 2000, events: '', sample: true }],
    solution: `void setup() {
  pinMode(2, OUTPUT);
  pinMode(3, OUTPUT);
}

void loop() {
  digitalWrite(2, HIGH);
  digitalWrite(3, LOW);
  delay(250);
  digitalWrite(2, LOW);
  digitalWrite(3, HIGH);
  delay(250);
}
`,
  },
  {
    id: 'c102-sos', unit: 'u1', title: 'SOS 求救燈', level: 2, tags: ['數位輸出', '函式'],
    desc: `摩斯密碼的 SOS 是「三短、三長、三短」。用 D13 的 LED 打出 SOS：

- 短訊號：亮 0.2 秒、暗 0.2 秒
- 長訊號：亮 0.6 秒、暗 0.2 秒
- 打完九個訊號後，再暗 1 秒，然後重新開始

提示：寫一個函式 \`void signal(int ms)\`，亮 ms 毫秒再暗 0.2 秒，就不用重複寫很多次。`,
    circuit: [LED('led1', 13, 'red', 'LED')],
    compare: [PIN(13)],
    cases: [{ name: '打一次多', duration: 7000, events: '', sample: true }],
    solution: `void signal(int ms) {
  digitalWrite(13, HIGH);
  delay(ms);
  digitalWrite(13, LOW);
  delay(200);
}

void setup() {
  pinMode(13, OUTPUT);
}

void loop() {
  for (int i = 0; i < 3; i++) signal(200);
  for (int i = 0; i < 3; i++) signal(600);
  for (int i = 0; i < 3; i++) signal(200);
  delay(1000);
}
`,
  },
  {
    id: 'c103-countdown', unit: 'u1', title: '五秒倒數燈', level: 2, tags: ['數位輸出', 'for 迴圈'],
    desc: `D2～D6 接了 5 顆 LED，用來做倒數計時：

- 一開始 5 顆燈全亮
- 每過 1 秒，從 D6 開始熄滅一顆（1 秒時 D6 熄、2 秒時 D5 熄……5 秒時 D2 熄）
- 全部熄滅 1 秒後，再全部亮起來，重新倒數

提示：熄燈的順序是 6、5、4、3、2，可以用 \`for (int i = 6; i >= 2; i--)\`。`,
    circuit: [2, 3, 4, 5, 6].map((p, i) => LED('l' + (i + 1), p, i < 2 ? 'green' : i < 4 ? 'yellow' : 'red', 'LED ' + (i + 1))),
    compare: [2, 3, 4, 5, 6].map(PIN),
    cases: [{ name: '倒數兩輪', duration: 13000, events: '', sample: true }],
    solution: `void setup() {
  for (int i = 2; i <= 6; i++) pinMode(i, OUTPUT);
}

void loop() {
  for (int i = 2; i <= 6; i++) digitalWrite(i, HIGH);
  delay(1000);
  for (int i = 6; i >= 2; i--) {
    digitalWrite(i, LOW);
    delay(1000);
  }
}
`,
  },
  {
    id: 'c104-walkman', unit: 'u1', title: '綠燈閃爍提醒', level: 2, tags: ['數位輸出', 'for 迴圈'],
    desc: `紅綠燈要變黃燈之前，綠燈會先閃幾下提醒。紅燈 D4、黃燈 D3、綠燈 D2，依序循環：

- 綠燈亮 3 秒
- 綠燈閃 3 下：每下「暗 0.25 秒、亮 0.25 秒」
- 綠燈熄滅，黃燈亮 1 秒
- 紅燈亮 3 秒

同一時間只能亮一顆燈（綠燈閃爍時，其他燈都是暗的）。`,
    circuit: [LED('red', 4, 'red', '紅燈'), LED('yellow', 3, 'yellow', '黃燈'), LED('green', 2, 'green', '綠燈')],
    compare: [PIN(2), PIN(3), PIN(4)],
    cases: [{ name: '一輪多', duration: 10000, events: '', sample: true }],
    solution: `const int RED = 4, YELLOW = 3, GREEN = 2;

void setup() {
  pinMode(RED, OUTPUT);
  pinMode(YELLOW, OUTPUT);
  pinMode(GREEN, OUTPUT);
}

void loop() {
  digitalWrite(GREEN, HIGH);
  delay(3000);
  for (int i = 0; i < 3; i++) {
    digitalWrite(GREEN, LOW);
    delay(250);
    digitalWrite(GREEN, HIGH);
    delay(250);
  }
  digitalWrite(GREEN, LOW);
  digitalWrite(YELLOW, HIGH);
  delay(1000);
  digitalWrite(YELLOW, LOW);
  digitalWrite(RED, HIGH);
  delay(3000);
  digitalWrite(RED, LOW);
}
`,
  },
  {
    id: 'c105-binary', unit: 'u1', title: '二進位計數燈', level: 3, tags: ['數位輸出', '二進位'],
    desc: `用 4 顆 LED 顯示二進位數字。D2 是最低位（1），D3 是 2，D4 是 4，D5 是最高位（8）：

- 從 0 開始，每 0.5 秒加 1，顯示 0、1、2、……、15
- 顯示到 15 之後，回到 0 重新開始
- 某一位是 1 就亮，是 0 就暗（例如 5 = 0101，D2 和 D4 亮）

提示：\`bitRead(n, k)\` 可以取出 n 的第 k 位（0 或 1）。`,
    circuit: [LED('b0', 2, 'red', '1'), LED('b1', 3, 'red', '2'), LED('b2', 4, 'red', '4'), LED('b3', 5, 'red', '8')],
    compare: [2, 3, 4, 5].map(PIN),
    cases: [{ name: '數一輪', duration: 8800, events: '', sample: true }],
    solution: `void setup() {
  for (int i = 2; i <= 5; i++) pinMode(i, OUTPUT);
}

void loop() {
  for (int n = 0; n < 16; n++) {
    for (int k = 0; k < 4; k++) {
      digitalWrite(2 + k, bitRead(n, k));
    }
    delay(500);
  }
}
`,
  },

  /* ------------------------------------------------------------ 2. 按鈕 */
  {
    id: 'c201-onoff', unit: 'u2', title: '開燈鈕與關燈鈕', level: 1, tags: ['數位輸入'],
    desc: `牆上有兩個按鈕：「開」接 D2、「關」接 D3（都接 GND，請用 \`INPUT_PULLUP\`），電燈接 D13。

- 按一下「開」：燈亮，放開後繼續亮
- 按一下「關」：燈熄，放開後繼續熄
- 開機時燈是熄的`,
    circuit: [BTN('on', 2, '開'), BTN('off', 3, '關'), LED('led1', 13, 'yellow', '電燈')],
    compare: [PIN(13)],
    cases: [
      { name: '開了又關', duration: 3000, events: '500 press on\n700 release on\n1800 press off\n2000 release off', sample: true },
      { name: '連按', duration: 4000, events: '300 press on\n400 release on\n900 press on\n1000 release on\n1500 press off\n1600 release off\n2000 press off\n2100 release off\n2800 press on\n2900 release on' },
    ],
    solution: `void setup() {
  pinMode(2, INPUT_PULLUP);
  pinMode(3, INPUT_PULLUP);
  pinMode(13, OUTPUT);
}

void loop() {
  if (digitalRead(2) == LOW) digitalWrite(13, HIGH);
  if (digitalRead(3) == LOW) digitalWrite(13, LOW);
}
`,
  },
  {
    id: 'c202-stairs', unit: 'u2', title: '樓梯燈', level: 2, tags: ['數位輸入', 'delay'],
    desc: `樓梯的燈按一下會亮一段時間後自動熄滅。按鈕接 D2（接 GND，請用 \`INPUT_PULLUP\`），燈接 D13：

- 按一下按鈕，燈立刻亮
- 亮 3 秒後自動熄滅
- 燈亮著的這 3 秒內，再按按鈕不會延長時間`,
    circuit: [BTN('btn', 2, '按鈕'), LED('led1', 13, 'white', '樓梯燈')],
    compare: [PIN(13)],
    cases: [
      { name: '按一次', duration: 4500, events: '500 press btn\n700 release btn', sample: true },
      { name: '亮的時候又按', duration: 9000, events: '300 press btn\n500 release btn\n1500 press btn\n1700 release btn\n5000 press btn\n5200 release btn' },
    ],
    solution: `void setup() {
  pinMode(2, INPUT_PULLUP);
  pinMode(13, OUTPUT);
}

void loop() {
  if (digitalRead(2) == LOW) {
    digitalWrite(13, HIGH);
    delay(3000);
    digitalWrite(13, LOW);
  }
}
`,
  },
  {
    id: 'c203-quiz', unit: 'u2', title: '搶答器', level: 3, tags: ['數位輸入', '狀態', '序列埠'],
    desc: `做一台兩人搶答器。A 的按鈕接 D2、B 的按鈕接 D3、老師的重設鈕接 D4（都接 GND，請用 \`INPUT_PULLUP\`）。A 的燈接 D12、B 的燈接 D11。

- 誰先按，誰的燈就亮，並從序列埠輸出 \`A\` 或 \`B\`
- 有人搶到之後，另一個人再按都沒有用
- 老師按重設：兩顆燈都熄滅，輸出 \`RESET\`，可以再搶答
- 還沒有人搶答時按重設，什麼都不做

提示：用一個變數記錄「目前誰搶到」（0 = 還沒有人）。`,
    circuit: [BTN('a', 2, 'A 按鈕'), BTN('b', 3, 'B 按鈕'), BTN('reset', 4, '重設'), LED('la', 12, 'red', 'A 燈'), LED('lb', 11, 'blue', 'B 燈')],
    compare: [SERIAL, PIN(12), PIN(11)],
    cases: [
      { name: 'A 先搶到', duration: 3000, events: '500 press a\n700 release a\n900 press b\n1100 release b\n2000 press reset\n2200 release reset', sample: true },
      { name: '好幾回合', duration: 6000, events: '300 press reset\n400 release reset\n800 press b\n900 release b\n1000 press a\n1100 release a\n2000 press reset\n2100 release reset\n2500 press a\n2600 release a\n3500 press reset\n3600 release reset\n4000 press b\n4100 release b' },
    ],
    solution: `int winner = 0;

void setup() {
  pinMode(2, INPUT_PULLUP);
  pinMode(3, INPUT_PULLUP);
  pinMode(4, INPUT_PULLUP);
  pinMode(12, OUTPUT);
  pinMode(11, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  if (winner == 0) {
    if (digitalRead(2) == LOW) {
      winner = 1;
      digitalWrite(12, HIGH);
      Serial.println("A");
    } else if (digitalRead(3) == LOW) {
      winner = 2;
      digitalWrite(11, HIGH);
      Serial.println("B");
    }
  }
  if (winner != 0 && digitalRead(4) == LOW) {
    winner = 0;
    digitalWrite(12, LOW);
    digitalWrite(11, LOW);
    Serial.println("RESET");
  }
}
`,
  },
  {
    id: 'c204-modes', unit: 'u2', title: '三段式檯燈', level: 4, tags: ['數位輸入', '狀態', 'millis'],
    desc: `檯燈只有一個按鈕（D2，接 GND，請用 \`INPUT_PULLUP\`），燈接 D13。每按一下切換一種模式：

- 模式 0：熄滅（開機時）
- 模式 1：恆亮
- 模式 2：閃爍——進入時先亮，之後每 0.25 秒切換一次亮暗
- 再按一下回到模式 0

按住不放只算按一下。閃爍時不能用 \`delay\`（會漏掉按鈕），請用 \`millis()\` 計時。`,
    circuit: [BTN('btn', 2, '按鈕'), LED('led1', 13, 'yellow', '檯燈')],
    compare: [PIN(13)],
    cases: [
      { name: '按三下', duration: 4000, events: '500 press btn\n700 release btn\n1500 press btn\n1700 release btn\n3000 press btn\n3200 release btn', sample: true },
      { name: '閃爍時切換', duration: 5000, events: '200 press btn\n300 release btn\n600 press btn\n700 release btn\n2130 press btn\n2230 release btn\n2600 press btn\n2700 release btn\n3000 press btn\n4500 release btn' },
    ],
    solution: `int mode = 0;
int lastState = HIGH;
unsigned long t0 = 0;
bool on = false;

void setup() {
  pinMode(2, INPUT_PULLUP);
  pinMode(13, OUTPUT);
}

void loop() {
  int s = digitalRead(2);
  if (lastState == HIGH && s == LOW) {
    mode = (mode + 1) % 3;
    t0 = millis();
    on = true;
  }
  lastState = s;
  if (mode == 0) {
    digitalWrite(13, LOW);
  } else if (mode == 1) {
    digitalWrite(13, HIGH);
  } else {
    if (millis() - t0 >= 250) {
      t0 += 250;
      on = !on;
    }
    digitalWrite(13, on);
  }
}
`,
  },

  /* ------------------------------------------------------------ 3. 序列埠 */
  {
    id: 'c301-gcd', unit: 'u3', title: '最大公因數', level: 2, tags: ['序列埠', 'while 迴圈'],
    desc: `從序列埠讀入兩個正整數 a、b（同一行，用空白隔開），輸出它們的最大公因數。每收到一行就輸出一個答案。

範例輸入：
\`12 18\`

範例輸出：
\`6\`

提示：輾轉相除法——當 b 不是 0 時，一直做 \`r = a % b; a = b; b = r;\`，最後的 a 就是答案。`,
    circuit: [],
    compare: [SERIAL],
    cases: [
      { name: '範例', duration: 3500, events: '100 serial 12 18\\n', sample: true },
      { name: '多組', duration: 5000, events: '100 serial 7 13\\n\n800 serial 100 75\\n\n1500 serial 1024 768\\n\n2200 serial 9 9\\n' },
    ],
    solution: `void setup() {
  Serial.begin(9600);
}

void loop() {
  if (Serial.available() > 0) {
    long a = Serial.parseInt();
    long b = Serial.parseInt();
    Serial.read();
    while (b != 0) {
      long r = a % b;
      a = b;
      b = r;
    }
    Serial.println(a);
  }
}
`,
  },
  {
    id: 'c302-prime', unit: 'u3', title: '質數判斷', level: 2, tags: ['序列埠', 'for 迴圈'],
    desc: `從序列埠讀入一個整數 n（2 ≤ n ≤ 30000，每行一個）。n 是質數就輸出 \`YES\`，不是就輸出 \`NO\`。

範例輸入：
\`17\`

範例輸出：
\`YES\``,
    circuit: [],
    compare: [SERIAL],
    cases: [
      { name: '範例', duration: 3500, events: '100 serial 17\\n', sample: true },
      { name: '各種數字', duration: 7000, events: '100 serial 2\\n\n600 serial 9\\n\n1100 serial 97\\n\n1600 serial 100\\n\n2100 serial 29989\\n\n2600 serial 30000\\n\n3100 serial 3\\n\n3600 serial 4\\n\n4100 serial 25\\n' },
    ],
    solution: `void setup() {
  Serial.begin(9600);
}

void loop() {
  if (Serial.available() > 0) {
    long n = Serial.parseInt();
    Serial.read();
    bool prime = true;
    for (long i = 2; i * i <= n; i++) {
      if (n % i == 0) {
        prime = false;
        break;
      }
    }
    Serial.println(prime ? "YES" : "NO");
  }
}
`,
  },
  {
    id: 'c303-bmi', unit: 'u3', title: 'BMI 計算機', level: 2, tags: ['序列埠', '小數'],
    desc: `從序列埠讀入身高（公分）和體重（公斤），兩個整數用空白隔開。輸出 BMI，到小數點後 1 位。

公式：BMI = 體重 ÷（身高公尺 × 身高公尺），身高公尺 = 身高公分 ÷ 100

範例輸入：
\`160 50\`

範例輸出：
\`19.5\`

提示：要用 \`float\` 計算，整數相除會把小數去掉。`,
    circuit: [],
    compare: [SERIAL],
    cases: [
      { name: '範例', duration: 3500, events: '100 serial 160 50\\n', sample: true },
      { name: '多人', duration: 5000, events: '100 serial 175 70\\n\n800 serial 150 45\\n\n1500 serial 182 95\\n' },
    ],
    solution: `void setup() {
  Serial.begin(9600);
}

void loop() {
  if (Serial.available() > 0) {
    int h = Serial.parseInt();
    int w = Serial.parseInt();
    Serial.read();
    float m = h / 100.0;
    float bmi = w / (m * m);
    Serial.println(bmi, 1);
  }
}
`,
  },
  {
    id: 'c304-countdown', unit: 'u3', title: '火箭發射倒數', level: 2, tags: ['序列埠', 'for 迴圈'],
    desc: `從序列埠讀入一個整數 n（1～5），從 n 倒數到 1，每個數字一行、每秒印一個，最後印出 \`GO!\`。

範例輸入：
\`3\`

範例輸出：
\`3\`
\`2\`
\`1\`
\`GO!\``,
    circuit: [],
    compare: [SERIAL],
    cases: [
      { name: '範例', duration: 5500, events: '100 serial 3\\n', sample: true },
      { name: '倒數 5', duration: 7500, events: '100 serial 5\\n' },
      { name: '倒數 1', duration: 3000, events: '100 serial 1\\n' },
    ],
    solution: `void setup() {
  Serial.begin(9600);
}

void loop() {
  if (Serial.available() > 0) {
    int n = Serial.parseInt();
    Serial.read();
    for (int i = n; i >= 1; i--) {
      Serial.println(i);
      delay(1000);
    }
    Serial.println("GO!");
  }
}
`,
  },
  {
    id: 'c305-stars', unit: 'u3', title: '星星三角形', level: 2, tags: ['序列埠', '巢狀迴圈'],
    desc: `從序列埠讀入一個整數 n（1～9），印出 n 行星號：第 1 行 1 個、第 2 行 2 個……第 n 行 n 個。

範例輸入：
\`3\`

範例輸出：
\`*\`
\`**\`
\`***\`

提示：外層迴圈決定第幾行，內層迴圈印星號；每行最後用 \`Serial.println()\` 換行。`,
    circuit: [],
    compare: [SERIAL],
    cases: [
      { name: '範例', duration: 3500, events: '100 serial 3\\n', sample: true },
      { name: '大三角形', duration: 4500, events: '100 serial 7\\n\n1000 serial 1\\n' },
    ],
    solution: `void setup() {
  Serial.begin(9600);
}

void loop() {
  if (Serial.available() > 0) {
    int n = Serial.parseInt();
    Serial.read();
    for (int i = 1; i <= n; i++) {
      for (int j = 0; j < i; j++) {
        Serial.print("*");
      }
      Serial.println();
    }
  }
}
`,
  },
  {
    id: 'c306-command', unit: 'u3', title: '文字指令開關燈', level: 3, tags: ['序列埠', 'String'],
    desc: `從序列埠輸入文字指令（每行一個）控制 D13 的 LED：

- \`ON\`：開燈，輸出 \`LED ON\`
- \`OFF\`：關燈，輸出 \`LED OFF\`
- \`TOGGLE\`：切換開關，輸出切換後的狀態（\`LED ON\` 或 \`LED OFF\`）
- 其他指令：輸出 \`?\`，燈不變

開機時燈是關的。提示：用 \`Serial.readStringUntil('\\n')\` 讀一行，再 \`trim()\`。`,
    circuit: [LED('led1', 13, 'green', 'LED')],
    compare: [SERIAL, PIN(13)],
    cases: [
      { name: '範例', duration: 3000, events: '200 serial ON\\n\n1200 serial OFF\\n', sample: true },
      { name: '行尾多了 CR 與空白', duration: 3000, events: '200 serial ON\\r\\n\n1000 serial  TOGGLE \\r\\n\n1800 serial OFF \\n' },
      { name: '切換與錯誤指令', duration: 5000, events: '200 serial TOGGLE\\n\n900 serial TOGGLE\\n\n1600 serial hello\\n\n2300 serial ON\\n\n3000 serial TOGGLE\\n\n3700 serial on\\n' },
    ],
    solution: `bool on = false;

void setup() {
  pinMode(13, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\\n');
    cmd.trim();
    if (cmd == "ON") on = true;
    else if (cmd == "OFF") on = false;
    else if (cmd == "TOGGLE") on = !on;
    else {
      Serial.println("?");
      return;
    }
    digitalWrite(13, on);
    Serial.println(on ? "LED ON" : "LED OFF");
  }
}
`,
  },

  /* ------------------------------------------------------------ 4. 類比 */
  {
    id: 'c401-voltmeter', unit: 'u4', title: '電壓計', level: 2, tags: ['類比輸入', '序列埠', '小數'],
    desc: `做一個電壓計：可變電阻接 A0，讀值 0～1023 代表 0～5V。

每當序列埠收到一行文字（任何內容都可以），就讀取 A0，輸出目前的電壓，到小數點後 2 位，後面加上 \`V\`。

電壓 = 讀值 × 5.0 ÷ 1023

範例：讀值 512 時輸出 \`2.50V\``,
    circuit: [{ id: 'pot', type: 'pot', pin: 14, label: '可變電阻', value: 512 }],
    compare: [SERIAL],
    cases: [
      { name: '範例', duration: 2500, events: '0 set pot 512\n100 serial ?\\n', sample: true },
      { name: '轉動後量測', duration: 4000, events: '0 set pot 0\n100 serial ?\\n\n500 set pot 1023\n600 serial ?\\n\n1000 set pot 300\n1100 serial ?\\n\n1500 set pot 777\n1600 serial v\\n' },
    ],
    solution: `void setup() {
  Serial.begin(9600);
}

void loop() {
  if (Serial.available() > 0) {
    Serial.readStringUntil('\\n');
    int v = analogRead(A0);
    float volt = v * 5.0 / 1023;
    Serial.print(volt, 2);
    Serial.println("V");
  }
}
`,
  },
  {
    id: 'c402-streetlight', unit: 'u4', title: '三段式路燈', level: 2, tags: ['類比輸入', 'PWM'],
    desc: `路燈會依照天色調整亮度。光敏電阻接 A1（越亮讀值越大），路燈 LED 接 D9：

- 讀值 < 300（天黑）：亮度 255
- 300 ≤ 讀值 < 700（傍晚）：亮度 100
- 讀值 ≥ 700（白天）：熄滅（亮度 0）

用 \`analogWrite\` 設定亮度。`,
    circuit: [{ id: 'ldr', type: 'ldr', pin: 15, label: '光敏電阻', value: 800 }, LED('led1', 9, 'white', '路燈')],
    compare: [PIN(9)],
    cases: [
      { name: '天黑了', duration: 3000, events: '0 set ldr 900\n800 set ldr 500\n1600 set ldr 100\n2400 set ldr 750', sample: true },
      { name: '邊界', duration: 3500, events: '0 set ldr 300\n500 set ldr 299\n1000 set ldr 700\n1500 set ldr 699\n2000 set ldr 0\n2500 set ldr 1023' },
    ],
    solution: `void setup() {
  pinMode(9, OUTPUT);
}

void loop() {
  int v = analogRead(A1);
  if (v < 300) analogWrite(9, 255);
  else if (v < 700) analogWrite(9, 100);
  else analogWrite(9, 0);
  delay(20);
}
`,
  },
  {
    id: 'c403-colorknob', unit: 'u4', title: '旋鈕選顏色', level: 2, tags: ['類比輸入', 'RGB'],
    desc: `轉動可變電阻（A0）來選擇 RGB LED 的顏色。RGB LED 的紅、綠、藍接 D9、D10、D11（HIGH 亮）：

- 讀值 0～340：紅色
- 讀值 341～681：綠色
- 讀值 682～1023：藍色

同一時間只亮一種顏色。`,
    circuit: [{ id: 'pot', type: 'pot', pin: 14, label: '可變電阻', value: 0 }, { id: 'rgb1', type: 'rgb', r: 9, g: 10, b: 11, label: 'RGB LED' }],
    compare: [PIN(9), PIN(10), PIN(11)],
    cases: [
      { name: '轉一圈', duration: 3000, events: '0 set pot 100\n800 set pot 500\n1600 set pot 900\n2400 set pot 0', sample: true },
      { name: '邊界', duration: 3500, events: '0 set pot 340\n500 set pot 341\n1000 set pot 681\n1500 set pot 682\n2000 set pot 1023' },
    ],
    solution: `void setup() {
  pinMode(9, OUTPUT);
  pinMode(10, OUTPUT);
  pinMode(11, OUTPUT);
}

void loop() {
  int v = analogRead(A0);
  digitalWrite(9, v <= 340);
  digitalWrite(10, v >= 341 && v <= 681);
  digitalWrite(11, v >= 682);
  delay(20);
}
`,
  },
  {
    id: 'c404-fever', unit: 'u4', title: '體溫警報器', level: 3, tags: ['類比輸入', 'map', '序列埠'],
    desc: `用可變電阻（A0）模擬溫度感測器：溫度 = \`map(讀值, 0, 1023, 30, 42)\`（單位 °C）。

- 溫度 ≥ 38：紅燈（D12）亮、綠燈（D11）熄，蜂鳴器（D8）發出 2000 Hz 警報聲
- 溫度 < 38：綠燈亮、紅燈熄，蜂鳴器安靜
- 開機後先從序列埠印出一次溫度，之後溫度有改變才再印，格式：\`TEMP 36\``,
    circuit: [{ id: 'temp', type: 'pot', pin: 14, label: '溫度感測器', value: 512 }, LED('red', 12, 'red', '紅燈'), LED('green', 11, 'green', '綠燈'), { id: 'bz', type: 'buzzer', pin: 8, label: '蜂鳴器' }],
    compare: [SERIAL, PIN(12), PIN(11), { kind: 'tone', pin: 8 }],
    cases: [
      { name: '發燒了', duration: 3000, events: '0 set temp 512\n1000 set temp 800\n2000 set temp 400', sample: true },
      { name: '剛好 38 度', duration: 3500, events: '0 set temp 0\n600 set temp 682\n1200 set temp 681\n1800 set temp 1023\n2400 set temp 1022' },
    ],
    solution: `int last = -1;

void setup() {
  pinMode(12, OUTPUT);
  pinMode(11, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int t = map(analogRead(A0), 0, 1023, 30, 42);
  if (t != last) {
    Serial.print("TEMP ");
    Serial.println(t);
    last = t;
  }
  if (t >= 38) {
    digitalWrite(12, HIGH);
    digitalWrite(11, LOW);
    tone(8, 2000);
  } else {
    digitalWrite(12, LOW);
    digitalWrite(11, HIGH);
    noTone(8);
  }
  delay(20);
}
`,
  },

  /* ------------------------------------------------------------ 5. 聲音 */
  {
    id: 'c501-siren', unit: 'u5', title: '救護車警笛', level: 2, tags: ['蜂鳴器'],
    desc: `讓蜂鳴器（D8）發出救護車的「喔咿喔咿」聲：

- 960 Hz 響 0.5 秒
- 770 Hz 響 0.5 秒
- 不斷重複`,
    circuit: [{ id: 'bz', type: 'buzzer', pin: 8, label: '蜂鳴器' }],
    compare: [{ kind: 'tone', pin: 8 }],
    cases: [{ name: '響 3 秒', duration: 3000, events: '', sample: true }],
    solution: `void setup() {
}

void loop() {
  tone(8, 960);
  delay(500);
  tone(8, 770);
  delay(500);
}
`,
  },
  {
    id: 'c502-start', unit: 'u5', title: '比賽開始提示音', level: 2, tags: ['蜂鳴器', 'for 迴圈'],
    desc: `賽跑開始前的提示音：開機後蜂鳴器（D8）

- 「嗶」三聲短音：每聲 1000 Hz 響 0.2 秒、安靜 0.3 秒
- 接著一聲長音：1500 Hz 響 1 秒
- 之後保持安靜（只響一次）`,
    circuit: [{ id: 'bz', type: 'buzzer', pin: 8, label: '蜂鳴器' }],
    compare: [{ kind: 'tone', pin: 8 }],
    cases: [{ name: '開機提示', duration: 3500, events: '', sample: true }],
    solution: `void setup() {
  for (int i = 0; i < 3; i++) {
    tone(8, 1000);
    delay(200);
    noTone(8);
    delay(300);
  }
  tone(8, 1500);
  delay(1000);
  noTone(8);
}

void loop() {
}
`,
  },
  {
    id: 'c503-piano', unit: 'u5', title: '三鍵電子琴', level: 3, tags: ['蜂鳴器', '數位輸入'],
    desc: `做一台只有三個鍵的電子琴。按鍵接 D2、D3、D4（都接 GND，請用 \`INPUT_PULLUP\`），蜂鳴器接 D8：

- 按住 D2：Do（262 Hz）
- 按住 D3：Re（294 Hz）
- 按住 D4：Mi（330 Hz）
- 沒有按任何鍵：安靜
- 同時按好幾個鍵時，以號碼最小的鍵為準`,
    circuit: [BTN('do', 2, 'Do'), BTN('re', 3, 'Re'), BTN('mi', 4, 'Mi'), { id: 'bz', type: 'buzzer', pin: 8, label: '蜂鳴器' }],
    compare: [{ kind: 'tone', pin: 8 }],
    cases: [
      { name: 'Do Re Mi', duration: 3000, events: '300 press do\n700 release do\n900 press re\n1300 release re\n1500 press mi\n1900 release mi', sample: true },
      { name: '同時按', duration: 3500, events: '200 press mi\n600 press re\n1000 press do\n1500 release do\n2000 release re\n2500 release mi' },
    ],
    solution: `void setup() {
  pinMode(2, INPUT_PULLUP);
  pinMode(3, INPUT_PULLUP);
  pinMode(4, INPUT_PULLUP);
}

void loop() {
  if (digitalRead(2) == LOW) tone(8, 262);
  else if (digitalRead(3) == LOW) tone(8, 294);
  else if (digitalRead(4) == LOW) tone(8, 330);
  else noTone(8);
  delay(10);
}
`,
  },
  {
    id: 'c504-bee', unit: 'u5', title: '小蜜蜂', level: 3, tags: ['蜂鳴器', '陣列'],
    desc: `用蜂鳴器（D8）彈「小蜜蜂」的第一句，開機後彈一次：

Sol Mi Mi、Fa Re Re、Do Re Mi Fa Sol Sol Sol

- 頻率：Do 262、Re 294、Mi 330、Fa 349、Sol 392（Hz）
- 每個音響 0.3 秒，接著安靜 0.1 秒（相同的音之間也要停）

提示：把 13 個音的頻率放進陣列，用 \`for\` 迴圈彈奏。`,
    circuit: [{ id: 'bz', type: 'buzzer', pin: 8, label: '蜂鳴器' }],
    compare: [{ kind: 'tone', pin: 8 }],
    cases: [{ name: '彈一次', duration: 6000, events: '', sample: true }],
    solution: `int song[] = {392, 330, 330, 349, 294, 294, 262, 294, 330, 349, 392, 392, 392};

void setup() {
  for (int i = 0; i < 13; i++) {
    tone(8, song[i]);
    delay(300);
    noTone(8);
    delay(100);
  }
}

void loop() {
}
`,
  },

  /* ------------------------------------------------------------ 6. 伺服 */
  {
    id: 'c601-door', unit: 'u6', title: '自動門', level: 2, tags: ['伺服馬達', '數位輸入'],
    desc: `伺服馬達（D9）控制一扇門，按鈕（D2，接 GND，請用 \`INPUT_PULLUP\`）是開門鈕：

- 開機時門是關的（0 度）
- 按下按鈕：門打開（90 度），停 3 秒後自動關上（0 度）`,
    circuit: [BTN('btn', 2, '開門鈕'), { id: 'door', type: 'servo', pin: 9, label: '門' }],
    compare: [{ kind: 'servo', pin: 9 }],
    cases: [
      { name: '開一次門', duration: 5000, events: '500 press btn\n700 release btn', sample: true },
      { name: '連續開門', duration: 9000, events: '300 press btn\n500 release btn\n4000 press btn\n4200 release btn' },
    ],
    solution: `#include <Servo.h>

Servo door;

void setup() {
  pinMode(2, INPUT_PULLUP);
  door.attach(9);
  door.write(0);
}

void loop() {
  if (digitalRead(2) == LOW) {
    door.write(90);
    delay(3000);
    door.write(0);
  }
}
`,
  },
  {
    id: 'c602-angle', unit: 'u6', title: '輸入角度轉馬達', level: 3, tags: ['伺服馬達', '序列埠'],
    desc: `從序列埠輸入角度（每行一個整數）控制伺服馬達（D9）：

- 開機時轉到 90 度
- 輸入 0～180：馬達轉到這個角度，輸出 \`ANGLE 角度\`（例如 \`ANGLE 45\`）
- 輸入超出範圍：輸出 \`ERROR\`，馬達不動`,
    circuit: [{ id: 'sv', type: 'servo', pin: 9, label: '伺服馬達' }],
    compare: [SERIAL, { kind: 'servo', pin: 9 }],
    cases: [
      { name: '範例', duration: 3500, events: '300 serial 45\\n', sample: true },
      { name: '各種角度', duration: 6000, events: '200 serial 0\\n\n900 serial 180\\n\n1600 serial 200\\n\n2300 serial -5\\n\n3000 serial 120\\n' },
    ],
    solution: `#include <Servo.h>

Servo sv;

void setup() {
  Serial.begin(9600);
  sv.attach(9);
  sv.write(90);
}

void loop() {
  if (Serial.available() > 0) {
    int a = Serial.parseInt();
    Serial.read();
    if (a >= 0 && a <= 180) {
      sv.write(a);
      Serial.print("ANGLE ");
      Serial.println(a);
    } else {
      Serial.println("ERROR");
    }
  }
}
`,
  },
  {
    id: 'c603-fan', unit: 'u6', title: '三段風向', level: 2, tags: ['伺服馬達', '類比輸入'],
    desc: `電風扇的擺頭用伺服馬達（D9）控制，旋鈕（可變電阻 A0）選擇方向：

- 讀值 0～340：0 度（左）
- 讀值 341～681：90 度（中）
- 讀值 682～1023：180 度（右）`,
    circuit: [{ id: 'knob', type: 'pot', pin: 14, label: '旋鈕', value: 0 }, { id: 'sv', type: 'servo', pin: 9, label: '風扇擺頭' }],
    compare: [{ kind: 'servo', pin: 9 }],
    cases: [
      { name: '左中右', duration: 3000, events: '0 set knob 100\n800 set knob 500\n1600 set knob 900\n2400 set knob 300', sample: true },
      { name: '邊界', duration: 3500, events: '0 set knob 340\n500 set knob 341\n1000 set knob 681\n1500 set knob 682\n2000 set knob 0' },
    ],
    solution: `#include <Servo.h>

Servo fan;

void setup() {
  fan.attach(9);
}

void loop() {
  int v = analogRead(A0);
  if (v <= 340) fan.write(0);
  else if (v <= 681) fan.write(90);
  else fan.write(180);
  delay(20);
}
`,
  },
  {
    id: 'c604-crossing', unit: 'u6', title: '平交道柵欄', level: 3, tags: ['伺服馬達', '蜂鳴器', '數位輸入'],
    desc: `火車快來時，平交道的柵欄會放下並響警鈴。偵測火車的感應器用按鈕（D2，接 GND，請用 \`INPUT_PULLUP\`）代替：

- 平常柵欄是升起的（伺服馬達 D9 在 0 度），警鈴（D8）安靜
- 感應到火車（按下按鈕）：柵欄放下（90 度），警鈴發出 800 Hz 的聲音
- 3 秒後：柵欄升起（0 度），警鈴停止`,
    circuit: [BTN('train', 2, '火車感應器'), { id: 'bar', type: 'servo', pin: 9, label: '柵欄' }, { id: 'bell', type: 'buzzer', pin: 8, label: '警鈴' }],
    compare: [{ kind: 'servo', pin: 9 }, { kind: 'tone', pin: 8 }],
    cases: [
      { name: '火車經過', duration: 5000, events: '500 press train\n700 release train', sample: true },
      { name: '兩班火車', duration: 9000, events: '300 press train\n500 release train\n4500 press train\n4700 release train' },
    ],
    solution: `#include <Servo.h>

Servo bar;

void setup() {
  pinMode(2, INPUT_PULLUP);
  bar.attach(9);
  bar.write(0);
}

void loop() {
  if (digitalRead(2) == LOW) {
    bar.write(90);
    tone(8, 800);
    delay(3000);
    bar.write(0);
    noTone(8);
  }
}
`,
  },

  /* ------------------------------------------------------------ 7. WS2812 */
  {
    id: 'c701-rgbstrip', unit: 'u7', title: '燈條三色輪播', level: 2, tags: ['WS2812'],
    desc: `8 顆的 WS2812 燈條接 D6。讓整條燈：

- 全部紅色（255, 0, 0）1 秒
- 全部綠色（0, 255, 0）1 秒
- 全部藍色（0, 0, 255）1 秒
- 不斷重複

提示：\`strip.fill(strip.Color(紅, 綠, 藍));\` 可以一次設定全部燈，記得 \`strip.show()\`。`,
    circuit: [{ id: 'strip', type: 'ws2812', pin: 6, count: 8, label: '燈條' }],
    compare: [{ kind: 'pixels', pin: 6 }],
    cases: [{ name: '兩輪', duration: 6500, events: '', sample: true }],
    solution: `#include <Adafruit_NeoPixel.h>

Adafruit_NeoPixel strip(8, 6, NEO_GRB + NEO_KHZ800);

void setup() {
  strip.begin();
}

void loop() {
  strip.fill(strip.Color(255, 0, 0));
  strip.show();
  delay(1000);
  strip.fill(strip.Color(0, 255, 0));
  strip.show();
  delay(1000);
  strip.fill(strip.Color(0, 0, 255));
  strip.show();
  delay(1000);
}
`,
  },
  {
    id: 'c702-rainbow', unit: 'u7', title: '彩虹六色', level: 2, tags: ['WS2812', '陣列'],
    desc: `6 顆的 WS2812 燈條接 D6。開機後讓第 0～5 顆依序顯示彩虹的顏色，之後保持不變：

- 第 0 顆 紅（255, 0, 0）
- 第 1 顆 橙（255, 128, 0）
- 第 2 顆 黃（255, 255, 0）
- 第 3 顆 綠（0, 255, 0）
- 第 4 顆 藍（0, 0, 255）
- 第 5 顆 紫（128, 0, 255）`,
    circuit: [{ id: 'strip', type: 'ws2812', pin: 6, count: 6, label: '燈條' }],
    compare: [{ kind: 'pixels', pin: 6 }],
    cases: [{ name: '彩虹', duration: 1500, events: '', sample: true }],
    solution: `#include <Adafruit_NeoPixel.h>

Adafruit_NeoPixel strip(6, 6, NEO_GRB + NEO_KHZ800);

void setup() {
  strip.begin();
  strip.setPixelColor(0, strip.Color(255, 0, 0));
  strip.setPixelColor(1, strip.Color(255, 128, 0));
  strip.setPixelColor(2, strip.Color(255, 255, 0));
  strip.setPixelColor(3, strip.Color(0, 255, 0));
  strip.setPixelColor(4, strip.Color(0, 0, 255));
  strip.setPixelColor(5, strip.Color(128, 0, 255));
  strip.show();
}

void loop() {
}
`,
  },
  {
    id: 'c703-scanner', unit: 'u7', title: '霹靂車掃描燈', level: 3, tags: ['WS2812', 'for 迴圈'],
    desc: `8 顆的 WS2812 燈條接 D6。讓一顆紅色（255, 0, 0）光點來回移動：

- 從第 0 顆走到第 7 顆，再走回第 1 顆，接著又從第 0 顆開始……
- 也就是位置依序是 0、1、2、…、7、6、5、…、1，然後重複
- 每 80 毫秒移動一格，同一時間只有一顆亮`,
    circuit: [{ id: 'strip', type: 'ws2812', pin: 6, count: 8, label: '燈條' }],
    compare: [{ kind: 'pixels', pin: 6 }],
    cases: [{ name: '來回兩次', duration: 2400, events: '', sample: true }],
    solution: `#include <Adafruit_NeoPixel.h>

Adafruit_NeoPixel strip(8, 6, NEO_GRB + NEO_KHZ800);

void show(int pos) {
  strip.clear();
  strip.setPixelColor(pos, strip.Color(255, 0, 0));
  strip.show();
  delay(80);
}

void setup() {
  strip.begin();
}

void loop() {
  for (int i = 0; i <= 7; i++) show(i);
  for (int i = 6; i >= 1; i--) show(i);
}
`,
  },
  {
    id: 'c704-colorbtn', unit: 'u7', title: '按鈕換燈色', level: 3, tags: ['WS2812', '數位輸入', '狀態'],
    desc: `8 顆的 WS2812 燈條接 D6，按鈕接 D2（接 GND，請用 \`INPUT_PULLUP\`）。

- 開機時燈條全暗
- 每按一下，整條燈依序換成：紅（255, 0, 0）→ 綠（0, 255, 0）→ 藍（0, 0, 255）→ 全暗 → 紅……
- 按住不放只算一下`,
    circuit: [BTN('btn', 2, '按鈕'), { id: 'strip', type: 'ws2812', pin: 6, count: 8, label: '燈條' }],
    compare: [{ kind: 'pixels', pin: 6 }],
    cases: [
      { name: '按四下', duration: 3500, events: '300 press btn\n500 release btn\n1000 press btn\n1200 release btn\n1700 press btn\n1900 release btn\n2400 press btn\n2600 release btn', sample: true },
      { name: '長按與連按', duration: 4000, events: '200 press btn\n1500 release btn\n1700 press btn\n1800 release btn\n2000 press btn\n2100 release btn\n2300 press btn\n2400 release btn\n2600 press btn\n2700 release btn' },
    ],
    solution: `#include <Adafruit_NeoPixel.h>

Adafruit_NeoPixel strip(8, 6, NEO_GRB + NEO_KHZ800);
int mode = 0;
int lastState = HIGH;

void setup() {
  pinMode(2, INPUT_PULLUP);
  strip.begin();
  strip.show();
}

void loop() {
  int s = digitalRead(2);
  if (lastState == HIGH && s == LOW) {
    mode = (mode + 1) % 4;
    if (mode == 1) strip.fill(strip.Color(255, 0, 0));
    else if (mode == 2) strip.fill(strip.Color(0, 255, 0));
    else if (mode == 3) strip.fill(strip.Color(0, 0, 255));
    else strip.clear();
    strip.show();
  }
  lastState = s;
  delay(10);
}
`,
  },

  /* ------------------------------------------------------------ 8. 綜合 */
  {
    id: 'c801-smartlight', unit: 'u8', title: '感應式小夜燈', level: 3, tags: ['類比輸入', '數位輸入', '邏輯運算'],
    desc: `走廊的小夜燈要「天黑」而且「有人經過」才會亮。光敏電阻接 A1（越亮讀值越大），人體感應器用開關（D2，接 GND，請用 \`INPUT_PULLUP\`，開關打開＝有人）代替，燈接 D13：

- 讀值 < 300 而且有人：燈亮
- 其他情況：燈熄

提示：「而且」用 \`&&\`。`,
    circuit: [{ id: 'ldr', type: 'ldr', pin: 15, label: '光敏電阻', value: 800 }, { id: 'pir', type: 'switch', pin: 2, wiring: 'pullup', label: '人體感應' }, LED('led1', 13, 'yellow', '小夜燈')],
    compare: [PIN(13)],
    cases: [
      { name: '晚上有人經過', duration: 3000, events: '0 set ldr 800\n500 toggle pir\n1000 set ldr 100\n2000 toggle pir', sample: true },
      { name: '各種組合', duration: 4000, events: '0 set ldr 100\n600 toggle pir\n1200 set ldr 300\n1800 set ldr 299\n2400 toggle pir\n3000 set ldr 50' },
    ],
    solution: `void setup() {
  pinMode(2, INPUT_PULLUP);
  pinMode(13, OUTPUT);
}

void loop() {
  bool dark = analogRead(A1) < 300;
  bool someone = digitalRead(2) == LOW;
  digitalWrite(13, dark && someone);
  delay(20);
}
`,
  },
  {
    id: 'c802-score', unit: 'u8', title: '比賽計分板', level: 3, tags: ['數位輸入', '序列埠', '狀態'],
    desc: `兩隊比賽的計分板。A 隊加分鈕接 D2、B 隊加分鈕接 D3、歸零鈕接 D4（都接 GND，請用 \`INPUT_PULLUP\`）。

- 開機時先輸出 \`0:0\`
- 每按一下加分鈕，該隊加 1 分，並輸出目前比分，格式是「A 隊分數:B 隊分數」，例如 \`2:1\`
- 按歸零：兩隊都變 0 分，輸出 \`0:0\`
- 按住不放只算一下`,
    circuit: [BTN('a', 2, 'A 隊'), BTN('b', 3, 'B 隊'), BTN('zero', 4, '歸零')],
    compare: [SERIAL],
    cases: [
      { name: '範例', duration: 3000, events: '300 press a\n400 release a\n800 press b\n900 release b\n1300 press a\n1400 release a', sample: true },
      { name: '比賽到歸零', duration: 5000, events: '200 press b\n300 release b\n500 press b\n1500 release b\n1700 press a\n1800 release a\n2100 press zero\n2200 release zero\n2600 press a\n2700 release a\n3000 press a\n3100 release a' },
    ],
    solution: `int a = 0, b = 0;
int lastA = HIGH, lastB = HIGH, lastZ = HIGH;

void report() {
  Serial.print(a);
  Serial.print(":");
  Serial.println(b);
}

void setup() {
  pinMode(2, INPUT_PULLUP);
  pinMode(3, INPUT_PULLUP);
  pinMode(4, INPUT_PULLUP);
  Serial.begin(9600);
  report();
}

void loop() {
  int sa = digitalRead(2), sb = digitalRead(3), sz = digitalRead(4);
  if (lastA == HIGH && sa == LOW) { a++; report(); }
  if (lastB == HIGH && sb == LOW) { b++; report(); }
  if (lastZ == HIGH && sz == LOW) { a = 0; b = 0; report(); }
  lastA = sa; lastB = sb; lastZ = sz;
  delay(10);
}
`,
  },
  {
    id: 'c803-garden', unit: 'u8', title: '自動澆花系統', level: 3, tags: ['類比輸入', '伺服馬達', '序列埠'],
    desc: `土壤濕度感測器用可變電阻（A0）代替，讀值越小越乾。伺服馬達（D9）控制水閥：

- 讀值 < 400（太乾）：水閥打開（90 度），從序列埠輸出 \`WATER\`
- 讀值 ≥ 400：水閥關閉（0 度），輸出 \`STOP\`
- 只有「狀態改變」時才輸出；開機時水閥是關的（0 度），如果一開機就太乾，要立刻打開並輸出 \`WATER\``,
    circuit: [{ id: 'soil', type: 'pot', pin: 14, label: '濕度感測器', value: 700 }, { id: 'valve', type: 'servo', pin: 9, label: '水閥' }],
    compare: [SERIAL, { kind: 'servo', pin: 9 }],
    cases: [
      { name: '土乾了', duration: 3000, events: '0 set soil 700\n800 set soil 300\n1800 set soil 650', sample: true },
      { name: '一開機就很乾', duration: 3500, events: '0 set soil 100\n700 set soil 399\n1400 set soil 400\n2100 set soil 399' },
    ],
    solution: `#include <Servo.h>

Servo valve;
bool watering = false;

void setup() {
  Serial.begin(9600);
  valve.attach(9);
  valve.write(0);
}

void loop() {
  bool dry = analogRead(A0) < 400;
  if (dry && !watering) {
    watering = true;
    valve.write(90);
    Serial.println("WATER");
  } else if (!dry && watering) {
    watering = false;
    valve.write(0);
    Serial.println("STOP");
  }
  delay(20);
}
`,
  },
  {
    id: 'c804-parking', unit: 'u8', title: '停車場空位顯示', level: 4, tags: ['數位輸入', '序列埠', '狀態'],
    desc: `停車場有 5 個車位。入口感應器用按鈕 D2、出口感應器用按鈕 D3（都接 GND，請用 \`INPUT_PULLUP\`）。綠燈 D11 表示「有空位」，紅燈 D12 表示「客滿」。

- 開機時有 5 個空位，輸出 \`SPACE 5\`，綠燈亮
- 有車進來（按 D2）：空位減 1，輸出 \`SPACE 剩餘數\`
- 有車出去（按 D3）：空位加 1，輸出 \`SPACE 剩餘數\`
- 空位是 0 時：紅燈亮、綠燈熄；這時再有車要進來，輸出 \`FULL\`，空位不變
- 空位已經是 5 時，出口再按不做任何事
- 按住不放只算一下`,
    circuit: [BTN('in', 2, '入口'), BTN('out', 3, '出口'), LED('green', 11, 'green', '有空位'), LED('red', 12, 'red', '客滿')],
    compare: [SERIAL, PIN(11), PIN(12)],
    cases: [
      { name: '進來兩台', duration: 2500, events: '300 press in\n400 release in\n800 press in\n900 release in', sample: true },
      { name: '停滿了', duration: 6000, events: '200 press in\n300 release in\n500 press in\n600 release in\n800 press in\n900 release in\n1100 press in\n1200 release in\n1400 press in\n1500 release in\n1800 press in\n1900 release in\n2300 press out\n2400 release out\n2800 press in\n3500 release in' },
      { name: '出口多按', duration: 3000, events: '200 press out\n300 release out\n600 press in\n700 release in\n1000 press out\n1100 release out\n1400 press out\n1500 release out' },
    ],
    solution: `int space = 5;
int lastIn = HIGH, lastOut = HIGH;

void lights() {
  digitalWrite(11, space > 0);
  digitalWrite(12, space == 0);
}

void setup() {
  pinMode(2, INPUT_PULLUP);
  pinMode(3, INPUT_PULLUP);
  pinMode(11, OUTPUT);
  pinMode(12, OUTPUT);
  Serial.begin(9600);
  Serial.println("SPACE 5");
  lights();
}

void loop() {
  int si = digitalRead(2), so = digitalRead(3);
  if (lastIn == HIGH && si == LOW) {
    if (space > 0) {
      space--;
      Serial.print("SPACE ");
      Serial.println(space);
    } else {
      Serial.println("FULL");
    }
  }
  if (lastOut == HIGH && so == LOW && space < 5) {
    space++;
    Serial.print("SPACE ");
    Serial.println(space);
  }
  lastIn = si; lastOut = so;
  lights();
  delay(10);
}
`,
  },
);

AJ.LEVEL_NAMES = AJ.LEVEL_NAMES || { 1: '入門', 2: '基礎', 3: '應用', 4: '挑戰' };
})(typeof window !== 'undefined' ? window : globalThis);
