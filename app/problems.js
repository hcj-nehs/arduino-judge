/* 內建範例題目。老師自訂的題目存放在雲端（Claude 資料庫或 Google 試算表） */
(function (G) {
'use strict';
const AJ = G.AJ = G.AJ || {};

const STARTER = `void setup() {
  // 這裡的程式只會在開機時執行一次

}

void loop() {
  // 這裡的程式會一直重複執行

}
`;

AJ.STARTER = STARTER;
AJ.BUILTIN_PROBLEMS = [
  {
    id: 'b01-blink', title: '閃爍的 LED', level: 1, tags: ['數位輸出'],
    desc: `讓接在 D13 的 LED 不停閃爍：亮 0.5 秒、暗 0.5 秒，一直重複。

- 開機後 LED 先亮
- 使用 \`pinMode\`、\`digitalWrite\`、\`delay\``,
    circuit: [{ id: 'led1', type: 'led', pin: 13, color: 'red', label: 'LED' }],
    compare: [{ kind: 'pin', pin: 13 }],
    cases: [{ name: '閃爍 5 秒', duration: 5000, events: '', sample: true }],
    solution: `void setup() {
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);
  delay(500);
  digitalWrite(13, LOW);
  delay(500);
}
`,
  },
  {
    id: 'b02-traffic', title: '紅綠燈', level: 1, tags: ['數位輸出'],
    desc: `做一個紅綠燈，依照下面的順序不斷循環：

- 綠燈亮 3 秒
- 黃燈亮 1 秒
- 紅燈亮 3 秒

同一時間只能有一個燈亮。開機時從綠燈開始。`,
    circuit: [
      { id: 'red', type: 'led', pin: 4, color: 'red', label: '紅燈' },
      { id: 'yellow', type: 'led', pin: 3, color: 'yellow', label: '黃燈' },
      { id: 'green', type: 'led', pin: 2, color: 'green', label: '綠燈' },
    ],
    compare: [{ kind: 'pin', pin: 2 }, { kind: 'pin', pin: 3 }, { kind: 'pin', pin: 4 }],
    cases: [{ name: '完整兩輪', duration: 15000, events: '', sample: true }],
    solution: `const int RED = 4, YELLOW = 3, GREEN = 2;

void setup() {
  pinMode(RED, OUTPUT);
  pinMode(YELLOW, OUTPUT);
  pinMode(GREEN, OUTPUT);
}

void light(int pin, int ms) {
  digitalWrite(pin, HIGH);
  delay(ms);
  digitalWrite(pin, LOW);
}

void loop() {
  light(GREEN, 3000);
  light(YELLOW, 1000);
  light(RED, 3000);
}
`,
  },
  {
    id: 'b03-button', title: '按住才會亮', level: 1, tags: ['數位輸入'],
    desc: `按鈕接在 D2，另一端接 GND（請使用 \`INPUT_PULLUP\`）。

按住按鈕時，D13 的 LED 亮；放開按鈕時，LED 熄滅。

提示：使用 INPUT_PULLUP 時，按下讀到 \`LOW\`，放開讀到 \`HIGH\`。`,
    circuit: [
      { id: 'btn', type: 'button', pin: 2, wiring: 'pullup', label: '按鈕' },
      { id: 'led1', type: 'led', pin: 13, color: 'red', label: 'LED' },
    ],
    compare: [{ kind: 'pin', pin: 13 }],
    cases: [
      { name: '按兩次', duration: 3000, events: '500 press btn\n1200 release btn\n1800 press btn\n2400 release btn', sample: true },
      { name: '長按', duration: 4000, events: '300 press btn\n3500 release btn' },
      { name: '快速點按', duration: 3000, events: '200 press btn\n350 release btn\n600 press btn\n750 release btn\n1000 press btn\n1100 release btn\n2000 press btn' },
    ],
    solution: `void setup() {
  pinMode(2, INPUT_PULLUP);
  pinMode(13, OUTPUT);
}

void loop() {
  if (digitalRead(2) == LOW) {
    digitalWrite(13, HIGH);
  } else {
    digitalWrite(13, LOW);
  }
}
`,
  },
  {
    id: 'b04-toggle', title: '按一下切換開關', level: 2, tags: ['數位輸入', '狀態'],
    desc: `按鈕接在 D2（另一端接 GND，請使用 \`INPUT_PULLUP\`），LED 接在 D13。

開機時 LED 是暗的。每「按下」一次按鈕，LED 就切換一次（暗→亮→暗…）。按住不放不會一直切換。

提示：記住上一次讀到的按鈕狀態，當狀態從 HIGH 變成 LOW 的那一刻才切換。`,
    circuit: [
      { id: 'btn', type: 'button', pin: 2, wiring: 'pullup', label: '按鈕' },
      { id: 'led1', type: 'led', pin: 13, color: 'green', label: 'LED' },
    ],
    compare: [{ kind: 'pin', pin: 13 }],
    cases: [
      { name: '按三下', duration: 4000, events: '500 press btn\n800 release btn\n1500 press btn\n1700 release btn\n2500 press btn\n3500 release btn', sample: true },
      { name: '按住很久', duration: 4000, events: '300 press btn\n3000 release btn\n3400 press btn\n3600 release btn' },
      { name: '連按', duration: 3000, events: '200 press btn\n300 release btn\n500 press btn\n600 release btn\n800 press btn\n900 release btn\n1100 press btn\n1200 release btn\n1400 press btn\n1500 release btn' },
    ],
    solution: `int lastState = HIGH;
bool ledOn = false;

void setup() {
  pinMode(2, INPUT_PULLUP);
  pinMode(13, OUTPUT);
}

void loop() {
  int state = digitalRead(2);
  if (lastState == HIGH && state == LOW) {
    ledOn = !ledOn;
    digitalWrite(13, ledOn ? HIGH : LOW);
  }
  lastState = state;
  delay(10);
}
`,
  },
  {
    id: 'b05-sum', title: '序列埠加法器', level: 1, tags: ['序列埠'],
    desc: `從序列埠讀入一行，裡面有兩個整數 a 和 b（用空白隔開，行尾是換行字元）。請輸出 a + b 的結果，並換行。

每一筆測資可能會陸續送入好幾行，每收到一行就輸出一個答案。

- 範圍：-100000 ≤ a, b ≤ 100000（注意：UNO 的 int 只有 16 位元！）
- 序列埠鮑率 9600

範例輸入：
\`3 5\`

範例輸出：
\`8\``,
    circuit: [],
    compare: [{ kind: 'serial', mode: 'lines' }],
    cases: [
      { name: '範例', duration: 3500, events: '100 serial 3 5\\n', sample: true },
      { name: '負數與多行', duration: 4500, events: '100 serial -12 40\\n\n800 serial 7 8\\n\n1500 serial 0 0\\n' },
      { name: '大數字', duration: 3500, events: '100 serial 30000 30000\\n\n700 serial -100000 99999\\n' },
    ],
    solution: `void setup() {
  Serial.begin(9600);
}

void loop() {
  if (Serial.available() > 0) {
    long a = Serial.parseInt();
    long b = Serial.parseInt();
    Serial.read();            // 讀掉換行字元
    Serial.println(a + b);
  }
}
`,
  },
  {
    id: 'b06-grade', title: '成績等第轉換', level: 2, tags: ['序列埠', '條件判斷'],
    desc: `從序列埠讀入一個 0~100 的整數分數（每行一個），依照下表輸出等第，每個等第一行：

- 90 分以上：A
- 80 ~ 89：B
- 70 ~ 79：C
- 60 ~ 69：D
- 59 分以下：F

範例輸入：
\`95\`

範例輸出：
\`A\``,
    circuit: [],
    compare: [{ kind: 'serial', mode: 'lines' }],
    cases: [
      { name: '範例', duration: 3500, events: '100 serial 95\\n', sample: true },
      { name: '邊界值', duration: 6000, events: '100 serial 90\\n\n500 serial 89\\n\n900 serial 80\\n\n1300 serial 79\\n\n1700 serial 70\\n\n2100 serial 60\\n\n2500 serial 59\\n\n2900 serial 0\\n\n3300 serial 100\\n' },
    ],
    solution: `void setup() {
  Serial.begin(9600);
}

void loop() {
  if (Serial.available() > 0) {
    int s = Serial.parseInt();
    Serial.read();
    if (s >= 90) Serial.println("A");
    else if (s >= 80) Serial.println("B");
    else if (s >= 70) Serial.println("C");
    else if (s >= 60) Serial.println("D");
    else Serial.println("F");
  }
}
`,
  },
  {
    id: 'b07-dimmer', title: '旋鈕調光', level: 2, tags: ['類比輸入', 'PWM'],
    desc: `可變電阻接在 A0，LED 接在 D9（支援 PWM）。

讀取可變電阻的值（0~1023），換算成 0~255 的亮度，用 \`analogWrite\` 控制 LED。

換算方式：亮度 = 讀值 / 4（或使用 \`map()\`）。`,
    circuit: [
      { id: 'pot', type: 'pot', pin: 14, label: '可變電阻', value: 0 },
      { id: 'led1', type: 'led', pin: 9, color: 'yellow', label: 'LED' },
    ],
    compare: [{ kind: 'pin', pin: 9 }],
    cases: [
      { name: '慢慢轉', duration: 3000, events: '0 set pot 0\n500 set pot 256\n1000 set pot 512\n1500 set pot 768\n2000 set pot 1023', sample: true },
      { name: '來回轉', duration: 3000, events: '0 set pot 1023\n600 set pot 100\n1200 set pot 900\n1800 set pot 3\n2400 set pot 640' },
    ],
    solution: `void setup() {
  pinMode(9, OUTPUT);
}

void loop() {
  int v = analogRead(A0);
  analogWrite(9, v / 4);
  delay(10);
}
`,
  },
  {
    id: 'b08-nightlight', title: '光敏小夜燈', level: 2, tags: ['類比輸入'],
    desc: `光敏電阻接在 A1，環境越亮讀值越大（0~1023）。LED 接在 D13。

當讀值小於 300（天黑）時，LED 亮；讀值大於等於 300 時，LED 熄滅。

同時，每當 LED 狀態改變時，從序列埠輸出一行：亮燈輸出 \`ON\`，熄燈輸出 \`OFF\`（開機時燈是暗的，不需要輸出）。`,
    circuit: [
      { id: 'ldr', type: 'ldr', pin: 15, label: '光敏電阻', value: 800 },
      { id: 'led1', type: 'led', pin: 13, color: 'white', label: '小夜燈' },
    ],
    compare: [{ kind: 'pin', pin: 13 }, { kind: 'serial', mode: 'lines' }],
    cases: [
      { name: '天黑又天亮', duration: 3000, events: '0 set ldr 800\n800 set ldr 120\n2000 set ldr 650', sample: true },
      { name: '邊界', duration: 4000, events: '0 set ldr 300\n500 set ldr 299\n1000 set ldr 300\n1500 set ldr 0\n2500 set ldr 1023\n3000 set ldr 250' },
    ],
    solution: `bool on = false;

void setup() {
  pinMode(13, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int v = analogRead(A1);
  bool dark = v < 300;
  if (dark != on) {
    on = dark;
    digitalWrite(13, on ? HIGH : LOW);
    Serial.println(on ? "ON" : "OFF");
  }
  delay(20);
}
`,
  },
  {
    id: 'b09-rgb', title: 'RGB 三色輪播', level: 1, tags: ['數位輸出', 'RGB'],
    desc: `RGB LED（共陰極）的紅、綠、藍分別接在 D9、D10、D11，輸出 HIGH 時該顏色會亮。

讓 RGB LED 依序顯示：紅色 1 秒 → 綠色 1 秒 → 藍色 1 秒，不斷重複。`,
    circuit: [{ id: 'rgb1', type: 'rgb', r: 9, g: 10, b: 11, label: 'RGB LED' }],
    compare: [{ kind: 'pin', pin: 9 }, { kind: 'pin', pin: 10 }, { kind: 'pin', pin: 11 }],
    cases: [{ name: '兩輪', duration: 7000, events: '', sample: true }],
    solution: `void setColor(int r, int g, int b) {
  digitalWrite(9, r);
  digitalWrite(10, g);
  digitalWrite(11, b);
}

void setup() {
  pinMode(9, OUTPUT);
  pinMode(10, OUTPUT);
  pinMode(11, OUTPUT);
}

void loop() {
  setColor(HIGH, LOW, LOW);
  delay(1000);
  setColor(LOW, HIGH, LOW);
  delay(1000);
  setColor(LOW, LOW, HIGH);
  delay(1000);
}
`,
  },
  {
    id: 'b10-doorbell', title: '按鈕門鈴', level: 2, tags: ['蜂鳴器', '數位輸入'],
    desc: `按鈕接在 D2（另一端接 GND，請使用 \`INPUT_PULLUP\`），無源蜂鳴器接在 D8。

按住按鈕時，蜂鳴器發出 1000 Hz 的聲音（\`tone\`）；放開時停止發聲（\`noTone\`）。`,
    circuit: [
      { id: 'btn', type: 'button', pin: 2, wiring: 'pullup', label: '門鈴按鈕' },
      { id: 'bz', type: 'buzzer', pin: 8, label: '蜂鳴器' },
    ],
    compare: [{ kind: 'tone', pin: 8 }],
    cases: [
      { name: '按兩下', duration: 3000, events: '400 press btn\n1000 release btn\n1600 press btn\n2600 release btn', sample: true },
      { name: '長按', duration: 3000, events: '100 press btn\n2800 release btn' },
    ],
    solution: `void setup() {
  pinMode(2, INPUT_PULLUP);
}

void loop() {
  if (digitalRead(2) == LOW) {
    tone(8, 1000);
  } else {
    noTone(8);
  }
  delay(10);
}
`,
  },
  {
    id: 'b11-servo', title: '旋鈕控制伺服馬達', level: 2, tags: ['伺服馬達', '類比輸入'],
    desc: `可變電阻接在 A0，伺服馬達的訊號線接在 D9。

讀取可變電阻（0~1023），用 \`map()\` 換算成 0~180 度，讓伺服馬達轉到對應的角度。

需要 \`#include <Servo.h>\`。`,
    circuit: [
      { id: 'pot', type: 'pot', pin: 14, label: '可變電阻', value: 512 },
      { id: 'sv', type: 'servo', pin: 9, label: '伺服馬達' },
    ],
    compare: [{ kind: 'servo', pin: 9 }],
    cases: [
      { name: '轉一圈', duration: 3000, events: '0 set pot 0\n500 set pot 341\n1000 set pot 682\n1500 set pot 1023\n2000 set pot 512', sample: true },
      { name: '隨意轉', duration: 3000, events: '0 set pot 1000\n700 set pot 30\n1400 set pot 600\n2100 set pot 777' },
    ],
    solution: `#include <Servo.h>

Servo myServo;

void setup() {
  myServo.attach(9);
}

void loop() {
  int v = analogRead(A0);
  int angle = map(v, 0, 1023, 0, 180);
  myServo.write(angle);
  delay(15);
}
`,
  },
  {
    id: 'b12-chaser', title: 'WS2812 跑馬燈', level: 3, tags: ['WS2812', '迴圈'],
    desc: `8 顆 WS2812B 全彩燈條接在 D6。

讓一顆紅色（255, 0, 0）的光點從第 0 顆跑到第 7 顆，每 100 毫秒前進一格；跑到最後一顆後再從第 0 顆開始。同一時間只有一顆燈亮。

需要 \`#include <Adafruit_NeoPixel.h>\`，建立物件：
\`Adafruit_NeoPixel strip(8, 6, NEO_GRB + NEO_KHZ800);\``,
    circuit: [{ id: 'strip', type: 'ws2812', pin: 6, count: 8, label: '燈條' }],
    compare: [{ kind: 'pixels', pin: 6 }],
    cases: [{ name: '跑兩圈', duration: 2400, events: '', sample: true }],
    solution: `#include <Adafruit_NeoPixel.h>

Adafruit_NeoPixel strip(8, 6, NEO_GRB + NEO_KHZ800);
int pos = 0;

void setup() {
  strip.begin();
}

void loop() {
  strip.clear();
  strip.setPixelColor(pos, strip.Color(255, 0, 0));
  strip.show();
  delay(100);
  pos = (pos + 1) % 8;
}
`,
  },
];

AJ.PLAYGROUND_DEFAULT = {
  circuit: [
    { id: 'led1', type: 'led', pin: 13, color: 'red', label: 'LED' },
    { id: 'btn', type: 'button', pin: 2, wiring: 'pullup', label: '按鈕' },
    { id: 'pot', type: 'pot', pin: 14, label: '可變電阻', value: 512 },
  ],
  code: `// 自由練習：左邊寫程式，右邊可以增減元件
void setup() {
  pinMode(13, OUTPUT);
  pinMode(2, INPUT_PULLUP);
  Serial.begin(9600);
  Serial.println("Hello Arduino!");
}

void loop() {
  int v = analogRead(A0);
  if (digitalRead(2) == LOW) {
    digitalWrite(13, HIGH);
    Serial.print("按鈕按下，A0 = ");
    Serial.println(v);
    delay(300);
  } else {
    digitalWrite(13, LOW);
  }
}
`,
};
})(typeof window !== 'undefined' ? window : globalThis);
